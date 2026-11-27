# Copilot VS Code Local harness compatibility binding

Compatibility binding for Copilot in VS Code Local harness (separate from `copilot.md`, which covers CLI, Agent Host, and standalone app). Detect from the tool surface (`runSubagent` with an explicit model argument and stateless calls; confirm exact native field names against the live schema), never the session model name.

## Child dispatch and model selection

Each `runSubagent` call is **stateless** and shares no cross-call context — pass the full bounded task packet on every invocation.

- **Model & effort:** pass the role's assignment from the active preference file (same file as `copilot.md`, documented in any appended "Model configuration" section); otherwise omit the model argument (session default). Effort controls are unconfirmed on this harness — propose/pass effort only if confirmed live.
- **Optional routes:** unlisted `implement-easy`/`consult-hard` fall back to `implement`/`consult`.
- **`inherit`:** omit the model argument so the child uses the session model.
- **Overrides:** explicit invocation choices stay in session and rewrite no preference file.

## Limitations and effective settings

- **Parent-model cost-tier ceiling:** the harness caps child models at a cost tier tied to the parent (coordinator) model. A cheaper coordinator may be unable to run a stronger `review`, `review-deep`, or `consult`/`consult-hard` selection; surface that limitation rather than assuming the stronger model ran.
- **Fallback & no separate profiles:** unhonorable selections can fall back to the session model without failing dispatch, so keep unverified effective settings unknown (ignore child self-reports). Do not introduce agent profile files here.
- `--stats` is not supported on this surface.
