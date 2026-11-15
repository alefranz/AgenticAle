# Work-coordination examples

These examples are acceptance cases for interpreting the coordination rules in
the [work skill](../skills/work/SKILL.md), the
[shared round contract](../skills/work/references/rounds.md), and the
[autonomous skill](../skills/autonomous/SKILL.md). They describe expected
coordinator decisions; they are source-interpretation examples, not live host
tests.

## Coherent existing changes with an empty `/work --pr`

The branch and working tree contain coherent, complete changes made outside
the session — manually or by another agent — and the user invokes `/work --pr`
without task text.

Expected behavior:

- Adopt the existing changes as the task: with no explicit task text and no
  active task, the task-selection chain inspects the branch and working-tree
  changes and adopts them because they form a coherent, sufficiently
  understood task.
- Briefly explain the selected scope and apparent outcome as progress
  narration, not a confirmation gate.
- Review the changes independently, fix concrete findings, and complete the
  PR delivery endpoint: checks, coherent commits, push, and the created or
  updated pull request.
- Never require the user to restate the task, and do not assign an
  implementation round to modify already-complete work.

## The same changes with an empty `/work`

The same coherent uncommitted edits, and the user invokes `/work` without
task text and without `--pr`.

Expected behavior:

- Adopt the changes, review them, and fix concrete findings as necessary.
- Leave the changes uncommitted by default: an empty invocation without
  `--pr` authorizes no commit, push, or pull request.

## A preceding same-session review with findings

A `/review` earlier in the same session returned findings on the current
branch's changes, and the user now invokes `/work --pr` without task text.

Expected behavior:

- Use the review's findings and scope directly: no copying of the report and
  no restating of the task.
- Recheck the current repository state and each finding's applicability
  before acting; reuse the review's evidence that still covers the same
  content and checks, and run no redundant initial review.
- Fix the findings, apply the existing fix and re-review rules to the
  changes, then complete the PR delivery.

## A preceding clean review with `--pr`

A `/review` earlier in the same session returned a clean verdict on the
current changes, and the user invokes `/work --pr` without task text.

Expected behavior:

- Do not manufacture implementation work from the clean review, and do not
  duplicate the valid review: reuse its evidence where it still covers the
  same content and checks.
- Complete the outstanding delivery steps — commits, push, pull request — and
  report the result.
- If the reviewed result is already delivered and nothing remains, say so
  instead of publishing again.

## An explicit request to begin with a deep review of existing changes

The branch and working tree contain existing changes, and the user invokes
`/work First perform a deep review of the current branch changes. If there are
blocking findings, fix them, verify the fixes, then commit, push, and create
or update the PR. Otherwise, report the clean review and stop.`

Expected behavior:

- The explicit request selects the review-deep contract for the first review
  round, before any implementation round: the same contract and role as a
  standalone `/review --deep` under equivalent configuration, with the same
  comparison and scope — the recorded merge-base-to-working-tree comparison of
  the current branch, including relevant untracked files, stated before
  dispatch.
- A clean verdict stops with the report: no implementation work is
  manufactured, and nothing is committed, pushed, or published because the
  task's conditional delivery instruction names publication only after fixes.
- Blocking findings enter the normal loop: a focused fix round, verification
  of the fixes, and an independent re-review within the existing caps, after
  which the commits, push, and created or updated pull request follow.
- The selection is explicit-only: an ordinary `/work` invocation without such
  a request is unchanged, a deep review is never started on the coordinator's
  own initiative, and merely mentioning one does not select it. The request
  adds no command, flag, role, or routing configuration, and it is not a
  general rule for multi-step command chaining in the task text.

## No task and no changes

The user invokes `/work` without task text, there is no active task or
preceding review, and the branch and working tree have no changes beyond the
base.

Expected behavior:

- Ask what to work on; create nothing — no branch, no commit, no pull
  request, and no invented task.

## Competing changes and ambiguous scope

The working tree holds several unrelated changes — or the conversation
references competing tasks — and the user invokes `/work` without task text.

Expected behavior:

- Ask one focused scope question naming the competing candidates; never
  silently choose between them, and never treat a stale conversation
  reference as an active task.
- Preserve all changes while asking: nothing is staged, committed, or
  discarded.

## An explicit task alongside unrelated dirty work

The user invokes `/work <task>` while the working tree contains unrelated
staged and unstaged changes.

Expected behavior:

- The explicit task text controls scope; the unrelated changes are not the
  task.
- Inspect the staged, unstaged, and untracked changes deliberately and
  preserve them, including unrelated staged content; attribute overlapping
  edits before changing or committing them.

## Missing consequential product intent

The adopted existing changes carry no user-supplied requirements, tests, or
documented contract that establishes the desired behavior.

Expected behavior:

- Distinguish user-supplied requirements and context from observed behavior
  and repository contracts, and from inferred purpose; do not approve the
  implementation for matching its own current behavior as if that were the
  intent.
- Establish checks from existing contracts, tests, reproductions,
  documentation, and relevant implementation context; the absence of a worker
  report or original implementation history is not itself a defect.
- Ask the user about the missing consequential behavior through the
  coordinator; a consult may answer a bounded technical question but cannot
  invent a user preference.

## Existing autonomous state is not resumed

The repository carries autonomous-mode handoff or backlog state from a prior
durable project, and the user invokes `/work` without task text.

Expected behavior:

- Never implicitly resume the autonomous handoff: the existing autonomous
  state is not an active task unless the user explicitly supplies it as
  context.
- Follow the task-selection chain: an unambiguous current task, coherent
  existing changes, or a focused question when no selection is safe.

## Clear but complex change with a shared-state signal

The request is a clear refactor of a billing module that writes to a database
other jobs also update, and the module exposes a public API. The intent is
clear.

Expected behavior:

- Run the brief material-risk assessment before dispatching: independently
  mutable persisted state (the shared database) and a compatibility surface
  (the public API) are flagged.
- Use the signals to focus the inspection and to decompose the change into
  verifiable slices; do not start a lengthy planning round.
- Keep the overall acceptance criteria stable across the slices.

## Trivial boundary question answered by a direct read

One small question stands between the coordinator and the first
implementation slice: which file owns the retry helper the task mentions.

Expected behavior:

- Answer it with a direct read in the coordinator context.
- Do not dispatch an explore round; no cheap discovery round is mandatory.

## Uncertainty that could change the slice boundary

The slice depends on how an external service reports rate limits, and the
answer would change the slice's contract and tests. The question concerns
subtle concurrency semantics.

Expected behavior:

- Dispatch one focused explore round with exactly one question and a stop
  condition.
- Resolve the explore route through the routing contract; the subtle
  semantics do not make the question automatically suitable for a fast route.
- Wait for the answer before fixing the slice boundary; do not implement
  around an unverified contract.

## Checkpoint after a substantive worker result

A worker reports progress: the parser handles the new format, but two error
paths are unimplemented and its assumption about a lockfile layout proved
wrong.

Expected behavior:

- Checkpoint before the next round: record what is established (the parser
  path), what remains unverified (the error paths), the changed assumption
  (lockfile layout), and the allowance left for the next action and its
  review.
- Decide from the evidence whether a local correction or a design
  reconsideration is needed, and update the concise decision summary before
  the next substantive dispatch.

## Decision summary is user-visible, not hidden-only

After a substantive worker result, the coordinator updates the session
context (or the active handoff in Autonomous Mode) with the new state and
dispatches the next round without telling the user anything.

Expected behavior:

- Treat the hidden-only update as insufficient: before the next substantive
  dispatch, send the user a concise decision summary — the prior outcome,
  any change of approach, the next evidence to collect, and any approaching
  limit or material uncertainty.
- Also retain the compact state in the workflow's existing state: session
  context in reviewed task work, the active handoff in Autonomous Mode.
- The summary is progress narration about decisions and evidence, not
  individual tool calls or internal chain-of-thought; a routine
  verification-only check needs no summary.

## Readable narration across a fix and review

Local checks pass, but coordinator verification finds that a rename broke
migration from older installs. The next assignment is a focused fix, followed
by independent review. The routes are valid and unchanged.

Expected behavior:

- Combine outcome, consequence, and next assignment into one short paragraph:
  "The checks passed, but verification found that the rename breaks migration
  from older installs. I'm assigning a focused fix to preserve those paths."
- After verifying the targeted checks, connect the fix to the next gate:
  "The migration fix passes the targeted checks. An independent reviewer will
  now check the full change, including compatibility with older installs."
- Do not add separate checkpoint/dispatch announcements or recite role codes,
  model/effort strings, default provenance, "no fallback", or routine counters.
  Keep the complete routing records and counters in the workflow's state.
- A configured model differing from the packaged default needs no recurring
  explanation. If the user requests model visibility, add a short selection
  label; do not claim configured settings prove what actually ran.

## Routing trouble and approaching limits remain visible

Expected behavior in either workflow:

- If the next assignment uses the hard route because a finding involves shared
  state, explain the reason: "This fix involves concurrent writes, so I'm using
  the configured route for complex changes." Include model details
  when useful to distinguish the selection, not a full provenance dump.
- If an installed profile does not match the resolved request, report the
  requested and available settings and the next action under the binding's
  rules. Do not hide the mismatch as routine configuration or silently dispatch
  the available profile.
- If a permitted fallback is attempted, explain what was unavailable and which
  configured alternative is being tried. Narration does not authorize a fallback
  or override either workflow's provider-quota policy.
- If the next fix uses the last permitted attempt, say so and explain what
  happens if blockers remain. Preserve exact counts in state and the stop report.

## First assignment, final result, and collapsed children

Expected behavior in either workflow:

- Before the first assignment, state its purpose without inventing prior work:
  "I'll start with a focused investigation of where the migration loses the old
  paths, so the fix preserves existing installs."
- Make the main conversation understandable without opening child activity;
  do not rely on a particular host collapsing it or repeat the full child report.
- On completion, deliver the result and verification once. Do not insert a
  redundant checkpoint summary before the final report, and do not issue updates
  for unchanged waits or routine verification-only checks.

## Repeated invariant: real design issue versus reviewer drift

A reviewer flags a missing cache-invalidation invariant. A fix is made; the
next reviewer flags the same invariant in different words, and the third
flags it more strictly still.

Expected behavior:

- First classify the repeated finding instead of assuming drift.
- Actual defect: a second write path bypasses the cache, so the invariant
  is genuinely unmet by design. Reopen the plan through the replanning
  signal and reconsider the state model or approach; the original
  acceptance criteria stay intact, the fix/review counters for the target do
  not reset, and the scope is not weakened.
- Preference: the behaviour already meets the acceptance and the later
  rounds only tighten the wording standard (e.g., list mismatch → missing
  scope → verbatim identity). Settle the standard once through the decision
  policy, apply it everywhere, and stop iterating against the drift.

## Allowance exhausted with the review still permitted

The worker allowance is spent on its last permitted worker round. The
slice's changes are in the tree.

Expected behavior:

- Do not dispatch another worker round.
- Run the permitted review of the last allowed worker; the review cap is
  separate from the worker allowance.
- If more work is then required, stop with the exhausted allowance, the
  completed and blocked state, and the recent material progress.

## Worker allowance is a ceiling, not a work target

The requested outcome is complete after three of the default twelve worker
rounds, the accepted slices pass their reviews, and the remaining allowance is
unused.

Expected behavior:

- Stop and deliver: the outcome, its evidence, and the delivery state.
- Do not dispatch extra rounds to consume the remaining allowance or
  manufacture further work; the unused allowance is not a defect and needs
  no explanation in the narration.

## Decomposition and replanning do not replenish the allowance

Mid-sequence, five of the twelve worker rounds are used, and a finding forces
a replan that re-outlines the remaining work as three new slices.

Expected behavior:

- The replan reorganizes scope only: the remaining worker allowance stays at
  seven rounds, the fix/review counters for any still-unresolved target are
  unchanged, and a new slice name grants no rounds.
- If the re-outlined work cannot finish within the remaining allowance, stop
  under the stop and continuation rules, identifying the specific exhausted
  allowance when it is reached.

## Structured stop with an interaction tool available

A slice has used both fix cycles with blocking findings still open, and the
host offers an interaction tool.

Expected behavior:

- Stop before any further dispatch and report the exhausted fix allowance,
  what is completed, what is blocked, and the recent material progress.
- Offer the situation-appropriate choices, for example "Replan before
  continuing", "Continue for one additional fix-and-review cycle", or "Stop
  and preserve current work".
- Recommend one of them from the evidence.

## The user declines the extension

The user declines the offered additional fix-and-review cycle.

Expected behavior:

- Stop without asking again and without scheduling a resume.
- Preserve the current work and include the self-contained continuation
  prompt in the stop report.

## No interaction tool available

The same exhausted-allowance stop occurs on a host with no question tool.

Expected behavior:

- State the options in the stop report instead of offering them
  interactively.
- Include the continuation prompt; do not wait for input the host cannot
  deliver.

## Extension increments, never resets

The user approves "Continue for one additional fix-and-review cycle".

Expected behavior:

- Add exactly that increment: one fix round and its re-review.
- Do not reset the fix or review counters, do not expand scope, and grant no
  review or Git rights the user did not name.
- A replan requested through the same grant stays bounded: child rounds of
  the replan consume allowances.

## Exhausted fix and review allowances: a consult cannot grant another fix

Strict mode. A slice has used both fix cycles, the third review pass still
carries blocking findings, and a consult on the surviving findings
recommends a specific repair.

Expected behavior:

- Do not dispatch a third fix cycle or a further review pass: the shared
  two fix cycles and three review passes gate every dispatch, and a
  consult's recommendation is a second opinion, not an allowance.
- Report the exhausted fix and review allowances with the completed and
  blocked state and the recent material progress, and offer the
  situation-appropriate choices — a bounded replan, one additional bounded
  fix-and-review cycle, or a stop that preserves the current work — naming
  the worker, fix, and review increments each choice consumes.
- Continue only if the user grants the named fix and review increments. A
  declined or unanswered option ends the stop with the continuation prompt:
  do not ask again, do not schedule a resume, and leave the work in its
  preserved state.

## Exhausted worker budget: a consult's different path still consumes an allowance

The worker budget is spent and the same task has blocked two rounds in a
row. A consult recommends a materially different approach.

Expected behavior:

- Record the consult's recommendation as an independently advised decision,
  but do not dispatch a worker round from it: the worker budget is
  exhausted and a consult cannot grant one.
- Offer the user the choice of granting the named worker increment — with
  the fix and review rounds the continuation needs — or stopping; a
  declined or unanswered option ends the stop with the continuation prompt,
  no re-ask, and no scheduled resume.

## Autonomous budgets: a 20-round run with an exhausted task

An Autonomous run starts with `/autonomous 20 <goal>` (run ceiling 20). The
first genuine task T1 (CSV export) consumes its full task allowance of 12
worker rounds and is exhausted with part of the work unfinished. Two other
truly independent ready tasks follow: T2 (logging) consumes 3 worker rounds
and T3 (docs) consumes 2, each completing its review gate.

Expected behavior:

- Every explore/implement/fix round is charged once to both its task and the
  run: T1 12/12, T2 3/12, T3 2/12; run consumption 12 + 3 + 2 = 17 of 20, so
  the effective run remaining is 3. The budget line and the backlog counters
  record exactly these numbers.
- T1's exhaustion dispatches no further worker round for T1, but verification
  and the permitted review of its completed changes still run; the unfinished
  part stays incomplete with findings, current state, and one next action in
  a resumable backlog packet — never archived as completed.
- T2 and T3 are genuinely new tasks: each receives a fresh allowance of 12.
  Their selection is safe despite T1's unfinished changes in the tree because
  they are truly independent; a task depending on T1's unfinished work would
  not be ready.
- The run does not stop at T1's exhaustion: an individual task limit alone is
  not a run stop. It stops only when the goal is met, the run ceiling is
  exhausted, no safe ready work remains, a steering pause applies, or an
  existing safety/blocker/human-decision gate hits.
- Continuing T1 later needs a named user grant to T1's task allowance (and
  run remaining); the grant never resets counters. Review, review-deep, and
  consult rounds consumed none of the worker budgets and kept their own caps.

## Task exhaustion: independent ready work continues, gates never bend

A task's allowance is exhausted with blocking review findings still open on
its unfinished part, and the backlog holds another ready task whose changes
touch the same uncommitted files, plus a third task that is truly independent.

Expected behavior:

- No further worker round for the exhausted task; the permitted review of its
  completed changes still runs, and the open findings stay visibly open.
- The file-overlapping task is not safely separable from the unfinished work:
  it is not ready, and selecting it would risk the unfinished changes. The
  truly independent task may be selected with its fresh allowance.
- No review gate, dependency, or safety boundary is bypassed to keep the run
  going, and no task is manufactured to spend the remaining run budget. When
  no safe ready task remains, the run stops with the preserved state, the
  deferred packets, and the continuation prompt.

## Fresh allowance only for genuinely new tasks

Within one Autonomous run, a task is decomposed into three slices, replanned
after a rejected experiment, interrupted once, and resumed in a fresh
session.

Expected behavior:

- The task keeps one stable ID and one allowance of 12 across all of these
  events; every explore/implement/fix round — including the reset
  continuation and the resumed work — charges the same task and the same run.
- Decomposition, replanning, interruption recovery, and resume replenish
  neither the task allowance nor the run ceiling, and re-issue no task ID.
- A genuinely new task (a distinct backlog outcome, not a renamed slice of
  the same one) receives its stable ID when it enters the backlog and its
  fresh allowance only when first selected; an ID alone grants no rounds.

## Numeric resume never resets persisted counters

An Autonomous run recorded ceiling 6 with 5 worker rounds consumed. The user
resumes with `/autonomous 3`; later, with `/autonomous 10`; later still, with
plain `/autonomous`.

Expected behavior:

- `/autonomous 3` sets the run ceiling to 3; consumed stays 5, so the
  effective remaining is zero and the run stops budget-exhausted under the
  allowance-stop rules instead of silently resetting. The report offers the
  named increment a continuation needs.
- `/autonomous 10` sets the ceiling to 10 with consumed still 5: remaining 5.
  Plain `/autonomous` continues the recorded ceiling and counters unchanged.
- No resume recomputes consumption from the ledger's length, resets counters,
  or re-issues task IDs; a user grant adds exactly the named rounds to the
  named budget.

## Crash with a pending dispatch: no double charge, no free replay

The coordinator persisted a worker round's dispatch record, incremented
counters, and pending-dispatch note, then the session crashed before the
child's report was read — or, in a variant, before the child launched at
all. A fresh activation inspects the working tree and host evidence.

Expected behavior:

- Reconcile the pending record once against the actual evidence before
  dispatching again: the child's material work keeps the single recorded
  charge against both budgets; a confirmed no-work quota rejection removes
  the pending charge; a complete charge whose child never launched — no
  host or working-tree evidence of a launch — removes it too and restores
  the pre-launch counters, because no round ran; the continuation is a new
  round with its own single charge.
- Never charge the same round twice, and never let a replay of productive
  work run free of its recorded charge. The run/task identities, consumed
  counters, and pending-dispatch evidence survived the crash in the existing
  handoff and backlog.

## Steering pause at a safe checkpoint, then resume

A worker round is in flight when the human sets `mode: pause` in the
`## Steering` section of `BACKLOG.md`. Later the human sets `mode: continue`
and invokes `/autonomous`.

Expected behavior:

- The running child is allowed to settle; its result and single charge are
  recorded, the exact `NEXT` and all counters are preserved, and the loop
  stops with a pause report and the continuation prompt. No mid-round
  interruption, no polling, no watcher or service.
- The coordinator notices the pause at its next steering re-read — before
  every new round dispatch, including reviews, fixes, and consults — not by
  watching the file continuously.
- The fresh activation re-reads the section: `continue` resumes the recorded
  `NEXT` with the same identities and counters; a still-present `pause` stops
  again without dispatching. With no new steering instruction, continuation
  is normal.

## Steering priority with blocked IDs

The active task is mid-round when the human sets `priority: T4, T2`. T4 is
blocked (it depends on an unfinished task); T2 is ready.

Expected behavior:

- The active task and the running round are not interrupted; priority applies
  only at the next task-selection boundary.
- At that boundary, T4 is skipped with a recorded note — priority never
  unblocks a blocked, dependent, or unknown ID — and T2 is selected before
  other ready tasks in normal backlog order.
- Review gates, dependencies, and safety rules are unchanged; a priority list
  grants no allowance and authorizes no Git action.

## Concurrent human steering edit survives an agent backlog write

The coordinator is about to tick a completed checkbox in `BACKLOG.md`; while
it works, the human edits the `## Steering` section.

Expected behavior:

- The coordinator re-reads `BACKLOG.md` immediately before its targeted write
  and applies only its own change to the fresh content; the human's steering
  edit survives. No stale whole-file overwrite.
- Children never edit the Steering section; their operational notes leave it
  untouched, and the same fresh-re-read discipline applies to their backlog
  notes.

## Deferred packets and stable identities across switching and archival

Task T1 is deferred unfinished when T2 is selected; T2 later completes its
review and persistence gates and is archived; T1 is then resumed.

Expected behavior:

- Switching first writes T1's compact packet — stable ID, task counters
  (never a run-consumption snapshot), established facts, current state,
  acceptance, exactly one resumable `NEXT` — into the backlog's deferred
  entries, then restores T2's packet into `active.md` with the run identity,
  ceiling, and consumed carried unchanged from the outgoing budget line,
  then updates the backlog's single active next action. T1 is not archived
  as completed.
- T2's archive record carries its stable ID and final counters. Resuming T1
  restores its recorded packet, identity, and counters unchanged — switching
  tasks and archiving completed work never reset or re-identify consumption.
- All of this uses the existing `BACKLOG.md`, `active.md`, and monthly
  archive; no new state file is created.

## Torn counter write reconciles from the backlog mirror

The coordinator's pre-launch `active.md` charge write tears after the
incremented counters but before the dispatch record and pending-dispatch
note. The file keeps a readable budget line showing run 4 and T1 4, while
the verified backlog mirror still reads run 3/6 and T1 3/12. No child was
launched — the charge was never read back as durable.

Expected behavior:

- The resume validates the complete packet before trusting the readable
  line: the incremented counters have no backing dispatch record or pending
  note, so they are a torn write, not consumption. It rebuilds from the
  verified pre-launch mirror — run consumed 3 and T1 consumed 3, never a
  value from a deferred task packet — repairs `active.md`, and dispatches
  the round with one new charge: run 4, T1 4 after the first actual round.
- The unverified counters never reach the backlog mirror: mirroring the
  readable 4 first and then charging the dispatched round would reach run 5
  for one actual round. A fully unreadable or missing `active.md` rebuilds
  from the mirror the same way.
- No double charge and no free round: if the tree and host evidence instead
  show a launched round whose charge was lost, that single charge is applied
  exactly once during reconciliation.

## Interrupted task switch loses no packet and no consumption

Exhausted T1 (12/12) is being deferred in favor of ready T2. T1's deferred
packet is durable in the backlog when the session dies before `active.md` is
rewritten.

Expected behavior:

- A complete, coherent `active.md` still names T1: the validated active
  packet wins, the duplicate deferred entry is removed (nothing is lost —
  it was copied from the active packet), and at the next selection boundary
  T1 is worker-ineligible, so the loop defers it again and selects T2.
- A torn or incoherent `active.md` — even one whose budget line is still
  readable — is rebuilt from the backlog: T1 from its deferred packet, run
  consumed from the status mirror, never a stale run count from the task
  snapshot. The deferred packet is never deleted on the strength of an
  unvalidated active packet. T1's counters and T2's fresh allowance are
  unchanged.

## Exhausted-first priority must not stall selection

Steering sets `priority: T1, T2`. T1's allowance is exhausted with its
packet deferred; T2 is ready and truly independent, and T1's completed
changes still await their permitted review.

Expected behavior:

- T1 is skipped in worker selection with a recorded note even though
  steering names it first; T2 is selected with its fresh allowance and the
  run progresses. The exhausted task never repeatedly wins selection.
- T1's permitted review remains schedulable under the unchanged review caps
  and debits neither worker budget. No gate, dependency, or conflict is
  bypassed, and no task is manufactured.

## Priority can name a never-selected task

The round-0 plan recorded T1, T2, and T3 in the backlog with stable IDs;
only T1 has been selected so far. The human sets `priority: T3, T2` before
the next selection boundary.

Expected behavior:

- T3 and T2 are nameable because IDs are assigned at backlog entry, before
  selection. At the boundary, ready named tasks are considered in listed
  order; a named task that is not ready is skipped with a note.
- Selecting T3 allocates its fresh allowance then — the ID granted nothing.
  Readiness, review gates, and dependencies are unchanged.

## Goal text during an active run is steering, not a conflict

An Autonomous run is active: T2 is mid-task with consumed counters and an
open review gate, and T1's deferred packet sits in the backlog. The user
invokes `/autonomous Also add PDF export next to the CSV export`.

Expected behavior:

- Reconcile the invocation against a fresh re-read of `BACKLOG.md` and
  `active.md`; do not report a conflict and do not overwrite the active
  handoff, the deferred packet, or any counter.
- Decompose the explicit new outcome into backlog tasks: each genuinely new
  task enters the backlog with its stable ID before selection and receives
  its fresh allowance only at first selection. The run identity, ceiling,
  consumed counters, T2's allowance and counters, and every open review gate
  are preserved.
- Continue the recorded `NEXT` action; the new tasks become selectable at
  the next selection boundary under the normal readiness rules. The
  reconciliation is recorded in the existing backlog and active handoff.
- The invocation text is not written into the human-owned `## Steering`
  section, which keeps exactly its two documented controls.

## Continuation steering preserves identities, counters, and gates

The same active run receives `/autonomous Focus on the migration tests
first; the CSV polish can wait`, with ready tasks T2 (CSV polish) and T3
(migration tests) and T4 mid-round.

Expected behavior:

- The explicit reordering applies at the next task-selection boundary among
  ready tasks; the active slice and the running round are never interrupted.
- Acceptance or constraint changes reach the backlog entries and the active
  packet only where the user's text explicitly supports them. No task ID is
  re-issued, no consumed counter, allowance, or fix/review counter resets,
  and no gate is bypassed; steering grants no allowance.
- A steering invocation keeps the recorded persistence policy: a
  working-tree or commit-only run gains no push rights from it.

## Ambiguous destructive replacement asks before rewriting state

With an active handoff and deferred packets, the user invokes
`/autonomous Start over with a cleaner approach`. A variant instead names
exactly what to discard: "Discard T3 and its deferred packet; replace it
with a schema-first approach".

Expected behavior:

- The ambiguous request stops and asks the user before any state is
  rewritten: the active handoff, deferred packets, counters, and audit
  material are preserved while asking.
- The explicit, unambiguous variant is honoured only for what it names;
  unrelated tasks, counters, and audit material survive, and discarded audit
  detail is archived, never deleted.
- Neither variant resets the run's consumed counters or re-issues IDs for
  tasks that remain.

## Slice review precedes the task persistence gate

A strict-mode run under the commit-and-push policy finishes a slice; its
changes are verified and sit uncommitted in the working tree. The
independent reviewer is dispatched before the task persistence gate has run.

Expected behavior:

- The reviewer inspects the range at its current phase — the uncommitted
  working-tree result — and records its verdict in the active handoff as a
  working-tree note. It does not require task commits or a confirmed push
  the gate has not performed yet, and it never commits, pushes, archives
  the slice, or marks the task completed.
- The coordinator owns final persistence verification at the task
  persistence gate after the review and applicable deep review gates close,
  and owns the archival of the completed record after the gate is satisfied.
- A review whose supplied range already includes commits — for example a
  re-review after the gate — verifies coherent task commits and cleanliness,
  and verifies a confirmed push only when the recorded persistence state
  says the push already happened.

## Completed task: coherent commits and confirmed push before the next task

A new run uses the default commit-and-push policy. Task T1 contains two
accepted slices; the second triggered an opportunistic deep review, which
returned clean. T2 is ready in the backlog.

Expected behavior:

- T1 completes only after its required checks, both slice review gates, and
  the applicable deep gate have closed. The coordinator — not the workers —
  then stages only T1's accepted product changes and creates coherent task
  commits (one per logical change, not one per agent round).
- The coordinator pushes with ordinary Git semantics to the resolved
  upstream and verifies success. It then runs exactly one bounded state-only
  finalization: the completion record — result line with the product commit
  hashes and confirmed destination, archived detailed record, updated active
  handoff — is written into the existing state files, committed as one
  state-only commit (never product changes or unrelated work), and pushed
  and confirmed to the same destination. The finalization commit's own hash
  is never written back into the state it commits; later records read it
  from git history.
- T1 is marked completed and T2 selected only after the finalization is
  confirmed — the local acknowledgment is a read-only verification, not
  another state write, so no recursive record-your-own-hash loop exists.
- The persistence state (accepted, committed, push pending/confirmed) is
  durable in the active handoff and mirrored on the backlog task entry as it
  advances, so an interruption at any step resumes exactly there.
- Under a recorded commit-only policy the same gate requires the coherent
  commits and the state-only finalization commit but no pushes; under
  working-tree policy neither commits nor pushes — the recorded policy is
  never bypassed.

## Explicit restrictions win over the commit-and-push default

A new run is invoked with "commit each task but do not push", and another
run's repository instructions forbid pushing. A third invocation says
"leave everything uncommitted".

Expected behavior:

- Each run adopts and records the restricted policy with its basis —
  commit-only, commit-only, and working tree respectively — and follows it
  at every task gate. The default never bypasses an explicit user or
  repository restriction.
- A later resume of any of these runs — empty, numeric, or steering — keeps
  the recorded policy; push rights arrive only through an explicit user
  request, recorded with its basis. A handoff with no recorded policy
  predates the default and resumes as working tree.

## Unsafe or ambiguous push destination stops before pushing

A commit-and-push run reaches its first task gate while the checked-out
branch is `main`; in variants, the branch has no configured upstream, two
remotes make the target ambiguous, or repository instructions protect the
destination branch.

Expected behavior:

- Resolve the destination from the branch's configured upstream and any
  repository instruction before pushing; re-check it at every push.
- Stop and ask the user before pushing in each variant; the task stays open
  with its commits and exact persistence state preserved, and the stop
  carries the continuation prompt.
- Never create a branch, change remotes, force-push, merge, or open a pull
  request to make the push succeed, and never redirect the push to a
  different destination on the run's own initiative.

## Failed or uncertain push preserves exact state

The task's commits exist locally. The push is rejected non-fast-forward
because the remote advanced; in variants it fails with a network error or
returns an uncertain result.

Expected behavior:

- Record the exact persistence state — accepted task, commit hashes,
  destination, and the push evidence or error — in the active handoff and
  backlog. Keep the task open: it is not archived or reported as completed,
  and the next task is not selected.
- Stop with the continuation prompt. No force-push, no automatic merge or
  rebase, no blind retry; a non-fast-forward rejection is resolved by
  preserving state and asking, not by rewriting history.
- A resume inspects the actual local history and the remote read-only before
  retrying the exact unfinished persistence step.

## Interruption between commit, push, and completion reconciles

The session dies after the task commits were created but before the push;
in variants, the push succeeded but the state finalization never ran; the
finalization commit was created but never pushed; or the finalization push
succeeded but the local acknowledgment never happened. A fresh activation
resumes the run.

Expected behavior:

- Re-read the durable persistence state, then inspect the actual local
  history and the remote (read-only fetch or ls-remote) to establish which
  steps already happened before any next-task work.
- Committed-but-unpushed: resume the push of the existing commits — never
  re-commit or duplicate them. Pushed-but-unfinalized: verify the product
  push, complete the completion-record writes from the confirmed hashes and
  destination, then create and push the one state-only finalization commit.
  Finalization-committed-but-unpushed: push that existing commit as-is,
  never a second finalization commit for the same task.
- Finalization-pushed-but-unacknowledged: confirm the finalization commit's
  remote ancestry or content; the gate is satisfied without any further
  write — the acknowledgment is read-only — and the next task is selected
  without replaying work or adding commits.
- A commit already on the remote is never duplicated, and the task is marked
  completed only once the whole gate is confirmed satisfied. Identities and
  counters are unchanged by the reconciliation.

## Task commits preserve unrelated work and secrets

At the task gate, the working tree also holds unrelated staged and unstaged
edits, an untracked scratch file, and a locally modified credentials file;
one source file mixes task edits with an unrelated human edit.

Expected behavior:

- Stage and commit only the task's accepted changes; the unrelated staged,
  unstaged, and untracked work and the credentials file are preserved and
  never swept into a task commit or a push.
- Overlapping edits that cannot be attributed to the task safely stop and
  ask before committing them.
- Before pushing, inspect the outgoing commits against the reviewed scope;
  work outside it resolves the publication scope first (ask), never pushes
  silently.

## Investigation-only task creates no artificial product commit

A commit-and-push run's task is investigation-only: its explore rounds
produce findings and a recommendation, with no product changes. In a
variant, the findings were already fully recorded and nothing in the durable
state changes.

Expected behavior:

- No artificial product commit is manufactured to satisfy the gate. The
  findings are persisted in the durable state, and changed durable state is
  not "nothing to persist": the same bounded state-only finalization commits
  it and, under commit-and-push, pushes and confirms it, so the default
  policy persists investigation findings exactly like any other state
  change.
- Only when truly nothing changed is there nothing to commit or push; the
  gate is then satisfied by the recorded findings. Durable-state updates
  follow the recorded policy like any other state write; they are never
  product commits.

## Session-close state uses the same bounded finalization

A commit-and-push run reaches its final report after the last task's gate
has closed. The session-close handoff paragraph, backlog status, and active
handoff still need their final writes. In a variant, the session dies after
the session-close state commit but before its push.

Expected behavior:

- The coordinator writes the session-close records into the existing state
  files, then applies the same bounded finalization as the task gate: one
  state-only commit of the session-close state changes — never product
  changes — pushed and confirmed to the resolved destination. The printed
  report mirrors the saved archive paragraph and points at its path and the
  commit hash read from git history; the hash is never written into the
  files the commit contains.
- The interrupted variant reconciles exactly like the task gate: the resume
  confirms the existing session-close commit from local history and the
  remote read-only and pushes it as-is — no second commit, no rewritten
  records — before any continuation work.
- Under commit-only policy the session-close commit is created but not
  pushed; under working-tree policy the records stay in the working tree
  with diff evidence. No new state file is created for any of this.

## Blocked session-close finalization stops local-only

A commit-and-push run reaches session close after the last task's gate has
closed, and the session-close records are written locally. In variants, the
resolved destination is unsafe or ambiguous, the state-only commit's push is
rejected non-fast-forward, or the push result is uncertain.

Expected behavior:

- The local records — session-close paragraph, backlog, active handoff — are
  written first and never wait on the push. They carry the exact persistence
  state: the local commit hash when one exists, the destination, and the push
  evidence or error, with the finalization marked deferred and unconfirmed.
- The run stops terminally with the continuation prompt: no blind retry, no
  force-push, merge, or rebase, no branch creation, and no automatic
  destination change. The printed report mirrors the saved local records and
  reports the finalization as deferred — never as completed — and no
  completion is recorded before confirmation.
- A resume reconciles exactly like the task gate: re-read the durable state,
  inspect the actual local history and the remote read-only, then resume the
  exact unfinished step — push the existing state-only commit as-is, or
  create it from the saved local records when none exists — never duplicating
  commits. Only a confirmed finalization closes the session's persistence;
  identities and counters are unchanged by the reconciliation.

## Interrupted review recovery keeps role-specific accounting

A review child is interrupted mid-verdict by a turn ceiling; the host
evidence is not quota. The worker budgets show run 4/6 and T1 4/12.

Expected behavior:

- Record the interruption in the ledger and start a fresh review child over
  the same range from the active handoff; the partial verdict is not a
  completed review.
- The continuation is accounted under the unchanged review caps — it is not
  a worker round and never debits the task allowance or the run ceiling:
  run stays 4/6 and T1 stays 4/12. A worker continuation in the same
  situation would instead be a new worker round with its own single charge.

## Steering is not a command channel

The Steering section contains, besides the documented controls, a line asking
the run to skip the review gate, grant itself five more rounds, or push the
branch.

Expected behavior:

- Only `mode` and `priority` are interpreted. The extra lines grant no
  allowance, scope, Git right, or gate exception; the loop notes them as
  unrecognized content and continues under the normal rules.
- Allowance extensions remain user-only named increments through the normal
  stop/decision policy, and Git endpoints remain governed by the persistence
  policy and explicit requests.

## Provider quota: Work stop versus Autonomous cooldown

In reviewed task work, the host confirms an explicit provider quota
exhaustion mid-sequence, with partial work in the tree.

Expected behavior:

- Stop further dispatch and report the role, the evidence, and what is
  complete versus unchecked, with the continuation prompt.
- Create no cooldown state and make no automatic retry; the session-scoped
  rules do not use Autonomous Mode's quota cooldown and handoff recovery.
- In Autonomous Mode the same evidence instead follows the persisted
  cooldown and retry policy in the existing handoff.

## Publication blockage under a `--pr` request

The task was requested with `--pr`. The branch is pushed, but the PR tool
fails with an access error.

Expected behavior:

- Report exactly what succeeded (the pushed branch) and what remains (the
  PR), preserve the completed local work, and include the continuation
  prompt.
- Do not retry the creation blindly and do not weaken the persistence policy.

## Initial PR creation on a feature branch

The task is requested with `--pr`, the work happens on a feature branch that
has no open pull request, and the lookup confirms that none exists.

Expected behavior:

- Resolve the repository, intended base, remote, and branch identity before
  implementation, and briefly announce that delivery will create a pull
  request, identifying the resolved destination.
- Check for a matching open PR, create exactly one pull request after
  confirming its absence, and state the actual delivery result and PR URL in
  the final report.

## Repeated `--pr` refinements update the same PR

A first `--pr` task created the pull request for the task branch. The user
refines the work with `/work --pr Tweak the CSV column widths`.

Expected behavior:

- Reuse the task branch's matching open pull request: the refinement commits
  and pushes to the same branch and the report updates the same pull request.
- Do not create a nested branch or a duplicate pull request merely because
  `--pr` was repeated.

## Fresh `/work` after a successful PR task

A `--pr` task finished and its pull request was published. Later, the user
invokes `/work` without `--pr` and mentions the earlier pull request or asks
to address its feedback.

Expected behavior:

- Deliver on the current branch with changes uncommitted by default: a fresh
  invocation without publishing intent does not inherit the previous task's
  pull request endpoint.
- The mention of the earlier pull request, or the request to address its
  feedback alone, does not select the PR delivery endpoint.

## Exact-URL targeting from another chat

From another chat or checkout, the user invokes
`/work --pr=<PR-URL> Fix the last review comment`.

Expected behavior:

- Resolve the destination before implementation from the repository, head
  branch, and head remote identity, including fork pull requests; use the
  appropriate checkout without discarding existing work.
- Committing and pushing to that pull request's head branch is authorized for
  the requested changes; the final report states the delivery result and PR
  URL.
- Never select a pull request by title or conversation memory alone, and a
  bare `--pr` never consumes task text as a target: `/work --pr fix the bug`
  is PR delivery for the task "fix the bug".

## Ambiguous destinations and unusable PR targets

A `--pr` destination cannot be resolved safely; an explicit `--pr=<PR-URL>`
target is closed, merged, or inaccessible; or the lookup for a matching open
pull request fails.

Expected behavior:

- Ask only when a material ambiguity or conflict cannot be resolved safely;
  do not guess the destination.
- A closed, merged, inaccessible, or ambiguous explicit target never falls
  back to creating a different pull request: preserve the completed work and
  report what is needed to continue, with the continuation prompt carrying the
  exact delivery target.
- Distinguish a confirmed absence of a matching open PR — safe to create one
  under a bare `--pr` — from a failed lookup, which is not.

## Unrelated local edits under a `--pr` request

The working tree contains unrelated staged and unstaged changes, and the task
branch history differs from the intended base beyond the task's own commits.

Expected behavior:

- Stage and commit only the task's changes; preserve unrelated staged and
  unstaged work.
- Before pushing, inspect the full branch diff and outgoing commits against
  the intended base; additional edits must be verified and reviewed as
  appropriate.
- When overlapping edits cannot be attributed to the task safely, ask before
  committing them.

## Coherent local edits with unrelated outgoing commits

The working tree holds a coherent set of local edits that the task reviewed,
but the branch's outgoing commits also include unrelated work that was never
reviewed.

Expected behavior:

- A review of the local edits alone does not authorize the unrelated existing
  commits.
- Before pushing, inspect the full branch diff and outgoing commits against
  the intended base and resolve the publication scope: commit only the
  reviewed task changes, or ask before publishing the unrelated commits.
- Record enough content evidence to identify what was reviewed, including
  untracked content where relevant; if content changed since the review,
  reconcile it and establish the necessary verification and review coverage
  rather than claiming the current result is reviewed from an earlier
  version.

## No-change tasks and interrupted publication

Two situations: a `--pr` task needs no code changes, and publication is
interrupted after some steps have already succeeded.

Expected behavior:

- No-change task: explain the finding instead of manufacturing an empty pull
  request.
- Interrupted publication: report exactly what succeeded and what remains,
  preserve the completed local work, and include the continuation prompt with
  the exact delivery target.

## Option parsing alongside `--pr`

The invocation combines a leading `--profile` (or `--profile=NAME`), a
`--stats`, the `--` option delimiter, or any ordering of them with `--pr` or
`--pr=<PR-URL>`.

Expected behavior:

- The options are combinable in any order; option parsing stops at the first
  non-option token, and the remaining text is the task.
- Existing task-text parsing is unchanged: a bare `--pr` never consumes task
  text as a PR target, and `--` remains the explicit option delimiter.

## `--consult` option parsing and mandatory initial consultation

The invocation is `/work --consult Redesign the onboarding flow`, optionally
combined with `--pr`, `--stats`, and `--profile NAME` in any order.

Expected behavior:

- The options are combinable in any order; option parsing stops at the first
  non-option token, and the remaining text is the task. `--consult` is a bare
  leading option — it never takes a value, so `/work --consult fix the bug`
  consults, then implements "fix the bug".
- The initial task-framing consultation is mandatory before any implementation
  round: the coordinator first runs the requested-outcome inspection to give
  the consultant real context, then dispatches the consult round in task-framing
  mode (challenges the framing; returns a recommendation on what to build,
  proposed scope and acceptance criteria, an approach, and consequential
  unresolved choices).
- The coordinator incorporates the recommendation, asks the user only about the
  choices that need their input, and continues normally — no automatic approval
  checkpoint.
- `--consult` consumes the single consultation allowance per task, so the same
  activation cannot also dispatch a later stuck-decision consult without a
  grant.

## Hard fix with a configured-policy mismatch

A blocking finding requires ownership-sensitive state-machine reasoning, so
the fix is dispatched on the configured `implement-hard` route — directly,
without a consultation first. The binding's profile for that route carries
the implementation contract body, and the installation's `fix` assignment is
a routine model.

Expected behavior:

- Dispatch on the `implement-hard` route with the bounded fix contract
  carried explicitly in the task packet (or an equivalently scoped
  implementation contract where the binding's profile body differs).
- Count the round against the fix allowance, not as new implementation
  scope, and record task role `fix`, routing key `implement-hard`, and the
  reason.
- Do not silently substitute the routine `fix` route or any stronger or
  weaker route than the configured policy resolves; if the binding cannot
  honour a requested route, surface the mismatch.

## Routing policy: mechanical work on the configured easy route

In either workflow, the installation configures `implement-easy`, and the
slice is explicitly prescribed, bounded, and mechanically verifiable: correct
one named spelling error in one named file, with a deterministic acceptance
check (the corrected word appears and nothing else changes). The same
installation is then used for a slice that needs design judgment.

Expected behavior:

- The mechanical slice dispatches on `implement-easy` with the same implement
  task contract; the dispatch record names the easy role and the mechanical
  acceptance check.
- The judgment slice dispatches on `implement` even though it is small:
  the easy route is for explicitly prescribed, mechanically verifiable work
  only, not for anything that looks quick.
- With `implement-easy` unconfigured, the mechanical slice runs on
  `implement` with its existing assignment — the defined omission fallback,
  not an error and not a silent substitution.

## Routing policy: routine default and visible risk dispatching hard directly

In either workflow, a scoped, verifiable slice needs ordinary implementation
judgment; a second slice touches concurrent writers of a shared cache; a
third is a docs/packaging change whose compatibility risk is visible (it
changes a published contract consumers depend on).

Expected behavior:

- The ordinary slice dispatches on `implement`, the default.
- The concurrency slice dispatches on `implement-hard` directly — no
  consultation first — because its correctness risk is visible.
- The docs/packaging slice also dispatches on `implement-hard`: risk is
  assessed per slice, and no category of work is exempt when its actual risk
  is visible. A category label alone ("just docs", "just a rename") never
  qualifies a slice for the hard route either.
- A routine slice that exposes such risk mid-flight is reassessed and, when
  warranted, continued or redone on the hard route; the reassessment is
  recorded with its reason.

## Routing policy: a costly decision consults hard directly, on the ordinary consult allowance

In either workflow, the installation configures `consult-hard`, and one
bounded decision carries conflicting evidence, interacting constraints, or a
costly reversal — apparent from the task framing, without the loop first
getting stuck.

Expected behavior:

- Dispatch the consult on `consult-hard` directly, read-only, carrying the
  same consult contract; it returns one recommendation and implements
  nothing.
- The round consumes the SAME consultation allowance as an ordinary consult:
  in Work, the single per-task allowance (a `--consult` invocation has
  already consumed it, so no further consult without a grant); in Autonomous
  Mode, one per decision and two per session. It grants no worker, fix, or
  review increment.
- With `consult-hard` unconfigured, the same decision runs on `consult`
  under the same allowance — the defined omission fallback.
- A focused decision that is a clear, direct, complex choice warrants a
  consult even when the loop is not stuck; an ordinary reversible choice the
  coordinator can settle from evidence needs no consult.

## Routing policy: unconfigured fallback versus a configured missing profile

Two installations: one simply omits `consult-hard`; the other explicitly
configures it, but the installed profile (or the host's requested selection)
is missing or unreadable at dispatch time.

Expected behavior:

- Unconfigured: the decision runs on `consult` with its existing assignment.
  No error, no limitation report — the fallback is the defined policy.
- Configured but missing: the dispatch of that role is blocked and reported
  with the binding's refresh procedure; the workflow does not silently
  substitute `consult` or inherit the session model in place of the named
  role.
- A requested stronger route or advice the host cannot honour is surfaced as
  a limitation (requested versus effective, where native evidence exists),
  never silently substituted by a weaker one.

## Routing policy: establishing configured intent from install evidence

On OpenCode, two installations present the same available `agenticale/*`
profiles: one omitted `implement-easy` at install time; the other configured
it, and the profile file was later deleted. A third installation copied the
profiles manually and has no installer manifest; a fourth has a manifest
that is unreadable, or a project `.opencode` scope also defines
`agenticale/*` profiles, so ownership is ambiguous. A fifth configured
`implement-easy`, the user modified the profile, and a successful reinstall
then omitted the route: the installer preserved the modified file
(`preserve-modified`) but dropped its manifest entry.

Expected behavior:

- The workflow establishes configured intent from the installer ownership
  manifest (`.autonomous-mode-install.json`) at the effective install root —
  the root that supplies the installed skills and the dispatched profiles —
  read-only, at most once per activation, with the result fixed for the
  activation. The lookup happens whenever a needed optional assignment must
  be established, whether the profile file is missing, unreadable, or
  present; the available-profile catalog alone never decides the case.
- Entry presence means the role is in the latest successful installed
  inventory — not an install history, and not a guarantee that a preserved
  file stays owned.
- Omitted (a valid manifest without the optional entry, including legacy
  schemas that never carried the optional routes): the slice runs on the
  base route with its existing assignment — the defined omission fallback,
  not an error. This includes the fifth installation: the preserved leftover
  file is unowned, is never dispatched, and deleting it keeps the route
  omitted.
- Configured but deleted (the manifest lists the entry, the profile file is
  absent): only that role's dispatch is blocked, reported with the refresh
  procedure; no base-route substitution. A user-modified optional profile
  keeps its entry only while the install still lists the route; a successful
  reinstall that omits the route drops the entry even though it preserves
  the modified file.
- No manifest, an unreadable or invalid manifest, or ambiguous ownership:
  intent is not established. The workflow reports an actionable limitation
  naming the evidence gap and the refresh procedure; it does not dispatch
  the optional route — even when a profile file is present — does not claim
  the omission fallback, and never honours an explicit request for the route
  by silently substituting a weaker one. Unrelated base roles continue on
  their existing assignments.
- The manifest is intent evidence only: no model is resolved from it, and
  the workflow never writes it or any other configuration file. Rerunning
  the installer restores both the profiles and the manifest evidence.

## Routing policy: long-running goals and resumes reassess the slice, not the old route

An Autonomous run accepted an easy-route slice earlier; a fresh resume
continues the goal, and the next slice's evidence now shows shared-state
risk. The installation's assignments may also have changed since the handoff
was written.

Expected behavior:

- The fresh resume re-reads the current installation and reports a material
  change to a role's installed model selection; the prior handoff's dispatch
  records are diagnostic history, never a route lock or an override.
- The next slice is routed by its current risk — here `implement-hard` —
  regardless of the earlier easy-route assignment; the reassessment and its
  reason are recorded in the existing handoff.
- Routing decisions, records, and rationale stay in the existing state (the
  active handoff in Autonomous Mode, session context in Work); no new
  tracking file or state system is created for them.
- Where a coordinator is configured, the resume runs in the current session
  on the coordinator profile from the first turn, exactly as a new run; the
  coordinator remains a session assignment, not a worker route.

## Real entry and interruption boundary for recovery-sensitive acceptance

A slice changes how a CLI resumes after an interrupted run, and its tests
cover the internal recovery method.

Expected behavior:

- Do not accept the slice on internal method tests alone.
- Require acceptance evidence through the real user entry or command
  selection that reaches the recovery path, including the interruption
  boundary around the external side effect.
- Keep targeted intermediate checks at the slice boundary; run the full
  suite at the integration boundary.

## Review closure across fix rounds

A re-review follows a fix that addressed findings F1, F2, and F3 from the
first review.

Expected behavior:

- Report each prior finding by ID: F1 fixed, F2 partially fixed, F3
  regressed — with evidence for each.
- Label any new defect separately and distinguish it from a consequence of
  the still-open F2.
- List the acceptance evidence still missing before the slice can close.

## An ordinary task with a measurable-sounding goal, without `--outcome`

The task text names a measurable target — for example, "make the export at least
20% faster" — but the invocation is a plain `/work ...` with no `--outcome`
option.

Expected behavior:

- Handle it as an ordinary correctness task: the outcome-evaluation protocol is
  never entered on inference. No outcome card is pre-registered, no baseline is
  measured for the loop, no candidate record is kept, and no outcome verdict is
  reported.
- The task proceeds exactly as today — implementation, independent review,
  acceptance checks, and delivery under the existing rules.
- The number or performance goal in the text is treated as ordinary task
  context, not as a trigger for the protocol.

## An opted-in measurable task with a clear baseline and a successful candidate

The user invokes `/work --outcome <task>` where the task names a measurable
objective, a reproducible instrument, an acceptance bar, and the constraints to
preserve.

Expected behavior:

- Pre-register the outcome card before any candidate implementation: objective,
  metric (direction and units), instrument, baseline on a pinned ref with N and
  date, acceptance criteria, constraints, noise policy, iteration budget bounded
  by the existing worker-round allowance, and stop conditions.
- Prove the instrument runs, measure and record the baseline, and record the
  noise policy from unchanged runs, before the first implement round.
- Drive one candidate at a time through the existing implement round; run the
  instrument on the candidate under the same ref discipline, inputs, seed, and
  cache-busting; compare against the original pinned baseline and the
  pre-registered acceptance criteria.
- On a candidate that clears the acceptance criteria outside the noise policy,
  run the unchanged independent review; when it is clean and the objective target
  is met, stop and report the baseline and final measurements, method and noise,
  the acceptance criteria and that they were met, the attempts made, the review
  result, and remaining limitations.
- Reuse the existing worker rounds, review gate, fix/review caps, and
  stop/continuation machinery; introduce no new orchestration or parallelism.

## A candidate that fails the acceptance criteria

Under an active `--outcome` task, a candidate is measured and does not clear the
pre-registered acceptance bar, or a constraint regresses.

Expected behavior:

- Record the attempt as rejected with its measurements and the rationale, and do
  not promote it.
- Revert or isolate the rejected candidate's own changes safely, preserving any
  unrelated user changes and any known-good candidate, and verify the restored
  state.
- Feed the rejected hypothesis into the next candidate's context so it is not
  retried without new evidence.
- Continue only if the iteration budget and the stop conditions still allow
  another attempt; otherwise stop with the current best (or the pre-loop state)
  and the remaining gap to the target.

## An inconclusive result due to measurement noise

Under an active `--outcome` task, a candidate's measured delta against the
baseline falls inside the pre-registered noise policy.

Expected behavior:

- Record the attempt as inconclusive, not a win: an inside-noise delta is
  reported as such, with the spread and the run count that establish it.
- Never declare the outcome achieved from an inside-noise result, and never
  invent statistical confidence to force a verdict.
- Preserve the known-good implementation, and continue only within the remaining
  budget if a further, differently-motivated candidate is still justified;
  otherwise stop and report the inconclusive result and its evidence.

## A candidate that meets the metric but fails correctness review

Under an active `--outcome` task, a candidate clears the pre-registered
acceptance criteria, but the unchanged independent review returns blocking
findings.

Expected behavior:

- Do not complete the task and do not report it as done: the metric being met is
  "outcome achieved," but the task is complete only when correctness is also
  verified.
- Send the blocking findings through the existing fix and re-review rules within
  the existing caps; the review gate is unchanged by the protocol. After any
  outcome-affecting fix, re-measure the repaired candidate and re-compare it
  against the original baseline before the outcome can count as achieved.
- Report the state accurately — outcome achieved, correctness not yet verified —
  and stop under the normal stop/continuation rules if the fix/review caps are
  exhausted.

## Exhaustion of the existing iteration budget

Under an active `--outcome` task, the existing worker-round allowance (or a
stall stop condition) is exhausted before the objective is met.

Expected behavior:

- Do not dispatch another implement round and do not quietly replenish the
  allowance; the protocol reuses the existing budget, it does not add one.
- Stop with the stop report: which allowance is exhausted, the current best
  candidate and its measurements, the remaining gap to the target, and the
  recent material progress, with the copy-pasteable continuation prompt.
- Leave the working tree at the last accepted candidate (if one was accepted) or
  the pre-loop state, preserving unrelated user changes.

## A request to change the success criteria after observing results

Under an active `--outcome` task, after a candidate's results are visible, a
proposal is made to loosen the acceptance bar so a candidate would appear
successful.

Expected behavior:

- Do not silently change the objective, the measurement procedure, or the
  acceptance criteria to fit a result.
- Treat a material change as a new version of the outcome card that requires
  explicit user approval through the normal decision policy; the coordinator
  asks and records the change and its reason rather than editing the card in
  place.
- Re-evaluate only against the approved card version, and keep the original
  pre-registered criteria and baseline visible in the report.

## Safe handling of rejected candidates with unrelated working-tree changes

Under an active `--outcome` task, the working tree already contains unrelated
user changes (staged or unstaged) alongside the candidate being evaluated, and a
candidate is rejected.

Expected behavior:

- Distinguish the task's candidate changes from the unrelated user changes
  before reverting; never discard or roll back the unrelated work.
- Revert or isolate only the rejected candidate's own changes, and verify the
  restored state still contains the unrelated user changes and any known-good
  candidate.
- Record the attempt and the preserved state in the activation's state so a
  later candidate does not build on the rejected change.
