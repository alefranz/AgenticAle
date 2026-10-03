---
name: work
description: "Coordinate an everyday coding task through focused implementation, independent review, and fixes, optionally through opening a PR. Explicit-only: invoke with /work (optionally /work --pr) to start a reviewed task; the model does not start this workflow on its own."
version: 1
slash: true
disable-model-invocation: true
metadata:
  opencode/autoinvoke: false
---

# Reviewed task work

Complete the user's current task with focused, fresh subagents. The coordinator
owns scope, user communication, and delivery; workers implement and independent
reviewers inspect the result. Read [the shared round contract](references/rounds.md)
before dispatching, including its bundled skill loading and task-packet rules.
Dispatch each round to a fresh child subagent using the task contract named for
that round under `references/tasks/`; those contracts are shared by both
workflows and do not activate Autonomous Mode.

## Entry and arguments

Consume the invoking user's task text directly; do not treat a placeholder
arguments token as the task. A leading `--pr` option selects delivery through a
GitHub pull request, and the remaining text is the task. A clear
natural-language request to open a PR selects the same endpoint. Otherwise use
the current branch and leave changes uncommitted unless the user or applicable
repository instructions specify otherwise. With empty input, use an unambiguous
current task or ask what to work on; never implicitly resume an autonomous
handoff. Investigation-only requests stay investigation-only, and a mention of
an existing PR or a request to address its feedback alone does not authorize
publishing.

## Start from the requested outcome

Read applicable repository instructions and inspect the current branch, status,
and diff. Record the starting state in session context, including pre-existing
staged, unstaged, and untracked changes. Preserve unrelated work and distinguish
it from the task's changes throughout review and delivery. If overlapping edits
cannot be attributed safely, ask before changing or committing them.

Use the current request and relevant conversation to identify the task and its
acceptance criteria. Empty command input uses an unambiguous current task;
otherwise ask what to work on. Never resume an autonomous handoff implicitly.

Choose the smallest useful path:

- A clear change: implement, independently review, and finish.
- An uncertain request: explore one concrete question first. Present options
  when the findings expose a meaningful user choice, then implement once the
  intended outcome is clear.
- Investigation or advice only: return findings and options without implementing.
- Review feedback: inspect the actual feedback and current changes, fix the
  requested issues, and independently review the fix and affected behaviour.
  Retrieve referenced feedback using available tools; ask for it if inaccessible.

Ask the user about consequential scope, behaviour, or preference choices; do
not invent their preference or require a consultation first. Continue routine
implementation and review fixes without stage-by-stage permission requests.
Child agents return blockers to the coordinator rather than asking the user.

## Route only the rounds needed

| Purpose | Task contract |
| --- | --- |
| Focused project or external-source discovery | [explore](references/tasks/explore.md) |
| Routine implementation | [implement](references/tasks/implement.md) |
| Concurrency, subtle state, security, or difficult contract reasoning | [implement](references/tasks/implement.md) with hard-task routing context |
| Fix specific review findings | [fix](references/tasks/fix.md) |
| Independent review of changes | [review](references/tasks/review.md) |
| Integration review across substantial interacting slices | [deep-review](references/tasks/deep-review.md) |
| Optional technical second opinion | [consult](references/tasks/consult.md) |

### Resolve routing before dispatching

Before dispatching any round, the coordinator loads the routing policy and the
active runtime binding, in this order:

1. Read [the routing contract](references/ROUTING.md) and
   [the packaged policy](references/routing.json).
2. Select the applicable runtime binding from
   `references/runtimes/` for the host actually being used; that binding states
   the native dispatch schema, the per-host model/effort field names, and how
   `inherit` and unsupported hosts are handled on that surface.
3. For each round, resolve its named routing key against the active policy using
   the documented precedence (task override, then `--routing` file, then the
   packaged preset), then dispatch using the binding's exposed native schema.

A missing key in a complete policy is an error, not an implicit inheritance. If
the host does not expose the native dispatch field for the resolved route, the
coordinator follows the runtime binding's documented fallback and records the
requested route versus the effective model and effort. Do not silently inherit
the session model in place of a route the policy names.

Default to routine implementation. Exploration, consultation, and deep review
are conditional, not mandatory stages. Keep the coordinator's context small by
passing relevant facts and paths rather than full transcripts. Run rounds
sequentially; never have a worker approve its own change.

For a larger task, split by verifiable outcomes. Review each implementation
slice and check the combined result before delivery. Use deep review only when
the interactions merit it. Independent review is the default for changes;
there is no strict/standard selector in this workflow. An explicit user request
to skip review can override this; disclose that review was skipped.

Start with a budget appropriate to the task, normally up to six worker rounds
(explore, implement, hard implementation, or fix). Allow at most two fix cycles
per slice, three review passes per slice, and one optional consultation per task.
Review calls do not consume the worker budget but are bounded by these caps.
Caps prevent dispatching another round of that type beyond its allowance;
verification and the permitted review of the last allowed worker still run.
If more work is then required, stop and report it. Also stop when the same
blocker recurs or two consecutive workers make no material progress. Do not
quietly replenish the budget or return incomplete work as finished.

If a child is interrupted, inspect its actual changes and verification state.
Start a fresh child with the last known facts and one next action; do not infer
completion from a partial response. A repeated interruption without progress
is a blocker to report.

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

A leading `--pr` option, or a clear request to complete this task and open a PR,
authorizes creating a feature branch, making coherent commits, pushing that
branch, and opening the PR. This is one delivery request: do not ask again for
each of those actions. A mention of an existing PR or a request to address its
feedback alone does not select this endpoint. Requests to update an existing PR
use its branch and PR rather than creating duplicates; push only when requested.

For the PR endpoint:

1. Before implementation, identify the repository, intended base, remote, and
   whether the task already has a feature branch or PR. Use an existing task
   branch when appropriate; otherwise create a feature branch from the intended
   base without discarding work. Resolve ambiguous destinations or unrelated
   branch history with the user. Check available authentication/tooling early.
2. Keep worker rounds uncommitted unless repository instructions require
   otherwise. Review the task changes independently before committing; make
   coherent task commits, not one commit for every agent round. Stage only task
   changes, preserving unrelated staged content as well as unstaged work.
3. Before pushing, inspect the full branch diff and outgoing commits against
   the intended base. Ensure they match the requested scope and final reviewed
   content; additional edits must be verified and reviewed as appropriate.
4. Push the task branch with ordinary Git semantics. Before drafting the PR
   body, load `pull-request-description` by exact ID or read its full
   [SKILL.md](../pull-request-description/SKILL.md); apply it to the final
   reviewed branch diff. Use available GitHub tools to open the PR. Check for
   an existing matching PR before creation, including after an uncertain tool
   response. Never retry a creation blindly.
5. Return the PR URL and verification result. If publication is blocked, report
   exactly what succeeded and what remains; preserve the completed local work.

This endpoint does not authorize merging, force-pushing, changing remotes,
discarding unrelated changes, or publishing a release. If the requested task
needs no changes, explain the finding instead of manufacturing an empty PR.

## Finish

Verify the final task diff and a relevant acceptance check. Report what changed,
tests/checks and independent review performed, any material limitations or open
findings, and the delivery state (uncommitted changes, commits, or PR link).
Keep the agent ledger out of the default user-facing summary. A clean review
is evidence of checking, not a guarantee that the change has no defects.
