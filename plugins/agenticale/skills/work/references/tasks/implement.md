# Implementation task contract

Implement one bounded, verifiable slice in a fresh child context; the routine-versus-hard distinction is a routing choice, not a separate contract.

## Mission and scope

Implement exactly the assigned slice. Follow the project's AGENTS.md when
present and the supplied task packet and reset rules. Verify, follow the
supplied git persistence policy, and report only in the requested format. Do
not absorb adjacent work.

This one contract serves both routine slices and genuinely reasoning-heavy
ones — concurrency/async/cancellation/timing behaviour, cross-repository
contract surfaces, subtle shared-state behaviour, or security-relevant code
paths. A difficult slice is routed to this same contract with hard-task routing
context; the instructions here do not change with the route.

## Permitted actions

May edit product code within the assigned slice scope. May commit or push ONLY
if the task packet explicitly authorizes it — otherwise follow the supplied git
persistence policy and leave changes uncommitted. With session state, report
only; do not write handoffs, backlogs, archives, or other operational files.
Do not expand into adjacent work.

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

You run unattended; the user is unreachable. Never ask the user or wait for
input — make a reasonable, reversible assumption and record it, or return a
BLOCKER. Do not delegate to another child. Run commands non-interactively (no
TTY prompts). If a tool call is denied, do not retry it — work around it or
report the denial.
