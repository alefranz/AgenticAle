# Fixture 14 — Unselected invalid profiles and inactive-runtime profiles

One profile is garbled, one is defined only for another runtime, and one is
valid. Invalid entries in unselected profiles never block; a profile defined
only for another runtime never silently resolves to default for the active
one. Active runtime is `codex`.

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

## Profile: broken

### codex

#### Tiers

| Tier | Model | Reasoning effort |
| --- | --- | --- |
| fast | gpt-6-broken | ??? |

## Profile: other-server

### opencode

#### Tiers

| Tier | Model | Reasoning effort |
| --- | --- | --- |
| fast | openai/other-server-fast | medium |
```

No `~/.agenticale/routing.md`.

## Expected effective selections (codex, `--profile server-b`)

Recorded invocation: `/work --profile server-b <task>`. The garbled
`broken` profile is unselected and never blocks the valid selection.

| Role | Selection | Requested model / effort | Provenance |
| --- | --- | --- | --- |
| explore | tier `fast` | gpt-6-nebula / medium | role: default mapping; tier: repo routing.md (profile server-b) |
| implement / fix | tier `routine` | gpt-6-luna / high | role: default mapping; tier: repo routing.md |
| implement-hard / review | tier `standard` | gpt-6.1-sol / high | role: default mapping; tier: repo routing.md |
| deep-review / consult | tier `deep` | gpt-6.1-sol / xhigh | role: default mapping; tier: repo routing.md |

With no selector, the same default-section selections resolve (ordinary
routing) with the `repo routing.md` provenance throughout.

## Expected errors (reported before dispatch)

- `/work --profile other-server <task>`: `other-server` is defined only under
  `## opencode`, so for the active `codex` runtime it is an error — it never
  silently resolves to default:
  `Unknown routing profile 'other-server' for runtime 'codex'. Available
  profiles for this runtime: broken, server-b.`
- Selecting the garbled profile itself is also reported, with the concrete
  entry: `repo routing.md (profile broken) codex/tier 'fast' explicit route
  requires a supported reasoningEffort (got '???').`
