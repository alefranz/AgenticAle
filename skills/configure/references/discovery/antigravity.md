# Antigravity model discovery (configure)

Model-discovery notes for the `configure` skill on the Google Antigravity
desktop IDE (observed 2.23.1) and the Antigravity CLI `agy` (observed
1.3.5). Dispatch rules live in the work skill's
[Antigravity runtime binding](../../../work/references/runtimes/antigravity.md);
this reference covers only what configure may read, propose, and verify.

## Detection

Detect Antigravity from the actual tool surface — specifically the presence
of the `invoke_subagent` tool — never from the session's model name.

## Model selection surface — fixed enum, no enumeration needed

The `Model` parameter on `invoke_subagent` accepts only the fixed enum
`inherit`, `flash_lite`, `flash`, and `pro`. These are the only valid
selection tokens configure may propose on this host; they are documented
native field values, not concrete model names. The host does not accept
arbitrary concrete model IDs or external model strings: proposing one for
any role — including an optional route — is proposing a selection the host
cannot honor, and must be surfaced as a limitation, never written as if it
would work.

Antigravity provides no reasoning-effort parameter for child subagents.
Never propose a `#variant` suffix or a comma-effort value on this host.

The enum's tier names suggest a capability ordering (lighter tiers for
cheap slots, `pro` for strong slots); that mapping is a labelled proposal,
not a verified capability or cost ranking — enumeration alone establishes
no ranking. Let the user tune it.

`inherit` is an explicit, intentional choice: the child runs on the
session's active model. It is the path to models outside the enum — the
user selects the session model in the Antigravity UI or CLI and assigns
`inherit` to the roles that should use it. Session-model-everywhere (no
preference file, or `inherit` throughout) is a valid configuration.

## What configure proposes here

Preference-file role lines whose values are only the enum tokens above,
for example `- explore: flash_lite` or `- review: pro`, with no variant.
Names outside the enum come from the user only as a limitation discussion:
explain that the host cannot honor them and offer the enum or `inherit`
alternatives; never silently substitute.

## Verification

No binding documents a `--stats` procedure on this surface: state that the
option is unsupported rather than promising it. Antigravity does not report
the effective underlying model via host metadata or subagent completion
events, and host-level substitution is undetectable from runtime responses:
the requested enum selection is all that can be recorded, and the effective
underlying model stays unconfirmed. Never trust a child's self-reported
model name.

This reference is selected from the actual runtime/tool surface, not from
the session's model name. A surface that is not Antigravity does not use it;
an unknown surface reports a limitation instead of inventing tools.
