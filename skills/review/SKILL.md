---
name: review
description: "Independently review the current branch's net changes from the local merge base to the current working-tree result — the committed branch review on a clean tree — with one fresh reviewer, returning findings to the user. Explicit-only: invoke with /review (optionally /review --deep and /review --profile NAME); the model does not start this workflow on its own."
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

- Leading options, in any order: an optional `--deep` option selects the
  deep-review contract for the review round; an optional `--profile NAME` or
  `--profile=NAME` option selects a routing profile. `--` is an explicit
  option delimiter; option parsing stops at the first non-option token, and
  everything after the options is the review context: a focus, acceptance
  criteria, an explicit scope (for example "only my uncommitted changes"), or
  a named local base. There is no base or scope flag; a base or scope is
  always named in the remaining text.
- With no arguments at all, use the local default base and no extra criteria.
- A missing profile name (a trailing `--profile`, or one followed by another
  option), or two different profile names, is reported before dispatch, listing
  the profile names available for the active runtime.
- An unambiguous natural-language instruction (for example, "use the
  server-b routing profile") selects the profile; merely mentioning a profile
  does not.
- No selector, or `--profile default`, uses the ordinary default routing
  (installed baseline, personal preferences, project preferences). The
  selection stays in session state for the activation: a fresh `/review`
  invocation without a selector returns to default.
- A profile controls the reviewer's routing only: it never changes the
  session's model, the runtime, or credentials or endpoints.

## Comparison scope

The default comparison is the merge base of the current branch and the
resolved base to the current working-tree result, including relevant untracked
files. A dirty tree never narrows the review to uncommitted changes alone;
that would omit the branch's own commits. An explicit natural-language scope
in the review context (for example "only my uncommitted changes") selects the
local changes relative to `HEAD` instead; there is no scope flag. Existing
base selection, focus, `--deep`, and routing-profile behavior are preserved,
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

## Resolve routing before dispatch

Run the shared routing bootstrap described in
[the routing contract](../work/references/ROUTING.md) — the same bootstrap the
work skill uses — once per activation, at start, from the loaded
installation's resources relative to this SKILL.md (never the AgenticAle
repository checkout):

1. Select the actual runtime from the host's tool surface — never from a
   selected model name — and its binding under `../work/references/runtimes/`.
2. Establish the Git worktree root, or the explicitly established workspace
   root for a non-Git project. When no root is established, omit `--root`;
   only the personal preference location is checked.
3. Run the default path — one mechanical call from the installed skill:

   ```sh
   node ../work/scripts/routing.mjs startup --runtime <runtime> --root <root> [--profile NAME]
   ```

   with `--profile NAME` when a routing profile is selected and the
   activation carries no invocation-level preferences. For this skill, a
   profile selected at invocation is an invocation-level preference: on that
   path `startup` serves only as the file-existence probe — its policy and
   its profile check are not final — and if `--profile` is passed, its
   unknown-profile result is provisional and is not reported. Act on the
   result through the routing contract's documented paths:
   - Profile selected at invocation (invocation-preference path): `startup`
     accepts no invocation layers, so none of its results is final.
     Interpret the discovered files (if any) and the selected profile into
     the ordered structured layers, lowest to highest precedence per the
     routing contract, write them to a temporary file, and resolve them:

     ```sh
     node ../work/scripts/routing.mjs resolve --runtime <runtime> --input <layers-file> --profile NAME --explain
     ```

     Profile availability is validated only by this final resolution: its
     unknown-profile error lists the names available for the active runtime
     and is the one that gets reported, before dispatch. Its `--explain`
     output — `policy`, `routeProvenance`, and `profile` — is the snapshot.
   - `resolved` (no invocation-level preferences): the output IS the routing
     snapshot. Store `policy`, `routeProvenance`, `profile`, and (on
     OpenCode) the `agents` entries in session state; no further reference
     reading is required to resolve or compare routes.
   - `interpretation-required`: a documented preference file is present.
     Read the listed `presentFiles`, interpret them per the routing contract
     (the helper never parses Markdown), write the structured layers to a
     temporary file, and resolve them:

     ```sh
     node ../work/scripts/routing.mjs resolve --runtime <runtime> --input <layers-file> --explain
     ```

     The `--explain` output — `policy`, `routeProvenance`, and `profile` — is
     the snapshot.
   - Non-zero exit (unreadable preference file, unknown or invalid profile):
     report the actionable error once. An unreadable preference file is a
     genuine error on every path. An unknown or invalid profile error is
     final only on the paths where `startup`'s results are final — on the
     invocation-preference path the final
     `resolve --input <layers-file> --profile NAME --explain` is the one that
     validates and reports profile availability. A removed or unavailable
     selected profile blocks the dispatch instead of falling back silently.
4. Check the capability before dispatch: on OpenCode compare the reviewer's
   route with the installed profile the binding names — the `agents` entries of
   the `resolved` output, or the in-context comparison the contract documents
   otherwise — and dispatch the role only when it matches; a missing,
   mismatched, or unreadable profile blocks only that dispatch, reported with
   the binding's preparation and refresh procedure. On other runtimes, compare
   the selection with the binding's native dispatch fields as the binding says.
5. Where Node is unavailable, apply the routing contract in context as its
   documented fallback: check the two documented preference locations, read
   and interpret the present files, and resolve the routes keeping each route's
   source. Where the host cannot dispatch a child subagent at all, do not
   invent a route or a dispatch: report the limitation honestly and state what
   the review can and cannot provide.
6. Keep the snapshot fixed for the activation; the bootstrap is read-only and
   creates no routing file. Start quietly: surface routing information only
   when it explains a selected profile, a limitation, or a required user
   action.

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
- State stays in the session: the base, the recorded comparison, the routing
  record, and the report are retained in session context. No handoff, backlog,
  archive, round ledger, or other operational file is created.
- Make no product-code changes and no Git changes of any kind: no commits, no
  pushes, no stashing, no remote fetch, no branch or remote changes; the
  pre-report recheck is read-only.
