# Shared round contract

Both reviewed task work and Autonomous Mode use this contract. The invoking
workflow supplies state storage, interaction, Git policy, and the overall
budget. Never infer durable files or Git authorization from a role's name.

## Task packet

Give each fresh child everything needed for one bounded assignment:

- Repository path and branch; applicable repository instructions.
- User outcome, this round's scope, acceptance checks, and stop boundary.
- Relevant facts and file paths; failed approaches only when useful.
- Starting state and the exact commit range or working-tree changes to inspect,
  including pre-existing changes that must be preserved.
- Git policy and its authorization; state policy and any explicitly required
  handoff path. Session state means return a report without operational writes.
- Verification commands, findings to fix if applicable, and report format.

Do not send the full conversation or require another agent to reconstruct it.
For review, include the original acceptance criteria and actual diff scope;
label worker claims as unverified. The reviewer inspects the change and evidence
independently, including untracked files, rather than approving the report.

## Roles and reports

The coordinator delegates implementation. Each child handles one task, without
nested delegation or user questions. If a decision would change the requested
outcome or needs user preference, report it as a blocker; routine reversible
implementation choices can be stated as assumptions.

Workers report status (done, progress, or blocked), a compact summary, changed
files or commits, verification commands and results, and one next action. Include
failed approaches and the missing decision for progress/blocked work. Reviewers
report a verdict (clean or blocking findings), each finding's location, impact,
and required correction, optional nits, and independently checked evidence.
The invoking workflow may specify a stricter report format.

End an unproductive round after two failed hypotheses or a repeated failure
after a targeted fix. Also reset when the task becomes a different investigation
or the next action is no longer concrete. Return evidence and a next action for
a fresh agent, saving them on disk only when the supplied state policy requires
it. Productive implementation and verification need not reset on a tool count.

## Review and fix gate

Review task correctness, relevant regressions, acceptance checks, scope,
repository conventions, and the supplied Git/state policy. Reviewers do not
change product code. They write operational notes only when the state policy
explicitly requires them. Run relevant checks independently where feasible;
report unavailable checks and do not claim they passed. Missing evidence needed
to establish acceptance is blocking.

Blocking findings identify defects or unmet acceptance conditions that must be
resolved before delivery. Style preferences and optional improvements are nits
and do not block. Distinguish pre-existing issues from task regressions; do not
expand the assignment to repair unrelated issues.

Send blocking findings to a fresh fix worker with the original acceptance
criteria. Allow at most two fix cycles (three review passes) per task/slice.
If blockers survive, follow the invoking workflow's stop/decision policy rather
than repeatedly attempting the same fix.

A purely mechanical finding has a sufficient deterministic acceptance check.
After its fix, the coordinator can close it by running that check. Behaviour,
correctness, or design findings require independent re-review of the fix and
affected invariants. Do not spend another full review on a deterministic edit
or reopen unaffected accepted work. If a reviewer repeatedly tightens the same
standard, settle that standard once through the invoking workflow's decision
policy rather than treating each new preference as another defect.

The coordinator checks the final diff/state and a relevant acceptance result
before reporting completion. An accepted change requires the necessary checks
and no unresolved blocking findings; disclose limits of the evidence.
