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
packet, including in the templates in
[references/prompts.md](references/prompts.md). This workflow adds durable state and
unattended continuation to that contract; its state, reset, budget, and decision
policies — now in the `references/` files — remain in force. Where this skill and the
shared contract overlap,
the shared rules bind and this skill adds only the durable-state specifics.

Work a long goal in short, **sequential rounds**. Each round is one foreground
child subagent that receives everything it needs and returns a compact report. The
main loop only coordinates: it defines each round's task, persists the outcome in
the compact state, and stops when done or blocked. The goal is context management,
NOT parallelism — rounds never overlap.

Two modes: **standard** (one worker round per task with the coordinator's normal
verification, no independent review gate) and **strict** (worker round, then an
independent **review round**, looping until the review has no blocking findings,
before the next task starts — a clearly mechanical slice closes by its
deterministic check instead of a review round unless risk warrants an independent
review; see [Review gate](references/gates.md#review-gate)). Choose the mode in round 0 and
state it. Default to
**strict** for every task that changes code, configuration, tests, or other project
behaviour, including a single-task goal. Use **standard** only for investigation-only
work or when the user explicitly accepts skipping an independent review for a
low-risk, mechanical task. The number of tasks alone never justifies standard mode.

## Reference loads

The detailed sections of this workflow live in `references/`. Load each one at its
named loop point, as part of that step — not as a pointer to follow later:

- [references/state-protocol.md](references/state-protocol.md) — before the first
  state event, and on every fresh resume
- [references/persistence.md](references/persistence.md) — in round 0 before
  recording the persistence policy, and at every persistence boundary
- [references/budgets.md](references/budgets.md) — in round 0 before writing the
  budget line
- [references/gates.md](references/gates.md) — before composing a worker packet (its reset
  triggers), at the reset/handoff gate step, before any decision the autonomy envelope
  governs, before dispatching a review or review-deep round, or closing any slice gate
- [references/recovery.md](references/recovery.md) — in the checkpoint on any terminal
  child return (any role, including interrupted or no-report results) or a rejected
  launch, and on reconcile/resume before classifying host evidence — torn or missing
  state, a quota failure whose cooldown was never saved
- [references/consultation.md](references/consultation.md) — at every settlement or declaration consult decision (including the no-dispatch degraded
  path), and when deciding whether a consult is owed, permitted, or warranted, before
  dispatching one
- [references/prompts.md](references/prompts.md) — before composing the first
  prompt for each role
- [references/steering.md](references/steering.md) — on the first read of the steering surface or
  invocation steering text, before interpreting either; apply from context on every later
  read, including resumes and selections
- [references/dispatch.md](references/dispatch.md) — before dispatching any round
- [references/anti-patterns.md](references/anti-patterns.md) — before dispatching
  any round
- [references/stops.md](references/stops.md) — in the checkpoint after every settled child
  return, before redispatch or task selection; on a selection or close reached by a
  resume (or after completing the recorded NEXT), before selecting further work or closing;
  and on a numeric resume that lands budget-exhausted, before any dispatch

## Entry and arguments

Consume the invoking user's goal text directly as the invocation arguments:

- Leading option: an optional positive-integer worker-round budget. `--` is an
  explicit option delimiter; everything after it is the goal text, possibly empty.
  With no budget, the run uses the default ceiling of 240 worker rounds — a generous
  emergency safety limit, not a work target. The budget sets the run ceiling for the
  whole run; each genuine task keeps its own default allowance of 12 with the shared
  progress-based ceiling of 24 (see [Run and task budgets](references/budgets.md#run-and-task-budgets)).
- Whenever the parsed goal text is empty — no arguments or a budget alone — RESUME:
  continue the exact one `NEXT` action recorded in the active state. If no active
  state exists, report that a new run needs goal text. A numeric budget on a resume
  changes the run ceiling only: persisted consumed counters carry over and are never
  reset, so a ceiling at or below recorded consumption leaves the run
  budget-exhausted rather than silently refreshed. On a resume that leaves the run
  budget-exhausted, the run's stop conditions in [references/stops.md](references/stops.md)
  govern the report before any dispatch.
- A supplied goal with already-active state is steering, not a conflict (see
  [Invocation steering](references/steering.md#invocation-steering)).
- Start in **strict** mode unless the user explicitly requested standard mode.

In round 0, follow the setup rules: read the project's `AGENTS.md`, the active state
(`.agenticale/active.md`, or the legacy `.agenticale/handoffs/active.md` when only it
exists), `BACKLOG.md`, and recent relevant Git history. For a new goal, initialize the
state before round 1. For a resume, run the state protocol's reconcile event and
continue the exact one `NEXT` action. For a steering invocation, reconcile first, then
continue. During reconcile or resume, read [references/recovery.md](references/recovery.md)
before classifying host evidence — including a torn or missing state and a quota failure
whose cooldown was never saved — and resume any recorded recovery before dispatching.

Read [references/state-protocol.md](references/state-protocol.md) before the first
state event and on every fresh resume, and
[references/steering.md](references/steering.md) on a steering invocation.

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
  task's own counters, its active targets' recorded `STANDARD:`, `CONVERGENCE:`, and
  `DECLARED:` lines, its per-slice `SLICE-RES:` reservation lines, and the target's
  residual list; one- or two-line result records for completed tasks (date,
  outcome, product commit hashes, confirmed push destination when pushing applies); and
  exactly one active next action. The completed-task count is derived from the confirmed
  result records, never a separate tally. The backlog never mirrors the active task's or
  the run's consumed counters — those live once in the snapshot. Keep it normally below
  about 150 lines.
- `.agenticale/active.md` is the compact active checkpoint — the snapshot. It is at most
  ~2 KB and contains `GOAL`, `ESTABLISHED`, `CURRENT STATE`, `ACCEPTANCE`, and exactly one
  `NEXT` action; a reset adds a compact `TRIED` section. `CURRENT STATE` carries the
  single budget line — run identity, ceiling, consumed; active task ID, allowance in
  force (including any recorded progress extension and the grant flavour of any named
  grant in force), consumed; the open target's fix/review counters — plus the
  pending-charge evidence while a charged child is in flight (dispatch record and
  pending-dispatch note: round number, role, task ID), the compact persistence state of
  an open gate, the current slice's evidence, and, for each active target, its recorded
  standard-settlement, convergence-history, declaration, and slice-reservation lines:
  `STANDARD: <target>: <class>: blocking (bar: <the class's precision bar>) @R<N>
  (<consult-adopted|user>)` (one line per settled class; a nit class is recorded
  `STANDARD: <target>: <class>: nit (residual) @R<N> (<consult-adopted|user>)`; the
  tag records the standard's content provenance — the standard came from the consult
  and the user adopted it, or the user named it themselves or chose an alternative —
  and is `user` on the degraded path where the decision proceeds directly with the
  standard named; a settlement record always evidences a user decision, even when the
  user ratifies the consult's proposed standard),
  `CONVERGENCE: <target>: R<N> <n>fix/<n>new[<classes>]` per review round since the
  last clean close — with the suffix `a!` appended to a round in which an acceptance
  check failed — with a trailing `saturation R<N>|none`, and
  `DECLARED: <target>: R<N> <outcome>; continue-x2 used|unused; remaining:
  <what remains open>` where `<outcome>` is
  `closed-with-residuals|continue-x2|incomplete|user-review`;
  `SLICE-RES: <slice> <spent>/<reserved> [<over-reservation reason @R<N>]>`. When a slice
  gate closes
  accepted-with-residuals, the target's residual list is recorded with its lines: it
  merges every slice residual list at acceptance and rides the task persistence gate and
  the final report. Lines for closed targets fold into the backlog's task result record:
  the snapshot carries only active targets' lines, keeping its size bound. The
  snapshot is not a journal: settled rounds fold into compact backlog task results; the
  snapshot keeps only what the next round and recovery need. Create it before the first
  round of a session if absent. A role's model selection, where the active binding
  exposes it, is an `ESTABLISHED` fact of the activation, not a new state file.
- `.agenticale/steering.md` is the optional human-owned steering file (see
  [Live steering](references/steering.md#live-steering)). It is absent by default; the coordinator reads it and
  never writes it.

**No default archive.** Completed task detail lives in the backlog's result records; the
run creates no monthly archive and no session-close archive paragraph. Historical
material — legacy handoffs, existing archives, old session records — is preserved
untouched: never rewritten into a lossy summary, never deleted, and read only by an exact
pointer when a decision needs it.

**Legacy state compatibility.** A run may carry the legacy layout:
`.agenticale/handoffs/active.md` as the active packet and a human-owned `## Steering`
section in `BACKLOG.md`. On resume, when the new snapshot is absent and a legacy packet
exists, first establish from the backlog and Git whether this run already migrated or
closed: compact result records or a run-close record under the same run identity in the
backlog, or the run's state-only commits carrying `.agenticale/active.md` in git history
(a bounded `git log -- .agenticale/active.md`), show the new contract already ran. The
preserved legacy packet is history, not current evidence — its counters stopped being
current at the transition, so a later loss of the new snapshot never restores them.

**Reconcile close persistence before classifying closure.** Durable completion records
alone never close a snapshot-absent run. The final close's completion, cleanup, and
record-resolution steps are persistence boundaries like any other: an interruption in
them reconciles first — on every resume, before the closure classification — under the
[bounded persistence sequence](references/persistence.md#the-bounded-persistence-sequence)'s
interruption rules and the final close's cutpoints (see
[Consolidated final close](references/persistence.md#task-persistence-gate)), never as an
after-the-fact exception to a closure report. The
reconciliation never re-imports the legacy packet, never recreates a legitimately deleted
snapshot, and changes no identities or counters. Then classify:

- **Already closed** — the run-close record and every task's confirmed result record are
  durable under the policy, and the close's full persistence is verified — the completion
  and bounded cleanup confirmed under the policy, any deferred failure records resolved,
  and no outstanding close commit or push: report the confirmed closure from those
  records; never re-import the legacy packet or restart the run. A new run needs new goal
  text.
- **Already migrated, run still open** — never re-import the legacy packet. The missing
  new snapshot follows the reconcile event's recover-or-stop rule: rebuild from the last
  committed new-snapshot state plus verified host and working-tree evidence of the rounds
  since, applying each charge exactly once, or stop naming the gap.
- **No migration or closure trace** — make the one-time transition: validate the legacy
  packet, carry its identities, consumed counters, allowances in force, fix/review
  counters, open gates, and recorded persistence policy exactly into the new compact
  snapshot — no reset, no re-derivation — persist the transition under the active policy
  as a bounded state-only checkpoint before further dispatch (recorded diff evidence
  under working-tree policy), so any later resume can recognize the migration, then run
  the reconcile event and continue under this contract.

The legacy file itself is historical material: never auto-edited, migrated away, or
deleted. The legacy backlog's consumed-counter mirrors and milestone status are
superseded by the snapshot's budget line — never authoritative again and no longer
maintained; later targeted writes follow the compact board format above, preserving the
human-owned `## Steering` section, deferred packets, result records, and historical
pointers. When both packets exist, a valid new snapshot wins and the legacy
packet stays untouched. A torn or missing packet — new or legacy — follows the reconcile
event's recover-or-stop rule. Legacy steering compatibility and precedence are defined
under [Live steering](references/steering.md#live-steering).

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
   Read [references/persistence.md](references/persistence.md) before recording
   the persistence policy, and [references/budgets.md](references/budgets.md) before
   writing the budget line.
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
   round, dispatch the focused explore round with its one question and stop condition under
   the task loop's pre-dispatch loads (dispatch.md, anti-patterns.md, prompts.md, gates.md)
   instead of reading source itself.
3. Follow [Task dispatch and capability](references/dispatch.md#task-dispatch-and-capability). For a resume, compare the current installation
   against the recorded dispatch records first and report a material change to a role's
   model selection. Record the model selections the binding exposes in the snapshot's
   `ESTABLISHED` facts; the workflow creates or modifies no configuration file.
4. State the plan in 3–6 lines: goal, budget, mode, persistence policy, how the work splits
   into slices, and stop conditions. Record the planned tasks in the backlog with their
   stable IDs now, before any selection; allowances are allocated later, at first selection.
   Then start round 1 without waiting for approval; pause only on a [stop condition](references/stops.md).

## Task loop

Tasks come from the round-0 plan, an invocation steering reconciliation, the backlog's
active next action, or the previous round's report.

Before every new round dispatch — worker, review, fix, consult, or deep review — re-read the
steering surface (see [Live steering](references/steering.md#live-steering)) and the snapshot's budget line. A
`pause` stops the loop at the safe checkpoint described there. A worker dispatch
additionally needs at least one effective worker round — the smaller of the task's remaining
allowance in force and the run's remaining ceiling; apply the state protocol's charge event
before launching the child. When the allowance in force is reached and verified progress
evidence justifies continuation, record the bounded extension first (shared contract), then
dispatch under the new allowance.
Read [references/steering.md](references/steering.md) before interpreting the surface
or the invocation steering text — it defines `mode` and `priority`, which surfaces
supply a `pause`, and the legacy/new precedence — on the first read, and apply the rules
from context on every later read, including a resume or selection that reads the surface
before the next dispatch. Before every new dispatch, read
[references/dispatch.md](references/dispatch.md) and
[references/anti-patterns.md](references/anti-patterns.md).

Task selection happens only at a selection boundary — the current task complete through its
persistence gate, or documented as deferred or blocked — never mid-task. The run processes
eligible backlog tasks until the backlog is drained or a safety limit is reached: at each
boundary where a task has just completed, check the completed-task count against its limit
before selecting further work. A selection or close reached by a resume (or after completing
the recorded `NEXT`) applies the same stop check before selecting further work or closing —
load [references/stops.md](references/stops.md) on first use, apply from context afterwards.
Apply the steering priority among ready tasks, then the
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
verification policy. The [deep review gates](references/gates.md#review-deep-gates) still govern escalation; decomposition adds
no per-step deep review. Apply
[the shared contract's checkpoint](../work/references/rounds.md#checkpoints-decision-summary-and-stop-reports)
after every substantive worker or reviewer result, and its progress narration guidance
before each substantive dispatch, including the first: what was learned, what comes next,
and why. As part of that checkpoint, on any terminal child return (any role, including
interrupted or no-report results) or a rejected launch, read [references/recovery.md](references/recovery.md)
before repair or interruption handling; after every settled child return — worker, review,
fix, consult, reset, or correction round — run the stop check, the binding for
[references/stops.md](references/stops.md), before redispatch or task selection; load each
on first use, apply from context afterwards. Keep the compact state in the snapshot's `CURRENT STATE`; routine
dispatch records
and counters belong in that state, not in every visible update.

When a task decomposes into N known slices, record a per-slice reservation — the allowance
in force divided by the slices remaining, minimum one — in the snapshot
(`SLICE-RES: S1 5/5`). A slice spending past its reservation does not stop: it records the
reason (standard loop, replan, …) and surfaces the remaining slices' reduced margin in the
next dispatch packet. The shared
[Convergence declaration](../work/references/rounds.md#convergence-declaration) is the
single authority for the threshold: its two-round saturation trigger applies once the
slice has spent more than half its recorded reservation, and a slice that has overspent
has necessarily spent more than half of it, so the same single trigger applies — no
second condition exists. At a task
with S1+S2+S3 and a 12-round allowance, S1's over-reservation at round 5 would have been
flagged before round 9, not discovered inside a budget question.

For each current slice or discovery assignment:

1. **Worker round.** Compose a self-contained prompt from the worker template. Invoke one
   foreground child carrying the matching task contract (see [the dispatch rules](references/dispatch.md#task-dispatch-and-capability)).
   Check the report against a quick verification (`git -C <repo> status` and, when
   applicable, `git -C <repo> log -1`). If the host result proves provider quota exhaustion,
   handle it under [Provider quota recovery](references/recovery.md#provider-quota-recovery) before report repair
   or interruption handling. Otherwise, if the report is missing, malformed, or its claims
   do not match, send one correction round with the observed discrepancy — do not restart
   the task.
   Read [references/prompts.md](references/prompts.md) before composing the first
   prompt for each role, [references/gates.md](references/gates.md) before composing the
   worker packet — the reset triggers in it bind the packet — and
   [references/recovery.md](references/recovery.md) when classifying the child's return.
2. **Reset/handoff gate.** If the report hit a reset trigger, persist its compact reset
   evidence, record the outcome, and start the next worker as a fresh investigation,
   diagnostic, or implementation round from the snapshot. A reset is normal progress and
   counts as one worker round; do not make it a free, hidden continuation. Do not review an
   unfinished task. If host evidence shows quota exhaustion, use
   [Provider quota recovery](references/recovery.md#provider-quota-recovery) before
   applying this gate. Read [references/gates.md](references/gates.md) at this step — it
   defines the reset triggers and the fresh-handoff rules.
3. **[strict] Review round.** For a clearly mechanical slice — one whose entire
   acceptance is a deterministic check — the coordinator runs that check and the
   slice's gate is its pass; no review round is dispatched unless risk warrants an
   independent review (a surface the check does not cover, a visible correctness
   risk, interaction with earlier work, or the user's explicit strictness), in which
   case this review round runs as usual. Otherwise compose the review template with
   the task definition, the worker's compact report, and its commit hashes or
   recorded change range. A fresh child carrying the review contract verifies
   independently and reports findings; the coordinator records the verdict in the
   durable state. For a high-risk slice whose risk warrants an integration-level
   audit, the slice's review round is that deep review — one level for the slice's
   range: the slice's own gate is never both a normal review and a deep one — and
   its verdict is the slice's gate; a justified post-gate audit (the struggle
   trigger, the periodic gate, an explicit user request) still follows per the
   [Deep review gates](references/gates.md#review-deep-gates). See
   [Review gate](references/gates.md#review-gate).
   Read [references/gates.md](references/gates.md) before dispatching a review or
   review-deep round, or closing any slice gate.
4. **Gate.** In strict mode a slice is only accepted when its applicable required
   gate passes — a review round, ordinary or a deep review standing in for the
   slice's own gate, returning no blocking findings, or for a clearly mechanical
   slice, its deterministic check run by the coordinator; in standard mode, the
   applicable required gate is the slice's normal verification. A failed gate is
   handled by its kind: a failed deterministic check or failed standard-mode
   verification is repaired and the same gate is re-run by the coordinator — no
   finding classification and no review round, since no reviewer ran, and those
    repairs are not fix rounds for the struggle trigger — and only
   when the gate was a review round do its blocking findings get a fix round and
   then close by their class (the [Review gate](references/gates.md#review-gate)'s
   finding-class rules): a mechanical
   finding is closed by the coordinator running its sufficient
   deterministic check — no review round — while a judgmental finding gets an
   independent re-review of the fix and the invariants it touched (a review round,
   or the scoped deep re-audit where the gate was deep). Before dispatching the next
   fix round for an unresolved target, the struggle trigger is checked on its own
   condition — at least two fix rounds made in response to a review round's findings —
   and when it fires while the slice's gate has not passed, the in-loop **diagnostic
   audit** dispatches (advisory, never the slice gate; see the
   [Deep review gates](references/gates.md#review-deep-gates)) before
   the next fix; if dispatching it would exceed an applicable explicit review
   limit that covers deep reviews, or consume the last permitted review under it,
   the loop does not
   dispatch — it stops at that boundary report-only, and the eligible
   `cap`-flavoured increment on that limit is a separate question-eligible situation
   through the [anti-ask gate](#asking-the-user-anti-ask-gate) — the
   budget-exhaustion entry, per the shared
   [Grant flavours](../work/references/rounds.md#grant-flavours) rule: an
   explicit review limit is cap-only, and reporting the stop is not asking; that
   boundary stop defeats the anti-ask
   gate's third check — when it fires, continuation is not covered, and the
   loop dispatches neither the in-loop diagnostic nor the next fix; when a
   settlement decision or a saturation
   declaration is pending for the target, the struggle trigger is not checked and the
   in-loop diagnostic audit is not dispatched — the pending decision is itself the
   resolution the audit would be ordered to end in (settlement proposal, replan, or
   declaration), and the shared
   [Decision order](../work/references/rounds.md#convergence-declaration) forbids
   further rounds on the target while it is pending — and the trigger is re-checked on
   the next loop iteration once the decision is recorded. After the applicable gate
   closes — passing cleanly or closing `accepted-with-residuals` under a recorded
   settlement or declaration — check the remaining opportunistic deep review escalation
   triggers and any applicable [deep gate](references/gates.md#review-deep-gates) before recording the slice accepted: the
   checks apply to either closure outcome, not only a clean pass, before the task
   proceeds.
5. **Record the outcome.** An accepted slice that leaves the task unfinished continues with
   the task's next slice. When the task's last slice is accepted and its applicable deep
   gates have closed, satisfy the task persistence gate — coherent task commits, a confirmed
   ordinary push, and the bounded state-only finalization under the active policy — before
   the next task is selected.
   Read [references/persistence.md](references/persistence.md) at every persistence
   boundary. The stop check — the binding for [references/stops.md](references/stops.md) —
   runs in the checkpoint after every settled child return, before
   redispatch or task selection: read it on first use, then apply it from context.

## Asking the user (anti-ask gate)

The main loop asks the user only through this gate: the closed list defines
which SITUATIONS are question-eligible, and the three checks below decide
whether an eligible situation may be asked NOW. Every question the loop would
put to the user — from the closed list or not — is a candidate question that
passes those checks; a question that fails them is a guard breach of the
autonomy envelope, not a courtesy: it stops, is reported as such, and does
not go to the user. An exact-cap (or ceiling) stop is report-only unless an
interactive grant offer is eligible under the
[Grant flavours](../work/references/rounds.md#grant-flavours) rule: reporting the stop is not asking.

Decisions the autonomy envelope governs are made under the [autonomy
envelope](references/gates.md) rules: read them before such a
decision, load once, and apply from context afterwards.

The closed list of question-eligible situations: an
autonomy-envelope guard breach; an irreversible or user-reserved action
(or anything `AGENTS.md` reserves);
a user preference over scope, acceptance, or goal text; a budget exhaustion
stop with its increment offer — the one leading-option rule keyed to the
exhausted budget, per the shared
[Grant flavours](../work/references/rounds.md#grant-flavours) rule: `progress`
leads only while the task worker allowance is below its progress ceiling,
otherwise at most a `cap`-flavoured named increment — that rule, read before
dispatching, is the full one, and below the ceiling an exact `cap`-flavoured
boundary is not progress-eligible (a cap boundary offers at most a
`cap`-flavoured named increment); never lead with an auto-extension that
cannot take effect; the run ceiling and the limits
never auto-grow, a run-level stop keeps its INCOMPLETE safety-stop character,
and verified progress does not override a cap; a standalone
[standard settlement](../work/references/rounds.md#standard-settlement) —
ratify, an alternative including the
reviewer's original bar, or close now — its options and consult/degraded-path
order are the shared contract's, read before dispatching; the decision is owed
either way, the consult is not; a one-time grant-flavour clarification when a
free-text grant is ambiguous ([Grant flavours](../work/references/rounds.md#grant-flavours)); a
persistence-recovery question — a destination or commit-attribution
question when persistence is blocked, declared question-eligible in the
[bounded persistence sequence](references/persistence.md#the-bounded-persistence-sequence) — which
passes the gate's three checks like any other candidate question; a
[convergence declaration](../work/references/rounds.md#convergence-declaration)
that requires a closure decision; or the same blocker two rounds running with
no materially different path (consult first). Read
[references/consultation.md](references/consultation.md) at every settlement or declaration
consult decision, including the no-dispatch degraded path.

A settlement record always evidences a user decision, even when the user
ratifies the consult's proposed standard: the `STANDARD:` line's tag
(`<consult-adopted|user>`) records the standard's content provenance and is `user`
on the degraded path.

A candidate question — including one from the closed list — passes the
checks, in order, and the outcome is recorded in state:

1. **Recorded decision?** A settlement or declaration already covering the
   situation binds — apply it, do not ask.
2. **Consult owed?** The decision is a reversible judgement (surviving
   blocking findings, a standard question, a path choice) and no consult has
   run for it — run the consult first; a low-confidence or hedged consult
   counts as no answer, and the owed question then proceeds through this gate.
   Read [references/consultation.md](references/consultation.md) when deciding whether
   the consult is owed, permitted, or warranted — before dispatching one.
   On the two standard-setting paths the mandatory consult runs first, then
   the one decision proceeds through this gate per the shared contract's
   [Decision order](../work/references/rounds.md#convergence-declaration); on
   a standard-setting path whose consult allowance is exhausted, no consult is
   owed — the one decision proceeds directly, recorded.
3. **Continuation covered?** The effective worker budget covers the next
   cycle — the next fix and its required re-review — each applicable explicit
   review limit leaves at least one review available after that cycle, the
   latest fix made verified progress, and no safeguard, settlement, or
   declaration is pending — continue the loop without asking and record the
   auto-continuation (round, target, evidence) in the snapshot. When the next
   cycle would exceed an explicit review limit or consume the last permitted
   review under one, continuation is not covered: the loop stops report-only,
   and the eligible `cap`-flavoured increment on that review limit is a
   separate question-eligible situation through this gate — per the shared
   [Grant flavours](../work/references/rounds.md#grant-flavours) rule: an
   explicit review limit is cap-only, and reporting the stop is not asking.
   When an in-loop diagnostic dispatch
   is pending and dispatching it would exceed an applicable explicit review
   limit that covers deep reviews, or consume the last permitted review under
   it, continuation is not covered either: the
   loop stops report-only and dispatches neither the in-loop diagnostic nor
   the next fix, and the eligible `cap`-flavoured increment on that limit is
   a separate question-eligible situation through this gate (per the shared
   [Grant flavours](../work/references/rounds.md#grant-flavours) rule: an
   explicit review limit is cap-only, and reporting the stop is not asking).

"The review blocked again" is not on the closed list while the gate's third
check holds.

## Final report (main loop, ≤ 15 lines)

- A compact summary of the round outcomes and verdicts, drawn from the saved task evidence
  (not a durable per-round ledger).
- What was achieved, with evidence (changed files or commit hashes, test results, review
  verdicts).
- Where the work now stands (state, including any material change to a role's model selection
  reported on resume) and the exact next step. Under a restricted policy, state that accepted
  work remains unpushed (commit-only) or uncommitted and unpushed (working tree), per the
  recorded policy and its basis.
- Open blockers or decisions needed, and the merged residual list of any task closed
  accepted-with-residuals — recorded in state and in the task result record.
- For an incomplete stop, the continuation prompt: outcome and blockers with evidence, what
  actually exists (files, branches, commits) and what to preserve, the next recommended
  approach, the checks and independent review still required, and the delivery permissions
  and restrictions.

**Persist before printing.** State lives on disk, not in the conversation (core rule 3) — the
printed report is not the record. Unless persistence is already blocked — in which case the
close goes directly to the terminal local-only stop below, creating no commits and attempting
no pushes — the close first applies the
[stop-boundary WIP checkpoint](references/persistence.md#stop-boundary-wip-checkpoints) under the active policy, so the
records below carry the actual WIP hashes and push state; the local records never wait on a
WIP push that cannot complete safely. Before giving the final report, the main loop writes
the report's pertinent info to the durable state as compact task evidence, not a round
journal: settled round outcomes fold into the backlog task's bounded result/progress note
(change references and verdicts), alongside the final verified state (build/test evidence,
per-repo persistence state and pin match), any material change to a role's model selection
reported on resume, the open nits already tracked as checkboxes, the continuation prompt for
an incomplete stop, and the exact next step. Consumption stays once in the snapshot's budget
line — run and task identities, ceilings and allowances in force, consumed counters, the
completed-task count derived from the confirmed result records, and any granted or
evidence-backed progress extensions — never duplicated as a separate tally or a per-round
ledger. No stop or close requires a full round ledger; host logs and git history are optional
diagnostics, not a default archive. A fresh resume validates
the state against the actual checkout and re-establishes missing context rather than trusting
it. Update `BACKLOG.md` and the snapshot so they retain only current state, the carried open
items, and one exact next action. Then apply the [bounded
persistence sequence](references/persistence.md#the-bounded-persistence-sequence) to the close
records: one state-only commit of the close state changes — never product changes — pushed
and confirmed under commit-and-push; under working-tree policy, the recorded diff evidence.
When the run is complete (goal met), this is the consolidated final close: the same commit
carries the last task's completion record and the run-close record, keeping the snapshot as
the recovery checkpoint; the bounded snapshot cleanup follows only after that commit's
persistence is confirmed (see
[Consolidated final close](references/persistence.md#task-persistence-gate)).
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
evidence or error — in the snapshot and backlog, or in the backlog alone when the verified
final-close cleanup already removed the snapshot (never recreate it), mark the blocked
persistence deferred and unconfirmed, and stop with the continuation prompt. The stop is terminal: no further round or
retry follows it in this run, and the backlog's one next action is the deferred persistence.
The final report is printed from the saved local records and reports the persistence as
deferred — never as completed; completion is recorded only once a resume confirms it. A
resume reconciles exactly like the task gate's, before any next work: re-read the durable
state, inspect the actual local history and the remote read-only, and resume the exact
unfinished steps in order — push the existing blocked commit as-is, creating it from the
saved local records only when none exists, never duplicating commits. After the push is
confirmed, resolve the deferred failure records to the confirmed hashes and destination
and complete any remaining close step; the changed durable state not yet committed rides
in exactly one bounded state-only commit, pushed and confirmed under the policy — never
while an earlier push is still unconfirmed. A boundary already confirmed with no
outstanding record writes needs no further write. If the blocked commit is the final-close
cleanup commit, the snapshot was already removed after verified completion persistence: it
stays recoverable from git history, the failure records live in the backlog alone, and the
resume never recreates the snapshot. This is a coordination edit the main loop may make
itself even though it normally does not edit files.
