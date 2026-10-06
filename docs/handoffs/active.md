# Active handoff: skills-first re-architecture

This handoff tracks the skills-first re-architecture described in
[skills-first-coding-plan.md](../skills-first-coding-plan.md). It is a durable
status note, not a changelog.

## Goal

Make AgenticAle a collection of portable, explicit-only coding skills with
explicit model routing, distributed through Agent Plugins 1.0. Center the
implementation on Copilot and Codex; generate OpenCode V2 agent profiles as a
compatibility adapter rather than authored source. The public workflows are
`work` and `autonomous`; the session invokes the skill and coordinates fresh
children. `source-code-lookup` and `pull-request-description` are the two
supporting skills. There are no authored coordinator profiles and no command
wrappers.

## Established (subtasks 1-9: complete)

- **Four authored skills** under `skills/`: `work`, `autonomous` (workflows) and
  `source-code-lookup`, `pull-request-description` (supporting). Workflows are
  explicit-only on every runtime (Copilot `disable-model-invocation: true`,
  OpenCode `autoinvoke: false`, OpenAI `allow_implicit_invocation: false`).
- **Routing defaults** at `skills/work/references/routing.json` (schemaVersion
  2): four shared tiers map the seven roles to per-runtime model/effort pairs.
  Optional project and personal overrides use interpreted `routing.md` files;
  generated bundles carry only the defaults baseline, with no expanded
  resolved snapshot.
- **Seven generated OpenCode profiles**: `consult`, `deep-review`, `explore`,
  `fix`, `implement`, `implement-hard`, `review`. `implement-hard` is a
  distinct profile (the `implement` contract at higher effort), not a reused
  alias. There is no `coordinator` profile.
- **One plugin + two catalogs**: `plugins/agenticale` (Agent Plugins 1.0,
  name `agenticale`, version `0.3.0`) plus `.github/plugin/marketplace.json`
  (Copilot, `strict: true`) and `.agents/plugins/marketplace.json` (OpenAI,
  per-plugin `policy: { installation: "INSTALLED_BY_DEFAULT",
  authentication: "ON_USE" }` — the documented skills-only values, validated by
  `publish-default-plugin.mjs`).
- **Three build output roots** under `--output X`: `plugin/agenticale` (22
  files), `standalone/.agents/skills` (21 files), `opencode` (30 files: seven
  profiles + four skills incl. `routing.json`). Build state at
  `X/.agenticale-build.json` (schemaVersion 2).
- **Three installers**: `install.mjs` (OpenCode, copy-only, state schema 6,
  migrates copy/link schemas 1-4 and six-profile schema 5),
  `install-copilot.mjs` (ends in `copilot plugin install`), and
  `install-standalone.mjs` (project/user scopes, state schema 1; user scope
  defaults to `~/.agents/skills`). Both copy installers emit a non-blocking
  notice when the target already carries the other layout's marker, and a
  same-schema update retires owned files the new inventory no longer carries.
  `publish-default-plugin.mjs` regenerates the plugin and both catalogs;
  `--check` verifies currency.
- The earlier skills-first implementation pass passed its validation and
  artifact checks. The current routing simplification and this documentation
  cleanup are generated through `publish-default-plugin.mjs`; automated
  routing, installer, build, validation, and publication checks pass.

## Review findings (R1-R15: addressed)

All fifteen findings from
[skills-first-implementation-review.md](../skills-first-implementation-review.md)
are addressed in this branch:

- **R1** — the invalid-YAML `description` (unquoted `Explicit-only: invoke`)
  is now double-quoted in the authored skills, and `validate.mjs` rejects the
  defect class for both authored and generated copies. A full YAML parser was
  not added: the repo is deliberately dependency-free, and the guard targets
  the exact R1 failure (an unquoted scalar containing `": "`).
- **R2** — the build materializes `work/references/routing.json` (explicit by
  default, `mode: "inherit"` under `--no-model`, caller values under
  `--routing`) in all three roots.
- **R4** — `implement-hard` is now a distinct generated profile (the `implement`
  contract rendered at higher effort) rather than a runtime alias; the adapter,
  build, installer, docs, and tests cascade accordingly.
- **R6 / R7 / R15** — the installer verifies link ownership before retiring a
  link, confines every write physically under the target root (refusing, and
  rolling back, if a managed path sits under a non-owned symlink), and
  recognizes/retires legacy install state.
- **R11 / R12** — both copy installers warn on a duplicate layout marker and
  retire owned files the current inventory no longer carries on a same-schema
  update.
- **R13** — the OpenAI marketplace entry carries `policy: { installation:
  "INSTALLED_BY_DEFAULT", authentication: "ON_USE" }` (the documented
  skills-only values) instead of the Copilot-only `strict: true`, and
  `publish-default-plugin.mjs` rejects undocumented values.

## Current state (subtask 10: documentation)

The skills-first implementation and its documentation pass are complete.
The routing follow-up keeps Markdown as the user preference format, retains
one packaged defaults baseline, restores the interpretation fixtures, and
removes the expanded snapshot. Resolver, installer, build, validation, and
publication checks pass; live client dispatch remains unverified.
`docs/skills-first-coding-plan.md` remains an unchanged planning record.

The follow-up branch review
([skills-first-branch-review.md](../skills-first-branch-review.md)) added two
safety regressions, both now fixed with focused fixtures:

- **F11** — a refused installer update no longer rolls back through a linked
  ancestor: both copy installers validate every planned mutation's existing
  ancestors before backing up or writing, roll back only paths actually mutated,
  and confine restoration too (an owned link a migration removes stays exempt).
  The populated-junction fixtures assert the external file's content, identity,
  and link count are unchanged and state bytes are preserved.
- **F12** — a missing `--output` is now resolved through its nearest existing
  ancestor physically, so a junction into a source directory is rejected instead
  of building into the source tree. The fixture runs a disposable copied build
  and asserts rejection with no new files in the source tree.

## Acceptance

- The docs describe the four skills, seven generated OpenCode profiles, three
  build roots, three installers, and explicit routing with no coordinator
  picker, command wrappers, or per-role authored profiles.
- `docs/runtime-compatibility.md` exists as the durable spike output and marks
  every live capability "not tested"; docs that reference live behavior point
  to it instead of asserting support.
- `git diff --check` is clean (LF markdown, no CRLF).

Framing that holds for every live-capability claim: no live runtime workflow was
exercised in this branch. Version inspection and doc research are not live
verification, so runtime acceptance of the seven-profile layout (discovery,
`/work` and `/autonomous` invocation, and a live run of `implement-hard`)
remains **pending manual testing**. Every capability in
`docs/runtime-compatibility.md` is recorded as **not tested**. The review's
minimum close-out also asks for a tiny live run plus independent review on the
primary runtime(s) claimed as working; that is the remaining gate before the
branch can be committed, and it is **not** part of this static change set.

## Next

1. Static close-out is complete: F11/F12 fixed with fixtures, all four
   verification commands green, `git diff --check` clean.
2. Remaining: the runtime acceptance spike on the primary runtime(s) (discovery,
   `/work` and `/autonomous` invocation, a live `implement-hard` run, and the
   actual dispatch fields plus requested/effective routing recorded in
   `docs/runtime-compatibility.md`) plus an independent review of that live
   evidence. Untested clients and the full desktop/cloud matrix stay explicit
   follow-up work. Then commit the branch.
