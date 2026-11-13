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

Give the current branch's net changes an independent review against a local
base: from the merge base to the current working-tree result, including
relevant untracked files. On a clean tree this is the existing committed
branch review. The session coordinates; one fresh reviewer inspects the
recorded comparison and returns its findings. This skill reviews — it does
not implement, fix, or publish. Read [the shared round contract](../work/references/rounds.md)
before dispatching, including its task-packet and report rules. The review and
deep-review task contracts are shared with the work and autonomous workflows;
invoking this skill does not activate either of them.

## Entry and arguments

Consume the invoking user's text directly; do not treat a placeholder
arguments token as the request. Interpret the complete arguments as:

- Leading options: an optional `--deep` option selects the deep-review
  contract for the review round. `--` is an explicit option delimiter; option
  parsing stops at the first non-option token, and everything after the
  options is the review context: a focus, acceptance criteria, an explicit
  scope (for example "only my uncommitted changes"), or a named local base.
  There is no base or scope flag; a base or scope is always named in the
  remaining text.
- With no arguments at all, use the local default base and no extra criteria.

## Comparison scope

The default comparison is the merge base of the current branch and the
resolved base to the current working-tree result, including relevant untracked
files. A dirty tree never narrows the review to uncommitted changes alone;
that would omit the branch's own commits. An explicit natural-language scope
in the review context (for example "only my uncommitted changes") selects the
local changes relative to `HEAD` instead; there is no scope flag. Existing
base selection, focus, and `--deep` behavior are preserved,
and genuinely conflicting scope instructions are clarified with the user or
rejected.

The final working-tree result is the reviewed content: a file whose staged and
working-tree contents differ is reviewed at its working-tree content, not the
intermediate staged version, and untracked files are included where relevant.
Never stash, commit, or discard the user's work. State the actual comparison
and included changes before dispatching.

## Resolve the base

- When the review context names no base, use the repository's default branch
  established from local Git metadata (for example the remote's HEAD
  reference) and applicable repository conventions.
- When the review context names a base that exists locally — a branch, tag,
  or commit — use it.
- When a named base is unavailable locally or is ambiguous, ask the user for
  the intended local base; do not review against a different target such as
  the default branch.
- When no base can be determined at all (for example none is named and no
  default-branch reference exists), ask the user which base to review against.
- Never fetch from a remote, and never switch branches, check out, merge,
  rebase, or reset: the comparison is read-only against the current checkout.

## Record the comparison range

Compute the merge base of the current branch and the resolved base, and record
the exact comparison in session context: the base name, the HEAD commit, the
merge base, the comparison baseline — the merge base for the default scope,
`HEAD` for the explicit HEAD-relative scope — the comparison endpoint, which
is the working-tree result in both scopes, and the untracked files included
in the review. The recorded comparison carries content evidence sufficient to
identify what is reviewed; a status line or an unchanged filename list alone
is insufficient.

Establish whether there is anything to review from the actual net comparison
between the recorded baseline and the working-tree result, including the
relevant untracked files — not from the commit-range diff and the local diff
considered separately: each part can be non-empty while the net result is
empty, when a local edit cancels a branch commit or an unstaged edit cancels
a staged change. When the net comparison is empty, report that there is
nothing to review and stop; do not dispatch a reviewer.

## Dispatch

Select the runtime binding from the host's tool surface — never from a
selected model name — under `../work/references/runtimes/`; on OpenCode
dispatch the installed `agenticale/review` profile, or
`agenticale/deep-review` when `--deep` was selected. The workflow never
selects a model. Where the installation appends a "Model configuration
(this installation)" section, the preference file it documents is the only
configuration file the workflow reads — at most once, at activation;
otherwise the workflow reads, creates, or modifies no configuration file. A
missing or unreadable profile blocks the dispatch and is reported with the
binding's refresh procedure. Where the installation documents a preference
file, the selected file stays fixed for the activation.

## Dispatch exactly one reviewer

Dispatch one fresh child subagent carrying the
[review contract](../work/references/tasks/review.md) — or the
[deep-review contract](../work/references/tasks/deep-review.md) when `--deep`
was selected — with the task packet the shared round contract defines. The
packet supplies:

- the repository path, the current branch, and applicable repository
  instructions (the project's `AGENTS.md` when present);
- the recorded comparison: base name, merge base, HEAD commit, the comparison
  endpoint, and the included untracked files. State the actual comparison and
  included changes before dispatch; the reviewer inspects that comparison and
  verifies its evidence independently, and never expands into a
  repository-wide audit;
- the user's focus, criteria, and context, clearly labelled as user-supplied;
- verification commands the user named, or the repository's obvious targeted
  checks, stated as checks the reviewer may run;
- `State policy: session; report only; no operational files`.

No worker report, accepted-slice summary, or implementation history is
supplied, and none is invented: this is a review of the recorded comparison,
not of a completed worker slice. Do not dispatch a second reviewer, a fix
round, or any other child; the shared fix-and-review loop does not run from
this invocation.

## Finish

Before returning the report, recheck the checkout: the current branch, `HEAD`,
and the working-tree result. When the checkout or the working-tree result
changed during the review, state that the verdict covers only the recorded
comparison and what changed; never assert the checkout stayed unchanged
without that evidence, and never claim the changed result is covered.

Return the reviewer's report as the outcome: a verdict (clean or blocking
findings), each finding with its location, impact, and required action,
optional nits, and the commands the reviewer ran with results.

- Identify the reviewed branch, the base, and the recorded comparison in the
  final report.
- Disclose checks the reviewer could not run, unavailable criteria, or
  evidence it could not establish; never claim a clean verdict when the
  evidence is missing.
- Findings are returned to the user, not dispatched: there is no fix round, no
  re-review, no hosted review, and no approval or merge. Addressing the
  findings is a separate request; a `/work` invocation in the same session
  uses the findings and scope directly.
- State stays in the session: the base, the recorded comparison, the dispatch
  record, and the report are retained in session context. No handoff, backlog,
  archive, round ledger, or other operational file is created.
- Make no product-code changes and no Git changes of any kind: no commits, no
  pushes, no stashing, no remote fetch, no branch or remote changes; the
  pre-report recheck is read-only.

## Model configuration (this installation)

At activation the workflow may read one optional preference file: first
`<project-root>/.agenticale/preferences.md`, then
`~/.agenticale/preferences.md`. A missing file is normal (no
customization); the workflow never creates or modifies preference files.

Format: a Markdown list of direct role assignments, one per line:

- `- <role>: <model>` or `- <role>: <model>, <effort>`
- `<role>` is one of: explore, implement, implement-hard, fix, review,
  deep-review, consult.
- Roles not listed use the host default.
- Nothing else is interpreted: no tiers, no fallbacks, no runtime sections,
  no profile sections, no merging of files.

A leading `--profile NAME` option (or an unambiguous natural-language
equivalent) selects the file `preferences.NAME.md` instead, again project
first, then personal. `NAME` is 1-40 characters: a lowercase letter, then
lowercase letters, digits, or hyphens, with no trailing hyphen; `default`
and `inherit` are reserved. A missing selected file is a concise, actionable
error listing the files that exist at the checked locations — never a
silent fallback. The selected file is read once at activation and stays
fixed; the selection stays in session state for the activation.

Application: where the active runtime binding exposes per-spawn model/effort
fields, the role's assignment is passed at dispatch; where the host cannot
select a model per child, the assignment has no effect (say so when the
user asks for it). A profile never changes the session model, runtime,
credentials, or endpoints.

The same file may also carry the top-level `## Work` section documented in
the skill body (worker-round allowance); it is the only other supported
section.

Example `preferences.md`:

    - review: openai/gpt-6.1-sol, xhigh
    - deep-review: openai/gpt-6.1-sol, xhigh

    ## Work
    - worker rounds: 12
