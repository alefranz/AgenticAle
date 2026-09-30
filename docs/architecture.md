# Architecture

This release packages everyday reviewed task work, durable autonomous project
work, source lookup, and PR description guidance for OpenCode V2 and GitHub
Copilot. The workflows share a portable round contract and specialist roles,
with generated client bindings.

## Portable orchestration protocol

The protocol is the behavior that does not depend on a particular model:

- split work into small, verifiable tasks when needed;
- run worker and independent reviewer rounds sequentially;
- give each round a bounded, fresh context and a compact input contract;
- pass relevant facts, acceptance state, and one next action to each child;
- use explicit reset, escalation, retry, and stop conditions;
- keep implementation, review, deep audit, exploration, and consultation as
  separate responsibilities;
- obey the user's and target repository's git persistence policy.

`skills/work-mode/references/rounds.md` defines the shared task packet, compact
reports, reset criteria, and review/fix gate. Both coordinator skills explicitly
load it; every build and install includes the reference. The seven worker
profiles follow the supplied state and Git policies rather than loading a
workflow implicitly. Their historical `autonomous/*` IDs remain stable for
existing model mappings and permissions.

The shared contract also requires reading `pull-request-description` before
writing or revising PR bodies and `source-code-lookup` when another codebase's
behavior matters. Commands reinforce these triggers, and task packets pass the
loading rules to fresh children. Discovery metadata alone is insufficient;
the responsible agent reads the full skill instructions. Lookup evidence uses
the active state policy, including child reports for session-only work.

`skills/work-mode/SKILL.md` supplies the everyday policy: optional exploration,
meaningful questions through the coordinator, independent review, session-only
state, and uncommitted changes by default. `/work --pr` (or an equivalent clear
request) authorizes branch, coherent commits, push, and PR creation. Mentioning
PR feedback alone does not. Publication follows review and checks the full
outgoing scope; unrelated existing changes must be preserved.

`skills/autonomous-mode/SKILL.md` adds durable backlog, handoff, archival,
unattended decision, and continuation policies. The target project owns its
`BACKLOG.md` and `docs/handoffs/active.md`; this source repository's files with
those names are only its own development state. Read-only child reports are
persisted by the coordinator. Everyday work does not resume these files or
promise recovery after loss of the host session.

## OpenCode V2 binding

The OpenCode profile bundle contains:

- `agents/autonomous/*.md` binds protocol roles to OpenCode subagents, step
  limits, and tool permissions;
- `skills/autonomous-mode/SKILL.md` supplies discovery metadata and routes
  rounds through the installed `autonomous/*` agent IDs;
- `skills/work-mode/SKILL.md` and its `references/rounds.md` supply everyday task
  coordination and the shared round contract;
- `commands/work.md` binds `/work [--pr] [task]` to the built-in `build` agent;
- `commands/autonomous.md` binds `/autonomous` to starting a supplied goal or
  resuming the active handoff with the built-in `build` agent.
- `skills/source-code-lookup/SKILL.md` guides source inspection for dependencies
  and related codebases. It can be used in an ordinary OpenCode task without
  `/autonomous`, its agents, or its handoff files.
- `skills/pull-request-description/SKILL.md` guides the content of a PR body.
  It is deliberately independent of GitHub or other mechanical PR-creation
  automation, so it can be applied wherever a PR description is written.

The profile installer maps those paths into the user's OpenCode configuration.
Both coordinator skills set `metadata.opencode/autoinvoke: false` and `slash: false`,
so their commands load them without creating duplicate slash entries or
implicitly turning ordinary conversations into orchestrated sessions. The installer does not install
repository contributor guidance, tests, handoffs, or documentation.
`scripts/validate.mjs` enforces seven agents, four skills, one shared reference,
and two commands: fourteen authored bundle files.

OpenCode provides the child-session lifecycle, foreground subagent calls,
permission enforcement, skill discovery, command discovery, and model
inheritance used by this binding. Source agents omit a model so the active
session's configured model is inherited when explicitly selected. For copy
installs, a JSON role-to-model mapping lets the installer render `model`
frontmatter into selected installed agents. Unmapped roles inherit the session
model. The installer requires either that mapping or an explicit `--no-model`
choice; link mode cannot render model overrides and also requires the explicit
choice. `--models` accepts either a path or a bundled preset name; presets are
just checked-in JSON mappings and do not detect provider credentials or model
availability. The mapping accepts only the seven known role names and safe
`provider/model[#variant]` scalar values. Rendered file hashes enter the
ordinary install state, so updates and removal retain the same collision,
backup, and modified-file behavior. The source bundle stays provider-neutral.
For copy installs, `--source-root` renders a local repository root into the
lookup skill. Link installs use its portable `~/dev` default. The installer
uses schema v4 for fourteen-file copy or seven-link installs. It accepts the
previous v1 nine-file, v2 ten-file, and v3 eleven-file copy states, and the prior
three-, four-, and five-link states, so existing profiles can update or uninstall.

## Shared-source build and Copilot binding

The checked-in OpenCode bundle remains the authored source because its files
contain the complete role bodies and protocol. `scripts/build.mjs` reads those
fourteen files and generates two disposable products beneath `dist/`:

- `dist/opencode` preserves OpenCode paths and frontmatter, optionally adding
  provider-qualified model assignments;
- `dist/copilot/agenticale` is an Agent Plugins 1.0 package with portable
  skills and Copilot-specific agents and commands beneath
  `com.github.copilot/`.

Disposable artifacts under `dist/` are ignored and never edited by hand. The
Copilot adapter translates role IDs, removes OpenCode-only skill metadata and
step-limit claims, maps model identifiers by dropping the first provider
prefix, and adds Copilot `model` and `reasoningEffort` frontmatter. It also
generates the visible `agenticale` (AgenticAle) and `agenticale-autonomous`
(AgenticAle Autonomous) coordinators plus seven shared `agenticale-*` workers.
The seventeen-file Copilot package includes both commands, four skills, the
shared reference, nine agents, and its manifest.
`scripts/install-copilot.mjs` builds into a temporary directory and delegates
installation to `copilot plugin install`; the same installed plugin is
discovered by Copilot CLI and VS Code.

Copilot CLI 1.0.87 still accepts local-path plugin installation but marks it
deprecated in favor of marketplace installation. For no-clone installation,
`scripts/publish-default-plugin.mjs` materializes the default generated package
under `plugins/agenticale/` and creates `.github/plugin/marketplace.json`.
Those files are committed but remain derived: CI regenerates them in memory
and fails on any drift. The marketplace is the durable installation path;
direct `OWNER/REPO:PATH` installation remains available while Copilot supports
it. CLI-only development can also load a generated directory ephemerally with
`--plugin-dir`.

The default build reads `examples/gpt.json`, applies each worker's mapped
effort variant (with `high` as fallback), and gives the coordinator the
strongest configured role model at `medium` effort. Use `--effort` to override
the variant for every worker. This accommodates VS Code's rule that a child
model cannot exceed its parent model tier while keeping routine worker calls
on Luna. Model fields are
omitted entirely with `--no-model`, allowing session inheritance and native
Copilot `/subagents` overrides.
`reasoningEffort` is a Copilot CLI custom-agent field. VS Code's local-agent
schema currently documents per-agent models but not per-agent effort, so the
field may be ignored there and the session-level effort control applies.
The generated `work` and `autonomous-mode` skills set `user-invocable: false`:
their coordinator and command can load the protocol without duplicate slash
commands. Select the corresponding coordinator before using its command;
commands supply arguments but do not select an agent or model.

Copilot does not provide OpenCode's per-agent hard `steps` ceiling. The adapter
therefore keeps bounded rounds through the protocol's round budget, task
contract, reset triggers, and the selected state policy. It emits `agents: []` for worker
profiles so clients supporting that field block nested delegation; prompts
retain the same prohibition for other clients. Tool permission equivalence is
not claimed across clients because their tool identifiers and enforcement
surfaces differ.

Future adapters should preserve the protocol while translating only these
integration points:

1. role discovery and role-specific instructions;
2. fresh child-context creation and sequential invocation;
3. read-only/edit/subagent/question capability enforcement;
4. per-role step or effort budgets and optional model selection;
5. skill or command entry points;
6. profile-level installation, update, and removal conventions.

An adapter must document which guarantees are enforced by the harness and
which are only prompt conventions. The Copilot adapter is the first generated
binding; its transformation tests define the shared-source boundary for later
clients.

## Safety and state boundaries

The coordinator is intentionally thin: children receive compact packets and
return reports. Autonomous Mode persists those reports to the target repository;
everyday work keeps them in session context. Git operations follow the user's
requested endpoint and applicable repository instructions. The installer
owns only paths recorded in `.autonomous-mode-install.json`, refuses unsafe
profile/source overlap and linked managed ancestors, backs up explicit
replacements, and preserves modified content during uninstall.

The target project's `AGENTS.md` is optional. When present, worker and review
rounds read it for local conventions; when absent, round prompts skip it.
