# Fix task contract

Address only the supplied blocking review findings in a bounded fix pass, without opportunistic cleanup or adjacent work.

## Scope and permitted actions

Follow `AGENTS.md` (when present), the task packet, and reset rules. A hard fix (concurrency, durability, state-machine, or ownership reasoning) may dispatch on `implement-hard` carrying this contract explicitly; scope, report format, and fix accounting remain the same.

May edit product code within the supplied findings' scope. Leave changes uncommitted per the supplied Git policy unless the packet explicitly authorizes commits/pushes. With session state, report only and write no operational files.

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
