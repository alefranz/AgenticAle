## Run and task budgets

Two durable worker-round budgets bound every run, and a separate completed-task limit
bounds how many tasks one run may finish:

- **Run ceiling** — the whole run's worker-round budget: the default 240, or the positive
  integer supplied at invocation. The default is a generous emergency safety limit, not a
  work target: the run processes eligible backlog tasks until the backlog is drained or a
  safety limit is reached. The ceiling changes only by the user's explicit numeric override
  or a named grant; the coordinator never auto-grows it, and an explicit ceiling is exact.
- **Task allowance** — each genuine task's own worker-round budget, default 12, with the
  shared
  [progress-aware
  contract](../../work/references/rounds.md#budgets-and-loop-continuation)'s
  progress-based hard ceiling of 24: when the normal allowance is reached with verified
  progress evidence, the coordinator records a bounded extension up to that ceiling before
  dispatching further worker rounds — automatically, without a permission ask, and never on
  code churn. It is independent of the run ceiling and of the Work preference file's
  `## Work` allowance, which never sets an autonomous budget. Flavour-eligibility follows
  the shared [Grant flavours](../../work/references/rounds.md#budgets-and-loop-continuation) rule, and
  only a user grant extends a specific task's allowance beyond its ceiling, as a named
  increment.
- **Completed-task limit** — default 20 completed tasks per run, separate from both worker
  budgets. A task counts toward the limit only after its task persistence gate is fully
  satisfied, including the bounded state finalization; deferred, blocked, exhausted,
  review-open, and WIP-checkpointed tasks never count. Reaching the limit while eligible
  backlog work remains is an INCOMPLETE safety stop, never a completed run. An explicit user
  instruction may set a different limit, recorded in the durable state; it never auto-grows.

**Named grants.** Only the user extends a budget beyond its cap, through a named increment:
it adds exactly the rounds it names — worker rounds (fix rounds are worker rounds) to the
named budget (run ceiling or task allowance), and review rounds only against an explicit user
review limit. A grant never resets counters and grants no scope, review, or Git rights beyond
what it names; the resulting boundary is an exact cap that does not auto-extend, except
per the shared [Grant flavours](../../work/references/rounds.md#budgets-and-loop-continuation) rule for
a progress-flavoured task-allowance grant. A consult cannot grant any increment.

**Grant flavours.** Per the shared [Grant flavours](../../work/references/rounds.md#budgets-and-loop-continuation)
rule, a named grant states a flavour recorded in the snapshot's budget line
(`M0-03: 15 (progress @R57) 9 consumed`): `cap` for the exact boundary that
does not auto-extend — the named default — and `progress` for the
task-allowance auto-extend authority up to the progress ceiling. The shared
contract is the single authority for the flavour and leading-option rules.

Every explore, implement, and fix round — including a reset continuation or a
malformed-report correction — is one worker round charged to BOTH the current task and the
run. Exploration that defines a task belongs to that task's allowance. The effective
remaining worker budget is the smaller of the task's remaining allowance in force and the
run's remaining ceiling; a worker dispatch needs at least one effective round. Review,
review-deep, and consult rounds do not consume either worker budget. Consult rounds keep
their unchanged caps — one per decision, two per session. Review and review-deep rounds
keep their own accounting and are bounded by the shared review-justification rules, not a
fixed per-target pass count; per-target fix/review cycle counts are not authorization gates
in this workflow (see
[Fix continuation and review justification](gates.md#fix-continuation-and-review-justification)).

Only a genuinely new task receives a fresh task allowance. Decomposing a task, replanning
it, resuming it, steering it, or recovering it from an interruption keeps the same task
identity and the same consumed counters; none of them replenishes the task allowance or the
run ceiling, and none erases a recorded progress extension or its evidence. A renamed or
re-outlined slice of the same task is not a new task.

### Task exhaustion is not a run stop

When a task's allowance in force is exhausted — at the progress ceiling, or at an exact
explicit cap, with no further extension justified under the shared contract — dispatch no
further worker round for that task and exclude it from worker selection until a user grant
extends its allowance, so an exhausted deferred task cannot repeatedly win selection.
Verification and the permitted review of its completed changes still run under the
unchanged review rules and remain schedulable; an unfinished task is still not reviewed as
if complete. Whatever remains unfinished stays incomplete: record the findings, the current
state, and exactly one next action, and keep the task's packet resumable in the backlog.
The run may then select another truly independent ready task, which receives its own fresh
allowance — even while the exhausted task's unfinished changes remain in the tree.
Selection never bypasses a review gate, a dependency, or a safety boundary: a task that
depends on the unfinished work, or whose changes cannot be safely separated from it, is not
ready, and no task is manufactured to spend remaining budget. When no safe ready task
remains, the run stops under the [stop conditions](stops.md#stop-conditions) — an incomplete
stop whenever unfinished tasks remain. The run itself stops for budget only when the run ceiling or the
completed-task limit is exhausted.
