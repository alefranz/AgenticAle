# GitHub Copilot plugin smoke test

The normal automated checks do not make model requests. Use this checklist to
verify plugin discovery with an isolated Copilot home before a release.

## Static and isolated discovery checks

```powershell
node scripts/build.mjs
node scripts/test-build.mjs
node scripts/publish-default-plugin.mjs --check

$smokeRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("agenticale-copilot-smoke-" + [guid]::NewGuid())
$env:COPILOT_HOME = $smokeRoot
copilot --version
copilot plugin install ./dist/copilot/agenticale
copilot plugin list --json
copilot plugin uninstall agenticale
Remove-Item Env:COPILOT_HOME
Remove-Item -LiteralPath $smokeRoot -Recurse -Force
```

Expected observations:

- the CLI version exposes `gpt-5.6-luna`, `gpt-5.6-terra`, and
  `gpt-5.6-sol` in `copilot help config`;
- installation succeeds without a model request;
- `copilot plugin list --json` contains an enabled `agenticale` entry;
- a new CLI session exposes **AgenticAle Autonomous** through `/agent` (or
  `copilot --agent agenticale:agenticale-autonomous`), the seven worker agents,
  the `/agenticale:autonomous` command, and the three skills;
- VS Code discovers the same plugin under Agent Plugins after it is installed
  in the real Copilot home and the Copilot session is restarted.

Before publishing, also verify the repository marketplace from an isolated
Copilot home:

```powershell
$env:COPILOT_HOME = $smokeRoot
copilot plugin marketplace add .
copilot plugin marketplace browse agenticale --json
copilot plugin install agenticale@agenticale
copilot plugin list --json
copilot plugin uninstall agenticale
copilot plugin marketplace remove agenticale
```

## Optional paid end-to-end check

Do this only when a real model call is warranted. Build an all-Luna custom
mapping, use `low` effort, set Copilot's minimum 30-credit response ceiling,
select the coordinator with `--agent` or `/agent`, and give it a tiny read-only
goal in a throwaway repository. Do not substitute Terra or Sol if Luna is
unavailable. Confirm one child dispatch and a valid report, then stop; quality
benchmarking is separate from plugin discovery.
