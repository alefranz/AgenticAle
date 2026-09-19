---
name: Autonomous Mode
description: Run a long goal in sequential subagent rounds when explicitly invoked through /autonomous. In strict mode each task is gated by an independent review subagent until clean.
version: 1
slash: false
metadata:
  opencode/autoinvoke: false
---

# Autonomous mode

Work a long goal in short, **sequential rounds**. Each round is one
foreground subagent call that receives everything it needs and returns a
compact report. The main loop only coordinates: it defines each round's
task, records a two-line ledger entry, and stops when done or blocked. The
goal is context management, NOT parallelism — rounds never overlap.

Two modes:

- **standard** — one worker round per task, with the coordinator's normal
  verification, but no independent review gate.
- **strict** — worker round, then an independent **review round**, looping until
  the review has no blocking findings, before the next task starts.

Choose the mode in round 0 and state it. Default to **strict** for every task
that changes code, configuration, tests, or other project behaviour, including
a single-task goal. Use **standard** only for investigation-only work or when
the user explicitly accepts skipping an independent review for a low-risk,
mechanical task. The number of tasks alone never justifies standard mode.

## Agent routing and capability

Use the installed `autonomous/*` agents available to OpenCode below, not the
generic `general` or `explore` agents. Each role gets a fresh context and a
bounded task:

| Round purpose | Agent | Why |
| --- | --- | --- |
| One-question, read-only discovery | `autonomous/explore` | Focused evidence gathering; it cannot edit. |
| Normal implementation slice | `autonomous/implement` | Small, verifiable coding task. |
| Hard implementation slice | `autonomous/implement-hard` | Reasoning-heavy work that benefits from an explicitly bounded specialist context. |
| Review-findings fix pass | `autonomous/fix` | Narrow, evidence-led changes. |
| Per-slice independent review | `autonomous/review` | Adversarial verification in a context independent from the worker. |
| Periodic integration audit / escalated slice review | `autonomous/deep-review` | Cross-slice review in a fresh context. |
| Stuck decision second opinion | `autonomous/consult` | One read-only recommendation on a decision the loop cannot settle. |

The `autonomous/*` agent definitions — global at
`~/.config/opencode/agents/autonomous/`, or a project's `.opencode/agents/autonomous/`
when present — intentionally omit `model` frontmatter and inherit the active
OpenCode model. Users may assign locally available models to installed agent
copies. If doing so, prefer stronger reasoning capability for `review`,
`deep-review`, and `consult`; model diversity is optional, while fresh-context
independence is required.

Implementation slices default to `autonomous/implement`. Route a slice to
`autonomous/implement-hard` only when it is genuinely reasoning-heavy:
concurrency/async/cancellation/timing behaviour, the cross-repository
contract surface, subtle shared-state behaviour, or security-relevant code
paths. Mechanical renames, dependency swaps,
packaging, and docs never qualify.
Independent review is required even when every role inherits the same model.
Hard slices are prime candidates for the deep-review escalation below.

`steps` is an OpenCode hard ceiling on model turns, not a target or a tool-call
budget. The role ceilings leave room to read, verify, write a handoff, and
return a well-formed report: explore 24; implement 64; implement-hard 64;
fix 48; review 56;
deep review 72. A fixed tool-call count is not a context-health signal:
compaction should handle healthy, in-scope work. A coordinator must never try
to continue a step-capped child: OpenCode has ended it, so recovery always uses
a fresh child and a disk handoff.

## Non-interactive child sessions

Child sessions are deliberately non-interactive: every `autonomous/*` profile
denies the `question` tool and nested subagents, and the prompts forbid asking.
Consequences for the coordinator:

- Compose every round prompt so it needs no user decision; when a choice
  cannot be made locally, state the choice to make in the prompt itself.
- If a report comes back `blocked` on a decision, the main loop takes the
  Decision consultation path: one second opinion first, and a
  question to the user only for irreversible actions, user preference, or a
  consult that does not commit. Never route a user-facing question through a
  subagent.
- A tool denial inside a round is a report item, not a retry: re-scope the next
  round or handle the path from the main loop.
- The main loop follows the same spirit: it runs unattended and defaults to
  a documented assumption recorded in the handoff. Questions to the user are
  reserved for the stop conditions below (guard breach, irreversible action,
  a consult that could not settle a standard-setting question, same task
  blocked twice) — never for routine continuation or a preference the
  handoff can decide.

## Core rules (do not break)

1. **The main loop is a coordinator, not a worker.** It does not implement.
   It reads just enough to define the next round, then delegates. The only
   exception is a trivial coordination edit (e.g., one backlog checkbox)
   that would otherwise block the next round.
2. **One subagent at a time, strictly sequential.** Never
   `background: true`, never parallel calls. Round N+1 starts only after
   round N's report has been read.
3. **State lives on disk, not in the conversation.** The active handoff,
   backlog, archived handoffs, and git history or working-tree diffs are the
   single source of
   truth. A round never inherits another round's details; it re-reads the
   active handoff and recent history itself.
4. **Each worker round is one small, verifiable slice that follows the active
   git persistence policy.** A slice has exactly one behaviour or investigation question,
   one observable acceptance condition, and a defined stop boundary. It may
   touch every file or repository required for that one outcome, but never
   absorbs a newly discovered adjacent task. If the next task is bigger than
   one round, split it in the prompt — never ask a subagent to "do the rest".
5. **The main loop's memory of round N is at most two lines.** Ledger line
   format: `R<N>: <role: work|review|fix|consult> <done|clean|findings|blocked> —
   <one-line outcome>` (a consult line carries the chosen option and its
   confidence, e.g. `R7: consult done — adopt option B (medium)`).
6. **Reset before a round sprawls.** When a worker reaches a reset trigger,
   it writes a compact disk handoff and ends. The main loop starts a *fresh*
   subagent with that handoff; it never asks the old worker to keep exploring.

## Handoff storage and archival

Keep current operational state separate from completed audit detail:

- `BACKLOG.md` is the compact operational board. It contains product
  decisions that still govern work, open blockers/nits as checkboxes, the
  current milestone's short status, exactly one first active next action,
  and pointers to archived slices. Keep it normally below about 150 lines.
- `docs/handoffs/active.md` is the authoritative active-slice packet. It is
  at most ~2 KB and contains `GOAL`, `ESTABLISHED`, `CURRENT STATE`,
  `ACCEPTANCE`, and exactly one `NEXT` action. A reset also adds a compact
  `TRIED` section. Create it before the first round of a session if absent.
- `docs/handoffs/archive/YYYY-MM.md` holds completed handoffs, review
  verdicts, and session-close ledgers. Preserve the original detail and
  append records in chronological order; do not rewrite it into a lossy
  summary.

After a slice has passed its required review gate (or a standard-mode slice
is complete), move its detailed handoff and review record from the active
packet into the monthly archive. Replace any detailed completed record in
`BACKLOG.md` with a one- or two-line result: date, outcome, relevant commit
hashes or changed files, and an archive pointer. Carry every unresolved
blocker or nit into the appropriate open checkbox in `BACKLOG.md` before archiving. Never
delete audit material, and never archive an active or review-open slice.

At session close, archive the full round ledger and verification evidence.
`BACKLOG.md` keeps only the current session's compact status/next action;
older session-close handoffs move to the archive. Archive early whenever
the backlog exceeds the normal size target or a milestone closes. Preserve
repository-specific handoff rules when they are stricter.

## Git persistence between handoffs

Choose and record one persistence policy in round 0, then pass it verbatim to
every child:

- **Working tree (default):** do not commit or push. Leave verified changes in
  the working tree and identify them with `git status` and `git diff` evidence.
- **Commit:** allowed only when the user explicitly requested commits or the
  active repository instructions require them. The workflow creates the
  coherent commits for accepted slices itself; it does not leave commits for
  the user to make. Commit changed repositories in dependency order and update
  any outer-repository pins.
- **Push:** allowed only when the user explicitly requested pushing. Repository
  instructions or an inferred desire for persistence are not enough.

Review rounds follow the same policy for handoff-only changes. Later rounds
refer to commit hashes when commits exist; otherwise they use the recorded
baseline plus changed-file and diff evidence. Work on the already checked-out
branch unless the user explicitly asks for a new branch or repository
instructions require one; a request to commit does not imply creating a
branch. Creating a branch, pushing, and opening a pull request are separate,
explicit actions. Never change remotes, publish, or silently strengthen the
persistence policy.

## Setup (round 0, done by the main loop)

1. Parse the goal, the round budget, the mode, and the git persistence policy.
   If no budget was given,
   choose one that fits the scope (default 6 worker rounds; up to ~10 for
   large goals — strict-mode review rounds are cheap and are not counted
   against the worker budget). State all four.
2. Read only what is needed to define round 1: `docs/handoffs/active.md`
   (or, only while initializing it, the first active "Next slice" item in
   `BACKLOG.md`), `AGENTS.md` conventions when that file exists, and
   `git log --oneline -5` in
   each repo the work touches. The active packet must be at most ~2 KB and
   contain the task, established facts, relevant commits/files, acceptance
   commands, and exactly one next action. Historical handoff prose is audit
   material: read it only by an exact archive pointer, never as general
   archaeology. Do NOT read source code — that is what the subagents are
   for.
3. State the plan in 3–6 lines: goal, budget, mode, persistence policy, how the
   work splits into slices, and stop conditions. Then start round 1 without
   waiting for approval; pause only on a stop condition below.

## Task loop

Tasks come from the handoff (first uncompleted item in the "Next slice") or
from the previous round's report. For each task:

1. **Worker round.** Compose a self-contained prompt from the worker
   template. Call `subagent` (foreground): `autonomous/explore` for a
   read-only discovery question, `autonomous/implement` for an implementation
   slice, `autonomous/implement-hard` for a hard implementation slice (see
   the routing rules above), and `autonomous/fix` for a review-directed fix.
   Check the report against a quick verification (`git -C <repo> status` and,
   when applicable, `git -C <repo> log -1`). If the
   report is missing, malformed, or its claims do not match, send one
   correction round with the observed discrepancy — do not restart the task.
2. **Reset/handoff gate.** If the report hit a reset trigger, record its
   ledger line and start the next worker as a fresh investigation, diagnostic,
   or implementation round from the compact handoff. A reset is normal
   progress and counts as one worker round; do not make it a free, hidden
   continuation. Do not review an unfinished task.
3. **[strict] Review round.** Compose the review template with the task
   definition, the worker's 15-line report, and its commit hashes or recorded
   change range. A fresh `autonomous/review` subagent verifies independently and reports
   findings. See "Review gate" below.
4. **Gate.** In strict mode the task is only complete when a review round
   returns no blocking findings. Otherwise send a fix round (see below) and
   re-review. After a clean gate, check the opportunistic deep-review escalation
   triggers below before moving to the next task.
5. **Record the ledger line(s)** (one per round) and move to the next task.

### Step-cap recovery

If OpenCode ends a child because it reached its configured `steps` ceiling,
the coordinator does **not** resume that child or count its forced summary as
a completed task. Record `R<N>: <role> progress — step cap; fresh handoff
required`. Start a fresh agent of the same routed role. Give it the existing
active handoff plus the capped agent's final summary and instruct it first to
validate or repair the compact handoff before doing one concrete `NEXT`
action. This is a normal reset, not a malformed-report correction and not an
automatic retry loop. If the same task hits a step cap twice without reaching
a material decision or persisted outcome, stop and report it as blocked.

## Periodic deep-review gate

A clean per-slice review proves a slice; it does not reliably expose mistakes
at the seams between slices. Run one foreground `autonomous/deep-review`
round after the first applicable trigger below, but only after the current
slice has passed its normal gate:

- three accepted implementation slices since the last deep review;
- a milestone, release, or session-close boundary after two or more accepted
  slices;
- an accepted slice changes a public API, package/dependency identity,
  cross-repository contract, or submodule relationship; or
- the accepted range spans two repositories or roughly twelve non-handoff
  files.

Do not run it for a one-slice investigation, a docs-only session, or merely
because a normal reviewer emitted a non-blocking nit. It is an integration
gate, not a full repository audit and not a replacement for the strict
per-slice reviewer. Deep-review rounds do not consume the worker-round budget,
but are recorded in the ledger as `R<N>: deep-review clean|findings — ...`.

Give the audit the exact commit or diff range since the preceding deep-review
(or session start), the accepted-slice summaries, affected repositories, and
the cross-slice acceptance commands. It must independently run the relevant
integrated verification and inspect the whole supplied range. It appends an
audit verdict to the active handoff and follows the active persistence policy.
Blocking findings each receive a dedicated `autonomous/fix` round; judgmental
findings are followed by a fresh deep review scoped to the fix delta and the
invariants it touched, while mechanical-only rounds close by local
verification (see the Review gate's finding-class rules). Cap deep-review
re-audits at two per audit target per session; on a further blocking
verdict, stop and ask the user. Promote every non-blocking nit to a
`BACKLOG.md` checkbox before closing the audit.

## Opportunistic deep-review escalation

The per-slice reviewer is independent in context even when it inherits the
same model as the worker. After a slice passes its normal review gate, and
before archiving it, run one foreground `autonomous/deep-review` round over
that slice's commit or diff range when any of these is true:

- the slice touched a high-risk surface per the routing rules above —
  concurrency/async/cancellation/timing behaviour, the cross-repository
  contract surface, subtle shared-state behaviour, or security-relevant code
  paths (this includes every `implement-hard`
  slice);
- the slice needed two fix rounds (its review passed only on the third
  pass) — a struggle signal that worker and reviewer share a blind
  spot; or
- the user explicitly asks for a deep review on this slice.

Use the deep-review prompt template with a single-slice audit range.
Blocking findings each receive a dedicated `autonomous/fix` round; judgmental
findings are followed by a fresh escalated review scoped to the fix delta,
while mechanical-only rounds close by local verification (see the Review
gate's finding-class rules). Cap deep-review re-audits at two per target per
session, on top of the one escalation; on a further blocking verdict, stop
and ask the user. Escalation rounds do not consume the worker-round budget
and are recorded in the ledger as
`R<N>: deep-review clean|findings — escalated slice`.

Budget guard: run at most one opportunistic escalation per session. If a
further trigger fires, record it in the active handoff as a deferred-escalation
note and let the periodic gate pick it up on its normal cadence. The user may
always direct an additional escalation explicitly. Consult rounds are capped
at two per session, separately from the escalation and re-audits.

## Decision consultation (independent second opinion)

This skill runs unattended, so the escape hatch for a stuck decision is not
a question to the user: it is one foreground `autonomous/consult` round —
an independent second opinion. When a stop condition below would end in "ask
the user a question" about a reversible judgement decision (a blocked task,
a third review pass with surviving findings, a standard-setting question,
or any decision the handoff cannot settle), the main loop may run one
consult round instead of asking.

Give the consult exactly one decision: the question, the candidate options
with what each does to scope, budget, and risk, what was already tried and
why it failed, the acceptance conditions, and the cheap checks it may run.
It returns one recommendation with a confidence level; the main loop may
adopt it. Adoption is recorded like any other decision: a consult ledger
line plus a handoff note citing the consult round and its report, marked as
an **independently advised decision the user can veto later**.

Consult does NOT apply to: irreversible actions (force-push, deleting
branches, publishing — those stop and ask), user preference or taste (ask),
and anything `AGENTS.md` reserves to the user. A low-confidence consult, or
one that hedges despite its format, counts as no answer: ask the user.
At most one consult per decision and two per session. Consult rounds do not
consume the worker-round budget.

## Reset and handoff gate

End a worker round and start a fresh subagent when the first of these occurs:

- **Two hypotheses failed**, or the same build/test failure remains after one
  targeted fix and rerun.
- **Three consecutive exploratory actions** (search, read, probe, comparison)
  produced neither a material decision nor a persisted implementation.
- The work changes from implementing the assigned behaviour to understanding
  a new subsystem, upstream-parity question, package/provenance question, or
  cross-repository dependency.
- The next action is no longer concrete from the task's original acceptance
  condition.
- At a natural checkpoint, the worker cannot state the next action, evidence,
  and stop boundary compactly enough for a fresh agent to resume without
  rediscovering material context. This is a judgement call; do not reset just
  because a productive build, test, or verification sequence used many tools.

For a reset, the worker changes no unrelated code. It updates
`docs/handoffs/active.md` with at most: `GOAL`, `ESTABLISHED` (facts with file/command evidence),
`TRIED` (disproved hypotheses), `CURRENT STATE` (commits/files/tests), and
`NEXT` (one action for a fresh agent). A discovery round has one question and
a decision criterion; its conclusion becomes the next implementation round.

Use known repository paths with `git -C {REPO}` where practical. Never hide a
failed `cd` or verification with `2>/dev/null`; a navigation failure is a
blocker to report, not noise to suppress.

## Review gate

- **Blocking findings** — anything that must be addressed before moving on:
  build or tests fail; the active persistence policy was not followed;
  submodule pins do not match committed dependency changes when commits are
  required; scope deviation beyond the task; an `AGENTS.md` convention is
  violated; the handoff is not updated; or a report claim is contradicted by
  verification.
- **Nits** — style, naming, minor cleanup, "would be nice". The reviewer
  records them in the handoff; they never block.
- **Fix round.** One worker round per review pass, prompt: the original
  task plus the blocking findings list, scope = fix exactly these, then follow
  the active persistence policy. Then re-review.
- **Cap: two fix cycles per task** (at most three review passes). If
  blocking findings survive the third review, stop and ask the user — do
  not burn rounds on a wall.
- A review finding that is **pre-existing** (not caused by the task) and
  small: the main loop may assign it a dedicated fix round. Otherwise
  record it in the handoff and continue.

### Finding class: mechanical vs judgmental

Classify each blocking finding before the fix round. A finding is
**mechanical** iff it states or implies a locally re-runnable acceptance
check — an exact-phrase grep, a build or test, a file-state or git-state
check. A round whose findings are all mechanical is fixed, then verified
by the coordinator with exactly that check; it closes within the current
cycle and requires **no new review round** — reviewer budget
is not spent re-confirming a deterministic edit. Any judgmental finding
(correctness, behaviour, or design requires re-reasoning) makes the round
judgmental: after the fix round a re-review is required, scoped to the fix
commit range plus the consistency invariants the fix touched — not the
whole slice range.

**Standard drift.** If the same invariant is flagged in consecutive rounds
at a stricter standard (e.g., list mismatch → missing scope → verbatim
identity), treat it as a standard-setting question, not a defect: set the
standard once — codify the canonical form in this skill or the document —
apply it everywhere, and stop iterating against the reviewer's drift. A
standard-setting question is one of the few cases where the user's
judgement genuinely adds value; take a consult (see Decision consultation)
and codify its recommended standard — recorded as an independently advised
decision the user can veto — instead of guessing or stalling.

**Autonomy envelope.** The coordinator continues the fix → verify →
re-review loop without asking the user while all of these hold: the work
stays docs/config-only or is reversible under the active persistence policy;
the session's deep-review work stays within one opportunistic escalation plus
two re-audits plus two consults; and no single target has passed three fix
rounds. Breach any guard, or
reach an irreversible action — stop and ask. A standard-setting question
goes to a consult first (see Decision consultation). Asking is for guard
breaches, irreversible actions, and what a consult could not settle — not
for routine continuation inside the envelope.

## Worker prompt template

```
You are round {N} of {BUDGET} in an autonomous work session, {MODE} mode.
Work in the {REPO} repository at {PATH} (branch {BRANCH}). Related repos:
{OTHERS}.
Git persistence policy: {WORKING TREE | COMMIT | COMMIT AND PUSH, WITH BASIS}.

Goal (context only — you do only your task): {GOAL}

First read:
- {AGENTS.md path}, if it exists (follow its working conventions); otherwise
  skip this item
- {HANDOFF path}, section "{SECTION}" (current state and handoff)
- recent history: git -C {REPO} log --oneline -5
{any extra files, the previous round's NEXT line, or the review's
blocking findings list if this is a fix round}

Your task this round (scope: exactly this, nothing more):
{TASK}

Round budget: end and write the compact reset handoff after two failed
hypotheses, after three consecutive exploratory actions without a decision,
when the task becomes a different investigation, or when a compact handoff
would let a fresh agent continue more clearly. Do not reset merely because a
productive verification sequence used many tools. Do not continue in this
context after a reset trigger.

Before you finish you must:
- verify your work ({BUILD/TEST COMMANDS});
- follow the stated git persistence policy in every repo you changed, in
  dependency order, then update applicable outer-repository pins;
- update the handoff section so the next round starts from it.

Do not start any other task. Do not ask questions and do not wait for user
input — you cannot reach the user (the question tool and confirmation prompts
are denied in child sessions and would leave you stuck); make a reasonable
choice within this task and record it as an ASSUMPTION in your report. If a
reset trigger occurs, record evidence and `NEXT` in the handoff and stop so a
fresh subagent can take the next round.

Your final response must be the report and nothing else, in exactly this
format, under 15 lines total:
STATUS: done | progress | blocked
SUMMARY: <= 3 lines — what changed
EVIDENCE: commands run with results; git status/diff or commit hashes per repo
TRIED: only for progress/blocked — failed hypotheses or "none"
NEXT: one concrete next step
BLOCKER: only if blocked — what is missing and what decision is needed
```

## Reviewer prompt template (strict mode)

```
You are the independent reviewer for a completed task in an autonomous
work session. You did NOT do the work. Assume nothing the worker claims;
verify everything yourself. You make NO code changes. You are unattended in
a child session: never ask the user anything (the question tool is denied
and a prompt would leave you stuck); if the evidence cannot settle a claim,
record it as a blocking finding.

Task that was supposed to be completed (verbatim): {TASK}
Worker's self-report (unverified — check every claim): {REPORT}
Changes to review: {COMMIT HASHES OR BASELINE + WORKING-TREE DIFF per repo}
Git persistence policy: {POLICY}

First read:
- {AGENTS.md path}, if it exists (follow its conventions); otherwise skip
  this item
- {HANDOFF path}, section "{SECTION}"

Independently verify:
1. Build/tests: run {BUILD/TEST COMMANDS} yourself.
2. Persistence discipline: verify the stated policy. For working-tree mode,
   inspect status and diffs; for commit mode, verify commits and cleanliness;
   verify pushes only when the user explicitly requested them. Check that any
   outer-repo submodule pins match committed dependency changes.
3. Scope: inspect the stated commit or diff range; changes match
   the task, nothing beyond it, no drive-by refactors. Do not turn this into
   a repository-wide architecture, upstream-parity, or provenance audit
   unless that was the assigned task.
4. Conventions: {relevant AGENTS.md rules when present; handoff updated so the next round
   starts cleanly}.

Append your verdict to the active handoff (doc-only change, following the
   persistence policy): one line per task round — verdict, plus any nits as
   backlog items.
When the verdict closes the slice, archive the completed record and leave
the compact result and carried-open items in `BACKLOG.md`.

Your final response must be the report and nothing else, in exactly this
format, under 20 lines total:
VERDICT: clean | blocking findings
BLOCKING: one line per finding — what, where (file/commit), required action
NITS: one line each (or "none")
EVIDENCE: the commands YOU ran with results
```

## Deep-review prompt template

```
You are the independent integration auditor for accepted autonomous-mode
slices. You did NOT do the work. Make no product-code changes. You are
unattended in a child session: never ask the user anything (the question
tool is denied and a prompt would leave you stuck); if the evidence cannot
settle a claim, record it as a blocking finding.

Audit range: {COMMIT OR DIFF RANGE} across {REPOS}.
Accepted slices: {COMPACT_SLICE_SUMMARIES}
Integration acceptance: {BUILD/TEST COMMANDS and contract checks}
Prior audit or session boundary: {BOUNDARY}

First read:
- {AGENTS.md path}, if it exists; otherwise skip this item
- {HANDOFF path}, section "{SECTION}"

Independently verify the supplied range only: cross-slice correctness and
compatibility, integrated build/tests, compliance with the active git
persistence policy, submodule pins, handoff/backlog consistency, and regressions
caused by the combined changes. Do not expand into a repository-wide
archaeology audit.

Append a concise audit verdict to the active handoff, promote every nit to a
BACKLOG checkbox, and apply the active persistence policy to handoff-doc changes.

Your final response must be exactly:
VERDICT: clean | blocking findings
BLOCKING: one line per finding — what, where (file/commit), required action
NITS: one line each (or "none")
EVIDENCE: commands YOU ran with results
NEXT: one concrete action
```

## Stop conditions

Stop the loop and report to the user when any of these hit:

- **Goal met** — the final review (or, standard mode, the final worker
  round) shows it (green tests, persistence policy satisfied, handoff updated).
  Verify with one cheap command, then give the final report.
- **Budget exhausted** — give the final report; the handoff must make the
  next step explicit so work can resume.
- **Same task blocked two rounds in a row** — stop; a consult may open a
  materially different path (one more round if so), otherwise do not burn
  rounds on a wall that only the user can decide.
- **[strict] Three review passes with blocking findings** — stop; one
  consult on the surviving findings first (see Decision consultation), then
  ask if it does not commit.
- **Autonomy-envelope guard breach** — deep-review work beyond one escalation
  plus two re-audits, a fourth fix round on one target, or work leaving
  docs/config-only/reversible scope — stop and ask.
- **A decision or irreversible action is required** (force-push, deleting
  branches, publishing, or anything `AGENTS.md` flags) — irreversible
  actions and user preference stop and ask (consult does not apply);
  reversible judgement decisions get one consult first (see Decision
  consultation).
- **Two consecutive worker rounds with no net progress** — stop and
  summarize.

## Final report (main loop, ≤ 15 lines)

- The round ledger, one line per round.
- What was achieved, with evidence (changed files or commit hashes, test
  results, review verdicts).
- Where the work now stands (handoff state) and the exact next step.
- Open blockers or decisions needed.

**Persist before printing.** State lives on disk, not in the conversation
(core rule 3) — the printed report is not the record. Before giving the
final report, the main loop writes the report's pertinent info to the repo
handoff archive (a dated **session-close handoff paragraph** in the current
monthly archive, following the active git persistence policy): the round ledger
(one line per round with change references and verdicts), the final verified
state (build/test evidence, per-repo persistence state and pin match), the open
nits already tracked as checkboxes, and the exact next step. Update `BACKLOG.md` and
`docs/handoffs/active.md` so they retain only current state, the carried
open items, and one exact next action; add an archive pointer for the closed
session. Update any stale references in place where repository policy
requires it. The printed report mirrors the saved archive paragraph and
points at its path and commit hash when one exists. This is a coordination edit
the main loop may make itself even though it normally does not edit files.

## Anti-patterns

- Letting the main loop read long source files "just to check" — that is
  what the subagents are for.
- Telling a subagent "continue where you left off" without pointing it at
  the handoff file — it has no memory of previous rounds.
- Parallel or background subagents. This mode is sequential by design.
- A worker reviewing its own work, or a reviewer fixing code — the roles
  never blur; fixes are always a worker round.
- Treating nits as blocking (infinite fix loops) or ignoring blocking
  findings to save a round.
- Trusting a "done" or "clean" report without one cheap verification.
- Expanding a round's scope because "it's close" — the round ends on the
  slice it was given.
- Letting a worker use repeated probes, build reruns, or source archaeology
  to avoid a reset — a fresh, compact handoff is the intended recovery path.
- Routing a routine slice to `implement-hard` "to be safe" — it is for
  reasoning-heavy work only; wall-clock is the cost.
- Running the deep reviewer on routine slices "to be safe" — escalation is
  trigger-based and capped per session.
- Re-running the full review after a mechanical fix — a deterministic edit
  verified by its own deterministic check closes within the cycle; review
  budget is a scarce resource.
- Iterating against a reviewer's drifting standard — consecutive rounds
  flagging the same invariant at stricter precision is a standard-setting
  question to fix once, not a defect to chase.
- Asking the user for routine continuation inside the autonomy envelope —
  asks are for guard breaches, irreversible actions, and what a consult
  could not settle.
- Asking the user a question one consult round could settle — an unattended
  session gets its second opinion before it gets the user's; the consult is
  the escape hatch, capped at two per session.
- Spending a consult on a user preference, taste, or an irreversible
  action — those go straight to the user; a second opinion cannot veto a
  force-push or decide what the user wants.
