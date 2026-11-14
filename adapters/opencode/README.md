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
child tool naming the configured profile for that role, and the model
(including its reasoning variant) is materialized **inside the profile at
install time**. So the OpenCode binding must materialize the flat model config
as generated agent profiles. That profile generation is the **only currently
planned mandatory shim** — every other runtime binding stays agent-file-free.
See `skills/work/references/runtimes/opencode.md`.

Because the neutral contracts stay clean, the OpenCode-specific host metadata
that the old profiles used to carry — the `steps` ceiling, `mode: subagent`, and
the permission policy — now lives **here, in this adapter**, and the build
renders it per selected model/effort.

## 2. What the build renders

From this adapter plus the flat model config, the build emits:

- `dist/opencode/agents/agenticale/<role>.md` — the generated worker profiles
  (see the note in §3). Each carries the profile's `mode`, `steps`, and
  `permissions` frontmatter plus the model for that role (see §5), and the
  body is copied verbatim from the matching neutral task contract
  `skills/work/references/tasks/<role>.md`.
- `dist/opencode/agents/agenticale/coordinator.md` — the session coordinator
  profile, generated **only when the flat model config carries the top-level
  `coordinator` key** (never under `--no-model`). It is one visible
  `mode: primary` agent with the normal ability to dispatch children (no
  `subagent` denial, no step ceiling) and the adapter-owned workflow-neutral
  body `adapters/opencode/coordinator.md`.
- `dist/opencode/skills/` — the `work`, `review`, and `autonomous` skills copied
  with their OpenCode discovery metadata (see §6).
- `dist/opencode/commands/work.md`, `dist/opencode/commands/review.md`, and
  `dist/opencode/commands/autonomous.md` — the three OpenCode command entries
  copied from `adapters/opencode/commands/` (see §7). They are what make
  `/work`, `/review`, and `/autonomous` available in the OpenCode TUI; OpenCode
  does not interpret the skills' `slash` field.

The build renders exactly the worker profiles named in `adapter.json` and
**must not** invent any other. The seven base worker roles always render, one
profile per role; the two optional worker roles (`implement-easy`,
`consult-hard`) render only when the config lists them explicitly.
`implement`, `implement-easy`, and `implement-hard` are separate profiles that
render the same implementation task contract with different dispatch context;
`consult` and `consult-hard` likewise share the consult contract. The
coordinator is the session that runs the `work`, `review`, or `autonomous`
skill; it becomes a profile only when explicitly configured, and it is never a
`mode: subagent` worker.

This adapter is **metadata only**. It contains no model values (those come
from the flat model config, `adapters/opencode/models.json` by default or the
`--models PATH|PRESET` / `--no-model` option, at build time) and no neutral
task-contract body text (the build copies the body from the neutral task
contracts; the coordinator body is the adapter-owned `coordinator.md`).

## 3. The 9-role → profile mapping

`keyByRoute` in `adapter.json` maps each of the nine worker roles to the
OpenCode profile name the build renders:

| Role | Profile name | Notes |
| --- | --- | --- |
| `explore` | `explore` | 1:1 |
| `implement` | `implement` | 1:1 |
| `implement-easy` | `implement-easy` | optional; separate profile, same task contract as implement |
| `implement-hard` | `implement-hard` | separate profile, same task contract as implement |
| `fix` | `fix` | 1:1 |
| `review` | `review` | 1:1 |
| `review-deep` | `review-deep` | 1:1 (renamed from `deep-review`) |
| `consult` | `consult` | 1:1 |
| `consult-hard` | `consult-hard` | optional; separate profile, same task contract as consult |

**`implement`, `implement-easy`, and `implement-hard` are separate profiles**
that render the same implementation task contract (`tasks/implement.md`) with
different dispatch context; **`consult` and `consult-hard`** likewise share
`tasks/consult.md`. The profile body does not change — the difference is
dispatch context, not instructions — so each renders as its own
`agenticale/<role>` profile rather than reusing another role's profile. Every
role maps 1:1 to its own profile. The seven base roles always render;
`implement-easy` and `consult-hard` carry `optional: true` and render only when
the flat model config lists them. The top-level `coordinator` config key is a
session assignment, not a worker route: it is absent from `keyByRoute` and
renders the separate conditional primary profile described in §2.

## 4. Per-profile steps and permission policy

These values live **only** here in this adapter. The neutral task contract must
never gain `steps`, `mode`, or `permissions` — they are OpenCode host metadata
and belong exclusively in this adapter.

| Profile | Steps | Permissions (all `resource: *`, `effect: deny`) |
| --- | --- | --- |
| `explore` | 24 | `subagent`, `edit`, `question` |
| `implement` | 64 | `subagent`, `question` |
| `implement-easy` | 64 | `subagent`, `question` |
| `implement-hard` | 64 | `subagent`, `question` |
| `fix` | 48 | `subagent`, `question` |
| `review` | 56 | `subagent`, `question` |
| `review-deep` | 72 | `subagent`, `question` |
| `consult` | 20 | `subagent`, `edit`, `question` |
| `consult-hard` | 20 | `subagent`, `edit`, `question` |

Read-only reconnaissance and opinion roles (`explore`, `consult`,
`consult-hard`) also deny `edit`; the rest only deny `subagent` and `question`.
The coordinator carries no step ceiling and an empty permission list: it keeps
the normal ability to dispatch children and to interact with the user.

## 5. How the model is applied at render time

The adapter carries **no** model values; the build reads them from the flat
model config (`adapters/opencode/models.json` by default, or the
`--models PATH|PRESET` / `--no-model` option) for the role being rendered:

- **Listed role**: the build writes one `model:` line into the rendered
  profile's frontmatter, in provider-qualified `provider/model[#variant]`
  form. The reasoning variant rides on the model line; OpenCode V2 has no
  separate `reasoningEffort` field, and the build emits none.
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

When the flat model config assigns the coordinator, the build additionally
writes `agent: agenticale/coordinator` and `subagent: false` into each rendered
command's frontmatter: the command then runs in the current session on the
coordinator's configured model (OpenCode applies the selected command agent's
model, and `subagent: false` forces the current session). The skill load and
`$ARGUMENTS` body stay byte-identical. Without a configured coordinator (or
under `--no-model`) the commands keep only their description frontmatter and
remain caller-session launchers.

## 8. Documentation-only pass

This adapter is **documentation and adapter data** in the current
documentation-only pass. It is the authoritative spec the build and later tests
will follow, but live OpenCode rendering and behavior are **not** tested here.
