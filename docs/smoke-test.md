# OpenCode V2 smoke test

Use this checklist before a release. Every write goes to a newly created
temporary directory; do not substitute a real OpenCode profile path.

## Prerequisites

- OpenCode V2 on `PATH` (`opencode --version` must print `opencode v2.x`)
- Node.js 20 or later
- a clean checkout of this repository

The release candidate was last exercised with OpenCode `2.0.9`. Record the
version you test because discovery behavior can change between releases.

## PowerShell

Open a fresh PowerShell process and run from the repository root:

```powershell
$smokeRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("autonomous-mode-smoke-" + [guid]::NewGuid())
$profileRoot = Join-Path $smokeRoot "config"
$workspaceRoot = Join-Path $smokeRoot "workspace"
New-Item -ItemType Directory -Path $workspaceRoot | Out-Null
$env:XDG_CONFIG_HOME = $profileRoot
$env:XDG_DATA_HOME = Join-Path $smokeRoot "data"
$env:XDG_CACHE_HOME = Join-Path $smokeRoot "cache"
$env:XDG_STATE_HOME = Join-Path $smokeRoot "state"
$env:OPENCODE_DISABLE_PROJECT_CONFIG = "1"
$env:OPENCODE_DISABLE_EXTERNAL_SKILLS = "1"

opencode --version
node scripts/install.mjs --target (Join-Path $profileRoot "opencode") --no-model
node scripts/validate.mjs
opencode debug paths
$agents = opencode debug agents | ConvertFrom-Json
$agents | Where-Object { $_.id -like 'autonomous/*' } |
  Select-Object id, mode, steps, @{Name='model';Expression={ "$($_.model.providerID)/$($_.model.id)" }}
opencode debug config

opencode service stop
node scripts/install.mjs uninstall --target (Join-Path $profileRoot "opencode")
Remove-Item Env:XDG_CONFIG_HOME
Remove-Item Env:XDG_DATA_HOME
Remove-Item Env:XDG_CACHE_HOME
Remove-Item Env:XDG_STATE_HOME
Remove-Item Env:OPENCODE_DISABLE_PROJECT_CONFIG
Remove-Item Env:OPENCODE_DISABLE_EXTERNAL_SKILLS
Remove-Item -LiteralPath $smokeRoot -Recurse -Force
```

## POSIX shell

Open a fresh POSIX shell and run from the repository root:

```sh
smoke_root="$(mktemp -d)"
profile_root="$smoke_root/config"
workspace_root="$smoke_root/workspace"
mkdir -p "$workspace_root"
export XDG_CONFIG_HOME="$profile_root"
export XDG_DATA_HOME="$smoke_root/data"
export XDG_CACHE_HOME="$smoke_root/cache"
export XDG_STATE_HOME="$smoke_root/state"
export OPENCODE_DISABLE_PROJECT_CONFIG=1
export OPENCODE_DISABLE_EXTERNAL_SKILLS=1

opencode --version
node scripts/install.mjs --target "$profile_root/opencode" --no-model
node scripts/validate.mjs
opencode debug paths
opencode debug agents > "$smoke_root/agents.json"
node -e 'const a=JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")); for(const x of a.filter(x=>x.id.startsWith("autonomous/"))) console.log(x.id,x.mode,x.steps,`${x.model?.providerID}/${x.model?.id}`)' "$smoke_root/agents.json"
opencode debug config

opencode service stop
node scripts/install.mjs uninstall --target "$profile_root/opencode"
unset XDG_CONFIG_HOME
unset XDG_DATA_HOME
unset XDG_CACHE_HOME
unset XDG_STATE_HOME
unset OPENCODE_DISABLE_PROJECT_CONFIG
unset OPENCODE_DISABLE_EXTERNAL_SKILLS
rm -rf "$smoke_root"
```

## Expected observations

- installation reports exactly the bundle destinations and completes without
  reading or replacing another profile;
- `opencode debug paths` reports config, data, cache, and state paths beneath
  the generated smoke-test root;
- `opencode debug agents` lists all seven `autonomous/*` roles as subagents
  with their configured step limits and permission denials. With `--no-model`,
  the resolved output may show each role's inherited session model;
- the installed `autonomous-mode/SKILL.md` has `slash: false` and
  `metadata.opencode/autoinvoke: false`, and OpenCode's command list shows
  `/autonomous` using `build`;
- uninstall removes the recorded ten-file copy installation and its state
  file while leaving the isolated profile directory safe to delete.

The commands above verify discovery without making a model request. An
end-to-end model run is intentionally manual because it consumes provider
credentials and may modify the selected project. If performed, create a second
throwaway repository beneath `workspaceRoot`/`workspace_root`, invoke
`/autonomous` with a trivial documented edit as its goal, and confirm it
creates the handoff files and routes at least one worker round. Delete that
repository when finished.

To smoke-test per-role selection, make a copy of
`examples/gpt.json` inside the temporary smoke root and replace
each example ID with a model ID shown by `/models` in the isolated OpenCode
profile.
Before the uninstall command above, run `node scripts/install.mjs --target
<isolated-profile-path> --models <edited-json-path> --replace`, then inspect
`opencode debug agents`: the `model` values for `autonomous/explore` and
`autonomous/review` should match the edited mapping. A role omitted from the
JSON object inherits the current session model.
Re-run the same install without `--replace` and confirm it reports "Already up
to date." The uninstall should remove unchanged rendered agents.
