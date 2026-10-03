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
| Routing policy | `skills/work/references/routing.json` |
| Runtime bindings | `skills/work/references/runtimes/<host>.md` (four: `copilot`, `copilot-local`, `codex`, `opencode`) |

The two workflow skills are explicit-only: each sets
`copilot/disable-model-invocation: true` and `opencode/autoinvoke: false`, and
the OpenAI metadata (`agents/openai.yaml`) disables implicit invocation. The
invoking session is the coordinator; there is no selectable coordinator profile
and no `commands/` entry. The session owns its own model and effort, and it
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
`rounds.md`, the `ROUTING.md` reference and `routing.json`, the four runtime
bindings, the six task contracts, the `adapters/opencode/` metadata, and the two
supporting skills, for 21 source-of-truth files. The retired layout
(`commands/`, `agents/autonomous/`, `skills/work-mode`, `skills/autonomous-mode`)
must be absent.

## The routing contract

Routing is an explicit, versioned policy, not a fallback chain.
`skills/work/references/routing.json` (schemaVersion 1) names, for each of three
runtimes (`copilot`, `codex`, `opencode`) and each of seven routing keys
(`explore`, `implement`, `implement-hard`, `fix`, `review`, `deep-review`,
`consult`), either an explicit model and effort or explicit inheritance. A route
is either `mode: explicit` (a non-empty model and an optional supported effort)
or `mode: inherit` (no model or effort, an explicit choice). There are no
fallbacks, and a missing key in a complete policy is an error.

The packaged baseline is the `gpt-6` family, provider-qualified per host:
`OpenAI/` for Copilot, `openai/` for Codex, `opencode/` for OpenCode. A
top-level `provenance` note records that this baseline is an inventory derived
from the `examples` mappings, unverified in the documentation-only pass, and that
identifiers should be validated per host or overridden.

Build and install options resolve the policy:

- `--routing PATH` builds from a complete caller-supplied policy (conflicts with
  `--models`).
- `--models PATH|PRESET` imports a legacy `provider/model[#variant]` inventory
  and converts it; omitted keys become explicit inheritance and are reported.
- `--no-model` forces inheritance for every route.
- `--effort LEVEL` is a route-wide reasoning-effort override.
- `--coordinator-effort` is retired and reports a notice that the session now
  owns the setting.

Requested routing precedence at dispatch is: an explicit user/task override, then
an explicitly selected project or user routing file, then the packaged preset.

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

The adapter metadata lives at `adapters/opencode/` (`adapter.json` and
`README.md`) and is the only machine-readable description the build reads to
render the OpenCode binding. Step ceilings and permission denials are OpenCode
adapter concerns; they are not claimed on the other hosts.

## Distribution

One modern Agent Plugins 1.0 package carries the four public skills, their
task/routing resources, and optional OpenAI presentation metadata
(`agents/openai.yaml`). Package identity: name `agenticale`, version `0.2.0`,
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
| `<output>/plugin/agenticale` | Agent Plugins 1.0 package (20 files: `plugin.json` + the four skills and their resources) |
| `<output>/standalone/.agents/skills` | the four standalone skills (19 files), no plugin dependency |
| `<output>/opencode` | the seven generated profiles plus the same skills (26 files) |

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
| `scripts/install-standalone.mjs` | the four standalone skills to project scope (`<cwd>/.agents/skills`, default) or user scope (`~/.agents/skills`) | `.agenticale-standalone-install.json` (schema 1) |
| `scripts/install.mjs` | the generated OpenCode output (skills + seven profiles) | `.autonomous-mode-install.json` (schema 6, 26-file inventory) |

The OpenCode installer is copy-only. It builds to a temporary root and copies the
generated output into the OpenCode configuration directory; it does not link to
the repository source. On install it migrates older copy installs (state schema
1-4) and older link installs (schema 1-4) to the current generated copy layout.
The standalone installer requires no native agent or plugin, which is the path
for the official Codex VS Code extension.

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
