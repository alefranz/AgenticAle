# Configure

`configure` is the user-initiated setup skill for AgenticAle's model routing
and the Work worker-round allowance. It discovers what your host actually
exposes, proposes the exact configuration content with you, and writes only
after you confirm the exact target path and content. It is explicit-only: it
runs when you ask to configure AgenticAle — on OpenCode through `/configure`,
on the other hosts through your client's explicit skill invocation — and never
starts on its own or inside a `work`, `review`, or `autonomous` round.

Examples:

- `/configure` — set up per-role model routing on this installation
- `/configure Set the Work worker-round allowance to 8` — a Work-only edit
- `Configure AgenticAle's model routing for this project`

The slash form is conceptual; use the invocation supported by your client in
[installation and client setup](../../setup.md).

## What it proposes

The output depends on the host, detected from the actual runtime surface —
never from the session's model name:

- **Copilot, Codex, Antigravity (plugin or standalone installs)** — the
  optional [preference file](../../guides/model-routing.md#other-hosts-the-preference-file):
  direct role assignments for the nine worker roles. A bundled commented
  starter (`preferences.example.md`, shipped inside the configure skill)
  documents every role; the optional routes stay unlisted unless you opt in.
- **OpenCode** — models are fixed in the generated profiles at install time,
  so preference-file role lines do not apply. Configure proposes a flat
  `--models` JSON and, as a separate confirmed step, the installer rerun that
  bakes it into the profiles. It never edits the generated profiles directly.
- **Every host** — the preference file's `## Work` section (the Work
  worker-round allowance). A Work-only edit needs no model discovery at all.

Every proposed model name comes from live host evidence or from you — nothing
is invented and no packaged inventory of model names ships. Where the host
enumerates models (confirmed on OpenCode), the role mapping is a labelled
capability heuristic for you to tune, not a verified ranking; where no listing
is confirmed, configure asks you for names and never writes placeholders.
Native limitations (for example Antigravity's fixed model enum) are surfaced
before any write, and a listed selection the host cannot honor is never
silently substituted.

## Confirmation and verification

Discovery and tuning are read-only. A write happens only on your explicit
confirmation of the exact path and exact content (for an existing file, the
exact minimal diff), and the target is re-read immediately before writing — a
changed target invalidates the confirmation. Preference-file writes,
`--models` JSON writes, and installer runs each need their own consent;
cancellation means no writes. Existing content is preserved, and workflows
still never create or modify preference files themselves.

A successful write is not routing verification. Configure offers the host's
verification path and lets you drive it: on OpenCode, the installer's profile
verification prompt and a small `/work` run with `--stats`; on other hosts,
native metadata or traces where available, with `--stats` stated as
unsupported. Requested versus effective is recorded honestly; an unknown
effective setting stays unknown.

The authoritative flow lives in the
[configure skill](https://github.com/alefranz/AgenticAle/blob/main/skills/configure/SKILL.md),
with per-host discovery notes under its `references/discovery/` directory.
Behavior examples are in the repository's
[configure fixtures](https://github.com/alefranz/AgenticAle/blob/main/docs/configure-fixtures.md).
Model configuration itself is covered in the
[model configuration guide](../../guides/model-routing.md).