# Standalone review examples

These examples are acceptance cases for interpreting the [review skill](../skills/review/SKILL.md)
against the [shared round contract](../skills/work/references/rounds.md) and the
[review](../skills/work/references/tasks/review.md) and
[deep-review](../skills/work/references/tasks/deep-review.md) task contracts.
They describe expected coordinator decisions; they are source-interpretation
examples, not live host tests.

| Situation | Expected behavior |
| --- | --- |
| The working tree has staged, unstaged, or untracked changes | Stop before dispatch: name what is present, require a clean tree, and never stash, commit, or discard the user's work. |
| The base is user-named, resolvable locally, or neither | Use the user-named local base; otherwise the local default from Git metadata and repository conventions; an unavailable or ambiguous base is a question to the user — never a fetch, and no branch, checkout, merge, rebase, or reset. |
| The range resolves to commits beyond the base | Record the base name, HEAD, merge base, and the merge-base to HEAD range in session context before dispatch; the reviewer inspects that exact range and verifies its evidence independently. |
| The branch has no commits beyond the base | Report that there is nothing to review; do not dispatch a reviewer. |
| The review produces findings | Dispatch exactly one fresh reviewer (the review contract, or deep-review with `--deep`), return its findings report to the user, and enter no fix loop: no second reviewer, no fix round, and the shared cycle caps do not apply. |
| A routing profile is selected, unknown, or unavailable | Resolve the route through the same bootstrap Work uses (no new routing key); an unknown or invalid profile is reported before dispatch with the names available for the active runtime, and a removed or unavailable selected profile blocks the dispatch rather than falling back silently. |
| State is created during the activation | The base, recorded range, routing record, and report stay in session context only; no handoff, backlog, archive, round ledger, or other operational file is created. |
| Git operations would change the repository | None are made: no commits, pushes, or branch or remote changes. Before reporting, the branch, `HEAD`, and working-tree status are rechecked: when unchanged, the working tree is left exactly as found — clean; when the checkout changed during the review, the verdict is scoped to the recorded commits and that change is stated. |
| Node is unavailable or the host cannot dispatch a child | Apply the routing contract in context where the fallback is documented; where dispatch itself is unavailable, report the limitation honestly instead of inventing a route, and never claim a clean verdict without evidence. |
| A necessary check is unavailable when the review ends | Never claim a clean verdict: report the established findings together with the missing evidence — the check that could not run and what it leaves unverified — instead of a clean outcome. |
| Work or Autonomous runs after the change | Their existing review and fix gates, budgets and allowances, and state policies apply unchanged: the standalone skill does not activate either workflow or feed it rounds, and addressing the review's findings is a separate request (for example a `/work` invocation). |
| A build, install, update, or remove fixture runs | The new skill and its OpenCode command entry are included by the existing ownership rules: they are part of the generated bundle and the install state, an update from a pre-review install adds them without `--replace`, a differing copy collides until `--replace` backs it up, and uninstall removes unmodified owned files while preserving a modified one. |
