# Autonomous

Autonomous is for a long goal that needs to continue through several focused
work rounds and fresh sessions. The skill keeps a durable backlog and handoff
in the project so a later activation can resume the recorded next action.

Use it for a multi-step project, such as:

- `/autonomous Add CSV export, update its tests, and prepare the release`
- `/autonomous 4 Migrate the report pipeline and verify the new behavior`
- `/autonomous` to resume the active handoff
- `/autonomous Also add PDF export` to steer an active run with new work

The slash form is conceptual: use the invocation supported by your client, as
described in [installation and client setup](../../setup.md). Autonomous starts
only when explicitly invoked. Leading options — a positive-integer worker-round
budget and the `--` delimiter — may appear in either order, with everything
after the options as the goal text, possibly empty. An invocation with no
goal text RESUMEs the active goal, preserving its persisted run ceiling and
consumed counters; a new run with no budget uses the default run ceiling of
6 worker rounds. Goal text supplied while a handoff is already active steers
the run instead of conflicting with it: explicit new outcomes are decomposed
into new backlog tasks, and continuation instructions adjust the existing
plan at the next selection boundary — without overwriting active work or
resetting identities, counters, budgets, or review gates. An ambiguous
request to discard or replace the active goal asks you before anything is
rewritten. The budget bounds the whole run; each genuine task
within the run has its own allowance of 12 worker rounds, and every
exploration, implementation, and fix round counts against both — the
effective remaining budget is the smaller of the two. The session becomes the
coordinator and proceeds in sequential, bounded
rounds. On OpenCode, when the installation configures a coordinator model,
the `/autonomous` command entry — including a fresh resume — runs in the
current session on the generated `agenticale/coordinator` profile from the
first turn; without one, the invoking session coordinates on its own model.
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

Autonomous selects routes by the same shared routing policy as
[Work](../work/index.md): `implement` is the default; `implement-hard` is
dispatched directly — no consultation first — when a slice's correctness
risk is visible, assessed per slice with no category exemptions; a hard fix
keeps the fix contract and the fix counters. The two optional routes exist
only where your installation configures them: `implement-easy` for explicitly
prescribed, bounded, mechanically verifiable work, and `consult-hard` for a
focused decision with conflicting evidence, interacting constraints, or a
costly reversal. Unconfigured, they fall back to `implement` and `consult`
with their existing assignments — a defined fallback, not an error. A
`consult-hard` round is read-only, carries the same consult contract, and
consumes the same consultation allowance as an ordinary consult (one per
decision, two per session). At every slice boundary and every fresh resume,
the next slice's route is reassessed against the current installation;
earlier dispatch records are diagnostic history, not a route lock.

Concise progress narration keeps the sequence readable in the main conversation:
what was learned, what happens next, and why. When your client collapses subagent
activity, these updates let you follow the work without opening every subtask.

You provide the goal, constraints, and any acceptance examples. The workflow
records durable progress in the target project's `BACKLOG.md` and
`.agenticale/handoffs/active.md`. Each task carries a stable ID — assigned
when it enters the backlog, before selection — and its worker-round
counters; a task deferred unfinished keeps a compact resumable
packet in the backlog — with its findings, current state, and one next
action — instead of being archived as completed. It reports the completed
work, verification, and remaining limitations. An investigation-only goal
returns findings and a next step without manufacturing product commits.

A new run commits and pushes each completed task by default: after the
task's required checks and reviews — including applicable deep review
gates — the coordinator makes coherent task commits and confirms an
ordinary push before the next task starts. The completion record itself —
result line, archived detail, updated handoff — is then persisted in one
bounded state-only commit, pushed and confirmed under the same policy, so
the pushed state is never left open and no endless chain of confirmation
writes follows. Reviews run before this gate and inspect the uncommitted
result; the coordinator owns final persistence verification and archival.
Explicit user or repository restrictions win: a commit-only or working-tree
run is recorded with its basis and followed, never bypassed. A restriction
means an actual prohibition — you ask to leave changes uncommitted or not to
push, or repository instructions forbid commits or pushes — cited concretely
when the policy is recorded. A conditional guard such as "do not commit
unless explicitly asked" is not a prohibition: invoking Autonomous is that
explicit request, and it satisfies the guard for the run's authorized commits
and pushes. Work's uncommitted default, the worker children's no-commit rule,
and the coordinator role are not bases for a restricted policy. The run
states the chosen policy and its basis visibly at start and on every fresh
resume, and warns when the policy leaves accepted work uncommitted or
unpushed. A resume keeps the recorded policy, so an existing working-tree or
commit-only run never silently gains push rights; a legacy handoff with no
recorded policy resumes as working tree with that warning, never silently
upgraded. If you explicitly change an active run's policy to commit or
commit-and-push, the change is recorded with its basis, and outstanding
persistence is reconciled under the new policy before further dispatch.
Completed tasks are re-evaluated against the new policy even when they
were already finalized and archived under the old one: their accepted work
may still be uncommitted or unpushed, and a gate satisfied under the old
policy does not excuse it. Only the persistence is reopened — reviews,
counters, the next action, and archived evidence stay unchanged; existing
commits are pushed as-is rather than re-created, and each completion record
is updated through the same bounded finalization. The order is fixed and
finite, so reconciliation state already carried by a task finalization is
never committed twice. Everything follows the ordinary destination and
safety rules and never duplicates commits. Pushes go only to the
checked-out branch's
resolved upstream; a main or protected branch, a missing upstream, or an
ambiguous destination stops and asks. Branch creation, pull requests,
merging, force-pushing, and remote changes remain separate explicit
requests. A failed or uncertain push keeps the task open with its exact
commit and destination state recorded and stops with the continuation
prompt; a resume inspects the actual local and remote history before
retrying the exact unfinished step, never duplicates commits or replays
work, and never marks a task completed before its persistence is confirmed.
Stopping preserves unfinished work too: when a run stops with attributable
unfinished product changes — even review-open ones — the coordinator
checkpoints them as explicit WIP commits under the same policy, recording
their verification and review status and the exact continuation in the
durable state. A WIP checkpoint never completes a task or bypasses its
review gate; when the task later finishes, its gate reuses those commits, and
every review's range starts at or before the recorded pre-WIP base —
preserved across resumes — so the WIP commits are inside the diff. A
significant backlog
reconciliation — new or removed tasks, rewritten acceptance — is committed
and pushed as a state-only checkpoint before further dispatch; routine
counter and ledger writes are not checkpointed. Checkpoint pushes follow the
same destination and safety rules as task pushes, and a failed or uncertain
checkpoint push — like any blocked persistence — goes directly to the
terminal local-only close: no further commits or pushes, all persistence
deferred until a resume reconciles the actual local and remote state.
Session-close state follows the same bounded finalization: its local records
are saved first, and a blocked close stops with the finalization deferred
and reported as unconfirmed — never completed — until a resume reconciles
and confirms it.

Completed handoffs and review records go in
`.agenticale/handoffs/archive/YYYY-MM.md`. For runs that need to resume from
a fresh clone, track `BACKLOG.md` and `.agenticale/handoffs/` in Git with the
matching product changes or submodule pin.

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
- Optionally add a `## Steering` section (see
  [Steer a running goal](#steer-a-running-goal)) to pause and continue the run
  or reorder the next ready-task selection while it works. The section is
  yours; the workflow reads it but never edits it.

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
and its next action. With an active handoff, the same goal text steers the
run — adding explicitly requested tasks or adjusting continuation — instead
of starting a new one. Invoke `/autonomous` without goal text to resume an
existing handoff's recorded `NEXT` action.

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

Two budgets bound the run. The **run ceiling** (default 6 for a new run, or
the number you pass) limits worker rounds across the whole run; the coordinator never
auto-grows it for a large goal. Each genuine task also has its own **task
allowance** of 12 worker rounds. Every exploration, implementation, and fix
round is charged to both, and the effective remaining budget is the smaller
of the two; review, review-deep, and consult rounds keep their own separate
caps. Only a genuinely new task gets a fresh allowance — decomposition,
replanning, resume, and interruption recovery never replenish either budget.
The run and task identities and the consumed counters are durable: they
survive crashes, resumes, and quota outages, each round is charged exactly
once, and a resume never resets them. The active handoff's budget line is
the canonical counter record; the backlog mirrors it in a fixed write order,
so a torn write or an interrupted task switch reconciles deterministically
without double charging or restoring stale consumption. A numeric budget on
a resume changes the run ceiling only: `/autonomous 3` after five consumed
rounds leaves no worker rounds rather than silently refreshing the count.

When the run ceiling is exhausted, the loop stops without another worker
round. The report says what is completed and what is blocked, and the recent
material progress, and offers bounded choices — a bounded replan, one
additional fix-and-review cycle, or a stop that preserves the current work —
naming the rounds each choice consumes. A granted extension adds exactly the
named rounds — worker rounds (fix rounds are worker rounds) to the named
budget (run ceiling or task allowance), and review rounds only against an
explicit user review limit: it never resets counters and grants no extra
scope, review, or Git rights. A consult can settle a reversible decision but
cannot grant one, and declining or not answering ends the stop. Allowance
usage and any granted extension are persisted in the active handoff, and the
incomplete stop carries a copy-pasteable continuation prompt so a later
activation can act on the grant.

One task's exhausted allowance is not a run stop. No further worker round
runs for that task, but verification and the permitted review of its
completed changes still run; the unfinished part stays incomplete and
resumable in the backlog. The exhausted task is skipped in worker selection —
even when steering names it first — so it cannot repeatedly win selection
and stall the run, while its permitted review stays schedulable. The run may
then select another truly independent ready task with a fresh allowance —
even while unfinished changes exist — without ever bypassing review gates,
dependencies, or safety boundaries, and without manufacturing tasks. When no
safe ready work remains, the run stops with the preserved state and the
continuation prompt.

Productive fixes continue unattended while budget and progress allow.
Autonomous does not gate the fix → review loop at a fixed per-target cycle
count: each further fix is a worker round charged once to both budgets, and
the loop continues — including beyond two fixes or three review passes on one
target — while at least one effective worker round remains, the latest fix
made real progress, and no safeguard or explicit user limit has fired. It
does not repeatedly ask you to authorize one more cycle. Every review must be
justified by changed slice or fix evidence, a required integration gate, or
bounded interrupted-review recovery; a review-only loop over unchanged
evidence is prohibited. Fix and review counters persist as evidence across
resumes, replans, and renames — nothing resets or re-identifies them — and
explicit limits you recorded stay binding; legacy default cycle caps never
re-gate a resumed run.

Deep-review re-audits likewise follow productive fixes instead of a fixed
per-target cap. The worker budget gates the next fix, not the review: the
required deep re-review of the last allowed judgmental fix still runs when
zero worker rounds remain. The session still runs at most one opportunistic
escalation — triggered when a slice touches a high-risk surface, needs at
least two fix rounds, or you explicitly ask for one — and the periodic
integration triggers are unchanged. Consults stay capped at one per decision
and two per session and can never grant worker budget. When the worker budget
is exhausted, fixes stop but the required review of the last allowed worker
still runs; surviving blockers keep the target incomplete and review-open.
An exhausted run ceiling stops the run and offers the named increment a
continuation needs; an exhausted task allowance alone defers that task while
the run continues with another truly independent ready task when one can be
selected safely. The no-progress, same-blocker, and repeated-interruption
safeguards, invariant replanning, and the scope, irreversible-action,
user-preference, Git, persistence, and steering limits all still apply.

Repeated findings on the same invariant are classified as a real
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

## Steer a running goal

You can steer a run while it works, through one small human-owned section of
the project's existing `BACKLOG.md` — no new file, and no general command
channel:

```markdown
## Steering

- mode: continue
- priority: T3, T2
```

- `mode: pause` asks the run to stop at the next safe checkpoint: the
  currently running child is allowed to finish its round, its result and
  budget charge are recorded, and the exact next action and all counters are
  preserved before the loop stops with a pause report. Nothing is interrupted
  mid-round, and the workflow does not poll or run a watcher. Set
  `mode: continue` (or remove the section) and invoke `/autonomous` again to
  resume the recorded next action. With no new instruction, the run continues
  normally.
- `priority` is an optional comma-separated list of task IDs that reorders
  only the next task selection among ready tasks. IDs are assigned when
  tasks enter the backlog, so a recorded task that has never been selected
  can be named. Priority never interrupts the active task, and it never
  unblocks a blocked, dependent, unknown, or allowance-exhausted task —
  such IDs are skipped with a note.

The section belongs to you. The coordinator re-reads it before every new
round — workers, reviews, fixes, and consults alike — and never edits it;
its backlog writes are targeted edits on a fresh re-read, so your concurrent
steering changes survive. Steering cannot grant budget, change scope,
authorize Git actions, or bypass a review gate; those stay with the normal
invocation and grant rules. Goal text in an invocation is a separate
explicit channel: it can add tasks or steer continuation under the
reconciliation rules above, and it is never written into this section.

For the detailed state, budget, review, and resume rules, read the
[Autonomous skill source](https://github.com/alefranz/AgenticAle/blob/main/skills/autonomous/SKILL.md)
and the shared
[round contract](https://github.com/alefranz/AgenticAle/blob/main/skills/work/references/rounds.md).
For setup, see [installation and client setup](../../setup.md); for the
everyday workflow, see [Work](../work/index.md).
