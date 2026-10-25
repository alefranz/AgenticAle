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

The human-authored file is `preferences.md`, copied from
`references/preferences.example.md`:

- `<project-root>/.agenticale/preferences.md` applies to one project.
- `~/.agenticale/preferences.md` applies across projects.

The same file may carry the optional top-level `## Work` section, which sets
the Work workflow's worker-round allowance (see [Work worker-round
allowance](#work-worker-round-allowance)).

At each scope, `routing.md` remains accepted as a legacy name for the same
file. When both `preferences.md` and `routing.md` exist at the same scope,
`preferences.md` takes precedence and `routing.md` is ignored — never merged —
and the workflow identifies the ignored file rather than silently dropping
it. An unreadable `preferences.md` is reported as an error on every path and
is never a reason to fall back to the legacy file; a legacy file is only an
error condition when it is the effective file.

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

The routing sections (per-runtime sections and `## Profile:` sections)
govern only model, effort, and explicit fallback choices. They cannot change
task scope, workflow budgets, permissions, installation ownership, or other
skill behavior. The one documented exception is the top-level `## Work`
section: it can change only the Work workflow's worker-round allowance (the
available worker rounds, default eight), and nothing else — not how many
rounds must run, the consultation allowance, the per-slice fix/review caps,
the progress safeguards, scope, or permissions (see [Work worker-round
allowance](#work-worker-round-allowance)). Keep the resolved routing snapshot
fixed for an activation, including context compaction; reload it on a new
invocation or an explicit request. The selected profile (or the absence of
one) is part of the snapshot: Work keeps it in session state and Autonomous
persists the goal's selected name (see the workflow skills).

Preference files belong to the user. The install, update, build, publication,
and uninstall flows do not create, overwrite, migrate, or remove them. The one
exception is the OpenCode installer's `setup` subcommand
(`node scripts/install.mjs setup`), invoked only after the user explicitly
consents: it may CREATE the personal `~/.agenticale/preferences.md` when it is
absent (the legacy name `routing.md` is still honored there), as a minimal
scaffold with no role overrides, so the installed baseline routing (which
matches the generated agent profiles) applies. It never
overwrites, migrates, or removes a preference file, and it never creates the
project-scope file. Missing files mean no customization.
Report a present but unreadable file rather than claiming it was applied. Do
not scan parent workspaces, nested repositories, host config directories, or
plugin caches. For Git projects, use the worktree root even when invoked below
it; for non-Git projects, use the explicitly established workspace root.

## Named routing profiles

A routing profile is a collection of overrides — tier definitions and role
overrides — inside a preference file, selected once per activation. Keep the
concepts distinct: a tier is one model/effort choice; a role selects a tier or
an explicit choice; a profile groups overrides for a purpose, such as another
server or provider. A profile is not a runtime, an account, an endpoint, or a
machine.

Express profiles as optional `## Profile: <name>` sections in
`preferences.md` (the legacy `routing.md` name is still accepted).
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
preferences, then invocation — and does not mean "ignore my preferences and
use the packaged settings".

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
preferences.md preference file or omitting the profile selector. A profile
defined only for another runtime never silently resolves to default. Invalid entries
in unselected profiles, or in inactive runtime sections, never block an
otherwise valid selection.

Profiles control child routing only. A profile does not change the actual
runtime, authenticate an account, configure an endpoint, or move work to
another machine; different servers or subscriptions are selectable only where
the current host exposes them as distinct usable provider/model
configurations. Keep credentials and endpoint setup out of routing files.

## Work worker-round allowance

The preference file may carry a top-level `## Work` section — a sibling of
the `## <runtime>` sections and of the `## Profile:` sections. A `## Work`
heading inside a `## Profile:` section is not a Work setting and is not
interpreted as one. The section has one documented entry:

```markdown
## Work

- worker rounds: 12
```

The value is the Work workflow's worker-round **allowance**: how many worker
rounds are available to a Work task, not how many must run. The default is
eight. The override changes only what is available: it never changes how many
rounds must run, the consultation allowance, the per-slice fix and review
caps, the progress safeguards, the task's scope, or permissions. It is
Work-specific: Autonomous Mode keeps its own budget behavior and ignores the
setting. The section has no per-runtime scoping and is not profile-scoped: a
selected routing profile does not change it, and it applies to every
runtime.

Precedence is lowest to highest: the packaged default (eight, declared in
the installed baseline), the personal file, the project file, and finally an
explicit task-time instruction at invocation (coordinator-level; it is not
part of the resolver). Omitted entries retain the lower-precedence value. An
invalid value (not a positive integer) is an actionable error naming the
source and the value; it is never silently defaulted and never clamped.

## Deterministic resolution and exports

The workflow interprets Markdown into structured layers and passes those
layers to the dependency-free helper. A layer optionally carries a `profiles`
map — profile name to per-runtime tier/role sections in the same shape as the
layer's `runtimes` — which the workflow interprets from the file's
`## Profile:` sections. A layer may also carry an optional `work` key
(`{ workerRounds }`, a positive integer) that the workflow interprets from
the file's top-level `## Work` section; it is layer-level — never runtime- or
profile-scoped — and an invalid value is an error naming the source and the
value, never silently defaulted or clamped. The helper validates the active
runtime, checks a selected profile's grammar and availability, merges entries
from lowest to highest precedence, replaces each selected entry atomically,
resolves all seven roles, and exports a complete version-1 policy. It does
not discover or parse user files. Without Node, apply these same rules in
context and keep the source of each role and tier selection so the chosen
route can be explained.

The default startup command is `startup`:

```sh
node scripts/routing.mjs startup --runtime codex --root <root> [--profile NAME]
```

It checks both documented filenames — `preferences.md` and the legacy
`routing.md` — at the documented preference locations: personal
`~/.agenticale/`, and project `<root>/.agenticale/` only with `--root` (exact
path, no parent scanning; deduplicated when the root is the home directory) —
without reading their contents. At each scope a present `preferences.md` is
the effective file, and a present `routing.md` beside it is ignored — never
merged — and reported in that location's `ignored` list. A present but
unreadable effective file is an error, never treated as absent, on every
path, and never a reason to fall back to the other filename; an unreadable
ignored file is not an error. The result reports `preferenceFiles` per
location — `state` (`absent`, `present`, or `not-checked` when `--root` is
omitted), the effective `file`, its absolute `path`, and the `ignored`
files — and `presentFiles`, the effective file paths only. With no file
present it resolves the installed baseline directly, with no preference
layers and no input file, and prints a `resolved` result: the strict
version-1 `policy`, per-role `routeProvenance`, the selected `profile` (null
for ordinary routing), the effective `work` allowance
(`{ workerRounds, source }`), and, for opencode or an explicit
`--agents-dir`, an `agents` map comparing each of the seven resolved routes
against the installed agent profiles — each role `match`, `mismatch` (a
compact note plus the expected and installed values), `missing` (no file), or
`unreadable` (file unreadable, no parseable frontmatter, or a duplicated
field that makes the profile ambiguous). With an effective file present it
prints an `interpretation-required` result naming the `presentFiles` (the
effective files only; ignored files are identified in `preferenceFiles`);
the result carries no interpretation of the files — including the `## Work`
section — and the workflow then reads and interprets the effective Markdown
itself and resolves the interpreted layers through `resolve --input <file>
--explain`, whose output is the routing snapshot. An unreadable effective file is an error, never
treated as absent, on every path, and never a reason to fall back to the
other filename; an unknown `--profile` with no preference files fails with
the actionable unknown-profile message — final only when the activation
carries no invocation-level preferences.
`startup` accepts no invocation layers: the `resolved` result finalizes only
when the activation carries no invocation-level preferences. When the
activation carries invocation preferences — direct task-time overrides, an
explicitly supplied invocation Markdown file, or a profile selected at
invocation — the workflow interprets the discovered files (if any) plus the
invocation preferences into the ordered structured layers, lowest to highest
precedence per this contract, writes them to a temporary file, and resolves
them through `resolve --input <file> [--profile NAME] --explain`; profile
availability is validated only by this final resolution, whose
unknown-profile error lists the available names, including those defined by
the invocation Markdown itself (a profile defined there is valid). On this
path `startup` serves only as the file-existence probe: an unknown-profile
failure with no preference files is provisional and is not reported.

```sh
node scripts/routing.mjs resolve --runtime codex --input <structured-layers.json> [--profile NAME]
```

`--input` is a FILE PATH of structured preference JSON (one layer or an array
of layers), typically the interpreted form of a preferences.md preference
file (the legacy routing.md name is still accepted) — never inline JSON — and
a tooling interface for the interpreted preferences,
not a second automatically discovered user format. It is omitted when there
are no preferences. `--profile NAME` selects a named routing profile from the
layers' `profiles` maps; `default` or omission
selects ordinary routing. `--explain` returns the policy with per-role
selection and tier provenance, the selected profile (null for ordinary
routing), and the effective `work` allowance (`{ workerRounds, source }`); a
selected profile's entries resolve through sub-layers labeled
`<layer source> (profile <name>)`. The workflow's snapshot-producing
resolution always runs the command with `--explain`, and the snapshot stores
that output's `policy`, `routeProvenance`, `profile`, and `work`. The plain
output
remains a strict version-1 policy for build tools and OpenCode's installer —
never the workflow's snapshot — and profile-selection metadata and provenance
stay in the explanatory output and workflow state, never in the strict
version-1 export. Build-time `--routing PATH` also accepts complete
version-1 policies or version-2 baselines; `--models` remains the legacy
examples importer.

For OpenCode preparation, compare the requested choices against the installed
profiles and actual profile fields. If refresh is needed, export a complete
OpenCode policy and use the existing installer flow documented in
`references/runtimes/opencode.md`. The helper and preference interpretation
never rewrite active profiles or global host configuration implicitly.
