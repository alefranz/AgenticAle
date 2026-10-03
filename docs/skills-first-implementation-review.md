# Skills-first implementation review

Reviewed on 2026-10-02, branch `docs/skills-first-coding-plan`, implementation
commit `e37272f`. Compared with [the branch's plan](skills-first-coding-plan.md),
the original plan at `aa24aac`, and the behavioral baseline at `b3e3b75`.

**Assessment: the structure follows the plan, but the implementation is not
ready for acceptance.** Discovery, model routing, and installation safety have
issues that can be established without running a live workflow. There are
seven high-priority findings and eight medium-priority findings below.

This review adds only this report. No implementation fixes, commits, real
profile installations, model calls, runtime smoke tests, or end-to-end test
suites were performed. Runtime acceptance remains for the later manual pass.

> **Status (post-review):** all fifteen findings (R1-R15) are addressed on this
> branch; see "Review findings (R1-R15: addressed)" in
> [handoffs/active.md](handoffs/active.md). This report is left as the
> point-in-time snapshot it was taken from. Live runtime acceptance is still
> pending the manual spike.

## What matches the plan

- The authored core now has four public skills, six private task contracts,
  shared rounds, target routing maps, and four named runtime references.
- The modern package removes command wrappers and custom coordinator/worker
  profiles. OpenCode profiles are generated from neutral task contracts.
- Work entry behavior preserves empty-input handling, investigation-only scope,
  `--pr` authorization, uncommitted delivery, sequential rounds, and review caps.
- Autonomous entry absorbs budget/resume/conflict behavior. Comparison with the
  baseline shows that strict defaults, standard-mode exceptions, periodic
  audits, consultation caps, reset rules, and durable templates mostly survive.
- Supporting-skill bodies preserve source-root precedence and source acquisition
  policies. OpenAI invocation policy files disable implicit invocation.
- CI retains Linux, Windows, and macOS. The compatibility document explicitly
  marks live capabilities not tested, which is appropriate for this review.

## High-priority findings

### R1 — `work/SKILL.md` has invalid YAML frontmatter

**Location:** [skills/work/SKILL.md:3](../skills/work/SKILL.md#L3), mirrored in
[the generated package](../plugins/agenticale/skills/work/SKILL.md#L3).
**Plan:** §§2, 5, 7; discoverable, invocable skills and metadata validation.

The unquoted description contains `Explicit-only: invoke`. A colon followed by
whitespace inside this plain scalar makes the frontmatter invalid YAML. Parsing
both authored and published copies with the available `yaml` package reports
`Nested mappings are not allowed in compact mappings`. Hosts using a YAML parser
can reject the public work entry before any workflow runs. The repository's
regex-based validator accepts it.

**Address:** Quote the description or use a YAML block scalar, regenerate through
the publisher, and validate frontmatter with an actual YAML parser. Cover the
installed/generated copies as well as authored source.

### R2 — Modern packages discard installation-time routing choices

**Location:** [scripts/build.mjs:348](../scripts/build.mjs#L348),
[route resolution:433](../scripts/build.mjs#L433),
[skill output:467](../scripts/build.mjs#L467).
**Plan:** §§4–6; explicit model/effort routing, customization, and inheritance.

`loadRouting()` reads custom configuration, but `resolveRoute()` is used only
for OpenCode profiles. All skill trees copy the authored `routing.json`
unchanged. Consequently Copilot and standalone installs with `--routing`,
`--models`, `--effort`, or `--no-model` still ship the packaged explicit routes.
The temporary build state records options but is not installed with the skills.
Even OpenCode's installed routing resource disagrees with customized profiles.

The test at [scripts/test-build.mjs:141](../scripts/test-build.mjs#L141) explicitly
requires the plugin to be byte-identical with and without `--no-model`, enforcing
this defect rather than the documented behavior.

**Address:** Materialize the resolved routing policy into every generated skill
tree, preserving intentional inheritance and configured fallbacks. Verify each
target's installed policy reflects its selected model and effort. Replace the
byte-identity assertion with semantic customization checks.

### R3 — Workflow entry points do not load routing or runtime bindings

**Location:** [work dispatch:13](../skills/work/SKILL.md#L13),
[work routing:74](../skills/work/SKILL.md#L74),
[autonomous routing:58](../skills/autonomous/SKILL.md#L58),
[shared rounds](../skills/work/references/rounds.md).
**Plan:** §§3–4; select a binding from the actual tool surface and resolve every
round's route before native dispatch.

Neither workflow nor the required round reference instructs the coordinator to
read `ROUTING.md`, `routing.json`, or a runtime reference. The entry paths point
only to rounds and task contracts. Thus the protocol never requires the model
to discover the override precedence, native model/effort dispatch rules,
unsupported-host handling, or requested-versus-effective evidence requirements.
An agent can follow the loaded skill and spawn children with inherited settings.
Work also says unmapped routes inherit, conflicting with the complete-policy
rule that missing keys are errors.

**Address:** Add a mandatory preparation step shared by both workflows: load
the policy and routing contract, select/read the applicable runtime binding,
resolve the named key and any override, and dispatch using the exposed native
schema. Specify failure/fallback handling and evidence recording. Remove
unmapped-route inheritance from the new complete-policy path. Live schema
qualification can remain deferred, but resource loading must be wired now.

### R4 — OpenCode silently drops the `implement-hard` route

**Location:** [adapter mapping](../adapters/opencode/adapter.json#L8),
[scripts/build.mjs:303](../scripts/build.mjs#L303),
[OpenCode binding](../skills/work/references/runtimes/opencode.md#L25).
**Plan:** §4 and the mandatory preservation of difficulty-based model selection.

Both implementation keys map to one profile. `canonicalRoute()` chooses
`implement`, so `implement-hard`'s model and effort are never rendered. With the
packaged mapping, hard slices receive the routine `gpt-6-luna`/`max` profile
instead of their configured `gpt-6-sol`/`high` route. Passing hard-task context
cannot change a model pinned in a profile when per-call overrides are unavailable.

The implementation commit also changed the plan's §4 table from seven profiles
to six. That amendment conflicts with the plan's stronger routing invariant and
its still-seven-profile output sketch; it does not solve the dispatch problem.

**Address:** Keep distinct generated routing profiles sharing `implement.md`, or
use a verified native override mechanism. Reconcile the plan explicitly and
check that changing only `implement-hard` changes the effective hard route while
routine implementation remains unchanged.

### R5 — Copilot's explicit-only flag is placed in the wrong field

**Location:** [work frontmatter:6](../skills/work/SKILL.md#L6),
[autonomous frontmatter:5](../skills/autonomous/SKILL.md#L5),
[validator:156](../scripts/validate.mjs#L156).
**Plan:** §2; `disable-model-invocation: true` for Copilot.

The skills set `metadata.copilot/disable-model-invocation`, and the validator
requires that exact placement. The documented Copilot control is the top-level
boolean `disable-model-invocation`; its default is false. The current metadata
does not set that native field, so the package does not encode the promised
activation policy for Copilot. Prose in the description is insufficient to
replace the host control. See the
[official Copilot skills reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference#skills-reference).

**Address:** Emit the documented flag in shared or target-specific frontmatter,
update validation, and regenerate artifacts. Keep OpenAI's existing invocation
policy and OpenCode's adapter metadata. Leave actual negative-activation checks
to the manual runtime pass.

### R6 — Legacy link migration treats modified destinations as owned

**Location:** [scripts/install.mjs:600](../scripts/install.mjs#L600),
[removal:706](../scripts/install.mjs#L706).
**Plan:** §6; preserve modifications, detect collisions, and migrate only owned
links/files.

For any old link-state entry, migration schedules removal solely because a
destination exists. It does not check `isSymbolicLink()` or compare its current
target with `stored.linkTarget`, although `entryMatches()` already supports that
comparison. A user-replaced link, regular file, or directory is therefore removed
without `--replace` and treated as space for new files. A directory can contain
unrelated user content. Backing it up does not satisfy preservation/collision
semantics. Migration removals also bypass the managed-parent checks applied to
new writes, allowing a linked ancestor to redirect a retired-path removal.

**Address:** Verify current link ownership and physical ancestors before planning
or performing removals. Preserve changed destinations and report collisions;
require explicit replacement where appropriate. Add fixtures with changed link
targets, links replaced by populated directories, and linked parent directories,
including legacy schemas 1–3 as well as 4.

### R7 — Build deletes more of `standalone/` than its ownership inventory allows

**Location:** [owned roots:33](../scripts/build.mjs#L33),
[ownership check:408](../scripts/build.mjs#L408),
[recursive deletion:444](../scripts/build.mjs#L444).
**Plan:** §§5–7; explicit output ownership and confinement.

The ownership check covers `standalone/.agents/skills`, but regeneration deletes
the entire `standalone` directory. By inspection, a fresh output directory
containing only `standalone/keep.txt` passes the unmanaged-bundle check and then
loses that unrelated file. The same mismatch affects subsequent owned builds.

**Address:** Delete only the declared owned root, or explicitly own and validate
the entire directory before replacing it. Preserve neighboring files. Include
physical path/symlink confinement in the build checks; the current guard checks
only lexical paths. Do not exercise these cases against real user directories.

## Medium-priority findings

### R8 — Supporting-skill links escape the installed skill bundle

**Location:** [skills/work/references/rounds.md:15](../skills/work/references/rounds.md#L15)
and [line 20](../skills/work/references/rounds.md#L20).
**Plan:** §3 and the required resource-link-resolution coverage in §7.

Both links use `../../../<supporting-skill>/SKILL.md`; from `work/references/`
they need `../../`. They currently resolve outside the sibling skill root and
are missing in authored and installed layouts. The baseline used the correct
depth. This breaks the full-file loading alternative when exact-ID loading is
unavailable.

**Address:** Restore the sibling-relative paths, regenerate, and check every
local resource link in all three output trees without depending on this checkout.
The common reference also retains the OpenCode profile ID `autonomous/explore`;
use a neutral task/routing key there and leave profile translation to the binding.

### R9 — Standalone defaults do not provide a working documented install path

**Location:** [scripts/install-standalone.mjs:196](../scripts/install-standalone.mjs#L196),
[target guard:319](../scripts/install-standalone.mjs#L319),
[setup instructions](setup.md#L37).
**Plan:** §5; user/project standalone installation for Codex VS Code.

User scope defaults to `~/.config/.agents/skills` or
`$XDG_CONFIG_HOME/.agents/skills`, whereas Codex documents user discovery at
`~/.agents/skills`. A successful default user installation can remain invisible.
See [official OpenAI skill-discovery documentation](https://learn.chatgpt.com/docs/build-skills#where-codex-loads-local-skills).

The README's bare `node scripts/install-standalone.mjs --no-model` also selects
this checkout's `.agents/skills` when run from the checkout, and the overlap
guard rejects it. The docs do not supply a usable external project target or
explain running the absolute script path from a different project.

**Address:** Use the target client's documented user location and show a working
project invocation with an explicit destination or working directory. Preserve
source safety while distinguishing generated install destinations from authored
files. Cover default user/project path selection, including Windows.

### R10 — Caller routing validation omits required schema checks

**Location:** [scripts/build.mjs:219](../scripts/build.mjs#L219),
[route resolution:293](../scripts/build.mjs#L293),
[documented schema](../skills/work/references/ROUTING.md#L80).
**Plan:** §4; reject unknown keys, bad types, contradictory fields, and unsupported
fallbacks/efforts.

The builder ignores unknown runtime/route keys, does not validate fallbacks, and
accepts `inherit` entries carrying model/effort fields. A misspelled additional
route can be accepted without effect; invalid fallback values survive unchecked.
Explicit entries without effort are intentionally accepted even though the
written contract requires effort. `--effort` on an inherited route additionally
creates an `explicit` result without a model. The shipped policy's inherited
entries produced by legacy import contain `fallbacks: []`, while `ROUTING.md`
forbids that field in inherit mode.

**Address:** Define one consistent schema for authored, imported, and caller
policies; share its validator. Reject typos and contradictory fields, validate
ordered fallback pairs, and explicitly settle optional effort and effort-only
inheritance semantics. Add negative cases against the actual builder input.

### R11 — Duplicate plugin/standalone installations are not handled

**Location:** [scripts/install-standalone.mjs:513](../scripts/install-standalone.mjs#L513),
[setup documentation](setup.md).
**Plan:** §5 explicitly requires handling duplicate plugin and standalone installs.

The standalone installer examines only its target and its own state. There is
no duplicate-source check, warning, or documented choice when AgenticAle is
already installed as a plugin or in another discovered scope. OpenAI documents
that same-named skills can both appear in selectors. This can expose multiple
workflow entries with different routing/resources.

**Address:** Define and document a supported source/scope choice. Detect known
duplicates where possible and report actionable instructions; where detection
is unavailable, require an explicit documented choice. Add coverage for project
and user skill copies alongside a plugin. Do not silently edit unrelated config.

### R12 — Current-schema updates do not retire removed owned files

**Location:** [OpenCode migration selection:626](../scripts/install.mjs#L626),
[OpenCode early return:668](../scripts/install.mjs#L668),
[standalone planning:519](../scripts/install-standalone.mjs#L519),
[standalone state replacement:595](../scripts/install-standalone.mjs#L595).
**Plan:** §§5–7; owned-file retirement and modified-file preservation.

Legacy OpenCode schemas are migrated, but current-schema updates plan only the
new inventory. Existing owned paths absent from the new output are never
retired. Standalone updates replace the state with only new entries, losing
ownership of stale files. OpenCode can report up-to-date without reconciling
state entries at all. A removed runtime/task reference can consequently remain
installed and later survive uninstall.

**Address:** Reconcile old and new inventories on every update. Remove only
unmodified owned retirees, report/preserve modified ones, and update state even
when the new files already match. Cover a removed resource in both current schemas.

### R13 — The OpenAI marketplace is a Copilot catalog clone

**Location:** [scripts/publish-default-plugin.mjs:26](../scripts/publish-default-plugin.mjs#L26),
[OpenAI catalog](../.agents/plugins/marketplace.json).
**Plan:** §5; respective catalog schemas pointing to the same package.

`openaiMarketplaceManifest()` clones the Copilot manifest. It omits the
OpenAI-documented per-entry `policy.installation` and `policy.authentication`.
Calling the shape unverified does not implement the distinct catalog contract,
and `--check` merely compares artifacts with the same generator. A plain-string
local `source` is documented as supported, so that field alone is not a defect.
See [official OpenAI marketplace metadata](https://developers.openai.com/plugins/build/plugins#marketplace-metadata).

**Address:** Generate the documented OpenAI catalog separately while retaining
the shared plugin. Validate the catalog against its host contract in static
checks. Leave actual discovery/installation to the later manual pass.

### R14 — Reviewer contracts conflict with authorized autonomous Git persistence

**Location:** [review contract:15](../skills/work/references/tasks/review.md#L15),
[deep-review contract:22](../skills/work/references/tasks/deep-review.md#L22),
[autonomous persistence:185](../skills/autonomous/SKILL.md#L185),
[review template:498](../skills/autonomous/SKILL.md#L498).
**Plan:** mandatory baseline-policy preservation and explicit conflict resolution.

The new review and deep-review contracts categorically forbid commits/pushes,
but autonomous requires their handoff-only changes to follow the active Git
policy, including authorized commit mode. The baseline role bodies deferred to
the supplied authorization. A reviewer following the new prohibition can leave
required durable-note commits unfinished despite the workflow's expectations.

**Address:** Either preserve narrowly authorized operational-note persistence,
or explicitly make reviewers report-only and have the coordinator persist and
commit their records. Reconcile templates, contracts, and permissions together;
keep product-code editing and unauthorized publication prohibited.

### R15 — Previous build ownership state has no upgrade path

**Location:** [scripts/build.mjs:401](../scripts/build.mjs#L401),
[build setup](setup.md#L188).
**Plan:** §6; version ownership schemas and preserve migration compatibility.

The baseline builder wrote `{schema: 1, package: "agenticale", outputs:
["opencode", "copilot/agenticale"]}`. The new builder accepts only schemaVersion
2 and rejects any prior state as invalid. An existing default `dist` therefore
blocks the documented `node scripts/build.mjs` after switching/upgrading, with
no migration guidance. The retired `copilot/agenticale` output is also outside
the new inventory.

**Address:** Provide safe migration/retirement for known old build ownership,
or an explicit documented transition to a new output directory with safe
cleanup instructions. Distinguish recognized old state from malformed state,
and preserve unowned paths. Add an old-build-state fixture.

## Verification and remaining acceptance work

Checks performed locally with Node.js `v26.7.0` on Windows:

| Check | Result |
| --- | --- |
| `node scripts/validate.mjs` | Passed; its current checks miss findings above |
| `node scripts/publish-default-plugin.mjs --check` | Passed; generator and committed artifacts agree |
| `node --check` for every `scripts/*.mjs` file | Passed |
| Actual YAML parsing of workflow frontmatter and OpenAI policy files | Failed for authored/published work frontmatter; other inspected files parsed |
| Local Markdown resource-link inspection under `skills/` | Found the two missing supporting-skill links in R8 |
| `git diff --check` | Passed before adding this report; repeated after writing it |

`test-build.mjs` and `test-installer.mjs` were inspected, not executed. Their
existing assertions do not establish compliance: several check fixed file
counts or encode incorrect behavior, and runtime-binding/argument semantics,
resource links, duplicate discovery, and migration safety need stronger static
or isolated regression coverage. No results are claimed here for Linux/macOS
execution or for the baseline commit's verification suite.

Before the manual pass, address R1–R15, regenerate only through the publisher,
and update validators/tests to verify the corrected behavior. Required additional
coverage includes native model/effort serialization, policy propagation into all
targets, explicit-only metadata, actual YAML parsing, installed resource links,
entry arguments and budgets, preservation of modified links/files, output
ownership, current-schema retirement, and duplicates. These checks need no paid
model calls.

Keep the following live acceptance work **deferred to manual testing**:

- Exact exposed dispatch schema, native model identifiers, available effort
  values, bounded fresh contexts, and requested/effective route evidence on each
  target. Generic descriptions in runtime references remain qualification work.
- Actual skill expansion and negative activation on Copilot CLI, Agent Host,
  standalone app, Local harness, Codex CLI, official Codex extension, and OpenCode.
- Routine versus hard routing; explicit override, inheritance/Auto mode,
  unavailable-model, unsupported-effort, fallback, and conflicting-default cases.
- Independent review/fix gates and caps, interruption recovery, ordinary work
  delivery, autonomous budget/resume/new-goal conflict handling, and supporting
  skill use. PR delivery requires the explicitly authorized disposable test repo.
- Upgrade discovery after command/profile retirement, installed resources without
  this checkout, and minimum supported client/bundled-harness versions.

Record evidence separately for Agent Host and the standalone Copilot app rather
than treating their shared SDK as qualification of both. Keep cloud-agent support
as the plan's secondary target. Expand `runtime-compatibility.md` into per-surface
records with prompts, schemas, requested/effective settings, and evidence paths
when manual results become available; no target is verified by this review.

Finally reconcile documentation status: the plan still says installation has
not changed, the handoff says documentation is in progress and the plan was not
edited, and README/setup contain unverified picker/discovery claims. Mark the
implementation as pending corrections and manual qualification, resolve the
six/seven-profile inconsistency, update moved baseline links, and review release
versioning before publishing this breaking layout change.
