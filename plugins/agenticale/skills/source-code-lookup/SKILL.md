---
name: source-code-lookup
description: Locate another codebase involved in a task, such as a package, HTTP service, or message producer or consumer. Search local checkouts and upstream repositories when its implementation matters; skip ordinary navigation in the current repo.
---

# Source Code Lookup

Source root: "~/dev"

When behavior outside the current codebase matters, first identify what owns it. Follow the evidence available in the current repo: package references and lockfiles; HTTP clients, endpoints, and API schemas; or message names, topics, queues, schemas, and producer or consumer configuration. Repository names may differ from package, service, or message names.

Search the source root recursively for an existing checkout. If none is found, use the identifiers and links you found to locate the repository on GitHub or its other source host. Clone it outside the active project when inspecting its code would help. Follow a clear existing layout under the source root; otherwise use `<owner>/<repo>`, adding the host name only to avoid a collision. Repository visibility does not determine placement.

Inspect the revision that matches the dependency or deployed service when it can be established. Do not switch, reset, or edit another repo's working copy; use `git show` or a detached worktree in a temporary directory if you need checked-out files. For compiled dependencies, decompile only when source is unavailable or compiled behavior needs comparison.

When the lookup affects an implementation decision, record the source location and revision, or the reason no matching source was found, in the task notes or handoff.
