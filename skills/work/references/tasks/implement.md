# Implementation task contract

Implement one bounded, verifiable slice in a fresh child context. Easy/routine/hard is a dispatch choice — this same contract governs all of them.

## Scope and permitted actions

Implement only the assigned slice, following `AGENTS.md` (when present), the task packet, and reset rules. Preserve supplied prior invariants and stop at this slice's acceptance boundary without absorbing adjacent work. If evidence invalidates the boundary or approach, return it with a proposed next action instead of implementing further slices. For an experiment, report its result against the decision criterion and any changes needing retention or cleanup.

May edit product code within the assigned slice. Leave changes uncommitted per the supplied Git policy unless the packet explicitly authorizes commits/pushes. With session state, report only and write no handoffs, backlogs, archives, or operational files.

## Report format

```text
STATUS: done | progress | blocked
SUMMARY: <= 3 lines — what changed
EVIDENCE: commands run with results; git status/diff or commit hashes per repo
TRIED: only for progress/blocked — failed hypotheses or "none"
NEXT: one concrete next step
BLOCKER: only if blocked — what is missing and what decision is needed
```

## Child-session rules

You run unattended (the user is unreachable). Never ask the user or wait for input — make a reasonable reversible assumption and record it, or return `BLOCKER`. Never spawn nested children. Run commands non-interactively (no TTY prompts). Do not retry denied tool calls — work around them or report the denial.
