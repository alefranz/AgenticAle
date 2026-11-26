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

Every state-only persistence boundary — a task gate finalization, a reconciliation or
legacy-transition checkpoint, the stop close, the final close, and its bounded cleanup —
ends with this one bounded sequence, defined here once; the boundary sections name it
instead of restating it.

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
then complete missing record writes from the confirmed hashes and destination — changed
durable state not yet committed rides in exactly one bounded state-only commit under the
policy, never while an earlier push is unconfirmed. A finalization already confirmed with
no outstanding record writes satisfies the boundary without any further write. Identities
and consumed counters are unchanged by every persistence reconciliation.

**Failed, uncertain, or blocked persistence is terminal for the run.** A rejected, failed,
or uncertain push — of product commits, of a WIP or reconciliation checkpoint, or of a
state finalization — or a destination that stops the push before it runs, never advances
the run: record the exact persistence state — the task or boundary, commit hashes,
destination, and the push evidence or error — in the snapshot and backlog, keep every open
task open, and stop with the continuation prompt via the terminal local-only close (see
[Final report](../SKILL.md#final-report-main-loop--15-lines)). No further commit or push follows
it in this run: a later WIP or
finalization push would carry the uncertain commit as a descendant, an implicit retry. Do
not select the next task, force-push, merge or rebase automatically, retry blindly, or
change the destination; a non-fast-forward rejection means the remote moved; preserving
the state and asking is the recovery, not rewriting history. A recovery question the
run would put to the user is question-eligible and proceeds through the [anti-ask
gate](../SKILL.md#asking-the-user-anti-ask-gate). All further persistence is
deferred to a reconciling resume, which reconciles the actual local and remote state
before any next work under the interruption rules above.

### Task lifecycle states

Once selected, a task is in exactly one lifecycle state. The state — not a worker's report
or a clean review — governs next-task selection and completion accounting:

| State | Entry condition | Next-task selection | Completed-task count |
| --- | --- | --- | --- |
| review-open | Work in progress; a required slice review, fix loop, or applicable deep gate is still open. | Never — the task stays active. | Never |
| accepted | A terminal task state, entered only when every required task gate — every required check, review gate, and applicable deep gate — has closed and acceptance is verified; it and `accepted-with-residuals` are both terminal task states, and the difference is that no slice gate closed with residuals under a recorded settlement or declaration. The persistence gate has not yet run — task persistence (`persistence-pending → complete`) remains outstanding in both states. | Never — the gate runs first. | Never |
| accepted-with-residuals | A terminal task state, entered exactly as `accepted` — every required task gate closed and acceptance verified — with the one difference that at least one slice gate closed on the shared contract's `accepted-with-residuals` outcome (every open finding a nit under the target's recorded settled standard, under a recorded settlement or declaration); only that slice-gate closure is terminal at the gate level — while any later slice or required gate is still open the task stays `review-open`; the merged residual list — every slice residual list carried in state — rides the task persistence gate and the final report; the persistence gate has not yet run — task persistence (`persistence-pending → complete`) remains outstanding in both states. | Never — the gate runs first, exactly as for `accepted`. | Never |
| persistence-pending | The gate is underway: a required product commit, its push, or the bounded state finalization is outstanding or unconfirmed. | Never — finish or reconcile the gate first. | Never |
| complete | The whole persistence gate is confirmed under the active policy, including the bounded state finalization. | Allowed at the next selection boundary. | Counts exactly once |
| deferred / blocked / exhausted | Unfinished, with a resumable packet or open findings preserved in the backlog. | Only via documented deferral: another truly independent ready task may be selected safely. | Never |

Invariants:

- A clean review closes a slice gate, never the task: review-open → accepted still leaves
  the persistence gate outstanding. An accepted or persistence-pending task is never
  reported completed or counted, and the next task is never selected while its required
  commit or push is outstanding or unverified.
- `review-open → accepted-with-residuals` leaves the persistence gate outstanding exactly
  like `accepted`: the state transition is
  `review-open → accepted-with-residuals → persistence-pending → complete`, the residual
  list is part of the gate's evidence, and the gate's "required checks and reviews
  complete" clause is satisfied because the blocking set under the settled standard is
  empty. An accepted-with-residuals task is never WIP-checkpointed or deferred as
  incomplete: its residuals are recorded, not open work.
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
   — in strict mode, the review round, or for a clearly mechanical slice, its
   deterministic check run by the coordinator; in standard mode, the normal
   verification — and every applicable deep review gate, periodic or opportunistic, has
   closed. An unfinished or review-open task is never persisted as completed.
2. **Coherent task commits.** The coordinator stages only the task's accepted product
   changes and creates coherent task commits — one per logical change, not one per agent
   round. Unrelated staged, unstaged, and untracked work, concurrent human edits, and
   secrets are preserved and never swept into a task commit; overlapping edits that cannot
   be attributed to the task safely stop, and the attribution question proceeds through
   the [anti-ask gate](../SKILL.md#asking-the-user-anti-ask-gate). An investigation-only task produces
   findings, not product changes: it creates no artificial product commit; when its
   findings change the durable state, the finalization persists them like any other state
   change, and with truly nothing to persist the gate is satisfied by the recorded
   findings. The run's durable state is never swept into product commits. When part or all
   of the accepted product changes already sit in recorded WIP checkpoint commits from an
   earlier stop, those commits are the task's product commits for the changes they carry:
   verify their attribution and coherence, never re-commit or duplicate them, and commit
   only the remaining accepted working-tree delta. The push and the completion record
   include the WIP hashes, and the coordinator's own reviews of the task use a range whose
   lower bound is the recorded pre-WIP base or earlier, so the WIP commits are inside the
   diff — never excluded by a base that already contains them.
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
remaining task and the goal is met, the same finalization also carries the run-close
record — one bounded state-only completion commit, not a separate task finalization
followed by a session-close commit. The snapshot is not deleted in this commit: it stays,
updated with the confirmed product persistence and one `NEXT` naming the close's exact
unfinished step, as the recovery checkpoint until the completion commit's final required
persistence is verified under the policy — the confirmed push under commit-and-push, the
commit under commit-only, the recorded diff evidence under working-tree. A run that stops
incomplete keeps the snapshot as its resume state; the stop close persists the stop
records without deleting it.

**Snapshot cleanup.** Only after that verification, and only for a completed run: fold
the snapshot's remaining content into the backlog's result records, read them back, then
remove the snapshot. Under commit or commit-and-push the fold and deletion ride in one
bounded state-only cleanup commit, created only after the completion commit is confirmed
— never while its push is uncertain, when the cleanup would carry it as a descendant —
and pushed and confirmed under commit-and-push. Under working-tree policy no commit
exists: record both changes as diff evidence. The deleted snapshot stays recoverable from
git history. Never delete the snapshot while any task is unfinished or any required
persistence is unconfirmed.

The close's entry and resume cutpoints follow the bounded sequence's interruption and
failure rules, in this fixed order:

1. Records written, completion commit missing: an interruption resumes the one completion
   commit; a blocked destination stops before it, with the failure records in the
   still-present snapshot and backlog.
2. Completion commit exists, push unconfirmed: a rejected, failed, or uncertain push
   stops terminally with the failure records in the still-present snapshot and backlog;
   no cleanup commit is created in this run. A reconciling resume pushes the existing
   completion commit as-is — never re-creates it — and confirms it.
3. Completion persistence confirmed, cleanup outstanding: the resume runs the cleanup
   above — no second completion commit, no rewritten completion records. After a blocked
   completion push, the deferred failure records are resolved to the confirmed hashes and
   destination, and the resolution rides in the one cleanup commit with the fold and
   deletion.
4. Cleanup commit exists, its push rejected, failed, or uncertain: the snapshot is
   already legitimately gone; the terminal failure records go to the backlog alone —
   never recreate the snapshot — and no further commit or push follows in this run. A
   reconciling resume pushes the existing cleanup commit as-is; once confirmed, the
   deferred records are resolved to the confirmed destination and ride in exactly one
   bounded state-only resolution commit, pushed and confirmed under the policy. Its own
   hash is never written back.

The safe count: a successful close is exactly two state-only commits — completion, then
cleanup — each confirmed before the next step begins. Each failed or interrupted push
adds at most one bounded record-resolution commit on a later resume, created only after
the prior push is confirmed: never a descendant of an uncertain push in the same run,
never a duplicate commit, never a record-your-own-hash write.

**Push destination.** Resolve the destination before the run's first push and re-check it
at every push: the checked-out branch's configured upstream (remote and branch), plus any
destination named by repository instructions. Push only to that resolved upstream. Stop
before pushing when the destination is unsafe or unclear — the destination question
proceeds through the [anti-ask gate](../SKILL.md#asking-the-user-anti-ask-gate) — the unsafe or
unclear cases: the branch is
`main`/`master` or otherwise protected by repository instructions or hosting rules, no
upstream is configured, multiple remotes make the target ambiguous, or the outgoing commits
include work outside the authorized scope. The run's completed-task commits and recorded
WIP checkpoint commits are authorized outgoing scope — a WIP checkpoint is pushable even
while its task's review is open — but unrelated or unreviewed unauthorized commits are not;
the run resolves the publication scope first, and that publication-scope question proceeds
through the [anti-ask gate](../SKILL.md#asking-the-user-anti-ask-gate). Never create a branch, change
remotes, force-push, merge, or open a pull request to make a push succeed.

### Stop-boundary WIP checkpoints

A stop that ends the session preserves attributable unfinished product work, not only the
durable state. Under commit or commit-and-push policy, the coordinator creates one WIP
checkpoint commit per changed repository, staging only the unfinished product changes
attributable to the run's tasks — including review-open changes. The commit message
identifies the checkpoint explicitly: a `WIP:` prefix naming the run identity and the task
IDs whose changes it carries (for example `WIP: csv-export T2 — slice 2, review open`).
Unrelated staged, unstaged, and untracked work, concurrent human edits, and secrets are
preserved and never swept into a WIP commit; overlapping edits that cannot be attributed to
a task safely stop, with the attribution question proceeding through the
[anti-ask gate](../SKILL.md#asking-the-user-anti-ask-gate), leaving the changes in the tree. With no attributable
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
sequence to them. The durable record carries, per task, the WIP commit hashes, the pre-WIP
review base (the commit immediately before the task's first WIP checkpoint commit in each
repository), the verification and review status (what passed, what is still open), the push
state (confirmed destination, or deferred with its evidence), and exactly one resumable
`NEXT`. This compact per-task evidence lives on the backlog task entries and, as recovery
needs it, in the snapshot. Consumed counters are not part of that per-task record: the
active task's and the run's consumption stay once in the snapshot's budget line, and a
deferred task's own counters stay in its deferred packet — the backlog never mirrors them.
A WIP commit contains only product changes; the state records reference its hashes read
from Git history.

The pre-WIP review base is preserved across resumes and reused: the coordinator's own
reviews of a checkpointed task — slice review, re-review, or opportunistic deep review —
use a range whose lower bound is that base or earlier, so the WIP commits and every
later working-tree delta are inside the diff. An explicit-request audit is different:
it runs over the user-named range subject only to the lower-bound floor, so its named
end stands even when that end is a recorded commit earlier than the current
working-tree state. A resumed session's start boundary never replaces the earlier recorded
base, and work accepted before the base is never re-reviewed on the coordinator's own
initiative — a checkpoint never re-opens it — though an explicit user request may name a
range starting at or before the base, in which case the named start stands; the floor
widens only a named start that comes after the base and never moves an earlier one. The
base governs the task's reviews until its persistence gate closes.

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
