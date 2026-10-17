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
  subagents. Explicit routes and fallback pairs on Antigravity do not carry
  `reasoningEffort`.

Child subagents receive their bounded task contract and instructions directly in
their invocation prompt.

## Routing bootstrap on this surface

At activation, follow the shared bootstrap in `ROUTING.md`: discover personal and
project `routing.md` files, interpret the active runtime's preferences, apply
invocation choices, and resolve this runtime's routes once for the activation.
The preference section uses the `antigravity` runtime name. Precedence is
invocation, project, personal, then installed baseline. Do not scan unrelated
files. Invocation choices are session-scoped and do not persist to a preference
file or `routing.md`.

## Requested versus effective settings

The per-dispatch `Model` field carries the snapshot's requested enum selection
(`flash`, `pro`, or `inherit`). Antigravity does not report the effective
underlying model via host metadata or subagent completion events. A child's
self-reported model name in conversation or prompt output cannot be trusted to
establish the effective model. Treat the effective underlying model as
unconfirmed by host metadata.

## How `inherit` is realized

When the resolved route for a key is `mode: inherit`, the coordinator dispatches
the child subagent with `Model: "inherit"`. With `Model: "inherit"`, the child
subagent executes using the session's active model rather than a fixed tier
selection.

This enables users to run models outside the fixed enum—such as Gemini 4 Argon or
Claude Sonnet—for specific roles or all roles by configuring the session model
in the Antigravity UI or CLI, and routing those roles to `inherit` in `routing.md`
(for example, via `tier: inherit` or role overrides). `inherit` is an explicit,
intentional choice; it is not a fallback and not a missing value.

## Caller and session overrides

An explicit invocation choice wins over discovered preference files for the
entries it names; every other entry still resolves from the discovered files and
the installed baseline. Invocation choices stay within the session and never
rewrite `routing.md` or any preference file. Because Antigravity has no
reasoning-effort controls, build-time `--effort` overrides skip this runtime.

## Limitations (stated honestly)

- Fixed tier enum only. `invoke_subagent` only accepts the `Model` enum values
  (`inherit`, `flash_lite`, `flash`, `pro`). Arbitrary concrete model identifiers
  cannot be passed to child subagents.
- No reasoning-effort control. The host provides no per-call or per-agent
  reasoning-effort parameter for subagents. Explicit routes and fallback pairs
  on Antigravity must not include `reasoningEffort`.
- Undetectable host substitution. Because Antigravity host metadata does not
  report the effective model executing the subagent, any host-level substitution
  or fallback cannot be reliably detected from runtime responses.
- Automated testing is local and deterministic. All routing resolution and
  validator checks run offline without network access or live host invocation;
  live routing dispatch on an active Antigravity session is not tested in
  automated regression checks.

The skill selects this binding from the actual runtime/tool surface (`invoke_subagent`),
not from the chosen language model. A surface that is not Antigravity does not use
this binding; an unknown surface reports a limitation instead of inventing tools.
