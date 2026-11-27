# Work-coordination examples

These examples are acceptance cases for interpreting the coordination rules in
the [work skill](../skills/work/SKILL.md), the
[shared round contract](../skills/work/references/rounds.md), and the
[autonomous skill](../skills/autonomous/SKILL.md). They describe expected
coordinator decisions; they are source-interpretation examples, not live host
tests. The counter, switching, and recovery cases interpret the autonomous
skill's [state and write discipline](../skills/autonomous/SKILL.md#state-files-and-write-discipline)
and [recovery rules](../skills/autonomous/references/recovery.md), which govern
the charge, settle, switch, reconcile, and finalize rules. The autonomous state
is the compact snapshot `.agenticale/active.md`
plus `BACKLOG.md`; the snapshot is the single counter authority, the
coordinator is the only state writer, and there is no default archive.

## Coherent existing changes with an empty `/work --pr`

The branch and working tree contain coherent, complete changes made outside
the session — manually or by another agent — and the user invokes `/work --pr`
without task text.

Expected behavior:

- Adopt the existing changes as the task: with no explicit task text and no
  active task, the task-selection chain inspects the branch and working-tree
  changes and adopts them because they form a coherent, sufficiently
  understood task.
- Briefly explain the selected scope and apparent outcome as progress
  narration, not a confirmation gate.
- Review the changes independently, fix concrete findings, and complete the
  PR delivery endpoint: checks, coherent commits, push, and the created or
  updated pull request.
- Never require the user to restate the task, and do not assign an
  implementation round to modify already-complete work.

## The same changes with an empty `/work`

The same coherent uncommitted edits, and the user invokes `/work` without
task text and without `--pr`.

Expected behavior:

- Adopt the changes, review them, and fix concrete findings as necessary.
- Leave the changes uncommitted by default: an empty invocation without
  `--pr` authorizes no commit, push, or pull request.

## A preceding same-session review with findings

A `/review` earlier in the same session returned findings on the current
branch's changes, and the user now invokes `/work --pr` without task text.

Expected behavior:

- Use the review's findings and scope directly: no copying of the report and
  no restating of the task.
- Recheck the current repository state and each finding's applicability
  before acting; reuse the review's evidence that still covers the same
  content and checks, and run no redundant initial review.
- Fix the findings, apply the existing fix and re-review rules to the
  changes, then complete the PR delivery.

## A preceding clean review with `--pr`

A `/review` earlier in the same session returned a clean verdict on the
current changes, and the user invokes `/work --pr` without task text.

Expected behavior:

- Do not manufacture implementation work from the clean review, and do not
  duplicate the valid review: reuse its evidence where it still covers the
  same content and checks.
- Complete the outstanding delivery steps — commits, push, pull request — and
  report the result.
- If the reviewed result is already delivered and nothing remains, say so
  instead of publishing again.

## An explicit request to begin with a deep review of existing changes

The branch and working tree contain existing changes, and the user invokes
`/work First perform a deep review of the current branch changes. If there are
blocking findings, fix them, verify the fixes, then commit, push, and create
or update the PR. Otherwise, report the clean review and stop.`

Expected behavior:

- The explicit request selects the review-deep contract for the first review
  round, before any implementation round: the same contract and role as a
  standalone `/review --deep` under equivalent configuration, with the same
  comparison and scope — the recorded merge-base-to-working-tree comparison of
  the current branch, including relevant untracked files, stated before
  dispatch.
- A clean verdict stops with the report: no implementation work is
  manufactured, and nothing is committed, pushed, or published because the
  task's conditional delivery instruction names publication only after fixes.
- Blocking findings enter the normal loop, closed by the finding's class: a
  mechanical finding closes by its deterministic check (a passing check
  closes only that finding; fail → another fix round), and a judgmental
  finding takes an independent re-review within the existing caps.
  Acceptance and delivery wait until all blockers are closed, each by its
  class: the commits, push, and created or updated pull request follow only
  after every blocking finding is closed.
- The selection is explicit-only: an ordinary `/work` invocation without such
  a request is unchanged, this initial deep review of existing changes is
  never started on the coordinator's own initiative, and merely mentioning one
  does not select it. The request adds no command, flag, role, or routing
  configuration, and it is not a general rule for multi-step command chaining
  in the task text.

## An explicit initial deep review of a named range

The branch and working tree contain existing changes, and the user invokes
`/work First perform a deep review of the range v1.4.2..HEAD. If there are
blocking findings, fix them, verify the fixes, then commit and push.`

Expected behavior:

- The explicit request selects the review-deep contract for the first review
  round, before any implementation round, exactly as the un-named request
  does.
- The review covers exactly the user-named range `v1.4.2..HEAD`: the named
  range replaces the comparison, and the default merge-base-to-working-tree
  range applies only when the request names no range.
- Blocking findings, if any, enter the normal loop, closed by the finding's
  class, with acceptance and delivery waiting until all blockers are closed
  under the task's delivery instructions as written.

## No task and no changes

The user invokes `/work` without task text, there is no active task or
preceding review, and the branch and working tree have no changes beyond the
base.

Expected behavior:

- Ask what to work on; create nothing — no branch, no commit, no pull
  request, and no invented task.

## Competing changes and ambiguous scope

The working tree holds several unrelated changes — or the conversation
references competing tasks — and the user invokes `/work` without task text.

Expected behavior:

- Ask one focused scope question naming the competing candidates; never
  silently choose between them, and never treat a stale conversation
  reference as an active task.
- Preserve all changes while asking: nothing is staged, committed, or
  discarded.

## An explicit task alongside unrelated dirty work

The user invokes `/work <task>` while the working tree contains unrelated
staged and unstaged changes.

Expected behavior:

- The explicit task text controls scope; the unrelated changes are not the
  task.
- Inspect the staged, unstaged, and untracked changes deliberately and
  preserve them, including unrelated staged content; attribute overlapping
  edits before changing or committing them.

## Missing consequential product intent

The adopted existing changes carry no user-supplied requirements, tests, or
documented contract that establishes the desired behavior.

Expected behavior:

- Distinguish user-supplied requirements and context from observed behavior
  and repository contracts, and from inferred purpose; do not approve the
  implementation for matching its own current behavior as if that were the
  intent.
- Establish checks from existing contracts, tests, reproductions,
  documentation, and relevant implementation context; the absence of a worker
  report or original implementation history is not itself a defect.
- Ask the user about the missing consequential behavior through the
  coordinator; a consult may answer a bounded technical question but cannot
  invent a user preference.

## Existing autonomous state is not resumed

The repository carries autonomous-mode handoff or backlog state from a prior
durable project, and the user invokes `/work` without task text.

Expected behavior:

- Never implicitly resume the autonomous handoff: the existing autonomous
  state is not an active task unless the user explicitly supplies it as
  context.
- Follow the task-selection chain: an unambiguous current task, coherent
  existing changes, or a focused question when no selection is safe.

## Clear but complex change with a shared-state signal

The request is a clear refactor of a billing module that writes to a database
other jobs also update, and the module exposes a public API. The intent is
clear.

Expected behavior:

- Run the brief material-risk assessment before dispatching: independently
  mutable persisted state (the shared database) and a compatibility surface
  (the public API) are flagged.
- Use the signals to focus the inspection and to decompose the change into
  verifiable slices; do not start a lengthy planning round.
- Keep the overall acceptance criteria stable across the slices.

## Trivial boundary question answered by a direct read

One small question stands between the coordinator and the first
implementation slice: which file owns the retry helper the task mentions.

Expected behavior:

- Answer it with a direct read in the coordinator context.
- Do not dispatch an explore round; no cheap discovery round is mandatory.

## Uncertainty that could change the slice boundary

The slice depends on how an external service reports rate limits, and the
answer would change the slice's contract and tests. The question concerns
subtle concurrency semantics.

Expected behavior:

- Dispatch one focused explore round with exactly one question and a stop
  condition.
- Resolve the explore route through the routing contract; the subtle
  semantics do not make the question automatically suitable for a fast route.
- Wait for the answer before fixing the slice boundary; do not implement
  around an unverified contract.

## Checkpoint after a substantive worker result

A worker reports progress: the parser handles the new format, but two error
paths are unimplemented and its assumption about a lockfile layout proved
wrong.

Expected behavior:

- Checkpoint before the next round: record what is established (the parser
  path), what remains unverified (the error paths), the changed assumption
  (lockfile layout), and the allowance left for the next action and its
  review.
- Decide from the evidence whether a local correction or a design
  reconsideration is needed, and update the concise decision summary before
  the next substantive dispatch.

## Decision summary is user-visible, not hidden-only

After a substantive worker result, the coordinator updates the session
context (or the active snapshot in Autonomous Mode) with the new state and
dispatches the next round without telling the user anything.

Expected behavior:

- Treat the hidden-only update as insufficient: before the next substantive
  dispatch, send the user a concise decision summary — the prior outcome,
  any change of approach, the next evidence to collect, and any approaching
  limit or material uncertainty.
- Also retain the compact state in the workflow's existing state: session
  context in reviewed task work, the active snapshot in Autonomous Mode.
- The summary is progress narration about decisions and evidence, not
  individual tool calls or internal chain-of-thought; a routine
  verification-only check needs no summary.

## Readable narration across a fix and review

Local checks pass, but coordinator verification finds that a rename broke
migration from older installs. The next assignment is a focused fix, followed
by independent review. The routes are valid and unchanged.

Expected behavior:

- Combine outcome, consequence, and next assignment into one short paragraph:
  "The checks passed, but verification found that the rename breaks migration
  from older installs. I'm assigning a focused fix to preserve those paths."
- After verifying the targeted checks, connect the fix to the next gate:
  "The migration fix passes the targeted checks. An independent reviewer will
  now check the full change, including compatibility with older installs."
- Do not add separate checkpoint/dispatch announcements or recite role codes,
  model/effort strings, default provenance, "no fallback", or routine counters.
  Keep the complete routing records and counters in the workflow's state.
- A configured model differing from the packaged default needs no recurring
  explanation. If the user requests model visibility, add a short selection
  label; do not claim configured settings prove what actually ran.

## Routing trouble and approaching limits remain visible

Expected behavior in either workflow:

- If the next assignment uses the hard route because a finding involves shared
  state, explain the reason: "This fix involves concurrent writes, so I'm using
  the configured route for complex changes." Include model details
  when useful to distinguish the selection, not a full provenance dump.
- If an installed profile does not match the resolved request, report the
  requested and available settings and the next action under the binding's
  rules. Do not hide the mismatch as routine configuration or silently dispatch
  the available profile.
- If a permitted fallback is attempted, explain what was unavailable and which
  configured alternative is being tried. Narration does not authorize a fallback
  or override either workflow's provider-quota policy.
- If the next fix uses the last permitted attempt, say so and explain what
  happens if blockers remain. Preserve exact counts in state and the stop report.

## First assignment, final result, and collapsed children

Expected behavior in either workflow:

- Before the first assignment, state its purpose without inventing prior work:
  "I'll start with a focused investigation of where the migration loses the old
  paths, so the fix preserves existing installs."
- Make the main conversation understandable without opening child activity;
  do not rely on a particular host collapsing it or repeat the full child report.
- On completion, deliver the result and verification once. Do not insert a
  redundant checkpoint summary before the final report, and do not issue updates
  for unchanged waits or routine verification-only checks.

## Repeated invariant: real design issue versus reviewer drift

A reviewer flags a missing cache-invalidation invariant. A fix is made; the
next reviewer flags the same invariant in different words, and the third
flags it more strictly still.

Expected behavior:

- First classify the repeated finding instead of assuming drift.
- Actual defect: a second write path bypasses the cache, so the invariant
  is genuinely unmet by design. Reopen the plan through the replanning
  signal and reconsider the state model or approach; the original
  acceptance criteria stay intact, the fix/review counters for the target do
  not reset, and the scope is not weakened.
- Preference: the behaviour already meets the acceptance and the later
  rounds only tighten the wording standard (e.g., list mismatch → missing
  scope → verbatim identity). Settle the standard once through the decision
  policy, apply it everywhere, and stop iterating against the drift.

## Allowance exhausted with the review still permitted

The worker allowance in force is spent on its last permitted worker round —
after any evidence-backed auto-continuation, at the progress ceiling, or at
an exact explicit cap. The slice's changes are in the tree.

Expected behavior:

- Do not dispatch another worker round.
- Run the permitted review of the last allowed worker; the review accounting
  is separate from the worker allowance.
- If more work is then required, stop with the exhausted allowance, the
  completed and blocked state, and the recent verified progress.

## Worker allowance is a ceiling, not a work target

The requested outcome is complete after three of the default twelve worker
rounds, the accepted slices pass their reviews, and the remaining allowance is
unused.

Expected behavior:

- Stop and deliver: the outcome, its evidence, and the delivery state.
- Do not dispatch extra rounds to consume the remaining allowance or
  manufacture further work; the unused allowance is not a defect and needs
  no explanation in the narration.

## Decomposition and replanning do not replenish the allowance

Mid-sequence, five of the twelve worker rounds are used, and a finding forces
a replan that re-outlines the remaining work as three new slices.

Expected behavior:

- The replan reorganizes scope only: the remaining worker allowance stays at
  seven rounds, any recorded progress extension stays in force, the
  fix/review counters for any still-unresolved target are unchanged, and a
  new slice name grants no rounds.
- If the re-outlined work cannot finish within the remaining allowance, stop
  under the stop and continuation rules, identifying the specific exhausted
  allowance when it is reached.

## Structured stop with an interaction tool available

In reviewed task work, the task's allowance in force is exhausted and the
required review of the last allowed fix still reports blocking findings, and
the host offers an interaction tool.

Expected behavior:

- Stop before any further worker dispatch and report the exhausted worker
  allowance, what is completed, what is blocked, and the recent verified
  progress.
- Offer the situation-appropriate choices, for example "Replan before
  continuing", "Continue for one additional fix-and-review cycle", or "Stop
  and preserve current work".
- Recommend one of them from the evidence.

## The user declines the extension

The user declines the offered additional fix-and-review cycle.

Expected behavior:

- Stop without asking again and without scheduling a resume.
- Preserve the current work and include the self-contained continuation
  prompt in the stop report.

## No interaction tool available

The same exhausted-allowance stop occurs on a host with no question tool.

Expected behavior:

- State the options in the stop report instead of offering them
  interactively.
- Include the continuation prompt; do not wait for input the host cannot
  deliver.

## Extension increments, never resets

The user approves "Continue for one additional fix-and-review cycle".

Expected behavior:

- Add exactly that increment: one fix round (a worker round) and its
  re-review. The resulting boundary is an exact cap that does not
  auto-extend.
- Do not reset the fix or review counters, do not expand scope, and grant no
  review or Git rights the user did not name.
- A replan requested through the same grant stays bounded: child rounds of
  the replan consume allowances.

## Exhausted worker budget: a consult cannot grant another fix

Reviewed task work. The task's allowance in force is exhausted — at the
progress ceiling or an exact explicit cap — the required review of the last
allowed fix still carries blocking findings, and a consult on the surviving
findings recommends a specific repair.

Expected behavior:

- Do not dispatch another fix: the worker budget gates fix dispatch in both
  workflows, and a consult's recommendation is a second opinion, not an
  allowance. Per-target fix/review cycle counts are not the gate — the
  exhausted worker allowance is.
- Report the exhausted worker allowance with the completed and blocked
  state and the recent verified progress, and offer the situation-appropriate
  choices — a bounded replan, one additional bounded fix-and-review cycle,
  or a stop that preserves the current work — naming the worker increment
  each choice consumes (a fix is a worker round; review rounds only against
  an explicit user review limit).
- Continue only if the user grants the named worker increment; the resulting
  boundary is an exact cap that does not auto-extend. A declined or
  unanswered option ends the stop with the continuation prompt: do not ask
  again, do not schedule a resume, and leave the work in its preserved
  state.

## Exhausted worker budget: a consult's different path still consumes an allowance

The worker budget is spent and the same task has blocked two rounds in a
row. A consult recommends a materially different approach.

Expected behavior:

- Record the consult's recommendation as an independently advised decision,
  but do not dispatch a worker round from it: the worker budget is
  exhausted and a consult cannot grant one. The same-blocker safeguard
  would stop the task's worker dispatch even with budget remaining.
- Offer the user the choice of granting the named worker increment (a fix
  is a worker round; review rounds only against an explicit user review
  limit) or stopping; a declined or unanswered option ends the stop with
  the continuation prompt, no re-ask, and no scheduled resume.

## Progress-aware defaults: 12/24 per task, 240 run ceiling, 20 completed tasks

A new Work task and a new Autonomous run start without explicit budgets.

Expected behavior:

- Work: the task's normal allowance is 12 worker rounds with a progress-based
  hard ceiling of 24; the default allowance auto-extends on verified progress
  evidence, in recorded increments, never on churn.
- Autonomous: the run ceiling is 240 worker rounds — a generous emergency
  safety limit, not a work target — each genuine task keeps the same 12/24
  allowance/ceiling, and a separate completed-task limit of 20 bounds how
  many tasks one run may finish. The run processes eligible backlog tasks
  until the backlog is drained or a safety limit is reached.
- An explicit invocation budget, preference entry, or user task limit is an
  exact cap instead: it never auto-extends, whatever its size.

## Verified correction at round twelve extends to thirteen

A task reaches its normal allowance of 12 with the work unfinished. Since
the allowance was last set, a fix resolved a prior blocking finding and the
resolution is confirmed by its targeted check or the independent re-review;
the coordinator can point to that evidence.

Expected behavior:

- Record the verified-progress evidence and the bounded extension in the
  workflow's existing state before the next dispatch — session state in
  reviewed task work, the durable handoff and backlog in Autonomous Mode —
  then dispatch round thirteen automatically, without a permission ask.
- The extension grows the allowance within the progress ceiling of 24; it
  resets no consumed counter, fix/review evidence, or safeguard.
- Without such evidence the allowance is exhausted instead: stop the task's
  worker dispatch under the stop rules.

## Churn cannot extend the allowance

A task reaches its normal allowance of 12 with the work unfinished. The last
rounds were churn: reformatting and re-renaming edits that do not move
acceptance, a re-run of a disproved approach without new evidence, and
checks still failing or unverified.

Expected behavior:

- No extension: churn establishes no verified progress, so the allowance is
  exhausted; stop the task's worker dispatch incomplete with the stop report
  and continuation prompt.
- Two consecutive unproductive rounds fire the stall stop even earlier,
  regardless of remaining budget or ceiling.
- Evidence that rules out an approach can be progress; repeating the same
  failure without new evidence is not.

## Round twenty-four fix: the final review still runs

A task's allowance has been extended on verified progress to the progress
ceiling of 24, and round 24 is a fix whose changes are in the tree.

Expected behavior:

- Dispatch no further worker round: the progress ceiling bounds
  auto-continuation, and no extension beyond it is justified.
- The fix's required independent review — including a deep re-review where
  the finding was judgmental — still runs at zero worker budget: the budget
  gates fix dispatch, not review.
- Blocking findings that survive it keep the target incomplete and
  review-open; follow the stop/decision policy rather than attempting
  another fix or asking to authorize one more cycle. Only a named user grant
  can extend the allowance further, and its boundary is an exact cap.

## Explicit caps are exact: eight rounds with verified progress

The user sets an explicit allowance of eight worker rounds — at invocation
or through the preference entry — and the task reaches eight with verified
progress and unfinished work.

Expected behavior:

- Stop at eight: the explicit cap is exact and never auto-extends, whatever
  its size; auto-continuation applies only to the default allowance.
- Report the exhausted explicit allowance and offer the named increment a
  continuation needs; the grant's resulting boundary is again an exact cap.
- The same rule binds an explicit Autonomous run ceiling, an explicit user
  task limit, and the boundary of a named grant.

## Completed-task limit counts only closed persistence gates

An Autonomous run with the default completed-task limit of 20 has finalized
19 tasks through their full persistence gates. T20's product commits and
push are confirmed, but its bounded state finalization is still pending;
T21 is deferred unfinished, T22 is blocked, and T23 is WIP-checkpointed.

Expected behavior:

- The completed-task count is 19, derived from the backlog's confirmed
  completion records: T20 does not count until its persistence gate —
  including the state finalization — is fully satisfied, and deferred,
  blocked, exhausted, review-open, and WIP-checkpointed tasks never count.
- When T20's gate closes, the count reaches 20 — exactly once; a later
  resume reconciling the same confirmed finalization adds no second count.
  With eligible backlog work remaining, the run makes an INCOMPLETE safety
  stop: report the limit, the
  completed and remaining tasks, and the continuation prompt, offering the
  named increment (a raised limit) or a stop that preserves the current
  work. The limit never auto-grows.
- When the backlog is drained instead, the normal goal-met close applies.

## A budget stop is never a successful completion

An Autonomous run reaches its run ceiling (or its completed-task limit)
while eligible backlog work remains; in a variant, no eligible work remains
but blocked or exhausted tasks do.

Expected behavior:

- The stop is an INCOMPLETE safety stop, never a completed run: report the
  exhausted limit, the completed and blocked state, the recent verified
  progress, and the continuation prompt the stop rules require.
- A run with blocked, exhausted, or otherwise unfinished tasks is explicitly
  incomplete even when no eligible work remains — only satisfied acceptance
  and closed gates complete a task, and only a fully completed goal completes
  a run.
- Verification and the permitted review of completed changes still run
  under the unchanged review rules; no worker round is dispatched.

## Productive fix continuation beyond historical cycle counts

Either workflow. A target has already used more than two fix rounds and
three review passes — this is its fourth productive fix situation; the
latest fix made verified progress and the newest review still reports one
blocking finding. The effective worker budget shows three rounds remaining
(in Autonomous Mode, the smaller of the task's remaining allowance in force
and the run's remaining ceiling), the work is reversible under the recorded
persistence policy, and no progress safeguard or explicit user limit has
fired.

Expected behavior:

- Continue unattended: dispatch the next fix round and then an independent
  re-review of the changed delta. Do not stop to ask the user to "authorize
  one more bounded cycle", add a fix cycle and a review pass, or confirm an
  available deep re-audit — per-target fix/review cycle counts (the
  historical two-fix/three-review and two-re-audit defaults) are not
  authorization gates in either workflow; a fourth or later productive fix
  within budget needs no permission ask.
- In Autonomous Mode, charge the fix exactly once against BOTH durable
  budgets before launch (run and task counters each increment by one); the
  re-review debits neither worker budget and is justified by the changed fix
  evidence. In reviewed task work, the fix consumes the worker allowance and
  the extension/stop rules above apply when it is reached.
- Keep the target's fix/review counters as durable evidence — the historical
  counts above the old defaults are retained, never reset or re-identified
  to make the target look fresh.

## Autonomous deep findings continue beyond historical re-audit counts

A periodic or escalated deep review of an Autonomous target returns blocking
findings after two re-audits have already run this session. The effective
worker budget still covers another fix, each prior fix made verified
progress, and the envelope holds. In a variant, the slice needed two fix
rounds before its ordinary review passed.

Expected behavior:

- Each blocking finding receives a dedicated fix round charged once to both
  worker budgets; judgmental findings are followed by a fresh deep review
  scoped to the fix delta and the invariants it touched, and mechanical-only
  rounds close by local verification. The re-audit continues past the
  historical two-per-target count while fixes stay productive — no
  authorization prompt, and no unjustified re-audit of unchanged evidence.
- The two-fix struggle trigger — the slice has needed at least two fix
  rounds made in response to a review round's findings, whether or not a
  later pass eventually passed — is checked, and the audit dispatched,
  after the slice's applicable required gate passes; the session still runs
  at most one additional opportunistic escalation unless the user explicitly
  directs another — a required slice-gate deep review is outside that cap.
  The remaining periodic triggers — boundary, contract-surface, scale — are
  unchanged; slice count alone no longer fires one.
- The worker budget gates the next fix, not the re-review: the required deep
  re-review of the last allowed judgmental fix still dispatches when zero
  effective worker rounds remain. When a blocking verdict survives that
  re-review with no effective worker round left for another fix — or a
  progress safeguard fires — an exhausted run ceiling stops the run under
  the stop conditions with the named increment a continuation needs; an
  exhausted task allowance alone defers the target incomplete and
  review-open, and the run continues with another truly independent ready
  task when one can be selected safely. A consult cannot grant budget.

## Clearly mechanical changes close by deterministic verification

Either workflow. A slice's entire acceptance is a deterministic check — for
example, a prescribed docs correction or a reference-checked rename. In a
variant, a same-shaped change touches a surface the check does not cover, or
exposes a visible correctness risk.

Expected behavior:

- The coordinator runs the slice's deterministic acceptance check and closes
  the slice on its pass, with no independent review dispatched.
- When risk warrants it — a surface the check does not cover, or a visible
  correctness risk — an independent review is still dispatched before the
  slice is accepted and work advances.
- Every other change keeps its review gate unchanged; the mechanical
  exception never weakens the prohibition of review-only loops over unchanged
  evidence.

## A high-risk slice gets one review level, never both

Autonomous strict mode. A hard slice's risk warrants an integration-level
audit: it interacts with an earlier slice, a shared invariant, or an
uncertain contract later work depends on. In a variant, a self-contained
high-risk slice's acceptance a single-slice review fully covers.

Expected behavior:

- The level of the slice's own review is selected before its review
  dispatches: the integration-level slice is reviewed by one deep review
  standing in for the normal review, and its verdict is the slice's gate,
  closing before dependent work proceeds.
- The self-contained high-risk slice keeps its normal review only — no
  automatic deep review follows it.
- The session never dispatches a redundant deep review over the same slice
  range its normal review already covered without changed fix evidence, a
  required integration gate, bounded interrupted-review recovery, or an
  explicit user request: the two-fix struggle trigger and an explicit user
  request remain post-gate justifications — the explicit request itself needs
  no changed fix evidence — and the periodic gate's deep review over the
  already-reviewed range is still justified as a required integration gate,
  not an autonomy-envelope guard breach.

## A required slice-gate deep review runs after the escalation cap is spent

Autonomous strict mode. The session's one opportunistic escalation has
already been spent on an earlier post-gate deep review. A later high-risk
slice's gate requires a deep review: its risk warrants an integration-level
audit, and no normal review of it has run.

Expected behavior:

- The deep review runs as that slice's gate, outside the escalation cap: the
  cap counts additional escalations — the post-gate deep reviews, the
  struggle trigger, and explicit user requests — and does not limit a
  slice's own required gate review.
- Dependent work does not advance before its verdict; the gate closes on the
  verdict like any other required review.
- The cap still limits further additional escalations: a further post-gate
  trigger is recorded as a deferred-escalation note for the periodic gate, and
  the user may still direct an additional escalation explicitly.

## An explicit user request after a standing-in or deterministic gate

Autonomous strict mode. A slice's required gate was a deep review standing in
for its own review — its risk warranted an integration-level audit — or, in a
variant, the slice was clearly mechanical and closed by its coordinator-run
deterministic check. After that gate passes cleanly, the user explicitly asks
for a deep review of this slice. In another variant, the session's one
additional escalation is already spent when the user asks.

Expected behavior:

- The post-gate trigger check applies because the slice's applicable required
  gate passed — a review round, ordinary or standing-in deep, or the
  deterministic check for a clearly mechanical slice — not only when a normal
  review ran, so the slice keeps its post-gate triggers.
- The explicit request authorizes one bounded additional deep review over the
  range the user names: the request is itself the justification — it needs no
  changed fix evidence — and it authorizes that audit, not a review-only loop.
- The additional deep review counts against the additional-escalation cap,
  while a required slice-gate deep review would be outside it. The user may
  direct the escalation even after the cap is spent; the cap limits
  coordinator-initiated additional escalations, not an explicit user request.

## The struggle trigger needs no diff the previous review has not seen

Autonomous. A slice needed at least two fix rounds made in response to a
review round's findings, and its second judgmental fix was already
independently re-reviewed: the re-reviewer has seen the slice's final diff.
The two-fix struggle trigger fires after the slice's gate passes cleanly.
In a variant, a further struggle audit is requested over the same range with
nothing new.

Expected behavior:

- One deep review is dispatched as a required integration gate over the
  slice's accumulated commit or diff range — its single-slice range from the
  slice's own entry through the current state, including every fix delta; it
  does not start at the preceding deep review, so when the slice's own gate
  was a deep review standing in for it, the struggle audit re-covers the
  slice's whole range, justified by the changed fix evidence and the trigger.
  The trigger itself — the shared worker/reviewer blind-spot signal after at
  least two fix rounds made in response to a review round's findings, whether
  or not a later pass eventually passed — is the justification; it does not
  require a diff the previous review has not seen.
- A second struggle audit over the same range with no new trigger, no
  changed evidence, and no interrupted review to recover is prohibited as a
  review-only loop.

## Same-gate retries of a failed check are not fix rounds for the struggle trigger

Autonomous strict mode. A clearly mechanical slice's gate is its
coordinator-run deterministic check. The check fails; the coordinator
dispatches a focused repair and re-runs the same check; it fails again; a
second repair, another re-run; it finally passes. No reviewer ever ran, and
no review round ever returned a finding for this slice.

Expected behavior:

- The gate closes on the passing check: a failed deterministic check is
  repaired and the same gate is re-run by the coordinator — no finding
  classification and no review round, since no reviewer ran.
- The two same-gate retries are repairs, not fix rounds: the struggle
  trigger counts fix rounds made in response to a review round's findings,
  and it presupposes a reviewer — it does not fire.
- No deep review is dispatched on that basis: no post-gate trigger fires,
  and the slice is recorded accepted when its gate passes cleanly.

## Slice count alone no longer triggers a deep review

Autonomous. Three or more accepted implementation slices have closed since
the last deep review, but no periodic trigger — boundary, contract-surface,
or scale — and no escalation trigger has fired.

Expected behavior:

- No deep review is dispatched: slice count is not a trigger. The periodic
  gate runs only on a milestone, release, or session-close boundary after
  two or more accepted slices, an accepted slice changing a public API,
  package/dependency identity, cross-repository contract, or submodule
  relationship, or an accepted range spanning two repositories or roughly
  twelve non-handoff files; the escalation triggers are unchanged.

## A standing-in deep review does not shorten the periodic range

Autonomous. Slice A passed its ordinary review, and slice B — a high-risk
slice whose risk warranted an integration-level audit — passed its gate by
a deep review standing in for its own review. No periodic trigger has fired
since session start. A milestone boundary then fires the periodic gate.

Expected behavior:

- The periodic audit's range spans A and B — from session start, the
  previous baseline — not an empty range after B: the standing-in audit was
  scoped to slice B only, so it did not advance the periodic baseline; the
  baseline advances only when a deep review's audit range covered the whole
  accumulated range since the previous baseline (an integration-scope
  audit).
- Slice A, already audited at slice level, is re-covered as part of that
  integration range: the same-range re-coverage is justified as a required
  integration gate under the scoped no-stacking rule, not a review-only
  loop.
- That periodic audit, its range having covered the whole accumulated range
  since the previous baseline, is the new baseline for the next periodic
  range.

## Autonomous budget exhaustion: the required review still runs, blockers prevent completion

An Autonomous target's last effective worker round is spent on a fix. The
fix's changes are verified and in the tree; the strict review gate has not
yet run for them. In a variant, the last allowed worker round is a
judgmental fix to a deep-review finding, due its fresh deep re-review.

Expected behavior:

- Dispatch no further worker round for the target: the effective worker
  budget is exhausted. The required review of the last allowed worker still
  runs under the review accounting — review rounds debit neither worker
  budget. In the variant, the required deep re-review dispatches with zero
  effective worker rounds left: the budgets gate fix dispatch, not review,
  and the re-review is never skipped for lack of fix budget.
- A clean review lets the slice proceed to its remaining gates; blocking
  findings keep the target incomplete and review-open — blockers prevent
  completion, and no automatic extra fix cycle runs.
- When the run ceiling is exhausted, stop the run under the allowance-stop
  rules — an INCOMPLETE safety stop whenever eligible work remains —
  reporting the exhausted budget, the completed and blocked state, and the
  recent verified progress, and offer the named worker increment a
  continuation needs (a fix is a worker round); a consult cannot grant it.
- An exhausted task allowance alone defers only that task: the target stays
  incomplete and review-open with its resumable packet and open findings, a
  truly independent ready task may be selected with its fresh allowance, and
  the run stops for budget only when the run ceiling or the completed-task
  limit is exhausted, or no safe ready work remains — an incomplete stop
  whenever unfinished tasks remain. No review gate, dependency, or safety
  boundary is bypassed to keep the run going.

## Two unproductive worker rounds stop despite remaining budget

Either workflow. A target has effective worker rounds remaining, but two
consecutive worker rounds made no verified progress on the surviving
blocking finding — their only output was unverified claims or still-failing
checks; in a variant, the same task reports the same blocker two rounds in
a row.

Expected behavior:

- Stop the task's worker dispatch under the shared stall safeguards — two
  consecutive unproductive worker rounds, or the same blocker twice — even
  though budget remains. Remaining budget is not a reason to keep fixing a
  wall, and no progress extension is justified without verified evidence.
- A consult may recommend a materially different path, but that path still
  consumes the worker allowance and a consult cannot grant one; otherwise do
  not burn rounds on a wall only the user can decide. Repeated findings on a
  genuinely unmet invariant still reopen the plan with the original
  acceptance and counters intact, and reviewer standard drift is still
  settled once, not chased.

## Autonomous explicit user limits and historical caps on resume

An Autonomous handoff records an explicit user limit ("at most three fix
rounds for T2") alongside its counters. In a variant, the handoff was
recorded under the historical default caps with two fixes and three review
passes already used, and the user resumes with plain `/autonomous` while
effective worker rounds remain and fixes are productive.

Expected behavior:

- The explicit user limit stays binding and never auto-extends: reaching it
  stops the loop under the stop/decision policy with the named increment a
  continuation needs; only a user grant extends it, the grant never resets
  counters, and its resulting boundary is again an exact cap.
- The historical default caps do not re-gate the resumed run: with budget,
  progress, and permissions intact, the resume continues the fix → review
  loop unattended past the recorded two-fix/three-review counts. The
  historical counters persist as evidence — a resume, replan, rename, or
  interruption recovery resets or re-identifies nothing, erases no recorded
  progress extension, and creates no new state file.
- A numeric resume still changes the run ceiling only; persisted consumption
  carries over, and an explicit user review limit, where recorded, is
  extended only by the review rounds a named grant names.

## Autonomous review-only loops over unchanged evidence are prohibited

An Autonomous target's latest review returned blocking findings, but no fix
has changed the diff since; in a variant, a mechanical finding closed by its
deterministic check; in another, a review child was interrupted mid-verdict;
and in another, the periodic deep-review gate fires over a range whose
slices already passed their per-slice reviews; and in another, the user
explicitly asks for a deep review of a slice after its review passed
cleanly.

Expected behavior:

- No unjustified re-review of unchanged evidence: a review round needs
  changed slice or fix evidence, a required integration gate (periodic or
  opportunistic deep review), bounded interrupted-review recovery over the
  same range, or an explicit user request. Dispatching another review just
  to spend availability, or looping review-only rounds hoping for a
  different verdict, is prohibited even while review rounds remain
  dispatchable.
- The explicit user request authorizes one bounded audit over the range the
  user names: the request is itself the justification — it needs no changed
  fix evidence — and it authorizes that audit, not a review-only loop; the
  prohibition on coordinator-initiated review loops over unchanged evidence
  continues to apply.
- The mechanical finding closes by the coordinator's deterministic check without
  another full review. The interrupted review is replaced by one fresh
  review child over the same range under the review accounting — not a
  worker round, and not a reason to re-review accepted work.
- The periodic gate's deep review over the already-reviewed range is
  justified as a required integration gate — a justified same-range review,
  not an autonomy-envelope guard breach. A further deep re-audit with no fix
  delta, no gate trigger, no interrupted review to recover, and no explicit
  user request is unjustified and prohibited.

## Work continues productive fixes within budget: the same third-fix situation

Reviewed task work. A slice has used two fix cycles and three review passes
with a blocking finding still open, while several worker rounds of the
task's allowance remain unused and the latest fix made verified progress.

Expected behavior:

- Continue unattended under the shared progress-aware contract: dispatch the
  next fix and its justified re-review without a permission ask. Per-slice
  fix/review cycle counts are not authorization gates in Work either; the
  worker allowance in force, verified progress, and the stall safeguards
  bound the loop.
- Stop only when the allowance in force is exhausted (after any
  evidence-backed extension, at the progress ceiling, or at an exact
  explicit cap), a stall or blocker safeguard fires, or an explicit user
  limit binds — then report the exhausted allowance and offer the named
  increments. The required review of the last allowed fix still runs at
  zero worker budget.
- Work's one-consultation-per-task allowance and its stop/continuation rules
  are unchanged, and every review still needs changed evidence, a required
  integration gate, bounded interrupted-review recovery, or an explicit user
  request.

## Autonomous budgets: a 20-round run with an exhausted task

An Autonomous run starts with `/autonomous 20 <goal>` (an exact run ceiling
of 20) and an explicit user task cap of 12 for T1. The first genuine task T1
(CSV export) consumes its full capped allowance of 12 worker rounds and is
exhausted with part of the work unfinished. Two other truly independent
ready tasks follow: T2 (logging) consumes 3 worker rounds and T3 (docs)
consumes 2, each completing its review and persistence gates.

Expected behavior:

- Every explore/implement/fix round is charged once to both its task and the
  run: T1 12/12, T2 3/12, T3 2/12; run consumption 12 + 3 + 2 = 17 of 20, so
  the effective run remaining is 3. The snapshot's budget line records exactly
  these numbers once — the backlog never mirrors consumed counters — and the
  completed-task count of 2 against the limit of 20 is derived from the
  backlog's confirmed result records; T1 never counts while unfinished.
- T1's explicit cap is exact: it does not auto-extend even if the last rounds
  made verified progress. (Under the default allowance, verified progress at
  round 12 would instead justify a recorded extension up to the progress
  ceiling of 24, bounded here by the run's remaining ceiling.)
- T1's exhaustion dispatches no further worker round for T1, but verification
  and the permitted review of its completed changes still run; the unfinished
  part stays incomplete with findings, current state, and one next action in
  a resumable backlog packet — never recorded as completed.
- T2 and T3 are genuinely new tasks: each receives a fresh allowance of 12
  with the progress ceiling of 24. Their selection is safe despite T1's
  unfinished changes in the tree because they are truly independent; a task
  depending on T1's unfinished work would not be ready.
- The run does not stop at T1's exhaustion: an individual task limit alone is
  not a run stop. It stops only when the goal is met, the run ceiling or the
  completed-task limit is exhausted, no safe ready work remains, a steering
  pause applies, or an existing safety/blocker/human-decision gate hits —
  an incomplete stop whenever unfinished tasks remain.
- Continuing T1 later needs a named user grant to T1's task allowance (and
  run remaining); the grant never resets counters and its boundary is an
  exact cap. Review, review-deep, and consult rounds consumed none of the
  worker budgets and kept their own accounting.

## Task exhaustion: independent ready work continues, gates never bend

A task's allowance is exhausted with blocking review findings still open on
its unfinished part, and the backlog holds another ready task whose changes
touch the same uncommitted files, plus a third task that is truly independent.

Expected behavior:

- No further worker round for the exhausted task; the permitted review of its
  completed changes still runs, and the open findings stay visibly open.
- The file-overlapping task is not safely separable from the unfinished work:
  it is not ready, and selecting it would risk the unfinished changes. The
  truly independent task may be selected with its fresh allowance.
- No review gate, dependency, or safety boundary is bypassed to keep the run
  going, and no task is manufactured to spend the remaining run budget. When
  no safe ready task remains, the run stops with the preserved state, the
  deferred packets, and the continuation prompt.

## Fresh allowance only for genuinely new tasks

Within one Autonomous run, a task is decomposed into three slices, replanned
after a rejected experiment, interrupted once, and resumed in a fresh
session; along the way a recorded progress extension raised its allowance in
force from 12 to 16.

Expected behavior:

- The task keeps one stable ID and one allowance in force across all of
  these events — the default 12 plus any recorded extension; every
  explore/implement/fix round — including the reset continuation, the
  resumed work, and any replay of productive work — charges the same task
  and the same run, keeping its recorded charge.
- Decomposition, replanning, interruption recovery, and resume replenish
  neither the task allowance nor the run ceiling, re-issue no task ID, and
  erase no recorded extension or its evidence.
- A genuinely new task (a distinct backlog outcome, not a renamed slice of
  the same one) receives its stable ID when it enters the backlog and its
  fresh allowance only when first selected; an ID alone grants no rounds.

## Single counter authority: no mirror, no growing ledger

An Autonomous run has settled several rounds. The snapshot carries the
budget line — run identity, ceiling, consumed; active task ID, allowance in
force, consumed — plus the open target's fix/review counters, the
pending-dispatch evidence while a charged child is in flight, and the
current slice's state. The backlog carries the run header, task entries,
deferred packets, and result records.

Expected behavior:

- The consumed counters live exactly once, in the snapshot's budget line.
  The backlog never mirrors the active task's or the run's consumed
  counters — duplicate counters drift. Remaining budget is derived from the
  ceiling or allowance, never stored as a second number.
- The snapshot is a compact checkpoint (at most ~2 KB), not a journal:
  settled rounds fold into the backlog task's compact result/progress note,
  and the snapshot keeps only what the next round and recovery need. No
  growing round ledger accumulates in either file, and consumption is never
  re-derived from a ledger or from memory.
- A deferred packet carries the task's own counters, never a run-consumption
  snapshot, so a stale task packet can never restore a stale run count. The
  completed-task count is derived from the backlog's confirmed result
  records, never a separate tally.
- The open target's fix/review counters persist as evidence in the snapshot
  (or the deferred packet when deferred) without reset or re-identification
  on resume or rename.

## Numeric resume never resets persisted counters

An Autonomous run recorded an explicit invocation ceiling of 6 with 5 worker
rounds consumed. The user resumes with `/autonomous 3`; later, with
`/autonomous 10`; later still, with plain `/autonomous`.

Expected behavior:

- `/autonomous 3` sets the run ceiling to 3; consumed stays 5, so the
  effective remaining is zero and the run stops budget-exhausted — an
  INCOMPLETE safety stop if eligible work remains — under the allowance-stop
  rules instead of silently resetting. The report offers the named increment
  a continuation needs.
- `/autonomous 10` sets the ceiling to 10 with consumed still 5: remaining 5.
  Plain `/autonomous` continues the recorded ceiling and counters unchanged.
- No resume recomputes consumption from a ledger or from memory, resets
  counters, re-issues task IDs, or erases a task's recorded progress
  extension; a user grant adds exactly the named rounds to the named budget,
  and its boundary is an exact cap.

## Crash with a pending dispatch: no double charge, no free replay

The coordinator persisted a worker round's dispatch record, incremented
counters, and pending-dispatch note, then the session crashed before the
child's report was read — or, in a variant, before the child launched at
all. A fresh `/autonomous` activation runs the reconcile event, inspecting
the working tree and host evidence.

Expected behavior:

- Reconcile the pending record once against the actual evidence before
  dispatching again: the child's material work keeps the single recorded
  charge against both budgets; a confirmed no-work quota rejection removes
  the pending charge; a complete charge whose child never launched — no
  host or working-tree evidence of a launch — removes it too and restores
  the pre-launch counters, because no round ran; the continuation is a new
  round with its own single charge.
- Never charge the same round twice, and never let a replay of productive
  work run free of its recorded charge. The run/task identities, consumed
  counters, allowances in force with any recorded progress extension, and
  compact pending-dispatch evidence survived the crash in the existing
  snapshot and backlog.

## Children report; the coordinator alone writes state

A worker round hits a reset trigger; a reviewer returns a verdict with
nits; a consult returns a recommendation. None of them has written any
operational file.

Expected behavior:

- Children return concise structured reports — including compact reset
  evidence when they reset — and never write the backlog, the snapshot, the
  steering file, or any operational file. Read-only exploration and
  consultation children return their findings in the report; the coordinator
  persists the relevant content before dispatching the next round.
- For the reset, the worker's report carries established facts with file or
  command evidence, `TRIED` (disproved hypotheses), current state, and one
  `NEXT` action. The coordinator persists that evidence into the snapshot
  (adding the compact `TRIED` section) and starts a fresh child from the
  snapshot — never asking the old worker to keep exploring.
- The coordinator records the reviewer's verdict and nits in the durable
  state from the report and promotes nits to backlog checkboxes; the
  reviewer writes no operational file and never marks the task completed.
- The coordinator is the only state writer: every event step is a targeted
  edit on a fresh re-read, read back to confirm it landed, and every
  `BACKLOG.md` write preserves any concurrent human edit.

## Steering pause at a safe checkpoint, then resume

A worker round is in flight when the human creates `.agenticale/steering.md`
with `- mode: pause`. Later the human sets `- mode: continue` and invokes
`/autonomous`. In a variant, the human instead removes the file.

Expected behavior:

- The file is optional and absent by default: no file means `continue` and no
  priority. The coordinator reads it; it never creates, edits, or deletes it,
  and children never touch it. Only the exact value `pause` pauses; an
  unrecognized `mode` value changes nothing and is noted in the next report.
- The running child is allowed to settle; its result and single charge are
  recorded, the exact `NEXT` and all counters are preserved in the snapshot,
  and the loop stops with a pause report and the continuation prompt. No
  mid-round interruption, no polling, no watcher or service.
- The coordinator notices the pause at its next steering re-read —
  immediately before every new round dispatch, worker, review, fix, consult,
  and deep review alike — not by watching the file continuously.
- The pause is persistent: it survives session ends and resumes. The fresh
  activation re-reads the surface: `continue` (or an absent file) resumes the
  recorded `NEXT` with the same identities and counters; a still-present
  `pause` stops again without dispatching. Only the human's own edit releases
  it; with no new steering instruction, continuation is normal. A pause
  noticed during a quota cooldown wait is honored before the next launch
  after the wait; the wait keeps its deadline rules.

## Legacy steering precedence: pause wins, priority from the new file

A legacy run carries the human-owned `## Steering` section in `BACKLOG.md`.
In one variant only the legacy section exists; in another the human has also
created `.agenticale/steering.md`, and the two surfaces disagree.

Expected behavior:

- With only the legacy section present, the coordinator reads it exactly like
  the new file — the same two controls, the same pause/priority semantics —
  and never edits it.
- With both surfaces present, `pause` in either pauses the run (pause wins);
  `priority` comes from the new file when it defines one, otherwise from the
  legacy section. A disagreement is noted in the next report, and neither
  surface is ever auto-edited to resolve it.
- The one-time transition is the human's own act — creating
  `.agenticale/steering.md`, optionally copying the controls — never the
  coordinator's: the agent never migrates, rewrites, or deletes human
  steering content, and the legacy section stays untouched as history when
  the new file exists. Invocation goal text is never written into either
  surface.

## Steering priority with blocked IDs

The active task is mid-round when the human sets `priority: T4, T2`. T4 is
blocked (it depends on an unfinished task); T2 is ready.

Expected behavior:

- The active task and the running round are not interrupted; priority applies
  only at the next task-selection boundary.
- At that boundary, T4 is skipped with a recorded note — priority never
  unblocks a blocked, dependent, or unknown ID — and T2 is selected before
  other ready tasks in normal backlog order.
- Review gates, dependencies, and safety rules are unchanged; a priority list
  grants no allowance and authorizes no Git action.

## Concurrent human steering edit survives an agent backlog write

A legacy run's coordinator is about to tick a completed checkbox in
`BACKLOG.md`; while it works, the human edits the legacy `## Steering`
section. In a variant, the run uses the new `.agenticale/steering.md` file.

Expected behavior:

- The coordinator re-reads `BACKLOG.md` immediately before its targeted write
  and applies only its own change to the fresh content; the human's steering
  edit survives. No stale whole-file overwrite.
- Children never edit the steering surface; their reports leave it untouched,
  and the coordinator's backlog writes preserve any concurrent human edit.
- With the new steering file, the surface is separate from `BACKLOG.md` and
  is never agent-written at all — no backlog write can touch it, and the
  coordinator still re-reads it before every dispatch.

## Deferred packets and stable identities across switching and completion

Task T1 is deferred unfinished when T2 is selected; T2 later completes its
review and persistence gates; T1 is then resumed.

Expected behavior:

- The switch event first writes T1's compact packet — stable ID, task
  counters (never a run-consumption snapshot), established facts, current
  state, acceptance, exactly one resumable `NEXT` — into the backlog's
  deferred entries, then restores T2's packet into the snapshot with the run
  identity, ceiling, and consumed carried unchanged from the outgoing budget
  line, then updates the backlog's single active next action. T1 is not
  recorded as completed.
- T2's completion is a compact backlog result record — date, outcome, product
  commit hashes, and the confirmed push destination when pushing applies.
  Resuming T1 restores its recorded packet, identity, and counters unchanged
  — switching tasks and completing work never reset or re-identify
  consumption.
- All of this uses the existing `BACKLOG.md` and the compact snapshot; no
  archive is created and no new state file. A deferred packet for a
  checkpointed task also carries its WIP hashes, push state, and recorded
  pre-WIP review base.

## No default archive; historical material stays untouched

A run completes several tasks and later stops. The repository also carries
legacy handoffs and an existing monthly archive from earlier runs.

Expected behavior:

- Completed task detail lives in the backlog's compact result records —
  date, outcome, product commit hashes, and the confirmed push destination
  when pushing applies. The run creates no monthly archive and no
  session-close archive paragraph, and no archival step gates completion.
- Historical material — legacy handoffs, existing archives, old session
  records — is preserved untouched: never rewritten into a lossy summary,
  never deleted, and read only by an exact pointer when a decision needs it.
- Unresolved blockers and nits stay as open backlog checkboxes; a deferred
  unfinished task keeps its resumable packet and is never recorded as
  completed.

## Torn counter write reconciles from verified prior evidence

The coordinator's pre-launch snapshot charge write tears after the
incremented counters but before the dispatch record and pending-dispatch
note. The file keeps a readable budget line showing run 4 and T1 4, while
the last committed state — the snapshot version carried by the run's latest
state-only commit — still reads run 3/6 and T1 3/12. No child was launched —
the charge was never read back as durable.

Expected behavior:

- The resume's reconcile event validates the complete packet before trusting
  the readable line: the incremented counters have no backing dispatch record
  or pending note, so they are a torn write, not consumption. It rebuilds from
  the verified committed state — run consumed 3 and T1 consumed 3 — repairs
  the snapshot, and dispatches the round with one new charge: run 4, T1 4
  after the first actual round.
- There is no backlog counter mirror to rebuild from: consumed counters live
  once in the snapshot. A deferred packet supplies task counters only for a
  deferred task, never run consumption. Treating the readable 4 as consumption
  and then charging the dispatched round would reach run 5 for one actual
  round — unverified counters are never trusted.
- No double charge and no free round: if the tree and host evidence instead
  show a launched round whose charge was lost, that single charge is applied
  exactly once during reconciliation. If the exact consumed counters cannot
  be established from the committed state plus verified host and working-tree
  evidence, the resume stops with the continuation prompt naming the gap —
  never guessing and never resetting counters to zero.

## Missing snapshot rebuilds from verified evidence or stops

The snapshot file is gone entirely — deleted, or lost with an interrupted
write. The backlog survives with its deferred packets and result records,
and the run's state-only commits carry earlier snapshot versions.

Expected behavior:

- The resume rebuilds only from verified prior evidence: the last committed
  state in git history, the backlog's deferred packets for task counters
  (never for run consumption), recorded WIP hashes and review bases, and host
  or working-tree evidence of the rounds launched since that committed state.
  Each verified round's outcome is applied exactly once under the settle
  outcomes — material work keeps or applies its single charge, a confirmed
  quota-only or never-launched dispatch removes or never applies it.
- With no evidence sufficient to establish the exact consumed counters, the
  resume stops with the continuation prompt naming the missing evidence —
  never a fresh zeroed run, never a guess, and never consumption recomputed
  from a ledger or from memory.
- A torn or missing legacy packet follows the same recover-or-stop rule; the
  legacy file is never auto-edited or deleted by the recovery. With a legacy
  packet present and the new snapshot missing, the legacy-compatibility
  guard runs first: a run already migrated or closed never re-imports it
  (see the migrated-run fixture).

## Legacy packet transition carries counters, gates, and policy exactly

A resume finds no `.agenticale/active.md` but a legacy
`.agenticale/handoffs/active.md` packet from a run under the old contract,
with consumed counters, a recorded progress extension, fix/review counters,
an open review gate, and a recorded persistence policy. The legacy backlog
carries consumed-counter mirrors and the human-owned `## Steering` section.
The backlog and git history show no trace of an earlier migration or closure
of this run: no compact result records or run-close record under its identity,
and no state-only commit carrying `.agenticale/active.md`. In variants, both
packets exist; the legacy packet is torn; or the legacy handoff records no
policy at all.

Expected behavior:

- The one-time transition validates the legacy packet and carries its
  identities, consumed counters, allowances in force (including the recorded
  progress extension), fix/review counters, open gates, and recorded
  persistence policy exactly into the new compact snapshot — no reset, no
  re-derivation — then persists the transition under the active policy as a
  bounded state-only checkpoint before further dispatch (recorded diff
  evidence under working-tree policy), runs the reconcile event, and
  continues under the new contract. The checkpoint makes the migration
  recognizable from git history on any later resume. The legacy file itself
  is historical material: never auto-edited, migrated away, or deleted.
- The legacy backlog's consumed-counter mirrors and milestone status are
  superseded by the snapshot's budget line — never authoritative again and
  no longer maintained. Later targeted writes follow the compact board
  format, preserving the human-owned `## Steering` section, deferred
  packets, result records, and historical pointers.
- Both packets exist: a valid new snapshot wins and the legacy packet stays
  untouched. A torn or missing packet — new or legacy — follows the
  reconcile event's recover-or-stop rule: rebuild only from verified prior
  evidence, or stop naming the gap; never guess or zero the counters.
- A legacy handoff with no recorded policy predates the commit-and-push
  default and resumes as working tree, stated with the warning that accepted
  work stays uncommitted and unpushed — never silently upgraded. The legacy
  steering section keeps its controls and precedence under the live-steering
  rules; the agent never rewrites it.

## Migrated run with a missing snapshot never re-imports the legacy packet

A legacy run migrated at run 2 / T1 2: the transition checkpoint committed
the new `.agenticale/active.md` at those counters, and the backlog's compact
result notes superseded the legacy mirrors. A later charged round advanced
the snapshot to run 3 / T1 3 — the charge was verified and the child ran
productively — and then the new snapshot file was lost. The preserved legacy
packet still reads run 2 / T1 2. The user resumes with plain `/autonomous`.
In variants, the run instead completed and cleaned up earlier (the run-close
record and every confirmed result record are durable, the snapshot
legitimately gone); or the exact counters after the last committed snapshot
cannot be established from host or working-tree evidence.

Expected behavior:

- Before any legacy fallback, the resume recognizes the prior migration from
  the backlog and Git: the compact result records under the same run
  identity and the state-only commits carrying `.agenticale/active.md` (a
  bounded `git log -- .agenticale/active.md`). The legacy packet is history,
  not current evidence — the resume never re-imports its stale run 2 / T1 2
  as the live counters.
- The missing new snapshot follows the reconcile event's recover-or-stop
  rule: rebuild from the last committed new-snapshot state (run 2 / T1 2)
  plus the verified host and working-tree evidence of the charged round
  since, applying its single charge exactly once — run 3 / T1 3 — and
  continue the recorded `NEXT`. Persistence reconciliation changes no
  counters, and the legacy file is never auto-edited or deleted.
- If the exact consumed counters cannot be established from that evidence,
  the resume stops with the continuation prompt naming the gap — never
  restores the stale legacy counters, never guesses, never zeroes.
- Completed-and-closed variant: the resume recognizes the closure from the
  durable run-close record and confirmed result records, verifies the close's
  full persistence — completion and bounded cleanup confirmed under the
  policy, any deferred failure records resolved, no outstanding close commit
  or push — then reports the confirmed closure and creates no state and no
  commits. It never re-imports the legacy packet or restarts the finished
  run; a new run needs new goal text. Outstanding cleanup or resolution
  persistence reconciles before that closure report, never after it (see the
  combined legacy-entry/cleanup-interruption fixture below).
- Only a run with no migration or closure trace in the backlog or git
  history takes the one-time transition (the preceding fixture).

## Legacy plain entry reconciles outstanding cleanup before reporting closure

A commit-and-push run migrated from the legacy layout, completed every task,
and reached its consolidated final close: the completion commit (the last
task's completion record plus the run-close record, snapshot kept as the
recovery checkpoint) was pushed and confirmed. The preserved legacy packet
still sits at `.agenticale/handoffs/active.md` with its stale counters. The
new snapshot is absent because the bounded cleanup legitimately removed it.
The user resumes with plain `/autonomous`. In variants, the interruption
landed at a different close cutpoint:

- Deletion before commit: the cleanup fold and snapshot deletion are already
  applied in the working tree, but the session died before the one cleanup
  commit was created. No failure records were written.
- Cleanup commit before push: the cleanup commit exists locally, but the
  session died before its push, or the push returned no confirmation. No
  failure records were written.
- Unresolved failure records: an earlier blocked cleanup push wrote terminal
  failure records to the backlog alone (the snapshot was already gone), and
  the cleanup commit is still unpushed.
- Confirmed complete: the completion and cleanup commits are both pushed and
  confirmed, with no deferred records.

Expected behavior:

- The entry establishes the prior migration and closure from the backlog and
  Git — the run-close record, the confirmed result records, and the state-only
  commits carrying `.agenticale/active.md` — and never re-imports the stale
  legacy packet. Durable completion records alone do not classify the run as
  closed: the entry reconciles outstanding close persistence first, under the
  bounded persistence sequence's interruption rules and the final close's
  cutpoints, before any closure report.
- Deletion-before-commit variant: the completion persistence is already
  confirmed, so the resume creates the one cleanup commit from the saved fold
  and deletion — never a second completion commit, never rewritten completion
  records — pushes and confirms it, then reports the confirmed closure. No
  failure records means no resolution commit.
- Cleanup-commit-before-push variant: the resume pushes the existing cleanup
  commit as-is — never re-creates it — and confirms it, then reports the
  confirmed closure. The deleted snapshot stays recoverable from git history
  and is never recreated. With no failure records there is no resolution
  commit.
- Unresolved-failure-records variant: the resume pushes the existing cleanup
  commit as-is and confirms it; only then are the deferred backlog failure
  records resolved to the confirmed hashes and destination, riding in exactly
  one bounded state-only resolution commit, pushed and confirmed. Its own hash
  is never written back, and the snapshot is never recreated. Only after that
  does the entry report the confirmed closure.
- Confirmed-complete variant: with the close's full persistence already
  verified and no outstanding record writes, the entry reports the confirmed
  closure and creates no state and no commits — the boundary is satisfied
  without any further write.
- Across every variant the reconciliation changes no identities or consumed
  counters, adds no duplicate commit, and never pushes a descendant of an
  uncertain commit in the same run. The legacy file is never auto-edited or
  deleted, and the human-owned steering surface is untouched. A new run needs
  new goal text; the finished run is never restarted.

## Interrupted settle write keeps the single charge

The charge event's snapshot write landed and read back — run 4 and T1 4,
backed by a complete pending-dispatch record — and the child ran
productively, but the session died before the settle write: the pending note
is unresolved and the backlog's compact result note is missing. In a variant,
the settle landed in the snapshot (pending note resolved, outcome recorded)
when the backlog result-note write was interrupted.

Expected behavior:

- The resume runs the reconcile event: the snapshot is complete and its
  counters are backed by its own records, so it validates and wins. The
  pending dispatch is resolved exactly once against the host and
  working-tree evidence under the settle outcomes: the productive round keeps
  its single charge, and the settled result folds into the backlog task's
  compact result/progress note.
- The interrupted backlog-note variant reconciles the same way: the snapshot
  is the counter authority, the missing note is completed from the settled
  record, and no counter changes — settle records a result, it does not
  charge again.
- No double charge and no free round: the interrupted write never becomes a
  second charge, and a continuation is a new round with its own single
  charge. The human-owned steering surface survives every state write.

## Interrupted task switch loses no packet and no consumption

Exhausted T1 (12/12) is being deferred in favor of ready T2. T1's deferred
packet is durable in the backlog when the session dies before the snapshot is
rewritten.

Expected behavior:

- A complete, coherent snapshot still names T1: the validated snapshot wins,
  the duplicate deferred entry is removed (nothing is lost — it was copied
  from the snapshot), and at the next selection boundary T1 is
  worker-ineligible, so the loop defers it again and selects T2.
- A torn or incoherent snapshot — even one whose budget line is still
  readable — is rebuilt from verified prior evidence: T1 from its deferred
  packet, run consumed from the verified committed state or host evidence —
  never a stale run count from a task packet. The deferred packet is never
  deleted on the strength of an unvalidated snapshot. If the run consumption
  cannot be established, the resume stops rather than guessing. T1's counters
  and T2's fresh allowance are unchanged.

## Plain `/autonomous` resumes the exact unfinished action

A run is interrupted at one of the points below, and the user resumes with
the same real command — plain `/autonomous` (a numeric resume changes only
the ceiling). The reconcile event runs first; the validated state's one
`NEXT` names the exact unfinished action.

| Interruption point | The exact action the resume selects |
| --- | --- |
| Torn charge write before launch | Rebuild from the last verified committed state plus host evidence, then dispatch the round with one new charge — never trust the torn counters. |
| Charge verified, settle write interrupted | Resolve the pending dispatch once against host/tree evidence, keep the single charge, continue from the round's outcome. |
| Missing snapshot | Rebuild from the committed state plus verified host/tree evidence, applying each round exactly once — or stop naming the evidence gap. |
| Switch: outgoing packet durable, snapshot not rewritten | The complete, coherent snapshot wins: remove the duplicate deferred entry and continue the active task to the next selection boundary. |
| Productive child crash | Keep the single recorded charge, settle the interruption, and start the fresh continuation as a new round with its own charge. |
| Quota-only launch rejection | Remove the pending charge, honor the recorded retry time, then launch the recorded round after the deadline. |
| Product committed, push interrupted | Push the existing product commits as-is — never re-commit. |
| Product pushed, state finalization missing | Complete the completion-record writes from the confirmed hashes and destination, then run the one finalize sequence. |
| Finalization committed, push interrupted | Push the existing finalization commit as-is — never a second finalization commit. |
| Finalization pushed, acknowledgment missing | Confirm the remote ancestry or content read-only; the gate is satisfied without any further write, and the next task is selected. |
| Final close records written, completion commit missing | Create the one completion commit from the saved records — the snapshot stays as the recovery checkpoint. |
| Completion commit created, push interrupted | Push the existing completion commit as-is; the cleanup follows only after the push is confirmed. |
| Completion push confirmed, cleanup outstanding | Run the bounded cleanup: fold, delete the snapshot, one cleanup commit — never a second completion commit. |
| Cleanup commit created, push interrupted | Push the existing cleanup commit as-is; the deleted snapshot stays recoverable from history, and any failure records live in the backlog alone. |

Expected behavior:

- Every resume selects the exact unfinished step above — not a replay of
  confirmed work, not a duplicated commit, charge, or completion record.
  Identities are unchanged, and consumed counters change only through the
  protocol's documented repairs and refunds: a torn charge write is rebuilt
  from verified prior Git/host evidence, and a confirmed quota-only or
  never-launched dispatch removes its pending charge. A productive round
  keeps its single charge, and persistence reconciliation changes no
  counters. The completed-task count increments exactly once, when the gate
  is first confirmed.
- The detailed cases are the surrounding fixtures: torn counter write,
  missing snapshot, interrupted settle, interrupted switch, crash with a
  pending dispatch, the quota-only launch in the quota examples, and
  interruption between commit, push, and completion.

## Exhausted-first priority must not stall selection

Steering sets `priority: T1, T2`. T1's allowance is exhausted with its
packet deferred; T2 is ready and truly independent, and T1's completed
changes still await their permitted review.

Expected behavior:

- T1 is skipped in worker selection with a recorded note even though
  steering names it first; T2 is selected with its fresh allowance and the
  run progresses. The exhausted task never repeatedly wins selection.
- T1's permitted review remains schedulable under the unchanged review rules
  and debits neither worker budget. No gate, dependency, or conflict is
  bypassed, and no task is manufactured.

## Priority can name a never-selected task

The round-0 plan recorded T1, T2, and T3 in the backlog with stable IDs;
only T1 has been selected so far. The human sets `priority: T3, T2` before
the next selection boundary.

Expected behavior:

- T3 and T2 are nameable because IDs are assigned at backlog entry, before
  selection. At the boundary, ready named tasks are considered in listed
  order; a named task that is not ready is skipped with a note.
- Selecting T3 allocates its fresh allowance then — the ID granted nothing.
  Readiness, review gates, and dependencies are unchanged.

## Goal text during an active run is steering, not a conflict

An Autonomous run is active: T2 is mid-task with consumed counters and an
open review gate, and T1's deferred packet sits in the backlog. The user
invokes `/autonomous Also add PDF export next to the CSV export`.

Expected behavior:

- Reconcile the invocation against a fresh re-read of `BACKLOG.md` and
  `active.md`; do not report a conflict and do not overwrite the active
  handoff, the deferred packet, or any counter.
- Decompose the explicit new outcome into backlog tasks: each genuinely new
  task enters the backlog with its stable ID before selection and receives
  its fresh allowance only at first selection. The run identity, ceiling,
  consumed counters, T2's allowance and counters, and every open review gate
  are preserved.
- Continue the recorded `NEXT` action; the new tasks become selectable at
  the next selection boundary under the normal readiness rules. The
  reconciliation is recorded in the existing backlog and snapshot.
- The invocation text is not written into the human-owned steering surface
  (`.agenticale/steering.md`, or the legacy `## Steering` section), which
  keeps exactly its two documented controls.

## Continuation steering preserves identities, counters, and gates

The same active run receives `/autonomous Focus on the migration tests
first; the CSV polish can wait`, with ready tasks T2 (CSV polish) and T3
(migration tests) and T4 mid-round.

Expected behavior:

- The explicit reordering applies at the next task-selection boundary among
  ready tasks; the active slice and the running round are never interrupted.
- The reorder changes the durable plan, so it is a significant
  reconciliation: its state-only checkpoint is pushed and confirmed before
  any further dispatch, after the active T4 round settles undisturbed.
- Acceptance or constraint changes reach the backlog entries and the active
  packet only where the user's text explicitly supports them. No task ID is
  re-issued, no consumed counter, allowance, or fix/review counter resets,
  and no gate is bypassed; steering grants no allowance.
- A steering invocation keeps the recorded persistence policy: a
  working-tree or commit-only run gains no push rights from it.

## Ambiguous destructive replacement asks before rewriting state

With an active snapshot and deferred packets, the user invokes
`/autonomous Start over with a cleaner approach`. A variant instead names
exactly what to discard: "Discard T3 and its deferred packet; replace it
with a schema-first approach".

Expected behavior:

- The ambiguous request stops and asks the user before any state is
  rewritten: the active snapshot, deferred packets, counters, and historical
  material are preserved while asking.
- The explicit, unambiguous variant is honoured only for what it names;
  unrelated tasks, counters, and historical material survive. Historical
  records of the discarded work stay preserved untouched — never deleted and
  never rewritten into a lossy summary; only the named open entries and
  packets are discarded.
- Neither variant resets the run's consumed counters or re-issues IDs for
  tasks that remain.

## Slice review precedes the task persistence gate

A strict-mode run under the commit-and-push policy finishes a slice; its
changes are verified and sit uncommitted in the working tree. The
independent reviewer is dispatched before the task persistence gate has run.

Expected behavior:

- The reviewer inspects the range at its current phase — the uncommitted
  working-tree result — and returns its verdict in its report only; it writes
  no operational file. The coordinator records the verdict in the snapshot.
  The reviewer does not require task commits or a confirmed push the gate has
  not performed yet, and it never commits, pushes, or marks the task
  completed.
- The coordinator owns final persistence verification at the task
  persistence gate after the review and applicable deep review gates close,
  and owns the backlog completion record after the gate is satisfied.
- A review whose supplied range already includes commits — for example a
  re-review after the gate — verifies coherent task commits and cleanliness,
  and verifies a confirmed push only when the recorded persistence state
  says the push already happened.
- When the supplied range includes recorded WIP checkpoint commits from an
  earlier stop, they are part of the task's changes: the supplied lower bound
  precedes them (the recorded pre-WIP base), so the reviewer inspects them
  inside the diff and treats their WIP identification as unfinished status —
  never as completion, and never as a reason to skip the remaining gates.

## Task lifecycle states gate selection and completion accounting

A strict commit-and-push run works T1 while ready T2 waits in the backlog.
T1's slice is implemented and verified, and its independent review is still
open. Later variants reach: every T1 check, review gate, and applicable deep
gate closed with no product commit yet (accepted); the product commits
created and pushed but the bounded state finalization unconfirmed
(persistence-pending); and the whole gate confirmed (complete). The backlog
also holds deferred unfinished T3 and blocked T4.

Expected behavior:

- review-open: T1 stays active; no next task is selected and T1 is not
  counted. The fix → review loop continues under the unchanged budget and
  progress rules.
- accepted: the clean reviews closed slice gates, not the task. The
  coordinator runs the task persistence gate before any selection; T1 is
  not reported completed and not counted.
- persistence-pending: an outstanding or unconfirmed commit, push, or state
  finalization keeps T1 open and uncounted, and T2 is not selected. An
  interruption here resumes the exact unfinished step from the actual Git
  evidence — never a duplicate commit, a record-your-own-hash write, or a
  descendant push after an uncertain one.
- complete: only now is T1 marked completed, counted exactly once from its
  confirmed completion record, and T2 selectable at the selection boundary.
- Deferred T3 and blocked T4 never count as completed. Selecting another
  truly independent ready task while they are unfinished is a documented
  deferral — the outgoing packet durable in the backlog first — never a
  completion bypass; their unfinished parts stay incomplete and resumable.
- A policy upgrade that reopens T1's persistence only moves it from complete
  back to persistence-pending with reviews and counters unchanged; when the
  gate re-closes, the existing completion record is updated and T1 is never
  counted twice.

## Completed task: coherent commits and confirmed push before the next task

A new run uses the default commit-and-push policy. Task T1 contains two
accepted slices; the second triggered an opportunistic deep review, which
returned clean. T2 is ready in the backlog.

Expected behavior:

- T1 completes only after its required checks, both slice review gates, and
  the applicable deep gate have closed. The coordinator — not the workers —
  then stages only T1's accepted product changes and creates coherent task
  commits (one per logical change, not one per agent round).
- The coordinator pushes with ordinary Git semantics to the resolved
  upstream and verifies success. It then runs exactly one bounded state-only
  finalization: the completion record — the backlog result line with the
  product commit hashes and confirmed destination, and the snapshot updated
  with the confirmed persistence state and one `NEXT` — is written into the
  existing state files, committed as one state-only commit (never product
  changes or unrelated work), and pushed and confirmed to the same
  destination. The finalization commit's own hash is never written back into
  the state it commits; later records read it from git history.
- T1 is marked completed and T2 selected only after the finalization is
  confirmed — the local acknowledgment is a read-only verification, not
  another state write, so no recursive record-your-own-hash loop exists.
- The persistence state (accepted, committed, push pending/confirmed) is
  durable in the snapshot as it advances, persisted before the next step, so
  an interruption at any step resumes exactly there.
- Under a recorded commit-only policy the same gate requires the coherent
  commits and the state-only finalization commit but no pushes; under
  working-tree policy neither commits nor pushes — the recorded policy is
  never bypassed.

## Explicit restrictions win over the commit-and-push default

A new run is invoked with "commit each task but do not push", and another
run's repository instructions forbid pushing. A third invocation says
"leave everything uncommitted".

Expected behavior:

- Each run adopts and records the restricted policy with its basis —
  commit-only, commit-only, and working tree respectively — and follows it
  at every task gate. The default never bypasses an explicit user or
  repository restriction.
- A later resume of any of these runs — empty, numeric, or steering — keeps
  the recorded policy; push rights arrive only through an explicit user
  request, recorded with its basis. A handoff with no recorded policy
  predates the default and resumes as working tree.
- Every start and fresh resume states the chosen policy and its basis
  visibly, and warns when the policy leaves accepted work uncommitted or
  unpushed: commit-only leaves commits unpushed; working-tree and legacy
  leave accepted changes uncommitted and unpushed. The legacy resume is
  never silently upgraded.

## A conditional repository guard is satisfied by the invocation

A repository's AGENTS.md says "do not stage, commit, push, or change
remotes/branches unless explicitly asked". The user invokes
`/autonomous Deliver the webhook milestone` with no git restriction, and no
repository instruction forbids commits or pushes.

Expected behavior:

- The run adopts the default commit-and-push policy. The conditional guard
  is not a prohibition: the explicit autonomous invocation is the request
  that satisfies its condition for the run's authorized persistence
  boundaries. The run does not select working-tree or commit-only policy
  citing the guard.
- The chosen policy and its basis are stated visibly at start and restated
  on every fresh resume; no restricted-policy warning applies because the
  default commits and pushes accepted work.
- An explicit prohibition still wins: with the same guard, a user text
  "leave everything uncommitted" or a repository instruction forbidding
  pushes selects working-tree or commit-only respectively, recorded with
  that concrete cited basis and the warning that accepted work stays
  uncommitted or unpushed.

## Work's default and role boundaries are not restricted-policy bases

A new autonomous run's coordinator records working-tree policy, citing
Work's uncommitted default, the worker children's no-commit rule, or its own
coordinator role as the basis. No user or repository prohibition exists.

Expected behavior:

- None of these is a basis for a restricted policy: Work's default belongs
  to a different workflow, the children's no-commit rule is a role boundary
  (the coordinator owns every commit and push), and the coordinator role
  imposes no restriction either. Without a concrete cited prohibition the
  new-run default — commit and push — stands.
- The coordinator corrects the policy record to commit-and-push with the
  invocation as its authorization basis before dispatching, and states the
  policy and basis visibly.

## Clean review never completes an unpersisted task under commit-and-push

A commit-and-push run's webhook task passes its slice review cleanly. The
coordinator reports the task completed and the run successful while all
accepted changes remain uncommitted and unpushed, citing the repository's
conditional "do not commit unless explicitly asked" guard as the reason.

Expected behavior:

- Never a success under commit-and-push: the conditional guard is satisfied
  by the invocation, not a restriction, and the task persistence gate —
  coherent task commits, confirmed ordinary push, bounded state-only
  finalization — is outstanding. The task stays open, the next task is not
  selected, and the coordinator completes the gate before reporting
  completion.
- The same uncommitted outcome is legitimate only under a recorded
  restricted policy with a concrete cited basis — working tree, or
  commit-only for the unpushed part — reported with the policy's warning
  that accepted work stays uncommitted or unpushed, or as a
  persistence-blocked stop: an unsafe destination or a rejected or uncertain
  push records the exact persistence state and reason, reports the
  persistence as deferred — never completed — and stops local-only with the
  continuation prompt.

## Explicit policy upgrade reconciles outstanding persistence first

An active working-tree run — the user originally asked to leave changes
uncommitted — has T1 fully finalized under that policy: its review gates
closed, its persistence gate satisfied with recorded diff evidence, the
completion record written in the backlog, and its accepted changes still in
the working tree. A significant backlog reconciliation's targeted edits have
also landed in the state files, uncommitted, with their diff evidence
recorded. The user now invokes `/autonomous Commit and push each completed
task, including the tasks already finished in this run`.

Expected behavior:

- The policy change is explicit user authorization: record commit-and-push
  with the user request as its basis, and state the new policy and basis
  visibly. The request explicitly covers the run's existing accepted work;
  no retroactive permission is inferred beyond it. A resume or steering
  text without that explicit request would keep working tree.
- T1's gate was satisfied under the working-tree policy, but that never
  satisfies the new policy: re-evaluate T1 against commit-and-push and
  reopen its persistence only. Its closed reviews and verdicts, consumed
  counters, recorded `NEXT`, and historical evidence stay unchanged — no
  re-review, no rework, no new slice, no budget charge; the coordinator
  reconciles it itself, dispatching no child.
- Before any further dispatch, in the fixed finite order: T1 goes through
  the task persistence gate under the new policy — coherent task commits
  from its accepted working-tree changes, a confirmed ordinary push to the
  resolved destination, and exactly one bounded state-only finalization
  that updates the existing completion record (backlog result line and
  snapshot) with the confirmed hashes and destination. That finalization
  commits the changed durable state not yet committed, carrying the
  reconciliation's landed edits. The significant reconciliation's checkpoint
  then creates no second commit — its state is already carried by T1's
  finalization and is confirmed read-only. In a variant with no task
  finalization carrying it, the reconciliation receives exactly one
  state-only checkpoint commit, pushed and confirmed.
- The ordinary destination, scope, and failure rules apply unchanged: an
  unsafe or ambiguous destination stops and asks, and a rejected or
  uncertain push records the exact persistence state and stops local-only,
  deferring the remaining reconciliation to a reconciling resume.
- Reconcile the actual local and remote state first: commits already
  confirmed on the remote are never duplicated or re-committed, identities
  and consumed counters are unchanged, and only then does the recorded
  `NEXT` action continue.

## Policy upgrade from commit-only pushes finalized tasks as-is

An active commit-only run — the user originally asked to commit but not
push — has T1 fully finalized under that policy: coherent product commits
and the state-only finalization commit exist locally, unpushed, and the
completion record carries the product hashes and no destination. A
significant reconciliation's state-only checkpoint commit and an open T2's
WIP checkpoint commit also exist locally, unpushed. The user now invokes
`/autonomous Switch to commit and push — push the completed tasks and the
run's existing commits`.

Expected behavior:

- Record commit-and-push with the user request as its basis, stated
  visibly. T1's former-policy gate satisfaction does not exempt it:
  re-evaluated against the new policy, its product commits exist but its
  push is outstanding, so its persistence is reopened — reviews, counters,
  `NEXT`, and historical evidence unchanged, no re-review or rework, no
  budget charge, and no child dispatched.
- In the fixed finite order, T1's gate reuses the existing product commits
  — verified for attribution and coherence, never re-committed — pushes
  them as-is with ordinary Git semantics to the resolved destination, and
  confirms success. Its bounded state-only finalization updates the
  existing completion record with the confirmed destination, creates
  exactly one state-only commit of that record delta, and pushes and
  confirms it; the former finalization commit is never rewritten or
  duplicated, and no finalization hash is written back into the state it
  commits.
- The reconciliation's existing checkpoint commit is reused, never
  re-created: pushed as-is if still unpushed, or confirmed read-only when a
  finalization push already carried it to the remote — never a second
  checkpoint commit for the same state. Any remaining unpushed run commits
  — T2's WIP checkpoint — are pushed as-is in dependency order and
  confirmed; T2 stays open, its review and persistence gates unchanged.
- The ordinary destination, scope, and failure rules apply unchanged: an
  unsafe or ambiguous destination stops and asks; a rejected or uncertain
  push records the exact state and stops local-only, deferring the
  remaining reconciliation to a reconciling resume. Commits already
  confirmed on the remote are never duplicated, identities and consumed
  counters are unchanged, and only then does the recorded `NEXT` continue.

## Unsafe or ambiguous push destination stops before pushing

A commit-and-push run reaches its first task gate while the checked-out
branch is `main`; in variants, the branch has no configured upstream, two
remotes make the target ambiguous, or repository instructions protect the
destination branch.

Expected behavior:

- Resolve the destination from the branch's configured upstream and any
  repository instruction before pushing; re-check it at every push.
- Stop and ask the user before pushing in each variant; the task stays open
  with its commits and exact persistence state preserved, and the stop
  carries the continuation prompt.
- Never create a branch, change remotes, force-push, merge, or open a pull
  request to make the push succeed, and never redirect the push to a
  different destination on the run's own initiative.
- The stop goes directly to the terminal local-only close: no further
  commits or pushes follow it in this run, and all further persistence waits
  for a reconciling resume.

## Failed or uncertain push preserves exact state

The task's commits exist locally. The push is rejected non-fast-forward
because the remote advanced; in variants it fails with a network error or
returns an uncertain result.

Expected behavior:

- Record the exact persistence state — accepted task, commit hashes,
  destination, and the push evidence or error — in the snapshot and backlog.
  Keep the task open: it is not recorded as completed, and the next task is
  not selected.
- Stop with the continuation prompt. No force-push, no automatic merge or
  rebase, no blind retry; a non-fast-forward rejection is resolved by
  preserving state and asking, not by rewriting history.
- The stop goes directly to the terminal local-only close: no further
  commits or pushes follow it in this run — no WIP checkpoint or
  finalization push that would carry the uncertain commit as a descendant —
  and all further persistence is deferred to the reconciling resume.
- The user resumes with plain `/autonomous`: the resume inspects the actual
  local history and the remote read-only before any next-task work,
  establishes whether the uncertain push landed, and resumes the exact
  unfinished step — pushing the existing commits as-is when they are not on
  the remote, never re-committing them. While the push is unresolved, no
  descendant commit or push follows it. Once the push is confirmed, the
  terminal stop's deferred failure records are resolved to the confirmed
  hashes and destination and ride in exactly one bounded state-only commit;
  a clean interruption that wrote no failure records needs no such commit.
  The task stays incomplete and uncounted, and no next task is selected,
  until the whole gate is confirmed satisfied.

## Interruption between commit, push, and completion reconciles

The session dies after the task commits were created but before the push;
in variants, the push succeeded but the state finalization never ran; the
finalization commit was created but never pushed; or the finalization push
succeeded but the local acknowledgment never happened. The user resumes
with plain `/autonomous`.

Expected behavior:

- Re-read the durable persistence state, then inspect the actual local
  history and the remote (read-only fetch or ls-remote) to establish which
  steps already happened before any next-task work.
- Committed-but-unpushed: resume the push of the existing commits — never
  re-commit or duplicate them. Pushed-but-unfinalized: verify the product
  push, complete the completion-record writes from the confirmed hashes and
  destination, then run the finalize event's one state-only commit and push.
  Finalization-committed-but-unpushed: push that existing commit as-is,
  never a second finalization commit for the same task.
- Finalization-pushed-but-unacknowledged: confirm the finalization commit's
  remote ancestry or content; the gate is satisfied without any further
  write — the acknowledgment is read-only — and the next task is selected
  without replaying work or adding commits.
- A commit already on the remote is never duplicated, and the task is marked
  completed only once the whole gate is confirmed satisfied. Identities and
  counters are unchanged by the reconciliation.
- The reconciliation is replay-safe and the accounting increments once: the
  completed-task count rises by exactly one when the task's gate is first
  confirmed, and a later resume that re-confirms the same finalization adds
  no second count, no second completion record, and no duplicate commit.

## Task commits preserve unrelated work and secrets

At the task gate, the working tree also holds unrelated staged and unstaged
edits, an untracked scratch file, and a locally modified credentials file;
one source file mixes task edits with an unrelated human edit.

Expected behavior:

- Stage and commit only the task's accepted changes; the unrelated staged,
  unstaged, and untracked work and the credentials file are preserved and
  never swept into a task commit or a push.
- Overlapping edits that cannot be attributed to the task safely stop and
  ask before committing them.
- Before pushing, inspect the outgoing commits against the reviewed scope;
  work outside it resolves the publication scope first (ask), never pushes
  silently.

## Investigation-only task creates no artificial product commit

A commit-and-push run's task is investigation-only: its explore rounds
produce findings and a recommendation, with no product changes. In a
variant, the findings were already fully recorded and nothing in the durable
state changes.

Expected behavior:

- No artificial product commit is manufactured to satisfy the gate. The
  findings are persisted in the durable state, and changed durable state is
  not "nothing to persist": the same bounded state-only finalization commits
  it and, under commit-and-push, pushes and confirms it, so the default
  policy persists investigation findings exactly like any other state
  change.
- Only when truly nothing changed is there nothing to commit or push; the
  gate is then satisfied by the recorded findings. Durable-state updates
  follow the recorded policy like any other state write; they are never
  product commits.

## Consolidated final close carries the last task, run close, and cleanup

A commit-and-push run's last remaining task has just closed its persistence
gate and the goal is met. In variants, the session dies after the close
records are written but before the completion commit; after the completion
commit but before its push; after the push is confirmed but before the
cleanup; the run instead stops incomplete; or the run uses working-tree or
commit-only policy.

Expected behavior:

- The same finalization that records the last task's completion also carries
  the run-close record — one bounded state-only completion commit, not a
  separate task finalization followed by a session-close commit. The snapshot
  is not deleted in this commit: it stays, updated with the confirmed product
  persistence and one `NEXT` naming the close's exact unfinished step, as the
  recovery checkpoint until the completion commit's push is confirmed. The
  printed report mirrors the saved records and points at the commit hash read
  from git history; the hash is never written into the files the commit
  contains.
- The cleanup runs only after that confirmation, and only for a completed
  run: fold the snapshot's remaining content into the backlog's result
  records, read them back, then remove the snapshot; the fold and deletion
  ride in one bounded state-only cleanup commit, pushed and confirmed. A
  successful close is exactly two state-only commits — completion, then
  cleanup — each confirmed before the next step begins. The deleted snapshot
  stays recoverable from git history. Never delete it while any task is
  unfinished or any required persistence is unconfirmed.
- The interruption variants reconcile the exact unfinished step: before the
  completion commit, create it once from the saved records; committed but
  unpushed, push it as-is — never a second completion commit; push confirmed
  with cleanup outstanding, run the cleanup without rewriting the completion
  records. A clean interruption writes no failure records and needs no
  resolution commit: a confirmed finalization with no outstanding record
  writes satisfies the boundary without any further write.
- An incomplete stop keeps the snapshot as its resume state: the stop close
  persists the stop records without deleting it.
- Under working-tree policy no commit exists: the completion records are
  recorded as diff evidence, and only after that verification fold the
  snapshot content into the backlog results, read them back, and remove the
  snapshot, recording both changes as diff evidence. Under commit-only the
  completion commit and the cleanup commit are created in the same order but
  not pushed. No new state file is created for any of this.

## Blocked final close stops local-only

A commit-and-push run reaches its final close after the last task's gate has
closed, and the run-close records are written locally. In variants, the
resolved destination is unsafe or ambiguous before the completion commit
exists; the completion commit's push is rejected non-fast-forward or returns
an uncertain result; or the completion push is confirmed, the cleanup commit
is created, and its push is rejected or uncertain.

Expected behavior:

- The local records — run-close record, backlog, snapshot — are written
  first and never wait on the push. They carry the exact persistence state:
  the local commit hash when one exists, the destination, and the push
  evidence or error, with the finalization marked deferred and unconfirmed.
  While the completion commit's push is unconfirmed the snapshot is still
  present: the failure records are written there and in the backlog, and no
  cleanup commit is created in this run — it would carry the uncertain
  commit as a descendant.
- The run stops terminally with the continuation prompt: no blind retry, no
  force-push, merge, or rebase, no branch creation, and no automatic
  destination change. The printed report mirrors the saved local records and
  reports the finalization as deferred — never as completed — and no
  completion is recorded before confirmation.
- A resume reconciles the exact unfinished step: re-read the durable state,
  inspect the actual local history and the remote read-only, then push the
  existing completion commit as-is — creating it from the saved records only
  when none exists — and confirm it. After confirmation, the deferred
  failure records are resolved to the confirmed hashes and destination, and
  the resolution rides in the one cleanup commit with the fold and the
  snapshot deletion, pushed and confirmed. No second completion commit, no
  repeated cleanup, no self-hash write; identities and counters are
  unchanged by the reconciliation.
- Cleanup-push variant: the snapshot is already legitimately gone after the
  verified completion persistence. The terminal failure records go to the
  backlog alone — the snapshot is never recreated — and no further commit or
  push follows in this run. The resume pushes the existing cleanup commit
  as-is; once confirmed, the deferred records are resolved to the confirmed
  destination and ride in exactly one bounded state-only resolution commit,
  pushed and confirmed. The deleted snapshot stays recoverable from git
  history throughout.
- The same local-only close applies when the run arrives at close with
  persistence already blocked at an earlier boundary — a rejected, failed,
  or uncertain task, WIP, or reconciliation checkpoint push, or a blocked
  destination: the close creates no WIP or finalization commit and attempts
  no push, and all further persistence is deferred to the reconciling resume.

## Stop-boundary WIP checkpoint preserves review-open work

A commit-and-push run stops — steering pause, exhausted run ceiling, or no
safe ready work — while T2's current slice is implemented and verified but
its review is still open, and the tree also holds attributable unfinished
changes named by T1's deferred packet.

Expected behavior:

- Before the stop records and finalization, the coordinator stages only the
  unfinished product changes attributable to the run's tasks and creates one
  WIP checkpoint commit per changed repository, identified with a `WIP:`
  prefix naming the run and task IDs (for example `WIP: csv-export T2 —
  slice 2, review open`). It pushes with ordinary Git semantics to the
  resolved upstream and verifies success.
- The stop records carry, per task, the WIP commit hashes, the pre-WIP review
  base, the verification and review status (what passed, what is still open),
  the confirmed push destination, and exactly one resumable `NEXT`. This
  compact per-task evidence lives on the backlog task entries and, as recovery
  needs it, in the snapshot. Consumed counters are not part of that per-task
  record: the active task's and the run's consumption stay once in the
  snapshot's budget line, and T1's deferred packet keeps its own counters —
  the backlog never mirrors the active/run counters. The bounded state-only
  finalization then commits and pushes those records. No checkpoint hash is
  written into the files its own commit contains.
- T2 stays open and review-open: nothing is recorded as completed, no review
  or persistence gate is bypassed, and the resume continues the recorded
  `NEXT` with the ordinary gates still required.
- The checkpoint dispatches no child and consumes no worker, review, or
  consult budget; it never launches work beyond the caps that produced the
  stop. With no attributable unfinished product changes, no WIP commit is
  created.

## WIP checkpoints respect restricted and legacy policies

The same stop happens in a commit-only run, in a working-tree run, and in a
legacy handoff with no recorded policy.

Expected behavior:

- Commit-only: the WIP checkpoint commits and the stop-close state commit
  are created, but nothing is pushed.
- Working-tree and legacy: no checkpoint or state commit is created; the
  unfinished changes stay in the working tree, identified by `git status`
  and `git diff` evidence in the records. A legacy handoff resumes as
  working tree and gains no commit or push rights from the checkpoint rules.
- No variant marks a task completed or bypasses a restriction to satisfy the
  default policy.

## Multi-round stop and plain resume keep one budget and no journal

A commit-and-push run `csv-export` (ceiling 240) has settled seven worker
rounds across two tasks: T1 was deferred after five rounds, and T2 is active
with two rounds consumed under its allowance of 12. The run then stops at a
safe checkpoint — a steering `pause` or no safe ready work; 7/240 leaves run
budget, so an exhausted ceiling is not a stop cause at this consumption —
with T2's current slice implemented and verified but review-open, and
attributable unfinished changes in the tree. In a variant the run instead
carries an explicit ceiling of 7, so the same seven consumed rounds exhaust
it exactly (7/7) and the stop is the ceiling stop. The user later resumes with
plain `/autonomous`; in the pause variant the human first sets
`mode: continue` (or removes the pause) in the steering surface.

Expected behavior:

- The stop writes compact per-task evidence, not a round journal: the backlog
  T2 entry carries the WIP commit hashes, the pre-WIP review base, the
  verification/review status, the push state, and one resumable `NEXT`; the
  snapshot keeps the current state and what recovery needs. Settled round
  outcomes fold into the backlog tasks' bounded result/progress notes — no
  one-line-per-round ledger accumulates in either file, and no stop or close
  step requires a full ledger. Host logs and git history are optional
  diagnostics, not a default archive.
- Consumption lives exactly once: the snapshot budget line reads run
  `csv-export` 7/240 and active T2 2/12 (allowance in force), plus the open
  target's fix/review counters. T1's deferred packet carries its own 5/12.
  The backlog's active T2 entry and the run header never mirror the consumed
  counters, and no second tally or per-round budget copy is written.
- The plain resume runs the reconcile event, validates the intact snapshot,
  and continues the recorded `NEXT` with consumption unchanged — run stays
  7/240 and T2 stays 2/12, T1's packet stays 5/12. It adds no duplicate budget
  line, journal, or counter mirror, re-derives nothing from a ledger, and
  resets nothing; the ordinary review and persistence gates still apply.
- Pause variant: continuation requires the human's own pause release first.
  A fresh activation with a still-present `pause` stops again without
  dispatching; only after the human sets `mode: continue` or removes the
  pause does the plain resume continue the recorded `NEXT`. The release
  changes no identity or counter.
- Exact-ceiling variant (7/7): the plain resume is budget-exhausted and stops
  under the allowance-stop rules with the continuation prompt — consumption
  stays 7, and further worker rounds need the ceiling changed by one of the
  two supported user actions: an explicit numeric resume override above 7,
  or a named user grant adding its named rounds to the ceiling. Both carry
  consumption over unchanged — no counter reset and no implicit grant — and
  a numeric override at or below 7 leaves the run exhausted. The resume
  never refreshes the exhausted ceiling on its own.
- A variant stops under working-tree policy: no WIP or state commit is
  created, the same compact layout and single budget hold, and the diff
  evidence identifies the unfinished changes. The layout and unchanged
  consumption are identical across policies.

## Significant reconciliation checkpoints state before further dispatch

An active commit-and-push run receives `/autonomous Also add PDF export`;
the reconciliation adds T4 and T5 and rewrites T3's acceptance. In a variant,
the only writes between two rounds are a counter charge and a settled result
note.

Expected behavior:

- The reconciliation is significant — it adds task entries and rewrites open
  acceptance — so after its targeted edits land, the coordinator creates
  exactly one state-only checkpoint commit of the changed durable state and
  pushes and confirms it to the resolved destination before dispatching any
  further round. The checkpoint's own hash is never written back into the
  state it commits.
- The routine-writes variant creates no checkpoint commit: counter charges,
  settled results, dispatch records, and persistence-state records are
  routine progress writes, not reconciliations, and per-write commits are not
  the contract.
- Under commit-only the checkpoint commit is created but not pushed; under
  working-tree policy no commit is created and the diff evidence identifies
  the reconciled state. The checkpoint dispatches no child and consumes no
  budget; identities and consumed counters are unchanged.

## Significant reorder checkpoints; routine writes and priority hints do not

An active commit-and-push run receives `/autonomous Do the migration tests
before the CSV polish, and the docs task last`; the reconciliation reorders
the upcoming backlog tasks. In one variant the only writes between two
rounds are a counter charge and a settled result note; in another the human
sets `priority: T3, T2` in the steering surface while the backlog's task
order is untouched.

Expected behavior:

- The reorder changes the durable plan rather than recording progress — a
  significant reconciliation even though no task's acceptance text changes.
  After its targeted edits land, the coordinator creates exactly one
  state-only checkpoint commit, pushes and confirms it to the resolved
  destination before dispatching any further round, and never writes the
  checkpoint's own hash back into the state it commits.
- The reorder applies at the next selection boundary under the normal
  readiness rules; the active slice and any running round are never
  interrupted, and no allowance, gate, or counter changes.
- The routine-writes variant creates no checkpoint commit: routine progress
  writes are not reconciliations, and per-write commits are not the contract.
- The bare `priority` hint reorders only the next selection among ready
  tasks: it rewrites no backlog entry, creates no durable plan change, and
  needs no checkpoint commit. It is a selection control, not a plan
  reconciliation.

## Rejected reconciliation checkpoint push stops before dispatch

The reconciliation's state-only checkpoint commit exists locally, but its
push is rejected non-fast-forward; in variants the push fails with a network
error, returns an uncertain result, or never runs because the destination is
unsafe or ambiguous.

Expected behavior:

- No further round is dispatched. Record the exact persistence state — the
  reconciliation, the local commit hash, the destination, and the push
  evidence or error — keep every task open, and stop with the continuation
  prompt. No blind retry, force-push, merge, rebase, or destination change.
- The stop goes directly to the terminal local-only close: the close creates
  no WIP checkpoint or finalization commit and attempts no push — a
  descendant of the blocked checkpoint would implicitly retry it. The local
  records carry the exact persistence state and, for any attributable
  unfinished product changes, the diff evidence; all further persistence is
  deferred, and the backlog's one next action is the deferred checkpoint
  push.
- A resume inspects the actual local history and the remote read-only, then
  resumes the exact unfinished step — pushing the existing checkpoint commit
  as-is, or recording an already-succeeded push — before any dispatch. The
  checkpoint is never duplicated, and identities and consumed counters are
  unchanged.

## Uncertain reconciliation checkpoint push closes local-only

An active commit-and-push run with review-open product changes in the tree
receives a steering invocation that adds a task. The reconciliation's
state-only checkpoint commit is created, and its push returns an uncertain
result. The run must now stop and close the session.

Expected behavior:

- The uncertain push blocks the run before any further dispatch: the exact
  persistence state — the reconciliation, the local checkpoint hash, the
  destination, and the push evidence — is recorded, every task stays open,
  and the stop goes directly to the terminal local-only close.
- The close creates no new commits and attempts no pushes: no WIP checkpoint
  commit for the review-open changes and no stop-close finalization commit.
  Pushing either would carry the uncertain checkpoint as a descendant — an
  implicit retry of the blocked push. The unfinished changes stay in the
  working tree, identified by `git status` and `git diff` evidence in the
  local records, which mark all further persistence deferred and unconfirmed.
- The final report is printed from the saved local records with the exact
  evidence and one next action — reconcile and complete the deferred
  persistence — and reports nothing as completed or finalized. No further
  round or retry follows in this run.
- A resume reconciles the actual local history and the remote read-only
  before any next work: it confirms whether the checkpoint push actually
  succeeded, pushes the existing checkpoint commit as-is when it did not —
  never duplicating it — then completes the deferred WIP checkpoint once
  from the attributable changes the records name and the deferred stop-close
  finalization from the saved records. Identities and consumed counters are
  unchanged; only then does the recorded work continue.

## Task gate completes work already in WIP commits

After the WIP stop above, a resume finishes T2: the remaining slice passes
its review and deep gates. Part of T2's accepted changes already sits in the
recorded WIP checkpoint commits.

Expected behavior:

- The coordinator's own reviews of T2 use a range whose lower bound is the
  recorded pre-WIP base or earlier, so the WIP commits are inside the diff;
  the reviewer inspects them as part of the task's changes and treats their
  WIP identification as unfinished status, not completion.
- At the task gate the coordinator verifies the recorded WIP commits'
  attribution and coherence, never re-commits or duplicates their changes,
  and commits only the remaining accepted working-tree delta as coherent
  task commits. The push includes the WIP commits, and the completion record
  references all product hashes — WIP and new — with the confirmed
  destination.
- The ordinary gate sequence is unchanged: reviews first, then the coherent
  commits, confirmed push, and one bounded state-only finalization before
  the next task is selected.

## Review range keeps historical WIP across a resume

A commit-and-push run stops with T2's verified slice review-open. The commit
immediately before the checkpoint is B0; the coordinator creates the WIP
checkpoint commit W1 on top of it, pushes it, and records B0 as T2's pre-WIP
review base alongside the WIP hash. A fresh session resumes T2, a fix round
adds more changes to the working tree, and the slice review — and later a
deep review — is dispatched.

Expected behavior:

- At the checkpoint, the durable record carries the pre-WIP review base B0
  per repository — the commit immediately before the task's first WIP
  checkpoint commit — with the WIP hashes and push state; a deferred packet
  carries the same boundary.
- The coordinator's own reviews of T2 after the resume (the slice review
  and the later deep review) use a range whose lower bound is B0 or earlier,
  so W1 and the new working-tree delta are both inside the diff.
  The resumed session's start boundary never replaces B0: a deep review
  scoped "since the session start" would exclude the historical WIP, so the
  recorded base is preserved and reused across resumes instead.
- Work accepted before B0 is not re-reviewed. The reviewer treats W1's WIP
  identification as unfinished status, never as completion or a satisfied
  gate: the full WIP-plus-working-tree result is reviewed without
  re-reviewing unrelated accepted work.

## An explicit request starting after the WIP base is widened to the base

Autonomous. The same open checkpointed task T2: recorded pre-WIP review base
B0, WIP checkpoint commit W1 on top of it, and later working-tree deltas.
After the applicable gate passes cleanly, the user explicitly asks for a
deep review of a range whose named start comes after B0 — for example
`W1..HEAD`.

Expected behavior:

- The explicit request authorizes one bounded audit; the recorded pre-WIP
  base B0 is a floor on the lower bound, so the effective lower bound is B0
  and the WIP commits stay inside the diff — a named start after the base is
  widened, never truncated.
- The audit brief names the requested range and the effective range
  separately and states why the range was widened; the user's named end
  stands as the audit's upper end, and the named range sets the audit's
  focus — never narrowing silently to the named start or widening silently
  past the named end.

## An explicit request ending at a recorded commit excludes the working-tree tail

Autonomous. The same open checkpointed task T2: recorded pre-WIP review base
B0, WIP checkpoint commit W1, and later working-tree deltas added since W1.
After the slice's applicable gate passes cleanly, the user explicitly asks
for a deep review of `B0..W1` — a range whose named start is at the recorded
base and whose named end is a recorded commit before the current
working-tree state.

Expected behavior:

- The named range stands exactly: the named start at the base is not
  widened, and the named end W1 is the audit's upper end — the later
  working-tree deltas are not added to this audit, and no default
  range is substituted for the named one.
- The full-WIP-plus-working-tree rule still governs the checkpoint's own
  reviews: the coordinator-initiated slice review, re-review, and deep
  reviews of T2 continue to use a range whose lower bound is B0 or earlier
  so that W1 and every later working-tree delta are inside the diff; only
  the user-named audit is bounded by the named range.

## WIP push scope distinguishes authorized checkpoints from unrelated commits

At a stop, the outgoing range to the resolved upstream contains the run's
recorded WIP checkpoint commits and, in a variant, an unrelated commit made
outside the run. The working tree also holds an unrelated human edit and a
locally modified credentials file.

Expected behavior:

- The recorded WIP checkpoint commits are authorized outgoing scope even
  though their task's review is open; the unrelated commit is not. The
  variant stops and asks to resolve the publication scope before pushing —
  never pushes silently, never rewrites or drops the unrelated commit.
- The WIP commit stages only attributable unfinished product changes: the
  unrelated human edit and the credentials file are preserved and never
  swept in. Overlapping edits that cannot be attributed to a task safely
  stop and ask, leaving the changes in the tree.
- An unsafe or ambiguous destination stops and asks before any checkpoint
  push, exactly like a task push; no branch creation, remote change, or
  force-push makes it succeed. Like every persistence-blocked stop, it goes
  directly to the terminal local-only close: no further commits or pushes
  follow it in this run, and all further persistence waits for a reconciling
  resume.

## Interrupted WIP checkpoint reconciles without duplication

The session dies after the WIP checkpoint commits were created but before
their push; in variants, the WIP push succeeded but the stop records were
never written; the records were written and the state finalization commit
created but never pushed; or the attributable changes were never committed
at all.

Expected behavior:

- The resume re-reads the durable state and inspects the actual local history
  and the remote read-only before any continuation work. Committed-but-
  unpushed WIP or finalization commits are pushed as-is — never re-committed
  or duplicated. Pushed-but-unrecorded: complete the record writes from the
  confirmed hashes and destination, then run the one bounded state-only
  finalization.
- When the attributable changes were never committed, the resume creates the
  WIP checkpoint once from the changes the durable state names; a checkpoint
  already recorded and pushed is never repeated.
- Identities and consumed counters are unchanged by the reconciliation, and
  no task is marked completed by a checkpoint. A coordinator interrupted or
  quota-exhausted before checkpointing promises no persistence; recovery
  reconciles whatever durable state and Git evidence exist.

## Interrupted review recovery keeps role-specific accounting

A review child is interrupted mid-verdict by a turn ceiling; the host
evidence is not quota. The worker budgets show run 4/6 and T1 4/12.

Expected behavior:

- Record the interruption in the snapshot and start a fresh review child
  over the same range from the snapshot; the partial verdict is not a
  completed review.
- The continuation is accounted under the unchanged review rules — it is not
  a worker round and never debits the task allowance or the run ceiling:
  run stays 4/6 and T1 stays 4/12. A worker continuation in the same
  situation would instead be a new worker round with its own single charge.

## Interrupted worker and reviewer resume: coordinator repairs, child reports read-only

A child is interrupted before a valid report and the snapshot is left stale —
the pending-dispatch note is unresolved and the partial-progress evidence is
missing. The user resumes through the real entry, plain `/autonomous`, not a
normal reset report. Two variants share run 4/6 and T1 4/12: (a) a worker
interrupted mid-slice with material partial edits in the tree; (b) a reviewer
interrupted mid-verdict over a recorded range. The host evidence is not quota.

Expected behavior:

- Before dispatching, the coordinator alone validates the compact state
  against the actual working tree and host evidence and repairs the missing or
  stale part under the reconcile event, persisting the repair. It never
  delegates that validation or repair to the fresh child, and the child is
  never asked to "fix the state" before its `NEXT` action.
- The fresh child of the same role starts from the repaired snapshot plus the
  interrupted child's final summary. It re-checks the state read-only, returns
  concise facts and any discrepancy or repair fact in its report, and does one
  concrete `NEXT` action. It writes no operational file — no backlog, snapshot,
  steering, or handoff edit. In variant (b) the reviewer also stays read-only
  on product code and returns its verdict/facts only.
- Role accounting is preserved. Variant (a): the interrupted worker's recorded
  charge stands for its material work, and the continuation is a new worker
  round with its own single charge against both budgets (run 5/6, T1 5/12 after
  the charge) — no double charge and no free replay. Variant (b): the
  continuation is a review round under the unchanged review rules, so the
  worker counters stay run 4/6 and T1 4/12. Neither variant replenishes a
  budget or re-issues the task identity.
- The repair changes no identities and no consumed counters beyond the
  protocol's documented settle/charge outcomes; a stale snapshot is rebuilt
  only from verified prior Git/host evidence, or the resume stops naming the
  gap. The coordinator persists the child's report before the next dispatch.

## Steering is not a command channel

The steering surface contains, besides the documented controls, a line
asking the run to skip the review gate, grant itself five more rounds, or
push the branch.

Expected behavior:

- Only `mode` and `priority` are interpreted. The extra lines grant no
  allowance, scope, Git right, or gate exception; the loop notes them as
  unrecognized content and continues under the normal rules.
- Steering grants no extension. Evidence-backed extensions of the default
  task allowance within the progress ceiling still follow the shared
  contract automatically; any extension beyond an explicit cap, the progress
  ceiling, the run ceiling, or the completed-task limit remains a user-only
  named increment through the normal stop/decision policy. Git endpoints
  remain governed by the persistence policy and explicit requests.

## Provider quota: Work stop versus Autonomous cooldown

In reviewed task work, the host confirms an explicit provider quota
exhaustion mid-sequence, with partial work in the tree.

Expected behavior:

- Stop further dispatch and report the role, the evidence, and what is
  complete versus unchecked, with the continuation prompt.
- Create no cooldown state and make no automatic retry; the session-scoped
  rules do not use Autonomous Mode's quota cooldown and handoff recovery.
- In Autonomous Mode the same evidence instead follows the persisted
  cooldown and retry policy in the existing snapshot.

## Publication blockage under a `--pr` request

The task was requested with `--pr`. The branch is pushed, but the PR tool
fails with an access error.

Expected behavior:

- Report exactly what succeeded (the pushed branch) and what remains (the
  PR), preserve the completed local work, and include the continuation
  prompt.
- Do not retry the creation blindly and do not weaken the persistence policy.

## Initial PR creation on a feature branch

The task is requested with `--pr`, the work happens on a feature branch that
has no open pull request, and the lookup confirms that none exists.

Expected behavior:

- Resolve the repository, intended base, remote, and branch identity before
  implementation, and briefly announce that delivery will create a pull
  request, identifying the resolved destination.
- Check for a matching open PR, create exactly one pull request after
  confirming its absence, and state the actual delivery result and PR URL in
  the final report.

## Repeated `--pr` refinements update the same PR

A first `--pr` task created the pull request for the task branch. The user
refines the work with `/work --pr Tweak the CSV column widths`.

Expected behavior:

- Reuse the task branch's matching open pull request: the refinement commits
  and pushes to the same branch and the report updates the same pull request.
- Do not create a nested branch or a duplicate pull request merely because
  `--pr` was repeated.

## Fresh `/work` after a successful PR task

A `--pr` task finished and its pull request was published. Later, the user
invokes `/work` without `--pr` and mentions the earlier pull request or asks
to address its feedback.

Expected behavior:

- Deliver on the current branch with changes uncommitted by default: a fresh
  invocation without publishing intent does not inherit the previous task's
  pull request endpoint.
- The mention of the earlier pull request, or the request to address its
  feedback alone, does not select the PR delivery endpoint.

## Exact-URL targeting from another chat

From another chat or checkout, the user invokes
`/work --pr=<PR-URL> Fix the last review comment`.

Expected behavior:

- Resolve the destination before implementation from the repository, head
  branch, and head remote identity, including fork pull requests; use the
  appropriate checkout without discarding existing work.
- Committing and pushing to that pull request's head branch is authorized for
  the requested changes; the final report states the delivery result and PR
  URL.
- Never select a pull request by title or conversation memory alone, and a
  bare `--pr` never consumes task text as a target: `/work --pr fix the bug`
  is PR delivery for the task "fix the bug".

## Ambiguous destinations and unusable PR targets

A `--pr` destination cannot be resolved safely; an explicit `--pr=<PR-URL>`
target is closed, merged, or inaccessible; or the lookup for a matching open
pull request fails.

Expected behavior:

- Ask only when a material ambiguity or conflict cannot be resolved safely;
  do not guess the destination.
- A closed, merged, inaccessible, or ambiguous explicit target never falls
  back to creating a different pull request: preserve the completed work and
  report what is needed to continue, with the continuation prompt carrying the
  exact delivery target.
- Distinguish a confirmed absence of a matching open PR — safe to create one
  under a bare `--pr` — from a failed lookup, which is not.

## Unrelated local edits under a `--pr` request

The working tree contains unrelated staged and unstaged changes, and the task
branch history differs from the intended base beyond the task's own commits.

Expected behavior:

- Stage and commit only the task's changes; preserve unrelated staged and
  unstaged work.
- Before pushing, inspect the full branch diff and outgoing commits against
  the intended base; additional edits must be verified and reviewed as
  appropriate.
- When overlapping edits cannot be attributed to the task safely, ask before
  committing them.

## Coherent local edits with unrelated outgoing commits

The working tree holds a coherent set of local edits that the task reviewed,
but the branch's outgoing commits also include unrelated work that was never
reviewed.

Expected behavior:

- A review of the local edits alone does not authorize the unrelated existing
  commits.
- Before pushing, inspect the full branch diff and outgoing commits against
  the intended base and resolve the publication scope: commit only the
  reviewed task changes, or ask before publishing the unrelated commits.
- Record enough content evidence to identify what was reviewed, including
  untracked content where relevant; if content changed since the review,
  reconcile it and establish the necessary verification and review coverage
  rather than claiming the current result is reviewed from an earlier
  version.

## No-change tasks and interrupted publication

Two situations: a `--pr` task needs no code changes, and publication is
interrupted after some steps have already succeeded.

Expected behavior:

- No-change task: explain the finding instead of manufacturing an empty pull
  request.
- Interrupted publication: report exactly what succeeded and what remains,
  preserve the completed local work, and include the continuation prompt with
  the exact delivery target.

## Option parsing alongside `--pr`

The invocation combines a leading `--profile` (or `--profile=NAME`), a
`--stats`, the `--` option delimiter, or any ordering of them with `--pr` or
`--pr=<PR-URL>`.

Expected behavior:

- The options are combinable in any order; option parsing stops at the first
  non-option token, and the remaining text is the task.
- Existing task-text parsing is unchanged: a bare `--pr` never consumes task
  text as a PR target, and `--` remains the explicit option delimiter.

## `--consult` option parsing and mandatory initial consultation

The invocation is `/work --consult Redesign the onboarding flow`, optionally
combined with `--pr`, `--stats`, and `--profile NAME` in any order.

Expected behavior:

- The options are combinable in any order; option parsing stops at the first
  non-option token, and the remaining text is the task. `--consult` is a bare
  leading option — it never takes a value, so `/work --consult fix the bug`
  consults, then implements "fix the bug".
- The initial task-framing consultation is mandatory before any implementation
  round: the coordinator first runs the requested-outcome inspection to give
  the consultant real context, then dispatches the consult round in task-framing
  mode (challenges the framing; returns a recommendation on what to build,
  proposed scope and acceptance criteria, an approach, and consequential
  unresolved choices).
- The coordinator incorporates the recommendation, asks the user only about the
  choices that need their input, and continues normally — no automatic approval
  checkpoint.
- `--consult` consumes the single consultation allowance per task, so the same
  activation cannot also dispatch a later stuck-decision consult without a
  grant.

## Hard fix with a configured-policy mismatch

A blocking finding requires ownership-sensitive state-machine reasoning, so
the fix is dispatched on the configured `implement-hard` route — directly,
without a consultation first. The binding's profile for that route carries
the implementation contract body, and the installation's `fix` assignment is
a routine model.

Expected behavior:

- Dispatch on the `implement-hard` route with the bounded fix contract
  carried explicitly in the task packet (or an equivalently scoped
  implementation contract where the binding's profile body differs).
- Count the round against the fix allowance, not as new implementation
  scope, and record task role `fix`, routing key `implement-hard`, and the
  reason.
- Do not silently substitute the routine `fix` route or any stronger or
  weaker route than the configured policy resolves; if the binding cannot
  honour a requested route, surface the mismatch.

## Routing policy: mechanical work on the configured easy route

In either workflow, the installation configures `implement-easy`, and the
slice is explicitly prescribed, bounded, and mechanically verifiable: correct
one named spelling error in one named file, with a deterministic acceptance
check (the corrected word appears and nothing else changes). The same
installation is then used for a slice that needs design judgment.

Expected behavior:

- The mechanical slice dispatches on `implement-easy` with the same implement
  task contract; the dispatch record names the easy role and the mechanical
  acceptance check.
- The judgment slice dispatches on `implement` even though it is small:
  the easy route is for explicitly prescribed, mechanically verifiable work
  only, not for anything that looks quick.
- With `implement-easy` unconfigured, the mechanical slice runs on
  `implement` with its existing assignment — the defined omission fallback,
  not an error and not a silent substitution.

## Routing policy: routine default and visible risk dispatching hard directly

In either workflow, a scoped, verifiable slice needs ordinary implementation
judgment; a second slice touches concurrent writers of a shared cache; a
third is a docs/packaging change whose compatibility risk is visible (it
changes a published contract consumers depend on).

Expected behavior:

- The ordinary slice dispatches on `implement`, the default.
- The concurrency slice dispatches on `implement-hard` directly — no
  consultation first — because its correctness risk is visible.
- The docs/packaging slice also dispatches on `implement-hard`: risk is
  assessed per slice, and no category of work is exempt when its actual risk
  is visible. A category label alone ("just docs", "just a rename") never
  qualifies a slice for the hard route either.
- A routine slice that exposes such risk mid-flight is reassessed and, when
  warranted, continued or redone on the hard route; the reassessment is
  recorded with its reason.

## Routing policy: a costly decision consults hard directly, on the ordinary consult allowance

In either workflow, the installation configures `consult-hard`, and one
bounded decision carries conflicting evidence, interacting constraints, or a
costly reversal — apparent from the task framing, without the loop first
getting stuck.

Expected behavior:

- Dispatch the consult on `consult-hard` directly, read-only, carrying the
  same consult contract; it returns one recommendation and implements
  nothing.
- The round consumes the SAME consultation allowance as an ordinary consult:
  in Work, the single per-task allowance (a `--consult` invocation has
  already consumed it, so no further consult without a grant); in Autonomous
  Mode, one per decision and two per session. It grants no worker, fix, or
  review increment.
- With `consult-hard` unconfigured, the same decision runs on `consult`
  under the same allowance — the defined omission fallback.
- A focused decision that is a clear, direct, complex choice warrants a
  consult even when the loop is not stuck; an ordinary reversible choice the
  coordinator can settle from evidence needs no consult.

## Routing policy: unconfigured fallback versus a configured missing profile

Two installations: one simply omits `consult-hard`; the other explicitly
configures it, but the installed profile (or the host's requested selection)
is missing or unreadable at dispatch time.

Expected behavior:

- Unconfigured: the decision runs on `consult` with its existing assignment.
  No error, no limitation report — the fallback is the defined policy.
- Configured but missing: the dispatch of that role is blocked and reported
  with the binding's refresh procedure; the workflow does not silently
  substitute `consult` or inherit the session model in place of the named
  role.
- A requested stronger route or advice the host cannot honour is surfaced as
  a limitation (requested versus effective, where native evidence exists),
  never silently substituted by a weaker one.

## Routing policy: establishing configured intent from install evidence

On OpenCode, two installations present the same available `agenticale/*`
profiles: one omitted `implement-easy` at install time; the other configured
it, and the profile file was later deleted. A third installation copied the
profiles manually and has no installer manifest; a fourth has a manifest
that is unreadable, or a project `.opencode` scope also defines
`agenticale/*` profiles, so ownership is ambiguous. A fifth configured
`implement-easy`, the user modified the profile, and a successful reinstall
then omitted the route: the installer preserved the modified file
(`preserve-modified`) but dropped its manifest entry.

Expected behavior:

- The workflow establishes configured intent from the installer ownership
  manifest (`.autonomous-mode-install.json`) at the effective install root —
  the root that supplies the installed skills and the dispatched profiles —
  read-only, at most once per activation, with the result fixed for the
  activation. The lookup happens whenever a needed optional assignment must
  be established, whether the profile file is missing, unreadable, or
  present; the available-profile catalog alone never decides the case.
- Entry presence means the role is in the latest successful installed
  inventory — not an install history, and not a guarantee that a preserved
  file stays owned.
- Omitted (a valid manifest without the optional entry, including legacy
  schemas that never carried the optional routes): the slice runs on the
  base route with its existing assignment — the defined omission fallback,
  not an error. This includes the fifth installation: the preserved leftover
  file is unowned, is never dispatched, and deleting it keeps the route
  omitted.
- Configured but deleted (the manifest lists the entry, the profile file is
  absent): only that role's dispatch is blocked, reported with the refresh
  procedure; no base-route substitution. A user-modified optional profile
  keeps its entry only while the install still lists the route; a successful
  reinstall that omits the route drops the entry even though it preserves
  the modified file.
- No manifest, an unreadable or invalid manifest, or ambiguous ownership:
  intent is not established. The workflow reports an actionable limitation
  naming the evidence gap and the refresh procedure; it does not dispatch
  the optional route — even when a profile file is present — does not claim
  the omission fallback, and never honours an explicit request for the route
  by silently substituting a weaker one. Unrelated base roles continue on
  their existing assignments.
- The manifest is intent evidence only: no model is resolved from it, and
  the workflow never writes it or any other configuration file. Rerunning
  the installer restores both the profiles and the manifest evidence.

## Routing policy: long-running goals and resumes reassess the slice, not the old route

An Autonomous run accepted an easy-route slice earlier; a fresh resume
continues the goal, and the next slice's evidence now shows shared-state
risk. The installation's assignments may also have changed since the handoff
was written.

Expected behavior:

- The fresh resume re-reads the current installation and reports a material
  change to a role's installed model selection; the prior snapshot's dispatch
  records are diagnostic history, never a route lock or an override.
- The next slice is routed by its current risk — here `implement-hard` —
  regardless of the earlier easy-route assignment; the reassessment and its
  reason are recorded in the existing snapshot.
- Routing decisions, records, and rationale stay in the existing state (the
  active snapshot in Autonomous Mode, session context in Work); no new
  tracking file or state system is created for them.
- Where a coordinator is configured, the resume runs in the current session
  on the coordinator profile from the first turn, exactly as a new run; the
  coordinator remains a session assignment, not a worker route.

## Real entry and interruption boundary for recovery-sensitive acceptance

A slice changes how a CLI resumes after an interrupted run, and its tests
cover the internal recovery method.

Expected behavior:

- Do not accept the slice on internal method tests alone.
- Require acceptance evidence through the real user entry or command
  selection that reaches the recovery path, including the interruption
  boundary around the external side effect.
- Keep targeted intermediate checks at the slice boundary; run the full
  suite at the integration boundary.

## Review closure across fix rounds

A re-review follows a fix that addressed findings F1, F2, and F3 from the
first review.

Expected behavior:

- Report each prior finding by ID: F1 fixed, F2 partially fixed, F3
  regressed — with evidence for each.
- Label any new defect separately and distinguish it from a consequence of
  the still-open F2.
- List the acceptance evidence still missing before the slice can close.

## An ordinary task with a measurable-sounding goal, without `--outcome`

The task text names a measurable target — for example, "make the export at least
20% faster" — but the invocation is a plain `/work ...` with no `--outcome`
option.

Expected behavior:

- Handle it as an ordinary correctness task: the outcome-evaluation protocol is
  never entered on inference. No outcome card is pre-registered, no baseline is
  measured for the loop, no candidate record is kept, and no outcome verdict is
  reported.
- The task proceeds exactly as today — implementation, the applicable gate
  (an independent review, or for a clearly mechanical change its deterministic
  check, with an independent review only when risk warrants it), acceptance
  checks, and delivery under the existing rules.
- The number or performance goal in the text is treated as ordinary task
  context, not as a trigger for the protocol.

## An opted-in measurable task with a clear baseline and a successful candidate

The user invokes `/work --outcome <task>` where the task names a measurable
objective, a reproducible instrument, an acceptance bar, and the constraints to
preserve.

Expected behavior:

- Pre-register the outcome card before any candidate implementation: objective,
  metric (direction and units), instrument, baseline on a pinned ref with N and
  date, acceptance criteria, constraints, noise policy, iteration budget bounded
  by the existing worker-round allowance, and stop conditions.
- Prove the instrument runs, measure and record the baseline, and record the
  noise policy from unchanged runs, before the first implement round.
- Drive one candidate at a time through the existing implement round; run the
  instrument on the candidate under the same ref discipline, inputs, seed, and
  cache-busting; compare against the original pinned baseline and the
  pre-registered acceptance criteria.
- On a candidate that clears the acceptance criteria outside the noise policy,
  run its applicable gate — the unchanged independent review, or for a clearly
  mechanical change its deterministic check, with an independent review only
  when risk warrants it; when it passes and the objective target is met, stop
  and report the baseline and final measurements, method and noise, the
  acceptance criteria and that they were met, the attempts made, the gate
  result, and remaining limitations.
- Reuse the existing worker rounds, review gate, worker-round allowance with
  its evidence-based progress extension and any exact explicit user limit,
  and stop/continuation machinery; introduce no new orchestration or
  parallelism.

## A candidate that fails the acceptance criteria

Under an active `--outcome` task, a candidate is measured and does not clear the
pre-registered acceptance bar, or a constraint regresses.

Expected behavior:

- Record the attempt as rejected with its measurements and the rationale, and do
  not promote it.
- Revert or isolate the rejected candidate's own changes safely, preserving any
  unrelated user changes and any known-good candidate, and verify the restored
  state.
- Feed the rejected hypothesis into the next candidate's context so it is not
  retried without new evidence.
- Continue only if the iteration budget and the stop conditions still allow
  another attempt; otherwise stop with the current best (or the pre-loop state)
  and the remaining gap to the target.

## An inconclusive result due to measurement noise

Under an active `--outcome` task, a candidate's measured delta against the
baseline falls inside the pre-registered noise policy.

Expected behavior:

- Record the attempt as inconclusive, not a win: an inside-noise delta is
  reported as such, with the spread and the run count that establish it.
- Never declare the outcome achieved from an inside-noise result, and never
  invent statistical confidence to force a verdict.
- Preserve the known-good implementation, and continue only within the remaining
  budget if a further, differently-motivated candidate is still justified;
  otherwise stop and report the inconclusive result and its evidence.

## A candidate that meets the metric but fails correctness review

Under an active `--outcome` task, a candidate clears the pre-registered
acceptance criteria, but the unchanged independent review returns blocking
findings.

Expected behavior:

- Do not complete the task and do not report it as done: the metric being met is
  "outcome achieved," but the task is complete only when correctness is also
  verified.
- Send the blocking findings through the existing fix and re-review rules:
  fix continuation is bounded by the worker-round allowance, its
  evidence-based progress extension, and any exact explicit user limit — not
  a fixed per-target fix/review cycle count — and each re-review, a
  continuation of the review the original findings already warranted, needs
  changed fix evidence or another valid justification. The review gate is
  unchanged by the protocol. After any outcome-affecting fix, re-measure the
  repaired candidate and re-compare it against the original baseline before
  the outcome can count as achieved.
- Report the state accurately — outcome achieved, correctness not yet verified.
  Worker-allowance exhaustion gates fix dispatch, not review: the required
  review of the last allowed fix still runs at zero worker budget. Stop under
  the normal stop/continuation rules when the allowance or an explicit user
  limit is exhausted and blocking findings keep correctness unverified.

## Exhaustion of the existing iteration budget

Under an active `--outcome` task, the existing worker-round allowance (or a
stall stop condition) is exhausted before the objective is met.

Expected behavior:

- Do not dispatch another implement round and do not quietly replenish the
  allowance; the protocol reuses the existing budget, it does not add one.
- Stop with the stop report: which allowance is exhausted, the current best
  candidate and its measurements, the remaining gap to the target, and the
  recent verified progress, with the copy-pasteable continuation prompt.
- Leave the working tree at the last accepted candidate (if one was accepted) or
  the pre-loop state, preserving unrelated user changes.

## A request to change the success criteria after observing results

Under an active `--outcome` task, after a candidate's results are visible, a
proposal is made to loosen the acceptance bar so a candidate would appear
successful.

Expected behavior:

- Do not silently change the objective, the measurement procedure, or the
  acceptance criteria to fit a result.
- Treat a material change as a new version of the outcome card that requires
  explicit user approval through the normal decision policy; the coordinator
  asks and records the change and its reason rather than editing the card in
  place.
- Re-evaluate only against the approved card version, and keep the original
  pre-registered criteria and baseline visible in the report.

## Safe handling of rejected candidates with unrelated working-tree changes

Under an active `--outcome` task, the working tree already contains unrelated
user changes (staged or unstaged) alongside the candidate being evaluated, and a
candidate is rejected.

Expected behavior:

- Distinguish the task's candidate changes from the unrelated user changes
  before reverting; never discard or roll back the unrelated work.
- Revert or isolate only the rejected candidate's own changes, and verify the
  restored state still contains the unrelated user changes and any known-good
  candidate.
- Record the attempt and the preserved state in the activation's state so a
  later candidate does not build on the rejected change.
