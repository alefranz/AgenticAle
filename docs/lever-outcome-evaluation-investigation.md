# Lever outcome-driven workflow investigation

Status: investigation and design; Phase 0 implemented. This
report preceded the implementation: Phase 0 of the outcome loop
was implemented on 2026-11-01 as the opt-in, instruction-level
`--outcome` protocol carried by the `work` skill, and this
document ships with that change. See the decision note below for
how the implementation differs from the recommendation in this
report. This document is repository-only: it is intentionally
**not** in the published-page allowlist
(`docs/.vitepress/published-pages.mjs`) and is not a user-facing skill page.

Research date: 2026-11-01. GitHub Lever inspected at a local
checkout of `github/lever` (obtained per the `source-code-lookup`
skill; the source root is `~/dev` by default), commit
`f859d0aa2be96981157ee0480655c84877e3cd98` (default branch, clean tree).
AgenticAle inspected at this repository's `main`.

This report separates two kinds of content, and labels them explicitly:

- **Verified** — observed directly in the Lever source at the commit above, or
  in AgenticAle's current source. File paths are cited.
- **Proposed** — a design recommendation for AgenticAle. Nothing here is
  implemented.

The goal is **not** to port Lever wholesale or to add a competing orchestration
model. It is to find the smallest cohesive capability or set of reusable
patterns that would complement AgenticAle's existing workflows.

---

## Decision note: Phase 0 implemented as an instruction-level protocol (2026-11-01)

Phase 0 of the outcome loop has been implemented on branch
`feat/outcome-evaluation-phase-0` and delivered as its own reviewed pull
request. It deliberately differs from the recommendation in sections 4-7 in
three ways. This note records the rationale; the findings and the
recommendation above are unchanged.

1. **No generic verdict script in Phase 0.** The `verdict.mjs` script
   proposed in section 5.3 (generalized from Lever's `arm_stats.py`) is
   deferred, not rejected. Measurement requirements vary too much by task —
   instrument, metric, units, and even what "paired runs" mean — for a
   universal keep/reject engine to earn its place before the pattern has
   proven itself on real tasks. AgenticAle's shipped scripts are few, and each
   carries test coverage (`routing.mjs`, `session-stats.mjs`); a generic
   verdict script would add an unproven artifact plus its own test surface
   before the loop has its first user. The anti-gaming properties that matter
   — pre-registration, proposer not judge, noise policy, pinned baseline —
   are carried by the protocol's instructions and the recorded measurements,
   not by a script. Instead, the coordinator runs the agreed reproducible
   instrument (preferring an existing project tool), records the measurements,
   and interprets them against the pre-registered acceptance criteria: an
   inside-noise delta is inconclusive, never a win, and no statistical
   confidence is invented. A task may still use a task-specific evaluation
   script where genuinely useful; it is part of that task's scope, not a
   shipped artifact. A deterministic verdict script remains the leading
   Phase 1 candidate if real use shows a repeated, comparable measurement
   shape.
2. **A `work` reference, not a new supporting skill.** Phase 0 ships the
   protocol as `skills/work/references/outcome-evaluation.md`, referenced from
   `work`, instead of the `skills/outcome-loop/` supporting skill proposed in
   section 5.4. The capability is one protocol document, it has a single
   consumer in Phase 0 (`work`; `autonomous` is explicitly not integrated),
   and a new skill would expand the validated file inventory and the package
   before the pattern is proven. Promotion to a supporting skill remains the
   Phase 1 shape.
3. **An explicit `--outcome` flag as the trigger.** Open question 1 in section
   8 (a crisp, testable trigger) is resolved as a bare leading option — the
   same convention as `--pr`, `--stats`, and `--consult` — rather than
   inference from task text. A task that mentions a number or a performance
   goal without `--outcome` is an ordinary correctness task and is handled
   exactly as today.

Retained from the recommendation: the pre-registered lean outcome card (nine
fields, per section 5.2), proposer not judge (the implement worker proposes
one candidate and does not grade it), noise awareness (an inside-noise delta
is inconclusive, never a win), the pinned baseline with ref discipline and
cache-busting, safe revert and known-good preservation for rejected candidates,
reuse of the existing worker-round allowance (no new budget), the unchanged
independent correctness review gate (with re-measurement after any
outcome-affecting fix), bounded sequential candidates (no parallel arms, no
PR-per-candidate, no worktree orchestration), and three-way reporting (outcome
achieved / correctness verified / task completed).

## 1. Executive summary

Lever's core value is a **pre-registered, measurable objective** ("Loop Card"):
before any code changes, the agent pins down a felt outcome, a metric with
guards, a self-run instrument, a baseline, a noise floor, a pre-registered
"keep bar" (what counts as a win), a budget/leash, and a stop rule. Iteration
is then bounded and judged by the **instrument, not the worker** ("separate the
proposer from the judge"), with accepted *and* rejected attempts recorded in a
ledger so they are not retried.

Most of this is **portable prose plus one small deterministic script**. Only
the *execution vehicle* — driving GitHub Actions, one draft PR per candidate,
`gh` polling, and CI cost accounting — is GitHub/Copilot-specific. AgenticAle
already has the surrounding machinery (bounded sequential rounds, independent
correctness review, durable state in `autonomous`, cost/value model routing,
explicit stop conditions) that Lever's loop *presumes* but does not provide.

**What AgenticAle genuinely lacks** is the measurable dimension: today a task
succeeds when it passes correctness review and its acceptance checks. There is
no first-class notion of a *pre-registered quantitative objective*, a *noise
floor*, or a *deterministic keep/reject verdict* for a candidate. That is the
real gap Lever fills, and it is orthogonal to correctness review.

**Recommendation.** Add an **optional, opt-in "outcome loop"** capability,
carried by a small supporting skill plus a dependency-free Node verdict script
(analogous to `skills/work/scripts/routing.mjs`), referenced by `work` (and,
for durable runs, `autonomous`). It is **not** a new slash command, not a new
orchestrator, and not parallel. A task that specifies a measurable objective
pre-registers a lean outcome card, then iterates one candidate at a time:
implement → run the instrument → record the measurement → apply the
deterministic verdict → keep or iterate, bounded by a max-iteration count and
stop rules. **Correctness review remains the separate, unchanged gate** that
every accepted candidate must still pass. Ordinary tasks with plain acceptance
checks are entirely unchanged.

Explicitly **not** adopted: Lever's parallel "arms" (conflicts with
AgenticAle's deliberate sequential-only design), its GitHub Actions /
PR-per-candidate / `gh` driver, its Copilot config-file dial system, and its
L0–L5 autonomy ladder (overlaps and would conflict with AgenticAle's own
explicit-authorization and persistence policy). The smallest valuable first step
is the verdict script plus the outcome-card pattern plus a short opt-in section
in `work`, proven on one real measurable task before promoting it to a full
supporting skill.

---

## 2. Lever implementation findings (verified)

All file paths are relative to the Lever checkout at commit `f859d0a`. Lever is
a Copilot plugin: `plugin.json` is a thin agent-plugins.org manifest; all logic
lives in Markdown skills under `skills/`, with a few Python scripts.

### 2.1 The Loop Card and the `find-the-loop` flow

`/lever loop` routes to the `find-the-loop` skill. The artifact it produces is
`templates/loop-card.md`, an 11-field table. Its header sets the posture:

> "Fill this in **before** iterating. If a row is blank, you don't have a loop
> yet."

Fields (verified, `templates/loop-card.md`):

| Field | Meaning |
| --- | --- |
| Outcome | What the user will feel (the felt effect, not a proxy). |
| Metric + guards | One felt metric plus cost/quality guards. |
| Instrument | How the agent measures it *itself*: a command / test / script / eval, plus its path. |
| Noise floor (A/A) | Spread of the metric over N unchanged runs. |
| Baseline | Value on the current head, with N and date. |
| Keep bar (pre-registered) | The effect size required to count as a win, plus guards. |
| Generalization check | Holdout set, second machine, or real traffic after merge. |
| Leash / budget | Timebox, max iterations, API/compute budget. |
| Stop rule | When to stop, re-plan, or ask. |
| Autonomy level | L0–L5 (see `docs/autonomy.md`) and its source. |
| Ledger | Where accepted *and rejected* attempts are recorded. |

The creation flow (`skills/find-the-loop/SKILL.md`, steps 1–11) is notable for a
few invariants:

- The metric must be **felt, not a proxy**: "PR time-to-green on the critical
  path, not job durations. Reject proxy metrics unless you can show they track
  the outcome."
- **Find before you build**: reuse an existing instrument (tests, benchmarks,
  eval suites, CI history) before inventing one.
- **Prove you can run it yourself**: the output is "a one-line proof that you
  ran the instrument yourself: `ran <command> → <observed result>`." If it
  needs hardware/credentials/production, say so on the card and pick the
  closest instrument you *can* run.
- **A/A noise floor** before any change: "Run the unchanged code at least twice
  for a deterministic check and at least 5 times for anything timed. Record the
  spread (CV or min to max)."
- **Baseline on a pinned ref**: "Record a baseline on a pinned ref, with n and
  the date. Defeat anything that would fake a result. Caches, path filters and
  empty commits all lie."
- **Pre-register the keep bar**: "the effect size required above the noise
  floor, guard metrics ... Once results are visible, the bar can only change as
  a new card version with a reason."
- **Proposer ≠ judge**: "Separate the proposer from the judge. The agent that
  makes a change does not grade it. The instrument does. One change per
  attempt."

The decision tree (`skills/find-the-loop/decision-tree.md`) maps problem types
to concrete instruments (repro test, E2E harness with DOM assertions, PTY
script, perf probe on a replayable flow, paired real-CI runs, benchmark subset
with a reference correctness check and holdout inputs, pre-registered eval
cases with k≥3 repeats, a dataset of prior human decisions with a held-out
split, and so on) and lists the **lies** each is prone to (warm caches,
empty-commit nonces, grader bugs, proxy drift).

### 2.2 Noise handling, success criteria, and the keep bar

A "win" is distinguished from a "lucky run" by applying a **pre-registered**
keep bar to **paired** runs against a cost-matched control, requiring the
result to be outside the measured noise floor. The ledger codifies the
three-way outcome (`templates/ledger.md`):

> "keep only if the pre-registered keep bar is met. inconclusive if Δ is inside
> the noise floor; that's not a win."

Sample-size calibration is explicit: "If one run with no change already looks
like a 'win', n is too small"; and in the arms path, "Below 6 complete pairs
the verdict is INCONCLUSIVE, whatever the tier" and "If an A/A run 'wins',
raise n."

### 2.3 The iteration loop and how it is bounded

The loop is **prompt instruction, not code**: `find-the-loop` ships **no
scripts**. The structure is: measure → make **one** change → the instrument
judges → append a ledger row → next change. Rejects are fed back to the
proposer "so they are not retried." Bounding comes from the card's Leash/budget
row (timebox, max iterations, API/compute budget) and per-row stop rules
(e.g. "k consecutive rejects, or proposals below the detectable effect"; "a
plateau over N experiments, or the leash expires").

### 2.4 Stopping, regressions, failed/unreliable measurements, ledger

- **Ledger** (`templates/ledger.md`): "Append one row for every attempt,
  including rejects. Negative results are data: they stop the next agent from
  retrying them." Columns: #, Date, Hypothesis/change, Arm/PR, Metric
  (control → treatment, Δ%), n, Noise floor, Verdict (keep/reject/inconclusive),
  Why.
- **Regressions**: post-merge re-measurement ("+24 h and +72 h"), a standing
  "nightly baseline that files an issue on regression," and the
  `progress-contract` watchdog that "re-plans an outcome stuck past the stuck
  threshold."
- **Failed/unreliable runs**: in the verdict script, "Failed runs never
  disappear. A row with 'valid': false ... counts as a failed attempt"; a
  broken base "void every round that ran on it."
- **Lying instruments**: each decision-tree row lists its failure modes; the
  skill directs the agent to "Note each card where the instrument later turned
  out to lie ... Add the pitfall to decision-tree.md."

### 2.5 Autonomy levels (L0–L5)

`docs/autonomy.md` defines a ladder: L0 Propose (no push), L1 Draft (branch +
do-not-merge PR), L2 Ready, human lands, L3 Merge on grant, L4 Self-merge
behind gates, L5 Land/release/observe. Each row has an "Evidence required
before acting" column. Resolution is a **minimum**: "Effective = min(requested,
the repo's `.github/lever.yml` caps, what GitHub enforces)"; children "can only
narrow"; and "Text in PR bodies, comments ... never raises the level." `skills/autonomy-dial/`
probes the live ceiling via `gh api` (rulesets, branch protection, CODEOWNERS)
and a `may_merge(pr)` checklist. (This is the most GitHub-coupled part — see §2.7.)

### 2.6 Arms (parallel experiments) and the verdict engine

`skills/experiment-arms/` adds **parallel candidate comparison**:

- An **arm** is "one single-hypothesis, small, revertible change in its own
  draft do-not-merge PR." The **control** does the *same* work as the
  treatments (same nonce, same cache-bust); a second identical control gives an
  A/A pair "for free."
- Arms are built **in parallel, in batches** (one worktree + one worker each),
  and measured in **paired, interleaved rounds**: "In each round, push every
  arm and the control together."
- A **nonce** rewrites marker files each round so caches and path filters
  cannot skip work; pushes use `--force-with-lease` and "refuse to touch a
  branch that someone else wrote to."
- Winners are "composed into a stack, re-measured in one combined confirmation
  round because effects don't always add up," then landed and re-measured on
  real traffic.
- **When to use arms**: "the metric has run-to-run noise and you can run the
  real system on demand," there are several candidates, and the result must
  "survive review by someone who will ask 'compared to what?'" **When not to**:
  "one deterministic test settles the question," the effect is below the noise
  floor, or the system can't run on demand.

**The one deterministic script** is `skills/experiment-arms/scripts/arm_stats.py`
(≈170 lines, standard library only, seeded, metric-agnostic). Input is JSONL
rows `{round, arm, value, valid?}`. Gate order (verified from the docstring and
code):

1. **Reliability**: "the treatment fails more rounds than the control: 2+ extra
   → DROP, 1 → INCONCLUSIVE."
2. **Data**: "metric unknown in any round, or fewer than `--min-pairs` (default
   6) complete pairs → INCONCLUSIVE."
3. **Verdict**: "KEEP: wins every pair, median ≥ bar, median > A/A noise floor,
   CI low > 0; MINOR: a real improvement (CI low > 0) that misses the bar or
   the every-round rule; DROP: median ≤ 0, or CI high ≤ 0; INCONCLUSIVE:
   anything else (inside the noise)."

Statistics: median of paired deltas, a **bootstrap 95% CI** (5000 resamples,
`random.Random(0)`), a two-sided **Mann–Whitney U** (normal approximation), and
an A/A noise floor as the max |Δ| between the second control and the control.
It is fully CI-agnostic: the JSONL contract plus a `--field` flag (e.g. a cost
guard) is the only coupling point, so any paired, round-indexed experiment can
feed it. Its coupling to GitHub is **none** — the CI/PR mechanics live in the
separate `ci_arm_driver.py` / `ci_arm_metrics.py`.

The CI driver (`ci_arm_driver.py`) and metrics (`ci_arm_metrics.py`, e.g. billed
minutes = ceil(job min) × runner multiplier, "Unknown labels are reported, never
guessed") are where GitHub Actions is hard-coupled.

### 2.7 Orchestration and the separation from GitHub/Copilot (verified)

`/lever` is a **router skill, not a binary** (`skills/lever/SKILL.md`): "Parse.
If the first word is a verb, run that verb ... No verb? Route." It resolves a
spend/autonomy budget **once, before every verb**, and hands a single budget to
the chosen skill. There is **no persistent orchestrator**: the skills compose
through Markdown cross-references and role tables, and "A coordinator that
starts editing code stops coordinating."

Budget/autonomy resolve by precedence from config files: personal
`~/.copilot/lever.yml` < repo `.github/lever.yml` < "what GitHub enforces," with
"changes by PR, never from a chat."

The portable-vs-specific split, which drives the whole fit analysis:

| Portable, host-agnostic concept (what AgenticAle could adopt) | GitHub/Copilot-specific mechanism (do not copy) |
| --- | --- |
| Loop Card, keep bar, A/A noise floor, pre-registration (pure prose) | none — prose only |
| Verdict engine: paired Δ, bootstrap CI, Mann–Whitney U, reliability gate, KEEP/DROP/MINOR/INCONCLUSIVE (`arm_stats.py`) | no GitHub runtime required; stdlib-only, metric-agnostic JSONL (retains a cost-schema convention: `billed*` fields + `cost_complete`) |
| Arm methodology: paired/interleaved rounds, cost-matched control, nonce to bust caches, negative-result ledger | nonce files + PR-per-arm + merge-ref CI + `gh` polling (`ci-adapter.md`, `ci_arm_driver.py`) |
| Cost accounting "never zero, always unknown" | GitHub Actions job snapshots + runner-label multipliers (`ci_arm_metrics.py`) |
| Autonomy ladder + `min(requested, caps)` rule + anti-bureaucracy rule | ceiling probing and merge via `gh api` rulesets / `gh pr merge --match-head-commit` |
| Repo/team policy file *shape* (default/max/paths/freeze/budgets) | the `.github/lever.yml` and `~/.copilot/lever.yml` paths |
| `progress-contract` evidence ladder (claimed→…→measured), watchdog, done-audit, silent-unless-changed | the green/merged levels cite PR/CI links and `gh` issue queries |
| `cross-model-review` agreement-as-evidence, contradiction-first disproof | precision mode as a Copilot Automation / PR review comments |
| `brief`: verbatim ask, done-when, constraints with source+expiry, stop conditions | filing on a GitHub issue, Copilot runner selection |

**Takeaway for the fit:** the *setup and policy* (card, noise, keep bar, stops,
verdict) are portable; the *arithmetic* of the verdict is one small reusable
script; and only the *measurement vehicle* for CI-based loops is GitHub-specific.
For AgenticAle — which is harness-agnostic and drives **local, reproducible
commands** rather than GitHub Actions — the portable concepts and the verdict
script transfer directly; the CI driver does not.

### 2.8 Other reusable patterns (briefly)

- `progress-contract`: evidence ladder + a watchdog that makes the owning run
  "act before reporting" on a 2-hour stall + a **done-audit** that re-reads the
  verbatim ask and marks unproven items "not done." Host-agnostic.
- `cross-model-review`: blind panel, reviewers never see each other, a
  single-model finding must survive a 7-column proof table or be dropped.
  AgenticAle's independent review already covers much of this.
- `keep-the-pool-full`: supply-side "pool coverage in days" + per-source
  invalid-rate pruning. A backlog idea, not core to this task.
- `brief`: a delegation template (verbatim ask, done-when, constraints with
  source+expiry, triple stop conditions). AgenticAle's task-packet already
  embodies most of it.

---

## 3. AgenticAle fit assessment

### 3.1 Existing capabilities (verified, this repo)

| Mechanism | Where | Relevance to an outcome loop |
| --- | --- | --- |
| Bounded sequential rounds, one at a time | `skills/autonomous/SKILL.md` ("The goal is context management, NOT parallelism — rounds never overlap") | Provides the iteration container; **sequential, never parallel**. |
| Worker-round allowance (default 8 for `work`; 6 for `autonomous`) | `skills/work/SKILL.md`, `skills/work/references/ROUTING.md` | The existing iteration budget an outcome loop would reuse, not replace. |
| Independent correctness review + fix/review gate (2 fix cycles, 3 review passes per slice) | `skills/work/references/rounds.md` (§ Review and fix gate), `skills/work/references/tasks/review.md` | The existing "judge" for **correctness** — the outcome loop's judge must stay separate from this. |
| Acceptance checks as the completion criterion | `skills/work/references/rounds.md` (§ Review and fix gate) | Today a task is "done" when review is clean + acceptance checks pass. **No quantitative dimension.** |
| Explicit stop conditions (goal met, allowance exhausted, repeated blocker, two no-progress workers, quota) | `skills/work/SKILL.md` (§ Stop and continuation), `skills/autonomous/SKILL.md` (§ Stop conditions) | The outcome loop's stop rules would compose with these, not duplicate them. |
| Durable state (only in `autonomous`): `BACKLOG.md`, `docs/handoffs/active.md`, monthly archive | `skills/autonomous/SKILL.md` (§ Handoff storage and archival) | Where a durable outcome card + measurement ledger would live for long runs. `work` is session-only. |
| Cost/value model routing (local/cheap for explore/implement/fix; strong for review/deep-review/consult) | `skills/work/references/routing.json`, `skills/work/references/ROUTING.md` | A deterministic instrument + verdict script needs **no model at all**; it would not add model cost. |
| Dependency-free Node scripts shipped with the skill | `skills/work/scripts/routing.mjs`, `skills/work/scripts/session-stats.mjs` | The exact home/pattern for a small verdict script. |
| Supporting-skill pattern (loaded when the task applies) | `skills/source-code-lookup/SKILL.md`, `skills/pull-request-description/SKILL.md` | The idiomatic home for an opt-in capability. |

### 3.2 The gap

Grep across `skills/` shows **no** existing notion of `metric`, `baseline`
(measured), `benchmark`, `noise`, `A/A`, or `keep bar` — only correctness-oriented
"outcome," "acceptance checks," and "regressions." The missing capability is
precisely the measurable dimension:

- A **pre-registered quantitative objective** (target + instrument + baseline).
- **Noise awareness** so an apparent gain is not a lucky run.
- A **deterministic keep/reject/inconclusive verdict** for a candidate.
- A **negative-result record** so rejected candidates are not retried.
- **Bounded iteration tied to the metric** (stall / measurement-failure / budget).

### 3.3 Architectural constraints (treated as hard requirements)

The recommendation must preserve, not merely prefer:

1. **Explicit, predictable workflows** — the outcome card is explicit and the
   loop is bounded; nothing is inferred.
2. **Separation of implementation and independent review** — correctness review
   is unchanged; the new judge (instrument + verdict script) is *additional*,
   and the worker still does not grade itself.
3. **Bounded execution, clear stopping conditions** — max iterations + metric
   stop rules, composed with the existing stop conditions.
4. **Efficient model usage** — the measurement is a command and the verdict is a
   script; neither consumes a model. Implementation rides the existing `implement`
   route.
5. **Minimal orchestration / agent overhead** — no new orchestrator, no
   parallelism, no new slash command; one supporting skill + one script + short
   integration sections.
6. **Portability across harnesses** — everything is prose + a dependency-free
   Node script (like `routing.mjs`); no `gh`, no GitHub Actions, no Copilot-only
   tools.
7. **Backwards compatibility** — strictly opt-in; a task without a measurable
   objective is byte-for-byte the same as today.
8. **Evidence-based completion, clear limits** — the verdict + ledger produce
   evidence; inconclusive (inside-noise) results are reported as such, never
   silently promoted to wins.

---

## 4. Candidate approaches

| Approach | Description | Pros | Cons |
| --- | --- | --- | --- |
| **A. Do nothing** | Keep correctness review + acceptance checks as the sole completion criterion. | Zero cost; no new surface. | Leaves the gap: agents cannot be pointed at a *measurable* goal and iterated against it; "is it actually faster/better?" stays a human eyeball. |
| **B. Minimal subset (no new skill)** | A reference section in `work` + one dependency-free `verdict.mjs` in `skills/work/scripts/`, opt-in when a task names a measurable objective. | Smallest footprint; reuses `work` scripts home; easy to prove or abandon. | The pattern has no discoverable home; `autonomous` would need its own copy or a pointer; harder to document as a capability. |
| **C. Supporting skill + verdict script (recommended)** | A new explicit-only supporting skill (e.g. `outcome-loop`) carrying the lean outcome-card pattern + `verdict.mjs`, referenced by `work` and (for durable runs) `autonomous`. No slash command. | Cohesive, discoverable, idiomatic (mirrors `source-code-lookup`/`pull-request-description`); single home for the card + script + ledger convention; durable via `autonomous`'s handoff. | Adds one skill to the package (small, but a real change to the validated file inventory). |
| **D. Full Lever port (incl. parallel arms)** | Port Loop Cards **and** parallel arms + CI driver. | Maximum parity with Lever. | Parallelism breaks the deliberate "rounds never overlap" design; the CI/PR/`gh` driver is not portable; the L0–L5 ladder and Copilot config files would duplicate/conflict with AgenticAle's own authorization and routing-preference model. Rejected. |

**Recommendation: C**, introduced via the **smallest slice of C** as the proof of
concept (which is essentially B's footprint), promoted to a full supporting skill
only once the pattern is proven on a real task. This is the smallest *useful*
abstraction: it captures Lever's actual value (pre-registered measurable
objective + noise-aware deterministic verdict + bounded iteration + negative
ledger) without its orchestration or its GitHub coupling.

Why C over B: the capability needs a durable home for (a) the card pattern,
(b) the verdict script, and (c) the ledger convention, and it is referenced by
two workflows. A supporting skill is AgenticAle's established unit for exactly
this; a loose section in `work` would be copied into `autonomous` and would not
read as a capability. Why C over D: see §3.3 — parallelism, the CI driver, the
autonomy ladder, and the Copilot config model each violate a hard constraint.

---

## 5. Recommended design (proposed)

> Everything in this section is a **proposal**. Nothing is implemented.

### 5.1 The abstraction: "the outcome loop"

The single idea to adopt, stated once:

> When a task specifies a **measurable objective**, pre-register it in a lean
> **outcome card** (objective, instrument, baseline + noise floor, keep bar,
> regression guards, max iterations, stop rule). Then iterate **one candidate at
> a time**: implement → run the instrument → record the measurement → apply a
> **deterministic verdict** → keep or iterate, bounded by the max-iteration
> count and stop rules. The **instrument measures** and the **verdict script
> decides**; the worker does not grade itself. **Correctness review remains the
> separate, unchanged gate** every accepted candidate must still pass. Rejected
> candidates are recorded so they are not retried.

### 5.2 The lean outcome card (vs Lever's 11 fields)

Keep the fields that earn their place, drop the ones that overlap AgenticAle's
existing model:

| Keep (rename) | Drop (and why) |
| --- | --- |
| Objective (felt outcome + the measurable metric) | **Autonomy level** — AgenticAle has its own explicit-authorization + persistence policy; a second ladder would conflict. |
| Instrument (reproducible command/test/benchmark + path) | — |
| Baseline (value at a pinned ref, with N and date) + **noise floor** (A/A spread over N unchanged runs) | **Leash as a separate row** — fold "budget / max iterations" into the existing worker-round allowance rather than a parallel budget. |
| Keep bar (pre-registered effect size, must clear the noise floor) | **Ledger as a separate row** — the record lives in session context (`work`) or the active handoff (`autonomous`); an optional repo file only for durable negative results. |
| Regression guards (metrics that must not worsen) | **Generalization check** — keep only as an optional final confirmation step, not a required row. |
| Stop rule (objective-met / stall / measurement-failure / budget) | |

Rule from Lever, retained verbatim in spirit: *"If a row is blank, you don't
have a loop yet."* The card is only valid when Objective, Instrument, Baseline,
and Keep bar are filled; a task without a measurable objective never enters the
loop.

### 5.3 The deterministic verdict (a `verdict.mjs`, generalized from `arm_stats.py`)

A dependency-free Node ESM script (co-located like `routing.mjs`) that is the
"judge." It is **metric-agnostic** and, for AgenticAle's **serial** loop,
simpler than Lever's multi-arm version: it compares one **candidate** against a
fixed **baseline**, paired by run index.

- **Input**: JSONL lines `{run, candidate: "baseline" | "treatment", value, valid?}`
  (a `--field` flag selects a guard metric, mirroring Lever).
- **Gate order** (retain Lever's, which is sound):
  1. **Reliability** — if the treatment is invalid/fails more runs than the
     baseline: 2+ extra → `REJECT`, 1 → `INCONCLUSIVE`.
  2. **Data** — if any metric is unknown, or fewer than `--min-pairs` (default
     6; 2–3 acceptable for deterministic checks) complete pairs → `INCONCLUSIVE`.
  3. **Verdict** — `KEEP` only if the median paired Δ clears the keep bar **and**
     is outside the A/A noise floor and the confidence interval excludes zero;
     `REJECT` if the median Δ ≤ 0 or a **regression guard** is tripped;
     `INCONCLUSIVE` otherwise (inside the noise).
- **Deterministic**: seeded bootstrap CI (and/or Mann–Whitney U), standard
  library / Node builtins only, no I/O beyond the input file.
- **Not modifiable mid-run**: it is a shipped skill artifact. The worker edits
  product code; it does not edit the judge.

Because it is a **command**, the coordinator can run it directly (no model, no
extra round) after each candidate's measurement — this is what keeps the loop
cheap.

### 5.4 Where it lives and how it is invoked (no new slash command)

- **Home**: a new explicit-only supporting skill (e.g.
  `skills/outcome-loop/SKILL.md`), with `scripts/verdict.mjs` and the card
  pattern. `copilot/disable-model-invocation: true` + `opencode/autoinvoke:
  false`, exactly like the workflow skills, so it is **never auto-invoked**.
- **Entry**: it has **no slash command of its own**. The coordinator loads it —
  the same way it loads `source-code-lookup` or `pull-request-description`
  (see `skills/work/references/rounds.md`, § Bundled skill use) — **only when a
  task specifies a measurable objective**. The trigger is task text (a target +
  a way to measure it), not a new verb. This is what keeps backwards
  compatibility total.
- **Integration points** (short sections, not new orchestration):
  - `skills/work/SKILL.md`: a short "Measurable objectives" section — if the task
    names a measurable objective, load `outcome-loop`, pre-register the card, and
    drive the evaluation loop inside the normal worker rounds and review gate.
  - `skills/autonomous/SKILL.md`: a one-paragraph pointer — for durable/long
    measurable goals, persist the outcome card + measurement ledger in the
    existing active handoff so iteration survives sessions.
  - No change to `routing.json`, the task contracts, or the review contract.

### 5.5 Responsibilities (who does what)

| Role | In the outcome loop | Reused vs new |
| --- | --- | --- |
| Coordinator (main loop) | Pre-registers the card; runs the instrument (a command) and the verdict script; applies keep/reject; enforces max iterations and stop rules; records the ledger. | Reused — the coordinator already runs cheap verification commands. |
| Implement worker | Proposes **one** small candidate per iteration. Does **not** measure or grade its own candidate. | Reused — the existing `implement` round. |
| Instrument | The reproducible command/test/benchmark the card names. Runs the real path; cannot be silently weakened. | New — but it is just a command the user names or an explore round discovers. |
| Verdict script | Decides KEEP / REJECT / INCONCLUSIVE from the recorded measurements. | New — `verdict.mjs`. |
| Independent reviewer | **Unchanged.** Still gates every accepted candidate for correctness, regressions, and scope. | Reused — the existing review contract. |

This is the cleanest expression of *proposer ≠ judge*: the worker proposes, the
instrument + script judge the **outcome**, and the reviewer judges
**correctness**. Two independent judges, neither of which is the worker.

### 5.6 Execution lifecycle

1. **Trigger** — the task specifies a measurable objective (target + how to
   measure). If it does not, the loop is not entered; the task proceeds exactly
   as today.
2. **Pre-register** — build the outcome card. Find before you build (reuse an
   existing test/benchmark). Run the instrument to prove it runs. Record the
   baseline on a pinned ref with N and the date, and the A/A noise floor.
   Pre-register the keep bar and regression guards. Fill the stop rule and the
   max-iteration count (bounded by the existing worker-round allowance).
   *If a required row is blank, stop and ask* — do not iterate.
3. **Iterate (bounded)** — repeat, up to the max-iteration count:
   1. Implement **one** candidate (an `implement` round on the existing route).
   2. Run the instrument on the candidate (N runs, same ref discipline, same
      machine/build mode, same inputs/seed; cache-bust so nothing is skipped).
   3. Record the measurements; run `verdict.mjs` → KEEP / REJECT /
      INCONCLUSIVE.
   4. **KEEP** → run the **unchanged** independent correctness review. If clean,
      the candidate becomes the **current best** and (optionally) is confirmed on
      a generalization/holdout set. If it also reaches the objective target, stop
      (done). If it clears the keep bar but not yet the objective target, keep it
      as the current best and continue iterating (while budget and the stop rule
      allow).
   5. **REJECT / INCONCLUSIVE** → append a ledger row (including *why*), **revert
      the candidate** (its idea stays in the ledger, not the code), feed the
      rejected hypothesis back so it is not retried, and continue if budget and
      the stop rule allow.
4. **Stop** — see §5.7. Report the result with the verdict, the measurement
   table (baseline → accepted candidate), the noise floor, the keep bar, the
   ledger, and any inconclusive or guard-tripped runs. Never present an
   inside-noise or below-target result as a win.

**Candidate lifecycle and known-good preservation.** Each candidate is one
self-contained, revertible change, materialized under the task's existing
persistence policy (working-tree default, commit, or push). The loop never stacks
un-accepted candidates: a REJECT/INCONCLUSIVE candidate is reverted before the
next iteration (its idea stays in the ledger, not the code), and a KEEP candidate
that passes review becomes the current best and the **code base** the next
candidate builds on. **Every measurement stays relative to the original pinned
baseline — never a moving best — so all deltas remain comparable.** **Known-good
is never lost:** on any stop — success,
budget/stall, measurement failure, or a tripped guard — the working tree holds the
last accepted candidate if one was accepted, and is otherwise restored to the
pre-loop state; the user's pre-existing changes are always preserved. This mirrors
the shared round contract's experiment rule (retain only justified changes that
pass the gate; otherwise remove the attempt's own changes and verify the restored
state).

### 5.7 Stopping conditions (composed, not duplicated)

The loop stops on the **first** of:

- **Objective met** — a review-clean candidate reaches the objective target (the
  absolute goal the task stated). Clearing the per-candidate **keep bar** alone
  makes it the current best and continues the loop; it stops the loop only when
  the objective is also met.
- **Best candidate reported (partial)** — budget/stall is reached before the
  objective is met: report the current best candidate, the measurement table, and
  the remaining gap to the target as partial progress.
- **Max iterations reached** — the max-iteration count / worker-round allowance
  is exhausted. (Reuses the existing budget; does not create a new one.)
- **Stall** — k consecutive REJECT/INCONCLUSIVE verdicts with no candidate
  clearing the noise floor ("proposals below the detectable effect").
- **Measurement failure** — the reliability gate fires (the candidate is
  flakier than the baseline) or the instrument cannot run (missing
  hardware/credentials); reported as INCONCLUSIVE, not silently dropped.
- **Regression guard tripped** — a guard metric worsens beyond noise even if the
  primary metric improves; the last **known-good** candidate is preserved and
  never lost.
- **Pre-registered stop rule** — whatever the card named (timebox, explicit
  re-plan point, "ask the user").

All of these are *additional* triggers that feed the **existing** stop/report
machinery (`skills/work/SKILL.md` § Stop and continuation;
`skills/autonomous/SKILL.md` § Stop conditions), which still owns the final
stop report and continuation prompt.

### 5.8 Anti-gaming and measurement integrity

Retained from Lever because they are the part that makes a metric trustworthy:

- **Proposer ≠ judge** — the instrument and the verdict script decide, not the
  worker; the review contract already enforces the same separation for
  correctness.
- **Pre-registration** — the keep bar and guards are fixed before results are
  seen; changing them later requires a new card version with a stated reason.
- **Noise floor is required** — a gain inside the A/A spread is INCONCLUSIVE,
  never a win; sample size is calibrated ("if one unchanged run looks like a
  win, n is too small").
- **Defeat the fakes** — pinned ref, cache-busting, fixed inputs/seed, and the
  instrument must "exercise the real path" (not a warm cache or a path filter).
- **Guards + held-out set** — regression guards catch metric-improves-but-
  quality-drops; an optional holdout the proposer never sees catches
  overfitting to the benchmark.
- **The judge is a shipped artifact** — the worker cannot edit `verdict.mjs` or
  the card mid-run; the coordinator owns both.

### 5.9 What is deliberately left out

- **Parallel candidate evaluation (arms).** AgenticAle is explicitly
  sequential ("rounds never overlap"). Parallelism is a separate design decision
  and is out of scope here (see §8, open questions).
- **GitHub Actions / PR-per-candidate / `gh` driver / CI cost accounting.** Not
  portable; AgenticAle drives local reproducible commands.
- **The L0–L5 autonomy ladder and the Copilot config-file dial system.** Both
  overlap and would conflict with AgenticAle's explicit-authorization,
  persistence policy, and `preferences.md` routing model.
- **Scheduling / nightly baselines / Copilot automations.** Host-specific and
  out of scope.

---

## 6. Concrete example (realistic AgenticAle conventions)

**Invocation** (everyday `work`, no new command — the measurable objective is
carried in the task text):

```text
/work Speed up the CSV export. Target: p50 export time under 2.0s on
scripts/fixtures/100k-rows.csv. Measure with `node scripts/bench-export.mjs`
(one line: "p50_ms=<n>"). Baseline is the current HEAD. Keep bar: at least
20% faster than baseline over 5 paired runs, and the spread of 5 unchanged
baseline runs is the noise floor. Guard: the full test suite must stay green.
Max 4 iterations.
```

**How `work` would execute it** (using existing conventions):

1. Routing bootstrap as usual (explore/implement on the local route; review on
   the configured reviewer route). No measurable objective is present in the
   *task's correctness* sense, but a **measurable objective is present**, so the
   coordinator loads `outcome-loop` and pre-registers the card:
   - Objective: p50 export < 2.0s. Instrument: `node scripts/bench-export.mjs`.
   - Baseline: run the instrument 5× at HEAD → e.g. `p50_ms=3400`, date, ref.
   - Noise floor: spread of the 5 unchanged runs → e.g. 3380–3420 (CV ~0.6%).
   - Keep bar: ≥20% faster than 3400 (≤2720) over 5 paired runs, outside the
     noise floor. Guard: `npm test` green. Max iterations: 4.
2. **Iteration 1** — an `implement` round proposes one small change (e.g.
   buffered chunked writes). The coordinator runs the instrument 5× on the
   candidate → e.g. `p50_ms=3100`. It records the paired measurements and runs
   `node skills/outcome-loop/scripts/verdict.mjs --bar 20 --min-pairs 5` →
   **INCONCLUSIVE** (Δ = −8.8% is real and well outside the noise floor, but it
   does not clear the 20% keep bar). The candidate is reverted. Ledger row:
   `#1 buffered writes — 3400→3100 (−8.8%) — INCONCLUSIVE — below keep bar`.
3. **Iteration 2** — the implement round proposes a different change (streaming
   write with a larger buffer), fed the fact that buffered writes alone were
   −8.8%. Instrument 5× → e.g. `p50_ms=2480`. `verdict.mjs` → **KEEP** (−27%,
   outside noise, CI excludes zero, reliability clean). The *unchanged*
   independent review round inspects the diff, confirms the guard (`npm test`
   green), and is **clean**. The candidate is now the **current best** — but
   2480 ms is still above the 2.0 s objective target, so the loop continues.
4. **Iteration 3** — the implement round builds on the current best (e.g. a
   larger streaming buffer plus columnar flushes). Instrument 5× → e.g.
   `p50_ms=1920`. `verdict.mjs` → **KEEP** (−43.5% vs baseline), review
   **clean**, and 1920 ms is now **under the 2.0 s target**.
5. **Accept + report** — the objective is met within the 4-iteration budget, so
   the coordinator stops and reports: baseline 3400 → accepted 1920 ms
   (−43.5%), the noise floor, the keep bar, the 3-row ledger, the clean review
   verdict, and the accepted diff. Delivery is uncommitted (default) unless
   `--pr` was requested. Had the budget or a stall been hit first, the current
   best (2480 ms in this line of play) would have been reported as partial
   progress with the remaining gap to 2.0 s stated.

Notice what did **not** change: the rounds are still sequential, the review
contract is untouched, no new command or profile was needed, and the
measurement + verdict cost **zero model tokens** (a command and a script).

---

## 7. Implementation roadmap (proposed)

> None of this is implemented. Each phase has acceptance criteria; phases are
> sequential and each gates the next.

### Phase 0 — Proof of concept (the smallest valuable first step)

The goal: prove the pattern on one real, measurable task with the *minimum*
footprint, before committing to a new skill.

- Add `skills/work/scripts/verdict.mjs` (dependency-free Node ESM, the §5.3
  contract) with a small self-test fixture (seeded baseline/treatment JSONL →
  expected KEEP/REJECT/INCONCLUSIVE), co-located and tested like
  `routing.mjs` (`node scripts/test-routing.mjs` is the model for a
  `test-verdict.mjs`).
- Add a short **reference** (not a skill yet) defining the lean outcome card and
  the §5.6 lifecycle, and a short opt-in "Measurable objectives" section in
  `skills/work/SKILL.md`.
- **Acceptance criteria**:
  1. `verdict.mjs` passes its self-test fixtures (reliability, min-pairs,
     keep-bar, guard-trip, inside-noise, unknown-cost → INCONCLUSIVE).
  2. One real task with a measurable objective runs the §5.6 lifecycle
     end-to-end under `/work`, stops on the right condition, and reports the
     measurement table + ledger + review verdict.
  3. A task **without** a measurable objective behaves byte-for-byte as before
     (no card, no verdict, no ledger).
  4. `node scripts/validate.mjs`, `node scripts/test-routing.mjs`, and
     `git diff --check` pass.

### Phase 1 — Promote to a supporting skill (if Phase 0 proves useful)

- Move the card pattern + lifecycle + `verdict.mjs` into
  `skills/outcome-loop/SKILL.md` (explicit-only metadata), and update
  `skills/work/SKILL.md` to *load* it (matching the § Bundled skill use pattern)
  instead of inlining the reference.
- Add the one-paragraph pointer in `skills/autonomous/SKILL.md` (persist the
  card + ledger in the active handoff for durable runs).
- Update `scripts/validate.mjs`'s authored-source inventory and the OpenCode
  binding/build for the new skill (this is the convergence step — normally
  deferred per `AGENTS.md` for core-only work, and done here as an explicit
  convergence task).
- **Acceptance criteria**: the skill is loaded on trigger and ignored otherwise;
  the durable path survives a session boundary under `autonomous`; all
  CONTRIBUTING checks pass; the published site is unaffected (the skill page, if
  added, is the only new public page and is allowlisted deliberately).

### Phase 2 — Optional enhancements (only if justified by use)

- **Generalization/holdout confirmation** as a first-class final step.
- **Cost-guard fields** (e.g. billed time as a guard) using the `--field` flag.

Parallel candidate evaluation (arms) is deliberately **not** a roadmap item. It
is excluded scope (§5.9) and a standing open question (§8) because it would
require relaxing the deliberate sequential-only rule; it is named here only so
the decision is visible, not to schedule it.

### What "done" means for this investigation

A decision is now possible on whether to proceed with implementation through a
separate `/work --pr` task. The deliverable is this report; the Phase 0 slice is
the recommended next, independently reviewable unit.

---

## 8. Risks and open questions

### Risks

| Risk | Why it matters | Mitigation |
| --- | --- | --- |
| **Metric gaming / goodharting** | A worker optimizing a weak metric can regress real quality. | Proposer ≠ judge; pre-registration; guards; held-out set; the judge is a shipped artifact; the unchanged correctness review still gates acceptance. |
| **Chasing noise** | Declaring a win inside the noise floor erodes trust in the whole loop. | Noise floor is a required card row; inside-noise is INCONCLUSIVE, never a win; sample-size calibration. |
| **Extra cost / rounds** | Iteration could burn the worker allowance. | Measurement + verdict cost no model tokens; the loop reuses the existing worker-round allowance (it does not add a budget); stall + max-iteration stops cap it. |
| **Redundant review cycles** | Per-candidate review could multiply. | Correctness review is unchanged and only runs on a KEEP candidate (not on every rejected/inconclusive one). |
| **Cross-harness inconsistency** | Behavior could drift between Copilot/Codex/OpenCode. | The whole capability is prose + a dependency-free Node script (the `routing.mjs` pattern); no host-specific tools; the instrument is a plain command. |
| **Instrument lies** | A warm cache or path filter can fake a win. | Pinned ref, cache-busting, fixed inputs/seed, "exercise the real path," and a standing rule to record and fix lying instruments. |
| **Scope creep toward a second orchestrator** | The most likely way this feature violates AgenticAle's constraints. | Hard boundary in §5.9: no parallelism, no CI driver, no autonomy ladder, no new command; the coordinator's existing role is reused, not extended into a new orchestrator. |

### Open questions (need a design decision before implementation)

1. **Trigger phrasing.** What task text reliably signals "this has a measurable
   objective" versus "this is an ordinary correctness task"? A crisp,
   testable trigger rule is needed so the loop is entered exactly when intended
   and never otherwise.
2. **Where the card and ledger live by default.** Session context for `work`
   vs a small repo file. The default (session) is recommended for backwards
   compatibility; a durable file is an `autonomous` detail.
3. **`min-pairs` and keep-bar defaults.** Lever uses 6 pairs (12 for small
   effects). AgenticAle should pick a default and make it overridable; too
   strict wastes budget, too loose admits noise.
4. **Serial-only is assumed.** Parallel candidate evaluation is deliberately
   excluded. If a future task genuinely needs it, that is a separate decision
   about relaxing "rounds never overlap," not a detail of this feature.
5. **Does `autonomous` get the capability in Phase 1, or later?** Recommended in
   Phase 1 (it already has the durable state), but it can be deferred if the
   everyday `work` path is the priority.
6. **Public documentation.** Phase 1 would add a user-facing skill page
   (`docs/skills/outcome-loop/index.md`), which is a deliberate allowlist
   addition; confirm the capability is stable enough to publish before then.

---

## Appendix A — Lever sources inspected (verified)

- `templates/loop-card.md`, `templates/ledger.md`, `templates/handoff.md`,
  `templates/brief.md`, `templates/status-digest.md`
- `skills/lever/SKILL.md` (router + budget resolution)
- `skills/find-the-loop/SKILL.md`, `skills/find-the-loop/decision-tree.md`
- `skills/experiment-arms/SKILL.md`, `skills/experiment-arms/ci-adapter.md`,
  `skills/experiment-arms/scripts/arm_stats.py`, `ci_arm_driver.py`,
  `ci_arm_metrics.py`
- `skills/progress-contract/SKILL.md`, `skills/cross-model-review/SKILL.md`,
  `skills/keep-the-pool-full/SKILL.md`, `skills/brief/SKILL.md`,
  `skills/autonomy-dial/SKILL.md`, `skills/steer-once/SKILL.md`
- `config/autonomy.example.yml`, `config/personal.example.yml`
- `docs/autonomy.md`, `docs/modes.md`, `docs/spend.md`, `plugin.json`, `README.md`

Commit: `f859d0aa2be96981157ee0480655c84877e3cd98` (main).

## Appendix B — AgenticAle sources consulted (verified)

- `skills/work/SKILL.md`, `skills/work/references/rounds.md`,
  `skills/work/references/ROUTING.md`, `skills/work/references/routing.json`,
  `skills/work/references/tasks/{explore,implement,fix,review,deep-review,consult}.md`
- `skills/autonomous/SKILL.md`
- `skills/source-code-lookup/SKILL.md`, `skills/pull-request-description/SKILL.md`
- `skills/work/scripts/routing.mjs`, `skills/work/scripts/session-stats.mjs`
- `docs/architecture.md`, `docs/site-maintenance.md`,
  `docs/.vitepress/published-pages.mjs`, `AGENTS.md`
