# Round contract acceptance examples

Acceptance examples for sections of the [shared round contract](rounds.md);
the operative rules for each section stay in rounds.md.

## Sequential decomposition

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
| The same underlying invariant is flagged in consecutive rounds | Repeated findings about one invariant trigger replanning: a real design issue reopens the plan with the original acceptance and counters intact, while a drifting reviewer standard is settled once, not chased as a defect ([Standard settlement](rounds.md#standard-settlement)). |

## Progress-aware budgets and continuation

| Situation | Expected coordination |
| --- | --- |
| The twelfth worker round finishes productive work and the task is unfinished | Record the verified evidence, extend the allowance within the progress ceiling, and dispatch round thirteen without a permission ask. |
| The allowance is reached and the last rounds were churn — edits with failing or unverified acceptance | No extension: stop the task's worker dispatch incomplete; two consecutive unproductive rounds fire the stall stop even earlier. |
| An explicit user allowance of eight rounds is reached with verified progress | Stop at eight: the explicit cap is exact and does not auto-extend; offer the named increment a continuation needs. |
| The twenty-fourth worker round is a fix and the progress ceiling is reached | No further worker round; the fix's required independent review still runs at zero worker budget, and surviving blockers keep the target incomplete. |
| A run-level safety limit is reached while eligible backlog work remains | INCOMPLETE safety stop with the continuation prompt — never reported as a completed run. |
| The second consecutive review on a target opens only findings of an already-seen class | No further fix round dispatches on those findings: the [Standard settlement](rounds.md#standard-settlement) path runs first, and the settled standard binds every later dispatch packet. |
| Convergence saturation fires on a target | The [convergence declaration](rounds.md#convergence-declaration) runs before any further round on that target — the loop's non-convergence is declared once, with trajectory, verified-green evidence, cost, and exactly one decision. |
| Blocking findings survive while budget and verified progress hold and no safeguard fired | Continue the fix → verify → re-review loop unattended (subject to the review-limit headroom condition in [Fix continuation and review justification](rounds.md#fix-continuation-and-review-justification)); surviving findings are not a permission ask. |
| A free-text grant matches neither grant flavour exactly | Parse it once; one clarifying question when ambiguous; the parsed flavour is recorded in the budget line. |
| A settlement classifies every open finding as a nit | Close the target accepted-with-residuals under the settled standard without a question; the residual list is recorded in state and in the task result record. |
