# Troubleshooting

If `/work`, `/review`, or `/autonomous` is not found after installation, let
the client pick up the installed entries. For OpenCode, a running server
reloads installed agents, commands, and skills automatically after a save;
use `/reload` to force a full reload — no app restart is needed. For Copilot,
restart the Copilot session; for Antigravity, restart the CLI or desktop app
session (and verify with `agy plugin list` that `agenticale` is enabled).
OpenCode uses generated command entries; other clients discover the installed
skills through their own skill or plugin interface. See [setup](../setup.md)
for installation.

If an OpenCode child stops for approval or cannot resume, review the configured
permissions below. Child actions need preconfigured allow or deny rules so they
can finish without an interactive prompt. Continue `/work` from its retained
session — an incomplete stop report carries a copy-pasteable continuation
prompt for a fresh session — or rerun `/autonomous` to resume its durable
handoff; only Autonomous persists recovery state on disk.

If a model cannot be found, check that its identifier is available in your
account and that the installation's model configuration names it. On OpenCode
the models are fixed in the generated profiles at install time: rerun the
installer with a different `--models PATH|PRESET` (or `--no-model`)
configuration; the running server reloads the refreshed profiles
automatically (`/reload` forces a full reload), and the next fresh workflow
invocation uses them. On other hosts the
preference file can assign a model per role; edit it and start a new `/work`,
`/review`, or `/autonomous` activation. See the [model configuration
guide](model-routing.md).

## Optional route reported missing on OpenCode

When the workflow reports that a configured optional route (`implement-easy`
or `consult-hard`) cannot dispatch, the install manifest lists the route but
its profile is missing or unreadable: rerun the installer with the same
`--models` configuration to restore it (the running server reloads
automatically; `/reload` forces a full reload). That is different from the
defined fallback when the route was never configured. If the workflow
instead reports that configured intent could not be established, the
ownership manifest (`.autonomous-mode-install.json`) is absent, unreadable,
or ambiguous — for example after a manual profile copy, or with
`agenticale/*` profiles defined in more than one configuration scope. Rerun
the installer into the effective configuration directory to restore both
the profiles and the manifest; unrelated base roles keep working in the
meantime. See [optional routes: omitted versus
missing](model-routing.md#optional-routes-omitted-versus-missing) in the
model configuration guide.

If you customized an optional profile and then reinstalled without that
route, the install succeeds and keeps your modified file
(`preserve-modified`) but drops its manifest entry: the route is omitted,
the workflow falls back to the base route, and the leftover file is never
dispatched. Delete the leftover manually if you want it gone — `--replace`
only replaces profiles the new install generates — and reinstall with the
route configured to use it again.

## Preference file precedence and invalid work allowance

If both the project and the personal preference file exist, the project file
wins; the files are never merged. If the selected preference file carries an
invalid `## Work` worker-round value (zero, a fraction, or a word), the
activation fails with an actionable error naming the file and the value; it
is never silently defaulted and never clamped — set the entry to a positive
integer. See [the preference
file](model-routing.md#other-hosts-the-preference-file) and [Work
worker-round allowance](model-routing.md#work-worker-round-allowance) in the
model configuration guide.

## Provider quota exhaustion

When a host or provider explicitly reports that a usage quota or rate limit is
exhausted, Work stops and reports the affected role, evidence, partial work,
unchecked work, and any retry or reset details supplied by the host. Inspect
the working tree before resuming so partial changes are preserved. Work does
not automatically wait, retry, switch models, or create durable cooldown
state. Missing output, a generic `429`, or an authentication, network, billing,
or account error alone does not confirm quota exhaustion; handle those through
the ordinary error guidance. Autonomous has a separate durable recovery policy.

## OpenCode permissions

The OpenCode installer leaves `opencode.jsonc` unchanged. The foreground agent
needs permission to run the `/work`, `/review`, and `/autonomous` command
entries, load the `work`, `review`, and `autonomous` skills, and launch the
generated `agenticale/*` profiles. Those profile IDs are shared by the
workflows. Child sessions
cannot ask the user questions or launch nested agents, so configure the actions
the task needs to resolve without interactive child prompts and scope the rules
to the task and your environment.

A denied child action must be reported to the coordinator as a blocker. Do not
bypass the denial or retry the action with broader permissions. See the
[OpenCode V2 permissions guide](https://opencode.ai/v2/docs/permissions) for
permission syntax and the detailed
[Autonomous guide](https://github.com/alefranz/AgenticAle/blob/main/docs/autonomous.md#permissions-for-unattended-runs)
for unattended runs.

If the issue concerns client capability, check the
[runtime compatibility matrix](../runtime-compatibility.md), whose entries
remain **not tested** unless live evidence is recorded. For implementation
background, see the [technical architecture guide](../architecture.md).
