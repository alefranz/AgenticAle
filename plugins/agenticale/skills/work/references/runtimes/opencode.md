# OpenCode V2 runtime binding

## Surface and direct child dispatch

OpenCode V2 is the only currently planned mandatory shim. Its documented
subagent interface selects a configured agent and has no documented per-call
model override, so this binding does not dispatch a model directly. Instead the
configured routes are materialized as generated agent profiles, and a "direct
child dispatch" means the coordinator invokes the child tool naming the
preconfigured agent profile for that routing key.

- Dispatch field: the child tool takes a configured agent/profile identifier, not
  a free model string. The exact tool schema must be verified in the spike;
  retain the profiles unless that check demonstrates they are unnecessary.
- Model and effort: encoded inside the generated profile, not on the call. The
  profile carries the model (provider-qualified, `provider/model[#variant]` form)
  and the reasoning effort for that route.

The compatibility mapping from routing key to generated OpenCode profile is:

| Routing key | OpenCode profile ID |
| --- | --- |
| `explore` | `autonomous/explore` |
| `implement` | `autonomous/implement` |
| `implement-hard` | `autonomous/implement-hard` |
| `fix` | `autonomous/fix` |
| `review` | `autonomous/review` |
| `deep-review` | `autonomous/deep-review` |
| `consult` | `autonomous/consult` |

`implement` and `implement-hard` are separate generated profiles that select the
same underlying implementation task contract with different routing context; the
difference is routing, not instructions. There are seven generated profiles, one
per routing key.

## Routing precedence on this surface

Route resolution for each round follows the shared precedence, in order:

1. An explicit user or task override for that route.
2. An explicitly selected project or user routing file (a complete
   `schemaVersion` 1 policy supplied via `--routing PATH`).
3. The packaged host preset (the bundled `routing.json`).

Do not scan unrelated files for overrides. A caller may override any individual
route without replacing the rest of the selected policy. Task-time overrides are
session-scoped and do not persist to the routing file.

## How `inherit` is realized

Because the shim can only select preconfigured profiles, `inherit` on OpenCode is
realized by the generated profile carrying no forced model of its own, so the
child runs on the session model rather than a pinned one. In practice every
packaged OpenCode route is explicit (materialized as a profile with a concrete
model/effort), so `inherit` is expressed by a profile that defers to the session
model. Do not attempt to express `inherit` by omitting a per-call model field;
the native tool does not accept a per-call model override.

## Caller and session overrides

An explicit user/task override can only select a matching preconfigured profile.
Because the native tool only selects preconfigured profiles, arbitrary task-time
model overrides cannot be promised: use a matching installed route, or report
that the shim must be regenerated. Regenerate the generated profiles to change
routes; do not change global model configuration mid-task. Overrides supplied at
task time stay within the session and do not rewrite `routing.json` or any
project/user routing file.

## Limitations (stated honestly)

- Task-time arbitrary model overrides are not supported. The child tool selects
  a preconfigured profile, so a caller cannot name an arbitrary model at task
  time. To change routes, regenerate the generated shim; a requested model with
  no matching profile is reported as a limitation, not silently substituted.
- Generated profiles are the source of the effective model. What a profile
  actually resolves to depends on the generated artifact and the account's model
  availability. The baseline inventory in `examples/` is a mapping reference, not
  proof of current account access.
- Per-call selection is unconfirmed. The documented interface has no per-call
  model override. If the spike shows OpenCode supports per-call selection and
  permissions/step behavior remain correctly represented, the model-only shim can
  be removed; until that check passes, retain the profiles.
- Do not change global model configuration mid-task. Route changes go through
  regenerating the profiles, not by editing a global setting while a task runs.

The skill selects this binding from the actual runtime/tool surface, not from the
chosen language model. A surface that is not OpenCode V2 does not use this
binding; an unknown surface reports a limitation instead of inventing tools.
