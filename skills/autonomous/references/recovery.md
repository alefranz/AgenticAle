# Recovery: resume, interruptions, and provider quota

Read this reference only on a fresh resume/crash reconcile, an interrupted child, or provider quota exhaustion.

## Reconcile on resume or crash

Before dispatching on resume:
1. Re-read `BACKLOG.md` and `.agenticale/active.md` fresh.
2. Validate `.agenticale/active.md` as a complete packet (required sections + one `NEXT` + any in-flight charge backed by a pending-dispatch note). If an interrupted task switch left both `.agenticale/active.md` and a duplicate deferred packet in `BACKLOG.md` for the active task, the valid snapshot wins — remove the duplicate deferred entry.
3. If `.agenticale/active.md` is missing or torn (including unbacked counter increments): rebuild strictly from the last state-only commit in git history, `BACKLOG.md` deferred packets (for task counters only), and verified working-tree/host evidence of rounds since that commit, applying each productive round's charge once. Never delete a deferred packet on a torn snapshot, never guess, and never reset counters to zero — if exact counters cannot be established, stop with a continuation prompt naming the gap.
4. Settle any pending dispatch once against real tree/host evidence (material work keeps single charge; confirmed never-launched or quota-only launch restores pre-launch counters), and reconcile any unfinished persistence boundary per [persistence.md](persistence.md) before new work.

## Interrupted-round recovery

If the host ends a child without a valid report (turn/step limit or crash):
- Never treat partial output as complete. Record the interruption in `.agenticale/active.md`, reconcile state against the working tree, keep the single charge if material work occurred, and start a fresh child of the **same role** from the repaired snapshot and summary (e.g., an interrupted review re-runs as a review over the same range without charging worker budget).
- If the same task is interrupted twice consecutively without material progress or decision, stop and report it as blocked.

## Provider quota recovery

Check host/dispatch output for explicit provider quota or rate-limit evidence (e.g., `The usage limit has been reached`) **before** report repair or interruption handling. Never infer quota exhaustion from empty output, generic crashes, timeouts, or auth/billing errors.

When quota exhaustion is confirmed:
1. Confirm the child is terminal (never overlap a replacement child with a live one).
2. Persist a `QUOTA RECOVERY` block in `.agenticale/active.md`: affected role/slice, exact evidence, retry time (reliable host reset time if later, else **30-minute cooldown**), whether material work began, consecutive no-work retry count (starting at `0`), and `NEXT`.
3. Check a reliable clock against the retry time and never dispatch early. If the host exposes a supported timer-backed foreground wait, wait for the remaining duration (re-checking the clock; honoring explicit user stop/cancel requests; never busy-polling). Otherwise preserve the retry time and stop cleanly (**quota-wait stop**).
4. Allow up to **8 consecutive no-work cooldown retries** across sessions (resetting to `0` only on resumed material progress); at 8, stop with a resumable snapshot.
5. Confirmed quota-only launches remove their pending worker charge and **never** count toward stall, repeated-blocker, or repeated-interruption limits.
