# Fixture 08 — Ambiguity

A qualitative preference that names no resolvable selection. The ambiguity in
the final effective selection blocks only the affected dispatch; unrelated
clear selections proceed, and no model identifier is invented. Active runtime
is `codex`.

## Setup

`~/.agenticale/routing.md`:

```markdown
## codex

### Role overrides

- review: use a stronger model.
```

No `<repo>/.agenticale/routing.md`. No per-route invocation choices.

## Expected behavior

- `review`'s final effective selection is ambiguous: "a stronger model" is a
  qualitative preference with no referenced selection that is clear from the
  file or the invocation. The affected dispatch (review) is blocked, with the
  ambiguity surfaced and its source labeled (personal routing.md).
- No model identifier is invented to satisfy the preference.
- All unrelated clear selections are preserved and may proceed:

| Role | Selection | Requested model / effort | Provenance |
| --- | --- | --- | --- |
| explore / implement / fix | tier `fast` | openai/gpt-6-luna / max | tier: installed baseline |
| implement-hard | tier `standard` | openai/gpt-6-sol / high | tier: installed baseline |
| deep-review / consult | tier `deep` | openai/gpt-6-sol / xhigh | tier: installed baseline |

- The report states what the user must clarify (a concrete model/effort pair
  or a named tier for `review`), and the rest of the activation is not held
  hostage by the one unresolved entry.
