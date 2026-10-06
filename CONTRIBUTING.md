# Contributing

This project is an experimental multi-client agent workflow bundle. Small,
focused changes with clear verification are easiest to review.

## Before a change

- Read `AGENTS.md` when present, `docs/architecture.md`, and the relevant skill
  files.
- Keep the authored source of truth under the skills-first layout. The two
  workflow skills are `skills/work` and `skills/autonomous`; the two supporting
  skills are `skills/pull-request-description` and
  `skills/source-code-lookup`. The OpenCode adapter lives under
  `adapters/opencode`, and the routing contract is
  `skills/work/references/ROUTING.md`, with the version-2 defaults baseline at
  `skills/work/references/routing.json`, the customization example at
  `skills/work/references/routing.example.json`, and the shared module at
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

Use Node.js 20 or later and run, in this order:

```sh
node scripts/validate.mjs
node scripts/test-routing.mjs
node scripts/test-installer.mjs
node scripts/test-build.mjs
node scripts/publish-default-plugin.mjs --check
git diff --check
```

- `validate.mjs` checks the authored source of truth: 25 source-of-truth files
  (including the routing contract, the version-2 `routing.json` baseline, the
  `routing.example.json` patch, and the shared `routing.mjs` module), 6
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
- `git diff --check` catches whitespace errors in the LF markdown files.

Installer tests use temporary directories and must not target a real OpenCode
profile. For a manual release check, follow `docs/smoke-test.md` (OpenCode) and
`docs/copilot-smoke-test.md` (Copilot); workflow-interpretation evaluation
fixtures for the routing customization boundary live in
Live model-routing and workflow checks are recorded in
`docs/runtime-compatibility.md`.

Please describe the problem, the chosen behavior, and the verification in a
pull request. Do not include credentials, private endpoints, generated build
output, or personal client configuration.
