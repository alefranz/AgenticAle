# Copilot runtime binding

Covers Copilot CLI, Copilot Agent Host (VS Code), and the standalone GitHub Copilot app (for VS Code Local harness, see `copilot-local.md`). Detect from the tool surface (child dispatch with native per-call model and effort fields; confirm exact field names against the live tool schema), never the session model name.

## Child dispatch and model selection

Invoke fresh general-purpose children with native per-call model and effort fields:

- **Model & effort:** pass the role's assignment from the active preference file (when documented by an appended "Model configuration" section); otherwise omit model fields (session default). Effort levels `low`, `medium`, `high`, `xhigh`, `max` are documented (confirm per-client acceptance live).
- **Optional routes:** unlisted `implement-easy`/`consult-hard` fall back to `implement`/`consult`; unhonorable listed choices are surfaced as limitations without silent substitution.
- **`inherit`:** omit model/effort fields so the child runs on the session's model and effort.
- **Overrides:** explicit invocation choices stay in session and rewrite no preference file.

## Limitations and effective settings

- **Silent fallback:** Copilot falls back to the session model when a requested model or effort cannot be honored; a successful dispatch does not prove the request ran. Keep unknown effective models unknown unless runtime metadata/traces establish them (ignore child self-reports).
- **`modelPolicy: required`:** a tested version-specific compatibility exception only, never required or assumed by default.
- **Unconfirmed parity & effort:** CLI, Agent Host, and standalone app parity and per-version effort acceptance are unconfirmed; surface unsupported levels instead of silently substituting.
- `--stats` is not supported on this surface.
