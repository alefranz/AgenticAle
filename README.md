# AgenticAle: coding tasks with independent review

Describe the change. AgenticAle coordinates focused agents to implement it,
review it independently, and fix the findings. Use it for a feature, a bug fix,
or feedback on a PR. Ask for a PR when you want it to take care of delivery too.

This is a free, open-source collection of portable coding skills with explicit
model routing, distributed as one Agent Plugins 1.0 package. It runs inside your
coding assistant using your available models; there is no separate service. Your
model provider's usage costs still apply.

The public experience is two explicit-only skills:

- `/work [task]` (optionally `/work --pr <task>`) for a reviewed everyday task;
- `/autonomous [budget] [goal]` for a durable, multi-round project.

Two supporting skills, `source-code-lookup` and `pull-request-description`, are
loaded by the workflows when their tasks arise. There is no coordinator to select
and no `commands/` entry: the session you invoke the skill in is the coordinator.
Live runtime support per client is recorded in
[runtime-compatibility.md](docs/runtime-compatibility.md), where every capability
is **not tested** in this documentation-only pass.

## Start here

### GitHub Copilot (CLI and VS Code)

With Copilot CLI installed and authenticated, install the shared plugin:

```sh
copilot plugin marketplace add alefranz/AgenticAle
copilot plugin install agenticale@agenticale
```

Or build and install it locally from a checkout:

```sh
node scripts/install-copilot.mjs
```

Restart the Copilot session and invoke the skill directly; there is no agent
picker. From the CLI:

```sh
/agenticale:work Fix the date filtering bug
/agenticale:work Address the review feedback on this branch
/agenticale:work Investigate why export is slow and suggest an approach
/agenticale:work --pr Add CSV export
```

VS Code discovers the same plugin; the work skill may display as `/agenticale
work` in the autocomplete even though the CLI uses `/agenticale:work`. Select
the suggested autocomplete entry in VS Code.

### Standalone skills (Codex VS Code and other clients)

The official Codex VS Code extension supports skills and subagents but not
plugins, so install the four skill folders directly. A routing choice is
required: `--no-model` (inherit), `--models PATH|PRESET`, or `--routing PATH`.
No native agent or plugin is required.

From a checkout, install to user scope (the checkout's own `.agents/skills` is
off limits to the installer, so project scope does not apply here):

```sh
node scripts/install-standalone.mjs --no-model --scope user
```

From any other project, run the checkout's script by absolute path so the
skills land in that project's own `<project>/.agents/skills`:

```sh
node /path/to/AgenticAle/scripts/install-standalone.mjs --no-model
```

Use `--scope user` for user scope (`~/.agents/skills`) or `--target PATH` to
override the destination explicitly.

### OpenCode V2

Install [OpenCode V2](https://opencode.ai/v2/docs) and Node.js 20 or later. From
a checkout of this repository, install the generated OpenCode binding (the four
skills plus seven generated routing profiles):

```sh
node scripts/install.mjs --no-model
```

Restart OpenCode and run:

```text
/work Fix the date filtering bug
/work Address the review feedback on this branch
/work Investigate why export is slow and suggest an approach
/work --pr Add CSV export
```

`--no-model` uses your active model for every route. To use the included role
mapping with OpenCode Zen, install with `--models zen` instead, or pass a full
policy with `--routing PATH`. Check that its model IDs are available in your
account. Routing options, project-scoped child permissions, and custom installs
are covered in [setup and customization](docs/setup.md). The OpenCode installer
leaves your `opencode.jsonc` unchanged.

## What happens when you use it

For a clear change, an implementation agent does the work and a fresh reviewer
checks the actual changes and relevant tests. Blocking findings go to a focused
fix agent and are verified or independently reviewed again. Optional nits do not
keep the task running indefinitely.

When the request needs investigation, an exploration agent gathers evidence
first. The coordinator brings meaningful choices back to you and continues
routine work without asking permission at every stage. Investigation-only
requests return findings and options without starting implementation.

Each agent gets a bounded task and the relevant context. Routing is an explicit
per-route policy: high-volume work (explore, routine implement, fix) uses a fast
or cheap model, while `implement-hard`, `review`, `deep-review`, and `consult`
reserve a stronger model. `implement` and `implement-hard` share the same
implementation contract but route to different models and effort. You can
customize routes, and a fresh child context does not by itself mean a different
model family. Actual cost depends on the task, models, and number of rounds; a
tiny task does not need every specialist.

At the end, you get the changes, verification results, review outcome, and any
remaining limitations. Independent review helps catch issues before your own
review; it does not guarantee defect-free code.

## Choose where the task finishes

| Request | Result |
| --- | --- |
| `/work <task>` | Reviewed changes on the current branch, left uncommitted |
| `/work --pr <task>` | Feature branch, reviewed changes, coherent commits, push, and GitHub PR |
| "Investigate … and suggest an approach" | Findings and options, without implementation |
| "Address feedback on this PR" | Reviewed fixes on its current branch; no implicit commit or push |

Explicit instructions and repository conventions take precedence. "Open a PR"
authorizes that delivery sequence once; it does not authorize merging. Existing
task branches and PRs are reused where appropriate, and unrelated local changes
are preserved. Ambiguous destinations or overlapping edits may need your input.

Everyday work keeps coordination in the session. It adds no handoff files,
workflow backlog, or agent archives to your project unless your repository
explicitly requires durable notes. Continue in the same session when needed.

## Advanced: long-running autonomous projects

For a project that should keep progressing across many rounds, restarts, and
fresh sessions, invoke the `autonomous` skill: `/autonomous [budget] [goal]`.

It is a skill, not a selectable profile: the invoking session coordinates. It
uses the same specialist roles and independent review, with durable backlog,
handoff, and archive files so a new session can resume the next action. Those
files are intentional working memory for unattended project development.
Working-tree persistence remains the default; request commits when desired.

See [Autonomous Mode](docs/autonomous.md) for budgets, continuation, Git policy,
and disposable sandbox setup.

## Other included skills

- **[Source Code Lookup](skills/source-code-lookup/SKILL.md)** finds and inspects
  local dependency or related-project source before guessing how it works.
- **[Pull Request Description](skills/pull-request-description/SKILL.md)** writes
  a PR narrative around the problem, resulting behaviour, and useful validation.

Both workflows require agents to read and apply these skills when their tasks
arise: PR descriptions use Pull Request Description, and investigations of
another codebase use Source Code Lookup. Both can also be used independently.

Set `SOURCE_ROOT` to your source directory (for example, a Windows Dev Drive) to
customize lookup without reinstalling the plugin; the default is `~/dev`.
Existing checkouts are reused, and missing repositories are cloned into that
root for later use. See [source lookup setup](docs/setup.md) for precedence and
configuration examples.

## Customize or contribute

- [Setup, model routing, updates, and troubleshooting](docs/setup.md)
- [Architecture and client bindings](docs/architecture.md)
- [Runtime compatibility matrix (not tested)](docs/runtime-compatibility.md)
- [Skills-first Copilot and Codex implementation plan](docs/skills-first-coding-plan.md)
- [Contributing and verification](CONTRIBUTING.md)

AgenticAle grew out of my own coding workflow. Everyday reviewed tasks are the
main starting point; the autonomous skill remains available for longer runs.
Available under the [MIT License](LICENSE).
