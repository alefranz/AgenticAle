# Fixture 19 — New name; each scope resolves on its own effective file

`preferences.md` is the documented name of the customization file; the legacy
`routing.md` name is still accepted at each scope. Each scope resolves
independently on its own effective file: a scope with a `preferences.md` uses
it, a scope with only `routing.md` uses the legacy file, and the mix is
permitted. Case A is the new name alone, with a `## Work` section effecting
the Work allowance; case B is the new name at project scope only; cases C and
D mix the two names across scopes. Active runtime is `codex`.

## Setup — case A: personal `preferences.md` only, with a `## Work` section

`~/.agenticale/preferences.md`:

```markdown
# AgenticAle preferences

## codex

### Tiers

| Tier | Model | Reasoning effort |
| --- | --- | --- |
| fast | gpt-6-luna | low |

## Work

- worker rounds: 12
```

No `<repo>/.agenticale/preferences.md`, and no `routing.md` at either scope.
Recorded invocation: `/work <task>` (no selector).

## Expected effective selections — case A (codex)

| Role | Selection | Requested model / effort | Provenance |
| --- | --- | --- | --- |
| explore | tier `fast` | gpt-6-luna / low | role: default mapping; tier: personal preferences.md |
| implement / fix | tier `routine` | gpt-6-luna / high | role: default mapping; tier: installed baseline |
| implement-hard / review | tier `standard` | gpt-6.1-sol / high | role: default mapping; tier: installed baseline |
| deep-review / consult | tier `deep` | gpt-6.1-sol / xhigh | role: default mapping; tier: installed baseline |

The `## Work` section is interpreted as a layer-level work allowance and the
snapshot records `work: { "workerRounds": 12, "source": "personal preferences.md" }`:
twelve worker rounds are available to this Work task instead of the default
eight. Available, not required — how many rounds must run, the consultation
allowance, the per-slice caps, and the progress safeguards are unchanged.

## Setup — case B: project `preferences.md` only, no `## Work` section

`<repo>/.agenticale/preferences.md`:

```markdown
## codex

### Role overrides

- review: use the deep tier.
```

No personal preference file under either name, no `routing.md` anywhere.
Recorded invocation: `/work <task>`.

## Expected effective selections — case B (codex)

| Role | Selection | Requested model / effort | Provenance |
| --- | --- | --- | --- |
| explore | tier `fast` | gpt-6-luna / medium | role: default mapping; tier: installed baseline |
| implement / fix | tier `routine` | gpt-6-luna / high | role: default mapping; tier: installed baseline |
| implement-hard | tier `standard` | gpt-6.1-sol / high | role: default mapping; tier: installed baseline |
| review | tier `deep` | gpt-6.1-sol / xhigh | role: repo preferences.md; tier: installed baseline |
| deep-review / consult | tier `deep` | gpt-6.1-sol / xhigh | role: default mapping; tier: installed baseline |

No `## Work` section anywhere: the effective allowance stays the packaged
default — `work: { "workerRounds": 8, "source": "installed baseline" }`. The
new name changes nothing about discovery: the file is read, interpreted, and
provenance-labeled exactly as the legacy name is.

## Setup — case C: personal legacy `routing.md` + project `preferences.md`

`~/.agenticale/routing.md`:

```markdown
## codex

### Tiers

| Tier | Model | Reasoning effort |
| --- | --- | --- |
| fast | gpt-6-luna | low |
```

`<repo>/.agenticale/preferences.md`:

```markdown
## codex

### Role overrides

- review: use the deep tier.
```

No `preferences.md` beside the personal file and no `routing.md` beside the
project file. Recorded invocation: `/work <task>`.

## Expected effective selections — case C (codex)

| Role | Selection | Requested model / effort | Provenance |
| --- | --- | --- | --- |
| explore | tier `fast` | gpt-6-luna / low | role: default mapping; tier: personal routing.md |
| implement / fix | tier `routine` | gpt-6-luna / high | role: default mapping; tier: installed baseline |
| implement-hard | tier `standard` | gpt-6.1-sol / high | role: default mapping; tier: installed baseline |
| review | tier `deep` | gpt-6.1-sol / xhigh | role: repo preferences.md; tier: installed baseline |
| deep-review / consult | tier `deep` | gpt-6.1-sol / xhigh | role: default mapping; tier: installed baseline |

Each scope resolves independently on its own effective file: the personal
scope's effective file is the legacy `routing.md` (still accepted — no
`preferences.md` beside it), the project scope's is `preferences.md`. The two
files merge by entry with project over personal, exactly as two same-named
files would; the filename at a scope is invisible once the effective file is
identified.

## Setup — case D: the inverse mix (personal `preferences.md` + project legacy `routing.md`)

`~/.agenticale/preferences.md`:

```markdown
## codex

### Tiers

| Tier | Model | Reasoning effort |
| --- | --- | --- |
| fast | gpt-6-luna | low |
```

`<repo>/.agenticale/routing.md`:

```markdown
## codex

### Role overrides

- review: use the deep tier.
```

No other preference file at either scope. Recorded invocation: `/work <task>`.

## Expected behavior — case D

- The same independence holds in the inverse mix: the personal scope
  interprets `preferences.md` and the project scope interprets the legacy
  `routing.md`; the merged selections match case C's pattern (personal `fast`
  tier, project `review` override, all other roles on the installed baseline).
- Provenance names the file that actually supplied each entry (`personal
  preferences.md`, `repo routing.md`); no entry is labeled with a filename
  that is not that scope's effective file.
- No `## Work` section anywhere, so the allowance stays the packaged default
  with its `installed baseline` source.

Effective settings are unknown unless the host exposes native dispatch
metadata.
