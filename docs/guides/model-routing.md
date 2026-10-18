# Model routing

AgenticAle routes each worker role through an explicit per-route policy. The
four packaged tiers express a cost/value design: fast exploration, routine
implementation and fixes, standard review and hard implementation, and deep
review when the combined work warrants it. Use inexpensive or local models for
high-volume routine work where your host and provider support them; reserve
stronger models for difficult reasoning and independent review. Checks and
focused fixes aim to reduce time spent on unfinished work. They do not promise
perfect results or universal savings. Model access and enforcement depend on
the client, account, and provider; the published runtime matrix remains
**not tested** until a live check is recorded.

For Copilot, Codex, or OpenCode installs, the simplest trial is to inherit the
current session model for every route with `--no-model`. For custom preferences,
copy `references/routing.example.md` from the installed `work` skill to
`.agenticale/routing.md` in one repository or `~/.agenticale/routing.md` for
your user account. Project choices override personal choices, which override
the packaged baseline. Start a new workflow activation to load the preference.

OpenCode turns the resolved routes into seven generated profiles. After changing
preferences, install a matching profile set and restart or open a new session;
if the selected profiles do not match, the workflow reports the mismatch and
the preparation command.

The portable policy is specified in the
[routing contract](https://github.com/alefranz/AgenticAle/blob/main/skills/work/references/ROUTING.md). The details below
cover install-time choices and user-owned preferences.

## Choosing models by role

Each tier is a named configuration: a model plus requested reasoning effort
where the host supports it. The same model at different effort levels can be
different tiers; a tier can also inherit the session model. The packaged tiers
are for different kinds of work, not a fixed ranking of model quality.
Exploration, routine implementation, and focused fixes make up much of the
workload, so the defaults use a lighter configuration there when supported. A
capable lower-cost implementer may need extra focused implementation or fix
passes, yet still cost less overall than using the strongest model throughout.
A fresh, stronger reviewer can catch issues and give actionable feedback, while
checks and re-review can improve the result. Extra review and fix work counts
toward the total, and savings and quality depend on the task and provider.

| Tier | Typical roles | Packaged example for Copilot and Codex |
| --- | --- | --- |
| Fast | `explore` | `gpt-6-luna` at `medium` effort |
| Routine | `implement`, `fix` | `gpt-6-luna` at `high` effort |
| Standard | `implement-hard`, `review` | `gpt-6.1-sol` at `high` effort |
| Deep | `deep-review`, optional `consult` | `gpt-6.1-sol` at `xhigh` effort |

These examples come from the packaged defaults, not a claim about current
availability or account pricing. OpenCode uses the corresponding `openai/`
model prefix. Antigravity uses its host-native `flash` and `pro` choices and has
no reasoning-effort setting.

Review independence comes from a fresh agent checking the work. It does not
require a different model, and an explicitly configured route can inherit the
session model. Check your host's available models before relying on a specific
choice.

## Install-time routing options

All three installers accept the same routing options, passed through to the
build:

| Option | Effect |
| --- | --- |
| `--models PATH\|PRESET` | Legacy import. Reads an `examples` mapping (`gpt`, `openai`, `zen`, `local`, `example`) or a JSON file and converts it to the routing contract. Known OpenCode provider prefixes (`openai/`, `opencode/`) are removed for Copilot and Codex, and retained for OpenCode. Omitted roles become explicit inheritance and are reported. Does not apply to `antigravity` tiers (packaged tiers are preserved). |
| `--routing PATH` | Build from a complete caller-supplied routing file instead of the packaged `routing.json`. Conflicts with `--models`. |
| `--no-model` | Omit model and effort for every route; each route inherits the session model. Conflicts with `--models`. |
| `--effort LEVEL` | Route-wide reasoning-effort override (`low`/`medium`/`high`/`xhigh`/`max`); overrides every route's effort. Skips runtimes without effort control (`antigravity`) with a notice. |

`--coordinator-effort` is retired: the session owns its own effort, so the
option is ignored and a notice is reported. `--models` preserves packaged
Antigravity tiers, and `--effort` skips Antigravity because it has no effort
control.

Examples:

```sh
# Copilot, packaged routing
node scripts/install-copilot.mjs

# Copilot, inherit the session model everywhere
node scripts/install-copilot.mjs --no-model

# Copilot, a complete caller policy
node scripts/install-copilot.mjs --routing /path/to/routing.json --effort high

# Standalone Codex skills, project scope
node scripts/install-standalone.mjs --scope project --models zen

# OpenCode, isolated target and session inheritance
node scripts/install.mjs --target /path/to/opencode --no-model
```

`--source-root PATH` on any installer writes a different default source-lookup
root into the installed skill; `SOURCE_ROOT` still takes precedence at lookup
time.

## User preferences and precedence

The packaged `references/routing.json` supplies defaults. To customize them,
copy `references/routing.example.md` from the installed `work` skill to either
`<repo>/.agenticale/routing.md` for one repository or
`~/.agenticale/routing.md` for all repositories. The project file overrides
the personal file, which overrides the packaged baseline; an explicitly
supplied Markdown path is the highest-precedence invocation choice. Invocation
choices apply only to that workflow activation and do not persist to a
preference file.

For Git projects, the project preference is found from the worktree root even
when invoked from a subdirectory. For non-Git projects, establish the workspace
root explicitly. Apply only preferences for the active runtime. Unknown roles,
undefined tiers, or unresolved ambiguity for that runtime must be surfaced
before the affected dispatch. Preferences govern model, effort, and explicit
fallback choices only; they do not change task scope, budgets, permissions, or
installation ownership.

Use the tier table first and add optional role overrides. State both model and
effort for a direct choice on runtimes with effort control. Missing entries
retain the lower-precedence choice. `inherit` explicitly uses both the session
model and effort; `role: default` clears a lower-precedence role exception and
restores the packaged role-to-tier mapping, while `tier: default` restores
that standard tier's packaged definition. A custom tier without a packaged
definition cannot be reset this way. Replacing an entry replaces its model,
effort, and fallbacks together. Fallbacks are optional ordered pairs and are
used only when explicitly requested and supported by the runtime.

Preference files are user-owned. Install, update, build, publication, and
uninstall do not create, overwrite, migrate, or remove them. Missing files mean
no customization; a present but unreadable file is reported rather than
claimed as applied. Start a new `/work` or `/autonomous` activation to load
changed preferences. See the example preference file at
[`references/routing.example.md`](https://github.com/alefranz/AgenticAle/blob/main/skills/work/references/routing.example.md)
and the full [routing contract](https://github.com/alefranz/AgenticAle/blob/main/skills/work/references/ROUTING.md) for
interpretation and fallback details.

Use a `--models` preset as shorthand for a checked-in example mapping; it does
not probe your provider account or `/models` catalog. Run `/models` and confirm
that IDs are available. The `local` preset is a starting point because local
provider names and IDs vary between machines. Legacy `--models` JSON names
roles and omits roles to inherit:

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

Values use `provider/model[#variant]`; an optional `#variant`
(`low`/`medium`/`high`/`xhigh`/`max`) sets that route's effort. The bundled
`openai/` and `opencode/` prefixes select OpenCode providers; imports remove
them when creating Copilot and Codex routes, which use bare model IDs.

## OpenCode profile refresh

OpenCode turns the resolved routes into seven generated profiles. A preference
change takes effect there only after matching profiles are installed and
loaded. Before dispatch, the workflow compares requested routes with installed
profiles. If no profile matches, it reports the mismatch and the preparation
command; it does not rewrite profiles or global host configuration implicitly.
Refresh requires the checkout-based installer and a new OpenCode session. The
installer leaves `opencode.jsonc` unchanged. See the
[OpenCode runtime procedure](https://github.com/alefranz/AgenticAle/blob/main/skills/work/references/runtimes/opencode.md).
