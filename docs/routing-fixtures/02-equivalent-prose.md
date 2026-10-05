# Fixture 02 — Equivalent prose

The same effective selections as Fixture 01, expressed in prose instead of
the recommended table. Clear prose must be interpreted to the same bounded
preferences; no parser or exact heading shape is required. Active runtime is
`codex`.

## Setup

Project root `.agenticale/routing.md`:

```markdown
# AgenticAle model routing

## codex

For tiers, I want fast work on gpt-6-luna with high reasoning effort,
standard work on gpt-6-sol with high effort, and deep work on gpt-6-sol with
xhigh effort.

For individual roles, review should use the deep tier rather than the
standard one, and consult should use gpt-6-astra with high reasoning effort.
```

No `~/.agenticale/routing.md`.

## Expected effective selections (codex)

Identical to Fixture 01:

| Role | Selection | Requested model / effort | Provenance |
| --- | --- | --- | --- |
| explore | tier `fast` | gpt-6-luna / high | role: default mapping; tier: repo routing.md |
| implement | tier `fast` | gpt-6-luna / high | role: default mapping; tier: repo routing.md |
| fix | tier `fast` | gpt-6-luna / high | role: default mapping; tier: repo routing.md |
| implement-hard | tier `standard` | gpt-6-sol / high | role: default mapping; tier: repo routing.md |
| review | tier `deep` | gpt-6-sol / xhigh | role: repo override; tier: repo routing.md |
| deep-review | tier `deep` | gpt-6-sol / xhigh | role: default mapping; tier: repo routing.md |
| consult | direct | gpt-6-astra / high | role: repo override (direct choice) |

The recorded summary must carry the same selections and the same source
labels as the table form; prose form must not change any effective choice.
