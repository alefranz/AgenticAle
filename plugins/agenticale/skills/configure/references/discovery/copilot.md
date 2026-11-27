# Copilot model discovery (configure)

Covers Copilot CLI, Copilot Agent Host (VS Code), and the standalone GitHub Copilot app (for VS Code Local harness, see [Copilot Local](copilot-local.md)). Dispatch rules live in [the Copilot runtime binding](../../../work/references/runtimes/copilot.md).

## Detection

Detect from the tool surface (never the session model name): a child dispatch tool exposing native per-call model and effort fields. Confirm exact field names against the live tool schema.

## Model enumeration — unconfirmed

No live model-listing pass is confirmed across these clients. Check read-only whether the active surface exposes a listing tool or command; if not, propose placeholders and ask the user for names. Never invent a command or assume parity across Copilot CLI, Agent Host, and standalone app.

## Native limitations & proposal

- **Silent fallback:** unhonorable model or effort requests fall back to the session model without failing dispatch.
- **Unconfirmed effort levels:** `low`, `medium`, `high`, `xhigh`, `max` are documented, but per-client acceptance is unconfirmed; propose a variant only when confirmed for the target surface.
- `modelPolicy: required` is a tested compatibility exception, not a default; never require or assume it.

Propose preference-file role lines (`- <role>: <provider/model[#variant]>` or legacy forms) from live listing evidence or user input, stating any fallback/variant limitations alongside.

## Verification

`--stats` is **not** supported here; state that explicitly. Verify effective models only via native runtime metadata or local traces where exposed; never trust a child's self-reported model name.
