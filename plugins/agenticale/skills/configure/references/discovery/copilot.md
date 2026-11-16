# Copilot model discovery (configure)

Model-discovery notes for the `configure` skill on the Copilot CLI, the
Copilot Agent Host (VS Code), and the standalone GitHub Copilot app.
Dispatch rules live in the work skill's
[Copilot runtime binding](../../../work/references/runtimes/copilot.md);
this reference covers only what configure may read, propose, and verify.
The VS Code Local harness uses the separate
[Copilot Local discovery reference](copilot-local.md).

## Detection

Detect the Copilot surface from the actual tool surface: a child dispatch
with native per-call model and effort fields. The exact field names are an
adapter concern to confirm against the raw child-tool schema live; do not
assume a fixed property name across clients. Never detect from the session's
model name.

## Model enumeration — unconfirmed

No live model-listing pass is recorded for these surfaces. Detect whether
the actual surface exposes a model listing (a tool or command); if it does,
use it read-only and treat the result as live evidence for proposals. If it
does not, degrade to the role→slot structure with placeholders and ask the
user for names. Do not invent a listing command, and do not transfer a
capability seen on one Copilot client to another: per-surface parity
between the CLI, Agent Host, and standalone app is unconfirmed, and each
must be checked on its own.

## Native limitations

- Fallback to the session model is documented when a requested model or
  effort cannot be honored: a successful dispatch is not proof the request
  was honored. Proposed assignments are requested-only until native
  evidence establishes them; say so.
- The effort set `low`, `medium`, `high`, `xhigh`, `max` is documented, but
  which levels a given surface/version accepts is unconfirmed. Propose a
  variant only at a level confirmed for the target; otherwise propose no
  variant and mark the level unconfirmed.
- `modelPolicy: required` is a tested compatibility exception, not a
  default. Do not assert such a profile is present or require one.

## What configure proposes here

Preference-file role lines in the combined
`- <role>: <provider/model[#variant]>` form (or the legacy forms), with
names from a live listing if one is actually exposed, or from the user.
Warn where a requested selection may fall back to the session model; the
user's explicit, confirmed choice wins with the limitation stated — the
workflow surfaces an unhonorable listed selection at dispatch, and
configure never silently substitutes a weaker route.

## Verification

No binding documents a `--stats` procedure on this surface: state that the
option is unsupported rather than promising it. Establish the effective
selection only from native runtime metadata or local traces where the host
exposes them; keep an unknown effective setting unknown, and never trust a
child's self-reported model name.

This reference is selected from the actual runtime/tool surface, not from
the session's model name. A surface that is not the Copilot CLI, Copilot
Agent Host, or standalone app does not use it; an unknown surface reports a
limitation instead of inventing tools.
