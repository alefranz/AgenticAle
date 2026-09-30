---
description: "Implement and independently review a task, optionally through opening a PR."
argument-hint: "[--pr] [task]"
---

Explicitly load the work-mode skill by ID. Interpret the complete command
arguments as: $ARGUMENTS

A leading --pr selects delivery through a GitHub pull request; the remaining
text is the task. A clear natural-language request to open a PR selects the
same endpoint. Otherwise use the current branch and leave changes uncommitted
unless the user or applicable repository instructions specify otherwise.
With empty arguments, use the unambiguous current task or ask what to work on.

Follow the shared contract's bundled skill rules: load `pull-request-description`
before drafting or revising a PR body, and have the investigating agent load
`source-code-lookup` when behavior in another codebase matters. Read the full
skill instructions; do not rely on discovery descriptions or remembered habits.

Use the installed `agenticale-*` roles with the work-mode skill's session-state
policy and shared round contract. These role IDs do not activate Autonomous
Mode. Independently review implementation changes and address blocking
findings within the skill's limits. Ask meaningful questions from the
coordinator when needed; children return blockers rather than asking users.
