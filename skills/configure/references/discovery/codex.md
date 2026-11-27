# Codex model discovery (configure)

Covers the Codex CLI and official Codex VS Code extension (distinct from the experimental Codex integration in VS Code Agent Host). Dispatch rules live in [the Codex runtime binding](../../../work/references/runtimes/codex.md).

## Detection

Detect from the tool surface (never the session model name): a child spawn tool with native per-spawn model and reasoning fields. Confirm exact field names against the live schema.

## Model enumeration — unconfirmed

No live listing pass is confirmed. Check read-only whether the surface exposes a model listing or config/profile inspection; otherwise propose placeholders and ask the user for names. Never invent a command or assume parity between the CLI and VS Code extension.

## Native limitations & proposal

- **Unconfirmed per-call enforcement:** whether the exposed spawn tool honors per-call overrides vs. configured profiles is unconfirmed live; do not promise strict enforcement.
- **Custom agent pins override preferences:** a project custom agent file pinning its own model can override preference assignments; warn about any observed pin.
- **Unconfirmed effort levels & fresh context:** per-version acceptance of `low`–`max` is unconfirmed (propose a variant only if confirmed), and fresh-context behavior is unconfirmed (do not claim verified).

Propose preference-file role lines (`- <role>: <provider/model[#variant]>` or legacy forms) with these limitations stated alongside.

## Verification

`--stats` is **not** supported here; state that explicitly. Verify effective models only via native runtime metadata or local traces where exposed; never trust a child's self-reported model name.
