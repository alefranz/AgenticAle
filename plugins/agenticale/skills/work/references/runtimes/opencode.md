# OpenCode V2 runtime binding

## Invocation surface

The installer ships three OpenCode command entries with the profiles and
skills: `commands/work.md`, `commands/review.md`, and
`commands/autonomous.md`. Each explicitly loads the matching skill by its exact
ID and passes the command arguments through, so `/work`, `/review`, and
`/autonomous` in the OpenCode TUI are the user-facing entry points.
OpenCode does not interpret the skills' `slash` field; without the command
entries the explicit-only skills have no invocation surface on this host. The
session that receives a command entry is the coordinator. When the
installation configures a coordinator, the command entries bind
`agent: agenticale/coordinator` with `subagent: false`, so they run in the
current session on the coordinator's configured model from the first turn —
including a fresh `/autonomous` resume; without a configured coordinator
(or under `--no-model`) they stay plain caller-session launchers. The
installer never changes `default_agent` or `opencode.jsonc`.

## Surface and direct child dispatch

OpenCode V2 is the only currently planned mandatory shim. Its documented
subagent interface selects a configured agent and has no documented per-call
model override, so this binding does not dispatch a model directly. Instead the
role's model and effort are materialized in the generated profile at install
time, and a "direct child dispatch" means the coordinator invokes the child
tool naming the preconfigured agent profile for that role.

- Dispatch field: the child tool takes a configured agent/profile identifier, not
  a free model string. The exact tool schema must be verified in the spike;
  retain the profiles unless that check demonstrates they are unnecessary.
- Model and effort: encoded inside the generated profile, not on the call. The
  profile carries one model line in provider-qualified `provider/model[#variant]`
  form; the reasoning variant rides on the model line (there is no separate
  reasoning-effort field).

The compatibility mapping from role to generated OpenCode profile is:

| Role | OpenCode profile ID |
| --- | --- |
| `explore` | `agenticale/explore` |
| `implement` | `agenticale/implement` |
| `implement-easy` | `agenticale/implement-easy` (only when configured) |
| `implement-hard` | `agenticale/implement-hard` |
| `fix` | `agenticale/fix` |
| `review` | `agenticale/review` |
| `review-deep` | `agenticale/review-deep` |
| `consult` | `agenticale/consult` |
| `consult-hard` | `agenticale/consult-hard` (only when configured) |

`implement`, `implement-easy`, and `implement-hard` are separate generated
profiles that select the same underlying implementation task contract with
different dispatch context; `consult` and `consult-hard` likewise share the
consult contract. The difference is dispatch, not instructions. The seven
base worker profiles are always generated, one per role; the two optional
worker profiles render only when the model config lists them. When the config
assigns the coordinator key, the build also generates the visible primary
`agenticale/coordinator` profile for the coordinating session itself — it is
not a worker role and never dispatches as a child.

The optional routes follow the shared routing policy: when `implement-easy`
or `consult-hard` is not configured, the workflow dispatches the base route
(`implement` or `consult`) with its existing assignment — a defined
fallback, not a missing-profile error. Optional routes are opt-in
configuration: a leftover profile preserved from an earlier install does
not make the route configured, and a stale preserved file never dispatches
on its own. When the config DOES list an optional route but its installed
profile is missing or unreadable, that is an explicitly configured role: it
blocks only that role's dispatch and is reported with the refresh procedure
below, never silently substituted by the base route. Which case applies is
established from the installer's ownership manifest, not from the available
profiles alone — see [Establishing configured-route
intent](#establishing-configured-route-intent-from-install-evidence).

## Establishing configured-route intent from install evidence

An install that omitted an optional route and an install that configured it
but whose profile was later deleted present the same available profiles, so
the profile catalog alone cannot decide the distinction above. A successful
reinstall that omits a previously configured route can also leave a
user-modified profile file in place (`preserve-modified`) while dropping its
manifest entry, so a present profile file cannot decide it either. The
authoritative evidence is the installer's ownership manifest,
`.autonomous-mode-install.json`, at the install root: its entry inventory
records exactly the profiles the latest successful install generated. The
workflow reads it install-relative — no source checkout or build input —
read-only, at most once per activation, and only when a decision needs
configured-route intent: whenever a needed optional route assignment must
be established, whether its profile is missing, unreadable, or present. The
result stays fixed for the activation, like the preference file; the
workflow never writes the manifest or any other configuration file.

**The effective install root.** The manifest belongs to the OpenCode
configuration directory that supplies the installed `agenticale/*` resources
the workflow runs from. This binding's own installed path identifies it: the
file lives at `<root>/skills/work/references/runtimes/opencode.md`, so the
root is five directories up, the manifest is
`<root>/.autonomous-mode-install.json`, and the profiles it describes are
`<root>/agents/agenticale/`. That holds for the default global target
(`$XDG_CONFIG_HOME/opencode`, otherwise `~/.config/opencode`) and for any
custom `--target`, including a project `.opencode` directory. OpenCode also
discovers project-scoped `.opencode/agents/`, and a project definition of the
same agent ID takes precedence over the global one; a manifest describes
only its own root. Use it only when that root is the effective profile
source: if another configuration scope also defines `agenticale/*` profiles,
or the effective profiles live at a root without a manifest, the evidence
does not match the effective install and intent is not established (below).
Never borrow a manifest from a different install root.

**Reading the manifest.** Intent comes from the presence of the profile's
entry (`agents/agenticale/implement-easy.md`,
`agents/agenticale/consult-hard.md`) in the state's `entries` list — not from
digest matches or current file content. Entry presence means the role is in
the latest successful installed inventory: it is not an install history,
and it is not a guarantee that every preserved file stays owned.

- Entry present: the route is configured. Deleting a profile file never
  rewrites the manifest, so a deleted profile keeps its entry too — that is
  the configured-but-missing case, not an omission. A user-modified profile
  keeps its entry only while the install still lists the route: a
  successful reinstall that omits the route preserves the modified file
  (`preserve-modified`) but drops its entry, because the manifest is
  rewritten as exactly the new inventory.
- Entry absent from a valid current (schema 7) state: the route was omitted
  at the latest successful install, and the shared policy's base-route
  fallback applies — even when a preserved leftover profile file still
  exists. The leftover is unowned: it never dispatches, and deleting it
  keeps the route omitted.
- Older states (generated schemas 5-6, copy/link schemas 1-4) never carried
  the optional worker routes: their absence there logically means omitted.
  The installer migrates those states on the next run.
- Manifest absent (for example a manually copied install), not valid JSON,
  failing validation, or ambiguous in ownership: configured intent is not
  established.

**Decisions.** A configured route whose profile is present and readable
dispatches normally. A configured route whose profile is missing or
unreadable blocks only that role's dispatch and is reported with the refresh
procedure above — never substituted by the base route. An omitted optional
route falls back to its base route with the existing assignment, the defined
policy — whether its profile file is absent or a preserved leftover still
exists; the leftover is never dispatched and never automatically assigned.
The omission fallback applies only to the two optional routes: any other
missing profile blocks that role with the refresh report regardless of the
manifest.

When intent is not established, fail conservatively: report an actionable
limitation naming the evidence gap (missing, unreadable, or ambiguous
manifest at the effective root) and the refresh procedure. Do not dispatch
the optional route — even when a profile file is present — and do not claim
the omission fallback; an explicit request for that route is never honoured
by silently substituting a weaker one — that dispatch stops with the
limitation. Unrelated base roles are unaffected: rounds that do not need
the route continue on their existing assignments with the limitation
surfaced. Rerunning the installer restores both the profiles and the
manifest evidence.

The manifest establishes configuration intent only. Its entries carry paths
and digests, no model assignments: never resolve a model from it, and never
treat it as effective-model evidence — that stays native host evidence, as
above.

## When a role's profile is missing or not what you need

Rerun the checkout-based installer with the flat model config you want. This is
the only step that needs the AgenticAle source checkout (obtain one by cloning
`https://github.com/alefranz/AgenticAle`); preference reading and task resources
stay install-relative:

```sh
node <AgenticAle-checkout>/scripts/install.mjs install --models <path|preset> [--target PATH]
```

(or `--no-model` to make every role inherit the session model), under the
installer's normal ownership, backup, collision, and rollback safeguards: a
profile you have modified is reported (`preserve-modified`) and left in
place. While the install still lists that route, re-running with `--replace`
backs the modification up first and replaces the profile. A reinstall that
omits the route leaves a modified file behind unowned: `--replace` replaces
only what the new install generates — it is not a broad cleanup — so
removing such a leftover is a manual step, and the route stays omitted with
or without it. OpenCode picks up the refreshed profiles without an app
restart: a running server watches the configuration directory and reloads
agents, commands, and skills after a save, and `/reload` forces a full
reload. Do not treat refreshed profiles as effective until the host has
reloaded them; the next fresh workflow activation dispatches with the
refreshed profiles. `--profile` is not an option on this surface — models
are selected at install time.

## Requested versus effective settings

The profile's frontmatter carries the requested model and effort; what it
actually resolves to depends on the account's model availability. Keep an
unknown effective setting unknown, and never let a child's self-reported model
name establish the effective model. Establish the effective selection only
from native host evidence — the session and assistant metadata the host
records (agent, provider/model, variant, native response identifiers, and
usage), or local traces — and record requested versus effective when both
are available.

## How `inherit` is realized

Because the shim can only select preconfigured profiles, `inherit` on OpenCode is
realized by the generated profile carrying no forced model of its own, so the
child runs on the session model rather than a pinned one. In practice every
packaged OpenCode role is explicit (materialized as a profile with a concrete
model/effort), so `inherit` is expressed by a profile that defers to the session
model. Do not attempt to express `inherit` by omitting a per-call model field;
the native tool does not accept a per-call model override.

## Caller and session overrides

An explicit user/task override can only select a matching installed profile;
arbitrary task-time model overrides cannot be promised — reinstall with a
different `--models` config instead. Never change global model configuration
mid-task; overrides stay in the session and rewrite no preference file.

## Session usage summary (opt-in)

The `--stats` option is supported on this surface. The coordinator process's
`OPENCODE_SESSION_ID` environment variable identifies the coordinator session.
After the final diff and acceptance checks and before the delivery report, run
the skill's own stats helper from the installed `skills/work` directory — the
environment variable supplies the session id, so no argument is needed:

```sh
node scripts/session-stats.mjs
```

Include its summary, or a compact excerpt when the table is large, in the
final report. The helper issues only read-only API queries against the
running OpenCode server and changes nothing. If the server is unreachable,
report that the summary could not be produced and continue with the
remaining delivery.

## Limitations (stated honestly)

- Task-time arbitrary model overrides are not supported. The child tool selects
  a preconfigured profile, so a caller cannot name an arbitrary model at task
  time. A requested model with no matching profile is reported as a limitation,
  not silently substituted.
- The generated profile is the source of the effective model. What it actually
  resolves to depends on the generated artifact and the account's model
  availability.
- Per-call selection is unconfirmed. The documented interface has no per-call
  model field. If a live check shows OpenCode supports per-call selection and
  permissions/step behavior remain correctly represented, the model-only shim
  can be removed; until that check passes, retain the profiles.
- Do not change global model configuration mid-task. Model changes go through
  reinstalling with a different `--models` config, not by editing a global
  setting while a task runs.

The skill selects this binding from the actual runtime/tool surface, not from the
chosen language model. A surface that is not OpenCode V2 does not use this
binding; an unknown surface reports a limitation instead of inventing tools.
