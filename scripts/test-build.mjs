#!/usr/bin/env node

import { existsSync } from "node:fs";
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

async function buildFixture(name, args = [], { env, cwd } = {}) {
  const root = join(scratch, name);
  const result = spawnSync(process.execPath, [build, "--output", root, ...args], {
    encoding: "utf8",
    env: env ? { ...process.env, ...env } : process.env,
    cwd,
  });
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

// The version-1 baseline exactly as it was committed before the version-2
// contract (git 11eb0ae:skills/work/references/routing.json). The acceptance
// criterion is that the version-2 baseline resolves to the SAME concrete
// selections as this inventory, so routing-output assertions compare against
// it. Version-1 --routing inputs in this file are derived from it too.
const legacyV1Baseline = {
  schemaVersion: 1,
  provenance: "Baseline-inventory defaults derived from examples/gpt.json and examples/openai.json (gpt-6 family). These are NOT verified against any live account or runtime in this documentation-only pass. Exact native model field names and supported effort values are adapter concerns; validate identifiers per host before relying on a strict route, or override any route (or use --no-model / --routing PATH).",
  runtimes: {
    copilot: {
      explore: { mode: "explicit", model: "OpenAI/gpt-6-luna", reasoningEffort: "max", fallbacks: [] },
      implement: { mode: "explicit", model: "OpenAI/gpt-6-luna", reasoningEffort: "max", fallbacks: [] },
      "implement-hard": { mode: "explicit", model: "OpenAI/gpt-6-sol", reasoningEffort: "high", fallbacks: [] },
      fix: { mode: "explicit", model: "OpenAI/gpt-6-luna", reasoningEffort: "max", fallbacks: [] },
      review: { mode: "explicit", model: "OpenAI/gpt-6-sol", reasoningEffort: "high", fallbacks: [] },
      "deep-review": { mode: "explicit", model: "OpenAI/gpt-6-sol", reasoningEffort: "xhigh", fallbacks: [] },
      consult: { mode: "explicit", model: "OpenAI/gpt-6-sol", reasoningEffort: "xhigh", fallbacks: [] },
    },
    codex: {
      explore: { mode: "explicit", model: "openai/gpt-6-luna", reasoningEffort: "max", fallbacks: [] },
      implement: { mode: "explicit", model: "openai/gpt-6-luna", reasoningEffort: "max", fallbacks: [] },
      "implement-hard": { mode: "explicit", model: "openai/gpt-6-sol", reasoningEffort: "high", fallbacks: [] },
      fix: { mode: "explicit", model: "openai/gpt-6-luna", reasoningEffort: "max", fallbacks: [] },
      review: { mode: "explicit", model: "openai/gpt-6-sol", reasoningEffort: "high", fallbacks: [] },
      "deep-review": { mode: "explicit", model: "openai/gpt-6-sol", reasoningEffort: "xhigh", fallbacks: [] },
      consult: { mode: "explicit", model: "openai/gpt-6-sol", reasoningEffort: "xhigh", fallbacks: [] },
    },
    opencode: {
      explore: { mode: "explicit", model: "opencode/gpt-6-luna", reasoningEffort: "max", fallbacks: [] },
      implement: { mode: "explicit", model: "opencode/gpt-6-luna", reasoningEffort: "max", fallbacks: [] },
      "implement-hard": { mode: "explicit", model: "opencode/gpt-6-sol", reasoningEffort: "high", fallbacks: [] },
      fix: { mode: "explicit", model: "opencode/gpt-6-luna", reasoningEffort: "max", fallbacks: [] },
      review: { mode: "explicit", model: "opencode/gpt-6-sol", reasoningEffort: "high", fallbacks: [] },
      "deep-review": { mode: "explicit", model: "opencode/gpt-6-sol", reasoningEffort: "xhigh", fallbacks: [] },
      consult: { mode: "explicit", model: "opencode/gpt-6-sol", reasoningEffort: "xhigh", fallbacks: [] },
    },
  },
};

// Key-order-insensitive JSON comparison (policy objects are compared by value,
// not by serialization order).
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

try {
  // Default build: three output roots, correct shapes and file counts.
  const fixture = await buildFixture("default");
  const pluginRel = await listRelative(fixture.pluginRoot);
  const standaloneRel = await listRelative(fixture.standaloneRoot);
  const openCodeRel = await listRelative(fixture.openCodeRoot);

  check(pluginRel.length === 23, "plugin bundle has 23 files");
  check(standaloneRel.length === 22, "standalone bundle has 22 files");
  check(openCodeRel.length === 31, "OpenCode bundle has 31 files (7 profiles + 2 commands + 22 skills)");

  // The packaged routing resources (version-2 baseline, resolved version-1
  // snapshot, example preferences, and the shared resolver module) ship in
  // all three output roots.
  for (const [label, skillsRoot] of [
    ["plugin", join(fixture.pluginRoot, "skills")],
    ["standalone", fixture.standaloneRoot],
    ["opencode", join(fixture.openCodeRoot, "skills")],
  ]) {
    for (const rel of [
      "work/references/routing.json",
      "work/references/resolved-routing.json",
      "work/references/routing.example.md",
      "work/scripts/routing.mjs",
    ]) {
      check(existsSync(join(skillsRoot, rel)), `${label} bundle ships ${rel}`);
    }
  }

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

  // OpenCode command entries: thin launchers for the explicit-only skills.
  check(openCodeRel.includes("commands/work.md") && openCodeRel.includes("commands/autonomous.md"), "OpenCode bundle has the two command entries");
  const workCommand = await readText(join(fixture.openCodeRoot, "commands", "work.md"));
  check(workCommand.includes("`work`") && workCommand.includes("$ARGUMENTS"), "work command loads the work skill by exact ID and passes $ARGUMENTS");
  const autonomousCommand = await readText(join(fixture.openCodeRoot, "commands", "autonomous.md"));
  check(autonomousCommand.includes("`autonomous`") && autonomousCommand.includes("$ARGUMENTS"), "autonomous command loads the autonomous skill by exact ID and passes $ARGUMENTS");

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
  // routing.json holds the effective version-2 baseline (tiers + role
  // exceptions); resolved-routing.json holds the fully resolved version-1
  // snapshot from the same resolution pass. Both ship in every skill tree.
  const assertV2TierShape = (label, v2) => {
    check(v2.schemaVersion === 2, `${label} routing.json is a version-2 baseline`);
    check(typeof v2.provenance === "string" && v2.provenance.length > 0, `${label} routing.json carries provenance`);
    check(JSON.stringify(Object.keys(v2.roleTiers).sort()) === JSON.stringify(allProfiles.slice().sort()), `${label} routing.json maps all seven roles to tiers`);
    for (const runtime of ["copilot", "codex", "opencode"]) {
      const map = v2.runtimes?.[runtime];
      check(map && typeof map.tiers === "object" && typeof map.roles === "object", `${label} routing.json declares tiers+roles for ${runtime}`);
      for (const tier of ["fast", "standard", "deep"]) {
        const entry = map?.tiers?.[tier];
        check(
          entry && entry.mode === "explicit" && typeof entry.model === "string" && entry.model.length > 0
            && ["low", "medium", "high", "xhigh", "max"].includes(entry.reasoningEffort) && Array.isArray(entry.fallbacks),
          `${label} routing.json ${runtime}/${tier} is a valid explicit tier`,
        );
      }
    }
  };
  const assertResolvedV1Modes = async (label, skillsRoot, expectedMode) => {
    const resolvedPath = join(skillsRoot, "work", "references", "resolved-routing.json");
    check(existsSync(resolvedPath), `${label} materializes work/references/resolved-routing.json`);
    const parsed = JSON.parse(await readText(resolvedPath));
    check(parsed.schemaVersion === 1, `${label} resolved snapshot is a version-1 policy`);
    for (const runtime of Object.keys(parsed.runtimes)) {
      for (const route of Object.keys(parsed.runtimes[runtime])) {
        check(parsed.runtimes[runtime][route].mode === expectedMode, `${label} resolved ${runtime}/${route} is ${expectedMode}`);
      }
    }
  };
  const withoutProvenance = (policy) => { const { provenance, ...rest } = policy; return rest; };
  // The default build materializes the packaged (explicit) routing into every
  // tree, and the resolved snapshot is the legacy v1 baseline with nothing lost.
  assertV2TierShape("default plugin", JSON.parse(await readText(join(fixture.pluginRoot, "skills", "work", "references", "routing.json"))));
  await assertResolvedV1Modes("default plugin", join(fixture.pluginRoot, "skills"), "explicit");
  await assertResolvedV1Modes("default standalone", fixture.standaloneRoot, "explicit");
  await assertResolvedV1Modes("default opencode", join(fixture.openCodeRoot, "skills"), "explicit");
  const defaultResolved = JSON.parse(await readText(join(fixture.standaloneRoot, "work", "references", "resolved-routing.json")));
  check(
    stableStringify(withoutProvenance(defaultResolved)) === stableStringify(withoutProvenance(legacyV1Baseline)),
    "default resolved snapshot is deep-equal to the legacy version-1 baseline (provenance aside)",
  );
  // --no-model materializes an inherit-only routing into every tree.
  await assertResolvedV1Modes("no-model plugin", join(noModel.pluginRoot, "skills"), "inherit");
  await assertResolvedV1Modes("no-model standalone", noModel.standaloneRoot, "inherit");
  const noModelV2 = JSON.parse(await readText(join(noModel.standaloneRoot, "work", "references", "routing.json")));
  for (const runtime of Object.keys(noModelV2.runtimes)) {
    const roleMap = noModelV2.runtimes[runtime].roles;
    check(JSON.stringify(Object.keys(roleMap).sort()) === JSON.stringify(allProfiles.slice().sort()), `no-model routing.json ${runtime} has a role exception for every role`);
    check(Object.values(roleMap).every((entry) => entry.mode === "inherit"), `no-model routing.json ${runtime} roles all inherit`);
  }
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

  // --routing accepts BOTH version-1 policies and version-2 baselines. A
  // version-1 input is a complete policy: it normalizes to exact direct role
  // exceptions over the packaged tiers (never reinterpreted as a sparse tier
  // override) and undeclared runtimes keep the packaged defaults.
  const packaged = JSON.parse(await readText(join(repository, "skills", "work", "references", "routing.json")));
  const callerV1 = structuredClone(legacyV1Baseline);
  callerV1.runtimes.opencode.review.model = "acme/test-model";
  const callerV1Path = join(scratch, "caller-routing-v1.json");
  await writeFile(callerV1Path, JSON.stringify(callerV1), "utf8");
  const v1Fixture = await buildFixture("caller-routing-v1", ["--routing", callerV1Path]);
  check((await readText(join(v1Fixture.openCodeRoot, "agents", "autonomous", "review.md"))).includes("model: acme/test-model"), "--routing v1 policy model is rendered into the review profile");
  check((await readText(join(v1Fixture.openCodeRoot, "agents", "autonomous", "explore.md"))).includes("model: opencode/gpt-6-luna"), "--routing v1 policy leaves unmodified routes at their packaged model");
  // The changed role materializes as a direct role exception, not a tier rewrite.
  const v1Shipped = JSON.parse(await readText(join(v1Fixture.standaloneRoot, "work", "references", "routing.json")));
  check(v1Shipped.runtimes.opencode.roles.review.mode === "explicit" && v1Shipped.runtimes.opencode.roles.review.model === "acme/test-model", "--routing v1 policy change materializes as an opencode/review role exception");
  check(v1Shipped.runtimes.opencode.tiers.standard.model === "opencode/gpt-6-sol", "--routing v1 policy does not rewrite the standard tier");
  const v1ShippedPlugin = JSON.parse(await readText(join(v1Fixture.pluginRoot, "skills", "work", "references", "routing.json")));
  check(v1ShippedPlugin.runtimes.opencode.roles.review.model === "acme/test-model", "--routing v1 customization is materialized into the plugin routing.json");
  // The resolved snapshot equals the caller's complete policy (provenance aside).
  const v1Resolved = JSON.parse(await readText(join(v1Fixture.standaloneRoot, "work", "references", "resolved-routing.json")));
  check(stableStringify(withoutProvenance(v1Resolved)) === stableStringify(withoutProvenance(callerV1)), "--routing v1 resolved snapshot equals the caller policy (provenance aside)");

  // A version-2 input is a defaults baseline: an overridden tier affects every
  // role mapped to it, and undeclared runtimes are filled from the packaged
  // defaults as before.
  const callerV2 = structuredClone(packaged);
  callerV2.runtimes.opencode.tiers.standard.model = "acme/v2-model";
  const callerV2Path = join(scratch, "caller-routing-v2.json");
  await writeFile(callerV2Path, JSON.stringify(callerV2), "utf8");
  const v2Fixture = await buildFixture("caller-routing-v2", ["--routing", callerV2Path]);
  check((await readText(join(v2Fixture.openCodeRoot, "agents", "autonomous", "review.md"))).includes("model: acme/v2-model"), "--routing v2 tier override renders into the review profile");
  check((await readText(join(v2Fixture.openCodeRoot, "agents", "autonomous", "implement-hard.md"))).includes("model: acme/v2-model"), "--routing v2 tier override renders into the implement-hard profile");
  check((await readText(join(v2Fixture.openCodeRoot, "agents", "autonomous", "explore.md"))).includes("model: opencode/gpt-6-luna"), "--routing v2 leaves unmapped tiers at their packaged model");
  const v2Shipped = JSON.parse(await readText(join(v2Fixture.standaloneRoot, "work", "references", "routing.json")));
  check(v2Shipped.runtimes.opencode.tiers.standard.model === "acme/v2-model", "--routing v2 customization is materialized into the standalone routing.json");
  check(v2Shipped.runtimes.opencode.tiers.fast.model === "opencode/gpt-6-luna", "--routing v2 leaves the fast tier untouched");

  // F5: --effort cannot be applied to a route that inherits (inherit means
  // inherit both model AND effort), including the all-inherit --no-model case.
  const inheritRouting = structuredClone(legacyV1Baseline);
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
  const codexOnly = { schemaVersion: 1, runtimes: { codex: structuredClone(legacyV1Baseline.runtimes.codex) } };
  const codexOnlyPath = join(scratch, "f6-codex-only.json");
  await writeFile(codexOnlyPath, JSON.stringify(codexOnly), "utf8");
  const f6Fixture = await buildFixture("f6-codex-only", ["--routing", codexOnlyPath]);
  const f6Explore = await readText(join(f6Fixture.openCodeRoot, "agents", "autonomous", "explore.md"));
  check(f6Explore.includes("model: opencode/gpt-6-luna"), "F6 omitted opencode runtime is filled from the packaged preset (explore profile carries a model)");
  const f6Shipped = JSON.parse(await readText(join(f6Fixture.standaloneRoot, "work", "references", "routing.json")));
  check(JSON.stringify(Object.keys(f6Shipped.runtimes).sort()) === JSON.stringify(["codex", "copilot", "opencode"].sort()), "F6 shipped v2 baseline declares all three runtimes");
  check(f6Shipped.runtimes.opencode.tiers.fast.model === "opencode/gpt-6-luna", "F6 merged opencode runtime keeps the packaged tier model");
  const f6Resolved = JSON.parse(await readText(join(f6Fixture.standaloneRoot, "work", "references", "resolved-routing.json")));
  check(f6Resolved.runtimes.codex.explore.model === legacyV1Baseline.runtimes.codex.explore.model, "F6 declared codex runtime is untouched by the merge");

  // OpenCode preparation inputs: a requested policy carrying an ordered
  // fallback list on one role and an intentional inheritance on another. The
  // build materializes the primary selection into the profile frontmatter
  // only — the seven-profile adapter cannot execute a fallback chain — while
  // the shipped resources preserve the fallback list and inheritance verbatim.
  const prepV1 = structuredClone(legacyV1Baseline);
  prepV1.runtimes.opencode.review.model = "acme/review-prep";
  prepV1.runtimes.opencode.review.fallbacks = [
    { model: "acme/review-fb-1", reasoningEffort: "high" },
    { model: "acme/review-fb-2", reasoningEffort: "medium" },
  ];
  prepV1.runtimes.opencode.consult = { mode: "inherit" };
  const prepV1Path = join(scratch, "prep-routing-v1.json");
  await writeFile(prepV1Path, JSON.stringify(prepV1), "utf8");
  const prepFixture = await buildFixture("prep-routing-v1", ["--routing", prepV1Path]);
  const prepReview = await readText(join(prepFixture.openCodeRoot, "agents", "autonomous", "review.md"));
  check(prepReview.includes("model: acme/review-prep"), "prep v1: review profile renders the requested primary model");
  check((prepReview.match(/^model:/gm) ?? []).length === 1, "prep v1: the profile materializes exactly one model (no fallback chain)");
  check(!prepReview.includes("acme/review-fb-1") && !prepReview.includes("acme/review-fb-2"), "prep v1: requested fallbacks are not rendered into the profile");
  check(prepReview.includes("steps: 56") && prepReview.includes("mode: subagent") && prepReview.includes("- action: subagent") && prepReview.includes("- action: question") && !/- action: edit/.test(prepReview), "prep v1: review profile keeps its permission/step fields");
  const prepConsult = await readText(join(prepFixture.openCodeRoot, "agents", "autonomous", "consult.md"));
  check(!/^model:/m.test(prepConsult) && !/^reasoningEffort:/m.test(prepConsult), "prep v1: an inherit request renders a profile with no forced model");
  check(prepConsult.includes("steps: 20") && prepConsult.includes("- action: edit"), "prep v1: consult profile keeps its permission/step fields");
  const prepProfileNames = (await listRelative(prepFixture.openCodeRoot)).filter((path) => path.startsWith("agents/autonomous/")).map((path) => path.split("/").pop().replace(".md", ""));
  check(JSON.stringify([...prepProfileNames].sort()) === JSON.stringify([...allProfiles].sort()), "prep v1: seven profiles with a distinct implement-hard");
  const prepResolved = JSON.parse(await readText(join(prepFixture.standaloneRoot, "work", "references", "resolved-routing.json")));
  check(JSON.stringify(prepResolved.runtimes.opencode.review.fallbacks) === JSON.stringify(prepV1.runtimes.opencode.review.fallbacks), "prep v1: the resolved snapshot preserves the requested fallback order");
  check(JSON.stringify(prepResolved.runtimes.opencode.consult) === JSON.stringify({ mode: "inherit" }), "prep v1: the resolved snapshot preserves the intentional inheritance");
  check(prepResolved.runtimes.opencode.explore.model === legacyV1Baseline.runtimes.opencode.explore.model, "prep v1: the resolved snapshot keeps untouched routes");
  const prepShipped = JSON.parse(await readText(join(prepFixture.pluginRoot, "skills", "work", "references", "routing.json")));
  check(JSON.stringify(prepShipped.runtimes.opencode.roles.review.fallbacks) === JSON.stringify(prepV1.runtimes.opencode.review.fallbacks), "prep v1: the shipped v2 baseline preserves the fallback list in the role exception");

  // strictValidateRouting negative cases (the shared contract the build enforces).
  const { strictValidateRouting } = await import("./build.mjs");
  const makeBad = (mutate) => { const r = structuredClone(legacyV1Baseline); mutate(r); return r; };
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

  // A Markdown preference file supplied to --routing is a workflow input, not a
  // build input: the build refuses it before parsing with guidance toward the
  // runtime preference files and a resolved JSON export.
  const markdownPrefs = join(scratch, "routing-prefs.md");
  await writeFile(markdownPrefs, "# Personal preferences\nexplore: acme/prose-model\n", "utf8");
  const markdownRun = spawnSync(process.execPath, [build, "--output", join(scratch, "err"), "--routing", markdownPrefs], { encoding: "utf8" });
  check(markdownRun.status === 1 && /expects a JSON policy/.test(markdownRun.stderr), "Markdown path to --routing is refused before parsing");
  check(/routing\.md/.test(markdownRun.stderr) && /resolved version-1 JSON/.test(markdownRun.stderr), "Markdown --routing refusal points at runtime preferences and the resolved JSON export");
  check(!(await existsSync(join(scratch, "err"))), "Markdown --routing refusal writes no output");

  // Publication isolation: a default build must neither read nor embed the
  // caller's home/project routing preferences, even when both are seeded in an
  // isolated fake home and project root that a discovery helper could find.
  {
    const sentinelHome = join(scratch, "sentinel-home");
    const sentinelProject = join(scratch, "sentinel-project");
    await mkdir(join(sentinelHome, ".agenticale"), { recursive: true });
    await mkdir(join(sentinelProject, ".agenticale"), { recursive: true });
    const homePrefs = "SENTINEL-HOME-PREFERENCE-ZXQ9\nexplore: acme/sentinel-home-model\n";
    const projectPrefs = "SENTINEL-PROJECT-PREFERENCE-KT7W\nreview: acme/sentinel-project-model\n";
    await writeFile(join(sentinelHome, ".agenticale", "routing.md"), homePrefs, "utf8");
    await writeFile(join(sentinelProject, ".agenticale", "routing.md"), projectPrefs, "utf8");
    const iso = await buildFixture("isolation", [], { env: { HOME: sentinelHome, USERPROFILE: sentinelHome }, cwd: sentinelProject });
    const builtContents = await Promise.all([
      ...(await listFiles(iso.pluginRoot)),
      ...(await listFiles(iso.standaloneRoot)),
      ...(await listFiles(iso.openCodeRoot)),
      iso.buildState,
    ].map((path) => readFile(path, "utf8")));
    check(!builtContents.some((text) => text.includes("SENTINEL-HOME-PREFERENCE-ZXQ9")), "default build does not embed the home routing.md sentinel");
    check(!builtContents.some((text) => text.includes("SENTINEL-PROJECT-PREFERENCE-KT7W")), "default build does not embed the project routing.md sentinel");
    check(!builtContents.some((text) => text.includes("acme/sentinel-home-model") || text.includes("acme/sentinel-project-model")), "default build does not interpret the sentinel preference selections");
    check((await readText(join(sentinelProject, ".agenticale", "routing.md"))) === projectPrefs, "default build leaves the project routing.md untouched");
    check((await readText(join(sentinelHome, ".agenticale", "routing.md"))) === homePrefs, "default build leaves the home routing.md untouched");
    const committedContents = await Promise.all((await listFiles(join(repository, "plugins", "agenticale"))).map((path) => readFile(path, "utf8")));
    check(!committedContents.some((text) => text.includes("SENTINEL-HOME-PREFERENCE-ZXQ9") || text.includes("SENTINEL-PROJECT-PREFERENCE-KT7W")), "published plugin does not embed the routing.md sentinels");
  }

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
  check(existsSync(newRootFile), "F3 refused guard leaves the new-root content intact");
} finally {
  await rm(scratch, { recursive: true, force: true });
}

console.log(`Build tests passed: ${assertions} assertions.`);
