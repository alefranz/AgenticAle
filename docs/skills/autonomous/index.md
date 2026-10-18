# Autonomous

Autonomous is for a long goal that needs to continue through several focused
work rounds and fresh sessions. The skill keeps a durable backlog and handoff
in the project so a later activation can resume the recorded next action.

Use it for a multi-step project, such as:

- `/autonomous Add CSV export, update its tests, and prepare the release`
- `/autonomous 4 Migrate the report pipeline and verify the new behavior`
- `/autonomous` to resume the active handoff

The slash form is conceptual: use the invocation supported by your client, as
described in [installation and client setup](../../setup.md). Autonomous starts
only when explicitly invoked. A positive number at the start sets the worker
round budget; otherwise the default budget is used. The session becomes the
coordinator and proceeds in sequential, bounded rounds. Code and configuration
changes receive independent review by default, with focused fixes for blocking
findings.

You provide the goal, constraints, and any acceptance examples. The workflow
records durable progress in the target project's `BACKLOG.md` and
`docs/handoffs/active.md`, and returns the completed work, verification, and
remaining limitations. By default changes stay uncommitted; commit, branch,
push, and pull request actions are separate requests. An investigation-only
goal returns findings and a next step.

The coordinator may ask you to settle a meaningful behavior choice, provide
missing information, or clarify an ambiguous pull request destination. If a
round cannot proceed because of a permission or capability limit, it reports
the blocker and the choice needed to continue.

For the detailed state, budget, routing, review, and resume rules, read the
[Autonomous skill source](https://github.com/alefranz/AgenticAle/blob/main/skills/autonomous/SKILL.md)
and the shared
[round contract](https://github.com/alefranz/AgenticAle/blob/main/skills/work/references/rounds.md).
For setup, see [installation and client setup](../../setup.md); for the
everyday workflow, see [Work](../work/index.md).
