#!/usr/bin/env node

// Tests the flat model configuration (scripts/model-config.mjs) and its
// build/installer behavior: validation of the flat role map (a JSON object
// mapping worker roles to "provider/model[#effort]" plus the optional
// top-level coordinator session key, missing roles inherit), the rendering
// of the OpenCode profiles from the flat config (seven base workers always,
// implement-easy/consult-hard and the coordinator only when configured), the
// build state's modelsSource, the model-configuration fragment spliced into
// the plugin/standalone workflow skills (verbatim, with its content contract:
// nine child keys, no coordinator assignment, no retired deep-review key,
// combined #variant and legacy comma-effort forms, optional-route fallback),
// the absence of any routing artifact
// in build output, the installer's ownership semantics for generated
// profiles, and the configured-route intent lookup contract (the OpenCode
// binding's install-relative ownership-manifest procedure plus the workflow
// skills' narrow manifest-read permission). Replaces the retired
// test-routing.mjs.
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

// The preference fragment's content contract: exactly the nine child worker
// keys (no coordinator assignment), no retired deep-review key, the combined
// provider/model[#variant] form, the legacy comma-effort form kept so existing
// preference files keep working, and the optional routes' base-route fallback.
function checkFragmentContent(label, text) {
  const keyList = text.match(/nine child worker keys:([\s\S]*?)\./);
  check(keyList !== null, `fragment content: ${label} lists the nine child worker keys`);
  const keys = keyList ? keyList[1].split(",").map((token) => token.trim()).sort() : [];
  check(JSON.stringify(keys) === JSON.stringify([...ALL_ROLES].sort()), `fragment content: ${label} lists exactly the nine child keys (no coordinator assignment)`);
  check(text.includes("There is no coordinator key"), `fragment content: ${label} states there is no coordinator key`);
  check(!/\bdeep-review\b/.test(text), `fragment content: ${label} carries no retired deep-review key`);
  check(text.includes("<provider/model[#variant]>"), `fragment content: ${label} documents the combined provider/model[#variant] form`);
  check(text.includes("`low`, `medium`, `high`, `xhigh`, `max`"), `fragment content: ${label} documents the variant set`);
  check(text.includes("- <role>: <model>, <effort>"), `fragment content: ${label} keeps the legacy comma-effort form`);
  check(text.includes("- <role>: <model>"), `fragment content: ${label} keeps the plain model form`);
  check(text.includes("- review: openai/gpt-6.1-sol, xhigh"), `fragment content: ${label} example shows the legacy comma-effort form`);
  check(text.includes("are optional routes") && text.includes("base route"), `fragment content: ${label} documents the optional routes' base-route fallback`);
}

const BASE_ROLES = ["explore", "implement", "implement-hard", "fix", "review", "review-deep", "consult"];
const OPTIONAL_ROLES = ["implement-easy", "consult-hard"];
const ALL_ROLES = ["explore", "implement", "implement-easy", "implement-hard", "fix", "review", "review-deep", "consult", "consult-hard"];

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

const stripFrontmatter = (text) => text.replace(/^---\n[\s\S]*?\n---\n/, "");

try {
  // ---------------------------------------------------------------------
  // 1. Flat-format validation (the shared loader the build and installers use).
  // ---------------------------------------------------------------------
  {
    const validFull = join(scratch, "valid-full.json");
    await writeFile(validFull, JSON.stringify({
      coordinator: "acme/coordinator#medium",
      explore: "acme/explore-low#low",
      implement: "acme/implement",
      "implement-easy": "acme/easy#low",
      "implement-hard": "acme/hard#xhigh",
      fix: "acme/fix#medium",
      review: "acme/review#high",
      "review-deep": "acme/deep#xhigh",
      consult: "acme/consult#max",
      "consult-hard": "acme/consult-hard#xhigh",
    }), "utf8");
    const { config, coordinator, sourcePath } = await loadModelConfig(validFull);
    check(Object.keys(config).sort().join(",") === ALL_ROLES.sort().join(","), "valid full file: all nine worker roles load");
    check(sourcePath === validFull, "valid full file: sourcePath is the resolved path");
    check(config.explore.model === "acme/explore-low" && config.explore.effort === "low", "valid full file: model#effort splits into model and effort");
    check(config.implement.model === "acme/implement" && config.implement.effort === null, "valid full file: a value without #effort carries no effort");
    check(coordinator !== null && coordinator.model === "acme/coordinator" && coordinator.effort === "medium", "valid full file: the coordinator key loads as the session assignment, not a worker role");
    check(!Object.hasOwn(config, "coordinator"), "valid full file: the coordinator is kept out of the worker config map");

    // A missing role is legal: it inherits the session model.
    const validPartial = join(scratch, "valid-partial.json");
    await writeFile(validPartial, JSON.stringify({ review: "acme/review#high" }), "utf8");
    const { config: partial, coordinator: partialCoordinator } = await loadModelConfig(validPartial);
    check(Object.keys(partial).join(",") === "review", "missing roles: a partial file loads with only the listed roles");
    check(partial.review.model === "acme/review" && partial.review.effort === "high", "missing roles: the listed role parses");
    check(partialCoordinator === null, "missing roles: no coordinator key means no session assignment");

    // A coordinator-only config is legal: every worker role inherits.
    const coordinatorOnly = join(scratch, "coordinator-only.json");
    await writeFile(coordinatorOnly, JSON.stringify({ coordinator: "acme/session#high" }), "utf8");
    const { config: coordConfig, coordinator: coordOnly } = await loadModelConfig(coordinatorOnly);
    check(Object.keys(coordConfig).length === 0, "coordinator-only: no worker roles are listed");
    check(coordOnly !== null && coordOnly.model === "acme/session" && coordOnly.effort === "high", "coordinator-only: the session assignment parses");

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

    // The breaking deep-review -> review-deep rename is rejected with a
    // targeted hint, not silently accepted.
    const retiredRole = join(scratch, "retired-role.json");
    await writeFile(retiredRole, JSON.stringify({ "deep-review": "acme/model#high" }), "utf8");
    await expectConfigError(retiredRole, "retired deep-review role", [
      /Unknown role in model config/,
      /'deep-review'/,
      /renamed to 'review-deep'/,
    ]);

    const badEffort = join(scratch, "bad-effort.json");
    await writeFile(badEffort, JSON.stringify({ review: "acme/model#extreme" }), "utf8");
    await expectConfigError(badEffort, "invalid effort suffix", [
      /Model for role 'review' has an invalid reasoning effort 'extreme'/,
      /'acme\/model#extreme'/,
    ]);

    const badCoordinator = join(scratch, "bad-coordinator.json");
    await writeFile(badCoordinator, JSON.stringify({ coordinator: "acme/model#extreme" }), "utf8");
    await expectConfigError(badCoordinator, "invalid coordinator effort", [
      /Model for role 'coordinator' has an invalid reasoning effort 'extreme'/,
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
      ["coordinator newline injection", "coordinator", "provider/model\nmode: primary"],
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
    // The example preset carries the exact coordinator + nine-worker inventory.
    const { config: exampleConfig, coordinator: exampleCoordinator } = await loadModelConfig("example");
    check(Object.keys(exampleConfig).sort().join(",") === ALL_ROLES.sort().join(","), "preset: the example preset lists all nine worker roles");
    check(exampleCoordinator !== null && `${exampleCoordinator.model}#${exampleCoordinator.effort}` === EXAMPLE_ASSIGNMENTS.coordinator, "preset: the example preset assigns the exact coordinator model");
    for (const role of ALL_ROLES) {
      check(`${exampleConfig[role].model}#${exampleConfig[role].effort}` === EXAMPLE_ASSIGNMENTS[role], `preset: the example preset assigns the exact ${role} model`);
    }
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
    check(JSON.stringify(state.profiles.map((p) => p.name).sort()) === JSON.stringify(BASE_ROLES.sort()), "default build: build state records the seven base profiles");
    check(state.coordinator === null, "default build: build state records no coordinator");

    const agentsRel = await listRelative(join(fixture.openCodeRoot, "agents", "agenticale"));
    check(JSON.stringify(agentsRel) === JSON.stringify(BASE_ROLES.map((role) => `${role}.md`).sort()), "default build: exactly the seven base profiles render (no optional workers, no coordinator)");

    for (const role of BASE_ROLES) {
      const text = await readText(join(fixture.openCodeRoot, "agents", "agenticale", `${role}.md`));
      check(text.includes(`model: ${defaultModels[role]}`), `default build: ${role} profile renders the flat config model line ${defaultModels[role]}`);
      check(!/^reasoningEffort:/m.test(text), `default build: ${role} profile has no separate reasoningEffort line`);
      check((text.match(/^model:/gm) ?? []).length === 1, `default build: ${role} profile renders exactly one model line`);
    }

    // Without a configured coordinator the commands stay caller-session
    // launchers: description-only frontmatter, exact skill load, $ARGUMENTS.
    for (const name of ["work", "review", "autonomous"]) {
      const text = await readText(join(fixture.openCodeRoot, "commands", `${name}.md`));
      check(!/^agent:/m.test(text) && !/^subagent:/m.test(text), `default build: ${name} command has no agent/subagent binding`);
      check(text.includes(`\`${name}\``) && text.includes("$ARGUMENTS"), `default build: ${name} command keeps the exact skill load and $ARGUMENTS`);
    }

    // Fragment splicing: the authored fragment is the final top-level section
    // of the plugin and standalone work/review/autonomous SKILL.md copies only,
    // verbatim, and carries the preference-format content contract.
    const title = "## Model configuration (this installation)";
    const fragmentSource = await readText(join(repository, "adapters", "plugin", "model-configuration.md"));
    checkFragmentContent("authored fragment", fragmentSource);
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
      check(text.endsWith(`${fragmentSource.trimEnd()}\n`), `fragment: ${label} splices the authored fragment verbatim`);
      checkFragmentContent(label, text);
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
    // The exact example preset: one visible primary coordinator plus nine
    // worker profiles, each carrying its exact provider/model#variant line.
    const example = buildFixture("build-example", ["--models", "example"]);
    const state = JSON.parse(await readText(example.buildState));
    check(state.modelsSource === "--models example", "example build: build state modelsSource records the preset");
    check(JSON.stringify(state.profiles.map((p) => p.name).sort()) === JSON.stringify(ALL_ROLES.sort()), "example build: build state records all nine worker profiles");
    check(state.coordinator !== null && state.coordinator.name === "coordinator" && state.coordinator.model === EXAMPLE_ASSIGNMENTS.coordinator, "example build: build state records the coordinator assignment");

    const agentsRel = await listRelative(join(example.openCodeRoot, "agents", "agenticale"));
    check(JSON.stringify(agentsRel) === JSON.stringify([...ALL_ROLES, "coordinator"].map((role) => `${role}.md`).sort()), "example build: exactly ten profiles render (1 primary + 9 workers)");

    for (const role of ALL_ROLES) {
      const text = await readText(join(example.openCodeRoot, "agents", "agenticale", `${role}.md`));
      check(text.includes(`model: ${EXAMPLE_ASSIGNMENTS[role]}`), `example build: ${role} renders the exact model line ${EXAMPLE_ASSIGNMENTS[role]}`);
      check(text.includes("mode: subagent"), `example build: ${role} is a subagent`);
      check(!/^reasoningEffort:/m.test(text), `example build: ${role} has no separate reasoningEffort line`);
    }

    const coordinator = await readText(join(example.openCodeRoot, "agents", "agenticale", "coordinator.md"));
    check(coordinator.includes(`model: ${EXAMPLE_ASSIGNMENTS.coordinator}`), "example build: the coordinator renders its exact model line");
    check(coordinator.includes("mode: primary"), "example build: the coordinator is a visible primary agent");
    check(!/^hidden:/m.test(coordinator), "example build: the coordinator is not hidden");
    check(!/^steps:/m.test(coordinator), "example build: the coordinator carries no step ceiling");
    check(!/- action: subagent/.test(coordinator), "example build: the coordinator keeps the normal ability to dispatch children");
    const coordinatorBody = (await readText(join(repository, "adapters", "opencode", "coordinator.md"))).replace(/\r\n?/g, "\n");
    check(stripFrontmatter(coordinator).trim() === coordinatorBody.trim(), "example build: the coordinator body is verbatim the adapter-owned coordinator body");

    // Optional workers reuse their base contract bodies verbatim.
    const implementContract = (await readText(join(repository, "skills", "work", "references", "tasks", "implement.md"))).replace(/\r\n?/g, "\n");
    const consultContract = (await readText(join(repository, "skills", "work", "references", "tasks", "consult.md"))).replace(/\r\n?/g, "\n");
    const reviewDeepContract = (await readText(join(repository, "skills", "work", "references", "tasks", "review-deep.md"))).replace(/\r\n?/g, "\n");
    for (const role of ["implement", "implement-easy", "implement-hard"]) {
      const text = await readText(join(example.openCodeRoot, "agents", "agenticale", `${role}.md`));
      check(stripFrontmatter(text).trim() === implementContract.trim(), `example build: ${role} body is verbatim the implement contract`);
    }
    for (const role of ["consult", "consult-hard"]) {
      const text = await readText(join(example.openCodeRoot, "agents", "agenticale", `${role}.md`));
      check(stripFrontmatter(text).trim() === consultContract.trim(), `example build: ${role} body is verbatim the consult contract`);
    }
    const reviewDeep = await readText(join(example.openCodeRoot, "agents", "agenticale", "review-deep.md"));
    check(stripFrontmatter(reviewDeep).trim() === reviewDeepContract.trim(), "example build: review-deep body is verbatim the renamed review-deep contract");

    // With a configured coordinator every command binds it in the current
    // session while keeping the exact skill load and $ARGUMENTS.
    for (const name of ["work", "review", "autonomous"]) {
      const text = await readText(join(example.openCodeRoot, "commands", `${name}.md`));
      check(/^agent: agenticale\/coordinator$/m.test(text), `example build: ${name} command binds agent: agenticale/coordinator`);
      check(/^subagent: false$/m.test(text), `example build: ${name} command forces the current session (subagent: false)`);
      check(text.includes(`\`${name}\``) && text.includes("$ARGUMENTS"), `example build: ${name} command keeps the exact skill load and $ARGUMENTS`);
      const template = (await readText(join(repository, "adapters", "opencode", "commands", `${name}.md`))).replace(/\r\n?/g, "\n");
      check(stripFrontmatter(text) === stripFrontmatter(template), `example build: ${name} command body is byte-identical to the template body`);
    }
  }
  {
    // --no-model: every role inherits; no profile carries a model line and
    // no coordinator is generated; the commands stay caller-session launchers.
    const noModel = buildFixture("build-nomodel", ["--no-model"]);
    const state = JSON.parse(await readText(noModel.buildState));
    check(state.modelsSource === "none (--no-model)", "--no-model build: build state modelsSource is 'none (--no-model)'");
    check(state.noModel === true, "--no-model build: build state noModel is true");
    check(state.profiles.every((p) => p.mode === "inherit" && p.model === undefined), "--no-model build: build state profiles all inherit");
    check(state.coordinator === null, "--no-model build: build state records no coordinator");
    const agentsRel = await listRelative(join(noModel.openCodeRoot, "agents", "agenticale"));
    check(JSON.stringify(agentsRel) === JSON.stringify(BASE_ROLES.map((role) => `${role}.md`).sort()), "--no-model build: exactly the seven base profiles render");
    for (const role of BASE_ROLES) {
      const text = await readText(join(noModel.openCodeRoot, "agents", "agenticale", `${role}.md`));
      check(!/^model:/m.test(text) && !/^reasoningEffort:/m.test(text), `--no-model build: ${role} profile has no model/effort lines`);
    }
    for (const name of ["work", "review", "autonomous"]) {
      const text = await readText(join(noModel.openCodeRoot, "commands", `${name}.md`));
      check(!/^agent:/m.test(text) && !/^subagent:/m.test(text), `--no-model build: ${name} command has no agent/subagent binding`);
    }
  }
  {
    // --models with a preset name: the flat preset renders verbatim and the
    // build state records the caller value.
    const preset = buildFixture("build-preset", ["--models", "local"]);
    const state = JSON.parse(await readText(preset.buildState));
    check(state.modelsSource === "--models local", "preset build: build state modelsSource records the --models preset");
    const review = await readText(join(preset.openCodeRoot, "agents", "agenticale", "review.md"));
    check(review.includes("model: local-llama/qwen3.8-27b#xhigh"), "preset build: the local preset renders into the review profile as one model line");
    const reviewDeep = await readText(join(preset.openCodeRoot, "agents", "agenticale", "review-deep.md"));
    check(reviewDeep.includes("model: local-llama/qwen3.8-27b#xhigh"), "preset build: the renamed review-deep role renders from the local preset");
  }
  {
    // --models with a caller file that lists only some roles: the listed roles
    // render explicit frontmatter, the unlisted roles inherit (no model line),
    // and unlisted optional roles (and the coordinator) do not render at all.
    const partial = join(scratch, "partial-models.json");
    await writeFile(partial, JSON.stringify({ review: "acme/rev#high" }), "utf8");
    const caller = buildFixture("build-caller", ["--models", partial]);
    const state = JSON.parse(await readText(caller.buildState));
    check(state.modelsSource === `--models ${partial}`, "caller build: build state modelsSource records the --models path");
    const review = await readText(join(caller.openCodeRoot, "agents", "agenticale", "review.md"));
    check(review.includes("model: acme/rev#high"), "caller build: the listed review role renders one explicit model line");
    const consult = await readText(join(caller.openCodeRoot, "agents", "agenticale", "consult.md"));
    check(!/^model:/m.test(consult) && !/^reasoningEffort:/m.test(consult), "caller build: an unlisted role inherits (no model line)");
    const agentsRel = await listRelative(join(caller.openCodeRoot, "agents", "agenticale"));
    check(JSON.stringify(agentsRel) === JSON.stringify(BASE_ROLES.map((role) => `${role}.md`).sort()), "caller build: unlisted optional roles and the coordinator do not render");
    for (const name of ["work", "review", "autonomous"]) {
      const text = await readText(join(caller.openCodeRoot, "commands", `${name}.md`));
      check(!/^agent:/m.test(text) && !/^subagent:/m.test(text), `caller build: ${name} command stays a caller-session launcher without a coordinator`);
    }
  }
  {
    // A coordinator-only config generates the primary coordinator and binds
    // the commands while every worker profile inherits the session model.
    const coordOnly = join(scratch, "coordinator-only-build.json");
    await writeFile(coordOnly, JSON.stringify({ coordinator: "acme/session#medium" }), "utf8");
    const caller = buildFixture("build-coordinator-only", ["--models", coordOnly]);
    const state = JSON.parse(await readText(caller.buildState));
    check(state.coordinator !== null && state.coordinator.model === "acme/session#medium", "coordinator-only build: build state records the coordinator");
    check(state.profiles.every((p) => p.mode === "inherit"), "coordinator-only build: every worker profile inherits");
    const agentsRel = await listRelative(join(caller.openCodeRoot, "agents", "agenticale"));
    check(JSON.stringify(agentsRel) === JSON.stringify([...BASE_ROLES, "coordinator"].map((role) => `${role}.md`).sort()), "coordinator-only build: seven inheriting workers plus the coordinator render");
    const coordinator = await readText(join(caller.openCodeRoot, "agents", "agenticale", "coordinator.md"));
    check(coordinator.includes("model: acme/session#medium") && coordinator.includes("mode: primary"), "coordinator-only build: the coordinator renders its model and primary mode");
    for (const name of ["work", "review", "autonomous"]) {
      const text = await readText(join(caller.openCodeRoot, "commands", `${name}.md`));
      check(/^agent: agenticale\/coordinator$/m.test(text) && /^subagent: false$/m.test(text), `coordinator-only build: ${name} command binds the coordinator in the current session`);
    }
  }
  {
    // Regression: the packaged default must resolve against the repository
    // root, not the caller's CWD — a build from a different CWD with no
    // --models succeeds and renders the packaged default into all seven profiles.
    const otherCwd = join(scratch, "build-other-cwd");
    const result = spawnSync(process.execPath, [build, "--output", otherCwd], { cwd: scratchRoot, encoding: "utf8" });
    check(result.status === 0, `other-cwd build exits 0${result.status === 0 ? "" : ` (stderr: ${result.stderr.trim()})`}`);
    if (result.status !== 0) console.error(result.stdout, result.stderr);
    for (const role of BASE_ROLES) {
      const text = await readText(join(otherCwd, "opencode", "agents", "agenticale", `${role}.md`));
      check(text.includes(`model: ${defaultModels[role]}`), `other-cwd build: ${role} profile renders the packaged default (${defaultModels[role]})`);
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

  // ---------------------------------------------------------------------
  // 4. Configured-route intent evidence: the authored OpenCode binding
  //    documents the install-relative ownership-manifest lookup (omitted vs
  //    configured-but-missing vs unestablished intent), and the three
  //    workflow skills carry the narrow read permission for it. The
  //    installer tests (test-installer.mjs, section H) cover the evidence
  //    itself; these assertions pin the instruction contract.
  // ---------------------------------------------------------------------
  {
    // Normalize prose whitespace so re-wrapping a line does not break the
    // contract assertions.
    const prose = async (path) => (await readText(path)).replace(/\s+/g, " ");
    const binding = await prose(join(repository, "skills", "work", "references", "runtimes", "opencode.md"));
    check(binding.includes(".autonomous-mode-install.json"), "intent lookup: the binding names the installer ownership manifest");
    check(binding.includes("Establishing configured-route intent from install evidence"), "intent lookup: the binding carries the intent-lookup procedure section");
    check(binding.includes("the profile catalog alone cannot decide"), "intent lookup: the binding states the profile catalog alone cannot distinguish omitted from configured-deleted");
    check(binding.includes("<root>/skills/work/references/runtimes/opencode.md"), "intent lookup: the binding anchors the install root at its own installed path");
    check(binding.includes("<root>/.autonomous-mode-install.json") && binding.includes("<root>/agents/agenticale/"), "intent lookup: the manifest and profiles are install-relative to the same root");
    check(binding.includes("The effective install root"), "intent lookup: the binding documents effective-install-root selection");
    check(binding.includes(".opencode/agents/") && binding.includes("takes precedence over the global one"), "intent lookup: the binding documents project/global profile precedence");
    check(binding.includes("Never borrow a manifest from a different install root"), "intent lookup: the manifest must match the effective install root");
    check(binding.includes("agents/agenticale/implement-easy.md") && binding.includes("agents/agenticale/consult-hard.md"), "intent lookup: the binding names the optional profile entries");
    check(binding.includes("not from digest matches or current file content"), "intent lookup: intent is entry presence, not digest or content");
    check(binding.includes("Entry presence means the role is in the latest successful installed inventory"), "intent lookup: entry presence is the latest successful installed inventory, not history or a preservation guarantee");
    check(binding.includes("a present profile file cannot decide it either"), "intent lookup: a present optional profile file alone never establishes intent");
    check(binding.includes("whether its profile is missing, unreadable, or present"), "intent lookup: the lookup triggers for a needed optional assignment even when the profile is present");
    check(binding.includes("preserve-modified") && binding.includes("but drops its entry"), "intent lookup: a successful omitting reinstall preserves a modified file but drops its manifest entry");
    check(binding.includes("a deleted profile keeps its entry too"), "intent lookup: a deleted configured profile stays configured-but-missing");
    check(binding.includes("Entry absent from a valid current (schema 7) state"), "intent lookup: a valid schema-7 state without the entry establishes omission");
    check(binding.includes("even when a preserved leftover profile file still exists"), "intent lookup: omission holds even with a preserved leftover file");
    check(binding.includes("The leftover is unowned") && binding.includes("the leftover is never dispatched and never automatically assigned"), "intent lookup: the preserved leftover is unowned and never dispatches");
    check(binding.includes("generated schemas 5-6, copy/link schemas 1-4") && binding.includes("their absence there logically means omitted"), "intent lookup: legacy schema absence logically means omitted");
    check(binding.includes("Manifest absent") && binding.includes("not valid JSON") && binding.includes("ambiguous in ownership"), "intent lookup: missing, unreadable, and ambiguous evidence leave intent unestablished");
    check(binding.includes("read-only, at most once per activation"), "intent lookup: the manifest read is read-only and activation-fixed");
    check(binding.includes("The result stays fixed for the activation"), "intent lookup: the evidence result stays fixed for the activation");
    check(binding.includes("never writes the manifest or any other configuration file"), "intent lookup: the workflow never writes the manifest");
    check(binding.includes("The omission fallback applies only to the two optional routes"), "intent lookup: the omission fallback is limited to the optional routes");
    check(binding.includes("fail conservatively") && binding.includes("Do not dispatch the optional route — even when a profile file is present — and do not claim the omission fallback"), "intent lookup: unestablished intent fails conservatively without dispatching a present file or claiming the fallback");
    check(binding.includes("an explicit request for that route is never honoured by silently substituting a weaker one"), "intent lookup: an explicitly requested route is never silently substituted");
    check(binding.includes("Unrelated base roles are unaffected"), "intent lookup: unestablished intent does not block unrelated base roles");
    check(binding.includes("it is not a broad cleanup"), "intent lookup: --replace replaces only generated files, not unowned leftovers");
    check(binding.includes("no model assignments") && binding.includes("never resolve a model from it"), "intent lookup: the manifest never resolves models");

    const rounds = await prose(join(repository, "skills", "work", "references", "rounds.md"));
    check(rounds.includes("authoritative install evidence as the active binding documents"), "intent lookup: the shared routing policy defers configured intent to binding-documented install evidence");
    check(rounds.includes("not from the presence or absence of profile files alone"), "intent lookup: the shared policy forbids deciding intent from the profile catalog alone");
    check(rounds.includes("when that evidence is unavailable or ambiguous, the binding's conservative limitation handling applies"), "intent lookup: the shared policy defers unavailable/ambiguous evidence to the binding");

    for (const skill of ["work", "review", "autonomous"]) {
      const text = await prose(join(repository, "skills", skill, "SKILL.md"));
      check(text.includes("install-ownership manifest the active runtime binding documents"), `intent lookup: the ${skill} skill permits the binding-documented install-ownership manifest`);
      check(text.includes("read-only at most once at activation"), `intent lookup: the ${skill} skill's manifest read is read-only and activation-fixed`);
      check(text.includes("solely to establish whether a needed optional route was configured in the current install inventory"), `intent lookup: the ${skill} skill limits the manifest read to configured-intent evidence for a needed optional route`);
      check(text.includes("including when a leftover profile file is present"), `intent lookup: the ${skill} skill's manifest read covers present leftover profiles, not only missing ones`);
      check(text.includes("never resolves models from that manifest"), `intent lookup: the ${skill} skill forbids model resolution from the manifest`);
    }
    const review = await prose(join(repository, "skills", "review", "SKILL.md"));
    check(review.includes("only preference file the workflow reads"), "intent lookup: the review skill's preference-file exclusivity is narrowed to preference files");
    check(review.includes("never modifies the manifest"), "intent lookup: the review skill never modifies the manifest");
  }
} finally {
  await rm(scratch, { recursive: true, force: true });
}

console.log(`Model configuration tests passed: ${assertions} assertions.`);
