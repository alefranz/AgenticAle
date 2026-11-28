# Architecture

AgenticAle is a set of portable coding skills with per-role model
configuration, distributed as one Agent Plugins 1.0 package. It carries
everyday reviewed task work (`work`), standalone branch review (`review`),
durable autonomous project work (`autonomous`), and three supporting skills
(`source-code-lookup`, `pull-request-description`, and the user-invoked
`configure` setup skill). Runtime specifics are kept
out of the skills, and the workflow never resolves a model at activation:
Copilot, Codex, and Antigravity dispatch native children, and OpenCode gets a
generated set of agent profiles carrying the per-role model (with its
reasoning variant) from install time as a compatibility adapter, plus an
optional primary coordinator profile when the config assigns one.

Live runtime behavior is tracked in
[runtime-compatibility.md](runtime-compatibility.md): most capabilities remain
**not tested**, with one narrow recorded OpenCode `/work` routing pass and one
narrow recorded OpenCode model-listing shape pass.

## The authored core

Four concerns are separated so each can change independently:

| Concern | Where |
| --- | --- |
| Workflow skills | `skills/work/SKILL.md`, `skills/review/SKILL.md`, `skills/autonomous/SKILL.md` |
| Task contracts | `skills/work/references/tasks/<role>.md` (six: `explore`, `implement`, `fix`, `review`, `review-deep`, `consult`) |
| Flat model config | `adapters/opencode/models.json` (role → `"provider/model[#variant]"`, plus the optional top-level `coordinator` session key; unlisted roles inherit) |
| Plugin preference fragment | `adapters/plugin/model-configuration.md` (appended to the workflow skills in plugin and standalone outputs) |
| Runtime bindings | `skills/work/references/runtimes/<host>.md` (six: `copilot`, `copilot-local`, `codex`, `opencode`, `qwen-code`, `antigravity`) |
| Outcome-evaluation protocol (opt-in) | `skills/work/references/outcome-evaluation.md` (Work only; loaded only when invoked with `--outcome`) |
| Work conditional references | `skills/work/references/pr-delivery.md` (`--pr`), `skills/work/references/decomposition.md` (multi-slice/experiment) |
| Autonomous cold-path references | `skills/autonomous/references/{persistence,escalation,recovery}.md` (loaded only when triggered) |

The three workflow skills and the `configure` setup skill are explicit-only:
each sets `disable-model-invocation: true` and `opencode/autoinvoke: false`,
and the OpenAI metadata (`agents/openai.yaml`) disables implicit invocation.
The invoking session is the coordinator, and there is no `commands/` entry in
the authored core (the OpenCode binding ships four thin command entries — see
the generated binding below). On OpenCode the flat config may optionally
assign a `coordinator` session model: the build then generates one visible
primary `agenticale/coordinator` profile and binds the workflow command
entries to it, so the workflow runs in the current session on that model from
the first turn (including an autonomous resume); the `configure` command
entry always stays a caller-session launcher. Without a configured
coordinator the invoking session coordinates on its own model. The session
owns its own model and effort, and it dispatches fresh children using the
task-specific instructions; it never selects a model.

Each workflow skill splits into an entry plus reference files with explicit
load points because OpenCode truncates skill loads and whole-file reads at
50 KiB (51,200 bytes): every file a workflow reads whole stays at or under a
45 KiB (46,080-byte) authored budget; `scripts/validate.mjs` enforces the
budget and the skills' link and anchor integrity.

The standalone review skill (`skills/review/SKILL.md`) is self-contained and
reviews the current branch's net changes from the merge base to the current
working-tree result — the committed branch review on a clean tree — without
loading the multi-round `rounds.md` contract, returning findings without fixing.
Work can start from a requested outcome, existing changes, or a same-session
preceding review's findings, entering at the first necessary step.

`skills/work/references/rounds.md` is the shared round contract loaded by
`work` and `autonomous`: the child task packet, compact reports, reset criteria,
the shared routing policy, the review/fix gate, and the simplified **24-round**
task worker budget. Both workflows continue productive fix → verify → re-review
loops unattended while worker budget remains, stopping or escalating only on
genuine non-convergence: two consecutive no-progress rounds or repeated
identical blockers (stall), two-cycle oscillation, four or more consecutive
reviews opening only stylistic/wording blockers after functional checks pass
(standard drift), or repeated root-cause invariant failure. Every review needs
changed evidence, a required integration gate, bounded interrupted-review
recovery, or an explicit user request (never a review-only loop over unchanged
code), and the required review of the last allowed worker still runs at zero
worker budget. A limit or safeguard stop with remaining work is always an
incomplete stop carrying a self-contained continuation prompt.
The six task contracts are capability-neutral: they carry only the role's
instructions, with no host-specific protocol. `implement`, `implement-easy`,
and `implement-hard` share the same `implement` contract, and `consult` and
`consult-hard` share the `consult` contract; the easy/hard roles are dispatch
roles, not separate contracts — the OpenCode output generates each as a
distinct profile reusing the shared contract body. A hard review finding keeps
the `fix` contract and the fix counters while it dispatches on the
`implement-hard` role.

`skills/work/references/outcome-evaluation.md` carries Work's opt-in
outcome-evaluation protocol, loaded only when a task is invoked with the bare
`--outcome` option. It pre-registers a lean outcome card before implementation,
drives one candidate at a time against the pinned baseline through the existing
worker rounds and the unchanged applicable gate, and reuses the
existing worker-round allowance and stop/continuation machinery. It is
instruction-level: no generic verdict script, no metric framework, no new
orchestration, and no new dispatch role.

`pull-request-description` is read before writing or revising a PR body;
`source-code-lookup` is read when another codebase's behavior matters. Both are
loaded in full when their task triggers apply. Lookup evidence uses the active
state policy, and an unavailable configured source root is reported rather than
silently replaced.

`skills/configure/SKILL.md` is the user-initiated setup skill for model
routing and the Work worker-round allowance: it detects the actual runtime
surface, discovers capabilities through a degradation ladder (live native
listing → user-supplied names → safe session-model inheritance), proposes
exact preference-file content — or a flat `--models` JSON plus an install
refresh on OpenCode and Qwen Code — and writes only on explicit confirmation
of the exact
path and content, re-reading the target before the write. Every proposed
model name comes from live host evidence or the user; no packaged inventory
of names ships. Its per-host discovery notes live in
`skills/configure/references/discovery/` (unconfirmed capabilities stay
marked unconfirmed), and the commented preferences starter is authored once
at `examples/preferences.example.md`. Configure adds no scaffold command, no
profile management, and no persistent state; the workflows never invoke it
and never write preference files themselves.

`skills/autonomous/SKILL.md` adds durable backlog (`BACKLOG.md`), compact
checkpoint (`.agenticale/active.md`), optional human-owned steering
(`.agenticale/steering.md`), and three on-demand cold-path references
(`persistence.md`, `escalation.md`, `recovery.md`), composing round prompts
directly from `rounds.md` and `tasks/<role>.md`.

Two durable worker-round budgets and a completed-task limit bound a run: a
run ceiling (default **240**), a per-task allowance (default **24**, independent
of Work's preference file), and a completed-task limit (default **20**). Every
explore/implement/fix round is charged once to both worker budgets before
launch; an exhausted task is deferred resumable while truly independent ready
tasks may be selected, and reaching the run ceiling or completed-task limit
with remaining work is an incomplete safety stop.

Productive fix loops continue unattended while budget remains, bounded by the
shared non-convergence safeguards, one opportunistic deep-review escalation per
session (separate from required slice-gate or periodic deep reviews), and
consults capped at 1 per decision / 2 per session. The anti-ask gate limits
user questions to irreversible/reserved actions, ambiguous preferences,
exhausted run limits or blocked persistence, and unresolved non-convergence.
The default Git persistence policy commits and pushes each completed task
through coherent task commits and one bounded state-only finalization commit
before the next task is selected, keeping `.agenticale/active.md` as recovery
checkpoint until final close cleanup is confirmed. Blocked or failed pushes
stop local-only for a reconciling resume. Everyday `work` uses session state
for task coordination.

The flat model config is a flat per-role inventory: a role with no entry
inherits the session model, and the packaged config is an inventory, not a
verified account mapping. The two optional worker routes (`implement-easy`,
`consult-hard`) render only when listed, and the optional top-level
`coordinator` key assigns the coordinating session's model on OpenCode.
Fresh-agent review can use the same model as the
worker. Work stops and reports explicit provider quota exhaustion without
durable recovery; only Autonomous applies the cooldown and recovery policy
below.

Autonomous mode also persists provider-quota cooldown and retry state in its
compact snapshot. It can resume long work from verified partial progress
after a supported wait or a later activation; it does not promise an automatic
wake when the host exposes no such capability. See the
[quota recovery examples](https://github.com/alefranz/AgenticAle/blob/main/docs/autonomous-quota-fixtures.md) for the behavior
boundaries.

The authored source-of-truth layout is what `scripts/validate.mjs` asserts
exists: the three workflow skills plus their `agents/openai.yaml`, the shared
`rounds.md`, `pr-delivery.md`, `decomposition.md`, and `outcome-evaluation.md`
references, the three on-demand autonomous references (`persistence.md`,
`escalation.md`, `recovery.md`), the shared `session-stats.mjs` helper, the six
runtime bindings, the six task contracts, the `adapters/opencode/` metadata, the
`adapters/qwen-code/` metadata, the plugin preference fragment
(`adapters/plugin/model-configuration.md`), the three supporting skills
(including `configure` with its `agents/openai.yaml` and six discovery
references), and `examples/preferences.example.md`, for 50 source-of-truth
files. The retired layout (`commands/`, `agents/autonomous/`,
`skills/work-mode`, `skills/autonomous-mode`) and the retired routing paths
(`ROUTING.md`, `routing.json`, `preferences.example.md`, and
`scripts/routing.mjs` under `skills/work/`) must be absent.

## Model configuration

Model selection is a build-time input only: the workflow never resolves a
model at activation. Two authored files own it:

- `adapters/opencode/models.json` — the flat model config: a JSON object
  mapping a role to `"provider/model"` or `"provider/model[#variant]"`, plus
  the optional top-level `coordinator` key (a session assignment, not a
  worker role). Missing roles inherit the session model; there are no tiers,
  fallbacks, runtime sections, or profiles. It is the packaged default and is
  also a usable `--models` path.
- `adapters/plugin/model-configuration.md` — the preference fragment the
  build appends as the final top-level section of the workflow skills in the
  plugin and standalone outputs (not the OpenCode output, not the three
  non-workflow skills). It documents the one optional preference file the
  workflow reads at activation on per-spawn hosts: the nine child worker keys
  (no coordinator key — the host owns the session model), the combined
  `provider/model[#variant]` value form alongside the legacy comma-effort
  form, the optional routes' fallback semantics, metavariable-only examples,
  and the one non-blocking no-file note pointing at the user-invoked
  `configure` skill and its bundled starter.

The preferences starter is authored once at `examples/preferences.example.md`
and copied verbatim by the build into every output at
`configure/references/preferences.example.md` (install-relative); the
packaged configure skill's starter link is repointed at that copy, while the
authored skill keeps the source-checkout link.

The build never discovers user files, so generated packages remain
reproducible; the installers never create, overwrite, migrate, or remove
user preference files, except that `scripts/install.mjs setup` creates the
personal preferences file with the user's explicit consent.

### Build and install options

The build and every installer accept the same model options:

- `--models PATH|PRESET` — the flat config from a JSON file or a bundled
  preset (`example`, `local`, `openai`, `gpt`, `zen`, the example files in
  `examples/`); a missing role inherits the session model.
- `--no-model` — every role inherits the session model.

These are explicit build-time operations, not remembered invocation
preferences.

### The preference file (per-spawn hosts)

Where the build splices the preference fragment, the workflow may read one
optional preference file at activation:
`<project-root>/.agenticale/preferences.md` first, then
`~/.agenticale/preferences.md`; a project file wins, and a missing file is
normal (no customization). The format is a list of direct role assignments,
one per line (`- <role>: <provider/model[#variant]>`, or the legacy
`- <role>: <model>` / `- <role>: <model>, <effort>` forms);
nothing else is interpreted. A leading `--profile NAME` selects
`preferences.NAME.md` at the same locations instead; a missing selected file
is a concise, actionable error listing the files that exist, never a silent
fallback. The selected file is read once at activation and stays fixed for
the activation. The same file may carry the top-level `## Work` section (the
Work worker-round allowance), the only other supported section. Where a host
cannot select a model per child, a role assignment has no effect; the
workflow creates or modifies no configuration file. The user-invoked
`configure` skill is the guided setup path for this file (and for OpenCode's
`--models` config); it writes only on explicit confirmation of the exact path
and content.

## Generated OpenCode binding

OpenCode V2 is the one runtime whose documented subagent interface selects a
preconfigured profile with no documented per-call model override, so the flat
model config is materialized as generated profiles under `agents/agenticale/`:
the **seven base worker profiles** always render — `explore`, `implement`,
`implement-hard`, `fix`, `review`, `review-deep`, and `consult` — while
`implement-easy` and `consult-hard` render only when the config lists them.
When the config assigns the top-level `coordinator` key, the build also
generates one visible primary `agenticale/coordinator` profile (no step
ceiling, normal ability to dispatch children) from the adapter-owned
coordinator body; it is a session assignment, never a worker route.
`implement`, `implement-easy`, and `implement-hard` are distinct profiles that
reuse the `implement` task-contract body, and `consult`/`consult-hard` reuse
the `consult` body; their models come from the flat config like every other
role. Each generated profile carries the adapter's `mode`, `steps`, and
`permissions` frontmatter plus the matching neutral task-contract body. A role
with an explicit config entry writes one `model:` line in
`provider/model[#variant]` form into the profile frontmatter (the reasoning
variant rides on the model line; there is no separate effort field); a role
with no entry omits the `model:` line so the profile inherits the session
model.

The binding also carries four command entries, `commands/work.md`,
`commands/review.md`, `commands/autonomous.md`, and `commands/configure.md`,
rendered from the adapter-owned templates in `adapters/opencode/commands/`.
Each is a thin launcher that explicitly loads the matching skill by its exact
ID and passes through `$ARGUMENTS`; they are the only way OpenCode V2 exposes
`/work`, `/review`, `/autonomous`, and `/configure`, because OpenCode does not
interpret the skills' `slash` portability field. When the config assigns the
coordinator, each workflow command additionally binds
`agent: agenticale/coordinator` with `subagent: false`, running the workflow
in the current session on the coordinator's model from the first turn;
without it the commands stay caller-session launchers. The configure command
declares `bindCoordinator: false` and always stays a caller-session launcher:
setup is a user-owned conversation, not a workflow round. The workflow rules
stay in the skills; the commands carry none of them.

The adapter metadata lives at `adapters/opencode/` (`adapter.json`, the
`commands/` templates, and `README.md`) and is the only machine-readable
description the build reads to render the OpenCode binding. Step ceilings and
permission denials are OpenCode adapter concerns; they are not claimed on the
other hosts.

Customization follows the same model on OpenCode: the flat model config
determines which profiles render — the seven base workers always, the two
optional workers and the coordinator only when listed — with exactly one
generated profile per configured role and no per-call model override. To
change a role's model, rerun the checkout-based installer with a different
`--models` configuration (adding `--replace` when the generated profiles
differ). OpenCode picks up the refreshed profiles without an app restart: a
running server reloads them automatically after a save (`/reload` forces a
full reload), and the next fresh workflow invocation dispatches with them.
The installer leaves `opencode.jsonc` and
`default_agent` unchanged and updates only the generated profiles it owns.
Preference-file role lines do not apply to an OpenCode installation — its
`## Work` section does. A role whose installed profile is missing or
unreadable blocks only that role's dispatch and is reported with the installer
rerun rather than silently substituted; an optional route that is simply
unconfigured falls back to its base route by the shared routing policy.
Whether an optional route is configured is established from the installer's
ownership manifest (`.autonomous-mode-install.json`) at the effective install
root — read-only, at most once per activation — not from the available
profiles alone: the latest successful install inventory is authoritative,
so an omitted route has no entry even when a modified file was preserved
and left behind. A missing, unreadable, or ambiguous manifest leaves intent
unestablished and is reported as a conservative limitation without blocking
unrelated base roles.

## Distribution

One modern Agent Plugins 1.0 package carries the six public skills, their
task and reference resources, and optional OpenAI presentation metadata
(`agents/openai.yaml`). Package identity: name `agenticale`, author
"Ale Franz", MIT license, schema
`https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`; the current
version is `pluginManifest.version` in `scripts/build.mjs`.

```text
plugins/agenticale/                 committed generated default modern package
.github/plugin/marketplace.json     Copilot catalog
.agents/plugins/marketplace.json    OpenAI catalog
```

The two catalogs use their respective schemas but point to the same generated
package. `scripts/publish-default-plugin.mjs` regenerates the package and both
catalogs; `--check` verifies all artifacts are current.

## Build output

`scripts/build.mjs` reads the authored core and the OpenCode and Qwen Code
adapters and writes four output roots beneath `--output` (default `dist`):

| Output root | Contents |
| --- | --- |
| `<output>/plugin/agenticale` | Agent Plugins 1.0 package (45 files: `plugin.json` + the six skills and their resources, with the preference fragment appended to the workflow skills) |
| `<output>/standalone/.agents/skills` | the six standalone skills (44 files), no plugin dependency, with the preference fragment appended to the workflow skills |
| `<output>/opencode` | the seven base worker profiles (plus the optional `implement-easy`/`consult-hard` and `coordinator` profiles when configured — all ten with the packaged default), the same skills, and the four command entries (51 files with the packaged default) |
| `<output>/qwen-code` | the flat `agents/agenticale-<role>.md` worker profiles (the same seven base roles, plus the optional roles and the flat coordinator when configured — all ten with the packaged default), the same six skills (47 files with the packaged default); codex-routed model values render a pinned codex executor block instead of a model line |

The build writes `.agenticale-build.json` (schemaVersion 3) describing the
package, the model config source, the no-model flag, the rendered profiles,
and the Qwen Code render modes (including a `coordinatorSkipped` record when
the coordinator value is codex-routed). Build output must not target the
repository root or a source directory. Disposable `dist/` artifacts are
ignored and never edited by hand.

## Installers

Each installer owns a distinct destination and records its own state so updates
and removal touch only owned, unmodified files. Modified files are preserved and
reported; replacements are backed up.

| Installer | Installs | State |
| --- | --- | --- |
| `scripts/install-copilot.mjs` | the modern shared plugin, via `copilot plugin install` | managed by the Copilot plugin store |
| `codex plugin marketplace add` + `codex plugin add` | the shared plugin from `.agents/plugins/marketplace.json` | managed by the Codex plugin store |
| `scripts/install-standalone.mjs` | the six standalone skills to project scope (`<cwd>/.agents/skills`, default) or user scope (`~/.agents/skills`) | `.agenticale-standalone-install.json` (schema 1) |
| `scripts/install.mjs` | the generated OpenCode output (skills + seven base worker profiles + optional profiles + four command entries) | `.autonomous-mode-install.json` (schema 7, 55-file inventory by default, up to 58) |
| `scripts/install.mjs qwen-install` | the generated Qwen Code output (skills + flat `agenticale-*` agent profiles) | `.autonomous-mode-install.json` (schema 1, package `qwen-code-autonomous-mode`, 54 files with all roles and the coordinator) |

The OpenCode installer is copy-only. It builds to a temporary root and copies the
generated output into the OpenCode configuration directory; it does not link to
the repository source. On install it migrates older copy installs (state schema
1-4), older link installs (schema 1-4), and older generated installs (schema
5-6, retiring the owned pre-rename `deep-review` profile) to the current
generated copy layout. Same-schema updates reconcile the historical complete
skill sets: a pre-configure schema-7 state (five skills, three command
entries) validates and gains the configure skill and command entry without
`--replace`, and the standalone installer refreshes its pre-configure
five-skill `sourceLayout` the same way.
The standalone installer provides an alternative local skill install for Codex
CLI, the VS Code extension, and Codex in the ChatGPT desktop app.
The Qwen Code installer is copy-only with no legacy migrations. It reuses the
OpenCode ownership, backup, and rollback mechanics but records its own package
identifier in the shared state file name, so it refuses to manage a state file
written by a different AgenticAle package.

## Safety and state boundaries

The coordinator is intentionally thin: children receive compact packets and
return reports. Autonomous Mode persists their relevant content as compact
task evidence in the target repository; everyday work keeps them in session
context. Git operations follow the user's
requested endpoint and applicable repository instructions: everyday work's
default delivery is uncommitted, while a new Autonomous run defaults to
coherent task commits and a confirmed ordinary push per completed task, with
explicit restrictions winning and resumes keeping the recorded policy. A
restricted Autonomous policy requires a concrete cited prohibition — a
conditional "unless explicitly asked" guard is satisfied by the invocation,
and another workflow's default or a role boundary is not a restriction.

Before implementation, the coordinator runs a brief material-risk assessment
— which independently mutable sources the request would touch (local working
trees, remote branches or pull requests, persisted state such as databases or
caches) and which of them other actors can also mutate, external side effects
that would survive an interruption, concurrent humans, ownership-sensitive
cleanup, and compatibility surfaces — and inspects only as much as the
request's concrete uncertainties require. Everyday work may answer
small questions with direct reads; Autonomous Mode keeps the main loop thin and
sends needed source evidence to a focused explore round. When the run ceiling
or another allowance is exhausted, no further worker round is dispatched, but
the required review of the last allowed worker still runs at zero worker
budget: the workflow reports the exhausted allowance, the completed and
blocked state, and recent verified progress, and recommends a bounded
correction, a bounded replan, or a stop. A limit reached with eligible work
remaining — and any stop leaving blocked or exhausted tasks — is an
INCOMPLETE safety stop, never a successful completion. An exhausted task
allowance in Autonomous Mode defers that task — verification and the
permitted review of its completed changes still run, and another truly
independent ready task may be selected with a fresh allowance — while a
steering pause or the absence of safe ready work stops the run. Every
incomplete stop carries a self-contained, copyable continuation prompt;
everyday work keeps it in the session only, while Autonomous Mode persists
it, with allowance usage and any granted or evidence-backed progress
extension, in the compact snapshot so a resume or a renamed target cannot
evade the unresolved-target limits. See the
[work-coordination examples](https://github.com/alefranz/AgenticAle/blob/main/docs/work-coordination-fixtures.md)
for the expected decisions.

Skills can request a model and effort but cannot prevent host-side fallback. An
adapter documents which guarantees are enforced by the harness and which are
only prompt conventions. The target project's `AGENTS.md` is optional; when
present, worker and review rounds read it for local conventions, and when absent
round prompts skip it.
