# Qwen Code adapter — backlog

Branch: `feat/qwen-code-adapter`. Status: increments 1–4 done (research +
adapter source, spike, build path with tests, runtime binding + configure
discovery); two codex-deep-review gates run, findings fixed; the installer
entry (increment 5) is the remaining step before the PR; note the binding's
installer-rerun line becomes real only once increment 5 adds the qwen-code
install path to `scripts/install.mjs` (currently OpenCode-only).

Goal: an installation method for Qwen Code mirroring the OpenCode adapter
(`adapters/opencode/`), so the flat model config (roles → `provider/model#effort`,
plus the optional `coordinator` key — see `examples/example.json`) can be
materialized for the Qwen Code host. Supported model sources, by decision:
**local llama** (OpenAI-compatible provider, direct), **the Qwen Code / Alibaba
token plan** (direct), and **OpenAI models via the Codex external executor**.
Nothing else is wired up.

## Findings (verified 2026-11-26 against Qwen Code 0.28.6 + codex 0.172.0)

### Host capabilities

- **Agent definitions** live at `.qwen/agents/*.md` (project) and
  `~/.qwen/agents/*.md` (user). The directory scan is **non-recursive** — only
  Markdown files directly inside the agents root load (verified in the
  installed `convertAgentFiles`). Supported frontmatter: `name`,
  `description`, `model` (`inherit` | `fast` | `modelId` |
  `authType:modelId`), `approvalMode` (`default|plan|auto-edit|yolo|bubble`),
  `tools` (allowlist), `disallowedTools` (blocklist; also blocks
  deferred-bridge invocation), `maxTurns` (positive int), `background`, and
  `executor` (`kind: codex|acp`, `command`, `args`). Agent name rule
  (installed validator): letters, numbers, hyphens, and underscores
  (`/^[\p{L}\p{N}_-]+$/u`) — **no colons, no dots**. (The
  "1–64 lowercase letters, numbers, dots or hyphens; name must match the
  filename" message is the *fork-profile* name rule, not the agent rule.)
  The CC-compat `effort` field is documented as *not yet implemented*.
- **Per-invocation model**: the Agent tool has no model argument by default.
  A `model` argument appears only when the user configures
  `agents.modelGrades`; then it selects a *grade* for unpinned direct agents
  and never affects codex executor profiles. Either way, the model is fixed in
  the definition at install time — the same "mandatory shim" property that
  makes OpenCode V2 materialize profiles.
- **Codex external executor**: `executor.kind: codex` spawns
  `command` + `args` (default `["app-server","--stdio"]`), verbatim. The host
  **rejects** (invalid config, refusing launch) an external agent that
  supplies `model` (other than `inherit`), `tools`, `disallowedTools`,
  `mcpServers`, `hooks`, `maxTurns`, or related override keys — so those
  fields must not render in codex profiles at all. The model is pinned through
  CLI `-c key=value` overrides in `args`. Verified natively: with
  `-c model="gpt-6.2-sol" -c model_reasoning_effort="high"`, the
  `thread/start` response reports `model: gpt-6.2-sol, reasoningEffort: high`.
  Codex tasks are **one-shot** (no messages/resume); they are unavailable in
  safe mode and container execution mode; the host checks **its own**
  workspace trust before launch (project/builtin level), on top of codex's
  own trusted-folder requirement. One-shot matches the workflow's
  fresh-context worker semantics.
- **Approval → native sandbox**: the *session's* approval mode drives the
  codex sandbox (default-mode session → codex read-only; auto-edit/yolo →
  codex may write / full access). A permissive session therefore gives
  codex-routed read-only roles write access — an honest limitation, documented
  in the runtime binding once written.
- **Commands**: `.qwen/commands/<path>.md` → `/<colon-joined>` with `{{args}}`.
  Not needed here (see decision D6).
- **Skills**: `.qwen/skills/<name>/SKILL.md`; a skill is itself exposed as the
  slash command `/<name>` (user-invocable by default; `disable-model-invocation`
  keeps it explicit-only). This is the invocation surface — unlike OpenCode, no
  separate command entries are required.
- **Model selection**: a bare model id resolves the session's auth type first,
  then the built-in auth types (`qwen-oauth`, `openai`, `vertex-ai`,
  `anthropic`, `gemini`); models registered under custom provider ids are
  reachable through their protocol bucket. The `authType:modelId` form
  recognizes **only built-in auth types** before the colon — a custom provider
  id (`local-llama:`) does not parse as a selector (verified by running the
  installed resolver: the whole string is kept as the model id). Providers are
  registered once in the user's `settings.json` via `modelProviders` +
  `providerProtocol` (OpenAI-compatible).
- **Reasoning effort**: `model.reasoningEffort` is **session-global** (set via
  `/effort`); there is **no per-agent effort field** yet. The `#effort` of a
  direct-provider role therefore cannot be materialized per profile (gap G1).
  Codex-side, the 0.172.0 model catalog lists `xhigh`/`max` for the GPT-6.2
  models, so codex-routed efforts pass through verbatim.

### Mapping the flat model config

| Config form | Rendered qwen-code frontmatter |
| --- | --- |
| `openai/<model>#<effort>` | `background: false` + `executor:` block with `-c model="<model>"` and `-c model_reasoning_effort="<effort>"` (effort pair only when a `#` suffix is present) |
| `openai/<model>` (no suffix) | same, without the effort pair (codex default effort) |
| `<provider>/<model>` (provider ≠ openai) | `maxTurns`, `background: false`, `disallowedTools` + `model: <model>` (bare model id) |
| `<provider>/<model>#<effort>` (provider ≠ openai) | same; effort **not materialized** (gap G1 — runs at the session's `/effort` selection) |
| role unlisted | direct form with no model line, no executor → inherits the session model |
| `coordinator: openai/...` | shared build **skips** the qwen-code coordinator with a console note + state record (the coordinating session must run on a model in Qwen's own provider registry); the installer enforces the strict rejection |

### Spike results (increment 2, all four resolved)

- **S1 — Flat definition loads and dispatches.** A scratch
  `agenticale-ping` definition at the agents root loaded and dispatched
  through the Agent tool; the reply came back ("pong"). Flat layout + name
  rule confirmed end-to-end.
- **S2 — Bare model-id resolution.** With the provider registered in
  `settings.json`, a bare model id resolves as expected. **Surprise,
  now a documented limitation:** an *unresolvable* `model:` value does
  **not** fail — Qwen Code 0.28.6 silently falls back to the session model
  (the scratch profile returned "pong" with `model: no-such-model-zxq9`).
  The install docs and runtime binding must state that a mistyped model id
  degrades silently to the session model.
- **S3 — Skill slash invocation passes arguments.** `/work <args>` (and
  friends) appends the arguments to the skill body; the skill receives them.
  Decision D6 (no command entries) is sufficient.
- **S4 — `xhigh` on a codex profile.** A codex executor profile with
  `-c model_reasoning_effort="xhigh"` for `gpt-6.2-sol` launches and the
  `thread/start` response reports `reasoningEffort: xhigh`. Effort
  passthrough (D9) confirmed for at least xhigh; `max` also accepted by the
  0.172.0 catalog for the GPT-6.2 models.

## Design decisions

- **D1 — Flat install layout, namespace `agenticale-<role>`.** Agents load
  only from the flat agents root, and colons/dots are invalid in agent names,
  so the rendered file is `agents/agenticale-<role>.md` with
  `name: agenticale-<role>`, dispatched with `subagent_type:
  "agenticale-<role>"`.
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
- **D5 — `approvalMode` left unset.** For direct profiles the host
  auto-derives it (permissive parent stays permissive; default parent yields
  auto-edit), and a pinned stricter value could never win over a permissive
  parent. For codex profiles the session approval mode drives the native
  sandbox, so pinning a Qwen field would change nothing; the read-only
  guarantee for codex-routed consult/explore holds only while the session is
  not permissive (documented limitation).
- **D6 — No command entries.** Qwen Code exposes skills as slash commands
  (`/work`, `/review`, `/autonomous`, `/configure`), so shipping
  `.qwen/commands/` files would create duplicate names for the same surface.
- **D7 — Coordinator = session model + posture body.** Qwen Code has no
  "primary agent runs the session" concept. When the config carries
  `coordinator`, the build renders the coordinator agent file (same conditional
  rule as OpenCode) and the runtime binding instructs the coordinating session
  to run on the coordinator's model (session-scoped model switch, never a
  global settings rewrite) and adopt the installed coordinator body. The
  coordinator value must be Qwen-direct (the session cannot switch to a
  model that only exists behind the codex executor). In the shared build a
  codex-routed coordinator value is skipped with a console note and a
  `qwenCode.coordinatorSkipped` state record rather than failing the run;
  the installer enforces the strict rejection.
- **D8 — Codex routing key `codex.providerPrefix`** (`"openai"`) in
  `adapter.json`: model values whose provider equals it render as executor
  blocks; every other provider renders a direct profile.
- **D9 — Effort passthrough for codex roles.** The five flat-config effort
  levels pass through verbatim to `model_reasoning_effort` (the codex 0.172.0
  catalog lists `xhigh`/`max` for the GPT-6.2 models); a level the backend
  rejects fails visibly rather than being silently downgraded. No `#` suffix
  → no effort pair (codex default).
- **D10 — Codex profiles render only fields the host binds.** A codex-routed
  profile carries `name`, `description`, `background: false`, and the
  `executor:` block only — `model`, `maxTurns`, and `disallowedTools` are not
  just ignored but *rejected* at launch for external agents, so they must not
  render. The role's read/write policy is carried by codex's own sandbox and
  approval mapping instead.
- **D11 — Direct roles render the bare model id.** `model: <provider>:<id>`
  only parses for built-in auth types, so the build writes
  `model: <model>`; the provider component is routing information for the
  adapter, and the provider registration (settings.json) is a documented
  prerequisite. Id collisions resolve to the session auth type first.

## Increments

- [x] **1. Research + adapter source.** This file, `adapters/qwen-code/`
  (`adapter.json`, `models.json`, `coordinator.md`, `README.md`).
- [x] **Review gate 1** (after increment 1): codex-deep-review
  (gpt-6.2-sol, high) reported 4×P1, 5×P2, 2×P3; all load-bearing claims were
  re-verified against the installed Qwen Code 0.28.6 code (non-recursive
  agents scan; built-in-only selector auth types; hard rejection of
  model/maxTurns/tools on external agents; 6-skill build list) and fixed in
  the adapter source. Residual: live dispatch unverified (S1–S4 below).
- [x] **2. Spike (empirical, cheap).** S1–S4 resolved; results and the
  S2 silent-fallback finding are recorded in the spike section above.
- [x] **3. Build path.** `scripts/build.mjs` renders the `qwen-code/` output
  root (flat worker profiles from `adapters/qwen-code/adapter.json`,
  conditional coordinator, six skills) through the shared
  `scripts/model-config.mjs`; a codex-routed coordinator value is skipped
  with a console note and a `qwenCode.coordinatorSkipped` state record.
  `scripts/validate.mjs` gained `validateQwenCodeAdapter()` (exact
  profile/coordinator/codex/permissionToolNames/skillDiscovery metadata,
  flat output paths, maxTurns ceilings, deny sets) plus the qwen-code
  packaged default in the model-config checks. `scripts/test-build.mjs`
  covers both profile shapes (exact model lines, -c overrides, the
  no-other-host-rejected-keys form), the no-coordinator and coordinator
  variants, `--no-model` inheritance, the skip record, state records, file
  counts, and the skill inventory. Ownership/confinement: the schema-1 and
  schema-2 states migrate to schema 3, an unowned pre-existing qwen-code
  root refuses the run, a malformed (newline-joined) schema-3 state is
  rejected, and the qwen-code root is covered by the symlink-confinement
  cases.
- [x] **4. Runtime binding.** `skills/work/references/runtimes/qwen-code.md`
  (invocation surface, dispatch = Agent tool with `subagent_type:
  agenticale-<role>`, the two materialization forms, coordinator adoption,
  manifest-based configured-route intent, refresh procedure,
  requested-vs-effective model incl. the silent fallback, one-shot codex
  children, `--stats` unsupported, limitations) plus the configure discovery
  reference (`skills/configure/references/discovery/qwen-code.md`), the
  configure SKILL.md host wiring, and the work/autonomous dispatch
  sentences that name Qwen Code as an agent-file host. `validate.mjs` pins
  both new files and the configure host list. NOTE: the binding's
  installer-rerun line is real only once increment 5 lands; until then a
  Qwen Code install is manual (copy the `qwen-code/` build root into the
  install root) and there is no ownership manifest yet.
- [ ] **5. Install.** Installer entry (target: project `.qwen/` or
  `~/.qwen/`), ownership manifest for configured-route intent, install docs.
- [x] **Review gate 2** (after increment 3): codex-deep-review over build +
  tests reported 1×P1 (TOML-breaking chars in model ids), 9×P2, 1×P3.
  Fixed in the same pass: the shared loader now rejects quotes/backslashes
  and YAML-coercible bare model ids; the build pins `codex.kind`, asserts the
  flat output paths, and compares state outputs as exact arrays; the validator
  pins the exact codex key set (kind included) and the exact six-skill
  inventory; the coordinator descriptions drop the YAML-breaking colon; the
  test suite gained exact-shape assertions, the skill-inventory check, and
  schema-2 migration / unowned-qwen-root / malformed-state fixtures; README
  and docs were aligned with the actual build behavior.
- [ ] **6b. Review gate 3.** After increment 4: codex-deep-review over the
  runtime binding.

## Open questions

- **G1 — Per-agent effort (direct roles).** Blocked on the upstream `effort`
  field. Interim: session `/effort` governs all direct roles; documented.
  Optional advanced escape hatch (not implemented): register per-variant model
  ids whose `generationConfig.extra_body` carries the backend's reasoning
  parameter; the provider backend must support it.
- **G2 — `openai` provider direct use.** Out of scope by decision: on this
  host `openai/*` always means the codex executor. A user wanting OpenAI
  models through Qwen Code's own provider path must use a different provider
  id (and a model id that resolves there).
- **G3 — Unlisted roles.** One rule: unlisted means inherit (direct form, no
  executor). An executor *could* run with no model override (codex's own
  config default), but rendering one for an unlisted role would invent intent
  the config did not express; out of scope.
- **G4 — Trust prerequisites.** Codex dispatch needs the folder trusted in
  Codex's configuration (`~/.codex/config.toml`) **and** the workspace
  trusted by Qwen Code itself (the host checks its own folder trust before
  launching a project-level external agent). The install docs state both; the
  installer never rewrites external global config or trust lists.
- **G5 — PR shape.** If increments 3–5 land cleanly this can be one PR
  (adapter + build + binding + install). If the build/install coupling proves
  invasive, ship the adapter source + runtime binding as a documentation-only
  pass (as the OpenCode adapter originally was) and leave the build for a
  follow-up.
- **G6 — Unresolvable `model:` values fail silently.** Verified in S2: a
  `model:` id that resolves to nothing falls back to the session model with
  no error (Qwen Code 0.28.6). The install docs and runtime binding must
  document this; a strict resolver is an upstream feature, not a local one.

## Review notes

`codex-deep-review` agent (user-level, `~/.qwen/agents/`) runs
`gpt-6.2-sol` at high reasoning effort via the executor block this adapter
targets; use it for the remaining review gates.
