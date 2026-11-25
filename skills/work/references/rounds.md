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
  through the explore role to keep source-reading detail in a fresh context.
  The runtime binding maps the role to the host's dispatch.
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
- Starting state, with content evidence sufficient to identify it (a status
  line or an unchanged filename list alone is insufficient), and the exact
  commit range or working-tree changes to inspect, including pre-existing
  changes that must be preserved.
- Git policy and its authorization; state policy and any explicitly required
  handoff path. Session state means return a report without operational writes.
- The applicable budget facts for this round: the remaining allowance of its
  type, including any recorded progress extension and the progress ceiling
  where the workflow keeps one, and — where the invoking workflow keeps both a
  task allowance and a run ceiling — the stable task and run identities and the
  effective remaining worker rounds.
- Verification commands, findings to fix if applicable, and report format.

Do not send the full conversation or require another agent to reconstruct it.
For review, include the original acceptance criteria and actual diff scope;
label worker claims as unverified. The reviewer inspects the change and evidence
independently, including untracked files, rather than approving the report.
For a re-review after a fix, carry the prior findings with stable IDs and their
evidence so the review can report each as fixed, partially fixed, still open,
or regressed. For a standalone review of a recorded comparison — a committed
branch range or the current working-tree result, including relevant untracked
files — the packet supplies the exact comparison and the user's criteria in
place of worker claims and worker-round acceptance criteria; nothing about a
worker report is invented, and the reviewer's findings report is the
deliverable.

## Sequential decomposition

The coordinator may split one bounded user task into a short sequence of
verifiable outcomes, from the initial request or after an explore or consult
report. Use this when an early result will resolve a material uncertainty,
establish a contract later work depends on, or keep implementation and review
within a coherent scope. Keep a straightforward change as one slice. File
count alone is not a reason to split; a slice may span several files or layers.
Exploration and consultation remain optional by default and retain their
existing scopes and limits; neither is a mandatory planning round, though the
invoking workflow may make an initial consultation mandatory through an
explicit option.

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
   next implementation slice starts. A clearly mechanical change closes by the
   shared contract's deterministic verification, with independent review only
   when risk warrants it. Review against the slice's acceptance and the overall
   invariants. Explicitly deferred functionality is not itself a
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
workflow's applicable budget. Where the workflow keeps both a per-task
allowance and a run ceiling (Autonomous Mode), each such worker round is
charged to both, and the effective remaining budget is the smaller of the
two; only a genuinely new task receives a fresh task allowance. Renaming a
slice, rejecting an approach, or replanning does not reset fix/review counts
for the same unresolved target, nor the repeated-blocker or no-progress
limits, nor either worker budget. Evidence that rules out an approach
can be progress; repeating a disproved approach without new evidence is not.

Before delivery, check the accumulated task changes against the original goal
and run relevant combined acceptance checks. Ensure independent review, when
required, covers the interactions between slices, using a final ordinary review
or deep review when prior reviews did not cover them. Choose deep review for
substantial interactions or high-risk shared invariants, not simply because
there are several steps. The invoking workflow's stricter deep review triggers
and limits still apply. Clean slice verdicts alone do not establish completion of
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
| Individually clean slices fail an integration check | Keep the task open and fix/re-review the affected interactions within the invoking workflow's remaining limits; escalate to deep review when warranted. |
| Budget or repeated-failure limits are reached mid-sequence | Stop with accepted outcomes, actual unfinished state, and the next action; a new slice name does not grant more rounds. |
| A task's worker allowance is exhausted while the run ceiling still has rounds | No further worker round for that task; verification and the permitted review of its completed changes still run. The unfinished part stays incomplete and resumable; the run may select another truly independent ready task with a fresh allowance, never bypassing gates or dependencies, and stops when no safe ready work remains. |
| The same underlying invariant is flagged in consecutive rounds | Repeated findings about one invariant trigger replanning: a real design issue reopens the plan with the original acceptance and counters intact, while a drifting reviewer standard is settled once, not chased as a defect ([Standard settlement](#standard-settlement)). |

## Checkpoints, decision summary, and stop reports

After every substantive worker or reviewer result, checkpoint before the next
round: what was established and what remains unverified, which assumptions
changed or the problem grew, whether a local correction suffices or the design
needs reconsideration, and the allowance still available for the next action
and its review — the effective minimum where both a task allowance and a run
ceiling apply. Repeated findings about the same underlying invariant are a
replanning signal, not a reason to keep fixing: a real design problem reopens
the plan with the original acceptance criteria intact, while reviewer standard
drift is settled once through the invoking workflow's decision policy
([Standard settlement](#standard-settlement)).
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
such as "Checkpoint" or "Dispatching", and repeated workflow
explanations. Include concrete evidence when it helps assess progress, without
reciting every check or copying the child's report. Distinguish reported results
from what the coordinator or reviewer actually verified.

Keep routine round counters and dispatch details in workflow state; the
[dispatch-record guidance](#dispatch-records) below defines when they belong
in the visible update. Surface a budget when it constrains the next action, in
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
Preserve the required evidence, counters, and dispatch records there without
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
the same pull request instead of duplicating it. The prompt also carries the
recorded decision state for the affected targets — the settlement lines, the
declaration lines, the residual lists, the convergence history with its
per-round facts and acceptance-failure flags, the per-slice reservation spend
where the invoking workflow records a per-slice reservation, and the
remaining bounded-continuation authority — whether a bounded continue was
used and what of it remains — so a fresh session binds the same one-time
decisions instead of re-asking them. A fresh session must
inspect the current checkout and re-establish missing context rather than
trusting the prompt.
Reviewed task work keeps the prompt in the stop report only; Autonomous Mode
carries it in the durable handoff and records allowance usage and any granted
extensions in the existing state, so a resume or a renamed target cannot evade
the unresolved-target limits.

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

## Progress-aware budgets and continuation

Both workflows bound worker dispatch by this same progress-aware contract.
The invoking workflow supplies the numbers, the state storage, and any
run-level limits; the rules below bind reviewed task work and Autonomous Mode
identically, except that the struggle and periodic deep review triggers are
Autonomous Mode's escalation gates and grant Work no post-gate escalation
right.

### Verified progress evidence

Progress is verified, not claimed. A worker round made progress only when the
coordinator can point to evidence of one of these:

- **Passing acceptance** — the slice's or task's relevant acceptance checks
  pass on the round's actual changes, verified by the coordinator or an
  independent review, not merely reported by the worker.
- **Verified correction** — a fix resolves a prior blocking finding and the
  resolution is confirmed by its targeted check or the independent re-review.
- **Resolved blocker** — a previously blocking uncertainty or decision is
  settled with evidence: a passing reproduction, an explore finding that
  removes the unknown, or a consult recommendation adopted and recorded.
- **Material new finding** — an explore or consult round establishes a fact
  that materially changes the plan: a confirmed root cause, a disproved
  approach with evidence, or a contract boundary later work depends on.

Code churn is not progress: edits that do not move acceptance, repeated
reformatting or re-renaming, re-running a disproved approach without new
evidence, and review-only loops over unchanged evidence establish nothing. A
round whose only output is unverified claims or still-failing checks is
unproductive. Evidence that rules out an approach can be progress; repeating
the same failure without new evidence is not.

### Normal allowance, progress ceiling, and auto-continuation

Each task starts with a normal worker-round allowance — default twelve in
both workflows — and a progress-based hard ceiling, default twenty-four.
Worker rounds (explore, implement, hard implementation, and fix) consume the
allowance; review, review-deep, and consult rounds keep their own accounting.

While the allowance in force covers the next round, dispatch is normal. When
it is reached and the task is unfinished, the coordinator may continue only
through a recorded extension: the allowance grows by a bounded increment
backed by verified progress evidence established since the allowance was last
set or extended, and never beyond the progress ceiling. The extension and its
evidence are recorded in the invoking workflow's existing state before the
next worker dispatch — session state in reviewed task work, the compact
snapshot in Autonomous Mode. Without such evidence the allowance
is exhausted: stop the task's worker dispatch under the stop rules. Continuation
is automatic while the evidence, the budget, and the safeguards allow it; the
coordinator does not ask the user to authorize each extended round.

An explicit user cap is exact and never auto-grows: an allowance set by a
task-time instruction, a preference entry, or the boundary of a named user
grant recorded with the `cap` flavour does not auto-extend, whatever its
size. The one exception is a named grant recorded with the `progress` flavour
([Grant flavours](#grant-flavours)): it is an explicit auto-extend authority,
not a cap — its boundary auto-extends under the verified-progress rule up to
the progress ceiling. Auto-continuation applies to the workflow's default
allowance and to `progress`-flavoured grants of the task worker allowance,
and the progress ceiling bounds
auto-continuation only — an explicit user allowance or grant may name any
positive size. A user grant adds exactly the named rounds and never resets
counters.

An extension never resets consumed counters, the per-target fix/review
evidence, or the stall and blocker safeguards. Decomposition, replanning,
renaming, resume, and interruption recovery keep the same allowance in force
and the same consumption; a replay of productive work keeps its recorded
charge.

### Grant flavours

A named grant states a flavour. `cap`: the added rounds end in an exact
boundary that does not auto-extend — the current semantics, and the named
default when the user's wording names a total ("10 more rounds" ⇒ +10, cap).
`progress`: the boundary auto-extends under the verified-progress rule up to
the progress ceiling — the flavour for "keep going while it's making
progress" rather than a specific number. A free-text grant matching neither
flavour exactly is parsed once; when ambiguous it gets one clarifying
question, and the parsed flavour is recorded in the budget line
(`M0-03: 15 (progress @R57) 9 consumed`). A `progress` flavour is a grant on
the task worker allowance only: the run ceiling, an explicit user review
limit, and any completed-task limit never auto-grow and are not
flavour-eligible — a grant on one of them is recorded `cap`-flavoured, an
exact named increment. A budget question offers the `progress` flavour as the
leading option only when the exhausted budget is the task worker allowance
accepting a `progress`-flavoured grant (the default allowance, or a
`progress`-flavoured grant in force below its progress ceiling) — the
progress-leading named increment applies only while the task worker allowance
is below its progress ceiling; at or past the ceiling the offered increment
is the `cap` increment — and the `cap` increment as the conservative
alternative otherwise; the coordinator's
own extension proposals are always `progress`-flavoured up to the ceiling and
never propose a `cap` increment as the leading option.

### Stall safeguards

Two consecutive worker rounds with no verified progress stop the task's
worker dispatch regardless of remaining budget or ceiling; the same blocker
two rounds in a row and the invoking workflow's repeated-interruption limit
stop it the same way. Remaining budget is not a reason to keep fixing a wall.
A consult may recommend a materially different path, but that path still
consumes the worker allowance and a consult cannot grant one. Repeated
findings about a genuinely unmet invariant reopen the plan with the original
acceptance and counters intact; reviewer standard drift is settled once, not
chased ([Standard settlement](#standard-settlement)). Quota-only waits and
launch rejections are not no-progress rounds under the invoking workflow's
quota rules.

### Fix continuation and review justification

Per-target productive fix/review cycle counts are not authorization gates.
Fix continuation is bounded by the effective worker budget, verified progress
evidence, the stall safeguards, and the review-limit headroom condition
instead: while budget remains, the latest fix made verified progress, no
safeguard or explicit user limit has fired, and the next cycle — the next
fix and its required re-review — leaves at least one review available under
each applicable explicit user review limit, continue the fix → verify →
re-review loop without asking the user to authorize another cycle — a fourth
or later productive fix within budget needs no permission ask. When the next
cycle would consume the last permitted review under an explicit user review
limit, the loop stops at that boundary, and the invoking workflow's budget
question offers the eligible named increment for that limit — always a
`cap`-flavoured increment ([Grant flavours](#grant-flavours)): an explicit
user review limit never auto-grows and is not flavour-eligible. Every
review round, ordinary or deep, must be justified by changed slice or fix
evidence (a diff the previous review has
not seen), a required integration gate, bounded interrupted-review recovery
over the same range, or an explicit user request. An explicit user request
authorizes one bounded audit over the range the user names — the request is
itself the justification, so it needs no changed fix evidence, and it
authorizes that audit, not a review-only loop: the prohibition on
coordinator-initiated review loops over unchanged evidence continues to
apply. The preserved deep review triggers are Autonomous Mode's escalation
gates — required integration gates: the trigger itself — the two-fix struggle
signal, the shared worker/reviewer blind-spot signal after at least two fix
rounds made in response to a review round's findings (it fires whether or
not a later pass eventually passed), or the periodic boundary, contract,
or scale condition — is the justification, and each trigger's range is its
own: the struggle audit runs over the slice's accumulated
commit or diff range — its single-slice range from the slice's own entry
(first change or recorded WIP boundary) through the current state, including
every fix delta — while the periodic audit runs over the accumulated range
since the periodic baseline — the preceding deep review whose audit range
covered the whole accumulated range since the previous baseline (an
integration-scope audit), or session start when none has run; neither
requires a diff the previous review has not seen. When the slice's own gate
was a deep review standing in for it, the struggle audit re-covers the
slice's whole range — justified by the changed fix evidence and the trigger —
and a single-slice audit, standing-in or struggle, never advances the
periodic baseline. The review-only-loop prohibition still applies: a repeat
of the same trigger's audit over the same range with no new trigger, no
changed evidence, and no interrupted review to recover is prohibited. In
Work, post-fix closure follows the finding-class rule, and a deep review
applies only where Work's own rules warrant one: a single slice's risk
warrants an integration-level audit and stands in for the ordinary review
before dependent work proceeds, uncovered integration scope at the combined
boundary, or an explicit user request. The invoking workflow's consultation
caps and trigger-based deep review limits are unchanged.

The worker budget gates fix dispatch, not review: when the allowance in force
is exhausted — at the progress ceiling or an exact explicit cap — dispatch no
further worker round, but the required independent review of the last allowed
fix, including a deep re-review, still runs at zero worker budget. Blocking
findings that survive it keep the target incomplete and review-open; follow
the invoking workflow's stop/decision policy rather than attempting another
fix or asking to authorize one more cycle.

### Standard settlement

A finding's class is either blocking or a nit for a target, and that status
is settled once per target and held in state, not in the conversation.
Classify before settling: repeated findings about a genuinely unmet
invariant are a real design issue — the plan reopens with the original
acceptance criteria and counters intact, unchanged by this path. Only
reviewer standard drift — an already-seen finding class re-opening — takes
the settlement path below. Its trigger is deterministic, and it fires only for
classes with no recorded settlement: the second consecutive review round on
the same target that opens only findings of an already-seen class that has no
recorded settlement line. A never-seen class — the first appearance of that
class in the loop — is a new finding, not drift, and is assessed against the
original acceptance criteria; the settlement trigger cannot fire on it. An
already-seen class that was never the subject of a recorded settlement — the
class recurred but never settled — is likewise assessed against the original
acceptance criteria for classification, but, being already seen, it can
qualify as standard drift, and the settlement trigger can fire for it. When
it fires, the standard for that class is unsettled drift, and no further fix
round dispatches on those findings until it is settled.

Settlement path: the invoking workflow's decision policy first — in
Autonomous Mode one consult round names a **proposed** standard for each open
class, e.g. mechanism facts: blocking, source-verified; citation accuracy:
blocking, exact file:line; wording and scope phrasing: nit, recorded as
residual. The proposal is not a binding adoption: the loop never settles the
standard on the consult's authority alone. The loop then owes the user exactly
one decision, offered through the invoking workflow's question authority —
the anti-ask gate in Autonomous Mode, directly in Work, where the user is
present: ratify the proposed standard; one of the alternatives, including the
reviewer's original bar; or close the target now, available when the proposed
standard classifies every open finding as a nit. In Work the coordinator
presents the proposed standard with the reviewer's original bar alongside in
that one question. When the invoking workflow's consult allowance is
exhausted, the same one decision reaches the user directly with the proposed
standard named — a degraded path to one recorded decision, never repeated
questions. The outcome is recorded in the invoking workflow's state, one line per settled
class: a blocking class as
`STANDARD: <target>: <class>: blocking (bar: <the class's precision bar>)
@R<N> (<consult-adopted|user>)` and a nit class as
`STANDARD: <target>: <class>: nit (residual) @R<N> (<consult-adopted|user>)`,
and is bound into every subsequent dispatch packet for the target. The
settled standard binds only its settled classes: reviewers flag findings
inside the blocking classes, a finding in a settled nit class is a nit that
never blocks the verdict — a verdict that blocks on a nit-class finding is
malformed — and a finding in a class not yet settled is assessed against the
original acceptance criteria as a new finding: it may block the verdict as an
unmet acceptance condition, and where it is a genuinely unmet invariant the
plan reopens with the original acceptance criteria and counters intact. A
malformed verdict
is recovered without a re-review: the coordinator records the malformation —
the original verdict and the correction — in the state, and the gate proceeds
on the corrected classification under the recorded settlement: the finding is
reported as a nit, and the close path applies when every open finding is then
a nit. No re-review runs over the same range — a same-range re-review has no
permitted justification and the review-only-loop prohibition stands — and the
target's next review still needs its own justification. A malformed verdict is
not a clean verdict: the gate outcome comes from the corrected classification,
never from the raw verdict.

A settlement reopens only on changed acceptance, a genuinely unmet invariant
of a blocking class, or a user instruction — never on a later reviewer
tightening the same class. A reclassification of a finding under a recorded
settlement — a reviewer or consult proposing a different blocking or nit
classification for it — is an unratified proposal, and non-binding: the
recorded settlement continues to bind, and a recorded class is unset only
when a stated reopening condition holds — changed acceptance, a genuinely
unmet invariant of a blocking class, or a user instruction. The
reclassification is reported and may inform the next settlement question
where the rules allow one, but it changes nothing until and unless a
reopening condition holds.

### Convergence declaration

The coordinator keeps, per target, the loop's finding history: for each
review round in the current fix loop, how many prior findings were confirmed
fixed and the classes of the new findings. **Saturation** fires when the last
three review rounds each confirm all prior findings fixed and open only new
findings of classes already seen in the loop, and no acceptance check failed
in any of them; two rounds suffice once the slice has spent more than half
its recorded reservation (where the invoking workflow records a per-slice
reservation) — this single condition is the whole threshold: a slice that has
overspent its reservation has necessarily spent more than half of it, so the
same trigger applies and no second condition exists. Where the invoking
workflow keeps durable state — the
Autonomous Mode snapshot — that history is the target's `CONVERGENCE` line:
one entry per review round since the last clean close,
`R<N> <n>fix/<n>new[<classes>]` — the confirmed-fixed count, the new-finding
count, and the new findings' classes — with the suffix `a!` appended to a
round in which an acceptance check failed, keeping the saturation trigger's
no-failed-check condition recomputable after a handoff — and a trailing
`saturation R<N>|none` marking the round that declared saturation, e.g.
`CONVERGENCE: S1: R54 2fix/2new[wording] R56 2fix/2new[wording] saturation
R57|none`; a round with a failed acceptance check reads `R41
1fix/1new[mechanism] a!`.

**Decision order** — stated here once; the workflows reference it. When more
than one mechanism is live on a target, they run in this order:

1. **Settlement trigger first.** When the [standard
   settlement](#standard-settlement) trigger fires, the settlement path — the
   consult first where the invoking workflow's decision policy has one — runs
   before any further fix round on the target, and no fix round dispatches
   while its one decision is pending.
2. **Saturation next.** When saturation fires, the declaration runs before
   any further round on the target. Whenever the declaration runs and any
   open finding is in a class not yet settled for the target — whether or
   not the standalone settlement trigger fired — the settlement question for
   those classes is carried inside the declaration as the single combined
   decision, and the declaration waits on that one decision. The invoking
   workflow's decision policy supplies the proposed standard: in Autonomous
   Mode a mandatory preparatory consult — where its allowance permits — runs
   before that combined decision and names it first; it is neither a fix
   round nor a worker round, so it does not violate the
   before-any-further-round prohibition — it prepares the decision. In Work
   the coordinator presents the proposed standard directly, no consult on
   this path. Where the consult allowance is exhausted, the combined
   decision proceeds directly with the standard named — the degraded path.
   Where every open finding's class is already settled, the declaration
   stands alone with its closure options.
3. **Bounded continuation legality.** **Continue, bounded** is offered only
   when all of these hold: the same recorded decision leaves at least one
   open finding in a settled blocking class, or no settlement exists for
   those classes — in which case the settlement question runs first, or is
   carried inside the declaration per the rule above; the effective worker
   budget permits the next fix; the review limits permit, leaving at least
   one review available under the headroom condition; and no safeguard has
   fired. When the settled standard classifies every open finding as a
   nit, **Continue, bounded** is not offered: the options are
   close-with-residuals, stop-incomplete, and user-review.
4. **Residual closure.** **Close accepted-with-residuals** is offered only
   when the same recorded decision contains the nit-only settlement outcome —
   a settlement classifying every open finding as a nit, ratified, or carried
   inside the declaration, in that one decision. When the consult allowance
   is exhausted on a standalone declaration — no unsettled classes — the
   declaration proceeds and the closure decision reaches the user directly: a
   degraded path, recorded.

Saturation is a stop, and it requires a **convergence declaration** before
any further round on the target — a visible, self-contained statement that
the loop is not converging. The declaration names: the target and slice; the
finding trajectory with classes (e.g. 6 → 4 → 4 → 2 → 2, mechanism-class
closed at R50, wording-class re-opening every round); what is verified and
green (acceptance evidence, deterministic checks); the cost so far (rounds,
worker budget consumed, wall time including user waits); and exactly one
decision with its options and costs:

- **Close accepted-with-residuals under the settled standard** — available
  without asking when the settled standard classifies every open finding as
  a nit: the declaration then notifies, the close is recorded, and the loop
  ends. When no settlement covers all open classes, the close is offered
  inside the combined decision of decision order 2 and 4, not separately.
- **Continue, bounded** — at most two more fix/re-review rounds, offered
  only when the fix it authorises is legal under the settled standard
  (decision order 3); the declaration re-fires afterwards and this option is
  gone.
- **Stop the target incomplete** — with the continuation prompt.
- **User reviews the target directly** — dispatch stops; the coordinator may
  hand over the drafted fix without applying it.

The decision is recorded as
`DECLARED: <target>: R<N> <outcome>; continue-x2 used|unused; remaining:
<what remains open>`, where `<outcome>` is
`closed-with-residuals|continue-x2|incomplete|user-review`. A target with a
recorded declaration is never asked the same question twice: a re-declaration
is possible only with new evidence — a new finding class, a failed acceptance
check, or the expiry of a granted bounded continue — and a second bounded
continue is never offered. The declaration, not a repeated gate-closure
question, is the only user-visible form of a non-converging loop.

### Incomplete safety stops

A limit reached while eligible work remains is an INCOMPLETE safety stop,
never a successful completion: report the exhausted limit, the completed and
blocked state, the recent verified progress, and the continuation prompt the
stop rules require. Blocked or budget-exhausted tasks are explicitly
incomplete even when no eligible work remains — a stop that leaves unfinished
tasks is an incomplete stop, not a completed run. Only satisfied acceptance
and closed gates complete a task; only a fully completed goal completes a
run.

### Acceptance examples

| Situation | Expected coordination |
| --- | --- |
| The twelfth worker round finishes productive work and the task is unfinished | Record the verified evidence, extend the allowance within the progress ceiling, and dispatch round thirteen without a permission ask. |
| The allowance is reached and the last rounds were churn — edits with failing or unverified acceptance | No extension: stop the task's worker dispatch incomplete; two consecutive unproductive rounds fire the stall stop even earlier. |
| An explicit user allowance of eight rounds is reached with verified progress | Stop at eight: the explicit cap is exact and does not auto-extend; offer the named increment a continuation needs. |
| The twenty-fourth worker round is a fix and the progress ceiling is reached | No further worker round; the fix's required independent review still runs at zero worker budget, and surviving blockers keep the target incomplete. |
| A run-level safety limit is reached while eligible backlog work remains | INCOMPLETE safety stop with the continuation prompt — never reported as a completed run. |
| The second consecutive review on a target opens only findings of an already-seen class | No further fix round dispatches on those findings: the [Standard settlement](#standard-settlement) path runs first, and the settled standard binds every later dispatch packet. |
| Convergence saturation fires on a target | The [convergence declaration](#convergence-declaration) runs before any further round on that target — the loop's non-convergence is declared once, with trajectory, verified-green evidence, cost, and exactly one decision. |
| Blocking findings survive while budget and verified progress hold and no safeguard fired | Continue the fix → verify → re-review loop unattended (subject to the review-limit headroom condition in [Fix continuation and review justification](#fix-continuation-and-review-justification)); surviving findings are not a permission ask. |
| A free-text grant matches neither grant flavour exactly | Parse it once; one clarifying question when ambiguous; the parsed flavour is recorded in the budget line. |
| A settlement classifies every open finding as a nit | Close the target accepted-with-residuals under the settled standard without a question; the residual list is recorded in state and in the task result record. |

## Routing policy

Both workflows select routes by the same rules. Routes are opt-in only
through the installation's configuration: the workflow never selects a model
itself, and an ordinary route with no explicit configuration keeps its
existing assignment unchanged. The two optional routes — `implement-easy`
and `consult-hard` — exist only where the installation configures them.

- **`implement` is the default**: a scoped, verifiable slice that needs
  ordinary implementation judgment.
- **`implement-easy`** is selected only when the installation configures it
  AND the slice is explicitly prescribed, bounded, and mechanically
  verifiable — a docs correction with a deterministic acceptance check, or a
  reference-checked rename. A slice that needs design judgment, behavioral
  reasoning, or open-ended verification is not easy, however small it looks.
  When the route is not configured, the slice runs on `implement` with its
  existing assignment; that fallback is the defined policy, not a silent
  substitution.
- **`implement-hard`** is dispatched directly — no consultation first — when
  the slice's correctness risk is visible: concurrency/async/cancellation/
  timing behaviour, cross-repository contract surfaces, subtle shared-state
  behaviour, security-relevant code paths, compatibility surfaces, or
  interacting contracts. Risk is assessed per slice: no category of work
  (docs, packaging, renames included) is exempt when its actual risk is
  visible, and none qualifies merely by label. A routine slice that exposes
  such risk mid-flight is reassessed and, when warranted, continued or
  redone on the hard route.
- **A hard fix keeps the fix contract and the fix counters**: it dispatches
  on `implement-hard` with the bounded fix contract carried explicitly in
  the task packet (or an equivalently scoped implement contract where the
  installed profile body differs), and records task role `fix`, dispatched
  role `implement-hard`, and the reason.
- **`consult`** covers an independent task-framing recommendation and a
  second opinion on one bounded focused decision. A focused decision
  warrants a consult when it is a clear, direct, complex choice whose
  framing benefits from independent review — not only when the loop is
  stuck.
- **`consult-hard`** is selected only when the installation configures it,
  for a decision with conflicting evidence, interacting constraints, or a
  costly reversal; dispatch it directly when that character is apparent.
  When the route is not configured, the decision runs on `consult`. It is
  read-only, carries the same consult contract in both modes, and consumes
  the SAME consultation allowance as `consult`: one per task in reviewed
  task work (a `--consult` invocation consumes it), one per decision and
  two per session in Autonomous Mode. A requested stronger advice the host
  cannot honour is surfaced as a limitation, never silently substituted by
  a weaker route.
- **`review` and `review-deep`** keep their existing gates, budgets, and
  triggers; the routing policy adds no review round and changes no cap.

An optional route that is simply unconfigured falls back to its base route
as defined above. That is different from an explicitly configured role
whose installed profile is missing or unreadable: that blocks only that
role's dispatch and is reported with the binding's refresh procedure —
never silently inherited or substituted. Whether a route is configured is
established from the installation's authoritative install evidence as the
active binding documents — not from the presence or absence of profile
files alone; when that evidence is unavailable or ambiguous, the binding's
conservative limitation handling applies. The same distinction applies to a
requested route the active binding cannot honour: report the limitation.

Routing follows the current slice, not a prior route lock. At every slice
boundary, and on every fresh resume of a long-running goal, reassess the
next slice's risk and the current installation before selecting its route;
earlier dispatch records are diagnostic history, not an assignment. Keep
the routing decisions, records, and rationale in the invoking workflow's
existing state — session context in reviewed task work, the active handoff
in Autonomous Mode — and create no new state for them.

## Dispatch records

The coordinator records each dispatched round with its role (one of the
seven base roles: explore, implement, implement-hard, fix, review,
review-deep, consult — plus implement-easy and consult-hard where the
installation configures them), the task contract it ran, and — only where
the active binding exposes it — the role's model selection.

These records belong to the invoking workflow's state: session state in
reviewed task work, the compact snapshot and the backlog's settled task
evidence in Autonomous Mode — a checkpoint, not a default round journal.
In Autonomous Mode the record also carries the stable run and task identities
and, for a worker round, its single charge against both worker budgets,
persisted before launch so a crash or a quota-only launch can be reconciled
without double charging or free replay; review, review-deep, and consult
rounds are accounted under their own rules and never debit the worker budgets.
A child's self-reported model name never establishes what it ran on, and an
unknown model selection stays unknown rather than being estimated.

Dispatch records are diagnostic state, not a script to recite before every
child. In ordinary progress narration, omit model identifiers and selection
details; surface them only when explaining a consequential limitation or a
requested-versus-installed mismatch. If the user asks to see model choices,
include a short, clearly labelled selection alongside the assignment. State
the practical effect and next action; include exact model identifiers when
needed to diagnose the issue. Explain an unchanged limitation once, then
repeat it only when it affects a new decision. These presentation rules
never permit silent substitution or remove required records.

## Review and fix gate

Review task correctness, relevant regressions, acceptance checks, scope,
repository conventions, and the supplied Git/state policy. Reviewers do not
change product code. They write operational notes only when the state policy
explicitly requires them. Run relevant checks independently where feasible;
report unavailable checks and do not claim they passed. Missing evidence needed
to establish acceptance is blocking.

Distinguish user-supplied requirements and context from observed behavior and
repository contracts, and from inferred purpose; do not treat the
implementation's current behavior as the intended behavior and approve it for
matching itself. Establish meaningful checks from existing contracts, tests,
reproductions, documentation, and relevant implementation context; the
absence of a worker report or original implementation history is not itself a
defect.

Blocking findings identify defects or unmet acceptance conditions that must be
resolved before delivery. Style preferences and optional improvements are nits
and do not block. Distinguish pre-existing issues from task regressions; do not
expand the assignment to repair unrelated issues.

Send blocking findings to a fresh fix worker with the original acceptance
criteria. Fix continuation follows the shared
[progress-aware contract](#progress-aware-budgets-and-continuation): the
effective worker budget, verified progress evidence, the stall safeguards,
and the review-limit headroom condition in
[Fix continuation and review justification](#fix-continuation-and-review-justification)
bound it — not an arbitrary per-target fix/review cycle count — and every
review must be justified by changed evidence, a required integration gate,
bounded interrupted-review recovery, or an explicit user request — one
bounded audit over the range the user names: the request is itself the
justification, and it authorizes that audit, not a review-only loop. The
required independent review of the
last allowed fix still runs at zero worker budget. If blockers survive it,
follow the invoking workflow's stop/decision policy rather than repeatedly
attempting the same fix; the target stays incomplete and review-open.

A re-review closes the loop over the earlier report: it states each prior
finding by ID as fixed, partially fixed, still open, or regressed, separates
new defects from the consequences of an earlier unresolved issue, and lists
the acceptance evidence still missing. Run the targeted checks that bound the
current slice; reserve full-suite and publishing checks for the integration
boundaries where they are meaningful. When a change makes recovery or
interruption behaviour part of the acceptance, the evidence comes from the
real user entry or command selection that reaches it and the interruption
boundary around its external side effects, not only from internal method tests.

`accepted-with-residuals` is a terminal slice-gate outcome: the target's
acceptance is verified, every deterministic check passes, and every open
finding is a nit under the target's settled standard ([Standard
settlement](#standard-settlement)). Its record obligations: the residual list
is recorded in state and in the task result record as a known-limits line, and
is surfaced in the final report; a dependent task's dispatch packet names the
inherited residuals. Closing with residuals is legal only under a recorded
settlement or a recorded convergence declaration ([Convergence
declaration](#convergence-declaration)) — without one, "close with documented
residuals" is not an option the coordinator offers and the target stays
review-open under the invoking workflow's stop/decision policy.

A purely mechanical finding has a sufficient deterministic acceptance check.
After its fix, the coordinator can close it by running that check. Behaviour,
correctness, or design findings require independent re-review of the fix and
affected invariants. Do not spend another full review on a mechanical finding
closed by its deterministic check or reopen unaffected accepted work. If a
reviewer repeatedly tightens the same standard, settle that standard once
through the invoking workflow's decision policy rather than treating each new
preference as another defect.

The same mechanical/judgemental distinction governs changes, not only
findings: a clearly mechanical change — one whose entire acceptance is a
deterministic check — closes by running that check, without an independent
review; independent review is required only when risk warrants it (a surface
the check does not cover, a visible correctness risk, interaction with earlier
work, or the invoking workflow's stricter mode requires it). Every other
change keeps its review gate unchanged. A failed deterministic check is
repaired and the same check is re-run by the coordinator: it is not a review
finding and does not trigger a review.

The coordinator checks the final diff/state and a relevant acceptance result
before reporting completion. An accepted change requires the necessary checks
and no unresolved blocking findings; disclose limits of the evidence. A clean
review is acceptance evidence, not completion: the task completes only under
the invoking workflow's delivery rules — Autonomous Mode's task persistence
gate, or reviewed task work's delivery and Git policy, which may legitimately
leave the accepted changes uncommitted.

A standalone review invoked directly (outside the work and autonomous
workflows) returns the findings report to the user and does not enter this
gate's fix loop: no fix round is dispatched from its findings, and the
fix-continuation rules do not apply to it. This gate governs the work and
autonomous dispatches, which keep their existing review and fix policies.
