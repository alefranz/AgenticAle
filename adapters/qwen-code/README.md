# Qwen Code adapter

This adapter is the machine-readable metadata the build reads to render the
Qwen Code binding. It lives at `adapters/qwen-code/` and produces the
generated output under `dist/qwen-code/`.

## 1. What the Qwen Code binding is, and why it is a shim

The skills-first core (`skills/work` and `skills/autonomous`) is authored
runtime-neutral: the neutral task contracts under
`skills/work/references/tasks/<role>.md` carry only the role's instructions and
nothing host-specific. On Copilot and Codex the runtime can select a model at
dispatch time, so no per-role agent file is required.

Qwen Code is in the OpenCode situation, for a verified reason: the Agent tool
carries **no per-call model parameter by default** — an external executor
builds its `thread/start` request without a model, and the tool's `model`
argument exists only when the user configures `agents.modelGrades`, in which
case it selects a *grade* for unpinned direct agents (never the native codex
model). A subagent's model is therefore fixed in the agent **definition** at
install time, so a "direct child dispatch" means the coordinator invokes the
Agent tool naming the configured profile (`subagent_type: "agenticale-<role>"`),
and the model (and, for codex-routed roles, the reasoning effort) is
materialized **inside the profile at install time**. That profile generation is
the mandatory shim, exactly as on OpenCode; every other runtime binding stays
agent-file-free.

Unlike OpenCode, Qwen Code offers **two** model materialization paths inside a
profile, selected by the provider in the flat model config:

1. **Direct provider models** — one `model:` frontmatter line carrying the
   bare model id, for models registered in the user's `settings.json` (the
   local llama OpenAI-compatible endpoint, the Qwen Code / Alibaba token plan,
   …).
2. **The Codex external executor** — an `executor:` frontmatter block that
   spawns the installed Codex CLI with `-c` config overrides pinning the model
   and reasoning effort. This is the path for the `openai/*` model values.

## 2. What the build renders

From this adapter plus the flat model config, the build emits:

- `dist/qwen-code/agents/agenticale-<role>.md` — the generated worker
  profiles, **flat** at the agents root: Qwen Code 0.28.6 scans only the
  Markdown files directly inside `.qwen/agents/` (and `~/.qwen/agents/`), so a
  nested directory would be invisible to the host. Each profile carries
  `name: agenticale-<role>` (agent names accept letters, numbers, hyphens, and
  underscores; colons and dots do not) and the profile description. What it
  carries beyond that depends on the role's model routing (§5):
  - **direct-routed or unlisted**: `maxTurns` (the profile's turn ceiling),
    `background: false`, and the `disallowedTools` list rendered from the
    permission policy (§4); a listed direct value adds one `model:` line.
  - **codex-routed**: `background: false` and the `executor:` block **only** —
    the host *rejects* (invalid config, refusing launch) an external agent
    that supplies `model` (other than `inherit`), `maxTurns`, `tools`,
    `disallowedTools`, or related overrides, so none of those renders.
- `dist/qwen-code/agents/agenticale-coordinator.md` — the coordinator agent
  file, generated **only when the flat model config carries the top-level
  `coordinator` key** (never under `--no-model`). The value must be
  Qwen-direct (not codex-routed): the coordinating session is the user's own
  session, it runs on the coordinator's model via a session-scoped model
  switch drawn from Qwen's own provider registry, and a codex executor
  definition never makes its model available to the session. The shared build
  skips a codex-routed coordinator value with a console note and a
  `qwenCode.coordinatorSkipped` build-state record (it must not fail a build
  whose other roots still render); the installer enforces the strict
  rejection. Qwen Code has no session-primary
  agent concept: the runtime binding tells the session to adopt this file's
  body. The coordinator file is never dispatched as a worker child.
- `dist/qwen-code/skills/` — the four explicit-only skills plus the two
  supporting skills the work/review references link to (`pull-request-
  description`, `source-code-lookup`) (§7).

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
from the flat model config at build time — the packaged build default
`adapters/opencode/models.json`, or the `--models PATH|PRESET` option;
`adapters/qwen-code/models.json` is the Qwen Code install default carried as
a config file, not a build default) and no neutral task-contract body text
(the build copies the body from the neutral task contracts; the coordinator
body is the adapter-owned `coordinator.md`).

## 3. The 9-role → agent mapping

`keyByRoute` in `adapter.json` maps each of the nine worker roles to its
profile key (the role name, 1:1, as on OpenCode); the build derives the Qwen
Code agent name as `agenticale-<key>`:

| Role | Profile key | Agent name | Notes |
| --- | --- | --- | --- |
| `explore` | `explore` | `agenticale-explore` | 1:1 |
| `implement` | `implement` | `agenticale-implement` | 1:1 |
| `implement-easy` | `implement-easy` | `agenticale-implement-easy` | optional; separate profile, same task contract as implement |
| `implement-hard` | `implement-hard` | `agenticale-implement-hard` | separate profile, same task contract as implement |
| `fix` | `fix` | `agenticale-fix` | 1:1 |
| `review` | `review` | `agenticale-review` | 1:1 |
| `review-deep` | `review-deep` | `agenticale-review-deep` | 1:1 |
| `consult` | `consult` | `agenticale-consult` | 1:1 |
| `consult-hard` | `consult-hard` | `agenticale-consult-hard` | optional; separate profile, same task contract as consult |

The top-level `coordinator` config key is a session assignment, not a worker
route: it is absent from `keyByRoute` and renders the conditional coordinator
file described in §2.

## 4. Turn ceilings, tool policy, and background

These values live **only** here in this adapter. The neutral task contract must
never gain `maxTurns`, `disallowedTools`, or `background` — they are Qwen Code
host metadata and belong exclusively in this adapter. The table states each
profile's policy; on **codex-routed** renderings only `background` survives
(§2/§5), and the role's read/write policy is then carried by codex's own
sandbox and approval mapping instead.

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
declared without interactive question tools. Every worker profile renders
`background: false` so a round's dispatch reads the child's inline result.
`approvalMode` is left unset on purpose: for direct profiles the host
auto-derives it (a permissive parent stays permissive; a default-mode parent
yields auto-edit), and a pinned stricter value could never win over a
permissive parent. For codex profiles the *session's* approval mode is what
drives the native sandbox (default-mode session → codex runs read-only;
auto-edit/yolo → codex may write), so a permissive session also gives
codex-routed read-only roles (consult, explore) write access — an honest
limitation of this host, carried by the runtime binding.

## 5. How the model is applied at render time

The adapter carries **no** model values; the build reads them from the flat
model config (the packaged build default `adapters/opencode/models.json`, or
the `--models PATH|PRESET` / `--no-model` option — the Qwen Code install
default is `adapters/qwen-code/models.json`) for the role being rendered, and
routes by `codex.providerPrefix` (`"openai"`):

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
  ```

  with a second `-c` pair adding `model_reasoning_effort="<effort>"` **only
  when the value carries a `#effort` suffix**; without a suffix the override is
  omitted and codex's own default effort applies. The five flat-config effort
  levels pass through verbatim (the codex model catalog lists `xhigh`/`max`
  for the GPT-6.2 models; a level the backend rejects fails visibly rather
  than being silently downgraded). No other field renders for codex profiles
  (§2). The `-c` overrides are verified to flow into the spawned app-server:
  the `thread/start` response reports the resolved model and effort.

- **Direct value** (`<provider>/<model>[#effort]`, provider ≠ openai): the
  build writes one `model:` line carrying the **bare model id** (`<model>`).
  The `provider` component is routing information for this adapter, not a
  Qwen Code selector prefix: the host's `authType:modelId` form recognizes
  only built-in auth types before the colon, so a custom provider id like
  `local-llama:` would not parse as a selector at all. A bare id resolves
  against the session's own auth type first, then the built-in auth types —
  models registered under custom provider ids are reachable through their
  protocol bucket, which is why the provider registration below is a
  prerequisite. The `#effort` is **not materialized** — Qwen Code has no
  per-agent reasoning-effort field; the role runs at the session's
  `model.reasoningEffort` selection (`/effort`). This is the documented gap
  (BACKLOG G1), not a build omission.

- **Unlisted role** (or `--no-model`): the build renders the profile with
  **no** `model:` line and **no** `executor:` block, so it inherits the
  session model. (An executor *can* run with no model override — codex's own
  config default — but the design keeps one rule: unlisted means inherit, the
  same semantics OpenCode has.)

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
  `configure` skill guides this conversation. Model ids must resolve without
  ambiguity (the session auth type is checked first, so a collision is won by
  the session provider).
- **Codex**: the `codex` executable on `PATH`, authenticated by Codex's own
  means, the working folder trusted in Codex's configuration
  (`~/.codex/config.toml`), **and** the workspace trusted by Qwen Code itself
  — the host checks its own folder trust before launching any external agent
  at project level. The installer never rewrites any of this (see BACKLOG G4).

## 7. Skill discovery and invocation surface

`skillDiscovery` in `adapter.json` records what lands under `dist/qwen-code/
skills/` for install into `.qwen/skills/` (project) or `~/.qwen/skills/`
(user):

- The four **explicit-only** skills, `work`, `autonomous`, `review`, and
  `configure`, copied from their `skills/<name>` sources. The authored skills
  already carry the explicit-only semantics; Qwen Code's
  `disable-model-invocation: true` frontmatter keeps them model-uninvocable
  while the skill name itself is the user's slash invocation surface —
  `/work`, `/review`, `/autonomous`, `/configure` — with no separate command
  entries.
- The two **support** skills, `pull-request-description` and
  `source-code-lookup`, copied like the OpenCode build does: the work and
  review references link to them, so an install missing them leaves dangling
  links. They stay model-invocable supporting capabilities, not workflow
  entry points.

## 8. Status

The adapter data, the build path (`qwen-code/` rendering, validated by
`scripts/validate.mjs` and the render fixtures in
`scripts/test-build.mjs`), and the runtime binding
(`skills/work/references/runtimes/qwen-code.md`, plus the configure
discovery reference `skills/configure/references/discovery/qwen-code.md`)
are implemented (BACKLOG increments 1–4). The installer entry
(BACKLOG increment 5) is implemented as `scripts/install.mjs
qwen-install` / `qwen-uninstall`: a copy-only install of the generated
`qwen-code/` build root into the Qwen Code configuration directory
(`--target PATH`, default `~/.qwen`), reusing the OpenCode installer's
ownership, backup, collision, rollback, and reconciliation mechanics under
its own package identifier (`qwen-code-autonomous-mode`, state schema 1,
`.autonomous-mode-install.json`), so the ownership manifest it writes is
the configured-route intent evidence the work binding reads. The default
model config is this adapter's `models.json`; `--models PATH|PRESET` and
`--no-model` override it, and a codex-routed `coordinator` value is
rejected at install time. Live Qwen Code rendering and dispatch are
verified only by the spike probes recorded in BACKLOG.md, not by this
branch's test suite.
