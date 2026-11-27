## Review-deep gates

A deep review is one foreground round with the review-deep contract — an integration
gate, not a full repository audit, and ordinarily not a replacement for the strict
per-slice reviewer. A clean per-slice review proves a slice; it does not reliably
expose mistakes at the seams between slices. A deep review runs when its trigger
fires: either standing in for a slice's own per-slice review under the escalation
rule below, in which case its verdict is that slice's gate, or, for the remaining
triggers below, after the slice has passed its applicable required gate — an
ordinary review round, a deep review standing in for the slice's own gate, for a
clearly mechanical slice its deterministic check, or, in standard mode, the
slice's normal verification — after either closure outcome, the slice gate
passing cleanly or closing `accepted-with-residuals` under a recorded
settlement or declaration. There is one exception to that post-gate placement:
the in-loop diagnostic audit of a non-converging loop is checked and dispatched
on its own trigger inside the loop, on a still-open gate before the next fix
round — advisory, never the slice's gate, deferred while a settlement decision
or a saturation declaration is pending (see Diagnostic mode below). Review-deep rounds do not
consume the worker-round budget and are recorded as `R<N>: review-deep clean|findings`.
Two trigger families govern it:

**Periodic gate.** Run one deep review after the first applicable trigger:

- a milestone, release, or session-close boundary after two or more accepted slices;
- an accepted slice changes a public API, package/dependency identity, cross-repository
  contract, or submodule relationship; or
- the accepted range spans two repositories or roughly twelve non-handoff files.

Do not run it for a one-slice investigation, a docs-only session, or merely because a normal
reviewer emitted a non-blocking nit. Give the audit the exact commit or diff range since the
periodic baseline — the preceding deep review whose audit range covered the whole
accumulated range since the previous baseline, an integration-scope audit, or session
start when none has run — plus the accepted-slice summaries, affected repositories, and
the cross-slice acceptance commands. The baseline advances only when a deep review's
audit range actually covered the whole accumulated range since the previous baseline;
a single-slice deep review standing in for a slice's own gate does not advance it, so
the next periodic audit's range continues from the previous baseline and covers the full
accumulated range, and slices already audited at slice level are re-covered as part of
that integration range, justified as a required integration gate under the scoped
no-stacking rule. When a deep review stands in for a slice's
own review, the brief distinguishes the pending slice from the accepted context: it
names the pending slice and its acceptance, presents the accepted slices as context, and
requires the audit to cover the pending slice's full acceptance as well as its interactions
with earlier work — the audit's verdict is that slice's gate.

**Opportunistic escalation.** A deep review never redundantly stacks on top of the
slice's normal review: the prohibition covers a same-slice-range deep review that its
normal review already covered, without changed fix evidence, a required integration
gate, bounded interrupted-review recovery, or an explicit user request. For the
high-risk surface below, the level of the slice's own review is selected before that
review dispatches; the remaining post-gate triggers — the two-fix struggle signal and
the explicit user request — are checked, and the audit dispatched, only after the
slice passes its applicable required gate (an ordinary review round, a deep review
standing in for the slice's own gate, for a clearly mechanical slice its
deterministic check, or, in standard mode, the slice's normal verification) —
after either closure outcome, the gate passing cleanly or closing
`accepted-with-residuals` under a recorded settlement or declaration — still
governed by the existing review-justification rules
(changed fix evidence, a required integration gate, bounded interrupted-review
recovery, or an explicit user request). The in-loop diagnostic audit — the
struggle trigger inside a non-converging loop whose slice gate has not passed —
is the exception to this post-gate placement: it is checked and dispatched on
its own trigger inside the loop, on a still-open gate before the next fix round
— advisory, never the slice's gate, deferred while a settlement decision or a
saturation declaration is pending, and subject to the in-loop diagnostic
headroom stop (the same boundary stop as [Task loop](../SKILL.md#task-loop) step 4 and Diagnostic mode)
— and the post-gate behaviour for passed gates is unchanged. As is the periodic gate's same-range
integration audit, the struggle signal and the periodic gate are required
integration gates — the trigger itself (the shared worker/reviewer blind-spot
signal after at least two fix rounds made in response to a review round's
findings, whether or not a later pass eventually passed; the periodic
boundary, contract, or scale conditions) is the justification, and each
trigger's range is its own: the struggle
audit runs over the slice's accumulated commit or diff range — its single-slice
range from the slice's own entry (first change or recorded WIP boundary) through
the current state, including every fix delta — while the periodic audit runs over
the accumulated range since the periodic baseline — the preceding deep review whose
audit range covered the whole accumulated range since the previous baseline (an
integration-scope audit), or session start when none has run — and neither requires
a diff the previous review has not seen. When the slice's own gate was a deep review
standing in for it, the struggle audit re-covers the slice's whole range, justified
by the changed fix evidence and the trigger; a single-slice audit, standing-in or
struggle, never advances the periodic baseline. A repeat of the same trigger's audit
over the same range with no new trigger, no changed evidence, and no interrupted
review to recover is a prohibited review-only loop. Run one deep review when any of
these is true; each trigger's audit range is its own — the standing-in gate audit
covers the pending slice's range, the struggle audit runs over the slice's
accumulated single-slice range, and the explicit-request audit runs over the range
the user names:

- the slice touched a high-risk surface per the [dispatch rules](dispatch.md#task-dispatch-and-capability) —
  concurrency/async/cancellation/timing behaviour, the cross-repository contract surface,
  subtle shared-state behaviour, or security-relevant code paths (this includes every hard
  implementation slice): when its risk warrants an integration-level audit — it interacts
  with earlier slices, a shared invariant, or an uncertain contract later work depends on
  — run ONE deep review INSTEAD of the slice's normal review; its verdict closes the
  slice's gate before dependent work proceeds. A high-risk slice whose acceptance a
  single-slice review fully covers keeps its normal review only — no automatic deep
  review follows it;
- the slice needed at least two fix rounds — a struggle signal that worker and reviewer
  share a blind spot, whether or not a later review pass eventually passed — counting
  only fix rounds made in response to a review round's findings, since the trigger
  presupposes a reviewer: same-gate retries of a failed non-review gate, a repaired
  deterministic check or standard-mode verification, are repairs, not fix rounds for
  this trigger; or
- the user explicitly asks for a deep review — the request authorizes one
  bounded audit over the range the user names: one slice, a range spanning
  slices, or a named commit or diff range. The request is itself the
  justification — no changed fix evidence needed — and it authorizes that
  audit, not a review-only loop. The recorded pre-WIP base of an open
  checkpointed task the range covers is a floor on the lower bound, not a
  ceiling on the request: when the user-named start comes after it, the
  effective lower bound is that recorded base — historical WIP evidence is
  never truncated — and the user-named range sets the audit's focus and upper
  end; when the named start is at or before the base, the named start stands —
  the stop-boundary checkpoint exclusion binds the coordinator's own initiative
  only. The audit brief names the requested and effective ranges separately
  and states why the range was widened, never narrowing silently to the
  user-named start or widening silently past the user-named end.

The struggle audit uses the slice's accumulated single-slice range; the
explicit-request audit uses the user-named range (its lower bound floored at
the open task's recorded pre-WIP base). Budget guard: run at most one opportunistic
escalation per session. A deep review standing in for a slice's own gate is a required gate review, not an
opportunistic escalation: the cap counts additional escalations — the post-gate deep
reviews, the in-loop diagnostic mode audit (the struggle trigger's audit dispatched
inside a non-converging loop) and explicit user requests — and does not limit a slice's
own required gate review; the periodic-gate family is unaffected. When the cap is
already spent and a later high-risk slice's gate requires a deep review, that deep review
still runs as the slice's gate and dependent work waits for its verdict; the cap keeps
limiting additional escalations. If a further
opportunistic trigger fires, record it in the snapshot as a deferred-escalation note and
let the periodic gate pick it up when its trigger fires. The user may always direct an
additional escalation explicitly. Consult rounds are capped at two per session, separately
from the escalation and re-audits.

**Diagnostic mode inside a non-converging loop.** When the slice's required gate has not
passed because its review keeps reporting blocking findings, the struggle signal is still
checked on its own trigger condition — at least two fix rounds made in response to a review
round's findings — and, when it fires, the audit dispatches immediately in **diagnostic
mode**: its verdict is advisory, never the slice gate; it runs over the slice's
accumulated single-slice range as before; and its report must end in a standard
settlement, a replan with the original acceptance intact, or the saturation declaration —
never in another fix round on unchanged evidence. The same headroom stop applies
before the dispatch: if dispatching the audit would exceed an applicable explicit
review limit that covers deep reviews, or consume the last permitted review under
it, the loop does not
dispatch — it stops at that boundary report-only, and the eligible `cap`-flavoured
increment on that limit is a separate question-eligible situation through the
[anti-ask gate](../SKILL.md#asking-the-user-anti-ask-gate) — the
budget-exhaustion entry, per the shared
[Grant flavours](../../work/references/rounds.md#budgets-and-loop-continuation) rule: an
explicit review limit is cap-only, and reporting the stop is not
asking; that boundary stop defeats the anti-ask gate's third check — when it
fires, continuation is not covered, and the loop dispatches neither the
in-loop diagnostic nor the next fix; when no such limit applies, or headroom
holds, the dispatch is unchanged.
That outcome rule binds diagnostic mode only: an ordinary post-gate audit still
gives each blocking finding its dedicated fix round under the shared continuation
rules below. The diagnostic audit counts against the
one-opportunistic-escalation-per-session cap above — it is the struggle trigger's
audit, dispatched before the gate — so a required slice-gate deep review stays
outside the cap, no slice is stranded, and the periodic-gate family is unaffected.
The diagnostic audit is recorded with the trigger it fired on and with its mode;
the post-gate trigger behaviour for passed gates is unchanged.

**Shared continuation rules.** When the range covers a task with recorded WIP checkpoint
commits, its lower bound is the recorded pre-WIP base or earlier — a resumed session start
never truncates historical WIP out of the range — and the recorded boundary is reused across
resumes. The periodic baseline — the lower bound of the periodic gate's range — advances
only when a deep review's audit range actually covered the whole accumulated range since
the previous baseline (an integration-scope audit); a single-slice standing-in audit does
not advance it, and the next periodic audit continues from the previous baseline,
re-covering slices already audited at slice level as part of that integration range. The
audit must independently run the relevant integrated verification and inspect
the whole supplied range. Blocking findings each receive a dedicated fix round — a worker
round under the state protocol's charge event. Judgmental findings are followed by a fresh
deep review scoped to the fix delta and the invariants it touched, while mechanical-only
rounds close by local verification (see the Review gate's finding-class rules). For a
checkpointed task, that scoping is the re-review's focus, not its comparison range: as the
coordinator's own review, it keeps the recorded pre-WIP base — or earlier — as its lower
bound and the current state as its endpoint, so the WIP commits and every later
working-tree delta stay inside the diff. The focus narrows what the reviewer evaluates;
it does not shrink the range supplied. Re-audits
are not capped at a fixed per-target count: each follows a productive fix and runs under the
same review-justification rules (see
[Fix continuation and review justification](#fix-continuation-and-review-justification)).
The worker budget gates the next fix, not the review: the required deep re-review of the
last allowed judgmental fix still runs when zero effective worker rounds remain. For
example, the run's last worker round is a judgmental fix to a deep finding: its fresh deep
re-review dispatches under the review accounting with both worker budgets at zero, and a
blocking verdict surviving it is handled by the exhaustion rules — the re-review is never
skipped for lack of fix budget. When a blocking verdict survives the re-review with no
effective worker round left for another fix — or a progress safeguard fires — follow the
[stop conditions](stops.md#stop-conditions) (an exhausted run ceiling stops the run; an
exhausted task allowance defers the target) instead of asking the user to authorize
another cycle. An unjustified re-audit
of unchanged evidence is prohibited; a required integration gate, bounded
interrupted-review recovery, or an explicit user request may justify a
same-range review — an explicit user request authorizes one bounded audit
over the range the user names — but a review-only loop over unchanged
evidence may not. The coordinator promotes every non-blocking nit to a
`BACKLOG.md` checkbox before closing the audit. Settled residuals — nits
under a recorded settled standard, carried by the settlement or declaration
as known limitations — are not open work and are not promoted to a checkbox;
they ride the residual list into task persistence and the final report as
known limitations.

## Reset and handoff gate

End a worker round and start a fresh subagent when the first of these occurs:

- **Two hypotheses failed**, or the same build/test failure remains after one targeted fix
  and rerun.
- **Three consecutive exploratory actions** (search, read, probe, comparison) produced
  neither a material decision nor a persisted implementation.
- The work changes from implementing the assigned behaviour to understanding a new
  subsystem, upstream-parity question, package-origin question, or cross-repository
  dependency.
- The next action is no longer concrete from the task's original acceptance condition.
- At a natural checkpoint, the worker cannot state the next action, evidence, and stop
  boundary compactly enough for a fresh agent to resume without rediscovering material
  context. This is a judgement call; do not reset just because a productive build, test, or
  verification sequence used many tools.

For a reset, the worker changes no unrelated code and returns compact reset evidence in its
report: established facts with file or command evidence, `TRIED` (disproved hypotheses),
current state (commits/files/tests), and one `NEXT` action for a fresh agent. The coordinator
persists that evidence into the snapshot (`GOAL`, `ESTABLISHED`, `TRIED`, `CURRENT STATE`,
`NEXT`) before dispatching the fresh child. A discovery round has one question and a decision
criterion; its conclusion becomes the next implementation round.

Use known repository paths with `git -C {REPO}` where practical. Never hide a failed `cd` or
verification with `2>/dev/null`; a navigation failure is a blocker to report, not noise to
suppress.

## Review gate

Apply the shared round contract's independent review, finding classification, and re-review
closure. Its progress-aware continuation rules apply here with durable counters (see
[Fix continuation and review justification](#fix-continuation-and-review-justification)
below). In strict mode every implementation slice must pass that gate before work advances,
with one exception: a clearly mechanical slice — one whose entire acceptance is a
deterministic check — closes by that check under the shared contract's mechanical-change
rule, with an independent review only when risk warrants it. A re-review reports each prior
finding by ID as fixed, partially fixed, still open, or
regressed; when the acceptance involves recovery or interruption behaviour, require the real
user entry or command selection and the interruption boundary around external side effects,
not only internal method tests. A violation of this workflow's required persistence,
handoff, or submodule-pin policy is also blocking. The coordinator records verdicts and nits
in the durable state from the review report; the reviewer writes no operational file.

A small pre-existing finding may receive a separately scoped fix round; otherwise preserve it
in the backlog without expanding the current task. Mechanical findings close after the
coordinator runs their sufficient acceptance check; judgmental findings require independent
re-review of the fix and affected invariants. The [Decision
consultation](consultation.md#decision-consultation-independent-second-opinion) and the
autonomy envelope below govern stuck decisions.

### Fix continuation and review justification

The shared contract's
[progress-aware continuation](../../work/references/rounds.md#budgets-and-loop-continuation)
and [review/fix gate](../../work/references/rounds.md#review-and-fix-gate) bind this workflow
unchanged: per-target fix/review cycle counts — including the historical two-fix/three-review
and two-re-audit defaults — are not authorization gates; the effective worker budget,
verified progress, the stall safeguards, and the review-limit headroom condition
([Fix continuation and review justification](../../work/references/rounds.md#budgets-and-loop-continuation))
bound the fix → verify → re-review loop, which continues unattended (a fourth or later
productive fix needs no permission ask); every review needs changed evidence, a required
integration gate, bounded interrupted-review recovery, or
an explicit user request — one bounded audit over the range the user names: the request is
itself the justification, and it authorizes that audit, not a review-only loop; and the
required review of the last allowed fix still runs at zero worker budget. This skill
adds only the durable-state specifics below.

**Durable counters, no loopholes.** Fix and review counters stay durable per-target evidence
in the snapshot (or the deferred packet). They survive resumes, replans, renames, and
interruption recovery unchanged; nothing resets or re-identifies them. Counts recorded under
the historical default caps are retained as evidence, but those legacy defaults never re-gate
a resumed run. An explicit user limit recorded in the durable state — a user-set cap or the
boundary of a named grant — remains binding and stops the loop when reached: a
`cap`-flavoured boundary never auto-extends, and a `progress`-flavoured boundary —
always a task-allowance grant — auto-extends only under the verified-progress rule, up
to the progress ceiling, and continuation under it is subject to the review-limit
headroom condition ([Fix continuation and review justification](../../work/references/rounds.md#budgets-and-loop-continuation)).

**Safeguards and exhaustion.** The shared stall safeguards stop the loop regardless of
remaining budget: two consecutive unproductive worker rounds, the same blocker two rounds in a
row, the repeated-interruption limit, and the repeated-invariant rule below. When the
effective worker budget is exhausted, dispatch no further fix; surviving blocking findings
keep the target incomplete and review-open. An exhausted run ceiling or completed-task limit
stops the run (an INCOMPLETE safety stop whenever eligible work remains), offering the named
increment a continuation needs; an exhausted task allowance alone defers the target and the
run continues with another truly independent ready task (see
[Task exhaustion is not a run stop](budgets.md#task-exhaustion-is-not-a-run-stop)). The
interactive budget grant offer is a question-eligible situation that proceeds through
the [anti-ask gate](../SKILL.md#asking-the-user-anti-ask-gate).

**Repeated findings on the same invariant.** Classify first. A genuinely unmet invariant is a
real design defect: reopen the plan through the checkpoint's replanning signal with the
original acceptance and the target's fix/review counters intact, no scope weakening. Only when
the behaviour already meets acceptance and later rounds merely tighten the standard is it a
standard-setting question: settle it once — the consult (see [Decision
consultation](consultation.md#decision-consultation-independent-second-opinion)) names a
**proposed** standard, not a binding adoption, and the loop owes the user exactly one
decision — ratify, an alternative, or close now — offered through the
[anti-ask gate](../SKILL.md#asking-the-user-anti-ask-gate), with the shared
[Standard settlement](../../work/references/rounds.md#budgets-and-loop-continuation) as the
single authority for that path — and stop iterating against the drift. The
standalone question is owed only
when no saturation declaration is pending: when one is, per the shared contract's
[Decision order](../../work/references/rounds.md#budgets-and-loop-continuation), the settlement
question is the declaration's single combined decision, and this instruction owes no
separate question. Neither path resets counters or weakens scope.

**Autonomy envelope.** The coordinator continues the loop without asking while all of these
hold: the work stays docs/config-only or is reversible under the active persistence policy;
additional deep review escalations stay within one per session — the cap counts
additional escalations (post-gate deep reviews, the struggle trigger — including its
in-loop diagnostic form — and explicit user requests); a required slice-gate deep review is
outside that cap, and the user may always
explicitly direct an additional escalation — with every re-audit justified; consults stay
within two per session; the effective worker budget covers the next
fix (including any justified extension), no safeguard or explicit user limit
has fired, and the next cycle — the next fix and its required re-review —
leaves at least one review available under each applicable explicit review
limit (the review-limit headroom condition in
[Fix continuation and review justification](../../work/references/rounds.md#budgets-and-loop-continuation));
and no irreversible action is required. When the next cycle would exceed an
explicit review limit or consume the last permitted review under one, the loop
stops at that boundary report-only, and the eligible `cap`-flavoured increment
on that review limit is a separate question-eligible situation through the
[anti-ask gate](../SKILL.md#asking-the-user-anti-ask-gate) — the
budget-exhaustion entry, per the shared
[Grant flavours](../../work/references/rounds.md#budgets-and-loop-continuation) rule: an
explicit review limit is cap-only, and reporting the stop is not
asking. Both worker budgets gate worker dispatch only: an
exhausted task allowance defers that task, not the run, and an exhausted run ceiling stops
worker dispatch while the permitted review of completed changes still runs. A consult never
grants an allowance — only the user can, through a named increment. Breach any guard, or reach
an irreversible action — stop. Every question to the user routes through the
[anti-ask gate](../SKILL.md#asking-the-user-anti-ask-gate), the single entry for questions — guard
breaches, irreversible actions, and what a consult could not settle included — and never for
routine continuation inside the envelope; a question that fails the gate is a guard breach,
reported, not sent.
