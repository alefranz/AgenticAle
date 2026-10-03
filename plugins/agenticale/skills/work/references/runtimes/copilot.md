# Copilot runtime binding

## Surface and direct child dispatch

This binding is the single Copilot adapter used for the Copilot CLI, the Copilot
Agent Host (VS Code), and the standalone GitHub Copilot app. Those surfaces share
the Copilot SDK direction, so they are one binding here rather than one per
client. The exact bundled runtime and version must be verified per surface with a
versioned smoke test; discovery of a tool in one client does not prove the others
expose the same tool.

A "direct child dispatch" on this surface means the coordinator invokes a fresh
general-purpose child subagent and passes the model and reasoning effort as
native per-call fields on that child invocation. The child is started fresh (the
workflow itself controls child isolation, so the top-level coordinator is not a
forked context). The child receives the bounded task packet for its routing key,
not the parent's full transcript.

- Model field: the per-call model selection on the child dispatch. Copilot's CLI
  reference documents an explicit per-call model and a per-call effort, each with
  a defined precedence. The exact native field name is an adapter concern and
  must be confirmed against the raw child-tool schema live; do not assume a fixed
  property name across clients.
- Effort field: the per-call reasoning/effort selection, drawn from the
  documented set `low`, `medium`, `high`, `xhigh`, `max`. Whether every effort
  level is accepted on a given surface/version is an adapter concern to confirm
  live.

Because the exact field names and the set of supported effort levels are
adapter concerns, this binding describes them generically. Live verification of
the schema is documentation-only for this pass and is not tested here.

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

When the resolved route for a key is `mode: inherit`, the coordinator omits the
model/effort field on the child dispatch. With the field omitted, the child runs
on the session's current model and effort rather than a forced one. `inherit` is
an explicit, intentional choice; it is not a fallback and not a missing value.

## Caller and session overrides

An explicit user/task override for a route wins over the selected policy for that
route only; all other routes still resolve from the policy. Overrides supplied at
task time stay within the session and do not rewrite `routing.json` or any
project/user routing file. If the caller supplies conflicting routing inputs
(more than one routing source, or a routing policy that conflicts with a legacy
`--models` import), the inputs are rejected rather than merged.

## Limitations (stated honestly)

- Fallback to the session model is possible. Copilot documents fallback to the
  session model when a requested model or effort cannot be honored. A successful
  dispatch is not proof the child ran on the requested model. Distinguish
  requested settings from effective settings using runtime metadata or local
  traces; do not rely on a child's self-reported model name.
- Strict enforcement is not guaranteed. If a requested route cannot be honored
  and the host falls back, the host's fallback behavior is not something the
  skill can prevent on its own. Do not advertise strict routing on a mode/version
  where the host silently substitutes with no reliable detection or control.
- `modelPolicy: required` is a compatibility exception, not a default. A thin
  Copilot agent profile that requests `modelPolicy: required` (rejecting model
  substitution) is a tested compatibility exception only if a particular version
  actually needs it to prevent fallback. Do not assert that such a profile is
  present, and do not require one to claim a model-file-free package. If it is
  needed on a specific version, record it as a tested exception or restrict the
  supported mode/version.
- Per-surface parity is unconfirmed. The CLI, Agent Host, and standalone app are
  expected to align, but each must be smoke-tested on its own; a capability seen
  in one is not proof it is present in another.
- Effort-level support is unconfirmed per version. Support only verified effort
  levels on a target; reject or apply an explicitly configured fallback for an
  unsupported level rather than assuming it is honored.

The skill selects this binding from the actual runtime/tool surface, not from the
chosen language model. A surface that is not the Copilot CLI, Copilot Agent Host,
or standalone app does not use this binding; an unknown surface reports a
limitation instead of inventing tools. The VS Code Local harness uses the
separate `copilot-local.md` compatibility binding, not this one.
