# Fixture 07 — Unreadable source

A preference file that exists but cannot be read. Absence is normal, but an
existing unreadable file is not absence: it must be reported before dispatch
instead of silently behaving as if defaults were intentionally chosen. Active
runtime is `codex`.

## Setup

`~/.agenticale/routing.md` exists (mode `000` or otherwise unreadable). Its
intended content is not knowable:

```markdown
## codex

### Tiers

| Tier | Model | Reasoning effort |
| --- | --- | --- |
| standard | gpt-6-astra | high |
```

No `<repo>/.agenticale/routing.md`.

## Expected discovery

- The personal preference source is reported as an existing file that cannot
  be read, before any child is dispatched.
- The report distinguishes this from absence: it must not say "no personal
  routing file was found" and it must not claim the installed defaults were
  intentionally chosen.
- The workflow does not create, overwrite, or otherwise modify the file; a
  read-only startup leaves the filesystem untouched.

## Expected behavior

- The unreadable source is reported before dispatch, and no dispatch happens
  as if the installed defaults had been chosen: entries the personal layer
  could have overridden stay unresolved until the user restores read access
  or explicitly confirms a selection.
- The summary must not label the installed-baseline routes as
  "intentional"; their provenance is the installed baseline, with the
  inaccessible personal source reported alongside.
