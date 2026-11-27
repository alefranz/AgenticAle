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

### Step 2 — `work` + shared `rounds.md` / `tasks/` / `runtimes/` + budget/stop rework (`done`)
- [x] `skills/work/references/rounds.md`: 46,076 B (750 L) → 11,136 B (85 L) (−76%); replaced 12→24 dual-threshold + `cap`/`progress` grant flavours + 3-round stop with a single 24-round allowance, explicit continuation of productive fix loops, and real non-convergence stops (stall, oscillation, 4+ review style drift after green checks, repeated root-cause failure)
- [x] Conditional references: created `pr-delivery.md` (3,106 B, 32 L) and `decomposition.md` (3,973 B, 35 L, replacing 4,890 B `rounds-examples.md`); trimmed `outcome-evaluation.md` from 11,129 B (195 L) → 4,345 B (46 L) (−61%)
- [x] `skills/work/SKILL.md`: 39,725 B (629 L) → 9,892 B (74 L) (−75%)
- [x] `skills/work/references/tasks/*.md` (6 files): 16,880 B (340 L) → 9,765 B (157 L) (−42%)
- [x] `skills/work/references/runtimes/*.md` (6 files): 54,675 B (967 L) → 16,194 B (165 L) (−70%)
- [x] Total `skills/work/`: 173,375 B (2,722 L) → 58,411 B (594 L) (−66%); hot-path startup load dropped from ~90–105 KiB → ~23–26 KiB
- [x] Updated `configure/SKILL.md` default note (24 worker rounds), temporary `autonomous/` anchors, `scripts/validate.mjs`, and `scripts/test-models.mjs`
- [x] Verified with `node scripts/validate.mjs`, `node scripts/test-models.mjs` (458 assertions), and `git diff --check`

### Step 3 — `autonomous` + its references (`done`)
- [x] Added backward-compatibility policy to `AGENTS.md`
- [x] `skills/autonomous/SKILL.md`: 46,026 B (636 L) → 11,014 B (78 L) (−76%); lean happy-path loop with on-demand reference loads
- [x] `skills/autonomous/references/*`: 135,941 B (1,916 L across 11 files) → 11,612 B (100 L across 3 cold-path files: `escalation.md` 3,621 B, `persistence.md` 4,605 B, `recovery.md` 3,386 B) (−91%)
- [x] Removed 9 superseded/redundant files (`anti-patterns.md`, `budgets.md`, `consultation.md`, `dispatch.md`, `gates.md`, `prompts.md`, `state-protocol.md`, `steering.md`, `stops.md`) and legacy handoff migration prose
- [x] Total `skills/autonomous/`: 181,967 B (2,552 L) → 22,626 B (178 L) (−88%); typical happy-path startup dropped from ~200–235 KiB → ~24–27 KiB
- [x] Total `skills/` tree (all 6 skills + refs): **411,890 B (6,466 L) → 112,805 B (1,141 L) (−73%)**
- [x] Updated `scripts/validate.mjs` and `scripts/test-models.mjs`
- [x] Verified with `node scripts/validate.mjs`, `node scripts/test-models.mjs` (458 assertions), and `git diff --check`

### Step 4 — Convergence & PR (`pending`)
- [ ] Update affected public and repository docs (`npm run docs:check`)
- [ ] Finalize `scripts/validate.mjs` and test scripts
- [ ] Bump `pluginManifest.version` in `scripts/build.mjs` and run `node scripts/publish-default-plugin.mjs`
- [ ] Run full CONTRIBUTING verification and `node scripts/check-plugin-version.mjs --base main`
- [ ] Delete `BACKLOG.md` before final merge/PR
