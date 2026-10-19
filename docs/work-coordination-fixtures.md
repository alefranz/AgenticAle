# Work-coordination examples

These examples are acceptance cases for interpreting the coordination rules in
the [work skill](../skills/work/SKILL.md), the
[shared round contract](../skills/work/references/rounds.md), and the
[autonomous skill](../skills/autonomous/SKILL.md). They describe expected
coordinator decisions; they are source-interpretation examples, not live host
tests.

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
- The summary is not tool narration or internal chain-of-thought; a
  routine verification-only check needs no summary.

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
