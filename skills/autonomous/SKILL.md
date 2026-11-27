---
name: autonomous
description: "Run a long development goal in sequential worker and independent-review rounds with durable handoffs. Use only when the user explicitly asks for autonomous mode."
slash: true
disable-model-invocation: true
metadata:
  opencode/autoinvoke: false
---

# Autonomous mode

Read [the shared round contract](../work/references/rounds.md) before dispatching. Work a long goal in strictly sequential foreground child rounds (never parallel or background). The main loop coordinates, maintains durable state, and handles Git persistence; children do the implementation and independent verification.

Default to **strict** mode: every slice changing code, config, tests, or behavior passes an independent review round before the next slice starts, except clearly mechanical slices closed by their coordinator-run deterministic check per [Review and fix gate](../work/references/rounds.md#review-and-fix-gate). Use **standard** mode (coordinator verification only, no review round) only for investigation-only goals or when the user explicitly accepts skipping review for low-risk mechanical work.

## On-demand references (load ONLY when triggered)

Do not read these upfront on normal slices; read each only when its condition fires:

- [references/persistence.md](references/persistence.md) — when recording a non-default Git policy in round 0, at task completion persistence gates, or at stop/final close.
- [references/escalation.md](references/escalation.md) — when triggering `review-deep`, `consult`, or a worker reset.
- [references/recovery.md](references/recovery.md) — on a fresh resume/crash reconcile, an interrupted child, or provider quota exhaustion.

## Entry, arguments, and setup (round 0)

Consume the invoking user's text directly:

- Optional leading positive integer sets the run worker-round ceiling (default **240**); `--` explicitly ends options; remaining text is the goal.
- **Empty goal text = RESUME:** load [references/recovery.md](references/recovery.md), reconcile state against the checkout, and continue the recorded `NEXT` action. A numeric argument on resume updates the run ceiling only — never resets consumed counters (if already exhausted, stop per stop rules before dispatching).
- **Non-empty goal text with existing active state = invocation steering:** reconcile fresh against `BACKLOG.md` and `.agenticale/active.md`. Add genuinely new tasks with stable IDs; adjust acceptance or upcoming order at the next selection boundary without interrupting the active slice; ask on ambiguous destructive "start over" requests; keep existing identity, counters, and open gates. Persist significant plan changes as a state-only reconciliation checkpoint via [persistence.md](references/persistence.md).

For a new goal:
1. Parse goal, mode (default strict), run ceiling (default 240), completed-task limit (default 20), and Git persistence policy (default **commit and push** per completed task; only a concretely cited user or repo prohibition selects commit-only or working-tree instead — a conditional "unless explicitly asked" guard is satisfied by invoking `/autonomous`). State the four choices and policy basis (plus an explicit warning if accepted work stays uncommitted or unpushed).
2. Read only `AGENTS.md` (when present), `BACKLOG.md` / `.agenticale/active.md` (if resuming), `.agenticale/steering.md` (if present), and `git log --oneline -5`. Never read large product source files in the coordinator — dispatch a bounded `explore` round when code evidence is needed.
3. Run a brief material-risk check (mutable sources, concurrent actors, external side effects, compatibility surfaces), record planned tasks with stable IDs (`T1`, `T2`, …) in `BACKLOG.md`, initialize `.agenticale/active.md`, state the plan in 3–6 lines, and start round 1 without waiting for approval.

## State files and write discipline

Keep `.agenticale/` at the project root. Only the coordinator writes these files:

- **`BACKLOG.md`** (~150 lines max): run identity and limits header; tasks (`T1`, `T2`, …) with dependencies and acceptance; deferred resumable packets carrying only each deferred task's own counters (never run counters); 1–2 line confirmed result records (date, outcome, commit hashes, push destination — completed-task count derives from confirmed records); and one active next action. No default archive.
- **`.agenticale/active.md`** (~2 KiB max checkpoint, never a round journal): `GOAL`, `ESTABLISHED` (including natively exposed role model selections), `CURRENT STATE` (one budget line with run ID/ceiling/consumed + active task ID/allowance/consumed + pending-dispatch note while a worker is in flight + current slice/persistence state), `ACCEPTANCE`, `TRIED` (on reset), and one `NEXT` action.
- **`.agenticale/steering.md`** (optional, human-owned — coordinator reads, never writes): supports `- mode: continue | pause` and `- priority: T3, T2`. Re-read before every round dispatch. `pause` stops cleanly after any running child settles and persists across resumes; `priority` reorders ready tasks at the next selection boundary only without bypassing dependencies, gates, or exhausted tasks.

Apply targeted edits on fresh re-reads (never overwrite `BACKLOG.md` from a stale copy). Write and read back the incremented worker charge + pending-dispatch note in `.agenticale/active.md` before launching each worker child, and settle it on return (productive/reset keeps the single charge; confirmed quota-only or never-launched removes it). On a task switch `A → B`, write `A`'s deferred packet to `BACKLOG.md` before overwriting `.agenticale/active.md`.

## Budgets and task selection

- **Budgets:** default **24 worker rounds** per task, **240** per run, and **20 completed tasks** per run (a task counts only once its persistence gate is confirmed). Worker rounds (`explore`, `implement`, `implement-easy`, `implement-hard`, `fix`, including resets/corrections) charge both task and run counters; `review`, `review-deep`, and `consult` do not. Only a genuinely new task gets a fresh 24-round allowance.
- **Task exhaustion is not a run stop:** when a task hits its allowance, run any pending review on its completed changes, defer the task with its resumable packet in `BACKLOG.md`, and select another truly independent ready task (fresh allowance). Never bypass gates/dependencies or manufacture work.
- **Loop continuation:** follow [Budgets and loop continuation](../work/references/rounds.md#budgets-and-loop-continuation). Continue productive fix loops unattended (never stop on a review-round count); stop/escalate only on stall (2 no-progress rounds or same blocker twice), oscillation (2 cycles), reviewer style drift (4+ reviews after functional checks pass), or repeated root-cause invariant failure.

## Dispatch and task loop

Select the runtime binding from the host's tool surface under `../work/references/runtimes/` (never from a model name) at start and on every fresh resume (reporting material installed-model changes on resume). Never select models directly:
- Read at most once at activation: (1) any documented preference file (`## Work` allowance never sets autonomous budgets), and (2) when checking whether an optional route (`implement-easy`, `consult-hard`) is configured, the binding-documented install-ownership manifest — read-only, solely for current install intent (including when a leftover profile file is present), never resolving models from it or modifying it. Adopt `agenticale-coordinator` posture on Qwen Code (`agenticale/coordinator` on OpenCode). Missing/unreadable configured profiles block only that role (report with binding's refresh procedure; never silently substitute).

Route rounds per [Routing policy](../work/references/rounds.md#routing-policy) to `../work/references/tasks/<role>.md`. Compose each prompt directly from [Task packet](../work/references/rounds.md#task-packet) (no separate prompt template file needed), adding run/task budget counts, active Git persistence policy, `.agenticale/active.md` read-only pointer, worker reset triggers (2 failed hypotheses or 3 unproductive exploratory actions), and `State policy: coordinator-only — return facts in your report; never edit BACKLOG.md, .agenticale/active.md, or .agenticale/steering.md`. On OpenCode/Qwen Code, the role's contract is baked into the agent profile; on per-spawn hosts, include or tell the child to read the matching `../work/references/tasks/<role>.md`.

For each slice (giving 1–3 sentence progress narration before each substantive dispatch):
1. Re-read `.agenticale/steering.md` and `.agenticale/active.md`'s budget line; charge worker round; launch one fresh foreground child; verify result with `git status` / `git log -1`. If quota-exhausted or interrupted, load [recovery.md](references/recovery.md); otherwise if missing/malformed, send one correction round.
2. If the worker hit a reset trigger, persist `TRIED` and `NEXT` and start a fresh child (counts as a worker round; never review unfinished work).
3. In strict mode, gate each changed slice via [Review and fix gate](../work/references/rounds.md#review-and-fix-gate) (clearly mechanical slices close via deterministic check; judgemental findings loop fix → verify → re-review unattended while making progress). Load [escalation.md](references/escalation.md) if a `review-deep` gate, `consult`, or reset applies.
4. When a task's final slice and gates close, complete the task persistence gate in [persistence.md](references/persistence.md) before selecting the next task.

## Asking the user (anti-ask gate)

Run unattended. Stop and ask the user **only** when one of these occurs:
1. An irreversible or `AGENTS.md`-reserved action (force-push, deleting branches, opening PRs, publishing releases).
2. An ambiguous user preference over goal, scope, acceptance, or destructive replacement ("start over").
3. An exhausted run ceiling / completed-task limit (offer `+N` increment or stop preserving work), or blocked persistence destination / ambiguous commit attribution.
4. Genuine non-convergence (stall, oscillation, repeated root-cause blocker, or 4+ review style drift) that a read-only `consult` (per [escalation.md](references/escalation.md)) could not settle.

Never ask to authorize routine continuation, the next slice, or another productive fix/review cycle while budget and progress hold.

## Final report (<= 15 lines) and persistence

**Persist before printing.** Apply WIP checkpoints (for incomplete stops under commit/push policy) and update `BACKLOG.md` + `.agenticale/active.md` per [persistence.md](references/persistence.md) before printing the report (unless persistence is blocked, in which case stop local-only with no commits/pushes). Report: compact summary of outcomes/verdicts, achieved work with commit/test evidence, current state and next step (with warning if uncommitted/unpushed), open blockers or documented nits, and a copyable continuation prompt on any incomplete stop.
