# Qwen Code adapter — backlog

Branch: `feat/qwen-code-adapter`. Status: increment 1 done (research + adapter
source); build integration and runtime binding not started.

Goal: an installation method for Qwen Code mirroring the OpenCode adapter
(`adapters/opencode/`), so the flat model config (roles → `provider/model#effort`,
plus the optional `coordinator` key — see `examples/example.json`) can be
materialized for the Qwen Code host. Supported model sources, by decision:
**local llama** (OpenAI-compatible provider, direct), **the Qwen Code / Alibaba
token plan** (direct), and **OpenAI models via the Codex external executor**.
Nothing else is wired up.

## Findings (verified 2026-11-26 against Qwen Code 0.28.6)

### Host capabilities

- **Agent definitions** live at `.qwen/agents/*.md` (project) and
  `~/.qwen/agents/*.md` (user). Supported frontmatter: `name`, `description`,
  `model` (`inherit` | `fast` | `modelId` | `authType:modelId`), `approvalMode`
  (`default|plan|auto-edit|yolo|bubble`), `tools` (allowlist),
  `disallowedTools` (blocklist; also blocks deferred-bridge invocation),
  `maxTurns` (positive int → `runConfig.max_turns`), `background`, and
  `executor` (`kind: codex|acp`, `command`, `args`). Name rule (parser
  message): 1–64 lowercase letters/numbers/dots/hyphens, no leading/trailing/
  consecutive separators, and **must exactly match the filename**. The
  CC-compat `effort` field is documented as *not yet implemented*.
- **No per-invocation model parameter** on the Agent tool: the installed
  executor builds `thread/start` without a model, and the tool schema has no
  model field. The model is therefore fixed in the definition at install time —
  the same "mandatory shim" property that makes OpenCode V2 materialize
  profiles.
- **Codex external executor**: `executor.kind: codex` spawns
  `command` + `args` (default `["app-server","--stdio"]`), verbatim. Qwen
  `model`/`tools`/`maxTurns` are *not* applied to external executors, so the
  model is pinned through CLI `-c key=value` config overrides in `args`.
  Verified natively: with
  `-c model="gpt-6.2-sol" -c model_reasoning_effort="high"`, the `thread/start`
  response reports `model: gpt-6.2-sol, reasoningEffort: high`. Codex tasks are
  **one-shot** (no messages/resume), require a trusted workspace, and are
  unavailable in container execution mode. One-shot matches the workflow's
  fresh-context worker semantics.
- **Commands**: `.qwen/commands/<path>.md` → `/<colon-joined>` with `{{args}}`.
  Not needed here (see decision D6).
- **Skills**: `.qwen/skills/<name>/SKILL.md`; a skill is itself exposed as the
  slash command `/<name>` (user-invocable by default; `disable-model-invocation`
  keeps it explicit-only). This is the invocation surface — unlike OpenCode, no
  separate command entries are required.
- **Providers**: custom provider ids (e.g. `local-llama`, `alibaba-token-plan`)
  are registered once in the user's `settings.json` via `modelProviders` +
  `providerProtocol` (OpenAI-compatible). Agent `model:` values use
  `provider:modelId` to select across providers.
- **Reasoning effort**: `model.reasoningEffort` is **session-global** (set via
  `/effort`); there is **no per-agent effort field** yet. The `#effort` of a
  direct-provider role therefore cannot be materialized per profile (gap G1).

### Mapping the flat model config

| Config form | Rendered qwen-code frontmatter |
| --- | --- |
| `openai/<model>#<effort>` | `executor:` block (kind codex) with `-c model="<model>"` and `-c model_reasoning_effort="<clamped>"` |
| `<provider>/<model>` (provider ≠ openai) | `model: <provider>:<model>` (provider must be registered in user settings) |
| `<provider>/<model>#<effort>` (provider ≠ openai) | `model: <provider>:<model>`; effort **not materialized** (gap G1 — runs at the session's `/effort` selection) |
| role unlisted | no `model:` line, no executor → inherits session model (codex roles cannot inherit: the executor always needs a model, so an unlisted openai-routed role renders no profile model and inherits only when the provider is not the codex-routed one) |

## Design decisions

- **D1 — Agent namespace `agenticale-<role>`.** Colons and slashes are invalid
  in agent names and the name must match the filename, so the rendered file
  `agents/agenticale/<role>.md` carries `name: agenticale-<role>` and is
  dispatched with `subagent_type: "agenticale-<role>"`.
- **D2 — `steps` → `maxTurns`**, same numeric ceilings (24/64/48/56/72/20) as
  the OpenCode profiles.
- **D3 — Permission mapping.** `subagent` deny → `disallowedTools: ["agent"]`
  (blocks direct and deferred-bridge invocation per the tool-config docs);
  `edit` deny → `disallowedTools: ["write_file","edit","notebook_edit"]`
  (shell stays available, matching the OpenCode policy of denying edit actions
  only); `question` deny → no field (named subagents are already declared
  without interactive question tools).
- **D4 — `background: false`** on worker profiles: rounds dispatch
  synchronously and read the child's inline result.
- **D5 — `approvalMode` left unset.** The host auto-derives it (permissive
  parent stays permissive; default parent yields auto-edit), and a stricter
  value would never win over a permissive parent, so pinning it would be
  misleading.
- **D6 — No command entries.** Qwen Code exposes skills as slash commands
  (`/work`, `/review`, `/autonomous`, `/configure`), so shipping
  `.qwen/commands/` files would create duplicate names for the same surface.
- **D7 — Coordinator = session model + posture body.** Qwen Code has no
  "primary agent runs the session" concept. When the config carries
  `coordinator`, the build renders the coordinator agent file (same conditional
  rule as OpenCode) and the runtime binding instructs the coordinating session
  to run on the coordinator's model (session-scoped model switch, never a
  global settings rewrite) and adopt the installed coordinator body.
- **D8 — Codex routing key `codexProviderPrefix: "openai"`** in
  `adapter.json`: model values whose provider equals it render as executor
  blocks; every other provider renders a direct `model:` line.
- **D9 — Effort clamp for codex roles.** Codex's accepted
  `model_reasoning_effort` values are not yet confirmed for the 6.2 models;
  until spike S4, the build clamps `xhigh`/`max` → `high` and passes
  `low`/`medium`/`high` through, documented in the README.
- **D10 — Codex profiles render only fields the host binds.** A codex-routed
  profile carries `name`, `description`, `background: false`, and the
  `executor:` block only — no `model`, `maxTurns`, or `disallowedTools`,
  because the host does not apply Qwen tool lists or turn caps to external
  executors; rendering them would imply bounds that do not hold. The role's
  read/write policy is carried by codex's own sandbox and approval mapping.

## Increments

- [x] **1. Research + adapter source.** This file, `adapters/qwen-code/`
  (`adapter.json`, `models.json`, `coordinator.md`, `README.md`).
- [ ] **2. Spike (empirical, cheap).** S1: agent-name pattern in a live parse
  (create a scratch `agenticale-ping` definition, confirm it loads and
  dispatches). S2: `model: <provider>:<model>` resolution when the provider is
  registered vs not (document the failure shape). S3: skill slash invocation
  passes arguments (`/work <args>` reaches the skill). S4: codex
  `model_reasoning_effort` accepted values (probe `thread/start`/a minimal
  turn with `xhigh`).
- [ ] **3. Build path.** Render `dist/qwen-code/` (worker profiles, conditional
  coordinator, skills copy) from `adapters/qwen-code/adapter.json` using the
  shared `scripts/model-config.mjs`; extend `scripts/validate.mjs` for the new
  adapter (budget, links) and add render tests mirroring the opencode ones.
- [ ] **4. Runtime binding.** `skills/work/references/runtimes/qwen-code.md`
  (invocation surface, dispatch = Agent tool with `subagent_type:
  agenticale-<role>`, refresh procedure, requested-vs-effective model,
  limitations) and the minimal skill-side reference that routes this host to
  the binding.
- [ ] **5. Install.** Installer entry (target: project `.qwen/` or
  `~/.qwen/`), ownership manifest for configured-route intent, install docs.
- [ ] **6. Review gates.** After increment 2: codex-deep-review (gpt-6.2-sol,
  high) over the adapter source; after increment 3: over build + tests.

## Open questions

- **G1 — Per-agent effort (direct roles).** Blocked on the upstream `effort`
  field. Interim: session `/effort` governs all direct roles; documented.
  Optional advanced escape hatch (not implemented): register per-variant model
  ids whose `generationConfig.extra_body` carries the backend's reasoning
  parameter; the provider backend must support it.
- **G2 — `openai` provider direct use.** Out of scope by decision: on this
  host `openai/*` always means the codex executor. A user wanting OpenAI models
  through Qwen Code's own provider path must use a different provider id.
- **G3 — Unlisted codex-routed roles.** A role routed to codex cannot
  "inherit the session model" (the executor needs an explicit model). Current
  rule: such a role renders only when listed. Confirm this reads well in the
  runtime binding's refresh language.
- **G4 — Trusted workspace.** Codex dispatch requires the folder to be
  trusted by Codex (`~/.codex/config.toml`). The install docs must state the
  prerequisite; no auto-adding of trust entries (installer never rewrites
  external global config).
- **G5 — PR shape.** If increments 3–5 land cleanly this can be one PR
  (adapter + build + binding + install). If the build/install coupling proves
  invasive, ship the adapter source + runtime binding as a documentation-only
  pass (as the OpenCode adapter originally was) and leave the build for a
  follow-up.

## Review notes

`codex-deep-review` agent (user-level, `~/.qwen/agents/`) runs
`gpt-6.2-sol` at high reasoning effort via the executor block this adapter
targets; use it for the increment 2 and 3 review gates.
