---
name: review
description: "Independently review the current branch's net changes from the local merge base to the current working-tree result — the committed branch review on a clean tree — with one fresh reviewer, returning findings to the user. Explicit-only: invoke with /review (optionally /review --deep); the model does not start this workflow on its own."
version: 1
slash: true
disable-model-invocation: true
metadata:
  opencode/autoinvoke: false
---

# Standalone branch review

Give the current branch's net changes an independent review against a local base using one fresh reviewer. This skill only reviews — it never implements, fixes, commits, or publishes, and does not activate `work` or `autonomous`.

## Entry and arguments

Consume the invoking user's text directly (never treat a placeholder arguments token as input):

- Optional leading `--deep` selects [review-deep](../work/references/tasks/review-deep.md) instead of [review](../work/references/tasks/review.md).
- `--` explicitly ends options; option parsing also stops at the first non-option token. Remaining text is review context: a focus, acceptance criteria, an explicit natural-language scope (e.g., "only my uncommitted changes"), or a named local base. There is no base or scope flag.
- Empty arguments use the local default base with no extra criteria.

## Comparison scope and base

- **Default scope:** merge base of the current branch and resolved base to the current working-tree result, including relevant untracked files (on a clean tree this is the committed branch diff; on a dirty tree working-tree contents override staged contents, and uncommitted edits never narrow away branch commits).
- **Explicit HEAD-relative scope** (e.g., "only my uncommitted changes"): changes relative to `HEAD` through the same working-tree result. Ask or reject if scope instructions conflict.
- **Resolve the base:** use the named local branch/tag/commit when given, or the local default branch from local Git metadata (e.g., remote HEAD ref) and repo conventions. If a named base is missing locally or ambiguous, or no base can be determined, ask the user — never substitute another base.
- **Read-only:** never fetch, switch branches, check out, stash, commit, merge, rebase, or reset.

Record the exact comparison in session context: base name, `HEAD` commit, merge base, baseline (merge base or `HEAD`), endpoint (working-tree result), and included untracked files, with enough content evidence to detect changes during review (a status line or filename list alone is insufficient).

Check the actual **net comparison** between the baseline and working-tree result (branch commits and local edits can cancel each other out). If the net comparison is empty, report nothing to review and stop without dispatching.

## Dispatch

Select the runtime binding from the host's tool surface — never from a model name — under `../work/references/runtimes/` (on OpenCode, dispatch `agenticale/review` or `agenticale/review-deep`). The workflow never selects a model. Where an installation appends a "Model configuration (this installation)" section, read only its documented preference file read-only at most once at activation (kept fixed for the activation); otherwise read, create, or modify no configuration file. A missing or unreadable profile blocks dispatch and is reported with the binding's refresh procedure.

State the actual comparison and included changes, then dispatch **one** fresh child subagent carrying the [review contract](../work/references/tasks/review.md) (or [review-deep contract](../work/references/tasks/review-deep.md) with `--deep`) and a concise, self-contained task packet:

- Repository path, current branch, and applicable repository instructions (`AGENTS.md` when present).
- Recorded comparison (base name, merge base, `HEAD`, baseline/endpoint, included untracked files) — the reviewer verifies independently without expanding into a repository-wide audit.
- User-supplied focus, criteria, and context (clearly labelled as user-supplied).
- Checks the user named or obvious targeted repository checks the reviewer may run.
- Bundled skill instruction: if external dependency/service code matters, read [source-code-lookup](../source-code-lookup/SKILL.md) before inspecting it.
- `State policy: session; report only; no operational files`.

Do not invent worker history or accepted-slice summaries. Never dispatch a second reviewer, a fix round, or any other child.

## Finish

Before reporting, re-check the current branch, `HEAD`, and working-tree result read-only. If anything changed during the review, state that the verdict covers only the recorded comparison and list what changed; never claim the changed result is covered.

Return the reviewer's report naming the reviewed branch, base, and recorded comparison: verdict (clean or blocking findings), each finding's location, impact, and required action, optional nits, commands run with results, and any unrun checks or missing evidence (never claim a clean verdict when evidence is missing).

Findings go only to the user — no fix loop, re-review, PR, or merge. Addressing findings is a separate request (a `/work` invocation in the same session uses them directly). Keep all state in session context with no operational files, product edits, or Git changes.
