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

### GitHub Copilot (CLI and VS Code)

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

#### Alternative: install from a local checkout

Alternatively, clone this repository or use your current checkout, then run the
installer from the repository root:

```sh
node scripts/install-copilot.mjs
```

To inherit the active Copilot model and effort instead of applying per-route
defaults, or to override routing, pass the routing options below. Remove the
plugin with:

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

For a local checkout during development, use `codex plugin marketplace add
/absolute/path/to/AgenticAle` instead of the GitHub source. Then install with
the same `codex plugin add` command. You can also open Plugins in the ChatGPT
desktop app, select the AgenticAle marketplace, and install the plugin there.
Start a new chat or session afterward. In CLI and VS Code, use `/skills` or
mention `$work`, `$review`, or `$autonomous`; in the desktop app, open Skills
or mention the skill in your prompt.

Refresh a Git-backed marketplace with `codex plugin marketplace upgrade
agenticale`. Inspect installs with `codex plugin list` and remove this plugin
with `codex plugin remove agenticale@agenticale`. See the [official Codex plugin
commands](https://learn.chatgpt.com/docs/developer-commands#codex-plugin).

### Alternative: standalone Codex skills

Installs the five skill folders directly under a `.agents/skills` directory.
Codex CLI, the official VS Code extension, and Codex mode in the ChatGPT
desktop app can discover these standalone skills. The installer requires no
native agent or plugin.

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

```sh
node scripts/install.mjs --no-model
```

The install command requires either `--models PATH|PRESET` or `--no-model`.
This installer is copy-only: it no longer offers a link mode. On install it
migrates older copy installs (state schema 1-4), older link installs
(schema 1-4), and older six-profile generated installs (schema 5) to the
current generated copy layout (state `.autonomous-mode-install.json`,
schema 6, a 35-file inventory).

If the target already carries another AgenticAle marker (for example a
standalone `.agenticale-standalone-install.json`), the installer surfaces a
non-blocking `notice: another AgenticAle install appears present (<path>)`
line instead of failing. Review it and remove the duplicate layout if the
two installs were meant to be a single one.

### Google Antigravity (App and CLI)

Antigravity installs the plugin from a local clone. Clone the repository, then
in the CLI run `/plugin`, choose **Discover** > **Install from local
directory**, and select `plugins/agenticale`. Restart the CLI or app before
invoking the skills. Updates are installed from the same local clone through
`/plugin`.

See the [Antigravity installation reference](https://antigravity.google/docs/cli/install/)
and [model routing guide](guides/model-routing.md).

## Model routing

The complete policy, preference precedence, and client-specific behavior live in
[the model routing guide](guides/model-routing.md). The following legacy
section anchors remain available for existing links.

### Routing options

See [routing options and install examples](guides/model-routing.md#install-time-routing-options)
in the focused guide.

### Customizing model routing

See [customizing model routing](guides/model-routing.md#user-preferences-and-precedence)
for the preference file locations and precedence.

### Choosing models: cheap by default, strong when it matters

See [choosing routes](guides/model-routing.md#choosing-models-by-role) for the
packaged tier intent.

### OpenCode permissions

See the [OpenCode permissions guidance](guides/troubleshooting.md#opencode-permissions) and the
[detailed Autonomous guide](https://github.com/alefranz/AgenticAle/blob/main/docs/autonomous.md#permissions-for-unattended-runs).

### Useful build and publish commands

See [build, preview, and contribution checks](contributing.md) and the
[site maintenance guide](site-maintenance.md).

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

See the focused [troubleshooting guide](guides/troubleshooting.md) for common
invocation, routing, and OpenCode permission issues.

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
