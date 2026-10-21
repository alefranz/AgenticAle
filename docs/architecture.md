# Architecture

AgenticAle is a set of portable coding skills with explicit model routing,
distributed as one Agent Plugins 1.0 package. It carries everyday reviewed task
work (`work`), standalone branch review (`review`), durable autonomous project
work (`autonomous`), and two supporting skills
(`source-code-lookup`, `pull-request-description`). Runtime
specifics are kept out of the skills: Copilot and Codex dispatch native children
with per-call model and effort, and OpenCode gets a generated set of routing
profiles as a compatibility adapter.

Live runtime behavior is not asserted here; see
[runtime-compatibility.md](runtime-compatibility.md), where every capability is
**not tested** in this documentation-only pass.

## The authored core

Four concerns are separated so each can change independently:

| Concern | Where |
| --- | --- |
| Workflow skills | `skills/work/SKILL.md`, `skills/review/SKILL.md`, `skills/autonomous/SKILL.md` |
| Task contracts | `skills/work/references/tasks/<role>.md` (six: `explore`, `implement`, `fix`, `review`, `deep-review`, `consult`) |
| Routing contract | `skills/work/references/ROUTING.md` |
| Routing defaults baseline | `skills/work/references/routing.json` (schemaVersion 2) |
| Routing customization example | `skills/work/references/routing.example.md` |
| Shared routing module | `skills/work/scripts/routing.mjs` (dependency-free, packaged with the work skill) |
| Runtime bindings | `skills/work/references/runtimes/<host>.md` (five: `copilot`, `copilot-local`, `codex`, `opencode`, `antigravity`) |

The three workflow skills are explicit-only: each sets
`copilot/disable-model-invocation: true` and `opencode/autoinvoke: false`, and
the OpenAI metadata (`agents/openai.yaml`) disables implicit invocation. The
invoking session is the coordinator; there is no selectable coordinator profile
and no `commands/` entry in the authored core (the OpenCode binding ships three
thin command entries — see the generated binding below). The session owns its
own model and effort, and it
dispatches fresh children using task-specific instructions and the caller
selected or configured route.

`skills/work/references/rounds.md` is the shared round contract: the child task
packet, compact reports, reset criteria, and the review/fix gate. Both workflows
load it, and every build and install includes it. For complex bounded goals, it
also defines sequential decomposition: the coordinator can outline provisional
outcomes, complete and review one slice at a time, then reassess based on the
evidence. Replanning does not reset the task's budgets or failure limits, and
the accumulated changes receive combined acceptance checks before delivery.
It also defines checkpoints after substantive rounds and visible progress
narration before substantive assignments: the result, next action, and reason
in a short paragraph. Detailed routing records and budget counters remain in
workflow state; the coordinator surfaces them when they affect a decision or
the user asks. This keeps the main conversation understandable even when a
host collapses child activity, without relying on any particular host layout.
The contract also defines review-closure rules for re-reviews and the
self-contained continuation prompt that every incomplete stop carries.
The six task contracts are capability-neutral: they carry only the role's
instructions, with no host-specific protocol. `implement` and `implement-hard`
share the same `implement` contract; `implement-hard` is a routing key, not a
separate contract or profile. A hard review finding keeps the `fix` contract
and the fix counters while it dispatches on the `implement-hard` route.

`pull-request-description` is read before writing or revising a PR body;
`source-code-lookup` is read when another codebase's behavior matters. Both are
loaded in full when their task triggers apply. Lookup evidence uses the active
state policy, and an unavailable configured source root is reported rather than
silently replaced.

`skills/autonomous/SKILL.md` adds durable backlog, handoff, archival, and
continuation policies. The target project owns `BACKLOG.md` and
`docs/handoffs/active.md`; this repository's files with those names are only its
own development state. Everyday `work` does not resume those files or promise
recovery after loss of the host session.

Work's routing defaults express a cost/value design: fast exploration and
routine implementation/fixes, standard review and hard implementation, and
conditional deep review. Fresh-agent review can use the same model as the
worker, and route inheritance can select the session model. Work stops and
reports explicit provider quota exhaustion without durable recovery; only
Autonomous applies the cooldown and handoff policy below.

Autonomous mode also persists provider-quota cooldown and retry state in its
existing active handoff. It can resume long work from verified partial progress
after a supported wait or a later activation; it does not promise an automatic
wake when the host exposes no such capability. See the
[quota recovery examples](https://github.com/alefranz/AgenticAle/blob/main/docs/autonomous-quota-fixtures.md) for the behavior
boundaries.

The authored source-of-truth layout is what `scripts/validate.mjs` asserts
exists: the three workflow skills plus their `agents/openai.yaml`, the shared
`rounds.md`, the `ROUTING.md` reference, the `routing.json` defaults baseline,
the `routing.example.md` customization example, the shared `scripts/routing.mjs`
module, the shared `scripts/session-stats.mjs` helper, the five runtime
bindings, the six task contracts, the `adapters/opencode/` metadata (adapter,
command templates, and README), and the two supporting skills, for 30
source-of-truth files. The retired layout
(`commands/`, `agents/autonomous/`, `skills/work-mode`, `skills/autonomous-mode`)
must be absent.

## The routing contract

Routing uses JSON for the packaged defaults and structured resolver inputs;
users author preferences in Markdown. The workflow reads the optional
personal and project files and interprets them into structured layers; the
packaged resolver merges those layers with the installed baseline and never
reads or discovers user files. The build never discovers user files either,
so generated packages remain reproducible.

### The version-2 defaults baseline

`skills/work/references/routing.json` (schemaVersion 2) is the packaged
defaults contract: a common `roleTiers` map (the seven exposed role names to
`fast`, `routine`, `standard`, or `deep`) plus per-runtime `tiers` definitions and
optional per-runtime `roles` exceptions, for the four runtimes (`copilot`,
`codex`, `opencode`, `antigravity`). A version-2 role entry is a tier reference
(`{ "mode": "tier", "tier": ... }`), an explicit model/effort selection with
optional ordered fallback pairs, or an inheritance entry. The packaged
baseline declares all four runtimes and mirrors `examples/openai.json`: Copilot
and Codex use native bare model IDs, while OpenCode keeps the `openai/` provider
prefix; Antigravity uses host-native tier choices (`flash`, `pro`) with no
reasoning-effort parameter. Its `provenance` note records that model access
depends on each host and account. `default` and `inherit` are reserved
instructions, not tier names.

### The shared module

`skills/work/scripts/routing.mjs` is the packaged, dependency-free module (Node
builtins only, ESM), so it runs from an installed fixture with no repository
source present. It exposes:

- validation for version-1 complete policies and version-2 defaults
  (`validateRouting`, `strictValidateRouting`, `validateV2Routing`,
  `validatePreferenceLayer`);
- preference-layer merging (`normalizePreferenceInput`, `mergePreferenceLayers`)
  — lowest to highest precedence, atomic entry replacement, tier and role
  sections merged separately, tier references resolved only after all layers
  merge;
- named routing profile selection (`availableProfiles`, the optional
  `profile` argument of the merge and resolve functions) — a selected
  profile expands into per-layer precedence-ordered sub-layers;
- concrete resolution (`resolveRuntime`, `resolveAllRuntimes`) with source and
  provenance labels and the reset semantics (`role: default`, `tier: default`,
  `inherit`);
- version-1 normalization and build overrides (`mergeV2MissingRuntimes`,
  `normalizeV1ToV2`, `legacyInventoryToV2`, `applyBuildOverrides`);
- strict version-1 export (`exportV1`), compatible with the existing validator;
- personal and project Markdown paths for the workflow to interpret. The
  resolver does not discover user files.

The `resolve` CLI reads the installed baseline and an optional structured
layer (`--input PATH`) produced by interpreting the Markdown preferences. It
prints a complete version-1 policy for the active runtime
(`--runtime copilot|codex|opencode|antigravity`); `--profile NAME` selects a
named routing profile (below), and `--explain` includes per-route source
provenance plus the selected profile (`null` for ordinary routing).

The `startup` CLI is the workflow's default startup path. It checks the
documented preference locations — the personal `~/.agenticale/routing.md`
and, with `--root PATH`, the project `<root>/.agenticale/routing.md` (exact
path, no parent scanning; deduplicated against the personal location when
the root is the home directory) — without reading their contents, and
accepts `--profile NAME` and, for the agent-profile comparison,
`--agents-dir PATH` (default for opencode: the installed
`agents/agenticale/` beside the skill). With no preference file present it
takes the no-input short path: it resolves the installed baseline directly,
with no preference layers and no input file, and prints a `resolved`
result — the strict version-1 `policy`, per-role `routeProvenance`, the
selected `profile` (`null` for ordinary routing), and, for opencode or an
explicit `--agents-dir`, an `agents` map comparing each resolved route
against the installed agent profiles — each role `match`, `mismatch` (a
compact note plus the expected and installed values), `missing` (no file),
or `unreadable` (unreadable file, no parseable frontmatter, or a duplicated
field). With a present file it prints an `interpretation-required` result
naming the `presentFiles`; the workflow then interprets the Markdown itself
and resolves the layers through `resolve --input <file> --explain`. A
present but unreadable file is an actionable error, never treated as
absent, and an unknown `--profile` with no preference files fails with the
actionable unknown-profile message. `startup` accepts no invocation layers:
its `resolved` result finalizes only when the activation carries no
invocation-level preferences, which the workflow then interprets — together
with any discovered files — through `resolve --input <file> --explain`.

### One installed defaults file

Every build installs `references/routing.json`, the version-2 baseline. The
resolver derives concrete routes when needed, and the same result renders
OpenCode profiles. There is no checked-in or packaged expanded snapshot.

### Precedence and merge

Precedence is per named entry, from highest to lowest:

```text
Invocation preferences
  > `<project-root>/.agenticale/routing.md`
  > `~/.agenticale/routing.md`
  > installed/package baseline
```

Tier definitions and role selections merge separately, replacing entries
atomically (a replacement carries its own model, effort, and fallbacks as one
unit; a new selection without fallbacks has an empty fallback list). An
omitted entry preserves the lower layer. Role-to-tier references resolve only
after all layers merge. `role: default` clears a lower-precedence role
exception; `tier: default` restores a standard tier's baseline definition;
`inherit` intentionally inherits the session model and effort. Unknown roles
and undefined tier references are errors with their source file.

Build and install options resolve the policy:

- `--routing PATH` builds from a caller-supplied version-1 or version-2 file
  (conflicts with `--models`). A complete version-1 policy normalizes to exact
  direct role exceptions over the packaged tiers and undeclared runtimes merge
  from the packaged defaults. Runtime-discovered `routing.md` preferences are
  interpreted by the workflow and are not build inputs.
- `--models PATH|PRESET` imports a legacy `provider/model[#variant]` inventory
  and converts it; omitted keys become explicit inheritance and are reported.
- `--no-model` forces inheritance for every route.
- `--effort LEVEL` is a route-wide reasoning-effort override; it is rejected
  when any effective route inherits.
- `--coordinator-effort` is retired and reports a notice that the session now
  owns the setting.

Build-time flags are explicit operations on the installed baseline, not
remembered invocation preferences: installed inheritance and direct-role
exceptions remain until a higher role selection or `default` clears them, and
tier edits alone preserve them.

### Named routing profiles

Markdown preference files may contain optional `## Profile: <name>` sections,
which the workflow interprets into the structured layer's `profiles` map —
profile name to per-runtime tier/role sections in the same shape as the
layer's `runtimes`. Exactly one profile is selected per activation; `default`
(or no selector) means ordinary routing. For a selected profile, precedence is
lowest to highest: installed baseline, personal default entries, personal
entries for the selected profile, project default entries, project entries for
the selected profile, default and selected-profile entries from an explicitly
supplied invocation Markdown file, and direct invocation overrides. The full
contract is in
[ROUTING.md](https://github.com/alefranz/AgenticAle/blob/main/skills/work/references/ROUTING.md#named-routing-profiles).

The resolver accepts an optional selected-profile argument and exposes
`availableProfiles(layers, runtime)`. A selected profile's entries resolve
through sub-layers labeled `<layer source> (profile <name>)`. The `--explain`
output carries the per-route `routeProvenance` and the selected profile
(`null` for ordinary routing), while the strict version-1 policy export stays
unchanged — profile metadata never enters the policy. Within-profile
semantics are unchanged: omitted entries retain the lower-precedence choice,
replacement is atomic, and `role: default`, `tier: default`, and `inherit`
keep their existing meanings.

## Generated OpenCode binding

OpenCode V2 is the one runtime whose documented subagent interface selects a
preconfigured profile with no documented per-call model override, so the resolved
routes are materialized as **seven** generated profiles under
`agents/agenticale/`: `explore`, `implement`, `implement-hard`, `fix`, `review`,
`deep-review`, and `consult`. There is no coordinator profile. `implement-hard`
is a distinct profile that reuses the `implement` task-contract body at a higher
reasoning effort. Each generated profile carries the adapter's `mode`, `steps`, and
`permissions` frontmatter plus the matching neutral task-contract body. An
explicit route writes a `model:` line and reasoning effort into the profile
frontmatter; an inherit route omits the `model:` line so the profile inherits the
session model.

The binding also carries three command entries, `commands/work.md`,
`commands/review.md`, and `commands/autonomous.md`, rendered from the
adapter-owned templates in `adapters/opencode/commands/`. Each is a thin
launcher that explicitly loads the matching skill by its exact ID and passes
through `$ARGUMENTS`; they are the only way OpenCode V2 exposes `/work`,
`/review`, and `/autonomous`, because OpenCode does not interpret the skills'
`slash` portability field. The workflow rules stay in the skills; the commands
carry none of them.

The adapter metadata lives at `adapters/opencode/` (`adapter.json`, the
`commands/` templates, and `README.md`) and is the only machine-readable
description the build reads to render the OpenCode binding. Step ceilings and
permission denials are OpenCode adapter concerns; they are not claimed on the
other hosts.

Customization follows the same model on OpenCode: the resolved
selections determine what the seven profiles render, but additional tiers never
create new profiles or task contracts — there remains exactly one default
generated profile per routing key, and per-call model overrides stay bounded
by the preconfigured profiles. Named routing sets add further user-owned
profiles under `agenticale/routing/<profile>/` without changing the default
seven. When a user's preference file selects routes no installed profile
matches, the workflow reports the mismatch with an actionable preparation
command and never dispatches the route as if it were honored. The explicit
refresh path — a resolved version-1 export plus the existing checkout-based
installer, then a restart or new session — is documented in
`references/runtimes/opencode.md` (OpenCode preparation and refresh).

## Distribution

One modern Agent Plugins 1.0 package carries the five public skills, their
task/routing resources, and optional OpenAI presentation metadata
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
| `<output>/plugin/agenticale` | Agent Plugins 1.0 package (26 files: `plugin.json` + the five skills and their resources, including one routing baseline, the preference example, and shared module) |
| `<output>/standalone/.agents/skills` | the five standalone skills (25 files), no plugin dependency |
| `<output>/opencode` | the seven generated profiles plus the same skills (35 files) |

The build writes `.agenticale-build.json` (schemaVersion 2) describing the
package, the routing source, the effort mode, and the resolved profiles. Build
output must not target the repository root or a source directory. Disposable
`dist/` artifacts are ignored and never edited by hand.

## Installers

Each installer owns a distinct destination and records its own state so updates
and removal touch only owned, unmodified files. Modified files are preserved and
reported; replacements are backed up.

| Installer | Installs | State |
| --- | --- | --- |
| `scripts/install-copilot.mjs` | the modern shared plugin, via `copilot plugin install` | managed by the Copilot plugin store |
| `codex plugin marketplace add` + `codex plugin add` | the shared plugin from `.agents/plugins/marketplace.json` | managed by the Codex plugin store |
| `scripts/install-standalone.mjs` | the five standalone skills to project scope (`<cwd>/.agents/skills`, default) or user scope (`~/.agents/skills`) | `.agenticale-standalone-install.json` (schema 1) |
| `scripts/install.mjs` | the generated OpenCode output (skills + seven profiles) | `.autonomous-mode-install.json` (schema 6, 35-file inventory) |

The OpenCode installer is copy-only. It builds to a temporary root and copies the
generated output into the OpenCode configuration directory; it does not link to
the repository source. On install it migrates older copy installs (state schema
1-4) and older link installs (schema 1-4) to the current generated copy layout.
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
routes needed source evidence to a focused explore round. When an allowance or
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
