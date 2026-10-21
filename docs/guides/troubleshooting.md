# Troubleshooting

If `/work`, `/review`, or `/autonomous` is not found, restart the client after
installation. For OpenCode, restart OpenCode; for Copilot, restart the Copilot
session; for Antigravity, restart the CLI or desktop app session. OpenCode uses
generated command entries; other clients discover the installed skills through
their own skill or plugin interface. See [setup](../setup.md) for installation.

If an OpenCode child stops for approval or cannot resume, review the configured
permissions below. Child actions need preconfigured allow or deny rules so they
can finish without an interactive prompt. Continue `/work` from its retained
session — an incomplete stop report carries a copy-pasteable continuation
prompt for a fresh session — or rerun `/autonomous` to resume its durable
handoff; only Autonomous persists recovery state on disk.

If a model cannot be found, check that its identifier is available in your
account and inspect the Markdown routing file. Plugin users can edit Markdown
and start a new `/work`, `/review`, or `/autonomous` activation. OpenCode users may need to
refresh generated profiles; see the
[model routing guide](model-routing.md#opencode-profile-refresh). For a quick
routing trial, use `--no-model` and then create a `routing.md` preference file.

## Provider quota exhaustion

When a host or provider explicitly reports that a usage quota or rate limit is
exhausted, Work stops and reports the affected role, evidence, partial work,
unchecked work, and any retry or reset details supplied by the host. Inspect
the working tree before resuming so partial changes are preserved. Work does
not automatically wait, retry, change the route, or create durable cooldown
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
