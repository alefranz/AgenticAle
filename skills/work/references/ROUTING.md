# Routing

This contract has one packaged source of defaults: `references/routing.json`.
Personal and project settings are optional JSON patches. The installed package
does not carry a second, expanded copy of the defaults.

## Roles and default tiers

Every runtime supports the same seven routing roles:

`explore`, `implement`, `implement-hard`, `fix`, `review`, `deep-review`, and
`consult`.

The packaged baseline maps roles to four reusable tiers:

| Tier | Roles | Purpose |
| --- | --- | --- |
| `fast` | `explore` | Quick exploration |
| `routine` | `implement`, `fix` | Routine implementation |
| `standard` | `implement-hard`, `review` | Difficult implementation and review |
| `deep` | `deep-review`, `consult` | Integration analysis and second opinions |

Each runtime defines its model and reasoning effort for those tiers. Model
identifiers and dispatch fields are runtime-specific; use the runtime binding
in `references/runtimes/` when dispatching. For example, OpenCode model names
may include a provider prefix while Codex and Copilot use host-native model
IDs.

## Optional preference files

Users may create either or both of these files:

- `<project-root>/.agenticale/routing.json`
- `~/.agenticale/routing.json`

The project file overrides the personal file, which overrides the packaged
baseline. An invocation choice has the highest precedence. Missing files mean
no customization. Existing but unreadable or invalid JSON files are errors to
report before dispatch.

The preference file is a version-2 JSON patch. It may include only the
runtimes and entries being changed; omitted entries keep their lower-priority
value. Copy `references/routing.example.json` as a starting point. A patch can
replace tier definitions under `runtimes.<runtime>.tiers` or role selections
under `runtimes.<runtime>.roles`.

Preference files from older releases that use `routing.md` are not read or
rewritten. Convert any existing choices to JSON before dispatching; the
resolver reports a legacy file instead of silently falling back to defaults.

An explicit selection has this form:

```json
{
  "mode": "explicit",
  "model": "gpt-6.1-sol",
  "reasoningEffort": "high",
  "fallbacks": []
}
```

A role can select a tier with `{ "mode": "tier", "tier": "deep" }`, or
intentionally inherit both model and effort with `{ "mode": "inherit" }`.
`{ "mode": "default" }` resets a role or tier entry to the packaged
baseline. A custom tier without a packaged definition cannot be reset.
Replacing an entry replaces its model, effort, and fallbacks together.
Fallbacks are ordered `{ "model", "reasoningEffort" }` pairs.

An example role override:

```json
{
  "schemaVersion": 2,
  "runtimes": {
    "codex": {
      "roles": {
        "review": {
          "mode": "explicit",
          "model": "gpt-6.1-sol",
          "reasoningEffort": "high",
          "fallbacks": []
        }
      }
    }
  }
}
```

Preference files are user-owned. Install, update, build, publication, and
uninstall never create, overwrite, migrate, or remove them. Do not scan parent
workspaces, nested repositories, host-specific config directories, or plugin
caches for additional preferences.

## Resolution

At the start of `work` or `autonomous`:

1. Identify the active runtime and establish the project root. For a Git
   project, use the worktree root even when invoked from a subdirectory. For a
   non-Git project, use an explicitly established workspace root.
2. Read `references/routing.json` and the two optional preference files above.
   Merge from lowest to highest precedence: packaged baseline, personal file,
   project file, then explicit invocation choices. Keep the source of each
   selected entry in session state.
3. Resolve all seven roles for the active runtime. Validate model and effort
   support against that runtime's binding before dispatch. Report invalid or
   unsupported choices; use only an explicitly configured fallback.
4. Keep the resolved choices fixed for the activation, including context
   compaction. A new invocation or explicit request resolves them again.

When Node is available, the packaged helper can discover the JSON files and
resolve them deterministically:

```sh
node scripts/routing.mjs resolve --runtime codex --project-root <project-root>
```

Use `--input PATH` for an additional structured invocation layer. The helper
prints a complete version-1 policy for the active runtime. It does not write
preference files. Without Node, apply the same JSON merge rules in context.

Unknown top-level keys, runtimes, roles, or tiers; incomplete selections; and
unsupported effort values are errors. A missing role in a complete version-1
policy is also an error, not implicit inheritance. `inherit` means inherit both
model and effort. Do not silently substitute the session model or invent a
weaker model when a configured route is unavailable.

Do not infer the runtime from the selected model. Record requested versus
effective settings when the host exposes effective metadata; a child's
self-reported model name is not proof of what it ran on. `work` keeps routing
state in the session. `autonomous` records a compact summary in its existing
handoff/report.

## Build and import options

- `--routing PATH` accepts a complete version-1 policy or a version-2 baseline.
- `--models PATH|PRESET` imports the legacy `provider/model[#variant]` map
  format used by `examples/`. Omitted roles become explicit inheritance and
  are reported. Known `openai/` and `opencode/` prefixes are removed for
  Codex/Copilot and retained for OpenCode; other provider prefixes pass through.
- `--no-model` makes all routes inherit both model and effort.
- `--effort LEVEL` overrides effort on explicit routes and is rejected if any
  route inherits.

These are build-time choices. Runtime preference files are not build inputs and
are never embedded into generated packages.

## OpenCode profiles

OpenCode dispatches preconfigured profiles instead of arbitrary model strings.
Compare the resolved request directly with the current profile's `model` and
`reasoningEffort` fields before dispatch. The profile itself is the source of
what is installed; no second resolved-policy snapshot is needed. If a route has
no matching profile, report that limitation and use the documented explicit
preparation and refresh process in `references/runtimes/opencode.md`. The
current adapter cannot execute an arbitrary fallback chain or materialize
multiple models for one role.

| Role | OpenCode profile ID |
| --- | --- |
| `explore` | `autonomous/explore` |
| `implement` | `autonomous/implement` |
| `implement-hard` | `autonomous/implement-hard` |
| `fix` | `autonomous/fix` |
| `review` | `autonomous/review` |
| `deep-review` | `autonomous/deep-review` |
| `consult` | `autonomous/consult` |
