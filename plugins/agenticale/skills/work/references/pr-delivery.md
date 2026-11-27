# Pull request delivery (`--pr`)

Read this reference only when `--pr` (`--pr=<PR-URL>`) or an unambiguous request to commit and push updates to a pull request is active.

PR delivery is one combined endpoint (coherent task commits, push, create/update PR) — do not ask separately for each Git step. It never authorizes merging, force-pushing, changing remotes, discarding unrelated changes, or publishing a release. If no product changes are needed, explain that instead of creating an empty PR.

## 1. Resolve destination before implementation

1. Identify the repository, intended base branch, task branch head and remote (including fork PRs), and whether a matching open PR already exists — match by branch/remote identity, never by title or conversation memory alone.
2. With `--pr=<PR-URL>`, target that exact PR and authorize committing/pushing requested changes to its head branch. If it is inaccessible, closed, merged, or ambiguous, never fall back to creating a different PR; preserve local work and report what is needed.
3. With an existing matching open PR on the task branch, update it; otherwise plan to open one from a suitable task branch (or new feature branch off the intended base) without discarding existing work. Repeated `--pr` runs reuse the open PR rather than creating nested branches or duplicate PRs.
4. Check available Git/PR tooling and authentication early, briefly announce the resolved destination (create vs. update), and ask only on material ambiguity or conflict.

## 2. Commit cleanly after review

- Keep worker rounds uncommitted unless repo instructions require otherwise.
- Complete the independent review (or deterministic check for clearly mechanical changes under [Review and fix gate](rounds.md#review-and-fix-gate)) before committing.
- Make coherent task commits (not one commit per agent round), staging only task changes and preserving unrelated staged and unstaged work.

## 3. Verify outgoing diff and push

- Inspect the full outgoing commit range and branch diff against the intended base before pushing. Ensure every commit matches the requested scope and reviewed content; resolve any unrelated outgoing commits before pushing, and re-verify/re-review if files changed after review.
- Push with ordinary Git semantics (never force-push). If a push is rejected because the remote branch advanced, reconcile state and verification before retrying.

## 4. Draft PR body and create or update

- Before writing or updating the PR description, load `pull-request-description` by exact ID or read [its SKILL.md](../../pull-request-description/SKILL.md) and apply it to the final reviewed diff.
- Before creating a new PR (including after an uncertain tool response), check whether a matching open PR already exists — only create from a confirmed absence, never blindly after a failed lookup.

## 5. Report result or blocked delivery

Report the actual delivery outcome and PR URL. If blocked or interrupted, preserve all local work, state clearly what succeeded and what remains, and include a continuation prompt carrying the exact delivery target.
