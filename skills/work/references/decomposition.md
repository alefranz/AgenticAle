# Sequential decomposition and experiments

Read this reference only when splitting a bounded task into multiple sequential slices or running a bounded code experiment.

## Running slices sequentially

Keep a compact ordered outline in the workflow's existing state (session context in `work`; `BACKLOG.md`/snapshot in `autonomous`) — accepted outcomes with evidence, current slice, tentative next slices, and assumptions to watch. Do not create a second planning system.

1. **Assign one slice at a time.** Detail only the current slice: observable outcome, boundary check, starting boundary/diff evidence (so review isolates the slice delta even on dirty files), and explicit exclusions. Never leave a regression for "the next step." If a worker hits a bad boundary, it returns evidence and a proposed next action instead of expanding scope.
2. **Gate before advancing.** Verify and close the slice's gate (review or deterministic check for clearly mechanical changes) before starting the next slice. Do not demand deferred functionality at an early boundary, and do not ignore regressions.
3. **Reassess at every boundary.** Check what was established, whether assumptions changed, whether remaining slices are still needed, and remaining budget. Merge, split, reorder, or drop provisional steps as evidence warrants without reopening accepted work unless an assumption/interface changed or regressed.
4. **Pass progressive acceptance before delivery.** Clean per-slice checks/reviews do not prove cross-slice behavior. Verify the accumulated change range against the original goal and run combined integration checks, then pass the stepped-up fresh-context acceptance review over the complete changeset per [Progressive independent assurance](rounds.md#review-and-fix-gate) (`review-deep` when any slice needed `review`, unless an un-invalidated full-range `review-deep` already covers it).

## Experiments and rejected approaches

Prefer read-only `explore` when it can settle an uncertainty. When code is needed, assign a bounded experiment via `implement` with one question, a success/rejection criterion, checks, and cleanup rules:

- A rejected hypothesis is useful evidence, not completion.
- Before starting the next slice, reconcile the working tree: retain only justified, gated changes, or assign a bounded cleanup to remove the attempt's own changes and verify restoration. Never blindly `git reset` over unrelated or previously accepted work.
- All exploration, experiment, fix, and cleanup rounds consume the task's worker allowance; replanning or renaming never resets consumption.

## Acceptance examples

| Situation | Expected coordination |
| --- | --- |
| Clear fix with one observable outcome | Converge at lowest sufficient tier; pass stepped-up acceptance review before delivery; no forced split or consult. |
| Compatibility change with a known contract boundary | Implement and gate the foundation, then its consumer; pass combined checks and stepped-up acceptance review before delivery. |
| Explore/consult reveals dependent steps | Adopt outline and assign only the first slice; read-only child does not implement. |
| Prototype disproves approach | Record evidence, reconcile/clean prototype changes, revise plan within remaining budget. |
| Later slice invalidates earlier assumption | Re-check affected accepted behavior and adjust remaining slices; don't re-run unrelated reviews. |
| Clean slices fail combined integration check | Keep task open and fix/re-review interactions within remaining budget before acceptance review. |
| Productive fix loop reaches round 3+ with verified progress | Reassess at round 4 (progress, route, strategy); keep looping fix → verify → re-review unattended while budget remains ([Budgets and loop continuation](rounds.md#budgets-and-loop-continuation)). |
| Fixing A reopens B across 2 cycles (oscillation) | Reassess immediately; stop ping-ponging and change strategy, upgrade route, or consult with concrete evidence. |
| Functional checks pass, but reviews keep inventing style blockers | Settle during reassessment: classify purely stylistic items as nits and close/confirm once. |
| Budget exhausted while work remains | Stop incomplete with continuation prompt and offer `+N` rounds or stop; run pending required slice or acceptance review of last worker first. |
