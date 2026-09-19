# Architecture

This release packages three independent capabilities for OpenCode V2: an
autonomous development workflow, a source lookup skill, and a pull-request
description skill. The workflow has two boundaries: a portable orchestration
protocol and the concrete OpenCode integration that runs that protocol today.

## Portable orchestration protocol

The protocol is the behavior that does not depend on a particular model:

- split a long goal into one small, verifiable task at a time;
- run worker and independent reviewer rounds sequentially;
- give each round a bounded, fresh context and a compact input contract;
- persist decisions, evidence, acceptance state, and exactly one next action in
  repository handoff files;
- use explicit reset, escalation, retry, and stop conditions;
- keep implementation, review, deep audit, exploration, and consultation as
  separate responsibilities;
- obey the user's and target repository's git persistence policy.

`skills/autonomous-mode/SKILL.md` is the canonical executable description of
that protocol in this release. The project being operated on owns its
`BACKLOG.md` and `docs/handoffs/active.md`; this source repository's files with
those names are only its own development state.

## OpenCode V2 binding

The OpenCode profile bundle contains:

- `agents/autonomous/*.md` binds protocol roles to OpenCode subagents, step
  limits, and tool permissions;
- `skills/autonomous-mode/SKILL.md` supplies discovery metadata and routes
  rounds through the installed `autonomous/*` agent IDs;
- `commands/autonomous.md` binds `/autonomous` to starting a supplied goal or
  resuming the active handoff with the built-in `build` agent.
- `skills/source-code-lookup/SKILL.md` guides source inspection for dependencies
  and related codebases. It can be used in an ordinary OpenCode task without
  `/autonomous`, its agents, or its handoff files.
- `skills/pull-request-description/SKILL.md` guides the content of a PR body.
  It is deliberately independent of GitHub or other mechanical PR-creation
  automation, so it can be applied wherever a PR description is written.

The profile installer maps those paths into the user's OpenCode configuration.
The autonomous-mode skill sets `metadata.opencode/autoinvoke: false` and `slash: false`, so
OpenCode loads it through `/autonomous` without advertising it for ordinary
requests or creating a second slash entry. The installer does not install
repository contributor guidance, tests, handoffs, or documentation.
`scripts/validate.mjs` enforces the exact seven agents, three skills, and one
command as the complete bundle.

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
accepts the previous v1 nine-file and v2 ten-file copy states, plus the prior
three-link and four-link states, so existing profiles can update or uninstall.

## Future adapter boundaries

Other coding harnesses are not supported by this release. A later adapter
should preserve the protocol while translating only these integration points:

1. role discovery and role-specific instructions;
2. fresh child-context creation and sequential invocation;
3. read-only/edit/subagent/question capability enforcement;
4. per-role step or effort budgets and optional model selection;
5. skill or command entry points;
6. profile-level installation, update, and removal conventions.

An adapter must document which guarantees are enforced by the harness and
which are only prompt conventions. Shared prose or generated manifests may be
worth extracting after a second working adapter establishes the real common
contract; this v0.1 keeps one hand-maintained OpenCode implementation rather
than adding speculative generation machinery.

## Safety and state boundaries

The coordinator is intentionally thin: durable state is written to the target
repository before a child context ends. The profile bundle never grants itself
authority to push, publish, or override project instructions. The installer
owns only paths recorded in `.autonomous-mode-install.json`, refuses unsafe
profile/source overlap and linked managed ancestors, backs up explicit
replacements, and preserves modified content during uninstall.

The target project's `AGENTS.md` is optional. When present, worker and review
rounds read it for local conventions; when absent, round prompts skip it.
