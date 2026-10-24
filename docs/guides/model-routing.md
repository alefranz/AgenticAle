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

Not every fix dispatches on the routine `fix` route. A blocking finding that
needs concurrency, durability, state-machine, or ownership reasoning keeps the
fix role and its fix counters, but is dispatched on the `implement-hard`
route, which the packaged defaults place in the standard tier. The task role
and the routing key are separate choices; the configured policy decides the
route, and a requested route the binding cannot honour is reported rather
than silently substituted.

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

## The default startup path

You do not need a preference file. With no `routing.md` anywhere and no
invocation-level preferences — no direct task-time routing choice, no
explicitly supplied invocation Markdown file, and no profile selected at
invocation — each activation resolves the installed choices with one
mechanical helper call from the installed skill and finalizes directly from
its `resolved` output: no manual bootstrap, and no AgenticAle checkout, even
when the task is developing AgenticAle itself. With invocation-level
preferences, that startup output is not final: the workflow interprets the
choices into the ordered preference layers, lowest to highest precedence as
the precedence sections below describe, writes them to a temporary file, and
resolves them with `resolve --input <file> --explain`; that `--explain`
output is the routing snapshot. The choices apply to that activation only and
never create a preference file, and an invocation-selected profile that no
preference file defines fails with the actionable unknown-profile error that
lists the available names. Missing preference files are
normal: the workflow never creates configuration and never asks you to
set up routing, and it stays quiet about routine routing — the details stay
in the session, and routing information is surfaced only to explain a
selected profile, a material change, a limitation, or a required user
action.

The installed choices are whatever your install was built with. For a custom
install (a `--models` preset, a `--routing` policy, `--no-model`, or an
`--effort` override), the installed baseline IS your customization: nothing
is re-derived from the packaged defaults at activation time.

When preference files exist, the workflow reads and interprets them itself
and resolves the interpreted layers with the helper; the resolver's
`--input` is a file path of those interpreted layers and is omitted when
there are no preferences.

On OpenCode, each role's route is compared with its generated profile before
dispatch. An unavailable role — a missing, stale, or unreadable profile —
blocks only its own dispatch and is reported with the preparation steps;
the other roles proceed.

## User preferences and precedence

The packaged `references/routing.json` supplies defaults. To customize them,
copy `references/routing.example.md` from the installed `work` skill to either
`<repo>/.agenticale/routing.md` for one repository or
`~/.agenticale/routing.md` for all repositories, or use the OpenCode
installer's consented setup step to create a minimal personal
`~/.agenticale/routing.md` scaffold for you (ownership note below). The
project file overrides
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

Preference files belong to the user. Install, update, build, publication, and
uninstall do not create, overwrite, migrate, or remove them. The one exception
is the OpenCode installer's consented setup step (`node scripts/install.mjs
setup`, run with `--setup` or after you answer yes to the post-install
prompt): it may create the personal `~/.agenticale/routing.md` when it is
absent, as a minimal scaffold in which every role inherits the session model
and effort. It never overwrites, migrates, or removes a preference file, and
it never creates the project-scope file. Missing files mean no customization;
a present but unreadable file is reported rather than claimed as applied.
Start a new `/work`, `/review`, or `/autonomous` activation to load changed
preferences. See the example preference file at
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

## Named routing profiles

A routing profile is a named collection of overrides — tier definitions and
role overrides — inside an optional `## Profile: <name>` section of a
`routing.md` preference file. Select exactly one profile per workflow
activation. Profiles control child routing only: a profile is not a runtime,
an account, an endpoint, or a machine, and it never authenticates, moves, or
configures anything. Names are stable lowercase identifiers (1–40 characters,
starting with a letter, then lowercase letters, digits, or hyphens, with no
trailing hyphen); `default` and `inherit` are reserved. The full contract,
including the seven-level precedence, is in the
[routing contract](https://github.com/alefranz/AgenticAle/blob/main/skills/work/references/ROUTING.md#named-routing-profiles).

### Ordinary defaults are unchanged

No selector — or `--profile default` — means ordinary routing: installed
baseline, then personal preferences, then project preferences, then invocation
choices. `default` does **not** mean "ignore my routing.md and use the
packaged settings": every one of your default sections still applies.

### A default section plus profiles

The packaged example
([`references/routing.example.md`](https://github.com/alefranz/AgenticAle/blob/main/skills/work/references/routing.example.md))
ships a default section and two profiles. Inside a `## Profile:` section the
runtime heading sits one level deeper (`### opencode`), and tier tables use
`#### Tiers`:

```markdown
# AgenticAle model routing

## opencode

### Tiers

| Tier | Model | Reasoning effort |
| --- | --- | --- |
| fast | server-a/small-coder | medium |
| routine | server-a/main-coder | high |
| standard | provider-main/reviewer | high |
| deep | provider-main/reviewer | xhigh |

### Role overrides

- review: use the deep tier.

## Profile: server-b

### opencode

#### Tiers

| Tier | Model | Reasoning effort |
| --- | --- | --- |
| fast | server-b/small-coder | medium |
| routine | server-b/main-coder | high |
```

The model names are illustrative, not a claim of availability; actual
identifiers and effort support come from your host. `--profile server-b`
selects only that profile's entries: a partial profile like this one changes
only the `fast` and `routine` tiers, while review and the deeper tiers retain
the default section's configuration.

### Precedence across files

For a selected profile, precedence is lowest to highest: installed baseline,
personal default entries, personal entries for the selected profile, project
default entries, project entries for the selected profile, default and
selected-profile entries from an explicitly supplied invocation Markdown file,
and direct invocation overrides. A project default entry can therefore beat a
personal profile entry: if your personal profile redefines `fast` and the
project default also redefines `fast`, the project's `fast` wins for
default-mapped roles such as `explore`. Same-name profiles merge across files
by entry, so a project file may extend a personal profile by specifying only
its differences.

### Role resets inside profiles

The reset semantics apply unchanged inside a profile:

- `- review: default.` in the profile's role overrides clears a lower-level
  direct role exception; `review` returns to the profile's `standard` tier.
- `tier: default` restores a standard tier's packaged definition.
- Changing all four tiers in a profile does **not** clear an existing direct
  role exception. Clear it explicitly in the profile
  (`- review: default.`) or at a higher layer.

### Selecting at invocation

```sh
/work --profile server-b Fix the flaky test
/work --profile=server-b Fix the flaky test
/work --pr --profile server-b fix the flaky test
/work --profile server-b --pr fix the flaky test
/work --profile server-b -- fix the flaky test
/autonomous 4 --profile server-b Migrate the report pipeline
/autonomous --profile server-b 4 Migrate the report pipeline
/autonomous --profile server-b
```

Work accepts `--profile NAME` (or `--profile=NAME`) alongside `--pr`,
`--consult`, and `--`, in any order, with everything after the options as the
task text. Autonomous
accepts the worker-round budget in either order relative to the profile
selector. A profile-only invocation such as `/autonomous --profile server-b`
has an empty parsed goal text, so it RESUMEs the active goal. An unambiguous
natural-language instruction (for example, "use the server-b routing profile")
also selects a profile; merely mentioning one does not. An unknown name, a
missing name (a trailing `--profile`), or two different names is reported
before dispatch, listing the profiles available for the active runtime.

### How Autonomous treats the selection

The selected profile name is durable goal configuration: Autonomous records
it in the active handoff, separately from the diagnostic resolved-routing
summary. A resume without a selector retains the goal's recorded selection; an
explicit selector changes it; `--profile default` clears a named selection
back to ordinary routing. Every fresh resume re-reads the current routing
files: the persisted name is the only thing persisted, and resolved model
choices are never carried over. A selected profile that no longer resolves —
removed, renamed, or defined only for another runtime — blocks dispatch with
an actionable explanation instead of silently falling back to default.

### OpenCode named sets

On OpenCode, a selected profile requires an explicitly prepared **named set**
of generated profiles in `agenticale/routing/<profile>/<role>` (for example
`agenticale/routing/server-b/implement`), each carrying the selected
profile's resolved model and effort for that role. Named sets are user-owned
agent files outside the installer's management: the installer refreshes only
the default seven and never creates or regenerates named sets, so preparing
one is a manual, user-approved action — resolve with `--profile`, mirror
each default profile with the resolved model and effort, start a new session,
and confirm host acceptance; the full procedure is in the
[OpenCode runtime binding](https://github.com/alefranz/AgenticAle/blob/main/skills/work/references/runtimes/opencode.md).
Selecting a profile never regenerates profiles or changes `opencode.jsonc`
or global host configuration implicitly. A missing or stale
named set (prepared values that differ from the currently resolved selection)
is reported with the exact preparation steps and is never silently
substituted by the default `agenticale/<role>` set. Host acceptance of the
`agenticale/routing/...` identifier namespace is not verified yet: before
dispatch, the workflow confirms the host accepts the identifier — it appears
in the available-agents listing and resolves to the intended prepared
profile — and records that confirmation in the session. See the
[OpenCode profile refresh](#opencode-profile-refresh) section below.

### Profiles are not build inputs

Profiles are user-authored `routing.md` content, scoped to one activation
(Work) or one goal (Autonomous). They are not install-time `--models` presets
or build-time `--routing` files, which convert fixed choices into the
installed baseline at install time.

## OpenCode profile refresh

OpenCode turns the resolved routes into seven generated profiles. A preference
change takes effect there only after matching profiles are installed and
loaded. Before dispatch, the workflow compares requested routes with installed
profiles. If no profile matches, it reports the mismatch and the preparation
command; it does not rewrite profiles or global host configuration implicitly.
Refresh requires the checkout-based installer and a new OpenCode session. The
installer leaves `opencode.jsonc` unchanged, and the installer refresh updates
only the default seven. A selected profile's named set is a user-owned set of
agent files under `agenticale/routing/<profile>/<role>`, prepared by hand per
the runtime binding's procedure — resolve with `--profile`, mirror each
default profile with the resolved model and effort, start a new session, and
confirm host acceptance; see [Named routing profiles](#named-routing-profiles).
The installer never regenerates named sets. See the
[OpenCode runtime procedure](https://github.com/alefranz/AgenticAle/blob/main/skills/work/references/runtimes/opencode.md).
