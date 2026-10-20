# Fixture 11 — Profile selection

A repository `routing.md` with a default `## codex` section and one partial
named profile (`## Profile: server-b`, changing only `fast` and `routine`).
No personal file. Active runtime is `codex`.

## Setup

Project root `.agenticale/routing.md`:

```markdown
# AgenticAle model routing

## codex

### Tiers

| Tier | Model | Reasoning effort |
| --- | --- | --- |
| fast | gpt-6-luna | medium |
| routine | gpt-6-luna | high |
| standard | gpt-6.1-sol | high |
| deep | gpt-6.1-sol | xhigh |

## Profile: server-b

### codex

#### Tiers

| Tier | Model | Reasoning effort |
| --- | --- | --- |
| fast | gpt-6-nebula | medium |
| routine | gpt-6-nebula | high |
```

No `~/.agenticale/routing.md`.

## Expected effective selections (codex, `--profile server-b`)

Recorded invocation: `/work --profile server-b <task>`.

| Role | Selection | Requested model / effort | Provenance |
| --- | --- | --- | --- |
| explore | tier `fast` | gpt-6-nebula / medium | role: default mapping; tier: repo routing.md (profile server-b) |
| implement / fix | tier `routine` | gpt-6-nebula / high | role: default mapping; tier: repo routing.md (profile server-b) |
| implement-hard | tier `standard` | gpt-6.1-sol / high | role: default mapping; tier: repo routing.md |
| review | tier `standard` | gpt-6.1-sol / high | role: default mapping; tier: repo routing.md |
| deep-review / consult | tier `deep` | gpt-6.1-sol / xhigh | role: default mapping; tier: repo routing.md |

The profile changes only the `fast`/`routine`-mapped roles (explore,
implement, fix); `implement-hard`, `review`, `deep-review`, and `consult`
keep their default-section selections. No fallback is configured, so none is
attempted. Effective settings are unknown unless the host exposes native
dispatch metadata.

## Expected effective selections (codex, ordinary routing)

No selector and `--profile default` give identical ordinary routing — `fast`,
`routine`, `standard`, and `deep` all resolve from the repo's default section
(the values above without the `(profile server-b)` provenance).

## Expected errors (reported before dispatch)

- `/work --profile nope <task>`: the unknown profile is an actionable error
  listing the available names: `Unknown routing profile 'nope' for runtime
  'codex'. Available profiles for this runtime: server-b.`
- A trailing `--profile` (missing name) is reported before dispatch, listing
  the profile names available for the active runtime.
- Two different profile names in one invocation are reported before dispatch
  as conflicting; neither is silently chosen.
