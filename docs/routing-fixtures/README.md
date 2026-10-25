# Routing prompt fixtures

Reusable prompt fixtures for the workflow interpretation boundary (plan
section 10.2): they check that an orchestrator running the `work` or
`autonomous` skill interprets the `preferences.md` prose file (the legacy
`routing.md` name is still accepted at each scope), resolves the snapshot
for the active runtime, and records the expected effective selections with
source labels. They are evaluations, not claims of deterministic prose
parsing — the deterministic core (structured merge, resolution, export) is
covered by `scripts/test-routing.mjs`, and the installed workflow must never
need these files to run.

Fixtures 01–18 predate the `preferences.md` name and seed the legacy
`routing.md` filename; they exercise the same interpretation boundary, and
the legacy name is still accepted. Fixtures 19–23 cover the new name:
per-scope effective files, the both-filenames rule, the `## Work`
worker-round allowance, and the unreadable-effective-file error.

Placement: the installed workflow needs only the packaged contract, defaults,
Markdown example, and shared module (see `ROUTING.md`), so these fixtures live
under `docs/` and are not shipped in the skill tree or counted in the
source-of-truth inventory.

The profile fixtures (11–15) exercise the same interpretation boundary with
named routing profiles: the workflow interprets the `## Profile:` sections and
selects one profile per activation. They are evaluations, not claims of
deterministic prose parsing and not live runtime verification.

## How to use

1. Seed an isolated temporary home and project root (or subdirectory) with the
   fixture's preference files exactly as given. Never seed the real user home
   or a real repository.
2. Start the workflow on the fixture's host/runtime (the fixtures use `codex`
   as the active runtime unless stated otherwise) with the recorded
   invocation, and observe the bootstrap.
3. Compare the activation's recorded routing summary — the compact fields in
   `skills/work/references/rounds.md` (role, selection, requested
   model/effort, provenance, fallback attempted, effective settings or the
   reason they are unknown) — against the fixture's expected table.

Model names are illustrative (as in `preferences.example.md`). "Installed
baseline" below means the packaged codex baseline: fast
`gpt-6-luna|medium`, routine `gpt-6-luna|high`, standard
`gpt-6.1-sol|high`, deep `gpt-6.1-sol|xhigh`, with role-to-tier mapping
explore to `fast`, implement/fix to `routine`, implement-hard/review to
`standard`, and deep-review/consult to `deep`.

| Fixture | Scenario |
| --- | --- |
| `01-recommended-tables.md` | Recommended table plus role overrides |
| `02-equivalent-prose.md` | The same selections expressed in prose |
| `03-omitted-sections.md` | Sparse files with omitted sections |
| `04-inactive-runtime-sections.md` | Multi-runtime file with the active section absent |
| `05-subdirectory-invocation.md` | Git project invoked from a subdirectory |
| `06-nongit-workspace-scope.md` | Non-Git workspace with, and without, an established root |
| `07-unreadable-source.md` | An existing preference file that cannot be read |
| `08-ambiguity.md` | An ambiguous final selection blocks only its dispatch |
| `09-override-repairs-ambiguous-lower-entry.md` | A clear higher layer supersedes an ambiguous lower entry |
| `10-negative-budget-permissions.md` | Routing prose cannot change budgets or permissions |
| `11-profile-selection.md` | A partial profile changes only its tiers; unknown or conflicting selectors are reported |
| `12-profile-across-files.md` | Project default beats personal profile; same-name profiles merge across files |
| `13-profile-exceptions.md` | A direct role exception survives profile tier changes unless explicitly cleared |
| `14-profile-inactive-and-invalid.md` | Invalid or other-runtime profiles never block an otherwise valid selection |
| `15-opencode-named-sets.md` | OpenCode named sets: stale or missing routes are reported, never substituted by the default set |
| `16-default-startup-short-path.md` | No preference files: one mechanical `startup` call finalizes the installed choices, quietly, creating nothing |
| `17-startup-errors.md` | Startup-path errors: an unreadable preference file fails the probe itself; an invocation-selected profile with no files is reported once by the final resolution, the startup's unknown-profile result being provisional |
| `18-unavailable-agent-roles.md` | An unavailable OpenCode role blocks only its own dispatch; invocation overrides compare against the final snapshot, not the startup's baseline `agents` entries; a profile defined by the invocation Markdown itself is valid, the startup's unknown-profile result being provisional |
| `19-preferences-effective-file.md` | Each scope resolves on its own effective file: the new name alone (with a `## Work` section effecting the Work allowance), the new name at one scope, and the two mixed-name cases across scopes |
| `20-preferences-both-at-one-scope.md` | Both filenames at one scope: `preferences.md` is the effective file and `routing.md` is identified, ignored, and never merged (even a conflicting `## Work` value); an unreadable ignored file is not an error |
| `21-preferences-precedence-and-work-allowance.md` | Project beats personal for routing entries AND for the `## Work` allowance (effective value plus source recorded); an omitted entry retains the lower-precedence value; an explicit task-time instruction at invocation outranks all files |
| `22-preferences-invalid-work-allowance.md` | `worker rounds` of `0`, `2.5`, or `eight`: an actionable error naming the file and the value, reported before dispatch; never defaulted to eight, never clamped, no silent continuation |
| `23-preferences-unreadable-preferred.md` | An unreadable `preferences.md` beside a readable legacy `routing.md`: the error is reported and the readable legacy file is never a fallback (startup probe path; the interpretation path inherits the rule) |
