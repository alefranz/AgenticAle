# Autonomous quota recovery examples

These examples are acceptance cases for interpreting the provider-quota rules
in the [Autonomous skill](../skills/autonomous/SKILL.md#provider-quota-recovery).
They describe expected coordinator behavior; they are not live host tests.
Charge retention and removal follow the skill's
[state protocol](../skills/autonomous/SKILL.md#state-protocol) settle event.

## Quota interrupts a worker after partial progress

The host reports `The usage limit has been reached` and confirms the worker is
terminal. Its working tree contains a changed source file and an untracked
checkpoint file. The active handoff has no reliable provider reset time.

Expected behavior:

- Save verified evidence, the worker role and slice, the 30-minute retry time,
  the exact remaining action, and a no-work quota-retry rejection count of
  zero in the existing active handoff. The initial quota failure is not a
  cooldown retry rejection, even when the child made partial material progress.
- Count the productive worker round against the normal allowance — one
  charge against both the task allowance and the run ceiling — because it
  made material progress. Do not count the quota event as another interruption,
  malformed-report correction, or task blocker.
- After cooldown, start a fresh worker that inspects both changed and untracked
  files, validates or repairs the handoff, then continues its one next action.
  It does not reset or recreate the partial implementation.
- Run the ordinary verification and independent review before accepting the
  slice.

## Quota blocks a child launch, then the session resumes early

The host returns an explicit quota error before a reviewer starts. The active
handoff records a provider reset time two hours later. A fresh activation occurs
30 minutes after the error, and the host has no supported foreground wait.

Expected behavior:

- Do not launch the reviewer early and do not consume a review allowance.
- Preserve the original later retry time and the review role/action in the
  active handoff. Stop cleanly for a later activation; do not claim it will
  wake automatically.
- On a subsequent activation after that time, re-run routing bootstrap,
  inspect the handoff and working tree, then resume the reviewer role.

## Repeated no-work quota rejection

An explicit quota error occurs on each launch attempt and no child performs
work. Several sessions end before the recorded cooldown expires.

Expected behavior:

- Preserve the consecutive rejection count and retry state across sessions;
  an early failed probe or a new session does not reset the count.
- Treat the initial quota failure as count zero. Eight automatic cooldown
  retries are then allowed: when no later provider reset time applies, retry 1
  is due at t0+30 minutes, retry 2 at t0+60 minutes, continuing through retry
  8 at t0+240 minutes. Thus the eighth retry is allowed four hours after the
  initial failure under the default cooldown; its rejection stops automatic
  retrying with count eight.
- Do not spend worker, review, or consultation allowances on quota-only
  launches or waits (a fix is a worker round), and do not count those events
  toward the two-blocker or no-progress stop rules.
- After eight no-work cooldown retry rejections, stop with the exact retry
  action recorded as resumable state. Reset this count only after a resumed
  child makes material progress, and charge that productive round against its
  normal allowance. A quota interruption after resumed material progress,
  including a partial productive interruption, begins a new sequence at zero.
- A later activation may make one probe after the recorded deadline. If it is
  rejected without work, keep the count at eight, persist the new retry time,
  and stop again without an automatic retry loop.

## Deadline across bounded waits and early returns

The host has an interruptible timer-backed wait with a maximum duration shorter
than the persisted cooldown. The first wait returns early because the user asks
for a status update; the deadline is still in the future.

Expected behavior:

- Re-read the current time after every wait return and recompute the remaining
  duration from the persisted retry time. Compose additional supported waits
  within their duration limit; do not launch or probe a child before the
  deadline.
- A status request or correction alone does not cancel the original recovery.
  Continue to respect the deadline after handling it.
- If the user explicitly asks to stop or cancel, pause or stop according to the
  request while preserving the cooldown, partial work, and resume action.

## No reliable clock or supported wait

The current host cannot reliably measure the current time or exposes no
supported timer-backed foreground wait.

Expected behavior: retain the persisted retry time and exact resume action,
stop resumably, and make no claim of automatic recovery or wakeup. Do not
substitute repeated child probes or an invented scheduler.

## Similar-looking failures that are not quota evidence

A child times out without provider quota evidence, is denied permission, or
reports an authentication or billing suspension.

Expected behavior: use the existing interruption, permission, authentication,
or stop policy. Do not apply a 30-minute quota retry or alter the quota
rejection counter.

## Quota-only worker launch removes the pending charge

Before launching a worker round, the coordinator persisted the dispatch
record, the incremented task and run counters, and the pending-dispatch note.
The host then returns an explicit quota rejection before any work begins, and
the child is terminal.

Expected behavior:

- Remove the pending charge and restore both consumed counters (the settle
  event's quota-only outcome): a pure quota-blocked launch with no resumed
  work consumes no task allowance and no run ceiling. Resolve the
  pending-dispatch note as quota-only; do not delete the evidence without a
  trace.
- Record the quota recovery state (evidence, retry time, no-work rejection
  count) in the existing active handoff; the run and task identities and all
  other counters survive unchanged.
- After the deadline, the fresh child continues the recorded `NEXT`; its
  productive round is charged once, normally, to both budgets. The quota-only
  launch is not a malformed-report correction, a second interruption, or a
  no-progress failure, and it does not erase genuine prior no-progress
  evidence.

## Quota interrupts a reviewer after partial progress

The host reports `The usage limit has been reached` and confirms the review
child is terminal after it inspected part of the range. The review round
had not changed the worker counters.

Expected behavior:

- Account the productive review round under the review accounting only: it
  never debits the task allowance or the run ceiling, and the pending-dispatch
  note resolves without touching the worker consumed counters.
- Record the quota recovery state (role, evidence, retry time, no-work
  rejection count) in the existing active handoff and honor the cooldown.
- After the deadline, a fresh review child resumes over the same range; the
  completed review still satisfies the ordinary gate. A quota-only review
  launch with no resumed work would instead consume no review allowance.
