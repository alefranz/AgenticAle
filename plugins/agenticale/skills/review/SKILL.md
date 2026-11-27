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

## Model configuration (this installation)

At activation the workflow may read one optional preference file: first
`<project-root>/.agenticale/preferences.md`, then
`~/.agenticale/preferences.md`. A missing file is normal (no
customization); the workflow never creates or modifies preference files.
When this default lookup finds no file, the workflow adds one non-blocking note
that every role inherits the session model, pointing at the
user-invoked `configure` skill and its
[bundled starter](../configure/references/preferences.example.md); it
reads nothing extra, and a missing named `--profile` file remains an error.

Format: a Markdown list of direct role assignments, one per line:

- `- <role>: <provider/model[#variant]>` — one combined value. The optional
  `#variant` suffix carries the reasoning variant
  (`low`, `medium`, `high`, `xhigh`, `max`); where the host exposes separate
  model and effort fields, the variant is passed as the effort selection.
- The earlier forms stay accepted: `- <role>: <model>` (no effort) and
  `- <role>: <model>, <effort>`. The comma form means the same assignment
  as the combined `#variant` form, so existing preference files keep
  working unchanged; use one form or the other on a line.
- `<role>` is one of the nine child worker keys: explore, implement,
  implement-easy, implement-hard, fix, review, review-deep, consult,
  consult-hard. There is no coordinator key: the host owns the session
  model, and this file never changes it — select the session model in the
  host itself.
- Roles not listed use the host default (the session model).
- `implement-easy` and `consult-hard` are optional routes. When they are not
  listed, the shared routing policy dispatches the base route (`implement`
  or `consult`) with its existing assignment — a defined fallback, not an
  error. When one IS listed but the host cannot honor the requested
  selection, the workflow surfaces the limitation; it never silently
  substitutes a weaker route.
- Nothing else is interpreted: no tiers, no fallbacks beyond the optional
  routes above, no runtime sections, no profile sections, no merging of
  files.

A leading `--profile NAME` option (or an unambiguous natural-language
equivalent) selects the file `preferences.NAME.md` instead, again project
first, then personal. `NAME` is 1-40 characters: a lowercase letter, then
lowercase letters, digits, or hyphens, with no trailing hyphen; `default`
and `inherit` are reserved.
A missing selected file is a concise, actionable error listing the files
that exist at the checked locations — never a silent fallback. The
selected file is read once at activation and stays fixed; the selection
stays in session state for the activation.

Application: where the active runtime binding exposes per-spawn model/effort
fields, the role's assignment is passed at dispatch; where the host cannot
select a model per child, the assignment has no effect (say so when the
user asks for it). A profile never changes the session model, runtime,
credentials, or endpoints. The effective selection is established only from
native host evidence (runtime metadata or local traces), never from a
child's self-reported model name; keep an unknown effective setting unknown.

The same file may also carry the top-level `## Work` section documented in
the skill body (worker-round allowance); it is the only other supported
section.

Example `preferences.md` shape (both value forms are accepted). The
`<...>` tokens are placeholders, not usable assignments: replace every one
with a real model name from your host's live listing (or one you know your
account exposes) and a real variant before use. The user-invoked
`configure` skill can discover the names with you and propose the exact
content before anything is written.

    - review: <provider/model#variant>
    - review-deep: <provider/model>, <effort>
    - consult-hard: <provider/model#variant>

    ## Work
    - worker rounds: 24
