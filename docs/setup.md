# Setup and customization

Choose your client below to install AgenticAle. This page is the canonical
installation guide; the [getting started page](getting-started.md) is the short
reader entry point. Live runtime behavior is tracked separately in
[runtime compatibility](runtime-compatibility.md), and is **not tested** until
live evidence is recorded.

The package exposes three public workflows, all explicit-only skills:

- `/work [task]` (optionally `/work --pr <task>`) for a reviewed everyday task;
- `/review [base or criteria]` (optionally `/review --deep` and
  `/review --profile NAME`) for an independent review of the current branch's
  net changes up to the working-tree result;
- `/autonomous [budget] [goal]` for a durable, multi-round project.

The other two skills, `source-code-lookup` and `pull-request-description`, are
supporting and are loaded by the workflows when their tasks arise. There is no
coordinator to select and no `commands/` entry: the session you invoke the
skill in is the coordinator.

## Install: choose your client

### GitHub Copilot (App, CLI, and VS Code)

With Copilot CLI installed and authenticated, install the published plugin from
the AgenticAle marketplace:

```sh
copilot plugin marketplace add alefranz/AgenticAle
copilot plugin install agenticale@agenticale
```

Restart the Copilot session and invoke a workflow directly; there is no agent
picker. For example, from the CLI:

```text
/agenticale:work Fix the date filtering bug
/agenticale:work Address the review feedback on this branch
/agenticale:work Investigate why export is slow and suggest an approach
/agenticale:work --pr Add CSV export
```

VS Code discovers the same plugin. Its autocomplete may display the work skill
as `/agenticale work` even though the CLI uses `/agenticale:work`; select the
suggested autocomplete entry in VS Code.

#### In the GitHub Copilot app

The app installs the same published plugin from the same marketplace. Open
these links in the app; each one asks you to confirm, then opens a pre-filled
form:

1. [Add the marketplace](ghapp://plugins/marketplace/add?source=alefranz%2FAgenticAle) (`alefranz/AgenticAle`)
2. [Install the plugin](ghapp://plugins/install?source=agenticale%40agenticale) (`agenticale@agenticale`)

Or do it by hand: **Customize → + Add → Marketplace** with `alefranz/AgenticAle`,
then **+ Add → Plugin** with `agenticale@agenticale`. Nothing is added or
installed until you confirm each form in the app.

Start a new session and try one that only reads:

```text
/agenticale:review main
```

You get an independent review back: the blocking findings, the nits, and the
checks it ran. Nothing gets changed, committed, or pushed.

#### Alternative: install from a local checkout

Alternatively, clone this repository or use your current checkout, then run the
installer from the repository root:

```sh
node scripts/install-copilot.mjs
```

The installer accepts `--models PATH|PRESET` and `--no-model` and retains
them in the build state, but for the Copilot plugin the workflow roles' models
are set at activation time through the preference file (see the
[model configuration guide](guides/model-routing.md#other-hosts-the-preference-file)).
Remove the plugin with:

```sh
copilot plugin uninstall agenticale
```

### Codex plugin (CLI, VS Code extension, and ChatGPT desktop app)

The published `plugins/agenticale` package contains all five skills, including
`agents/openai.yaml` metadata for the `work`, `review`, and `autonomous`
workflows. The
repository also contains a Codex marketplace at
`.agents/plugins/marketplace.json`. Install it with the Codex CLI:

```sh
codex plugin marketplace add alefranz/AgenticAle
codex plugin add agenticale@agenticale
```

For a local checkout during development, use
`codex plugin marketplace add /absolute/path/to/AgenticAle` instead of the
GitHub source. Then install with
the same `codex plugin add` command. You can also open Plugins in the ChatGPT
desktop app, select the AgenticAle marketplace, and install the plugin there.
Start a new chat or session afterward. In CLI and VS Code, use `/skills` or
mention `$work`, `$review`, or `$autonomous`; in the desktop app, open Skills
or mention the skill in your prompt.

Refresh a Git-backed marketplace with
`codex plugin marketplace upgrade agenticale`. Inspect installs with
`codex plugin list` and remove this plugin
with `codex plugin remove agenticale@agenticale`. See the [official Codex plugin
commands](https://learn.chatgpt.com/docs/developer-commands#codex-plugin).

### Alternative: standalone Codex skills

Installs the five skill folders directly under a `.agents/skills` directory.
Codex CLI, the official VS Code extension, and Codex mode in the ChatGPT
desktop app can discover these standalone skills. The installer requires no
native agent or plugin.

A model selection is required (`--models PATH|PRESET`, or `--no-model` for
session-model inheritance); the examples below show each. The default
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
installer, it prints a non-blocking
`notice: another AgenticAle install appears present (<path>)` if the target
already carries the other layout's
marker.

After installation, start a new chat or session in the chosen client. In Codex
CLI and the VS Code extension, type `$work Fix the date filtering bug`,
`$review main`, or `$autonomous 10 Improve the export workflow`; `/skills` also
lists available
skills. In the ChatGPT desktop app's Codex mode, open Skills in the sidebar or
mention the skill in your prompt. Use one install scope for the same machine
unless you intentionally want separate copies: Codex may show both skills if
their names occur in user and project scopes. The plugin install can also
duplicate a standalone install. See the [official OpenAI skill
documentation](https://learn.chatgpt.com/docs/build-skills) for discovery and
invocation details.

### OpenCode V2 (generated profiles)

Installs the *generated* OpenCode binding: the five skills, seven generated
agent profiles under `agents/agenticale/`, and the three command entries
`commands/work.md`, `commands/review.md`, and `commands/autonomous.md` that
expose `/work`, `/review`, and `/autonomous` in the OpenCode TUI. It copies
into the OpenCode configuration
directory and does not link to the repository source. The default target is
`$XDG_CONFIG_HOME/opencode` when set, otherwise `~/.config/opencode`.

Quick start without a checkout, POSIX (Linux, macOS, WSL):

```sh
curl -fsSL https://raw.githubusercontent.com/alefranz/AgenticAle/main/scripts/install.sh | sh
```

Windows PowerShell:

```powershell
powershell -NoProfile -Command "Invoke-WebRequest -Uri https://raw.githubusercontent.com/alefranz/AgenticAle/main/scripts/install.ps1 -OutFile install.ps1"
powershell -ExecutionPolicy Bypass -File install.ps1
```

The one-liner `powershell -NoProfile -Command "irm https://raw.githubusercontent.com/alefranz/AgenticAle/main/scripts/install.ps1 | iex"` is equivalent: it runs the same script without saving it.

To install a specific release, pass the release tag to the wrapper with
`--version TAG`: pinning the tag in the wrapper URL alone does **not** pin
the installed release — both wrappers still resolve the latest release unless
told otherwise. POSIX (the options go after `sh -s --`, which hands them to
the wrapper's own parser):

```sh
curl -fsSL https://raw.githubusercontent.com/alefranz/AgenticAle/v0.17.0/scripts/install.sh | sh -s -- --version v0.17.0
```

Windows PowerShell:

```powershell
powershell -NoProfile -Command "Invoke-WebRequest -Uri https://raw.githubusercontent.com/alefranz/AgenticAle/v0.17.0/scripts/install.ps1 -OutFile install.ps1"
powershell -ExecutionPolicy Bypass -File install.ps1 --version v0.17.0
```

Using the same release tag in the wrapper URL as in `--version` also pins the
wrapper itself to that release. In either case the wrapper prints the release
tag, downloads that release's source archive, and runs the installer from the
extracted archive; it never launches an AI session and cleans up its temporary
directory. Prerequisites: Node.js 20 or later plus `curl` and `tar` (Windows
10 or later provides `curl.exe` and `tar`). With no model selection it
installs session-model inheritance (the wrapper appends `--no-model`).

| Option | Effect |
| --- | --- |
| *(none)* | Every role inherits the session model (`--no-model` is appended). |
| `--version TAG` | Install that release tag instead of resolving the latest. |
| `--models PATH\|PRESET` | Flat per-role model config: a JSON file mapping roles to `"provider/model[#effort]"`, or a bundled preset (`example`, `local`, `openai`, `gpt`, `zen`); a missing role inherits the session model. |
| `--no-model` | Every role inherits the session model. |
| `--source-root PATH` | Embed a different default source-lookup root into the installed skill. |
| `--replace` | Back up and replace differing destinations during install/update. |
| `--dry-run` | Print the planned operation without changing the filesystem. |
| `--setup` | Also create the personal AgenticAle preferences file (`~/.agenticale/preferences.md`) after a successful install. |

For the model flags and the preference file, see
[model configuration](guides/model-routing.md).

After a successful install the wrapper offers a consented setup step: with
`--setup` it runs unconditionally; on a terminal without `--setup` it asks
"Create a personal AgenticAle preferences file (~/.agenticale/preferences.md)?
[y/N]" (default no); non-interactive runs skip it and print a one-line tip.
The step creates the personal `~/.agenticale/preferences.md` only when it is
absent — a minimal scaffold with no active entries, so the models configured
at install time apply — and it never overwrites, migrates, or removes a
preference file or creates the project-scope file. On an OpenCode
installation the scaffold states that role lines in the file do not apply
(the models are fixed in the generated agent profiles; rerun the installer
with a different `--models` configuration to change them) while the top-level
`## Work` section does apply (worker-round allowance; a project file
`<repo>/.agenticale/preferences.md` takes precedence over the personal file).
It then prints the file's path, that guidance, and a ready-to-paste prompt
for an OpenCode session to walk through the `## Work` changes.

After the install — or after any reinstall with a different model
configuration — you can verify your model configuration. The installer prints
a ready-to-paste prompt for an OpenCode session; it reads the generated agent
profiles and reports each role's model and reasoning effort (a profile with no
model line inherits the session model), and notes that role lines in a
preference file do not apply to this installation while the preference
file's `## Work` section does. See the
[model configuration guide](guides/model-routing.md) for details.

#### Alternative: install from a local checkout

From a clone or your current checkout (offline or local use), run the
installer from the repository root:

```sh
node scripts/install.mjs --no-model
```

The install command requires either `--models PATH|PRESET` or `--no-model`.
This installer is copy-only: it no longer offers a link mode. On install it
migrates older copy installs (state schema 1-4), older link installs
(schema 1-4), and older six-profile generated installs (schema 5) to the
current generated copy layout (state `.autonomous-mode-install.json`,
schema 6, a 32-file inventory).

If the target already carries another AgenticAle marker (for example a
standalone `.agenticale-standalone-install.json`), the installer surfaces a
non-blocking `notice: another AgenticAle install appears present (<path>)`
line instead of failing. Review it and remove the duplicate layout if the
two installs were meant to be a single one.

### Google Antigravity (App and CLI)

Antigravity uses the `agy` command-line tool and installs plugins from a local
repository clone. Clone or pull this repository, then install it directly with
`agy`:

```sh
agy plugin install .
```

From another directory, pass the path to the repository root:

```sh
agy plugin install /path/to/AgenticAle
```

The command discovers the plugin definition in the repository and installs the
package into the user plugin root (`~/.gemini/config/plugins/agenticale`, or
`%USERPROFILE%\.gemini\config\plugins\agenticale` on Windows), where both the
Antigravity desktop IDE and the `agy` CLI discover it.

Verify that the plugin is recognized and active:

```sh
agy plugin list
```

Expected output:

```text
Installed plugins:
- agenticale (enabled, <version>)
    Source:     antigravity
    Components: 5 skills
```

To update after pulling new changes in your local clone, rerun the install
command:

```sh
git pull
agy plugin install .
```

To remove the plugin:

```sh
agy plugin uninstall agenticale
```

#### Alternative: install via the interactive session

Inside an interactive Antigravity chat or CLI session, run the `/plugin`
command, select **Discover** > **Install from local directory**, and choose the
repository root or `plugins/agenticale`.

Restart any running CLI or IDE session after installing or updating so the
skills are loaded into active context.

See the [Antigravity installation reference](https://antigravity.google/docs/cli/install/)
and [model configuration guide](guides/model-routing.md).

## Model configuration

The complete model configuration — install-time model flags, the preference
file, and the Work worker-round allowance — lives in
[the model configuration guide](guides/model-routing.md). The following
legacy section anchors remain available for existing links.

### Routing options

See [install-time model options](guides/model-routing.md#opencode-models-are-set-at-install-time)
in the focused guide.

### Customizing model routing

See [the preference file](guides/model-routing.md#other-hosts-the-preference-file)
for the preference file locations and format.

### Choosing models: cheap by default, strong when it matters

See [the seven roles](guides/model-routing.md#the-seven-roles) for the
per-role model intent.

### OpenCode permissions

See the [OpenCode permissions guidance](guides/troubleshooting.md#opencode-permissions) and the
[detailed Autonomous guide](https://github.com/alefranz/AgenticAle/blob/main/docs/autonomous.md#permissions-for-unattended-runs).

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

Missing repositories are cloned into the source root for future reuse, and
inspecting another revision does not disturb existing working files or
branches.

## Preview, update, and uninstall

Preview an OpenCode or standalone install without touching the filesystem:

```sh
node scripts/install.mjs --dry-run --no-model
node scripts/install-standalone.mjs --dry-run --no-model
```

Update an existing install after fetching a newer version:

```sh
# OpenCode (explicit session-model inheritance shown here)
node scripts/install.mjs --replace --no-model

# Antigravity (re-run install from the updated local checkout)
git pull
agy plugin install .
```

Uninstall removes only the files owned by the package and deletes its state
file:

```sh
node scripts/install.mjs uninstall
node scripts/install-standalone.mjs uninstall
copilot plugin uninstall agenticale
agy plugin uninstall agenticale
```

The installers record their ownership, refuse to overwrite differing files by
default, and create a backup before an explicitly approved replacement.
Modified files are preserved during uninstall.

## Troubleshooting

See the focused [troubleshooting guide](guides/troubleshooting.md) for common
invocation, model-configuration, and OpenCode permission issues.

## Limitations

- Live runtime support per client is recorded in
  [runtime-compatibility.md](runtime-compatibility.md) and is **not tested** in
  this pass. Do not treat the inspected client versions as verified.
- OpenCode enforces the generated per-profile step and permission rules. Copilot
  has no equivalent per-profile hard step ceiling, and some child-session
  restrictions are prompt conventions when a client does not support the
  corresponding custom-agent field.
- Skills can request a model and effort but cannot prevent host-side fallback.
  A host that silently substitutes a model without detection or control does not
  get a strict model-selection claim; that limitation is recorded per host,
  not here.
- A fresh child context provides independence, but it does not automatically
  mean a different model family; use `--models` or the preference file for
  explicit model separation.
- Prompt instructions complement OpenCode permissions; they cannot make an
  inherently irreversible operation safe.
- Unattended operation still needs bounded budgets and final human inspection.
