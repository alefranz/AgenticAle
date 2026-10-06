# Fixture 04 — Inactive runtime sections

A multi-runtime file whose `codex` and `opencode` sections exist but whose
active runtime is `copilot`: only the active runtime's preferences apply, and
the other sections are ignored for this activation. Active runtime: `copilot`
(first case), then `codex` (variant).

## Setup

Project root `.agenticale/routing.md`:

```markdown
# AgenticAle model routing

## codex

### Tiers

| Tier | Model | Reasoning effort |
| --- | --- | --- |
| fast | gpt-6-luna | high |

## opencode

### Tiers

| Tier | Model | Reasoning effort |
| --- | --- | --- |
| deep | opencode/gpt-6-astra | xhigh |
```

No `~/.agenticale/routing.md`.

## Expected effective selections — active runtime `copilot`

No `copilot` section exists in the file, so every route resolves from the
installed baseline (the packaged Copilot values: `gpt-6-luna|medium` for
exploration, `gpt-6-luna|high` for routine implementation and fixes,
`gpt-6.1-sol|high` for `standard`, and `gpt-6.1-sol|xhigh` for `deep`). Every
provenance label is "installed baseline". The `codex` and
`opencode` sections are inactive and must not leak into this activation.

## Expected effective selections — active runtime `codex` (variant)

| Role | Selection | Requested model / effort | Provenance |
| --- | --- | --- | --- |
| explore | tier `fast` | gpt-6-luna / high | tier: repo routing.md |
| implement / fix | tier `routine` | gpt-6-luna / high | tier: installed baseline |
| implement-hard / review | tier `standard` | gpt-6.1-sol / high | tier: installed baseline |
| deep-review / consult | tier `deep` | gpt-6.1-sol / xhigh | tier: installed baseline |

Only the `codex` section applies; the `opencode` section is ignored. The
`codex` section defines only `fast`, so `routine`, `standard`, and `deep` keep
the installed baseline.
