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
`references/runtimes/`. Runtimes without effort control (such as `antigravity`)
omit reasoning effort from explicit selections and fallback pairs. The
`copilot-local` binding uses the `copilot` preference section. Users may define
additional named tiers. A tier selects a model and effort together (or model
only on runtimes without effort control), or explicitly inherits from the session.

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
tier, specify a model directly (with reasoning effort on runtimes that support it),
intentionally inherit from the session, or return to its default tier. State both
model and effort for a direct selection on runtimes with effort control; do not
infer an effort from a lower layer. On runtimes without effort control (such as
`antigravity`), omit reasoning effort entirely from explicit selections and fallback
pairs. Fallbacks are optional, ordered pairs (model and effort, or model only on
effort-less runtimes) and are used only when explicitly requested and supported by
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
or an explicit request. The selected profile (or the absence of one) is part
of the snapshot: Work keeps it in session state and Autonomous persists the
goal's selected name (see the workflow skills).

Preference files belong to the user. Install, update, build, publication, and
uninstall do not create, overwrite, migrate, or remove them. Missing files mean
no customization. Report a present but unreadable file rather than claiming it
was applied. Do not scan parent workspaces, nested repositories, host config
directories, or plugin caches. For Git projects, use the worktree root even
when invoked below it; for non-Git projects, use the explicitly established
workspace root.

## Named routing profiles

A routing profile is a collection of overrides — tier definitions and role
overrides — inside a preference file, selected once per activation. Keep the
concepts distinct: a tier is one model/effort choice; a role selects a tier or
an explicit choice; a profile groups overrides for a purpose, such as another
server or provider. A profile is not a runtime, an account, an endpoint, or a
machine.

Express profiles as optional `## Profile: <name>` sections in `routing.md`.
Inside one, runtime sections, tier tables, and role overrides are interpreted
exactly as in the file's default sections, including the same tolerance for
clear equivalent prose. Recommended format (a default section plus one partial
profile):

```markdown
# AgenticAle model routing

## opencode

### Tiers

| Tier | Model | Reasoning effort |
| --- | --- | --- |
| fast | server-a/small-coder | medium |
| routine | server-a/main-coder | high |
| standard | provider-main/reviewer | high |
| deep | provider-main/reviewer | xhigh |

### Role overrides

- review: use the deep tier.

## Profile: server-b

### opencode

#### Tiers

| Tier | Model | Reasoning effort |
| --- | --- | --- |
| fast | server-b/small-coder | medium |
| routine | server-b/main-coder | high |
```

Profile names are stable lowercase identifiers: 1–40 characters, starting
with a lowercase letter, then lowercase letters, digits, or hyphens, with no
trailing hyphen. `default` and `inherit` are reserved. `default` selects the
ordinary routing — installed baseline, then personal preferences, then project
preferences, then invocation — and does not mean "ignore my routing.md and use
the packaged settings".

For a selected profile, precedence is lowest to highest:

1. The installed baseline.
2. Personal default entries.
3. Personal entries for the selected profile.
4. Project default entries.
5. Project entries for the selected profile.
6. Default and selected-profile entries from an explicitly supplied
   invocation Markdown file.
7. Direct invocation overrides.

A project default entry can override a personal profile entry with the same
key: if a personal profile redefines the `fast` tier and the project default
also redefines `fast`, the project's `fast` wins for every default-mapped role
such as `explore`.

Matching profile names merge across files by entry, following the same
precedence, so a project file may extend a personal profile by specifying only
its differences.

Inside a profile, all existing routing semantics apply: omitted entries retain
the lower-precedence choice, a replacement carries its model, effort, and
fallbacks atomically, tier definitions and role overrides merge independently,
tier references resolve after merging, and `role: default`, `tier: default`,
and `inherit` keep their existing meanings. Changing all four tiers in a
profile does not clear an existing direct role exception; clear it explicitly
in the profile's role overrides (`- review: default.`) or at a higher layer.

Select exactly one profile per activation. There is no profile inheritance,
profile stacking, automatic load balancing, or automatic profile failover.

Selecting an unknown profile produces an actionable error for the active
runtime: it lists the available profile names, or says that none are defined
for the runtime and suggests adding a `## Profile: <name>` section to a
routing.md preference file or omitting the profile selector. A profile defined
only for another runtime never silently resolves to default. Invalid entries
in unselected profiles, or in inactive runtime sections, never block an
otherwise valid selection.

Profiles control child routing only. A profile does not change the actual
runtime, authenticate an account, configure an endpoint, or move work to
another machine; different servers or subscriptions are selectable only where
the current host exposes them as distinct usable provider/model
configurations. Keep credentials and endpoint setup out of routing files.

## Deterministic resolution and exports

The workflow interprets Markdown into structured layers and passes those
layers to the dependency-free helper. A layer optionally carries a `profiles`
map — profile name to per-runtime tier/role sections in the same shape as the
layer's `runtimes` — which the workflow interprets from the file's
`## Profile:` sections. The helper validates the active runtime, checks a
selected profile's grammar and availability, merges entries from lowest to
highest precedence, replaces each selected entry atomically, resolves all
seven roles, and exports a complete version-1 policy. It does not discover or
parse user files. Without Node, apply these same rules in context and keep the
source of each role and tier selection so the chosen route can be explained.

```sh
node scripts/routing.mjs resolve --runtime codex --input <structured-layer.json> [--profile NAME]
```

`--input` is a tooling interface for the interpreted preferences, not a
second automatically discovered user format. `--profile NAME` selects a named
routing profile from the layers' `profiles` maps; `default` or omission
selects ordinary routing. `--explain` returns the policy with per-role
selection and tier provenance plus the selected profile (null for ordinary
routing); a selected profile's entries resolve through sub-layers labeled
`<layer source> (profile <name>)`. The plain output remains a strict version-1
policy for build tools and OpenCode's installer; profile-selection metadata
and provenance stay in the explanatory output and workflow state, never in the
strict version-1 export. Build-time `--routing PATH` also accepts complete
version-1 policies or version-2 baselines; `--models` remains the legacy
examples importer.

For OpenCode preparation, compare the requested choices against the installed
profiles and actual profile fields. If refresh is needed, export a complete
OpenCode policy and use the existing installer flow documented in
`references/runtimes/opencode.md`. The helper and preference interpretation
never rewrite active profiles or global host configuration implicitly.
