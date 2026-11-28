# Escalation: progressive acceptance, consultation, and resets

Read this reference only when triggering a progressive acceptance review, `review-deep`, `consult`, or a worker reset.

## Progressive acceptance and review-deep gates

`review` and `review-deep` rounds do not consume worker budget, are recorded as `R<N>: review|review-deep clean|findings`, and never stack redundantly over the same unchanged range unless stepping up for acceptance or triggered below:

- **Progressive acceptance review (delivery / milestone / run-close boundary):** before closing a milestone, shipping a public API / dependency / cross-repo contract / submodule / multi-repo / ~12+ file boundary, or finishing a strict-mode run with product changes (including a single-task run delivering directly; skip for investigation-only or zero-change runs), pass one fresh-context acceptance review over the complete accumulated range since the last accepted delivery baseline (or pre-WIP base / session start) per [Progressive independent assurance](../../work/references/rounds.md#review-and-fix-gate):
  - Tier 0 only during implementation → acceptance review at **Tier 1 (`review`)**.
  - Tier 1 (`review`) required during implementation → acceptance review at **Tier 2 (`review-deep`)**.
  - Tier 2 (`review-deep`) already required during implementation → stays at **Tier 2 (`review-deep`)**, already satisfied if an un-invalidated `review-deep` covers that complete accumulated range.
- **Standing-in slice gate:** for a high-risk slice (`implement-hard`, concurrency/async, cross-repo contracts, subtle shared state, or security) interacting with prior slices or uncertain contracts, run one `review-deep` **instead of** ordinary slice review (verdict is the slice's gate; satisfies acceptance only if it covers the complete delivery range with no later changes).
- **Non-convergence diagnostic (capped at 1 opportunistic escalation per session):** when periodic reassessment hits oscillation, repeated root-cause invariant failure, or stuck fix rounds without converging (never on healthy productive fixes), run an advisory `review-deep` over the slice's accumulated range to produce a clear disposition (replan, style-drift settlement, or stop). Progressive acceptance and standing-in slice gates are outside this 1-per-session cap.
- **Explicit user request:** one bounded audit over the user-named range (lower bound floored at any open task's pre-WIP base).

Blocking acceptance or deep findings receive dedicated fix rounds (converging cheaply first if substantial; landing in a follow-up commit when earlier tasks are already committed) and re-pass at the changeset's required acceptance tier (purely mechanical findings close via coordinator-run deterministic check). Promote ordinary nits to `BACKLOG.md` checkboxes; carry closed style-drift residuals as documented known limitations instead of open checkboxes.

## Decision consultation (`consult` / `consult-hard`)

Use one foreground read-only `consult` round (or `consult-hard` when configured for conflicting evidence, interacting constraints, or costly reversals) during periodic reassessment or before committing to a complex choice to resolve strategy shifts, reversible technical deadlocks, or reviewer style drift (reviews opening only style/wording blockers after functional checks pass).

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
