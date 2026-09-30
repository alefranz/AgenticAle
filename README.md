# AgenticAle: coding tasks with independent review

Describe the change. AgenticAle coordinates focused agents to implement it,
review it independently, and fix the findings. Use it for a feature, a bug fix,
or feedback on a PR. Ask for a PR when you want it to take care of delivery too.

This is a free, open-source collection of agent instructions and skills for
OpenCode V2, GitHub Copilot CLI, and GitHub Copilot in VS Code. It runs inside
your coding assistant using your available models; there is no separate service.
Your model provider's usage costs still apply.

## Start here

### GitHub Copilot CLI and VS Code

With Copilot CLI installed and authenticated, install the plugin:

```sh
copilot plugin marketplace add alefranz/AgenticAle
copilot plugin install agenticale@agenticale
```

Restart the Copilot session. In VS Code or Copilot's `/agent` picker, select
**AgenticAle** and describe the task. From the CLI you can also start it directly:

```sh
copilot --agent agenticale:agenticale
```

VS Code discovers the plugin installed by Copilot CLI. Select the agent once
per session; then use ordinary requests:

```text
Fix the date filtering bug.
Address the review feedback on this branch.
Investigate why export is slow and suggest an approach.
Add CSV export and open a PR.
```

The optional `/agenticale:work [--pr] [task]` command supplies the same task
and delivery choice. Select **AgenticAle** first: the slash command does not
switch the current agent or its model. The underlying `work` skill is hidden
from slash autocomplete to avoid a duplicate starting command.

### OpenCode V2

Install [OpenCode V2](https://opencode.ai/v2/docs) and Node.js 20 or later.
From a checkout of this repository, install the bundle:

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

`--no-model` uses your active model for every role. To use the included role
mapping with OpenCode Zen, install with `--models zen` instead. Check that its
model IDs are available in your account. Other mappings, project-scoped child
permissions, and custom installs are covered in [setup and customization](docs/setup.md).
The installer leaves your OpenCode permissions unchanged.

## What happens when you use it

For a clear change, an implementation agent does the work and a fresh reviewer
checks the actual changes and relevant tests. Blocking findings go to a focused
fix agent and are verified or independently reviewed again. Optional nits do
not keep the task running indefinitely.

When the request needs investigation, an exploration agent gathers evidence
first. The coordinator brings meaningful choices back to you and continues
routine work without asking permission at every stage. Investigation-only
requests return findings and options without starting implementation.

Each agent gets a bounded task and the relevant context. The default Copilot
mapping uses cheaper models for exploration, routine implementation, and fixes,
with stronger models for review and difficult work. The same roles serve both
workflows, and you can customize their models. Actual cost depends on the task,
models, and number of rounds; a tiny task does not need every specialist.

At the end, you get the changes, verification results, review outcome, and any
remaining limitations. Independent review helps catch issues before your own
review; it does not guarantee defect-free code.

## Choose where the task finishes

| Request | Result |
| --- | --- |
| `/work <task>` | Reviewed changes on the current branch, left uncommitted |
| `/work --pr <task>` | Feature branch, reviewed changes, coherent commits, push, and GitHub PR |
| “Investigate … and suggest an approach” | Findings and options, without implementation |
| “Address feedback on this PR” | Reviewed fixes on its current branch; no implicit commit or push |

Explicit instructions and repository conventions take precedence. “Open a PR”
authorizes that delivery sequence once; it does not authorize merging. Existing
task branches and PRs are reused where appropriate, and unrelated local changes
are preserved. Ambiguous destinations or overlapping edits may need your input.

Everyday work keeps coordination in the session. It adds no handoff files,
workflow backlog, or agent archives to your project unless your repository
explicitly requires durable notes. Continue in the same session when needed.

## Advanced: long-running autonomous projects

For a project that should keep progressing across many rounds, restarts, and
fresh sessions, use **AgenticAle Autonomous** or OpenCode's `/autonomous`.

It uses the same specialist roles and independent review, with durable backlog,
handoff, and archive files so a new coordinator can resume the next action.
Those files are intentional working memory for unattended project development.
Working-tree persistence remains the default; request commits when desired.

See [Autonomous Mode](docs/autonomous.md) for budgets, continuation, Git policy,
and disposable sandbox setup. Existing `/autonomous` invocations still work.

## Other included skills

- **[Source Code Lookup](skills/source-code-lookup/SKILL.md)** finds and inspects
  local dependency or related-project source before guessing how it works.
- **[Pull Request Description](skills/pull-request-description/SKILL.md)** writes
  a PR narrative around the problem, resulting behaviour, and useful validation.

Both can be used outside these workflows.

## Customize or contribute

- [Setup, model routing, updates, and troubleshooting](docs/setup.md)
- [Architecture and client bindings](docs/architecture.md)
- [Contributing and verification](CONTRIBUTING.md)

AgenticAle grew out of my own coding workflow. Everyday reviewed tasks are the
main starting point; the autonomous sandbox remains available for longer runs.
Available under the [MIT License](LICENSE).
