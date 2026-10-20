# AgenticAle

AgenticAle is a free, open-source collection of coding skills for AI assistants.
Its everyday workflow coordinates implementation, independent review, and
focused fixes. A durable workflow carries larger goals across multiple rounds
and sessions.

The workflow is designed to lower model cost by using fast, inexpensive, or
local models for routine high-volume work, and stronger models for difficult
implementation and independent review. Successful delivery, including a
requested pull request, includes independent review, acceptance checks, and
fixes for blocking findings, so your attention goes to completed work.

Describe the outcome you want and invoke a workflow explicitly. The session
where you invoke it coordinates the work; there is no separate coordinator to
select.

```text
/work Fix the date filtering bug
/work Investigate why export is slow and recommend a fix
/work --pr Add CSV export to the report table
/autonomous 4 Migrate the report pipeline and verify the new behavior
```

These examples use conceptual slash syntax. Select the skill or use the
invocation supported by your client, as described in the
[installation guide](https://alefranz.github.io/AgenticAle/setup.html).
On OpenCode, add `--stats` to a `/work` invocation to include a session
usage summary — duration, per-session token counts, and a per-provider
breakdown — in the final report.

**[Open the documentation site](https://alefranz.github.io/AgenticAle/)** for
[getting started](https://alefranz.github.io/AgenticAle/getting-started.html),
[skill guides](https://alefranz.github.io/AgenticAle/skills/work/),
[installation and routing](https://alefranz.github.io/AgenticAle/setup.html),
and [contributing](https://alefranz.github.io/AgenticAle/contributing.html).

## Start here

Choose the client setup in the [installation guide](https://alefranz.github.io/AgenticAle/setup.html).
The four skills are `work`, `autonomous`, `source-code-lookup`, and
`pull-request-description`. The two workflow skills are explicit-only; the
supporting skills are loaded when their tasks call for them.

### GitHub Copilot (CLI and VS Code)

See [Copilot installation](https://alefranz.github.io/AgenticAle/setup.html#github-copilot-cli-and-vs-code).

### Codex (CLI, VS Code extension, and ChatGPT desktop app)

See [Codex plugin installation](https://alefranz.github.io/AgenticAle/setup.html#codex-plugin-cli-vs-code-extension-and-chatgpt-desktop-app)
or the [standalone skill option](https://alefranz.github.io/AgenticAle/setup.html#alternative-standalone-codex-skills).

#### Alternative: install standalone skills

See the [standalone skills installation guide](https://alefranz.github.io/AgenticAle/setup.html#alternative-standalone-codex-skills).

### OpenCode V2

See [OpenCode installation](https://alefranz.github.io/AgenticAle/setup.html#opencode-v2-generated-profiles).

### Google Antigravity (App and CLI)

See [Antigravity installation](https://alefranz.github.io/AgenticAle/setup.html#google-antigravity-app-and-cli).

## What happens when you use it

Work completes a bounded task through implementation, independent review,
focused fixes for blocking findings, and acceptance checks. When investigation
is needed, it gathers evidence first. Autonomous applies the same review gates
to long goals and saves a durable next action for a later session. Each
workflow reports its checks and remaining limitations.

Before dispatching implementation, the coordinator briefly assesses what the
request would touch — which sources other actors can also mutate, which side
effects would survive an interruption, and which compatibility surfaces are
involved — and inspects only as much as a concrete uncertainty requires. A
small question is answered with a direct read; a focused exploration round runs
only when a question needs its own context, so no discovery round is mandatory.
A blocking finding that needs concurrency, durability, state-machine, or
ownership reasoning keeps the fix role but is dispatched on the configured
hard route.

Both workflows keep you informed: a concise decision summary precedes each
substantive step. When an allowance is exhausted, the stop report says which
allowance is spent, what is completed and what is blocked, and recommends a
bounded correction, a bounded replan, or a stop that preserves the current
work. Where your host offers choices, it offers them — for example one
additional fix-and-review cycle — and a granted extension adds exactly the
named rounds without resetting counters or granting extra rights; declining
ends the stop. Every incomplete stop includes a copy-pasteable continuation
prompt. Provider quota exhaustion is separate: Work stops without durable
recovery, while Autonomous applies its own cooldown and handoff policy.

## Customize model routing

Routing preferences and install options are documented in the
[model routing guide](https://alefranz.github.io/AgenticAle/guides/model-routing.html).

## Choose where the task finishes

Work leaves changes ready for your review unless you ask it to prepare and open
a pull request. Autonomous keeps a durable handoff in the target project;
commit, branch, push, and pull request actions are separate requests. See the
[skill guides](https://alefranz.github.io/AgenticAle/skills/work/).

## Advanced: long-running autonomous projects

Use [Autonomous](https://alefranz.github.io/AgenticAle/skills/autonomous/) for
a goal that spans multiple rounds or sessions.

## Other included skills

The supporting [source code lookup](https://alefranz.github.io/AgenticAle/skills/source-code-lookup/)
and [pull request description](https://alefranz.github.io/AgenticAle/skills/pull-request-description/)
guides explain when each skill is loaded and what it returns.

## Customize or contribute

- [Installation, updates, and client options](https://alefranz.github.io/AgenticAle/setup.html)
- [Model routing](https://alefranz.github.io/AgenticAle/guides/model-routing.html)
- [Troubleshooting](https://alefranz.github.io/AgenticAle/guides/troubleshooting.html)
- [Site maintenance](https://alefranz.github.io/AgenticAle/site-maintenance.html)
- [Contributing checks](https://alefranz.github.io/AgenticAle/contributing.html)
