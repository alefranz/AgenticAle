# Setup and customization

Start with the [README quick start](../README.md). This guide covers the three
install paths, model routing, and client limitations. Live runtime behavior is
tracked separately in [runtime-compatibility.md](runtime-compatibility.md);
nothing in this file is a live test result.

The package exposes two public workflows, both explicit-only skills:

- `/work [task]` (optionally `/work --pr <task>`) for a reviewed everyday task;
- `/autonomous [budget] [goal]` for a durable, multi-round project.

The other two skills, `source-code-lookup` and `pull-request-description`, are
supporting and are loaded by the workflows when their tasks arise. There is no
coordinator to select and no `commands/` entry: the session you invoke the
skill in is the coordinator.

## Install: choose your client

### GitHub Copilot (CLI and VS Code)

Builds a temporary Agent Plugins 1.0 package and installs it with
`copilot plugin install`. GitHub Copilot in VS Code discovers the same install.
It makes no model request.

```sh
node scripts/install-copilot.mjs
```

To inherit the active Copilot model and effort instead of applying per-route
defaults, or to override routing, pass the routing options below. Remove the
plugin with:

```sh
copilot plugin uninstall agenticale
```

### Standalone skills (Codex VS Code and other clients)

Installs the four skill folders directly under a `.agents/skills` directory.
It requires no native agent or plugin, which is the path for the official Codex
VS Code extension (skills/subagents supported, plugins unsupported).

A routing choice is required (`--no-model` for inheritance, `--models
PATH|PRESET`, or `--routing PATH`); the examples below show each. The default
destination is project scope, `<cwd>/.agents/skills`. Because of the overlap
guard, running it from a checkout of this repository installs into the
repository itself and is rejected, so from a checkout use user scope:

```sh
node scripts/install-standalone.mjs --no-model --scope user
```

From another project, invoke the checkout's script by absolute path so the
skills land in that project's own `<project>/.agents/skills`:

```sh
node /path/to/AgenticAle/scripts/install-standalone.mjs --no-model
```

`--scope user` installs to `~/.agents/skills` (Codex's user-level skill
discovery location; on Windows `%USERPROFILE%\.agents\skills`). `--target PATH`
overrides the destination entirely. The state file is
`.agenticale-standalone-install.json` (schema 1). Like the OpenCode
installer, it prints a non-blocking `notice: another AgenticAle install
appears present (<path>)` if the target already carries the other layout's
marker.

### OpenCode V2 (generated profiles)

Installs the *generated* OpenCode binding: the four skills plus seven generated
agent profiles under `agents/autonomous/`. It copies into the OpenCode
configuration directory and does not link to the repository source. The default
target is `$XDG_CONFIG_HOME/opencode` when set, otherwise `~/.config/opencode`.

```sh
node scripts/install.mjs --no-model
```

The install command requires either `--models PATH|PRESET` or `--no-model`.
This installer is copy-only: it no longer offers a link mode. On install it
migrates older copy installs (state schema 1-4), older link installs
(schema 1-4), and older six-profile generated installs (schema 5) to the
current generated copy layout (state `.autonomous-mode-install.json`,
schema 6, a 26-file inventory).

If the target already carries another AgenticAle marker (for example a
standalone `.agenticale-standalone-install.json`), the installer surfaces a
non-blocking `notice: another AgenticAle install appears present (<path>)`
line instead of failing. Review it and remove the duplicate layout if the
two installs were meant to be a single one.

## Model routing

Routing is an explicit per-route policy in
[`skills/work/references/routing.json`](../skills/work/references/routing.json)
(schemaVersion 1). For each of three runtimes (`copilot`, `codex`, `opencode`)
and each of seven routing keys (`explore`, `implement`, `implement-hard`, `fix`,
`review`, `deep-review`, `consult`), the policy names an explicit model and
effort or explicit inheritance. There are no fallbacks. The packaged baseline is
the `gpt-6` family, provider-qualified per host: `OpenAI/` for Copilot,
`openai/` for Codex, `opencode/` for OpenCode. That baseline is an inventory,
not a verified account mapping: check each host's `/models` or `/model` before
relying on a strict route, or override any route (or use `--no-model` /
`--routing PATH`).

`implement` and `implement-hard` share the same implementation contract but
route to different models and effort. OpenCode materializes the resolved routes
as **seven** generated profiles (`explore`, `implement`, `implement-hard`,
`fix`, `review`, `deep-review`, `consult`); `implement-hard` is a distinct
profile rendering the `implement` contract at a higher reasoning effort.

### Routing options

All three installers accept the same routing options, passed through to the
build:

| Option | Effect |
| --- | --- |
| `--models PATH\|PRESET` | Legacy import. Reads an `examples` mapping (`gpt`, `openai`, `zen`, `local`, `example`) or a JSON file and converts it to the routing contract. Omitted roles become explicit inheritance and are reported. |
| `--routing PATH` | Build from a complete caller-supplied routing file instead of the packaged `routing.json`. Conflicts with `--models`. |
| `--no-model` | Omit model and effort for every route; each route inherits the session model. Conflicts with `--models`. |
| `--effort LEVEL` | Route-wide reasoning-effort override (`low`/`medium`/`high`/`xhigh`/`max`); overrides the effort of every route. |

`--coordinator-effort` is retired: the session now owns its own effort, so the
option is ignored and a notice is reported.

Examples:

```sh
# Copilot, packaged routing
node scripts/install-copilot.mjs

# Copilot, inherit the session model everywhere
node scripts/install-copilot.mjs --no-model

# Copilot, a complete caller policy
node scripts/install-copilot.mjs --routing /path/to/routing.json --effort high

# Standalone (Codex VS Code / other clients), project scope
node scripts/install-standalone.mjs --scope project --models zen

# OpenCode, isolated target and session inheritance
node scripts/install.mjs --target /path/to/opencode --no-model
```

`--source-root PATH` on any installer writes a different default source-lookup
root into the installed skill; `SOURCE_ROOT` still takes precedence at lookup
time.

## Choosing models: cheap by default, strong when it matters

The intended routing keeps high-volume work (explore, routine implement, fix)
on a fast, cheap, or local model and reserves a stronger model for
`implement-hard`, `review`, `deep-review`, and `consult`. This split is the main
reason to configure a mapping.

| Route | What it does | Good default |
| --- | --- | --- |
| `explore` | Understands the project and gathers evidence | Fast, cheap, or local |
| `implement` | Makes routine changes | Fast, cheap, or local |
| `fix` | Applies specific review findings | Fast, cheap, or local |
| `implement-hard` | Handles difficult or security-sensitive work | Stronger model when needed |
| `review` | Checks a worker's changes independently | Stronger model when available |
| `deep-review` | Audits interactions across the whole slice | Best model, used sparingly |
| `consult` | Gives a second opinion on one stuck decision | Best model, used sparingly |

Use a `--models` preset as shorthand for one of the checked-in example mappings
(`openai`, `zen` from `examples/gpt.json`, `local`, `example`); a preset does
not probe your provider account or `/models` catalog. To build your own, write a
routing file and pass it with `--routing`, or start from a legacy
`provider/model[#variant]` JSON and pass it with `--models`. Run `/models` first
and confirm the IDs exist. The `local` preset is intentionally a starting point
because local provider names and model IDs vary between machines.

The legacy `--models` JSON names roles and omits ones to inherit:

```json
{
  "explore": "cheap-provider/fast-model",
  "implement": "cheap-provider/fast-model",
  "fix": "cheap-provider/fast-model",
  "review": "strong-provider/review-model",
  "deep-review": "strong-provider/best-model",
  "consult": "strong-provider/best-model"
}
```

Values use the `provider/model[#variant]` form; an optional `#variant`
(`low`/`medium`/`high`/`xhigh`/`max`) sets the effort for that route. Roles left
out inherit the session model and the install reports the conversion.

## OpenCode permissions

The OpenCode installer leaves `opencode.jsonc` unchanged. The foreground agent
needs permission to load the `work` and `autonomous` skills and to launch the
generated `autonomous/*` profiles; those profile IDs are shared by both
workflows. Child sessions cannot ask the user questions or launch nested
agents. Configure the actions your task needs so they resolve without
interactive child prompts, scoped to the project and your environment. See the
[OpenCode V2 permissions guide](https://opencode.ai/v2/docs/permissions) for
syntax. A denied child action should return a blocker to the coordinator; do not
bypass a denial or assume a paused child can resume. For unattended setup, see
[Autonomous Mode](autonomous.md#permissions-for-unattended-runs).

## Useful build and publish commands

Generate inspectable plugin, standalone, and OpenCode output without installing:

```sh
node scripts/build.mjs
```

The three output roots are written beneath `--output` (default `dist`), which
Git ignores: `plugin/agenticale` (the Agent Plugins 1.0 package),
`standalone/.agents/skills` (the four standalone skills), and `opencode`
(seven generated profiles plus the same skills). The build writes
`.agenticale-build.json` (schemaVersion 2) describing what it produced. Build
output must not target the repository root or a source directory.

Regenerate the committed plugin and both catalogs after changing the canonical
skills, routing, or plugin metadata:

```sh
node scripts/publish-default-plugin.mjs
```

This regenerates `plugins/agenticale/` plus both catalogs,
`.github/plugin/marketplace.json` (Copilot) and
`.agents/plugins/marketplace.json` (OpenAI). CI runs the same command with
`--check` and rejects stale artifacts.

## Source lookup configuration

Set `SOURCE_ROOT` to your local source directory to customize lookup without
rebuilding or reinstalling. This works with directly installed Copilot plugins
as well as standalone and OpenCode copy installs. For example, in PowerShell:

```powershell
$env:SOURCE_ROOT = 'V:\dev'
[Environment]::SetEnvironmentVariable('SOURCE_ROOT', 'V:\dev', 'User')
```

The first line sets the current shell's value; the second persists it for future
processes. Restart an already-running editor or CLI to inherit the new value.
On POSIX shells, use `export SOURCE_ROOT=/path/to/repos` and add it to your
shell startup configuration if desired. Use an existing absolute directory.

Lookup uses an explicit task override first, then a non-empty `SOURCE_ROOT`,
then the installed default (`~/dev` unless customized). An invalid or
unavailable configured root is reported rather than silently replaced with the
default. Alternatively, embed a different default in an install with
`--source-root /path/to/repos`; the installer writes that default into the
installed skill and `SOURCE_ROOT` still takes precedence at lookup time.
Reinstalling with a different path requires `--replace`, which backs up the
previous copy.

Lookup checks likely paths under the root and verifies repository identity.
Missing repositories are cloned into `<source-root>/<owner>/<repo>` for future
reuse, with the host added when needed to avoid a collision. Explicit layout
instructions take precedence. Inspecting another revision preserves existing
working files and branches: use Git object reads or a temporary detached
worktree, removed through Git after inspection. Canonical clones remain
available for later development; no separate persistent inspection clone cache
is used.

## Preview, update, and uninstall

Preview an OpenCode or standalone install without touching the filesystem:

```sh
node scripts/install.mjs --dry-run --no-model
node scripts/install-standalone.mjs --dry-run --no-model
```

Update an existing OpenCode install after fetching a newer version (explicit
session-model inheritance shown here):

```sh
node scripts/install.mjs --replace --no-model
```

Uninstall removes only the files owned by the package and deletes its state
file:

```sh
node scripts/install.mjs uninstall
node scripts/install-standalone.mjs uninstall
copilot plugin uninstall agenticale
```

The installers record their ownership, refuse to overwrite differing files by
default, and create a backup before an explicitly approved replacement.
Modified files are preserved during uninstall.

## Troubleshooting

- **`/work` or `/autonomous` is not found:** restart the client after running
  the installer. For OpenCode, restart OpenCode; for Copilot, restart the
  Copilot session.
- **A worker stops for approval or does not resume (OpenCode):** review the
  permission setup above. Child sessions need deterministic `allow`/`deny`
  rules for the actions they use; continue `/work` from its retained session, or
  rerun `/autonomous` to resume its durable handoff. Only the autonomous skill
  provides fresh-session recovery.
- **A model cannot be found:** run `/models`, update the routing file or legacy
  JSON, and reinstall with `--replace`.
- **You are unsure about model routing:** use `--no-model` for a quick trial,
  then reinstall with `--models /path/to/my-models.json` or
  `--routing /path/to/routing.json` when you are ready to specialize routes.
- **You want to understand the implementation:** read the optional
  [technical architecture guide](architecture.md).

## Limitations

- Live runtime support per client is recorded in
  [runtime-compatibility.md](runtime-compatibility.md) and is **not tested** in
  this pass. Do not treat the inspected client versions as verified.
- OpenCode enforces the generated per-profile step and permission rules. Copilot
  has no equivalent per-route hard step ceiling, and some child-session
  restrictions are prompt conventions when a client does not support the
  corresponding custom-agent field.
- Skills can request a model and effort but cannot prevent host-side fallback.
  A host that silently substitutes a model without detection or control does not
  get a strict-routing claim; that limitation is recorded per host, not here.
- A fresh child context provides independence, but it does not automatically
  mean a different model family; use `--models` or `--routing` for explicit
  model separation.
- Prompt instructions complement OpenCode permissions; they cannot make an
  inherently irreversible operation safe.
- Unattended operation still needs bounded budgets and final human inspection.
