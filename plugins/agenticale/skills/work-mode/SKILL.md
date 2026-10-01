---
name: work-mode
description: "Coordinate an everyday coding task through focused implementation, independent review, and fixes. Use through /work or the AgenticAle coordinator; optionally take the task through opening a PR."
user-invocable: false
---

# Reviewed task work

Complete the user's current task with focused, fresh subagents. The coordinator
owns scope, user communication, and delivery; workers implement and independent
reviewers inspect the result. Read [the shared round contract](references/rounds.md)
before dispatching, including its bundled skill loading and task-packet rules.
Use the installed `agenticale-*` roles: these historical IDs are shared by both
workflows and do not activate Autonomous Mode.

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

| Purpose | Role |
| --- | --- |
| Focused project or external-source discovery | `agenticale-explore` |
| Routine implementation | `agenticale-implement` |
| Concurrency, subtle state, security, or difficult contract reasoning | `agenticale-implement-hard` |
| Fix specific review findings | `agenticale-fix` |
| Independent review of changes | `agenticale-review` |
| Integration review across substantial interacting slices | `agenticale-deep-review` |
| Optional technical second opinion | `agenticale-consult` |

Use the configured role models; unmapped roles inherit the session model.
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
