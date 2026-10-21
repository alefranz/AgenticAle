# AgenticAle

AgenticAle is a collection of portable coding skills for working with an AI
coding assistant. Its everyday workflow coordinates focused implementation,
independent review, and fixes, with optional delivery.

The workflow is designed to lower model cost by using fast, inexpensive, or
local models for routine high-volume work, and stronger models for difficult
implementation and independent review. Successful delivery, including a
requested pull request, includes independent review, acceptance checks, and
fixes for blocking findings, so your attention goes to completed work. Routes
are configurable and can inherit your session model.

**[Get started](./getting-started.md)** · **[Explore the Work skill](./skills/work/index.md)**

## Choose a workflow

- [Work](./skills/work/index.md): a reviewed everyday coding task, invoked explicitly.
- [Review](./skills/review/index.md): an independent review of the committed
  changes on the current branch, invoked explicitly.
- [Autonomous](./skills/autonomous/index.md): durable work across multiple
  rounds and fresh sessions.
- Supporting skills: [source code lookup](./skills/source-code-lookup/index.md)
  and [pull request description](./skills/pull-request-description/index.md).

Start with [getting started](./getting-started.md), then follow
[installation and client setup](./setup.md). For focused help, see the
[model routing](./guides/model-routing.md) and
[troubleshooting](./guides/troubleshooting.md) guides. The
[architecture](./architecture.md) and
[runtime compatibility](./runtime-compatibility.md) pages are canonical
references.
