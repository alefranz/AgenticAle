# Antigravity model discovery (configure)

Covers Google Antigravity desktop IDE and `agy` CLI. Dispatch rules live in [the Antigravity runtime binding](../../../work/references/runtimes/antigravity.md).

## Detection

Detect from the tool surface (never the session model name): presence of the `invoke_subagent` tool.

## Model selection surface — fixed enum

`invoke_subagent`'s `Model` parameter accepts **only** `inherit`, `flash_lite`, `flash`, or `pro`. No enumeration is needed, and arbitrary concrete model IDs or external provider strings cannot be honored — treat user-supplied concrete IDs only as a limitation discussion and offer `inherit` or an enum token instead.

Antigravity has no reasoning-effort parameter for subagents: never propose `#variant` or comma-effort values here.

Enum tier names suggest a capability ordering, which is a labelled heuristic proposal, not a verified capability or cost ranking. `inherit` runs children on the active UI/CLI session model (session-model-everywhere or `inherit` throughout is valid and is the way to use models outside the enum).

## What configure proposes here

Preference-file role lines using only the enum tokens above (e.g., `- explore: flash_lite`, `- review: pro`), with no variant.

## Verification

`--stats` is **not** supported here; state that explicitly. Antigravity does not expose the effective underlying model in host metadata or completion events (host substitution is undetectable), so only the requested enum selection can be recorded and the effective model stays unconfirmed. Never trust a child's self-reported model name.
