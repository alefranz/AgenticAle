# Shared round contract

Both reviewed task work and Autonomous Mode use this contract. The invoking
workflow supplies state storage, interaction, Git policy, and the overall
budget. Never infer durable files or Git authorization from a role's name.

## Bundled skill use

These workflows expect the bundled skills to be used when their tasks apply.
Load the skill by exact ID, or read its full `SKILL.md` with the available file
tool, before doing that part of the task. Seeing its discovery description or
mentioning its name is not loading it.

- `pull-request-description`: before drafting or revising a PR body, the agent
  writing it reads [the skill](../../pull-request-description/SKILL.md) and
  follows its narrative and selective-validation guidance, including for the
  work mode's PR endpoint. The skill does not authorize Git hosting operations.
- `source-code-lookup`: when behavior in a dependency, service, or another
  codebase matters, the agent investigating it reads
  [the skill](../../source-code-lookup/SKILL.md) before locating and inspecting
  that source. Ordinary navigation in the current repository does not need it.
  Keep lookup evidence in the invoking workflow's state: a child report for
  session state, or the required task notes/handoff for durable state.
  Keep quick lookups inline; route substantial external-source investigation
  through the `explore` routing key to keep source-reading detail in a fresh
  context. The runtime binding translates that key to the host's dispatch.
  Supply the question and stop condition, known repository URL/path or discovery
  evidence, target version/tag/commit or lockfile/configuration path, relevant
  symbols and observed behavior, and constraints. Unknown repository or revision
  details are part of the investigation. Require a concise answer with repository
  URL, exact inspected commit, file references, and version uncertainty.
  A worker needing a separate investigation returns the question and known facts
  to the coordinator; the coordinator dispatches Explore and resumes the worker
  with the findings. Children do not delegate to other children.

If a required skill cannot be loaded, report that limitation rather than
silently substituting remembered guidance. Respect the task's scope, state,
and permissions while applying it.

## Task packet

Give each fresh child everything needed for one bounded assignment:

- Repository path and branch; applicable repository instructions.
- User outcome, this round's scope, acceptance checks, and stop boundary.
- For a decomposed task: the current slice's entry state, prior accepted
  outcomes and relevant invariants, explicitly deferred work, and any
  experiment's question, decision criterion, and cleanup boundary. The full
  goal is context, not permission to implement later slices.
- Relevant facts and file paths; failed approaches only when useful.
- Applicable skill IDs and loading instructions. Pass the source-code-lookup
  trigger above to each child so it can load the skill if the need emerges;
  fresh children must not assume the coordinator's loaded skills are inherited.
- Starting state and the exact commit range or working-tree changes to inspect,
  including pre-existing changes that must be preserved.
- Git policy and its authorization; state policy and any explicitly required
  handoff path. Session state means return a report without operational writes.
- Verification commands, findings to fix if applicable, and report format.

Do not send the full conversation or require another agent to reconstruct it.
For review, include the original acceptance criteria and actual diff scope;
label worker claims as unverified. The reviewer inspects the change and evidence
independently, including untracked files, rather than approving the report.
For a re-review after a fix, carry the prior findings with stable IDs and their
evidence so the review can report each as fixed, partially fixed, still open,
or regressed. For a standalone review of an existing committed branch range,
the packet supplies the exact range and the user's criteria in place of worker
claims and worker-round acceptance criteria; nothing about a worker report is
invented, and the reviewer's findings report is the deliverable.

## Sequential decomposition

The coordinator may split one bounded user task into a short sequence of
verifiable outcomes, from the initial request or after an explore or consult
report. Use this when an early result will resolve a material uncertainty,
establish a contract later work depends on, or keep implementation and review
within a coherent scope. Keep a straightforward change as one slice. File
count alone is not a reason to split; a slice may span several files or layers.
Exploration and consultation remain optional and retain their existing scopes
and limits; neither is a mandatory planning round.

Keep the original goal and overall acceptance criteria stable. Outline only
the useful next few outcomes and their dependencies; later slices are
provisional, not a detailed backlog. Each assigned slice needs an observable
result, a check that can run at its boundary, and explicit exclusions. It need
not deliver the entire feature, but it must leave a coherent state without
breaking existing behaviour. Do not defer a regression as "the next step".
Record each slice's starting boundary and changed-file/diff evidence in the
existing state so review can distinguish its delta from accumulated task and
pre-existing changes, including when successive slices edit the same uncommitted
file. This does not require commits or extra files.

Run one slice at a time using the invoking workflow's existing roles:

1. Give a fresh worker only the current slice and enough context about prior
   work and the full goal to preserve compatibility. Keep future implementation
   out of its assignment; a worker that discovers a bad boundary returns
   evidence and a proposed next action instead of expanding its scope.
2. Verify the result and complete the applicable review/fix gate before the
   next implementation slice starts. Review against the slice's acceptance and
   the overall invariants. Explicitly deferred functionality is not itself a
   defect; a broken invariant or unmet current acceptance condition is.
3. Reassess after every slice or inconclusive round: what was established,
   which assumptions changed, whether the next outcome is still needed, and
   whether the remaining budget can cover it. Continue, merge, split, reorder,
   or drop provisional steps when evidence warrants it. Do not reopen accepted
   work without a changed assumption, interface, or regression that affects it.
   Briefly explain material plan changes to the user, following the invoking
   workflow's decision policy if they change the requested outcome or need a
   user preference. Routine replanning does not require stage approval.

**Experiments and rejected approaches.** Prefer read-only exploration when it
can settle the uncertainty. When code is needed, assign a bounded experiment
through implementation with a question, a success/rejection criterion, relevant
checks, and what may be retained or must be removed. A negative answer can be
useful evidence, but does not satisfy the feature's acceptance. An unfinished
attempt is not an accepted slice. The coordinator decides whether to refine
the approach or abandon it, recording the evidence and revised next action.
Before the next slice, reconcile the actual changes: retain only justified
changes that pass the applicable gate, or dispatch a bounded implementation
assignment to remove the attempt's own changes and verify the restored state.
Preserve unrelated and previously accepted work; never assume a reset or
rollback is safe. Review
retained changes and any cleanup that alters accepted behaviour under the normal
gate. No product-code review is needed for a read-only finding alone.

All implementation, investigation, fix, and cleanup rounds consume the invoking
workflow's applicable budget. Renaming a slice, rejecting an approach, or
replanning does not reset fix/review counts for the same unresolved target, nor
the repeated-blocker or no-progress limits. Evidence that rules out an approach
can be progress; repeating a disproved approach without new evidence is not.

Before delivery, check the accumulated task changes against the original goal
and run relevant combined acceptance checks. Ensure independent review, when
required, covers the interactions between slices, using a final ordinary review
or deep review when prior reviews did not cover them. Choose deep review for
substantial interactions or high-risk shared invariants, not simply because
there are several steps. The invoking workflow's stricter deep-review triggers
and caps still apply. Clean slice verdicts alone do not establish completion of
the whole task; missing integration evidence or blocking findings keep it open.

Keep the outline, evidence, rejected approaches, and next action in the invoking
workflow's existing state. Session state creates no operational files; durable
state uses the existing backlog/handoff, not a second planning system.

### Acceptance examples

Examples use the invoking workflow's review policy; standard mode or an
explicit review waiver still follows that workflow's verification requirements.

| Situation | Expected coordination |
| --- | --- |
| A clear validation fix with one observable outcome | One implement/review loop; no forced decomposition or consult. |
| A compatibility change has a known contract boundary | Implement and review the compatible foundation, then assign its consumer; check the combined behaviour before delivery. |
| Explore reveals two dependent changes, or consult recommends a staged approach | The coordinator adopts or adjusts the outline and assigns only the first slice; the read-only child does not implement it. |
| A prototype disproves the chosen approach | Preserve the evidence, reconcile prototype changes, then revise the next assignment within remaining limits; do not declare the requested feature complete. |
| A later slice invalidates an earlier assumption | Recheck affected accepted behaviour and revise the remaining outline; do not rerun unrelated reviews or silently change the goal. |
| Individually clean slices fail an integration check | Keep the task open and fix/re-review the affected interactions within existing caps; escalate to deep review when warranted. |
| Budget or repeated-failure limits are reached mid-sequence | Stop with accepted outcomes, actual unfinished state, and the next action; a new slice name does not grant more rounds. |
| The same underlying invariant is flagged in consecutive rounds | Repeated findings about one invariant trigger replanning: a real design issue reopens the plan with the original acceptance and counters intact, while a drifting reviewer standard is settled once, not chased as a defect. |

## Checkpoints, decision summary, and stop reports

After every substantive worker or reviewer result, checkpoint before the next
round: what was established and what remains unverified, which assumptions
changed or the problem grew, whether a local correction suffices or the design
needs reconsideration, and the allowance still available for the next action
and its review. Repeated findings about the same underlying invariant are a
replanning signal, not a reason to keep fixing: a real design problem reopens
the plan with the original acceptance criteria intact, while reviewer standard
drift is settled once through the invoking workflow's decision policy.
Replanning never resets the fix and review counters for the same unresolved
target.

Before each substantive dispatch, including the first, send the user a concise,
visible decision summary. This is **progress narration**: what was established,
why the next assignment is useful, and what it should resolve. On the first
assignment, state the intended outcome and first step; do not invent a prior
result. Include a changed approach, material uncertainty, or approaching limit
when it affects the next decision. Both workflows communicate these updates
visibly; a hidden-only state update does not satisfy this rule.

Normally use one short paragraph of one to three sentences, combining the
previous result and next assignment rather than announcing each separately.
Lead with the task and its consequence: "The checks passed, but verification
found that the rename breaks migration from older installs. I'm assigning a
focused fix to preserve those paths." Name the next agent's purpose in ordinary
language (for example, "an independent review of the fix"). Avoid stock labels
such as "Checkpoint" or "Dispatching", role/tier codes, and repeated workflow
explanations. Include concrete evidence when it helps assess progress, without
reciting every check or copying the child's report. Distinguish reported results
from what the coordinator or reviewer actually verified.

Keep routine round counters and routing details in workflow state; the
[routing-record guidance](#routing-records) below defines when they belong in
the visible update. Surface a budget when it constrains the next action, in
plain language: "This is the last permitted fix attempt; if it leaves blockers,
I'll stop with the remaining work and options." Give the exact allowance in a
stop report or when the user asks. A material change of plan needs its reason;
an unchanged plan needs no repeated justification.

Explain decisions and evidence, not internal chain-of-thought or individual tool
calls. Routine verification-only checks and unchanged waits need no separate
summary. If the result ends the task, use the delivery or stop report rather
than adding a duplicate progress message. The main conversation should remain
understandable when the host collapses child activity; do not assume it always
does or promise control over its presentation.

Also retain the compact state in the invoking workflow's existing state:
session context in reviewed task work, the active handoff in Autonomous Mode.
Preserve the required evidence, counters, and routing records there without
copying the narration into a second log.

Every incomplete stop — an exhausted allowance, a repeated blocker, quota
exhaustion, a declined or unavailable user option, or a publication blockage —
includes a self-contained, copyable continuation prompt: the outcome and the
blockers with their evidence, what actually exists (files, branches, commits,
working tree) and what must be preserved, the recommended next approach, the
checks and independent review still required before delivery, and the exact
delivery permissions and restrictions. When the delivery is PR-based, the
prompt also carries the exact delivery target: the pull request URL when one
exists, otherwise the intended repository and head destination — stated as
not yet created, and including fork destinations — so a fresh session resumes
the same pull request instead of duplicating it. A fresh session must
inspect the current checkout and re-establish missing context rather than
trusting the prompt.
Reviewed task work keeps the prompt in the stop report only; Autonomous Mode
carries it in the durable handoff and records allowance usage and any granted
extensions in the existing state, so a resume or a renamed target cannot evade
the unresolved-target caps.

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

## Routing records

The coordinator records each dispatched round with its compact routing fields:

- Role: the routing key (one of the seven).
- Selection: the selected tier, or the direct choice.
- Requested: the requested model and reasoning effort (or `inherit`).
- Provenance: the selection's source(s) — the role-selection source and, for a
  tier reference, the tier-definition source.
- Fallback: any explicitly configured fallback actually attempted (or none).
- Effective: the effective settings when native metadata makes them available,
  or the reason they are unknown.

These records belong to the invoking workflow's state: session state in
reviewed task work, the handoff routing summary and the round ledger in
Autonomous Mode. A child's self-reported model name never fills the effective
field, and an unknown effective setting stays unknown rather than being
estimated. The compact routing snapshot kept in that state records the
selected routing profile name (or `default`) alongside the tier summary and
role exceptions, so continuation prompts and autonomous resumes can preserve
it.

Routing records are diagnostic state, not a script to recite before every
child. In ordinary progress narration, omit model identifiers, reasoning effort,
default-versus-configured comparisons, and "no fallback". If the user asks to
see model choices, include a short, clearly labelled selection alongside the
assignment; provide full provenance when requested.

Surface routing details when they explain a consequential route change, an
attempted configured fallback, a requested-versus-available mismatch, or a
capability limit. State the practical effect and next action; include exact
model/effort identifiers when needed to distinguish choices or diagnose the
issue. Explain an unchanged limitation once, then repeat it only when it affects
a new decision. A valid user customization differing from the packaged default
is not itself a mismatch. An installed profile describes configured settings,
not proof of the effective model. Say "configured for" or "requested" unless
native evidence confirms what ran. These presentation rules never relax routing
validation, permit silent substitution, or remove required records.

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

A re-review closes the loop over the earlier report: it states each prior
finding by ID as fixed, partially fixed, still open, or regressed, separates
new defects from the consequences of an earlier unresolved issue, and lists
the acceptance evidence still missing. Run the targeted checks that bound the
current slice; reserve full-suite and publishing checks for the integration
boundaries where they are meaningful. When a change makes recovery or
interruption behaviour part of the acceptance, the evidence comes from the
real user entry or command selection that reaches it and the interruption
boundary around its external side effects, not only from internal method tests.

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

A standalone review invoked directly (outside the work and autonomous
workflows) returns the findings report to the user and does not enter this
gate's fix loop: no fix round is dispatched from its findings, and the cycle
caps do not apply to it. This gate governs the work and autonomous dispatches,
which keep their existing review and fix policies.
