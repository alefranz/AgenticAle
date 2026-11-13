#!/usr/bin/env node

// Tests the flat model configuration (scripts/model-config.mjs) and its
// build/installer behavior: validation of the flat role map (a JSON object
// mapping roles to "provider/model[#effort]", missing roles inherit), the
// rendering of the seven OpenCode profiles from the flat config, the build
// state's modelsSource, the model-configuration fragment spliced into the
// plugin/standalone workflow skills, the absence of any routing artifact in
// build output, and the installer's ownership semantics for generated
// profiles. Replaces the retired test-routing.mjs.
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { loadModelConfig } from "./model-config.mjs";

const repository = resolve(import.meta.dirname, "..");
const build = join(repository, "scripts", "build.mjs");
const install = join(repository, "scripts", "install.mjs");

// Scratch under the environment's /tmp/opencode on POSIX; fall back to the OS
// temp dir elsewhere (Windows CI has no /tmp/opencode).
const scratchRoot = process.platform === "win32" ? tmpdir() : join(tmpdir(), "opencode");
await mkdir(scratchRoot, { recursive: true });
const scratch = await mkdtemp(join(scratchRoot, "agenticale-models-test-"));
let assertions = 0;

function check(condition, label) {
  assert.ok(condition, label);
  assertions += 1;
}

function portable(path) {
  return path.split(sep).join("/");
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.filter((entry) => entry.isDirectory()).map((entry) => listFiles(join(directory, entry.name))));
  return [...entries.filter((entry) => entry.isFile()).map((entry) => join(directory, entry.name)), ...nested.flat()].sort();
}

// Sorted portable paths relative to `base`.
async function listRelative(base) {
  return (await listFiles(base)).map((path) => portable(relative(base, path))).sort();
}

async function readText(path) {
  return readFile(path, "utf8");
}

function buildFixture(name, args = []) {
  const root = join(scratch, name);
  const result = spawnSync(process.execPath, [build, "--output", root, ...args], { encoding: "utf8" });
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

function installRun(target, extra = []) {
  const result = spawnSync(process.execPath, [install, "install", "--target", target, ...extra], { encoding: "utf8" });
  return { exit: result.status, out: (result.stdout || "").trim(), err: (result.stderr || "").trim() };
}

// Expect loadModelConfig to throw and the error message to match every pattern.
async function expectConfigError(value, label, patterns) {
  let threw = null;
  try {
    await loadModelConfig(value);
  } catch (error) {
    threw = error;
  }
  check(threw instanceof Error, `${label}: loadModelConfig throws`);
  for (const pattern of patterns) {
    check(threw !== null && pattern.test(threw.message), `${label}: error ${pattern} (got: ${threw ? threw.message : "no error"})`);
  }
}

const ALL_ROLES = ["explore", "implement", "implement-hard", "fix", "review", "deep-review", "consult"];

try {
  // ---------------------------------------------------------------------
  // 1. Flat-format validation (the shared loader the build and installers use).
  // ---------------------------------------------------------------------
  {
    const validFull = join(scratch, "valid-full.json");
    await writeFile(validFull, JSON.stringify({
      explore: "acme/explore-low#low",
      implement: "acme/implement",
      "implement-hard": "acme/hard#xhigh",
      fix: "acme/fix#medium",
      review: "acme/review#high",
      "deep-review": "acme/deep#xhigh",
      consult: "acme/consult#max",
    }), "utf8");
    const { config, sourcePath } = await loadModelConfig(validFull);
    check(Object.keys(config).sort().join(",") === ALL_ROLES.sort().join(","), "valid full file: all seven roles load");
    check(sourcePath === validFull, "valid full file: sourcePath is the resolved path");
    check(config.explore.model === "acme/explore-low" && config.explore.effort === "low", "valid full file: model#effort splits into model and effort");
    check(config.implement.model === "acme/implement" && config.implement.effort === null, "valid full file: a value without #effort carries no effort");

    // A missing role is legal: it inherits the session model.
    const validPartial = join(scratch, "valid-partial.json");
    await writeFile(validPartial, JSON.stringify({ review: "acme/review#high" }), "utf8");
    const { config: partial } = await loadModelConfig(validPartial);
    check(Object.keys(partial).join(",") === "review", "missing roles: a partial file loads with only the listed roles");
    check(partial.review.model === "acme/review" && partial.review.effort === "high", "missing roles: the listed role parses");

    await expectConfigError(join(scratch, "missing.json"), "missing file", [
      /Model config file not found/,
      /missing\.json/,
    ]);

    const notJson = join(scratch, "not-json.json");
    await writeFile(notJson, "{nope", "utf8");
    await expectConfigError(notJson, "invalid JSON", [/Model config is not valid JSON/]);

    const nonObjectArray = join(scratch, "non-object-array.json");
    await writeFile(nonObjectArray, "[]", "utf8");
    await expectConfigError(nonObjectArray, "array JSON", [/Model config must be a JSON object mapping roles/]);

    const nonObjectScalar = join(scratch, "non-object-scalar.json");
    await writeFile(nonObjectScalar, "42", "utf8");
    await expectConfigError(nonObjectScalar, "scalar JSON", [/Model config must be a JSON object mapping roles/]);

    const unknownRole = join(scratch, "unknown-role.json");
    await writeFile(unknownRole, JSON.stringify({ bogus: "acme/model" }), "utf8");
    await expectConfigError(unknownRole, "unknown role", [
      /Unknown role in model config/,
      /'bogus'/,
    ]);

    const badEffort = join(scratch, "bad-effort.json");
    await writeFile(badEffort, JSON.stringify({ review: "acme/model#extreme" }), "utf8");
    await expectConfigError(badEffort, "invalid effort suffix", [
      /Model for role 'review' has an invalid reasoning effort 'extreme'/,
      /'acme\/model#extreme'/,
    ]);

    const noSlash = join(scratch, "no-slash.json");
    await writeFile(noSlash, JSON.stringify({ fix: "gpt-6" }), "utf8");
    await expectConfigError(noSlash, "value without a provider slash", [
      /Model for role 'fix' must be "provider\/model\[#effort\]"/,
      /'gpt-6'/,
    ]);

    const nonString = join(scratch, "non-string.json");
    await writeFile(nonString, JSON.stringify({ review: 42 }), "utf8");
    await expectConfigError(nonString, "non-string value", [
      /Model for role 'review' must be a non-empty string/,
      /42/,
    ]);

    // Regression: values with empty provider/model components, whitespace,
    // or control characters are rejected (they would corrupt the generated
    // frontmatter). Every error names the role.
    const rejectedValueCases = [
      ["empty model component", "review", "provider/"],
      ["empty provider component", "implement", "/model"],
      ["newline injection", "review", "provider/model\nsteps: 999"],
      ["internal space", "fix", "provider /model"],
      ["trailing space after effort", "consult", "a/b#medium "],
    ];
    for (const [label, role, badValue] of rejectedValueCases) {
      const bad = join(scratch, `rejected-${label.replace(/\s+/g, "-")}.json`);
      await writeFile(bad, JSON.stringify({ [role]: badValue }), "utf8");
      await expectConfigError(bad, label, [
        new RegExp(`Model for role '${role}'`),
      ]);
    }

    // Plain provider/model and provider/model#max remain valid.
    const validSimple = join(scratch, "valid-simple.json");
    await writeFile(validSimple, JSON.stringify({ implement: "provider/model", explore: "provider/model#max" }), "utf8");
    const { config: simple } = await loadModelConfig(validSimple);
    check(simple.implement.model === "provider/model" && simple.implement.effort === null, "simple values: 'provider/model' loads");
    check(simple.explore.model === "provider/model" && simple.explore.effort === "max", "simple values: 'provider/model#max' loads");
  }
  {
    // Preset names resolve to the bundled examples/ files (case-insensitive).
    const { config, sourcePath } = await loadModelConfig("local");
    check(sourcePath === join(repository, "examples", "local.json"), "preset: the name 'local' resolves to examples/local.json");
    check(config.review.model === "local-llama/qwen3.8-27b" && config.review.effort === "xhigh", "preset: the local preset loads its per-role values");
    const { sourcePath: upper } = await loadModelConfig("LOCAL");
    check(upper === join(repository, "examples", "local.json"), "preset: preset names are case-insensitive");
  }

  // ---------------------------------------------------------------------
  // 2. Build rendering from the flat model config.
  // ---------------------------------------------------------------------
  const defaultModels = JSON.parse(await readText(join(repository, "adapters", "opencode", "models.json")));
  const fixture = buildFixture("build-default");
  {
    const state = JSON.parse(await readText(fixture.buildState));
    check(state.modelsSource === "adapters/opencode/models.json", "default build: build state modelsSource is the packaged flat model config");
    check(state.noModel === false, "default build: build state noModel is false");
    check(JSON.stringify(state.profiles.map((p) => p.name).sort()) === JSON.stringify(ALL_ROLES.sort()), "default build: build state records all seven profiles");

    for (const role of ALL_ROLES) {
      const text = await readText(join(fixture.openCodeRoot, "agents", "agenticale", `${role}.md`));
      const assignment = defaultModels[role];
      const [model, effort] = assignment.split("#");
      check(text.includes(`model: ${model}`), `default build: ${role} profile renders the flat config model ${model}`);
      check(text.includes(`reasoningEffort: ${effort}`), `default build: ${role} profile renders the flat config effort ${effort}`);
      check((text.match(/^model:/gm) ?? []).length === 1, `default build: ${role} profile renders exactly one model line`);
    }

    // Fragment splicing: the authored fragment is the final top-level section
    // of the plugin and standalone work/review/autonomous SKILL.md copies only.
    const title = "## Model configuration (this installation)";
    const fragmentTargets = [
      ["plugin work", join(fixture.pluginRoot, "skills", "work", "SKILL.md")],
      ["plugin review", join(fixture.pluginRoot, "skills", "review", "SKILL.md")],
      ["plugin autonomous", join(fixture.pluginRoot, "skills", "autonomous", "SKILL.md")],
      ["standalone work", join(fixture.standaloneRoot, "work", "SKILL.md")],
      ["standalone review", join(fixture.standaloneRoot, "review", "SKILL.md")],
      ["standalone autonomous", join(fixture.standaloneRoot, "autonomous", "SKILL.md")],
    ];
    for (const [label, path] of fragmentTargets) {
      const text = await readText(path);
      check(text.split(title).length - 1 === 1, `fragment: ${label} carries the fragment title exactly once`);
      const headings = [...text.matchAll(/^## .*$/gm)].map((m) => m[0]);
      check(headings.length > 0 && headings[headings.length - 1] === title, `fragment: ${label} carries the fragment as the final top-level section`);
    }
    const fragmentAbsence = [
      ["opencode work", join(fixture.openCodeRoot, "skills", "work", "SKILL.md")],
      ["opencode review", join(fixture.openCodeRoot, "skills", "review", "SKILL.md")],
      ["opencode autonomous", join(fixture.openCodeRoot, "skills", "autonomous", "SKILL.md")],
      ["plugin pull-request-description", join(fixture.pluginRoot, "skills", "pull-request-description", "SKILL.md")],
      ["plugin source-code-lookup", join(fixture.pluginRoot, "skills", "source-code-lookup", "SKILL.md")],
      ["standalone pull-request-description", join(fixture.standaloneRoot, "pull-request-description", "SKILL.md")],
      ["standalone source-code-lookup", join(fixture.standaloneRoot, "source-code-lookup", "SKILL.md")],
    ];
    for (const [label, path] of fragmentAbsence) {
      const text = await readText(path);
      check(!text.includes(title), `fragment: ${label} does not carry the fragment`);
    }

    // No routing artifact ships anywhere in any build output.
    for (const [label, root] of [["plugin", fixture.pluginRoot], ["standalone", fixture.standaloneRoot], ["opencode", fixture.openCodeRoot]]) {
      const rel = await listRelative(root);
      check(!rel.some((p) => p === "work/references/routing.json" || p.endsWith("/routing.json")), `${label} bundle ships no routing.json`);
      check(!rel.some((p) => p.endsWith("preferences.example.md")), `${label} bundle ships no preferences.example.md`);
      check(!rel.some((p) => p.endsWith("scripts/routing.mjs")), `${label} bundle ships no routing.mjs`);
    }
  }
  {
    // --no-model: every role inherits; no profile carries a model line.
    const noModel = buildFixture("build-nomodel", ["--no-model"]);
    const state = JSON.parse(await readText(noModel.buildState));
    check(state.modelsSource === "none (--no-model)", "--no-model build: build state modelsSource is 'none (--no-model)'");
    check(state.noModel === true, "--no-model build: build state noModel is true");
    check(state.profiles.every((p) => p.mode === "inherit" && p.model === undefined), "--no-model build: build state profiles all inherit");
    for (const role of ALL_ROLES) {
      const text = await readText(join(noModel.openCodeRoot, "agents", "agenticale", `${role}.md`));
      check(!/^model:/m.test(text) && !/^reasoningEffort:/m.test(text), `--no-model build: ${role} profile has no model/effort lines`);
    }
  }
  {
    // --models with a preset name: the flat preset renders verbatim and the
    // build state records the caller value.
    const preset = buildFixture("build-preset", ["--models", "local"]);
    const state = JSON.parse(await readText(preset.buildState));
    check(state.modelsSource === "--models local", "preset build: build state modelsSource records the --models preset");
    const review = await readText(join(preset.openCodeRoot, "agents", "agenticale", "review.md"));
    check(review.includes("model: local-llama/qwen3.8-27b") && review.includes("reasoningEffort: xhigh"), "preset build: the local preset renders into the review profile");
  }
  {
    // --models with a caller file that lists only some roles: the listed roles
    // render explicit frontmatter, the unlisted roles inherit (no model line).
    const partial = join(scratch, "partial-models.json");
    await writeFile(partial, JSON.stringify({ review: "acme/rev#high" }), "utf8");
    const caller = buildFixture("build-caller", ["--models", partial]);
    const state = JSON.parse(await readText(caller.buildState));
    check(state.modelsSource === `--models ${partial}`, "caller build: build state modelsSource records the --models path");
    const review = await readText(join(caller.openCodeRoot, "agents", "agenticale", "review.md"));
    check(review.includes("model: acme/rev") && review.includes("reasoningEffort: high"), "caller build: the listed review role renders explicit frontmatter");
    const consult = await readText(join(caller.openCodeRoot, "agents", "agenticale", "consult.md"));
    check(!/^model:/m.test(consult) && !/^reasoningEffort:/m.test(consult), "caller build: an unlisted role inherits (no model line)");
  }
  {
    // Regression: the packaged default must resolve against the repository
    // root, not the caller's CWD — a build from a different CWD with no
    // --models succeeds and renders the packaged default into all seven profiles.
    const otherCwd = join(scratch, "build-other-cwd");
    const result = spawnSync(process.execPath, [build, "--output", otherCwd], { cwd: scratchRoot, encoding: "utf8" });
    check(result.status === 0, `other-cwd build exits 0${result.status === 0 ? "" : ` (stderr: ${result.stderr.trim()})`}`);
    if (result.status !== 0) console.error(result.stdout, result.stderr);
    for (const role of ALL_ROLES) {
      const text = await readText(join(otherCwd, "opencode", "agents", "agenticale", `${role}.md`));
      const [model, effort] = defaultModels[role].split("#");
      check(text.includes(`model: ${model}`) && text.includes(`reasoningEffort: ${effort}`), `other-cwd build: ${role} profile renders the packaged default (${model}, ${effort})`);
    }
  }

  // ---------------------------------------------------------------------
  // 3. Installer ownership smoke: a user edit to a generated profile blocks
  //    the re-install without --replace (the edit is left in place) and is
  //    backed up and replaced with --replace.
  // ---------------------------------------------------------------------
  {
    const target = join(scratch, "install-smoke");
    const fresh = installRun(target, ["--no-model"]);
    check(fresh.exit === 0 && fresh.out.includes("Installation complete."), "installer smoke: fresh install exits 0");
    const profile = join(target, "agents", "agenticale", "consult.md");
    const generated = await readText(profile);
    await writeFile(profile, "USER-EDITED\n", "utf8");
    const blocked = installRun(target, ["--no-model"]);
    check(blocked.exit === 1 && blocked.err.includes("Differing content already exists at:"), "installer smoke: re-install without --replace is blocked");
    check(blocked.err.includes(profile), "installer smoke: the blocked re-install names the modified profile");
    check(blocked.err.includes("--replace"), "installer smoke: the blocked re-install points at --replace");
    check((await readText(profile)) === "USER-EDITED\n", "installer smoke: the modified profile is preserved on the blocked re-install");
    const replaced = installRun(target, ["--no-model", "--replace"]);
    check(replaced.exit === 0 && replaced.out.includes("backup created:"), "installer smoke: --replace exits 0 and backs up the edit");
    check((await readText(profile)) === generated, "installer smoke: --replace restores the generated profile content");
    const backups = join(target, ".autonomous-mode-backups");
    const backupFiles = (await listRelative(backups)).filter((p) => p.endsWith("agents/agenticale/consult.md"));
    check(backupFiles.length === 1, "installer smoke: the backup directory carries the modified profile");
  }
} finally {
  await rm(scratch, { recursive: true, force: true });
}

console.log(`Model configuration tests passed: ${assertions} assertions.`);
