## Anti-patterns

- Letting the main loop read long source files "just to check" — that is what the subagents
  are for.
- Telling a subagent "continue where you left off" without pointing it at the snapshot — it
  has no memory of previous rounds.
- Parallel or background subagents; a worker reviewing its own work, or a reviewer fixing
  code — the roles never blur; fixes are always a worker round.
- A child writing the backlog, snapshot, steering file, or any operational file — or being
  asked to validate or repair the compact state before its `NEXT` action: the coordinator is
  the only state writer and repairs state itself before dispatch; children return reports
  (including reset evidence and read-only discrepancy facts) and the coordinator persists them.
- Treating the snapshot as a journal, growing a full round ledger in it, or requiring a
  per-round ledger at stop or close — it is a compact checkpoint; settled results fold into
  bounded backlog task evidence, and host logs/git history are optional diagnostics, not a
  default archive.
- Mirroring the active task's or run's consumed counters into the backlog — the snapshot is
  the single counter authority; duplicate counters drift.
- Trusting a readable budget line from a torn write, or guessing/resetting consumption when
  the snapshot is missing or torn — validate the whole packet, then rebuild only from
  verified prior Git/host evidence, or stop.
- Re-importing the preserved legacy packet after the run already migrated or closed — its
  counters are history; recognize the migration or closure from backlog/Git, then recover
  current evidence or stop.
- Charging a settled round twice on resume, or letting a crashed dispatch's productive work
  replay free — reconcile the pending-dispatch record once against the actual evidence.
- Treating nits as blocking (infinite fix loops), ignoring blocking findings to save a round,
  or trusting a "done"/"clean" report without one cheap verification.
- Expanding a round's scope because "it's close" — the round ends on the slice it was given.
- Dispatching a routine slice on `implement-hard` "to be safe", or a judgment slice on
  `implement-easy` because it looks small — routes follow visible risk and explicit mechanical
  prescription, not labels.
- Running the deep reviewer on routine slices "to be safe", or redundantly stacking a deep
  review over a slice's range its normal review already covered — without changed fix
  evidence, a required integration gate, bounded interrupted-review recovery, or an
  explicit user request — escalation is trigger-based and capped per session.
- Re-running the full review after a mechanical finding's fix, or re-reviewing
  unchanged evidence to spend review availability — every review needs a
  changed diff, a required integration gate, bounded interrupted-review
  recovery, or an explicit user request (one bounded audit over the range the
  user names, never a review-only loop).
- Iterating against a reviewer's drifting standard — settle it once; a genuinely unmet
  invariant is a real defect to replan around, not drift.
- Asking the user for routine continuation inside the autonomy envelope, or to authorize one
  more fix/review cycle while budget, progress, and the envelope permit continuation —
  per-target cycle counts are not authorization gates.
- Re-asking the user a gate-closure or continuation question for a target that already has
  a recorded settlement or declaration — the recorded decision binds; a re-declaration
  needs new evidence, and a second bounded continue is never offered.
- Asking the user to authorize a fix/review cycle the anti-ask gate's third check covers —
  the no-ask default is the rule; a failed gate is a guard breach, reported, not sent.
- Reclassifying a reviewer's finding in a dispatch packet without a recorded settlement —
  unratified reclassifications carry as proposals only; the recorded class is preserved
  until a shared Standard settlement reopening condition holds — changed acceptance, a
  genuinely unmet invariant of a blocking class, or a user instruction.
- Letting the struggle trigger stay unfired because the slice gate has not
  passed — in a non-converging loop the diagnostic audit runs on the trigger, not behind
  the gate, subject to the in-loop diagnostic headroom stop (the same boundary stop as
  Task-loop step 4 and Diagnostic mode).
- Offering "close with documented residuals" before a settlement or declaration exists —
  without one it is not a legal close.
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
- Deleting the snapshot before the completed run's final persistence is verified, or inside
  the completion commit whose push is still unconfirmed — it stays as the recovery
  checkpoint until that confirmation, and the deletion rides in the bounded cleanup commit
  that follows, recoverable from git history. Recreating a deleted snapshot to hold terminal
  failure records — after verified cleanup, failure records go to the backlog alone.
- Reporting a snapshot-absent run as closed on durable completion records alone while the
  cleanup or record-resolution persistence is still outstanding — reconcile the close's
  full persistence first, then classify closure; never skip the unpushed cleanup commit.
- Archiving a deferred unfinished task as completed, or dropping its resumable packet when
  switching the active task — deferred packets stay in the backlog with their identity,
  counters, and one `NEXT`.
- Reporting goal text supplied during an active run as a conflict, or overwriting the active
  state with it — reconcile it as steering; an ambiguous destructive replacement asks the
  user, question-eligible through the anti-ask gate.
- Selecting the next task before the completed task's required commits and push are confirmed,
  or blindly duplicating commits after an uncertain push — reconcile the actual local and
  remote state first.
- Writing a finalization commit's own hash back into the state it commits — the bounded
  sequence ends with a read-only confirmation, never a recursive record-your-own-hash loop.
- Retrying a blocked push in the same run — directly, or by pushing a later WIP or finalization
  commit that carries the uncertain commit as a descendant — blocked persistence goes directly
  to the terminal local-only close.
- Treating a WIP checkpoint commit as task completion, or re-committing its changes at the task
  gate — the coordinator's own reviews of the task use a range that starts at or before the
  recorded pre-WIP base, so the WIP commits are inside the diff, and the gate reuses them.
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
