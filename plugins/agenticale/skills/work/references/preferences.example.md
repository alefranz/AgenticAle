# AgenticAle preferences (example)

Copy the body of this file to a preferences file to customize model routing
and, optionally, the Work workflow's worker-round allowance:

- project scope: `<repo>/.agenticale/preferences.md`
- personal scope: `~/.agenticale/preferences.md`

At each scope the legacy filename `routing.md` is still accepted for the same
file. When both `preferences.md` and `routing.md` exist at the same scope,
`preferences.md` takes precedence and `routing.md` is ignored — never merged.

File creation is an explicit user action. AgenticAle never overwrites,
migrates, or removes these files; the only exception is the OpenCode
installer's consented `setup` subcommand, which may create the personal
`~/.agenticale/preferences.md` — a minimal scaffold with no role overrides,
so the installed baseline routing applies — when it is absent. See `ROUTING.md`
for the full contract.
Runtime sections are `## codex`, `## copilot`, `## opencode`, and
`## antigravity` headings (the `copilot-local` binding uses the `copilot`
section); inside a `## Profile:` section the same runtime heading sits one
level deeper, as in `### opencode` below. Apply only the active runtime's
preferences; omit a section to keep the installed defaults for that runtime.
The top-level `## Work` section — a sibling of the runtime sections, never
inside a `## Profile:` section — sets the Work workflow's worker-round
allowance with a `- worker rounds: <positive integer>` entry. Named profile
sections work for any runtime and are selected with `--profile <name>` at
invocation. The model names below are illustrative; actual identifiers and
effort support come from the host.

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

## Work

- worker rounds: 12

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
- The `## Work` section overrides the Work workflow's default allowance of
  eight worker rounds with twelve: twelve worker rounds are available to a
  Work task. It changes only what is available — never what is required —
  and applies to the Work workflow only (Autonomous Mode keeps its own
  budget); an invalid value (not a positive integer) is reported, never
  defaulted or clamped.

The provider/model aliases and effort values are illustrative, not a claim of
availability; substitute identifiers the user's host supports.
