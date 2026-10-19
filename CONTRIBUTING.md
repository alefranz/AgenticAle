# Contributing

This project is an experimental multi-client agent workflow bundle. Small,
focused changes with clear verification are easiest to review.

## Before a change

- Follow [AGENTS.md](AGENTS.md) for focused core development and the explicit
  core-only scope. Read the relevant skill source and architecture sections;
  defer packaging and cross-client convergence when requested.
- Keep the authored source of truth under the skills-first layout. The two
  workflow skills are `skills/work` and `skills/autonomous`; the two supporting
  skills are `skills/pull-request-description` and
  `skills/source-code-lookup`. The OpenCode adapter lives under
  `adapters/opencode`, and the routing contract is
  `skills/work/references/ROUTING.md`, with the version-2 defaults baseline at
  `skills/work/references/routing.json`, the Markdown customization example at
  `skills/work/references/routing.example.md`, and the shared module at
  `skills/work/scripts/routing.mjs`. Do not add retired-layout paths
  (`commands/`, `agents/autonomous/`, `skills/work-mode`,
  `skills/autonomous-mode`) at the repository root. The adapter-owned OpenCode
  command templates under `adapters/opencode/commands/` are part of the
  generated OpenCode binding, not the retired layout.
- Do not edit the generated plugin or catalog files under `plugins/agenticale/`,
  `.github/plugin/marketplace.json`, or `.agents/plugins/marketplace.json` by
  hand; regenerate them with `node scripts/publish-default-plugin.mjs`.
  Disposable `dist/` output remains uncommitted.
- Keep provider, model, machine, account, and project assumptions out of the
  installable bundle. The packaged routing baseline is an inventory, not a
  verified account mapping.
- Update the README, setup, or architecture documentation when behavior or
  setup changes. Record live runtime results in `docs/runtime-compatibility.md`;
  do not mark a capability verified without a live pass.

## Verify

Use Node.js 20 or later for repository scripts. The documentation site requires
Node.js 24 or later. For an explicitly core-only task, use the scoped checks
and convergence handoff in [AGENTS.md](AGENTS.md#core-only-work-and-later-convergence).
For integrated changes and release readiness, run the full sequence in this order:

```sh
node scripts/validate.mjs
node scripts/test-routing.mjs
node scripts/test-installer.mjs
node scripts/test-build.mjs
node scripts/test-plugin-version.mjs
node scripts/test-release-plugin.mjs
node scripts/publish-default-plugin.mjs --check
node scripts/check-plugin-version.mjs --base public/main
git diff --check
```

- `validate.mjs` checks the authored source of truth: 26 source-of-truth files
  (including the routing contract, the version-2 `routing.json` baseline, the
  `routing.example.md` example, and the shared `routing.mjs` module), 6
  capability-neutral task contracts, 7 OpenCode adapter profiles, 2 OpenCode
  command templates, the absence of the retired layout, and sanitation.
- `test-routing.mjs` covers the shared routing module: version
  1/2 validation, preference merging, resolution, normalization, and the resolve
  CLI.
- `test-installer.mjs` covers the OpenCode and standalone
  installers, including old copy and link state migration and user-owned
  routing-file preservation, in isolated temporary directories.
- `test-build.mjs` covers the three build output roots, routing
  serialization, argument behavior, and artifact drift.
- `publish-default-plugin.mjs --check` verifies the committed plugin and both
  catalogs are current.
- `check-plugin-version.mjs` compares the final distributed plugin and both
  catalogs with the target branch, ignoring only their version fields. Changed
  content requires a greater version; invalid versions and downgrades fail too.
  Use your target branch ref instead of `public/main` when it differs.
- `test-plugin-version.mjs` and `test-release-plugin.mjs` exercise version
  enforcement and release safety with isolated Git fixtures and mocked GitHub
  responses. They do not publish releases or change repository settings.
- `git diff --check` catches whitespace errors in the LF markdown files.

Installer tests use temporary directories and must not target a real OpenCode
profile. For a manual release check, follow `docs/smoke-test.md` (OpenCode) and
`docs/copilot-smoke-test.md` (Copilot). Workflow-interpretation evaluation
fixtures for the routing customization boundary live in
[`docs/routing-fixtures`](docs/routing-fixtures/README.md). Live model-routing
and workflow checks are recorded in [docs/runtime-compatibility.md](docs/runtime-compatibility.md).

Please describe the problem, the chosen behavior, and the verification in a
pull request. Do not include credentials, private endpoints, generated build
output, or personal client configuration.

## Versions and GitHub releases

For a PR that changes the distributed plugin or marketplace metadata, bump
`pluginManifest.version` in `scripts/build.mjs` and run
`node scripts/publish-default-plugin.mjs`. Commit the generated plugin manifest
and both catalogs in the same PR. Use stable `MAJOR.MINOR.PATCH` versions: patch
for fixes, minor for new capabilities, major for breaking changes (minor for
breaking changes before 1.0). Documentation-only PRs need no bump. Core-only
tasks defer versioning to convergence, as described in AGENTS.md.

CI checks the PR's final package against its target branch, including after
review corrections at the same bumped version. Merge groups use their target
branch too; only pushes to `main` compare against the previous push. Feature
branch pushes still run the platform checks but skip the version gate.

In GitHub Settings → Rules → Rulesets, configure the rule for `main` to require
`Plugin version`
and all three `Node 24 / <os>` checks, with branches up to date before merging
(or use a merge queue). This repository includes merge-group checks. These
repository settings are separate from workflow files: merely adding a job does
not prevent merging a failing PR. Recheck the bump after updating the branch;
two PRs must not publish different plugin contents with the same version.

On a push to `main` in `alefranz/AgenticAle`, the release job waits for all CI
checks. If the version increased, it creates `vX.Y.Z` and a GitHub release with
generated notes at the exact tested commit. Only this job has `contents: write`;
it uses the built-in `GITHUB_TOKEN`, with no additional secret. Documentation
pushes and pushes in forks do not publish releases. The package and catalogs
are already committed before tagging; GitHub releases do not update them.

If publishing fails, rerun the failed job in the original CI run. A matching
existing tag and published release are safe to rerun. A tag pointing elsewhere
or an existing draft/prerelease causes a failure for investigation; automation
never moves tags or overwrites releases. Check repository Actions permissions
if GitHub denies creation. Automated release publishing still needs a live
post-merge pass; source tests use mocked API responses.
