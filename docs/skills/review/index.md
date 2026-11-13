# Review

Review gives your current branch's net changes an independent review against
a local base: from the merge base to the current working-tree result,
including relevant untracked files. On a clean tree this is the committed
branch review — the commits your branch has advanced past the base. Invoke it
when you want a fresh reviewer to inspect the result and return findings —
without implementing, fixing, or publishing anything.

Review runs the same shared review contract that Work and Autonomous use,
on a recorded comparison instead of a completed worker slice: no worker
report, accepted-slice history, or implementation history is needed, and the
reviewer inspects the comparison and verifies its evidence itself.

## Try Review

Invoke the installed skill on a branch whose committed changes you want
checked:

- `/review`
- `/review main check the migration commit for regressions`
- `/review --deep v1.4.0 audit the combined API changes`
- `/review only my uncommitted changes`

Leading options — `--deep` and the `--` delimiter — may appear in any order,
with everything after the options as the review context: a focus,
acceptance criteria, or a named local base. A base is always named in that
remaining text; there is no separate base flag. Add `--deep` for the
expensive integration-level audit (the deep-review contract) instead of the
ordinary review.

| Request form | Review behavior |
| --- | --- |
| `/review` | The local default base, no extra criteria, ordinary review of the net changes to the working-tree result. |
| `/review <base or criteria>` | Names a local base or supplies focus or criteria; ordinary review. |
| `/review only my uncommitted changes` | Reviews the local changes relative to `HEAD` instead of the merge-base comparison. |
| `/review --deep ...` | The same recorded comparison reviewed by the deep-review contract. |

The workflow never selects a model: on OpenCode the reviewer's model comes
from the generated `agenticale/review` or `agenticale/deep-review` profile,
and on other hosts the role's model can come from the installation's
preference file (a leading `--profile NAME` selects `preferences.NAME.md`
instead). See [model configuration](#model-configuration).

The examples use conceptual slash syntax; select the installed skill or use
the client-specific invocation described in [setup](../../setup.md). Review
starts only when explicitly invoked.

## Scope and base

The default comparison is the merge base of your branch and the base to the
current working-tree result, including relevant untracked files. A dirty
tree does not stop the invocation, and it never narrows the review to
uncommitted changes alone. An explicit scope in the review context — for
example "only my uncommitted changes" — reviews the local changes relative
to `HEAD` instead. Nothing is ever stashed, committed, or discarded, and the
actual comparison and included changes are stated before the reviewer is
dispatched.

The base is resolved from local Git metadata and repository conventions
when you do not name one. An unavailable or ambiguous base is a question to
you, not a remote fetch, and no branch is switched, checked out, merged,
rebased, or reset. The comparison is recorded before the reviewer is
dispatched; when it has no net changes there is nothing to review and no
reviewer is dispatched.

## Model configuration

The review round runs the review role; `--deep` runs the deep-review role.
Each role's model comes from the installation — the generated agent profiles
on OpenCode, or the preference file on per-spawn hosts. See
[model configuration](../../guides/model-routing.md).

## What you receive

The reviewer's report: a verdict (clean or blocking findings), each finding
with its location, impact, and required action, optional nits, and the
commands the reviewer ran with results. The report identifies the reviewed
branch, the base, and the recorded comparison, and discloses checks the
reviewer could not run or criteria it could not verify; a clean verdict is
not claimed when evidence is missing.

Findings are returned to you, not dispatched: Review does not run a fix
round, a re-review, or a hosted review, and it makes no commits, pushes, or
other changes. The report is the deliverable, not a gate into a fix loop: a
`/work` in the same session uses the findings and scope directly when you
want them addressed.

The review also never changes the checkout: nothing is stashed, committed,
discarded, or reconciled. Before the results are reported, a final recheck
records the current branch, `HEAD`, and the working-tree result; if the
checkout or the working-tree result changed during the review, the report
states that the verdict covers only the recorded comparison and what
changed — the changed result is not claimed covered.

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
