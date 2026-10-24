# AgenticAle model routing (example)

Copy the body of this file to a routing preference file to customize model
routing:

- project scope: `<repo>/.agenticale/routing.md`
- personal scope: `~/.agenticale/routing.md`

File creation is an explicit user action. AgenticAle never overwrites,
migrates, or removes these files; the only exception is the OpenCode
installer's consented `setup` subcommand, which may create the personal
`~/.agenticale/routing.md` — a minimal scaffold in which every role inherits
the session model and effort — when it is absent. See `ROUTING.md` for the
full contract.
Runtime sections are `## codex`, `## copilot`, `## opencode`, and
`## antigravity` headings (the `copilot-local` binding uses the `copilot`
section); inside a `## Profile:` section the same runtime heading sits one
level deeper, as in `### opencode` below. Apply only the active runtime's
preferences; omit a section to keep the installed defaults for that runtime.
Named profile sections work for any runtime and are selected with
`--profile <name>` at invocation. The model names below are illustrative;
actual identifiers and effort support come from the host.

---

# AgenticAle model routing

## opencode

### Tiers

| Tier | Model | Reasoning effort |
| --- | --- | --- |
| fast | server-a/small-coder | medium |
| routine | server-a/main-coder | high |
| standard | provider-main/reviewer | high |
| deep | provider-main/reviewer | xhigh |

### Role overrides

- review: use the deep tier.

## Profile: server-b

### opencode

#### Tiers

| Tier | Model | Reasoning effort |
| --- | --- | --- |
| fast | server-b/small-coder | medium |
| routine | server-b/main-coder | high |

## Profile: alternate-provider

### opencode

#### Tiers

| Tier | Model | Reasoning effort |
| --- | --- | --- |
| fast | provider-backup/fast-model | medium |
| routine | provider-backup/coding-model | high |
| standard | provider-backup/review-model | high |
| deep | provider-backup/review-model | xhigh |

#### Role overrides

- review: default.

---

## What each example does

- No selector (or `--profile default`) uses the default `opencode` table and
  its review override, so `review` runs on the `deep` tier.
- `--profile server-b` changes the `fast` and `routine` tiers — exploration,
  routine implementation, and ordinary fixes — while review and deeper
  reasoning retain their default configuration.
- `--profile alternate-provider` changes all four tiers and clears the
  default review exception (`review: default.`), returning `review` to its
  default `standard` tier.

The provider/model aliases and effort values are illustrative, not a claim of
availability; substitute identifiers the user's host supports.
