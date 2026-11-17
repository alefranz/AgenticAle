# Configure behavior examples

These examples define expected behavior for the user-initiated
`skills/configure/SKILL.md` and its per-host discovery references under
`skills/configure/references/discovery/`. They are review fixtures, not
claims about any runtime's exact output or a test of live host behavior.

## Live listing on OpenCode

**Observed:** The user asks to configure model routing on an OpenCode
installation, and the session exposes the live model listing (the models
tool or `opencode models`).

**Expected:** Propose a flat `--models` JSON whose names and variants come
from that live list, mapped to role slots by labelled capability heuristics
(cheap/fast for explore/implement/fix, strong for implement-hard, strongest
reasoning for review/review-deep/consult). Enumeration alone establishes no
capability or cost ranking: present the mapping as a proposal to tune, not
a verified ordering. Never propose preference-file role lines for OpenCode
routing and never edit generated profiles directly.

## User-supplied names

**Observed:** The user supplies model names that do not appear in the live
listing (or no listing is available), and asks to use them.

**Expected:** The user is a valid evidence source: accept the names into
the proposal, noting that host availability is unverified and the effective
selection stays unknown until native evidence establishes it. Never invent
additional names to fill gaps, and never reject user names merely because
the listing omits them.

## No discovery available

**Observed:** The host exposes no model enumeration (for example Copilot or
Codex without a confirmed listing surface).

**Expected:** Propose the role→slot structure with placeholders and ask the
user for model names, or point at the host's own documentation. Mark the
listing capability unconfirmed; do not invent a listing command or transfer
a capability seen on another client. No write happens while placeholders
remain.

## Unknown runtime / nothing to work with (routing requests)

**Observed:** The user asks to configure routing, the tool surface matches
no known binding, or there is no listing and the user supplies no names.

**Expected:** Degrade safely: state that session-model-everywhere (no
preference file, or no assignments) is a valid configuration, and stop the
routing proposal. Invent no tools, commands, or model names, and write
nothing. The stop binds routing discovery only: an explicitly requested
Work-only allowance edit is not blocked (see the Work-only fixtures
below).

## Unsupported selection

**Observed:** A proposal would assign a concrete model ID or a `#variant`
on Antigravity, a reviewer above the parent cost tier on the Copilot Local
harness, or an effort level unconfirmed on the target surface/version.

**Expected:** Surface the native limitation in the proposal before any
write: Antigravity accepts only its fixed enum and no effort; the Local
harness may not honor an above-tier reviewer; unconfirmed levels stay
unconfirmed. Offer the valid alternatives (enum values, `inherit`, no
variant). The user's explicit, confirmed choice wins with the limitation
stated — configure never silently substitutes a weaker route, and never
writes an unhonorable selection as if it would work.

## Cancellation or no confirmation

**Observed:** The user cancels, declines, or never confirms the proposed
content.

**Expected:** No writes of any kind — no preference file, no JSON, no
installer run, and no partial or "harmless" subset write. Report the
proposed state and stop.

## Placeholders at confirmation time

**Observed:** The proposed content still contains `<placeholder>` tokens
when confirmation is requested.

**Expected:** Do not write. Confirmation binds exact, real content; resolve
every placeholder from live evidence or the user first, or stop with the
structure-only proposal.

## Existing preference file

**Observed:** The target preference file already exists with unrelated
assignments, sections, or comments.

**Expected:** Read it, propose the exact minimal diff against its current
content, and preserve everything unrelated. Never silently rewrite,
migrate, or remove the file. Write only the confirmed diff after explicit
confirmation of path and content.

## Change after confirmation

**Observed:** The target file's content changes between confirmation and
the write (another process or the user edited it).

**Expected:** The re-read before writing detects the change; the earlier
confirmation is stale. Stop, re-propose against the new content, and ask
again. Never write on the stale confirmation.

## Project priority and no merging

**Observed:** Both `<project-root>/.agenticale/preferences.md` and
`~/.agenticale/preferences.md` exist.

**Expected:** The project file is the effective selection; propose against
it when the user wants project scope. Files are never merged: say that a
personal-file edit has no effect while the project file exists, and let the
user choose the target explicitly. The selected file is read once at
activation and stays fixed for that activation.

## Named profile selection

**Observed:** The user invokes with `--profile NAME` or asks to configure
`preferences.NAME.md`.

**Expected:** Target `preferences.NAME.md` at the same locations, project
first. A missing selected file is reported — never silently replaced by
`preferences.md`. Writing the named file follows the same exact consent
rules; configure adds no profile listing, switching, or management feature.

## Work allowance edit on OpenCode

**Observed:** The user asks to change the Work worker-round allowance on an
OpenCode installation.

**Expected:** The `## Work` section applies on OpenCode: propose the exact
preference-file edit under the normal consent rules. Role lines still do
not apply there — redirect any routing change to the `--models` JSON and
installer rerun, with separate consents for the JSON write and the
installer run.

## Work-only edit without discovery (OpenCode)

**Observed:** The user asks only to change the Work worker-round allowance
on an OpenCode installation, with no model listing consulted or available.

**Expected:** No model discovery is required: proceed directly to the exact
`## Work` preference-file edit under the normal consent rules (exact path
and content or minimal diff, explicit confirmation, re-read before
writing, stale confirmation invalid, no writes on cancellation). The
routing discovery stop does not apply, and no `--models` JSON write or
installer run is needed for this edit. Routing changes still redirect to
the `--models` JSON and installer rerun with their separate consents.

## Work-only edit without discovery (per-spawn host)

**Observed:** The user asks only to set the Work worker-round allowance on
a per-spawn host that exposes no enumeration, and supplies no model names
(for example an unknown surface, or Copilot/Codex without a confirmed
listing).

**Expected:** The routing discovery stop does not block the edit: no
listing or user-supplied model names are required, and no routing
placeholders are proposed or written. Ask project vs personal, show the
exact resolved path and the exact content or minimal diff, and write only
on explicit confirmation; re-read before writing, treat a changed target
as stale confirmation, and write nothing on cancellation. An invalid
`worker rounds` value is reported, never written. Routing stays untouched
and session-model inheritance remains valid.

## Separate consent boundaries

**Observed:** The user confirms the `--models` JSON content, then the
installer command is proposed.

**Expected:** JSON-write consent does not authorize running the installer,
and neither authorizes a preference-file write. Each effect — preference
write, JSON write, installer run — needs its own explicit confirmation of
its exact target and content or command. The installer is never run
automatically.

## Work allowance validation

**Observed:** A proposed or existing `- worker rounds:` value is not a
positive integer (zero, negative, fractional, or non-numeric).

**Expected:** An actionable error naming the source file and the value —
never silently defaulted or clamped, and configure never writes an invalid
value. The allowance is Work-only (Autonomous budgets are untouched),
defaults to 12 when absent, and is available rounds, not required rounds.
The default auto-extends on verified progress evidence up to the hard
ceiling of 24; an explicit entry is an exact cap that never auto-extends,
whatever its size. Editing it never resets an active Work invocation's
allowance or consumed counters; new invocations pick up the change.

## Verification is host-aware and user-driven

**Observed:** A write or install succeeded, and the user asks whether
routing now works.

**Expected:** Never infer routing is verified from a successful write or
install, and never auto-launch a workflow to test. On OpenCode, offer the
installer's profile verification prompt and a small user-invoked `/work`
run with `--stats` (supported there), reading the per-session agent/model
table as native evidence. On other hosts, state that `--stats` is
unsupported rather than promising it; use native metadata or traces where
available. On Antigravity the effective underlying model stays
unconfirmed. Requested versus effective; unknown stays unknown; a child's
self-reported model name never establishes what it ran on.

## No workflow preference writes

**Observed:** A `work`, `review`, or `autonomous` round encounters a missing
or outdated preference file.

**Expected:** The workflow reports the state and continues with inheritance
or the existing selection; it never invokes configure or writes
configuration itself. Configure runs only on the user's direct request,
outside workflow rounds.

## No-file note at workflow activation

**Observed:** A workflow activation on a per-spawn host finds no preference
file through the default project-then-personal lookup.

**Expected:** One non-blocking note that every role inherits the session
model, pointing at the user-invoked `configure` skill and its bundled
starter; no extra reads. A missing named `--profile` file remains an error,
not a note. The workflow still never invokes configure or writes anything;
configure runs only if the user then asks for it.

## OpenCode command entry with a configured coordinator

**Observed:** The installation configures the primary coordinator profile,
and the user invokes `/configure`.

**Expected:** The configure command entry stays a caller-session launcher
(`bindCoordinator: false`): setup runs in the user's own session, not on the
coordinator profile, because setup is a user conversation and not a workflow
round. The command still loads the `configure` skill by its exact ID and
passes `$ARGUMENTS`. The workflow command entries keep their coordinator
binding.

## Install-relative starter

**Observed:** An installed configure skill (plugin, standalone, or OpenCode
copy) is used without a source checkout.

**Expected:** The packaged skill links the starter install-relative
(`references/preferences.example.md`), and the bundled starter is verbatim
the authored root starter with every assignment commented. No source
checkout is needed to reach it; the authored tree keeps the repository-root
link.

## Install update adds configure

**Observed:** A pre-configure install — an OpenCode schema-7 state with the
five-skill set and three command entries, or a standalone five-skill
`sourceLayout` — is updated with the current build.

**Expected:** Reconciliation adds the configure skill's files (and the
OpenCode configure command entry) without `--replace`; the historical state
validates rather than being rejected as incomplete. User preference files
are never created, overwritten, migrated, or removed by the update, and
modified owned files stay preserved and reported.
