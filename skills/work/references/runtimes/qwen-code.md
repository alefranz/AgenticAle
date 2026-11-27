# Qwen Code runtime binding

## Invocation surface and child dispatch

Qwen Code natively exposes each skill's `slash` field (`/work`, `/review`, `/autonomous`, `/configure`); no separate command files are shipped. Qwen Code has no session-primary agent switch, so the workflow runs in the caller session.

Qwen Code 0.28.6's Agent tool has no per-call model parameter by default (`model` only selects `agents.modelGrades` for unpinned direct agents). Child models (and Codex effort) are baked into flat `.qwen/agents/agenticale-<role>.md` (or `~/.qwen/agents/`) files at install time, dispatched via `subagent_type: "agenticale-<role>"`:

- Base roles (always installed): `explore`, `implement`, `implement-hard`, `fix`, `review`, `review-deep`, `consult`.
- Optional roles (installed only when configured): `implement-easy`, `consult-hard`.
- Optional session coordinator (not a child role): `agenticale-coordinator` (Qwen-direct only; `openai/` coordinator values are skipped by build and rejected by installer).

## Materialization forms

- **Direct provider models:** renders a bare model ID on `model:` (provider prefix stripped; host resolves against `settings.json` `modelProviders`), plus `maxTurns` and `disallowedTools`. `#effort` has no direct-form rendering. Unlisted roles / `--no-model` omit `model:` to inherit the session model.
- **Codex external executor (`openai/`):** renders `name`, `description`, `background: false`, and `executor:` (`codex app-server --stdio` with `-c` TOML overrides for bare model and `#effort`). `model`, `maxTurns`, `tools`, and `disallowedTools` are omitted because Qwen rejects them on external agents. Requires non-safe, non-container session mode plus folder trust in both Qwen Code and Codex CLI (if unmet, report unavailable without substituting).

## Establishing configured-route intent & coordinator adoption

Establish optional-route intent read-only once at activation from `<root>/.autonomous-mode-install.json` at the effective agent root (project `.qwen/` or `~/.qwen/`; never borrow across roots or resolve models from it). A valid `qwen-code-autonomous-mode` manifest is required:

- Entry present (`agents/agenticale-implement-easy.md` or `consult-hard.md`) → configured (missing/unreadable blocks only that role).
- Entry absent in valid current state → omitted (base-route fallback applies even with a leftover file; leftover never dispatches).
- Absent/invalid/ambiguous or foreign-package manifest → intent unestablished; fail conservatively without dispatching the optional route or claiming omission fallback.

**Coordinator adoption:** when `agents/agenticale-coordinator.md` is owned in a valid `qwen-code-autonomous-mode` manifest, read it read-only once at activation and adopt its posture body for the caller session (never dispatch it as a child or edit `settings.json`; users change session models via `/model <id>`).

## Refresh, effective settings, and limitations

Re-run from an AgenticAle checkout against the effective root (`.qwen/` or `~/.qwen/`, defaulting to `~/.qwen/`):

```sh
node <AgenticAle-checkout>/scripts/install.mjs qwen-install --models <path|preset> --target <install root>
```

Use `--no-model` to inherit session model, `--replace` to back up and update differing owned files (leaves unowned manual files untouched and retires removed owned files). Sessions read `agents/` at startup (no hot reload).

- **Silent fallback:** mistyped/unresolvable direct `model:` IDs fall back silently to the session model (Qwen Code 0.28.6); keep unverified effective selections unknown (ignore child self-reports). For Codex executor children, host metadata records only `external-codex:codex`, so the pinned Codex model stays requested-only.
- **One-shot Codex & permissions:** Codex executor tasks cannot resume/receive follow-ups, and external agents carry no `disallowedTools` (they inherit session approval mode: default/plan is read-only; auto-edit/yolo grants write access even to read-only roles).
- **`--stats` unsupported:** state unsupported on this surface and omit the stats block.
- **No mid-task config edits or arbitrary task-time model overrides.**
