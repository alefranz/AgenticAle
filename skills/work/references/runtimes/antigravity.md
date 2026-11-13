# Antigravity runtime binding

## Surface and direct child dispatch

This binding covers the Google Antigravity desktop IDE (observed 2.23.1) and the
Antigravity CLI `agy` (observed 1.3.5). Both surfaces share the user-level plugin
directory `~/.gemini/config/plugins/agenticale` (or `%USERPROFILE%\.gemini\config\plugins\agenticale`
on Windows) where AgenticAle is installed as a plugin.

The coordinator detects this runtime by the host surface and tools—specifically
the presence of the `invoke_subagent` tool—never by the model name running the
session.

A "direct child dispatch" on this surface means the coordinator invokes a fresh
child subagent via `invoke_subagent`:

- Model field: the `Model` parameter on `invoke_subagent` accepts only a fixed enum
  of values: `inherit`, `flash_lite`, `flash`, and `pro`. The host does not accept
  arbitrary concrete model IDs (such as `gemini-2.5-pro` or external model strings).
- Reasoning field: Antigravity provides no reasoning-effort parameter for child
  subagents. Role assignments on Antigravity do not carry `reasoningEffort`.

Child subagents receive their bounded task contract and instructions directly in
their invocation prompt.

## Model selection on this surface

This host exposes a per-dispatch `Model` field on `invoke_subagent`, but it
accepts only the fixed enum `inherit`, `flash_lite`, `flash`, and `pro`. When a
preference file is present, pass the role's assignment from the active
preference file, provided the assignment names one of the enum values; the
preference file is documented in the "Model configuration (this installation)"
section the installation appends to the skills. If that section is absent from
the loaded skill, there is no preference file and no model selection. When
no assignment exists for a role, dispatch without a model field (the
session default).

## Requested versus effective settings

The per-dispatch `Model` field carries the requested enum selection (`flash`,
`pro`, or `inherit`); Antigravity does not report the effective underlying model
via host metadata or subagent completion events. Keep the effective underlying
model unconfirmed, and do not trust a child's self-reported model name.

## How `inherit` is realized

When the role's assignment is `inherit`, the coordinator dispatches the child
subagent with `Model: "inherit"`. With `Model: "inherit"`, the child subagent
executes using the session's active model rather than a fixed enum selection.

This enables users to run models outside the fixed enum—such as Gemini 4 Argon or
Claude Sonnet—for specific roles or all roles by configuring the session model
in the Antigravity UI or CLI and assigning those roles `inherit` in the
preference file. `inherit` is an explicit, intentional choice; it is not a
fallback and not a missing value.

## Caller and session overrides

An explicit invocation choice wins for the entries it names and stays within
the session; it rewrites no preference file. Because Antigravity has no
reasoning-effort controls, the per-role effort in the flat model config has
no effect on this runtime; there is no build-time or route-wide effort
override to apply.

## Limitations (stated honestly)

- Fixed tier enum only. `invoke_subagent` only accepts the `Model` enum values
  (`inherit`, `flash_lite`, `flash`, `pro`). Arbitrary concrete model identifiers
  cannot be passed to child subagents.
- No reasoning-effort control. The host provides no per-call or per-agent
  reasoning-effort parameter for subagents. Role assignments on Antigravity must
  not include `reasoningEffort`.
- Undetectable host substitution. Because Antigravity host metadata does not
  report the effective model executing the subagent, any host-level substitution
  or fallback cannot be reliably detected from runtime responses.
- Automated testing is local and deterministic. All model-selection checks run
  offline without network access or live host invocation; live dispatch on an
  active Antigravity session is not tested in automated regression checks.

The skill selects this binding from the actual runtime/tool surface (`invoke_subagent`),
not from the chosen language model. A surface that is not Antigravity does not use
this binding; an unknown surface reports a limitation instead of inventing tools.
