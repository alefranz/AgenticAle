# OpenCode model discovery (configure)

Model-discovery notes for the `configure` skill on OpenCode V2. Dispatch
rules live in the work skill's
[OpenCode runtime binding](../../../work/references/runtimes/opencode.md);
this reference covers only what configure may read, propose, and verify.

## Detection

Detect OpenCode from the actual tool surface: the OpenCode session/agent
tools (including the opencode MCP server where present), the installed
`agenticale/*` profiles, and the `/work`, `/review`, `/autonomous` command
entries. Never from the session's model name.

## Live model enumeration — confirmed

Two read-only listing surfaces were observed live on OpenCode V2
(2026-11-16):

- The OpenCode models tool in the agent tool surface (observed as the
  opencode MCP server's `models` tool): it searches models by provider or
  name and returns providers whose models carry an `id` in
  `providerID/modelID` form, a display name, a release date, the reasoning
  `variants`, per-million-token `cost`, and a `status`
  (active/beta/alpha/deprecated), with pagination.
- The CLI listing `opencode models` ("List all available models"), printing
  `provider/model` lines.

Detect which of these the current session actually exposes and use it
read-only; do not assume a tool or command that is not present. The listing
is live evidence of the names, variants, and cost fields the host reports
for this account. It is not a verified capability or cost ranking:
enumeration alone establishes no ordering, so propose the role mapping as a
labelled heuristic and let the user tune it. What a child actually runs on
is still established only from native host evidence at dispatch.

## What configure proposes here

Models are baked into the generated `agenticale/<role>` profiles at install
time; preference-file role lines do not apply to an OpenCode installation.
Never propose role lines for OpenCode routing, and never edit the generated
profiles, `opencode.jsonc`, or `default_agent` directly.

Propose a flat `--models` JSON whose names come from the live listing above
or from the user:

- A JSON object mapping any of the nine worker roles (`explore`,
  `implement`, `implement-easy`, `implement-hard`, `fix`, `review`,
  `review-deep`, `consult`, `consult-hard`) to
  `"provider/model[#variant]"`. Omitted roles inherit the session model.
- The optional top-level `coordinator` key is a session assignment, not a
  worker role: it generates the visible primary `agenticale/coordinator`
  profile and binds the command entries to it. Propose it only when the
  user wants the coordinating session itself on a configured model.
- The variant rides on the model line (`low`, `medium`, `high`, `xhigh`,
  `max`); there is no separate effort field.
- `implement-easy` and `consult-hard` render only when listed; propose them
  unlisted unless the user opts in.
- The shared flat-config loader rejects unknown keys (the retired
  `deep-review` key is renamed `review-deep`), whitespace or control
  characters, and invalid variants; every failure names the role and value.

Write the JSON only on its own explicit confirmation of the exact
user-chosen path and content; re-read before writing, and treat a content
change since confirmation as invalidating it.

Then propose the installer rerun (the work binding's refresh procedure):

```sh
node <AgenticAle-checkout>/scripts/install.mjs install --models <path|preset> [--target PATH]
```

Add `--replace` when the generated profiles differ. The installer is
copy-only under its normal ownership, backup, collision, and rollback
safeguards: a modified profile is preserved and reported unless `--replace`
backs it up and replaces it; `opencode.jsonc` and `default_agent` stay
unchanged. Running the installer is a separate explicit consent for its
external effects — never automatic. OpenCode reloads refreshed profiles
without an app restart (`/reload` forces a full reload); the next fresh
workflow activation dispatches with them.

The bundled `--models` presets remain an explicit user option — they are
example inventories, not verified account mappings. Configure's own
proposals still come only from the live listing or the user, never from a
packaged baseline of names.

The installer's existing consent-gated `setup` subcommand can create a
minimal personal preferences scaffold; on OpenCode only its `## Work`
section applies. Configure adds no scaffold command of its own, and the
`## Work` allowance is editable through the preference file on this host
like any other.

## Current install evidence (read-only)

Whether an optional route is configured comes from the installer's
ownership manifest (`.autonomous-mode-install.json`) at the effective
install root, exactly as the work binding documents — read-only. Configure
may read it to report current intent; it never writes the manifest, and
never resolves models from it.

## Verification

`--stats` is supported on this surface (the work binding's session usage
summary procedure). Offer a small user-invoked `/work` run with `--stats`
and read the per-session agent/model table as native host evidence; the
installer also prints a ready-to-paste profile verification prompt after
install. Record requested versus effective; an unknown effective setting
stays unknown, and a child's self-reported model name never establishes what
it ran on. A successful install is not routing verification.

## Limitations

- No per-call model override: the child tool selects a preconfigured
  profile, so arbitrary task-time model requests are a limitation, not a
  silently substituted route.
- What a profile resolves to depends on the account's model availability;
  keep the effective selection unknown until native evidence establishes it.
- Do not change global model configuration mid-task; model changes go
  through the installer rerun above.

This reference is selected from the actual runtime/tool surface, not from
the session's model name. A surface that is not OpenCode V2 does not use it;
an unknown surface reports a limitation instead of inventing tools.
