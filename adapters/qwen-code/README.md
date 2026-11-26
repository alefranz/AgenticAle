# Qwen Code adapter

This adapter is the machine-readable metadata the build reads to render the
Qwen Code binding. It lives at `adapters/qwen-code/` and (once the build path
exists — see the BACKLOG increment list) produces the generated output under
`dist/qwen-code/`.

## 1. What the Qwen Code binding is, and why it is a shim

The skills-first core (`skills/work` and `skills/autonomous`) is authored
runtime-neutral: the neutral task contracts under
`skills/work/references/tasks/<role>.md` carry only the role's instructions and
nothing host-specific. On Copilot and Codex the runtime can select a model at
dispatch time, so no per-role agent file is required.

Qwen Code is in the OpenCode situation, for a verified reason: its Agent tool
has **no per-call model parameter**, and the installed codex external executor
builds its `thread/start` request without a model. A subagent's model is fixed
in the agent **definition** at install time, so a "direct child dispatch" means
the coordinator invokes the Agent tool naming the configured profile
(`subagent_type: "agenticale-<role>"`), and the model (and, for codex-routed
roles, the reasoning effort) is materialized **inside the profile at install
time**. That profile generation is the mandatory shim, exactly as on OpenCode;
every other runtime binding stays agent-file-free.

Unlike OpenCode, Qwen Code offers **two** model materialization paths inside a
profile, selected by the provider in the flat model config:

1. **Direct provider models** — one `model:` frontmatter line in
   provider-qualified `provider:modelId` form, for providers registered in the
   user's `settings.json` (the local llama OpenAI-compatible endpoint, the
   Qwen Code / Alibaba token plan, …).
2. **The Codex external executor** — an `executor:` frontmatter block that
   spawns the installed Codex CLI with `-c` config overrides pinning the model
   and reasoning effort. This is the path for the `openai/*` model values.

## 2. What the build renders

From this adapter plus the flat model config, the build emits:

- `dist/qwen-code/agents/agenticale/<role>.md` — the generated worker
  profiles. Each carries `name: agenticale-<role>` (the name must match the
  filename; colons and slashes are invalid in agent names), the profile
  description, `maxTurns`, `background: false`, the `disallowedTools` list
  rendered from the permission policy (§4), and either a `model:` line or an
  `executor:` block (§5). The body is copied verbatim from the matching neutral
  task contract `skills/work/references/tasks/<role>.md`.
- `dist/qwen-code/agents/agenticale/coordinator.md` — the coordinator agent
  file, generated **only when the flat model config carries the top-level
  `coordinator` key** (never under `--no-model`). Qwen Code has no
  session-primary agent concept: the coordinating session is the user's own
  session, and the runtime binding tells it to run on the coordinator's model
  (session-scoped switch) and adopt this file's body. It is never dispatched
  as a worker child.
- `dist/qwen-code/skills/` — the four explicit-only skills copied from their
  sources (§7).

The build renders exactly the worker profiles named in `adapter.json` and
**must not** invent any other. The seven base worker roles always render, one
profile per role; the two optional worker roles (`implement-easy`,
`consult-hard`) render only when the config lists them explicitly. `implement`,
`implement-easy`, and `implement-hard` are separate profiles rendering the same
implementation task contract with different dispatch context; `consult` and
`consult-hard` likewise share the consult contract.

**No command entries are rendered.** Qwen Code exposes skills as slash
commands (`/work`, `/review`, `/autonomous`, `/configure`) directly; unlike
OpenCode there is no separate command surface, so shipping command files would
duplicate names.

This adapter is **metadata only**. It contains no model values (those come
from the flat model config, `adapters/qwen-code/models.json` by default or the
`--models PATH|PRESET` option, at build time) and no neutral task-contract body
text (the build copies the body from the neutral task contracts; the
coordinator body is the adapter-owned `coordinator.md`).

## 3. The 9-role → agent mapping

`keyByRoute` in `adapter.json` maps each of the nine worker roles to the Qwen
Code agent name the build renders:

| Role | Agent name | Notes |
| --- | --- | --- |
| `explore` | `agenticale-explore` | 1:1 |
| `implement` | `agenticale-implement` | 1:1 |
| `implement-easy` | `agenticale-implement-easy` | optional; separate profile, same task contract as implement |
| `implement-hard` | `agenticale-implement-hard` | separate profile, same task contract as implement |
| `fix` | `agenticale-fix` | 1:1 |
| `review` | `agenticale-review` | 1:1 |
| `review-deep` | `agenticale-review-deep` | 1:1 |
| `consult` | `agenticale-consult` | 1:1 |
| `consult-hard` | `agenticale-consult-hard` | optional; separate profile, same task contract as consult |

The top-level `coordinator` config key is a session assignment, not a worker
route: it is absent from `keyByRoute` and renders the conditional coordinator
file described in §2.

## 4. Turn ceilings, tool policy, and background

These values live **only** here in this adapter. The neutral task contract must
never gain `maxTurns`, `disallowedTools`, or `background` — they are Qwen Code
host metadata and belong exclusively in this adapter.

| Profile | `maxTurns` | `disallowedTools` (rendered from `permissions`) |
| --- | --- | --- |
| `explore` | 24 | `agent`, `write_file`, `edit`, `notebook_edit` |
| `implement` | 64 | `agent` |
| `implement-easy` | 64 | `agent` |
| `implement-hard` | 64 | `agent` |
| `fix` | 48 | `agent` |
| `review` | 56 | `agent` |
| `review-deep` | 72 | `agent` |
| `consult` | 20 | `agent`, `write_file`, `edit`, `notebook_edit` |
| `consult-hard` | 20 | `agent`, `write_file`, `edit`, `notebook_edit` |

The permission-action → tool mapping lives in `permissionToolNames` in
`adapter.json` and mirrors the OpenCode policy: the `subagent` deny blocks the
`agent` tool (both direct and deferred-bridge invocation); the `edit` deny
blocks the file-mutating tools while shell access stays available; the
`question` deny renders **no** entry because named subagents are already
declared without interactive question tools. Every worker profile also renders
`background: false` so a round's dispatch reads the child's inline result.
`approvalMode` is left unset on purpose: the host auto-derives it (a
permissive parent stays permissive; a default-mode parent yields auto-edit),
and a pinned stricter value could never win over a permissive parent.

## 5. How the model is applied at render time

The adapter carries **no** model values; the build reads them from the flat
model config (`adapters/qwen-code/models.json` by default, or the
`--models PATH|PRESET` / `--no-model` option) for the role being rendered, and
routes by the `codex.providerPrefix` entry (`"openai"`):

- **Codex-routed value** (`openai/<model>[#effort]`): the build emits an
  `executor:` block —

  ```yaml
  executor:
    kind: codex
    command: codex
    args:
      - "app-server"
      - "--stdio"
      - "-c"
      - 'model="<model>"'
      - "-c"
      - 'model_reasoning_effort="<effort>"'
  ```

  where `<effort>` is the value clamped per `codex.effortClamp`
  (`xhigh`/`max` → `high` until the codex-accepted set is confirmed). Codex
  profiles render **only** `name`, `description`, `background: false`, and the
  `executor:` block: Qwen model overrides, tool lists, and `maxTurns` are not
  applied to external executors, so none of `model`, `maxTurns`, or
  `disallowedTools` is rendered — a field that the host does not bind on the
  native process must not imply a bound that does not hold. The role's
  read-only/write policy is carried by codex's own sandbox and approval
  mapping instead (see the Limitations section of the runtime binding once
  written).

  The `-c` overrides are verified to flow into the spawned app-server: the
  `thread/start` response reports the resolved model and effort.

- **Direct value** (`<provider>/<model>[#effort]`, provider ≠ openai): the
  build writes one `model:` line in `provider:modelId` form. The `#effort` is
  **not materialized** — Qwen Code has no per-agent reasoning-effort field;
  the role runs at the session's `model.reasoningEffort` selection (`/effort`).
  This is the documented gap (BACKLOG G1), not a build omission. The provider
  id must be registered in the user's `settings.json` (`modelProviders` +
  `providerProtocol`); the install docs carry the example fragment.

- **Unlisted role** (or `--no-model`): the build emits **neither** a `model:`
  line nor an `executor:` block, so the profile inherits the session model.
  A role whose *configured* value would route to codex cannot inherit (the
  executor needs an explicit model), so such a role renders only when listed.

Because the host has no per-call override, a role's model is bounded by the
generated profiles: to change a role's model you reinstall with a different
`--models` config rather than changing model configuration mid-task.

## 6. Prerequisites (stated, never auto-applied)

- **Direct providers**: the user's `settings.json` registers the provider ids
  the config uses, e.g.

  ```jsonc
  {
    "providerProtocol": {
      "local-llama": "openai",        // OpenAI-compatible (chat-completions)
      "alibaba-token-plan": "openai"
    },
    "modelProviders": {
      "local-llama": [
        { "id": "qwen3.8-27b", "name": "Qwen3.8 27B (local)",
          "baseUrl": "http://<your-llama-endpoint>:8080/v1" }
      ]
    }
  }
  ```

  The token-plan models are available through the Qwen Code account sign-in;
  the exact registration depends on the account's provider surface — the
  `configure` skill guides this conversation.
- **Codex**: the `codex` executable on `PATH`, authenticated by Codex's own
  means, and the working folder trusted in Codex's configuration
  (`~/.codex/config.toml`). The installer never rewrites any of this (see
  BACKLOG G4).
- **Codex effort values**: the accepted `model_reasoning_effort` set is
  confirmed by spike S4; until then the clamp in §5 applies.

## 7. Skill discovery and invocation surface

`skillDiscovery` in `adapter.json` records where the explicit-only skills land:

- `outputSkillsRoot`: `skills` — i.e. the skills land under
  `dist/qwen-code/skills/<name>/SKILL.md` for install into `.qwen/skills/`
  (project) or `~/.qwen/skills/` (user).
- The four skills, `work`, `autonomous`, `review`, and `configure`, are copied
  from their `skills/<name>` sources. The authored skills already carry the
  explicit-only semantics; Qwen Code's `disable-model-invocation: true`
  frontmatter keeps them model-uninvocable while the skill name itself is the
  user's slash invocation surface — `/work`, `/review`, `/autonomous`,
  `/configure` — with no separate command entries.

## 8. Status

This adapter is **documentation and adapter data** in the current
documentation-only pass (BACKLOG increments 1–2). The build path
(`dist/qwen-code/` rendering), the runtime binding
(`skills/work/references/runtimes/qwen-code.md`), and the installer entry are
not yet implemented; live Qwen Code rendering and behavior are not tested
here.
