# Autonomous

Autonomous is for a long goal that needs to continue through several focused
work rounds and fresh sessions. The skill keeps a durable backlog and handoff
in the project so a later activation can resume the recorded next action.

Use it for a multi-step project, such as:

- `/autonomous Add CSV export, update its tests, and prepare the release`
- `/autonomous 4 Migrate the report pipeline and verify the new behavior`
- `/autonomous` to resume the active handoff
- `/autonomous --profile server-b` to resume the active goal with that routing
  profile

The slash form is conceptual: use the invocation supported by your client, as
described in [installation and client setup](../../setup.md). Autonomous starts
only when explicitly invoked. Leading options — a positive-integer worker-round
budget, `--profile NAME` (or `--profile=NAME`), and the `--` delimiter — may
appear in either order, with everything after the options as the goal text,
possibly empty. A profile-only or budget-and-profile invocation with no goal
text RESUMEs the active goal; with no budget, the default budget is used. The
session becomes the coordinator and proceeds in sequential, bounded rounds.
Code and configuration changes receive independent review by default, with
focused fixes for blocking findings.

The selected profile name is durable goal configuration: it is recorded in the
active handoff and persists across resumes, so a resume without a selector
keeps it; `--profile default` clears a named selection back to ordinary
routing. A mid-run profile change applies only to future dispatches — it never
changes an already-running child, never resets budgets or review counters,
never bypasses the provider quota rules, and never authorizes provider
switching. A selected profile that no longer resolves — removed, renamed, or
defined only for another runtime — blocks the next dispatch with an actionable
explanation. See [named routing profiles](../../guides/model-routing.md#named-routing-profiles)
for the selection and precedence rules.

Concise progress narration keeps the sequence readable in the main conversation:
what was learned, what happens next, and why. When your client collapses subagent
activity, these updates let you follow the work without opening every subtask.

You provide the goal, constraints, and any acceptance examples. The workflow
records durable progress in the target project's `BACKLOG.md` and
`docs/handoffs/active.md`, and returns the completed work, verification, and
remaining limitations. By default changes stay uncommitted; commit, branch,
push, and pull request actions are separate requests. An investigation-only
goal returns findings and a next step.

Before round 1, the coordinator briefly assesses what the goal would touch —
sources other actors can also mutate, side effects that would survive an
interruption, concurrent humans, ownership-sensitive cleanup, and
compatibility surfaces — and keeps the main loop thin: source evidence needed
to define a round goes to a focused exploration round with one question and a
stop condition, not into the main loop. Before each substantive assignment,
including the first, it explains the next step and its purpose. After a result,
the next update connects the evidence to the next decision; a finished task ends
with the delivery report. The compact state stays in the active handoff next to
the round ledger.

The narration follows the [same guidance as Work](../work/index.md#progress-narration):
short updates about outcomes, trade-offs, and verification, with model details
and counters surfaced when they affect a decision or you ask for them. For
example: "The new reader passes its compatibility checks. I'm assigning the
writer update next, keeping the old format readable during the transition."
These summaries add tokens in exchange for an easier-to-follow account of a
long task. The durable handoff preserves the state needed to resume; the visible
updates help you understand how the work reached that state.

When a budget or allowance is exhausted, the loop stops without another round
of that type. The report says which allowance is exhausted, what is completed
and what is blocked, and the recent material progress, and offers bounded
choices — a bounded replan, one additional fix-and-review cycle, or a stop
that preserves the current work — naming the rounds each choice consumes. A
granted extension adds exactly the named worker, fix, and review rounds: it
never resets counters and grants no extra scope, review, or Git rights. A
consult can settle a reversible decision but cannot grant one, and declining
or not answering ends the stop. Allowance usage and any granted extension are
persisted in the active handoff, and the incomplete stop carries a
copy-pasteable continuation prompt so a later activation can act on the
grant. Repeated findings on the same invariant are classified as a real
design issue — replanned with the original acceptance and counters intact —
or as reviewer standard drift, settled once rather than chased. Provider
quota exhaustion is separate: it follows the recovery policy below, not these
allowance stops.

When the host reports provider quota exhaustion, the coordinator records the
evidence, affected role, retry time, inspected partial progress, remaining work,
and next action in the active handoff. It waits about 30 minutes by default, or
longer when reliable provider reset metadata requires it, then resumes from the
inspected working tree. Up to eight quota retries without resumed progress are
allowed, with the count preserved across sessions and reset only after material
progress. A supported host wait can keep the session waiting; otherwise the
handoff is ready for a later activation, without a promised automatic wakeup.

The coordinator may ask you to settle a meaningful behavior choice, provide
missing information, or clarify an ambiguous pull request destination. If a
round cannot proceed because of a permission or capability limit, it reports
the blocker and the choice needed to continue.

For the detailed state, budget, routing, review, and resume rules, read the
[Autonomous skill source](https://github.com/alefranz/AgenticAle/blob/main/skills/autonomous/SKILL.md)
and the shared
[round contract](https://github.com/alefranz/AgenticAle/blob/main/skills/work/references/rounds.md).
For setup, see [installation and client setup](../../setup.md); for the
everyday workflow, see [Work](../work/index.md).
