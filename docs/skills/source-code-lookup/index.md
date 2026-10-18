# Source code lookup

`source-code-lookup` helps when a task depends on how another codebase,
dependency, service, or API behaves. It locates the relevant source, checks the
applicable revision, and returns focused evidence with file references. Work
and Autonomous load it when that investigation is needed.

Typical requests include:

- `/work Check how our HTTP client retries timeouts before changing this code`
- `/work Find where this event is produced in the companion service`
- `/autonomous Verify the upstream API contract before planning the migration`

The slash form is conceptual; invoke the workflow through the syntax your
client supports in [installation and client setup](../../setup.md). You do not
normally invoke this supporting skill directly. Describe the dependency or
repository and the behavior the task needs to establish. The workflow checks
the configured source root and repository identity, then inspects the relevant
revision. If the canonical repository is missing, it may clone it into the
configured source root for reuse. The result identifies the repository URL,
exact inspected commit, relevant files, and any version uncertainty. If the
repository or behavior is ambiguous, the workflow asks for the missing
repository or revision details before treating the lookup as reliable.

The authoritative lookup procedure is in the
[source-code-lookup skill](https://github.com/alefranz/AgenticAle/blob/main/skills/source-code-lookup/SKILL.md).
Its configuration is covered in [setup](../../setup.md#source-lookup-configuration).
