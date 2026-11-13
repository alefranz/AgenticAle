# OpenCode adapter

This adapter is the machine-readable metadata the build reads to render the
OpenCode V2 binding. It lives at `adapters/opencode/` and produces the generated
OpenCode output under `dist/opencode/`.

## 1. What the OpenCode binding is, and why it is the only mandatory shim

The skills-first core (`skills/work` and `skills/autonomous`) is authored
runtime-neutral: the neutral task contracts under
`skills/work/references/tasks/<role>.md` carry only the role's instructions and
nothing host-specific. On Copilot and Codex the runtime can select a model at
dispatch time, so no per-role agent file is required.

OpenCode V2 is the exception. Its documented subagent interface selects a
**preconfigured agent profile** and has **no documented per-call model
override**. A "direct child dispatch" therefore means the coordinator invokes the
child tool naming the configured profile for that role, and the model and
reasoning effort are materialized **inside the profile at install time**. So the
OpenCode binding must materialize the flat model config as generated agent
profiles. That profile generation is the **only currently planned mandatory shim**
— every other runtime binding stays agent-file-free. See
`skills/work/references/runtimes/opencode.md`.

Because the neutral contracts stay clean, the OpenCode-specific host metadata
that the old profiles used to carry — the `steps` ceiling, `mode: subagent`, and
the permission policy — now lives **here, in this adapter**, and the build
renders it per selected model/effort.

## 2. What the build renders

From this adapter plus the flat model config, the build emits:

- `dist/opencode/agents/agenticale/<role>.md` — seven generated profiles, one
  per role (see the note in §3). Each carries the profile's `mode`,
  `steps`, and `permissions` frontmatter plus the model/effort for that role
  (see §5), and the body is copied verbatim from the matching neutral task
  contract `skills/work/references/tasks/<role>.md`.
- `dist/opencode/skills/` — the `work`, `review`, and `autonomous` skills copied
  with their OpenCode discovery metadata (see §6).
- `dist/opencode/commands/work.md`, `dist/opencode/commands/review.md`, and
  `dist/opencode/commands/autonomous.md` — the three OpenCode command entries
  copied from `adapters/opencode/commands/` (see §7). They are what make
  `/work`, `/review`, and `/autonomous` available in the OpenCode TUI; OpenCode
  does not interpret the skills' `slash` field.

The build renders exactly the **seven** profiles named in `adapter.json` and
**must not** invent any other: there is no `coordinator` OpenCode profile and no
`mode: subagent` for the coordinator. The coordinator is the session that runs
the `work` or `autonomous` skill; only the seven worker/review roles become
profiles. `implement` and `implement-hard` are separate profiles that render the
same implementation task contract with different dispatch context.

This adapter is **metadata only**. It contains no model/effort values (those come
from the flat model config, `adapters/opencode/models.json` by default or the
`--models PATH|PRESET` / `--no-model` option, at build time) and no neutral
task-contract body text (the build copies the body from the neutral task
contracts).

## 3. The 7-role → profile mapping

`keyByRoute` in `adapter.json` maps each of the seven roles to the
OpenCode profile name the build renders:

| Role | Profile name | Notes |
| --- | --- | --- |
| `explore` | `explore` | 1:1 |
| `implement` | `implement` | 1:1 |
| `implement-hard` | `implement-hard` | separate profile, same task contract |
| `fix` | `fix` | 1:1 |
| `review` | `review` | 1:1 |
| `deep-review` | `deep-review` | 1:1 |
| `consult` | `consult` | 1:1 |

**`implement` and `implement-hard` are separate profiles** that render the same
implementation task contract (`tasks/implement.md`) with different dispatch
context. The profile body does not change — the difference is dispatch context,
not instructions — so `implement-hard` renders as its own
`agenticale/implement-hard` profile rather than reusing
`agenticale/implement`. Every role maps 1:1 to its own profile, yielding
**seven** distinct profiles.

## 4. Per-profile steps and permission policy

These values live **only** here in this adapter. The neutral task contract must
never gain `steps`, `mode`, or `permissions` — they are OpenCode host metadata
and belong exclusively in this adapter.

| Profile | Steps | Permissions (all `resource: *`, `effect: deny`) |
| --- | --- | --- |
| `explore` | 24 | `subagent`, `edit`, `question` |
| `implement` | 64 | `subagent`, `question` |
| `fix` | 48 | `subagent`, `question` |
| `review` | 56 | `subagent`, `question` |
| `deep-review` | 72 | `subagent`, `question` |
| `consult` | 20 | `subagent`, `edit`, `question` |

Read-only reconnaissance and opinion roles (`explore`, `consult`) also deny
`edit`; the rest only deny `subagent` and `question`.

## 5. How model/effort are applied at render time

The adapter carries **no** model/effort; the build reads them from the flat
model config (`adapters/opencode/models.json` by default, or the
`--models PATH|PRESET` / `--no-model` option) for the role being rendered:

- **Listed role**: the build writes a `model:` line (and the reasoning effort)
  into the rendered profile's frontmatter. The model is provider-qualified in
  `provider/model[#variant]` form.
- **Unlisted role** (or `--no-model`): the build **omits** the `model:` line so
  the profile inherits the session model.

Because OpenCode has no per-call override, a role's model is bounded by the
generated profiles: to change a role's model you reinstall with a different
`--models` config rather than changing model configuration mid-task. This
matches `skills/work/references/runtimes/opencode.md`.

## 6. Skill discovery

`skillDiscovery` in `adapter.json` records where the three skills land and
their OpenCode discovery metadata so the build can copy the skills and apply
the metadata:

- `outputSkillsRoot`: `skills` — i.e. the skills land under
  `dist/opencode/skills/`.
- Three skills, `work`, `review`, and `autonomous`, each copied from its
  `skills/<name>` source with frontmatter:
  - `slash: true` — a portability field for the runtimes that expose skills as
    direct slash invocations (Copilot, Codex). OpenCode V2 accepts the field but
    does **not** interpret it; on OpenCode the `/work`, `/review`, and
    `/autonomous` surface comes from the command entries in §7.
  - `opencode/autoinvoke: false` — no automatic/implicit invocation by the model.
  - `copilot/disable-model-invocation: true` — carried alongside for coexistence
    with the other runtimes.

Together this means the skills are **explicit, user-only** invocations: available
for direct user invocation but never started by the model on its own.

## 7. Command entries

`commands` in `adapter.json` declares the three OpenCode command templates the
build copies from `adapters/opencode/commands/` into `dist/opencode/commands/`:

| Command | Source | Output |
| --- | --- | --- |
| `work` | `commands/work.md` | `commands/work.md` |
| `review` | `commands/review.md` | `commands/review.md` |
| `autonomous` | `commands/autonomous.md` | `commands/autonomous.md` |

Each template is a thin launcher: frontmatter with a one-line description, and a
body that explicitly loads the matching skill by its exact ID with the skill
tool and passes through `$ARGUMENTS`. The workflow rules live in the skills,
not here. These command files are the only way OpenCode V2 exposes `/work`,
`/review`, and `/autonomous` in its TUI, because OpenCode does not interpret
the skills' `slash` portability field. They are adapter-owned generated output, not the
retired repo-root `commands/` layout.

## 8. Documentation-only pass

This adapter is **documentation and adapter data** in the current
documentation-only pass. It is the authoritative spec the build and later tests
will follow, but live OpenCode rendering and behavior are **not** tested here.
