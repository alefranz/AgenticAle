# Fixture 13 — Profile versus direct role exceptions

A profile that changes all four codex tiers while the default section carries
a direct role exception for `review`. Changing all four tiers does not clear
the exception; an explicit `- review: default.` inside the profile does.
Active runtime is `codex`.

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

### Role overrides

- review: use gpt-6-astra with high reasoning effort.

## Profile: server-b

### codex

#### Tiers

| Tier | Model | Reasoning effort |
| --- | --- | --- |
| fast | gpt-6-nebula | medium |
| routine | gpt-6-nebula | high |
| standard | gpt-6-nebula-ultra | high |
| deep | gpt-6-nebula-ultra | xhigh |
```

No `~/.agenticale/routing.md`.

## Expected effective selections (codex, `--profile server-b`)

Recorded invocation: `/work --profile server-b <task>`.

| Role | Selection | Requested model / effort | Provenance |
| --- | --- | --- | --- |
| explore | tier `fast` | gpt-6-nebula / medium | role: default mapping; tier: repo routing.md (profile server-b) |
| implement / fix | tier `routine` | gpt-6-nebula / high | role: default mapping; tier: repo routing.md (profile server-b) |
| implement-hard | tier `standard` | gpt-6-nebula-ultra / high | role: default mapping; tier: repo routing.md (profile server-b) |
| review | direct | gpt-6-astra / high | role: repo override (direct choice) |
| deep-review / consult | tier `deep` | gpt-6-nebula-ultra / xhigh | role: default mapping; tier: repo routing.md (profile server-b) |

The profile redefines all four tiers, but the direct `review` exception
survives: `review` stays on gpt-6-astra / high from the default section's
role override. Tier changes alone never clear a direct role exception.
Effective settings are unknown unless the host exposes native dispatch
metadata.

## Explicit clear (same file, profile extended)

Extend the same profile's role overrides with the explicit reset:

```markdown
## Profile: server-b

### codex

#### Tiers

| Tier | Model | Reasoning effort |
| --- | --- | --- |
| fast | gpt-6-nebula | medium |
| routine | gpt-6-nebula | high |
| standard | gpt-6-nebula-ultra | high |
| deep | gpt-6-nebula-ultra | xhigh |

#### Role overrides

- review: default.
```

With `--profile server-b`, the exception is cleared and `review` returns to
the profile's `standard` tier:

| Role | Selection | Requested model / effort | Provenance |
| --- | --- | --- | --- |
| review | tier `standard` | gpt-6-nebula-ultra / high | role: default mapping; tier: repo routing.md (profile server-b) |

All other roles keep the selections from the first table.
