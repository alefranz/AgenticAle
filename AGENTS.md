# Working in AgenticAle

For tasks that improve the skills' capabilities, start with the authored core
below. Read the relevant source and its direct dependencies before expanding
discovery. This is a repository development convention; editing a skill does
not invoke its workflow.

## Source map

| Concern | Authored source |
| --- | --- |
| Everyday task workflow | `skills/work/SKILL.md` |
| Durable autonomous workflow | `skills/autonomous/SKILL.md` |
| Shared rounds, task packets, review and fix rules | `skills/work/references/rounds.md` |
| Specialist behavior | `skills/work/references/tasks/*.md` |
| Supporting capabilities | `skills/source-code-lookup/SKILL.md`, `skills/pull-request-description/SKILL.md` |
| Routing semantics and implementation | `skills/work/references/ROUTING.md`, `skills/work/scripts/routing.mjs` |
| Routing defaults and customization example | `skills/work/references/routing.json`, `skills/work/references/routing.example.md` |

Runtime bindings in `skills/work/references/runtimes/`, presentation metadata
in `skills/*/agents/`, `adapters/opencode/`, and build/install scripts are also
authored source, but concern integration. Inspect them when the task involves
that boundary or a core change depends on an actual runtime capability.

`plugins/agenticale/`, `dist/`, installed copies, and the catalogs at
`.github/plugin/marketplace.json` and `.agents/plugins/marketplace.json` are
derived artifacts. Never edit them by hand or use them as alternative skill
source. Do not search duplicate copies to understand core behavior.

## Keep discovery focused

- Start searches in the relevant `skills/<name>/` directory. Follow shared
  references only as needed; `autonomous` shares resources from `work`.
- Read the relevant sections of `docs/architecture.md` for context. Setup,
  compatibility matrices, historical plans, reviews, and development handoffs
  are task-specific context, not required reading for every skill improvement.
- State the intended behavior and acceptance examples, then make the smallest
  coherent source change. Keep portable behavior in the skills and task
  contracts; keep host dispatch details in runtime bindings and adapters.
- Expand scope when evidence requires it. Report a runtime dependency precisely
  instead of inventing a capability or turning a core task into a harness audit.

## Core-only work and later convergence

When the user asks for "core only", "focus on skill content", or to defer
convergence, complete the authored capability change and its relevant checks.
Leave artifact regeneration, installer changes, cross-client integration, and
release documentation for the later convergence task unless explicitly included.
This scope applies to implementation and review alike; pass it to any agents
used by an explicitly invoked workflow.

Run `node scripts/validate.mjs` and `git diff --check`. For routing logic changes,
also run `node scripts/test-routing.mjs`; use relevant behavior examples or
fixtures for instruction changes. Add checks when needed to establish the
requested behavior. Build and installer checks belong to convergence when the
change does not concern those layers. Do not claim live runtime verification
from source validation alone.

Finish with the changed source, verification results, and a compact convergence
handoff: affected bindings or docs, artifacts to regenerate, remaining checks,
and any unresolved capability assumptions. Keep this in the task report unless
durable notes are requested. Core completion does not mean release readiness;
generated copies may intentionally lag until convergence.

Without a request to defer convergence, retain focused discovery and complete
normal integration. For a convergence or release task, use
`node scripts/publish-default-plugin.mjs` to regenerate the plugin and catalogs,
then run the full verification sequence in [CONTRIBUTING.md](CONTRIBUTING.md).
Do not install into a personal client profile as part of repository validation.
