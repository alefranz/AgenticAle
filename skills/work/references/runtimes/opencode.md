# OpenCode V2 runtime binding

## Invocation surface

The installer ships three OpenCode command entries with the profiles and
skills: `commands/work.md`, `commands/review.md`, and
`commands/autonomous.md`. Each explicitly loads the matching skill by its exact
ID and passes the command arguments through, so `/work`, `/review`, and
`/autonomous` in the OpenCode TUI are the user-facing entry points.
OpenCode does not interpret the skills' `slash` field; without the command
entries the explicit-only skills have no invocation surface on this host. The
session that receives a command entry is the coordinator.

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
  profile carries the model (provider-qualified, `provider/model[#variant]` form)
  and the reasoning effort for that role.

The compatibility mapping from role to generated OpenCode profile is:

| Role | OpenCode profile ID |
| --- | --- |
| `explore` | `agenticale/explore` |
| `implement` | `agenticale/implement` |
| `implement-hard` | `agenticale/implement-hard` |
| `fix` | `agenticale/fix` |
| `review` | `agenticale/review` |
| `deep-review` | `agenticale/deep-review` |
| `consult` | `agenticale/consult` |

`implement` and `implement-hard` are separate generated profiles that select the
same underlying implementation task contract with different dispatch context;
the difference is dispatch, not instructions. There are seven generated
profiles, one per role.

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
profile you have modified is reported (`preserve-modified`) and left in place
until you explicitly approve replacement with `--replace`, which backs it up
first. Then start a new OpenCode session: do not treat refreshed profiles as
effective until a new session picks them up. `--profile` is not an option on
this surface — models are selected at install time.

## Requested versus effective settings

The profile's frontmatter carries the requested model and effort; what it
actually resolves to depends on the account's model availability. Keep an
unknown effective setting unknown, and never let a child's self-reported model
name establish the effective model.

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
