---
name: autonomous
description: "Run a long development goal in sequential worker and independent-review rounds with durable handoffs. Use only when the user explicitly asks for autonomous mode."
slash: true
disable-model-invocation: true
metadata:
  opencode/autoinvoke: false
---

# Autonomous mode

Read the [shared round contract](../work/references/rounds.md) before dispatching.
Follow its bundled skill loading rules and pass them to fresh children in the task
packet, including in the templates below. This workflow adds durable state and
unattended continuation to that contract; its state, reset, budget, and decision
policies below remain in force. Where this skill and the shared contract overlap,
the shared rules bind and this skill adds only the durable-state specifics.

Work a long goal in short, **sequential rounds**. Each round is one foreground
child subagent that receives everything it needs and returns a compact report. The
main loop only coordinates: it defines each round's task, persists the outcome in
the compact state, and stops when done or blocked. The goal is context management,
NOT parallelism — rounds never overlap.

Two modes: **standard** (one worker round per task with the coordinator's normal
verification, no independent review gate) and **strict** (worker round, then an
independent **review round**, looping until the review has no blocking findings,
before the next task starts). Choose the mode in round 0 and state it. Default to
**strict** for every task that changes code, configuration, tests, or other project
behaviour, including a single-task goal. Use **standard** only for investigation-only
work or when the user explicitly accepts skipping an independent review for a
low-risk, mechanical task. The number of tasks alone never justifies standard mode.

## Entry and arguments

Consume the invoking user's goal text directly as the invocation arguments:

- Leading option: an optional positive-integer worker-round budget. `--` is an
  explicit option delimiter; everything after it is the goal text, possibly empty.
  With no budget, the run uses the default ceiling of 240 worker rounds — a generous
  emergency safety limit, not a work target. The budget sets the run ceiling for the
  whole run; each genuine task keeps its own default allowance of 12 with the shared
  progress-based ceiling of 24 (see [Run and task budgets](#run-and-task-budgets)).
- Whenever the parsed goal text is empty — no arguments or a budget alone — RESUME:
  continue the exact one `NEXT` action recorded in the active state. If no active
  state exists, report that a new run needs goal text. A numeric budget on a resume
  changes the run ceiling only: persisted consumed counters carry over and are never
  reset, so a ceiling at or below recorded consumption leaves the run
  budget-exhausted rather than silently refreshed.
- A supplied goal with already-active state is steering, not a conflict (see
  [Invocation steering](#invocation-steering)).
- Start in **strict** mode unless the user explicitly requested standard mode.

In round 0, follow the setup rules: read the project's `AGENTS.md`, the active state
(`.agenticale/active.md`, or the legacy `.agenticale/handoffs/active.md` when only it
exists), `BACKLOG.md`, and recent relevant Git history. For a new goal, initialize the
state before round 1. For a resume, run the state protocol's reconcile event and
continue the exact one `NEXT` action. For a steering invocation, reconcile first, then
continue.

## Invocation steering

Goal text supplied while state is already active steers the run. It is user
instruction for the coordinator, not a replacement goal: reconcile it against a fresh
re-read of `BACKLOG.md` and the snapshot before dispatching, and never overwrite active
work to apply it.

- **New work.** Explicit new outcomes are decomposed into backlog tasks like a round-0
  plan: each genuinely new task enters the backlog with its stable ID before any
  selection and receives its fresh allowance only at first selection. When
  decomposition needs source evidence, dispatch a focused explore round.
- **Continuation steering.** Text that adjusts the existing goal — emphasis, clarified
  acceptance, added constraints, or an explicit reordering of upcoming work — updates
  the backlog's open entries and the snapshot's acceptance only where the user's text
  explicitly supports the change. Selection changes apply at the next selection
  boundary under the normal readiness rules; the active slice and any running round
  are never interrupted. A reorder that changes the durable plan is a significant
  reconciliation, checkpointed before further dispatch.
- **Preserved state.** Steering keeps the run identity, the run ceiling (unless the
  invocation supplies an explicit numeric override), every consumed counter, the task
  allowance in force (including recorded progress extensions), fix/review counters,
  deferred packets, and open review gates. It grants no allowance — only a named user
  grant does — and bypasses no gate, dependency, or safety boundary.
- **Destructive replacement.** An explicit, unambiguous request to discard or replace
  named work is honoured only for what it names, preserving unrelated tasks and
  historical material. An ambiguous destructive request — "start over" or "replace the
  goal" without naming what is discarded — stops and asks the user before any state is
  rewritten.

The invocation text never goes into the human-owned steering surface (see
[Live steering](#live-steering)). Record the reconciliation in the existing backlog and
snapshot, then continue the recorded `NEXT` action unless the reconciled plan changes it
at a selection boundary. A significant reconciliation is persisted as an immediate
state-only checkpoint before any further dispatch (see
[Reconciliation checkpoints](#reconciliation-checkpoints)).

## Task dispatch and capability

Before dispatching any round, select the actual runtime binding from
`../work/references/runtimes/` for the host actually being used, from the tools the host
exposes; never infer the runtime from a selected model name. Do this at start and on
every fresh resume.

The workflow never selects a model: on OpenCode the model and effort are baked into the
installed `agenticale/<role>` profiles at install time; on other surfaces the binding's
native fields carry a role assignment only where the host supports it and the
installation's preference file provides one. When the installation configures a
coordinator, the OpenCode command entry runs this workflow in the current session on the
`agenticale/coordinator` profile from the first turn, including on a fresh resume;
without one, the caller session's own model coordinates. A role whose installed profile
is missing or unreadable blocks only that role's dispatch, reported with the binding's
refresh procedure; an unavailable role never blocks unrelated work. The workflow creates
or modifies no configuration file; a missing preference file is normal. The only other
configuration evidence it may read is the install-ownership manifest the active binding
documents — read-only, at most once at activation, solely to establish whether a needed
optional route was configured in the current install inventory; it never resolves models
from that manifest and never modifies it. The selected preference file is read at most
once at activation and stays fixed for the activation; a fresh resume starts fresh, and
the prior state's model choices are diagnostic history that never override the current
installation — report a material change to a role's installed model selection. The
preference file's `## Work` allowance is Work-specific and never sets an autonomous
budget.

A role with no installed profile (or no binding support) must not silently inherit the
session model in place of a role the installation names. An explicit model request the
host cannot honour is reported as a limitation, never silently substituted; when native
metadata makes the effective settings available, record requested versus effective, and
a child's self-reported model name never establishes what it ran on. A configuration
change takes effect only at the next fresh resume: it never changes an already-running
child, never resets budgets or review counters, never bypasses quota recovery, and never
authorizes automatic provider switching.

Route each round to a fresh child carrying the matching task contract from the work
skill's [references/tasks/](../work/references/tasks/) directory, selected by the shared
[routing policy](../work/references/rounds.md#routing-policy), which binds this workflow
exactly as it binds reviewed task work:

| Round purpose | Task contract |
| --- | --- |
| One-question source discovery | [explore](../work/references/tasks/explore.md) |
| Implementation slice (default) | [implement](../work/references/tasks/implement.md) |
| Explicitly prescribed, bounded, mechanically verifiable slice (only when configured) | implement contract on `implement-easy` |
| Hard implementation slice — visible correctness risk | implement contract on `implement-hard` |
| Review-findings fix pass | [fix](../work/references/tasks/fix.md) |
| Hard fix pass — concurrency, durability, state-machine, ownership reasoning | fix contract on `implement-hard` |
| Per-slice independent review | [review](../work/references/tasks/review.md) |
| Integration audit / escalated slice review | [review-deep](../work/references/tasks/review-deep.md) |
| Second opinion on one bounded focused decision | [consult](../work/references/tasks/consult.md) |
| Focused decision with conflicting evidence, interacting constraints, or costly reversal (only when configured) | consult contract on `consult-hard` |

Route selection follows the shared routing policy exactly: `implement` is the default;
`implement-easy` only when configured AND the slice is explicitly prescribed, bounded, and
mechanically verifiable; `implement-hard` dispatches directly — no consultation first — when
the slice's correctness risk is visible, assessed per slice with no category exemptions and
reassessed at every slice boundary and fresh resume (earlier dispatch records are diagnostic
history, not a route lock); a hard fix keeps the fix task role and the fix counters,
dispatched on `implement-hard` with the bounded fix contract carried explicitly in the packet
(or an equivalently scoped implement contract where the installed profile body differs),
recording task role, dispatched role, and the reason. An unconfigured optional route falls
back to its base route; never silently substitute a stronger or weaker role, and surface a
requested role the binding cannot honour. Independent review is required even when every role
runs the same model. Hard slices are prime candidates for the deep review escalation below.

## Non-interactive child sessions

Child sessions are deliberately non-interactive: their prompts forbid questions and
nested delegation, and the child must not wait for user input. Consequences for the
coordinator:

- Compose every round prompt so it needs no user decision; when a choice cannot be made
  locally, state the choice to make in the prompt itself.
- If a report comes back `blocked` on a decision, take the Decision consultation path:
  one second opinion first, and a question to the user only for irreversible actions,
  user preference, or a consult that does not commit. Never route a user-facing question
  through a child subagent.
- A tool denial inside a round is a report item, not a retry: re-scope the next round or
  handle the path from the main loop.
- The main loop runs unattended and defaults to a documented assumption recorded in the
  state. Questions to the user are reserved for the stop conditions below (guard breach,
  irreversible action, a consult that could not settle a standard-setting question, same
  task blocked twice) — never for routine continuation or a preference the state can
  decide.

## Core rules (do not break)

1. **The main loop is a coordinator, not a worker.** It does not implement. It reads just
   enough to define the next round, then delegates. The only exceptions are coordination
   edits to the existing state files, persisting child reports into that state, and the
   Git actions of the run's persistence boundaries.
2. **One child at a time, strictly sequential.** Round N+1 starts only after round N's
   report has been read. Never run rounds in parallel or in the background.
3. **State lives on disk, not in the conversation.** The backlog, the snapshot, and git
   history or working-tree diffs are the single source of truth. A round never inherits
   another round's details; it re-reads the state and recent history itself.
4. **Each worker round is one small, verifiable slice that follows the active git
   persistence policy.** A slice has exactly one behaviour or investigation question, one
   observable acceptance condition, and a defined stop boundary. It may touch every file
   or repository required for that one outcome, but never absorbs a newly discovered
   adjacent task. If the next task is bigger than one round, split it in the prompt —
   never ask a subagent to "do the rest".
5. **The coordinator is the only state writer.** Children return concise structured
   reports — including compact reset evidence when they reset — and never write the
   backlog, the snapshot, the steering file, or any operational file. The coordinator
   persists the report's relevant content before dispatching the next round. The snapshot
   is a compact checkpoint, not a journal: it carries the current state and the evidence
   recovery needs, never a growing round ledger.
6. **Reset before a round sprawls.** When a worker reaches a reset trigger, it returns
   compact reset evidence in its report and ends. The coordinator persists it and starts
   a *fresh* subagent from the snapshot; it never asks the old worker to keep exploring.

## State files and ownership

Resolve these paths from the project root used to start or resume the run; create the
`.agenticale/` directory when first writing to it. Only the coordinator writes them.

- `BACKLOG.md` is the compact operational board: the run identity and its limits (run
  ceiling, default task allowance and progress ceiling, completed-task limit) in a short
  header; each task's stable ID, title, dependencies, governing decisions, and
  acceptance; compact resumable packets for deferred unfinished tasks, carrying the
  task's own counters; one- or two-line result records for completed tasks (date,
  outcome, product commit hashes, confirmed push destination when pushing applies); and
  exactly one active next action. The completed-task count is derived from the confirmed
  result records, never a separate tally. The backlog never mirrors the active task's or
  the run's consumed counters — those live once in the snapshot. Keep it normally below
  about 150 lines.
- `.agenticale/active.md` is the compact active checkpoint — the snapshot. It is at most
  ~2 KB and contains `GOAL`, `ESTABLISHED`, `CURRENT STATE`, `ACCEPTANCE`, and exactly one
  `NEXT` action; a reset adds a compact `TRIED` section. `CURRENT STATE` carries the
  single budget line — run identity, ceiling, consumed; active task ID, allowance in
  force (including any recorded progress extension), consumed; the open target's
  fix/review counters — plus the pending-charge evidence while a charged child is in
  flight (dispatch record and pending-dispatch note: round number, role, task ID), the
  compact persistence state of an open gate, and the current slice's evidence. The
  snapshot is not a journal: settled rounds fold into compact backlog task results; the
  snapshot keeps only what the next round and recovery need. Create it before the first
  round of a session if absent. A role's model selection, where the active binding
  exposes it, is an `ESTABLISHED` fact of the activation, not a new state file.
- `.agenticale/steering.md` is the optional human-owned steering file (see
  [Live steering](#live-steering)). It is absent by default; the coordinator reads it and
  never writes it.

**No default archive.** Completed task detail lives in the backlog's result records; the
run creates no monthly archive and no session-close archive paragraph. Historical
material — legacy handoffs, existing archives, old session records — is preserved
untouched: never rewritten into a lossy summary, never deleted, and read only by an exact
pointer when a decision needs it.

**Legacy state compatibility.** A run may carry the legacy layout:
`.agenticale/handoffs/active.md` as the active packet and a human-owned `## Steering`
section in `BACKLOG.md`. On resume, when the new snapshot is absent and a legacy packet
exists, make the one-time transition: validate the legacy packet, carry its identities,
consumed counters, allowances in force, fix/review counters, open gates, and recorded
persistence policy exactly into the new compact snapshot — no reset, no re-derivation —
and continue under this contract. The legacy file itself is historical material: never
auto-edited, migrated away, or deleted. When both packets exist, a valid new snapshot
wins and the legacy packet stays untouched. A torn or missing packet — new or legacy —
follows the reconcile event's recover-or-stop rule. Legacy steering compatibility and
precedence are defined under [Live steering](#live-steering).

## Git persistence policy

Choose and record one persistence policy in round 0, then pass it verbatim to every child:

- **Commit and push (default for a new run):** the invocation itself authorizes
  committing and pushing each completed task, the stop-boundary WIP checkpoints that
  preserve attributable unfinished work, and the state-only checkpoints of significant
  reconciliations.
- **Commit:** the user explicitly restricts the run to commits, or repository
  instructions require commits but do not authorize pushing. Coherent task commits are
  still required before the next task; nothing is pushed.
- **Working tree:** the user explicitly asks to leave changes uncommitted, or repository
  instructions forbid commits. Leave verified changes in the working tree and identify
  them with `git status` and `git diff` evidence.

Explicit user or repository restrictions win over the default: adopt and record the
restricted policy with its basis, and follow it — never bypass a restriction to satisfy
the default. A restriction is an actual prohibition or limit, cited concretely (the user
text or the instruction) when the policy is recorded. A conditional guard such as "do not
commit or push unless explicitly asked/authorized" is not a prohibition: the explicit
autonomous invocation is that request, and it satisfies the guard's condition for the
run's authorized persistence boundaries. Neither Work's uncommitted default (a different
workflow), nor the children's no-commit rule (a role boundary — the coordinator owns
Git), nor the coordinator role itself is a basis for a restricted policy; without a
concrete cited prohibition the new-run default stands.

State the chosen policy and its basis visibly at the start of a run and on every fresh
resume, and warn explicitly when the policy leaves accepted work uncommitted or unpushed:
commit-only leaves every commit unpushed; working-tree leaves accepted changes uncommitted
and unpushed. A resume — empty or numeric — and a steering invocation keep the recorded
policy; a working-tree or commit-only run never silently gains push rights. A handoff with
no recorded policy predates the commit-and-push default and resumes as working tree,
stated with that warning — never silently upgraded.

Only an explicit user request changes an active run's policy, recorded with its basis.
When the user changes the active policy to commit or commit-and-push, reconcile
outstanding persistence under the new policy before any further dispatch. Re-evaluate the
run's completed tasks against the new policy, not the former one: a task finalized under
working-tree or commit-only policy satisfied its gate under that policy, but its accepted
product work can remain unpersisted under the new one. Reopen every such task, including
tasks whose completion record is already finalized; a former-policy finalization never
satisfies the new-policy gate. A task whose accepted work is already fully persisted under
the new policy's scope is left untouched.

The reopening is persistence-only: closed reviews and verdicts, consumed counters, the
recorded `NEXT`, and historical evidence stay unchanged — no re-review, no rework, no new
slice. The coordinator reconciles it itself, dispatching no child and consuming no
budget, under the ordinary destination, scope, and failure rules, in a fixed, finite
order:

1. Each reopened task goes through the [task persistence gate](#task-persistence-gate)
   in completion order: existing product and recorded WIP checkpoint commits are verified
   and reused, never re-committed; only the missing persistence is created — coherent task
   commits for accepted working-tree changes, the confirmed ordinary push under
   commit-and-push, and exactly one bounded state-only finalization updating the existing
   completion record with the confirmed hashes and destination.
2. A significant reconciliation not yet persisted under the new policy receives its
   [reconciliation checkpoint](#reconciliation-checkpoints): an existing checkpoint commit
   is reused — pushed as-is under commit-and-push, never re-created. A finalization
   commits the changed durable state not yet committed, so it carries the landed edits of
   an earlier uncommitted reconciliation; the checkpoint creates a commit only for
   reconciliation state no finalization or earlier checkpoint already carried, and
   confirms already-persisted state read-only — never a second commit for the same state.
3. Under commit-and-push, any remaining unpushed run commits — such as WIP checkpoints of
   open or deferred tasks — are pushed as-is in dependency order and confirmed.

Throughout, reconcile the actual local and remote state: a commit already confirmed on
the remote is never duplicated or re-committed, and a confirmed push is recorded, not
repeated. A rejected, failed, or uncertain push follows the failure rules below: record
the exact persistence state, stop local-only, and defer the remaining reconciliation to a
reconciling resume.

The coordinator owns every commit and push: worker, fix, review, and review-deep children
leave their verified changes in the working tree and never commit or push them. The
coordinator applies the policy at every persistence boundary the run defines — the task
persistence gate, the stop-boundary WIP checkpoints, the reconciliation checkpoints, and
the final close — product changes in coherent task or WIP checkpoint commits, and the
run's durable state in bounded state-only commits, committing changed repositories in
dependency order and updating any outer-repository pins. Later rounds refer to commit
hashes when commits exist; otherwise they use the recorded baseline plus changed-file and
diff evidence. Work on the already checked-out branch unless the user explicitly asks for
a new branch or repository instructions require one; a request to commit does not imply
creating a branch. The policy authorizes ordinary task commits and pushes only: creating
a branch, opening a pull request, merging, force-pushing, changing remotes, and publishing
a release remain separate, explicit actions. Never silently strengthen the recorded
policy. The policy authorizes Git at the run's defined persistence boundaries — not a
commit for every edit, slice, or round.

### The bounded persistence sequence

Every state-only persistence boundary — a task gate finalization, a reconciliation
checkpoint, the stop close, and the final close — ends with this one bounded sequence,
defined here once; the boundary sections name it instead of restating it.

1. Write the boundary's record into the existing state files, each a targeted edit on a
   fresh re-read, read back to confirm it landed.
2. Under commit or commit-and-push policy, create exactly one state-only commit
   containing the run's changed durable state (`BACKLOG.md`, `.agenticale/`) — never
   product changes or unrelated work. With no changed durable state, no commit is created.
3. Under commit-and-push, push it to the resolved destination and verify success.
4. The commit's own hash is never written back into the state files it commits — later
   records reference it read-only from git history — and the local acknowledgment that the
   boundary is satisfied is a read-only verification, not another state write. The
   sequence is finite: no record-your-own-hash loop exists.

The boundary is satisfied only when its finalization is confirmed under the active
policy. An interruption anywhere in the sequence is reconciled before any next-task work,
on every resume: re-read the durable persistence state, inspect the actual local history
and the remote read-only (fetch or ls-remote), and establish which steps already happened.
A commit already on the remote — confirmed by ancestry or content, never assumed — is not
duplicated or re-committed; a push that already succeeded is recorded, not blindly
repeated. Resume the exact unfinished step first: push an existing unpushed commit as-is,
complete missing record writes from the confirmed hashes and destination, and treat a
confirmed finalization as satisfying the boundary without any further write. Identities
and consumed counters are unchanged by every persistence reconciliation.

**Failed, uncertain, or blocked persistence is terminal for the run.** A rejected, failed,
or uncertain push — of product commits, of a WIP or reconciliation checkpoint, or of a
state finalization — or a destination that stops the push before it runs, never advances
the run: record the exact persistence state — the task or boundary, commit hashes,
destination, and the push evidence or error — in the snapshot and backlog, keep every open
task open, and stop with the continuation prompt via the terminal local-only close (see
Final report). No further commit or push follows it in this run: a later WIP or
finalization push would carry the uncertain commit as a descendant, an implicit retry. Do
not select the next task, force-push, merge or rebase automatically, retry blindly, or
change the destination; a non-fast-forward rejection means the remote moved; preserving
the state and asking is the recovery, not rewriting history. All further persistence is
deferred to a reconciling resume, which reconciles the actual local and remote state
before any next work under the interruption rules above.

### Task lifecycle states

Once selected, a task is in exactly one lifecycle state. The state — not a worker's report
or a clean review — governs next-task selection and completion accounting:

| State | Entry condition | Next-task selection | Completed-task count |
| --- | --- | --- | --- |
| review-open | Work in progress; a required slice review, fix loop, or applicable deep gate is still open. | Never — the task stays active. | Never |
| accepted | Every required check, review gate, and applicable deep gate has closed; the persistence gate has not yet run. | Never — the gate runs first. | Never |
| persistence-pending | The gate is underway: a required product commit, its push, or the bounded state finalization is outstanding or unconfirmed. | Never — finish or reconcile the gate first. | Never |
| complete | The whole persistence gate is confirmed under the active policy, including the bounded state finalization. | Allowed at the next selection boundary. | Counts exactly once |
| deferred / blocked / exhausted | Unfinished, with a resumable packet or open findings preserved in the backlog. | Only via documented deferral: another truly independent ready task may be selected safely. | Never |

Invariants:

- A clean review closes a slice gate, never the task: review-open → accepted still leaves
  the persistence gate outstanding. An accepted or persistence-pending task is never
  reported completed or counted, and the next task is never selected while its required
  commit or push is outstanding or unverified.
- The only paths to a selection boundary are a confirmed complete gate and a documented
  deferral or block of the active task — the outgoing packet durable in the backlog before
  the snapshot is overwritten. A deferral is never a completion bypass: the unfinished
  task stays incomplete and uncounted, and an exhausted task's permitted review of its
  completed changes remains schedulable under the unchanged review rules.
- The completed-task count is derived from the backlog's confirmed result records — one
  count per task whose gate is confirmed — never a separate tally. Reconciling an
  already-confirmed gate on resume adds no second count; a persistence-only reopen under a
  policy upgrade (complete → persistence-pending) never double-counts the task when its
  gate re-closes.
- State transitions reconcile from actual Git evidence and are replay-safe: a step already
  confirmed is recorded, not repeated — no duplicate commits and no record-your-own-hash
  loop. After a rejected, failed, or uncertain push, no descendant commit or push follows
  in this run. An interruption in any state resumes the exact unfinished step before any
  next-task work.
- A WIP checkpoint changes no lifecycle state: a review-open or deferred task stays
  unfinished and uncounted. A run completes only when every backlog task is complete; a
  limit stop with eligible work remaining, or any blocked, exhausted, or otherwise
  unfinished task, is an incomplete stop — never a completed run.

### Task persistence gate

Slices and tasks are different units: a slice is one worker round's bounded outcome with
its own review gate; a task is the backlog outcome, which may contain several slices. The
gate carries the task from accepted through persistence-pending to complete, once per
completed task, under the active policy; an explicit policy upgrade re-evaluates it for
completed tasks whose accepted work is unpersisted under the new policy.

1. **Required checks and reviews are complete.** Every slice has passed its required gate
   — the strict review gate, or standard mode's normal verification — and every applicable
   deep review gate, periodic or opportunistic, has closed. An unfinished or review-open
   task is never persisted as completed.
2. **Coherent task commits.** The coordinator stages only the task's accepted product
   changes and creates coherent task commits — one per logical change, not one per agent
   round. Unrelated staged, unstaged, and untracked work, concurrent human edits, and
   secrets are preserved and never swept into a task commit; overlapping edits that cannot
   be attributed to the task safely stop and ask. An investigation-only task produces
   findings, not product changes: it creates no artificial product commit; when its
   findings change the durable state, the finalization persists them like any other state
   change, and with truly nothing to persist the gate is satisfied by the recorded
   findings. The run's durable state is never swept into product commits. When part or all
   of the accepted product changes already sit in recorded WIP checkpoint commits from an
   earlier stop, those commits are the task's product commits for the changes they carry:
   verify their attribution and coherence, never re-commit or duplicate them, and commit
   only the remaining accepted working-tree delta. The push and the completion record
   include the WIP hashes, and every review of the task uses a range whose lower bound is
   the recorded pre-WIP base or earlier, so the WIP commits are inside the diff — never
   excluded by a base that already contains them.
3. **Confirmed ordinary push.** Under commit-and-push the coordinator pushes the task
   commits with ordinary Git semantics to the resolved destination and verifies success.
   Under commit-only or working-tree policy this step does not apply; the recorded policy
   is never bypassed.
4. **Bounded state-only finalization.** Once the product persistence is confirmed — the
   push under commit-and-push, the commits under commit-only, the recorded diff evidence
   under working-tree — the coordinator applies the
   [bounded persistence sequence](#the-bounded-persistence-sequence) with the completion
   record as its record write: the backlog task result line carrying the product commit
   hashes and, when pushing applies, the confirmed destination, and the snapshot updated
   with the confirmed persistence state and one `NEXT` action. The gate is satisfied only
   when this finalization is confirmed under the policy; the next task is selected only
   after that.

Record the persistence state as it advances — accepted, committed (product hashes), push
pending or confirmed (destination and evidence) — in the snapshot, persisted before the
next step, so an interruption at any step resumes exactly there. A task whose required
commit or push — product or finalization — is outstanding or unverified is never reported
as completed, and the next task is never selected.

**Consolidated final close.** When the task whose gate just closed is the run's last
remaining task and the goal is met, the same finalization also carries the run-close record
and the snapshot cleanup below — one bounded state-only commit, not a separate task
finalization followed by a session-close commit. A run that stops incomplete keeps the
snapshot as its resume state; the stop close persists the stop records without deleting it.

**Snapshot cleanup.** The snapshot is removed only after verified successful final
persistence of a completed run: its remaining content is folded into the backlog's result
records, and the deletion rides in the run's one final state-only commit, confirmed under
the policy. The deleted snapshot stays recoverable from git history; a failed or uncertain
final push leaves the local commit and its history untouched under the terminal local-only
rules, and a reconciling resume pushes the existing commit as-is — the cleanup is never
lost and never repeated. Under working-tree policy no commit exists: fold the content into
the backlog results, read them back, and only then remove the snapshot, recording both
changes as diff evidence. Never delete the snapshot while any task is unfinished or any
required persistence is unconfirmed, and never as a standalone cleanup step before the
final records are durable.

**Push destination.** Resolve the destination before the run's first push and re-check it
at every push: the checked-out branch's configured upstream (remote and branch), plus any
destination named by repository instructions. Push only to that resolved upstream. Stop
and ask the user before pushing when the destination is unsafe or unclear: the branch is
`main`/`master` or otherwise protected by repository instructions or hosting rules, no
upstream is configured, multiple remotes make the target ambiguous, or the outgoing commits
include work outside the authorized scope. The run's completed-task commits and recorded
WIP checkpoint commits are authorized outgoing scope — a WIP checkpoint is pushable even
while its task's review is open — but unrelated or unreviewed unauthorized commits are not;
they resolve the publication scope first (ask). Never create a branch, change remotes,
force-push, merge, or open a pull request to make a push succeed.

### Stop-boundary WIP checkpoints

A stop that ends the session preserves attributable unfinished product work, not only the
durable state. Under commit or commit-and-push policy, the coordinator creates one WIP
checkpoint commit per changed repository, staging only the unfinished product changes
attributable to the run's tasks — including review-open changes. The commit message
identifies the checkpoint explicitly: a `WIP:` prefix naming the run identity and the task
IDs whose changes it carries (for example `WIP: csv-export T2 — slice 2, review open`).
Unrelated staged, unstaged, and untracked work, concurrent human edits, and secrets are
preserved and never swept into a WIP commit; overlapping edits that cannot be attributed to
a task safely stop and ask, leaving the changes in the tree. With no attributable
unfinished product changes, no WIP commit is created.

A WIP checkpoint is never task completion: the task stays open or deferred, its review and
persistence gates are unchanged, and nothing is recorded as completed. Under
commit-and-push the coordinator pushes the WIP commits with ordinary Git semantics to the
resolved destination and verifies success; under commit-only it creates the commits and
pushes nothing; under working-tree policy — including a legacy handoff with no recorded
policy — it creates no commit and records the diff evidence instead. The push destination
and outgoing-scope rules above apply unchanged.

At the stop close the checkpoint comes first — unless persistence is already blocked, in
which case the close creates no commits and attempts no pushes: create the WIP commits and
push them under the policy, then write the stop records, then apply the bounded persistence
sequence to them. The durable record — in the snapshot and on the backlog task entries —
carries, per task, the WIP commit hashes, the pre-WIP review base (the commit immediately
before the task's first WIP checkpoint commit in each repository), the verification and
review status (what passed, what is still open), the push state (confirmed destination, or
deferred with its evidence), the consumed counters, and exactly one resumable `NEXT`. A WIP
commit contains only product changes; the state records reference its hashes read from Git
history.

The pre-WIP review base is preserved across resumes and reused: every review of a
checkpointed task — slice review, re-review, or deep review — uses a range whose lower
bound is that base or earlier, so the WIP commits and every later working-tree delta are
inside the diff. A resumed session's start boundary never replaces the earlier recorded
base, and work accepted before the base is not re-reviewed. The base governs the task's
reviews until its persistence gate closes.

A rejected, failed, or uncertain WIP push defers all remaining close persistence: write the
local records with the exact state — WIP hashes, destination, push evidence or error —
without waiting on further persistence, create no finalization commit and attempt no
further push (a descendant would carry the uncertain WIP push), keep every task open, and
stop terminally with the continuation prompt under the failure rules above. A resume
reconciles the WIP checkpoint and the finalization under the bounded sequence's
interruption rules, never duplicating commits.

The checkpoint is a coordinator Git action at a stop the coordinator actually reaches: it
dispatches no child and consumes no worker, review, or consult budget, and it never
launches work beyond the limits that produced the stop. When the coordinator itself is
interrupted or quota-exhausted before checkpointing, no persistence is promised — recovery
reconciles whatever durable state and Git evidence exist, exactly like an interrupted gate.

### Reconciliation checkpoints

A significant reconciliation of the durable plan is persisted immediately, before any
further dispatch. A reconciliation is significant when it changes the plan rather than
recording progress: it adds or removes a backlog task entry, rewrites an open task's
acceptance or scope, reorders upcoming backlog tasks, changes a deferred packet, or
replaces the basis of the active next action — as an invocation steering reconciliation or
a material replan can. A significant reorder is a plan change even when no task's text
changes. Routine state writes — counter charges, settled results, dispatch records, and
persistence-state records — are never reconciliation checkpoints. The human-owned
`priority` control is a selection hint, not a plan rewrite: it reorders only the next
selection among ready tasks and creates no durable plan change by itself, so it needs no
checkpoint; a steering invocation that rewrites the backlog's task order does.

After the reconciliation's targeted edits land in the existing state files, the coordinator
applies the bounded persistence sequence to the changed durable state and confirms it
before dispatching any further round: one state-only checkpoint commit — never product
changes or unrelated work — pushed and verified under commit-and-push. Under commit-only
the checkpoint commit is created but not pushed; under working-tree policy no commit is
created and the recorded diff evidence identifies the reconciled state. The push
destination, outgoing-scope, and failure rules apply unchanged: a rejected, failed, or
uncertain checkpoint push — or a blocked destination — stops the run before any further
dispatch via the terminal local-only close, and a resume reconciles under the bounded
sequence's interruption rules — pushing an existing checkpoint commit as-is, never
duplicating it — before any dispatch. Like every persistence boundary, the checkpoint
dispatches no child, consumes no budget, and leaves identities and consumed counters
unchanged.

## Run and task budgets

Two durable worker-round budgets bound every run, and a separate completed-task limit
bounds how many tasks one run may finish:

- **Run ceiling** — the whole run's worker-round budget: the default 240, or the positive
  integer supplied at invocation. The default is a generous emergency safety limit, not a
  work target: the run processes eligible backlog tasks until the backlog is drained or a
  safety limit is reached. The ceiling changes only by the user's explicit numeric override
  or a named grant; the coordinator never auto-grows it, and an explicit ceiling is exact.
- **Task allowance** — each genuine task's own worker-round budget, default 12, with the
  shared
  [progress-aware contract](../work/references/rounds.md#progress-aware-budgets-and-continuation)'s
  progress-based hard ceiling of 24: when the normal allowance is reached with verified
  progress evidence, the coordinator records a bounded extension up to that ceiling before
  dispatching further worker rounds — automatically, without a permission ask, and never on
  code churn. It is independent of the run ceiling and of the Work preference file's
  `## Work` allowance, which never sets an autonomous budget. An explicit user task limit or
  the boundary of a named grant is an exact cap that never auto-extends; only a user grant
  extends a specific task's allowance beyond its ceiling, as a named increment.
- **Completed-task limit** — default 20 completed tasks per run, separate from both worker
  budgets. A task counts toward the limit only after its task persistence gate is fully
  satisfied, including the bounded state finalization; deferred, blocked, exhausted,
  review-open, and WIP-checkpointed tasks never count. Reaching the limit while eligible
  backlog work remains is an INCOMPLETE safety stop, never a completed run. An explicit user
  instruction may set a different limit, recorded in the durable state; it never auto-grows.

**Named grants.** Only the user extends a budget beyond its cap, through a named increment:
it adds exactly the rounds it names — worker rounds (fix rounds are worker rounds) to the
named budget (run ceiling or task allowance), and review rounds only against an explicit user
review limit. A grant never resets counters and grants no scope, review, or Git rights beyond
what it names; the resulting boundary is an exact cap that does not auto-extend. A consult
cannot grant any increment.

Every explore, implement, and fix round — including a reset continuation or a
malformed-report correction — is one worker round charged to BOTH the current task and the
run. Exploration that defines a task belongs to that task's allowance. The effective
remaining worker budget is the smaller of the task's remaining allowance in force and the
run's remaining ceiling; a worker dispatch needs at least one effective round. Review,
review-deep, and consult rounds do not consume either worker budget. Consult rounds keep
their unchanged caps — one per decision, two per session. Review and review-deep rounds
keep their own accounting and are bounded by the shared review-justification rules, not a
fixed per-target pass count; per-target fix/review cycle counts are not authorization gates
in this workflow (see
[Fix continuation and review justification](#fix-continuation-and-review-justification)).

Only a genuinely new task receives a fresh task allowance. Decomposing a task, replanning
it, resuming it, steering it, or recovering it from an interruption keeps the same task
identity and the same consumed counters; none of them replenishes the task allowance or the
run ceiling, and none erases a recorded progress extension or its evidence. A renamed or
re-outlined slice of the same task is not a new task.

### State protocol

The single authority for counter and state-transition bookkeeping: five events —
**charge**, **settle**, **switch**, **reconcile**, **finalize** — over the two existing
state files. Every other section names the event it applies instead of restating its
procedure. The protocol adds no state file, helper script, or runtime capability: the
coordinator executes it with ordinary targeted file edits and Git commands.

**Files and authority.** Counter authority is single and explicit. The snapshot's budget
line is the only place the run's consumed count and the active task's consumed counters
live; the backlog never mirrors them. The backlog is canonical for the run identity and
limits (its header), the deferred tasks' packets and counters, the completed result records
from which the completed-task count is derived, and the single active next action. A
deferred packet carries the task's own counters, never a run-consumption snapshot, so a
stale task snapshot can never restore a stale run count. Counters record consumption;
remaining is derived from the ceiling or allowance, never stored as a second number that
can drift. The open target's fix/review counters live in the snapshot (or the deferred
packet when deferred) and persist as evidence without reset or re-identification on resume
or rename.

**Write discipline.** Every event step is a targeted edit applied to a fresh re-read of the
file it writes, read back to confirm it landed before the next step; each step writes one
bounded state block, never a whole-file overwrite from a stale copy. Every `BACKLOG.md`
write preserves any concurrent human edit. The steering surface is human-owned and never
agent-written (see [Live steering](#live-steering)).

**Identities.** Round 0 assigns the run a stable identity (a short slug recorded in the
backlog header and the snapshot) and records the run ceiling and the completed-task limit.
Every task receives its stable task ID (`T1`, `T2`, … in recording order) when it first
enters the backlog — in the round-0 plan, an invocation steering reconciliation, or when a
round's report defines a new task — before any selection, so steering can name a task that
has never been selected. An ID is not an allowance: a genuinely new task's fresh allowance
is allocated only at its first selection, and readiness still governs eligibility. The ID
travels with the task through the backlog, the snapshot, dispatch records, and the result
records.

**Progress extension.** A progress extension is a recorded allowance increment, not a
reset: the coordinator writes the new allowance and its verified-progress evidence into the
snapshot before the next worker dispatch, under the same write discipline. Consumed
counters, per-target fix/review evidence, and the stall and blocker safeguards are unchanged
by an extension. A resume continues the recorded allowance in force and consumption
unchanged; a replay of productive work keeps its recorded charge.

**Charge — before launching a worker round.** One worker round is charged to BOTH the
current task and the run; which rounds are worker rounds and the effective-remaining rule
are defined under [Run and task budgets](#run-and-task-budgets). After the steering
re-read, with at least one effective worker round remaining and any justified progress
extension already recorded:

1. One snapshot write carries the incremented run and task counters, the dispatch record,
   and the pending-dispatch note (round number, role, task ID).
2. Read it back: the charge is durable and verified.
3. Launch the child. A child never launches before its charge is durable and verified.

Review, review-deep, and consult rounds are recorded under their own accounting and never
debit either worker budget; they carry no worker charge.

**Settle — when a round ends.** Resolve the pending note in the snapshot and record the
round's compact outcome: the current state and evidence the next round needs stay in the
snapshot; the settled result folds into the backlog task's compact result/progress note.
Each worker round is charged exactly once, with one of these outcomes:

- A productive round keeps its single charge, even when it is later interrupted or ends in
  a reset.
- A confirmed quota-only launch with no resumed work removes its pending charge (see
  [Provider quota recovery](#provider-quota-recovery)); it consumes no allowance.
- A confirmed never-launched dispatch removes its charge, restores the pre-launch counters,
  and resolves the note as never-launched: no round ran.
- A continuation is a new round with its own single charge — against both budgets for a
  worker role, under the role's own accounting for review, review-deep, or consult.

Never charge the same round twice, and never let a replay of productive work run free of
its recorded charge. A crash or session loss leaves the pending record durable; the
reconcile event resolves it against the working tree and host evidence before dispatching
again.

**Switch (A → B) — at a selection boundary.**

1. Write A's deferred packet — with its current counters from the snapshot's budget line —
   into the backlog's deferred entries. The outgoing packet is durable before the snapshot
   is overwritten, so no interrupted step loses a packet.
2. Write B's packet into the snapshot, restoring B's task counters from its backlog packet
   (or a fresh allowance for a genuinely new task) and carrying the run identity, ceiling,
   and consumed unchanged from the outgoing budget line.
3. Update the backlog's single active next action.

**Reconcile — at every launch and fresh resume, before dispatching.**

1. Re-read the snapshot and `BACKLOG.md` fresh.
2. Validate the snapshot as a complete, coherent whole before trusting any of its numbers.
   It must be intact — its sections present, including exactly one `NEXT` — and its budget
   line coherent: every consumed count is backed by the snapshot's own records — a complete
   pending-dispatch record (dispatch record plus pending-dispatch note) for an in-flight
   round, or the recorded outcome of a settled one. A readable budget line alone is not a
   valid state: incremented counters with no backing record are a torn charge write, not
   consumption.
3. A validated snapshot wins. If the backlog also holds a deferred packet for the active
   task ID, a switch was interrupted mid-sequence — the snapshot wins, remove the duplicate
   deferred entry (it was copied from or restored into the snapshot, so nothing is lost),
   and continue the active task; selection is reassessed at the next boundary. Never delete
   a deferred packet because of an unvalidated snapshot.
4. A missing, torn, or incoherent snapshot — including a torn charge write whose readable
   prefix shows incremented counters — is rebuilt only from verified prior evidence: the
   last committed state in git history (the snapshot and backlog versions carried by the
   run's state-only commits), the backlog's deferred packets for task counters (never for
   run consumption), recorded WIP hashes and review bases, and host or working-tree evidence
   of the rounds launched since that committed state. Apply each verified round's outcome
   exactly once under the settle outcomes. If the exact consumed counters cannot be
   established from that evidence, stop with the continuation prompt naming the gap — never
   guess, never reset counters to zero, and never recompute consumption from a ledger or
   from memory.
5. Resolve any pending dispatch, or host/working-tree evidence of a round launched after the
   recovered counters, exactly once under the settle outcomes: material work keeps or
   applies the single charge; a confirmed quota-only launch removes or never applies it; a
   complete pending charge whose child never launched — no host or working-tree evidence of
   a launch — is removed, its note resolved as never-launched, and the pre-launch counters
   restored, because no round ran. Persist the reconciled state.

An interrupted persistence step — a commit, push, or finalization — reconciles under the
bounded persistence sequence's interruption and failure rules instead; identities and
consumed counters are unchanged by every persistence reconciliation.

**Finalize — confirm a persistence boundary.** Apply the
[bounded persistence sequence](#the-bounded-persistence-sequence). For the task gate, the
completed-task count increments exactly once at that confirmation, and the next task is
selected only after it.

**Resume.** A resume — the same invocation with empty or numeric arguments — runs the
reconcile event first, then continues the exact one `NEXT` action the validated state
names: the exact unfinished step of an interrupted event or persistence boundary, never a
replay of confirmed work. A resume reads the persisted identities and counters and
continues them; it never resets counters and never re-issues task IDs. A numeric resume
override changes the run ceiling only: remaining becomes the new ceiling minus the
persisted consumption, floored at zero. When persisted consumption already meets or exceeds
the new ceiling, the run is budget-exhausted and stops under the allowance-stop rules
instead of silently resetting. A user grant adds exactly the named rounds to the named
budget — run ceiling or task allowance — and never resets counters.

**Examples.** (a) Torn charge write: the pre-launch snapshot write tears after the
incremented counters but before the dispatch record and pending note, leaving a readable
budget line of run 4, T1 4 while the last committed state reads run 3, T1 3 (a run started
with an explicit ceiling of 6). No child launched — the charge was never verified. The
resume finds the increment unbacked, rebuilds from the committed state (run 3, T1 3),
repairs the snapshot, and dispatches the round with one new charge: run 4, T1 4 after the
first actual round. Treating the readable 4 as consumption and then charging would reach 5
for one actual round — unverified counters are never trusted. (b) Interrupted switch:
exhausted T1 (12/12 under an exact user-set task cap) has its deferred packet durable in the
backlog when the session dies before the snapshot is rewritten. A complete, coherent
snapshot still names T1: the duplicate deferred entry is removed and T1 stays active until
the next selection boundary, where it is worker-ineligible and the loop defers it again and
selects ready T2. A torn or incoherent snapshot instead rebuilds T1 from its deferred packet
— never deleted on the strength of a torn snapshot — and the run consumed from the verified
committed state or host evidence; if that consumption cannot be established, the resume
stops rather than guessing. (c) Missing snapshot: the file is gone entirely. The resume
rebuilds from the last committed state plus verified host and working-tree evidence of the
rounds since, applying each round's charge exactly once; with no evidence sufficient to
establish the exact counters, it stops with the continuation prompt naming the missing
evidence — never a fresh zeroed run.

### Task exhaustion is not a run stop

When a task's allowance in force is exhausted — at the progress ceiling, or at an exact
explicit cap, with no further extension justified under the shared contract — dispatch no
further worker round for that task and exclude it from worker selection until a user grant
extends its allowance, so an exhausted deferred task cannot repeatedly win selection.
Verification and the permitted review of its completed changes still run under the
unchanged review rules and remain schedulable; an unfinished task is still not reviewed as
if complete. Whatever remains unfinished stays incomplete: record the findings, the current
state, and exactly one next action, and keep the task's packet resumable in the backlog.
The run may then select another truly independent ready task, which receives its own fresh
allowance — even while the exhausted task's unfinished changes remain in the tree.
Selection never bypasses a review gate, a dependency, or a safety boundary: a task that
depends on the unfinished work, or whose changes cannot be safely separated from it, is not
ready, and no task is manufactured to spend remaining budget. When no safe ready task
remains, the run stops under the stop conditions — an incomplete stop whenever unfinished
tasks remain. The run itself stops for budget only when the run ceiling or the
completed-task limit is exhausted.

## Setup (round 0, done by the main loop)

1. Parse the goal, the round budget, the mode, and the git persistence policy. A new run
   defaults to commit and push per completed task; only an explicit user or repository
   prohibition selects the commit-only or working-tree policy instead, recorded with its
   concretely cited basis — a conditional "unless explicitly asked" guard is satisfied by
   the invocation, not a restriction. A resume or steering invocation keeps the recorded
   policy unless the user explicitly changes it; a legacy handoff with no recorded policy
   resumes as working tree. If no budget was given, use the default run ceiling of 240
   worker rounds — the emergency safety limit; do not auto-grow an explicit ceiling.
   Strict-mode review rounds are cheap and are not counted against the worker budget.
   Assign the run identity, record the ceiling, the default task allowance of 12 with its
   progress ceiling of 24, and the completed-task limit of 20, and state all four parsed
   choices, the persistence policy's basis, and — when the policy leaves accepted work
   uncommitted or unpushed — the explicit warning.
2. Read only what is needed to define round 1: the active snapshot (or, only while
   initializing it, the first active next action in `BACKLOG.md`; or the legacy packet when
   only it exists), the steering surface when present, `AGENTS.md` conventions when that
   file exists, and `git log --oneline -5` in each repo the work touches. Historical handoff
   prose is audit material: read it only by an exact pointer, never as general archaeology.
   Do NOT read source code — that is what the subagents are for. Before defining round 1,
   run the brief material-risk assessment: which independently mutable sources the request
   would touch (local working trees, remote branches or pull requests, persisted state such
   as databases or caches) and which of them other actors can also mutate; external side
   effects that would survive an interruption; concurrent humans; ownership-sensitive
   cleanup; and compatibility surfaces. The signals justify a focused explore round or
   decomposition, not a long planning round. When source evidence is needed to define a
   round, dispatch the focused explore round with its one question and stop condition
   instead of reading source itself.
3. Follow Task dispatch and capability above. For a resume, compare the current installation
   against the recorded dispatch records first and report a material change to a role's
   model selection. Record the model selections the binding exposes in the snapshot's
   `ESTABLISHED` facts; the workflow creates or modifies no configuration file.
4. State the plan in 3–6 lines: goal, budget, mode, persistence policy, how the work splits
   into slices, and stop conditions. Record the planned tasks in the backlog with their
   stable IDs now, before any selection; allowances are allocated later, at first selection.
   Then start round 1 without waiting for approval; pause only on a stop condition below.

## Live steering

The human can steer a running goal through one small, optional, human-owned file —
`.agenticale/steering.md` — with exactly two documented controls and no unrestricted command
channel:

```markdown
- mode: continue
- priority: T3, T2
```

- The file is absent by default: no file means `continue` and no priority. The coordinator
  reads it; it never creates, edits, or deletes it, and children never touch it.
- `mode` is `continue` (the default when the file or the line is absent) or `pause`. Only
  the exact value `pause` pauses the run; an unrecognized value changes nothing and is noted
  in the next report.
- `priority` is an optional comma-separated list of task IDs. It reorders only the NEXT task
  selection among ready tasks: named ready tasks are considered first, in listed order, then
  the remaining ready tasks in their normal backlog order. IDs exist from the moment a task
  enters the backlog, so a recorded task that has never been selected can be named; an ID
  absent from the backlog is unknown. Priority never interrupts the active task or a running
  round, and it never makes a blocked, dependent, unknown, worker-ineligible
  (allowance-exhausted), or otherwise not-ready task selectable; such IDs are skipped with a
  recorded note.

The coordinator re-reads the steering surface immediately before every new round dispatch —
worker, review, fix, consult, and deep review alike. Steering grants no allowance, scope,
Git right, or gate exception; content beyond the two documented controls is not an
instruction the loop executes. Invocation goal text is a separate explicit user channel (see
[Invocation steering](#invocation-steering)); it is never written into the steering surface.

On `pause`, the loop stops at the next safe checkpoint: a running child is allowed to settle
(rounds are strictly sequential, so at most one is in flight), its result and charge are
recorded, and the snapshot preserves the exact `NEXT` action and all counters. The loop then
stops with a pause report and the continuation prompt. It never interrupts a child
mid-round, polls the file, or starts a watcher or service. **The pause is persistent**: it
survives session ends and resumes. A fresh activation re-reads the surface: `continue` (or
an absent file) resumes the recorded `NEXT`; a still-present `pause` stops again without
dispatching. Only the human's own edit — setting `continue` or removing the pause — releases
it; continuation is normal when no pause is present. A pause noticed during a quota cooldown
wait is honored before the next launch after the wait; the wait itself keeps its existing
deadline rules.

**Legacy steering compatibility.** A legacy run may carry the human-owned `## Steering`
section in `BACKLOG.md` with the same two controls. The coordinator reads it when the new
steering file is absent, and never edits it. When both surfaces exist, `pause` in either
pauses the run (pause wins); `priority` comes from the new file when it defines one,
otherwise from the legacy section; a disagreement is noted in the next report, and neither
surface is ever auto-edited to resolve it. The one-time transition is the human's own act —
creating `.agenticale/steering.md`, optionally copying the controls — never the
coordinator's: the agent never migrates, rewrites, or deletes human steering content, and
the legacy section stays untouched as history when the new file exists.

## Task loop

Tasks come from the round-0 plan, an invocation steering reconciliation, the backlog's
active next action, or the previous round's report.

Before every new round dispatch — worker, review, fix, consult, or deep review — re-read the
steering surface (see [Live steering](#live-steering)) and the snapshot's budget line. A
`pause` stops the loop at the safe checkpoint described there. A worker dispatch
additionally needs at least one effective worker round — the smaller of the task's remaining
allowance in force and the run's remaining ceiling; apply the state protocol's charge event
before launching the child. When the allowance in force is reached and verified progress
evidence justifies continuation, record the bounded extension first (shared contract), then
dispatch under the new allowance.

Task selection happens only at a selection boundary — the current task complete through its
persistence gate, or documented as deferred or blocked — never mid-task. The run processes
eligible backlog tasks until the backlog is drained or a safety limit is reached: at each
boundary where a task has just completed, check the completed-task count against its limit
before selecting further work. Apply the steering priority among ready tasks, then the
normal backlog order. A ready task is one whose dependencies and review gates are satisfied
and whose changes can be safely separated from any unfinished work in the tree. Worker
selection additionally requires worker eligibility: at least one effective worker round
remains for the task under both its allowance in force and the run ceiling. An
allowance-exhausted task is not worker-ready and is skipped with a recorded note even when
steering names it first, while the permitted review of its completed changes remains
schedulable under the review rules. Selecting a genuinely new task allocates its fresh
allowance (its stable ID was assigned when it entered the backlog); returning to a deferred
task restores its recorded packet, identity, and counters — including any recorded progress
extension. Example: steering lists exhausted T1 before ready, truly independent T2 — the
loop records T1's skip, selects T2, and may still dispatch T1's permitted review; it never
dispatches a worker round for T1, never bypasses a gate, dependency, or conflict, and never
manufactures a task.

Apply the shared contract's
[sequential decomposition](../work/references/rounds.md#sequential-decomposition) within a
task when useful, including after exploration or consultation. Keep the short provisional
sequence in the existing backlog and the current slice's acceptance, evidence, and one next
action in the snapshot. Reassess after each slice or inconclusive attempt before dispatching
the next assignment; record rejected experiments and reconcile their changes before the next
slice. This adds no state files and does not reset budgets, review counts, or stop
conditions. Strict mode gates each changed slice; standard mode retains its normal
verification policy. The deep review gates below still govern escalation; decomposition adds
no per-step deep review. Apply
[the shared contract's checkpoint](../work/references/rounds.md#checkpoints-decision-summary-and-stop-reports)
after every substantive worker or reviewer result, and its progress narration guidance
before each substantive dispatch, including the first: what was learned, what comes next,
and why. Keep the compact state in the snapshot's `CURRENT STATE`; routine dispatch records
and counters belong in that state, not in every visible update.

For each current slice or discovery assignment:

1. **Worker round.** Compose a self-contained prompt from the worker template. Invoke one
   foreground child carrying the matching task contract (see the dispatch rules above).
   Check the report against a quick verification (`git -C <repo> status` and, when
   applicable, `git -C <repo> log -1`). If the host result proves provider quota exhaustion,
   handle it under [Provider quota recovery](#provider-quota-recovery) before report repair
   or interruption handling. Otherwise, if the report is missing, malformed, or its claims
   do not match, send one correction round with the observed discrepancy — do not restart
   the task.
2. **Reset/handoff gate.** If the report hit a reset trigger, persist its compact reset
   evidence, record the outcome, and start the next worker as a fresh investigation,
   diagnostic, or implementation round from the snapshot. A reset is normal progress and
   counts as one worker round; do not make it a free, hidden continuation. Do not review an
   unfinished task. If host evidence shows quota exhaustion, use Provider quota recovery
   before applying this gate.
3. **[strict] Review round.** Compose the review template with the task definition, the
   worker's compact report, and its commit hashes or recorded change range. A fresh child
   carrying the review contract verifies independently and reports findings; the coordinator
   records the verdict in the durable state. See "Review gate" below.
4. **Gate.** In strict mode a slice is only accepted when a review round returns no blocking
   findings. Otherwise send a fix round and re-review. After a clean gate, check the
   opportunistic deep review escalation triggers below before recording the slice accepted.
5. **Record the outcome.** An accepted slice that leaves the task unfinished continues with
   the task's next slice. When the task's last slice is accepted and its applicable deep
   gates have closed, satisfy the task persistence gate — coherent task commits, a confirmed
   ordinary push, and the bounded state-only finalization under the active policy — before
   the next task is selected.

### Provider quota recovery

Inspect the host's terminal child or dispatch result for a provider-reported usage quota or
rate-limit exhaustion before applying malformed-report correction or ordinary
interrupted-round handling. Treat explicit host/provider evidence such as `The usage limit
has been reached` as quota evidence. A generic crash, timeout, cancellation, permission
denial, authentication failure, or billing/account suspension is not quota evidence; follow
the existing error or stop policy for those cases. Do not infer quota exhaustion from
silence or a child's unverified claim when host status is available. This policy applies to
all dispatched child roles, including workers, reviewers, fixers, explorers, consultants,
and deep reviewers.

When quota exhaustion is established, first confirm that the child is terminal and has no
background work still running. Never overlap a replacement child with a live one. Persist a
`QUOTA RECOVERY` record in the snapshot: affected role and slice, exact evidence, observed
time and retry time, whether work began, the next concrete resume action, and the
consecutive no-work quota-retry rejection count. The initial quota failure starts the outage
sequence with this count at zero, even if the child made partial material progress before
being interrupted; it is not one of the cooldown retry rejections. Honor reliable provider
retry/reset metadata when it gives a later time; otherwise use a 30-minute cooldown. Do not
assume all providers share a four-hour usage window. The cooldown and counters survive
session resumes and handoff repairs.

Read the current time from a reliable clock and compare it with the persisted retry time.
Never launch before that deadline, including after a fresh session or an early return from a
wait. Inspect the current host's actual tool surface for a supported, timer-backed
foreground wait. If available, wait for the remaining duration, composing multiple waits
only as needed to stay within the tool's supported duration. After every return, re-read the
clock and recompute the remaining time; do not busy-poll, probe children, or dispatch early.
User input may interrupt a wait: an explicit request to stop or cancel pauses or stops the
task according to that request while preserving the cooldown and work; a status request or
correction alone does not cancel recovery and must still respect the deadline. If elapsed
time cannot be measured reliably, or no supported timer-backed wait is available, preserve
the exact retry time and resume action in the snapshot and stop cleanly for a later
activation; do not attempt coordinator work while the coordinator itself is quota-exhausted.
Do not claim an automatic wakeup or invent scheduler support. Runtime bindings do not
promise a common wait or wakeup capability, so report it as unavailable unless the active
host exposes it.

Before resuming, inspect the actual working tree, including untracked files and partial
edits. The fresh child validates the snapshot against that state and continues from its one
`NEXT` action; it must not reset files, discard work, or reimplement the whole assignment
based only on the interrupted report. If the snapshot is missing or stale, the coordinator
may repair it from verified tree and tool evidence without dispatching another child.
Preserve role policy: a reviewer stays read-only, and Git actions remain governed by the
existing authorization rules. Completed changes still require the ordinary verification and
review gates.

The coordinator persists small durable checkpoints at natural progress points from child
reports, including before a long action likely to cross a provider usage window; each child
returns completed work and evidence, remaining work, and exactly one next action so a fresh
child can make forward progress rather than replaying the task. Resolve the pending-dispatch
record under the state protocol's settle event: a productive round keeps its single charge
(worker roles against both budgets, review, review-deep, and consult under their own
accounting), and a confirmed quota-only launch removes its pending charge. A quota rejection
with no resumed work is quota only even if the host created a child session before returning
the rejection; a pure quota-blocked launch or cooldown wait is not a malformed-report
correction, a second interruption, or a no-progress failure, and it must not erase genuine
prior no-progress evidence either. The run and task identities, the consumed counters, and
the pending-dispatch evidence survive the outage and every resume.

Allow at most eight automatic cooldown retries after the initial quota failure. Count only
quota rejections from those retries that find no resumed material progress: retry 1 raises
the count from zero to one, through retry 8 raising it to eight. Persist the count across
sessions and failed probes; a fresh activation does not start a new set of retries. Reset it
only after a resumed child makes material progress. At eight, stop with a resumable snapshot
and the next retry action; a later activation may make one fresh probe after the recorded
time, but another no-work rejection leaves the count capped at eight, records the new retry
time, and stops again without an automatic retry loop. A quota interruption after resumed
material progress starts a new sequence at zero, including when the productive child was
interrupted after partial progress. Quota waits and quota-only launch failures do not count
as two consecutive task blockers. When a resumed child makes material progress, its
productive round is charged under the settle event's normal role accounting. All normal
worker, fix, review, consultation, budget, and stop limits otherwise remain in force.

### Interrupted-round recovery

If the host ends a child before it produces a valid report (e.g. a turn/step ceiling or an
interruption), do not treat the task as complete or count a forced summary as a completed
task. Record the interruption in the snapshot (for example `R4: work progress — interrupted;
fresh handoff required`), start a fresh child of the same role from the snapshot plus the
interrupted child's final summary, and require it to first validate or repair the compact
state before doing one concrete `NEXT` action. This is a normal reset, not a malformed-report
correction and not an automatic retry loop. Account the interrupted round and its
continuation under the state protocol's settle and charge events: the recorded charge stands
for material work, and the fresh continuation is a new round with its own single charge
(worker roles) or under the role's own accounting (review, review-deep, consult). Neither
the interruption nor the reset replenishes any budget or re-issues the task identity. For
example, a review child interrupted mid-verdict is replaced by a fresh review child over the
same range: the continuation is a review round under the unchanged review rules, not a
worker round, and the run and task consumed worker counters stay unchanged. If the same task
is interrupted twice without a material decision or persisted outcome, stop and report it as
blocked.

When host/provider evidence identifies quota exhaustion, use the quota recovery path above
instead of recording an ordinary interruption. Quota-only waits and launch rejections do not
trigger this section's repeated-interruption limit.

## Deep review gates

A clean per-slice review proves a slice; it does not reliably expose mistakes at the seams
between slices. A deep review is one foreground round with the review-deep contract, run
only after the current slice has passed its normal gate. It is an integration gate, not a
full repository audit and not a replacement for the strict per-slice reviewer. Review-deep
rounds do not consume the worker-round budget and are recorded as
`R<N>: review-deep clean|findings`. Two trigger families govern it:

**Periodic gate.** Run one deep review after the first applicable trigger:

- three accepted implementation slices since the last deep review;
- a milestone, release, or session-close boundary after two or more accepted slices;
- an accepted slice changes a public API, package/dependency identity, cross-repository
  contract, or submodule relationship; or
- the accepted range spans two repositories or roughly twelve non-handoff files.

Do not run it for a one-slice investigation, a docs-only session, or merely because a normal
reviewer emitted a non-blocking nit. Give the audit the exact commit or diff range since the
preceding deep review (or session start), the accepted-slice summaries, affected
repositories, and the cross-slice acceptance commands.

**Opportunistic escalation.** After a slice passes its normal review gate, run one deep
review over that slice's commit or diff range when any of these is true:

- the slice touched a high-risk surface per the dispatch rules —
  concurrency/async/cancellation/timing behaviour, the cross-repository contract surface,
  subtle shared-state behaviour, or security-relevant code paths (this includes every hard
  implementation slice);
- the slice needed at least two fix rounds — a struggle signal that worker and reviewer
  share a blind spot, whether or not a later review pass eventually passed; or
- the user explicitly asks for a deep review on this slice.

Use a single-slice audit range. Budget guard: run at most one opportunistic escalation per
session. If a further trigger fires, record it in the snapshot as a deferred-escalation note
and let the periodic gate pick it up on its normal cadence. The user may always direct an
additional escalation explicitly. Consult rounds are capped at two per session, separately
from the escalation and re-audits.

**Shared continuation rules.** When the range covers a task with recorded WIP checkpoint
commits, its lower bound is the recorded pre-WIP base or earlier — a resumed session start
never truncates historical WIP out of the range — and the recorded boundary is reused across
resumes. The audit must independently run the relevant integrated verification and inspect
the whole supplied range. Blocking findings each receive a dedicated fix round — a worker
round under the state protocol's charge event. Judgmental findings are followed by a fresh
deep review scoped to the fix delta and the invariants it touched, while mechanical-only
rounds close by local verification (see the Review gate's finding-class rules). Re-audits
are not capped at a fixed per-target count: each follows a productive fix and runs under the
same review-justification rules (see
[Fix continuation and review justification](#fix-continuation-and-review-justification)).
The worker budget gates the next fix, not the review: the required deep re-review of the
last allowed judgmental fix still runs when zero effective worker rounds remain. For
example, the run's last worker round is a judgmental fix to a deep finding: its fresh deep
re-review dispatches under the review accounting with both worker budgets at zero, and a
blocking verdict surviving it is handled by the exhaustion rules — the re-review is never
skipped for lack of fix budget. When a blocking verdict survives the re-review with no
effective worker round left for another fix — or a progress safeguard fires — follow the
stop conditions (an exhausted run ceiling stops the run; an exhausted task allowance defers
the target) instead of asking the user to authorize another cycle. An unjustified re-audit
of unchanged evidence is prohibited; a required integration gate or bounded
interrupted-review recovery may justify a same-range review, but a review-only loop may not.
The coordinator promotes every non-blocking nit to a `BACKLOG.md` checkbox before closing
the audit.

## Decision consultation (independent second opinion)

This skill runs unattended, so the escape hatch for a decision the loop cannot settle is not
a question to the user: it is one foreground round with the consult contract — an
independent second opinion. When a stop condition below would end in "ask the user a
question" about a reversible judgement decision (a blocked task, surviving blocking findings
after a fix, a standard-setting question, or any decision the state cannot settle), the main
loop may run one consult round instead of asking. A consult is also warranted before the
loop commits to a clear, direct, complex choice — a bounded focused decision whose framing
benefits from independent review — not only when the loop is stuck.

Where the installation configures the `consult-hard` route, dispatch the consult on it
directly when the decision's character is apparent: conflicting evidence, interacting
constraints, or a costly reversal. It is read-only, carries the same consult contract, and
consumes the same consultation allowance as an ordinary consult; when the route is not
configured, the decision runs on `consult`. A requested stronger advice the host cannot
honour is surfaced as a limitation, never silently substituted.

Give the consult exactly one decision: the question, the candidate options with what each
does to scope, budget, and risk, what was already tried and why it failed, the acceptance
conditions, and the cheap checks it may run. It returns one recommendation with a confidence
level; the main loop may adopt it. Adoption is recorded like any other decision: a consult
outcome plus a state note citing the consult round and its report, marked as an
**independently advised decision the user can veto later**.

Consult does NOT apply to: irreversible actions (force-push, deleting branches, publishing a
release or pull request — those stop and ask), user preference or taste (ask), and anything
`AGENTS.md` reserves to the user. A low-confidence consult, or one that hedges despite its
format, counts as no answer: ask the user. At most one consult per decision and two per
session. Consult rounds do not consume the worker-round budget.

A consult settles a reversible technical or design decision within the allowances that
remain; adopting its recommendation never starts a round the budgets do not cover. The fix →
review loop is gated by the effective worker budget, verified progress, and the stall
safeguards — each fix is a worker round charged to both budgets — not by per-target cycle
counts. Review, review-deep, and consult rounds keep their own accounting and stay
dispatchable after worker-budget exhaustion when justified, including the permitted review
of an exhausted task's completed changes. A consult cannot grant an allowance or justify a
correction beyond the budgets: evidence-backed task extensions within the progress ceiling
follow the shared contract, and any extension beyond them — past an explicit cap, the run
ceiling, or the completed-task limit — is a user-only decision through a named increment,
never delegated to a consult. An exhausted task allowance alone is not a run stop (see
[Task exhaustion is not a run stop](#task-exhaustion-is-not-a-run-stop)). When the limits
that govern the next needed round are hit, stop under the stop conditions and offer the user
the named increment the continuation needs instead.

## Reset and handoff gate

End a worker round and start a fresh subagent when the first of these occurs:

- **Two hypotheses failed**, or the same build/test failure remains after one targeted fix
  and rerun.
- **Three consecutive exploratory actions** (search, read, probe, comparison) produced
  neither a material decision nor a persisted implementation.
- The work changes from implementing the assigned behaviour to understanding a new
  subsystem, upstream-parity question, package-origin question, or cross-repository
  dependency.
- The next action is no longer concrete from the task's original acceptance condition.
- At a natural checkpoint, the worker cannot state the next action, evidence, and stop
  boundary compactly enough for a fresh agent to resume without rediscovering material
  context. This is a judgement call; do not reset just because a productive build, test, or
  verification sequence used many tools.

For a reset, the worker changes no unrelated code and returns compact reset evidence in its
report: established facts with file or command evidence, `TRIED` (disproved hypotheses),
current state (commits/files/tests), and one `NEXT` action for a fresh agent. The coordinator
persists that evidence into the snapshot (`GOAL`, `ESTABLISHED`, `TRIED`, `CURRENT STATE`,
`NEXT`) before dispatching the fresh child. A discovery round has one question and a decision
criterion; its conclusion becomes the next implementation round.

Use known repository paths with `git -C {REPO}` where practical. Never hide a failed `cd` or
verification with `2>/dev/null`; a navigation failure is a blocker to report, not noise to
suppress.

## Review gate

Apply the shared round contract's independent review, finding classification, and re-review
closure. Its progress-aware continuation rules apply here with durable counters (see
[Fix continuation and review justification](#fix-continuation-and-review-justification)
below). In strict mode every implementation slice must pass that gate before work advances.
A re-review reports each prior finding by ID as fixed, partially fixed, still open, or
regressed; when the acceptance involves recovery or interruption behaviour, require the real
user entry or command selection and the interruption boundary around external side effects,
not only internal method tests. A violation of this workflow's required persistence,
handoff, or submodule-pin policy is also blocking. The coordinator records verdicts and nits
in the durable state from the review report; the reviewer writes no operational file.

A small pre-existing finding may receive a separately scoped fix round; otherwise preserve it
in the backlog without expanding the current task. Mechanical findings close after the
coordinator runs their sufficient acceptance check; judgmental findings require independent
re-review of the fix and affected invariants. Consultation and the autonomy envelope below
govern stuck decisions.

### Fix continuation and review justification

The shared contract's
[progress-aware continuation](../work/references/rounds.md#progress-aware-budgets-and-continuation)
and [review/fix gate](../work/references/rounds.md#review-and-fix-gate) bind this workflow
unchanged: per-target fix/review cycle counts — including the historical two-fix/three-review
and two-re-audit defaults — are not authorization gates; the effective worker budget,
verified progress, and the stall safeguards bound the fix → verify → re-review loop, which
continues unattended (a fourth or later productive fix needs no permission ask); every review
needs changed evidence, a required integration gate, or bounded interrupted-review recovery;
and the required review of the last allowed fix still runs at zero worker budget. This skill
adds only the durable-state specifics below.

**Durable counters, no loopholes.** Fix and review counters stay durable per-target evidence
in the snapshot (or the deferred packet). They survive resumes, replans, renames, and
interruption recovery unchanged; nothing resets or re-identifies them. Counts recorded under
the historical default caps are retained as evidence, but those legacy defaults never re-gate
a resumed run. An explicit user limit recorded in the durable state — a user-set cap or the
boundary of a named grant — remains binding, never auto-extends, and stops the loop when
reached.

**Safeguards and exhaustion.** The shared stall safeguards stop the loop regardless of
remaining budget: two consecutive unproductive worker rounds, the same blocker two rounds in a
row, the repeated-interruption limit, and the repeated-invariant rule below. When the
effective worker budget is exhausted, dispatch no further fix; surviving blocking findings
keep the target incomplete and review-open. An exhausted run ceiling or completed-task limit
stops the run (an INCOMPLETE safety stop whenever eligible work remains), offering the named
increment a continuation needs; an exhausted task allowance alone defers the target and the
run continues with another truly independent ready task (see
[Task exhaustion is not a run stop](#task-exhaustion-is-not-a-run-stop)).

**Repeated findings on the same invariant.** Classify first. A genuinely unmet invariant is a
real design defect: reopen the plan through the checkpoint's replanning signal with the
original acceptance and the target's fix/review counters intact, no scope weakening. Only when
the behaviour already meets acceptance and later rounds merely tighten the standard is it a
standard-setting question: settle it once — take a consult (see Decision consultation), codify
the recommended standard as an independently advised decision the user can veto, apply it
everywhere, and stop iterating against the drift. Neither path resets counters or weakens
scope.

**Autonomy envelope.** The coordinator continues the loop without asking while all of these
hold: the work stays docs/config-only or is reversible under the active persistence policy;
deep review stays within one opportunistic escalation per session with every re-audit
justified; consults stay within two per session; the effective worker budget covers the next
fix (including any justified extension) and no safeguard or explicit user limit has fired; and
no irreversible action is required. Both worker budgets gate worker dispatch only: an
exhausted task allowance defers that task, not the run, and an exhausted run ceiling stops
worker dispatch while the permitted review of completed changes still runs. A consult never
grants an allowance — only the user can, through a named increment. Breach any guard, or reach
an irreversible action — stop and ask. Asking is for guard breaches, irreversible actions, and
what a consult could not settle — not for routine continuation inside the envelope.

## Worker prompt template

```
You are round {N} in an autonomous work session, {MODE} mode.
Budgets: run {RUN_ID} {RUN_USED}/{RUN_CEILING} worker rounds used; task
{TASK_ID} {TASK_USED}/{TASK_ALLOWANCE} used (allowance in force; progress
ceiling {TASK_CEILING}). This round is charged to both.
Work in the {REPO} repository at {PATH} (branch {BRANCH}). Related repos:
{OTHERS}.
Git persistence policy: {WORKING TREE | COMMIT | COMMIT AND PUSH, WITH BASIS}.

Goal (context only — you do only your task): {GOAL}

First read:
- {AGENTS.md path}, if it exists (follow its working conventions); otherwise
  skip this item
- {SNAPSHOT path}, section "{SECTION}" (current state and handoff)
- recent history: git -C {REPO} log --oneline -5
{any extra files, the previous round's NEXT line, or the review's
blocking findings list if this is a fix round}

Your task this round (scope: exactly this, nothing more):
{TASK}

Round budget: end and return compact reset evidence after two failed
hypotheses, after three consecutive exploratory actions without a decision,
when the task becomes a different investigation, or when a compact handoff
would let a fresh agent continue more clearly. Do not reset merely because a
productive verification sequence used many tools. Do not continue in this
context after a reset trigger.

Before you finish you must:
- verify your work ({BUILD/TEST COMMANDS});
- leave your verified changes in the working tree in every repo you changed:
  the coordinator owns every commit and push at the run's persistence
  boundaries, in dependency order, including applicable outer-repository pins.

You write NO operational state: do not edit the backlog, the snapshot, the
steering file, or any handoff — return the handoff facts in your report and the
coordinator will persist them. For a long-running assignment, report small,
verified progress checkpoints at natural milestones and before a long action
likely to cross a provider usage window: completed work, evidence, remaining
work, and one concrete next action, so the coordinator can persist a checkpoint
a fresh child can resume without replaying the assignment. For a read-only
exploration assignment, return the handoff facts in your report instead of
editing files.

Do not start any other task. Do not ask questions and do not wait for user
input — make a reasonable choice within this task and record it as an
ASSUMPTION in your report. If a reset trigger occurs, return compact reset
evidence (established facts, TRIED, current state, and one NEXT) in your report
and stop so the coordinator can persist it and start a fresh subagent. The
steering surface (`.agenticale/steering.md`, or the legacy `## Steering`
section of `BACKLOG.md`) is human-owned: never edit it.

Your final response must be the report and nothing else, in exactly this
format, under 15 lines total:
STATUS: done | progress | blocked
SUMMARY: <= 3 lines — what changed
EVIDENCE: commands run with results; git status/diff or commit hashes per repo
TRIED: only for progress/blocked — failed hypotheses or "none"
NEXT: one concrete next step
BLOCKER: only if blocked — what is missing and what decision is needed
```

## Reviewer prompt template (strict mode)

```
You are the independent reviewer for a completed task in an autonomous work
session. You did NOT do the work. Assume nothing the worker claims; verify
everything yourself. You make NO code changes and write NO operational state.
You are unattended in a child session: never ask the user anything; if the
evidence cannot settle a claim, record it as a blocking finding.

Task that was supposed to be completed (verbatim): {TASK}
Worker's self-report (unverified — check every claim): {REPORT}
Changes to review: {COMMIT HASHES OR BASELINE + WORKING-TREE DIFF per repo}
Git persistence policy: {POLICY}

First read:
- {AGENTS.md path}, if it exists (follow its conventions); otherwise skip
- {SNAPSHOT path}, section "{SECTION}"

Independently verify:
1. Build/tests: run {BUILD/TEST COMMANDS} yourself.
2. Persistence discipline, at the phase of the supplied range: the task
   persistence gate runs only after the reviews close, so at slice review the
   task's changes are normally still uncommitted. The range may instead include
   recorded WIP checkpoint commits from an earlier stop: the supplied lower
   bound precedes them (the recorded pre-WIP base), so they are part of the
   task's diff — inspect them within the supplied range, and treat their WIP
   identification as unfinished status, never as completion or a satisfied
   gate. Inspect status and diffs; verify no child committed or pushed them,
   and that unrelated work and secrets stay out of the task's changes. When the
   supplied range already includes commits (a re-review after the gate), verify
   coherent task commits and cleanliness, and verify a confirmed push to the
   resolved destination only when the recorded persistence state says the push
   already happened — never require a commit or push the gate has not performed
   yet; the coordinator owns that final verification at the gate. Check that
   any outer-repo submodule pins match committed dependency changes.
3. Scope: inspect the stated commit or diff range; changes match the task,
   nothing beyond it, no drive-by refactors. Do not turn this into a
   repository-wide architecture, upstream-parity, or origin audit unless that
   was the assigned task.
4. Conventions: {relevant AGENTS.md rules when present}.

Return your verdict in the report only; you write no handoff, backlog, or
operational note. The coordinator records your verdict and nits in the durable
state and owns final persistence verification after the review and deep review
gates close and the task persistence gate is satisfied. You never mark the task
completed. The steering surface is human-owned: never edit it.

Your final response must be the report and nothing else, in exactly this
format, under 20 lines total:
VERDICT: clean | blocking findings
BLOCKING: one line per finding — what, where (file/commit), required action
NITS: one line each (or "none")
EVIDENCE: the commands YOU ran with results
```

## Deep review prompt template

```
You are the independent integration auditor for accepted autonomous-mode
slices. You did NOT do the work. Make no product-code changes and write no
operational state. You are unattended in a child session: never ask the user
anything; if the evidence cannot settle a claim, record it as a blocking
finding.

Audit range: {COMMIT OR DIFF RANGE} across {REPOS}.
Accepted slices: {COMPACT_SLICE_SUMMARIES}
Integration acceptance: {BUILD/TEST COMMANDS and contract checks}
Prior audit or session boundary: {BOUNDARY — never later than a recorded pre-WIP base in the range}

First read:
- {AGENTS.md path}, if it exists; otherwise skip this item
- {SNAPSHOT path}, section "{SECTION}"

Independently verify the supplied range only: cross-slice correctness and
compatibility, integrated build/tests, compliance with the active git
persistence policy at the range's phase (the uncommitted working-tree result or
recorded WIP checkpoint commits before the task persistence gate; coherent
commits and confirmed pushes after it), submodule pins, handoff/backlog
consistency, and regressions caused by the combined changes. Do not expand into
a repository-wide archaeology audit.

Return a concise audit verdict and every nit in your report only; you write no
handoff or backlog note. The coordinator records the verdict, promotes every
nit to a BACKLOG checkbox, and owns final persistence verification after the
gates close. You never mark tasks completed. The steering surface is
human-owned: never edit it.

Your final response must be exactly:
VERDICT: clean | blocking findings
BLOCKING: one line per finding — what, where (file/commit), required action
NITS: one line each (or "none")
EVIDENCE: commands YOU ran with results
NEXT: one concrete action
```

## Stop conditions

Stop the loop and report to the user when any of these hit:

- **Goal met** — every backlog task is completed through its gates and the final review (or,
  standard mode, the final worker round) shows the goal is satisfied (green tests,
  persistence policy satisfied, state updated). Verify with one cheap command, then give the
  final report. Blocked, exhausted, or otherwise unfinished tasks mean the goal is not met:
  that is an incomplete stop below, never a completed run.
- **Run ceiling exhausted** — an INCOMPLETE safety stop whenever eligible backlog work
  remains; never a successful run completion. Do not dispatch another worker round;
  verification and the permitted review of completed changes still run. Report the exhausted
  run ceiling, what remains, what is completed and blocked, and the recent verified progress.
  Where the host offers an interaction tool, offer the situation-appropriate choices — a
  bounded replan (its child rounds consume allowances), one additional bounded fix-and-review
  cycle, or a stop that preserves the current work — naming the worker and review increments
  each consumes; without one, state the same options in the stop report. Persist the allowance
  usage and any granted extension in the snapshot so a resume or renamed target cannot evade
  the unresolved-target limits. A continuation needs a named user grant (see
  [Run and task budgets](#run-and-task-budgets)); a consult cannot grant one. A declined or
  unanswered option ends the stop: do not ask again, do not schedule a resume, and leave the
  work preserved. Give the final report with the continuation prompt.
- **Completed-task limit reached** — the run has completed its limit of tasks (default 20),
  each counted only after its task persistence gate was fully satisfied. When eligible
  backlog work remains, this is an INCOMPLETE safety stop, never a completed run: report the
  limit, the completed and remaining tasks, and the continuation prompt, and offer the named
  increment a continuation needs (a raised limit) or a stop that preserves the current work;
  the limit never auto-grows. When the backlog is drained, the normal **Goal met** close
  applies instead.
- **Task allowance exhausted** — not a run stop by itself. The allowance in force is
  exhausted at the progress ceiling or an exact explicit cap, with no further extension
  justified. Dispatch no further worker round for that task; verification and the permitted
  review of its completed changes still run. Keep the unfinished part incomplete and
  resumable (findings, current state, one next action), then select another truly independent
  ready task with its fresh allowance when one can be selected safely; otherwise stop under
  **No safe ready work** below. Never bypass a review gate, dependency, or safety boundary to
  keep the run going, and never manufacture a task.
- **No safe ready work** — the current task is complete, deferred, or blocked, and no other
  truly independent ready task can be safely selected while unfinished changes exist. Stop
  with the preserved state, the deferred resumable packets, and the continuation prompt. When
  the stop leaves blocked, exhausted, or otherwise unfinished tasks, the run is explicitly
  incomplete even though no eligible work remains — report it as an incomplete stop, never as
  a completed run.
- **Persistence blocked** — a required commit or push — task product commits, WIP or
  reconciliation checkpoint commits, task state finalization, or the final close — cannot be
  completed safely: an unsafe or ambiguous push destination, a rejected or uncertain push, or
  an explicit restriction conflicting with the requested delivery. Preserve the exact
  persistence state, keep any open task open, and stop with the continuation prompt;
  destination decisions ask the user. The stop goes directly to the terminal local-only close
  under **Persist before printing** in Final report — no further commits or pushes in this
  run, all further persistence deferred. A resume reconciles the actual local and remote
  state before any next work.
- **Steering pause** — the human-owned steering surface says `pause`. Stop at the safe
  checkpoint: let a running child settle, record its result and charge, preserve the exact
  `NEXT` and all counters, and report the pause with the continuation prompt (see Live
  steering). The pause persists across resumes. No polling, watcher, or service.
- **Same task blocked two rounds in a row** — stop; a consult may recommend a materially
  different path, but that path still consumes the worker allowance and a consult cannot
  grant one — otherwise do not burn rounds on a wall that only the user can decide.
- **[strict] Blocking findings survive with no worker budget for another fix** — the last
  permitted review still reports blocking findings and the effective worker budget is
  exhausted. The consult authorizes no further fix or review pass — the user alone grants
  those as named increments. When the run ceiling is exhausted, stop the run; one consult on
  the surviving findings may separate genuine defects from standard drift (see Repeated
  findings on the same invariant), and a hedged consult counts as no answer: ask the user.
  Report the exhausted budget with the continuation prompt so a resume can act on a grant.
  When only the task allowance is exhausted, defer the target incomplete and review-open with
  its resumable packet and open findings, and select another truly independent ready task when
  safe; the run stops only under **No safe ready work** or another run stop. While an effective
  worker round remains and fixes make verified progress, this stop never fires: continue the
  loop unattended instead.
- **Autonomy-envelope guard breach** — a second opportunistic escalation in one session
  without an explicit user request, a review or re-audit over unchanged evidence with no
  review justification, an explicit user limit reached, or work leaving
  docs/config-only/reversible scope — stop and ask.
- **A decision or irreversible action is required** (force-push, deleting branches,
  publishing a release or pull request, or anything `AGENTS.md` flags) — irreversible actions
  and user preference stop and ask (consult does not apply); reversible judgement decisions
  get one consult first.
- **Two consecutive worker rounds with no verified progress** — stop and summarize under the
  shared stall safeguards; remaining budget is not a reason to continue.

## Final report (main loop, ≤ 15 lines)

- The round outcomes, one compact line per round.
- What was achieved, with evidence (changed files or commit hashes, test results, review
  verdicts).
- Where the work now stands (state, including any material change to a role's model selection
  reported on resume) and the exact next step. Under a restricted policy, state that accepted
  work remains unpushed (commit-only) or uncommitted and unpushed (working tree), per the
  recorded policy and its basis.
- Open blockers or decisions needed.
- For an incomplete stop, the continuation prompt: outcome and blockers with evidence, what
  actually exists (files, branches, commits) and what to preserve, the next recommended
  approach, the checks and independent review still required, and the delivery permissions
  and restrictions.

**Persist before printing.** State lives on disk, not in the conversation (core rule 3) — the
printed report is not the record. Unless persistence is already blocked — in which case the
close goes directly to the terminal local-only stop below, creating no commits and attempting
no pushes — the close first applies the
[stop-boundary WIP checkpoint](#stop-boundary-wip-checkpoints) under the active policy, so the
records below carry the actual WIP hashes and push state; the local records never wait on a
WIP push that cannot complete safely. Before giving the final report, the main loop writes
the report's pertinent info to the durable state: the round outcomes (one compact line per
round with change references and verdicts), the final verified state (build/test evidence,
per-repo persistence state and pin match), any material change to a role's model selection
reported on resume, the open nits already tracked as checkboxes, the allowance usage (run and
task identities, ceilings and allowances in force, consumed counters, the completed-task
count against its limit) and any granted or evidence-backed progress extensions, the
continuation prompt for an incomplete stop, and the exact next step. A fresh resume validates
the state against the actual checkout and re-establishes missing context rather than trusting
it. Update `BACKLOG.md` and the snapshot so they retain only current state, the carried open
items, and one exact next action. Then apply the bounded persistence sequence to the close
records: one state-only commit of the close state changes — never product changes — pushed
and confirmed under commit-and-push; under working-tree policy, the recorded diff evidence.
When the run is complete (goal met), this is the consolidated final close: the same commit
carries the last task's completion record, the run-close record, and the snapshot cleanup.
The printed report mirrors the saved records and points at the commit hash read from git
history when one exists. An interruption in the close finalization reconciles exactly like
the task gate's: resume the exact unfinished step from the durable state and git evidence,
never duplicating commits.

**Blocked persistence: the terminal local-only stop.** The local records above come first and
never wait on a commit or push. This stop applies when the close finalization cannot be
completed safely — an unsafe or ambiguous destination, a rejected, failed, or uncertain push,
or an explicit restriction conflicting with the delivery — and equally when the run arrives
at close with persistence already blocked at an earlier boundary: a task product push, a WIP
checkpoint push, or a reconciliation checkpoint push that was rejected, failed, or uncertain,
or a destination that stopped the push before it ran. In every variant the failure rules
apply unchanged: no blind retry, no force-push, merge, or rebase, no branch creation, and no
automatic destination change. An already-blocked close creates no new commits and attempts no
pushes — no WIP checkpoint commit and no finalization commit — because any descendant push
would carry the uncertain commit and implicitly retry it; the attributable unfinished changes
stay in the working tree, identified by diff evidence in the records. Record the exact
persistence state — the local commit hashes when they exist, the destination, and the push
evidence or error — in the snapshot and backlog, mark the blocked persistence deferred and
unconfirmed, and stop with the continuation prompt. The stop is terminal: no further round or
retry follows it in this run, and the backlog's one next action is the deferred persistence.
The final report is printed from the saved local records and reports the persistence as
deferred — never as completed; completion is recorded only once a resume confirms it. A resume
reconciles exactly like the task gate's, before any next work: re-read the durable state,
inspect the actual local history and the remote read-only, and resume the exact unfinished
steps in order — push the existing blocked commit as-is, then complete any deferred checkpoint
or finalization from the saved local records, creating a commit only when none exists — never
duplicating commits; a confirmed finalization closes the session's persistence without further
writes. If the blocked commit is the final close that deleted the snapshot, the snapshot stays
recoverable from that commit's history until the push is confirmed. This is a coordination
edit the main loop may make itself even though it normally does not edit files.

## Anti-patterns

- Letting the main loop read long source files "just to check" — that is what the subagents
  are for.
- Telling a subagent "continue where you left off" without pointing it at the snapshot — it
  has no memory of previous rounds.
- Parallel or background subagents; a worker reviewing its own work, or a reviewer fixing
  code — the roles never blur; fixes are always a worker round.
- A child writing the backlog, snapshot, steering file, or any operational file — the
  coordinator is the only state writer; children return reports (including reset evidence)
  and the coordinator persists them.
- Treating the snapshot as a journal or growing a full round ledger in it — it is a compact
  checkpoint; settled results fold into backlog task results.
- Mirroring the active task's or run's consumed counters into the backlog — the snapshot is
  the single counter authority; duplicate counters drift.
- Trusting a readable budget line from a torn write, or guessing/resetting consumption when
  the snapshot is missing or torn — validate the whole packet, then rebuild only from
  verified prior Git/host evidence, or stop.
- Charging a settled round twice on resume, or letting a crashed dispatch's productive work
  replay free — reconcile the pending-dispatch record once against the actual evidence.
- Treating nits as blocking (infinite fix loops), ignoring blocking findings to save a round,
  or trusting a "done"/"clean" report without one cheap verification.
- Expanding a round's scope because "it's close" — the round ends on the slice it was given.
- Dispatching a routine slice on `implement-hard` "to be safe", or a judgment slice on
  `implement-easy` because it looks small — routes follow visible risk and explicit mechanical
  prescription, not labels.
- Running the deep reviewer on routine slices "to be safe" — escalation is trigger-based and
  capped per session.
- Re-running the full review after a mechanical fix, or re-reviewing unchanged evidence to
  spend review availability — every review needs a changed diff, a required integration gate,
  or bounded interrupted-review recovery.
- Iterating against a reviewer's drifting standard — settle it once; a genuinely unmet
  invariant is a real defect to replan around, not drift.
- Asking the user for routine continuation inside the autonomy envelope, or to authorize one
  more fix/review cycle while budget, progress, and the envelope permit continuation —
  per-target cycle counts are not authorization gates.
- Extending a task allowance without verified progress evidence, or treating code churn as
  progress; an extension is a recorded, evidence-backed increment within the progress ceiling,
  never a reset.
- Auto-growing an explicit run ceiling, an exact user cap, or the completed-task limit, or
  letting a numeric resume reset persisted consumption.
- Reporting a limit stop as a completed run while eligible work remains, or a run with
  blocked/exhausted tasks as successfully completed — a limit reached with eligible work
  remaining is an INCOMPLETE safety stop.
- Counting a task toward the completed-task limit before its persistence gate is fully
  satisfied, or counting a deferred, blocked, review-open, or WIP-checkpointed task as
  completed — only a confirmed gate counts.
- Treating one task's exhausted allowance as a run stop while truly independent ready tasks
  remain — or manufacturing a task, or bypassing a gate or dependency, to spend the run's
  remaining budget.
- Editing the human-owned steering surface, treating it as a general command channel,
  auto-migrating or deleting human steering content, or overwriting `BACKLOG.md` wholesale
  from a stale copy — re-read before each targeted write and preserve concurrent human edits.
- Creating a monthly archive or session-close archive paragraph by default, or
  rewriting/deleting historical material — completed results live in the backlog; historical
  material stays untouched.
- Deleting the snapshot before the run's final persistence is verified, or as a standalone
  cleanup step — the deletion rides in the confirmed final state commit and stays recoverable
  from git history across a failed or uncertain push.
- Archiving a deferred unfinished task as completed, or dropping its resumable packet when
  switching the active task — deferred packets stay in the backlog with their identity,
  counters, and one `NEXT`.
- Reporting goal text supplied during an active run as a conflict, or overwriting the active
  state with it — reconcile it as steering; an ambiguous destructive replacement asks the
  user.
- Selecting the next task before the completed task's required commits and push are confirmed,
  or blindly duplicating commits after an uncertain push — reconcile the actual local and
  remote state first.
- Writing a finalization commit's own hash back into the state it commits — the bounded
  sequence ends with a read-only confirmation, never a recursive record-your-own-hash loop.
- Retrying a blocked push in the same run — directly, or by pushing a later WIP or finalization
  commit that carries the uncertain commit as a descendant — blocked persistence goes directly
  to the terminal local-only close.
- Treating a WIP checkpoint commit as task completion, or re-committing its changes at the task
  gate — every review's range starts at or before the recorded pre-WIP base so the WIP commits
  are inside the diff, and the gate reuses them.
- Committing every counter charge or settled result as a reconciliation checkpoint, or
  dispatching before a significant reconciliation's checkpoint is confirmed — checkpoints
  persist significant plan changes, not routine progress writes or a bare `priority` hint.
- Sweeping secrets, unrelated work, or concurrent human edits into a task or WIP commit, or
  pushing a checkpoint whose outgoing range carries unrelated or unreviewed unauthorized
  commits.
- A reviewer requiring the gate's commits or confirmed push before the gate has run — review
  inspects the range at its current phase; final persistence verification belongs to the
  coordinator after the gates close.
- Letting a child commit or push product changes, or pushing to a main/protected/ambiguous
  destination without asking — the coordinator owns Git at every persistence boundary.
- Silently upgrading a resumed working-tree or commit-only run to push rights, or bypassing an
  explicit restriction to satisfy the default — and resuming a legacy working-tree handoff
  without stating the policy and its warning.
- Reading a conditional repository guard ("do not commit unless explicitly asked") as an
  absolute prohibition, or citing Work's uncommitted default, the children's no-commit rule,
  or the coordinator role as the basis for a restricted policy.
- Changing the active policy to commit or commit-and-push and dispatching before the
  outstanding completed-task and significant-reconciliation persistence is reconciled under
  the new policy — the reconciliation reopens persistence only: no re-review, no counter
  reset, no duplicated commits.