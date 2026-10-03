# OpenCode V2 smoke test

Use this checklist before a release. It maps to the skills-first layout: the
generated OpenCode binding is seven profiles plus the four skills, and the two
public workflows are invoked as skills. Every write goes to a newly created
temporary directory; do not substitute a real OpenCode profile path.

Discovery and routing checks below make no model request. Live workflow behavior
is **not tested** in this pass; record results per capability in
[runtime-compatibility.md](runtime-compatibility.md) and do not report them here
as verified.

## Prerequisites

- OpenCode V2 on `PATH` (`opencode --version` must print `opencode v2.x`)
- Node.js 20 or later
- a clean checkout of this repository

Record the OpenCode version you test because discovery behavior can change
between releases.

## PowerShell

Open a fresh PowerShell process and run from the repository root:

```powershell
$smokeRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("agenticale-smoke-" + [guid]::NewGuid())
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

- installation reports the generated OpenCode destinations and completes without
  reading or replacing another profile;
- `opencode debug paths` reports config, data, cache, and state paths beneath
  the generated smoke-test root;
- `opencode debug agents` lists the seven generated `autonomous/*` profiles
  (`explore`, `implement`, `implement-hard`, `fix`, `review`, `deep-review`,
  `consult`) as subagents with their step limits and permission denials. There
  is no `coordinator` profile. With `--no-model`, each profile omits a
  `model:` line and inherits the session model;
- the installed `work/SKILL.md` and `autonomous/SKILL.md` set `slash: true` and
  `metadata.opencode/autoinvoke: false`, and OpenCode's command list exposes
  `/work` and `/autonomous` as invocable skills; both skills' shared-round links
  resolve to the installed `skills/work/references/rounds.md`;
- the install state is `.autonomous-mode-install.json` (schema 6, 26-file
  inventory); the materialized `work/references/routing.json` is explicit by
  default and carries `mode: "inherit"` under `--no-model`; uninstall removes
  the recorded copy and its state file while leaving the isolated profile
  directory safe to delete.

The commands above verify discovery without making a model request. An
end-to-end model run is intentionally manual because it consumes provider
credentials and may modify the selected project. If performed, create a second
throwaway repository beneath `workspaceRoot`/`workspace_root` and try:

- `/work` with a trivial verifiable code fix: confirm worker and independent
  reviewer dispatch, uncommitted changes, and no operational files.
- A vague investigation-only request: confirm focused exploration and findings
  or a meaningful question without implementation.
- Feedback on an existing branch with an unrelated staged edit: confirm the
  requested fix is reviewed and the unrelated edit and index state are preserved.
- `/autonomous` with a small goal: confirm durable handoff creation and resume
  from its next action, including persistence of read-only findings.

Use a disposable remote and an explicitly authorized PR for a live `/work --pr`
check. Verify branch creation/reuse, coherent commits after review, task-only
outgoing history, and one PR. Do not test publication against an ordinary
project just to verify discovery. Record actual observations and client version;
static package tests do not establish runtime agent behavior.

Inspect tool logs to confirm `pull-request-description` is loaded by ID or its
full `SKILL.md` is read before drafting the PR body. For either workflow, also
try a source investigation using a local dependency or service fixture: the
child must receive the loading rule, read `source-code-lookup` before the
lookup, and return location/revision evidence using the workflow's state policy.
Ordinary navigation in the current repository should not require source lookup.

For source lookup, use disposable fixture repositories and roots. Set
`SOURCE_ROOT` to a directory different from the installed default and verify
that Explore reuses a matching canonical checkout there. Repeat with an explicit
task root, then with the variable unset, to check precedence. An unavailable
configured root must produce a diagnostic without cloning into the fallback.
Start one investigation from a linked worktree outside the source root; it must
still use the configured root. Request an older fixture tag while the canonical
checkout has uncommitted changes: verify exact-commit evidence and unchanged
working files and local branches. If inspection needs a temporary detached
worktree, confirm Git cleanup after use. For a missing fixture repo, confirm one
canonical clone and reuse on a second lookup. Keep raw source output in the
Explore child and verify the coordinator receives a compact, cited answer.

To smoke-test per-route selection, make a copy of `examples/gpt.json` inside the
temporary smoke root and replace each example ID with a model ID shown by
`/models` in the isolated OpenCode profile. Before the uninstall command above,
run `node scripts/install.mjs --target <isolated-profile-path> --models
<edited-json-path> --replace`, then inspect `opencode debug agents`: the `model`
values for `autonomous/explore` and `autonomous/review` should match the edited
mapping. A role omitted from the JSON object inherits the current session model.
Re-run the same install without `--replace` and confirm it reports the profile
is up to date. The uninstall should remove unchanged rendered profiles.

## Live workflow checks (not tested)

The discovery steps above are runnable by hand. The live model-routing and
workflow checks in [runtime-compatibility.md](runtime-compatibility.md) are a
separate pass. Run them when provider credentials are available and record each
capability as verified, limited, or not tested there. Do not mark a capability
verified here on the basis of a discovery result.
