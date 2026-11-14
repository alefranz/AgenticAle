# Architecture

AgenticAle is a set of portable coding skills with per-role model
configuration, distributed as one Agent Plugins 1.0 package. It carries
everyday reviewed task work (`work`), standalone branch review (`review`),
durable autonomous project work (`autonomous`), and two supporting skills
(`source-code-lookup`, `pull-request-description`). Runtime specifics are kept
out of the skills, and the workflow never resolves a model at activation:
Copilot, Codex, and Antigravity dispatch native children, and OpenCode gets a
generated set of agent profiles carrying the per-role model (with its
reasoning variant) from install time as a compatibility adapter, plus an
optional primary coordinator profile when the config assigns one.

Live runtime behavior is tracked in
[runtime-compatibility.md](runtime-compatibility.md): most capabilities remain
**not tested**, with one narrow recorded OpenCode `/work` routing pass.

## The authored core

Four concerns are separated so each can change independently:

| Concern | Where |
| --- | --- |
| Workflow skills | `skills/work/SKILL.md`, `skills/review/SKILL.md`, `skills/autonomous/SKILL.md` |
| Task contracts | `skills/work/references/tasks/<role>.md` (six: `explore`, `implement`, `fix`, `review`, `review-deep`, `consult`) |
| Flat model config | `adapters/opencode/models.json` (role → `"provider/model[#variant]"`, plus the optional top-level `coordinator` session key; unlisted roles inherit) |
| Plugin preference fragment | `adapters/plugin/model-configuration.md` (appended to the workflow skills in plugin and standalone outputs) |
| Runtime bindings | `skills/work/references/runtimes/<host>.md` (five: `copilot`, `copilot-local`, `codex`, `opencode`, `antigravity`) |
| Outcome-evaluation protocol (opt-in) | `skills/work/references/outcome-evaluation.md` (Work only; loaded only when a task is invoked with `--outcome`) |

The three workflow skills are explicit-only: each sets
`copilot/disable-model-invocation: true` and `opencode/autoinvoke: false`, and
the OpenAI metadata (`agents/openai.yaml`) disables implicit invocation.
The invoking session is the coordinator, and there is no `commands/` entry in
the authored core (the OpenCode binding ships three thin command entries — see
the generated binding below). On OpenCode the flat config may optionally
assign a `coordinator` session model: the build then generates one visible
primary `agenticale/coordinator` profile and binds the command entries to it,
so the workflow runs in the current session on that model from the first turn
(including an autonomous resume). Without a configured coordinator the
invoking session coordinates on its own model. The session owns its
own model and effort, and it dispatches fresh children using the task-specific
instructions; it never selects a model.

The standalone review skill covers the current branch's net changes from the
merge base to the current working-tree result — the committed branch review on
a clean tree — and returns findings without fixing. Work can start from a
requested outcome, existing changes, or a same-session preceding review's
findings, entering at the first necessary step.

`skills/work/references/rounds.md` is the shared round contract: the child task
packet, compact reports, reset criteria, the shared routing policy, and the
review/fix gate. Both workflows
load it, and every build and install includes it. Its routing policy binds
Work and Autonomous identically: `implement` is the default;
`implement-easy` (explicitly prescribed, bounded, mechanically verifiable
work) and `consult-hard` (conflicting evidence, interacting constraints, or
costly reversal) are opt-in routes that exist only where configured, falling
back to their base routes when omitted; `implement-hard` is dispatched
directly when a slice's correctness risk is visible, assessed per slice with
no category exemptions; a hard fix keeps the fix contract and counters; and
`consult-hard` consumes the same consultation allowance as `consult`. For
complex bounded goals, the contract
also defines sequential decomposition: the coordinator can outline provisional
outcomes, complete and review one slice at a time, then reassess based on the
evidence — including the next slice's route, which is never locked by an
earlier assignment. Replanning does not reset the task's budgets or failure limits, and
the accumulated changes receive combined acceptance checks before delivery.
It also defines checkpoints after substantive rounds and visible progress
narration before substantive assignments: the result, next action, and reason
in a short paragraph. Detailed model-dispatch records and budget counters
remain in workflow state; the coordinator surfaces them when they affect a
decision or the user asks. This keeps the main conversation understandable even when a
host collapses child activity, without relying on any particular host layout.
The contract also defines review-closure rules for re-reviews and the
self-contained continuation prompt that every incomplete stop carries.
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
worker rounds and the unchanged independent review gate, and reuses the
existing worker-round allowance and stop/continuation machinery. It is
instruction-level: no generic verdict script, no metric framework, no new
orchestration, and no new dispatch role.

`pull-request-description` is read before writing or revising a PR body;
`source-code-lookup` is read when another codebase's behavior matters. Both are
loaded in full when their task triggers apply. Lookup evidence uses the active
state policy, and an unavailable configured source root is reported rather than
silently replaced.

`skills/autonomous/SKILL.md` adds durable backlog, handoff, archival, and
continuation policies. The target project owns `BACKLOG.md` and the
`.agenticale/handoffs/` directory for the active packet and monthly archive.
This repository's handoff records describe its own development. Everyday
`work` uses session state for task coordination.

The flat model config is a flat per-role inventory: a role with no entry
inherits the session model, and the packaged config is an inventory, not a
verified account mapping. The two optional worker routes (`implement-easy`,
`consult-hard`) render only when listed, and the optional top-level
`coordinator` key assigns the coordinating session's model on OpenCode.
Fresh-agent review can use the same model as the
worker. Work stops and reports explicit provider quota exhaustion without
durable recovery; only Autonomous applies the cooldown and handoff policy
below.

Autonomous mode also persists provider-quota cooldown and retry state in its
existing active handoff. It can resume long work from verified partial progress
after a supported wait or a later activation; it does not promise an automatic
wake when the host exposes no such capability. See the
[quota recovery examples](https://github.com/alefranz/AgenticAle/blob/main/docs/autonomous-quota-fixtures.md) for the behavior
boundaries.

The authored source-of-truth layout is what `scripts/validate.mjs` asserts
exists: the three workflow skills plus their `agents/openai.yaml`, the shared
`rounds.md`, the `outcome-evaluation.md` outcome-protocol reference, the shared
`session-stats.mjs` helper, the five runtime bindings, the six task contracts,
the `adapters/opencode/` metadata (adapter, command templates, flat model
config, coordinator body, and README), the plugin preference fragment
(`adapters/plugin/model-configuration.md`), and the two supporting skills, for
30 source-of-truth files. The retired layout
(`commands/`, `agents/autonomous/`, `skills/work-mode`, `skills/autonomous-mode`)
and the retired routing paths (`ROUTING.md`, `routing.json`,
`preferences.example.md`, and `scripts/routing.mjs` under `skills/work/`) must
be absent.

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
  plugin and standalone outputs (not the OpenCode output, not the two
  non-workflow skills). It documents the one optional preference file the
  workflow reads at activation on per-spawn hosts: the nine child worker keys
  (no coordinator key — the host owns the session model), the combined
  `provider/model[#variant]` value form alongside the legacy comma-effort
  form, and the optional routes' fallback semantics.

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
workflow creates or modifies no configuration file.

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

The binding also carries three command entries, `commands/work.md`,
`commands/review.md`, and `commands/autonomous.md`, rendered from the
adapter-owned templates in `adapters/opencode/commands/`. Each is a thin
launcher that explicitly loads the matching skill by its exact ID and passes
through `$ARGUMENTS`; they are the only way OpenCode V2 exposes `/work`,
`/review`, and `/autonomous`, because OpenCode does not interpret the skills'
`slash` portability field. When the config assigns the coordinator, each
command additionally binds `agent: agenticale/coordinator` with
`subagent: false`, running the workflow in the current session on the
coordinator's model from the first turn; without it the commands stay
caller-session launchers. The workflow rules stay in the skills; the commands
carry none of them.

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

One modern Agent Plugins 1.0 package carries the five public skills, their
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

`scripts/build.mjs` reads the authored core and the OpenCode adapter and writes
three output roots beneath `--output` (default `dist`):

| Output root | Contents |
| --- | --- |
| `<output>/plugin/agenticale` | Agent Plugins 1.0 package (23 files: `plugin.json` + the five skills and their resources, with the preference fragment appended to the workflow skills) |
| `<output>/standalone/.agents/skills` | the five standalone skills (22 files), no plugin dependency, with the preference fragment appended to the workflow skills |
| `<output>/opencode` | the seven base worker profiles (plus the optional `implement-easy`/`consult-hard` and `coordinator` profiles when configured), the same skills, and the three command entries (32 files by default, up to 35) |

The build writes `.agenticale-build.json` (schemaVersion 2) describing the
package, the model config source, the no-model flag, and the rendered
profiles. Build output must not target the repository root or a source
directory. Disposable `dist/` artifacts are ignored and never edited by hand.

## Installers

Each installer owns a distinct destination and records its own state so updates
and removal touch only owned, unmodified files. Modified files are preserved and
reported; replacements are backed up.

| Installer | Installs | State |
| --- | --- | --- |
| `scripts/install-copilot.mjs` | the modern shared plugin, via `copilot plugin install` | managed by the Copilot plugin store |
| `codex plugin marketplace add` + `codex plugin add` | the shared plugin from `.agents/plugins/marketplace.json` | managed by the Codex plugin store |
| `scripts/install-standalone.mjs` | the five standalone skills to project scope (`<cwd>/.agents/skills`, default) or user scope (`~/.agents/skills`) | `.agenticale-standalone-install.json` (schema 1) |
| `scripts/install.mjs` | the generated OpenCode output (skills + seven base worker profiles + optional profiles + three command entries) | `.autonomous-mode-install.json` (schema 7, 32-file inventory by default, up to 35) |

The OpenCode installer is copy-only. It builds to a temporary root and copies the
generated output into the OpenCode configuration directory; it does not link to
the repository source. On install it migrates older copy installs (state schema
1-4), older link installs (schema 1-4), and older generated installs (schema
5-6, retiring the owned pre-rename `deep-review` profile) to the current
generated copy layout.
The standalone installer provides an alternative local skill install for Codex
CLI, the VS Code extension, and Codex in the ChatGPT desktop app.

## Safety and state boundaries

The coordinator is intentionally thin: children receive compact packets and
return reports. Autonomous Mode persists those reports to the target repository;
everyday work keeps them in session context. Git operations follow the user's
requested endpoint and applicable repository instructions, and default delivery
is uncommitted.

Before implementation, the coordinator runs a brief material-risk assessment
— which independently mutable sources the request would touch (local working
trees, remote branches or pull requests, persisted state such as databases or
caches) and which of them other actors can also mutate, external side effects
that would survive an interruption, concurrent humans, ownership-sensitive
cleanup, and compatibility surfaces — and inspects only as much as the
request's concrete uncertainties require. Everyday work may answer
small questions with direct reads; Autonomous Mode keeps the main loop thin and
sends needed source evidence to a focused explore round. When an allowance or
the budget is exhausted, no further round of exhausted type is dispatched: the
workflow reports the exhausted allowance, the completed and blocked state, and
recent material progress, and recommends a bounded correction, a bounded
replan, or a stop. Every incomplete stop carries a self-contained, copyable
continuation prompt; everyday work keeps it in the session only, while
Autonomous Mode persists it, with allowance usage and any granted extension,
in the existing handoff so a resume or a renamed target cannot evade the
unresolved-target caps. See the
[work-coordination examples](https://github.com/alefranz/AgenticAle/blob/main/docs/work-coordination-fixtures.md)
for the expected decisions.

Skills can request a model and effort but cannot prevent host-side fallback. An
adapter documents which guarantees are enforced by the harness and which are
only prompt conventions. The target project's `AGENTS.md` is optional; when
present, worker and review rounds read it for local conventions, and when absent
round prompts skip it.
