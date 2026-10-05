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
| `explore` | `autonomous/explore` |
| `implement` | `autonomous/implement` |
| `implement-hard` | `autonomous/implement-hard` |
| `fix` | `autonomous/fix` |
| `review` | `autonomous/review` |
| `deep-review` | `autonomous/deep-review` |
| `consult` | `autonomous/consult` |

`implement` and `implement-hard` are separate generated profiles that select the
same underlying implementation task contract with different routing context; the
difference is routing, not instructions. There are seven generated profiles, one
per routing key.

## Routing bootstrap and profile selection on this surface

Route resolution for each round follows the shared bootstrap in `ROUTING.md`:
read the installed contract and defaults, discover and read the personal and
project preference files (the `opencode` preference section), apply the
invocation preferences, and resolve the snapshot for this runtime. Precedence
is per named entry, highest to lowest: invocation preferences, repository
routing.md, personal routing.md, installed baseline. Do not scan unrelated
files for preferences. A caller may override any individual route without
replacing the rest; invocation choices are session-scoped and do not persist
to any preference file or to `routing.json`.

Profile-based selection: because the shim dispatches preconfigured profiles
rather than free model strings, check each requested selection against the
installed profiles before dispatch — compare with the installed resolved policy
(`resolved-routing.json`) and the actual profile fields, accounting for
modified profiles; an unavailable comparison is a limitation, not proof of a
match. Dispatch the matching profile by its profile ID from the mapping above.
A mismatched profile leads to the explicit preparation/refresh procedure in
the next section; it is reported with an actionable preparation command and is
never dispatched as if the request was honored.

## OpenCode preparation and refresh

This procedure prepares the requested selections when no matching profile is
installed. It is explicit and read-only with respect to user state: it never
rewrites active profiles or the host's global model configuration as a side
effect of reading `routing.md`.

1. **Resolve the requested routes without the source checkout.** Interpret the
   discovered Markdown per `ROUTING.md`; the AgenticAle source checkout is not
   needed for interpretation. Where Node is available, the packaged
   `routing.mjs` module installed alongside this skill resolves
   deterministically; its default baseline is the installed
   `references/routing.json` beside the module:

   ```sh
   node scripts/routing.mjs resolve --runtime opencode --input <preferences.json>
   ```

   Run this from the installed `skills/work` directory, with structured
   preference JSON on stdin or via `--input`. The output is a complete
   version-1 policy for OpenCode: all seven roles, each an explicit
   model/effort selection (with any requested fallbacks preserved) or
   `inherit`.
2. **Compare requested with installed, from the actual profile fields.** Read
   the installed resolved policy (`references/resolved-routing.json`) and the
   `model` / `reasoningEffort` frontmatter of each
   `agents/autonomous/<role>.md` profile in the OpenCode target directory.
   Compare per role against the profile that is actually present: a profile
   edited after installation differs from the packaged snapshot, so the
   snapshot alone is never proof of a match. If the profiles are unavailable
   or unreadable, report the comparison as a limitation and do not dispatch
   the affected route as if it matched.
3. **Use a matching profile.** A route matches when the profile's model and
   effort equal the requested selection; an `inherit` request matches a
   profile with no `model` line. Dispatch it by its profile ID from the
   mapping above. Before promising an ordered fallback, check that each
   requested fallback pair also has a matching preconfigured profile; a
   fallback without a matching profile cannot be honored on this surface.
4. **Otherwise, export a preparation artifact.** Write the complete version-1
   OpenCode policy from step 1 to an explicit preparation artifact or
   temporary path — one you choose, outside project workflow state, and tell
   the user about:

   ```sh
   node scripts/routing.mjs resolve --runtime opencode \
     --input <preferences.json> > <preparation-path>/resolved-policy.json
   ```
5. **Refresh with the existing checkout-based installer.** This is the only
   step that needs the AgenticAle source checkout (the preparation
   dependency; obtain one by cloning
   `https://github.com/alefranz/AgenticAle`). Runtime preference reading and
   the task resources stay install-relative. Rerun the existing OpenCode
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
`routing.json` or any preference file.

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

The skill selects this binding from the actual runtime/tool surface, not from the
chosen language model. A surface that is not OpenCode V2 does not use this
binding; an unknown surface reports a limitation instead of inventing tools.
