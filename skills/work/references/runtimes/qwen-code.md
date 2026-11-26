# Qwen Code runtime binding

## Invocation surface

Qwen Code exposes the skills' `slash` field natively: with the skills
installed, `/work`, `/review`, `/autonomous`, and `/configure` are the
user-facing entry points. No command entries are shipped for this host —
that would create duplicate names for the same surface. The session that
receives a workflow command is the coordinator. Qwen Code has no
session-primary agent concept and no command entries to bind, so the
workflow always runs in the caller session — with or without a configured
coordinator; the coordinator's model and posture arrive through the flat
coordinator agent file (below), and the coordinating session's effective
model is the session's own model.

## Surface and direct child dispatch

Qwen Code is a shim-mandatory host, for a verified reason (Qwen Code
0.28.6): the Agent tool carries **no per-call model parameter by default** —
an external executor builds its `thread/start` request without a model, and
the tool's `model` argument exists only when the user configures
`agents.modelGrades`, in which case it selects a *grade* for unpinned direct
agents and never the native codex model. A child's model (and, for
codex-routed roles, the reasoning effort) is therefore fixed in the
installed agent **definition** at install time, and a "direct child
dispatch" means the coordinator invokes the Agent tool naming the configured
agent, `subagent_type: "agenticale-<role>"`.

- Dispatch field: the Agent tool takes a configured agent name, not a free
  model string.
- Model and effort: encoded inside the installed profile, not on the call.
  Which fields the profile carries depends on the role's model routing
  (below); the profile generation is the mandatory shim.

The compatibility mapping from role to installed agent name is flat — Qwen
Code 0.28.6 scans only the Markdown files directly inside the agents root
(`.qwen/agents/` or `~/.qwen/agents/`), so no nested namespace exists and
agent names accept letters, numbers, hyphens, and underscores only:

| Role | Qwen Code agent name |
| --- | --- |
| `explore` | `agenticale-explore` |
| `implement` | `agenticale-implement` |
| `implement-easy` | `agenticale-implement-easy` (only when configured) |
| `implement-hard` | `agenticale-implement-hard` |
| `fix` | `agenticale-fix` |
| `review` | `agenticale-review` |
| `review-deep` | `agenticale-review-deep` |
| `consult` | `agenticale-consult` |
| `consult-hard` | `agenticale-consult-hard` (only when configured) |

`implement`, `implement-easy`, and `implement-hard` are separate installed
agents that select the same underlying implementation task contract with
different dispatch context; `consult` and `consult-hard` likewise share the
consult contract. The difference is dispatch, not instructions. The seven
base worker profiles are always installed, one per role; the two optional
worker profiles are installed only when the model config lists them. When
the config assigns the coordinator key a Qwen-direct value, the build also
generates the flat `agenticale-coordinator` agent file — it is not a worker
role and never dispatches as a child; a codex-routed coordinator value is
skipped instead (see [Coordinator adoption](#coordinator-adoption)), and
that install carries no coordinator file.

The optional routes follow the shared routing policy: when `implement-easy`
or `consult-hard` is not configured, the workflow dispatches the base route
(`implement` or `consult`) with its existing assignment — a defined
fallback, not a missing-profile error. Optional routes are opt-in
configuration: a leftover agent file preserved from an earlier install does
not make the route configured, and a stale preserved file never dispatches
on its own. When the config DOES list an optional route but its installed
agent file is missing or unreadable, that is an explicitly configured role:
it blocks only that role's dispatch and is reported with the refresh
procedure below, never silently substituted by the base route. Which case
applies is established from the installer's ownership manifest, not from the
available agents alone — see [Establishing configured-route
intent](#establishing-configured-route-intent-from-install-evidence).

## The two materialization forms

The flat model config selects one of two profile forms per role by the
value's provider:

- **Direct provider models.** One `model:` frontmatter line carrying the
  **bare model id** (the provider component is routing information and is
  never rendered — the host resolves the bare id against the model providers
  registered in the user's `settings.json`, such as the local llama
  OpenAI-compatible endpoint or the Qwen Code / Alibaba token plan). The
  profile also carries `maxTurns` (the role's turn ceiling) and the
  `disallowedTools` list rendered from the permission policy. The direct
  form carries the model only: the config value's `#effort` suffix has no
  direct-profile rendering on this host.
- **The codex external executor.** For values under the `openai` provider
  prefix, the profile carries `name`, `description`, `background: false`,
  and the `executor:` block — nothing else: the host rejects (invalid
  config, refusing launch) an external agent that supplies `model` (other
  than `inherit`), `maxTurns`, `tools`, `disallowedTools`, or related
  overrides, so none of those renders. The executor spawns the installed
  Codex CLI on its app-server stdio interface with `-c` TOML overrides
  pinning the bare model and, when the value carries one, the reasoning
  effort verbatim (no clamping).

Before dispatching a codex-routed role, the host-side prerequisites must
hold or the dispatch is not available: the session is not in safe mode or
container execution mode (external executors do not run there), the
workspace is trusted by Qwen Code itself (the host checks its own folder
trust before launching a project-level external agent), and the folder is
trusted in the Codex CLI's own configuration. When one does not hold,
report the codex-routed role as unavailable with the missing prerequisite
named — there is no direct agent to substitute — and continue the roles
that can dispatch.

A role unlisted in the model config (or an install under `--no-model`)
renders the direct form with no `model:` line at all and no executor, so
the child inherits the session model.

## Establishing configured-route intent from install evidence

An install that omitted an optional route and an install that configured it
but whose agent file was later deleted present the same available agents,
so the agent catalog alone cannot decide the distinction above. The
authoritative evidence is the installer's ownership manifest,
`.autonomous-mode-install.json`, at the install root: its entry inventory
records exactly the agent files the latest successful install generated.
The workflow reads it install-relative — no source checkout or build input —
read-only, at most once per activation, and only when a decision needs
configured-route intent: whenever a needed optional route assignment must
be established, whether its agent file is missing, unreadable, or present.
The result stays fixed for the activation, like the preference file; the
workflow never writes the manifest or any other configuration file.

**The effective install root.** The manifest belongs to the Qwen Code
configuration directory that supplies the installed `agenticale-*` agents
the workflow runs from: the default user root (`~/.qwen`, the directory
holding `agents/agenticale-<role>.md`) or any custom install target,
including a project `.qwen` directory. Qwen Code discovers agents from both
the project-scoped and the user-scoped roots, and a manifest describes only
its own root. Use it only when that root is the effective agent source: if
another scope also defines `agenticale-*` agents, or the effective agents
live at a root without a manifest, the evidence does not match the
effective install and intent is not established (below). Never borrow a
manifest from a different install root.

**Reading the manifest.** Intent comes from the presence of the agent
file's entry (`agents/agenticale-implement-easy.md`,
`agents/agenticale-consult-hard.md`) in the state's `entries` list — not
from digest matches or current file content.

- Entry present: the route is configured. Deleting an agent file never
  rewrites the manifest, so a deleted agent keeps its entry too — that is
  the configured-but-missing case, not an omission. A user-modified agent
  file keeps its entry only while the install still lists the route: a
  successful reinstall that omits the route preserves the modified file
  (`preserve-modified`) but drops its entry, because the manifest is
  rewritten as exactly the new inventory.
- Entry absent from a valid current state: the route was omitted at the
  latest successful install, and the shared policy's base-route fallback
  applies — even when a preserved leftover agent file still exists. The
  leftover is unowned: it never dispatches, and deleting it keeps the route
  omitted.
- Manifest absent (for example a manually copied install), not valid JSON,
  failing validation, or ambiguous in ownership: configured intent is not
  established.

**Decisions.** A configured route whose agent file is present and readable
dispatches normally. A configured route whose agent file is missing or
unreadable blocks only that role's dispatch and is reported with the refresh
procedure below — never substituted by the base route. An omitted optional
route falls back to its base route with the existing assignment, the defined
policy — whether its agent file is absent or a preserved leftover still
exists; the leftover is never dispatched and never automatically assigned.
The omission fallback applies only to the two optional routes: any other
missing agent file blocks that role with the refresh report regardless of
the manifest.

When intent is not established, fail conservatively: report an actionable
limitation naming the evidence gap (missing, unreadable, or ambiguous
manifest at the effective root) and the refresh procedure. Do not dispatch
the optional route — even when an agent file is present — and do not claim
the omission fallback; an explicit request for that route is never honoured
by silently substituting a weaker one — that dispatch stops with the
limitation. Unrelated base roles are unaffected: rounds that do not need
the route continue on their existing assignments with the limitation
surfaced. Rerunning the installer restores both the agent files and the
manifest evidence.

The manifest establishes configuration intent only. Its entries carry paths
and digests, no model assignments: never resolve a model from it, and never
treat it as effective-model evidence — that stays native host evidence, as
below.

## Coordinator adoption

When the model config assigns the `coordinator` key a Qwen-direct value,
the install carries `agents/agenticale-coordinator.md`: its `model:` line is
the **requested** coordinator model and its body is the coordinating
posture. The coordinating session is the caller session — there is no
session-primary agent to switch it on. When the file is present and
readable, the workflow reads it at activation (at most once, read-only)
and **adopts** its posture body for the coordinating session: that read is
a required adoption step, not optional, and it is the only configuration
evidence this surface offers besides the install-ownership manifest the
binding documents. The workflow never writes the file and never dispatches
it as a child. To make the requested model effective, the user selects it
in the session — `/model <id>` before or at workflow start or a session
default — never a global `settings.json` rewrite by the workflow. Two host
behaviors shape that selection: `/model` searches the session's current
auth bucket first, so a coordinator model registered under a different
provider is only reachable when that provider is the session's bucket (or
resolvable from it); and a user-driven `/model` selection may persist the
choice to `settings.json` — a host behavior the workflow neither triggers
nor reverts. The effective coordinator model is the session's current
model, from native session metadata; record requested versus effective
when both are available.

A codex-routed coordinator value can never be a session model: the shared
build skips it with a console note and a `qwenCode.coordinatorSkipped`
state record, and the installer enforces the strict rejection. An install
whose coordinator value was skipped has no coordinator agent file, and the
coordinating session simply runs on its own session model.

## When a role's agent file is missing or not what you need

Re-run the installer from an AgenticAle source checkout (obtain one by
cloning `https://github.com/alefranz/AgenticAle`) with the flat model
config you want, pointing it at the effective install root — the project
`.qwen/` directory or `~/.qwen/`, whichever one supplies the installed
`agenticale-*` agents and skills:

```sh
node <AgenticAle-checkout>/scripts/install.mjs qwen-install --models <path|preset> --target <install root>
```

(or `--no-model` to make every role inherit the session model; with neither
flag the packaged Qwen Code install default applies). The installer is
copy-only and owns only the `agenticale-*` agent files and the AgenticAle
skill files: every other agent, skill, and setting in the install root is
left untouched, and the ownership manifest it writes is the evidence source
for [Establishing configured-route intent](#establishing-configured-route-intent-from-install-evidence).
It refuses to overwrite a differing file by default (`--replace` backs up
and replaces), and it refuses a state file written by another AgenticAle
package or an unrecognized hand-edited state. Reconciliation retires owned,
unmodified agent files the new inventory no longer lists — a manually
copied leftover agent is never touched, because it is not owned — while a
modified owned file is preserved and reported. Rerunning the installer
restores both the agent files and the manifest evidence; the next fresh
workflow activation dispatches with the refreshed agents.

## Requested versus effective settings

The profile carries the requested model (the direct form's `model:` line or
the codex executor's pinned `-c` overrides); what it actually resolves to
depends on the host's model registry and account. A **mistyped or
unresolvable `model:` id is a silent fallback**: Qwen Code 0.28.6 falls
back to the session model with no error, so the requested value is not
effective and the host does not surface the fallback. Keep an unknown
effective setting unknown, and never let a child's self-reported model name
establish the effective model. Establish the effective selection only from
native host evidence — the session and assistant metadata the host records
(provider/model, native response identifiers, and usage). For an executor
child the host records only its own label (`external-codex:codex`), not the
model or effort Codex itself resolves: the requested codex value stands as
requested, and the effective codex model is not host-native evidence on
this surface. Record requested versus effective when both are available.

## How `inherit` is realized

A direct-form profile with no `model:` line and no executor (an unlisted
role or `--no-model`) realizes `inherit`: the child runs on the session
model rather than a pinned one. `inherit` is not expressible on the codex
path — the executor always pins a model; unlisting a role removes the
executor entirely instead.

## Caller and session overrides

An explicit user/task override can only select a matching installed agent;
arbitrary task-time model overrides cannot be promised — reinstall with a
different `--models` config instead. Never change global model
configuration (`settings.json`) mid-task; overrides stay in the session and
rewrite no configuration file.

## Session usage summary (opt-in)

The `--stats` option is **not supported** on this surface: no binding
documents a session-usage procedure for Qwen Code. State that the option is
unsupported rather than promising it; the final report simply omits the
session usage section.

## Limitations (stated honestly)

- **Silent model fallback.** An unresolvable `model:` id degrades to the
  session model with no error (verified on Qwen Code 0.28.6). The requested
  value is not effective, and only native evidence exposes the mismatch.
- **Task-time arbitrary model overrides are not supported.** The Agent tool
  selects an installed agent, so a caller cannot name an arbitrary model at
  task time. A requested model with no matching installed agent is reported
  as a limitation, not silently substituted.
- **The codex child is one-shot.** An executor task has no resume and no
  follow-up messages: one round dispatch is one codex task, and anything
  needing iteration is a new dispatch.
- **Codex profiles carry no permission fields.** The host rejects them on
  external agents, so every codex-routed role's access rests on the
  session approval mode driving the native codex sandbox: the default (or
  plan) approval mode runs the child read-only — which is how the
  read-only policy of codex-routed `explore`/`consult`/`consult-hard` is
  honoured — while a permissive session (auto-edit or yolo) gives even
  those read-only-policy roles write access.
- **Codex dispatch has host-side prerequisites.** External executors do
  not run in safe mode or container execution mode, and the host requires
  its own workspace trust (plus Codex's own trusted-folder setting) before
  launch. When a prerequisite does not hold, the codex-routed role is
  unavailable — report it, never substitute.
- **The direct form carries no effort.** The config value's `#effort`
  suffix is not rendered for direct-routed roles; only codex-routed values
  pass the effort through.
- **No hot reload is promised.** Refreshed agent files are effective for a
  session that reads the agents root at start; do not assume a running
  session picks them up.
- Do not change global model configuration mid-task. Model changes go
  through reinstalling with a different `--models` config, not by editing a
  global setting while a task runs.

The skill selects this binding from the actual runtime/tool surface, not from
the chosen language model. A surface that is not Qwen Code does not use this
binding; an unknown surface reports a limitation instead of inventing tools.
