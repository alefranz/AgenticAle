# Fixture 06 — Non-Git workspace scope

A non-Git project. Two cases: an explicitly established workspace root, and
no established root. Active runtime is `codex`.

## Setup — case A: workspace root established

A non-Git workspace whose root `W` was explicitly established (the session
works directly in `W`, which is not a Git checkout). `W/.agenticale/routing.md`:

```markdown
## codex

### Tiers

| Tier | Model | Reasoning effort |
| --- | --- | --- |
| fast | gpt-6-luna | high |
```

No `~/.agenticale/routing.md`.

## Expected discovery — case A

- Project scope is the established workspace root `W` (no Git worktree
  resolution is possible or attempted).
- Checked candidates: `W/.agenticale/routing.md` (found) and
  `~/.agenticale/routing.md` (absent).

## Expected effective selections — case A (codex)

| Role | Selection | Requested model / effort | Provenance |
| --- | --- | --- | --- |
| explore | tier `fast` | gpt-6-luna / high | tier: workspace routing.md |
| implement / fix | tier `routine` | gpt-6-luna / high | tier: installed baseline |
| implement-hard / review | tier `standard` | gpt-6.1-sol / high | tier: installed baseline |
| deep-review / consult | tier `deep` | gpt-6.1-sol / xhigh | tier: installed baseline |

## Setup — case B: no established workspace root

Same non-Git workspace, but no workspace root was established for this
activation.

## Expected discovery — case B

- The missing project scope is reported. The bootstrap does not scan parent
  directories or any other location to guess a root.
- Only `~/.agenticale/routing.md` (absent here) and the installed baseline
  remain as sources.

## Expected effective selections — case B (codex)

All seven routes from the installed baseline — explore uses gpt-6-luna at
medium effort, implement and fix use gpt-6-luna at high, hard implementation
and review use gpt-6.1-sol at high, and deep review and consultation use
gpt-6.1-sol at xhigh — with every provenance label "installed baseline" and
the missing-project-scope report attached to the activation summary.
