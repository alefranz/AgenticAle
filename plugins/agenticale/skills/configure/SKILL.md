---
name: configure
description: "Configure AgenticAle's per-role model routing and the Work worker-round allowance on explicit user request: discover what the host actually exposes, propose exact preference-file content (or an OpenCode --models config and installer rerun), and write only after exact confirmation. Explicit-only: runs when the user asks to configure AgenticAle (on OpenCode, the /configure command); the model does not start this skill on its own."
slash: true
disable-model-invocation: true
metadata:
  opencode/autoinvoke: false
---

# Configure AgenticAle

A user-initiated setup skill. Its output is configuration the user has
confirmed: the optional preference file on per-spawn hosts, or a flat
`--models` JSON plus an installer rerun on OpenCode — and, on every host,
the preference file's `## Work` worker-round allowance. It adds no scaffold
command, no automatic setup, no packaged model inventory, and no
profile-management feature, and it keeps no persistent state of its own.

Explicit-only: run this skill only when the user asks to configure
AgenticAle — on OpenCode through the installed `/configure` command entry,
on the other hosts through the client's explicit skill invocation. Never
start it on your own initiative, never run it as part of a `work`, `review`,
or `autonomous` round, and never use it to write configuration from inside a
workflow: the workflows create or modify no preference files, and this skill
is the user's direct setup path, not a workaround for that rule.

## Safety rules

These bind every step below:

1. Read-only first. Discovery and tuning read the host surface and existing
   files; they write nothing.
2. Every proposed model name and variant comes from live native host
   evidence or from the user. Never invent a name, and never ship or recall
   a packaged inventory of names. A live enumeration establishes what the
   host lists — not a verified capability or cost ranking; role-mapping
   heuristics are proposals, labelled as such. Unknown stays unknown.
3. Tune interactively: show the proposed content, ask what to change, show
   the revision, and repeat until the user confirms.
4. Write only on explicit confirmation of the exact target path and the
   exact content — for an existing file, the exact diff against its current
   content. Consent is separate for each effect: a preference-file write, a
   `--models` JSON write, and running the installer. Confirming one never
   confirms another.
5. Re-read the target immediately before writing. If its content changed
   since confirmation, the confirmation is stale: stop, re-propose against
   the new content, and ask again. Never write on a stale confirmation.
6. Cancellation, no confirmation, or a proposal that still contains
   placeholders means no writes — including no partial or "harmless" writes.
7. Preserve existing contents. Edit an existing preference file minimally:
   only the confirmed lines or section change; unrelated assignments,
   sections, comments, and formatting stay as they are. Never silently
   rewrite, migrate, or remove a preference file.
8. Never launch a workflow or the installer automatically, and never infer
   that routing is verified because a write or an install succeeded.
   Verification is a separate, user-driven step (below).

## Detect the surface, then discover

Select the actual runtime from the host's tool surface — never from the
session's model name — and read the matching discovery reference:
[OpenCode](references/discovery/opencode.md),
[Copilot](references/discovery/copilot.md),
[Copilot Local](references/discovery/copilot-local.md),
[Codex](references/discovery/codex.md),
[Antigravity](references/discovery/antigravity.md).
An unknown surface invents no tools; for routing it degrades safely
(ladder step 3).

Model discovery serves routing requests only. An explicitly requested
Work-only allowance edit needs no model evidence and skips the ladder
entirely (see the Work allowance section below).

Discovery ladder (routing requests only):

1. **The host enumerates models** through a live native listing: propose
   concrete names taken from that live list, mapped to the role slots by
   capability heuristics — a cheap, fast, capable model for `explore`,
   `implement`, and `fix` (low–medium variant where the host supports
   effort); a strong model for `implement-hard`; the strongest reasoning
   for `review`, `review-deep`, and `consult` (high/xhigh where supported).
   Propose the optional routes `implement-easy` and `consult-hard`
   unlisted: unlisted, they fall back to their base routes by the shared
   routing policy. The mapping is a proposal for the user to tune, not a
   verified ranking.
2. **No enumeration**: propose the role→slot structure with placeholders
   and ask the user for the model names (or point at the host's own
   documentation). Placeholders are never written.
3. **Nothing to work with** — unknown host, no listing, no user-supplied
   names: state that session-model-everywhere (no preference file, or no
   assignments) is a valid configuration, and stop the routing proposal.
   This is safe degradation to valid inheritance, not a failure. The stop
   binds routing discovery only: it never blocks an explicitly requested
   Work-only allowance edit, which needs no model evidence.

Native limitations bind every proposal; the discovery references carry the
per-host detail (Antigravity's fixed model enum and absent effort control,
the Copilot Local parent-model cost-tier ceiling, unconfirmed listings and
effort levels). Warn about a selection the host cannot honor before writing
it; the user's explicit, confirmed choice wins with the limitation stated —
the workflow surfaces it at dispatch, and configure never silently
substitutes a weaker route.

## Target file and precedence (per-spawn hosts)

The preference file is `<project-root>/.agenticale/preferences.md` first,
then `~/.agenticale/preferences.md`. The project file wins when both exist;
files are never merged, and the selected file is read once at activation
and stays fixed for that activation. Ask project vs personal before
writing, and show the exact resolved path.

Existing named-profile semantics are respected, not extended: a leading
`--profile NAME` (or the user naming `preferences.NAME.md`) selects that
file at the same locations, project first. Target the selected file; a
missing selected file is reported, never silently replaced by
`preferences.md`. Writing a user-named profile file follows the same exact
consent rules as any preference write — this skill adds no profile
listing, switching, or management feature. The `## Work` section lives in
the same selected file.

## Propose the preference file (per-spawn hosts)

The format is a Markdown list of direct role assignments, one per line:
`- <role>: <provider/model[#variant]>` (combined form), or the legacy
`- <role>: <model>` / `- <role>: <model>, <effort>` forms — one form per
line. `<role>` is one of the nine worker keys: `explore`, `implement`,
`implement-easy`, `implement-hard`, `fix`, `review`, `review-deep`,
`consult`, `consult-hard`. There is no coordinator key: the host owns the
session model. Unlisted roles inherit the session model; nothing else is
interpreted. The `#variant` suffix (`low`, `medium`, `high`, `xhigh`,
`max`) applies only where the host supports per-child effort.

Start from the bundled starter,
[preferences.example.md](references/preferences.example.md):
all nine roles documented, every assignment commented, the optional routes
unlisted, and an inert `## Work` section. Replace placeholders with names
from live host evidence or the user, and uncomment only the confirmed
lines. Packaging: the build copies the authored root starter into every
packaged output at `skills/configure/references/preferences.example.md` and
repoints this link at that install-relative copy
(`references/preferences.example.md`), so installed users reach it without
the source checkout; in the authored tree the link resolves to the
repository-root `examples/preferences.example.md`.

For a new file, show the exact full content. For an existing file, show the
exact minimal diff against its current content and preserve everything
unrelated. Then apply the safety rules: explicit confirmation of path and
content, re-read before the write, stale confirmation invalid, no writes on
cancellation or remaining placeholders.

## OpenCode: --models JSON and installer rerun

On OpenCode the models are baked into the generated `agenticale/<role>`
profiles at install time; preference-file role lines do not apply. Never
propose role lines for OpenCode routing, and never edit the generated
profiles, `opencode.jsonc`, or `default_agent` directly. Read
[the OpenCode discovery reference](references/discovery/opencode.md) for the
confirmed live model listing and the flat-config contract.

Propose a flat `--models` JSON built from live listing evidence or user
names: role → `"provider/model[#variant]"`, omitted roles inherit, the
optional top-level `coordinator` key only when the user wants a session
assignment, and the optional routes listed only when the user opts in.
Write the JSON only on its own explicit confirmation of the exact
user-chosen path and content (re-read before writing; stale confirmation
invalid).

Then propose the installer rerun — the work binding's refresh procedure:

```sh
node <AgenticAle-checkout>/scripts/install.mjs install --models <path|preset> [--target PATH]
```

Add `--replace` when the generated profiles differ; the installer's normal
ownership, backup, collision, and rollback safeguards apply, and a modified
profile is otherwise preserved and reported. Running the installer is a
separate explicit consent for its external effects on the installation —
never automatic; the user may run the command themselves. OpenCode reloads
refreshed profiles without an app restart, and the next fresh workflow
activation dispatches with them.

The `## Work` allowance remains editable through the preference file on
OpenCode (below); it is the only preference-file section that applies there.

## The Work worker-round allowance (all hosts)

The top-level `## Work` section carries one documented entry:
`- worker rounds: N`, a positive integer. The default is twelve when the
entry is absent; the default allowance auto-extends on verified progress
evidence up to the progress-based hard ceiling of twenty-four. An explicit
entry is an exact cap: it never auto-extends, whatever its size. The
allowance is what is available to a Work task, not what must run; it never
changes the consultation allowance, the progress safeguards, scope, or
permissions. It is Work-specific: Autonomous Mode keeps its own run ceiling
and per-task allowance, untouched by this file.

A Work-only request — the user asks only to set or change the worker-round
allowance — needs no model evidence: no listing, no user-supplied model
names, and no routing proposal. The discovery ladder and its stop bind
routing discovery only and never block this edit, on any host. Proceed
directly to the exact preference-file edit under the same safety rules as
any preference write: target selection with the exact resolved path, exact
content (or the minimal diff against an existing file), explicit
confirmation, re-read before writing, stale confirmation invalid, and no
writes on cancellation. A Work-only proposal contains no routing
placeholders, and routing assignments stay untouched.

An invalid value is an actionable error naming its source and the value —
never silently defaulted or clamped. Configure never writes an invalid
value; when an existing file carries one, report it and propose a
correction only on confirmation.

No budget reset: the selected file is read once at activation. Editing the
allowance never resets or changes an already-active Work invocation's
allowance or consumed counters; new invocations pick up the change.

## Verify (host-aware, user-driven)

A successful write or install is not routing verification, and configure
never launches a workflow to "test" the configuration on its own. Offer
the host's verification path and let the user drive it:

- **OpenCode**: the installer prints a ready-to-paste verification prompt
  that reads the generated profiles and reports each role's model line.
  Effective routing is established only from native host evidence: a small
  user-invoked `/work` run with `--stats` (supported on this surface) and
  its per-session agent/model table. Record requested versus effective;
  unknown stays unknown; a child's self-reported model name never
  establishes what it ran on.
- **Other hosts**: no binding documents a `--stats` procedure — state that
  the option is unsupported there rather than promising it. Use native
  runtime metadata or local traces where the host exposes them. On
  Antigravity the effective underlying model is not reported by the host:
  keep it unconfirmed. Where no native evidence exists, say verification
  is unavailable and the configuration stands as requested-only.

## Finish

Report what was proposed, what was written (exact paths), which consents
were given, what remains requested-only or unverified, and the next
verification step. Keep state in the session; write no operational files
beyond the confirmed configuration targets.
