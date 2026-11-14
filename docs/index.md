# AgenticAle

> Pronounced **agentic + Ale** (*uh-JEN-tik AH-leh*, with *Ale* as in *Alessio* — not *ale* like the beer).

AgenticAle is a collection of portable coding workflows — skills for an AI
coding assistant that work with GitHub Copilot, Codex, OpenCode, and Google
Antigravity.

## Why use it

- **Independent review before work is called done.** A fresh reviewer inspects
  the result of each task, and blocking findings are fixed before delivery.
- **Per-role model configuration.** Each of the nine worker roles (seven
  base, two optional) gets its own
  model: routine, high-volume work can run on inexpensive or local models
  while stronger models are reserved for hard work and independent review.
  A role you do not configure inherits your session model.
- **Portable across clients.** The same skills work with GitHub Copilot,
  Codex, OpenCode, and Google Antigravity.
- **Explicit-only invocation.** Workflows start only when you invoke them; an
  ordinary coding request never starts one on its own.

**[Get started](./getting-started.md)** · **[Explore the Work skill](./skills/work/index.md)**

## Choose a workflow

- [Work](./skills/work/index.md): a reviewed everyday coding task, invoked
  explicitly.
- [Review](./skills/review/index.md): an independent review of the committed
  changes on the current branch, invoked explicitly.
- [Autonomous](./skills/autonomous/index.md): durable work across multiple
  rounds and fresh sessions.
- Supporting skills: [source code lookup](./skills/source-code-lookup/index.md)
  and [pull request description](./skills/pull-request-description/index.md).

**First step:** choose your client in the [setup guide](./setup.md), install,
then run `/work <task>` with a concrete task. For focused help, see the
[model configuration](./guides/model-routing.md) and
[troubleshooting](./guides/troubleshooting.md) guides. The
[architecture](./architecture.md) and
[runtime compatibility](./runtime-compatibility.md) pages are canonical
references.
