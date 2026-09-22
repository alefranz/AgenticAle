# Contributing

This project is an experimental multi-client agent workflow bundle. Small,
focused changes with clear verification are easiest to review.

## Before a change

- Read `AGENTS.md` when present, `docs/architecture.md`, and the relevant
  bundle files.
- Keep the authored OpenCode surface to the documented eleven files unless a
  release decision intentionally changes that contract. Copilot artifacts are
  generated from those sources and must not be edited or committed from
  `dist/`.
- Keep provider, model, machine, account, and project assumptions out of the
  installable bundle.
- Update the README or architecture documentation when behavior or setup
  changes.

## Verify

Use Node.js 20 or later and run:

```sh
node scripts/validate.mjs
node scripts/test-installer.mjs
node scripts/test-build.mjs
git diff --check
```

Installer tests use temporary directories and must not target a real OpenCode
profile. For a manual release check, follow `docs/smoke-test.md`.

Please describe the problem, the chosen behavior, and the verification in a
pull request. Do not include credentials, private endpoints, generated build
output, or personal OpenCode configuration.
