# OpenCode V2 runtime binding

## Invocation surface

The installer ships two OpenCode command entries with the profiles and skills:
`commands/work.md` and `commands/autonomous.md`. Each explicitly loads the
matching skill by its exact ID and passes the command arguments through, so
`/work` and `/autonomous` in the OpenCode TUI are the user-facing entry points.
OpenCode does not interpret the skills' `slash` field; without the command
entries the explicit-only skills have no invocation surface on this host. The
session that receives a command entry is the coordinator.

## Surface and direct child dispatch

OpenCode V2 is the only currently planned mandatory shim. Its documented
subagent interface selects a configured agent and has no documented per-call
model override, so this binding does not dispatch a model directly. Instead the
configured routes are materialized as generated agent profiles, and a "direct
child dispatch" means the coordinator invokes the child tool naming the
preconfigured agent profile for that routing key.

- Dispatch field: the child tool takes a configured agent/profile identifier, not
  a free model string. The exact tool schema must be verified in the spike;
  retain the profiles unless that check demonstrates they are unnecessary.
- Model and effort: encoded inside the generated profile, not on the call. The
  profile carries the model (provider-qualified, `provider/model[#variant]` form)
  and the reasoning effort for that route.

The compatibility mapping from routing key to generated OpenCode profile is:

| Routing key | OpenCode profile ID |
| --- | --- |
| `explore` | `agenticale/explore` |
| `implement` | `agenticale/implement` |
| `implement-hard` | `agenticale/implement-hard` |
| `fix` | `agenticale/fix` |
| `review` | `agenticale/review` |
| `deep-review` | `agenticale/deep-review` |
| `consult` | `agenticale/consult` |

`implement` and `implement-hard` are separate generated profiles that select the
same underlying implementation task contract with different routing context; the
difference is routing, not instructions. There are seven generated profiles, one
per routing key.

## Routing bootstrap and profile selection on this surface

At activation, follow the shared bootstrap in `ROUTING.md`:
discover personal and project `routing.md` files, interpret the active
`opencode` runtime preferences, apply explicit invocation choices, and resolve
this runtime's seven routes once for the activation. Precedence is invocation,
project, personal, then installed baseline. Do not scan unrelated files.
Invocation choices are session-scoped and do not persist to `routing.md` or a
preference file.

Before dispatch, compare each resolved selection with the actual profile's
`model` and `reasoningEffort` fields. The profile is the installed state; no
second resolved-policy file is needed. Dispatch only a matching profile. If
none matches, report the limitation and follow the explicit preparation and
refresh procedure below. When the activation selected a routing profile, the
comparison runs against that profile's named set — see the next section.

## Named routing sets on this surface

The seven default generated profile IDs (`agenticale/<role>`) are unchanged.
When a routing profile is selected for the activation — with `--profile NAME`
or an unambiguous natural-language instruction per the routing contract — the
activation resolves its routes with that profile, and the coordinator must use
an explicitly prepared **named set**: additional user-owned agent files in
the namespace `agents/agenticale/routing/<profile>/<role>.md`, with dispatch
identifier `agenticale/routing/<profile>/<role>` (for example
`agenticale/routing/server-b/implement`). Each named-set profile carries the
selected profile's resolved model and effort for that role.

Named sets live in the same target directory the installer uses
(`XDG_CONFIG_HOME/opencode`, otherwise `~/.config/opencode`), but they are
outside the installer's ownership. The current installer generates and
manages only the flat default seven under `agents/agenticale/` — its
install-state validation rejects nested named-set paths — so it never
creates, refreshes, or touches named-set files. Preparing or refreshing a
named set is a manual, explicit, user-approved action. Selecting a profile
never invokes or changes the installer, the default profiles,
`opencode.jsonc`, or any global host configuration.

**Host acceptance of the `agenticale/routing/...` identifier namespace is not
verified in this environment.** Before dispatching to a named set, the
coordinator must confirm that the host accepts the identifier — the child tool
resolves it to the intended prepared profile, and the available-agents
listing shows it — and record that confirmation in the session. If the host
does not accept it, report the limitation with the exact preparation steps
instead of dispatching.

Selection rule: dispatch a named-set profile only when it matches the routing
key **and** the current resolved selection — the same model/effort comparison
as the procedure below. If the named set is missing a file or stale (its
prepared values differ from the currently resolved selection, for example
because routing files changed since preparation), report the missing or stale
routes with the exact preparation steps. Never fall back to the default
`agenticale/<role>` set for a selected profile, and never treat a
default-set profile as a substitute for a named one. The exact preparation
steps reported for a missing or stale named set:

1. Resolve the requested routes with the selected profile:

   ```sh
   node scripts/routing.mjs resolve --runtime opencode \
     --input <ordered-structured-layers.json> --profile <name>
   ```

   The output is the version-1 OpenCode policy: seven routes, each an
   explicit selection or an intentional inheritance.

2. For each route, create or refresh `agents/agenticale/routing/<name>/<role>.md`
   by mirroring the matching default profile `agents/agenticale/<role>.md` —
   the same `description`, `mode`, `steps`, `permissions`, and
   task-contract body — but with the `model:` and `reasoningEffort:` lines
   set from that route's resolved selection. Omit both lines for an
   `inherit` route so the prepared profile inherits the session model. These
   are user-owned files outside the installer's management; the installer
   does not create, refresh, or remove them.
3. Start a new OpenCode session; confirm the host accepts the
   `agenticale/routing/<name>/<role>` identifiers — they appear in the
   available-agents listing and the child tool resolves them to the intended
   prepared profiles — and record the confirmation in the session. If the
   host does not accept them, report the limitation with these exact steps
   and do not dispatch.
4. Before dispatch, compare each route's requested selection with the
   prepared file's `model` and `reasoningEffort`; report missing or stale
   routes with these exact steps. Never fall back to the default
   `agenticale/<role>` set for a selected profile.

## OpenCode preparation and refresh

Use this procedure when no installed profile matches. Reading preferences
never rewrites active profiles or host-wide model configuration.

1. **Resolve the requested routes.** From the installed `skills/work`
   directory, use the packaged resolver with the ordered structured layers
   interpreted from personal Markdown, project Markdown, and any invocation
   preferences. This preserves persistent customizations when preparing the
   active profiles:

   ```sh
   node scripts/routing.mjs resolve --runtime opencode --input <ordered-structured-layers.json>
   ```

   The output is a complete version-1 OpenCode policy: seven explicit routes
   or intentional inheritance.
2. **Compare with the active profiles.** Read the `model` and
   `reasoningEffort` frontmatter of each `agents/agenticale/<role>.md` profile
   in the OpenCode target directory. If profiles are unavailable or unreadable,
   report the comparison as a limitation and do not dispatch as if matched.
3. **Use a matching profile.** A route matches when the profile's model and
   effort equal the requested selection; an `inherit` request matches a
   profile with no `model` line. Dispatch it by its profile ID from the
   mapping above. Before promising an ordered fallback, check that each
   requested fallback pair also has a matching preconfigured profile; a
   fallback without a matching profile cannot be honored on this surface.
4. **Otherwise, save the resolved policy.** Write the output from step 1 to
   an explicit preparation path outside project workflow state and tell the
   user where it is:

   ```sh
   node scripts/routing.mjs resolve --runtime opencode \
     --input <ordered-structured-layers.json> > <preparation-path>/resolved-policy.json
   ```
5. **Refresh with the existing checkout-based installer.** This is the only
   step that needs the AgenticAle source checkout (the preparation
   dependency; obtain one by cloning
   `https://github.com/alefranz/AgenticAle`). Preference reading and task
   resources stay install-relative. Rerun the existing OpenCode
   `install` command against the resolved policy:

   ```sh
   node <AgenticAle-checkout>/scripts/install.mjs install --routing <preparation-path>/resolved-policy.json
   ```

   with any explicitly chosen target options — `--target PATH` for a
   non-default OpenCode profile directory (default `XDG_CONFIG_HOME/opencode`,
   otherwise `~/.config/opencode`) and `--source-root PATH` for the
   source-code-lookup skill. The installer rebuilds the full generated
   OpenCode bundle (all seven profiles, the command entries, and the skills)
   from the supplied policy under its normal ownership, backup, collision, and
   rollback safeguards; a profile the user has modified is reported
   (`preserve-modified`) and left in place until the user explicitly approves
   replacement with `--replace`, which backs it up first.
6. **Activate, then re-check.** The installer's completion message is the
   activation step: restart OpenCode (a new session picks up the refreshed
   profiles) — the installer leaves `opencode.jsonc` unchanged. Do not treat
   refreshed profiles as effective until the host's verified reload or
   new-session behavior confirms it, and check requested versus installed
   selections again (step 2) before dispatch.

## Requested versus effective settings

The selected profile's model and reasoning effort carry the requested
selection; what a profile actually resolves to depends on the account's model
availability. Keep an unknown effective setting unknown, and do not treat a
profile as refreshed mid-task unless the host's verified reload or new-session
behavior confirms it.

## How `inherit` is realized

Because the shim can only select preconfigured profiles, `inherit` on OpenCode is
realized by the generated profile carrying no forced model of its own, so the
child runs on the session model rather than a pinned one. In practice every
packaged OpenCode route is explicit (materialized as a profile with a concrete
model/effort), so `inherit` is expressed by a profile that defers to the session
model. Do not attempt to express `inherit` by omitting a per-call model field;
the native tool does not accept a per-call model override.

## Caller and session overrides

An explicit user/task override can only select a matching preconfigured
profile. Because the native tool only selects preconfigured profiles, arbitrary
task-time model overrides cannot be promised: use a matching installed route,
or route the change through the explicit preparation/refresh path in
`ROUTING.md`; do not change global model configuration mid-task. Overrides
supplied at task time stay within the session and do not rewrite
`routing.md` or any preference file.

## Session usage summary (opt-in)

The `--stats` option is supported on this surface. The coordinator process's
`OPENCODE_SESSION_ID` environment variable identifies the coordinator session.
After the final diff and acceptance checks and before the delivery report, run
the skill's own stats helper from the installed `skills/work` directory — the
environment variable supplies the session id, so no argument is needed:

```sh
node scripts/session-stats.mjs
```

Include its summary, or a compact excerpt when the table is large, in the
final report. The helper issues only read-only API queries against the
running OpenCode server and changes nothing. If the server is unreachable,
report that the summary could not be produced and continue with the
remaining delivery.

## Limitations (stated honestly)

- Task-time arbitrary model overrides are not supported. The child tool selects
  a preconfigured profile, so a caller cannot name an arbitrary model at task
  time. To change routes, regenerate the generated shim; a requested model with
  no matching profile is reported as a limitation, not silently substituted.
- Generated profiles are the source of the effective model. What a profile
  actually resolves to depends on the generated artifact and the account's model
  availability. The baseline inventory in `examples/` is a mapping reference, not
  proof of current account access.
- Per-call selection is unconfirmed. The documented interface has no per-call
  model override. If the spike shows OpenCode supports per-call selection and
  permissions/step behavior remain correctly represented, the model-only shim can
  be removed; until that check passes, retain the profiles.
- Do not change global model configuration mid-task. Route changes go through
  regenerating the profiles, not by editing a global setting while a task runs.
- Fallback chains are not executed. A requested fallback list is preserved in
  the version-1 export, but the seven-profile adapter materializes exactly one
  model per role; it cannot materialize multiple models for one role or execute
  an arbitrary fallback chain. A fallback is honored only when a matching
  preconfigured profile exists, and that availability is checked before the
  fallback is promised.
- Profile refresh in the first release requires the existing checkout-based
  installer (the preparation dependency in the procedure above). Source-free
  automatic profile refresh is a later extension, and automatic in-workflow
  refresh is deferred until reload behavior and ownership integration have been
  verified.
- Named-set identifier acceptance is unverified. Host acceptance of the
  `agenticale/routing/<profile>/<role>` namespace is not verified in this
  environment; the coordinator confirms it in the session before dispatch and,
  when the host does not accept it, reports the limitation with the exact
  preparation steps.
- Profile selection never regenerates profiles implicitly. The current
  installer generates only the default seven — its install-state validation
  rejects nested named-set paths — so named-set preparation and refresh are
  manual, and automatic named-set refresh is a later extension; selecting a
  profile changes no installed profile, `opencode.jsonc`, or global host
  configuration.
- Stale or missing named sets are reported, not substituted. A selected
  profile whose named set is missing or out of date is reported with the exact
  preparation steps; it is never silently served by the default
  `agenticale/<role>` set.

The skill selects this binding from the actual runtime/tool surface, not from the
chosen language model. A surface that is not OpenCode V2 does not use this
binding; an unknown surface reports a limitation instead of inventing tools.
