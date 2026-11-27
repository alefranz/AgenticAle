# Qwen Code model discovery (configure)

Dispatch rules live in [the Qwen Code runtime binding](../../../work/references/runtimes/qwen-code.md).

## Detection

Detect from the tool surface (never the session model name): Qwen Code's Agent tool (no per-call model parameter), flat `agenticale-*` files under the install root's `agents/` directory, and `/work`, `/review`, `/autonomous`, `/configure` commands.

## Live model evidence

Qwen Code exposes no read-only model-enumeration tool. Read the effective `settings.json` `modelProviders` registry and session default read-only as a **candidate source of names, not a resolution guarantee** (merged scopes can hold duplicate bare IDs, and resolution tries the session's auth type first; unresolvable IDs silently inherit the session model).

`openai/*` values route to the installed Codex CLI catalog via the executor rather than `settings.json`, so their names come from the Codex side or the user.

## What configure proposes here

Preference-file role lines do not apply to Qwen Code routing (only `## Work` does). Never edit installed agent files, `settings.json`, or the model registry directly.

Propose a flat `--models` JSON mapping worker roles to `"provider/model[#effort]"`:

- Omitted roles inherit the session model; leave `implement-easy` and `consult-hard` unlisted unless the user opts in.
- Supported provider families: local llama OpenAI-compatible endpoints, Qwen Code / Alibaba token-plan models registered in `settings.json` (rendered as bare model IDs, which must exist in `settings.json` to avoid silent inheritance), and `openai/` for Codex-routed values (rendered via the pinned codex executor).
- Optional top-level `coordinator` generates `agenticale-coordinator`; it must be Qwen-direct (`openai/` coordinator values are skipped/rejected).
- `#effort` passes through only for `openai/` values; direct values render the model ID only.
- The flat-config loader rejects unknown keys (`review-deep`, not `deep-review`), whitespace/control characters, quotes/backslashes, invalid effort levels, and YAML-coercible bare IDs (numbers, booleans, `null`).
- Bundled `--models` presets are example inventories only; configure proposals come from `settings.json`, Codex, or the user.

After confirming and writing the JSON, separately confirm and run the installer refresh against the effective install root (`.qwen/` or `~/.qwen/`, defaulting to `~/.qwen/`):

```sh
node <AgenticAle-checkout>/scripts/install.mjs qwen-install --models <path|preset> --target <install root>
```

`settings.json` stays untouched. Use `--replace` to back up and update differing owned files (manually copied leftovers are unowned and untouched; retired owned unmodified files are removed). A session reads `agents/` at startup — do not promise hot reload in a running session.

## Current install evidence (read-only)

Read `.autonomous-mode-install.json` at the effective install root (read-only) if needed to report installed optional-route intent (never edit it or resolve models from it; manual copies have no manifest).

## Verification and limitations

- `--stats` is **not** supported here; state that explicitly. Offer a small user-invoked `/work` run and inspect native session metadata (`provider/model` for direct dispatches). For codex-executor children, Qwen logs only `external-codex:codex`, so the pinned Codex model stays requested-only.
- No per-call model override via the Agent tool.
- Unresolvable direct IDs silently fall back to the session model; verify IDs against `settings.json` before writing.
- Codex-routed children are one-shot tasks whose edit/read-only behavior follows the session approval mode.
