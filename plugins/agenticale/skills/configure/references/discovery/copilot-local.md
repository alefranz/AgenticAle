# Copilot Local model discovery (configure)

Covers Copilot in VS Code Local harness (for CLI, Agent Host, and standalone app, see [Copilot](copilot.md)). Dispatch rules live in [the Copilot Local runtime binding](../../../work/references/runtimes/copilot-local.md).

## Detection

Detect from the tool surface (never the session model name): `runSubagent` with an explicit model argument and stateless calls. Confirm the exact native field name against the live schema.

## Model enumeration — unconfirmed

No live listing pass is confirmed. Check read-only whether the surface exposes a listing; otherwise propose placeholders and ask the user for names without inventing a command.

## Native limitations & proposal

- **Parent-model cost-tier ceiling:** the harness caps child models at a cost tier tied to the parent (coordinator) model, so a cheap coordinator may be unable to launch a stronger reviewer. Warn explicitly whenever proposed `review`, `review-deep`, or `consult` models exceed the session model's tier; never silently downgrade, and let the user decide.
- **Unconfirmed effort controls:** propose no `#variant` unless effort support is confirmed live for this harness.
- **Fallback possible:** a successful dispatch does not prove the requested model ran.
- **No separate profiles:** routing uses per-call arguments only; do not propose agent profile files.

Propose preference-file role lines (same file location as main Copilot), flagging tier-ceiling risks clearly.

## Verification

`--stats` is **not** supported here; state that explicitly. Verify effective models only via native runtime metadata or local traces where exposed; never trust a child's self-reported model name.
