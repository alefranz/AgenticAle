# Fixture 09 — Explicit override repairing an ambiguous lower entry

The personal layer carries an ambiguous `review` entry (as in Fixture 08),
but the higher-precedence repository layer gives a clear one. An entry wholly
superseded by a clear higher layer does not block; the clear entry applies.
Active runtime is `codex`.

## Setup

`~/.agenticale/routing.md`:

```markdown
## codex

### Role overrides

- review: use a stronger model.
```

`<repo>/.agenticale/routing.md`:

```markdown
## codex

### Role overrides

- review: use the deep tier.
```

## Expected effective selections (codex)

| Role | Selection | Requested model / effort | Provenance |
| --- | --- | --- | --- |
| explore / implement / fix | tier `fast` | openai/gpt-6-luna / max | tier: installed baseline |
| implement-hard | tier `standard` | openai/gpt-6-sol / high | tier: installed baseline |
| review | tier `deep` | openai/gpt-6-sol / xhigh | role: repo routing.md; tier: installed baseline |
| deep-review / consult | tier `deep` | openai/gpt-6-sol / xhigh | tier: installed baseline |

Expected behavior:

- The repository's clear `review` selection supersedes the personal entry for
  that role; the personal ambiguity is wholly superseded and must not block
  the review dispatch.
- The recorded provenance for `review` keeps both the role-selection source
  (repo routing.md) and the tier-definition source (installed baseline).

## Variant — invocation preference wins

Same files, invoked with an explicit per-route choice
(`/work "review: use gpt-6-astra with high effort" <task>`). Expected:
`review` resolves to the invocation's direct choice (gpt-6-astra / high,
source: invocation) and all other routes are unchanged.
