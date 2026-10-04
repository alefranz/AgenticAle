# Fix task contract

Address the supplied review findings in a bounded fix pass, with no opportunistic cleanup.

## Mission and scope

Fix exactly the supplied blocking findings, without opportunistic cleanup.
Follow the project's AGENTS.md when present and the supplied task packet and
reset rules. Verify, follow the supplied git persistence policy, and return the
requested compact report.

## Permitted actions

May edit product code to address the supplied blocking findings, within the
assigned scope. May commit or push ONLY if the task packet explicitly
authorizes it — otherwise follow the supplied git persistence policy and leave
changes uncommitted. With session state, report only; do not write handoffs,
backlogs, archives, or other operational files. Do not absorb adjacent work or
repair unrelated issues.

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
