# OpenCode model discovery (configure)

Dispatch rules live in [the OpenCode runtime binding](../../../work/references/runtimes/opencode.md).

## Detection

Detect from the tool surface (never the session model name): OpenCode session/agent tools (including any `opencode` MCP server), installed `agenticale/*` profiles, and `/work`, `/review`, `/autonomous` commands.

## Live model enumeration — confirmed

Two read-only listing surfaces (observed on OpenCode V2):

- The OpenCode `models` tool (e.g. `opencode` MCP server): searches by provider/name and returns `id` (`providerID/modelID`), display name, release date, reasoning `variants`, per-million-token `cost`, and `status` (`active`/`beta`/`alpha`/`deprecated`), paginated.
- `opencode models` CLI: prints `provider/model` lines.

Use whichever is exposed read-only. Enumeration shows available names/variants/costs — not verified capability or cost ranking — so label role mappings as proposals.

## What configure proposes here

Preference-file role lines do not apply to OpenCode routing (only `## Work` does). Never edit generated profiles, `opencode.jsonc`, or `default_agent` directly.

Propose a flat `--models` JSON mapping worker roles (`explore`, `implement`, `implement-easy`, `implement-hard`, `fix`, `review`, `review-deep`, `consult`, `consult-hard`) to `"provider/model[#variant]"`:

- Omitted roles inherit the session model; leave `implement-easy` and `consult-hard` unlisted unless the user opts in.
- Optional top-level `coordinator` generates the primary `agenticale/coordinator` profile and binds command entries to it; propose only if the user wants the coordinator session itself configured.
- Variants (`low`, `medium`, `high`, `xhigh`, `max`) ride on the model string; there is no separate effort field.
- The flat-config loader rejects unknown keys (retired `deep-review` is now `review-deep`), whitespace/control characters, and invalid variants.
- Bundled `--models` presets are example inventories only; configure proposals come from live listings or the user.

After confirming and writing the JSON, separately confirm and run the installer refresh:

```sh
node <AgenticAle-checkout>/scripts/install.mjs install --models <path|preset> [--target PATH]
```

Add `--replace` when generated profiles differ (backs up modified profiles instead of silently overwriting; `opencode.jsonc` and `default_agent` stay untouched). OpenCode reloads refreshed profiles without an app restart (`/reload` forces a full reload). The installer's `setup` subcommand can also scaffold a personal `preferences.md` (where only `## Work` applies on OpenCode).

## Current install evidence (read-only)

Read `.autonomous-mode-install.json` at the effective install root (read-only) if needed to report whether optional routes are currently installed; never modify it or resolve models from it.

## Verification and limitations

- `--stats` is supported: offer a small user-invoked `/work --stats` run to inspect the native per-session agent/model table (and note the post-install verification prompt).
- No per-call model override: child dispatch selects preconfigured profiles, so arbitrary task-time model requests are unsupported limitations.
- Effective selection depends on account model availability; keep unverified effective settings unknown and ignore child self-reports.
