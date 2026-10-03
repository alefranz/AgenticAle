#!/usr/bin/env node

import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile, cp } from "node:fs/promises";
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
  if (!existsSync(directory)) return [];
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

async function buildFixture(name, args = []) {
  const root = join(scratch, name);
  const result = spawnSync(process.execPath, [build, "--output", root, ...args], { encoding: "utf8" });
  check(result.status === 0, `${name} build exits 0`);
  if (result.status !== 0) console.error(result.stdout, result.stderr);
  return {
    root,
    pluginRoot: join(root, "plugin", "agenticale"),
    standaloneRoot: join(root, "standalone", ".agents", "skills"),
    openCodeRoot: join(root, "opencode"),
    buildState: join(root, ".agenticale-build.json"),
  };
}

try {
  // Default build: three output roots, correct shapes and file counts.
  const fixture = await buildFixture("default");
  const pluginRel = await listRelative(fixture.pluginRoot);
  const standaloneRel = await listRelative(fixture.standaloneRoot);
  const openCodeRel = await listRelative(fixture.openCodeRoot);

  check(pluginRel.length === 20, "plugin bundle has 20 files");
  check(standaloneRel.length === 19, "standalone bundle has 19 files");
  check(openCodeRel.length === 26, "OpenCode bundle has 26 files (7 profiles + 19 skills)");

  // Plugin root: manifest + four skills.
  check(pluginRel.includes("plugin.json"), "plugin bundle has plugin.json");
  for (const name of ["work", "autonomous", "pull-request-description", "source-code-lookup"]) {
    check(pluginRel.includes(`skills/${name}/SKILL.md`), `plugin bundle ships ${name}/SKILL.md`);
  }
  const manifest = JSON.parse(await readText(join(fixture.pluginRoot, "plugin.json")));
  check(manifest.name === "agenticale", "plugin manifest name is agenticale");
  check(typeof manifest.$schema === "string" && manifest.$schema.length > 0, "plugin manifest declares a schema");
  check(!pluginRel.some((path) => path.includes("/skills/work-mode/") || path.includes("/skills/autonomous-mode/")), "plugin bundle ships no retired skills");

  // Standalone root: the four skill folders only, no agents/ or commands/.
  const standaloneTop = new Set(standaloneRel.map((path) => path.split("/")[0]));
  check(JSON.stringify([...standaloneTop].sort()) === JSON.stringify(["autonomous", "pull-request-description", "source-code-lookup", "work"]), "standalone bundle has exactly the four skill folders");
  check(!standaloneRel.some((path) => ["agents", "commands"].includes(path.split("/")[0])), "standalone bundle has no top-level agents/ or commands/");

  // OpenCode root: seven profiles, one per routing key (including implement-hard).
  const allProfiles = ["consult", "deep-review", "explore", "fix", "implement", "implement-hard", "review"];
  const profileNames = openCodeRel.filter((path) => path.startsWith("agents/autonomous/")).map((path) => path.split("/").pop().replace(".md", ""));
  check(JSON.stringify([...profileNames].sort()) === JSON.stringify([...allProfiles].sort()), "OpenCode bundle has exactly seven profiles, one per routing key");
  check(!openCodeRel.some((path) => path.endsWith("coordinator.md")), "OpenCode bundle has no coordinator profile");

  // Default models are rendered per route (opencode provider prefix).
  const explore = await readText(join(fixture.openCodeRoot, "agents", "autonomous", "explore.md"));
  check(explore.includes("model: opencode/gpt-6-luna"), "explore profile renders the opencode luna model");
  check(explore.includes("reasoningEffort: max"), "explore profile renders max effort");
  const implement = await readText(join(fixture.openCodeRoot, "agents", "autonomous", "implement.md"));
  check(implement.includes("model: opencode/gpt-6-luna"), "implement profile renders the opencode luna model");
  check(implement.includes("reasoningEffort: max"), "implement profile renders max effort");
  const fix = await readText(join(fixture.openCodeRoot, "agents", "autonomous", "fix.md"));
  check(fix.includes("model: opencode/gpt-6-luna"), "fix profile renders the opencode luna model");
  check(fix.includes("reasoningEffort: max"), "fix profile renders max effort");
  const review = await readText(join(fixture.openCodeRoot, "agents", "autonomous", "review.md"));
  check(review.includes("model: opencode/gpt-6-sol"), "review profile renders the opencode sol model");
  check(review.includes("reasoningEffort: high"), "review profile renders high effort");
  const deepReview = await readText(join(fixture.openCodeRoot, "agents", "autonomous", "deep-review.md"));
  check(deepReview.includes("model: opencode/gpt-6-sol"), "deep-review profile renders the opencode sol model");
  check(deepReview.includes("reasoningEffort: xhigh"), "deep-review profile renders xhigh effort");
  const consult = await readText(join(fixture.openCodeRoot, "agents", "autonomous", "consult.md"));
  check(consult.includes("model: opencode/gpt-6-sol"), "consult profile renders the opencode sol model");
  check(consult.includes("reasoningEffort: xhigh"), "consult profile renders xhigh effort");
  const implementHard = await readText(join(fixture.openCodeRoot, "agents", "autonomous", "implement-hard.md"));
  check(implementHard.includes("model: opencode/gpt-6-sol"), "implement-hard profile renders the opencode sol model");
  check(implementHard.includes("reasoningEffort: high"), "implement-hard profile renders high effort");

  // Each profile keeps its adapter metadata (subagent mode + exact deny set).
  const readOnly = ["explore", "consult"];
  for (const name of ["consult", "deep-review", "explore", "fix", "implement", "implement-hard", "review"]) {
    const text = await readText(join(fixture.openCodeRoot, "agents", "autonomous", `${name}.md`));
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
  check(stripFrontmatter(review).trim() === reviewContract.trim(), "review profile body is verbatim the review task contract");

  // Build state records the bundle shape.
  const state = JSON.parse(await readText(fixture.buildState));
  check(state.schemaVersion === 2, "build state schemaVersion is 2");

  // --no-model renders profiles without model/effort lines AND materializes an
  // inherit-only routing.json into every skill tree (all three output roots).
  const noModel = await buildFixture("no-model", ["--no-model"]);
  for (const name of allProfiles) {
    const text = await readText(join(noModel.openCodeRoot, "agents", "autonomous", `${name}.md`));
    check(!/^model:/m.test(text) && !/^reasoningEffort:/m.test(text), `${name} profile has no model/effort lines under --no-model`);
  }
  const pluginHashes = async (root) => {
    const list = await listFiles(root);
    return Promise.all(list.map(async (path) => [portable(relative(root, path)), hash(await readFile(path))]));
  };
  const assertRoutingModes = async (label, routingPath, expectedMode) => {
    check(existsSync(routingPath), `${label} materializes work/references/routing.json`);
    const parsed = JSON.parse(await readText(routingPath));
    for (const runtime of Object.keys(parsed.runtimes)) {
      for (const route of Object.keys(parsed.runtimes[runtime])) {
        check(parsed.runtimes[runtime][route].mode === expectedMode, `${label} routing ${runtime}/${route} is ${expectedMode}`);
      }
    }
  };
  // The default build materializes the packaged (explicit) routing into every tree.
  await assertRoutingModes("default plugin", join(fixture.pluginRoot, "skills", "work", "references", "routing.json"), "explicit");
  await assertRoutingModes("default standalone", join(fixture.standaloneRoot, "work", "references", "routing.json"), "explicit");
  // --no-model materializes an inherit-only routing into every tree.
  await assertRoutingModes("no-model plugin", join(noModel.pluginRoot, "skills", "work", "references", "routing.json"), "inherit");
  await assertRoutingModes("no-model standalone", join(noModel.standaloneRoot, "work", "references", "routing.json"), "inherit");
  check(JSON.stringify(await listRelative(fixture.standaloneRoot)) === JSON.stringify(await listRelative(noModel.standaloneRoot)), "standalone bundle file set is identical with and without --no-model");

  // --source-root renders the exact JSON-encoded path into the lookup skill.
  const customRoot = join(scratch, "custom-source");
  const sourceRootFixture = await buildFixture("source-root", ["--source-root", customRoot]);
  const lookup = await readText(join(sourceRootFixture.openCodeRoot, "skills", "source-code-lookup", "SKILL.md"));
  check(lookup.includes(`Source root: ${JSON.stringify(customRoot)}`), "source-code-lookup skill renders the exact --source-root path");

  // --models with a provider-qualified preset renders provider prefixes.
  const openaiFixture = await buildFixture("openai-preset", ["--models", "openai"]);
  const openaiReview = await readText(join(openaiFixture.openCodeRoot, "agents", "autonomous", "review.md"));
  check(/model: openai\//.test(openaiReview), "openai preset renders a provider-qualified model for review");

  // --effort is a route-wide reasoning-effort override: every explicit profile
  // renders the override instead of its per-route default, but keeps its model.
  const effortFixture = await buildFixture("effort-override", ["--effort", "low"]);
  for (const name of allProfiles) {
    const text = await readText(join(effortFixture.openCodeRoot, "agents", "autonomous", `${name}.md`));
    check(text.includes("reasoningEffort: low"), `--effort low overrides the ${name} profile effort`);
  }
  check((await readText(join(effortFixture.openCodeRoot, "agents", "autonomous", "review.md"))).includes("model: opencode/gpt-6-sol"), "--effort override keeps the per-route model");

  // --routing PATH is a first-class input: a caller-supplied file wins over the
  // packaged routing.json and its explicit model is rendered into the profiles.
  const callerRouting = join(scratch, "caller-routing.json");
  const packaged = JSON.parse(await readText(join(repository, "skills", "work", "references", "routing.json")));
  const customized = structuredClone(packaged);
  customized.runtimes.opencode.review.model = "acme/test-model";
  await writeFile(callerRouting, JSON.stringify(customized), "utf8");
  const routingFixture = await buildFixture("caller-routing", ["--routing", callerRouting]);
  check((await readText(join(routingFixture.openCodeRoot, "agents", "autonomous", "review.md"))).includes("model: acme/test-model"), "--routing file model is rendered into the review profile");
  check((await readText(join(routingFixture.openCodeRoot, "agents", "autonomous", "explore.md"))).includes("model: opencode/gpt-6-luna"), "--routing file leaves unmodified routes at their packaged model");
  // The caller's customization is materialized verbatim into the skill trees.
  const materializedCaller = JSON.parse(await readText(join(routingFixture.standaloneRoot, "work", "references", "routing.json")));
  check(materializedCaller.runtimes.opencode.review.model === "acme/test-model", "--routing customization is materialized into the standalone routing.json");
  const materializedCallerPlugin = JSON.parse(await readText(join(routingFixture.pluginRoot, "skills", "work", "references", "routing.json")));
  check(materializedCallerPlugin.runtimes.opencode.review.model === "acme/test-model", "--routing customization is materialized into the plugin routing.json");

  // F5: --effort cannot be applied to a route that inherits (inherit means
  // inherit both model AND effort), including the all-inherit --no-model case.
  const inheritRouting = structuredClone(packaged);
  for (const runtime of Object.keys(inheritRouting.runtimes)) inheritRouting.runtimes[runtime].review = { mode: "inherit" };
  const inheritRoutingPath = join(scratch, "f5-inherit.json");
  await writeFile(inheritRoutingPath, JSON.stringify(inheritRouting), "utf8");
  const f5Effort = spawnSync(process.execPath, [build, "--output", join(scratch, "f5-effort"), "--routing", inheritRoutingPath, "--effort", "low"], { encoding: "utf8" });
  check(f5Effort.status === 1 && /cannot be applied to routes that inherit/.test(f5Effort.stderr), "F5 --effort on an inherit route is rejected");
  const f5NoModel = spawnSync(process.execPath, [build, "--output", join(scratch, "f5-nomodel"), "--no-model", "--effort", "low"], { encoding: "utf8" });
  check(f5NoModel.status === 1 && /cannot be combined with --no-model/.test(f5NoModel.stderr), "F5 --effort with --no-model is rejected");

  // F6: a caller policy that omits a runtime must not silently render
  // model-less profiles; the undeclared runtime is filled from the packaged
  // preset before validation and rendering.
  const codexOnly = { schemaVersion: 1, runtimes: { codex: structuredClone(packaged.runtimes.codex) } };
  const codexOnlyPath = join(scratch, "f6-codex-only.json");
  await writeFile(codexOnlyPath, JSON.stringify(codexOnly), "utf8");
  const f6Fixture = await buildFixture("f6-codex-only", ["--routing", codexOnlyPath]);
  const f6Explore = await readText(join(f6Fixture.openCodeRoot, "agents", "autonomous", "explore.md"));
  check(f6Explore.includes("model: opencode/gpt-6-luna"), "F6 omitted opencode runtime is filled from the packaged preset (explore profile carries a model)");
  const f6Shipped = JSON.parse(await readText(join(f6Fixture.standaloneRoot, "work", "references", "routing.json")));
  check(JSON.stringify(Object.keys(f6Shipped.runtimes).sort()) === JSON.stringify(["codex", "copilot", "opencode"].sort()), "F6 shipped policy declares all three runtimes");
  check(f6Shipped.runtimes.opencode.explore.model === "opencode/gpt-6-luna", "F6 merged opencode route keeps the packaged model");
  check(f6Shipped.runtimes.codex.explore.model === packaged.runtimes.codex.explore.model, "F6 declared codex runtime is untouched by the merge");

  // strictValidateRouting negative cases (the shared contract the build enforces).
  const { strictValidateRouting } = await import("./build.mjs");
  const makeBad = (mutate) => { const r = structuredClone(packaged); mutate(r); return r; };
  const expectRoutingRejection = (label, mutate) => {
    let threw = false;
    try { strictValidateRouting(makeBad(mutate)); } catch { threw = true; }
    check(threw, `strict routing rejects ${label}`);
  };
  expectRoutingRejection("unknown top-level key", (r) => { r.bogus = true; });
  expectRoutingRejection("unsupported runtime", (r) => { r.runtimes.bogus = r.runtimes.copilot; });
  expectRoutingRejection("unknown route key", (r) => { r.runtimes.copilot.bogus = r.runtimes.copilot.review; });
  expectRoutingRejection("missing required route", (r) => { delete r.runtimes.copilot.consult; });
  expectRoutingRejection("inherit entry with extra fields", (r) => { r.runtimes.copilot.consult = { mode: "inherit", model: "x" }; });
  expectRoutingRejection("explicit entry missing effort", (r) => { delete r.runtimes.copilot.review.reasoningEffort; });
  expectRoutingRejection("unsupported reasoning effort", (r) => { r.runtimes.copilot.review.reasoningEffort = "extreme"; });
  expectRoutingRejection("fallback not a model/effort pair", (r) => { r.runtimes.copilot.review.fallbacks = [{ model: "x", reasoningEffort: "low", extra: 1 }]; });

  // Generated-artifact drift: the committed default package must equal a fresh
  // default build (catches a source change that skipped regeneration).
  const committedPlugin = join(repository, "plugins", "agenticale");
  const fixtureDigests = Object.fromEntries(await pluginHashes(fixture.pluginRoot));
  const committedDigests = {};
  for (const path of await listFiles(committedPlugin)) committedDigests[portable(relative(committedPlugin, path))] = hash(await readFile(path));
  check(JSON.stringify(fixtureDigests) === JSON.stringify(committedDigests), "committed plugins/agenticale matches a fresh default build (no drift)");

  // Source/output confinement: --output must never target the repo root or a
  // source directory (a build would otherwise clobber authored source).
  const rootBuild = spawnSync(process.execPath, [build, "--output", repository], { encoding: "utf8" });
  check(rootBuild.status === 1 && /must not be the repository root/.test(rootBuild.stderr), "--output at the repository root is rejected");
  const insideSource = spawnSync(process.execPath, [build, "--output", join(repository, "skills", "evil")], { encoding: "utf8" });
  check(insideSource.status === 1 && /must not be inside the source directory skills/.test(insideSource.stderr), "--output inside a source directory is rejected");

  // Error handling: conflicting/unknown arguments and bad model mappings.
  const conflict = spawnSync(process.execPath, [build, "--output", join(scratch, "err"), "--models", "openai", "--no-model"], { encoding: "utf8" });
  check(conflict.status === 1 && /cannot be used together/.test(conflict.stderr), "--models and --no-model are rejected");
  const effort = spawnSync(process.execPath, [build, "--output", join(scratch, "err"), "--no-model", "--effort", "extreme"], { encoding: "utf8" });
  check(effort.status === 1 && /Invalid --effort/.test(effort.stderr), "unknown --effort is rejected");

  const badModels = join(scratch, "bad-models.json");
  await writeFile(badModels, JSON.stringify({ review: 42 }), "utf8");
  const badModel = spawnSync(process.execPath, [build, "--output", join(scratch, "err"), "--models", badModels], { encoding: "utf8" });
  check(badModel.status === 1 && /Invalid model for review/.test(badModel.stderr), "non-string model value is rejected");
  const unknownRole = join(scratch, "unknown-role.json");
  await writeFile(unknownRole, JSON.stringify({ bogus: "acme/model" }), "utf8");
  const unknownRoleRun = spawnSync(process.execPath, [build, "--output", join(scratch, "err"), "--models", unknownRole], { encoding: "utf8" });
  check(unknownRoleRun.status === 1 && /Unknown role in model mapping/.test(unknownRoleRun.stderr), "unknown role in model mapping is rejected");

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
    check(existsSync(sentinel), `F1 ${caseName} leaves external content intact`);
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
    const missingOutput = spawnSync(process.execPath, [copiedBuild, "--output", join(alias, "missing-output")], { encoding: "utf8" });
    check(missingOutput.status === 1 && /must not be inside the source directory skills/.test(missingOutput.stderr), "F12 missing output under a source-linked ancestor is refused");
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
  check(existsSync(newRootFile), "F3 refused guard leaves the new-root content intact");
} finally {
  await rm(scratch, { recursive: true, force: true });
}

console.log(`Build tests passed: ${assertions} assertions.`);
