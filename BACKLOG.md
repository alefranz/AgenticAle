# Skill Simplification Backlog

Temporary tracking file on `refactor/simplify-skills`. Delete in Step 4 before opening/merging the final PR.

Goal: reduce eager context footprint, eliminate cross-file duplication and over-steering, move cold-path rules into on-demand references, and simplify budget/stop mechanics.

## Baseline (main)

- Total `skills/`: 411,890 bytes (6,466 lines)
- `pull-request-description/SKILL.md`: 1,642 bytes (31 lines)
- `source-code-lookup/SKILL.md`: 3,315 bytes (20 lines)
- `review/SKILL.md`: 8,816 bytes (161 lines) + 46,076 bytes eager `rounds.md`
- `configure/SKILL.md`: 15,533 bytes (278 lines) + 26,391 bytes across 6 discovery refs
- `work/SKILL.md`: 39,725 bytes (629 lines) + 46,076 bytes `rounds.md` + 11,129 bytes `outcome-evaluation.md` + 4,890 bytes `rounds-examples.md` + 16,880 bytes tasks + 54,675 bytes runtimes
- `autonomous/SKILL.md`: 46,026 bytes (636 lines) + 135,941 bytes across 11 refs

## Steps

### Step 1 — Four non-work/non-autonomous skills (`done`)
- [x] `skills/pull-request-description/SKILL.md`: 1,642 B (31 L) → 1,522 B (19 L)
- [x] `skills/source-code-lookup/SKILL.md`: 3,315 B (20 L) → 2,933 B (20 L)
- [x] `skills/review/SKILL.md`: 8,816 B (161 L) → 5,348 B (55 L), and decoupled from eager `work/references/rounds.md` (46,076 B saved on startup)
- [x] `skills/configure/SKILL.md`: 15,533 B (278 L) → 7,483 B (71 L)
- [x] `skills/configure/references/discovery/*.md`: 26,391 B (517 L) → 13,726 B (204 L) across all 6 host files
- [x] Updated `scripts/validate.mjs` and `scripts/test-models.mjs` for standalone `review` decoupling
- [x] Verified with `node scripts/validate.mjs`, `node scripts/test-models.mjs` (469 assertions), and `git diff --check`

### Step 2 — `work` + shared `rounds.md` / `tasks/` / `runtimes/` + budget/stop rework (`pending`)
- [ ] Split `work/references/rounds.md` into lean hot path + conditional references
- [ ] Simplify budget/stop rules (remove `cap`/`progress` grant-flavour parser and unnecessary ceremony)
- [ ] Deduplicate `work/SKILL.md`, move cold paths (`--pr`, non-convergence, decomposition) to conditional references
- [ ] Review `work/references/tasks/*.md` and `work/references/runtimes/*.md` for redundancies

### Step 3 — `autonomous` + its references (`pending`)
- [ ] Restructure `autonomous/SKILL.md` into a lean happy-path coordinator loop
- [ ] Convert `autonomous/references/*` into true cold-path on-demand references
- [ ] Fold non-obvious `anti-patterns.md` traps into positive rules and drop `anti-patterns.md`
- [ ] Simplify gate/persistence/stop rules and legacy migration ceremony

### Step 4 — Convergence & PR (`pending`)
- [ ] Update affected public and repository docs (`npm run docs:check`)
- [ ] Finalize `scripts/validate.mjs` and test scripts
- [ ] Bump `pluginManifest.version` in `scripts/build.mjs` and run `node scripts/publish-default-plugin.mjs`
- [ ] Run full CONTRIBUTING verification and `node scripts/check-plugin-version.mjs --base main`
- [ ] Delete `BACKLOG.md` before final merge/PR
