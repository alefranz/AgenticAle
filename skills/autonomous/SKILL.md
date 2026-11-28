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

Default to **strict** mode: every slice changing code, config, tests, or behavior converges using the lowest sufficient tier under [Review and fix gate](../work/references/rounds.md#review-and-fix-gate) (coordinator-run deterministic check for clearly mechanical slices, `review` for routine slices, `review-deep` standing in for high-risk slices), and milestones / run-close delivery boundaries pass a stepped-up fresh-context acceptance review per [escalation.md](references/escalation.md). Use **standard** mode (coordinator verification only, no review round) only for investigation-only goals or when the user explicitly accepts skipping review for low-risk mechanical work.

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

Keep `.agenticale/` at the project root. Only the coordinator writes these files, enforcing a strict single-source-of-truth split with transition pruning rather than hard line caps:

- **`BACKLOG.md`** (durable plan and outcomes — never a round journal or active-slice scratchpad):
  - Short run header (run ID, limits, persistence policy — overwrite in place when changed; never append a chronological resume/stop diary).
  - Open tasks (`T1`, `T2`, …) with dependencies and concise acceptance.
  - **Completed tasks:** on completion, delete acceptance prose, scope notes, progress logs, and fix specs, collapsing the entry to a **1-line `[x]` confirmed result receipt** (date, outcome, commit hashes, push destination, plus a short clause only for accepted known limitations; completed-task count derives from confirmed receipts). Lasting architectural decisions belong in repo docs or `AGENTS.md`, not `BACKLOG.md`.
  - **Deferred tasks only:** one compact resumable packet (each deferred task's own counters, still-open items, and next step — never run counters or settled history); delete the packet when the task resumes or closes.
  - **One-line `NEXT` pointer** naming the active task ID (all active-slice detail lives only in `.agenticale/active.md`, never mirrored in `BACKLOG.md`).
  - **No archive or append-only log file:** Git history of state-only commits is the audit trail. At run or milestone close, prune or collapse completed prior-milestone `[x]` lines to a 1-line milestone summary.
  - **Byte-based hygiene:** write clean multi-line Markdown (never pack history onto single lines to game line counts). Soft target ≤ 15–20 KiB; if it exceeds ~25–30 KiB (well below 50 KiB host read truncation), compact stale prose or move future unstarted milestones into a separate roadmap doc.
- **`.agenticale/active.md`** (live working checkpoint for the active task only — overwrite in place, never a round journal):
  - Sections: `GOAL`, `ESTABLISHED` (concise invariants + natively exposed role model selections), `CURRENT STATE` (one budget line with run ID/ceiling/consumed + active task ID/allowance/consumed + pending-dispatch note while a worker is in flight + current tree/WIP/pre-WIP base and gate state), open findings/blockers for the active slice (location, defect, and required outcome — never verbatim paragraph diffs), `ACCEPTANCE` (concise criteria or pointer — never duplicate budget counters), `TRIED` (on reset; cleared once resolved), and one `NEXT` action.
  - **Prune on every round settle:** immediately delete closed findings, applied or superseded fix instructions, and settled round narration so the checkpoint reflects *now*, not prior rounds.
  - **Byte-based soft target:** ~2–4 KiB normally; may grow temporarily when a complex active slice legitimately carries many open findings or leftovers (never by retaining settled history); compact/deduplicate if it exceeds ~6–8 KiB.
- **`.agenticale/steering.md`** (optional, human-owned — coordinator reads, never writes): supports `- mode: continue | pause` and `- priority: T3, T2`. Re-read before every round dispatch. `pause` stops cleanly after any running child settles and persists across resumes; `priority` reorders ready tasks at the next selection boundary only without bypassing dependencies, gates, or exhausted tasks.

Apply targeted edits on fresh re-reads (never overwrite `BACKLOG.md` from a stale copy). Write and read back the incremented worker charge + pending-dispatch note in `.agenticale/active.md` before launching each worker child, and settle it on return (productive/reset keeps the single charge; confirmed quota-only or never-launched removes it). On a task switch `A → B`, move only `A`'s still-open packet and task counters to `BACKLOG.md` before overwriting `.agenticale/active.md`; delete a deferred task's packet from `BACKLOG.md` when it resumes.

## Budgets and task selection

- **Budgets:** default **24 worker rounds** per task, **240** per run, and **20 completed tasks** per run (a task counts only once its persistence gate is confirmed). Worker rounds (`explore`, `implement`, `implement-easy`, `implement-hard`, `fix`, including resets/corrections) charge both task and run counters; `review`, `review-deep`, and `consult` do not. Only a genuinely new task gets a fresh 24-round allowance.
- **Task exhaustion is not a run stop:** when a task hits its allowance, run any pending review on its completed changes, defer the task with its resumable packet in `BACKLOG.md`, and select another truly independent ready task (fresh allowance). Never bypass gates/dependencies or manufacture work.
- **Loop continuation:** follow [Budgets and loop continuation](../work/references/rounds.md#budgets-and-loop-continuation). Continue productive fix loops unattended (never stop on a review-round count); run a **periodic reassessment every 4 worker rounds** on the task/slice (or sooner on stall/oscillation) to evaluate progress, route/complexity upgrades, strategy shifts or `consult`, and style-drift settlement; stop/escalate only on unresolved non-convergence.

## Dispatch and task loop

Select the runtime binding from the host's tool surface under `../work/references/runtimes/` (never from a model name) at start and on every fresh resume (reporting material installed-model changes on resume). Never select models directly:
- Read at most once at activation: (1) any documented preference file (`## Work` allowance never sets autonomous budgets), and (2) when checking whether an optional route (`implement-easy`, `consult-hard`) is configured, the binding-documented install-ownership manifest — read-only, solely for current install intent (including when a leftover profile file is present), never resolving models from it or modifying it. Adopt `agenticale-coordinator` posture on Qwen Code (`agenticale/coordinator` on OpenCode). Missing/unreadable configured profiles block only that role (report with binding's refresh procedure; never silently substitute).

Route rounds per [Routing policy](../work/references/rounds.md#routing-policy) to `../work/references/tasks/<role>.md`. Compose each prompt directly from [Task packet](../work/references/rounds.md#task-packet) (no separate prompt template file needed), adding run/task budget counts, active Git persistence policy, `.agenticale/active.md` read-only pointer, worker reset triggers (2 failed hypotheses or 3 unproductive exploratory actions), and `State policy: coordinator-only — return facts in your report; never edit BACKLOG.md, .agenticale/active.md, or .agenticale/steering.md`. On OpenCode/Qwen Code, the role's contract is baked into the agent profile; on per-spawn hosts, include or tell the child to read the matching `../work/references/tasks/<role>.md`.

For each slice (giving 1–3 sentence progress narration before each substantive dispatch):
1. Re-read `.agenticale/steering.md` and `.agenticale/active.md`'s budget line; charge worker round; launch one fresh foreground child; verify result with `git status` / `git log -1`. If quota-exhausted or interrupted, load [recovery.md](references/recovery.md); otherwise if missing/malformed, send one correction round.
2. If the worker hit a reset trigger, persist `TRIED` and `NEXT` and start a fresh child (counts as a worker round; never review unfinished work).
3. In strict mode, converge each changed slice via [Review and fix gate](../work/references/rounds.md#review-and-fix-gate) (lowest sufficient tier; judgemental findings loop fix → verify → re-review unattended while making progress). Load [escalation.md](references/escalation.md) when periodic reassessment triggers `consult`/diagnostic `review-deep`, for a standing-in `review-deep`, or for a progressive acceptance review at milestone / run-close delivery.
4. When a task's final slice and gates close, complete the task persistence gate in [persistence.md](references/persistence.md) (and at milestone / run-close delivery, pass the progressive acceptance review before final run close) before selecting the next task or finishing.

## Asking the user (anti-ask gate)

Run unattended. Stop and ask the user **only** when one of these occurs:
1. An irreversible or `AGENTS.md`-reserved action (force-push, deleting branches, opening PRs, publishing releases).
2. An ambiguous user preference over goal, scope, acceptance, or destructive replacement ("start over").
3. An exhausted run ceiling / completed-task limit (offer `+N` increment or stop preserving work), or blocked persistence destination / ambiguous commit attribution.
4. Genuine non-convergence that periodic reassessment and a read-only `consult` (per [escalation.md](references/escalation.md)) could not settle.

Never ask to authorize routine continuation, the next slice, or another productive fix/review cycle while budget and progress hold.

## Final report (<= 15 lines) and persistence

**Persist before printing.** Apply WIP checkpoints (for incomplete stops under commit/push policy) and update `BACKLOG.md` + `.agenticale/active.md` per [persistence.md](references/persistence.md) before printing the report (unless persistence is blocked, in which case stop local-only with no commits/pushes). Report: compact summary of outcomes/verdicts, achieved work with commit/test evidence, current state and next step (with warning if uncommitted/unpushed), open blockers or documented nits, and a copyable continuation prompt on any incomplete stop.
