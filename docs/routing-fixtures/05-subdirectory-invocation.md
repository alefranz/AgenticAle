# Fixture 05 — Subdirectory invocation

A Git project with its `routing.md` at the worktree root, invoked from a
subdirectory. The project scope must resolve to the worktree root, not the
invocation directory, and discovery must not scan nested directories. Active
runtime is `codex`.

## Setup

Git worktree root `<repo>` with `<repo>/.agenticale/routing.md`:

```markdown
## codex

### Tiers

| Tier | Model | Reasoning effort |
| --- | --- | --- |
| deep | gpt-6-sol | max |
```

Invocation: `/work <task>` with the session's working directory at
`<repo>/packages/web` (a subdirectory of the worktree). No
`<repo>/packages/web/.agenticale/` directory exists or is scanned. No
`~/.agenticale/routing.md`.

## Expected discovery

- Project root resolves to `<repo>` (the Git worktree root), even though the
  invocation happened in `packages/web`.
- Checked candidates: `<repo>/.agenticale/routing.md` (found) and
  `~/.agenticale/routing.md` (absent). No other directory is scanned.

## Expected effective selections (codex)

| Role | Selection | Requested model / effort | Provenance |
| --- | --- | --- | --- |
| explore | tier `fast` | gpt-6-luna / medium | tier: installed baseline |
| implement / fix | tier `routine` | gpt-6-luna / high | tier: installed baseline |
| implement-hard / review | tier `standard` | gpt-6.1-sol / high | tier: installed baseline |
| deep-review / consult | tier `deep` | gpt-6-sol / max | tier: repo routing.md |
