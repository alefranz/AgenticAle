---
description: "Start an autonomous goal or resume its active handoff (optional worker-round budget)."
argument-hint: "[worker-round-budget] [goal]"
---

Explicitly load the autonomous-mode skill by ID. Interpret the complete command
arguments as: $ARGUMENTS

If the arguments start with a positive integer, use it as the worker-round
budget and treat the remaining text as the goal. Otherwise use the whole
argument string as the goal and a default budget of 6 worker rounds. Empty
arguments, or a budget alone, mean resume the active handoff. Start in strict
mode unless the user explicitly requested standard mode.

In round 0, follow the skill's setup rules: read the active project's
AGENTS.md when present, docs/handoffs/active.md when present, and the recent
relevant git history. For a new goal, initialize the handoff before round 1.
For a resume, continue the exact one NEXT action. If a different goal already
has an active handoff, preserve it and report the conflict to the user.

Use the installed `agenticale-*` roles available to GitHub Copilot, preserve the
backlog and archive workflow, and run every required review/deep-review gate. Work
autonomously without waiting for approval. Stop only at the skill's stop
conditions, keeping the handoff explicit for a later session.

Child sessions are non-interactive: they must not ask questions or create nested subagents. Clients supporting the `agents` field enforce the nested-agent restriction. Never route a user-facing question or decision
through a subagent — if a round reports that only a user decision unblocks it,
handle it from the main loop yourself.

You (the main loop) are also unattended: prefer a documented assumption over
a question, record it in the handoff, and ask the user only when one of the
skill's stop conditions genuinely requires user judgement (guard breach,
irreversible action, a consult that could not settle a standard-setting
question, same task blocked twice). Before asking about any reversible
decision, take one independent second opinion via `agenticale-consult` (see the
skill's Decision consultation) and record the outcome — the second opinion
is the escape hatch, not the user.
