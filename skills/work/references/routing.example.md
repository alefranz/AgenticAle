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
come from the host. The installed role mapping uses `fast` for exploration,
`routine` for implementation and fixes, `standard` for hard implementation and
review, and `deep` for deep review and consultation.

---

# AgenticAle model routing

## codex

### Tiers

| Tier | Model | Reasoning effort |
| --- | --- | --- |
| fast | gpt-6-luna | medium |
| routine | gpt-6-luna | high |
| standard | gpt-6.1-sol | high |
| deep | gpt-6.1-sol | xhigh |
