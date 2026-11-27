# Escalation: deep review, consultation, and resets

Read this reference only when triggering `review-deep`, `consult`, or a worker reset.

## Review-deep gates

`review-deep` rounds do not consume worker budget, are recorded as `R<N>: review-deep clean|findings`, and never stack redundantly on top of an ordinary review over the same unchanged single-slice range unless triggered below:

- **Periodic integration gate:** run one deep review over the accumulated range since the last periodic baseline (or pre-WIP base / session start) after: (a) a milestone, release, or session-close boundary with 2+ accepted slices; (b) a public API, package/dependency, cross-repo contract, or submodule change; or (c) changes spanning 2+ repos or ~12+ non-handoff files. Skip for 1-slice investigations or docs-only runs.
- **Standing-in slice gate:** for a high-risk slice (`implement-hard`, concurrency/async, cross-repo contracts, subtle shared state, or security) interacting with prior slices or uncertain contracts, run one `review-deep` **instead of** ordinary slice review (verdict is the slice's gate; does not advance the periodic baseline).
- **Non-convergence diagnostic (capped at 1 opportunistic escalation per session):** when a loop hits oscillation, repeated root-cause invariant failure, or 3+ fix rounds without converging (never on healthy productive fixes), run an advisory `review-deep` over the slice's accumulated range to produce a clear disposition (replan, style-drift settlement, or stop). Periodic and standing-in slice gates are outside this 1-per-session cap.
- **Explicit user request:** one bounded audit over the user-named range (lower bound floored at any open task's pre-WIP base).

Blocking deep findings receive dedicated fix rounds and scoped re-review (keeping any pre-WIP lower bound); mechanical findings close via coordinator-run deterministic check. Promote ordinary nits to `BACKLOG.md` checkboxes; carry closed style-drift residuals as documented known limitations instead of open checkboxes.

## Decision consultation (`consult` / `consult-hard`)

Use one foreground read-only `consult` round (or `consult-hard` when configured for conflicting evidence, interacting constraints, or costly reversals) to resolve reversible technical deadlocks, complex design choices, or reviewer style drift (4+ consecutive reviews opening only style/wording blockers after functional checks pass).

- **Limits:** at most **1 consult per decision** and **2 per session** (does not consume worker budget).
- **Exclusions:** never use `consult` for irreversible Git/release actions, user taste/scope preferences, `AGENTS.md`-reserved decisions, or granting extra worker budget.
- **Hedged result:** a low-confidence or hedged consult counts as no answer; route the decision to the user via the anti-ask gate. Record adopted consult choices in state as independently advised decisions.

## Worker reset triggers

End a worker round early and start a fresh child from `.agenticale/active.md` when:
1. Two hypotheses fail, or the same build/test failure persists after one targeted fix and rerun.
2. Three consecutive exploratory actions produce no decision or implementation.
3. Scope shifts into a new subsystem or cross-repo dependency investigation.
4. The next action and evidence can no longer be handed off compactly (never reset merely because productive verification used many tools).

Persist compact `TRIED` (disproved hypotheses), current state, and one `NEXT` action in `.agenticale/active.md` before dispatching the fresh child. Never suppress failed `cd` or test errors with `2>/dev/null`.
