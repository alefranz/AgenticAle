# Fixture 20 — Both filenames at one scope: `preferences.md` effective, `routing.md` ignored

When both `preferences.md` and `routing.md` exist at the same scope,
`preferences.md` is the effective file and `routing.md` is ignored — never
merged — and the workflow identifies the ignored file in its report.
Conflicting entries in the ignored file must not influence the snapshot.
Case A: both at project scope; case B: both at personal scope, including a
conflicting `## Work` value in the ignored file; case C: the ignored file is
unreadable, which is not an error. Active runtime is `codex`.

## Setup — case A: both files at project scope

`<repo>/.agenticale/preferences.md`:

```markdown
## codex

### Tiers

| Tier | Model | Reasoning effort |
| --- | --- | --- |
| fast | gpt-6-luna | low |
```

`<repo>/.agenticale/routing.md` (conflicts on the same tier):

```markdown
## codex

### Tiers

| Tier | Model | Reasoning effort |
| --- | --- | --- |
| fast | gpt-6-comet | max |
```

No personal preference file under either name. Recorded invocation:
`/work <task>`.

## Expected effective selections — case A (codex)

| Role | Selection | Requested model / effort | Provenance |
| --- | --- | --- | --- |
| explore | tier `fast` | gpt-6-luna / low | role: default mapping; tier: repo preferences.md |
| implement / fix | tier `routine` | gpt-6-luna / high | role: default mapping; tier: installed baseline |
| implement-hard / review | tier `standard` | gpt-6.1-sol / high | role: default mapping; tier: installed baseline |
| deep-review / consult | tier `deep` | gpt-6.1-sol / xhigh | role: default mapping; tier: installed baseline |

## Expected behavior — case A

- The effective file at the project scope is `preferences.md`: its `fast`
  choice (`gpt-6-luna` / low) is the one that resolves, and no selection,
  tier definition, or provenance label in the snapshot carries the ignored
  file's `gpt-6-comet` / max choice — the ignored file's entries are never
  merged in, even though they name the same tier.
- The ignored file is identified, not silently dropped: the startup probe's
  project-location record carries `file` = `preferences.md` and
  `ignored` = [`<repo>/.agenticale/routing.md`] — the seeded absolute legacy
  path, because the probe reports paths, not basenames — and the activation's
  recorded routing summary names the ignored file alongside the effective one.
- `presentFiles` carries the effective file paths only (the project
  `preferences.md`), so the workflow reads and interprets exactly one file at
  that scope.

## Setup — case B: both files at personal scope, conflicting `## Work` values

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

`~/.agenticale/routing.md` (conflicts on the tier and on the allowance):

```markdown
## codex

### Tiers

| Tier | Model | Reasoning effort |
| --- | --- | --- |
| fast | gpt-6-comet | max |

## Work

- worker rounds: 5
```

No `<repo>/.agenticale/` file under either name. Recorded invocation:
`/work <task>`.

## Expected behavior — case B

- The personal `preferences.md` is the effective file: the `fast` tier comes
  from it (`gpt-6-luna` / low, source `personal preferences.md`), and the
  snapshot records `work: { "workerRounds": 12, "source": "personal preferences.md" }`.
- The ignored legacy file's `## Work` value (5) never appears in the
  snapshot: the allowance is twelve, not five, and its source is the
  effective file — a conflicting entry in an ignored file is not merged, not
  averaged, and not reported as a tie.
- The ignored file is identified in the personal location's record
  (`ignored` = [`~/.agenticale/routing.md`], the seeded absolute path) and
  named in the recorded routing summary.

## Setup — case C: the ignored file is unreadable

The case B seed, except `~/.agenticale/routing.md` cannot be read (mode
`000`, a directory at the path, or any other read failure; its intended
content is not knowable). Recorded invocation: `/work <task>`.

## Expected behavior — case C

- No error: an unreadable ignored file is not an error. The probe reports the
  personal location with `file` = `preferences.md` and
  `ignored` = [`~/.agenticale/routing.md`] (the seeded absolute path;
  presence, not readability, is what makes a file ignored), and the activation
  proceeds.
- The effective file is read and interpreted normally: `fast` resolves to
  `gpt-6-luna` / low and the allowance is twelve from `personal preferences.md`.
- Contrast with fixture 17 case A and fixture 23: the unreadable-file error
  applies only when the unreadable file is the effective file at its scope.

Effective settings are unknown unless the host exposes native dispatch
metadata.
