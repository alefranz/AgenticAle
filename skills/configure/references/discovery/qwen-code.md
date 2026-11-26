# Qwen Code model discovery (configure)

Model-discovery notes for the `configure` skill on Qwen Code. Dispatch
rules live in the work skill's
[Qwen Code runtime binding](../../../work/references/runtimes/qwen-code.md);
this reference covers only what configure may read, propose, and verify.

## Detection

Detect Qwen Code from the actual tool surface: the Qwen Code Agent tool
surface (no per-call model parameter by default), the installed flat
`agenticale-*` agent files under the effective install root's `agents/`
directory, and the `/work`, `/review`, `/autonomous`, `/configure` skill
commands. Never from the session's model name.

## Live model evidence — what this host offers

Qwen Code exposes no confirmed read-only model-enumeration tool in the
agent surface. The host-side evidence available to configure is the
effective `settings.json` model registry, read-only: its `modelProviders`
entries (the provider buckets the session and the installed agents' bare
`model:` lines resolve against) and the session default. Treat it as a
**candidate source of names, not a resolution guarantee**: the effective
registry merges multiple settings scopes, a bare id may be registered
under more than one provider, and resolution searches the session's auth
type first before other buckets — so a registry hit establishes that an id
*may* resolve, not which provider a child will actually run against. It
is not a cost or capability ranking, and enumeration alone establishes no
ordering, so propose the role mapping as a labelled heuristic and let the
user tune it. The `openai/*` values are a different family: they never
resolve against the settings registry; they route to the installed Codex
CLI's own catalog through the executor, so their names come from the codex
side or the user. What a child actually runs on is still established only
from native host evidence at dispatch — and remember the silent fallback:
an id the host cannot resolve degrades to the session model with no error.

## What configure proposes here

Models are baked into the installed `agenticale-<role>` agent files at
install time; preference-file role lines do not apply to a Qwen Code
installation. Never propose role lines for Qwen Code routing, and never
edit the installed agent files, `settings.json`, or the model registry
directly.

Propose a flat `--models` JSON whose names come from the settings registry,
the codex side, or the user:

- A JSON object mapping any of the nine worker roles (`explore`,
  `implement`, `implement-easy`, `implement-hard`, `fix`, `review`,
  `review-deep`, `consult`, `consult-hard`) to
  `"provider/model[#effort]"`. Omitted roles inherit the session model.
- The supported provider families: the user's local llama
  OpenAI-compatible endpoint, the Qwen Code / Alibaba token plan
  (registered in `settings.json`), and `openai/` for codex-routed values
  (the build renders the pinned codex executor for these). The provider
  component of a direct value is routing information only: the rendered
  agent carries the bare model id, which must exist in the settings
  registry — a mistyped id silently inherits the session model.
- The optional top-level `coordinator` key is a session assignment, not a
  worker role: it generates the flat `agenticale-coordinator` agent file
  whose `model:` line is the requested coordinator model. It must be
  Qwen-direct — an `openai/` coordinator value is skipped by the build and
  rejected by the installer, because the coordinating session can only run
  on a model from its own registry. Propose it only when the user wants
  the coordinating session itself on a configured model.
- The `#effort` suffix passes through only for `openai/` values (to the
  codex executor); for direct values the host renders the model only.
- `implement-easy` and `consult-hard` render only when listed; propose
  them unlisted unless the user opts in.
- The shared flat-config loader rejects unknown keys (the retired
  `deep-review` key is renamed `review-deep`), whitespace or control
  characters, quotes and backslashes in values, invalid effort levels, and
  bare model ids a YAML parser would coerce (a number, boolean, or null);
  every failure names the role and value.

Write the JSON only on its own explicit confirmation of the exact
user-chosen path and content; re-read before writing, and treat a content
change since confirmation as invalidating it.

Then propose the refresh (the work binding's refresh procedure). This host
has no installer entry yet — `scripts/install.mjs` currently installs only
the OpenCode binding — so the refresh is a manual build and copy:

```sh
node <AgenticAle-checkout>/scripts/build.mjs --models <path|preset>
```

and copy the generated `qwen-code/` build root's `agents/agenticale-*.md`
and skill directories into the effective install root (the project
`.qwen/` directory or `~/.qwen/`). The copy is the only effect on the
user's machine: `settings.json` stays unchanged, an agent file the user
has modified is backed up before being replaced, and nothing outside the
`agenticale-*` agents and the AgenticAle skill files is touched. Running
the build and copy is a separate explicit consent for its effects — never
automatic. A session that reads the agents root at start picks up the
refreshed files; do not promise a running session hot reload. Because a
manual install writes no ownership manifest, configured-route intent for
the optional routes cannot be established until an installer entry lands;
state that as a limitation when the user asks.

The bundled `--models` presets remain an explicit user option — they are
example inventories, not verified machine mappings. Configure's own
proposals still come only from the settings registry, the codex side, or
the user, never from a packaged baseline of names.

The installer's existing consent-gated `setup` subcommand can create a
minimal personal preferences scaffold; on Qwen Code only its `## Work`
section applies. Configure adds no scaffold command of its own, and the
`## Work` allowance is editable through the preference file on this host
like any other.

## Current install evidence (read-only)

Whether an optional route is configured comes from the installer's
ownership manifest (`.autonomous-mode-install.json`) at the effective
install root, exactly as the work binding documents — read-only. Configure
may read it to report current intent; it never writes the manifest, and
never resolves models from it. A manually copied install writes no
manifest, so intent is not established there and the conservative
decision applies.

## Verification

`--stats` is not supported on this surface — state that rather than
promising it. Offer a small user-invoked `/work` run and read the native
session metadata (provider/model per direct dispatch) as native host
evidence; for an executor child the host records only its own label
(`external-codex:codex`), so the pinned codex model stands as requested
and cannot be verified host-side. Record requested versus effective; the
silent fallback means an unknown effective setting stays unknown, and a
child's self-reported model name never establishes what it ran on. A
successful install is not routing verification.

## Limitations

- No per-call model override: the Agent tool selects an installed agent,
  so arbitrary task-time model requests are a limitation, not a silently
  substituted route.
- An unresolvable direct model id silently inherits the session model
  (no error); verify installed ids against the settings registry before
  writing them, and keep the effective selection unknown until native
  evidence establishes it.
- Codex-routed children are one-shot tasks, and their write/read-only
  behavior follows the session approval mode.
- Do not change global model configuration mid-task; model changes go
  through the installer rerun above.

This reference is selected from the actual runtime/tool surface, not from
the session's model name. A surface that is not Qwen Code does not use it;
an unknown surface reports a limitation instead of inventing tools.
