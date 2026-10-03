# GitHub Copilot plugin smoke test

The normal automated checks do not make model requests. Use this checklist to
verify plugin discovery with an isolated Copilot home before a release. The
package is the modern shared skills package: four skills and no custom
coordinator, no per-role agents, and no `commands/` entry. Skill invocation and
model routing are native to the Copilot host.

Discovery and routing checks below make no model request. Live workflow behavior
is **not tested** in this pass; record results per capability in
[runtime-compatibility.md](runtime-compatibility.md) and do not report them here
as verified.

## Static and isolated discovery checks

```powershell
node scripts/build.mjs
node scripts/test-build.mjs
node scripts/publish-default-plugin.mjs --check

$smokeRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("agenticale-copilot-smoke-" + [guid]::NewGuid())
$env:COPILOT_HOME = $smokeRoot
copilot --version
copilot plugin install ./dist/plugin/agenticale
copilot plugin list --json
copilot plugin uninstall agenticale
Remove-Item Env:COPILOT_HOME
Remove-Item -LiteralPath $smokeRoot -Recurse -Force
```

Expected observations:

- the build writes three output roots under `dist` (`plugin/agenticale`,
  `standalone/.agents/skills`, `opencode`) and `.agenticale-build.json`
  (schemaVersion 2);
- installation succeeds without a model request;
- `copilot plugin list --json` contains an enabled `agenticale` entry;
- a new CLI session exposes the four skills (`work`, `autonomous`,
  `source-code-lookup`, `pull-request-description`) in `/skills`, and the two
  public workflows as invocable skills with `/agenticale:work` and
  `/agenticale:autonomous`. There is no `AgenticAle` / `AgenticAle Autonomous`
  coordinator picker and no `/agent` selection step;
- the workflows do not appear in `/skills` as implicitly invokable entries; they
  are explicit-only.

In VS Code, record the client version and the work skill's autocomplete label.
It may display `/agenticale work` even though the CLI uses `/agenticale:work`.
Select the autocomplete entry and confirm the work prompt is loaded with the
supplied task arguments. Separately check manually typing `/agenticale:work`.
Successful execution alone is insufficient: confirm skill expansion so a
plain-text request is not mistaken for a recognized invocation.

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

## Optional live check (not tested)

A live model-routing check is a separate pass and is **not tested** in this
documentation-only migration. When provider credentials are available, use the
tiny fixture in [runtime-compatibility.md](runtime-compatibility.md): implement a
small change with one available model, review it with a different available
model, then run the override, unavailable-model, unsupported-effort,
inheritance, conflicting-defaults, and negative-activation variants. Record
requested versus effective settings per capability; a single successful dispatch
does not prove the effective model.

For workflow acceptance, use the everyday and autonomous scenarios in the
[OpenCode checklist](smoke-test.md) with the Copilot binding. In particular,
check that `/agenticale:work --pr` passes its option to the task and that
ordinary PR-feedback requests leave changes uncommitted. Live PR creation needs
a disposable authorized remote.

Check tool logs for skill loading, not just a claim that a skill was used:

- In a `/agenticale:work --pr` run, confirm that `pull-request-description` is
  loaded by ID or its full `SKILL.md` is read before the first PR body draft.
  Check that the body follows its selective-validation guidance.
- In either workflow, give a task whose answer requires a dependency or related
  service's source, with a local fixture checkout available. Confirm that the
  investigating child receives the loading rule and reads `source-code-lookup`
  before the lookup, then returns source location/revision evidence under the
  selected state policy. With the directly installed plugin, set `SOURCE_ROOT`
  before starting the client and verify it overrides the packaged default without
  a rebuild. Use the disposable source-lookup cases in [the smoke test](smoke-test.md)
  to check canonical clone reuse, linked worktrees, revision matching, and
  preservation of existing changes. Substantial lookup should run through Explore
  with a bounded question and return compact evidence to the coordinator.
- A task needing only navigation in the current repository should not trigger
  source lookup. A task without PR text should not need the PR-description skill.

Static package checks verify packaging; the live checks establish whether the
client and model actually follow the loading instructions, and are recorded in
[runtime-compatibility.md](runtime-compatibility.md).
