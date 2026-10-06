# Model routing

The installed `references/routing.json` is the single packaged defaults file.
Users customize model routing in Markdown; the workflow interprets the prose
into bounded structured preferences, then the packaged helper merges and
resolves them. Users do not need to author the helper's JSON schema.

## Roles and tiers

The seven roles are `explore`, `implement`, `implement-hard`, `fix`, `review`,
`deep-review`, and `consult`. The default role-to-tier mapping is:

| Tier | Default roles | Purpose |
| --- | --- | --- |
| `fast` | `explore` | Quick investigation |
| `routine` | `implement`, `fix` | Everyday implementation and fixes |
| `standard` | `implement-hard`, `review` | Complex changes and independent review |
| `deep` | `deep-review`, `consult` | Intensive analysis and second opinions |

Each runtime has its own model identifiers and supported effort values; see
`references/runtimes/`. The `copilot-local` binding uses the `copilot`
preference section. Users may define additional named tiers. A tier selects a
model and effort together, or explicitly inherits both from the session.

## User customization

The human-authored file is `routing.md`, copied from
`references/routing.example.md`:

- `<project-root>/.agenticale/routing.md` applies to one project.
- `~/.agenticale/routing.md` applies across projects.

The project file has precedence over the personal file, which has precedence
over the installed defaults. An explicitly supplied Markdown path is an
invocation layer above discovered files. Within each layer, express a choice
clearly; conflicting choices at the same level are ambiguous and require
clarification. Omitted entries retain the lower-precedence choice. A clear
higher-precedence entry may repair an ambiguous lower-precedence entry.

Use the tier table first, then add optional role overrides. A role may choose a
tier, specify a model and effort directly, intentionally inherit both, or
return to its default tier. State both model and effort for a direct selection;
do not infer an effort from a lower layer. Fallbacks are optional, ordered
model/effort pairs and are used only when explicitly requested and supported by
the runtime binding. Do not invent model identifiers or silently substitute a
weaker route.

`role: default` clears a lower-precedence role exception and restores the
packaged role-to-tier mapping, using the final merged tier values. `tier: default`
restores that standard tier's packaged definition; a custom tier with no
packaged definition cannot be reset this way. `inherit` is an explicit
choice to use both the session model and effort. An omitted entry leaves the
lower-precedence entry in place. Replacing an entry replaces its model, effort,
and fallbacks together.

Apply only preferences for the active runtime. An invalid or ambiguous entry
for an inactive runtime does not block the active one. Interpret the complete
human file, including clear equivalent prose, rather than requiring exact
headings, tables, or punctuation. Unknown roles, undefined tiers, and
unresolved ambiguity in the active runtime must be surfaced before the
affected dispatch. Preserve unrelated clear selections when one entry needs
clarification.

Routing preferences govern only model, effort, and explicit fallback choices.
They cannot change task scope, workflow budgets, permissions, installation
ownership, or other skill behavior. Keep the resolved routing snapshot fixed
for an activation, including context compaction; reload it on a new invocation
or an explicit request.

Preference files belong to the user. Install, update, build, publication, and
uninstall do not create, overwrite, migrate, or remove them. Missing files mean
no customization. Report a present but unreadable file rather than claiming it
was applied. Do not scan parent workspaces, nested repositories, host config
directories, or plugin caches. For Git projects, use the worktree root even
when invoked below it; for non-Git projects, use the explicitly established
workspace root.

## Deterministic resolution and exports

The workflow interprets Markdown into structured layers and passes those
layers to the dependency-free helper. The helper validates the active runtime,
merges entries from lowest to highest precedence, replaces each selected entry
atomically, resolves all seven roles, and exports a complete version-1 policy.
It does not discover or parse user files. Without Node, apply these same rules
in context and keep the source of each role and tier selection so the chosen
route can be explained.

```sh
node scripts/routing.mjs resolve --runtime codex --input <structured-layer.json>
```

`--input` is a tooling interface for the interpreted preferences, not a
second automatically discovered user format. `--explain` returns the policy
with per-role selection and tier provenance. The plain output remains a strict
version-1 policy for build tools and OpenCode's installer. Build-time
`--routing PATH` also accepts complete version-1 policies or version-2
baselines; `--models` remains the legacy examples importer.

For OpenCode preparation, compare the requested choices against the installed
profiles and actual profile fields. If refresh is needed, export a complete
OpenCode policy and use the existing installer flow documented in
`references/runtimes/opencode.md`. The helper and preference interpretation
never rewrite active profiles or global host configuration implicitly.
