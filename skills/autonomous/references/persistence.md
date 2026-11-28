# Persistence policies, gates, and checkpoints

## Git persistence policy

Record one policy in round 0 and pass it verbatim to every child (only the coordinator commits or pushes; children leave verified changes in the working tree):

- **Commit and push (default):** commit and push each completed task, stop-boundary WIP checkpoints, and state-only reconciliation checkpoints.
- **Commit:** user or `AGENTS.md` restricts to local commits only; commit at the same boundaries without pushing.
- **Working tree:** user or `AGENTS.md` forbids commits; leave changes in the tree and record `git status`/`git diff` evidence.

Keep the recorded policy across resumes unless the user explicitly upgrades/changes it (an upgrade re-evaluates completed tasks whose work is still unpersisted under the new policy without re-reviewing). Never silently strengthen a policy, create branches, change remotes, force-push, merge, open PRs, or publish releases. Commit changed repositories in dependency order and update outer-repo submodule pins.

## Bounded state-only persistence sequence

Every state-only boundary (task finalization, reconciliation checkpoint, stop close, final close, and cleanup) follows this finite sequence:

1. Apply targeted edits to `BACKLOG.md` and `.agenticale/active.md` on fresh re-reads and read back to confirm.
2. Under commit / commit-and-push, make one state-only commit (`BACKLOG.md`, `.agenticale/` — never product changes or unrelated edits).
3. Under commit-and-push, push to the verified upstream destination and confirm success.
4. Never write a commit's own hash back into the files it commits (later records read it from git history).

## Task lifecycle and persistence gate

A task moves through `review-open` → `accepted` → `persistence-pending` → `complete` (or `deferred` / `blocked` / `exhausted`, which never count toward the completed-task limit). A clean review never completes a task until its persistence gate closes:

1. **All gates closed:** every slice passed its required review/check and any applicable `review-deep` gate closed.
2. **Verify push destination (before pushing):** stop and ask if the branch is `main`/`master` or protected, has no configured upstream, has ambiguous remotes, or contains unrelated outgoing commits.
3. **Coherent task commits:** stage only the task's accepted product changes (preserving unrelated staged/unstaged work, concurrent human edits, and secrets; stop and ask if overlapping edits cannot be attributed safely). Reuse any recorded WIP checkpoint commits rather than duplicating them, committing only remaining deltas. Investigation-only tasks create no artificial product commits.
4. **Push & finalize:** push under commit-and-push, then run the bounded state-only sequence: collapse the completed task's `BACKLOG.md` entry (stripping in-flight working notes, scope notes, and fix specs) to a 1-line `[x]` confirmed result receipt (commit hashes + push destination) and overwrite `.agenticale/active.md` in place.

**Consolidated final close (goal met):** fold the last task's completion receipt and run-close record into **one** state-only completion commit keeping `.agenticale/active.md` intact until push is confirmed. Only after confirmation, fold any remaining snapshot notes into `BACKLOG.md`, delete `.agenticale/active.md`, and optionally prune or collapse completed prior-milestone `[x]` receipts to a 1-line milestone summary (full detail stays in Git history) in one bounded cleanup commit + push. Never delete `.agenticale/active.md` while any task or persistence is unconfirmed.

## Stop-boundary WIP and reconciliation checkpoints

- **WIP checkpoints (on incomplete stop):** under commit / commit-and-push, commit attributable unfinished product changes per repo (`WIP: <run-id> <task-id> — <summary>`), push under commit-and-push, and record the WIP hashes and **pre-WIP review base** (commit before the task's first WIP commit) in state so future reviews include WIP commits. Then persist stop state and continuation prompt. A WIP checkpoint never counts as task completion.
- **Reconciliation checkpoints:** immediately commit/push state-only changes whenever steering or replanning alters backlog tasks, acceptance, order, or deferred packets (routine progress/counter updates do not trigger checkpoints).

## Blocked, failed, or uncertain persistence

If any commit/push fails, is rejected (e.g., non-fast-forward), or is uncertain, **stop terminally local-only** before any further commit, push, or task selection: write exact hashes, destination, and error into `BACKLOG.md` and `.agenticale/active.md` without rewriting history or force-pushing. On resume, inspect local git history and remote read-only (`git fetch` / `ls-remote`), push existing unpushed commits as-is without duplicating them, and complete any missing record writes before starting new work.
