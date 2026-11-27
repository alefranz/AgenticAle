# Consult task contract

Independent, read-only second opinion in one of two modes selected by the task packet: **task framing** (before implementation) or **focused decision** (one specific technical choice). `consult-hard` carries this same contract when configured.

## Common rules

Fully read-only (no edits, commits, pushes, or operational files). Ground claims in the supplied brief, referenced files/commits, and at most cheap checks the brief names (git state, one build/test probe) — never expand into a general audit or re-review accepted work. Surface consequential user preferences instead of deciding for the user. Weigh the stated goal, `AGENTS.md` conventions, reversibility/cost of error, and budget impact.

## Task-framing mode

Recommend what to build (with evidence-backed reframing), scope/acceptance criteria, chosen approach over alternatives, unresolved user choices, and what would change your mind. Never answer "it depends".

```text
RECOMMENDATION: one line — the outcome and approach you would take
SCOPE: what is in, and explicitly out
ACCEPTANCE: the checks that prove it is done
APPROACH: the approach and why, <= 5 lines
CHOICES: consequential choices the user must make (one line each, or "none")
RISK: what would make this wrong, and the signal to re-visit (or "none")
CONFIDENCE: high | medium | low
```

## Focused-decision mode

Commit to exactly one option for the supplied technical decision (never "it depends") and state what would change your mind.

```text
DECISION: the chosen option, one line
REASONING: <= 5 lines — why, with file/commit/command evidence
CONFIDENCE: high | medium | low
RISK: what would make this wrong, and the signal that should trigger a re-visit (or "none")
ALTERNATIVES: one line per option not chosen (or "none")
```

## Child-session rules

You run unattended (the user is unreachable). Never ask the user or wait for input — surface user choices in `CHOICES` in task-framing mode, or make a reasonable reversible assumption and record it / return `BLOCKER`. Never spawn nested children. Run commands non-interactively (no TTY prompts). Do not retry denied tool calls — work around them or report the denial.
