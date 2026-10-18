# Autonomous quota recovery examples

These examples are acceptance cases for interpreting the provider-quota rules
in the [Autonomous skill](../skills/autonomous/SKILL.md#provider-quota-recovery).
They describe expected coordinator behavior; they are not live host tests.

## Quota interrupts a worker after partial progress

The host reports `The usage limit has been reached` and confirms the worker is
terminal. Its working tree contains a changed source file and an untracked
checkpoint file. The active handoff has no reliable provider reset time.

Expected behavior:

- Save verified evidence, the worker role and slice, the 30-minute retry time,
  the exact remaining action, and a no-work quota-retry rejection count of
  zero in the existing active handoff. The initial quota failure is not a
  cooldown retry rejection, even when the child made partial material progress.
- Count the productive worker round against the normal allowance because it
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
- Do not spend worker, fix, review, or consultation allowances on quota-only
  launches or waits, and do not count those events toward the two-blocker or
  no-progress stop rules.
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
