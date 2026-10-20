# Fixture 17 — Startup errors (unreadable file, unknown profile without files)

Two small error scenarios in the default startup path: `startup` checks the
documented preference locations without reading their contents, an unreadable
file is an error at the probe itself (case A), and an invocation-selected
profile with no preference files is validated only by the final resolution
(case B). Both are reported once, actionably, before dispatch. Active runtime
is `opencode`.

## Setup — case A: personal preference file exists but cannot be read

`~/.agenticale/routing.md` exists but cannot be read (mode `000`, a directory
at the path, or any other read failure; its intended content is not
knowable). No `<repo>/.agenticale/routing.md`. Recorded invocation:
`/work <task>` (no selector).

## Expected behavior — case A

- `startup` fails (non-zero exit) with the actionable unreadable-preference
  file error, and the workflow reports it exactly once, before any child is
  dispatched: the personal routing.md file exists but cannot be read, `startup`
  never creates or modifies preference files, and the user can make the file
  readable (or remove it) and retry.
- The report distinguishes this from absence: it must not say "no personal
  routing file was found", must not claim the installed defaults were
  intentionally chosen, and must not treat the unreadable file as absent.
- No configuration is created or suggested, no clarification is asked, and no
  repeated attempts are made: the bootstrap does not create, overwrite, or
  modify the file, does not fall back to a different location, and no dispatch
  happens as if defaults had been chosen — the activation does not finalize.
- Contrast with fixture 07, which is the interpretation context: there the
  workflow has a file to read and interpret and reports the unreadable source
  alongside the entries it could not resolve. Here the failure is at the
  startup probe itself — the file is checked for existence and readability
  without its content being read, and the actionable error stands on its own.

## Setup — case B: `--profile server-b` with no preference files anywhere

No `~/.agenticale/routing.md`, no `<repo>/.agenticale/routing.md`. Recorded
invocation: `/work --profile server-b <task>`.

## Expected behavior — case B

- A profile selected at invocation is an invocation-level preference, so
  `startup` serves only as the file-existence probe and none of its results
  is final: if the workflow passes `--profile server-b` to `startup`, the
  unknown-profile failure (non-zero exit) is provisional and is not reported
  (without the selector, `startup` prints the baseline `resolved` result,
  which is likewise not final).
- The final resolution — `resolve --runtime opencode --profile server-b
  --explain`, with no `--input` because no files were discovered and no
  override layers exist — fails with the actionable unknown-profile
  explanation, reported exactly once before dispatch: no routing profiles
  are defined for this runtime; add a `## Profile: server-b` section to a
  routing.md preference file, or omit the profile selector.
- No silent default substitution: the activation does not dispatch under
  ordinary routing just because no files exist, and no profile is invented.
- No retry with a different profile, no preference file created, and no
  clarification question — the error already names the two ways out.
