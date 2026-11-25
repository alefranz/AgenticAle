# Autonomous

Autonomous is for a long goal that needs to continue through several focused
work rounds and fresh sessions. The skill keeps a durable backlog and a
compact active checkpoint in the project so a later activation can resume the
recorded next action.

Use it for a multi-step project, such as:

- `/autonomous Add CSV export, update its tests, and prepare the release`
- `/autonomous 4 Migrate the report pipeline and verify the new behavior`
- `/autonomous` to resume the active run
- `/autonomous Also add PDF export` to steer an active run with new work

The slash form is conceptual: use the invocation supported by your client, as
described in [installation and client setup](../../setup.md). Autonomous starts
only when explicitly invoked. Leading options — a positive-integer worker-round
budget and the `--` delimiter — may appear in either order, with everything
after the options as the goal text, possibly empty. An invocation with no
goal text RESUMEs the active goal, preserving its persisted run ceiling and
consumed counters; a new run with no budget uses the default run ceiling of
240 worker rounds — a generous emergency safety limit, not a work target.
Goal text supplied while a run is already active steers
the run instead of conflicting with it: explicit new outcomes are decomposed
into new backlog tasks, and continuation instructions adjust the existing
plan at the next selection boundary — without overwriting active work or
resetting identities, counters, budgets, or review gates. An ambiguous
request to discard or replace the active goal asks you before anything is
rewritten. The budget bounds the whole run; each genuine task
within the run has its own allowance of 12 worker rounds with a
progress-based hard ceiling of 24, and every
exploration, implementation, and fix round counts against both — the
effective remaining budget is the smaller of the two. A separate
completed-task limit (default 20) bounds how many tasks one run may finish.
The session becomes the
coordinator and proceeds in sequential, bounded
rounds. On OpenCode, when the installation configures a coordinator model,
the `/autonomous` command entry — including a fresh resume — runs in the
current session on the generated `agenticale/coordinator` profile from the
first turn; without one, the invoking session coordinates on its own model.
Code and configuration changes receive independent review by default, with
focused fixes for blocking findings; in strict mode a clearly mechanical
slice closes by its deterministic check instead, with an independent review
only when risk warrants one.

Model configuration is not durable goal state: the preference file (or a
selected `preferences.NAME.md`) is read once at each activation and stays
fixed for that activation, and a fresh resume reads the current installation
again. A change to the installation's model configuration takes effect only
at the next fresh activation or resume: it never changes an already-running
child, never resets budgets or review counters, never bypasses the provider
quota-recovery rules, and never authorizes automatic provider switching. If a
role's installed model selection changed materially since the snapshot was
written, the resume reports it. See
[model configuration](../../guides/model-routing.md).

Autonomous selects routes by the same shared routing policy as
[Work](../work/index.md): `implement` is the default; `implement-hard` is
dispatched directly — no consultation first — when a slice's correctness
risk is visible, assessed per slice with no category exemptions; a hard fix
keeps the fix contract and the fix counters. The two optional routes exist
only where your installation configures them: `implement-easy` for explicitly
prescribed, bounded, mechanically verifiable work, and `consult-hard` for a
focused decision with conflicting evidence, interacting constraints, or a
costly reversal. Unconfigured, they fall back to `implement` and `consult`
with their existing assignments — a defined fallback, not an error. A
`consult-hard` round is read-only, carries the same consult contract, and
consumes the same consultation allowance as an ordinary consult (one per
decision, two per session). At every slice boundary and every fresh resume,
the next slice's route is reassessed against the current installation;
earlier dispatch records are diagnostic history, not a route lock.

Concise progress narration keeps the sequence readable in the main conversation:
what was learned, what happens next, and why. When your client collapses subagent
activity, these updates let you follow the work without opening every subtask.

You provide the goal, constraints, and any acceptance examples. The workflow
records durable progress in the target project's `BACKLOG.md` and
`.agenticale/active.md` — a compact snapshot of the current state and the
evidence recovery needs, not a growing round journal. Each task carries a
stable ID — assigned when it enters the backlog, before selection — and its
worker-round counters; a task deferred unfinished keeps a compact resumable
packet in the backlog — with its findings, current state, and one next
action — instead of being recorded as completed. It reports the completed
work, verification, and remaining limitations. An investigation-only goal
returns findings and a next step without manufacturing product commits.

A new run commits and pushes each completed task by default: after the
task's required checks and reviews — including applicable deep review
gates — the coordinator makes coherent task commits and confirms an
ordinary push before the next task starts. The completion record itself —
the backlog result line and the updated snapshot — is then persisted in one
bounded state-only commit, pushed and confirmed under the same policy, so
the pushed state is never left open and no endless chain of confirmation
writes follows. Reviews run before this gate and inspect the uncommitted
result; the coordinator owns final persistence verification.
Each task moves through explicit lifecycle states — review-open, accepted,
accepted-with-residuals, persistence-pending, complete, or unfinished
(deferred, blocked, exhausted) — and only a confirmed complete gate allows
the next task's selection and counts the task, exactly once, toward the
completed-task limit; a clean review alone never completes a task. Both
`accepted` and `accepted-with-residuals` are terminal task states, entered
only when every required task gate — every slice gate, every applicable deep
gate — has closed with the acceptance verified; the difference is whether at
least one slice gate closed with residuals (every open finding a nit under
the target's recorded settled standard, under a recorded settlement or
declaration). Only a slice-gate closure is terminal at the gate level: while
any later slice or required gate remains open the task stays `review-open`.
In both states, task persistence — `persistence-pending → complete` —
remains outstanding; the merged residual list rides the task persistence gate
and the final report, recorded as known limitations, not as open work.
Explicit user or repository restrictions win: a commit-only or working-tree
run is recorded with its basis and followed, never bypassed. A restriction
means an actual prohibition — you ask to leave changes uncommitted or not to
push, or repository instructions forbid commits or pushes — cited concretely
when the policy is recorded. A conditional guard such as "do not commit
unless explicitly asked" is not a prohibition: invoking Autonomous is that
explicit request, and it satisfies the guard for the run's authorized commits
and pushes. Work's uncommitted default, the worker children's no-commit rule,
and the coordinator role are not bases for a restricted policy. The run
states the chosen policy and its basis visibly at start and on every fresh
resume, and warns when the policy leaves accepted work uncommitted or
unpushed. A resume keeps the recorded policy, so an existing working-tree or
commit-only run never silently gains push rights; a legacy handoff with no
recorded policy resumes as working tree with that warning, never silently
upgraded. If you explicitly change an active run's policy to commit or
commit-and-push, the change is recorded with its basis, and outstanding
persistence is reconciled under the new policy before further dispatch.
Completed tasks are re-evaluated against the new policy even when they
were already finalized under the old one: their accepted work
may still be uncommitted or unpushed, and a gate satisfied under the old
policy does not excuse it. Only the persistence is reopened — reviews,
counters, the next action, and recorded evidence stay unchanged; existing
commits are pushed as-is rather than re-created, and each completion record
is updated through the same bounded finalization. The order is fixed and
finite, so reconciliation state already carried by a task finalization is
never committed twice. Everything follows the ordinary destination and
safety rules and never duplicates commits. Pushes go only to the
checked-out branch's
resolved upstream; a main or protected branch, a missing upstream, or an
ambiguous destination stops and asks. Branch creation, pull requests,
merging, force-pushing, and remote changes remain separate explicit
requests. A failed or uncertain push keeps the task open with its exact
commit and destination state recorded and stops with the continuation
prompt; a resume inspects the actual local and remote history before
retrying the exact unfinished step, never duplicates commits or replays
work, and never marks a task completed before its persistence is confirmed.
Stopping preserves unfinished work too: when a run stops with attributable
unfinished product changes — even review-open ones — the coordinator
checkpoints them as explicit WIP commits under the same policy, recording
their verification and review status and the exact continuation in the
durable state. A WIP checkpoint never completes a task or bypasses its
review gate; when the task later finishes, its gate reuses those commits, and
the coordinator's own reviews of the task use a range that starts at or
before the recorded pre-WIP base — preserved across resumes — so the WIP
commits are inside the diff. A
significant backlog
reconciliation — new or removed tasks, rewritten acceptance, reordered
upcoming tasks, or changed deferred packets — is committed
and pushed as a state-only checkpoint before further dispatch; routine
counter and state writes are not checkpointed. Checkpoint pushes follow the
same destination and safety rules as task pushes, and a failed or uncertain
checkpoint push — like any blocked persistence — goes directly to the
terminal local-only close: no further commits or pushes, all persistence
deferred until a resume reconciles the actual local and remote state.
When the last task completes and the goal is met, the same finalization
carries the run-close record in one completion commit. The snapshot stays as
the recovery checkpoint until that commit's persistence is confirmed under
the policy; only then does a separate bounded cleanup fold the remaining
state into the backlog's result records and remove the snapshot, recoverable
from git history. An incomplete stop keeps the snapshot as its resume state.
A blocked close stops with the persistence deferred
and reported as unconfirmed — never completed — until a resume reconciles
and confirms it.

Completed task detail lives in the backlog's compact result records — date,
outcome, product commit hashes, and the confirmed push destination when
pushing applies. The run creates no default archive and no round journal,
and historical material — legacy handoffs and existing archives from earlier
runs — stays untouched. For runs that need to resume from
a fresh clone, track `BACKLOG.md` and `.agenticale/` in Git with the
matching product changes or submodule pin.

Runs from older versions may carry the legacy `.agenticale/handoffs/active.md`
packet and a human-owned `## Steering` section in `BACKLOG.md`. A resume
recognizes that layout: with no migration or closure trace, it carries the
recorded identities, consumed counters, allowances, gates, and policy exactly
into the new compact snapshot once, then continues under the current
contract; after a migration or closure it never re-imports the legacy
packet's stale counters. The legacy files themselves stay untouched as
history, and a legacy handoff with no recorded policy resumes as working
tree with that warning.

## Prepare a backlog for Autonomous

For a new goal, you can give Autonomous the outcome, constraints, and
acceptance checks directly. If you want to plan the work first, capture it in
`BACKLOG.md` at the root of the project you want Autonomous to work on.

- Describe the milestone in terms of what should work when it is complete
  and how to verify it.
- Record decisions and constraints that apply across slices, such as
  compatibility requirements and which actions need your approval.
- Put one actionable item under `Next slice`. Give it one observable outcome,
  one check a worker can run, and a clear boundary for where the work stops.
  If a technical unknown blocks implementation, make the first slice a
  focused investigation with a question and a criterion for deciding what to
  do next.
- Keep the next few candidate slices in dependency order. The coordinator can
  revise their order or scope as it learns more.
- Optionally create `.agenticale/steering.md` (see
  [Steer a running goal](#steer-a-running-goal)) to pause and continue the run
  or reorder the next ready-task selection while it works. The file is
  yours; the workflow reads it but never edits it. A legacy `## Steering`
  section in `BACKLOG.md` keeps the same controls for older runs.

```markdown
# Project backlog

## Current milestone

Users can download a CSV from the Reports page. Verify that the downloaded
file contains the same rows as the filtered report.

## Decisions and constraints

- Keep the current report filters and access rules.

## Next slice

- [ ] Add CSV output for the report endpoint. Verify with an endpoint test
  that filtering and permissions match the existing report. End this slice
  at the endpoint, before adding the Reports page download action.

## Later slices

- [ ] Connect the Reports page download action to the verified endpoint and
  check the full download flow.
```

Start a new goal with explicit goal text that points to the milestone, for
example `/autonomous Deliver the CSV export milestone in BACKLOG.md`. The
coordinator creates `.agenticale/active.md` and records the current slice
and its next action. With an active run, the same goal text steers the
run — adding explicitly requested tasks or adjusting continuation — instead
of starting a new one. Invoke `/autonomous` without goal text to resume the
active run's recorded `NEXT` action.

### Ask an AI agent to prepare the backlog

Give the agent the project, the desired outcome, and any constraints you
already know. You can add this instruction to your request.

```text
Prepare the project backlog for an Autonomous run. Read AGENTS.md if present,
the existing BACKLOG.md and .agenticale/active.md if present, and enough
project source and tests to identify a verifiable first slice.

In the project's root BACKLOG.md, record the milestone, its acceptance check,
and decisions that carry across slices. Identify one Next slice with an
observable outcome, a verification command or reproducible check, and an
explicit stop boundary. Keep later slices short and ordered by dependency.
If a technical unknown blocks the first implementation slice, define one
investigation question and what evidence will settle it. Flag any product
decision that needs my input.

Preserve existing backlog entries and active work. If an active handoff
already owns the next action, leave that action in place and show me where
the proposed milestone fits. Return the suggested invocation for starting
the milestone when the project is ready. End after planning, before
implementation or invoking Autonomous.
```

## How a run proceeds

Before round 1, the coordinator briefly assesses what the goal would touch —
sources other actors can also mutate, side effects that would survive an
interruption, concurrent humans, ownership-sensitive cleanup, and
compatibility surfaces — and keeps the main loop thin: source evidence needed
to define a round goes to a focused exploration round with one question and a
stop condition, not into the main loop. Before each substantive assignment,
including the first, it explains the next step and its purpose. After a result,
the next update connects the evidence to the next decision; a finished task ends
with the delivery report. The compact state stays in the active snapshot —
a checkpoint, not a journal: settled results fold into the backlog's task
records, and the snapshot keeps only what the next round and recovery need.

The narration follows the [same guidance as Work](../work/index.md#progress-narration):
short updates about outcomes, trade-offs, and verification, with model details
and counters surfaced when they affect a decision or you ask for them. For
example: "The new reader passes its compatibility checks. I'm assigning the
writer update next, keeping the old format readable during the transition."
These summaries add tokens in exchange for an easier-to-follow account of a
long task. The durable snapshot preserves the state needed to resume; the visible
updates help you understand how the work reached that state.

Two worker-round budgets and a completed-task limit bound the run. The
**run ceiling** (default 240 for a new run — an emergency safety limit, not a
work target — or the number you pass) limits worker rounds across the whole
run; the coordinator never auto-grows it, and an explicit ceiling is exact.
Each genuine task also has its own **task allowance** of 12 worker rounds
with a progress-based hard ceiling of 24: when the allowance is reached with
verified progress evidence — passing acceptance checks, a confirmed fix, a
resolved blocker, or a material new finding — the coordinator records a
bounded extension up to that ceiling and continues automatically, without a
permission ask and never on code churn. An explicit user task limit, or the
boundary of a named grant recorded with the `cap` flavour, is an exact cap
that never auto-extends; a grant recorded with the `progress` flavour is an
explicit auto-extend authority up to the progress ceiling rather than a cap
— "keep going while it's making progress" instead of a specific number.
Auto-continuation is scoped to the task allowance: it applies to the default
allowance and to `progress`-flavoured grants on it, and never to the run
ceiling or any explicit user review limit. A free-text grant matching
neither flavour is parsed once, gets one clarifying question when ambiguous,
and its flavour is recorded in the snapshot; the offered increment is keyed
to the budget being extended: the task allowance at its exact boundary — the
default allowance, or a `progress`-flavoured grant still below its ceiling —
reached with verified progress offers the named increment with `progress`
leading (the auto-extension takes effect under the verified-progress rule),
`cap` as the conservative alternative; the progress-leading named increment
applies only while the task worker allowance is below its progress ceiling,
and at or past the ceiling the offered increment is the `cap`-flavoured one;
at the progress ceiling, an exact
cap, the run ceiling, the completed-task limit, or an explicit user review
limit, the increment offered — at most — is a `cap`-flavoured named
increment: the report never leads with an auto-extension that cannot take
effect, verified progress does not override a cap, and a run-level stop
keeps its INCOMPLETE safety-stop character. Every
exploration, implementation, and fix round is charged to both budgets, and
the effective remaining budget is the smaller of the two; review,
review-deep, and consult rounds consume neither budget: consults keep their
own caps, while review and review-deep rounds keep separate accounting under
the review-justification rules below, with no fixed per-target pass count;
an explicit user limit remains binding. Only a genuinely new task gets a
fresh allowance — decomposition, replanning,
resume, and interruption recovery never replenish either budget or erase a
recorded extension. The **completed-task limit** (default 20) counts a task
only after its full persistence gate is confirmed — checks, reviews,
commits, push, and the bounded state finalization; deferred, blocked,
exhausted, and review-open tasks never count, and the limit never auto-grows.

The run and task identities and the consumed counters are durable: they
survive crashes, resumes, and quota outages, each round is charged exactly
once, and a resume never resets them. One consolidated state protocol owns
the bookkeeping — charge before launch, settle when a round ends, switch at
a selection boundary, reconcile at every launch and resume, and finalize at
each persistence boundary. The snapshot's budget line is the single counter
authority — the backlog never mirrors the consumed counters — and a resume
validates the whole snapshot before trusting any counter, rebuilding a torn
or missing snapshot only from verified prior Git and host evidence or
stopping, so a torn write or an interrupted task switch reconciles without
double charging or restoring stale consumption. A numeric budget on a resume
changes the run ceiling only: `/autonomous 3` after five consumed rounds
leaves no worker rounds rather than silently refreshing the count.

When the run ceiling is exhausted while eligible
backlog work remains, the loop makes an INCOMPLETE safety stop — never a
completed run — without another worker round. The report says what is
completed and what is blocked, and the recent verified progress, and offers
bounded choices — a bounded replan, one additional fix-and-review cycle
(available only if the resulting budgets satisfy the review-headroom rule —
the cycle leaves at least one review available under each explicit review
limit you set), or a stop that preserves the current work — naming the
rounds each choice consumes; the offered increments are `cap`-flavoured
named increments — the
run ceiling never auto-grows. A granted extension adds exactly the named
rounds — worker rounds
(fix rounds are worker rounds) to the named budget (run ceiling or task
allowance), and review rounds only against an explicit user review limit: it
never resets counters and grants no extra scope, review, or Git rights. A
consult can settle a reversible decision but cannot grant one, and declining
or not answering ends the stop. Allowance usage and any granted extension
are persisted in the snapshot, and the incomplete stop carries a
copy-pasteable continuation prompt so a later activation can act on the
grant. A run with blocked or exhausted tasks is explicitly incomplete even
when no eligible work remains; only a fully completed goal completes a run.

The completed-task limit stop is separate from the worker-budget stops
above: when the completed-task limit is reached, continuation does not mean
more worker rounds for existing tasks — the stop offers, at most, a
`cap`-flavoured increase of the completed-task limit itself, recorded as a
new exact cap that never auto-grows, or a stop that preserves the current
work — and accepting the increase means agreeing to complete more tasks. It
keeps the INCOMPLETE safety-stop character: with eligible backlog work
remaining, it is never a completed run.

One task's exhausted allowance is not a run stop. No further worker round
runs for that task, but verification and the permitted review of its
completed changes still run; the unfinished part stays incomplete and
resumable in the backlog. The exhausted task is skipped in worker selection —
even when steering names it first — so it cannot repeatedly win selection
and stall the run, while its permitted review stays schedulable. The run may
then select another truly independent ready task with a fresh allowance —
even while unfinished changes exist — without ever bypassing review gates,
dependencies, or safety boundaries, and without manufacturing tasks. When no
safe ready work remains, the run stops with the preserved state and the
continuation prompt.

Productive fixes continue unattended while budget and progress allow.
Autonomous does not gate the fix → review loop at a fixed per-target cycle
count: each further fix is a worker round charged once to both budgets, and
the loop continues — including beyond two fixes or three review passes on one
target — while at least one effective worker round remains, the latest fix
made real progress, no safeguard or explicit user limit has fired, and the
next cycle — the next fix and its required re-review — leaves at least one
review available under each applicable explicit review limit. It does not
repeatedly ask you to authorize one more cycle. Every review must be
justified by changed slice or fix evidence, a required integration gate,
bounded interrupted-review recovery, or an explicit user request — which
authorizes one bounded audit over the range you name: the request is itself
the justification, so it needs no changed fix evidence, and it authorizes
that audit, not a review-only loop. The preserved triggers are required
integration gates: the trigger itself — the two-fix struggle signal, the
shared worker/reviewer blind-spot signal after at least two fix rounds made
in response to a review round's findings (it fires whether or not a later
pass eventually passed), or the periodic boundary, contract, or scale
condition — is the justification,
and each trigger's range is its own: the struggle audit runs over the slice's
accumulated commit or diff range — its single-slice range from the slice's
own entry (first change or recorded WIP boundary) through the current state,
including every fix delta — while the periodic audit runs over the
accumulated range since the periodic baseline — the preceding deep review
whose audit range covered the whole accumulated range since the previous
baseline (an integration-scope audit), or session start when none has run.
When the slice's own gate was a deep review standing in for it, the struggle
audit re-covers the slice's whole range, justified by the changed fix
evidence and the trigger; a single-slice audit, standing-in or struggle,
never advances the periodic baseline. Neither audit requires a diff the
previous review has not seen. The review-only-loop prohibition still applies:
a repeat of the same trigger's audit over the same range with no new
trigger, no changed evidence, and no interrupted review to recover is
prohibited. Fix and review counters persist as
evidence across resumes, replans, and renames — nothing resets or
re-identifies them — and explicit limits you recorded stay binding; legacy
default cycle caps never re-gate a resumed run.

Deep-review re-audits likewise follow productive fixes instead of a fixed
per-target cap. The worker budget gates the next fix, not the review: the
required deep re-review of the last allowed judgmental fix still runs when
zero worker rounds remain. The session still runs at most one additional
opportunistic escalation — the cap counts additional escalations: the
post-gate deep reviews (the struggle trigger and explicit user requests) and
the in-loop diagnostic audit — and a deep review standing in for a slice's
own gate is that slice's required gate review, outside the cap; you may
always explicitly direct an additional escalation. The high-risk-surface
escalation selects the level of the slice's own review: when its risk
warrants an integration-level audit, one deep review stands in for the
normal review — its verdict is the slice's gate — otherwise the normal
review alone; one level for the slice's range, never the normal review and a
deep review both in its place. The two-fix-round and explicit-request
triggers are unchanged post-gate triggers governed by the review-justification
rules — checked after either closure outcome, a clean pass or closing
`accepted-with-residuals` under a recorded settlement or declaration, and
distinct from the in-loop diagnostic trigger, which fires on a still-open
gate before the next fix round — and the periodic integration triggers no
longer include a standalone
slice-count trigger — three accepted slices since the last deep review no
longer fires one — while the milestone, release, or session-close boundary
after two or more accepted slices still does. Consults stay capped at one per
decision and two per session and can never grant worker budget. When the worker budget
is exhausted, fixes stop but the required review of the last allowed worker
still runs; surviving blockers keep the target incomplete and review-open.
An exhausted run ceiling stops the run and offers the named increment a
continuation needs; an exhausted task allowance alone defers that task while
the run continues with another truly independent ready task when one can be
selected safely. The no-progress, same-blocker, and repeated-interruption
safeguards, invariant replanning, and the scope, irreversible-action,
user-preference, Git, persistence, and steering limits all still apply.

Repeated findings on the same invariant are classified as a real
design issue — replanned with the original acceptance and counters intact —
or as reviewer standard drift, settled once rather than chased. When the
drift is detected, the loop settles the standard once instead of chasing it:
a consulted independent review names a **proposed** standard for each open
class — which finding classes block and which are nits — not a binding
adoption, and the run owes you exactly one decision: ratify the proposed
standard; one of the alternatives, including the reviewer's original bar; or
close the target now, available when the proposed standard classifies every
open finding as a nit. The decision is owed either way — the consult
proposes first where its allowance permits, and where the allowance is
exhausted the same one decision proceeds directly with the standard named,
recorded. That decision is recorded and binds every later review of the
target, and the record always evidences a user decision, even when you
ratify the consult's proposed standard. The settled standard binds only its
settled classes: a finding in a settled nit class is a nit that never blocks
the verdict, and a finding of a class that has never appeared in the loop is
a new finding assessed against your original acceptance criteria — it can
block; a finding of a class that has recurred but was never settled is
likewise assessed against your original acceptance criteria, but, being
already seen, it is the kind of standard drift that can trigger the one-time
settlement question. A settlement
reopens only on changed acceptance, a genuinely unmet invariant of a
blocking class, or your instruction — never on a later reviewer tightening
the same class. Provider
quota exhaustion is separate: it follows the recovery policy below, not these
allowance stops. The preference file's `## Work` section (the Work
worker-round allowance) does not change these rules: Autonomous keeps its own
budget behavior.

If a target's loop still stops converging — each review closes the earlier
findings, but the same classes re-open every round — the run makes a single
convergence declaration before any further round on that target: the finding
trajectory, what is verified and green, the cost so far, and exactly one
decision — close the target with its recorded residuals, continue for at most
two bounded fix-and-review rounds, stop it incomplete, or review it yourself.
The shared decision order applies: when the declaration runs and any open
finding is in a class not yet settled for the target — whether or not the
standalone settlement trigger fired — the settlement question for those
classes is the single combined decision inside the declaration, and where all
open classes are already settled the declaration stands alone — the mandatory
consult, where the consult allowance permits, runs before that combined
decision and names the proposed standard first, and it is neither a fix round
nor a worker round; "continue, bounded" is offered only
when all of these hold — the same recorded decision leaves at least one open
finding in a settled blocking class, or no settlement is recorded yet; the
worker budget permits the next fix; the review limits permit; and no
safeguard has fired; and residual closure is offered only when the same
recorded decision contains the nit-only settlement outcome. When the settled
standard already classifies every open finding as a nit, the declaration
simply notifies you and the target closes
`accepted-with-residuals` without a question. The declaration — not a repeated
gate-closure question — is the only user-visible form of a non-converging
loop: a target with a recorded declaration is never asked the same question
twice, and "close with documented residuals" is not offered before a
settlement or declaration exists. While a slice keeps struggling, the
two-fix struggle trigger is also checked inside the fix loop, before the
next fix round: when it fires while the slice's gate has not passed, you may
see an independent deep review run in diagnostic mode — its verdict is
advisory, never the slice's gate, and it counts against the session's
single opportunistic-escalation allowance. It is dispatched only when it
does not exceed an explicit review limit that covers deep reviews, or
consume the last review available under one; at that boundary the loop
stops and offers the `cap`-flavoured increment on that limit — the same
offer as any budget-exhaustion stop — rather than spending the last review. While a
settlement decision or a saturation declaration is pending for the target,
the trigger is not checked and the audit is not dispatched — the pending
decision is itself the resolution the audit would be ordered to end in; the
ordinary post-gate behaviour — which applies after either closure outcome,
a clean pass or closing `accepted-with-residuals` under a recorded
settlement or declaration — is unchanged, and this in-loop diagnostic
trigger is the still-open-gate path.

The main loop is built to continue, not to ask. Continuation is the default,
and the gate is the single authority for questions: the closed list defines
which situations are question-eligible, and the gate's checks decide whether
an eligible situation may be asked now — every question the loop would put to
you, listed or not, is a candidate that passes those checks. The
question-eligible situations are: an autonomy-envelope guard breach; an
irreversible or user-reserved action such as force-pushing or publishing; a
choice about scope, acceptance, or the goal text itself; a budget exhaustion
stop with its flavour-scoped increment — the task allowance offers the named
increment with `progress` leading per the grant-flavour rule, while the run
ceiling and any explicit user review limit never auto-grow and offer at most
a `cap`-flavoured named increment; the standalone settlement's one decision —
ratify the proposed standard, an alternative including the reviewer's
original bar, or close now when the nit-only option is eligible — owed
either way: the consult proposes first where its allowance permits, and where
it is exhausted the decision proceeds directly with the standard named; the
one-time clarification of an ambiguous grant; a persistence-recovery
question — a destination or commit-attribution question when persistence is
blocked; a convergence declaration that requires a closure decision; or the
same blocker two rounds running with no materially different path. On the two
standard-setting paths — the standard settlement question and a closure
decision from a convergence declaration — the run consults an independent
second opinion, where the consult allowance permits, before asking. On the
declaration path, the same combined-versus-standalone rule the declaration
passage states applies: when the declaration runs and any open finding is in
a class not yet settled for the target — whether or not the standalone
settlement trigger fired — the settlement question for those classes joins
the single declaration decision, and where all open classes are already
settled the declaration stands alone; the consult runs only where its
allowance permits. A candidate that fails the checks is a guard
breach: it stops, is reported as such, and is not sent. Reporting a stop is
not asking: an exact-cap stop is report-only unless an interactive grant
offer is eligible, and that grant offer is a separate question-eligible
situation, not part of the stop report.
"The review blocked again" is not a question while budget, verified progress,
and the loop's state all permit continuing the fix — surviving blocking
findings are not a permission ask.

When the host reports provider quota exhaustion, the coordinator records the
evidence, affected role, retry time, inspected partial progress, remaining work,
and next action in the snapshot. It waits about 30 minutes by default, or
longer when reliable provider reset metadata requires it, then resumes from the
inspected working tree. Up to eight quota retries without resumed progress are
allowed, with the count preserved across sessions and reset only after material
progress. A supported host wait can keep the session waiting; otherwise the
snapshot is ready for a later activation, without a promised automatic wakeup.

The coordinator may ask you to settle a meaningful behavior choice, provide
missing information, or clarify an ambiguous pull request destination. If a
round cannot proceed because of a permission or capability limit, it reports
the blocker and the choice needed to continue.

## Steer a running goal

You can steer a run while it works, through one small, optional, human-owned
file — `.agenticale/steering.md` — with exactly two documented controls and
no general command channel:

```markdown
- mode: continue
- priority: T3, T2
```

- The file is absent by default: no file means `continue` and no priority.
  The coordinator reads it; it never creates, edits, or deletes it, and
  children never touch it.
- `mode: pause` asks the run to stop at the next safe checkpoint: the
  currently running child is allowed to finish its round, its result and
  budget charge are recorded, and the exact next action and all counters are
  preserved before the loop stops with a pause report. Nothing is interrupted
  mid-round, and the workflow does not poll or run a watcher. The pause is
  persistent: it survives session ends and resumes. Set `mode: continue`
  (or remove the pause) and invoke `/autonomous` again to resume the recorded
  next action; a still-present `pause` stops a fresh activation again without
  dispatching. Only your own edit releases it — with no pause present, the
  run continues normally.
- `priority` is an optional comma-separated list of task IDs that reorders
  only the next task selection among ready tasks. IDs are assigned when
  tasks enter the backlog, so a recorded task that has never been selected
  can be named. Priority never interrupts the active task, and it never
  unblocks a blocked, dependent, unknown, or allowance-exhausted task —
  such IDs are skipped with a note.

The file belongs to you. The coordinator re-reads it before every new
round — workers, reviews, fixes, consults, and deep reviews alike — and never
edits it. Steering cannot grant budget, change scope,
authorize Git actions, or bypass a review gate; those stay with the normal
invocation and grant rules. Goal text in an invocation is a separate
explicit channel: it can add tasks or steer continuation under the
reconciliation rules above, and it is never written into the steering file.

A legacy run may instead carry the human-owned `## Steering` section in
`BACKLOG.md` with the same two controls. The coordinator reads it when the
new file is absent and never edits it. When both surfaces exist, `pause` in
either pauses the run, and `priority` comes from the new file when it defines
one, otherwise from the legacy section; a disagreement is noted in the next
report. Moving to the new file is your own act — the workflow never migrates,
rewrites, or deletes human steering content, and the legacy section stays
untouched as history.

For the detailed state, budget, review, and resume rules, read the
[Autonomous skill source](https://github.com/alefranz/AgenticAle/blob/main/skills/autonomous/SKILL.md)
and the shared
[round contract](https://github.com/alefranz/AgenticAle/blob/main/skills/work/references/rounds.md).
For setup, see [installation and client setup](../../setup.md); for the
everyday workflow, see [Work](../work/index.md).
