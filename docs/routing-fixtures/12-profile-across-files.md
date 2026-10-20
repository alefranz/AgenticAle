# Fixture 12 — Profiles across files (personal and project)

A personal profile entry and a project default entry both redefine `fast`;
the same profile name is defined in both files with different entries.
Active runtime is `codex`.

## Setup

`~/.agenticale/routing.md` (profile section only, no default section):

```markdown
# AgenticAle model routing

## Profile: server-b

### codex

#### Tiers

| Tier | Model | Reasoning effort |
| --- | --- | --- |
| fast | gpt-6-personal | medium |
```

Project root `.agenticale/routing.md`:

```markdown
# AgenticAle model routing

## codex

### Tiers

| Tier | Model | Reasoning effort |
| --- | --- | --- |
| fast | gpt-6-luna | medium |
| routine | gpt-6-luna | high |
| standard | gpt-6.1-sol | high |
| deep | gpt-6.1-sol | xhigh |

## Profile: server-b

### codex

#### Tiers

| Tier | Model | Reasoning effort |
| --- | --- | --- |
| routine | gpt-6-nebula | high |
```

## Expected effective selections (codex, `--profile server-b`)

Recorded invocation: `/work --profile server-b <task>`.

| Role | Selection | Requested model / effort | Provenance |
| --- | --- | --- | --- |
| explore | tier `fast` | gpt-6-luna / medium | role: default mapping; tier: repo routing.md |
| implement / fix | tier `routine` | gpt-6-nebula / high | role: default mapping; tier: repo routing.md (profile server-b) |
| implement-hard / review | tier `standard` | gpt-6.1-sol / high | role: default mapping; tier: repo routing.md |
| deep-review / consult | tier `deep` | gpt-6.1-sol / xhigh | role: default mapping; tier: repo routing.md |

- The project default `fast` (gpt-6-luna) beats the personal profile `fast`
  (gpt-6-personal) for the default-mapped role `explore`: a project default
  entry is a higher-precedence layer than a personal profile entry.
- Same-name profiles merge across files by entry: the merged `server-b`
  profile carries the personal `fast` entry and the project `routine` entry,
  and the surviving `routine` comes from the project file.
- Tiers the profile does not touch (`standard`, `deep`) fall through the
  ordinary precedence to the project default section.

Effective settings are unknown unless the host exposes native dispatch
metadata.

## Expected effective selections (codex, ordinary routing)

With no selector (or `--profile default`), the personal profile contributes
nothing: `fast` and `routine` resolve from the repo default section
(gpt-6-luna / medium and gpt-6-luna / high), and `standard`/`deep` from the
repo default section as well.
