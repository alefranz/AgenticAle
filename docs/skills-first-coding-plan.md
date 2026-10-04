# Skills-first coding plan

Status: implemented on this branch; live runtime acceptance is still pending
manual testing (see [runtime-compatibility.md](runtime-compatibility.md)).
Research date: 2026-10-01. Installed versions inspected: Copilot CLI 1.0.89,
Codex CLI 0.159.3, OpenCode V2 2.0.9, and VS Code 1.140.0. Version inspection
and documentation research are not live workflow verification.

Make AgenticAle a collection of portable coding skills with explicit model
routing, distributed through Agent Plugins. Center the implementation on
Copilot and Codex. Generate OpenCode V2 agent profiles as a compatibility
adapter, rather than keeping OpenCode profiles as the authored source.

The public workflows become `work` and `autonomous`. Remove separate command
definitions and selectable coordinator profiles from the default modern
package. The invoking session coordinates fresh children using task-specific
instructions and caller-selected model/effort settings. Keep source lookup
and PR description as the other two public skills.

ChatGPT Chat/Work is outside this plan. OpenAI targets are Codex CLI and the
official Codex VS Code extension. GitHub Copilot app means the standalone
coding app; the GitHub-hosted cloud agent is assessed separately below.

This document is the implementation handoff. No conversation history is
required. The chosen direction is skills-first; the compatibility spike settles
runtime details, not whether to retain OpenCode as the primary architecture.
Implementation starts from repository commit
`b3e3b75a4548ee477f4920419dc545e6e3114d1b` (published plugin version `0.2.0`).
Reconcile later repository changes before applying the file migration below.

The original profiles existed primarily because OpenCode could not select a
different model on each child call. AgenticAle's central value is choosing the
right model for a bounded job, with independent review. Preserve that value
while removing profile and command files where modern runtimes make them
unnecessary. Do not trade verified model routing for packaging uniformity.

Implementation scope includes the shared skills/plugin, standalone installation,
OpenCode compatibility generation, migration, tests, and documentation. It does
not include public plugin-directory submission, a new hosted service, new
workflow modes, parallelizing the currently sequential rounds, automatic model
benchmarking, or a redesign of durable autonomous state.

**Implementation baseline and required reading**

Read these repository files before editing; their current bodies contain the
complete policies to extract, not merely examples to approximate:

| Source at the baseline commit | Preserve or extract |
| --- | --- |
| [Work workflow](../skills/work-mode/SKILL.md) and [work entry](../commands/work.md) | Everyday task policy, arguments, PR authorization, session state, round limits |
| [Autonomous workflow](../skills/autonomous-mode/SKILL.md) and [autonomous entry](../commands/autonomous.md) | Budget/resume semantics, strict/standard policy, durable templates, deep-review and consultation gates |
| [Shared rounds](../skills/work-mode/references/rounds.md) | Child task packet, compact reports, resets, review/fix rules, supporting-skill loading |
| [Worker sources](../agents/autonomous/) | Seven role bodies plus OpenCode-only steps/permission metadata |
| [Source lookup](../skills/source-code-lookup/SKILL.md) and [PR description](../skills/pull-request-description/SKILL.md) | Supporting workflows, source-root precedence, reference loading |
| [Builder](../scripts/build.mjs), [OpenCode installer](../scripts/install.mjs), [Copilot installer](../scripts/install-copilot.mjs), [publisher](../scripts/publish-default-plugin.mjs) | Existing output ownership, customization, installation state, and artifact generation |
| [Architecture](architecture.md), [setup](setup.md), [contributing](../CONTRIBUTING.md) | Existing compatibility promises and verification conventions |

These links describe the pre-migration tree. Once files move, update links to
their replacements; recover the baseline with
`git show b3e3b75a4548ee477f4920419dc545e6e3114d1b:<path>` when comparing behavior.
Any reference to old source paths in this plan is a migration input, not a
requirement to keep those paths permanently.

Mandatory behavioral invariants:

- Work without a task uses an unambiguous current task or asks for one; it does
  not implicitly resume autonomous state. Investigation-only requests remain
  investigation-only. PR feedback alone does not authorize publishing.
- Work normally permits up to six worker rounds, two fix cycles/three review
  passes per slice, and one optional consultation. Reviews do not consume the
  worker budget. Repeated blockers or two workers without material progress
  stop the loop; limits must not be silently replenished.
- Autonomous parses a leading positive integer as its worker budget (default
  six). Empty input or a budget alone resumes the active handoff. A different
  supplied goal preserves existing active state and reports the conflict.
- Autonomous defaults to strict review. Preserve the existing standard-mode
  exceptions, periodic deep-review triggers, one opportunistic escalation,
  two re-audits per target, and two consultations per session. Extract the
  complete baseline rules and templates rather than replacing them with this
  abbreviated list.
- Ordinary work creates no workflow backlog/handoff/archive. Autonomous uses
  `BACKLOG.md`, `docs/handoffs/active.md`, and monthly archives with exactly one
  next action. Read-only children return reports for the coordinator to persist.
- Reviewers inspect actual changes, including untracked files and relevant
  tests. Behavioral findings require fresh re-review; mechanical findings can
  close with their sufficient deterministic check. Optional nits do not become
  an endless review loop. Never report self-review as independent review.
- The parent handles user questions; children return blockers. Preserve
  existing user/repository instruction precedence and scope boundaries.
- Preserve unrelated working-tree/staged changes. Default delivery is
  uncommitted. `--pr` or an explicit PR-delivery request authorizes branching,
  scoped commits, push, and PR creation, but not merging or force-pushing.
- Keep all source lookup customization: explicit task override, then the
  `SOURCE_ROOT` environment variable, then the installed default (`~/dev`).
  Both supporting skills must be fully read when their task triggers apply.

If a baseline policy is internally ambiguous, document the conflict and resolve
it explicitly; do not silently change workflow semantics during extraction.

**1. Current evidence and support boundary**

| Target | Evidence | Proposed binding |
| --- | --- | --- |
| Copilot CLI | Skills directly invocable; explicit per-call model and effort precedence documented | Skills plus direct child dispatch |
| Copilot in VS Code, Copilot Agent Host | Uses Copilot SDK, aligning runtime with CLI and standalone app | Same Copilot binding; verify bundled runtime/version |
| Standalone GitHub Copilot app | Shares SDK direction and discovers repository/CLI skills | Same Copilot binding; app smoke test |
| Copilot in VS Code, Local harness | Explicit model argument on `runSubagent`; separate restrictions and controls | Small compatibility binding; no profiles solely to select a model |
| Codex CLI | Explicit spawn model and reasoning settings supported | Skills plus direct child dispatch |
| Official Codex VS Code extension | Skills/subagents supported; plugins currently unsupported | Same skills installed as standalone folders |
| OpenCode V2 | Documented child dispatch selects a configured agent | Generated model-routing profiles |
| Copilot cloud agent on GitHub | Skills/plugins supported; execution and delivery are hosted | Secondary qualification target, not inferred identical to desktop app |

Copilot's CLI reference documents per-call model/effort precedence, but also
fallback to the session when settings cannot be honored. Agent definitions can
request `modelPolicy: required` to reject model substitution. Auto sessions and
user overrides need explicit tests; successful dispatch alone proves nothing
about the effective model. [CLI reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference#custom-agent-frontmatter-fields).

VS Code's SDK-based Agent Host is explicitly intended to align Copilot CLI,
VS Code, and the standalone app. This supports one Copilot adapter as the
design target, while requiring versioned smoke tests rather than assuming all
installed surfaces expose identical tools.
[Agent Host architecture](https://code.visualstudio.com/blogs/2026/08/26/agent-host-architecture).

The older Local harness separately documents per-call model selection and a
parent-model cost-tier ceiling. Its calls are stateless, and its effort controls
must be assessed separately. A cheap coordinator may therefore be unable to
launch the requested stronger reviewer on this surface.
[VS Code subagents](https://code.visualstudio.com/docs/agents/run/subagents).

Codex supports explicit per-spawn model and reasoning choices. Custom agent
files can override those choices, so the default adapter should avoid depending
on installed custom profiles. Fresh-context and model-override compatibility
must be checked against the actual exposed spawn tool.
[Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents).

Copilot documents direct skill invocation, including slash discovery in VS
Code. The standalone app discovers skills configured for the CLI/repository.
[CLI skills](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills),
[VS Code skills](https://code.visualstudio.com/docs/agent-customization/agent-skills),
[app customization](https://docs.github.com/en/copilot/how-tos/github-copilot-app/customize-github-copilot-app).

Codex's official IDE extension currently lacks plugin support; use standalone
`.agents/skills` folders there. Do not confuse that extension with the separate,
experimental Codex integration in VS Code Agent Host.
[Plugin support](https://learn.chatgpt.com/docs/plugins),
[Codex skill discovery](https://learn.chatgpt.com/docs/build-skills).

OpenCode V2 supports slash-visible skills and hiding them from implicit
discovery. Its documented subagent interface names a configured agent, with no
documented per-call model override. Verify its actual tool schema in the spike;
retain profiles unless that check demonstrates they are unnecessary.
[OpenCode skills](https://opencode.ai/v2/docs/skills),
[subagent tool](https://opencode.ai/v2/docs/tools#subagent).

Copilot cloud supports skills and declarative plugin installation. Its hosted
task/PR lifecycle must be checked before promising session-only uncommitted
delivery or cross-session autonomous resume. Do not equate the cloud agent with
the standalone Copilot app or let cloud parity block the local redesign.
[Copilot plugins](https://docs.github.com/en/copilot/concepts/agents/about-plugins).

**2. Public experience**

| Workflow | Copilot | Codex | OpenCode V2 |
| --- | --- | --- | --- |
| Reviewed coding task | `/work <task>` | `$work <task>` | `/work <task>` |
| Through PR delivery | `/work --pr <task>` | `$work --pr <task>` | `/work --pr <task>` |
| Autonomous project | `/autonomous [budget] [goal]` | `$autonomous [budget] [goal]` | `/autonomous [budget] [goal]` |

These are logical skill names. Plugin installation can add a namespace, such
as Copilot's `/agenticale:work`; publish the actual picker forms verified on
each surface. No separate command file is needed to make an invocable skill.

Move entry behavior into the skills before deleting wrappers: work's empty
input handling, `--pr`, and natural-language delivery selection; autonomous's
round budget, strict default, new-goal setup, resume, and conflict handling.
Consume the invoking user's task text, not a literal `$ARGUMENTS` token.

Keep workflows explicit-only. For Copilot, use invocable skill metadata with
`disable-model-invocation: true`; for Codex, supply
`agents/openai.yaml` with `allow_implicit_invocation: false`. Generate OpenCode
`slash: true` and `opencode/autoinvoke: false`. Test metadata coexistence in
the shared package. Do not use `context: fork` for the top-level coordinator:
the workflow itself controls child isolation, routing, budgets, and delivery.

Supporting skills remain available for implicit matching. Child task packets
still require full loading of relevant skills, rather than relying on the
parent having loaded them.

**3. The authored core**

Separate four concerns:

| Concern | Content |
| --- | --- |
| Workflow skills | Intent, round sequencing, review/fix gates, stop conditions, state and Git policy |
| Task contracts | Instructions, scope, permitted actions, evidence, and reports for a child assignment |
| Routing policy | Task difficulty to model/effort selection, caller overrides, explicit fallback rules |
| Runtime bindings | Translate the task and route into the host's available child tools |

Keep task contracts as private skill references, not seven more discoverable
skills or seven mandatory installed agents. An implementation contract can
serve routine and difficult tasks with different routing. Review, integration
review, exploration, fixes, and consultation retain their distinct constraints.
Independent review still requires a distinct child inspecting the actual diff.

Proposed authored layout:

```text
skills/
  work/
    SKILL.md
    agents/openai.yaml
    references/
      rounds.md
      tasks/
        implement.md
        fix.md
        explore.md
        review.md
        deep-review.md
        consult.md
      runtimes/
        copilot.md
        copilot-local.md
        codex.md
        opencode.md
      routing.json
  autonomous/
    SKILL.md
    agents/openai.yaml
  source-code-lookup/SKILL.md
  pull-request-description/SKILL.md
adapters/opencode/                  profile metadata and rendering rules
examples/                          target-specific routing presets
```

Both workflows reuse the round contract, task references, and routing policy
under `work`. All relative links must work after installing only the bundle.
The package carries finite, named runtime bindings; the skill selects one from
the actual runtime/tool surface, not from the chosen language model. Unknown
surfaces report a limitation instead of inventing tools.

Do not preserve authored OpenCode tool names, hard-step claims, or denied-tool
claims in the common protocol. Those belong in its adapter. Remove the brittle
chain of translating OpenCode prose into Copilot prose and then into Codex.

**4. Model selection is a required capability**

For each round, the coordinator:

1. Chooses a task contract and difficulty/routing category.
2. Resolves a caller override or the configured target-specific route.
3. Assembles a bounded task packet, including repository instructions and skill
   loading rules, without the full parent transcript.
4. Starts a fresh child with the selected model and effort using native fields.
5. Waits for its report, then verifies/reviews before dispatching the next round.

Requested routing precedence: explicit user/task override, explicitly selected
project/user routing file, then the packaged host preset. Do not scan unrelated
files for overrides. Preserve the existing seven mapping keys initially; map
`implement` and `implement-hard` to the same implementation contract with
different routes. Separate that compatibility mapping from task instructions.

Define and validate a versioned routing JSON contract before implementing its
renderers. It must encode, for each runtime and each of the seven keys, either
an explicit model/effort choice or explicit inheritance. A missing key in a new
complete policy is an error. Use a shape equivalent to this illustrative entry
(the placeholder model is not a real default):

```json
{
  "schemaVersion": 1,
  "runtimes": {
    "codex": {
      "review": {
        "mode": "explicit",
        "model": "MODEL_AVAILABLE_IN_THIS_RUNTIME",
        "reasoningEffort": "high",
        "fallbacks": []
      }
    }
  }
}
```

The real packaged policy must cover all supported runtime families and all
seven keys. `mode: inherit` omits model/effort and is an explicit choice;
fallbacks, when supplied, are ordered model/effort pairs. Validate unknown keys,
types, empty identifiers, contradictory fields, and unsupported effort values.
Treat exact native field names and supported effort values as adapter concerns.
Allow caller overrides of individual routes without requiring replacement of
the rest of the selected policy; task-time overrides stay session-scoped.

Compatibility mapping to generated OpenCode profiles. There are **seven** generated
profiles, one per routing key: `implement` and `implement-hard` are separate
profiles that render the same implementation task contract with different routing
(`implement-hard` carries a harder route), so each has its own profile ID.

| Existing route key | Task reference | OpenCode profile ID | Baseline step ceiling |
| --- | --- | --- | --- |
| `explore` | `explore.md` | `autonomous/explore` | 24 |
| `implement` | `implement.md` | `autonomous/implement` | 64 |
| `implement-hard` | `implement.md` (hard-task routing context) | `autonomous/implement-hard` | 64 |
| `fix` | `fix.md` | `autonomous/fix` | 48 |
| `review` | `review.md` | `autonomous/review` | 56 |
| `deep-review` | `deep-review.md` | `autonomous/deep-review` | 72 |
| `consult` | `consult.md` | `autonomous/consult` | 20 |

Retain `--models PATH|PRESET` as an import path for existing
`provider/model[#variant]` maps, including their documented partial-map
inheritance: convert omitted keys to explicit inheritance and report that
conversion. Do not confuse that legacy behavior with a missing key in the new
complete policy. Preserve preset aliases while validating availability on each
target. Use `examples/gpt.json` and `examples/openai.json` as the baseline
mapping inventory, not proof of current account access. Do not silently change
the model family as part of this migration. Add a clearly named option such as
`--routing PATH` for the new policy; reject conflicting routing inputs.

Carry forward `--source-root`, `--output`, and `--no-model`. Document the fate
of `--effort` as a route-wide override. Retire `--coordinator-effort` explicitly
if there is no generated coordinator: report that the session now owns this
setting instead of silently ignoring an accepted flag. Update CLI help and
argument tests with the final chosen option names.

Expose caller control through explicit skill instructions and configuration;
do not require a new custom profile for every model. Validate model identifiers
per host rather than assuming Copilot and Codex expose identical IDs or effort
levels. An explicit `--no-model` build/install option permits inheritance.
Otherwise, missing or unusable routes must not silently become inheritance.

For OpenCode, materialize the configured routes as agent profiles. Arbitrary
task-time model overrides cannot be promised if the native tool only selects
preconfigured profiles: use a matching installed route or report that the shim
must be regenerated. Do not change global model configuration mid-task.

The spike must distinguish requested settings, effective settings, and hard
enforcement. Skills can request a model; they cannot prevent host-side fallback
by themselves. Check actual runtime metadata or trace evidence, not a child's
self-reported model name. If a host silently substitutes and provides neither
enforcement nor sufficient evidence, do not advertise strict routing there.

The intended default contains no Copilot/Codex custom agents. If preventing
fallback requires a thin Copilot `modelPolicy: required` profile on a particular
version, record that as a tested compatibility exception or restrict the
supported mode/version. Do not sacrifice model routing merely to claim an
agent-file-free package. OpenCode is the only currently planned mandatory shim.

No new MCP orchestration server, nested CLI invocation, or SDK wrapper is
needed for the proposed architecture. Those would introduce another runtime
and authentication boundary to solve a capability already exposed natively.

**5. Distribution and generated artifacts**

Aim for one modern Agent Plugins 1.0 package containing the four public skills,
their task/routing resources, and optional OpenAI presentation metadata. Both
Copilot and OpenAI document this format.
[Copilot packaging](https://docs.github.com/en/copilot/concepts/agents/about-plugins#plugin-formats),
[OpenAI packaging](https://developers.openai.com/plugins/build/plugins).

```text
dist/
  plugin/agenticale/
    plugin.json
    skills/                        four skills and all runtime resources
  standalone/
    .agents/skills/                 same modern skills, no plugin dependency
  opencode/
    skills/                        generated OpenCode discovery metadata
    agents/autonomous/             seven compatibility profiles initially
plugins/agenticale/                 committed generated default modern package
.github/plugin/marketplace.json     Copilot catalog
.agents/plugins/marketplace.json    OpenAI catalog
```

The catalogs use their respective schemas but point to the same generated
package. Remove `com.github.copilot/commands` and the nine default Copilot
profiles once direct dispatch passes acceptance. No `.codex/agents` companion
is part of the default install.

The modern shared package includes separate Copilot/Codex routing maps and
binding references, keeping names and workflow behavior common. Use separate
generated packages only if a tested metadata/discovery incompatibility makes
one package unreliable. Such a fallback must not reintroduce separately
authored workflows or the `-mode` names.

The standalone installer serves Codex VS Code and optional repository-local
use in other clients. Reuse owned-file tracking, dry-run, collision detection,
replacement backups, and modified-file preservation. Handle duplicate plugin
and standalone installs explicitly; never silently edit unrelated configuration.

**6. Repository changes and migration**

| Current area | Planned change |
| --- | --- |
| `skills/work-mode`, `skills/autonomous-mode` | Rename to `work`, `autonomous`; incorporate command entry rules and remove host-specific protocol |
| `commands/*.md` | Delete after entry semantics and skill invocation pass tests |
| `agents/autonomous/*.md` | Extract neutral task contracts; keep only OpenCode profile metadata in its adapter |
| `scripts/build.mjs` | Render plugin, standalone skills, and OpenCode shim from the common core; use explicit output inventories |
| `scripts/install.mjs` | Install generated OpenCode output, not authored source; migrate old states and retired paths safely |
| `scripts/install-copilot.mjs` | Install modern shared plugin; retain explicit routing customization |
| New standalone installer | Install all skill resources for project/user scopes; no native-agent requirement |
| `scripts/publish-default-plugin.mjs` | Publish shared package and both catalogs; verify all artifacts with `--check` |
| Validators/tests/CI | Replace fourteen-authored-file/seventeen-Copilot-file assumptions; test semantic contracts and ownership migrations |
| README/setup/architecture/smoke tests | Skills-first quick starts, runtime matrix, model routing, migration instructions |

This intentionally changes the repository's source-of-truth layout. Do not
keep the old fourteen-file OpenCode contract merely to avoid updating tests.
Instead, version build ownership and install-state schemas, and preserve
migration coverage for previously supported installer states.

Copy installs must remove only unmodified, owned retired command/skill files.
Preserve modified files and report collisions. Existing link installs need a
defined transition because source paths will move: migrate owned links to a
stable generated location or require an explicit copy conversion. Never leave
links dangling or regenerate into a directory the installer does not own.

Keep the plugin identity stable and document that the old coordinator picker
entries disappear. Remove command wrappers and introduce same-named skills in
the same release to avoid shadowing. Test whether previous namespaced command
text now resolves to the skill before promising seamless invocation migration.
Do not retain a `work` command alias beside the `work` skill.

**7. Delivery and acceptance gates**

1. **Prove skills plus direct model routing.** In isolated fixtures, test
   Copilot CLI, Copilot Agent Host, standalone Copilot app, Codex CLI, and the
   official Codex extension. Test the VS Code Local harness separately. Capture
   skill discovery, raw child-tool schema, requested/effective model and effort,
   isolation behavior, and unsupported-route behavior. Verify OpenCode's schema
   and direct skill invocation. No real profile changes for tests.
2. **Extract the portable core.** Rename skills, absorb command behavior,
   extract private task contracts and routing, and define runtime bindings.
   Confirm explicit-only workflow invocation and shared-package metadata.
3. **Generate and migrate.** Produce the shared plugin, standalone tree, and
   OpenCode profiles. Remove modern commands/custom agents, update installers,
   version ownership state, and materialize both catalogs.
4. **Verify and document.** Run cross-platform generation/installer tests and
   per-runtime workflow smoke tests. Publish minimum tested versions and exact
   limitations. Cloud-agent qualification is a follow-up unless its required
   execution and delivery semantics are independently verified.

Create `docs/runtime-compatibility.md` as the spike's durable output. Record
client and bundled harness versions separately, the relevant tool input schema,
test prompt, requested/effective settings, evidence location, and pass/fail/not
tested for each capability. Exclude credentials and full private transcripts.
Use native tool metadata or local runtime traces where available; do not send
diagnostics to an external service merely to inspect model routing.

Run a tiny fixture that implements a small change with one available model and
reviews it with a different available model. Repeat with an explicit caller
override, unavailable model, unsupported effort, Auto/inheritance mode, and
conflicting user/profile defaults. Run explicit skill invocation and negative
activation prompts. Check that copied resources work without this checkout.
Do not interpret SDK-level support as proof the model-facing tool exposes it.

Resolve spike results with these rules:

| Finding | Implementation decision |
| --- | --- |
| Direct model/effort dispatch and resource loading pass | Use skills plus native child tools; no custom profile |
| Model routing works but an optional effort level does not | Support only verified levels; reject or apply an explicitly configured fallback |
| An enforceable routing guarantee needs a thin profile | Isolate and document that adapter exception; preserve the shared skills-first core |
| Shared discovery metadata conflicts | Generate host-specific metadata/package output from the same authored skills |
| A client is unavailable for testing | Record not tested; continue other implementation work and do not advertise verified support there |
| A host silently changes models with no reliable detection/control | Mark strict routing unsupported for that mode/version; no silent success claim |
| OpenCode supports per-call selection after all | Remove the model-only shim if permissions/step behavior remain correctly represented |

Publish a current support matrix with verified, limited, and not-tested states.
The release gate is per target: all required checks for that target must pass.
Do not block the entire refactor on an unavailable desktop app or optional cloud
surface, but do not label them complete based on another client's result.

Automated tests must cover resource-link resolution, task/route mapping,
target model/effort serialization, complete argument behavior, absence of
obsolete host claims, generated-artifact drift, source/output confinement,
owned-file retirement, modified files, old copy/link states, and duplicates.
Retain Linux, Windows, and macOS coverage. No test should make paid model calls
as part of ordinary static CI.

Before implementation, run the existing verification baseline with Node.js 20
or later. These checks should keep running during migration with updated
contracts, plus the new standalone-installer and runtime-binding tests:

```sh
node scripts/validate.mjs
node scripts/test-installer.mjs
node scripts/test-build.mjs
node scripts/publish-default-plugin.mjs --check
git diff --check
```

Use temporary directories for build/installer tests. Only regenerate committed
plugin/catalog artifacts through the publisher, and commit them with the source
changes that produce them. Update `CONTRIBUTING.md` and CI to list any added
test entry points. Preserve old install-state fixtures for update/uninstall
coverage even after the old authored files disappear.

Live workflow checks must demonstrate:

- Both workflows invoked as skills, with no custom coordinator selected.
- Routine implementation and hard implementation use different configured
  routes; an explicit caller override reaches the actual child model.
- A fresh independent reviewer inspects changes; a blocking finding reaches
  a fresh fix child and is verified/re-reviewed within the existing caps.
- The coordinator/model ceiling is reported accurately; invalid models,
  unsupported effort, user overrides, Auto mode, and fallback are not hidden.
- Children receive repository instructions and can load packaged skill
  resources. Built-in agent behavior must not truncate or alter required task
  reports; choose a general-purpose child where specialist defaults conflict.
- Ordinary work remains session-only and uncommitted by default. Investigation
  does not become implementation. PR delivery preserves its existing scope
  and is tested only with explicit authorization in a test repository.
- Autonomous new-goal, budget-only, and empty-input resume work across fresh
  sessions without changing budgets, backlog/handoff rules, or stop conditions.
- Sequential rounds stay sequential, and nested delegation is restricted or
  accurately documented as a prompt-level rule on each runtime.
- Upgrades remove stale commands/agents and old skill names without deleting
  user changes or producing duplicate discovery entries.

Success is a simpler public skill package with verified model routing on
Copilot and Codex, and generated compatibility profiles for OpenCode V2.
Package discovery alone is not the acceptance criterion.
