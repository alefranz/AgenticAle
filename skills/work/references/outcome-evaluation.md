# Outcome-driven evaluation (opt-in)

This reference defines Work's optional, opt-in outcome-evaluation protocol, used
only when a task is invoked with the `--outcome` option. It carries the
Lever-derived methodology — a pre-registered objective, a reproducible
measurement, explicit acceptance criteria, noise awareness, and evidence-based
iteration — as an instruction-level protocol. It is not a new orchestration: it
reuses Work's existing worker rounds, independent review gate, fix/review caps,
stop/continuation machinery, and worker-round allowance. It introduces no
generic verdict script, no metric framework, no parallel candidate execution,
and no new routing role.

## When it applies

- The protocol applies only to a task invoked with `--outcome`. It is an
  explicit, per-invocation opt-in; it is never entered on inference. A task
  whose text mentions a number, a performance goal, or a "better" outcome
  without `--outcome` is an ordinary correctness task and is handled exactly as
  today.
- `--outcome` signals that the task carries a measurable objective. The
  objective's details — what should improve, the metric, the instrument, the
  acceptance bar, the constraints — come from the task text, not from the
  option, which takes no value.
- When it applies, the coordinator pre-registers the outcome card before any
  candidate implementation, drives one candidate at a time through the existing
  worker rounds, runs the agreed instrument, compares the result against the
  pinned baseline and the pre-registered acceptance criteria, and completes only
  when both the outcome criteria and the existing correctness gates are
  satisfied. Candidate reconciliation reuses the round contract's
  [experiments and rejected approaches](rounds.md#sequential-decomposition)
  rule.

## The outcome card (pre-registered)

The outcome card is a lean record kept in the activation's existing state
(session context for Work; no operational file), established **before**
candidate implementation begins. It is valid only when its required fields are
filled — if a required field is blank, you do not yet have an outcome loop:
stop and ask; do not iterate.

| Field | What it captures |
| --- | --- |
| Objective | What should improve — the operational outcome the user wants. |
| Metric | What is measured, with its direction (better up or better down) and units. |
| Instrument | The reproducible command, test, or benchmark that produces the measurement, and where it lives. Prefer an existing project instrument; prove it runs. |
| Baseline | The measured starting point on a pinned ref, with its run count (N) and date. |
| Acceptance criteria | What constitutes a meaningful improvement — the pre-registered bar, stated relative to the baseline. |
| Constraints | What must not regress — correctness requirements and any guard metrics. |
| Noise policy | How measurement variability is handled — repeat count, how spread is characterized, and how an inside-noise delta is treated. |
| Iteration budget | The maximum number of candidate attempts, bounded by the existing worker-round allowance (it does not create a new budget). |
| Stop conditions | When to accept, reject, declare an inconclusive result, or stop. |

**Pre-registration invariant.** Once established, the objective, the measurement
procedure, and the acceptance criteria must not be silently changed to make a
candidate appear successful. A material change is a new version of the card that
requires explicit user approval (the coordinator asks through the normal decision
policy); it is never an editor's silent edit to fit a result.

## The protocol

The coordinator pre-registers the card and runs the instrument; it drives the
loop. The implement worker proposes one candidate and does not grade it. The
independent reviewer gates correctness, unchanged. Each step reuses the existing
rounds and gates:

1. **Identify** the explicitly requested measurable objective. Only a `--outcome`
   task reaches here.
2. **Establish a reproducible measurement procedure.** Reuse an existing
   instrument before building one, and prove the coordinator can run it: record a
   one-line proof (`ran <command> → <observed result>`). If it needs hardware,
   credentials, or production the coordinator lacks, say so and use the closest
   instrument it can actually run.
3. **Measure and record the baseline** on a pinned ref, with N and the date.
   Characterize the noise policy by repeating unchanged runs and recording the
   spread.
4. **Pre-register** the acceptance criteria, constraints, and stop conditions.
   The card is now final for the run.
5. **Implement one candidate** through the existing implement round.
6. **Run the agreed instrument** on the candidate with the same ref discipline,
   machine and build mode, inputs and seed, and cache-busting as the baseline, so
   nothing is skipped.
7. **Compare** the result against the original pinned baseline and the
   pre-registered acceptance criteria — not against a moving best.
8. **Record the outcome** as accepted, rejected, or inconclusive, with the
   measurements and the rationale.
9. **Continue only when justified** and within the existing execution limits —
   the worker-round allowance, the fix/review caps, and the pre-registered stop
   conditions.
10. **Complete** the task only when both the outcome criteria and the existing
    correctness gates (the acceptance checks and the independent review) are
    satisfied.

The independent review gate is separate from the measurement and is unchanged
by the protocol. A candidate that clears the acceptance criteria but carries
blocking review findings goes through the existing fix and re-review loop
within the existing caps; after any outcome-affecting fix it is re-measured and
re-compared against the original pinned baseline before it can count as
achieving the outcome.

## No generic verdict script

Phase 0 deliberately ships no generic verdict script or metric framework.
Measurement requirements vary too much by task for a universal verdict engine to
be in scope. Instead:

- Prefer existing project-specific benchmarks, tests, and analysis tools.
- Require reproducible measurements and explicit comparison rules — a named
  instrument, a named baseline ref, and a stated acceptance rule.
- Prefer executable acceptance checks when practical: a test, a benchmark
  assertion, or a threshold the instrument already reports.
- Allow a task-specific evaluation script where it is genuinely useful for that
  task. It is part of the task's own scope, not a shipped AgenticAle artifact,
  and it must not be the thing the worker edits to change the verdict.
- The coordinator (agent) interprets and reports the evidence against the
  pre-registered criteria. It must not invent statistical confidence, and it
  must not declare a noisy result successful without supporting evidence: the
  pre-registered noise policy decides, and an inside-noise delta is
  inconclusive, not a win.
- Where a task needs a complex calculation, use an appropriate tool or script
  for that task rather than embedding generic statistical logic in the skill.

The absence of a generic verdict script must not mean accepting unsupported
subjective claims. An accepted outcome requires recorded measurements, a stated
comparison, and (to be completed) a passed review.

## Candidate handling

- **Sequential.** One candidate at a time, through the existing worker rounds.
  There is no parallel candidate evaluation, no PR-per-candidate workflow, and no
  worktree orchestration.
- **Record each attempt** in the activation's state: a candidate identifier or
  description, the code revision or working-tree state, the measurement results,
  the comparison against the original baseline, the verdict and rationale, and
  any regressions or limitations.
- **Preserve a known-good implementation** when exploring further candidates. On
  any stop, the working tree holds the last accepted candidate when one was
  accepted, and is otherwise restored to the pre-loop state; the user's
  pre-existing changes are always preserved.
- **Revert or isolate rejected candidates safely.** A rejected candidate must not
  silently become the foundation of later attempts. Follow the round contract's
  [experiments and rejected approaches](rounds.md#sequential-decomposition)
  rule: retain only justified changes that pass the applicable gate, or remove
  the attempt's own changes and verify the restored state — without discarding
  unrelated user changes.
- **Do not repeat a failed approach** without new evidence. A rejected hypothesis
  stays in the attempt record, not the code.

## Stop conditions

The loop stops on the first of these terminal conditions, and each feeds the
existing stop/continuation machinery, which owns the final stop report and
continuation prompt:

- **Objective met** — a review-clean candidate meets the acceptance criteria and
  the objective target.
- **Best candidate reported (partial)** — the budget or a stall is reached before
  the objective is met: report the current best candidate, the measurements, and
  the remaining gap to the target.
- **Iteration budget / worker-round allowance exhausted** — reuse the existing
  budget; report what remains.
- **Stall** — consecutive rejected or inconclusive candidates, with no candidate
  clearing the pre-registered noise policy.
- **Measurement failure** — the instrument cannot run, or the candidate is less
  reliable than the baseline: report it as inconclusive, not silently dropped.
- **Pre-registered stop rule** — whatever the card named.

A **constraint trip** — a guard metric regressing beyond the noise policy even
though the primary metric improves — is not a terminal stop. It rejects the
candidate (revert its own changes and preserve the known-good implementation),
and the loop continues only if the budget and the other stop conditions still
allow. It is a measurement outcome, separate from the independent review gate.

## Completion and reporting

The final report for an outcome-driven task states:

- The baseline and final measurements.
- The measurement method and any relevant noise or uncertainty.
- The acceptance criteria and whether they were met.
- The attempts made, including rejected or inconclusive candidates.
- The correctness checks and the independent review results.
- The remaining limitations.

It distinguishes three outcomes clearly, and reports which holds:

- **Outcome achieved** — the measurement criteria were satisfied (evidence:
  recorded measurements and a stated comparison).
- **Correctness verified** — the existing acceptance checks and independent
  review gates passed.
- **Task completed** — both of the above.

Never report an outcome as achieved solely because the implementation looks
promising, and never report the task complete when only one of the two
conditions holds — say which is missing.
