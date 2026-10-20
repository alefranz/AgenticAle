# Fixture 16 — Default startup short path (no preference files)

No personal and no project preference file exists, and the activation carries
no profile selector or other invocation-level preferences. The workflow must
finalize routing with the single mechanical `startup` call from the
installed skill — no manual bootstrap, no AgenticAle checkout — and stay
quiet about it. Active runtime is `opencode`.

## Setup — scenario A: packaged install

A fresh OpenCode install from the packaged defaults: the seven generated
profiles under `agents/agenticale/` carry the packaged baseline (fast
`openai/gpt-6-luna` / medium, routine `openai/gpt-6-luna` / high, standard
`openai/gpt-6.1-sol` / high, deep `openai/gpt-6.1-sol` / xhigh, with the
default role-to-tier mapping).

- No `~/.agenticale/routing.md`.
- No `<repo>/.agenticale/routing.md`.
- Recorded invocation: `/work <task>` — no selector, no task-time model
  override, no supplied Markdown file.
- The task is developing the AgenticAle repository itself, from a checkout of
  that repository.

## Expected startup — scenario A (opencode)

- The bootstrap is exactly one mechanical call from the installed skill
  (relative to the installed SKILL.md, with the established root):

  ```sh
  node scripts/routing.mjs startup --runtime opencode --root <root>
  ```

- The result is `status: "resolved"`: the strict version-1 `policy` with
  provenance from the installed baseline (no input file was involved),
  per-role `routeProvenance` (every route "installed baseline"),
  `profile: null`, and `agents` with every role `match`.
- The activation finalizes directly from this output: it stores the snapshot
  (`policy`, `routeProvenance`, `profile`, `agents`) in session state. No
  `resolve` call is made, and no temporary input file is written — one of the
  two paths that create one is not taken.
- No AgenticAle checkout is needed: even though the task develops AgenticAle
  itself, the activation uses the loaded installation's resources and never
  the repository checkout's files as routing defaults.

## Expected behavior — scenario A

- No files are created or modified: no preference file, no temporary input
  file, no configuration. Missing preference files are normal; the bootstrap
  never creates them, never asks the user to configure routing, and never
  investigates fallbacks.
- No bootstrap narration: routine routing details stay in the workflow's
  session state. The user sees the task work, not the routing internals —
  routing information would surface only to explain a selected profile, a
  material change, a limitation, or a required user action; none occurs here.
- Every available role dispatches normally on the packaged choices, with the
  `agents` entries of the `resolved` output as the OpenCode comparison.

## Setup — scenario B: custom install, still no preference files

The same situation, but the OpenCode install was built with non-packaged
model/effort choices (for example `node scripts/install.mjs --routing
<custom-policy.json>`), and the seven generated profiles were generated from
that same custom policy:

| Role | Installed route (custom baseline) |
| --- | --- |
| `explore` | openai/local-quick / medium |
| `implement`, `fix` | openai/local-coder / high |
| `implement-hard`, `review` | openai/local-coder / high |
| `deep-review`, `consult` | openai/local-coder / xhigh |

(The model names are illustrative.) No `~/.agenticale/routing.md`, no
`<repo>/.agenticale/routing.md`, recorded invocation `/work <task>`.

## Expected startup — scenario B (opencode)

- The same single mechanical `startup` call returns `status: "resolved"`, and
  the `policy` carries exactly the install-time choices above: the installed
  baseline IS the customization.
- Nothing is re-derived from the packaged defaults: no packaged model (for
  example `openai/gpt-6-luna`) enters any route; every `routeProvenance`
  entry is the installed baseline.

## Expected behavior — scenario B

- `agents` has every role `match` (the profiles were generated from the same
  policy at install time), all roles dispatch normally on the custom choices,
  and the activation stays quiet with no files created — the default short
  path is the same for a custom install as for a packaged one.

Effective settings are unknown unless the host exposes native dispatch
metadata.
