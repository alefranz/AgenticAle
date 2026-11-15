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
Follow its bundled skill loading rules and pass them to fresh children in the
task packet, including in the worker and reviewer templates below.
This advanced workflow adds durable state and unattended continuation to that
contract. Its state, reset, budget, and decision policies below remain in force.

Work a long goal in short, **sequential rounds**. Each round is one
foreground child subagent that receives everything it needs and returns a
compact report. The main loop only coordinates: it defines each round's
task, records a two-line ledger entry, and stops when done or blocked. The
goal is context management, NOT parallelism — rounds never overlap.

Two modes:

- **standard** — one worker round per task, with the coordinator's normal
  verification, but no independent review gate.
- **strict** — worker round, then an independent **review round**, looping until
  the review has no blocking findings, before the next task starts.

Choose the mode in round 0 and state it. Default to **strict** for every task
that changes code, configuration, tests, or other project behaviour, including
a single-task goal. Use **standard** only for investigation-only work or when
the user explicitly accepts skipping an independent review for a low-risk,
mechanical task. The number of tasks alone never justifies standard mode.

## Entry and arguments

Consume the invoking user's goal text directly as the invocation arguments.
Interpret the complete arguments as:

- Leading option: an optional positive-integer worker-round budget. `--` is
  an explicit option delimiter; everything after the option is the goal text,
  possibly empty. With no budget, the goal uses the default run ceiling of 6
  worker rounds. The budget sets the run ceiling for the whole run; each
  genuine task keeps its own default allowance of 12 worker rounds (see
  [Run and task budgets](#run-and-task-budgets)).
- Whenever the parsed goal text is empty — no arguments at all or a budget
  alone — RESUME the active handoff: continue the exact one `NEXT` action
  recorded in it. If no active handoff exists, report that a new run needs
  goal text. A numeric budget on a resume changes the run ceiling only: the
  persisted consumed counters carry over and are never reset, so a ceiling
  at or below the recorded consumption leaves the run budget-exhausted
  rather than silently refreshed.
- A supplied goal with an already-active handoff is steering, not a conflict:
  reconcile the invocation text with the existing backlog and durable state
  without overwriting active work (see
  [Invocation steering](#invocation-steering)).
- Start in **strict** mode unless the user explicitly requested standard mode.

In round 0, follow the skill's setup rules: read the project's `AGENTS.md`
and `.agenticale/handoffs/active.md` when present, plus recent relevant Git
history. For a new goal, initialize the handoff before round 1. For a resume,
continue the exact one `NEXT` action. For a steering invocation, reconcile
first (see [Invocation steering](#invocation-steering)), then continue.

## Invocation steering

Goal text supplied while a handoff is already active steers the run. It is
user instruction for the coordinator, not a replacement goal: reconcile it
against a fresh re-read of `BACKLOG.md` and `.agenticale/handoffs/active.md`
before dispatching, and never overwrite active work to apply it.

- **New work.** Explicit new outcomes in the text are decomposed into backlog
  tasks like a round-0 plan: each genuinely new task enters the backlog with
  its stable ID before any selection and receives its fresh allowance only at
  first selection. When the decomposition needs source evidence, dispatch a
  focused explore round; the main loop stays thin.
- **Continuation steering.** Text that adjusts the existing goal — emphasis,
  clarified acceptance, added constraints, or an explicit reordering of
  upcoming work — updates the backlog's open entries and the active packet's
  acceptance only where the user's text explicitly supports the change.
  Selection changes apply at the next selection boundary under the normal
  readiness rules; the active slice and any running round are never
  interrupted.
- **Preserved state.** Steering keeps the run identity, the run ceiling
  (unless the invocation supplies an explicit numeric override), every
  consumed counter, task allowance, fix/review counter, deferred packet, and
  open review gate. It grants no allowance — only a named user grant does —
  and bypasses no gate, dependency, or safety boundary.
- **Destructive replacement.** An explicit, unambiguous request to discard or
  replace named work is honoured only for what it names, preserving unrelated
  tasks and audit material. An ambiguous destructive request — "start over"
  or "replace the goal" without naming what is discarded — stops and asks the
  user before any state is rewritten.

The invocation text never goes into the human-owned `## Steering` section,
which keeps exactly its two documented controls (see
[Live steering](#live-steering-human-owned-backlog-section)). Record the
reconciliation — added tasks, adjusted entries, preserved state, or the
pending user decision — in the existing backlog and active handoff, then
continue the recorded `NEXT` action unless the reconciled plan changes it at
a selection boundary.

## Task dispatch and capability

Before dispatching any round, select the actual runtime binding from
`../work/references/runtimes/` for the host actually being used, from the
tools the host exposes; never infer the runtime from a selected model name.
Do this at start and on every fresh resume.

The workflow never selects a model: on OpenCode the model and effort are
baked into the installed `agenticale/<role>` agent profiles at install
time; on other surfaces the binding's native fields carry a role assignment
only where the host supports it and the installation's preference file (its
"Model configuration (this installation)" section, when present) provides
one. When the installation configures a coordinator, the OpenCode command
entry runs this workflow in the current session on the
`agenticale/coordinator` profile from the first turn, including on a fresh
resume; without a configured coordinator (or under `--no-model`) the caller
session's own model coordinates. A role whose installed profile is missing
or unreadable blocks only
that role's dispatch, reported with the binding's refresh procedure; roles
no round uses are irrelevant, and an unavailable role never blocks unrelated
work. The workflow creates or modifies no configuration file; a missing
preference file is normal. The only other configuration evidence the
workflow may read is the install-ownership manifest the active runtime
binding documents, read-only at most once at activation and solely to
establish whether a needed optional route was configured in the current
install inventory, including when a leftover profile file is present; it
never resolves models from that manifest and never modifies it. Where the
installation documents a preference file, the selected file (or profile
file) is read at most once at activation and stays fixed for the activation;
a fresh resume starts fresh,
and the prior handoff's model choices are diagnostic history that never
override the current installation — report a material change to a role's
installed model selection. The preference file's `## Work` worker-round
allowance is Work-specific and never sets an autonomous budget — neither the
run ceiling nor a task allowance.

A role with no installed profile (or no binding support) must not silently
inherit the session model in place of a role the installation names. An
explicit model request the host cannot honour is reported as a limitation,
never silently substituted; when native metadata makes the effective
settings available, record requested versus effective, and a child's
self-reported model name never establishes what it ran on. A change to the
installation's configuration takes effect only at the next fresh resume: it
never changes an already-running child, never resets budgets or review
counters, never bypasses the provider quota-recovery rules, and never
authorizes automatic provider switching.

Route each round to a fresh child subagent carrying the matching task contract;
do not use a generic built-in child for a role that needs its own bounded
context. The task contracts live under the work skill's
[references/tasks/](../work/references/tasks/) directory. Each role gets a
fresh context and a bounded task:

| Round purpose | Task contract | Why |
| --- | --- | --- |
| One-question source discovery | [explore](../work/references/tasks/explore.md) | Focused evidence gathering; source acquisition is allowed, project code changes are not. |
| Normal implementation slice | [implement](../work/references/tasks/implement.md) | Small, verifiable coding task. |
| Explicitly prescribed, bounded, mechanically verifiable docs correction or reference-checked rename (only when configured) | [implement](../work/references/tasks/implement.md) on the `implement-easy` role | Defined mechanical work with a deterministic acceptance check. |
| Hard implementation slice | [implement](../work/references/tasks/implement.md) on the `implement-hard` role | Reasoning-heavy work that benefits from an explicitly bounded specialist context. |
| Review-findings fix pass | [fix](../work/references/tasks/fix.md) | Narrow, evidence-led changes. |
| Hard review-findings fix pass | [fix](../work/references/tasks/fix.md) contract on the `implement-hard` role | Findings needing concurrency, durability, state-machine, or ownership reasoning. |
| Per-slice independent review | [review](../work/references/tasks/review.md) | Adversarial verification in a context independent from the worker. |
| Periodic integration audit / escalated slice review | [review-deep](../work/references/tasks/review-deep.md) | Cross-slice review in a fresh context. |
| Second opinion on one bounded focused decision | [consult](../work/references/tasks/consult.md) | One read-only recommendation on a decision the loop cannot settle, or a clear, direct, complex choice that warrants independent framing. |
| A focused decision with conflicting evidence, interacting constraints, or costly reversal (only when configured) | [consult](../work/references/tasks/consult.md) on the `consult-hard` role | The same read-only consult contract and the same consultation allowance, on the stronger route. |

Select routes by the shared
[routing policy](../work/references/rounds.md#routing-policy), which binds
this workflow exactly as it binds reviewed task work. Implementation slices
default to the implement contract. Dispatch `implement-easy` only when the
installation configures it AND the slice is explicitly prescribed, bounded,
and mechanically verifiable; an unconfigured easy route falls back to
`implement` with its existing assignment. Dispatch a slice on the
`implement-hard` role directly — no consultation first — when its
correctness risk is visible: concurrency/async/cancellation/timing
behaviour, the cross-repository contract surface, subtle shared-state
behaviour, security-relevant code paths, compatibility surfaces, or
interacting contracts. Risk is assessed per slice: mechanical renames,
dependency swaps, packaging, and docs are not exempt when their actual risk
is visible, and none qualifies merely by label. Reassess a routine slice
that exposes such risk mid-flight, and reassess the next slice's route at
every slice boundary and fresh resume — earlier dispatch records are
diagnostic history, not a route lock.
A hard fix keeps the fix task role and the fix counters: dispatch it on the
`implement-hard` role, carrying the bounded fix contract explicitly in the
packet, or an equivalently scoped implement contract where the installed
profile body differs. The task role and the dispatched role are separate
choices; record both in the round's dispatch record, with the reason for the
hard dispatch. Never silently substitute a stronger or weaker role, and
surface a requested role the binding cannot honour.
Independent review is required even when every role runs the same model.
Hard slices are prime candidates for the deep review escalation below.

## Non-interactive child sessions

Child sessions are deliberately non-interactive. Their prompts forbid questions
and nested delegation, and the child must not wait for user input.
Consequences for the coordinator:

- Compose every round prompt so it needs no user decision; when a choice
  cannot be made locally, state the choice to make in the prompt itself.
- If a report comes back `blocked` on a decision, the main loop takes the
  Decision consultation path: one second opinion first, and a
  question to the user only for irreversible actions, user preference, or a
  consult that does not commit. Never route a user-facing question through a
  child subagent.
- A tool denial inside a round is a report item, not a retry: re-scope the next
  round or handle the path from the main loop.
- The main loop follows the same spirit: it runs unattended and defaults to
  a documented assumption recorded in the handoff. Questions to the user are
  reserved for the stop conditions below (guard breach, irreversible action,
  a consult that could not settle a standard-setting question, same task
  blocked twice) — never for routine continuation or a preference the
  handoff can decide.

## Core rules (do not break)

1. **The main loop is a coordinator, not a worker.** It does not implement.
   It reads just enough to define the next round, then delegates. The only
   exceptions are coordination edits (e.g., one backlog checkbox), persisting
   read-only child reports into the required durable state, and the Git
   actions of the [task persistence gate](#task-persistence-gate).
2. **One child at a time, strictly sequential.** Round N+1 starts only after
   round N's report has been read. Never run rounds in parallel or in the
   background.
3. **State lives on disk, not in the conversation.** The active handoff,
   backlog, archived handoffs, and git history or working-tree diffs are the
   single source of
   truth. A round never inherits another round's details; it re-reads the
   active handoff and recent history itself.
4. **Each worker round is one small, verifiable slice that follows the active
   git persistence policy.** A slice has exactly one behaviour or investigation question,
   one observable acceptance condition, and a defined stop boundary. It may
   touch every file or repository required for that one outcome, but never
   absorbs a newly discovered adjacent task. If the next task is bigger than
   one round, split it in the prompt — never ask a subagent to "do the rest".
5. **The main loop's memory of round N is at most two lines.** Ledger line
   format: `R<N>: <role: work|review|fix|consult> <done|clean|findings|blocked> —
   <one-line outcome>` (a consult line carries the chosen option and its
   confidence, e.g. `R7: consult done — adopt option B (medium)`).
6. **Reset before a round sprawls.** When a worker reaches a reset trigger,
   it writes a compact disk handoff and ends. The main loop starts a *fresh*
   subagent with that handoff; it never asks the old worker to keep exploring.

## Handoff storage and archival

Read-only exploration and consultation agents return reports without writing
files. The coordinator persists their relevant evidence and next action before
dispatching the next round; never require a read-only child to edit a handoff.

Resolve these paths from the project root used to start or resume the run.
Create the handoff directories when first writing to them. Keep current
operational state separate from completed audit detail:

- `BACKLOG.md` is the compact operational board. It contains product
  decisions that still govern work, open blockers/nits as checkboxes, the
  current milestone's short status with the run identity, ceiling, and
  consumed worker rounds (mirroring the active budget line), each task
  entry's stable ID and worker-round counters, exactly one first active
  next action, compact resumable packets for deferred unfinished tasks, the
  human-owned `## Steering` section (see [Live steering](#live-steering-human-owned-backlog-section)),
  and pointers to archived slices. Keep it normally below about 150 lines.
- `.agenticale/handoffs/active.md` is the authoritative active-slice packet.
  It is at most ~2 KB and contains `GOAL`, `ESTABLISHED`, `CURRENT STATE`,
  `ACCEPTANCE`, and exactly one `NEXT` action. A reset also adds a compact
  `TRIED` section. `CURRENT STATE` carries the compact budget line — run
  identity, ceiling, and consumed worker rounds; active task ID, allowance,
  and consumed worker rounds — next to the ledger, plus a pending-dispatch
  note while a charged child is in flight (see
  [Run and task budgets](#run-and-task-budgets)). Create it before the first
  round of a session if absent. A role's model selection, where the active
  binding exposes it (Task dispatch and capability), is an `ESTABLISHED` fact
  of the activation, not a new state file.
- `.agenticale/handoffs/archive/YYYY-MM.md` holds completed handoffs,
  review verdicts, and session-close ledgers, each under its stable task ID
  with the task's final counters. Preserve the original detail and append
  records in chronological order; do not rewrite it into a lossy summary.

After a slice has passed its required review gate and any applicable
deep review gate (or a standard-mode slice is complete and verified), the
coordinator moves its detailed handoff and review record from the active
packet into the monthly archive — reviewers and auditors record verdicts
only and never archive. Replace any detailed completed record in
`BACKLOG.md` with a one- or two-line result: date, outcome, relevant commit
hashes or changed files, and an archive pointer. A completed task's result
line also carries its confirmed push destination when the policy requires
pushing; the task is marked completed only after the
[task persistence gate](#task-persistence-gate), including its bounded state
finalization, is satisfied. Carry every unresolved blocker or nit into the
appropriate open checkbox in `BACKLOG.md` before archiving. Never delete
audit material, never archive an active or review-open slice, and never treat
a task as completed or select the next task while its required commit or push
is outstanding or unverified.

A deferred unfinished task is never archived as completed. When the active
task switches — allowance exhaustion, a blocker, or steering priority at a
selection boundary — move the outgoing task's compact packet (stable ID,
task counters, established facts, current state, acceptance, and exactly one
resumable `NEXT`) into the backlog's deferred-task entries, and restore the
incoming task's packet into `active.md`, in the fixed order defined under
[Durable identities and counters](#durable-identities-and-counters): the
outgoing packet is durable in the backlog before `active.md` is overwritten.
A deferred packet carries the task's own counters, never a run-consumption
snapshot. The backlog keeps exactly one active
next action; a deferred packet's `NEXT` is resumable state, not a second
active action. Resuming a deferred task restores its recorded packet,
identity, and counters unchanged. These are coordination edits to the
existing state files — no new tracking file. Every `BACKLOG.md` write is a
targeted edit applied to a fresh re-read of the file, preserving the
human-owned Steering section and any concurrent human edit.

At session close, archive the full round ledger and verification evidence.
`BACKLOG.md` keeps only the current session's compact status/next action;
older session-close handoffs move to the archive. Archive early whenever
the backlog exceeds the normal size target or a milestone closes. Preserve
repository-specific handoff rules when they are stricter.

## Git persistence between handoffs

Choose and record one persistence policy in round 0, then pass it verbatim to
every child:

- **Commit and push (default for a new run):** the invocation itself
  authorizes committing and pushing each completed task. After a task passes
  its required checks and review gates, the coordinator creates the coherent
  task commits and completes an ordinary push before the next task starts
  (see [Task persistence gate](#task-persistence-gate)).
- **Commit:** the user explicitly restricts the run to commits, or repository
  instructions require commits but do not authorize pushing. Coherent task
  commits are still required before the next task; nothing is pushed.
- **Working tree:** the user explicitly asks to leave changes uncommitted, or
  repository instructions forbid commits. Leave verified changes in the
  working tree and identify them with `git status` and `git diff` evidence.

Explicit user or repository restrictions win over the default: adopt and
record the restricted policy with its basis, and follow it — never bypass a
restriction to satisfy the default. A resume — empty or numeric — and a
steering invocation keep the recorded policy; a working-tree or commit-only
run never silently gains push rights. A handoff with no recorded policy
predates the commit-and-push default and resumes as working tree. Only an
explicit user request changes an active run's policy, recorded with its
basis.

The coordinator (main loop) owns every commit and push: worker, fix, review,
and review-deep children leave their verified changes and operational notes
in the working tree and never commit or push them. The coordinator applies
the policy at the task persistence gate — product changes in coherent task
commits, and the run's durable state in the gate's bounded state-only
finalization — committing changed repositories in dependency order and
updating any outer-repository pins, so the persisted state is coherent
across tasks. Reviewers write only the working-tree operational note; the
coordinator persists it under the same policy. Later rounds refer to commit
hashes when commits exist; otherwise they use the recorded baseline plus
changed-file and diff evidence. Work on the already checked-out branch unless
the user explicitly asks for a new branch or repository instructions require
one; a request to commit does not imply creating a branch. The policy
authorizes ordinary task commits and pushes only: creating a branch, opening
a pull request, merging, force-pushing, changing remotes, and publishing a
release remain separate, explicit actions. Never silently strengthen the
recorded policy.

### Task persistence gate

Slices and tasks are different units: a slice is one worker round's bounded
outcome with its own review gate; a task is the backlog outcome, which may
contain several slices. The gate applies once per completed task, under the
active policy:

1. **Required checks and reviews are complete.** Every slice of the task has
   passed its required gate — the strict review gate, or standard mode's
   normal verification — and every applicable deep review gate, periodic or
   opportunistic, has closed. An unfinished or review-open task is never
   persisted as completed.
2. **Coherent task commits.** The coordinator stages only the task's accepted
   product changes and creates coherent task commits — one per logical
   change, not one per agent round. Unrelated staged, unstaged, and untracked
   work, concurrent human edits, and secrets are preserved and never swept
   into a task commit; overlapping edits that cannot be attributed to the
   task safely stop and ask. An investigation-only task produces findings,
   not product changes: it creates no artificial product commit. When its
   findings change the durable state, the state finalization persists them
   like any other state change; with truly nothing to persist, the gate is
   satisfied by the recorded findings. The run's durable state is never
   swept into product commits; it is persisted by the bounded state
   finalization in step 4.
3. **Confirmed ordinary push.** Under the commit-and-push policy the
   coordinator pushes the task commits with ordinary Git semantics to the
   resolved destination and verifies the push succeeded. Under commit-only or
   working-tree policy this step does not apply; the recorded policy is never
   bypassed.
4. **Bounded state-only finalization.** Once the product persistence is
   confirmed — the push under commit-and-push, the commits under commit-only,
   the recorded diff evidence under working-tree — the coordinator performs
   exactly one bounded finalization sequence:
   - Write the completion record into the existing state files: the backlog
     task result line carrying the product commit hashes and, when pushing
     applies, the confirmed destination; the detailed record archived; the
     active handoff updated with the confirmed persistence state and one
     `NEXT` action. Each is a targeted edit on a fresh re-read.
   - Under commit or commit-and-push policy, create exactly one state-only
     finalization commit containing the run's changed durable state
     (`BACKLOG.md`, `.agenticale/handoffs/`) — never product changes or
     unrelated work — and, under commit-and-push, push it to the same
     resolved destination and verify success. With no changed durable state,
     no commit is created.
   - The gate is satisfied only when this finalization is confirmed under
     the policy; the next task is selected only after that. The sequence is
     finite: the finalization commit's own hash and push confirmation are
     never written back into the state files it commits — later records
     reference them read-only from git history — so no record-your-own-hash
     loop exists. The local acknowledgment that the gate is satisfied is a
     read-only verification, not another state write.

Record the persistence state as it advances — accepted, committed (product
hashes), push pending or confirmed (destination and evidence) — in the active
handoff and mirror it on the backlog task entry, each a targeted edit on a
fresh re-read, persisted before the next step; the completion record replaces
the mirror at finalization. A task whose required commit or push — product or
finalization — is outstanding or unverified is never reported as completed,
and the next task is never selected.

**Push destination.** Resolve the destination before the run's first push and
re-check it at every push: the checked-out branch's configured upstream
(remote and branch), plus any destination named by repository instructions.
Push only to that resolved upstream. Stop and ask the user before pushing
when the destination is unsafe or unclear: the branch is `main`/`master` or
otherwise protected by repository instructions or hosting rules, no upstream
is configured, multiple remotes make the target ambiguous, or the outgoing
commits include work outside the reviewed task scope. Never create a branch,
change remotes, force-push, merge, or open a pull request to make a push
succeed.

**Failed, uncertain, or interrupted persistence.** A rejected, failed, or
uncertain push — of the product commits or of the state finalization — never
advances the run: record the exact persistence state — accepted task, commit
hashes, destination, and the push evidence or error — in the active handoff
and backlog, keep the task open, and stop with the continuation prompt. Do
not select the next task, force-push, merge or rebase automatically, or retry
blindly. A non-fast-forward rejection means the remote moved; preserving the
state and asking is the recovery, not rewriting history.

An interruption anywhere in the gate — after the product commits before
their push, after the product push before the state finalization, after the
finalization commit before its push, or after the finalization push before
the local acknowledgment — is reconciled before any next-task work, on every
resume: re-read the durable persistence state, inspect the actual local
history and the remote read-only (fetch or ls-remote), and establish which
steps already happened. A commit already on the remote — confirmed by
ancestry or content, never assumed — is not duplicated or re-committed; a
push that already succeeded is recorded, not blindly repeated. Resume the
exact unfinished step first: push an existing unpushed product or
finalization commit as-is, complete missing completion-record writes from
the confirmed hashes and destination, and treat a confirmed finalization as
satisfying the gate without any further write — the acknowledgment is
read-only, so the next task starts without replaying work or adding commits.
Mark the task completed only once the whole gate is confirmed satisfied.

## Run and task budgets

Two worker-round budgets bound every run, and both are durable:

- **Run ceiling** — the whole run's worker-round budget: the default 6, or
  the positive integer supplied at invocation. It changes only by the user's
  explicit numeric override or a named grant; the coordinator never
  auto-grows the default for a large goal.
- **Task allowance** — each genuine task's own worker-round budget, default
  12. It is independent of the run ceiling and of the Work preference file's
  `## Work` allowance, which never sets an autonomous budget. Only a user
  grant extends a specific task's allowance, as a named increment.

Every explore, implement, and fix round — including a reset continuation or a
malformed-report correction — is one worker round charged to BOTH the current
task and the run. Exploration that defines a task belongs to that task's
allowance. The effective remaining worker budget is the smaller of the task's
remaining allowance and the run's remaining ceiling; a worker dispatch needs
at least one effective round. Review, review-deep, and consult rounds do not
consume either worker budget and keep their own unchanged caps.

Only a genuinely new task receives a fresh task allowance. Decomposing a
task, replanning it, resuming it, steering it, or recovering it from an
interruption keeps the same task identity and the same consumed counters;
none of them replenishes the task allowance or the run ceiling. A renamed or
re-outlined slice of the same task is not a new task.

### Durable identities and counters

Round 0 assigns the run a stable identity (a short slug recorded in the
backlog and the active handoff) and records the run ceiling. Every task
receives its stable task ID (`T1`, `T2`, … in recording order) when it first
enters the backlog — in the round-0 plan, an invocation steering
reconciliation, or when a round's report defines a new task — before any
selection, so steering can name a task that has never been selected. An ID
is not an allowance: a genuinely new task's fresh
allowance is allocated only at its first selection, and readiness still
governs eligibility. The ID travels with the task through the backlog, the
active packet, dispatch records, and the archive. The active handoff's
`CURRENT STATE` carries one compact budget line — run identity, ceiling,
consumed; task ID, allowance, consumed — next to the ledger, and the backlog
carries the same counters on each task's entry. Counters record consumption;
remaining is derived from the ceiling or allowance, never stored as a second
number that can drift.

Counter authority is single. The `active.md` budget line is canonical for
run consumption and the active task's counters; the backlog mirrors them on
the task entry and the milestone status, and is canonical for deferred
tasks' packets and counters. A deferred packet carries the task's own
counters, never a run-consumption snapshot, so a stale task snapshot can
never restore a stale run count. Persist counter changes in this fixed
order, each step a targeted edit on a fresh re-read, read back to confirm it
landed before the next step:

1. **Charge (before launch).** One `active.md` write carries the incremented
   run and task counters, the dispatch record, and the pending-dispatch note
   (round number, role, task ID). Read it back, mirror the new counters to
   the backlog task entry and status, then launch the child. A child never
   launches before its charge is durable and verified.
2. **Settle.** Finalize `active.md` (resolve the pending note, record the
   ledger line), then mirror the result to the backlog.
3. **Switch (A → B).** First write A's deferred packet — with its current
   counters from the budget line — into the backlog; then write B's packet
   into `active.md`, restoring B's task counters from its backlog packet (or
   a fresh allowance for a genuinely new task) and carrying the run identity,
   ceiling, and consumed unchanged from the outgoing budget line; then update
   the backlog's single active next action and status mirror. The outgoing
   packet is durable before `active.md` is overwritten, so no interrupted
   step loses a packet.

Charge each worker round exactly once. When the round settles, finalize the
record:

- A productive round keeps its single charge, even when it is later
  interrupted or ends in a reset.
- A confirmed quota-only launch with no resumed work removes its pending
  charge (see [Provider quota recovery](#provider-quota-recovery)); it
  consumes no allowance.
- A crash or session loss leaves the pending record durable. On resume,
  reconcile it against the working tree and host evidence before dispatching
  again: material work keeps the charge, a confirmed no-work quota rejection
  or a confirmed never-launched dispatch removes it, and the continuation is
  a new round with its own single charge.
  Never charge the same round twice, and never let a replay of productive
  work run free of its recorded charge.

Reconcile in this order at every launch and fresh resume, before dispatching:

1. Re-read `active.md` and `BACKLOG.md` fresh.
2. Validate the active packet as a complete, coherent whole before trusting
   any of its numbers. The packet must be intact — its sections present,
   including exactly one `NEXT` — and its budget line coherent: it agrees
   with the backlog mirror, or any excess over the mirror is backed by the
   packet's own records — a complete pending-dispatch record (dispatch
   record plus pending-dispatch note) for an in-flight round, or the ledger
   line of a settled one. A readable budget line alone is not a valid state:
   incremented counters with no backing record are a torn charge write, not
   consumption.
3. Only a validated active packet wins: rewrite any disagreeing backlog
   mirror from it. If the backlog also holds a deferred packet for the active
   task ID, a switch was interrupted mid-sequence — the active packet wins,
   remove the duplicate deferred entry (it was copied from or restored into
   the active packet, so nothing is lost), and continue the active task;
   selection is reassessed at the next boundary. Never rewrite a mirror from,
   or delete a deferred packet because of, an unvalidated packet.
4. A missing, torn, or incoherent `active.md` — including a torn charge write
   whose readable prefix shows incremented counters — is rebuilt from the
   backlog's verified pre-launch state: run identity, ceiling, and consumed
   from the status mirror — never from a deferred packet or the torn
   packet's unverified counters — and the active task from the entry named
   by the single active next action, with its counters from that entry or
   its deferred packet. Restore that packet into `active.md`.
5. Resolve any pending dispatch, or host/working-tree evidence of a round
   launched after the recovered counters, exactly once: material work keeps
   or applies the single charge; a confirmed quota-only launch removes or
   never applies it; a complete pending charge whose child never launched —
   no host or working-tree evidence of a launch — is removed, its note
   resolved as never-launched, and the pre-launch counters restored, because
   no round ran. Persist the reconciled state, then mirror it.

Examples. (a) Torn charge write with a readable prefix: the pre-launch
`active.md` write tears after the incremented counters but before the
dispatch record and pending note, leaving a readable budget line of run 4,
T1 4 while the verified backlog mirror still reads run 3/6, T1 3/12. No
child launched — the charge was never verified. The resume finds the
increment unbacked, rebuilds from the mirror (run 3, T1 3), repairs
`active.md`, and dispatches the round with one new charge: run 4, T1 4
after the first actual round. Mirroring the readable 4 first and then
charging would reach 5 for one actual round — the unverified counters must
never reach the mirror. (b) Interrupted switch: exhausted T1 (12/12) has its
deferred packet durable in the backlog when the session dies before
`active.md` is rewritten. A complete, coherent `active.md` still names T1:
the duplicate deferred entry is removed and T1 stays active until the next
selection boundary, where it is worker-ineligible and the loop defers it
again and selects ready T2. A torn or incoherent `active.md` instead
rebuilds T1 from its deferred packet — never deleted on the strength of a
torn packet — and the run consumed from the status mirror.

A resume — with or without a numeric budget — reads the persisted identities
and counters and continues them; it never recomputes consumption from the
ledger's length, never resets counters, and never re-issues task IDs. A
numeric resume override changes the run ceiling only: remaining becomes the
new ceiling minus the persisted consumption, floored at zero. When persisted
consumption already meets or exceeds the new ceiling, the run is
budget-exhausted and stops under the allowance-stop rules instead of silently
resetting. A user grant adds exactly the named rounds to the named budget —
run ceiling or task allowance — and never resets counters.

### Task exhaustion is not a run stop

When a task's allowance is exhausted, dispatch no further worker round for
that task and exclude it from worker selection until a user grant extends
its allowance, so an exhausted deferred task cannot repeatedly win
selection. Verification and the permitted review of its completed changes
still run under the unchanged review caps and remain schedulable; an
unfinished task is still not reviewed as if complete. Whatever remains
unfinished stays incomplete:
record the findings, the current state, and exactly one next action, and keep
the task's packet resumable in the backlog (see Handoff storage and archival).
The run may then select another truly independent ready task, which receives
its own fresh allowance — even while the exhausted task's unfinished changes
remain in the tree. Selection never bypasses a review gate, a dependency, or
a safety boundary: a task that depends on the unfinished work, or whose
changes cannot be safely separated from it, is not ready, and no task is
manufactured to spend remaining budget. When no safe ready task remains, the
run stops under the stop conditions. The run itself stops for budget only
when the run ceiling is exhausted.

## Setup (round 0, done by the main loop)

1. Parse the goal, the round budget, the mode, and the git persistence
   policy. A new run defaults to commit and push per completed task; explicit
   user or repository restrictions select the commit-only or working-tree
   policy instead, recorded with their basis. A resume or steering invocation
   keeps the recorded policy unless the user explicitly changes it. If no
   budget was given, use the default run ceiling of 6 worker rounds; do not
   auto-grow the default for large goals — a larger ceiling is
   the user's explicit numeric override or a later named grant. Strict-mode
   review rounds are cheap and are not counted against the worker budget.
   Assign the run identity, record the ceiling and the default task allowance
   of 12, and state all four parsed choices.
2. Read only what is needed to define round 1: `.agenticale/handoffs/active.md`
   (or, only while initializing it, the first active "Next slice" item in
   `BACKLOG.md`), the `## Steering` section of `BACKLOG.md` when present,
   `AGENTS.md` conventions when that file exists, and
   `git log --oneline -5` in
   each repo the work touches. The active packet must be at most ~2 KB and
   contain the task, established facts, relevant commits/files, acceptance
   commands, and exactly one next action. Historical handoff prose is audit
   material: read it only by an exact archive pointer, never as general
   archaeology. Do NOT read source code — that is what the subagents are
   for.
   Before defining round 1, run the brief material-risk assessment:
   which independently mutable sources the request would touch (local
   working trees, remote branches or pull requests, persisted state such
   as databases or caches) and which of them other actors can also
   mutate; external side effects that would survive an interruption;
   concurrent humans; ownership-sensitive cleanup; and compatibility
   surfaces. The signals justify a focused explore round or decomposition,
   not a long planning round. The main loop stays thin: when source
   evidence is needed to define a round, dispatch the focused explore round
   with its one question and stop condition instead of reading source
   itself.
3. Follow Task dispatch and capability above. For a resume, compare the
   current installation against the recorded dispatch records first and
   report a material change to a role's model selection. Record the model
   selections the binding exposes in the active handoff's `ESTABLISHED`
   facts; the workflow creates or modifies no configuration file.
4. State the plan in 3–6 lines: goal, budget, mode, persistence policy, how the
   work splits into slices, and stop conditions. Record the planned tasks in
   the backlog with their stable IDs now, before any selection; allowances
   are allocated later, at first selection. Then start round 1 without
   waiting for approval; pause only on a stop condition below.

## Live steering (human-owned BACKLOG section)

The human can steer a running goal through one small, documented section of
the existing `BACKLOG.md` — no new state file, and no unrestricted command
channel:

```markdown
## Steering

- mode: continue
- priority: T3, T2
```

- `mode` is `continue` (the default when the section or the line is absent)
  or `pause`. Only the exact value `pause` pauses the run; an unrecognized
  value changes nothing and is noted in the next report.
- `priority` is an optional comma-separated list of task IDs. It reorders
  only the NEXT task selection among ready tasks: named ready tasks are
  considered first, in listed order, then the remaining ready tasks in their
  normal backlog order. IDs exist from the moment a task enters the backlog,
  so a recorded task that has never been selected can be named; an ID absent
  from the backlog is unknown. Priority never interrupts the active task or a
  running round, and it never makes a blocked, dependent, unknown,
  worker-ineligible (allowance-exhausted), or otherwise not-ready task
  selectable; such IDs are skipped with a recorded note.

The section is human-owned. The coordinator re-reads it immediately before
every new round dispatch — worker, review, fix, consult, and deep review
alike — and immediately before every `BACKLOG.md` write. Children never edit
it; their operational notes leave it untouched. Agent writes to `BACKLOG.md`
are targeted edits applied to a fresh re-read of the file, never a whole-file
overwrite from a stale copy, so a concurrent human steering edit survives.
Steering grants no allowance, scope, Git right, or gate exception; content
beyond the two documented controls is not an instruction the loop executes.
Invocation goal text is a separate explicit user channel (see
[Invocation steering](#invocation-steering)); it is never written into this
section.

On `pause`, the loop stops at the next safe checkpoint: a running child is
allowed to settle (rounds are strictly sequential, so at most one is in
flight), its result and charge are recorded, and the handoff preserves the
exact `NEXT` action and all counters. The loop then stops with a pause report
and the continuation prompt. It never interrupts a child mid-round, polls the
file, or starts a watcher or service. If no new steering instruction is
present, continuation is normal. A fresh activation re-reads the section:
`continue` (or an absent section) resumes the recorded `NEXT`; a still-present
`pause` stops again without dispatching. A pause noticed during a quota
cooldown wait is honored before the next launch after the wait; the wait
itself keeps its existing deadline rules.

## Task loop

Tasks come from the round-0 plan, an invocation steering reconciliation, the
handoff (first uncompleted item in the "Next slice"), or the previous round's
report.

Before every new round dispatch — worker, review, fix, consult, or deep
review — re-read the `BACKLOG.md` Steering section (see
[Live steering](#live-steering-human-owned-backlog-section)) and the durable
budget line. A `pause` stops the loop at the safe checkpoint described there.
A worker dispatch additionally needs at least one effective worker round —
the smaller of the task's remaining allowance and the run's remaining ceiling
(see [Run and task budgets](#run-and-task-budgets)); persist the round's
single charge against both budgets, with the pending-dispatch note, before
launching the child.

Task selection happens only at a selection boundary — the current task
completed, deferred, or blocked — never mid-task. Apply the steering priority
among ready tasks, then the normal backlog order. A ready task is one whose
dependencies and review gates are satisfied and whose changes can be safely
separated from any unfinished work in the tree. Worker selection additionally
requires worker eligibility: at least one effective worker round remains for
the task under both its allowance and the run ceiling. An allowance-exhausted
task is not worker-ready and is skipped with a recorded note even when
steering names it first, while the permitted review of its completed changes
remains schedulable under the review caps. Selecting a genuinely new task
allocates its fresh allowance (its stable ID was assigned when it entered the
backlog); returning to a deferred task restores its recorded packet,
identity, and counters. Example: steering lists exhausted T1 before ready,
truly independent T2 — the loop records T1's skip, selects T2, and may still
dispatch T1's permitted review; it never dispatches a worker round for T1,
never bypasses a gate, dependency, or conflict, and never manufactures a
task.

Apply the shared contract's
[sequential decomposition](../work/references/rounds.md#sequential-decomposition)
within a task when useful, including after exploration or consultation. Keep
the short provisional sequence in the existing backlog and the current slice's
acceptance, evidence, and one next action in the active handoff. Reassess after
each slice or inconclusive attempt before dispatching the next assignment;
record rejected experiments and reconcile their changes before the next slice.
This adds no state files and does not reset budgets, review counts, or stop
conditions. Strict mode gates each changed slice; standard mode retains its
normal verification policy. The periodic and opportunistic deep review gates
below still govern escalation; decomposition adds no per-step deep review.
Apply [the shared contract's checkpoint](../work/references/rounds.md#checkpoints-decision-summary-and-stop-reports)
after every substantive worker or reviewer result. Use its progress narration
guidance before each substantive dispatch, including the first: what was learned,
what comes next, and why. Keep the compact state in the active handoff's
`CURRENT STATE` next to the ledger. Routine dispatch records and counters
belong in that state, not in every visible update.

For each current slice or discovery assignment:

1. **Worker round.** Compose a self-contained prompt from the worker
   template. Invoke one foreground child subagent carrying the matching task
   contract: the explore contract for a focused discovery question, the
   implement contract for an implementation slice, the implement contract on
   the `implement-easy` role for a configured, explicitly mechanical slice,
   the implement contract on the `implement-hard` role for a hard
   implementation slice (see the dispatch rules above), and the fix contract
   for a review-directed fix.
   Check the report against a quick verification (`git -C <repo> status` and,
   when applicable, `git -C <repo> log -1`). If the
   host result proves provider quota exhaustion, handle it under
   [Provider quota recovery](#provider-quota-recovery) before report repair or
   interruption handling. Otherwise, if the report is missing, malformed, or
   its claims do not match, send one correction round with the observed
   discrepancy — do not restart the task.
2. **Reset/handoff gate.** If the report hit a reset trigger, record its
   ledger line and start the next worker as a fresh investigation, diagnostic,
   or implementation round from the compact handoff. A reset is normal
   progress and counts as one worker round; do not make it a free, hidden
   continuation. Do not review an unfinished task. If host evidence shows
   quota exhaustion, use Provider quota recovery before applying this gate.
3. **[strict] Review round.** Compose the review template with the task
   definition, the worker's 15-line report, and its commit hashes or recorded
   change range. A fresh child carrying the review contract verifies
   independently and reports findings. See "Review gate" below.
4. **Gate.** In strict mode a slice is only accepted when a review round
   returns no blocking findings. Otherwise send a fix round (see below) and
   re-review. After a clean gate, check the opportunistic deep review escalation
   triggers below before archiving the slice.
5. **Record the ledger line(s)** (one per round). An accepted slice that
   leaves the task unfinished continues with the task's next slice. When the
   task's last slice is accepted and its applicable deep gates have closed,
   satisfy the [task persistence gate](#task-persistence-gate) — coherent
   task commits, a confirmed ordinary push, and the bounded state-only
   finalization under the active policy — before the next task is selected.

### Provider quota recovery

Inspect the host's terminal child or dispatch result for a provider-reported
usage quota or rate-limit exhaustion before applying malformed-report
correction or ordinary interrupted-round handling. Treat explicit host/provider
evidence such as `The usage limit has been reached` as quota evidence. A generic
crash, timeout, cancellation, permission denial, authentication failure, or
billing/account suspension is not quota evidence; follow the existing error or
stop policy for those cases. Do not infer quota exhaustion from silence or a
child's unverified claim when host status is available. This policy applies to
all dispatched child roles, including workers, reviewers, fixers, explorers,
consultants, and deep reviewers.

When quota exhaustion is established, first confirm that the child is terminal
and has no background work still running. Never overlap a replacement child
with a live one. Persist a `QUOTA RECOVERY` record in the existing active
handoff: affected role and slice, exact evidence, observed time and retry time,
whether work began, the next concrete resume action, and the consecutive
no-work quota-retry rejection count. The initial quota failure starts the
outage sequence with this count at zero, even if the child made partial
material progress before being interrupted; it is not one of the cooldown
retry rejections. Honor reliable provider retry/reset metadata
when it gives a later time; otherwise use a 30-minute cooldown. Do not assume
all providers share a four-hour usage window. The cooldown and counters survive
session resumes and handoff repairs.

Read the current time from a reliable clock and compare it with the persisted
retry time. Never launch before that deadline, including after a fresh session
or an early return from a wait. Inspect the current host's actual tool surface
for a supported, timer-backed foreground wait. If available, wait for the
remaining duration, composing multiple waits only as needed to stay within the
tool's supported duration. After every return, re-read the clock and recompute
the remaining time; do not busy-poll, probe children, or dispatch early. User
input may interrupt a wait: an explicit request to stop or cancel pauses or
stops the task according to that request while preserving the cooldown and
work; a status request or correction alone does not cancel recovery and must
still respect the deadline. If elapsed time cannot be measured reliably, or no
supported timer-backed wait is available, preserve the exact retry time and
resume action in the handoff and stop cleanly for a later activation; do not
attempt coordinator work while the coordinator itself is quota-exhausted. Do
not claim an automatic wakeup or invent scheduler support. Runtime bindings do
not promise a common wait or wakeup capability, so report it as unavailable
unless the active host exposes it.

Before resuming, inspect the actual working tree, including untracked files and
partial edits. The fresh child validates the handoff against that state and
continues from its one `NEXT` action; it must not reset files, discard work, or
reimplement the whole assignment based only on the interrupted report. If the
handoff is missing or stale, the coordinator may repair it from verified tree
and tool evidence without dispatching another child. Preserve role policy: a
reviewer stays read-only, and Git actions remain governed by the existing
authorization rules. Completed changes still require the ordinary verification
and review gates.

Write small durable handoff checkpoints at natural progress points, including
before a long action likely to cross a provider usage window. Record completed
work and evidence, remaining work, and exactly one next action so a fresh child
can make forward progress rather than replaying the task. Productive rounds
that made material progress, even when later interrupted, consume their normal
worker or review allowance. A pure quota-blocked launch or cooldown wait does
not consume those allowances and is not a malformed-report correction, a
second interruption, or a no-progress failure. It must not erase genuine prior
no-progress evidence either. A quota rejection with no resumed work is quota
only even if the host created a child session before returning the rejection.
Reconcile the pending-dispatch record accordingly, by role: a productive
worker round (explore, implement, fix) keeps its single recorded charge
against the task allowance and the run ceiling; a productive review,
review-deep, or consult round is accounted under its own caps and never
debits either worker budget; a confirmed quota-only launch removes its
pending charge and leaves both worker consumed counters unchanged. The run
and task identities, the consumed counters, and the pending-dispatch
evidence survive the outage and every resume.

Allow at most eight automatic cooldown retries after the initial quota
failure. Count only quota rejections from those retries that find no resumed
material progress: retry 1 raises the count from zero to one, through retry 8
raising it to eight. Persist the count across sessions and failed probes; a
fresh activation does not start a new set of retries. Reset it only after a
resumed child makes material progress. At eight, stop with a resumable handoff
and the next retry action; a later activation may make one fresh probe after
the recorded time, but another no-work rejection leaves the count capped at
eight, records the new retry time, and stops again without an automatic retry
loop. A quota interruption after resumed material progress starts a new
sequence at zero, including when the productive child was interrupted after
partial progress.
Quota waits and quota-only launch failures do not count as two consecutive task
blockers. When a resumed child makes material progress, charge that productive
round against its normal allowance — the worker budgets for a worker role,
the role's own caps for review, review-deep, or consult. All normal worker,
fix, review, consultation, budget, and stop limits otherwise remain in force.

### Interrupted-round recovery

If the host ends a child before it produces a valid report (e.g. a turn/step
ceiling or an interruption), do not treat the task as complete or count a
forced summary as a completed task. Record the interruption in the ledger
(for example `R4: work progress — interrupted; fresh handoff required`),
start a fresh child of the same role from the active handoff plus the
interrupted child's final summary, and require it to first
validate or repair the compact handoff before doing one concrete `NEXT`
action. This is a normal reset, not a malformed-report correction and not an
automatic retry loop. The dispatched round's recorded charge stands, and the
continuation is accounted by role: a fresh worker continuation (explore,
implement, fix) is a new worker round with its own single charge against the
same task and run; a fresh review, review-deep, or consult continuation stays
under that role's own caps and never debits either worker budget. Neither the
interruption nor the reset replenishes any budget or re-issues the task
identity. For example, a review child interrupted mid-verdict is replaced by
a fresh review child over the same range: the continuation is a review round
under the unchanged review caps, not a worker round, and the run and task
consumed worker counters stay unchanged. If the same task is interrupted
twice without a material decision or persisted outcome, stop and report it as
blocked.

When host/provider evidence identifies quota exhaustion, use the quota recovery
path above instead of recording an ordinary interruption. Quota-only waits and
launch rejections do not trigger this section's repeated-interruption limit.

## Periodic deep review gate

A clean per-slice review proves a slice; it does not reliably expose mistakes
at the seams between slices. Run one foreground round with the review-deep
contract after the first applicable trigger below, but only after the current
slice has passed its normal gate:

- three accepted implementation slices since the last deep review;
- a milestone, release, or session-close boundary after two or more accepted
  slices;
- an accepted slice changes a public API, package/dependency identity,
  cross-repository contract, or submodule relationship; or
- the accepted range spans two repositories or roughly twelve non-handoff
  files.

Do not run it for a one-slice investigation, a docs-only session, or merely
because a normal reviewer emitted a non-blocking nit. It is an integration
gate, not a full repository audit and not a replacement for the strict
per-slice reviewer. Review-deep rounds do not consume the worker-round budget,
but are recorded in the ledger as `R<N>: review-deep clean|findings — ...`.

Give the audit the exact commit or diff range since the preceding deep review
(or session start), the accepted-slice summaries, affected repositories, and
the cross-slice acceptance commands. It must independently run the relevant
integrated verification and inspect the whole supplied range. It appends an
audit verdict to the active handoff and follows the active persistence policy.
Blocking findings each receive a dedicated fix round; judgmental
findings are followed by a fresh deep review scoped to the fix delta and the
invariants it touched, while mechanical-only rounds close by local
verification (see the Review gate's finding-class rules). Cap deep review
re-audits at two per audit target per session; on a further blocking
verdict, stop and ask the user. Promote every non-blocking nit to a
`BACKLOG.md` checkbox before closing the audit.

## Opportunistic deep review escalation

The per-slice reviewer is independent in context even when it runs the same
model as the worker. After a slice passes its normal review gate, and
before archiving it, run one foreground round with the review-deep contract
over that slice's commit or diff range when any of these is true:

- the slice touched a high-risk surface per the dispatch rules above —
  concurrency/async/cancellation/timing behaviour, the cross-repository
  contract surface, subtle shared-state behaviour, or security-relevant code
  paths (this includes every hard implementation slice);
- the slice needed two fix rounds (its review passed only on the third
  pass) — a struggle signal that worker and reviewer share a blind
  spot; or
- the user explicitly asks for a deep review on this slice.

Use the deep review prompt template with a single-slice audit range.
Blocking findings each receive a dedicated fix round; judgmental
findings are followed by a fresh escalated review scoped to the fix delta,
while mechanical-only rounds close by local verification (see the Review
gate's finding-class rules). Cap deep review re-audits at two per target per
session, on top of the one escalation; on a further blocking verdict, stop
and ask the user. Escalation rounds do not consume the worker-round budget
and are recorded in the ledger as
`R<N>: review-deep clean|findings — escalated slice`.

Budget guard: run at most one opportunistic escalation per session. If a
further trigger fires, record it in the active handoff as a deferred-escalation
note and let the periodic gate pick it up on its normal cadence. The user may
always direct an additional escalation explicitly. Consult rounds are capped
at two per session, separately from the escalation and re-audits.

## Decision consultation (independent second opinion)

This skill runs unattended, so the escape hatch for a decision the loop
cannot settle is not a question to the user: it is one foreground round with
the consult contract — an independent second opinion. When a stop condition
below would end in "ask the user a question" about a reversible judgement
decision (a blocked task, a third review pass with surviving findings, a
standard-setting question, or any decision the handoff cannot settle), the
main loop may run one consult round instead of asking. A consult is also
warranted before the loop commits to a clear, direct, complex choice — a
bounded focused decision whose framing benefits from independent review —
not only when the loop is stuck.

Where the installation configures the `consult-hard` route, dispatch the
consult on it directly when the decision's character is apparent: conflicting
evidence, interacting constraints, or a costly reversal. It is read-only,
carries the same consult contract, and consumes the same consultation
allowance as an ordinary consult; when the route is not configured, the
decision runs on `consult`. A requested stronger advice the host cannot
honour is surfaced as a limitation, never silently substituted.

Give the consult exactly one decision: the question, the candidate options
with what each does to scope, budget, and risk, what was already tried and
why it failed, the acceptance conditions, and the cheap checks it may run.
It returns one recommendation with a confidence level; the main loop may
adopt it. Adoption is recorded like any other decision: a consult ledger
line plus a handoff note citing the consult round and its report, marked as
an **independently advised decision the user can veto later**.

Consult does NOT apply to: irreversible actions (force-push, deleting
branches, publishing a release or pull request — those stop and ask), user
preference or taste (ask), and anything `AGENTS.md` reserves to the user. A
low-confidence consult, or
one that hedges despite its format, counts as no answer: ask the user.
At most one consult per decision and two per session. Consult rounds do not
consume the worker-round budget.

A consult settles a reversible technical or design decision within the
allowances that remain; adopting its recommendation never starts a round the
caps do not cover. The shared two fix cycles and three review passes gate the
fix → review loop, and both worker budgets (task allowance and run ceiling)
gate worker dispatch only: review, review-deep, and consult rounds keep their
own caps and stay dispatchable after worker-budget exhaustion, including the
permitted review of an exhausted task's completed changes. A consult cannot
grant an allowance or justify a correction beyond those caps, and extending
an allowance is a user-only decision that is never delegated to a consult.
An exhausted task allowance alone is not a run stop (see
[Task exhaustion is not a run stop](#task-exhaustion-is-not-a-run-stop)).
When the caps that govern the next needed round are hit, stop under the stop
conditions and offer the user the named increment the continuation needs
instead.

## Reset and handoff gate

End a worker round and start a fresh subagent when the first of these occurs:

- **Two hypotheses failed**, or the same build/test failure remains after one
  targeted fix and rerun.
- **Three consecutive exploratory actions** (search, read, probe, comparison)
  produced neither a material decision nor a persisted implementation.
- The work changes from implementing the assigned behaviour to understanding
  a new subsystem, upstream-parity question, package-origin question, or
  cross-repository dependency.
- The next action is no longer concrete from the task's original acceptance
  condition.
- At a natural checkpoint, the worker cannot state the next action, evidence,
  and stop boundary compactly enough for a fresh agent to resume without
  rediscovering material context. This is a judgement call; do not reset just
  because a productive build, test, or verification sequence used many tools.

For a reset, the worker changes no unrelated code. It updates
`.agenticale/handoffs/active.md` with at most `GOAL`, `ESTABLISHED` (facts
with file or command evidence), `TRIED` (disproved hypotheses),
`CURRENT STATE` (commits/files/tests), and `NEXT` (one action for a fresh
agent). A discovery round has one question and a decision criterion. Its
conclusion becomes the next implementation round.

Use known repository paths with `git -C {REPO}` where practical. Never hide a
failed `cd` or verification with `2>/dev/null`; a navigation failure is a
blocker to report, not noise to suppress.

## Review gate

Apply the shared round contract's independent review, finding classification,
re-review closure, and two-fix-cycle limit. In strict mode every
implementation slice must pass that gate before work advances. A re-review
reports each prior finding by ID as fixed, partially fixed, still open, or
regressed; when the acceptance involves recovery or interruption behaviour,
require the real user entry or command selection and the interruption boundary
around external side effects, not only internal method tests. A violation of
this workflow's required persistence, handoff, or submodule-pin policy is also
blocking. Record verdicts and nits in the durable state as specified by the
templates below.

A small pre-existing finding may receive a separately scoped fix round;
otherwise preserve it in the backlog without expanding the current task.
Mechanical findings close after the coordinator runs their sufficient acceptance
check; judgmental findings require independent re-review of the fix and affected
invariants. Consultation and the autonomy envelope below govern stuck decisions.

**Repeated findings on the same invariant.** First classify what the
repeated finding actually is. If the invariant is genuinely unmet — an
acceptance or correctness failure the fixes did not address — it is a real
design defect, not drift: reopen the plan through the checkpoint's
replanning signal, reconsidering the state model or approach, with the
original acceptance criteria and the target's fix/review counters intact
and no scope weakening. Only when the behaviour already meets the
acceptance and the later rounds merely introduce a novel preference or
tighten the standard (e.g., list mismatch → missing scope → verbatim
identity) is it a standard-setting question: settle the standard once —
codify the canonical form in this skill or the document — apply it
everywhere, and stop iterating against the reviewer's drift. A
standard-setting question is one of the few cases where the user's
judgement genuinely adds value; take a consult (see Decision consultation)
and codify its recommended standard — recorded as an independently advised
decision the user can veto — instead of guessing or stalling. Neither path
resets counters or weakens scope.

**Autonomy envelope.** The coordinator continues the fix → verify →
re-review loop without asking the user while all of these hold: the work
stays docs/config-only or is reversible under the active persistence policy;
the session's deep review work stays within one opportunistic escalation plus
two re-audits plus two consults; the shared gate's two fix cycles (three
review passes) per target remain available; and no irreversible action is
required. Both worker budgets (task allowance and run ceiling) gate worker
dispatch only, not every dispatch: an exhausted task allowance defers that
task, not the run — the permitted review of its completed changes and another
truly independent ready task stay inside the envelope (see
[Task exhaustion is not a run stop](#task-exhaustion-is-not-a-run-stop)) —
and an exhausted run ceiling stops worker dispatch while the permitted
review of completed changes still runs under the unchanged review caps. A
consult may settle a reversible design or standard-setting question (see
Decision consultation) but never grants an allowance or authorizes work
beyond a cap — only the user can, through a named increment. Breach any
guard, or reach an irreversible action — stop and ask. Asking is for guard
breaches, irreversible actions, and what a consult could not settle — not
for routine continuation inside the envelope.

## Worker prompt template

```
You are round {N} in an autonomous work session, {MODE} mode.
Budgets: run {RUN_ID} {RUN_USED}/{RUN_CEILING} worker rounds used; task
{TASK_ID} {TASK_USED}/{TASK_ALLOWANCE} used. This round is charged to both.
Work in the {REPO} repository at {PATH} (branch {BRANCH}). Related repos:
{OTHERS}.
Git persistence policy: {WORKING TREE | COMMIT | COMMIT AND PUSH, WITH BASIS}.

Goal (context only — you do only your task): {GOAL}

First read:
- {AGENTS.md path}, if it exists (follow its working conventions); otherwise
  skip this item
- {HANDOFF path}, section "{SECTION}" (current state and handoff)
- recent history: git -C {REPO} log --oneline -5
{any extra files, the previous round's NEXT line, or the review's
blocking findings list if this is a fix round}

Your task this round (scope: exactly this, nothing more):
{TASK}

Round budget: end and write the compact reset handoff after two failed
hypotheses, after three consecutive exploratory actions without a decision,
when the task becomes a different investigation, or when a compact handoff
would let a fresh agent continue more clearly. Do not reset merely because a
productive verification sequence used many tools. Do not continue in this
context after a reset trigger.

Before you finish you must:
- verify your work ({BUILD/TEST COMMANDS});
- leave your verified changes in the working tree in every repo you changed:
  the coordinator owns every commit and push at the task persistence gate,
  in dependency order, including applicable outer-repository pins;
- update the handoff section so the next round starts from it.

For a long-running assignment, persist small, verified progress checkpoints in
the handoff at natural milestones and before a long action likely to cross a
provider usage window. Include completed work, evidence, remaining work, and
one concrete next action so a fresh child can resume without replaying the
assignment.

For a read-only exploration assignment, return the handoff facts in your report
instead of editing files; the coordinator will persist them.

Do not start any other task. Do not ask questions and do not wait for user
input — this child must not ask questions or wait for confirmation; make a
reasonable choice within this task and record it as an ASSUMPTION in your
report. If a reset trigger occurs, record evidence and `NEXT` in the handoff
and stop so a fresh subagent can take the next round. The `## Steering`
section of `BACKLOG.md` is human-owned: never edit it, and leave it untouched
in any operational note you write.

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
You are the independent reviewer for a completed task in an autonomous
work session. You did NOT do the work. Assume nothing the worker claims;
verify everything yourself. You make NO code changes. You are unattended in
a child session: never ask the user anything (this child must not ask
questions or wait for confirmation); if the evidence cannot settle a claim,
record it as a blocking finding.

Task that was supposed to be completed (verbatim): {TASK}
Worker's self-report (unverified — check every claim): {REPORT}
Changes to review: {COMMIT HASHES OR BASELINE + WORKING-TREE DIFF per repo}
Git persistence policy: {POLICY}

First read:
- {AGENTS.md path}, if it exists (follow its conventions); otherwise skip
  this item
- {HANDOFF path}, section "{SECTION}"

Independently verify:
1. Build/tests: run {BUILD/TEST COMMANDS} yourself.
2. Persistence discipline, at the phase of the supplied range: the task
   persistence gate runs only after the reviews close, so at slice review
   the task's changes are normally still uncommitted. Inspect status and
   diffs; verify no child committed or pushed them, and that unrelated work
   and secrets stay out of the task's changes. When the supplied range
   already includes commits (a re-review after the gate), verify coherent
   task commits and cleanliness, and verify a confirmed push to the resolved
   destination only when the recorded persistence state says the push
   already happened — never require a commit or push the gate has not
   performed yet; the coordinator owns that final verification at the gate.
   Check that any outer-repo submodule pins match committed dependency
   changes.
3. Scope: inspect the stated commit or diff range; changes match
   the task, nothing beyond it, no drive-by refactors. Do not turn this into
   a repository-wide architecture, upstream-parity, or origin audit
   unless that was the assigned task.
4. Conventions: {relevant AGENTS.md rules when present; handoff updated so the next round
   starts cleanly}.

Append your verdict to the active handoff (doc-only change): one line per
   task round — verdict, plus any nits as backlog items. Write this note to
   the working tree only; you never commit or push it. The coordinator applies
   the supplied Git persistence policy to the note itself. You never archive
   the slice or mark the task completed: the coordinator owns final
   persistence verification and archival after the review and deep review
   gates close and the task persistence gate is satisfied. The `## Steering`
   section of `BACKLOG.md` is human-owned: never edit it; re-read the file
   immediately before your targeted write and preserve any concurrent human
   change.

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
slices. You did NOT do the work. Make no product-code changes. You are
unattended in a child session: never ask the user anything (this child
must not ask questions or wait for confirmation); if the evidence cannot
settle a claim, record it as a blocking finding.

Audit range: {COMMIT OR DIFF RANGE} across {REPOS}.
Accepted slices: {COMPACT_SLICE_SUMMARIES}
Integration acceptance: {BUILD/TEST COMMANDS and contract checks}
Prior audit or session boundary: {BOUNDARY}

First read:
- {AGENTS.md path}, if it exists; otherwise skip this item
- {HANDOFF path}, section "{SECTION}"

Independently verify the supplied range only: cross-slice correctness and
compatibility, integrated build/tests, compliance with the active git
persistence policy at the range's phase (the uncommitted working-tree result
before the task persistence gate; coherent commits and confirmed pushes
after it), submodule pins, handoff/backlog consistency, and regressions
caused by the combined changes. Do not expand into a repository-wide
archaeology audit.

Append a concise audit verdict to the active handoff and promote every nit to
a BACKLOG checkbox, writing both to the working tree only. You never commit
or push these notes; the coordinator applies the active persistence policy to
the handoff-doc changes itself. You never archive slices or mark tasks
completed — final persistence verification and archival belong to the
coordinator after the gates close. The `## Steering` section of `BACKLOG.md`
is human-owned: never edit it; re-read the file immediately before your
targeted write and preserve any concurrent human change.

Your final response must be exactly:
VERDICT: clean | blocking findings
BLOCKING: one line per finding — what, where (file/commit), required action
NITS: one line each (or "none")
EVIDENCE: commands YOU ran with results
NEXT: one concrete action
```

## Stop conditions

Stop the loop and report to the user when any of these hit:

- **Goal met** — the final review (or, standard mode, the final worker
  round) shows it (green tests, persistence policy satisfied, handoff updated).
  Verify with one cheap command, then give the final report.
- **Run ceiling exhausted** — do not dispatch another worker round;
  verification and the permitted review of completed changes still run
  under the unchanged review caps. Report
  the exhausted run ceiling, what remains, what is completed and what is
  blocked, and the recent material progress. Where the host offers an
  interaction tool, offer the situation-appropriate choices — a bounded
  replan (child rounds of a replan consume allowances), one additional
  bounded fix-and-review cycle, or a stop that preserves the current work —
  and name the worker, fix, and review increments each choice consumes;
  without one, state the same options in the stop report. Persist the
  allowance usage and any user-granted extension in the active handoff —
  the existing state, no new tracking system — so a resume or a renamed
  target cannot evade the unresolved-target caps. A user grant is a named
  increment: it adds exactly the worker, fix, and review rounds it names to
  the named budget (run ceiling or task allowance), never resets counters,
  and grants no scope, review, or Git rights beyond what it names; a consult
  cannot grant any of these increments (see Decision consultation). A
  declined or unanswered option ends the stop: do not ask again, do not
  schedule a resume, and leave the work in its preserved state. Give the
  final report with the continuation prompt; the handoff must make the next
  step explicit so work can resume.
- **Task allowance exhausted** — not a run stop by itself. Dispatch no
  further worker round for that task; verification and the permitted review
  of its completed changes still run. Keep the unfinished part incomplete
  and resumable (findings, current state, one next action), then select
  another truly independent ready task with its fresh allowance when one can
  be selected safely; otherwise stop under **No safe ready work** below.
  Never bypass a review gate, dependency, or safety boundary to keep the run
  going, and never manufacture a task.
- **No safe ready work** — the current task is complete, deferred, or
  blocked, and no other truly independent ready task can be safely selected
  while unfinished changes exist. Stop with the preserved state, the
  deferred resumable packets, and the continuation prompt.
- **Persistence blocked** — a required commit or push — task product commits,
  task state finalization, or session-close finalization — cannot be completed
  safely: an unsafe or ambiguous push destination, a rejected or uncertain
  push, or an explicit restriction conflicting with the requested delivery.
  Preserve the exact persistence state, keep any open task open, and stop with
  the continuation prompt; destination decisions ask the user. A resume
  reconciles the actual local and remote state before retrying (see
  [Task persistence gate](#task-persistence-gate)); a blocked session-close
  finalization is the terminal local-only stop under **Persist before
  printing** in Final report.
- **Steering pause** — the human-owned `## Steering` section says `pause`.
  Stop at the safe checkpoint: let a running child settle, record its result
  and charge, preserve the exact `NEXT` and all counters, and report the
  pause with the continuation prompt (see Live steering). No polling,
  watcher, or service.
- **Same task blocked two rounds in a row** — stop; a consult may recommend
  a materially different path, but that path still consumes the worker
  allowance and a consult cannot grant one — otherwise do not burn rounds on
  a wall that only the user can decide.
- **[strict] Three review passes with blocking findings** — stop; one
  consult on the surviving findings may settle which are genuine defects and
  which are standard drift (see Repeated findings on the same invariant), and
  a hedged consult counts as no answer: ask the user. Either way, the
  consult authorizes no further fix cycle or review pass — the user alone
  grants those as named increments. Report the exhaustion with the
  continuation prompt so a resume can act on the grant.
- **Autonomy-envelope guard breach** — deep review work beyond one
  escalation plus two re-audits, a target that has reached the shared gate's
  two fix cycles (three review passes) without a clean result, or work
  leaving docs/config-only/reversible scope — stop and ask.
- **A decision or irreversible action is required** (force-push, deleting
  branches, publishing a release or pull request, or anything `AGENTS.md`
  flags) — irreversible actions and user preference stop and ask (consult
  does not apply); reversible judgement decisions get one consult first (see
  Decision consultation).
- **Two consecutive worker rounds with no net progress** — stop and
  summarize.

## Final report (main loop, ≤ 15 lines)

- The round ledger, one line per round.
- What was achieved, with evidence (changed files or commit hashes, test
  results, review verdicts).
- Where the work now stands (handoff state, including any material change to
  a role's model selection reported on resume) and the exact next step.
- Open blockers or decisions needed.
- For an incomplete stop, the continuation prompt: outcome and blockers with
  evidence, what actually exists (files, branches, commits) and what to
  preserve, the next recommended approach, the checks and independent review
  still required, and the delivery permissions and restrictions.

**Persist before printing.** State lives on disk, not in the conversation
(core rule 3) — the printed report is not the record. Before giving the
final report, the main loop writes the report's pertinent info to the repo
handoff archive (a dated **session-close handoff paragraph** in the current
monthly archive): the round ledger
(one line per round with change references and verdicts), the final verified
state (build/test evidence, per-repo persistence state and pin match), any
material change to a role's model selection reported on resume, the open
nits already tracked as checkboxes, the allowance usage (run and task
identities, ceilings and allowances, consumed counters) and any granted
extensions, the continuation prompt for an incomplete stop, and the exact
next step. A fresh resume validates the handoff against
the actual checkout and re-establishes missing context rather than trusting
it. Update `BACKLOG.md` and
`.agenticale/handoffs/active.md` so they retain only current state, the carried
open items, and one exact next action; add an archive pointer for the closed
session. Update any stale references in place where repository policy
requires it. Then apply the same bounded state-only finalization as the task
persistence gate: under commit or commit-and-push policy, one state-only
commit of the session-close state changes — never product changes — pushed
and confirmed under commit-and-push; under working-tree policy, the recorded
diff evidence. The finalization commit's own hash is never written into the
files it commits; the printed report mirrors the saved archive paragraph and
points at its path and the commit hash read from git history when one
exists. An interruption in the session-close finalization reconciles exactly
like the task gate's: resume the exact unfinished step from the durable
state and git evidence, never duplicating commits.

**Blocked finalization: the terminal local-only stop.** The local records
above come first and never wait on a commit or push. When the session-close
finalization cannot be completed safely — an unsafe or ambiguous destination,
a rejected, failed, or uncertain push, or an explicit restriction conflicting
with the delivery — the task gate's failure rules apply unchanged: no blind
retry, no force-push, merge, or rebase, no branch creation, and no automatic
destination change. Record the exact persistence state — the local commit
hashes when they exist, the destination, and the push evidence or error — in
the session-close paragraph and the active handoff, mark the finalization
deferred and unconfirmed, and stop with the continuation prompt. The stop is
terminal: no further round or retry follows it in this run, and the backlog's
one next action is the deferred finalization. The final report is printed
from the saved local records and reports the finalization as deferred — never
as completed; completion is recorded only once a resume confirms it. A resume
reconciles the session-close finalization exactly like the task gate's:
re-read the durable state, inspect the actual local history and the remote
read-only, and resume the exact unfinished step — push the existing
state-only commit as-is, or create it from the saved local records when none
exists — never duplicating commits; a confirmed finalization closes the
session's persistence without further writes. This is a coordination edit
the main loop may make itself even though it normally does not edit files.

## Anti-patterns

- Letting the main loop read long source files "just to check" — that is
  what the subagents are for.
- Telling a subagent "continue where you left off" without pointing it at
  the handoff file — it has no memory of previous rounds.
- Parallel or background subagents. This mode is sequential by design.
- A worker reviewing its own work, or a reviewer fixing code — the roles
  never blur; fixes are always a worker round.
- Treating nits as blocking (infinite fix loops) or ignoring blocking
  findings to save a round.
- Trusting a "done" or "clean" report without one cheap verification.
- Expanding a round's scope because "it's close" — the round ends on the
  slice it was given.
- Letting a worker use repeated probes, build reruns, or source archaeology
  to avoid a reset — a fresh, compact handoff is the intended recovery path.
- Dispatching a routine slice on the `implement-hard` role "to be safe" —
  the role is for reasoning-heavy work only; wall-clock is the cost.
- Dispatching a judgment slice on the `implement-easy` role because it looks
  small — the easy route is only for explicitly prescribed, mechanically
  verifiable work, and only where the installation configures it.
- Running the deep reviewer on routine slices "to be safe" — escalation is
  trigger-based and capped per session.
- Re-running the full review after a mechanical fix — a deterministic edit
  verified by its own deterministic check closes within the cycle; review
  budget is a scarce resource.
- Iterating against a reviewer's drifting standard — when the behaviour
  already meets the acceptance and later rounds only tighten the standard,
  settle it once instead of chasing each new preference; a genuinely
  unmet invariant is a real defect to replan around, not drift.
- Asking the user for routine continuation inside the autonomy envelope —
  asks are for guard breaches, irreversible actions, and what a consult
  could not settle.
- Asking the user a question one consult round could settle — an unattended
  session gets its second opinion before it gets the user's; the consult is
  the escape hatch, capped at two per session.
- Spending a consult on a user preference, taste, or an irreversible
  action — those go straight to the user; a second opinion cannot veto a
  force-push or decide what the user wants.
- Auto-growing the default run ceiling for a large goal, or letting a
  numeric resume reset persisted consumption — the ceiling changes only by
  explicit override or named grant, and consumed counters carry over.
- Treating one task's exhausted allowance as a run stop while truly
  independent ready tasks remain — or manufacturing a task, or bypassing a
  gate or dependency, to spend the run's remaining budget.
- Charging a settled round twice on resume, trusting a readable budget line
  from a torn write before validating the whole packet, or letting a crashed
  dispatch's productive work replay free — validate first, then reconcile
  the pending-dispatch record once against the actual evidence.
- Editing the human-owned `## Steering` section, treating it as a general
  command channel, or overwriting `BACKLOG.md` wholesale from a stale copy —
  re-read immediately before each targeted write and preserve concurrent
  human edits.
- Archiving a deferred unfinished task as completed, or dropping its
  resumable packet when switching the active task — deferred packets stay in
  the backlog with their identity, counters, and one `NEXT`.
- Reporting goal text supplied during an active run as a conflict, or
  overwriting the active handoff or backlog with it — reconcile it as
  steering: add explicit new tasks, adjust continuation, preserve identities,
  counters, and gates; an ambiguous destructive replacement asks the user.
- Selecting the next task before the completed task's required commits and
  push are confirmed, treating a task as completed while its push is
  outstanding, or blindly duplicating commits after an uncertain push —
  reconcile the actual local and remote state first.
- Leaving the completion record uncommitted after the product push, or
  writing a finalization commit's own hash back into the state it commits —
  the gate ends with one bounded state-only finalization whose confirmation
  is read-only, never a recursive record-your-own-hash loop.
- Retrying a blocked session-close push in the same run, changing its
  destination to make it succeed, or printing the close as finalized before
  confirmation — a blocked close stops terminally with the local records
  saved and the finalization deferred for a reconciling resume.
- A reviewer requiring the gate's commits or confirmed push before the gate
  has run, or a reviewer archiving the slice it closes — review inspects the
  range at its current phase; final persistence verification and archival
  belong to the coordinator after the gates close.
- Letting a child commit or push product changes, or pushing to a
  main/protected/ambiguous destination without asking — the coordinator owns
  Git at the task persistence gate.
- Silently upgrading a resumed working-tree or commit-only run to push
  rights, or bypassing an explicit user or repository restriction to satisfy
  the default policy.
