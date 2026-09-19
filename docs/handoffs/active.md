# Active handoff

## GOAL

Prepare the `public-release` branch as a sanitized public OpenCode V2 package
that users install into their user profile. Keep the source layout suitable
for later Codex and GitHub Copilot adapters, but do not implement or claim them
in this release.

## ESTABLISHED

- Work is isolated on branch `public-release` from commit `e82e143`.
- The source bundle contains seven OpenCode role agents, two skills, and one
  slash command.
- The public package must not retain environment-specific hosting, identity,
  path, project, or model assumptions.
- Do not push or publish during this preparation work.

## CURRENT STATE

- The installable surface is limited to `agents/`, `skills/`, and `commands/`;
  repository guidance and planning files are explicitly excluded.
- Source agent definitions inherit the active OpenCode model and contain no
  provider-specific identifiers or plan-limit assumptions. Copy installs may
  render per-role model IDs from a validated JSON mapping.
- The workflow defaults to working-tree persistence, permits commits only when
  requested or required by project instructions, and never pushes without an
  explicit user request.
- `scripts/install.mjs` provides dependency-free copy installation by default,
  optional link installation, dry runs, explicit replacement with target-local
  backups, and ownership-aware uninstall that preserves modified content.
- The `source-code-lookup` skill searches local source for dependencies and
  related codebases before decompilation. Copy installs can set its root with
  `--source-root`; the default is `~/dev`. Existing nine-file install state
  can update or uninstall.
- `scripts/test-installer.mjs` covers copy, idempotence, dry-run, collision
  refusal, update/replacement backups, link installation where supported, and
  modified-content preservation on uninstall in isolated temporary profiles.
- A clean temporary user configuration discovered all seven `autonomous/*`
  agents with OpenCode CLI 1.18.14.
- First-run documentation now directs users to invoke `/autonomous <goal>`;
  `/autonomous [budget]` resumes an existing active handoff. The skill is
  hidden from automatic invocation and the separate skill slash catalog.
- Coordinator instructions describe the `autonomous/*` roles as available
  installed roles, whether discovered from the user profile or the project.
- `node scripts/validate.mjs` deterministically checks the exact installable
  bundle, frontmatter and role invariants, routing, provider neutrality,
  sanitation, and obsolete helper absence without third-party dependencies.
- The v0.1 candidate is explicitly alpha and OpenCode V2-only, with requirements,
  roles, limitations, installer rationale, and official V2 documentation links
  collected in the README.
- `docs/architecture.md` separates the portable orchestration protocol from
  OpenCode-specific agents, skill/command routing, permissions, and installation;
  later adapter boundaries are documented without claiming support.
- MIT licensing, concise contributor guidance, an isolated OpenCode discovery
  smoke test, and Node 22 CI on Linux, Windows, and macOS are now present.
- Target projects may omit `AGENTS.md`; all round templates skip it when absent.
- Release review on 2026-09-19 corrected a prior test claim: OpenCode 1.18.14
  was V1. OpenCode V2 2.0.9 resolved all seven agents with the intended model
  mapping, step limits, and permission denials. A throwaway V2 session loaded
  the skill, ran one implementation child and a separate clean review child,
  and archived its handoff. The temporary profile and sessions were removed.
- README and smoke-test guidance now require V2 and use V2 debug commands.
  The final release commit has not run the three-platform CI workflow yet.

## ACCEPTANCE

- A public user can install the skill, role agents, and command into an OpenCode
  V2 user profile.
- Shared workflow prose has one canonical source.
- Harness/model differences are explicit and configurable.
- Validation catches stale generated files and personal/private references.

## NEXT

Run the three-platform CI workflow on the final release commit before
publishing.

## IMPLEMENTATION — optional target guidance contract

- Verified the user's `sampleAGENTS.md` was byte-identical to the prior tracked
  `AGENTS.md`; preserved the intended worktree rename (`AGENTS.md` deleted,
  `sampleAGENTS.md` untracked). Neither path is in the nine-file profile bundle.
- Updated worker, reviewer, and deep-review templates to read target
  `AGENTS.md` only when present; architecture and README state that target
  guidance is optional.
- Verification: `node scripts/validate.mjs`, `node scripts/test-installer.mjs`,
  and `git diff --check` passed. Independent review is deferred until release
  work resumes.

## IMPLEMENTATION — explicit per-role model mapping

- Added `--models PATH` for copy installs. Its JSON object may name any subset
  of the seven exact roles, with safe `provider/model[#variant]` values. Link
  installs and uninstall reject the option. Unmapped agents inherit the session
  model. Bundled `openai`, `zen`, `local`, and `example` presets resolve to
  checked-in JSON mappings. Every install must explicitly choose `--models`
  with a path or preset, or `--no-model`.
- Rendered model frontmatter is hashed in existing install state, so mapping
  changes require explicit `--replace`, trigger existing backups, and unchanged
  configured agents can be uninstalled safely. Supplying `--no-model` on an
  update returns roles to inherited defaults through the same replacement path.
- Added an example with concrete fast, strong, and frontier role assignments,
  and documented model selection and update behavior in README, architecture,
  and smoke-test guidance.
- Verification: `node scripts/validate.mjs` passed; `node
  scripts/test-installer.mjs` passed 181 assertions, including model input
  rejection and update semantics; `git diff --check` passed. The source bundle
  remains nine provider-neutral files.

## IMPLEMENTATION — public-release polish

- Added the MIT licence with the requested 2026 copyright, plus contributor
  guidance that preserves the nine-file installable bundle contract.
- Added a three-platform GitHub Actions matrix using Node 22; each job runs the
  deterministic bundle validator and the 133-assertion installer suite using
  shell-neutral `node` commands.
- Documented the portable orchestration protocol, the current OpenCode V2
  binding, safety/state boundaries, and six concrete future adapter integration
  points without adding adapter machinery or claiming other-harness support.
- Reworked the README for an alpha OpenCode V2 v0.1 candidate: requirements,
  tested versions, workflow/role overview, profile-installer rationale with
  official V2 links, usage, model behavior, limitations, and documentation
  pointers.
- Added a release smoke checklist whose explicit target and OpenCode config are
  under a new temporary directory. A local isolated run with OpenCode 1.18.14
  discovered the skill, seven model-neutral subagents, and command, then safely
  uninstalled all recorded content.
- Verification: `node scripts/validate.mjs` passed the exact nine-file bundle;
  `node scripts/test-installer.mjs` passed 133 assertions; `git diff --check`
  passed. The CI YAML uses only direct `node` invocations under each runner's
  default shell.

## IMPLEMENTATION — profile installer

- Added a cross-platform Node ESM installer whose default target follows the
  documented OpenCode user configuration path and whose install surface is
  limited to the seven agents, one skill, and one command.
- Differing destinations fail before mutation unless `--replace` is explicit;
  replacements are backed up below the target and partial operations attempt a
  rollback. Install state hashes copied files and records link targets so
  uninstall removes only unchanged package-owned entries.
- README guidance now covers recommended copy install, explicit update,
  contributor links, dry runs, target overrides, safe uninstall, the absence
  of a marketplace artifact, and preservation limits for model customizations.
- Verification: `node scripts/test-installer.mjs` passed 49 assertions.

## REVIEW — sanitation slice (2bbcbf8)

Verdict: blocking findings.

- `README.md` presents `/autonomous` as the post-install entry point even for a
  new project, but `commands/autonomous.md` accepts only a round budget and
  requires an existing handoff `NEXT`; document natural-language first-run
  usage and make clear that the command resumes prepared state, or redesign
  the command to accept a goal.
- `commands/autonomous.md` and `skills/autonomous-mode/SKILL.md` instruct the
  coordinator to use “project-local” roles although this package installs them
  globally; replace that wording with installed/available `autonomous/*` roles.

Evidence: OpenCode 1.18.14 with an isolated `XDG_CONFIG_HOME` discovered all
seven agents, the skill, and `/autonomous`; resolved agents had V2 mode, steps,
permissions, and no model override. `git diff --check` and a tracked-content
grep found no retained local URLs, provider/model IDs, or project-specific
names. Official V2 agent/command/skill docs match the shipped discovery paths
and frontmatter schema.

## FIX — sanitation review findings

- Corrected the README entry flow without changing the command argument
  contract: natural-language skill invocation initializes a new goal, while
  `/autonomous [budget]` resumes an active `NEXT` action.
- Replaced the inaccurate “project-local” role wording in the command and
  canonical skill with installed/available role language.
- Verification: `rg -n -i "project-local" commands/autonomous.md
  skills/autonomous-mode/SKILL.md` returned no matches; `git diff --check`
  passed.

## RE-REVIEW — sanitation fix (bdf0894)

Verdict: clean; both prior blocking findings are resolved.

- First-run natural-language invocation supplies the goal consumed by skill
  setup, which creates the active handoff before round 1; `/autonomous
  [budget]` is consistently limited to resuming its exact active `NEXT`.
- Installable instructions now route through installed `autonomous/*` roles
  available to OpenCode; no stale “project-local” claim remains there.
- Nits: none.
- Evidence: scoped `rg` checks, inspection of README/command/skill setup text,
  `git diff --check bdf0894^ bdf0894`, and the focused commit diff all passed.

## REVIEW — deterministic validation (85981bf)

Verdict: blocking findings.

- `scripts/validate.mjs` does not detect common private/local endpoints beyond
  its small literal denylist. In an isolated copy, adding an HTTP URL whose
  host was in the private 10/8 IPv4 range still produced successful validation,
  contradicting the README and handoff claim that private/environment-specific
  reference regressions are checked. Add explicit regression coverage for the
  intended private/local endpoint classes (at least RFC 1918 IPv4 and
  loopback/local-host forms), or narrow the documented contract to the exact
  denylist.
- Nit: a single forbidden `model: openai/gpt-5` mutation emits four overlapping
  findings; correct and actionable, but noisier than necessary.
- Evidence: the committed bundle passed on Windows and all seven agents were
  discovered by OpenCode 1.18.14 from an isolated profile. Temporary-copy
  mutations for a missing command, model field, and permission drift each
  exited 1 with file-specific remedies; a known private-hostname reference
  also exited 1, while the RFC 1918 URL above incorrectly exited 0.

## FIX — private endpoint validation

- Replaced the narrow IPv4 string denylist with context-aware classification
  of URL hosts and `host:port` endpoints across RFC 1918 IPv4, IPv4 loopback,
  compressed IPv6 loopback, and fully expanded IPv6 loopback forms.
- Kept bare IPv4 addresses in ordinary prose out of scope to avoid treating
  version-like or explanatory text as an endpoint leak.
- Added dependency-free positive and negative detector fixtures that run as
  part of every validation, and documented the endpoint sanitation contract.

## REVIEW — profile installer (0963f1f)

Verdict: blocking findings.

- Destination confinement is lexical only. Existing links/junctions in a
  target ancestor such as `profile/commands` are followed, so install writes
  package files outside the selected profile and uninstall later removes those
  external files. Backup-root ancestors have the same exposure. Reject or
  safely resolve linked ancestors before any read, backup, write, or removal.
- Source/target overlap is not rejected. With the checkout itself as `--target`,
  copy mode adopts the bundle sources for later deletion; `--link --replace`
  immediately replaces all three source units with self-referential links.
  Validate that every destination is disjoint from the repository sources.
- Install-state validation accepts duplicate entries and mode/kind mismatch.
  A duplicated valid file entry passes validation; uninstall deletes it once,
  fails on the second removal, and leaves a partially consumed installation
  with its state file intact. Require a unique, mode-consistent entry set.
- `--target --dry-run` consumes `--dry-run` as the target value, performs a
  real install in a directory named `--dry-run`, and exits successfully.
  Reject empty or option-looking `--target` values before resolving paths.
- Nits: POSIX behavior was reviewed statically but not executed on this Windows
  host; add CI coverage for both platforms when practical.
- Evidence: the committed 49-assertion installer suite, validator, and
  `git diff --check` pass. Isolated probes reproduced the junction escape and
  external uninstall, source/target self-link corruption (`ELOOP`), duplicate
  state partial uninstall, and missing-target-value mutation. Copy↔link→copy,
  replacement backups, collision dry-run purity, and unrelated-file isolation
  passed in temporary profiles; no real user profile was touched.

## FIX — profile installer safety review

- Canonicalized the selected profile to a physical directory and reject any
  linked/junction ancestor below that boundary for managed destinations and
  backups before reads or mutations. An explicitly selected profile link still
  works by resolving to its physical target.
- Reject target/source overlap in either direction, including a linked target
  or bundle source, before planning installation.
- Validate the state object's exact schema and entry set, unique canonical
  relative paths, mode/kind consistency, and payload formats before uninstall
  can remove anything.
- Reject option-looking `--target` values so `--target --dry-run` cannot turn
  into a real install.
- Expanded isolated adversarial coverage from 49 to 133 assertions, including
  install/uninstall junction escapes, linked backup roots, corrupt state cases,
  both overlap directions, resolved target/source links, and missing option
  values. No real profile or checkout source is used as a mutation fixture.

## RE-REVIEW — profile installer safety fix (125f272)

Verdict: clean; all four prior blocking findings are resolved.

- Linked/junction ancestors for managed install and uninstall paths, backup
  roots, and linked state files are rejected before any filesystem mutation;
  an explicitly selected profile link is safely resolved to its physical
  directory.
- Lexical and physical source/target overlap is rejected in both containment
  directions, including target aliases and bundle sources linked into the
  target, without changing either source or target.
- State validation requires the exact unique entry set and mode-consistent
  kind/payload schema, rejecting malformed, duplicate, traversal,
  noncanonical, missing, and extra entries before uninstall removes anything.
- Missing or option-looking `--target` values fail during argument parsing and
  cannot create an option-named target.
- Baseline copy, idempotent update, replacement backup, modified-file
  preservation, link install, and copy/link uninstall behaviors remain intact.
- Nit: POSIX behavior remains covered by platform-neutral implementation and
  tests but was not executed here because the available WSL environment has no
  Node.js runtime; retain Linux and Windows CI coverage for release.
- Evidence: the committed 133-assertion installer suite, validator, and
  `git diff --check` passed. A separate 65-check adversarial probe in fresh
  temporary directories independently negated every prior exploit and verified
  failure-before-mutation snapshots; the probe was removed after execution.
