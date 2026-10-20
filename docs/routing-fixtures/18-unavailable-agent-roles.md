# Fixture 18 — Unavailable agent roles on OpenCode

An unavailable role in the installed OpenCode default set blocks only its own
dispatch, with the exact preparation steps reported when that role is actually
needed — and an invocation-level override must be compared against the final
resolved snapshot, not against the baseline `agents` entries the `resolved`
startup output carried. Active runtime is `opencode`.

## Setup — scenario A: one profile missing, one stale, the rest match

No `~/.agenticale/routing.md`, no `<repo>/.agenticale/routing.md`. The
installed default set under `agents/agenticale/` was built from the packaged
baseline but has drifted for two roles:

| Installed profile | Installed model / effort | Compared to the resolved route |
| --- | --- | --- |
| `explore.md` | openai/gpt-6-luna / medium | matches |
| `implement.md`, `fix.md` | openai/gpt-6-luna / high | matches |
| `implement-hard.md`, `review.md` | openai/gpt-6.1-sol / high | matches |
| `deep-review.md` | openai/gpt-6.1-sol / medium | stale (effort differs: medium vs xhigh) |
| `consult.md` | — | missing (no file) |

Recorded invocation: `/work <task>`; the task's rounds use `explore`,
`implement`, `fix`, and `review` only — `deep-review` and `consult` are not
needed.

## Expected startup — scenario A (opencode)

- One mechanical `startup` call returns `status: "resolved"`; its `agents`
  entries report `missing` for `consult`, `mismatch` for `deep-review` (with
  the expected and installed values), and `match` for the other five roles.
- The activation finalizes directly from this output and stores the snapshot
  in session state.

## Expected coordinator behavior — scenario A

- The task proceeds normally and quietly: the rounds that dispatch only
  available roles (`explore`, `implement`, `fix`, `review`) are not blocked
  and not narrated — an unused unavailable role never blocks unrelated work,
  and its unavailability is not announced preemptively.
- When a `consult` or `deep-review` round is actually needed (for example the
  user asks for a second opinion or the combined work warrants a deep
  review), that role's dispatch is blocked — reported with the binding's
  exact preparation and refresh procedure (resolve the routes, write the
  plain strict version-1 export to a preparation path, refresh through the
  checkout-based installer, start a new session, and re-check before
  dispatch) — and is never silently served by another profile (the `review`
  or `implement-hard` profile is not a substitute for `consult`).

## Setup — scenario B: an invocation-level override, no discovered files

No `~/.agenticale/routing.md`, no `<repo>/.agenticale/routing.md`. The
installed default set matches the packaged baseline for all seven roles. The
task carries a direct invocation-level override for one role:

Recorded invocation: `/work Use openai/gpt-6-nebula at high effort for the
review role, and add the export filter <rest of the task>` — a direct
task-time override for `review`; no other invocation preferences.

## Expected startup — scenario B (opencode)

- `startup` (no discovered files) returns `status: "resolved"` with `agents`
  entries for the installed baseline routes — including `review: match`,
  because the installed profile carries the baseline `review` route.
- But `startup` accepts no invocation layers, so none of its results is
  final: the workflow interprets the invocation override into a structured
  layer, writes it to a temporary file, and resolves
  `resolve --input <layers-file> --explain`. That `--explain` output is the
  snapshot, in which `review` is openai/gpt-6-nebula / high and the other
  routes are the installed-baseline routes.

## Expected coordinator behavior — scenario B

- The OpenCode comparison runs in context against the FINAL resolved
  snapshot: the workflow reads the `model:` and `reasoningEffort:`
  frontmatter of the applicable installed profiles and applies the same match
  rules. It does NOT use the baseline `agents` entries the `resolved`
  startup output carried — those compare the superseded baseline routes, and
  trusting them would dispatch `review` on the installed baseline profile
  even though the override chose a different one.
- `review`: the installed `agents/agenticale/review.md` carries
  openai/gpt-6.1-sol / high, which mismatches the final snapshot's
  openai/gpt-6-nebula / high — the `review` dispatch is blocked, reported
  with the binding's exact preparation and refresh procedure, and never
  silently dispatched on the superseded baseline profile.
- The other roles' final routes equal the baseline routes, their installed
  profiles match, and they dispatch normally; only the overridden role is
  blocked.

## Setup — scenario C: a profile defined by the invocation Markdown itself

No `~/.agenticale/routing.md`, no `<repo>/.agenticale/routing.md`. The
installed default set matches the packaged baseline for all seven roles. The
invocation explicitly supplies an invocation Markdown file whose only
`## Profile:` section defines `server-b`, and selects that profile:

Recorded invocation: `/work <task>` with the invocation Markdown file
`invocation-routing.md` explicitly supplied for the task (contents below) and
`server-b` selected as the routing profile; no other invocation preferences.

```markdown
# AgenticAle model routing

## Profile: server-b

### opencode

#### Tiers

| Tier | Model | Reasoning effort |
| --- | --- | --- |
| fast | server-b/small-coder | medium |
| routine | server-b/main-coder | high |
```

## Expected startup — scenario C (opencode)

- `startup --runtime opencode --root <root> --profile server-b` (no
  discovered files) exits non-zero with the unknown-profile error: the
  invocation Markdown is not a discovered preference file, so it defines
  nothing for the probe. That result is provisional and is NOT reported —
  on the invocation-preference path `startup` serves only as the
  file-existence probe, its policy and its profile check are not final, and
  `--profile` need not have been passed to it at all.
- The activation does not stop on it: the workflow proceeds to interpret the
  supplied invocation Markdown and does not report the premature error.

## Expected coordinator behavior — scenario C

- The invocation Markdown is interpreted as the invocation layer (highest
  precedence; no discovered files here) into the ordered structured layers,
  its `## Profile: server-b` section under the layer's `profiles` map, and
  they are written to a temporary file — one of the two paths that create
  one.
- The final `resolve --input <layers-file> --profile server-b --explain`
  succeeds: a profile defined by the invocation Markdown itself is valid,
  and profile availability is validated only by this final resolution. Its
  `--explain` output is the snapshot — `profile: "server-b"`, `fast` at
  server-b/small-coder / medium and `routine` at server-b/main-coder / high
  with provenance `invocation (profile server-b)`, `standard` and `deep` at
  the installed baseline routes.
- The OpenCode comparison runs in context against the final snapshot, and
  the named-set selection rule of the binding applies to the selected
  profile: dispatching a role requires its prepared named-set profile
  `agents/agenticale/routing/server-b/<role>.md` matching the resolved
  selection. Missing or stale named-set files block only the affected
  role's dispatch, reported with the binding's exact preparation and refresh
  procedure (an explicit, user-approved manual action — selecting the
  profile never invokes or changes the installer), and a default-set
  profile is never a substitute for a named one.
- If the profile were not defined by the invocation file either (no
  `## Profile:` section in it, or a selected name no layer defines), the
  final resolver's actionable error — unknown profile `server-b` for runtime
  `opencode`, the available names listed (here: none defined) and the
  suggestion to add a `## Profile: server-b` section to a routing.md
  preference file or omit the profile selector — is the one that gets
  reported; the startup probe's provisional unknown-profile result is not
  reported in its place.

Effective settings are unknown unless the host exposes native dispatch
metadata.
