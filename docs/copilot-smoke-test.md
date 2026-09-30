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

- the CLI version resolves `gpt-6-luna` and `gpt-6-sol` in `copilot help config`
  or the `/model` picker;
- installation succeeds without a model request;
- `copilot plugin list --json` contains an enabled `agenticale` entry;
- a new CLI session exposes **AgenticAle** and **AgenticAle Autonomous** through
  `/agent` (CLI IDs `agenticale:agenticale` and
  `agenticale:agenticale-autonomous`), the seven shared worker agents,
  `/agenticale:work` and `/agenticale:autonomous`, and four skills;
- `work-mode` and `autonomous-mode` are visible in `/skills list` but do not
  appear as slash commands in the autocomplete menu;
- VS Code discovers the same plugin under Agent Plugins after it is installed
  in the real Copilot home and the Copilot session is restarted.

In VS Code, record the client version and the work command's autocomplete
label. It may display `/agenticale work` even though the CLI uses
`/agenticale:work`. Select the autocomplete entry and confirm that the work
prompt is loaded with the supplied task arguments. Separately check manually
typing `/agenticale:work`, which has also been observed to work in VS Code.
Successful execution alone is insufficient: confirm command expansion so a
plain-text request is not mistaken for a recognized slash command.

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

Do this only when a real model call is warranted. Build an all-GPT-6-Luna custom
mapping, use `low` effort, set Copilot's minimum 30-credit response ceiling,
select the coordinator with `--agent` or `/agent`, and give it a tiny read-only
goal in a throwaway repository. Do not substitute Sol if Luna is unavailable.
Confirm one child dispatch and a valid report, then stop; quality benchmarking
is separate from plugin discovery.

For workflow acceptance, use the everyday and autonomous scenarios in the
[OpenCode checklist](smoke-test.md) with the matching Copilot coordinator.
In particular, check that `/agenticale:work --pr` passes its option to the
already-selected everyday agent and that normal PR-feedback requests leave
changes uncommitted. Live PR creation needs a disposable authorized remote.

Check tool logs for skill loading, not just an agent's claim that it used one:

- In a `/agenticale:work --pr` run, confirm that `pull-request-description` is
  loaded by ID or its full `SKILL.md` is read before the first PR body draft.
  Check that the body follows its selective-validation guidance.
- In either mode, give a task whose answer requires a dependency or related
  service's source, with a local fixture checkout available. Confirm that the
  investigating child receives the loading rule and reads `source-code-lookup`
  before the lookup, then returns source location/revision evidence under the
  selected state policy.
- A task needing only navigation in the current repository should not trigger
  source lookup. A task without PR text should not need the PR-description skill.

Static package checks verify packaging; these log checks establish whether
the client and model actually follow the loading instructions.
