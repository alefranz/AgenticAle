# Architecture

AgenticAle is a set of portable coding skills with explicit model routing,
distributed as one Agent Plugins 1.0 package. It carries everyday reviewed task
work (`work`), durable autonomous project work (`autonomous`), and two
supporting skills (`source-code-lookup`, `pull-request-description`). Runtime
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
| Workflow skills | `skills/work/SKILL.md`, `skills/autonomous/SKILL.md` |
| Task contracts | `skills/work/references/tasks/<role>.md` (six: `explore`, `implement`, `fix`, `review`, `deep-review`, `consult`) |
| Routing contract | `skills/work/references/ROUTING.md` |
| Routing defaults baseline | `skills/work/references/routing.json` (schemaVersion 2) |
| Routing customization example | `skills/work/references/routing.example.md` |
| Shared routing module | `skills/work/scripts/routing.mjs` (dependency-free, packaged with the work skill) |
| Runtime bindings | `skills/work/references/runtimes/<host>.md` (four: `copilot`, `copilot-local`, `codex`, `opencode`) |

The two workflow skills are explicit-only: each sets
`copilot/disable-model-invocation: true` and `opencode/autoinvoke: false`, and
the OpenAI metadata (`agents/openai.yaml`) disables implicit invocation. The
invoking session is the coordinator; there is no selectable coordinator profile
and no `commands/` entry in the authored core (the OpenCode binding ships two
thin command entries — see the generated binding below). The session owns its
own model and effort, and it
dispatches fresh children using task-specific instructions and the caller
selected or configured route.

`skills/work/references/rounds.md` is the shared round contract: the child task
packet, compact reports, reset criteria, and the review/fix gate. Both workflows
load it, and every build and install includes it. The six task contracts are
capability-neutral: they carry only the role's instructions, with no
host-specific protocol. `implement` and `implement-hard` share the same
`implement` contract; `implement-hard` is a routing key, not a separate contract
or profile.

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

The authored source-of-truth layout is what `scripts/validate.mjs` asserts
exists: the two workflow skills plus their `agents/openai.yaml`, the shared
`rounds.md`, the `ROUTING.md` reference, the `routing.json` defaults baseline,
the `routing.example.md` customization example, the shared `scripts/routing.mjs`
module, the four runtime bindings, the six task contracts, the
`adapters/opencode/` metadata (adapter, command templates, and README), and the
two supporting skills, for 25 source-of-truth files. The retired layout
(`commands/`, `agents/autonomous/`, `skills/work-mode`, `skills/autonomous-mode`)
must be absent.

## The routing contract

Routing has two boundaries. The orchestrator interprets the user's Markdown
preference files in context. Deterministic tooling — the shared module
`skills/work/scripts/routing.mjs` and the build — consumes structured
preferences and concrete routes only. There is no partial Markdown parser that
quietly rejects valid prose, and no build or installer that needs an API call
to read user files. The user's files are sparse preferences with no required
schema version, frontmatter, or parser dependency; the contract itself is
versioned machine data.

### The version-2 defaults baseline

`skills/work/references/routing.json` (schemaVersion 2) is the packaged
defaults contract: a common `roleTiers` map (the seven exposed role names to
`fast`, `routine`, `standard`, or `deep`) plus per-runtime `tiers` definitions and
optional per-runtime `roles` exceptions, for the three runtimes (`copilot`,
`codex`, `opencode`). A version-2 role entry is a tier reference
(`{ "mode": "tier", "tier": ... }`), an explicit model/effort selection with
optional ordered fallback pairs, or an inheritance entry. The packaged
baseline declares all three runtimes and mirrors `examples/openai.json`: Copilot
and Codex use native bare model IDs, while OpenCode keeps the `openai/` provider
prefix. Its `provenance` note records that model access depends on each host and
account. `default` and `inherit` are reserved instructions, not tier names.

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
- concrete resolution (`resolveRuntime`, `resolveAllRuntimes`) with source and
  provenance labels and the reset semantics (`role: default`, `tier: default`,
  `inherit`);
- version-1 normalization and build overrides (`mergeV2MissingRuntimes`,
  `normalizeV1ToV2`, `legacyInventoryToV2`, `applyBuildOverrides`);
- strict version-1 export (`exportV1`, `exportV1All`), compatible with the
  existing validator;
- discovery helpers (`discoverPreferencePaths`, `loadPackagedBaseline`,
  `packagedBaselinePath`) that compute candidate paths for the caller. The
  module never reads preference files on its own, and default builds and
  publication must not call the discovery helper, so their output stays
  reproducible.

It also provides a `resolve` CLI: it reads the installed baseline (or
`--baseline PATH`) plus structured preference JSON (stdin or `--input PATH`)
and prints a valid version-1 policy for the complete active runtime
(`--runtime copilot|codex|opencode`). It does not interpret Markdown and does
not discover files; its errors identify the affected runtime, role/tier, and
source.

### Dual installed resources

Every build resolves the effective baseline once and writes both installed
resources from that single pass: `references/routing.json` (the version-2
baseline, retaining the tier relationships runtime customization needs) and
`references/resolved-routing.json` (the fully resolved version-1 snapshot —
all seven roles per runtime, each a concrete selection or `inherit`). The
snapshot supports compatibility, comparison, and export; it is a snapshot of
installed choices, not an override above user preferences. The resolver's
concrete result also supplies OpenCode profile rendering, so there is no
second hand-maintained role/model inventory.

### Precedence and merge

Precedence is per named entry, from highest to lowest:

```text
Invocation preferences
  > repository routing.md
  > personal routing.md
  > installed/package baseline
```

Tier definitions and role selections merge separately, replacing entries
atomically (a replacement carries its own model, effort, and fallbacks as one
unit; a new selection without fallbacks has an empty fallback list). An
omitted entry preserves the lower layer. Role-to-tier references resolve only
after all layers merge. `role: default` clears a lower-precedence role
exception; `tier: default` restores a standard tier's baseline definition;
`inherit` intentionally inherits the session model and effort. Unknown roles,
undefined tier references, and ambiguity in the final effective selection are
surfaced with their source location and block only the affected dispatch.

Build and install options resolve the policy:

- `--routing PATH` builds from a caller-supplied version-1 or version-2 file
  (conflicts with `--models`). A complete version-1 policy normalizes to exact
  direct role exceptions over the packaged tiers, undeclared runtimes merge
  from the packaged defaults, and a Markdown path is rejected with a clear
  explanation pointing at the runtime preference files or a resolved JSON
  export.
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

## Generated OpenCode binding

OpenCode V2 is the one runtime whose documented subagent interface selects a
preconfigured profile with no documented per-call model override, so the resolved
routes are materialized as **seven** generated profiles under
`agents/autonomous/`: `explore`, `implement`, `implement-hard`, `fix`, `review`,
`deep-review`, and `consult`. There is no coordinator profile. `implement-hard`
is a distinct profile that reuses the `implement` task-contract body at a higher
reasoning effort. Each generated profile carries the adapter's `mode`, `steps`, and
`permissions` frontmatter plus the matching neutral task-contract body. An
explicit route writes a `model:` line and reasoning effort into the profile
frontmatter; an inherit route omits the `model:` line so the profile inherits the
session model.

The binding also carries two command entries, `commands/work.md` and
`commands/autonomous.md`, rendered from the adapter-owned templates in
`adapters/opencode/commands/`. Each is a thin launcher that explicitly loads
the matching skill by its exact ID and passes through `$ARGUMENTS`; they are
the only way OpenCode V2 exposes `/work` and `/autonomous`, because OpenCode
does not interpret the skills' `slash` portability field. The workflow rules
stay in the skills; the commands carry none of them.

The adapter metadata lives at `adapters/opencode/` (`adapter.json`, the
`commands/` templates, and `README.md`) and is the only machine-readable
description the build reads to render the OpenCode binding. Step ceilings and
permission denials are OpenCode adapter concerns; they are not claimed on the
other hosts.

Customization follows the same two-boundary model on OpenCode: the resolved
selections determine what the seven profiles render, but additional tiers never
create new profiles or task contracts — there remains exactly one profile per
routing key, and per-call model overrides stay bounded by the preconfigured
profiles. When a user's preference file selects routes no installed profile
matches, the workflow reports the mismatch with an actionable preparation
command and never dispatches the route as if it were honored. The explicit
refresh path — a resolved version-1 export plus the existing checkout-based
installer, then a restart or new session — is documented in
`references/runtimes/opencode.md` (OpenCode preparation and refresh).

## Distribution

One modern Agent Plugins 1.0 package carries the four public skills, their
task/routing resources, and optional OpenAI presentation metadata
(`agents/openai.yaml`). Package identity: name `agenticale`, version `0.3.0`,
author "Ale Franz", MIT license, schema
`https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`.

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
| `<output>/plugin/agenticale` | Agent Plugins 1.0 package (23 files: `plugin.json` + the four skills and their resources, including the routing baseline, example, resolved snapshot, and shared module) |
| `<output>/standalone/.agents/skills` | the four standalone skills (22 files), no plugin dependency |
| `<output>/opencode` | the seven generated profiles plus the same skills (31 files) |

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
| `scripts/install-standalone.mjs` | the four standalone skills to project scope (`<cwd>/.agents/skills`, default) or user scope (`~/.agents/skills`) | `.agenticale-standalone-install.json` (schema 1) |
| `scripts/install.mjs` | the generated OpenCode output (skills + seven profiles) | `.autonomous-mode-install.json` (schema 6, 31-file inventory) |

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

Skills can request a model and effort but cannot prevent host-side fallback. An
adapter documents which guarantees are enforced by the harness and which are
only prompt conventions. The target project's `AGENTS.md` is optional; when
present, worker and review rounds read it for local conventions, and when absent
round prompts skip it.
