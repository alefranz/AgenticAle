#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile, cp, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";

const repository = resolve(import.meta.dirname, "..");
const build = join(repository, "scripts", "build.mjs");
const scratch = await mkdtemp(join(tmpdir(), "agenticale-build-test-"));
let assertions = 0;

function check(condition, label) {
  assert.ok(condition, label);
  assertions += 1;
}

function portable(path) {
  return path.split(sep).join("/");
}

// Returns sorted absolute file paths under a directory.
async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.filter((entry) => entry.isDirectory()).map((entry) => listFiles(join(directory, entry.name))));
  return [...entries.filter((entry) => entry.isFile()).map((entry) => join(directory, entry.name)), ...nested.flat()].sort();
}

// Sorted portable paths relative to `base`.
async function listRelative(base) {
  return (await listFiles(base)).map((path) => portable(relative(base, path))).sort();
}

function hash(content) {
  return createHash("sha256").update(content).digest("hex");
}

async function readText(path) {
  return readFile(path, "utf8");
}

async function buildFixture(name, args = [], { env, cwd } = {}) {
  const root = join(scratch, name);
  // Run from the repository root by default: the packaged flat model config
  // resolves relative to the build's working directory.
  const result = spawnSync(process.execPath, [build, "--output", root, ...args], {
    encoding: "utf8",
    env: env ? { ...process.env, ...env } : process.env,
    cwd: cwd ?? repository,
  });
  check(result.status === 0, `${name} build exits 0${result.status === 0 ? "" : ` (stderr: ${result.stderr.trim()})`}`);
  if (result.status !== 0) console.error(result.stdout, result.stderr);
  return {
    root,
    pluginRoot: join(root, "plugin", "agenticale"),
    standaloneRoot: join(root, "standalone", ".agents", "skills"),
    openCodeRoot: join(root, "opencode"),
    buildState: join(root, ".agenticale-build.json"),
  };
}

const BASE_ROLES = ["consult", "explore", "fix", "implement", "implement-hard", "review", "review-deep"];
const ALL_ROLES = ["consult", "consult-hard", "explore", "fix", "implement", "implement-easy", "implement-hard", "review", "review-deep"];

// The exact example preset acceptance: one primary coordinator plus nine
// workers, each with its exact provider/model#variant value.
const EXAMPLE_ASSIGNMENTS = {
  coordinator: "openai/gpt-6.1-sol#medium",
  explore: "local-llama/qwen3.8-27b#medium",
  "implement-easy": "local-llama/qwen3.8-27b#medium",
  implement: "alibaba-token-plan/qwen4-max-preview#medium",
  "implement-hard": "alibaba-token-plan/qwen4-max-preview#xhigh",
  fix: "alibaba-token-plan/qwen4-max-preview#medium",
  review: "openai/gpt-6.1-sol#high",
  "review-deep": "openai/gpt-6-astra#high",
  "consult-hard": "openai/gpt-6-astra#high",
  consult: "openai/gpt-6.1-sol#high",
};

try {
  // Default build: three output roots, correct shapes and file counts.
  const fixture = await buildFixture("default");
  const pluginRel = await listRelative(fixture.pluginRoot);
  const standaloneRel = await listRelative(fixture.standaloneRoot);
  const openCodeRel = await listRelative(fixture.openCodeRoot);

  check(pluginRel.length === 23, "plugin bundle has 23 files");
  check(standaloneRel.length === 22, "standalone bundle has 22 files");
  check(openCodeRel.length === 32, "OpenCode bundle has 32 files (7 profiles + 3 commands + 22 skills)");

  // No routing artifact ships in any output root (the flat model config is a
  // build-time input only; nothing routing-shaped is materialized).
  for (const [label, rel] of [["plugin", pluginRel], ["standalone", standaloneRel], ["opencode", openCodeRel]]) {
    check(!rel.some((path) => path.endsWith("routing.json")), `${label} bundle ships no routing.json`);
    check(!rel.some((path) => path.endsWith("preferences.example.md")), `${label} bundle ships no preferences.example.md`);
    check(!rel.some((path) => path.endsWith("scripts/routing.mjs")), `${label} bundle ships no routing.mjs`);
  }

  // Plugin root: manifest + five skills.
  check(pluginRel.includes("plugin.json"), "plugin bundle has plugin.json");
  for (const name of ["work", "review", "autonomous", "pull-request-description", "source-code-lookup"]) {
    check(pluginRel.includes(`skills/${name}/SKILL.md`), `plugin bundle ships ${name}/SKILL.md`);
  }
  check(pluginRel.includes("skills/work/scripts/session-stats.mjs"), "plugin bundle ships skills/work/scripts/session-stats.mjs");
  const manifest = JSON.parse(await readText(join(fixture.pluginRoot, "plugin.json")));
  check(manifest.name === "agenticale", "plugin manifest name is agenticale");
  check(typeof manifest.$schema === "string" && manifest.$schema.length > 0, "plugin manifest declares a schema");
  check(!pluginRel.some((path) => path.includes("/skills/work-mode/") || path.includes("/skills/autonomous-mode/")), "plugin bundle ships no retired skills");

  // Standalone root: the five skill folders only, no agents/ or commands/.
  const standaloneTop = new Set(standaloneRel.map((path) => path.split("/")[0]));
  check(JSON.stringify([...standaloneTop].sort()) === JSON.stringify(["autonomous", "pull-request-description", "review", "source-code-lookup", "work"]), "standalone bundle has exactly the five skill folders");
  check(!standaloneRel.some((path) => ["agents", "commands"].includes(path.split("/")[0])), "standalone bundle has no top-level agents/ or commands/");
  check(standaloneRel.includes("work/scripts/session-stats.mjs"), "standalone bundle ships work/scripts/session-stats.mjs");

  // OpenCode root: the seven base worker profiles, one per base role
  // (including implement-hard); optional workers and the coordinator render
  // only when configured.
  const profileNames = openCodeRel.filter((path) => path.startsWith("agents/agenticale/")).map((path) => path.split("/").pop().replace(".md", ""));
  check(JSON.stringify([...profileNames].sort()) === JSON.stringify([...BASE_ROLES].sort()), "OpenCode bundle has exactly the seven base profiles, one per base role");
  check(!openCodeRel.some((path) => path.endsWith("coordinator.md")), "default OpenCode bundle has no coordinator profile");
  check(!openCodeRel.some((path) => path.endsWith("implement-easy.md") || path.endsWith("consult-hard.md")), "default OpenCode bundle has no optional worker profiles");

  // OpenCode command entries: thin launchers for the explicit-only skills.
  check(openCodeRel.includes("commands/work.md") && openCodeRel.includes("commands/review.md") && openCodeRel.includes("commands/autonomous.md"), "OpenCode bundle has the three command entries");
  check(openCodeRel.includes("skills/work/scripts/session-stats.mjs"), "OpenCode bundle ships skills/work/scripts/session-stats.mjs");
  const workCommand = await readText(join(fixture.openCodeRoot, "commands", "work.md"));
  check(workCommand.includes("`work`") && workCommand.includes("$ARGUMENTS"), "work command loads the work skill by exact ID and passes $ARGUMENTS");
  const reviewCommand = await readText(join(fixture.openCodeRoot, "commands", "review.md"));
  check(reviewCommand.includes("`review`") && reviewCommand.includes("$ARGUMENTS"), "review command loads the review skill by exact ID and passes $ARGUMENTS");
  const autonomousCommand = await readText(join(fixture.openCodeRoot, "commands", "autonomous.md"));
  check(autonomousCommand.includes("`autonomous`") && autonomousCommand.includes("$ARGUMENTS"), "autonomous command loads the autonomous skill by exact ID and passes $ARGUMENTS");
  for (const [name, text] of [["work", workCommand], ["review", reviewCommand], ["autonomous", autonomousCommand]]) {
    check(!/^agent:/m.test(text) && !/^subagent:/m.test(text), `default ${name} command has no agent/subagent binding without a configured coordinator`);
  }

  // Default models render per role from the packaged flat model config as
  // one provider/model#variant model line (no separate reasoningEffort).
  const defaultModels = JSON.parse(await readText(join(repository, "adapters", "opencode", "models.json")));
  for (const role of BASE_ROLES) {
    const text = await readText(join(fixture.openCodeRoot, "agents", "agenticale", `${role}.md`));
    check(text.includes(`model: ${defaultModels[role]}`), `${role} profile renders the flat config model line ${defaultModels[role]}`);
    check(!/^reasoningEffort:/m.test(text), `${role} profile has no separate reasoningEffort line`);
  }

  // Each profile keeps its adapter metadata (subagent mode + exact deny set).
  const readOnly = ["explore", "consult"];
  for (const name of BASE_ROLES) {
    const text = await readText(join(fixture.openCodeRoot, "agents", "agenticale", `${name}.md`));
    check(text.includes("mode: subagent"), `${name} profile is a subagent`);
    if (readOnly.includes(name)) {
      check(text.includes("- action: edit"), `${name} (read-only) profile denies edit`);
    } else {
      check(!/- action: edit/.test(text), `${name} (standard) profile does not deny edit`);
    }
    check(text.includes("- action: subagent"), `${name} profile denies subagent`);
    check(text.includes("- action: question"), `${name} profile denies question`);
  }

  // Body is copied verbatim from the capability-neutral task contract.
  const reviewContract = (await readText(join(repository, "skills", "work", "references", "tasks", "review.md"))).replace(/\r\n?/g, "\n");
  const stripFrontmatter = (text) => text.replace(/^---\n[\s\S]*?\n---\n/, "");
  const reviewProfile = await readText(join(fixture.openCodeRoot, "agents", "agenticale", "review.md"));
  check(stripFrontmatter(reviewProfile).trim() === reviewContract.trim(), "review profile body is verbatim the review task contract");

  // Build state records the bundle shape and the flat model config source.
  const state = JSON.parse(await readText(fixture.buildState));
  check(state.schemaVersion === 2, "build state schemaVersion is 2");
  check(state.modelsSource === "adapters/opencode/models.json", "build state modelsSource is the packaged flat model config");
  check(state.noModel === false, "build state noModel is false for the default build");
  check(JSON.stringify(state.profiles.map((p) => p.name).sort()) === JSON.stringify([...BASE_ROLES].sort()), "build state records the seven base profiles");
  check(state.profiles.every((p) => p.mode === "explicit" && typeof p.model === "string" && p.model.includes("#") && p.reasoningEffort === undefined), "build state profiles all carry one explicit provider/model#variant value for the packaged defaults");
  check(state.coordinator === null, "default build state records no coordinator");

  // --no-model renders profiles without model/effort lines and records the
  // model-neutral source in the build state.
  const noModel = await buildFixture("no-model", ["--no-model"]);
  for (const name of BASE_ROLES) {
    const text = await readText(join(noModel.openCodeRoot, "agents", "agenticale", `${name}.md`));
    check(!/^model:/m.test(text) && !/^reasoningEffort:/m.test(text), `${name} profile has no model/effort lines under --no-model`);
  }
  const noModelState = JSON.parse(await readText(noModel.buildState));
  check(noModelState.modelsSource === "none (--no-model)", "--no-model build state modelsSource is 'none (--no-model)'");
  check(noModelState.noModel === true, "--no-model build state noModel is true");
  check(noModelState.profiles.every((p) => p.mode === "inherit" && p.model === undefined), "--no-model build state profiles all inherit");
  check(noModelState.coordinator === null, "--no-model build state records no coordinator");
  const noModelRel = await listRelative(noModel.openCodeRoot);
  check(!noModelRel.some((path) => path.endsWith("coordinator.md")), "--no-model bundle generates no coordinator profile");
  for (const name of ["work", "review", "autonomous"]) {
    const text = await readText(join(noModel.openCodeRoot, "commands", `${name}.md`));
    check(!/^agent:/m.test(text) && !/^subagent:/m.test(text), `--no-model ${name} command stays a caller-session launcher`);
  }
  const pluginHashes = async (root) => {
    const list = await listFiles(root);
    return Promise.all(list.map(async (path) => [portable(relative(root, path)), hash(await readFile(path))]));
  };
  check(JSON.stringify(await listRelative(fixture.standaloneRoot)) === JSON.stringify(await listRelative(noModel.standaloneRoot)), "standalone bundle file set is identical with and without --no-model");

  // --source-root renders the exact JSON-encoded path into the lookup skill.
  const customRoot = join(scratch, "custom-source");
  const sourceRootFixture = await buildFixture("source-root", ["--source-root", customRoot]);
  const lookup = await readText(join(sourceRootFixture.openCodeRoot, "skills", "source-code-lookup", "SKILL.md"));
  check(lookup.includes(`Source root: ${JSON.stringify(customRoot)}`), "source-code-lookup skill renders the exact --source-root path");

  // --models with a preset name renders the preset's flat values and records
  // the caller value in the build state.
  const localFixture = await buildFixture("local-preset", ["--models", "local"]);
  const localState = JSON.parse(await readText(localFixture.buildState));
  check(localState.modelsSource === "--models local", "local preset build state modelsSource records the --models preset");
  const localReview = await readText(join(localFixture.openCodeRoot, "agents", "agenticale", "review.md"));
  check(localReview.includes("model: local-llama/qwen3.8-27b#xhigh"), "local preset renders one provider-qualified model#variant line for review");

  // --models with a caller file that lists only some roles: listed roles
  // render explicit frontmatter, unlisted roles inherit the session model.
  const callerModels = join(scratch, "caller-models.json");
  await writeFile(callerModels, JSON.stringify({ review: "acme/rev#high" }), "utf8");
  const callerFixture = await buildFixture("caller-models", ["--models", callerModels]);
  const callerState = JSON.parse(await readText(callerFixture.buildState));
  check(callerState.modelsSource === `--models ${callerModels}`, "caller-file build state modelsSource records the --models path");
  const callerReview = await readText(join(callerFixture.openCodeRoot, "agents", "agenticale", "review.md"));
  check(callerReview.includes("model: acme/rev#high"), "caller file: the listed review role renders one explicit model line");
  const callerConsult = await readText(join(callerFixture.openCodeRoot, "agents", "agenticale", "consult.md"));
  check(!/^model:/m.test(callerConsult) && !/^reasoningEffort:/m.test(callerConsult), "caller file: an unlisted role inherits (no model line)");
  const callerRel = await listRelative(callerFixture.openCodeRoot);
  check(!callerRel.some((path) => path.endsWith("coordinator.md") || path.endsWith("implement-easy.md") || path.endsWith("consult-hard.md")), "caller file: unlisted optional roles and the coordinator do not render");

  // The exact example preset: 1 primary coordinator + 9 workers (35 files),
  // exact model values, and commands bound to the coordinator in the current
  // session with the skill load and $ARGUMENTS retained.
  {
    const exampleFixture = await buildFixture("example-preset", ["--models", "example"]);
    const exampleRel = await listRelative(exampleFixture.openCodeRoot);
    check(exampleRel.length === 35, "example preset OpenCode bundle has 35 files (10 profiles + 3 commands + 22 skills)");
    const exampleProfiles = exampleRel.filter((path) => path.startsWith("agents/agenticale/")).map((path) => path.split("/").pop().replace(".md", ""));
    check(JSON.stringify(exampleProfiles.sort()) === JSON.stringify([...ALL_ROLES, "coordinator"].sort()), "example preset renders exactly 1 primary + 9 worker profiles");
    for (const role of ALL_ROLES) {
      const text = await readText(join(exampleFixture.openCodeRoot, "agents", "agenticale", `${role}.md`));
      check(text.includes(`model: ${EXAMPLE_ASSIGNMENTS[role]}`), `example preset: ${role} renders the exact model line ${EXAMPLE_ASSIGNMENTS[role]}`);
      check(!/^reasoningEffort:/m.test(text), `example preset: ${role} has no separate reasoningEffort line`);
    }
    const exampleCoordinator = await readText(join(exampleFixture.openCodeRoot, "agents", "agenticale", "coordinator.md"));
    check(exampleCoordinator.includes("mode: primary") && exampleCoordinator.includes(`model: ${EXAMPLE_ASSIGNMENTS.coordinator}`), "example preset: the coordinator is a primary agent with its exact model");
    check(!/- action: subagent/.test(exampleCoordinator), "example preset: the coordinator can dispatch children (no subagent denial)");
    for (const name of ["work", "review", "autonomous"]) {
      const text = await readText(join(exampleFixture.openCodeRoot, "commands", `${name}.md`));
      check(/^agent: agenticale\/coordinator$/m.test(text) && /^subagent: false$/m.test(text), `example preset: ${name} command binds agenticale/coordinator with subagent: false`);
      check(text.includes(`\`${name}\``) && text.includes("$ARGUMENTS"), `example preset: ${name} command keeps the exact skill load and $ARGUMENTS`);
    }
    const exampleState = JSON.parse(await readText(exampleFixture.buildState));
    check(exampleState.coordinator !== null && exampleState.coordinator.model === EXAMPLE_ASSIGNMENTS.coordinator, "example preset build state records the coordinator assignment");
    check(exampleState.profiles.length === 9 && exampleState.profiles.every((p) => p.mode === "explicit"), "example preset build state records nine explicit worker profiles");
    // The plugin and standalone outputs are model-agnostic: identical file
    // sets with and without the coordinator config.
    check(JSON.stringify(await listRelative(exampleFixture.pluginRoot)) === JSON.stringify(pluginRel), "example preset plugin bundle file set matches the default build");
    check(JSON.stringify(await listRelative(exampleFixture.standaloneRoot)) === JSON.stringify(standaloneRel), "example preset standalone bundle file set matches the default build");
  }

  // Error handling: retired/unknown arguments, conflicts, and bad flat configs.
  const retiredRouting = spawnSync(process.execPath, [build, "--output", join(scratch, "err"), "--routing", join(scratch, "r.json")], { encoding: "utf8" });
  check(retiredRouting.status === 1 && /Unknown argument '--routing'/.test(retiredRouting.stderr), "retired --routing is an unknown argument");
  const retiredEffort = spawnSync(process.execPath, [build, "--output", join(scratch, "err"), "--effort", "low"], { encoding: "utf8" });
  check(retiredEffort.status === 1 && /Unknown argument '--effort'/.test(retiredEffort.stderr), "retired --effort is an unknown argument");
  const conflict = spawnSync(process.execPath, [build, "--output", join(scratch, "err"), "--models", "openai", "--no-model"], { encoding: "utf8" });
  check(conflict.status === 1 && /cannot be used together/.test(conflict.stderr), "--models and --no-model are rejected");

  const badModels = join(scratch, "bad-models.json");
  await writeFile(badModels, JSON.stringify({ review: 42 }), "utf8");
  const badModel = spawnSync(process.execPath, [build, "--output", join(scratch, "err"), "--models", badModels], { encoding: "utf8" });
  check(badModel.status === 1 && /Model for role 'review' must be a non-empty string/.test(badModel.stderr), "non-string model value is rejected");
  const unknownRole = join(scratch, "unknown-role.json");
  await writeFile(unknownRole, JSON.stringify({ bogus: "acme/model" }), "utf8");
  const unknownRoleRun = spawnSync(process.execPath, [build, "--output", join(scratch, "err"), "--models", unknownRole], { encoding: "utf8" });
  check(unknownRoleRun.status === 1 && /Unknown role in model config/.test(unknownRoleRun.stderr) && /'bogus'/.test(unknownRoleRun.stderr), "unknown role in the flat model config is rejected and named");
  const badEffort = join(scratch, "bad-effort.json");
  await writeFile(badEffort, JSON.stringify({ review: "acme/model#extreme" }), "utf8");
  const badEffortRun = spawnSync(process.execPath, [build, "--output", join(scratch, "err"), "--models", badEffort], { encoding: "utf8" });
  check(badEffortRun.status === 1 && /has an invalid reasoning effort 'extreme'/.test(badEffortRun.stderr) && /'acme\/model#extreme'/.test(badEffortRun.stderr), "invalid effort suffix is rejected and names role and value");
  const noSlash = join(scratch, "no-slash.json");
  await writeFile(noSlash, JSON.stringify({ fix: "gpt-6" }), "utf8");
  const noSlashRun = spawnSync(process.execPath, [build, "--output", join(scratch, "err"), "--models", noSlash], { encoding: "utf8" });
  check(noSlashRun.status === 1 && /Model for role 'fix' must be "provider\/model\[#effort\]"/.test(noSlashRun.stderr), "a model value without a provider slash is rejected");

  // Publication isolation: a default build must neither read nor embed the
  // caller's home/project model preferences, even when both are seeded in an
  // isolated fake home and a sibling project root. Model selection is a
  // build-time input only (--models), so no user preference file is ever
  // discoverable by the build.
  {
    const sentinelHome = join(scratch, "sentinel-home");
    const sentinelProject = join(scratch, "sentinel-project");
    await mkdir(join(sentinelHome, ".agenticale"), { recursive: true });
    await mkdir(join(sentinelProject, ".agenticale"), { recursive: true });
    const homePrefs = "- explore: SENTINEL-HOME-PREFERENCE-ZXQ9, high\n";
    const projectPrefs = "- review: SENTINEL-PROJECT-PREFERENCE-KT7W, high\n";
    await writeFile(join(sentinelHome, ".agenticale", "preferences.md"), homePrefs, "utf8");
    await writeFile(join(sentinelProject, ".agenticale", "preferences.md"), projectPrefs, "utf8");
    const iso = await buildFixture("isolation", [], { env: { HOME: sentinelHome, USERPROFILE: sentinelHome } });
    const builtContents = await Promise.all([
      ...(await listFiles(iso.pluginRoot)),
      ...(await listFiles(iso.standaloneRoot)),
      ...(await listFiles(iso.openCodeRoot)),
      iso.buildState,
    ].map((path) => readFile(path, "utf8")));
    check(!builtContents.some((text) => text.includes("SENTINEL-HOME-PREFERENCE-ZXQ9")), "default build does not embed the home preferences sentinel");
    check(!builtContents.some((text) => text.includes("SENTINEL-PROJECT-PREFERENCE-KT7W")), "default build does not embed the project preferences sentinel");
    check((await readText(join(sentinelProject, ".agenticale", "preferences.md"))) === projectPrefs, "default build leaves the project preferences.md untouched");
    check((await readText(join(sentinelHome, ".agenticale", "preferences.md"))) === homePrefs, "default build leaves the home preferences.md untouched");
  }

  // Source/output confinement: --output must never target the repo root or a
  // source directory (a build would otherwise clobber authored source).
  const rootBuild = spawnSync(process.execPath, [build, "--output", repository], { encoding: "utf8" });
  check(rootBuild.status === 1 && /must not be the repository root/.test(rootBuild.stderr), "--output at the repository root is rejected");
  const insideSource = spawnSync(process.execPath, [build, "--output", join(repository, "skills", "evil")], { encoding: "utf8" });
  check(insideSource.status === 1 && /must not be inside the source directory skills/.test(insideSource.stderr), "--output inside a source directory is rejected");

  // F1: physical confinement. A symlinked/junctioned parent on the managed-root
  // path must be refused before any mutation, and external content must survive.
  const external = join(scratch, "external-f1");
  await mkdir(external, { recursive: true });
  const sentinel = join(external, "sentinel.txt");
  await writeFile(sentinel, "keep", "utf8");
  for (const [caseName, linkName] of [["linked parent (plugin)", "plugin"], ["linked root (opencode)", "opencode"]]) {
    const out = join(scratch, `f1-${linkName}`);
    await mkdir(out, { recursive: true });
    await symlink(external, join(out, linkName), "junction");
    const linked = spawnSync(process.execPath, [build, "--output", out], { encoding: "utf8" });
    check(linked.status === 1 && /symlinked path|outside the output root/.test(linked.stderr), `F1 ${caseName} is refused`);
    check((await readFile(join(external, "sentinel.txt"), "utf8")).length > 0, `F1 ${caseName} leaves external content intact`);
    await rm(out, { recursive: true, force: true });
  }

  // F12: a MISSING --output beneath a junction that points into a source
  // directory must be refused (it would otherwise build into the source tree).
  // The build's confinement check runs against its OWN repositoryRoot, so use a
  // disposable copy of the source dirs and run the copied build.mjs; the check
  // must resolve the missing output through its nearest existing ancestor
  // physically, so the junction into skills/ is seen rather than hidden.
  {
    const copyRoot = join(scratch, "f12-repo");
    for (const dir of ["scripts", "skills", "adapters", "examples"]) {
      await cp(join(repository, dir), join(copyRoot, dir), { recursive: true });
    }
    await mkdir(join(copyRoot, "skills", "work"), { recursive: true });
    await writeFile(join(copyRoot, "skills", "work", "sentinel.txt"), "keep", "utf8");
    const alias = join(copyRoot, "source-alias");
    await symlink(join(copyRoot, "skills"), alias, "junction");
    const before = (await listFiles(join(copyRoot, "skills"))).length;
    const copiedBuild = join(copyRoot, "scripts", "build.mjs");
    const requestedOutput = join(alias, "missing-output");
    const missingOutput = spawnSync(process.execPath, [copiedBuild, "--output", requestedOutput], {
      encoding: "utf8",
    });
    const pathDiagnostics = JSON.stringify({
      copyRoot,
      realCopyRoot: await realpath(copyRoot),
      skills: join(copyRoot, "skills"),
      realSkills: await realpath(join(copyRoot, "skills")),
      alias,
      realAlias: await realpath(alias),
      requestedOutput,
      stdout: missingOutput.stdout.trim(),
    });
    check(
      missingOutput.status === 1 && /must not be inside the source directory skills/.test(missingOutput.stderr),
      `F12 missing output under a source-linked ancestor is refused (exit ${missingOutput.status}; stderr: ${missingOutput.stderr.trim()}; paths: ${pathDiagnostics})`,
    );
    check((await listFiles(join(copyRoot, "skills"))).length === before, "F12 refused build creates no new files in the source tree");
  }

  // F3: the real schema-1 baseline state must be recognized and migrated.
  const legacyOut = join(scratch, "f3-migrate");
  await mkdir(legacyOut, { recursive: true });
  await writeFile(join(legacyOut, ".agenticale-build.json"), JSON.stringify({ schema: 1, package: "agenticale", outputs: ["opencode", "copilot/agenticale"] }), "utf8");
  const legacyMigrate = spawnSync(process.execPath, [build, "--output", legacyOut], { encoding: "utf8" });
  check(legacyMigrate.status === 0, "F3 schema-1 baseline state is accepted and migrated");
  if (legacyMigrate.status !== 0) console.error(legacyMigrate.stdout, legacyMigrate.stderr);
  const migratedState = JSON.parse(await readText(join(legacyOut, ".agenticale-build.json")));
  check(migratedState.schemaVersion === 2 && migratedState.package.name === "agenticale", "F3 migrated state is schema 2");

  // F3: a legacy-state output that already holds content in a not-yet-owned new
  // root must be refused (the build would otherwise delete unowned content).
  const legacyGuard = join(scratch, "f3-guard");
  await mkdir(legacyGuard, { recursive: true });
  await writeFile(join(legacyGuard, ".agenticale-build.json"), JSON.stringify({ schema: 1, package: "agenticale", outputs: ["opencode", "copilot/agenticale"] }), "utf8");
  const newRootFile = join(legacyGuard, "plugin", "agenticale", "keep.txt");
  await mkdir(join(legacyGuard, "plugin", "agenticale"), { recursive: true });
  await writeFile(newRootFile, "keep", "utf8");
  const legacyGuardRun = spawnSync(process.execPath, [build, "--output", legacyGuard], { encoding: "utf8" });
  check(legacyGuardRun.status === 1 && /unmanaged bundle paths/.test(legacyGuardRun.stderr), "F3 legacy state with pre-existing new-root content is refused");
  check((await readFile(newRootFile, "utf8")) === "keep", "F3 refused guard leaves the new-root content intact");
} finally {
  await rm(scratch, { recursive: true, force: true });
}

console.log(`Build tests passed: ${assertions} assertions.`);
