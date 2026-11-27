# Antigravity runtime binding

Covers the Google Antigravity desktop IDE and `agy` CLI (user plugin directory `~/.gemini/config/plugins/agenticale` or `%USERPROFILE%\.gemini\config\plugins\agenticale`). Detect from the tool surface (`invoke_subagent`), never the session model name.

## Child dispatch and model selection

Invoke fresh child subagents via `invoke_subagent`, passing the bounded task packet in the prompt.

- **Model field:** accepts **only** the fixed enum `inherit`, `flash_lite`, `flash`, or `pro` — never concrete model IDs or external provider strings.
- **Reasoning effort:** unsupported (no per-call or per-agent effort field).
- **Preference file:** when the appended "Model configuration (this installation)" section documents an active preference file, pass the role's enum value; if absent or unlisted, omit `Model` (session default). Unlisted `implement-easy`/`consult-hard` fall back to `implement`/`consult`. Any concrete non-enum model ID in a preference file or task override cannot be honored — report the limitation without silently substituting.
- **`inherit`:** pass `Model: "inherit"` explicitly to run on the active UI/CLI session model (useful for models outside the enum).
- **Overrides:** explicit invocation choices stay in session and rewrite no preference file; flat model-config effort values have no effect here.

## Limitations and effective settings

- Antigravity metadata and completion events do not expose the effective underlying model, so host substitution is undetectable; keep the effective model unconfirmed and ignore child self-reports.
- `--stats` is not supported on this surface.
