# Getting started

## Why you might use it

One explicit invocation of Work gives you focused implementation, an
independent review of the result, and focused fixes for blocking findings — as
one task, optionally delivered as a pull request. Routine rounds can run on
inexpensive or local models, reserving stronger models for the work that needs
them.

## First steps

1. **Install for your client.** AgenticAle works with GitHub Copilot (App, CLI,
   and VS Code), Codex (CLI, VS Code extension, and ChatGPT desktop app),
   OpenCode V2, and Google Antigravity (App and CLI). The [setup guide](./setup.md)
   owns the installation steps and routing customization.
2. **Invoke the workflow explicitly** with a concrete task, for example
   `/work Fix the date filtering bug`. The session where you invoke it
   coordinates the task. It does not start automatically from an ordinary
   coding request.
3. **What happens next.** The coordinator dispatches focused implementation, a
   fresh independent review checks the result, blocking findings get focused
   fixes, and you get a delivery report — or the pull request you asked for.

Read the [Work skill guide](./skills/work/index.md) for its process, examples,
inputs, and outputs, and the [model routing](./guides/model-routing.md) and
[troubleshooting](./guides/troubleshooting.md) guides for focused help. For
architecture and runtime support, use the canonical
[architecture](./architecture.md) and
[runtime compatibility](./runtime-compatibility.md) references.
