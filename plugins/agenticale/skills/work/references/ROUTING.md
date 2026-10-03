# Routing contract

The routing policy maps each task difficulty (a routing key) to a model and
reasoning effort, per runtime. It is a versioned JSON contract authored under
`references/routing.json`. The bundled policy is the packaged host preset that
the coordinator falls back to when no caller or selected file overrides a route.

The packaged defaults are baseline-inventory values derived from `examples/`
(gpt-6 family). They are unverified against any live account or runtime in this
documentation-only pass, are validated per host, and are overridable per route
(via `--routing PATH` or a task-time override), or bypassed entirely with
`--no-model`.

## Schema

Top-level shape:

```json
{ "schemaVersion": 1, "runtimes": { "<runtime>": { "<key>": { ... } } } }
```

- `schemaVersion`: must be `1` for the policies in this package.
- `runtimes`: a map of runtime key to a route map. Supported runtime keys are
  `copilot`, `codex`, and `opencode`.
- Each runtime entry maps each of the seven routing keys to a route entry.

## The seven keys

A complete policy must contain all seven keys for every runtime it declares:

`explore`, `implement`, `implement-hard`, `fix`, `review`, `deep-review`,
`consult`.

`implement` and `implement-hard` share the same implementation task contract;
they differ only in routing (a harder route). Each is an independent profile;
a missing key in a complete policy is an error.

## The two modes

Each route entry uses exactly one mode:

- `explicit`: names a concrete choice.
  `{ "mode": "explicit", "model": "<model>", "reasoningEffort": "<effort>", "fallbacks": [] }`
  - `model`: a non-empty model identifier valid for that runtime. For OpenCode this
    is a provider-qualified id in `provider/model[#variant]` form.
  - `reasoningEffort`: one of `low`, `medium`, `high`, `xhigh`, `max`.
  - `fallbacks`: required ordered list of `{ "model", "reasoningEffort" }` pairs
    to try in order if the primary cannot be honored. Use `[]` for no fallbacks;
    the field must be present.
- `inherit`: omits model/effort on purpose.
  `{ "mode": "inherit" }`
  The child runs on the session's current model and effort. `inherit` is an
  explicit, intentional choice, not a missing value and not a fallback. It is the
  only field an `inherit` entry may carry.

`"inherit"` is not a valid effort value; inheritance is expressed only by
`mode: inherit`.

## Routing precedence

For each round, the coordinator resolves a route in this order, first match wins:

1. An explicit user or task override for that route.
2. An explicitly selected project or user routing file (a complete policy supplied
   via `--routing PATH`).
3. The packaged host preset (the bundled `routing.json`).

Do not scan unrelated files for overrides. A caller may override any individual
route without replacing the rest of the selected policy; task-time overrides are
session-scoped and do not persist to any routing file.

## `--routing PATH` vs `--models PATH|PRESET`

- `--routing PATH` selects the new versioned policy. The file must be a complete
  policy: all seven keys per declared runtime. Conflicting routing inputs
  (more than one routing source) are rejected.
- `--models PATH|PRESET` is the legacy import path for existing
  `provider/model[#variant]` maps (the style in `examples/`). A legacy map may be
  partial; import converts any omitted key to explicit inheritance and reports
  that conversion. Do not conflate a legacy partial map's omission (converted to
  inheritance and reported) with a missing key in a new complete policy (an
  error). Preset aliases are preserved and availability is validated per target.

## Validation rules

The following are errors, not silently coerced:

- Unknown keys: a routing key that is not one of the seven, or a runtime key that
  is not `copilot`, `codex`, or `opencode`.
- Wrong types: a route entry that is not an object, a `model` that is not a
  non-empty string, a `reasoningEffort` that is not a string, or a `fallbacks`
  that is not an array of `{ "model", "reasoningEffort" }` pairs.
- Empty identifiers: an empty `model` (or an empty `model`/`reasoningEffort` in a
  fallback pair).
- Contradictory fields: an `inherit` route that also carries `model`,
  `reasoningEffort`, or `fallbacks`; an `explicit` route that omits `model` or
  `reasoningEffort`; a `schemaVersion` other than `1`.
- Unsupported effort values: any `reasoningEffort` outside `low`, `medium`,
  `high`, `xhigh`, `max` (including the string `"inherit"`).

Exact native field names and the set of supported effort levels on a given host
are adapter concerns; the policy validates the policy-level shape, and each
runtime binding validates identifiers per host.

## Compatibility mapping to OpenCode profiles

| Routing key | Task reference | OpenCode profile ID |
| --- | --- | --- |
| `explore` | `explore.md` | `autonomous/explore` |
| `implement` | `implement.md` | `autonomous/implement` |
| `implement-hard` | `implement.md` (hard-task routing context) | `autonomous/implement-hard` |
| `fix` | `fix.md` | `autonomous/fix` |
| `review` | `review.md` | `autonomous/review` |
| `deep-review` | `deep-review.md` | `autonomous/deep-review` |
| `consult` | `consult.md` | `autonomous/consult` |

OpenCode is the only mandatory shim: these seven routes are materialized as
seven generated agent profiles, and per-call model overrides are bounded by the
preconfigured profiles (see `runtimes/opencode.md`).
