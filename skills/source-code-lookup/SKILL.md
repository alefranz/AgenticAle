---
name: source-code-lookup
description: Locate another codebase involved in a task, such as a package, HTTP service, or message producer or consumer. Search local checkouts and upstream repositories when its implementation matters; skip ordinary navigation in the current repo.
---

# Source Code Lookup

Source root: "~/dev"

Resolve the source root in this order: an explicit task override, a non-empty `SOURCE_ROOT` environment variable, then the default above (which an installer may customize). Read the variable from the execution environment, expand a leading `~` against the user's home directory, and require an absolute path. If an explicitly configured root is invalid or unavailable, report the problem instead of silently falling back. Create the default directory if needed when cloning. This convention also applies to directly installed plugins; no custom build is required.

When behavior outside the current codebase matters, first identify what owns it. Follow the evidence available in the current repo: package references and lockfiles; HTTP clients, endpoints, and API schemas; or message names, topics, queues, schemas, and producer or consumer configuration. Repository names may differ from package, service, or message names.

Check supplied checkout paths and likely locations under the source root: `<owner>/<repo>`, `<repo>`, and `<host>/<owner>/<repo>`. Verify a candidate's remote identity before reusing it; a matching folder name alone is insufficient. Keep discovery bounded to these candidates and any layout explicitly supplied by the task or repository instructions. Do not recursively scan the root or infer placement from the active worktree's parent directory.

If no checkout is found, use the identifiers and links to locate the repository on its source host. Clone into the canonical `<source-root>/<owner>/<repo>` location, adding `<host>` when needed to avoid a collision, or follow an explicitly supplied layout. Never overwrite an occupied path or clone inside the active project. Keep canonical clones for future reuse rather than creating a separate inspection clone cache. Repository visibility does not determine placement.

Inspect the revision that matches the dependency or deployed service when it can be established; do not silently substitute the default branch for an unavailable version. Use `git show` or `git grep` at that revision first. Fetch missing objects without switching, resetting, or editing an existing checkout or moving its local branches. If checked-out files are needed, create a detached worktree in a unique temporary directory outside the active project and remove it with `git worktree remove` when finished. Never force cleanup over unexpected changes. These operations may update Git metadata but must preserve existing working files and branches. For compiled dependencies, decompile only when source is unavailable or compiled behavior needs comparison.

Return the answer with the repository URL, exact inspected commit, relevant file locations, and any uncertainty about version matching, or explain why matching source was not found. Use the invoking workflow's state policy: a compact child report for session-only work, or its required task notes/handoff. Keep raw search output and large source excerpts out of the report.
