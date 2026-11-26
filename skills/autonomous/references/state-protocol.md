## State protocol

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
can drift. The open target's fix/review counters and its recorded `STANDARD:`,
`CONVERGENCE:`, and `DECLARED:` lines, its per-slice `SLICE-RES:` reservation lines, and
the target's residual list live in the snapshot (or the deferred packet when deferred)
and persist as evidence without reset or re-identification on resume or rename.

**Write discipline.** Every event step is a targeted edit applied to a fresh re-read of the
file it writes, read back to confirm it landed before the next step; each step writes one
bounded state block, never a whole-file overwrite from a stale copy. Every `BACKLOG.md`
write preserves any concurrent human edit. The steering surface is human-owned and never
agent-written (see [Live steering](steering.md#live-steering)).

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
are defined under [Run and task budgets](budgets.md#run-and-task-budgets). After the steering
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
  [Provider quota recovery](recovery.md#provider-quota-recovery)); it consumes no allowance.
- A confirmed never-launched dispatch removes its charge, restores the pre-launch counters,
  and resolves the note as never-launched: no round ran.
- A continuation is a new round with its own single charge — against both budgets for a
  worker role, under the role's own accounting for review, review-deep, or consult.

Never charge the same round twice, and never let a replay of productive work run free of
its recorded charge. A crash or session loss leaves the pending record durable; the
reconcile event resolves it against the working tree and host evidence before dispatching
again.

**Switch (A → B) — at a selection boundary.**

1. Write A's deferred packet — with its current counters from the snapshot's budget line,
   its active targets' recorded `STANDARD:`, `CONVERGENCE:`, and `DECLARED:` lines, its
   per-slice `SLICE-RES:` reservation lines, and the target's residual list — into the
   backlog's deferred entries. The outgoing packet is durable before the snapshot is
   overwritten, so no interrupted step loses a packet.
2. Write B's packet into the snapshot, restoring B's task counters and its targets'
   recorded `STANDARD:`, `CONVERGENCE:`, and `DECLARED:` lines, its per-slice `SLICE-RES:`
   reservation lines, and the target's residual list from its backlog packet (or a fresh
   allowance for a genuinely new task) and carrying the run identity, ceiling, and
   consumed unchanged from the outgoing budget line.
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
[bounded persistence sequence](persistence.md#the-bounded-persistence-sequence)'s interruption and failure rules
instead; identities and consumed counters are unchanged by every persistence reconciliation.

**Finalize — confirm a persistence boundary.** Apply the
[bounded persistence sequence](persistence.md#the-bounded-persistence-sequence). For the task gate, the
completed-task count increments exactly once at that confirmation, and the next task is
selected only after it.

**Resume.** A resume — the same invocation with empty or numeric arguments — runs the
reconcile event first, then continues the exact one `NEXT` action the validated state
names: the exact unfinished step of an interrupted event or persistence boundary, never a
replay of confirmed work. A resume reads the persisted identities and counters and
continues them; it never resets counters and never re-issues task IDs. A numeric resume
override changes the run ceiling only: remaining becomes the new ceiling minus the
persisted consumption, floored at zero. When persisted consumption already meets or exceeds
the new ceiling, the run is budget-exhausted and stops under the [stop
conditions](stops.md#stop-conditions) instead of silently resetting. A user grant adds exactly the named rounds to the named
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
