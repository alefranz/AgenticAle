---
name: work
description: "Coordinate an everyday coding task — a requested outcome, existing changes, or a preceding review's findings — through review, focused implementation, and fixes, optionally through a new or existing pull request. Explicit-only: invoke with /work (optionally /work --pr, /work --consult, and /work --outcome) to start a reviewed task; the model does not start this workflow on its own."
version: 1
slash: true
disable-model-invocation: true
metadata:
  opencode/autoinvoke: false
---

# Reviewed task work

Complete the user's task with focused, fresh subagents. The coordinator owns scope, user communication, and delivery; workers implement and independent reviewers inspect the result. Read [the shared round contract](references/rounds.md) before dispatching any child.

## Entry and arguments

Consume the invoking user's text directly (never treat a placeholder arguments token as input). Leading options combine in any order; remaining text is the task:

- **`--pr` / `--pr=<PR-URL>`** (or unambiguous request to commit and push updates to a PR): selects PR delivery — read [pr-delivery.md](references/pr-delivery.md) before implementation. Bare `--pr` never consumes task text as a URL; `--pr=<PR-URL>` targets that exact PR. Mentioning a PR or asking to address PR feedback alone does not authorize publishing.
- **`--stats`**: include the binding's session usage summary verbatim at the end of the final report (does not affect scope, budget, or permissions).
- **`--consult`**: run a mandatory read-only task-framing consultation before implementation. Inspect the repo first ([Start from the requested outcome](#start-from-the-requested-outcome)), dispatch [consult](references/tasks/consult.md) in task-framing mode (consumes the 1 consultation allowance), incorporate its recommendation, and ask the user only about genuine scope, behavior, or preference choices before proceeding.
- **`--outcome`**: explicit opt-in for measurable optimization tasks — read [outcome-evaluation.md](references/outcome-evaluation.md) before implementation. Never enter on inference without `--outcome`.
- **Initial deep review (explicit natural-language request only):** e.g., "First perform a deep review of the current branch changes" selects [review-deep](references/tasks/review-deep.md) as the first round over merge-base..working-tree (or the user-named range) before any implementation. Clean results manufacture no work; honor explicit conditional delivery instructions as written.

With empty arguments, select the task using the precedence below (ask if ambiguous; never implicitly resume an autonomous handoff). Empty invocation with `--pr` authorizes PR delivery for the selected existing work. Investigation-only requests stay investigation-only.

## Start from the requested outcome

Inspect `AGENTS.md` (when present) and the current branch, status, and diffs (staged, unstaged, untracked). Preserve unrelated work (including unrelated staged content) throughout review and delivery; ask before modifying or committing ambiguous overlapping edits.

Select the task by precedence:
1. Explicit task text from the invocation.
2. Unambiguous active task or preceding `/review` in the current session (recheck state and reuse still-valid review evidence directly — no redundant initial review; if clean, finish or deliver as authorized).
3. Coherent, sufficiently understood existing branch/working-tree changes.
4. Focused question if material ambiguity prevents safe scope selection.

Before dispatching implementation:
- Give a brief progress narration of the selected scope and first step (no confirmation gate for clear tasks; ask only about consequential scope, behavior, ownership, or destination uncertainty).
- Run a brief material-risk check: identify independently mutable sources (working trees, remote branches/PRs, persisted state), concurrent actors, external side effects surviving interruption, ownership-sensitive cleanup, and compatibility/API surfaces.
- Answer small questions via direct reads; dispatch a focused `explore` round only when a question needs a separate context.

Choose the smallest path: clear change → implement + gate; near-complete existing work → review + fix; uncertain request → one bounded `explore` + options if needed; complex bounded task → read [decomposition.md](references/decomposition.md) and run one slice at a time; investigation-only → return findings/options; review feedback → inspect actual feedback, fix, and close per [Review and fix gate](references/rounds.md#review-and-fix-gate).

## Dispatch and roles

| Purpose | Task contract | Route |
| --- | --- | --- |
| Project or external-source discovery | [explore](references/tasks/explore.md) | `explore` |
| Routine implementation | [implement](references/tasks/implement.md) | `implement` |
| Prescribed, bounded, mechanically verifiable edit (only if configured) | [implement](references/tasks/implement.md) | `implement-easy` |
| Concurrency, subtle state, security, or complex contracts | [implement](references/tasks/implement.md) | `implement-hard` |
| Fix blocking review findings | [fix](references/tasks/fix.md) | `fix` (or `implement-hard` with `fix` contract for hard fixes) |
| Independent slice/branch review | [review](references/tasks/review.md) | `review` |
| High-risk stand-in audit, combined-boundary audit, or explicit request | [review-deep](references/tasks/review-deep.md) | `review-deep` |
| Task-framing (`--consult`) or bounded technical second opinion | [consult](references/tasks/consult.md) | `consult` (`consult-hard` if configured & warranted) |

Select the runtime binding from the host's tool surface — never from a model name — under `references/runtimes/` and follow its dispatch rules. The workflow never selects models directly:
- Read at most once at activation: (1) the preference file documented in any appended "Model configuration (this installation)" section, and (2) when establishing whether an optional route (`implement-easy`, `consult-hard`) is configured, the install-ownership manifest documented by the active runtime binding — read-only, solely for current install intent (including when a leftover profile file is present), never resolving models from it or modifying it.
- On OpenCode with a configured coordinator, command entries run on `agenticale/coordinator`; on Qwen Code, read `agenticale-coordinator` read-only at most once at activation to adopt its posture and record requested vs. effective model.
- A missing/unreadable configured profile blocks only that role (report with the binding's refresh procedure; never silently substitute or inherit). Keep dispatch records compact in session state; run rounds sequentially; never let a worker approve its own work.
- `review-deep` triggers in Work (no automatic post-gate struggle/periodic escalation): (a) high-risk slice standing in for ordinary review (never both on the same range), (b) uncovered cross-slice integration scope at combined delivery, or (c) explicit user request.

## Budgets, stops, and quota exhaustion

- **Worker allowance:** default **24 worker rounds** (`explore`, `implement`, `implement-easy`, `implement-hard`, `fix`) across the whole task, plus **1 consultation** (`consult`/`consult-hard`). Override via explicit invocation instruction or top-level `## Work` `- worker rounds: N` (positive integer) in the same selected preference file (one lookup, no merging; invalid value is an actionable error, never clamped).
- **Continuation & stops:** follow [Budgets and loop continuation](references/rounds.md#budgets-and-loop-continuation). Continue productive fix loops while budget remains; stop only on budget exhaustion, stall, oscillation, reviewer standard drift (4+ reviews after functional checks pass), repeated root-cause invariant failure, or repeated unrecovered child interruption.
- **On a budget or non-convergence stop:** do not dispatch more workers (still run any required review of the last allowed worker). Present status, verified progress, concrete options (e.g., add `+N` rounds, replan, or stop preserving work — offer interactive choices if the host supports them), and the self-contained continuation prompt from [rounds.md](references/rounds.md#checkpoints-decision-summary-and-stop-reports).
- **Provider quota exhaustion:** before report repair/interruption handling, check for explicit host/provider quota or rate-limit evidence (do not infer from empty output, generic `429`, or auth/network/billing errors). When confirmed: verify the child is terminal before acting, preserve partial tree changes, stop further dispatch, and report the affected role/task, evidence, completed vs. unchecked work, host reset info, and a continuation prompt. Never switch models, finish child work in the coordinator, auto-retry, write cooldown files, or publish an unverified PR.

## State, Git, and Finish

Keep all state in the session (`State policy: session; report only; no operational files`); write no backlogs, handoffs, archives, or round ledgers unless explicitly required by repo conventions. Default Git policy leaves accepted changes uncommitted on the current branch unless `--pr` (see [pr-delivery.md](references/pr-delivery.md)) or explicit user/repo instructions apply.

Before finishing, verify the final diff and relevant acceptance checks. Report what changed, checks and review verdicts, open findings or limitations, and delivery state (omitting the agent ledger by default). If `--stats` was supplied, follow the active binding's stats procedure and place its report verbatim in a final fenced text code block (if unsupported on the runtime, say so); the only permitted edit is truncating per-session tables over 15 rows to the first 15 rows plus `… N more sessions omitted` while keeping header, totals, and per-provider breakdown verbatim.

## Model configuration (this installation)

At activation the workflow may read one optional preference file: first
`<project-root>/.agenticale/preferences.md`, then
`~/.agenticale/preferences.md`. A missing file is normal (no
customization); the workflow never creates or modifies preference files.
When this default lookup finds no file, the workflow adds one non-blocking note
that every role inherits the session model, pointing at the
user-invoked `configure` skill and its
[bundled starter](../configure/references/preferences.example.md); it
reads nothing extra, and a missing named `--profile` file remains an error.

Format: a Markdown list of direct role assignments, one per line:

- `- <role>: <provider/model[#variant]>` — one combined value. The optional
  `#variant` suffix carries the reasoning variant
  (`low`, `medium`, `high`, `xhigh`, `max`); where the host exposes separate
  model and effort fields, the variant is passed as the effort selection.
- The earlier forms stay accepted: `- <role>: <model>` (no effort) and
  `- <role>: <model>, <effort>`. The comma form means the same assignment
  as the combined `#variant` form, so existing preference files keep
  working unchanged; use one form or the other on a line.
- `<role>` is one of the nine child worker keys: explore, implement,
  implement-easy, implement-hard, fix, review, review-deep, consult,
  consult-hard. There is no coordinator key: the host owns the session
  model, and this file never changes it — select the session model in the
  host itself.
- Roles not listed use the host default (the session model).
- `implement-easy` and `consult-hard` are optional routes. When they are not
  listed, the shared routing policy dispatches the base route (`implement`
  or `consult`) with its existing assignment — a defined fallback, not an
  error. When one IS listed but the host cannot honor the requested
  selection, the workflow surfaces the limitation; it never silently
  substitutes a weaker route.
- Nothing else is interpreted: no tiers, no fallbacks beyond the optional
  routes above, no runtime sections, no profile sections, no merging of
  files.

A leading `--profile NAME` option (or an unambiguous natural-language
equivalent) selects the file `preferences.NAME.md` instead, again project
first, then personal. `NAME` is 1-40 characters: a lowercase letter, then
lowercase letters, digits, or hyphens, with no trailing hyphen; `default`
and `inherit` are reserved.
A missing selected file is a concise, actionable error listing the files
that exist at the checked locations — never a silent fallback. The
selected file is read once at activation and stays fixed; the selection
stays in session state for the activation.

Application: where the active runtime binding exposes per-spawn model/effort
fields, the role's assignment is passed at dispatch; where the host cannot
select a model per child, the assignment has no effect (say so when the
user asks for it). A profile never changes the session model, runtime,
credentials, or endpoints. The effective selection is established only from
native host evidence (runtime metadata or local traces), never from a
child's self-reported model name; keep an unknown effective setting unknown.

The same file may also carry the top-level `## Work` section documented in
the skill body (worker-round allowance); it is the only other supported
section.

Example `preferences.md` shape (both value forms are accepted). The
`<...>` tokens are placeholders, not usable assignments: replace every one
with a real model name from your host's live listing (or one you know your
account exposes) and a real variant before use. The user-invoked
`configure` skill can discover the names with you and propose the exact
content before anything is written.

    - review: <provider/model#variant>
    - review-deep: <provider/model>, <effort>
    - consult-hard: <provider/model#variant>

    ## Work
    - worker rounds: 24
