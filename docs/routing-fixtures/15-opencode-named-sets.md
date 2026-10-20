# Fixture 15 — OpenCode named routing sets (stale and missing)

A selected routing profile on OpenCode requires an explicitly prepared named
set in `agenticale/routing/<profile>/<role>`. Here the prepared set exists but
is stale for one route and missing for another. Stale or missing routes are
reported with the exact preparation steps; nothing falls back to the default
set. Active runtime is `opencode`.

## Setup

Project root `.agenticale/routing.md`:

```markdown
# AgenticAle model routing

## opencode

### Tiers

| Tier | Model | Reasoning effort |
| --- | --- | --- |
| fast | openai/gpt-6-luna | medium |
| routine | openai/gpt-6-luna | high |
| standard | openai/gpt-6.1-sol | high |
| deep | openai/gpt-6.1-sol | xhigh |

## Profile: server-b

### opencode

#### Tiers

| Tier | Model | Reasoning effort |
| --- | --- | --- |
| fast | openai/gpt-6-nebula | medium |
| routine | openai/gpt-6-nebula | high |
```

No `~/.agenticale/routing.md`. A prepared named set exists at
`agents/agenticale/routing/server-b/` in the OpenCode target directory,
prepared from an earlier resolution:

| Prepared file | Prepared model / effort | Compared to the current resolution |
| --- | --- | --- |
| `explore.md` | openai/gpt-6-nebula / low | stale (effort differs: low vs medium) |
| `implement.md` | openai/gpt-6-nebula / high | matches |
| `fix.md` | — | missing (no file) |
| `implement-hard.md` | openai/gpt-6.1-sol / high | matches |
| `review.md` | openai/gpt-6.1-sol / high | matches |
| `deep-review.md` | openai/gpt-6.1-sol / xhigh | matches |
| `consult.md` | openai/gpt-6.1-sol / xhigh | matches |

The default set (`agents/agenticale/<role>.md`) is installed and unchanged.

## Expected effective selections (opencode, `--profile server-b`)

Recorded invocation: `/work --profile server-b <task>`.

| Role | Selection | Requested model / effort | Provenance |
| --- | --- | --- | --- |
| explore | tier `fast` | openai/gpt-6-nebula / medium | role: default mapping; tier: repo routing.md (profile server-b) |
| implement / fix | tier `routine` | openai/gpt-6-nebula / high | role: default mapping; tier: repo routing.md (profile server-b) |
| implement-hard / review | tier `standard` | openai/gpt-6.1-sol / high | role: default mapping; tier: repo routing.md |
| deep-review / consult | tier `deep` | openai/gpt-6.1-sol / xhigh | role: default mapping; tier: repo routing.md |

## Expected coordinator behavior

- `explore` and `fix` are reported, not dispatched: the prepared named set is
  stale for `explore` (prepared effort `low` vs resolved `medium`) and
  missing for `fix`. The report carries the exact preparation steps:
  1. Resolve the routes with the selected profile:
     `node scripts/routing.mjs resolve --runtime opencode --input <ordered-structured-layers.json> --profile server-b`
  2. Create or refresh each `agents/agenticale/routing/server-b/<role>.md`
     profile by mirroring the matching default profile
     `agents/agenticale/<role>.md` with the resolved model and effort for
     that role (user-owned files outside installer management; the installer
     never creates or refreshes named sets).
  3. Start a new OpenCode session, then confirm the host accepts the
     `agenticale/routing/server-b/<role>` identifiers before dispatch.
- No dispatch on any route falls back to the default `agenticale/<role>` set
  for the selected profile; a default-set profile is never a substitute for a
  named one.
- The matching named-set routes (`implement`, `implement-hard`, `review`,
  `deep-review`, `consult`) proceed to dispatch only after the host's
  acceptance of the `agenticale/routing/...` identifier is confirmed in the
  session — the child tool resolves the identifier to the intended prepared
  profile and the available-agents listing shows it — with that confirmation
  recorded. Acceptance of the identifier namespace is not verified yet; if
  the host does not accept it, the limitation is reported with the same
  preparation steps.
- Selecting the profile changed no installed default profile,
  `opencode.jsonc`, or global host configuration; nothing was regenerated
  implicitly.

Effective settings are unknown unless the host exposes native dispatch
metadata.
