# AgenticAle model routing (example)

Copy the body of this file to a routing preference file to customize model
routing:

- project scope: `<repo>/.agenticale/routing.md`
- personal scope: `~/.agenticale/routing.md`

File creation is an explicit user action; AgenticAle never creates, overwrites,
migrates, or removes these files. See `ROUTING.md` for the full contract.
Runtime sections use `codex`, `copilot`, and `opencode` (the `copilot-local`
binding uses the `copilot` section). Apply only the active runtime's
preferences; omit a section to keep the installed defaults for that runtime.
The model names below are illustrative; actual identifiers and effort support
come from the host.

---

# AgenticAle model routing

## codex

### Tiers

| Tier | Model | Reasoning effort |
| --- | --- | --- |
| fast | gpt-6-luna | high |
| standard | gpt-6-sol | high |
| deep | gpt-6-sol | xhigh |

### Role overrides

- review: use the deep tier.
- consult: use gpt-6-astra with high reasoning effort.
