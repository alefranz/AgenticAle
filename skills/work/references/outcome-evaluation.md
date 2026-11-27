# Outcome-driven evaluation (`--outcome`)

Opt-in protocol for `work` tasks invoked with `--outcome` carrying an explicit measurable objective. It reuses Work's existing worker rounds, review gates, and 24-round worker allowance (no new orchestration, verdict script, or parallel candidate execution). Never enter this protocol on inference when `--outcome` is absent.

## Pre-registered outcome card

Keep this lean card in session context (no operational file) and fill **every** field before implementing any candidate; if a field cannot be filled, stop and ask.

| Field | Captures |
| --- | --- |
| **Objective** | Operational outcome to improve. |
| **Metric** | What is measured, units, and direction (higher/lower is better). |
| **Instrument** | Reproducible command/benchmark/test (prefer existing project tools); prove it runs. |
| **Baseline** | Measured starting value on a pinned ref, run count `N`, and date. |
| **Acceptance criteria** | Minimum meaningful improvement relative to the pinned baseline. |
| **Constraints** | Correctness invariants and guard metrics that must not regress. |
| **Noise policy** | Repeat count, spread measurement, and rule that inside-noise deltas are inconclusive. |
| **Iteration budget** | Candidate cap bounded by the existing Work worker-round allowance. |
| **Stop conditions** | When to accept, reject, declare inconclusive, or stop. |

**Pre-registration invariant:** Never silently alter the objective, instrument, or acceptance criteria after starting to make a candidate look successful; material changes require explicit user approval as a new card version.

## Protocol

The coordinator owns the card and runs the instrument; `implement` workers propose one candidate at a time without grading it.

1. Establish and prove the instrument (`ran <command> → <observed result>`). If hardware, credentials, or production access is missing, state that and use the closest runnable proxy.
2. Measure the baseline on a pinned ref (`N` runs, date) and characterize noise spread via repeated unchanged runs.
3. Finalize the outcome card before candidate 1.
4. Implement one candidate via `implement`, then run the instrument under identical ref, build mode, inputs/seed, and cache settings.
5. Compare against the **original pinned baseline** and acceptance criteria (never a moving best). Record each attempt (revision/state, measurements, comparison, verdict: `accepted | rejected | inconclusive`, rationale, regressions).
6. **Candidate reconciliation:** run sequentially one candidate at a time. Retain a known-good candidate safely; revert or isolate rejected candidates per [decomposition.md](decomposition.md#experiments-and-rejected-approaches) without discarding pre-existing user changes; never repeat a failed approach without new evidence. On any stop, leave the working tree at the last accepted candidate (or pre-loop state if none).
7. **Correctness gate remains mandatory:** a candidate meeting the outcome bar still goes through the normal review/fix gate; any outcome-affecting fix must be re-measured against the original baseline.

## No generic verdict script

Ship no generic statistical/verdict framework. Use existing project benchmarks/tests (or a task-scoped evaluation script that workers cannot edit to game results). Never invent statistical confidence; an inside-noise delta is inconclusive, not a win.

## Stop conditions and reporting

Stop on the first of: **Objective met** (gate-clean + outcome criteria met), **Best candidate reported (partial)** (budget/stall before target), **Budget exhausted**, **Stall** (consecutive rejected/inconclusive attempts inside noise), **Measurement failure** (instrument broken or less reliable than baseline), or **Pre-registered stop rule**. A **constraint trip** (guard metric regresses beyond noise) rejects and reverts that candidate and continues if budget/stop rules allow.

Report clearly: baseline vs. final measurements, method and noise/uncertainty, acceptance criteria verdict, all attempts (including rejected/inconclusive), correctness checks and review verdict, remaining limitations, and explicitly distinguish:
- **Outcome achieved** (measured comparison meets criteria)
- **Correctness verified** (checks and review gate passed)
- **Task completed** (both hold — never claim complete if only one holds).
