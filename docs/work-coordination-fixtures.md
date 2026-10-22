# Work-coordination examples

These examples are acceptance cases for interpreting the coordination rules in
the [work skill](../skills/work/SKILL.md), the
[shared round contract](../skills/work/references/rounds.md), and the
[autonomous skill](../skills/autonomous/SKILL.md). They describe expected
coordinator decisions; they are source-interpretation examples, not live host
tests.

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
context (or the active handoff in Autonomous Mode) with the new state and
dispatches the next round without telling the user anything.

Expected behavior:

- Treat the hidden-only update as insufficient: before the next substantive
  dispatch, send the user a concise decision summary — the prior outcome,
  any change of approach, the next evidence to collect, and any approaching
  limit or material uncertainty.
- Also retain the compact state in the workflow's existing state: session
  context in reviewed task work, the active handoff in Autonomous Mode.
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

The worker allowance is spent on its last permitted worker round. The
slice's changes are in the tree.

Expected behavior:

- Do not dispatch another worker round.
- Run the permitted review of the last allowed worker; the review cap is
  separate from the worker allowance.
- If more work is then required, stop with the exhausted allowance, the
  completed and blocked state, and the recent material progress.

## Structured stop with an interaction tool available

A slice has used both fix cycles with blocking findings still open, and the
host offers an interaction tool.

Expected behavior:

- Stop before any further dispatch and report the exhausted fix allowance,
  what is completed, what is blocked, and the recent material progress.
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

- Add exactly that increment: one fix round and its re-review.
- Do not reset the fix or review counters, do not expand scope, and grant no
  review or Git rights the user did not name.
- A replan requested through the same grant stays bounded: child rounds of
  the replan consume allowances.

## Exhausted fix and review allowances: a consult cannot grant another fix

Strict mode. A slice has used both fix cycles, the third review pass still
carries blocking findings, and a consult on the surviving findings
recommends a specific repair.

Expected behavior:

- Do not dispatch a third fix cycle or a further review pass: the shared
  two fix cycles and three review passes gate every dispatch, and a
  consult's recommendation is a second opinion, not an allowance.
- Report the exhausted fix and review allowances with the completed and
  blocked state and the recent material progress, and offer the
  situation-appropriate choices — a bounded replan, one additional bounded
  fix-and-review cycle, or a stop that preserves the current work — naming
  the worker, fix, and review increments each choice consumes.
- Continue only if the user grants the named fix and review increments. A
  declined or unanswered option ends the stop with the continuation prompt:
  do not ask again, do not schedule a resume, and leave the work in its
  preserved state.

## Exhausted worker budget: a consult's different path still consumes an allowance

The worker budget is spent and the same task has blocked two rounds in a
row. A consult recommends a materially different approach.

Expected behavior:

- Record the consult's recommendation as an independently advised decision,
  but do not dispatch a worker round from it: the worker budget is
  exhausted and a consult cannot grant one.
- Offer the user the choice of granting the named worker increment — with
  the fix and review rounds the continuation needs — or stopping; a
  declined or unanswered option ends the stop with the continuation prompt,
  no re-ask, and no scheduled resume.

## Provider quota: Work stop versus Autonomous cooldown

In reviewed task work, the host confirms an explicit provider quota
exhaustion mid-sequence, with partial work in the tree.

Expected behavior:

- Stop further dispatch and report the role, the evidence, and what is
  complete versus unchecked, with the continuation prompt.
- Create no cooldown state and make no automatic retry; the session-scoped
  rules do not use Autonomous Mode's quota cooldown and handoff recovery.
- In Autonomous Mode the same evidence instead follows the persisted
  cooldown and retry policy in the existing handoff.

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
the fix is dispatched on the configured `implement-hard` route. The binding's
profile for that route carries the implementation contract body, and the
configured policy resolves `fix` to a routine-tier profile.

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
