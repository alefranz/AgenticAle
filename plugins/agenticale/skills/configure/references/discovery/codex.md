# Codex model discovery (configure)

Model-discovery notes for the `configure` skill on the Codex CLI and the
official Codex VS Code extension. Dispatch rules live in the work skill's
[Codex runtime binding](../../../work/references/runtimes/codex.md); this
reference covers only what configure may read, propose, and verify.

## Detection

Detect Codex from the actual tool surface: a child spawn with native
per-spawn model and reasoning fields. The exact field names are an adapter
concern to confirm against the actually exposed spawn tool live. The
official Codex extension is not the separate experimental Codex integration
in VS Code Agent Host; do not equate them. Never detect from the session's
model name.

## Model enumeration — unconfirmed

Codex's model/config profiles are a candidate discovery surface, not a
confirmed capability: no live listing pass is recorded. Detect whether the
actual surface exposes a model listing or a read-only config/profile
inspection; if it does, use it read-only as live evidence for proposals. If
it does not, degrade to the role→slot structure with placeholders and ask
the user for names (or point at the host's own documentation). Do not
invent a listing command, and do not transfer a capability seen on the CLI
to the extension or vice versa — per-surface parity is unconfirmed.

## Native limitations

- Per-spawn model and reasoning fields are documented, but whether the
  exposed spawn tool actually accepts a per-call override (as opposed to a
  configured profile) is unconfirmed against the live tool. Do not promise
  strict enforcement the host cannot confirm.
- Custom agent files can override the spawn choices: a project custom agent
  that pins its own model can defeat a preference assignment. Warn about
  any such pin the discovery actually observes; do not assume the role's
  selection survives it.
- The reasoning set `low`, `medium`, `high`, `xhigh`, `max` is documented,
  but per-version acceptance is unconfirmed. Propose a variant only at a
  level confirmed for the target; otherwise propose no variant.
- Fresh-context behavior is unconfirmed; it does not change what configure
  proposes, but do not claim it as verified.

## What configure proposes here

Preference-file role lines in the combined
`- <role>: <provider/model[#variant]>` form (or the legacy forms), with
names from a live listing if one is actually exposed, or from the user.
State the override and enforcement limitations alongside the proposal; the
user's explicit, confirmed choice wins with the limitations stated, and the
workflow surfaces an unhonorable listed selection at dispatch.

## Verification

No binding documents a `--stats` procedure on this surface: state that the
option is unsupported rather than promising it. Establish the effective
selection only from native runtime metadata or local traces where the host
exposes them; keep an unknown effective setting unknown, and never trust a
child's self-reported model name.

This reference is selected from the actual runtime/tool surface, not from
the session's model name. A surface that is not the Codex CLI or the
official Codex VS Code extension does not use it; an unknown surface reports
a limitation instead of inventing tools.
