# Model configuration

## The seven roles

AgenticAle gives each of the seven worker roles its own model — and, where the
host supports it, its own reasoning effort:

| Role | Used for |
| --- | --- |
| `explore` | Focused codebase and external-source discovery |
| `implement` | Routine implementation |
| `implement-hard` | Reasoning-heavy implementation and fixes |
| `fix` | Focused fixes for review findings |
| `review` | Independent review of changes |
| `deep-review` | Integration-level audits |
| `consult` | Task-framing consultation and second opinions |

How a role gets its model depends on the host:

- **OpenCode** — the models are fixed at install time and baked into the
  generated `agenticale/<role>` agent profiles. Dispatching the role *is* the
  routing; the workflow never resolves a model at activation.
- **Other hosts (Copilot, Codex, Antigravity)** — the workflows dispatch the
  role, and the role's model can come from one optional preference file you
  can edit at any time.

## OpenCode: models are set at install time

The installer bakes the model configuration into the seven generated agent
profiles under `agents/agenticale/` in your OpenCode configuration directory.
The model flags are:

```sh
# A flat per-role model config: a JSON file or a bundled preset
node scripts/install.mjs --models examples/local.json
node scripts/install.mjs --models openai

# Every role inherits the session model
node scripts/install.mjs --no-model
```

The `--models` value is a JSON object mapping role names to
`"provider/model[#effort]"` strings; a role you omit inherits the session
model. The bundled presets are `example`, `local`, `openai`, `gpt`, and `zen`
(the example files live in `examples/`). The packaged default is
`adapters/opencode/models.json`.

To change the models on an existing install, rerun the installer with a
different `--models PATH|PRESET` (or `--no-model`) configuration, adding
`--replace` when the generated profiles differ, then restart OpenCode or start
a new session. After the install — and after any reinstall with a different
model configuration — the installer prints a ready-to-paste verification
prompt: an OpenCode session reads the generated profiles and reports each
role's model and reasoning effort (a profile with no model line inherits the
session model).

The installer's setup step (`node scripts/install.mjs setup`) can also create
a minimal personal `~/.agenticale/preferences.md` scaffold. On an OpenCode
installation the role lines in that file do **not** apply — the models are
fixed in the generated profiles — but its `## Work` section does.

## Other hosts: the preference file

On Copilot, Codex, and Antigravity (plugin or standalone installs), the
installed workflow skills carry a "Model configuration (this installation)"
section. It documents one optional Markdown preference file:

- `<project-root>/.agenticale/preferences.md` for one repository, or
  `~/.agenticale/preferences.md` for all repositories; a project file wins
  when both are present. A missing file is normal — it means no
  customization.

The format is a list of direct role assignments, one per line:

```markdown
- review: openai/gpt-6.1-sol, xhigh
- deep-review: openai/gpt-6.1-sol, xhigh
```

- `<role>` is one of the seven roles above; a role that is not listed uses
  the host default.
- The effort is optional where the host supports it.
- Nothing else is interpreted: no tiers, no fallbacks, no runtime sections,
  and no merging of files.

A leading `--profile NAME` on `/work`, `/review`, or `/autonomous` selects the
file `preferences.NAME.md` at the same locations (project first, then
personal) instead of `preferences.md`. A missing selected file is a concise,
actionable error listing the files that exist at the checked locations —
never a silent fallback. The selected file is read once at activation and
stays fixed for that activation; start a new workflow activation to load a
change.

## Work worker-round allowance

The same preference file may carry a top-level `## Work` section that sets
the Work workflow's worker-round **allowance**:

```markdown
## Work
- worker rounds: 12
```

The value is how many worker rounds are available to a Work task, not how
many must run. The default is eight. The project file wins over the personal
file. An invalid value (not a positive integer) is an actionable error naming
the file and the value — it is never silently defaulted and never clamped.
The setting is Work-specific: Autonomous Mode keeps its own budget behavior.

## What changed from the old tier system

The earlier tier-based routing — a packaged `routing.json` baseline, four
capability tiers, named profiles inside preference files, and the legacy
`routing.md` filename — is gone, with no compatibility support: files written
in the old format are simply not read. Per-role model selection is now
configured either at install time (OpenCode) or in the one preference file
above.
