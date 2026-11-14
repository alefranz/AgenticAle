# Model configuration

## The nine worker roles

AgenticAle gives each worker role its own model — and, where the host
supports it, its own reasoning variant. Seven base roles always exist; two
optional routes exist only where you configure them:

| Role | Used for |
| --- | --- |
| `explore` | Focused codebase and external-source discovery |
| `implement` | Routine implementation (the default) |
| `implement-easy` | Optional: explicitly prescribed, bounded, mechanically verifiable work (a docs correction with a deterministic check, a reference-checked rename) |
| `implement-hard` | Reasoning-heavy implementation and fixes: visible concurrency, shared-state, security, compatibility, or interacting-contract risk |
| `fix` | Focused fixes for review findings |
| `review` | Independent review of changes |
| `review-deep` | Integration-level audits |
| `consult` | Task-framing consultation and second opinions on one bounded focused decision |
| `consult-hard` | Optional: a focused decision with conflicting evidence, interacting constraints, or a costly reversal |

The workflows select routes by one shared routing policy: `implement` is the
default; `implement-hard` is dispatched directly when a slice's correctness
risk is visible (risk is assessed per slice — no category of work is exempt,
and none qualifies by label alone); a hard fix keeps the fix contract and the
fix counters. `implement-easy` and `consult-hard` are opt-in: when they are
not configured, the work runs on the base route (`implement` or `consult`)
with its existing assignment. A `consult-hard` round consumes the same
consultation allowance as an ordinary consult. Review and deep review gates,
budgets, and triggers are unchanged. The authoritative rules live in the
[shared round contract](https://github.com/alefranz/AgenticAle/blob/main/skills/work/references/rounds.md).

How a role gets its model depends on the host:

- **OpenCode** — the models are fixed at install time and baked into the
  generated `agenticale/<role>` agent profiles. Dispatching the role *is* the
  routing; the workflow never resolves a model at activation.
- **Other hosts (Copilot, Codex, Antigravity)** — the workflows dispatch the
  role, and the role's model can come from one optional preference file you
  can edit at any time.

## OpenCode: models are set at install time

The installer bakes the model configuration into the generated agent
profiles under `agents/agenticale/` in your OpenCode configuration directory:
the seven base worker profiles always render, `implement-easy` and
`consult-hard` render only when your config lists them, and an optional
`coordinator` profile renders only when your config assigns the top-level
`coordinator` key. The model flags are:

```sh
# A flat per-role model config: a JSON file or a bundled preset
node scripts/install.mjs --models examples/local.json
node scripts/install.mjs --models openai

# Every role inherits the session model
node scripts/install.mjs --no-model
```

The `--models` value is a JSON object mapping role names to
`"provider/model[#variant]"` strings; a role you omit inherits the session
model. The bundled presets are `example`, `local`, `openai`, `gpt`, and `zen`
(the example files live in `examples/`). The packaged default is
`adapters/opencode/models.json`. The `example` preset is a mixed-provider
inventory — it assumes every named provider, model, and variant is configured
on your account; it is an example, not a verified account mapping.

### The optional coordinator

The top-level `coordinator` key is a session assignment, not a worker route.
When it is present, the build generates one visible primary
`agenticale/coordinator` profile and binds the `/work`, `/review`, and
`/autonomous` command entries to it (`agent: agenticale/coordinator`,
`subagent: false`): the command then runs in the current session on the
coordinator's configured model from the first turn — including a fresh
`/autonomous` resume. Without a configured coordinator (or under
`--no-model`) the commands stay caller-session launchers: the session you
invoke them in coordinates on its own model. The installer never changes
`default_agent` or `opencode.jsonc`, and the coordinator is OpenCode-only —
the other hosts keep the invoking session as the coordinator.

To change the models on an existing install, rerun the installer with a
different `--models PATH|PRESET` (or `--no-model`) configuration, adding
`--replace` when the generated profiles differ. OpenCode picks up the
refreshed profiles without an app restart: a running server reloads them
automatically after a save, and `/reload` forces a full reload; the next
fresh workflow invocation dispatches with the refreshed profiles. After the
install — and after any reinstall with a
different model configuration — the installer prints a ready-to-paste
verification prompt: an OpenCode session reads the generated profiles and
reports each role's model and reasoning variant (a profile with no model line
inherits the session model).

The installer's setup step (`node scripts/install.mjs setup`) can also create
a minimal personal `~/.agenticale/preferences.md` scaffold. On an OpenCode
installation the role lines in that file do **not** apply — the models are
fixed in the generated profiles — but its `## Work` section does.

### Optional routes: omitted versus missing

The workflow establishes whether an optional route is configured by reading
the installer's ownership manifest, `.autonomous-mode-install.json`, in the
same configuration directory — read-only, at most once per activation,
whenever a needed optional assignment must be decided. The manifest records
the latest successful install's profile inventory, so the available profiles
alone cannot decide the case: an install that omitted `implement-easy`, one
that configured it but whose profile was later deleted, and one that omitted
it while leaving a preserved modified file behind can all look identical on
disk.

- An optional route whose entry is listed was configured in the latest
  successful install: a deleted or unreadable profile then blocks only that
  role's dispatch, reported with the installer rerun — never silently
  replaced by the base route. Deleting a profile file does not rewrite the
  manifest, so the entry stays.
- A valid manifest without the entry means the route was omitted at the
  latest successful install, and the defined base-route fallback applies —
  even when a modified profile file was preserved (`preserve-modified`) and
  still sits in the profiles directory. That leftover is unowned: the
  workflow never dispatches it, and deleting it changes nothing about the
  omission. A reinstall that still lists the route keeps the entry; with
  `--replace` it backs your modification up and regenerates the profile.
  Older install states never carried the optional routes, so their absence
  there means omitted too.
- If the manifest is absent (for example a manually copied install),
  unreadable, or ambiguous — another configuration scope also defines
  `agenticale/*` profiles — configured intent is not established: the
  workflow reports an actionable limitation instead of silently falling
  back or dispatching a present optional profile, and unrelated base roles
  continue. Rerunning the installer into the effective configuration
  directory restores the profiles and the manifest evidence.

The manifest never selects models; it only establishes which routes the
install configured.

## Other hosts: the preference file

On Copilot, Codex, and Antigravity (plugin or standalone installs), the
installed workflow skills carry a "Model configuration (this installation)"
section. It documents one optional Markdown preference file:

- `<project-root>/.agenticale/preferences.md` for one repository, or
  `~/.agenticale/preferences.md` for all repositories; a project file wins
  when both are present. A missing file is normal — it means no
  customization.

The format is a list of direct role assignments, one per line. Each line is
either one combined `provider/model[#variant]` value, or the earlier
comma-effort form — both are accepted, and existing files keep working:

```markdown
- review: openai/gpt-6.1-sol#xhigh
- review-deep: openai/gpt-6.1-sol, xhigh
```

- `<role>` is one of the nine worker keys above; a role that is not listed
  uses the host default (the session model). There is no coordinator key:
  the host owns the session model, and the preference file never changes it.
  Where a Sol-class model is available on your account, a medium variant
  (for example `openai/gpt-6.1-sol#medium`) is a reasonable session default
  to select in the host itself.
- The `#variant` suffix is optional where the host supports it; on hosts
  with separate model and effort fields, the variant is passed as the effort
  selection. The legacy forms `- <role>: <model>` (no effort) and
  `- <role>: <model>, <effort>` mean the same assignment; use one form or
  the other on a line.
- `implement-easy` and `consult-hard` are optional: unlisted, the work runs
  on the base route with its existing assignment (a defined fallback, not an
  error). Listed but unhonorable, the workflow surfaces the limitation — it
  never silently substitutes a weaker route.
- Nothing else is interpreted: no tiers, no runtime sections, and no merging
  of files.

A leading `--profile NAME` on `/work`, `/review`, or `/autonomous` selects the
file `preferences.NAME.md` at the same locations (project first, then
personal) instead of `preferences.md`. A missing selected file is a concise,
actionable error listing the files that exist at the checked locations —
never a silent fallback. The selected file is read once at activation and
stays fixed for that activation; start a new workflow activation to load a
change.

The effective selection is established only from native host evidence
(runtime metadata or local traces), never from a child's self-reported model
name; an unknown effective setting stays unknown.

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

The `deep-review` role was renamed to `review-deep`. This is a breaking
rename with no alias: model configs and preference lines using `deep-review`
are rejected with an error naming the new key (the flat-config loader points
at `review-deep`), and the generated OpenCode profile is now
`agenticale/review-deep`. The user-facing wording is unchanged — you still
ask for a "deep review" and invoke `/review --deep`. Update any saved
`--models` JSON or preference file to the new key; reinstall OpenCode
profiles so the retired `agenticale/deep-review` profile is retired by the
installer's normal migration.
