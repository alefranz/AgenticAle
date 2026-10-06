# Fixture 01 — Recommended tables

The canonical case: a repository `routing.md` written with the recommended
table plus role overrides, and no personal file. Active runtime is `codex`.

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
| deep | gpt-6-sol | xhigh |

### Role overrides

- review: use the deep tier.
- consult: use gpt-6-astra with high reasoning effort.
```

No `~/.agenticale/routing.md`.

## Expected effective selections (codex)

| Role | Selection | Requested model / effort | Provenance |
| --- | --- | --- | --- |
| explore | tier `fast` | gpt-6-luna / medium | role: default mapping; tier: repo routing.md |
| implement / fix | tier `routine` | gpt-6-luna / high | role: default mapping; tier: repo routing.md |
| implement-hard | tier `standard` | gpt-6.1-sol / high | role: default mapping; tier: repo routing.md |
| review | tier `deep` | gpt-6-sol / xhigh | role: repo override; tier: repo routing.md |
| deep-review | tier `deep` | gpt-6-sol / xhigh | role: default mapping; tier: repo routing.md |
| consult | direct | gpt-6-astra / high | role: repo override (direct choice) |

The repo's `fast` choice is explicit; the other three tiers are included so
the example is complete. No fallback is configured, so none is attempted.
Effective settings are unknown unless the host exposes native dispatch
metadata.
