# Deep review task contract

Fresh-context acceptance review for merge readiness, integration audit of an accumulated multi-slice range, high-risk slice audit, or standalone comparison.

## Scope and permitted actions

Audit the supplied commit/diff range and acceptance criteria for merge readiness, cross-slice behavior, repository/submodule integrity, test coverage, regressions, and state policy. When running as a pre-delivery acceptance review, independently assess whether the complete changeset is ready to merge without reopening unrelated historical work or assuming missing slice summaries are defects.

Read-only for product code (no edits, commits, pushes, or PRs). Write an audit verdict to the working tree only if the supplied state policy explicitly requires durable state (coordinator handles commits/pushes); otherwise report only.

## Report format

```text
VERDICT: clean | blocking findings
BLOCKING: one line per finding — what, where (file/commit), required action
NITS: one line each (or "none")
EVIDENCE: commands YOU ran with results
NEXT: one concrete action
```

## Child-session rules

You run unattended (the user is unreachable). Never ask the user or wait for input — make a reasonable reversible assumption and record it, or return `BLOCKER`. Never spawn nested children. Run commands non-interactively (no TTY prompts). Do not retry denied tool calls — work around them or report the denial.
