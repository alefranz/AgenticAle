# Copilot Local model discovery (configure)

Model-discovery notes for the `configure` skill on the Copilot in VS Code
Local harness. Dispatch rules live in the work skill's
[Copilot Local runtime binding](../../../work/references/runtimes/copilot-local.md);
this reference covers only what configure may read, propose, and verify.
The Copilot CLI, Agent Host, and standalone app use the separate
[Copilot discovery reference](copilot.md).

## Detection

Detect the Local harness from the actual tool surface: the `runSubagent`
child entry point with an explicit model argument and stateless calls. The
exact native field name is an adapter concern to confirm against the
harness tool schema live. Never detect from the session's model name.

## Model enumeration — unconfirmed

No live model-listing pass is recorded for this harness. Detect whether the
actual surface exposes a model listing; if it does, use it read-only as
live evidence. If it does not, degrade to the role→slot structure with
placeholders and ask the user for names. Do not invent a listing command.

## Native limitations

- Parent-model cost-tier ceiling: the harness caps child models at a cost
  tier tied to the parent (coordinator) model. A cheap coordinator may be
  unable to launch a requested stronger reviewer. When a proposed `review`,
  `review-deep`, or `consult` selection sits above the session model's
  tier, warn about the ceiling in the proposal — present the limitation
  and let the user choose; never silently downgrade the proposal, and
  never claim the stronger reviewer will run.
- Effort controls are unconfirmed: do not claim a specific effort level is
  honored without confirming it live. Propose no variant unless a level is
  confirmed for this harness.
- Fallback to the session model is possible: a successful dispatch is not
  proof the requested model was honored.
- No separate profiles to select a model: model selection is the native
  per-call argument bounded by the ceiling. Do not propose profiles here.

## What configure proposes here

Preference-file role lines (the same file as the main Copilot binding),
with names from a live listing if one is actually exposed, or from the
user. Flag the tier-ceiling risk for the strong-reasoning slots explicitly;
the user's confirmed choice wins with the limitation stated, and the
workflow surfaces an unhonorable selection at dispatch.

## Verification

No binding documents a `--stats` procedure on this surface: state that the
option is unsupported rather than promising it. Use native runtime
metadata or local traces where available; keep an unknown effective setting
unknown, and never trust a child's self-reported model name.

This reference is selected from the actual runtime/tool surface, not from
the session's model name. A surface that is not the Copilot VS Code Local
harness does not use it; an unknown surface reports a limitation instead of
inventing tools.
