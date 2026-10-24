---
name: work
description: "Coordinate an everyday coding task — a requested outcome, existing changes, or a preceding review's findings — through review, focused implementation, and fixes, optionally through a new or existing pull request. Explicit-only: invoke with /work (optionally /work --pr, /work --consult, and /work --profile NAME) to start a reviewed task; the model does not start this workflow on its own."
version: 1
slash: true
disable-model-invocation: true
metadata:
  opencode/autoinvoke: false
---

# Reviewed task work

Complete the user's current task with focused, fresh subagents. The coordinator
owns scope, user communication, and delivery; workers implement and independent
reviewers inspect the result. Give concise progress narration before substantive
assignments: what was learned, what comes next, and why. Read
[the shared round contract](references/rounds.md)
before dispatching, including its bundled skill loading and task-packet rules.
Dispatch each round to a fresh child subagent using the task contract named for
that round under `references/tasks/`; those contracts are shared by both
workflows and do not activate Autonomous Mode.

## Entry and arguments

Consume the invoking user's task text directly; do not treat a placeholder
arguments token as the task. A leading `--pr` option selects PR delivery:
complete the implementation and its checks, complete the independent review,
make coherent task commits, push, and create or update a pull request. A
leading `--stats` option requests a session usage summary in the final report;
the options — `--pr`, `--stats`, `--consult`, and `--profile` — are combinable
in any order, and the remaining text is the task. `--pr` never takes a bare
argument: task text is never consumed as a PR target, so `/work --pr fix the bug` is PR
delivery for the task "fix the bug". `--pr=<PR-URL>` selects an exact existing
PR and authorizes committing and pushing the requested changes to its head
branch; it is the explicit targeting form for another chat or checkout.
`--stats` changes only the delivery report, not the task's scope, budget, or
permissions. An unambiguous natural-language request to commit and push the
task's updates to a pull request selects the same endpoint. Otherwise use the
current branch and leave changes uncommitted unless the user or applicable
repository instructions specify otherwise. With empty input, select the task
through the precedence chain in [Start from the requested
outcome](#start-from-the-requested-outcome), and ask what to work on when no
selection is safe; never implicitly resume an autonomous handoff. An empty
invocation with `--pr` additionally authorizes the PR delivery endpoint for the
selected existing work. Investigation-only requests stay investigation-only,
and a mention of an existing PR or a request to address its feedback alone
does not authorize publishing.

A routing profile is a separate leading option:

- A leading `--profile NAME` or `--profile=NAME` option selects a routing
  profile; `--` is an explicit option delimiter; option parsing stops at the
  first non-option token, and the remaining text is the task.
- A missing profile name (a trailing `--profile`, or one followed by another
  option), or two different profile names, is reported before dispatch,
  listing the profile names available for the active runtime.
- An unambiguous natural-language instruction (for example, "use the
  server-b routing profile") selects the profile; merely mentioning a profile
  while discussing the task does not select it.
- No selector, or `--profile default`, uses the ordinary default routing
  (installed baseline, personal preferences, project preferences).
- The selection stays in session state for the activation: a fresh `/work`
  invocation without a selector returns to default, and the continuation
  prompt that every incomplete stop carries includes the selected profile so
  the user can preserve it deliberately.
- A profile controls child routing only: it never changes the coordinator's
  model, the runtime, or credentials or endpoints.

A leading `--consult` option requests an independent task-framing consultation
before implementation starts. It is a bare leading option like `--stats` — it
never takes a value, so `/work --consult fix the bug` consults, then
implements the task "fix the bug". It combines with `--pr`, `--stats`, and
`--profile` in any order, and it does not change routing.

When `--consult` is present, the initial consultation is mandatory and runs
before any implementation round:

- First run the same [Start from the requested
  outcome](#start-from-the-requested-outcome) inspection, so the consultant has
  real context — the inspected repository state, the interpreted request, and
  the concrete uncertainties you could not safely resolve.
- Dispatch the [consult](references/tasks/consult.md) round in its
  task-framing mode: it challenges the framing and returns one recommendation
  on what to build, with proposed scope and acceptance criteria, an approach,
  and any consequential unresolved choices. It is read-only and does not
  implement.
- Incorporate the recommendation, then ask the user only about the choices that
  genuinely need their input (scope, behaviour, or preference). There is no
  separate approval checkpoint: once those choices are settled, continue the
  normal implementation and review flow.

`--consult` consumes the single consultation allowance per task; an activation
run with it cannot also dispatch a later stuck-decision consult unless you grant
a further allowance. The coordinator still owns the final task definition, and
the user retains control over scope and preferences — the consultation
recommends, it never invents a user preference or vetoes the user's choice.
Without `--consult`, consultation stays optional as it is today.

## Start from the requested outcome

Read applicable repository instructions and inspect the current branch, status,
and diff deliberately, including staged, unstaged, and untracked changes. Record
the starting state in session context. Their presence alone does not mean every
change belongs to the task: preserve unrelated work, including unrelated staged
content, and distinguish it from the task's changes throughout review and
delivery. A clean feature branch containing existing commits is ordinary input;
its commits are part of the branch's net changes. If overlapping edits cannot be
attributed safely, ask before changing or committing them.

Select the task by this precedence:

1. Explicit task text from the invocation.
2. An unambiguous active task or a preceding review in the current
   conversation.
3. Existing branch and working-tree changes, adopted when they form a
   coherent, sufficiently understood task.
4. A focused question when a material ambiguity prevents safe scope
   selection.

Stale conversation references are not an active task. Never silently choose
between competing tasks, and never implicitly resume an autonomous handoff.

Before substantial work, briefly explain the selected scope and apparent
outcome. For coherent changes this is progress narration, not a mandatory
confirmation gate; ask only about material scope, behavior, ownership, or
destination uncertainty.

Before dispatching implementation, run a brief material-risk assessment of the
request, even when its intent is clear: identify the multiple independently
mutable sources the request would touch — local working trees, remote
branches or pull requests, and persisted state such as databases or caches —
and flag which of them other actors can also mutate, the external side
effects that would survive an interruption, concurrent humans on the same
branch or resources, ownership-sensitive cleanup, and compatibility
surfaces such as public APIs, contracts, or generated artifacts. The signals
justify focused inspection or decomposition; they do not require lengthy
planning.

Inspect enough of the request to ask whether a concrete uncertainty could
materially change the slice's boundary or approach. Answer small questions with
direct reads in the coordinator context and dispatch a focused explore round
only when the question needs a separate context; no cheap discovery round is
mandatory. Give every discovery round its one question and stop condition, and
do not assume a question about subtle semantics is automatically suitable for
a fast route — resolve its route through the routing contract.

Choose the smallest useful path:

- A clear change: implement, independently review, and finish.
- Existing work that is already complete or nearly so: review it and fix its
  concrete findings; do not assign an implementation round to modify
  already-complete work.
- An uncertain request: explore one concrete question first. Present options
  when the findings expose a meaningful user choice, then implement once the
  intended outcome is clear.
- A complex but bounded change: use the shared contract's sequential
  decomposition, either immediately or after exploration/consultation exposes
  useful boundaries. Assign only the next verifiable slice, close its review
  loop, then reassess before assigning the next one.
- Investigation or advice only: return findings and options without implementing.
- Review feedback: inspect the actual feedback and current changes, fix the
  requested issues, and independently review the fix and affected behaviour.
  Retrieve referenced feedback using available tools; ask for it if inaccessible.

Ask the user about consequential scope, behaviour, or preference choices; do
not invent their preference or require a consultation first. Continue routine
implementation and review fixes without stage-by-stage permission requests.
Child agents return blockers to the coordinator rather than asking the user.

## Review findings as Work input

When a relevant review preceded this Work invocation in the same session, use
its findings and scope directly: no copying of the report and no restating of
the task. Recheck the current repository state and each finding's applicability
before acting, and reuse the review's evidence that still covers the same
content and checks — a redundant initial review is not required merely because
Work was invoked. The existing fix and re-review rules apply to any changes
Work makes. A clean review must not manufacture implementation work: complete
outstanding delivery steps when authorized, and report that nothing remains
when the reviewed result is already delivered. An explicit `--pr=<PR-URL>`
invocation keeps the existing exact-target identity and failure rules.

## Deep review of existing changes, on explicit request

An unambiguous natural-language request to begin with a deep review of the
existing branch changes — for example, "First perform a deep review of the
current branch changes" — selects the
[deep-review](references/tasks/deep-review.md) contract for the first review
round, which runs before any implementation round. It is explicit-only, like
the other entry rules here: a deep review is never started on the
coordinator's own initiative, and merely mentioning one while discussing the
task does not select it. There is no deep-review flag; the request is named
in the task text.

The round reuses the same comparison and scope semantics as a standalone
`/review --deep`: the merge base of the current branch and the resolved base
to the current working-tree result, including relevant untracked files,
recorded before dispatch. The reviewer is resolved through this activation's
routing snapshot like any other round — the same `deep-review` route that a
`/review --deep` would use under equivalent routing inputs — so a selected
routing profile applies unchanged.

The review enters the normal Work loop: applicable blocking findings go
through the existing fix and re-review rules, with verification of the fixes
and independent re-review within the existing caps. A clean verdict must not
manufacture implementation work. The user's delivery instructions in the task
text are honored as written, including conditional ones: an instruction to
commit, push, and create or update a pull request only when the review finds
blocking findings publishes only after those fixes, while a clean review stops
with its report and no publication. Without such instructions, the existing
delivery defaults apply.

This rule covers this one explicit entry only: no new command, flag, role, or
routing configuration, and no general support for multi-step command chaining
in the task text.

## Establish intent without circular validation

Distinguish user-supplied requirements and context from observed behavior and
repository contracts, and from inferred purpose and remaining uncertainty. Do
not infer that the intended behavior is whatever the implementation currently
does, then approve it for matching itself. Establish checks from existing
contracts, tests, reproductions, documentation, and relevant implementation
context; the absence of a worker report or original implementation history is
not itself a defect. Ask the user, through the coordinator, when a
consequential desired behavior cannot be established. A consult may answer a
bounded technical question; it cannot invent a user preference, and
consultation remains optional unless `--consult` requests it, in which case an
initial task-framing consultation runs before implementation. Fix concrete
defects and unmet requirements
within the established scope automatically; optional suggestions must not turn
the work into open-ended refactoring or opportunistic cleanup.

## Route only the rounds needed

| Purpose | Task contract |
| --- | --- |
| Focused project or external-source discovery | [explore](references/tasks/explore.md) |
| Routine implementation | [implement](references/tasks/implement.md) |
| Concurrency, subtle state, security, or difficult contract reasoning | [implement](references/tasks/implement.md) with hard-task routing context |
| Fix specific review findings | [fix](references/tasks/fix.md) |
| Review findings requiring concurrency, durability, state-machine, or ownership reasoning | [fix](references/tasks/fix.md) contract on the `implement-hard` route (hard-task routing context) |
| Independent review of changes | [review](references/tasks/review.md) |
| Integration review across substantial interacting slices | [deep-review](references/tasks/deep-review.md) |
| Explicit request to begin with a deep review of existing branch changes | [deep-review](references/tasks/deep-review.md) |
| Independent task-framing recommendation (`--consult`) or a second opinion on one stuck decision | [consult](references/tasks/consult.md) |

A hard fix keeps the fix task role and the fix counters: dispatch it on the
configured `implement-hard` route, carrying the bounded fix contract explicitly
in the task packet, or an equivalently scoped implement contract where the
binding's profile body differs. The task role and the routing key are separate
choices; record both, with the reason for the hard route, in the routing
record. Respect the configured policy and the profiles the binding exposes —
never silently substitute a stronger or weaker route, and surface a requested
route the binding cannot honour.

### Resolve routing before dispatching

Before dispatching any round, run the shared routing bootstrap described in
[the routing contract](references/ROUTING.md) — the same bootstrap autonomous
mode uses — once per activation, at start. Activation always uses the loaded
installation's resources, relative to this loaded SKILL.md — never the
AgenticAle repository checkout, which is not a routing source even when the
task is developing AgenticAle itself:

1. Select the actual runtime from the host's tool surface — never from a
   selected model name — and its binding under `references/runtimes/`.
2. Establish the Git worktree root, or the explicitly established workspace
   root for a non-Git project. When no root is established, omit `--root`;
   only the personal preference location is checked.
3. Run the default path — one mechanical call from the installed skill:

   ```sh
   node scripts/routing.mjs startup --runtime <runtime> --root <root> [--profile NAME]
   ```

   with `--profile NAME` when a routing profile is selected and the
   activation carries no invocation-level preferences. On the
   invocation-preference path, `startup` serves only as the file-existence
   probe: its policy and its profile check are not final there, and
   `--profile` need not be passed to it — if it is, its unknown-profile
   result is provisional and is not reported. Then act on the result:
   - Invocation-level preferences — direct task-time overrides, an
     explicitly supplied invocation Markdown file, or a profile selected at
     invocation: `startup` accepts no invocation layers, so none of its
     results is final. Interpret the discovered files (if any) and the
     invocation preferences into the ordered structured layers, lowest to
     highest precedence per the routing contract, write them to a temporary
     file — one of the two paths that create one — and resolve them:

     ```sh
     node scripts/routing.mjs resolve --runtime <runtime> --input <layers-file> [--profile NAME] --explain
     ```

     with `--profile NAME` for an invocation-selected profile; profile
     availability is validated only by this final resolution — the
     resolver's unknown-profile error lists the available names, including
     those defined by the invocation Markdown itself (a profile defined
     there is valid), and is the one that gets reported. The `--explain`
     output is the snapshot, as for the interpretation path below.
   - `resolved` (no invocation-level preferences): the output IS the routing
     snapshot. Store `policy`, `routeProvenance`, `profile`, and (on
     OpenCode) the `agents` entries in session state; no further reference
     reading is required to resolve or compare routes.
   - `interpretation-required`: a documented preference file is present.
     Read the listed `presentFiles`, interpret them per the routing contract
     (Markdown or clear equivalent prose; the helper never parses Markdown),
     write the structured layers to a temporary file — the other path that
     creates one — and resolve them:

     ```sh
     node scripts/routing.mjs resolve --runtime <runtime> --input <layers-file> [--profile NAME] --explain
     ```

     `--input` is a file path of structured preference JSON, never inline
     JSON, and is omitted when there are no preferences. The `--explain`
     output — `policy`, `routeProvenance`, and `profile` — is the snapshot;
     the plain (non-`--explain`) output is the strict version-1 export the
     OpenCode preparation flow writes for the installer, not the snapshot.
   - Non-zero exit (unreadable preference file, unknown or invalid profile):
     report the actionable error once. An unreadable preference file is a
     genuine error on every path. An unknown or invalid profile error is
     final on the paths where `startup`'s results are final (no
     invocation-level preferences); on the invocation-preference path it is
     the final `resolve --input <layers-file> --profile NAME --explain` that
     validates and reports profile availability. Missing preference files
     are normal — never create or modify files, never ask the user to
     configure routing, and never investigate fallbacks or retry.
4. Check the capability before the affected dispatch. On OpenCode the
   comparison is the `agents` entries of the `resolved` startup output when
   the activation was finalized directly from that output — no discovered
   preference files and no invocation-level preferences; otherwise — the
   snapshot came from `resolve --input ... --explain` on the
   interpretation-required or invocation-preference path, or Node is
   unavailable — perform the in-context comparison against the final
   snapshot: read the `model:` and `reasoningEffort:` frontmatter of the
   applicable installed profiles (the default `agents/agenticale/<role>.md`
   set, or the named set for a selected profile) and apply the same match
   rules (an `inherit` route matches a profile with no `model` line; an
   explicit route must match model and, on effort-capable runtimes, effort).
   Dispatch a role only when it matches; a missing, mismatched, or
   unreadable profile blocks only that
   role's dispatch, reported with the binding's preparation and refresh
   procedure. Roles no round uses are irrelevant; an unused unavailable role
   never blocks unrelated work. On other runtimes, compare each selection
   with the binding's native dispatch fields as the binding says.
5. Where Node is unavailable, apply the routing contract in context: check
   the two documented preference locations, read and interpret the present
   files, and resolve the seven routes keeping each route's source. This is
   the documented fallback path; the contract section describes it.
6. Start quietly: keep routine routing details in session state and do not
   narrate a routine bootstrap. Surface routing information only when it
   explains a selected profile, a material change, a limitation, or a
   required user action.

A missing key in a complete policy is an error, not an implicit inheritance. An
unsupported request can use only an explicitly configured fallback; it must
not silently inherit the session model in place of a route the policy names or
invent a weaker model. Record requested versus effective settings when native
metadata makes the latter available; an unknown effective setting stays
unknown, and a child's self-reported model name never establishes what it ran
on.

Keep the snapshot fixed during the activation, including context compaction. A
new `/work` invocation or an explicit user request re-runs the bootstrap; a
re-resolution affects subsequent dispatches only, never an already-running
child. The bootstrap is read-only: it never creates or modifies a routing
file, and the snapshot stays in session state (see "State stays in the
session").

Default to routine implementation. Exploration, consultation, and deep review
are conditional, not mandatory stages; `--consult` is the explicit opt-in that
makes an initial task-framing consultation mandatory before implementation,
and an explicit request to begin with a deep review of existing branch
changes makes the initial deep-review round mandatory instead.
Keep the coordinator's context small by passing relevant facts and paths
rather than full transcripts. Run rounds
sequentially; never have a worker approve its own change.

### Sequential decomposition

Use [the shared decomposition guidance](references/rounds.md#sequential-decomposition)
when smaller outcomes make a difficult task easier to implement and verify.
Keep a compact ordered outline in session context: accepted outcomes and their
evidence, the current slice, tentative remaining outcomes, and assumptions that
could change them. Detail only the current assignment. This is still one user
task, with shared overall acceptance criteria and one budget; it does not activate
Autonomous Mode or create project tracking files.

Independent review is the default for each changed slice before the next slice
starts. There is no strict/standard selector in this workflow. An explicit user
request to skip review can override this; disclose that review was skipped.
Ordinary slice review includes its interactions with earlier work. Use deep
review only where substantial interactions or high-risk shared invariants need
an integration audit; decomposition alone does not trigger it at every step.
Prefer an audit at the combined-result boundary, or earlier when later work
would depend on an uncertain contract. Supply the exact accumulated change
range, accepted outcomes, and integration checks. A review that already covers
that range and those checks need not be duplicated at delivery. Any combined
review target has the same fix/review caps as a slice.

The default worker allowance is eight worker rounds (explore, implement, hard
implementation, or fix), covering the whole task across exploration,
implementation, and fixes. The allowance is what is available, not what is
required: Work finishes as soon as the requested outcome is complete. Do not
dispatch rounds to use up a remaining allowance or manufacture work to spend
it. Allow at most two fix cycles per slice, three review passes per slice, and
one consultation per task; a `--consult` invocation consumes that allowance for
its initial task-framing consultation. Review calls do not consume the worker
budget but are bounded by these caps.
Budget across the whole sequence, leaving room for fixes and integration work;
decomposition or replanning does not replenish the allowance. Reassess the
remaining scope against the remaining allowance at each slice boundary.
Caps prevent dispatching another round of that type beyond its allowance;
verification and the permitted review of the last allowed worker still run.
If more work is then required, stop under the stop and continuation rules
below. Also stop when the same blocker recurs or two consecutive workers make
no material progress. Do not quietly replenish the allowance or return
incomplete work as finished. When a limit will constrain the next useful
action, say so in the progress narration; a stop report names the specific
exhausted allowance — worker-round, fix, review, or consultation.

If a child is interrupted, inspect its actual changes and verification state.
Start a fresh child with the last known facts and one next action; do not infer
completion from a partial response. A repeated interruption without progress
is a blocker to report.

### Provider quota exhaustion

Before applying report repair or ordinary interrupted-round handling, inspect
the host's dispatch result or child output for explicit evidence that the host
or provider exhausted a usage quota or rate limit (for example, `The usage
limit has been reached`). This applies to every child role, including a launch
failure and an interruption after partial work.
Do not infer quota exhaustion from missing or empty output, a generic `429`, or
an authentication, network, billing, or account error without explicit quota
evidence; handle those through the ordinary error policy.

When quota exhaustion is confirmed, check whether the child is terminal using
the available host status. Do not race a child that may still be running or
launch overlapping work. Stop further dispatch and report the affected role and
task, the evidence, what work or verification was completed and remains
unchecked, and any retry/reset information the host supplied. Inspect the
actual working tree and preserve partial changes. Keep unfinished work and
review blockers visibly incomplete, and do not publish a pull request before
its required checks and review gates pass. Do not switch routes or models, do
the child's work in the coordinator, wait or retry automatically, or create
durable cooldown state. The user can decide when to resume Work; provide the
next concrete action, with the continuation prompt that every incomplete stop
carries. These session-scoped rules do not use Autonomous Mode's
quota cooldown and handoff recovery.

### Stop and continuation

Apply [the shared contract's checkpoint, decision summary, and stop-report
rules](references/rounds.md#checkpoints-decision-summary-and-stop-reports).
Use its progress narration guidance for each substantive dispatch. Keep routine
routing records and counters in session state and the continuation prompt in
the stop report; Work writes no operational files for these.

When an allowance is exhausted, do not dispatch another round of that type.
Stop and report which allowance is exhausted and what remains, what is
completed and what is blocked, and the recent material progress. Recommend,
from the evidence, a bounded correction within the remaining allowances, a
replan — also bounded, since a replan that needs child rounds consumes those
allowances — or a stop. Where the host offers an interaction tool, offer the
situation-appropriate choices, for example "Replan before continuing",
"Continue for one additional fix-and-review cycle", or "Stop and preserve
current work"; without one, state the same options in the stop report.

A user grant is a specific increment: it adds the named allowance, including
the worker, fix, or review rounds the grant covers. It never resets existing
counters and grants no scope, review, or Git rights beyond what it names; a
replan requested through it stays bounded the same way. A declined or
unanswered option ends the stop: do not ask again, do not schedule a resume,
and leave the work in its preserved state. Provider quota exhaustion stops
under its own rules above; it is separate from these allowance stops and from
Autonomous Mode's quota cooldown.

## State stays in the session

Pass the shared task packet to each child and retain compact reports in the
session. Set `State policy: session; report only; no operational files`.
Do not create or update a workflow backlog, handoff, archive, round ledger file,
or hidden persistence directory. Existing autonomous state is not this task's
input unless the user explicitly supplies it as context. Product documentation
requested by the task and applicable repository conventions still apply; an
explicit repository requirement for durable notes takes precedence and should
be explained briefly.

Normal continuation depends on the host retaining the session. If context is
lost, inspect the repository and ask for missing intent rather than claiming
crash recovery. For durable project continuation across fresh sessions, use
the separate autonomous-mode workflow.

## Delivery and Git

Default: work on the current branch and leave task changes uncommitted. Do not
push, open a PR, or make operational-note commits. Explicit requests to commit
or push authorize those endpoints without automatically authorizing later ones.
Repository instructions governing commits still apply.

A leading `--pr` option, or an unambiguous request to commit and push the
task's updates to a pull request, selects PR delivery: complete the
implementation and its checks, complete the independent review, make coherent
task commits, push the task branch, and create or update a pull request. This
is one delivery request: do not ask again for each of those actions. A mention
of an existing PR or a request to address its feedback alone does not select
this endpoint. Publishing intent is task-scoped: a fresh invocation without
`--pr` (or an unambiguous equivalent request) does not inherit a previous
task's PR delivery endpoint, while resuming an unfinished task preserves its
recorded destination and delivery permissions, with the current repository
state rechecked.

For the PR endpoint:

1. Before implementation, resolve the delivery destination: the repository,
   intended base, the task branch's head branch and head remote identity
   (including fork pull requests), and whether the task already has a feature
   branch or an open PR. Select an existing pull request by that identity,
   never by title or conversation memory alone. When the task branch has a
   matching open PR, update it; otherwise open a pull request using a suitable
   existing task branch or a new feature branch from the intended base, in the
   appropriate checkout and without discarding existing work. `--pr=<PR-URL>`
   selects that exact existing PR and authorizes committing and pushing the
   requested changes to its head branch. Briefly announce before
   implementation whether delivery will create or update a pull request,
   identifying the resolved destination. Ask only when a material ambiguity or
   conflict cannot be resolved safely. Check available authentication/tooling
   early.
2. Keep worker rounds uncommitted unless repository instructions require
   otherwise. Review the task changes independently before committing; make
   coherent task commits, not one commit for every agent round. Stage only task
   changes, preserving unrelated staged content as well as unstaged work.
3. Before pushing, inspect the full branch diff and outgoing commits against
   the intended base. Ensure they match the requested scope and final reviewed
   content; additional edits must be verified and reviewed as appropriate. A
   review of local edits alone does not authorize unrelated existing commits:
   when the outgoing history contains work outside the reviewed scope, resolve
   the publication scope before pushing. Record enough content evidence to
   identify what was reviewed, including untracked content where relevant; a
   status line or an unchanged filename list alone is insufficient to detect
   changes during review. If content changes during review or before delivery,
   reconcile the changes and establish the necessary verification and review
   coverage rather than claiming the current result is reviewed from an earlier
   version.
4. Push the task branch with ordinary Git semantics. If a push is rejected
   because the branch advanced, re-establish the current state and verification
   requirements before retrying; do not force-push. Before drafting the PR
   body, load `pull-request-description` by exact ID or read its full
   [SKILL.md](../pull-request-description/SKILL.md); apply it to the final
   reviewed branch diff. When creating a pull request, check for an existing
   matching PR before creating one, including after an uncertain tool
   response, and never retry a creation blindly. A confirmed absence of a
   matching open PR is safe to create from; a failed lookup is not. Repeated
   `--pr` refinements reuse the task branch's matching open PR; never create a
   nested branch or a duplicate PR merely because `--pr` was repeated.
5. State the actual delivery result and the PR URL in the final report. An
   inaccessible, closed, merged, or ambiguous explicit `--pr=<PR-URL>` target
   never falls back to creating a different PR: preserve the completed work
   and report what is needed to continue. If publication is blocked or
   interrupted, report exactly what succeeded and what remains, preserve the
   completed local work, and include the continuation prompt that every
   incomplete stop carries, with the exact delivery target.

This endpoint does not authorize merging, force-pushing, changing remotes,
discarding unrelated changes, or publishing a release. If the requested task
needs no changes, explain the finding instead of manufacturing an empty PR.

## Finish

Verify the final task diff and a relevant acceptance check. Report what changed,
tests/checks and independent review performed, any material limitations or open
findings, and the delivery state (uncommitted changes, commits, or PR link).
Keep the agent ledger out of the default user-facing summary. A clean review
is evidence of checking, not a guarantee that the change has no defects.

When `--stats` was supplied, follow the active runtime binding's session
usage summary procedure against the coordinator session and include a compact
result — overall duration, the per-session table (or a compact excerpt of
it), totals, and the per-provider breakdown — in the final report. If the
active binding has no such procedure, state that the option is unsupported
on the active runtime.
