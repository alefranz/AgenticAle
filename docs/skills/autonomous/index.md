# Autonomous

Autonomous is for a long goal that needs to continue through several focused
work rounds and fresh sessions. The skill keeps a durable backlog and a
compact active checkpoint in the project so a later activation can resume the
recorded next action.

Use it for a multi-step project, such as:

- `/autonomous Add CSV export, update its tests, and prepare the release`
- `/autonomous 4 Migrate the report pipeline and verify the new behavior`
- `/autonomous` to resume the active run
- `/autonomous Also add PDF export` to steer an active run with new work

The slash form is conceptual: use the invocation supported by your client, as
described in [installation and client setup](../../setup.md). Autonomous starts
only when explicitly invoked. Leading options — a positive-integer worker-round
budget and the `--` delimiter — may appear in either order, with everything
after the options as the goal text, possibly empty. An invocation with no
goal text RESUMEs the active goal, preserving its persisted run ceiling and
consumed counters; a new run with no budget uses the default run ceiling of
240 worker rounds — a generous emergency safety limit, not a work target.
Goal text supplied while a run is already active steers
the run instead of conflicting with it: explicit new outcomes are decomposed
into new backlog tasks, and continuation instructions adjust the existing
plan at the next selection boundary — without overwriting active work or
resetting identities, counters, budgets, or review gates. An ambiguous
request to discard or replace the active goal asks you before anything is
rewritten. The budget bounds the whole run; each genuine task within the run has its own
default allowance of **24 worker rounds**, and every exploration,
implementation, and fix round counts against both — the effective remaining
budget is the smaller of the two. A separate completed-task limit (default 20)
bounds how many tasks one run may finish. The session becomes the coordinator
and proceeds in sequential, bounded rounds. On OpenCode, when the installation
configures a coordinator model, the `/autonomous` command entry — including a
fresh resume — runs in the current session on the generated
`agenticale/coordinator` profile from the first turn; without one, the
invoking session coordinates on its own model. Code and configuration changes
receive independent review by default, with focused fixes for blocking
findings; in strict mode a clearly mechanical slice closes by its deterministic
check instead, with an independent review only when risk warrants one. Cold-path
procedures (`persistence.md`, `escalation.md`, `recovery.md`) load on demand
only when triggered, and round packets compose directly from the shared round
contract and role task contracts.

Model configuration is not durable goal state: the preference file (or a
selected `preferences.NAME.md`) is read once at each activation and stays
fixed for that activation, and a fresh resume reads the current installation
again. A change to the installation's model configuration takes effect only
at the next fresh activation or resume: it never changes an already-running
child, never resets budgets or review counters, never bypasses the provider
quota-recovery rules, and never authorizes automatic provider switching. If a
role's installed model selection changed materially since the snapshot was
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
records durable progress with a single-source-of-truth split between the
target project's `BACKLOG.md` (remaining plan, 1-line `[x]` completed receipts,
and deferred packets) and `.agenticale/active.md` — a live working checkpoint
of the active task and its currently open findings, overwritten in place on
every round settle rather than kept as a growing round journal. Each task
carries a stable ID — assigned when it enters the backlog, before selection —
and its worker-round counters; a task deferred unfinished keeps a compact
resumable packet in the backlog — with its still-open items, counters, and one
next action — instead of being recorded as completed. It reports the completed
work, verification, and remaining limitations. An investigation-only goal
returns findings and a next step without manufacturing product commits.

A new run commits and pushes each completed task by default: after the
task's required checks and reviews — including applicable deep review
gates — the coordinator makes coherent task commits and confirms an
ordinary push before the next task starts. The completion record itself —
the backlog result line and the updated snapshot — is then persisted in one
bounded state-only commit, pushed and confirmed under the same policy, so
the pushed state is never left open and no endless chain of confirmation
writes follows. Reviews run before this gate and inspect the uncommitted
result; the coordinator owns final persistence verification.
Each task moves through explicit lifecycle states — review-open, accepted,
accepted-with-residuals, persistence-pending, complete, or unfinished
(deferred, blocked, exhausted) — and only a confirmed complete gate allows
the next task's selection and counts the task, exactly once, toward the
completed-task limit; a clean review alone never completes a task. Both
`accepted` and `accepted-with-residuals` are terminal task states, entered
only when every required task gate — every slice gate, every applicable deep
gate — has closed with the acceptance verified; the difference is whether at
least one slice gate closed with residuals (every open finding a nit under
the target's recorded settled standard, under a recorded settlement or
declaration). Only a slice-gate closure is terminal at the gate level: while
any later slice or required gate remains open the task stays `review-open`.
In both states, task persistence — `persistence-pending → complete` —
remains outstanding; the merged residual list rides the task persistence gate
and the final report, recorded as known limitations, not as open work.
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
were already finalized under the old one: their accepted work
may still be uncommitted or unpushed, and a gate satisfied under the old
policy does not excuse it. Only the persistence is reopened — reviews,
counters, the next action, and recorded evidence stay unchanged; existing
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
the coordinator's own reviews of the task use a range that starts at or
before the recorded pre-WIP base — preserved across resumes — so the WIP
commits are inside the diff. A
significant backlog
reconciliation — new or removed tasks, rewritten acceptance, reordered
upcoming tasks, or changed deferred packets — is committed
and pushed as a state-only checkpoint before further dispatch; routine
counter and state writes are not checkpointed. Checkpoint pushes follow the
same destination and safety rules as task pushes, and a failed or uncertain
checkpoint push — like any blocked persistence — goes directly to the
terminal local-only close: no further commits or pushes, all persistence
deferred until a resume reconciles the actual local and remote state.
When the last task completes and the goal is met, the same finalization
carries the run-close record in one completion commit. The snapshot stays as
the recovery checkpoint until that commit's persistence is confirmed under
the policy; only then does a separate bounded cleanup fold the remaining
state into the backlog's result records and remove the snapshot, recoverable
from git history. An incomplete stop keeps the snapshot as its resume state.
A blocked close stops with the persistence deferred
and reported as unconfirmed — never completed — until a resume reconciles
and confirms it.

When a task finishes, its working notes, scope notes, and fix specs are
deleted and the entry collapses to a 1-line `[x]` confirmed receipt — date,
outcome, product commit hashes, and the confirmed push destination when pushing
applies (plus any accepted known limitations). The run creates no default
archive, no append-only log file, and no round journal: Git history of
state-only commits is the audit trail, historical material stays untouched, and
completed prior-milestone receipts can be pruned or collapsed to a 1-line
summary at run or milestone close. State stays cleanly under host read
truncation via byte-based soft targets (~2–4 KiB for `.agenticale/active.md`,
compacting around ~6–8 KiB; ≤ 15–20 KiB for `BACKLOG.md`, compacting or
splitting future milestones around ~25–30 KiB) rather than hard line caps.
For runs that need to resume from a fresh clone, track `BACKLOG.md` and
`.agenticale/` in Git with the matching product changes or submodule pin.

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
- Optionally create `.agenticale/steering.md` (see
  [Steer a running goal](#steer-a-running-goal)) to pause and continue the run
  or reorder the next ready-task selection while it works. The file is
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
coordinator creates `.agenticale/active.md` and records the current slice
and its next action. With an active run, the same goal text steers the
run — adding explicitly requested tasks or adjusting continuation — instead
of starting a new one. Invoke `/autonomous` without goal text to resume the
active run's recorded `NEXT` action.

### Ask an AI agent to prepare the backlog

Give the agent the project, the desired outcome, and any constraints you
already know. You can add this instruction to your request.

```text
Prepare the project backlog for an Autonomous run. Read AGENTS.md if present,
the existing BACKLOG.md and .agenticale/active.md if present, and enough
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
with the delivery report. Live state stays in the active snapshot —
overwritten in place and pruned on every round settle so closed findings and
applied fix instructions are deleted immediately while open leftovers remain
intact, and completed tasks collapse to 1-line receipts in the backlog.

The narration follows the [same guidance as Work](../work/index.md#progress-narration):
short updates about outcomes, trade-offs, and verification, with model details
and counters surfaced when they affect a decision or you ask for them. For
example: "The new reader passes its compatibility checks. I'm assigning the
writer update next, keeping the old format readable during the transition."
These summaries add tokens in exchange for an easier-to-follow account of a
long task. The durable snapshot preserves the state needed to resume; the visible
updates help you understand how the work reached that state.

Two worker-round budgets and a completed-task limit bound the run. The
**run ceiling** (default **240** for a new run — an emergency safety limit, not
a work target — or the number you pass) limits worker rounds across the whole
run; the coordinator never auto-grows it, and an explicit ceiling is exact.
Each genuine task also has its own **task allowance** (default **24** worker
rounds). Every exploration, implementation, and fix round is charged once to
both budgets, and the effective remaining budget is the smaller of the two;
`review`, `review-deep`, and `consult` rounds consume neither budget. Only a
genuinely new task gets a fresh 24-round allowance — decomposition, replanning,
resume, and interruption recovery never reset consumed counters. The
**completed-task limit** (default **20**) counts a task only after its full
persistence gate is confirmed (deferred, blocked, exhausted, and review-open
tasks never count).

The run and task identities and consumed counters survive crashes, resumes, and
quota outages: each worker round is charged in `.agenticale/active.md` before
launch and settled on return, and a resume validates the snapshot against
committed Git state and host evidence (never guessing or zeroing counters). A
numeric budget on resume changes the run ceiling only.

When the run ceiling or completed-task limit is reached while eligible backlog
work remains, Autonomous makes an INCOMPLETE safety stop with a copyable
continuation prompt and offers to add `+N` rounds/tasks or stop preserving
current work. One task's exhausted allowance is not a run stop: pending review
of its completed changes still runs, the task is deferred resumable in
`BACKLOG.md`, and the run selects another truly independent ready task with a
fresh allowance (stopping only when no safe ready work remains).

Productive fix loops continue unattended while worker budget remains —
Autonomous never stops merely because a fix/review loop reached a fixed round
count. It stops or escalates only on genuine non-convergence (2 consecutive
no-progress worker rounds or repeated identical blocker; oscillation where
fixing A reopens B across 2 cycles; 4+ reviews opening only stylistic/wording
blockers after functional checks pass; or repeated root-cause invariant
failure). `review-deep` runs at periodic integration boundaries (milestone/release/2+
slices, API/contract/submodule changes, or 2+ repos / ~12+ files), as a
standing-in gate for high-risk slices, or once per session as an advisory
non-convergence diagnostic. `consult` (at most 1 per decision, 2 per session)
handles reversible technical deadlocks and style-drift second opinions.

The main loop runs unattended under the **anti-ask gate** and asks the user
only for: irreversible or `AGENTS.md`-reserved actions (force-push, deleting
branches, opening PRs/releases); ambiguous goal/scope/acceptance or destructive
replacement; exhausted run limits or blocked persistence destination/attribution;
or genuine non-convergence that a read-only `consult` could not settle. Surviving
blocking findings are never a permission ask while budget and progress hold.

When the host reports provider quota exhaustion, the coordinator records the
evidence, affected role, retry time, inspected partial progress, remaining work,
and next action in the snapshot. It waits about 30 minutes by default, or
longer when reliable provider reset metadata requires it, then resumes from the
inspected working tree. Up to eight quota retries without resumed progress are
allowed, with the count preserved across sessions and reset only after material
progress. A supported host wait can keep the session waiting; otherwise the
snapshot is ready for a later activation, without a promised automatic wakeup.

The coordinator may ask you to settle a meaningful behavior choice, provide
missing information, or clarify an ambiguous pull request destination. If a
round cannot proceed because of a permission or capability limit, it reports
the blocker and the choice needed to continue.

## Steer a running goal

You can steer a run while it works, through one small, optional, human-owned
file — `.agenticale/steering.md` — with exactly two documented controls and
no general command channel:

```markdown
- mode: continue
- priority: T3, T2
```

- The file is absent by default: no file means `continue` and no priority.
  The coordinator reads it; it never creates, edits, or deletes it, and
  children never touch it.
- `mode: pause` asks the run to stop at the next safe checkpoint: the
  currently running child is allowed to finish its round, its result and
  budget charge are recorded, and the exact next action and all counters are
  preserved before the loop stops with a pause report. Nothing is interrupted
  mid-round, and the workflow does not poll or run a watcher. The pause is
  persistent: it survives session ends and resumes. Set `mode: continue`
  (or remove the pause) and invoke `/autonomous` again to resume the recorded
  next action; a still-present `pause` stops a fresh activation again without
  dispatching. Only your own edit releases it — with no pause present, the
  run continues normally.
- `priority` is an optional comma-separated list of task IDs that reorders
  only the next task selection among ready tasks. IDs are assigned when
  tasks enter the backlog, so a recorded task that has never been selected
  can be named. Priority never interrupts the active task, and it never
  unblocks a blocked, dependent, unknown, or allowance-exhausted task —
  such IDs are skipped with a note.

The file belongs to you. The coordinator re-reads it before every new
round — workers, reviews, fixes, consults, and deep reviews alike — and never
edits it. Steering cannot grant budget, change scope,
authorize Git actions, or bypass a review gate; those stay with the normal
invocation and grant rules. Goal text in an invocation is a separate
explicit channel: it can add tasks or steer continuation under the
reconciliation rules above, and it is never written into the steering file.

For the detailed state, budget, review, and resume rules, read the
[Autonomous skill source](https://github.com/alefranz/AgenticAle/blob/main/skills/autonomous/SKILL.md)
and the shared
[round contract](https://github.com/alefranz/AgenticAle/blob/main/skills/work/references/rounds.md).
For setup, see [installation and client setup](../../setup.md); for the
everyday workflow, see [Work](../work/index.md).
