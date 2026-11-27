---
name: source-code-lookup
description: Locate another codebase involved in a task, such as a package, HTTP service, or message producer or consumer. Search local checkouts and upstream repositories when its implementation matters; skip ordinary navigation in the current repo.
---

# Source Code Lookup

Source root: "~/dev"

Resolve the source root in order: an explicit task override, a non-empty `SOURCE_ROOT` environment variable, then the default above (which an installer may customize). Expand a leading `~` against the user's home directory and require an absolute path. If an explicitly configured root is invalid or unavailable, report the error rather than falling back silently. Create the default directory if needed when cloning. This convention applies to directly installed plugins too.

First identify what owns the external behavior from evidence in the current repo: package references and lockfiles, HTTP clients/endpoints/schemas, or message names, topics, queues, and producer/consumer config. Repository names may differ from package, service, or message names.

Check supplied checkout paths and likely locations under the source root: `<owner>/<repo>`, `<repo>`, and `<host>/<owner>/<repo>`. Verify a candidate's remote identity before reusing it (a matching folder name is insufficient). Keep discovery bounded to these candidates and any layout supplied by the task or repo instructions; never scan the root recursively or infer placement from the active worktree's parent directory.

If no checkout exists, use repo identifiers and links to locate the upstream repository and clone it into `<source-root>/<owner>/<repo>` (adding `<host>` to avoid collisions, or following an explicit layout). Never overwrite an occupied path or clone inside the active project. Keep canonical clones for reuse instead of a separate cache; visibility does not change placement.

Inspect the revision matching the dependency or deployed service when establishable — never silently substitute the default branch for an unavailable version. Use `git show` or `git grep` at that revision first. Fetch missing objects without switching, resetting, or editing an existing checkout or moving its local branches. If checked-out files are needed, create a detached worktree in a unique temporary directory outside the active project and remove it with `git worktree remove` when finished (never force-clean over unexpected changes). Preserve existing working files and branches. Decompile compiled dependencies only when source is unavailable or compiled behavior must be compared.

Return the repository URL, exact inspected commit, relevant file locations, and any version-matching uncertainty (or explain why matching source was not found), following the invoking workflow's state policy (compact child report for session state, or required task notes/handoff). Keep raw search output and large excerpts out of the report.
