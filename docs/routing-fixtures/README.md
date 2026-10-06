# Routing prompt fixtures

Reusable prompt fixtures for the workflow interpretation boundary (plan
section 10.2): they check that an orchestrator running the `work` or
`autonomous` skill interprets a `routing.md` prose file, resolves the
snapshot for the active runtime, and records the expected effective
selections with source labels. They are evaluations, not claims of
deterministic prose parsing — the deterministic core (structured merge,
resolution, export) is covered by `scripts/test-routing.mjs`, and the
installed workflow must never need these files to run.

Placement: the installed workflow needs only the packaged contract, defaults,
resolved snapshot, example, and shared module (see `ROUTING.md`, Packaged
resources), so these fixtures live under `docs/` and are not shipped in the
skill tree or counted in the source-of-truth inventory.

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

Model names are illustrative (as in `routing.example.md`). "Installed
baseline" below means the packaged Codex baseline: `gpt-6-luna|medium` for
exploration, `gpt-6-luna|high` for routine implementation and fixes,
`gpt-6.1-sol|high` for hard implementation and review, and
`gpt-6.1-sol|xhigh` for deep review and consultation.

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
