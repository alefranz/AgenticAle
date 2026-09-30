# Setup and customization

Start with the [README quick start](../README.md). This guide covers model
routing, custom installs, and client limitations for both workflows.

## Copilot models and custom installation

The recommended default derives its role models and effort variants from
[`examples/gpt.json`](../examples/gpt.json): the OpenCode provider prefix is
removed for Copilot, and each model variant sets that worker's reasoning
effort. The thin coordinator uses the strongest configured model at `medium`
effort. The default routing in Copilot CLI and clients using its agent host is:

| Role | Copilot model | Effort |
| --- | --- | --- |
| Coordinator | `gpt-6-sol` | `medium` |
| Explore, implement, fix | `gpt-6-luna` | `max` |
| Implement-hard, review | `gpt-6-sol` | `high` |
| Deep-review, consult | `gpt-6-sol` | `xhigh` |

The coordinator uses the highest model tier because VS Code does not allow a
subagent to exceed its parent agent's model cost tier. Most actual work still
runs in the cheaper worker roles.

Clone the repository only when you want to customize the package. To inherit
the active Copilot model and effort instead of applying per-role defaults:

```sh
node scripts/install-copilot.mjs --no-model
```

To use another role mapping or override effort for every worker:

```sh
node scripts/install-copilot.mjs --models /path/to/models.json --effort high
```

Copilot model IDs are derived by removing the first `provider/` prefix and an
optional OpenCode `#variant` suffix. Recognized variants (`low`, `medium`,
`high`, `xhigh`, or `max`) set the matching Copilot worker effort; `--effort`
overrides variants for all workers. Check `copilot help config` or `/model`
before installing a mapping whose resulting IDs might not be available in
your Copilot plan. Per-agent choices can later be overridden with Copilot's
`/subagents` settings. VS Code's local agent currently documents per-agent
model selection but not per-agent reasoning effort; when that harness ignores
`reasoningEffort`, use its session-level effort control instead.

The custom installer generates a temporary Agent Plugins 1.0 package and makes
no model request. To remove the plugin:

```sh
copilot plugin uninstall agenticale
```

## OpenCode permissions

The installer leaves `opencode.jsonc` unchanged. The foreground agent needs
permission to load `work-mode` and launch `autonomous/*`; these historical worker
IDs are shared by both workflows. Child sessions cannot ask the user questions
or launch nested agents. Configure the actions needed by your task to resolve
without interactive child prompts, scoped to the project and your environment.

See the [OpenCode V2 permissions guide](https://opencode.ai/v2/docs/permissions)
for syntax. `/work` does not require the broad disposable-environment permissions
used for unattended sandbox runs. A denied child action should return a blocker
to the coordinator; do not bypass a denial or assume a paused child can resume.
For unattended setup, see [Autonomous Mode](autonomous.md#permissions-for-unattended-runs).

## Choosing models: cheap by default, strong when it matters

The installer makes model routing an explicit choice. Use `--models` with a
JSON mapping so different roles can use different models, or use `--no-model`
if every role should inherit the model already active in your OpenCode
session. The latter is useful for a quick trial, but it does not provide the
workflow's intended model specialization.

If you want the workflow to use different models for different jobs, pass a
built-in preset name or a path to your own JSON file with `--models`. A preset
is only shorthand for one of the checked-in example mappings; the installer
does not probe your provider account or `/models` catalog.

| Preset | Use it when | Mapping |
| --- | --- | --- |
| `openai` | You have OpenAI connected in OpenCode | [`examples/openai.json`](../examples/openai.json) |
| `zen` | You have an OpenCode Zen subscription | [`examples/gpt.json`](../examples/gpt.json) |
| `local` | You have a local provider and will adapt its model IDs | [`examples/local.json`](../examples/local.json) |
| `example` | You want the mixed local/strong-model template | [`examples/example.json`](../examples/example.json) |

Run `/models` first and make sure the preset's IDs exist in your setup. The
`local` preset is intentionally a starting point: local provider names and
model IDs vary between machines.

### Customizing a mapping

Use the `local` preset if you can run local models, or use the `example` preset
as a mixed template that puts a cheap model on high-volume roles and reserves
a stronger model for integration review and consultation.

Open the file, replace the example model IDs with IDs shown by `/models` in
your OpenCode project, and save it as your own file, for example
`my-models.json`. Install that custom mapping with:

```sh
node scripts/install.mjs --models /path/to/my-models.json
```

For the bundled OpenCode Zen mapping instead:

```sh
node scripts/install.mjs --models zen
```

To explicitly install without per-role model overrides instead:

```sh
node scripts/install.mjs --no-model
```

The example is a template, not a guarantee that those exact providers or
models are configured on your machine. In particular, the `local-llama/...`
IDs require a matching local provider setup.

The intended routing looks like this:

| Role | What it does | Good default |
| --- | --- | --- |
| `explore` | Understands the project and gathers evidence | Fast, cheap, or local |
| `implement` | Makes routine changes | Fast, cheap, or local |
| `fix` | Applies specific review findings | Fast, cheap, or local |
| `implement-hard` | Handles difficult or security-sensitive work | Stronger model when needed |
| `review` | Checks a worker's changes independently | Stronger model when available |
| `deep-review` | Audits interactions across the whole slice | Best model, used sparingly |
| `consult` | Gives a second opinion on one stuck decision | Best model, used sparingly |

This split is the main reason to configure a JSON mapping: the models doing
most of the work can be inexpensive and plentiful, while expensive or
capacity-limited models are reserved for the moments where their extra
reasoning is most valuable.

If you do not have local models, use `openai` or `zen` and replace any IDs that
are not available after checking `/models`. The `gpt.json` file is the
provider-specific template behind the `zen` preset.

### JSON format

You may assign only the roles you want to override; omitted roles continue to
inherit the active session model:

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

Model IDs use OpenCode's `provider/model[#variant]` format. Run `/models` to
see what your connected providers actually make available.

## Useful installer commands

To generate inspectable OpenCode and Copilot packages without installing
either one, run:

```sh
node scripts/build.mjs
```

The generated output is written beneath `dist/` and is intentionally ignored
by Git. Both packages are rebuilt from the checked-in agents, commands, and
skills; generated copies are not maintained by hand.

The repository also commits the default Copilot package under
`plugins/agenticale/` so users can install without cloning. Regenerate it and
the repository marketplace manifest after changing canonical prompts, models,
or plugin metadata:

```sh
node scripts/publish-default-plugin.mjs
```

CI runs the same command with `--check` and rejects stale generated files.

The source lookup skill searches `~/dev` for existing checkouts by default.
For a different local repository root, use a copy install with
`--source-root`:

```sh
node scripts/install.mjs --no-model --source-root /path/to/repos
```

The installer writes that path into the installed skill. Reinstalling with a
different path requires `--replace`, which backs up the previous copy.
Linked installs use the checked-in `~/dev` default and cannot use
`--source-root`.

The default profile target is `$XDG_CONFIG_HOME/opencode` when
`XDG_CONFIG_HOME` is set, otherwise `~/.config/opencode`. Use `--target` for a
different or isolated profile:

```sh
node scripts/install.mjs --target /path/to/opencode --no-model
```

The install command requires either `--models PATH|PRESET` or `--no-model`.

Preview changes without touching the filesystem:

```sh
node scripts/install.mjs --dry-run --no-model
```

Update an existing installation after fetching a newer version (using explicit
session-model inheritance here):

```sh
node scripts/install.mjs --replace --no-model
```

Uninstall only the files owned by this package:

```sh
node scripts/install.mjs uninstall
```

The installer records its ownership, refuses to overwrite differing files by
default, and creates a timestamped backup before an explicitly approved
replacement. Modified files are preserved during uninstall.

## Troubleshooting

- **`/work` or `/autonomous` is not found:** restart OpenCode after running the installer.
- **A worker stops for approval or does not resume:** review the permission
  setup above. Child sessions need deterministic `allow`/`deny` rules for the
  actions they use; continue `/work` from its retained session, or rerun `/autonomous` to
  resume its durable handoff. Only Autonomous Mode provides fresh-session recovery.
- **A model cannot be found:** run `/models`, replace the unavailable ID in your
  JSON file, and reinstall with `--replace`.
- **You are unsure about model routing:** use `--no-model` for a quick trial,
  then reinstall with `--models /path/to/my-models.json` when you are ready to
  specialize roles.
- **You want to understand the implementation:** read the optional
  [technical architecture guide](architecture.md).

## Limitations

- OpenCode can enforce the checked-in per-role step and permission rules.
  Copilot has no equivalent per-role hard step ceiling, and some child-session
  restrictions are prompt conventions when a client does not support the
  corresponding custom-agent field.
- The Copilot coordinator must run at least the cost tier of its strongest
  child in VS Code. The generated default therefore uses Sol at medium effort for
  coordination while routing high-volume work to Luna.
- Copilot CLI 1.0.87 accepts direct repository and local-path installations but
  warns that they are deprecated. The checked-in marketplace is therefore the
  recommended default distribution path; `--plugin-dir` remains suitable for
  ephemeral CLI-only development but is not a shared VS Code installation.
- A fresh child context provides independence, but it does not automatically
  mean a different model family; use `--models` for explicit model separation.
- Prompt instructions complement OpenCode permissions; they cannot make an
  inherently irreversible operation safe.
- Unattended operation still needs bounded budgets and final human inspection.
