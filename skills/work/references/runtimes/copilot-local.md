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

## Routing bootstrap on this surface

Route resolution for each round follows the shared bootstrap in `ROUTING.md`:
read the installed contract and defaults, load the personal and project JSON
patches, apply invocation choices, and resolve this runtime's routes. The
preference section uses the `copilot` runtime name; this binding retains its
own dispatch limits (the per-call model argument on `runSubagent`, the
stateless calls, and the parent-model cost-tier ceiling). Precedence is
invocation, project, personal, then installed baseline. Do not scan unrelated
files. Invocation choices are session-scoped and do not persist to a preference
file or `routing.md`.

## Requested versus effective settings

The explicit model argument on `runSubagent` carries the snapshot's requested
selection, bounded by the harness's parent-model cost-tier ceiling. A
successful dispatch is not proof the requested model was honored: distinguish
requested from effective settings using runtime metadata or local traces, and
keep an unknown effective setting unknown.

## How `inherit` is realized

When the resolved route for a key is `mode: inherit`, the coordinator omits the
model argument on the `runSubagent` call so the child runs on the session model
rather than a forced one. `inherit` is an explicit, intentional choice; it is not
a fallback and not a missing value.

## Caller and session overrides

An explicit invocation choice wins over discovered preference files for the
entries it names; every other entry still resolves from the discovered files
and the installed baseline. Invocation choices
stay within the session and never rewrite `routing.md` or any preference
file.

## Limitations (stated honestly)

- Parent-model cost-tier ceiling. The harness enforces a cost-tier ceiling tied
  to the parent (coordinator) model. A cheap coordinator may therefore be unable
  to launch a requested stronger reviewer: if the resolved review or deep-review
  route names a model above the coordinator's cost tier, the harness may not
  honor it. Report this as a limitation rather than assuming the stronger
  reviewer ran.
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
