# Fixture 03 — Omitted sections

A sparse personal file that defines only one tier and omits the role-override
section entirely; the repository file is absent. Omitted entries preserve the
lower layer. Active runtime is `codex`.

## Setup

`~/.agenticale/routing.md`:

```markdown
## codex

### Tiers

| Tier | Model | Reasoning effort |
| --- | --- | --- |
| deep | gpt-6-sol | max |
```

No `<repo>/.agenticale/routing.md`.

## Expected effective selections (codex)

| Role | Selection | Requested model / effort | Provenance |
| --- | --- | --- | --- |
| explore | tier `fast` | gpt-6-luna / medium | role: default mapping; tier: installed baseline |
| implement | tier `routine` | gpt-6-luna / high | role: default mapping; tier: installed baseline |
| fix | tier `routine` | gpt-6-luna / high | role: default mapping; tier: installed baseline |
| implement-hard | tier `standard` | gpt-6.1-sol / high | role: default mapping; tier: installed baseline |
| review | tier `standard` | gpt-6.1-sol / high | role: default mapping; tier: installed baseline |
| deep-review | tier `deep` | gpt-6-sol / max | role: default mapping; tier: personal routing.md |
| consult | tier `deep` | gpt-6-sol / max | role: default mapping; tier: personal routing.md |

Expected behavior: the personal file replaces only `deep`. `fast`, `routine`,
and `standard` keep the installed baseline because the personal file omits
them. The missing role-override section adds no personal role exceptions.
Comments and omitted sections are allowed and must not be reported as errors.
