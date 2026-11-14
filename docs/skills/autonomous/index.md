# Autonomous

Autonomous is for a long goal that needs to continue through several focused
work rounds and fresh sessions. The skill keeps a durable backlog and handoff
in the project so a later activation can resume the recorded next action.

Use it for a multi-step project, such as:

- `/autonomous Add CSV export, update its tests, and prepare the release`
- `/autonomous 4 Migrate the report pipeline and verify the new behavior`
- `/autonomous` to resume the active handoff

The slash form is conceptual: use the invocation supported by your client, as
described in [installation and client setup](../../setup.md). Autonomous starts
only when explicitly invoked. Leading options — a positive-integer worker-round
budget and the `--` delimiter — may appear in either order, with everything
after the options as the goal text, possibly empty. An invocation with no
goal text RESUMEs the active goal; with no budget, the default budget is
used. The session becomes the coordinator and proceeds in sequential, bounded
rounds.
Code and configuration changes receive independent review by default, with
focused fixes for blocking findings.

Model configuration is not durable goal state: the preference file (or a
selected `preferences.NAME.md`) is read once at each activation and stays
fixed for that activation, and a fresh resume reads the current installation
again. A change to the installation's model configuration takes effect only
at the next fresh activation or resume: it never changes an already-running
child, never resets budgets or review counters, never bypasses the provider
quota-recovery rules, and never authorizes automatic provider switching. If a
role's installed model selection changed materially since the handoff was
written, the resume reports it. See
[model configuration](../../guides/model-routing.md).

Concise progress narration keeps the sequence readable in the main conversation:
what was learned, what happens next, and why. When your client collapses subagent
activity, these updates let you follow the work without opening every subtask.

You provide the goal, constraints, and any acceptance examples. The workflow
records durable progress in the target project's `BACKLOG.md` and
`.agenticale/handoffs/active.md`. It reports the completed work, verification,
and remaining limitations. By default changes stay uncommitted. Commit,
branch, push, and pull request actions are separate requests. An
investigation-only goal returns findings and a next step.

Completed handoffs and review records go in
`.agenticale/handoffs/archive/YYYY-MM.md`. For runs that need to resume from
a fresh clone, track `BACKLOG.md` and `.agenticale/handoffs/` in Git with the
matching product changes or submodule pin. Authorize pushes explicitly to
the intended remote.

When upgrading from a version that used `docs/handoffs/`, move the active
handoff and archive into `.agenticale/handoffs/` before resuming. Update
relative links and project instructions that refer to the old paths.

## Prepare a backlog for Autonomous

For a new goal, you can give Autonomous the outcome, constraints, and
acceptance checks directly. If you want to plan the work first, capture it in
`BACKLOG.md` at the root of the project you want Autonomous to work on.

- Describe the milestone in terms of what should work when it is complete
  and how to verify it.
- Record decisions and constraints that apply across slices, such as
  compatibility requirements and which actions need your approval.
- Put one actionable item under `Next slice`. Give it one observable outcome,
  one check a worker can run, and a clear boundary for where the work stops.
  If a technical unknown blocks implementation, make the first slice a
  focused investigation with a question and a criterion for deciding what to
  do next.
- Keep the next few candidate slices in dependency order. The coordinator can
  revise their order or scope as it learns more.

```markdown
# Project backlog

## Current milestone

Users can download a CSV from the Reports page. Verify that the downloaded
file contains the same rows as the filtered report.

## Decisions and constraints

- Keep the current report filters and access rules.

## Next slice

- [ ] Add CSV output for the report endpoint. Verify with an endpoint test
  that filtering and permissions match the existing report. End this slice
  at the endpoint, before adding the Reports page download action.

## Later slices

- [ ] Connect the Reports page download action to the verified endpoint and
  check the full download flow.
```

Start a new goal with explicit goal text that points to the milestone, for
example `/autonomous Deliver the CSV export milestone in BACKLOG.md`. The
coordinator creates `.agenticale/handoffs/active.md` and records the current slice
and its next action. A new goal requires the project to have no active
handoff. Invoke `/autonomous` without goal text to resume an existing
handoff's recorded `NEXT` action.

### Ask an AI agent to prepare the backlog

Give the agent the project, the desired outcome, and any constraints you
already know. You can add this instruction to your request.

```text
Prepare the project backlog for an Autonomous run. Read AGENTS.md if present,
the existing BACKLOG.md and .agenticale/handoffs/active.md if present, and enough
project source and tests to identify a verifiable first slice.

In the project's root BACKLOG.md, record the milestone, its acceptance check,
and decisions that carry across slices. Identify one Next slice with an
observable outcome, a verification command or reproducible check, and an
explicit stop boundary. Keep later slices short and ordered by dependency.
If a technical unknown blocks the first implementation slice, define one
investigation question and what evidence will settle it. Flag any product
decision that needs my input.

Preserve existing backlog entries and active work. If an active handoff
already owns the next action, leave that action in place and show me where
the proposed milestone fits. Return the suggested invocation for starting
the milestone when the project is ready. End after planning, before
implementation or invoking Autonomous.
```

## How a run proceeds

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
allowance stops. The preference file's `## Work` section (the Work
worker-round allowance) does not change these rules: Autonomous keeps its own
budget behavior.

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

For the detailed state, budget, review, and resume rules, read the
[Autonomous skill source](https://github.com/alefranz/AgenticAle/blob/main/skills/autonomous/SKILL.md)
and the shared
[round contract](https://github.com/alefranz/AgenticAle/blob/main/skills/work/references/rounds.md).
For setup, see [installation and client setup](../../setup.md); for the
everyday workflow, see [Work](../work/index.md).
