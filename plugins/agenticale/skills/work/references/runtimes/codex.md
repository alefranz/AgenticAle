# Codex runtime binding

Covers the Codex CLI and the official Codex VS Code extension (installed via standalone `.agents/skills`, since the extension does not support plugins). Detect from the tool surface (child spawn with native per-spawn model and reasoning fields), never the session model name. Do not equate the official Codex extension with the experimental Codex integration in VS Code Agent Host.

## Child dispatch and model selection

Spawn fresh children with native per-spawn model and reasoning fields (confirm exact property names against the live spawn tool schema):

- **Model & effort:** pass the role's assignment from the active preference file (when documented by an appended "Model configuration" section); otherwise omit model fields (session default). Supported effort set is documented as `low`, `medium`, `high`, `xhigh`, `max` (confirm accepted levels per version live).
- **Optional routes:** unlisted `implement-easy`/`consult-hard` fall back to `implement`/`consult`; unhonorable listed choices are surfaced as limitations without silent substitution.
- **`inherit`:** omit the model/reasoning field so the child uses the session's current model and effort.
- **Overrides:** explicit invocation choices stay in session and rewrite no preference file.

## Limitations and effective settings

- **Custom agent pins:** project custom agent files pinning their own model/reasoning can override spawn choices; do not assume preference selections survive them.
- **Unconfirmed live behaviors:** per-call model override vs. configured profile enforcement, genuine fresh-context isolation, CLI/extension parity, and per-version reasoning levels are unconfirmed live — do not promise strict enforcement until verified.
- **Effective model & `--stats`:** keep unverified effective settings unknown (ignore child self-reports). `--stats` is not supported on this surface.
