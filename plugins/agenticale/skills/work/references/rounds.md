# Shared round contract

Both `work` and `autonomous` use this contract. The invoking workflow supplies state storage, user interaction rules, Git policy, and budget limits; never infer durable files or Git rights from a role name.

## Bundled skill use

Load bundled skills by exact ID (or read their full `SKILL.md`) before doing that part of the work; mentioning a skill name is not loading it. If a required skill cannot be loaded, report the gap rather than inventing guidance.

- `pull-request-description`: read [the skill](../../pull-request-description/SKILL.md) before drafting or revising a PR body.
- `source-code-lookup`: read [the skill](../../source-code-lookup/SKILL.md) when behavior in a dependency, external service, or another codebase matters (skip for ordinary navigation in the current repo). Keep quick lookups inline; route substantial external-source investigation through `explore` with the question, stop condition, known repo/version/symbol evidence, and constraints. A worker needing a separate external investigation returns the question and facts to the coordinator rather than spawning children.

## Task packet

Give each fresh child everything needed for one bounded round without sending the full conversation:

- Repository path, branch, and applicable repo instructions (`AGENTS.md` when present).
- User outcome, this round's scope, acceptance checks, and stop boundary (for decomposed work: prior accepted outcomes, invariants to preserve, and deferred work — never permission to implement later slices).
- Relevant file paths, facts, and useful failed approaches.
- `source-code-lookup` trigger above so the child loads it if external code becomes relevant.
- Starting state with content evidence and exact commit/diff scope, naming any pre-existing changes to preserve.
- Git policy and authorization; state policy (session = report only, no operational files; autonomous = specified snapshot/handoff rules).
- Remaining worker-round allowance (and run ceiling in Autonomous Mode).
- Verification commands, prior blocking findings by ID (for re-review/fix), and the expected report format.

For reviews, include original acceptance criteria and label worker claims as unverified.

## Sequential decomposition

Split a bounded task into a short sequence of verifiable slices only when an early slice resolves a material uncertainty, establishes a dependency contract, or keeps review scope coherent — never by file count alone. Keep straightforward changes as one slice.

Keep the original goal and overall acceptance criteria stable. Define only the useful next slices, verify and gate each changed slice before starting the next, reassess assumptions and remaining budget at every boundary, and verify combined cross-slice interactions before delivery. Read [decomposition.md](decomposition.md) before splitting a task into multiple slices or running a code experiment.

## Checkpoints, decision summary, and stop reports

After every substantive child result, checkpoint before the next dispatch: what is verified vs. unverified, whether assumptions or scope changed, whether a local fix suffices or the plan needs adjustment, and remaining budget.

Before each substantive dispatch (including the first), give the user a short 1–3 sentence plain-language **progress narration**: what was learned, what comes next, and why. Avoid stock labels ("Checkpoint", "Dispatching"), internal chain-of-thought, or reciting routine dispatch logs. Distinguish child claims from verified evidence, and omit model IDs unless diagnosing a limitation or asked. Skip duplicate narration when the result ends the task.

Every incomplete stop (exhausted budget, stall, oscillation, quota exhaustion, unresolved blocker, or blocked delivery) must include a self-contained, copyable **continuation prompt**: outcome and blockers with evidence, actual repo/branch/commit/working-tree state and what to preserve, next recommended action, remaining checks/review, and exact delivery target and Git permissions. A fresh session must re-inspect the checkout rather than trusting the prompt blindly.

## Roles and reports

The coordinator delegates implementation; children run unattended, never ask the user directly, and never spawn nested children. Make reasonable reversible assumptions within scope (recorded as assumptions) or return a `BLOCKER`.

- **Workers** report `STATUS` (`done | progress | blocked`), compact `SUMMARY`, `EVIDENCE` (commands run + git status/diff/commits), `TRIED`, `NEXT`, and `BLOCKER` if blocked.
- **Reviewers** report `VERDICT` (`clean | blocking findings`), `BLOCKING` (location, impact, required action), `NITS`, and `EVIDENCE` (independently run commands).

End an unproductive child round after two failed hypotheses or a repeated failure after a targeted fix, or if the task shifts into a different investigation; do not reset productive verification merely on tool count.

## Budgets and loop continuation

- **Single clean worker allowance:** default **24 worker rounds** per task in both `work` and `autonomous`. Worker rounds (`explore`, `implement`, `implement-easy`, `implement-hard`, `fix`) consume the allowance; `review`, `review-deep`, and `consult` do not. An explicit invocation cap or preference setting overrides the default; Autonomous Mode also enforces a run-level ceiling. Replanning, decomposition, or renaming never resets consumed counts.
- **Justified reviews only:** every `review` or `review-deep` round must be justified by changed diff evidence, a required integration gate, interrupted-review recovery, or an explicit user request — never a review-only loop over unchanged code.
- **Continue productive fix loops:** never stop a fix → verify → re-review loop merely because it reached a 2nd, 3rd, or Nth fix round. While worker budget remains and each cycle makes verified progress (closing prior blocking findings, turning failing checks green, or settling concrete blockers), continue unattended.
- **Stop or escalate only on genuine non-convergence:**
  1. **Stall:** 2 consecutive worker rounds make no verified progress (code churn, unverified claims, or unchanged failures) OR hit the exact same blocker twice in a row.
  2. **Oscillation (flip-flopping):** fixing finding A reintroduces finding B (or breaks a previously passing check) across 2 cycles — stop and replan/escalate instead of ping-ponging.
  3. **Reviewer standard drift (only after functional acceptance is green):** all functional and correctness checks pass and no genuine bug or invariant failure remains, yet 4 or more consecutive review rounds keep opening purely stylistic, wording, or moving-goalpost blockers on unchanged behavior — stop chasing them; classify purely stylistic/wording items as non-blocking nits (confirm once with the user in `work` if ambiguous; in `autonomous`, optionally consult once first, then close accepted with documented nits/residuals).
  4. **Repeated root-cause invariant failure:** consecutive rounds failing the same core invariant despite targeted fixes signals a design flaw — stop and replan rather than applying another local patch.
- **Budget exhaustion & incomplete safety stops:** when worker allowance hits 0, dispatch no further worker rounds, still run the required review of the last allowed worker, and if work or blocking findings remain, stop incomplete with a continuation prompt and offer either a simple `+N` additional rounds or stopping. Any limit, stall, oscillation, or unresolved-blocker stop is always an incomplete stop, never a successful completion.

## Routing policy

Routes are configured at install/preference time; workflows never select models directly.

- **`implement` (default):** routine scoped slices needing ordinary implementation judgment.
- **`implement-easy` (optional):** use only when configured AND the slice is explicitly prescribed, bounded, and mechanically verifiable. Unconfigured, fall back to `implement`.
- **`implement-hard`:** dispatch directly (no consult prerequisite) when correctness risk is visible — concurrency/async/cancellation/timing, cross-repo contracts, subtle shared state, security-relevant code, or compatibility surfaces — regardless of task label. Reassess mid-flight if a routine slice exposes such risk.
- **Hard fix:** fix rounds requiring concurrency, durability, state-machine, or ownership reasoning dispatch on `implement-hard` carrying the `fix` contract explicitly in the packet, keeping `fix` role accounting and recording both task role (`fix`) and dispatched role (`implement-hard`).
- **`consult` / `consult-hard`:** read-only task-framing (`--consult`) or second opinion on one bounded complex decision. Use `consult-hard` when configured for conflicting evidence, interacting constraints, or costly reversals; otherwise fall back to `consult`. Both share the single consultation allowance.

Determine whether an optional route (`implement-easy`, `consult-hard`) is configured from authoritative install evidence as the active binding documents, not from profile files alone; when unavailable or ambiguous, the binding's conservative limitation handling applies. Never silently substitute a weaker route when a configured profile is missing or unreadable — block that role and report the binding's refresh procedure. Reassess the route at every slice boundary or resume.

## Dispatch records

Record each round's role, task contract, and (only where native host evidence exposes it) requested vs. effective model in the workflow's existing state. Never trust a child's self-reported model name; keep unknown effective selections unknown. Omit model IDs from ordinary narration unless diagnosing a mismatch/limitation or asked.

## Review and fix gate

Review correctness, regressions, acceptance checks, scope, conventions, and Git/state policy. Reviewers never edit product code. Run targeted checks independently; missing evidence needed to prove acceptance is blocking.

- **No circular validation:** distinguish user requirements from current implementation behavior; never approve broken behavior merely because code matches itself.
- **Scope discipline:** blocking findings identify defects or unmet acceptance; style preferences and optional improvements are non-blocking nits. Distinguish pre-existing issues from task regressions and do not expand scope.
- **Mechanical vs. judgemental rule:** a clearly mechanical change whose entire acceptance is a deterministic check closes when the coordinator runs that check and it passes (no review round unless risk warrants it); if the check fails, repair and re-run it directly without triggering review. After a review round, mechanical findings close via the coordinator running their deterministic check, whereas judgemental findings (behavior, correctness, design) require independent re-review of the fix and touched invariants, tracking each prior finding by ID as `fixed`, `partially fixed`, `still open`, or `regressed`.
- **Closure:** delivery still requires the coordinator to verify the final diff/checks and satisfy the invoking workflow's Git/persistence rules.
