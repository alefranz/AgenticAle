# Fixture 22 — An invalid `## Work` value is an actionable error, never defaulted or clamped

The `## Work` worker-round allowance must be a positive integer. A value
that is not one — zero, a non-integer, or a word — is an actionable error
naming the source file and the value; it is never silently defaulted to the
packaged default of eight and never clamped. The error is reported exactly
once, before any child is dispatched, and the activation does not continue
on the file's other (valid) entries. Case A is `0`, case B `2.5`, case C the
word `eight`. Active runtime is `codex`.

## Setup — case A: `worker rounds: 0` in the project file

`<repo>/.agenticale/preferences.md`:

```markdown
## codex

### Tiers

| Tier | Model | Reasoning effort |
| --- | --- | --- |
| fast | gpt-6-luna | low |

## Work

- worker rounds: 0
```

No personal preference file under either name. Recorded invocation:
`/work <task>`.

## Expected behavior — case A

- The workflow reports the invalid-value error exactly once, before any
  child is dispatched, naming the source and the value:
  `project preferences.md work.workerRounds must be an integer of at least
  1 (the Work worker-round allowance; got 0).`
- Never defaulted: the activation does not proceed as if the packaged
  default of eight applied, and the report does not claim the default was
  chosen.
- Never clamped: `0` is not raised to `1` or repaired anywhere else; the
  snapshot never carries `workerRounds: 0` or any other substituted value.
- No silent continuation: the valid `fast` tier in the same file is not
  dispatched on its own, no retry is made with a rewritten value, no
  preference file is created or modified, and no clarification question is
  asked — the error already states what a valid value is (a positive
  integer).

## Setup — case B: `worker rounds: 2.5` in the personal file

`~/.agenticale/preferences.md`:

```markdown
## codex

### Tiers

| Tier | Model | Reasoning effort |
| --- | --- | --- |
| fast | gpt-6-luna | low |

## Work

- worker rounds: 2.5
```

No `<repo>/.agenticale/` file under either name. Recorded invocation:
`/work <task>`.

## Expected behavior — case B

- The same actionable error, naming the personal file and the value:
  `personal preferences.md work.workerRounds must be an integer of at least
  1 (the Work worker-round allowance; got 2.5).` A non-integer is invalid;
  it is not rounded to `2` or `3`.
- The case A behaviors hold unchanged: reported once before dispatch, never
  defaulted to eight, and no silent continuation on the file's valid tier.

## Setup — case C: `worker rounds: eight` in the project file

The case A seed, except the `## Work` entry is
`- worker rounds: eight` — a word, not a number. Recorded invocation:
`/work <task>`.

## Expected behavior — case C

- The workflow interprets the complete file, including clear equivalent
  prose, but `eight` is not a positive integer, so the same actionable error
  is reported once before dispatch, naming the file and the value
  (`eight`), and the activation does not finalize.
- The word is never converted by guesswork (it is not turned into `8`),
  never defaulted, and never clamped: the uninterpretable value is the
  error, reported as the value the user wrote.
