# Copilot VS Code Local harness compatibility binding

## Surface and direct child dispatch

This is a small compatibility binding for the Copilot in VS Code Local harness,
kept separate from the main Copilot binding (`copilot.md`). The Local harness
separately documents per-call model selection and a parent-model cost-tier
ceiling, with its own restrictions and controls, so it is not merged into the
main Copilot adapter.

A "direct child dispatch" on this surface means the coordinator invokes
`runSubagent` (the harness's child entry point) and passes an explicit model
argument on that call.

- Model field: the explicit model argument on `runSubagent`. The exact native
  field name is an adapter concern to confirm against the harness tool schema
  live; do not assume a fixed property name.
- Effort: the harness's effort controls must be assessed separately. Do not
  assume the documented `low`/`medium`/`high`/`xhigh`/`max` set is fully honored
  on this surface; confirm which levels are actually accepted live.

## Stateless calls

Calls on this surface are stateless. Each `runSubagent` invocation is independent
and does not inherit a prior call's context or an accumulated session state from
the harness. The coordinator must therefore pass the full bounded task packet on
every call and must not rely on the harness retaining context between rounds.

## Model selection on this surface

This host exposes a per-call model argument on `runSubagent`. It uses the same
preference file as the main Copilot binding — there are no per-runtime sections
anymore. When a preference file is present, pass the role's assignment from the
active preference file; the preference file is documented in the "Model
configuration (this installation)" section the installation appends to the
skills. If that section is absent from the loaded skill, there is no preference
file and no model selection. When no assignment exists for a role, spawn
without a model field (the session default). This binding retains its own dispatch limits (the per-call
model argument on `runSubagent`, the stateless calls, and the parent-model
cost-tier ceiling).

The preference file's nine worker keys include the two optional routes,
`implement-easy` and `consult-hard`. When neither is assigned, the shared
routing policy dispatches the base route (`implement` or `consult`) with its
existing assignment — a defined fallback, not an error. When an optional
route IS assigned, the parent-model cost-tier ceiling still applies: a
`consult-hard` selection above the coordinator's cost tier may not be
honored, and that is reported as a limitation, never silently substituted.

## Requested versus effective settings

The explicit model argument on `runSubagent` carries the requested selection,
bounded by the harness's parent-model cost-tier ceiling. A successful dispatch
is not proof the requested model was honored; keep an unknown effective
setting unknown.

## How `inherit` is realized

When the role's assignment is `inherit`, the coordinator omits the model
argument on the `runSubagent` call so the child runs on the session model
rather than a forced one. `inherit` is an explicit, intentional choice; it is
not a fallback and not a missing value.

## Caller and session overrides

An explicit invocation choice wins for the entries it names and stays within
the session; it rewrites no preference file.

## Limitations (stated honestly)

- Parent-model cost-tier ceiling. The harness enforces a cost-tier ceiling tied
  to the parent (coordinator) model. A cheap coordinator may therefore be unable
  to launch a requested stronger reviewer: if the assigned review or review-deep
  model sits above the coordinator's cost tier, the harness may not honor it.
  Report this as a limitation rather than assuming the stronger reviewer ran.
- Statelessness has a cost. Because calls do not share state, the coordinator
  cannot rely on cross-call context; every round re-sends its packet.
- Effort controls are unconfirmed. The harness's effort controls are assessed
  separately from its model selection; do not claim a specific effort level is
  honored without confirming it live.
- Fallback to the session model is possible. As with the main Copilot binding, a
  successful dispatch is not proof the requested model was honored; use runtime
  metadata or local traces to distinguish requested from effective settings.
- No separate profiles to select a model. Do not introduce profiles on this
  surface solely to select a model; model selection is a native per-call
  argument bounded by the cost-tier ceiling.

The skill selects this binding from the actual runtime/tool surface, not from the
chosen language model. A surface that is not the Copilot VS Code Local harness
does not use this binding; an unknown surface reports a limitation instead of
inventing tools. The Copilot CLI, Agent Host, and standalone app use
`copilot.md`, not this binding.
