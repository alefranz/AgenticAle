# Routing contract

The routing policy maps each task difficulty (a routing role) to a model and
reasoning effort, per runtime. Users customize it with one optional Markdown
file; the installed package carries a version-2 defaults baseline and a fully
resolved version-1 snapshot for compatibility and comparison.

Two boundaries: the orchestrator interprets Markdown preferences in context.
Deterministic tooling (the shared module `scripts/routing.mjs` and the build)
consumes structured preferences and concrete routes only. Do not implement a
partial Markdown parser that quietly rejects valid prose, and do not require an
API call to interpret user files in a build or installer. The module provides
deterministic validation, layer merging, resolution, and version-1 export where
Node is already available; a direct workflow may apply the same documented
algorithm in context without Node.

## The seven roles

Every runtime maps exactly the seven exposed role names, which are
compatibility commitments:

`explore`, `implement`, `implement-hard`, `fix`, `review`, `deep-review`,
`consult`.

`implement` and `implement-hard` share the same implementation task contract;
they differ only in routing (a harder route). Each is an independent profile; a
missing key in a complete policy is an error, not an implicit inheritance. A
future rename requires an alias or migration, and new roles receive a packaged
tier mapping so ordinary three-tier customization continues to apply.

## Tiers and role overrides

The usual configuration consists of three named tiers, each selecting a model
and reasoning effort. The initial defaults:

| Tier | Meaning | Default roles |
| --- | --- | --- |
| `fast` | Routine, high-volume work | `explore`, `implement`, `fix` |
| `standard` | Difficult implementation and independent review | `implement-hard`, `review` |
| `deep` | Intensive integration analysis and second opinions | `deep-review`, `consult` |

Several tiers can use the same model with different efforts. Users may define
additional named tiers. `default` and `inherit` are reserved instructions, not
tier names. A role override selects a tier, a concrete model/effort pair,
intentional inheritance, or the role's default tier.

## The recommended Markdown file

Ship a template at `references/routing.example.md`. Its model names are
illustrative; actual identifiers and effort support come from the host. A
heading or clear prose scope is sufficient; exact heading levels, tables, or
punctuation are not required. Comments, explanations, and omitted sections are
allowed. Clear prose expressing the same routing choices is accepted.

Runtime sections use `codex`, `copilot`, and `opencode`. The `copilot-local`
binding uses the `copilot` preference section but retains its own dispatch
limits. Apply only the active runtime's preferences. Ask for a runtime section
when a multi-runtime file leaves its scope ambiguous.

Concrete selections specify both model and effort. A model-only instruction
does not inherit an effort from the lower-precedence model. An explicit request
for a model's default effort can be resolved only when the binding establishes
a concrete supported choice; otherwise report that unresolved request before
using the affected route. Qualitative preferences such as "use a stronger
model" are incomplete unless the referenced selection is clear from the file or
invocation. Do not invent a model identifier to satisfy them.

## Discovery and ownership

1. Establish the active runtime and target project once per activation.
2. For a Git project, resolve the worktree root, including when invoked from a
   subdirectory. For a non-Git project, use an explicitly established workspace
   root. If that root is unavailable, report the missing project scope.
3. Check `<repo>/.agenticale/routing.md` and the execution environment's
   `~/.agenticale/routing.md`. The optional Node helper uses `os.homedir()`;
   workflow instructions use the host's actual home directory.
4. Do not scan nested repositories, parent workspaces, `.codex/`, `.claude/`,
   `.agents/`, or plugin caches for additional preference files. Deduplicate a
   path if the established project root and home produce the same file.
5. Treat an absent file as normal. Distinguish absence from an existing file
   that cannot be read; report an inaccessible preference source before
   dispatch rather than claiming defaults were intentionally chosen.
6. Read each discovered file once. Keep its interpreted preferences and source
   identity in the activation's routing snapshot.

These files are user-owned. Installation, update, publication, and uninstall do
not create, overwrite, migrate, or remove them. Provide copy instructions for
the template; file creation is an explicit user action. Package only the
example and defaults, never a discovered personal or repository preference
file.

`.agenticale/` is an AgenticAle convention. Codex's native `config.toml` plugin
settings manage enablement and MCP policies, and hook `PLUGIN_DATA` provides
writable plugin data. Neither establishes automatic discovery of this Markdown
file; the preference source remains independent of those host mechanisms.

## Precedence

Precedence is per named entry, from highest to lowest:

```text
Invocation preferences
  > repository routing.md
  > personal routing.md
  > installed/package baseline
```

Merge from lowest to highest precedence. Merge tier definitions and role
selections separately, replacing entries atomically (a replacement carries its
own model, effort, and fallbacks as one unit; a new selection without fallbacks
has an empty fallback list). An omitted entry preserves the lower layer.
Resolve role-to-tier references only after merging all layers.

The installed baseline normally contains packaged tiers and default role
mappings. A custom installation may contain explicit legacy role choices
(normalized version-1 imports): preserve them as lower-precedence role
exceptions, including inheritance. Tier edits do not implicitly clear those
exceptions; `default` is the explicit reset.

An explicitly supplied Markdown path is a session-scoped invocation preference
layer above discovered files. It does not change the existing command-line
`--routing PATH` JSON contract. Explicit per-entry invocation choices take
precedence over entries in that supplied Markdown file. Conflicting choices
within the same layer need clarification; file order is not an implicit
tiebreaker.

Required precedence examples (all must hold):

| Personal preference | Repository preference | Expected result |
| --- | --- | --- |
| `review: deep` | Replace the `deep` selection | Review uses the repository's `deep` model and effort |
| A direct review model/effort | Replace `standard` | The direct review selection survives |
| A direct review model/effort | `review: default`, replace `standard` | Review uses the repository's `standard` selection |
| Replace `fast` | Omit `fast` | Personal `fast` applies to its default roles |
| `review: inherit` | Omit review | Review intentionally inherits session model and effort |
| `review: deep` | Invocation directly selects review | The invocation's pair applies to review only |
| Deep tier with fallbacks | Replace deep with a new pair only | Deep has the new pair and no inherited fallbacks |

## Selection rules

- A tier definition is an explicit model/effort selection or `inherit`.
- A role can reference a named tier, name a direct selection, or use `inherit`.
- `role: default` clears a lower-precedence role exception and restores that
  role's packaged tier mapping, using the final merged tier definition.
- `tier: default` restores that standard tier's installed baseline definition.
  Custom tiers without a baseline cannot use this reset.
- `inherit` intentionally inherits both session model and effort; it is
  distinct from omission and from `default`.
- Replacing an explicit selection replaces model, effort, and fallbacks as one
  unit.
- Ordered fallback pairs are optional advanced preferences. Preserve exact
  order and pairs. A role referencing a tier receives that tier's complete
  selection; an explicit role selection replaces it completely.
- Tier references cannot recursively reference other tiers in the first
  release. Additional tiers directly select model/effort or inheritance.

Interpret Markdown into these bounded preferences. It does not authorize
changes to task contracts, workflow budgets, permissions, or installation
ownership. Unknown role names and undefined tier references are surfaced with
their source location. Ambiguity in the final effective selection blocks that
affected dispatch; an entry wholly superseded by a clear higher layer need not
block it. Preserve unrelated clear selections while resolving an affected
entry.

## Workflow bootstrap

Both `work` and `autonomous` use this one shared bootstrap at start and resume:

1. Read the installed routing instructions (this file) and defaults
   (`references/routing.json`), and select the actual runtime binding from
   `references/runtimes/` for the host actually being used.
2. Discover and read personal and project preferences using Discovery above.
3. Apply invocation preferences and resolve a snapshot for the active runtime.
4. Check selections against the exposed dispatch capabilities. Surface missing
   capabilities, unsupported choices, or unresolved preferences before the
   affected child runs.
5. Show a compact tier summary and role exceptions, including sources. For a
   tier reference, retain both the role-selection source and the
   tier-definition source.
6. Dispatch children with the snapshot's concrete choices and record requested
   versus effective settings when native metadata makes the latter available.

Do not infer the runtime from the selected model. Do not claim a child used a
model because it self-reported that name; an unknown effective setting stays
unknown. An unsupported request can use only an explicitly configured
fallback; it must not silently inherit or invent a weaker model.

Keep the snapshot fixed during the activation, including context compaction.
Reload on a new invocation, a fresh autonomous resume, or an explicit user
request. A reload affects subsequent dispatches, never an already-running
child. On autonomous resume, compare against the prior summary and report
material changes; the prior handoff's routing record is diagnostic history, not
a layer that overrides current preferences.

`work` keeps this information in session state and does not create operational
files or hidden directories. `autonomous` records a compact routing summary in
its existing handoff/report structure. Read-only startup does not create a
routing file in either workflow. An explicitly requested export can write an
artifact; temporary OpenCode preparation files remain outside project workflow
state.

## Packaged resources

- `references/routing.json`: the installed version-2 defaults baseline — a
  common role-to-tier map plus per-runtime tier definitions and optional role
  exceptions. Its shape:

  ```json
  { "schemaVersion": 2, "provenance": "...",
    "roleTiers": { "<role>": "<tier>" },
    "runtimes": { "<runtime>": { "tiers": { "<tier>": { ... } }, "roles": { "<role>": { ... } } } } }
  ```

  The authored baseline declares all three existing runtimes. Version-2 role
  entries support `{ "mode": "tier", "tier": "<name>" }`, an explicit entry, or
  an inheritance entry. Reset instructions operate on preference patches and
  are removed during normalization. Users do not have to author or version this
  machine contract.

- `references/resolved-routing.json`: the fully resolved version-1 snapshot of
  the installed baseline (all seven roles per runtime, concrete or
  `inherit`). It supports compatibility, comparison, and export; it is a
  snapshot of installed choices, not an override above user preferences. Both
  files come from one resolution pass; there is no second hand-maintained
  role/model inventory.

- `scripts/routing.mjs`: the packaged, dependency-free shared module (Node
  builtins only). It validates both versions, merges preference layers,
  normalizes version-1 policies, resolves concrete routes with source and
  provenance labels, and exports a strict version-1 policy. Its `resolve` CLI
  takes the installed baseline and structured preference JSON (stdin or an
  explicit file) and prints a valid version-1 policy for the complete active
  runtime. It does not interpret Markdown and does not discover preference
  files; its errors identify the affected runtime, role/tier, and source.

## Validation rules

The following are errors, not silently coerced (machine contract):

- Unknown top-level keys; a `schemaVersion` other than the file's version.
- A `roleTiers` map (version 2) that does not map exactly the seven roles to
  non-empty tier names; reserved instruction names (`default`, `inherit`) used
  as tier names.
- Unknown runtime keys (supported: `copilot`, `codex`, `opencode`) or unknown
  role keys.
- Wrong types: a selection that is not an object, a `model` that is not a
  non-empty string, a `reasoningEffort` that is not one of `low`, `medium`,
  `high`, `xhigh`, `max` (including the string `"inherit"`), or a `fallbacks`
  that is not an array of `{ "model", "reasoningEffort" }` pairs with a
  non-empty model and a supported effort.
- Contradictory fields: an `inherit` entry that also carries `model`,
  `reasoningEffort`, or `fallbacks`; an `explicit` entry that omits `model` or
  `reasoningEffort`; a role tier reference with a missing or reserved tier
  name.
- Undefined references at resolution: a role referencing a tier that is not
  defined after merging, or a role whose default tier mapping names an
  undefined tier.
- Version 1 (complete policy): a declared runtime must map exactly the seven
  roles; a missing key is an error.

Exact native field names and the set of supported effort levels on a given host
are adapter concerns; the contract validates the policy-level shape, and each
runtime binding validates identifiers per host.

## Existing build-time interfaces

- `--routing PATH` with version-1 JSON: accepted unchanged. A complete version-1
  policy normalizes to exact direct role exceptions over the version-2 packaged
  tiers (divergent roles are preserved verbatim; it is not reinterpreted as a
  sparse tier override). Runtimes the policy leaves undeclared are merged from
  the packaged defaults, as before.
- `--routing PATH` with version-2 structured defaults: accepted as a separately
  versioned machine input, normalized through the shared resolver.
- A Markdown path supplied to `--routing` gets a clear explanation directing
  the user to the runtime preference files or a resolved JSON export; it is
  never silently treated as JSON.
- `--models PATH|PRESET`: the legacy import path for existing
  `provider/model[#variant]` maps (the style in `examples/`). A legacy map may
  be partial; import converts any omitted key to explicit inheritance and
  reports that conversion. Do not conflate a legacy partial map's omission
  (converted to inheritance and reported) with a missing key in a complete
  policy (an error). Preset aliases are preserved and availability is
  validated per target.
- `--no-model`: every route inherits both model and effort, as before.
- `--effort LEVEL`: the route-wide reasoning-effort override for explicit
  routes; it is rejected when any effective route inherits (inheritance means
  inherit both model and effort).

Build-time flags are explicit operations on the installed baseline, not
remembered as higher-priority invocation preferences in every later session.
Installed inheritance and direct-role exceptions remain until a higher role
selection or `default` clears them; tier edits alone preserve them. Currently
rejected option combinations (for example `--models` with `--no-model`, or
`--routing` with `--models`) remain rejected.

## Compatibility mapping to OpenCode profiles

| Routing role | Task reference | OpenCode profile ID |
| --- | --- | --- |
| `explore` | `explore.md` | `autonomous/explore` |
| `implement` | `implement.md` | `autonomous/implement` |
| `implement-hard` | `implement.md` (hard-task routing context) | `autonomous/implement-hard` |
| `fix` | `fix.md` | `autonomous/fix` |
| `review` | `review.md` | `autonomous/review` |
| `deep-review` | `deep-review.md` | `autonomous/deep-review` |
| `consult` | `consult.md` | `autonomous/consult` |

OpenCode is the only mandatory shim: these seven routes are materialized as
seven generated agent profiles, rendered from the resolver's concrete result,
and per-call model overrides are bounded by the preconfigured profiles (see
`runtimes/opencode.md`). Additional tiers affect resolved selections; they do
not create new task contracts or require one profile per tier.

The first release's OpenCode customization path is explicit: the installed
workflow reads Markdown and resolves the requested OpenCode routes; it
compares the requested selections with the installed resolved policy and the
actual profile fields (accounting for modified profiles; an unavailable
comparison is a limitation, not proof of a match); it uses a matching profile
when one exists, checking the availability of each requested fallback profile
before promising an ordered fallback can be honored; otherwise it exports a
complete version-1 OpenCode policy to an explicit preparation artifact and
refreshes by rerunning the existing checkout-based installer,
`node <AgenticAle-checkout>/scripts/install.mjs install --routing <resolved-policy.json>`,
with any explicitly chosen target options. Activate the refreshed profiles
using the host's verified reload or new-session behavior, and check requested
versus installed selections before dispatch. A mismatched profile is reported
with an actionable preparation command; the workflow never rewrites active
profiles or global host model configuration as an implicit side effect of
reading `routing.md`. Per-call overrides unsupported by the adapter remain
unsupported until matching profiles are available; preserve a requested
fallback list in exports, and do not claim the current seven-profile adapter
can materialize multiple models for one role or execute an arbitrary fallback
chain. The full procedure, with the exact export and installer commands, is in
`runtimes/opencode.md` (OpenCode preparation and refresh).
