# OpenCode V2 runtime binding

## Invocation surface

The installer ships four OpenCode command entries (`commands/work.md`, `review.md`, `autonomous.md`, `configure.md`), each loading its skill by exact ID and passing `$ARGUMENTS` (OpenCode does not interpret `slash`). When a `coordinator` model is configured, workflow commands bind `agent: agenticale/coordinator` (`subagent: false`) to run in the caller session on that model; `configure` sets `bindCoordinator: false` and stays a plain caller-session launcher. The installer never modifies `default_agent` or `opencode.jsonc`.

## Child dispatch and role profiles

OpenCode's subagent tool selects a preconfigured profile rather than accepting a per-call model override; role models and variants (`provider/model[#variant]`) are baked into generated profiles at install time.

| Role | OpenCode profile ID | Notes |
| --- | --- | --- |
| `explore`, `fix`, `review`, `review-deep` | `agenticale/<role>` | Always generated |
| `implement`, `implement-hard` | `agenticale/implement`, `agenticale/implement-hard` | Share `implement` contract |
| `consult` | `agenticale/consult` | Always generated |
| `implement-easy`, `consult-hard` | `agenticale/implement-easy`, `agenticale/consult-hard` | Optional; rendered only when configured |
| `coordinator` (session only) | `agenticale/coordinator` | Primary session agent when configured; never a child |

Unlisted `implement-easy` and `consult-hard` fall back to `implement` and `consult` per the routing policy. Configured roles with missing/unreadable profiles block only that role (report with the refresh procedure below; never substitute).

## Establishing configured-route intent from install evidence

Available profile files alone cannot distinguish an omitted optional route from a deleted configured one, or from a `preserve-modified` leftover kept during an omitting reinstall. Establish configured-route intent from the installer's ownership manifest (`.autonomous-mode-install.json`) at the effective install root:

- **Effective install root:** anchored install-relative to `<root>/skills/work/references/runtimes/opencode.md` (`<root>/.autonomous-mode-install.json` and `<root>/agents/agenticale/`). Project `.opencode/agents/` takes precedence over global (`$XDG_CONFIG_HOME/opencode` or `~/.config/opencode`). Never borrow a manifest from another root; if another scope defines `agenticale/*` or the effective root lacks a matching manifest, intent is unestablished.
- **Read-only, once at activation:** inspect the manifest only when a needed optional route must be checked, whether its profile is missing, unreadable, or present; keep the result fixed for the activation and never write the manifest or resolve models from it.
- **Entry presence in `entries`:**
  - `agents/agenticale/implement-easy.md` or `agents/agenticale/consult-hard.md` present → configured (a missing/unreadable profile blocks that role; never substitute the base route).
  - Entry absent from a valid current (schema 7) state (or legacy schemas 1–6) → omitted, so base-route fallback applies even when a preserved leftover profile file still exists — the leftover is never dispatched and never automatically assigned.
  - Manifest absent, invalid JSON, failing validation, or ambiguous ownership → intent unestablished: fail conservatively (do not dispatch the optional route even if present, and do not claim omission fallback; unrelated base roles continue normally).

## Refresh procedure and overrides

Re-run the checkout installer (`https://github.com/alefranz/AgenticAle`):

```sh
node <AgenticAle-checkout>/scripts/install.mjs install --models <path|preset> [--target PATH]
```

Use `--no-model` for session-model inheritance (`inherit` profiles omit forced models), and `--replace` to back up and update modified owned profiles (`--replace` never deletes unowned leftovers). OpenCode watches config files and reloads without restart (`/reload` forces a full reload). Arbitrary task-time model overrides and `--profile` are unsupported here; never edit global config mid-task.

## Requested vs. effective settings and `--stats`

Profile frontmatter carries the requested model/variant; establish effective selections only from native host session/assistant metadata or traces (keep unknown unknown; ignore child self-reports).

`--stats` is supported via `OPENCODE_SESSION_ID`: run read-only `node scripts/session-stats.mjs` from the installed `skills/work` directory before the delivery report and embed its output verbatim under `work`'s `## Finish` contract (if the server is unreachable, note that and continue).

## Limitations

- No per-call model override; unconfigured arbitrary task-time models are reported as limitations.
- Packaged Markdown files must stay under OpenCode's 50 KiB (51,200 B) truncation band (45 KiB authored budget enforced by `scripts/validate.mjs`).
