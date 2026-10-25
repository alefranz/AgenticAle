# Fixture 21 — Precedence: project beats personal for entries and for the `## Work` allowance

The preference-file precedence (installed baseline < personal < project)
applies both to the routing entries and to the top-level `## Work`
worker-round allowance: a value present in the project file overrides the
same entry in the personal file, and an omitted entry retains the
lower-precedence value. An explicit task-time instruction at invocation is
the layer above all files. Case A is both files present with a conflicting
`fast` tier and conflicting allowances; case B is the same seed with the
project file omitting the allowance; case C adds the task-time instruction.
Active runtime is `codex`.

## Setup — case A: conflicting `fast` tiers; personal `worker rounds: 12`, project `worker rounds: 5`

`~/.agenticale/preferences.md`:

```markdown
## codex

### Tiers

| Tier | Model | Reasoning effort |
| --- | --- | --- |
| fast | gpt-6-luna | low |

## Work

- worker rounds: 12
```

`<repo>/.agenticale/preferences.md` (conflicts on the same `fast` tier):

```markdown
## codex

### Tiers

| Tier | Model | Reasoning effort |
| --- | --- | --- |
| fast | gpt-6-mars | high |

### Role overrides

- review: use the deep tier.

## Work

- worker rounds: 5
```

Recorded invocation: `/work <task>` (no selector, no task-time instruction).

## Expected effective selections — case A (codex)

| Role | Selection | Requested model / effort | Provenance |
| --- | --- | --- | --- |
| explore | tier `fast` | gpt-6-mars / high | role: default mapping; tier: repo preferences.md |
| implement / fix | tier `routine` | gpt-6-luna / high | role: default mapping; tier: installed baseline |
| implement-hard | tier `standard` | gpt-6.1-sol / high | role: default mapping; tier: installed baseline |
| review | tier `deep` | gpt-6.1-sol / xhigh | role: repo preferences.md; tier: installed baseline |
| deep-review / consult | tier `deep` | gpt-6.1-sol / xhigh | role: default mapping; tier: installed baseline |

## Expected behavior — case A

- Project beats personal for the conflicting routing entry exactly as it does
  for the allowance: both files define the `fast` tier, and the project's
  choice (`gpt-6-mars` / high, source `repo preferences.md`) resolves for
  `explore` — the personal file's `gpt-6-luna` / low is not selected, not
  merged, not averaged, and not reported as a tie.
- Project beats personal for the `## Work` allowance in the same way: the
  snapshot records
  `work: { "workerRounds": 5, "source": "project preferences.md" }` — five
  worker rounds are available to this Work task, and the personal value of
  twelve is not used, not averaged, and not reported as a tie.
- The override changes only what is available: five rounds are available,
  not required — how many rounds must run, the consultation allowance, the
  per-slice fix/review caps, the progress safeguards, scope, and permissions
  are unchanged, and Autonomous Mode keeps its own budget.

## Setup — case B: the same seed, with the project file omitting `## Work`

The case A seed, except the project file has no `## Work` section (its
conflicting `fast` tier and `review` override are unchanged). Recorded
invocation: `/work <task>` (no selector, no task-time instruction).

## Expected behavior — case B

- An omitted entry retains the lower-precedence value: the project file never
  defines an allowance, so the personal allowance is retained — the snapshot
  records
  `work: { "workerRounds": 12, "source": "personal preferences.md" }` —
  twelve worker rounds are available, and the packaged default of eight never
  applies.
- The routing selections are exactly case A's: the project `fast` tier
  (`gpt-6-mars` / high, source `repo preferences.md`) still resolves for
  `explore`, the project `review` override still applies, and the rest stay
  on the installed baseline — the project file wins the tier conflict whether
  or not it carries a `## Work` section.

## Setup — case C: the case A seed, plus an explicit task-time instruction at invocation

The case A seed, unchanged. Recorded invocation: `/work <task>` with an
explicit instruction in the task text (coordinator-level, not part of the
resolver): "allow twenty worker rounds for this task".

## Expected behavior — case C

- The task-time instruction outranks all files: the effective allowance is
  twenty worker rounds, recorded as
  `work: { "workerRounds": 20, "source": "task-time instruction" }`; the
  project value of five and the personal value of twelve never apply.
- Precedence, lowest to highest, is the packaged default (eight, installed
  baseline), the personal file, the project file, and the explicit task-time
  instruction; each present layer overrides the ones below it, and an
  omitted value retains the lower-precedence one (case B shows the omitted
  project allowance retaining the personal one).
- The instruction changes only the allowance: the routing selections are
  exactly case A's (the project `fast` tier, the project `review` override,
  the rest on the installed baseline) with the same provenance labels.

Effective settings are unknown unless the host exposes native dispatch
metadata.
