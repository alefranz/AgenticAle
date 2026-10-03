# Codex runtime binding

## Surface and direct child dispatch

This binding covers the Codex CLI and the official Codex VS Code extension. Both
support skills and subagents, so they share one binding here. The official Codex
extension does not support plugins, so the skills are installed there as
standalone `.agents/skills` folders rather than through a plugin.

A "direct child dispatch" on this surface means the coordinator spawns a fresh
child subagent and passes an explicit model and an explicit reasoning setting as
native per-spawn fields. Codex documents explicit per-spawn model and reasoning
choices.

- Model field: the per-spawn model selection on the child. The exact native field
  name is an adapter concern to confirm against the actually exposed spawn tool
  live; do not assume a fixed property name.
- Reasoning field: the per-spawn reasoning/effort selection, drawn from the
  documented set `low`, `medium`, `high`, `xhigh`, `max`. Which levels are
  accepted on a given version is an adapter concern to confirm live.

Fresh-context and model-override compatibility must be checked against the actual
exposed spawn tool. Live verification is documentation-only for this pass and is
not tested here.

## Routing precedence on this surface

Route resolution for each round follows the shared precedence, in order:

1. An explicit user or task override for that route.
2. An explicitly selected project or user routing file (a complete
   `schemaVersion` 1 policy supplied via `--routing PATH`).
3. The packaged host preset (the bundled `routing.json`).

Do not scan unrelated files for overrides. A caller may override any individual
route without replacing the rest of the selected policy. Task-time overrides are
session-scoped and do not persist to the routing file.

## How `inherit` is realized

When the resolved route for a key is `mode: inherit`, the coordinator omits the
model/reasoning field on the child spawn. With the field omitted, the child runs
on the session's current model and effort rather than a forced one. `inherit` is
an explicit, intentional choice; it is not a fallback and not a missing value.

## Caller and session overrides

An explicit user/task override for a route wins over the selected policy for that
route only; all other routes still resolve from the policy. Overrides supplied at
task time stay within the session and do not rewrite `routing.json` or any
project/user routing file. If the caller supplies conflicting routing inputs
(more than one routing source, or a routing policy that conflicts with a legacy
`--models` import), the inputs are rejected rather than merged.

## Limitations (stated honestly)

- Custom agent files can override the spawn choices. Codex's custom agent files
  can override the explicit model and reasoning choices, so the default adapter
  should avoid depending on installed custom profiles. Do not assume the resolved
  route survives if a custom agent file in the project pins its own model.
- Per-call model override is unconfirmed against the live tool. Whether the
  exposed spawn tool actually accepts a per-call model override (as opposed to a
  configured profile) must be checked on the real tool schema. Do not promise
  strict enforcement the host cannot confirm.
- Fresh-context behavior is unconfirmed. Whether the spawn gives a genuinely fresh
  context on each call, and whether model-override and fresh-context compose,
  must be verified live; treat these as unconfirmed until then.
- Per-surface parity is unconfirmed. The CLI and the official extension are
  expected to align, but each must be smoke-tested on its own. Do not equate the
  official Codex extension with the separate experimental Codex integration in VS
  Code Agent Host; they are different surfaces.
- Reasoning-level support is unconfirmed per version. Support only verified
  reasoning levels on a target; reject or apply an explicitly configured fallback
  for an unsupported level rather than assuming it is honored.

The skill selects this binding from the actual runtime/tool surface, not from the
chosen language model. A surface that is not the Codex CLI or the official Codex
VS Code extension does not use this binding; an unknown surface reports a
limitation instead of inventing tools.
