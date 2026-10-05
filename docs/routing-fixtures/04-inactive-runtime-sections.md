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
installed baseline (the packaged copilot values: `OpenAI/gpt-6-luna|max` for
`fast` roles, `OpenAI/gpt-6-sol|high` for `standard`, `OpenAI/gpt-6-sol|xhigh`
for `deep`). Every provenance label is "installed baseline". The `codex` and
`opencode` sections are inactive and must not leak into this activation.

## Expected effective selections — active runtime `codex` (variant)

| Role | Selection | Requested model / effort | Provenance |
| --- | --- | --- | --- |
| explore / implement / fix | tier `fast` | gpt-6-luna / high | tier: repo routing.md |
| implement-hard / review | tier `standard` | openai/gpt-6-sol / high | tier: installed baseline |
| deep-review / consult | tier `deep` | openai/gpt-6-sol / xhigh | tier: installed baseline |

Only the `codex` section applies; the `opencode` section is ignored. The
`codex` section defines only `fast`, so `standard` and `deep` keep the
installed baseline.
