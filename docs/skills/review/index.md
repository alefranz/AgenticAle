# Review

Review gives the committed changes on your current branch an independent
review against a local base. Invoke it when you want a fresh reviewer to
inspect the commits your branch has advanced past the base and return
findings — without implementing, fixing, or publishing anything.

Review runs the same shared review contract that Work and Autonomous use,
on an existing committed range instead of a completed worker slice: no
worker report, accepted-slice history, or implementation history is needed,
and the reviewer inspects the range and verifies its evidence itself.

## Try Review

Invoke the installed skill on a branch whose committed changes you want
checked:

- `/review`
- `/review main check the migration commit for regressions`
- `/review --deep v1.4.0 audit the combined API changes`
- `/review --profile server-b main focus on the lock ordering`

Leading options — `--deep`, `--profile NAME` (or `--profile=NAME`), and the
`--` delimiter — may appear in any order, with everything after the options
as the review context: a focus, acceptance criteria, or a named local base.
A base is always named in that remaining text; there is no separate base
flag. Add `--deep` for the expensive integration-level audit (the
deep-review contract) instead of the ordinary review.

| Request form | Review behavior |
| --- | --- |
| `/review` | The local default base, no extra criteria, ordinary review. |
| `/review <base or criteria>` | Names a local base or supplies focus or criteria; ordinary review. |
| `/review --deep ...` | The same recorded range reviewed by the deep-review contract. |
| `/review --profile NAME ...` | The review route is resolved through that named routing profile. |

A selected profile is session-scoped: a fresh `/review` without a selector
uses ordinary routing. An unambiguous natural-language instruction (for
example, "use the server-b routing profile") selects a profile; merely
mentioning one does not. An unknown, conflicting, or missing profile
selector is reported before dispatch. Named routing profiles are described
in [named routing profiles](../../guides/model-routing.md#named-routing-profiles).

The examples use conceptual slash syntax; select the installed skill or use
the client-specific invocation described in [setup](../../setup.md). Review
starts only when explicitly invoked.

## A clean tree and a local base

Review covers committed changes only. A dirty working tree — staged,
unstaged, or untracked changes — stops the invocation: it names what is
present, and nothing is stashed, committed, or discarded.

The base is resolved from local Git metadata and repository conventions
when you do not name one. An unavailable or ambiguous base is a question to
you, not a remote fetch, and no branch is switched, checked out, merged,
rebased, or reset. The reviewed range is the merge base of the branch and
the base to HEAD, recorded before the reviewer is dispatched; when the
range is empty there is nothing to review and no reviewer is dispatched.

## The routing tiers

The review round uses the standard tier; `--deep` uses the deep tier. In
the packaged defaults these are the review and deep-review routes, and
routes remain configurable. See
[Choosing models by role](../../guides/model-routing.md#choosing-models-by-role).

## What you receive

The reviewer's report: a verdict (clean or blocking findings), each finding
with its location, impact, and required action, optional nits, and the
commands the reviewer ran with results. The report identifies the reviewed
branch, the base, and the commit range, and discloses checks the reviewer
could not run or criteria it could not verify; a clean verdict is not
claimed when evidence is missing.

Findings are returned to you, not dispatched: Review does not run a fix
round, a re-review, or a hosted review, and it makes no commits, pushes, or
other changes. The report is the deliverable, not a gate into a fix loop:
use `/work` with the findings when you want them addressed.

The review also never changes the checkout: nothing is stashed, committed,
discarded, or reconciled, and a dirty tree stops the review before dispatch.
Before the results are reported, a final recheck records the current branch,
`HEAD`, and the working-tree status; if the checkout changed during the
review, the report states that the verdict covers only the recorded commits
— the branch and the commit range recorded at dispatch — and what changed.

## Implementation source

This guide explains the user-facing workflow. The authoritative
instructions are the [review skill source](https://github.com/alefranz/AgenticAle/blob/main/skills/review/SKILL.md),
the [shared round contract](https://github.com/alefranz/AgenticAle/blob/main/skills/work/references/rounds.md),
the [review task contract](https://github.com/alefranz/AgenticAle/blob/main/skills/work/references/tasks/review.md),
and the [deep-review task contract](https://github.com/alefranz/AgenticAle/blob/main/skills/work/references/tasks/deep-review.md).
Installation remains in the [setup guide](../../setup.md);
architecture and runtime support remain in the canonical
[architecture](../../architecture.md)
and [runtime compatibility](../../runtime-compatibility.md)
references.
