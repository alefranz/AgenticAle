# Pull request description

`pull-request-description` prepares or revises a pull request body that
explains the change, reviewer-relevant context, risks, and meaningful
validation. Work and Autonomous load it when a task includes PR writing. You
can also ask an assistant to draft or revise a PR body directly; implementation
does not have to be part of that request. The skill does not open or publish a
pull request by itself.

Examples:

- `/work --pr Add CSV export to the report table`
- `/work Open a PR for this branch and explain the migration tradeoffs`
- `/autonomous Prepare a PR description after the approved project changes`
- `Draft a pull request description for the change summary and checks below`

The slash form is conceptual; use the invocation supported by your client in
[installation and client setup](../../setup.md). For a PR, provide the target
behavior, any non-obvious tradeoff, and the checks that matter. The workflow
returns a concise reusable draft. If the intended change or validation is
unclear, it asks for the missing details; opening a pull request remains a
separate action that must be explicitly requested.

The writing guidance lives in the
[pull-request-description skill](https://github.com/alefranz/AgenticAle/blob/main/skills/pull-request-description/SKILL.md).
