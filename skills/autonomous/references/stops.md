## Stop conditions

Stop the loop and report to the user when any of these hit:

- **Goal met** — every backlog task is completed through its gates, and the applicable final
  gate — the slice's required gate: a review round, or, for a clearly mechanical slice, its
  coordinator-run deterministic check (in standard mode, the slice's normal verification) — plus the
  completion evidence (green tests, persistence policy satisfied, state updated) shows the
  goal is satisfied. Verify with one cheap command, then give the [final
  report](../SKILL.md#final-report-main-loop--15-lines). Blocked,
  exhausted, or otherwise unfinished tasks mean the goal is not met: that is an incomplete
  stop below, never a completed run.
- **Run ceiling exhausted** — an INCOMPLETE safety stop whenever eligible backlog work
  remains; never a successful run completion. Do not dispatch another worker round;
  verification and the permitted review of completed changes still run. Report the exhausted
  run ceiling, what remains, what is completed and blocked, and the recent verified progress.
  Where the host offers an interaction tool, the situation is question-eligible through the
  [anti-ask gate](../SKILL.md#asking-the-user-anti-ask-gate), and reporting the stop is not asking: the
  gate offers the situation-appropriate choices — a bounded replan (its child rounds consume
  allowances), one additional bounded fix-and-review cycle, or a stop that preserves the
  current work — naming the worker and review increments each consumes; without one, state
  the same options in the stop report. A grant on the run
  ceiling or an explicit user review limit is recorded `cap`-flavoured — those boundaries
  never auto-grow — so the stop offers at most a `cap`-flavoured named increment, keeping
  the stop's INCOMPLETE safety-stop character. Persist the allowance
  usage and any granted extension in the snapshot so a resume or renamed target cannot evade
  the unresolved-target limits. A continuation needs a named user grant (see
  [Run and task budgets](budgets.md#run-and-task-budgets)); a consult cannot grant one. A declined or
  unanswered option ends the stop: do not ask again, do not schedule a resume, and leave the
  work preserved. Give the [final
  report](../SKILL.md#final-report-main-loop--15-lines) with the continuation prompt.
- **Completed-task limit reached** — the run has completed its limit of tasks (default 20),
  each counted only after its task persistence gate was fully satisfied. When eligible
  backlog work remains, this is an INCOMPLETE safety stop, never a completed run: report the
  limit, the completed and remaining tasks, and the continuation prompt, and offer the named
  increment a continuation needs (a raised limit, recorded `cap`-flavoured — the limit
  never auto-grows) or a stop that preserves the current work. Listing those options in
the stop report is not asking — reporting the stop is not a question; the interactive
named-increment offer, where it applies, is a distinct question-eligible situation
that proceeds through the [anti-ask gate](../SKILL.md#asking-the-user-anti-ask-gate). When the backlog is
  drained, the normal **Goal met** close
  applies instead.
- **Task allowance exhausted** — not a run stop by itself. The allowance in force is
  exhausted at the progress ceiling or an exact explicit cap, with no further extension
  justified. Dispatch no further worker round for that task; verification and the permitted
  review of its completed changes still run. When the budget question offers the named
  increment a continuation needs, it applies the one leading-option rule keyed to the
  exhausted budget, per the shared
  [Grant flavours](../../work/references/rounds.md#grant-flavours) rule:
  `progress` leads only while the task worker allowance is below its progress
  ceiling, otherwise at most a `cap`-flavoured named increment — that rule, read
  before dispatching, is the full one, and below the ceiling an exact
  `cap`-flavoured boundary is not progress-eligible (a cap boundary offers at
  most a `cap`-flavoured named increment); never lead with an auto-extension
  that cannot take effect; the run ceiling and the
  limits never auto-grow, a run-level stop keeps its INCOMPLETE safety-stop
  character, and verified progress does not override a cap. Keep the unfinished
  part incomplete and
  resumable (findings, current state, one next action), then select another truly independent
  ready task with its fresh allowance when one can be selected safely; otherwise stop under
  **No safe ready work** below. Never bypass a review gate, dependency, or safety boundary to
  keep the run going, and never manufacture a task.
- **No safe ready work** — the current task is complete, deferred, or blocked, and no other
  truly independent ready task can be safely selected while unfinished changes exist. Stop
  with the preserved state, the deferred resumable packets, and the continuation prompt. When
  the stop leaves blocked, exhausted, or otherwise unfinished tasks, the run is explicitly
  incomplete even though no eligible work remains — report it as an incomplete stop, never as
  a completed run.
- **Persistence blocked** — a required commit or push — task product commits, WIP or
  reconciliation checkpoint commits, task state finalization, or the final close — cannot be
  completed safely: an unsafe or ambiguous push destination, a rejected or uncertain push, or
  an explicit restriction conflicting with the requested delivery. Preserve the exact
  persistence state, keep any open task open, and stop with the continuation prompt;
  destination decisions are question-eligible through the
  [anti-ask gate](../SKILL.md#asking-the-user-anti-ask-gate). The stop goes directly to the terminal local-only close
  under **Persist before printing** in [Final
  report](../SKILL.md#final-report-main-loop--15-lines) — no further commits or pushes in this
  run, all further persistence deferred. A resume reconciles the actual local and remote
  state before any next work.
- **Steering pause** — the human-owned steering surface says `pause`. Stop at the safe
  checkpoint: let a running child settle, record its result and charge, preserve the exact
  `NEXT` and all counters, and report the pause with the continuation prompt (see [Live
  steering](steering.md#live-steering)). The pause persists across resumes. No polling, watcher, or service.
- **Blocking findings survive while budget remains** — not a stop: while the
  [anti-ask gate](../SKILL.md#asking-the-user-anti-ask-gate)'s third check holds, continue
  the fix → verify → re-review loop unattended. That check requires the next
  cycle — the next fix and its required re-review — to fit within the
  effective worker budget and leave at least one review available under each
  applicable explicit review limit: when the next cycle would exceed an
  explicit review limit or consume the last permitted review under one,
  continuation is not covered, the loop stops report-only, and the
  eligible `cap`-flavoured increment on that review limit is a separate
  question-eligible situation
  through the gate — the budget-exhaustion entry, per the shared
  [Grant flavours](../../work/references/rounds.md#grant-flavours) rule: an
  explicit review limit is cap-only, and reporting the stop is not asking. The
  only exits from the loop are a clean review, a settlement-bounded close, a
  [convergence
  declaration](../../work/references/rounds.md#convergence-declaration), a
  safeguard, or the budget. This stop condition replaces any practice of
  re-asking gate closure between rounds.
- **Convergence saturation** — the shared [convergence
  declaration](../../work/references/rounds.md#convergence-declaration) detector
  fires on the active target. The declaration is the stop report: run it
  before any further round on that target and dispatch no further fix or
  re-review before it resolves, under the shared
  [Decision order](../../work/references/rounds.md#convergence-declaration):
  the unsettled classes' settlement question joins the declaration as the
  single combined decision (its consult order and closure options are the shared
  contract's); where every open class is already settled, the declaration
  stands alone with its closure options. **Continue, bounded** is offered only
  when legal under the
  shared bounded-continuation rule, and **Close accepted-with-residuals**
  only when the same recorded decision contains the nit-only settlement
  outcome. When that outcome already holds, the declaration notifies and the
  target closes accepted-with-residuals and the loop ends without a question.
- **Same task blocked two rounds in a row** — stop; a consult may recommend a materially
  different path, but that path still consumes the worker allowance and a consult cannot
  grant one — otherwise do not burn rounds on a wall that only the user can decide.
- **[strict] Blocking findings survive with no worker budget for another fix** — the last
  permitted review still reports blocking findings and the effective worker budget is
  exhausted. The consult authorizes no further fix or review pass — the user alone grants
  those as named increments. When the run ceiling is exhausted, stop the run; one consult on
  the surviving findings may separate genuine defects from standard drift (see
  [Repeated findings on the same invariant](gates.md#fix-continuation-and-review-justification)): on the standard-setting path the mandatory consult runs
  first, then the owed one decision proceeds through the
  [anti-ask gate](../SKILL.md#asking-the-user-anti-ask-gate) — a hedged consult counts as no answer,
  and the decision reaches the gate without it.
  Report the exhausted budget with the continuation prompt so a resume can act on a grant.
  When only the task allowance is exhausted, defer the target incomplete and review-open with
  its resumable packet and open findings, and select another truly independent ready task when
  safe; the run stops only under **No safe ready work** or another run stop. While an effective
  worker round remains and fixes make verified progress, this stop never fires: the loop
  continues unattended only while the [anti-ask gate](../SKILL.md#asking-the-user-anti-ask-gate)'s third
  check holds.
- **Autonomy-envelope guard breach** — a second additional opportunistic escalation in one
  session without an explicit user request (a required slice-gate deep review is not an
  escalation), a review or re-audit over unchanged evidence with no review justification,
  or work leaving docs/config-only/reversible scope — stop; the situation is
  question-eligible through the [anti-ask gate](../SKILL.md#asking-the-user-anti-ask-gate), and
  reporting the stop is not asking. An explicit user limit reached is not a guard
  breach: it is the report-only budget-exhaustion stop above, with its
  `cap`-flavoured grant offer — the shared
  [Grant flavours](../../work/references/rounds.md#grant-flavours) rule: an
  explicit review limit is cap-only — as a separate question-eligible situation
  through the [anti-ask gate](../SKILL.md#asking-the-user-anti-ask-gate), where
  it applies.
- **A decision or irreversible action is required** (force-push, deleting branches,
  publishing a release or pull request, or anything `AGENTS.md` flags) — irreversible actions
  and user preference are question-eligible (consult does not apply for them) and proceed
  only through the [anti-ask gate](../SKILL.md#asking-the-user-anti-ask-gate); reversible judgement
  decisions get one consult first, then the gate.
- **Two consecutive worker rounds with no verified progress** — stop and summarize under the
  shared stall safeguards; remaining budget is not a reason to continue.
