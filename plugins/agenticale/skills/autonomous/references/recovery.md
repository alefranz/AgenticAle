## Provider quota recovery

Inspect the host's terminal child or dispatch result for a provider-reported usage quota or
rate-limit exhaustion before applying malformed-report correction or ordinary
interrupted-round handling. Treat explicit host/provider evidence such as `The usage limit
has been reached` as quota evidence. A generic crash, timeout, cancellation, permission
denial, authentication failure, or billing/account suspension is not quota evidence; follow
the existing error or stop policy for those cases. Do not infer quota exhaustion from
silence or a child's unverified claim when host status is available. This policy applies to
all dispatched child roles, including workers, reviewers, fixers, explorers, consultants,
and deep reviewers.

When quota exhaustion is established, first confirm that the child is terminal and has no
background work still running. Never overlap a replacement child with a live one. Persist a
`QUOTA RECOVERY` record in the snapshot: affected role and slice, exact evidence, observed
time and retry time, whether work began, the next concrete resume action, and the
consecutive no-work quota-retry rejection count. The initial quota failure starts the outage
sequence with this count at zero, even if the child made partial material progress before
being interrupted; it is not one of the cooldown retry rejections. Honor reliable provider
retry/reset metadata when it gives a later time; otherwise use a 30-minute cooldown. Do not
assume all providers share a four-hour usage window. The cooldown and counters survive
session resumes and handoff repairs.

Read the current time from a reliable clock and compare it with the persisted retry time.
Never launch before that deadline, including after a fresh session or an early return from a
wait. Inspect the current host's actual tool surface for a supported, timer-backed
foreground wait. If available, wait for the remaining duration, composing multiple waits
only as needed to stay within the tool's supported duration. After every return, re-read the
clock and recompute the remaining time; do not busy-poll, probe children, or dispatch early.
User input may interrupt a wait: an explicit request to stop or cancel pauses or stops the
task according to that request while preserving the cooldown and work; a status request or
correction alone does not cancel recovery and must still respect the deadline. If elapsed
time cannot be measured reliably, or no supported timer-backed wait is available, preserve
the exact retry time and resume action in the snapshot and stop cleanly for a later
activation — the quota-wait stop, one of this policy's own stops rather than a
[stop condition](stops.md#stop-conditions); do not attempt coordinator work while the
coordinator itself is quota-exhausted.
Do not claim an automatic wakeup or invent scheduler support. Runtime bindings do not
promise a common wait or wakeup capability, so report it as unavailable unless the active
host exposes it.

Before resuming, the coordinator inspects the actual working tree, including untracked files
and partial edits, validates the snapshot against that state, and repairs any missing or
stale part from verified tree and tool evidence before dispatch — without delegating the
repair to a child. The fresh child re-checks the snapshot read-only, reports any discrepancy
in its report, and continues from its one `NEXT` action; it must not reset files, discard
work, or reimplement the whole assignment based only on the interrupted report.
Preserve role policy: a reviewer stays read-only, and Git actions remain governed by the
existing authorization rules. Completed changes still require the ordinary verification and
review gates.

The coordinator persists small durable checkpoints at natural progress points from child
reports, including before a long action likely to cross a provider usage window; each child
returns completed work and evidence, remaining work, and exactly one next action so a fresh
child can make forward progress rather than replaying the task. Resolve the pending-dispatch
record under the state protocol's settle event: a productive round keeps its single charge
(worker roles against both budgets, review, review-deep, and consult under their own
accounting), and a confirmed quota-only launch removes its pending charge. A quota rejection
with no resumed work is quota only even if the host created a child session before returning
the rejection; a pure quota-blocked launch or cooldown wait is not a malformed-report
correction, a second interruption, or a no-progress failure, and it must not erase genuine
prior no-progress evidence either. The run and task identities, the consumed counters, and
the pending-dispatch evidence survive the outage and every resume.

Allow at most eight automatic cooldown retries after the initial quota failure. Count only
quota rejections from those retries that find no resumed material progress: retry 1 raises
the count from zero to one, through retry 8 raising it to eight. Persist the count across
sessions and failed probes; a fresh activation does not start a new set of retries. Reset it
only after a resumed child makes material progress. At eight, the quota-retry stop: stop
with a resumable snapshot and the next retry action; a later activation may make one fresh
probe after the recorded time, but another no-work rejection leaves the count capped at
eight, records the new retry time, and stops again without an automatic retry loop. A quota
interruption after resumed material progress starts a new sequence at zero, including when
the productive child was interrupted after partial progress. Quota waits and quota-only
launch failures do not count as two consecutive task blockers, and they do not trigger the
[repeated-blocker and no-progress stop conditions](stops.md#stop-conditions): a quota-only
launch produced no round and no task-level attempt — it is provider-side outage evidence,
while those stops guard against the task itself stalling on a wall the user could redirect —
so counting it as a blocker would stop the run for an outage the quota-wait stop and the
quota-retry stop already bound, and which no change of path could remove. When a resumed
child makes material progress, its productive round is charged under the settle event's
normal role accounting. All normal worker, fix, review, consultation, and budget limits,
and the [stop conditions](stops.md#stop-conditions), otherwise remain in force.

## Interrupted-round recovery

If the host ends a child before it produces a valid report (e.g. a turn/step ceiling or an
interruption), do not treat the task as complete or count a forced summary as a completed
task. Record the interruption in the snapshot (for example `R4: work progress — interrupted;
fresh handoff required`). Before dispatching, the coordinator alone validates the compact
state against the actual working tree and host evidence and repairs any missing or stale part
under the reconcile event, persisting the repair; it never delegates that validation or
repair to a child. Then start a fresh child of the same role from the repaired snapshot plus
the interrupted child's final summary. The child re-checks the state read-only, reports any
discrepancy or repair fact in its report without writing operational state, and does one
concrete `NEXT` action; an interrupted reviewer stays read-only and never edits state or
product code. This is a normal reset, not a malformed-report correction and not an automatic
retry loop. Account the interrupted round and its
continuation under the state protocol's settle and charge events: the recorded charge stands
for material work, and the fresh continuation is a new round with its own single charge
(worker roles) or under the role's own accounting (review, review-deep, consult). Neither
the interruption nor the reset replenishes any budget or re-issues the task identity. For
example, a review child interrupted mid-verdict is replaced by a fresh review child over the
same range: the continuation is a review round under the unchanged review rules, not a
worker round, and the run and task consumed worker counters stay unchanged. If the same task
is interrupted twice without a material decision or persisted outcome, stop and report it as
blocked.

When host/provider evidence identifies quota exhaustion, use the quota recovery path above
instead of recording an ordinary interruption. Quota-only waits and launch rejections do not
trigger this section's repeated-interruption limit.
