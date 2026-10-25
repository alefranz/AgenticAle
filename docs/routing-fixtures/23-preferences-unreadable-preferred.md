# Fixture 23 — Unreadable `preferences.md` is an error; the readable legacy file is not a fallback

When `preferences.md` exists but cannot be read, and a legacy `routing.md`
at the same scope IS readable, the unreadable effective file is an error on
every path: the readable legacy file is never used as a fallback, never
merged, and never interpreted in its place. Case A is the startup probe at
personal scope; case B is project scope, and the interpretation path
inherits the same rule. Active runtime is `opencode`.

## Setup — case A: unreadable personal `preferences.md`, readable personal `routing.md`

`~/.agenticale/preferences.md` exists but cannot be read (mode `000`, a
directory at the path, or any other read failure; its intended content is
not knowable). `~/.agenticale/routing.md` exists and is readable:

```markdown
## opencode

### Tiers

| Tier | Model | Reasoning effort |
| --- | --- | --- |
| fast | server-a/small-coder | medium |
```

No `<repo>/.agenticale/` file under either name. Recorded invocation:
`/work <task>` (no selector).

## Expected behavior — case A

- `startup` fails (non-zero exit) with the actionable unreadable-preference
  file error naming the effective file, and the workflow reports it exactly
  once, before any child is dispatched: the personal preferences.md file
  exists but cannot be read, `startup` never creates or modifies preference
  files, and the user can make the file readable (or remove it) and retry.
- The readable legacy file is not a fallback: its `fast` tier never enters
  the snapshot, the legacy file is not read or interpreted, and no dispatch
  happens as if `routing.md` were the effective file. The probe checks
  existence and readability without reading content, and the effective file
  (a present `preferences.md`) is identified before any file is read, so the
  readable sibling cannot substitute for it.
- The report distinguishes this from absence and from the inverse situation:
  it must not say "no personal preference file was found". Contrast with
  fixture 17 case A (the unreadable file is the legacy name, the only file
  at the scope — the same error) and fixture 20 case C (the unreadable file
  is the ignored one — NOT an error): the unreadable-file error applies only
  when the unreadable file is the effective file at its scope.
- No configuration is created or suggested, no retry with a different
  location, and no dispatch: the activation does not finalize.

## Setup — case B: the same situation at project scope

`<repo>/.agenticale/preferences.md` exists but cannot be read (the same
read-failure shapes). `<repo>/.agenticale/routing.md` exists and is
readable (the same content shape as case A's legacy file). No personal
preference file under either name. Recorded invocation: `/work <task>`.

## Expected behavior — case B

- The same error at the project location: the probe is `startup
  --runtime <runtime> --root <root>`, the error names the project
  preferences.md path, and the readable project `routing.md` is not a
  fallback for the same reasons as case A.
- The interpretation path inherits the same rule: even on a path where the
  probe passed (the file was readable when checked) but the later read of
  the effective file fails, the workflow reports the unreadable effective
  file and never interprets the readable legacy file in its place.
