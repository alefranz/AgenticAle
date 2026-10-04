# Skills-first branch follow-up review

## Post-fix verification — 2026-10-02, `c70c5c4` plus working-tree fixes

**Assessment: no remaining code or packaging blockers for PR submission.**
F13 is closed in both installers: each destination is registered for rollback
after the parent safety checks and successful replacement removal, before the
write can fail. F11's confinement checks remain in place.

Independent verification passed:

- `node scripts/validate.mjs`.
- `node scripts/test-installer.mjs`: 175 assertions, including the new
  replacement-write failure fixtures for both installers.
- `node scripts/test-build.mjs`: 207 assertions.
- `node scripts/publish-default-plugin.mjs --check`: 0.3.0 artifacts current.
- Working-tree and full-branch/base whitespace checks.
- Additional disposable-target probes that write partial bytes and then throw
  `ENOSPC`, for both replacement and missing-file creation in both installers:
  original replacement bytes restored, partial new files removed, and original
  ownership-state bytes unchanged in all four cases.

The practical scope remains Codex VS Code first, a portable plugin package, and
the retained generated OpenCode adapter. No further redesign or broad client
qualification is required to submit this experimental PR. The tiny Codex VS
Code implementation-plus-independent-review smoke test has **not** been run;
state that limitation in the PR and complete it before claiming verified
extension workflow support. Static tests do not establish that live behavior.

This recheck changed only this report; the installer fixes and regression tests
were already present in the working tree. Nothing was committed or published.
The pre-fix assessment below is retained as historical evidence.

---

## Pre-fix practical review — 2026-10-02, `c70c5c4`

Acceptance target: a working solution for the **official Codex VS Code
extension**, a reasonable Agent Plugins layout, and retained OpenCode V2
compatibility. A full client matrix, further architecture work, and stylistic
perfection are not requirements for this PR.

**Assessment: one small installer correction remains before a clean review.**
F11 and F12 are addressed, including regressions for their actual triggers.
The four-skills / shared-task-contracts / generated-OpenCode-adapter layout is
appropriate for this scope. Do not reopen the accepted extraction or routing
design. Working Codex extension behavior still needs one tiny live smoke test;
passing artifact checks establishes packaging/install behavior, not execution
inside the extension.

### F13 — P2: a failed replacement write is omitted from rollback

Locations: [OpenCode replacement loop](../scripts/install.mjs#L819) and
[standalone replacement loop](../scripts/install-standalone.mjs#L725).

The new `mutatedPaths` tracking adds a content path only **after** `writeFile`
succeeds. A replacement first removes the existing destination. If the write
then fails (for example, insufficient disk space), the destination has already
changed but is absent from the rollback set. Its backup is never restored.
A write that partially creates a file before failing has the same tracking gap.

Reproduced independently for both installers in disposable targets:

1. Install normally with `--no-model`.
2. Replace the installed `work/SKILL.md` (under `skills/` for OpenCode) with
   recognizable custom content and save the ownership-state bytes.
3. Run the same install with `--replace`, using a temporary Node `--import`
   hook to inject a one-shot `ENOSPC` error on that destination's `writeFile`.
   Build writes, backups, and other destination writes run normally.
4. Both commands exit **1**, but the destination is **missing** (`ENOENT`).
   Both report "Partial install changes were rolled back." State bytes are
   unchanged and a backup is retained, so manual recovery remains possible;
   automatic restoration is incomplete.

Correction: register a replacement immediately after its successful removal,
before attempting the write. Also track a newly created destination when a
failed write leaves it partially written. Keep the preflight and restoration
confinement checks introduced for F11. Add focused write-failure fixtures for
both installers asserting restored original content, unchanged state, and no
partial newly created file. This requires no installer redesign.

### Verification and close-out

| Check | Result |
| --- | --- |
| `node scripts/validate.mjs` | Passed |
| `node scripts/test-build.mjs` | Passed: 207 assertions, including F12 |
| `node scripts/test-installer.mjs` | Passed: 165 assertions, including F11 for both installers |
| `node scripts/publish-default-plugin.mjs --check` | Passed: 0.3.0 artifacts current |
| `git diff --check b3e3b75 HEAD` | Passed |
| Injected replacement-write failure, both installers | Reproduced F13 |
| Codex CLI 0.159.3 native prompt-input inspection, disposable standalone install | Installed skill root and the two supporting skills found; no model call or workflow run |
| Codex VS Code extension implementation plus independent review | Not executed |

Checks ran on Windows with Node.js `v26.7.0`. The committed portable manifest
and `skills/` layout agree with the current
[official packaging reference](https://developers.openai.com/plugins/build/plugins).
OpenCode retains its seven generated routing profiles and installer coverage;
its live workflow remains untested and can stay an explicit compatibility
follow-up for this Codex-focused PR.

Minimum useful close-out:

1. Fix F13 and run its regressions plus the existing checks.
2. In the Codex VS Code extension, install standalone skills into a disposable
   project with `--no-model`. Explicitly invoke `work` for one trivial change,
   observe a fresh implementation child followed by a separate review child,
   run the relevant check, and confirm the result stays uncommitted without
   autonomous operational files. Record the extension version, native dispatch
   fields, and inherited settings where the host exposes them. If effective
   model/effort metadata is unavailable, record that limitation. This one
   working inheritance path is sufficient for the user's current scope;
   explicit model routing and autonomous/client matrices can follow separately.
3. Record that result in `runtime-compatibility.md` and reconcile the handoff,
   then submit the PR with the remaining runtime limitations stated plainly.

Nonblocking documentation cleanup: README/runtime notes still call this a
"documentation-only" pass, `architecture.md` still names version `0.2.0`, and
`CONTRIBUTING.md` has old profile/test counts. These do not require another
design pass and should not grow the acceptance scope.

This review changes only this report. No implementation changes, real-profile
installations, model calls, commits, pushes, or PR publication were performed.
The earlier reviews below remain historical evidence for their named commits.

---

## Current re-review — 2026-10-02, `d4e79ea`

Reviewed the changes since `fd7cf88`, against the F1-F10 findings below,
with a practical acceptance standard: fix reproducible correctness/safety
defects and establish a working workflow; no broader redesign or stylistic
cleanup is required.

**Assessment: close, but two concrete safety fixes remain.** The previous
repairs are substantial, all four verification commands pass, and the branch
whitespace check now passes. Add the two regressions below and fix their
triggers. This review adds findings only; it does not change implementation,
install into real profiles, invoke models, commit, push, or publish the PR.

### F11 — P2: a refused installer update still replaces external files during rollback

Locations: [OpenCode rollback](../scripts/install.mjs#L811) and
[standalone rollback](../scripts/install-standalone.mjs#L718), together with
their planned-path sets at lines 751 and 658. This is the remaining
failed-update confinement issue from F2, rather than a recurrence of its
ownership-state deletion.

Both installers still roll back **every planned path**, including paths whose
parent safety check rejected the operation before any mutation. Rollback has
no corresponding parent safety check: it deletes the pre-existing destination
and copies the backup through the very junction the forward operation refused.
Consequently, a failed update can replace a file outside the installation root.

Reproduced independently for both installers in disposable directories:

1. Install normally with `--no-model` and save the ownership-state bytes.
2. Copy the installed runtime-reference directory to an external directory;
   replace the installed directory with a junction to that copy. The directory
   is `work/references/runtimes` for standalone and
   `skills/work/references/runtimes` for OpenCode.
3. Change the external `codex.md` to custom content. Create a second hard link
   to that file outside the install so replacement is observable.
4. Rerun installation with `--no-model --replace` and the same target.

Both commands exit **1**, correctly reporting a linked ancestor, but rollback
replaces the external `codex.md`: its inode/file identity changes and its link
count drops from **2 to 1**, breaking the original hard-link relationship.
The external bytes are restored in this fixture and the original state bytes
are preserved; this is not a claim of lost file contents. The defect is that
the refused operation nevertheless deletes/recreates an external file it
never changed. The existing F2 tests use an **empty** external directory and
therefore miss this path.

Correction: validate all planned mutation parents before backing up or changing
content, allowing for explicitly owned links that a legacy migration removes.
Track actual mutations and roll back only those paths; apply confinement checks
to restoration too. Add a populated-junction rejection fixture for each
installer and assert external file identity/content and state bytes remain
unchanged. No installer redesign is necessary.

### F12 — P2: a missing output path can bypass source confinement through a linked ancestor

Locations: [missing-path resolution](../scripts/build.mjs#L522),
[physical source check](../scripts/build.mjs#L577), and
[managed-root anchor](../scripts/build.mjs#L558). F1's intermediate-parent
deletion trigger is fixed, but resolution still does not handle a missing
output root through its nearest existing ancestor.

`resolveRealPath()` returns the lexical path on `ENOENT`. If `--output` is
not yet present beneath a junction, the physical source check never sees
where it will be created. The managed-root check also starts at that missing
output, so it compares two lexical fallbacks and accepts the path.

Reproduction used a disposable copy of the repository's `scripts`, `skills`,
`adapters`, and `examples`, leaving this checkout untouched: create
`source-alias` as a junction to the copied repository's `skills`; run
`node <copied-repo>/scripts/build.mjs --output <source-alias>/missing-output`.
The command exits **0** and creates all three bundles and the state file under
`<copied-repo>/skills/missing-output`, despite the explicit prohibition on
building inside source directories. No ownership-state forgery or concurrent
filesystem change is required. This fixture demonstrates source pollution;
it does not demonstrate deletion of pre-existing authored files.

Correction: resolve the nearest existing ancestor, append the missing path
segments, and use that physical destination for the source-overlap checks.
The installers already use this pattern in `physicalPath()`. Add a fixture
with a missing output under a source-linked ancestor, asserting rejection
and no new files in the source tree.

### Previous findings: current disposition

| Finding | Re-review result |
| --- | --- |
| F1 | Awaited guard and current/legacy intermediate-root checks fix the reported deletion trigger. Missing output ancestry remains in F12. |
| F2 | Original ownership-state bytes are now preserved after failed missing-file repairs; new regressions pass. Planned-path rollback still needs F11. |
| F3 | The actual baseline state format is recognized; existing newly introduced roots are refused. Migration and unowned-content regressions pass. |
| F4 | Catalog generation uses the policy values requested by the previous review and checks their enums; publisher check passes. Live host installation remains untested. |
| F5 | Inherited routes with `--effort`, including `--no-model --effort`, are now rejected before mutation; regressions pass. |
| F6 | Undeclared runtimes are filled from the packaged preset before rendering; caller maps retain precedence. Regression passes. |
| F7 | Real user/project duplication now has detection and an isolated regression. Ancestor scopes/plugin stores remain best-effort; expanding detection is not a blocker for this PR. |
| F8 | README/setup now show user scope from the checkout and an absolute script path from an external project. The reported quick-start failure is addressed. |
| F9 | Reviewer notes remain working-tree edits; the coordinator explicitly owns their authorized commits/pushes. The conflicting instructions are reconciled. |
| F10 | OpenCode's up-to-date condition now includes inventory equivalence; the missing-retired-entry regression passes. |

### Verification and practical close-out

Local checks used Node.js `v26.7.0` on Windows; other OS/Node versions were not
executed in this re-review.

| Check | Result |
| --- | --- |
| `node scripts/validate.mjs` | Passed |
| `node scripts/test-build.mjs` | Passed: 205 assertions |
| `node scripts/test-installer.mjs` | Passed: 153 assertions |
| `node scripts/publish-default-plugin.mjs --check` | Passed: 0.3.0 artifacts current |
| `git diff --check b3e3b75 HEAD` | Passed |
| Populated external-junction update, both installers | Reproduced F11; original state bytes preserved |
| Missing output beneath a source-linked ancestor, disposable source copy | Reproduced F12 |

The minimum useful close-out is:

1. Fix F11/F12 and add their focused regression fixtures; rerun the existing
   checks. Do not reopen accepted routing, packaging, or workflow extraction.
2. Record a tiny live implementation plus independent review on the primary
   runtime(s) being claimed as working, including actual dispatch fields and
   requested/effective routing. The current compatibility document still has
   no executed workflow evidence. Untested clients and the larger scenario
   matrix can remain explicit follow-up work; a full desktop/cloud matrix is
   not required to close this PR.
3. Update `docs/handoffs/active.md` to match that result. Its current "all
   findings are addressed; only live verification remains" statement is ahead
   of the evidence, and its documentation-in-progress text is stale.

The historical review below remains intact for traceability. Its assessment,
open-finding counts, test counts, whitespace result, and broad acceptance list
describe `fd7cf88`; use this section for the current disposition and scope.

---

## Historical review — `fd7cf88`

Reviewed on 2026-10-02 at `fd7cf88` on `docs/skills-first-coding-plan`.
Scope: the entire branch against `b3e3b75`, with particular attention to the
post-review changes from `e37272f`. Requirements are
[codex-support-plan.md](codex-support-plan.md), its delegated
[skills-first-coding-plan.md](skills-first-coding-plan.md), and
[skills-first-implementation-review.md](skills-first-implementation-review.md).
The original plan at `aa24aac` and baseline installer/build formats were also
compared.

**Assessment: not ready for acceptance.** Many repairs are real, and all four
existing verification commands pass. However, isolated fixtures reproduce
deletion outside a build's output root and loss of installer ownership state
on failed updates. Eight further medium-priority issues remain. The claim that
all R1-R15 are addressed is too strong. Live runtime qualification remains a
separate, deliberately deferred acceptance gate.

This review changes only this report. No implementation fixes, commits, real
profile installations, model calls, PR publication, or live workflow tests were
performed. Build/install probes used disposable directories, including an
isolated fake user home for scope-discovery checks. YAML parsing used a
temporary installation of the `yaml` package, without repository dependencies
or package-file changes.

## Findings

### F1 — P1: build confinement still permits deletion through linked parents

Locations: [build safety check](../scripts/build.mjs#L502),
[its invocation](../scripts/build.mjs#L568), and
[owned-root deletion](../scripts/build.mjs#L598). Related to R7.

The guard checks whether each final output root is itself a symbolic link,
but does not check intermediate parents such as `output/plugin` or
`output/standalone/.agents`. A regular directory reached through a linked
parent passes `lstat(managedPath)`. Recursive deletion then follows that parent
and removes content outside the selected output root.

Reproduction: create a temporary output with a valid schema-2 ownership state;
make `output/plugin` a junction to a separate temporary directory containing
`agenticale/keep.txt`; run a normal build. It exits **0** and the external
`keep.txt` is deleted. No forged file digest or concurrent filesystem change is
needed; this simulates a previously owned build whose parent was repointed.

The guard is also asynchronous but is called without `await`. Its errors do
not enter the builder's normal error handling, and it is not a barrier before
mutation. With Node's `--unhandled-rejections=warn`, a directly linked
`output/opencode` produces a safety-rejection warning, but the build replaces
the link and finishes successfully. Default Node rejection handling can instead
terminate the process; neither behavior supplies an awaited safety gate.

Correction: await the guard before any operation, verify physical confinement
of every managed root and ancestor, and resolve missing paths through their
nearest existing ancestor. Apply the same checks to legacy roots. Add fixtures
for linked intermediate parents and missing descendants, checking both exit
status and preservation of outside sentinels.

### F2 — P1: failed updates delete the existing ownership-state file

Locations: [OpenCode rollback](../scripts/install.mjs#L808) and
[standalone rollback](../scripts/install-standalone.mjs#L703), together with
their conditional backup allocation at lines 757 and 651. Related to R6 and
the plan's rollback/ownership requirements.

Both installers allocate backups only when a planned content path already
exists. An update that needs only missing files can therefore have an existing
state file and `backupDirectory === null`. On failure, rollback deletes that
state file before evaluating `join(backupDirectory, stateName)`, which throws.
The remaining install loses its ownership information and cannot be safely
uninstalled through the normal command.

Reproduction, independently for both installers: install normally into a
temporary target; replace the installed `work/references/runtimes` directory
(under `skills/` for OpenCode) with a junction to an empty temporary directory;
rerun the same install. Existing unaffected files are kept and missing runtime
references require creation. The parent check rejects the write. The process
exits **1**, reports `Automatic rollback also failed` with a null-path error,
and the original state file is **gone**.

Correction: preserve the pre-update state independently of content backups;
restore it only if it was actually changed. Validate all mutation parents
before backups or writes, and roll back actual mutations rather than every
planned path. Verify unchanged state bytes after failures during missing-file
repair and inventory growth, with and without content replacements.

### F3 — P2: the legacy build-state reader still rejects the real baseline

Location: [legacy recognition](../scripts/build.mjs#L547). R15 remains open.

The baseline builder writes
`{schema: 1, package: "agenticale", outputs: ["opencode", "copilot/agenticale"]}`.
The new reader instead requires `schemaVersion: 1` and
`package.name === "agenticale"`. A fixture containing the exact baseline
format exits **1** with `Build state is invalid`. An existing default `dist`
still blocks the documented build after upgrading.

Correction: recognize the actual baseline format, using fixtures generated
from or copied exactly from the old builder. Preserve unowned paths during
migration. In particular, the existing legacy branch treats all *new* output
roots as owned merely because an old state exists; an accepted synthetic
legacy-state fixture with an unrelated `plugin/agenticale/keep.txt` lost that
file. Correcting the field names alone would expose that deletion path to real
baseline upgrades. Validate ownership of newly introduced roots separately.

### F4 — P2: OpenAI marketplace policy values do not match the host contract

Location: [OpenAI catalog generation](../scripts/publish-default-plugin.mjs#L51),
mirrored in [.agents/plugins/marketplace.json](../.agents/plugins/marketplace.json).
R13 is only partially addressed.

The catalog now includes policy fields, but emits `installation: "auto"` and
`authentication: "none"`. Official metadata documents installation values
`AVAILABLE`, `INSTALLED_BY_DEFAULT`, and `NOT_AVAILABLE`; authentication
policies use `ON_INSTALL` or `ON_USE`. The generated values are not those host
policies. Absence of an MCP authentication requirement does not make `none` a
documented marketplace authentication policy.
[Official packaging reference](https://developers.openai.com/plugins/build/plugins#marketplace-metadata),
[official policy description](https://learn.chatgpt.com/docs/enterprise/plugin-management).

Correction: emit documented values appropriate to this package and validate
their allowed values independently of the generator. The current publisher
check establishes artifact currency, not host-schema validity. Live catalog
installation can remain in the manual pass.

### F5 — P2: `--effort` on an inherited route produces contradictory outputs

Locations: [profile route resolution](../scripts/build.mjs#L357) and
[policy materialization](../scripts/build.mjs#L426). Related to R2 and R10.

With a valid caller policy setting `review` to `{mode: "inherit"}`, building
with `--effort low` emits an OpenCode review profile with
`reasoningEffort: low` and no model, while installed `routing.json` still says
`{mode: "inherit"}`. Its contract means inherit both model and effort. The
build-state profile record additionally labels this model-less route
`explicit`, a shape the strict routing validator itself rejects.

Reproduction: change `review` to inheritance in each runtime of the packaged
policy, then build with that policy and `--effort low`. The build exits **0**;
the generated profile and installed policy disagree as described.

Correction: settle effort-only inheritance semantics explicitly. Either keep
inherited entries untouched in both renderers, reject the combination, or
version the schema to represent effort-only overrides. Resolve once and use
that same validated result for profiles, installed policies, and build state.

### F6 — P2: an omitted runtime silently creates model-neutral profiles

Locations: [runtime schema validation](../scripts/build.mjs#L253),
[missing-runtime resolution](../scripts/build.mjs#L352), and
[materialization](../scripts/build.mjs#L422). Related to R2/R10 and plan §4.

Caller validation accepts a nonempty subset of runtimes, but the builder
always emits all three targets. A complete Codex-only caller file therefore
produces seven OpenCode profiles with no model or effort despite no
`--no-model` request; the copied OpenCode policy has no `opencode` map either.
The packaged fallback is unavailable because its policy was replaced wholesale.
This silently makes a missing configuration behave like explicit inheritance.

Reproduction: keep the seven `codex` entries and delete `copilot` and
`opencode` from the packaged policy; build with `--routing` pointing to it.
The build exits **0**, reports zero explicit OpenCode profiles, and ships only
the Codex map in every target's routing resource.

Correction: require all runtimes needed by the emitted targets, or merge
undeclared runtime maps from the packaged preset before validating and
rendering. A missing runtime must not silently choose inheritance. Cover both
the multi-target builder and installers supplied with a policy for another host.

### F7 — P2: duplicate detection misses ordinary discovered scopes

Location: [standalone duplicate probing](../scripts/install-standalone.mjs#L522).
R11 is only partially addressed.

Probing only the destination and its immediate parent does not detect the
usual user-plus-project duplication, parent-repository skill scopes, or plugin
stores. The existing duplicate test places an artificial other-installer marker
in the same target, rather than exercising those discovery layouts. The docs
describe the marker notice but give no explicit source-choice procedure for
duplicates the installer cannot detect.

Reproduction: use an isolated fake user home; install with `--scope user`, then
install with `--scope project` into a separate temporary project. Both exit
**0**, both copies contain `work/SKILL.md`, and the second install emits **no
duplicate notice**. Official Codex discovery includes both scopes, and
same-named skills can appear separately in selectors.
[Official skill discovery reference](https://learn.chatgpt.com/docs/build-skills#where-codex-loads-local-skills).

Correction: inspect known discoverable scopes where feasible. Where plugin
state cannot be detected reliably, document an explicit plugin/user/project
choice and how to remove the competing copy. Test actual separate scopes and
plugin layouts without modifying unrelated client configuration.

### F8 — P2: the standalone quick start still fails from this checkout

Locations: [README standalone instructions](../README.md#L56) and
[setup example](setup.md#L44). R9 is only partially addressed.

The user destination has been corrected to `~/.agents/skills`. However, both
quick starts still instruct users to run
`node scripts/install-standalone.mjs --no-model`. From the checkout, that
selects this repository's `.agents/skills`, which the overlap guard rejects.
From another project, the shown relative script path is normally unavailable.
There is still no complete external-project invocation in those instructions.

Verification: the documented command with `--dry-run` exits **1** from the
checkout and reports that the target and checkout must not overlap.

Correction: show a working default user-scope command from the checkout and a
project command with an explicit external destination, or an absolute script
path invoked from the target project. Keep the overlap guard.

### F9 — P2: reviewer contracts still contradict authorized push persistence

Locations: [review permissions](../skills/work/references/tasks/review.md#L18),
[deep-review permissions](../skills/work/references/tasks/deep-review.md#L22),
and [autonomous persistence](../skills/autonomous/SKILL.md#L193).
R14 is only partially addressed.

Operational-note commits are now permitted in commit mode. Both task contracts
still categorically prohibit pushing, even when the supplied autonomous policy
is explicitly authorized `COMMIT AND PUSH`. Autonomous continues to require
review rounds to follow the same policy for handoff-only changes, and its
templates direct reviewers to apply that policy. There is no corresponding
explicit assignment transferring those reviewers' required pushes to the
coordinator. The loaded instructions remain inconsistent for this supported
authorization case.

Correction: either permit narrowly authorized note persistence through the
supplied Git policy, or assign all reviewer-record commits/pushes to the
coordinator and update the workflow/templates consistently. Retain prohibitions
on product-code edits and unauthorized publication.

### F10 — P2: OpenCode's up-to-date path skips state-only reconciliation

Location: [early return](../scripts/install.mjs#L734). R12 is only partially
addressed; standalone already checks state equivalence here.

The OpenCode early return checks files and scheduled removals but not whether
the stored inventory matches the new one. If a removed owned reference is
already absent, migration schedules no removal; with the remaining files
matching, the installer reports up-to-date and leaves the stale entry in state.
The promised every-update inventory reconciliation still does not happen.

Reproduction: install normally, add a state entry for an old reference under
`skills/work/references/` that is absent on disk, and rerun the install. It
exits **0**, prints `Already up to date`, and retains that entry.

Correction: include current-schema state equivalence in the early-return
condition and write reconciled state when only the inventory changed. Cover
already-missing and modified retired entries as well as unmodified existing
retirees.

## Reassessment of R1-R15

These statuses concern static implementation; they do not claim live host
verification.

| Original finding | Follow-up status |
| --- | --- |
| R1: invalid work YAML | Shipped YAML fixed; independent parsing passed. CI still uses an ad hoc guard rather than the requested real parser. |
| R2: routing choices discarded | Default/custom/no-model policies now materialize; remaining contradictions in F5/F6. |
| R3: routing/runtime loading omitted | Static entry wiring added to both workflows. Exact native bindings/effective-route evidence still require the planned manual pass. |
| R4: hard route discarded | Fixed: seven profiles; hard and routine routes are distinct and share one task body. |
| R5: Copilot invocation flag misplaced | Fixed: top-level `disable-model-invocation: true`; native negative-activation testing pending. |
| R6: modified links treated as owned | Live-target comparison added. Failed-update safety is incomplete; see F2. |
| R7: standalone neighbors deleted | Declared-root deletion fixed; physical confinement remains broken, F1. |
| R8: supporting links escape bundle | Fixed: all inspected local skill-resource links resolve, including generated trees. |
| R9: standalone defaults/examples | User path fixed; quick-start failure remains, F8. |
| R10: caller routing schema gaps | Shared strict validator added; resolution/materialization semantics remain inconsistent, F5/F6. |
| R11: duplicate installations | Same-location marker notice added; real scope/source handling remains incomplete, F7. |
| R12: current-schema retirement | Existing unmodified retirees are handled; state-only OpenCode reconciliation remains incomplete, F10. |
| R13: cloned OpenAI catalog | Separate policy fields added with undocumented values, F4. |
| R14: reviewer persistence conflict | Commit mode repaired; authorized push-mode conflict remains, F9. |
| R15: old build ownership upgrade | Still rejects the actual baseline state, F3. |

## Verification

Local execution used Node.js `v26.7.0` on Windows. Linux/macOS and CI Node 22
were not executed by this review.

| Check | Result |
| --- | --- |
| `node scripts/validate.mjs` | Passed |
| `node scripts/test-build.mjs` | Passed: 190 assertions |
| `node scripts/test-installer.mjs` | Passed: 136 assertions |
| `node scripts/publish-default-plugin.mjs --check` | Passed: generated package/catalogs current at 0.2.0 |
| `node --check` across `scripts/*.mjs` | Passed: eight scripts |
| Actual YAML parsing across authored, published, and temporary generated outputs | Passed: 37 documents, including OpenCode profiles |
| Local Markdown resource links across those skill trees | Passed: 120 links |
| Isolated targeted regression probes | Reproduced F1/F2/F3/F5/F6/F7/F8/F10 |
| `git diff --check b3e3b75 HEAD` | Failed: exit 2; 917 trailing-whitespace reports caused by committed CRLF additions |

The green suites do not exercise the failing cases above. In particular,
there is no real baseline build-state migration fixture, inherited-effort
consistency test, omitted-runtime target test, real user/project duplicate
fixture, or failure test asserting preservation of a pre-existing state when
no content backup was allocated. The standalone retirement path also lacks
the corresponding same-schema retirement regression coverage.

The full-branch whitespace result differs from an empty working-tree
`git diff --check`: the latter cannot establish cleanliness of committed
changes. `git ls-files --eol` confirms CRLF in committed new runtime references
and OpenAI policy files. Normalize authored text and regenerate through the
publisher; add a branch/base diff check if that remains an acceptance criterion.

## Documentation and remaining acceptance

Reconcile status before declaring completion:

- `docs/skills-first-coding-plan.md` still says installation/runtime behavior
  have not changed, and its baseline-source Markdown links remain moved paths.
- `docs/setup.md` still describes **six** OpenCode profiles and says hard
  implementation shares the routine profile, contradicting the implemented
  seven-profile layout and its own earlier installation section.
- `docs/handoffs/active.md` says documentation is in progress, later says only
  live verification remains, and states all fifteen findings are addressed.
- README/setup give exact picker/discovery claims while the compatibility
  matrix correctly records every live capability as not tested.
- The breaking package layout retains plugin version `0.2.0`, the baseline
  version. Decide and document release versioning before publication.

The portable architecture substantially follows the plan: four public skills,
six private task contracts, seven routing keys/profiles, two catalogs, and
generated standalone/OpenCode outputs. Supporting-skill source-root and
acquisition policies are preserved. Entry arguments, uncommitted work delivery,
PR authorization, sequential review/fix gates, and most autonomous durable-state
rules survive the extraction. No broad workflow-policy rewrite is required to
address the concrete findings above.

Keep the original manual acceptance work deferred and explicit: skill
discovery/negative activation, exact native dispatch schemas and identifiers,
requested versus effective model/effort, fresh contexts, routine/hard routing,
overrides/inheritance/fallback, independent review/fix caps, interruption
recovery, work delivery, and autonomous resume/budget/conflict behavior. Record
Copilot Agent Host and the standalone app separately; unavailable surfaces
remain not tested. PR delivery needs the explicitly authorized disposable
test repository. The current compatibility document is a test plan, not
completed spike evidence or a minimum-supported-version matrix.

Acceptance requires correcting the static findings, adding regressions for
their actual triggers, reconciling documentation, and then qualifying each
claimed runtime. Green artifact-generation tests alone do not establish the
goal of verified Copilot/Codex model routing.
