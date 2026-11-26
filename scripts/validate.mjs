#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { loadModelConfig } from "./model-config.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");

// The nine worker roles every route is built from; the adapter maps each one
// 1:1 to its own OpenCode profile. implement-easy and consult-hard are
// optional: their profiles render only when the model config lists them.
const routes = [
  "consult",
  "consult-hard",
  "explore",
  "fix",
  "implement",
  "implement-easy",
  "implement-hard",
  "review",
  "review-deep",
];

// The six capability-neutral task contracts authored under skills/work/references/tasks.
// implement-easy and implement-hard share the `implement` contract and
// consult-hard shares the `consult` contract, so there are no extra files.
const taskContracts = [
  "consult",
  "explore",
  "fix",
  "implement",
  "review",
  "review-deep",
];

const profileNames = ["consult", "consult-hard", "explore", "fix", "implement", "implement-easy", "implement-hard", "review", "review-deep"];
const optionalProfileNames = new Set(["consult-hard", "implement-easy"]);
const skillNames = ["work", "review", "autonomous", "pull-request-description", "source-code-lookup", "configure"];
const retiredSkillNames = ["work-mode", "autonomous-mode"];
// The four adapter-owned OpenCode command templates (thin launchers for the
// explicit-only skills; OpenCode does not interpret the skills' `slash` field).
const commandNames = ["autonomous", "configure", "review", "work"];

// OpenCode's hard host limit: skill loads and whole-file reads truncate at
// 50 KiB (51,200 bytes), cut at line boundaries. The committed plugin is
// what the host loads, so every packaged Markdown file must stay under it.
const OPENCODE_TRUNCATION_BAND_BYTES = 51_200;
// The 45 KiB authored read budget (46,080 bytes) = 10% margin under the
// 50 KiB (51,200-byte) OpenCode truncation band; the installed skill file
// additionally carries the appended preference fragment, so the budget
// keeps the installed total in band.
const SKILL_READ_BUDGET_BYTES = 45 * 1024;

// The NEW authored source-of-truth layout validate.mjs must assert exists.
const requiredPaths = [
  "skills/work/SKILL.md",
  "skills/work/agents/openai.yaml",
  "skills/work/references/rounds-examples.md",
  "skills/work/references/rounds.md",
  "skills/work/references/outcome-evaluation.md",
  "skills/work/references/runtimes/copilot.md",
  "skills/work/references/runtimes/copilot-local.md",
  "skills/work/references/runtimes/codex.md",
  "skills/work/references/runtimes/opencode.md",
  "skills/work/references/runtimes/qwen-code.md",
  "skills/work/references/runtimes/antigravity.md",
  ...taskContracts.map((name) => `skills/work/references/tasks/${name}.md`),
  "skills/work/scripts/session-stats.mjs",
  "skills/review/SKILL.md",
  "skills/review/agents/openai.yaml",
  "skills/autonomous/SKILL.md",
  "skills/autonomous/agents/openai.yaml",
  "skills/autonomous/references/anti-patterns.md",
  "skills/autonomous/references/budgets.md",
  "skills/autonomous/references/consultation.md",
  "skills/autonomous/references/dispatch.md",
  "skills/autonomous/references/gates.md",
  "skills/autonomous/references/persistence.md",
  "skills/autonomous/references/prompts.md",
  "skills/autonomous/references/recovery.md",
  "skills/autonomous/references/state-protocol.md",
  "skills/autonomous/references/steering.md",
  "skills/autonomous/references/stops.md",
  "skills/pull-request-description/SKILL.md",
  "skills/source-code-lookup/SKILL.md",
  "skills/configure/SKILL.md",
  "skills/configure/agents/openai.yaml",
  "skills/configure/references/discovery/opencode.md",
  "skills/configure/references/discovery/qwen-code.md",
  "skills/configure/references/discovery/copilot.md",
  "skills/configure/references/discovery/copilot-local.md",
  "skills/configure/references/discovery/codex.md",
  "skills/configure/references/discovery/antigravity.md",
  "examples/preferences.example.md",
  "adapters/opencode/adapter.json",
  "adapters/opencode/coordinator.md",
  "adapters/opencode/README.md",
  "adapters/opencode/commands/autonomous.md",
  "adapters/opencode/commands/configure.md",
  "adapters/opencode/commands/review.md",
  "adapters/opencode/commands/work.md",
  "adapters/opencode/models.json",
  "adapters/qwen-code/adapter.json",
  "adapters/qwen-code/coordinator.md",
  "adapters/qwen-code/models.json",
  "adapters/qwen-code/README.md",
  "adapters/plugin/model-configuration.md",
].sort();

// The RETIRED layout that must be gone from the authored source tree.
const retiredPaths = [
  "commands",
  "agents/autonomous",
  "skills/work-mode",
  "skills/autonomous-mode",
  "plugins/agenticale/com.github.copilot",
];

// The model-routing simplification retired the tiered routing layer: these
// authored paths must be gone from the source tree; their presence means a
// stale copy was restored.
const obsoleteRoutingPaths = [
  "skills/work/references/ROUTING.md",
  "skills/work/references/preferences.example.md",
  "skills/work/references/routing.json",
  "skills/work/scripts/routing.mjs",
];

const failures = [];

function portablePath(path) {
  return path.split(sep).join("/");
}

function fail(path, message, remedy) {
  failures.push(`${path}: ${message}${remedy ? `; ${remedy}` : ""}`);
}

function readText(path) {
  return readFileSync(join(repositoryRoot, path), "utf8").replace(/^\uFEFF/, "");
}

function looksLikeUnquotedColonScalar(value) {
  const trimmed = value.trim();
  if (trimmed === "") return false;
  const first = trimmed[0];
  if (first === '"' || first === "'" || first === "|" || first === ">" || first === "{" || first === "[" || first === "-") return false;
  return trimmed.includes(": ");
}

function parseFrontmatter(path, text) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  if (lines[0] !== "---") {
    fail(path, "missing opening frontmatter delimiter", "start the file with ---");
    return { fields: new Map(), permissions: [], metadata: new Map(), body: text };
  }

  const close = lines.indexOf("---", 1);
  if (close < 0) {
    fail(path, "missing closing frontmatter delimiter", "add --- before the Markdown body");
    return { fields: new Map(), permissions: [], metadata: new Map(), body: "" };
  }

  const fields = new Map();
  const permissions = [];
  const metadata = new Map();
  let currentPermission = null;
  let inPermissions = false;
  let inMetadata = false;

  for (let index = 1; index < close; index += 1) {
    const line = lines[index];
    if (line.trim() === "") continue;

    const topLevel = line.match(/^([A-Za-z][A-Za-z0-9-]*):(?:\s+(.*))?$/);
    if (topLevel) {
      const [, key, rawValue = ""] = topLevel;
      if (fields.has(key)) {
        fail(path, `duplicate frontmatter key '${key}'`, "keep exactly one value");
      }
      const value = rawValue.trim();
      if (looksLikeUnquotedColonScalar(value)) {
        fail(path, `frontmatter for '${key}' is invalid YAML (an unquoted scalar contains ": ")`, "quote the value or use a block scalar");
      }
      fields.set(key, value);
      inPermissions = key === "permissions";
      inMetadata = key === "metadata";
      currentPermission = null;
      continue;
    }

    if (inPermissions) {
      const item = line.match(/^  - action:\s+(.+)$/);
      if (item) {
        currentPermission = { action: item[1].trim() };
        permissions.push(currentPermission);
        continue;
      }
      const property = line.match(/^    (resource|effect):\s+(.+)$/);
      if (property && currentPermission) {
        currentPermission[property[1]] = property[2].trim().replace(/^(["'])(.*)\1$/, "$2");
        continue;
      }
    }

    if (inMetadata) {
      const property = line.match(/^  ([A-Za-z][A-Za-z0-9/-]*):\s+(.+)$/);
      if (property) {
        const [, key, value] = property;
        if (metadata.has(key)) fail(path, `duplicate metadata key '${key}'`, "keep exactly one value");
        metadata.set(key, value.trim());
        continue;
      }
    }

    fail(path, `unsupported or malformed frontmatter line ${index + 1}: ${line.trim()}`, "use the documented scalar fields, permission list, and metadata keys");
  }

  return { fields, permissions, metadata, body: lines.slice(close + 1).join("\n") };
}

function requireExactKeys(path, fields, expected) {
  for (const key of expected) {
    if (!fields.has(key)) fail(path, `missing required frontmatter key '${key}'`, `add ${key}: ...`);
  }
  for (const key of fields.keys()) {
    if (!expected.includes(key)) fail(path, `unsupported frontmatter key '${key}'`, "remove it or update the public skill contract intentionally");
  }
}

function requireMetadataFlags(path, metadata) {
  if (metadata.get("opencode/autoinvoke") !== "false") {
    fail(path, "metadata must set opencode/autoinvoke to false", "add opencode/autoinvoke: false");
  }
  const expectedFlags = new Set(["opencode/autoinvoke"]);
  for (const key of metadata.keys()) {
    if (!expectedFlags.has(key)) fail(path, `unexpected metadata key '${key}'`, "keep only the explicit-only invocation metadata flag");
  }
}

function validateSkillWork() {
  const path = "skills/work/SKILL.md";
  const { fields, metadata, body } = parseFrontmatter(path, readText(path));
  requireExactKeys(path, fields, ["name", "description", "version", "slash", "disable-model-invocation", "metadata"]);
  if (fields.get("name") !== "work") fail(path, "name must be 'work'", "set name: work");
  if (!fields.get("description")) fail(path, "description must not be empty", "add the skill routing description");
  if (!/^[1-9]\d*$/.test(fields.get("version") ?? "")) fail(path, "version must be a positive integer", "use version: <integer>");
  if (fields.get("slash") !== "true") fail(path, "slash must be true", "set slash: true");
  if (fields.get("disable-model-invocation") !== "true") {
    fail(path, "disable-model-invocation must be true (explicit-only)", "set disable-model-invocation: true");
  }
  requireMetadataFlags(path, metadata);
  if (!body.includes("](references/rounds.md)")) {
    fail(path, "body must link the shared round contract references/rounds.md", "link the shared round contract");
  }
  if (!body.includes("references/tasks/")) {
    fail(path, "body must reference references/tasks/", "keep the task-contract routing reference");
  }
}

function validateSkillAutonomous() {
  const path = "skills/autonomous/SKILL.md";
  const { fields, metadata, body } = parseFrontmatter(path, readText(path));
  requireExactKeys(path, fields, ["name", "description", "slash", "disable-model-invocation", "metadata"]);
  if (fields.has("version")) fail(path, "must not declare a version key", "remove the version key");
  if (fields.get("name") !== "autonomous") fail(path, "name must be 'autonomous'", "set name: autonomous");
  if (!fields.get("description")) fail(path, "description must not be empty", "add the skill routing description");
  if (fields.get("slash") !== "true") fail(path, "slash must be true", "set slash: true");
  if (fields.get("disable-model-invocation") !== "true") {
    fail(path, "disable-model-invocation must be true (explicit-only)", "set disable-model-invocation: true");
  }
  requireMetadataFlags(path, metadata);
  if (!body.includes("](../work/references/rounds.md)")) {
    fail(path, "body must link the shared round contract ../work/references/rounds.md", "link the shared round contract");
  }
  if (!body.includes("Asking the user (anti-ask gate)")) {
    fail(path, "body must keep the anti-ask gate section", "restore the Asking the user (anti-ask gate) heading");
  }
  for (const marker of [
    "STANDARD: <target>: <class>: blocking (bar: <the class's precision bar>)",
    "STANDARD: <target>: <class>: nit (residual) @R<N> (<consult-adopted|user>)",
    "CONVERGENCE: <target>: R<N> <n>fix/<n>new[<classes>]",
    "saturation R<N>|none",
    "DECLARED: <target>: R<N> <outcome>; continue-x2 used|unused; remaining:",
    "SLICE-RES: <slice> <spent>/<reserved>",
  ]) {
    if (!body.includes(marker)) {
      fail(path, `body must keep the snapshot state line marker \`${marker}\``, "restore the shared-contract snapshot state lines");
    }
  }
}

// The shared round contract is a plain reference (no frontmatter), loaded by
// both workflows: the shared mechanisms it defines must stay named sections,
// because the skills' anchor links and the published docs point at these
// exact headings.
function validateSharedRoundsContract() {
  const path = "skills/work/references/rounds.md";
  const text = readText(path);
  for (const marker of ["### Standard settlement", "### Convergence declaration", "### Grant flavours"]) {
    if (!text.includes(marker)) {
      fail(path, `body must keep the shared mechanism section '${marker}'`, "restore the section; both workflows and the docs link to its anchor");
    }
  }
}

function validateSkillReview() {
  const path = "skills/review/SKILL.md";
  const { fields, metadata, body } = parseFrontmatter(path, readText(path));
  requireExactKeys(path, fields, ["name", "description", "version", "slash", "disable-model-invocation", "metadata"]);
  if (fields.get("name") !== "review") fail(path, "name must be 'review'", "set name: review");
  if (!fields.get("description")) fail(path, "description must not be empty", "add the skill routing description");
  if (!/^[1-9]\d*$/.test(fields.get("version") ?? "")) fail(path, "version must be a positive integer", "use version: <integer>");
  if (fields.get("slash") !== "true") fail(path, "slash must be true", "set slash: true");
  if (fields.get("disable-model-invocation") !== "true") {
    fail(path, "disable-model-invocation must be true (explicit-only)", "set disable-model-invocation: true");
  }
  requireMetadataFlags(path, metadata);
  if (!body.includes("](../work/references/rounds.md)")) {
    fail(path, "body must link the shared round contract ../work/references/rounds.md", "link the shared round contract");
  }
  if (!body.includes("../work/references/tasks/")) {
    fail(path, "body must reference the shared task contracts ../work/references/tasks/", "keep the task-contract routing reference");
  }
}

function validateSkillSourceLookup() {
  const path = "skills/source-code-lookup/SKILL.md";
  const { fields, body } = parseFrontmatter(path, readText(path));
  requireExactKeys(path, fields, ["name", "description"]);
  if (fields.get("name") !== "source-code-lookup") fail(path, "skill name must match its folder", "set name: source-code-lookup");
  if (!fields.get("description")) fail(path, "description must not be empty", "describe when source lookup applies");
  if (body.split('Source root: "~/dev"').length !== 2) {
    fail(path, "skill must contain exactly one installer source-root marker", 'keep one Source root: "~/dev" line');
  }
}

function validateSkillPullRequest() {
  const path = "skills/pull-request-description/SKILL.md";
  const { fields, body } = parseFrontmatter(path, readText(path));
  requireExactKeys(path, fields, ["name", "description"]);
  if (fields.get("name") !== "pull-request-description") fail(path, "skill name must match its folder", "set name: pull-request-description");
  if (!fields.get("description")) fail(path, "description must not be empty", "describe when the skill applies");
  if (!/why/i.test(body) || !/validation/i.test(body)) {
    fail(path, "skill must cover intent and selective validation", "restore the PR narrative guidance");
  }
}

// The configure support skill is explicit-only like the workflows: the user
// invokes it (on OpenCode through the /configure command entry), never the
// model. Its starter pointer must stay exactly one authored-root link: the
// build repoints that marker at the packaged install-relative copy.
function validateSkillConfigure() {
  const path = "skills/configure/SKILL.md";
  const { fields, metadata, body } = parseFrontmatter(path, readText(path));
  requireExactKeys(path, fields, ["name", "description", "slash", "disable-model-invocation", "metadata"]);
  if (fields.get("name") !== "configure") fail(path, "name must be 'configure'", "set name: configure");
  if (!fields.get("description")) fail(path, "description must not be empty", "add the explicit-only setup description");
  if (fields.get("slash") !== "true") fail(path, "slash must be true", "set slash: true");
  if (fields.get("disable-model-invocation") !== "true") {
    fail(path, "disable-model-invocation must be true (explicit-only)", "set disable-model-invocation: true");
  }
  requireMetadataFlags(path, metadata);
  for (const host of ["opencode", "qwen-code", "copilot", "copilot-local", "codex", "antigravity"]) {
    if (!body.includes(`](references/discovery/${host}.md)`)) {
      fail(path, `body must link the ${host} discovery reference`, "keep the per-host discovery links");
    }
  }
  if (body.split("](../../examples/preferences.example.md)").length !== 2) {
    fail(path, "body must carry exactly one authored starter link", "keep one ](../../examples/preferences.example.md) marker for the build to repoint");
  }
  if (!body.includes("Write only on explicit confirmation")) {
    fail(path, "body must keep the exact-confirmation write rule", "restore the confirmation safety rule");
  }
}

// The flat model configs: the two packaged per-adapter defaults
// (adapters/opencode/models.json for the shared build default,
// adapters/qwen-code/models.json for the Qwen Code install) plus every bundled
// examples/*.json preset. Each is loaded through the shared flat-config loader
// so the exact schema the build and installers enforce is asserted here; every
// failure names the offending role and value. Missing roles are legal (they
// inherit the session model), so coverage is not required.
async function validateModelConfigs() {
  const defaultPath = "adapters/opencode/models.json";
  const qwenDefaultPath = "adapters/qwen-code/models.json";
  const examplesRoot = "examples";
  let exampleFiles = [];
  if (existsSync(join(repositoryRoot, examplesRoot)) && statSync(join(repositoryRoot, examplesRoot)).isDirectory()) {
    exampleFiles = readdirSync(join(repositoryRoot, examplesRoot)).filter((file) => file.endsWith(".json")).sort();
  }
  if (exampleFiles.length === 0) {
    fail(examplesRoot, "no bundled model config presets found", "restore the examples/*.json presets");
  }
  for (const path of [defaultPath, qwenDefaultPath, ...exampleFiles.map((file) => `${examplesRoot}/${file}`)]) {
    try {
      await loadModelConfig(join(repositoryRoot, path));
    } catch (error) {
      fail(path, `model config does not load (${error.message})`, "every role value must be a well-formed \"provider/model[#effort]\" string");
    }
  }
}

function denyActions(permissions) {
  return permissions
    .filter((permission) => permission && permission.action && permission.effect === "deny")
    .map((permission) => permission.action)
    .sort();
}

function validateAdapter() {
  const path = "adapters/opencode/adapter.json";
  let adapter;
  try {
    adapter = JSON.parse(readText(path));
  } catch (error) {
    fail(path, `adapter is not valid JSON (${error.message})`, "restore a parseable adapter");
    return;
  }
  if (adapter.runtime !== "opencode") {
    fail(path, "adapter runtime must be 'opencode'", "restore runtime: opencode");
  }
  const keyByRoute = adapter.keyByRoute;
  if (!keyByRoute || typeof keyByRoute !== "object" || Array.isArray(keyByRoute)) {
    fail(path, "adapter must include a keyByRoute map", "add the keyByRoute map");
  } else {
    if (JSON.stringify(Object.keys(keyByRoute).sort()) !== JSON.stringify([...routes].sort())) {
      fail(path, "keyByRoute must map exactly the nine worker routes", `map exactly: ${routes.join(", ")}`);
    }
    for (const route of routes) {
      if (keyByRoute[route] !== route) {
        fail(path, `keyByRoute["${route}"] must be "${route}" (each route maps 1:1 to its own profile)`, `set keyByRoute["${route}"] = "${route}"`);
      }
    }
  }
  if (!Array.isArray(adapter.profiles)) {
    fail(path, "adapter must include a profiles array", "add the profiles array");
    return;
  }
  const names = adapter.profiles.map((profile) => profile.name).sort();
  if (JSON.stringify(names) !== JSON.stringify([...profileNames].sort())) {
    fail(path, `profiles must be exactly ${profileNames.join(", ")} (the coordinator is the separate conditional entry)`, "remove any extra worker profile");
  }
  const expectedSteps = { explore: 24, implement: 64, "implement-easy": 64, "implement-hard": 64, fix: 48, review: 56, "review-deep": 72, consult: 20, "consult-hard": 20 };
  const readOnlyDeny = ["edit", "question", "subagent"];
  const standardDeny = ["question", "subagent"];
  for (const profile of adapter.profiles) {
    const profilePath = `${path}#profiles.${profile && profile.name}`;
    if (!profile || typeof profile.name !== "string" || !profileNames.includes(profile.name)) {
      fail(path, "every profile must be one of the nine worker route names", "use the documented profile names");
      continue;
    }
    const expectedKeys = ["description", "mode", "name", "outputPath", "permissions", "steps"];
    if (optionalProfileNames.has(profile.name)) expectedKeys.push("optional");
    const profileKeys = Object.keys(profile).sort();
    if (JSON.stringify(profileKeys) !== JSON.stringify(expectedKeys.sort())) {
      fail(profilePath, "profile must carry only metadata (no model/effort/body)", "remove model, reasoningEffort, and body text; keep metadata only");
    }
    if (optionalProfileNames.has(profile.name) && profile.optional !== true) {
      fail(profilePath, "optional worker profiles must declare optional: true", "add optional: true so the profile renders only when configured");
    }
    if (profile.mode !== "subagent") fail(profilePath, "profile mode must be 'subagent'", "restore mode: subagent");
    if (typeof profile.steps !== "number") {
      fail(profilePath, "profile steps must be a number", "restore a numeric steps value");
    } else if (profile.steps !== expectedSteps[profile.name]) {
      fail(profilePath, `profile steps must be ${expectedSteps[profile.name]}`, `restore steps: ${expectedSteps[profile.name]}`);
    }
    if (typeof profile.description !== "string" || profile.description.length === 0) {
      fail(profilePath, "profile description must be non-empty", "describe the profile in one line");
    }
    if (!Array.isArray(profile.permissions)) {
      fail(profilePath, "profile must have a permissions array", "add the permission list");
      continue;
    }
    for (const permission of profile.permissions) {
      if (!permission || permission.resource !== "*" || permission.effect !== "deny") {
        fail(profilePath, "every permission must deny resource '*'", "use effect: deny with resource: *");
      }
    }
    const expectedDeny = profile.name === "explore" || profile.name === "consult" || profile.name === "consult-hard" ? readOnlyDeny : standardDeny;
    if (JSON.stringify(denyActions(profile.permissions)) !== JSON.stringify(expectedDeny)) {
      fail(profilePath, `profile must deny exactly ${expectedDeny.join(", ")}`, "restore the exact deny permission set");
    }
  }
  // The conditional session coordinator: one visible primary agent, generated
  // only when the model config assigns the coordinator key. It keeps the
  // normal ability to dispatch children (no subagent denial) and carries no
  // step ceiling; its body is the adapter-owned workflow-neutral coordinator
  // file, not a worker task contract.
  const coordinator = adapter.coordinator;
  const coordinatorPath = `${path}#coordinator`;
  if (!coordinator || typeof coordinator !== "object" || Array.isArray(coordinator)) {
    fail(path, "adapter must include a coordinator entry", "add the conditional coordinator profile metadata");
  } else {
    const coordinatorKeys = Object.keys(coordinator).sort();
    if (JSON.stringify(coordinatorKeys) !== JSON.stringify(["body", "description", "mode", "name", "outputPath", "permissions"])) {
      fail(coordinatorPath, "coordinator must carry only name, outputPath, mode, description, body, and permissions", "remove model, steps, and body text; keep metadata only");
    }
    if (coordinator.name !== "coordinator") fail(coordinatorPath, "coordinator name must be 'coordinator'", "set name: coordinator");
    if (coordinator.outputPath !== "agents/agenticale/coordinator.md") fail(coordinatorPath, "coordinator outputPath must be agents/agenticale/coordinator.md", "restore the coordinator output path");
    if (coordinator.mode !== "primary") fail(coordinatorPath, "coordinator mode must be 'primary'", "restore mode: primary");
    if (typeof coordinator.description !== "string" || coordinator.description.length === 0) {
      fail(coordinatorPath, "coordinator description must be non-empty", "describe the coordinator in one line");
    }
    if (coordinator.body !== "coordinator.md") fail(coordinatorPath, "coordinator body must reference the adapter-owned coordinator.md", "set body: coordinator.md");
    if (!Array.isArray(coordinator.permissions)) {
      fail(coordinatorPath, "coordinator must have a permissions array", "add the permission list (empty keeps normal abilities)");
    } else {
      for (const permission of coordinator.permissions) {
        if (!permission || permission.resource !== "*" || permission.effect !== "deny") {
          fail(coordinatorPath, "every coordinator permission must deny resource '*'", "use effect: deny with resource: *");
        }
        if (permission && permission.action === "subagent") {
          fail(coordinatorPath, "coordinator must keep the normal ability to dispatch children", "remove the subagent denial");
        }
      }
    }
  }
  if (!Array.isArray(adapter.commands)) {
    fail(path, "adapter must include a commands array", "add the commands array");
  } else {
    const commandNamesSeen = adapter.commands.map((command) => command && command.name).sort();
    if (JSON.stringify(commandNamesSeen) !== JSON.stringify([...commandNames].sort())) {
      fail(path, `commands must be exactly ${commandNames.join(", ")}`, "keep one command entry per explicit-only workflow skill");
    }
    for (const command of adapter.commands) {
      const commandPath = `${path}#commands.${command && command.name}`;
      if (!command || typeof command.name !== "string" || typeof command.source !== "string" || typeof command.outputPath !== "string") {
        fail(commandPath, "command entry must declare name, source, and outputPath strings", "use the documented command entry shape");
        continue;
      }
      if (!command.source.startsWith("commands/") || command.source.includes("..")) {
        fail(commandPath, "command source must stay under the adapter commands directory", "reference the template relative to adapters/opencode");
      }
      if (!command.outputPath.startsWith("commands/")) {
        fail(commandPath, "command output path must live under commands/", "write the entry under commands/ in the OpenCode output");
      }
      if ("bindCoordinator" in command && typeof command.bindCoordinator !== "boolean") {
        fail(commandPath, "bindCoordinator must be a boolean when present", "use bindCoordinator: false or omit it");
      }
      if (command.name === "configure" && command.bindCoordinator !== false) {
        fail(commandPath, "the configure command must stay a caller-session launcher", "set bindCoordinator: false (setup is a user conversation, not a workflow round)");
      }
    }
  }
  const adapterText = readText(path);
  if (/task contract/i.test(adapterText)) {
    fail(path, "adapter must not contain task-contract body text", "keep the adapter metadata-only; bodies come from skills/work/references/tasks");
  }
}

// The Qwen Code adapter declares the flat agents/ output layout (Qwen Code
// 0.28.6 scans only the Markdown files directly inside .qwen/agents/), the
// maxTurns ceilings in place of OpenCode steps, the permission-to-tool-name
// mapping that renders disallowedTools, the pinned codex executor binding for
// openai/-routed values, and the skill roots that get copied alongside the
// agent files. Like the OpenCode adapter it carries no model, effort, or body
// text: the flat model config chooses routing at build time.
function validateQwenCodeAdapter() {
  const path = "adapters/qwen-code/adapter.json";
  let adapter;
  try {
    adapter = JSON.parse(readText(path));
  } catch (error) {
    fail(path, `adapter is not valid JSON (${error.message})`, "restore a parseable adapter");
    return;
  }
  if (adapter.runtime !== "qwen-code") {
    fail(path, "adapter runtime must be 'qwen-code'", "restore runtime: qwen-code");
  }
  const keyByRoute = adapter.keyByRoute;
  if (!keyByRoute || typeof keyByRoute !== "object" || Array.isArray(keyByRoute)) {
    fail(path, "adapter must include a keyByRoute map", "add the keyByRoute map");
  } else {
    if (JSON.stringify(Object.keys(keyByRoute).sort()) !== JSON.stringify([...routes].sort())) {
      fail(path, "keyByRoute must map exactly the nine worker routes", `map exactly: ${routes.join(", ")}`);
    }
    for (const route of routes) {
      if (keyByRoute[route] !== route) {
        fail(path, `keyByRoute["${route}"] must be "${route}" (each route maps 1:1 to its own profile)`, `set keyByRoute["${route}"] = "${route}"`);
      }
    }
  }
  if (!Array.isArray(adapter.profiles)) {
    fail(path, "adapter must include a profiles array", "add the profiles array");
    return;
  }
  const names = adapter.profiles.map((profile) => profile.name).sort();
  if (JSON.stringify(names) !== JSON.stringify([...profileNames].sort())) {
    fail(path, `profiles must be exactly ${profileNames.join(", ")} (the coordinator is the separate conditional entry)`, "remove any extra worker profile");
  }
  const expectedMaxTurns = { explore: 24, implement: 64, "implement-easy": 64, "implement-hard": 64, fix: 48, review: 56, "review-deep": 72, consult: 20, "consult-hard": 20 };
  const readOnlyDeny = ["edit", "question", "subagent"];
  const standardDeny = ["question", "subagent"];
  for (const profile of adapter.profiles) {
    const profilePath = `${path}#profiles.${profile && profile.name}`;
    if (!profile || typeof profile.name !== "string" || !profileNames.includes(profile.name)) {
      fail(path, "every profile must be one of the nine worker route names", "use the documented profile names");
      continue;
    }
    const expectedKeys = ["description", "maxTurns", "name", "outputPath", "permissions"];
    if (optionalProfileNames.has(profile.name)) expectedKeys.push("optional");
    const profileKeys = Object.keys(profile).sort();
    if (JSON.stringify(profileKeys) !== JSON.stringify(expectedKeys.sort())) {
      fail(profilePath, "profile must carry only metadata (no model/effort/body)", "remove model, effort, and body text; keep metadata only");
    }
    if (optionalProfileNames.has(profile.name) && profile.optional !== true) {
      fail(profilePath, "optional worker profiles must declare optional: true", "add optional: true so the profile renders only when configured");
    }
    if (profile.outputPath !== `agents/agenticale-${profile.name}.md`) {
      fail(profilePath, `profile outputPath must be agents/agenticale-${profile.name}.md (flat: the host scans only the top level of .qwen/agents/)`, `restore outputPath: agents/agenticale-${profile.name}.md`);
    }
    if (typeof profile.maxTurns !== "number") {
      fail(profilePath, "profile maxTurns must be a number", "restore a numeric maxTurns value");
    } else if (profile.maxTurns !== expectedMaxTurns[profile.name]) {
      fail(profilePath, `profile maxTurns must be ${expectedMaxTurns[profile.name]}`, `restore maxTurns: ${expectedMaxTurns[profile.name]}`);
    }
    if (typeof profile.description !== "string" || profile.description.length === 0) {
      fail(profilePath, "profile description must be non-empty", "describe the profile in one line");
    }
    if (!Array.isArray(profile.permissions)) {
      fail(profilePath, "profile must have a permissions array", "add the permission list");
      continue;
    }
    for (const permission of profile.permissions) {
      if (!permission || permission.resource !== "*" || permission.effect !== "deny") {
        fail(profilePath, "every permission must deny resource '*'", "use effect: deny with resource: *");
      }
    }
    const expectedDeny = profile.name === "explore" || profile.name === "consult" || profile.name === "consult-hard" ? readOnlyDeny : standardDeny;
    if (JSON.stringify(denyActions(profile.permissions)) !== JSON.stringify(expectedDeny)) {
      fail(profilePath, `profile must deny exactly ${expectedDeny.join(", ")}`, "restore the exact deny permission set");
    }
  }
  // The conditional session coordinator: rendered only when the model config
  // assigns the coordinator key, as a flat agent file carrying the posture
  // body. The coordinating session adopts the body per the runtime binding;
  // the assigned value must be Qwen-direct (the build skips a codex-routed
  // coordinator value with a note).
  const coordinator = adapter.coordinator;
  const coordinatorPath = `${path}#coordinator`;
  if (!coordinator || typeof coordinator !== "object" || Array.isArray(coordinator)) {
    fail(path, "adapter must include a coordinator entry", "add the conditional coordinator profile metadata");
  } else {
    const coordinatorKeys = Object.keys(coordinator).sort();
    if (JSON.stringify(coordinatorKeys) !== JSON.stringify(["body", "description", "name", "outputPath"])) {
      fail(coordinatorPath, "coordinator must carry only name, outputPath, description, and body", "remove the extra coordinator keys; keep metadata only");
    }
    if (coordinator.name !== "coordinator") fail(coordinatorPath, "coordinator name must be 'coordinator'", "set name: coordinator");
    if (coordinator.outputPath !== "agents/agenticale-coordinator.md") fail(coordinatorPath, "coordinator outputPath must be agents/agenticale-coordinator.md (flat)", "restore the coordinator output path");
    if (typeof coordinator.description !== "string" || coordinator.description.length === 0) {
      fail(coordinatorPath, "coordinator description must be non-empty", "describe the coordinator in one line");
    }
    if (coordinator.body !== "coordinator.md") fail(coordinatorPath, "coordinator body must reference the adapter-owned coordinator.md", "set body: coordinator.md");
  }
  // The codex executor binding is pinned: the build refuses to render a
  // different kind, command, or base args, so the validator holds the same
  // line (including the exact key set, so no stray key survives).
  const codex = adapter.codex;
  const codexPath = `${path}#codex`;
  if (!codex || typeof codex !== "object" || Array.isArray(codex)) {
    fail(path, "adapter must include a codex executor binding", "add the codex binding (kind, providerPrefix, command, baseArgs)");
  } else {
    if (JSON.stringify(Object.keys(codex).sort()) !== JSON.stringify(["baseArgs", "command", "kind", "providerPrefix"])) {
      fail(codexPath, "codex binding must carry exactly kind, providerPrefix, command, and baseArgs", "remove the extra keys; keep the pinned binding");
    }
    if (codex.kind !== "codex") fail(codexPath, "codex kind must be 'codex'", "restore kind: codex");
    if (codex.providerPrefix !== "openai") fail(codexPath, "codex providerPrefix must be 'openai'", "restore providerPrefix: openai");
    if (codex.command !== "codex") fail(codexPath, "codex command must be 'codex'", "restore command: codex");
    if (JSON.stringify(codex.baseArgs) !== JSON.stringify(["app-server", "--stdio"])) fail(codexPath, "codex baseArgs must be [\"app-server\", \"--stdio\"]", "restore baseArgs: [\"app-server\", \"--stdio\"]");
  }
  // permissionToolNames maps a deny action to the host tool names rendered
  // into disallowedTools; the build reads these values verbatim.
  const permissionToolNames = adapter.permissionToolNames;
  const permissionNamesPath = `${path}#permissionToolNames`;
  if (!permissionToolNames || typeof permissionToolNames !== "object" || Array.isArray(permissionToolNames)) {
    fail(path, "adapter must include a permissionToolNames map", "add the permissionToolNames map");
  } else {
    if (JSON.stringify(Object.keys(permissionToolNames).sort()) !== JSON.stringify(["edit", "question", "subagent"])) {
      fail(permissionNamesPath, "permissionToolNames must carry exactly edit, question, and subagent", "restore the three deny actions");
    }
    for (const [action, expected] of [["subagent", ["agent"]], ["edit", ["write_file", "edit", "notebook_edit"]], ["question", []]]) {
      if (JSON.stringify(permissionToolNames[action]) !== JSON.stringify(expected)) {
        fail(permissionNamesPath, `permissionToolNames.${action} must be ${JSON.stringify(expected)}`, `restore ${action}: ${JSON.stringify(expected)}`);
      }
    }
  }
  // skillDiscovery lists the skill roots copied next to the agent files; the
  // two support skills are explicitly flagged for the installer's discovery
  // notes.
  const skillDiscovery = adapter.skillDiscovery;
  const skillDiscoveryPath = `${path}#skillDiscovery`;
  if (!skillDiscovery || typeof skillDiscovery !== "object" || Array.isArray(skillDiscovery)) {
    fail(path, "adapter must include a skillDiscovery entry", "add the skillDiscovery entry");
  } else {
    if (skillDiscovery.outputSkillsRoot !== "skills") fail(skillDiscoveryPath, "skillDiscovery outputSkillsRoot must be 'skills'", "restore outputSkillsRoot: skills");
    // The build copies its own fixed six-skill list, so the declared inventory
    // must match it exactly, kind flags and all.
    const expectedSkills = [
      { name: "work", source: "skills/work" },
      { name: "autonomous", source: "skills/autonomous" },
      { name: "review", source: "skills/review" },
      { name: "configure", source: "skills/configure" },
      { name: "pull-request-description", source: "skills/pull-request-description", kind: "support" },
      { name: "source-code-lookup", source: "skills/source-code-lookup", kind: "support" },
    ];
    if (JSON.stringify(skillDiscovery.skills) !== JSON.stringify(expectedSkills)) {
      fail(skillDiscoveryPath, "skillDiscovery must list exactly the six skills the build copies (work, autonomous, review, configure, and the two support skills with kind: support)", "restore the exact six skill entries");
    }
  }
  const adapterText = readText(path);
  if (/task contract/i.test(adapterText)) {
    fail(path, "adapter must not contain task-contract body text", "keep the adapter metadata-only; bodies come from skills/work/references/tasks");
  }
}

// The adapter-owned command templates are the thin OpenCode launchers for the
// explicit-only skills: frontmatter with a description, and a body that loads
// the skill by exact ID and passes through $ARGUMENTS.
function validateCommandTemplates() {
  for (const name of commandNames) {
    const path = `adapters/opencode/commands/${name}.md`;
    if (!existsSync(join(repositoryRoot, path))) continue;
    const text = readText(path);
    const { fields, body } = parseFrontmatter(path, text);
    if (JSON.stringify([...fields.keys()].sort()) !== JSON.stringify(["description"])) {
      fail(path, "command frontmatter must carry only a description", "remove the extra frontmatter keys");
    }
    if (!fields.get("description")) {
      fail(path, "command description must not be empty", "describe the command in one line");
    }
    if (!body.includes("$ARGUMENTS")) {
      fail(path, "command body must pass through $ARGUMENTS", "add the $ARGUMENTS placeholder");
    }
    if (!body.includes(`\`${name}\``)) {
      fail(path, `command body must load the skill by exact ID \`${name}\``, "reference the exact skill ID in backticks");
    }
  }
}

function validateNeutralContracts() {
  const providerPatterns = [
    { pattern: /openai\//i, label: "openai/" },
    { pattern: /anthropic\//i, label: "anthropic/" },
    { pattern: /google\/gemini/i, label: "google/gemini" },
    { pattern: /gpt-\d/i, label: "gpt-<n>" },
    { pattern: /claude-/i, label: "claude-" },
    { pattern: /gemini-/i, label: "gemini-" },
  ];
  const tasksDir = join(repositoryRoot, "skills", "work", "references", "tasks");
  let actual = [];
  if (existsSync(tasksDir) && statSync(tasksDir).isDirectory()) {
    actual = readdirSync(tasksDir).sort();
  }
  const expectedFiles = taskContracts.map((name) => `${name}.md`).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expectedFiles)) {
    fail("skills/work/references/tasks", `task contracts must be exactly ${taskContracts.join(", ")} (no implement-hard, no coordinator)`, "implement-easy/implement-hard share the implement contract and consult-hard shares consult");
  }
  for (const name of taskContracts) {
    const path = `skills/work/references/tasks/${name}.md`;
    if (!existsSync(join(repositoryRoot, path))) {
      fail(path, "required task contract is missing", "restore the capability-neutral task contract");
      continue;
    }
    const text = readText(path);
    for (const { pattern, label } of providerPatterns) {
      if (pattern.test(text)) {
        fail(path, `capability-neutral contract must not reference provider/model '${label}'`, "use capability-neutral wording; model choices live in adapters/opencode/models.json and the installation's agent profiles");
      }
    }
  }
  // The adapter-owned coordinator body is workflow-neutral too: it fixes the
  // coordinator stance without naming providers, models, or a specific
  // workflow's rules.
  const coordinatorBody = "adapters/opencode/coordinator.md";
  if (existsSync(join(repositoryRoot, coordinatorBody))) {
    const text = readText(coordinatorBody);
    for (const { pattern, label } of providerPatterns) {
      if (pattern.test(text)) {
        fail(coordinatorBody, `workflow-neutral coordinator body must not reference provider/model '${label}'`, "use capability-neutral wording; model choices live in the flat model config");
      }
    }
  }
}

// The OpenAI-hosted-agent policy file for each invocation skill must opt out of
// implicit model invocation (plan: the skills are invoked by the user, not auto-run).
function validateOpenaiPolicy(path) {
  const text = readText(path).replace(/\r\n?/g, "\n");
  const policy = text.match(/^policy:\s*\n(?:[ \t]+.*\n?)*?([ \t]+allow_implicit_invocation:\s*(true|false))/m);
  if (!policy) {
    fail(path, "missing policy.allow_implicit_invocation", "add policy: { allow_implicit_invocation: false }");
    return;
  }
  if (policy[2] !== "false") {
    fail(path, "policy.allow_implicit_invocation must be false", "set policy.allow_implicit_invocation: false");
  }
}

function validateBundleSurface() {
  for (const path of requiredPaths) {
    if (!existsSync(join(repositoryRoot, path))) {
      fail(path, "required source-of-truth file is missing", "restore it from the skills-first layout");
    }
  }
  for (const policy of ["skills/work/agents/openai.yaml", "skills/review/agents/openai.yaml", "skills/autonomous/agents/openai.yaml", "skills/configure/agents/openai.yaml"]) {
    if (existsSync(join(repositoryRoot, policy))) validateOpenaiPolicy(policy);
  }
  for (const path of retiredPaths) {
    if (existsSync(join(repositoryRoot, path))) {
      fail(path, "retired layout path is still present", "remove the retired authored source");
    }
  }
  for (const path of obsoleteRoutingPaths) {
    if (existsSync(join(repositoryRoot, path))) {
      fail(path, "obsolete model-routing path is still present (removed with the model-routing simplification)", "do not restore the tiered routing layer; model configuration is flat");
    }
  }
  if (existsSync(join(repositoryRoot, "commands")) && statSync(join(repositoryRoot, "commands")).isDirectory()) {
    for (const file of readdirSync(join(repositoryRoot, "commands"))) {
      if (file.endsWith(".md")) fail(`commands/${file}`, "retired command file is still present", "remove commands/*.md");
    }
  }

  // Positive check on the committed shared package: it should contain plugin.json
  // and the six skills, and none of the retired paths.
  const packageRoot = "plugins/agenticale";
  if (existsSync(join(repositoryRoot, packageRoot))) {
    if (!existsSync(join(repositoryRoot, packageRoot, "plugin.json"))) {
      fail(`${packageRoot}/plugin.json`, "committed package is missing plugin.json", "restore the Agent Plugins manifest");
    }
    for (const name of skillNames) {
      if (!existsSync(join(repositoryRoot, packageRoot, "skills", name, "SKILL.md"))) {
        fail(`${packageRoot}/skills/${name}/SKILL.md`, "committed package is missing a public skill", "restore the generated skill");
      }
    }
    for (const name of ["work", "review", "autonomous"]) {
      const generated = join(packageRoot, "skills", name, "SKILL.md");
      if (!existsSync(join(repositoryRoot, generated))) continue;
      const { fields } = parseFrontmatter(generated, readText(generated));
      for (const [key, value] of fields) {
        if (looksLikeUnquotedColonScalar(value)) {
          fail(generated, `generated frontmatter for '${key}' is invalid YAML (an unquoted scalar contains ": ")`, "quote the value in the authored source");
        }
      }
    }
    for (const name of retiredSkillNames) {
      if (existsSync(join(repositoryRoot, packageRoot, "skills", name))) {
        fail(`${packageRoot}/skills/${name}`, "committed package must not ship a retired skill", "remove the retired skill from the package");
      }
    }
    if (existsSync(join(repositoryRoot, packageRoot, "com.github.copilot"))) {
      fail(`${packageRoot}/com.github.copilot`, "committed package must not ship a per-role Copilot directory", "remove the retired Copilot catalog");
    }

    // The packaged resources: the session stats helper and the configure
    // preferences starter (model configuration is no longer a packaged file;
    // it is rendered into the agent profiles at build/install time).
    for (const extra of [
      "skills/work/scripts/session-stats.mjs",
      "skills/configure/references/preferences.example.md",
    ]) {
      if (!existsSync(join(repositoryRoot, packageRoot, extra))) {
        fail(`${packageRoot}/${extra}`, "committed package is missing a packaged resource", "regenerate the plugin with node scripts/publish-default-plugin.mjs");
      }
    }
    const obsoleteSnapshot = `${packageRoot}/skills/work/references/resolved-routing.json`;
    if (existsSync(join(repositoryRoot, obsoleteSnapshot))) {
      fail(obsoleteSnapshot, "committed package still carries the redundant resolved routing snapshot", "regenerate the plugin without resolved-routing.json");
    }
    // Obsolete model-routing artifacts: the tiered routing layer was removed
    // with the model configuration simplification, so the package must not
    // carry any of its files. The retired starter location stays banned; the
    // current starter ships only under skills/configure/references/.
    for (const obsolete of [
      "skills/work/references/routing.json",
      "skills/work/scripts/routing.mjs",
      "skills/work/references/preferences.example.md",
    ]) {
      if (existsSync(join(repositoryRoot, packageRoot, obsolete))) {
        fail(`${packageRoot}/${obsolete}`, "committed package still carries an obsolete routing artifact", "regenerate the plugin with node scripts/publish-default-plugin.mjs");
      }
    }
    for (const name of skillNames) {
      const skillRoutingPath = `${packageRoot}/skills/${name}/references/routing.json`;
      if (existsSync(join(repositoryRoot, skillRoutingPath))) {
        fail(skillRoutingPath, "installed skill must not carry references/routing.json", "regenerate the plugin with node scripts/publish-default-plugin.mjs");
      }
    }
    // Check C — the committed plugin is what OpenCode installs and loads:
    // every packaged Markdown file must stay under the host truncation band.
    for (const absolute of walkFiles(join(repositoryRoot, packageRoot)).filter((file) => file.endsWith(".md"))) {
      const path = portablePath(relative(repositoryRoot, absolute));
      const size = statSync(absolute).size;
      if (size >= OPENCODE_TRUNCATION_BAND_BYTES) {
        fail(path, `committed plugin file at or above the 50 KiB host truncation band: ${size} bytes (band ${OPENCODE_TRUNCATION_BAND_BYTES} bytes)`, "regenerate the plugin with node scripts/publish-default-plugin.mjs so the installed file stays under the band");
      }
      pluginBandCount += 1;
    }
  }

  const obsoleteHelper = ["bin", `git-credential-${"git" + "ea"}`].join("/");
  if (existsSync(join(repositoryRoot, obsoleteHelper))) {
    fail(obsoleteHelper, "obsolete private credential helper is present", "remove it from the public source tree");
  }
}

function walkFiles(directory) {
  if (!existsSync(directory)) return [];
  const results = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const absolute = join(directory, entry.name);
    const repositoryPath = portablePath(relative(repositoryRoot, absolute));
    if (entry.isDirectory() && ["docs/.vitepress/dist", "docs/.vitepress/cache"].includes(repositoryPath)) continue;
    if (entry.isDirectory()) results.push(...walkFiles(absolute));
    else if (entry.isFile()) results.push(absolute);
  }
  return results;
}

// --- Host read-band checks --------------------------------------------------
//
// OpenCode truncates skill loads and whole-file reads at 50 KiB
// (51,200 bytes), cut at line boundaries. The committed plugin is what the
// host installs and loads, so the authored source keeps a 45 KiB read
// budget: 10% margin under the band, which also leaves room for the
// appended plugin preference fragment in the installed skill file.

// github-slugger 2.0.0 strip set, vendored verbatim. Upstream copyright and
// license (ISC), retained per the ISC terms:
//
//   Copyright (c) 2015, Dan Flettre <fletd01@yahoo.com>
//
//   Permission to use, copy, modify, and/or distribute this software for any
//   purpose with or without fee is hereby granted, provided that the above
//   copyright notice and this permission notice appear in all copies.
//
//   THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
//   WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
//   MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
//   ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
//   WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
//   ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
//   OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
//
// Do not approximate the set — it covers non-ASCII punctuation such as
// ≤ (U+2264), which the package matches through its \u2189-\u24B5 range.
// GitHub anchors: lowercase the heading, strip that set, replace each ASCII
// space (0x20) with a hyphen; repeated headings in one file get -1, -2, ...
// (the first keeps the bare slug, and every already-assigned id is reserved
// by the collision loop, mirroring the package).
export const GITHUB_SLUGGER_STRIP = /[\0-\x1F!-,\.\/:-@\[-\^`\{-\xA9\xAB-\xB4\xB6-\xB9\xBB-\xBF\xD7\xF7\u02C2-\u02C5\u02D2-\u02DF\u02E5-\u02EB\u02ED\u02EF-\u02FF\u0375\u0378\u0379\u037E\u0380-\u0385\u0387\u038B\u038D\u03A2\u03F6\u0482\u0530\u0557\u0558\u055A-\u055F\u0589-\u0590\u05BE\u05C0\u05C3\u05C6\u05C8-\u05CF\u05EB-\u05EE\u05F3-\u060F\u061B-\u061F\u066A-\u066D\u06D4\u06DD\u06DE\u06E9\u06FD\u06FE\u0700-\u070F\u074B\u074C\u07B2-\u07BF\u07F6-\u07F9\u07FB\u07FC\u07FE\u07FF\u082E-\u083F\u085C-\u085F\u086B-\u089F\u08B5\u08C8-\u08D2\u08E2\u0964\u0965\u0970\u0984\u098D\u098E\u0991\u0992\u09A9\u09B1\u09B3-\u09B5\u09BA\u09BB\u09C5\u09C6\u09C9\u09CA\u09CF-\u09D6\u09D8-\u09DB\u09DE\u09E4\u09E5\u09F2-\u09FB\u09FD\u09FF\u0A00\u0A04\u0A0B-\u0A0E\u0A11\u0A12\u0A29\u0A31\u0A34\u0A37\u0A3A\u0A3B\u0A3D\u0A43-\u0A46\u0A49\u0A4A\u0A4E-\u0A50\u0A52-\u0A58\u0A5D\u0A5F-\u0A65\u0A76-\u0A80\u0A84\u0A8E\u0A92\u0AA9\u0AB1\u0AB4\u0ABA\u0ABB\u0AC6\u0ACA\u0ACE\u0ACF\u0AD1-\u0ADF\u0AE4\u0AE5\u0AF0-\u0AF8\u0B00\u0B04\u0B0D\u0B0E\u0B11\u0B12\u0B29\u0B31\u0B34\u0B3A\u0B3B\u0B45\u0B46\u0B49\u0B4A\u0B4E-\u0B54\u0B58-\u0B5B\u0B5E\u0B64\u0B65\u0B70\u0B72-\u0B81\u0B84\u0B8B-\u0B8D\u0B91\u0B96-\u0B98\u0B9B\u0B9D\u0BA0-\u0BA2\u0BA5-\u0BA7\u0BAB-\u0BAD\u0BBA-\u0BBD\u0BC3-\u0BC5\u0BC9\u0BCE\u0BCF\u0BD1-\u0BD6\u0BD8-\u0BE5\u0BF0-\u0BFF\u0C0D\u0C11\u0C29\u0C3A-\u0C3C\u0C45\u0C49\u0C4E-\u0C54\u0C57\u0C5B-\u0C5F\u0C64\u0C65\u0C70-\u0C7F\u0C84\u0C8D\u0C91\u0CA9\u0CB4\u0CBA\u0CBB\u0CC5\u0CC9\u0CCE-\u0CD4\u0CD7-\u0CDD\u0CDF\u0CE4\u0CE5\u0CF0\u0CF3-\u0CFF\u0D0D\u0D11\u0D45\u0D49\u0D4F-\u0D53\u0D58-\u0D5E\u0D64\u0D65\u0D70-\u0D79\u0D80\u0D84\u0D97-\u0D99\u0DB2\u0DBC\u0DBE\u0DBF\u0DC7-\u0DC9\u0DCB-\u0DCE\u0DD5\u0DD7\u0DE0-\u0DE5\u0DF0\u0DF1\u0DF4-\u0E00\u0E3B-\u0E3F\u0E4F\u0E5A-\u0E80\u0E83\u0E85\u0E8B\u0EA4\u0EA6\u0EBE\u0EBF\u0EC5\u0EC7\u0ECE\u0ECF\u0EDA\u0EDB\u0EE0-\u0EFF\u0F01-\u0F17\u0F1A-\u0F1F\u0F2A-\u0F34\u0F36\u0F38\u0F3A-\u0F3D\u0F48\u0F6D-\u0F70\u0F85\u0F98\u0FBD-\u0FC5\u0FC7-\u0FFF\u104A-\u104F\u109E\u109F\u10C6\u10C8-\u10CC\u10CE\u10CF\u10FB\u1249\u124E\u124F\u1257\u1259\u125E\u125F\u1289\u128E\u128F\u12B1\u12B6\u12B7\u12BF\u12C1\u12C6\u12C7\u12D7\u1311\u1316\u1317\u135B\u135C\u1360-\u137F\u1390-\u139F\u13F6\u13F7\u13FE-\u1400\u166D\u166E\u1680\u169B-\u169F\u16EB-\u16ED\u16F9-\u16FF\u170D\u1715-\u171F\u1735-\u173F\u1754-\u175F\u176D\u1771\u1774-\u177F\u17D4-\u17D6\u17D8-\u17DB\u17DE\u17DF\u17EA-\u180A\u180E\u180F\u181A-\u181F\u1879-\u187F\u18AB-\u18AF\u18F6-\u18FF\u191F\u192C-\u192F\u193C-\u1945\u196E\u196F\u1975-\u197F\u19AC-\u19AF\u19CA-\u19CF\u19DA-\u19FF\u1A1C-\u1A1F\u1A5F\u1A7D\u1A7E\u1A8A-\u1A8F\u1A9A-\u1AA6\u1AA8-\u1AAF\u1AC1-\u1AFF\u1B4C-\u1B4F\u1B5A-\u1B6A\u1B74-\u1B7F\u1BF4-\u1BFF\u1C38-\u1C3F\u1C4A-\u1C4C\u1C7E\u1C7F\u1C89-\u1C8F\u1CBB\u1CBC\u1CC0-\u1CCF\u1CD3\u1CFB-\u1CFF\u1DFA\u1F16\u1F17\u1F1E\u1F1F\u1F46\u1F47\u1F4E\u1F4F\u1F58\u1F5A\u1F5C\u1F5E\u1F7E\u1F7F\u1FB5\u1FBD\u1FBF-\u1FC1\u1FC5\u1FCD-\u1FCF\u1FD4\u1FD5\u1FDC-\u1FDF\u1FED-\u1FF1\u1FF5\u1FFD-\u203E\u2041-\u2053\u2055-\u2070\u2072-\u207E\u2080-\u208F\u209D-\u20CF\u20F1-\u2101\u2103-\u2106\u2108\u2109\u2114\u2116-\u2118\u211E-\u2123\u2125\u2127\u2129\u212E\u213A\u213B\u2140-\u2144\u214A-\u214D\u214F-\u215F\u2189-\u24B5\u24EA-\u2BFF\u2C2F\u2C5F\u2CE5-\u2CEA\u2CF4-\u2CFF\u2D26\u2D28-\u2D2C\u2D2E\u2D2F\u2D68-\u2D6E\u2D70-\u2D7E\u2D97-\u2D9F\u2DA7\u2DAF\u2DB7\u2DBF\u2DC7\u2DCF\u2DD7\u2DDF\u2E00-\u2E2E\u2E30-\u3004\u3008-\u3020\u3030\u3036\u3037\u303D-\u3040\u3097\u3098\u309B\u309C\u30A0\u30FB\u3100-\u3104\u3130\u318F-\u319F\u31C0-\u31EF\u3200-\u33FF\u4DC0-\u4DFF\u9FFD-\u9FFF\uA48D-\uA4CF\uA4FE\uA4FF\uA60D-\uA60F\uA62C-\uA63F\uA673\uA67E\uA6F2-\uA716\uA720\uA721\uA789\uA78A\uA7C0\uA7C1\uA7CB-\uA7F4\uA828-\uA82B\uA82D-\uA83F\uA874-\uA87F\uA8C6-\uA8CF\uA8DA-\uA8DF\uA8F8-\uA8FA\uA8FC\uA92E\uA92F\uA954-\uA95F\uA97D-\uA97F\uA9C1-\uA9CE\uA9DA-\uA9DF\uA9FF\uAA37-\uAA3F\uAA4E\uAA4F\uAA5A-\uAA5F\uAA77-\uAA79\uAAC3-\uAADA\uAADE\uAADF\uAAF0\uAAF1\uAAF7-\uAB00\uAB07\uAB08\uAB0F\uAB10\uAB17-\uAB1F\uAB27\uAB2F\uAB5B\uAB6A-\uAB6F\uABEB\uABEE\uABEF\uABFA-\uABFF\uD7A4-\uD7AF\uD7C7-\uD7CA\uD7FC-\uD7FF\uE000-\uF8FF\uFA6E\uFA6F\uFADA-\uFAFF\uFB07-\uFB12\uFB18-\uFB1C\uFB29\uFB37\uFB3D\uFB3F\uFB42\uFB45\uFBB2-\uFBD2\uFD3E-\uFD4F\uFD90\uFD91\uFDC8-\uFDEF\uFDFC-\uFDFF\uFE10-\uFE1F\uFE30-\uFE32\uFE35-\uFE4C\uFE50-\uFE6F\uFE75\uFEFD-\uFF0F\uFF1A-\uFF20\uFF3B-\uFF3E\uFF40\uFF5B-\uFF65\uFFBF-\uFFC1\uFFC8\uFFC9\uFFD0\uFFD1\uFFD8\uFFD9\uFFDD-\uFFFF]|\uD800[\uDC0C\uDC27\uDC3B\uDC3E\uDC4E\uDC4F\uDC5E-\uDC7F\uDCFB-\uDD3F\uDD75-\uDDFC\uDDFE-\uDE7F\uDE9D-\uDE9F\uDED1-\uDEDF\uDEE1-\uDEFF\uDF20-\uDF2C\uDF4B-\uDF4F\uDF7B-\uDF7F\uDF9E\uDF9F\uDFC4-\uDFC7\uDFD0\uDFD6-\uDFFF]|\uD801[\uDC9E\uDC9F\uDCAA-\uDCAF\uDCD4-\uDCD7\uDCFC-\uDCFF\uDD28-\uDD2F\uDD64-\uDDFF\uDF37-\uDF3F\uDF56-\uDF5F\uDF68-\uDFFF]|\uD802[\uDC06\uDC07\uDC09\uDC36\uDC39-\uDC3B\uDC3D\uDC3E\uDC56-\uDC5F\uDC77-\uDC7F\uDC9F-\uDCDF\uDCF3\uDCF6-\uDCFF\uDD16-\uDD1F\uDD3A-\uDD7F\uDDB8-\uDDBD\uDDC0-\uDDFF\uDE04\uDE07-\uDE0B\uDE14\uDE18\uDE36\uDE37\uDE3B-\uDE3E\uDE40-\uDE5F\uDE7D-\uDE7F\uDE9D-\uDEBF\uDEC8\uDEE7-\uDEFF\uDF36-\uDF3F\uDF56-\uDF5F\uDF73-\uDF7F\uDF92-\uDFFF]|\uD803[\uDC49-\uDC7F\uDCB3-\uDCBF\uDCF3-\uDCFF\uDD28-\uDD2F\uDD3A-\uDE7F\uDEAA\uDEAD-\uDEAF\uDEB2-\uDEFF\uDF1D-\uDF26\uDF28-\uDF2F\uDF51-\uDFAF\uDFC5-\uDFDF\uDFF7-\uDFFF]|\uD804[\uDC47-\uDC65\uDC70-\uDC7E\uDCBB-\uDCCF\uDCE9-\uDCEF\uDCFA-\uDCFF\uDD35\uDD40-\uDD43\uDD48-\uDD4F\uDD74\uDD75\uDD77-\uDD7F\uDDC5-\uDDC8\uDDCD\uDDDB\uDDDD-\uDDFF\uDE12\uDE38-\uDE3D\uDE3F-\uDE7F\uDE87\uDE89\uDE8E\uDE9E\uDEA9-\uDEAF\uDEEB-\uDEEF\uDEFA-\uDEFF\uDF04\uDF0D\uDF0E\uDF11\uDF12\uDF29\uDF31\uDF34\uDF3A\uDF45\uDF46\uDF49\uDF4A\uDF4E\uDF4F\uDF51-\uDF56\uDF58-\uDF5C\uDF64\uDF65\uDF6D-\uDF6F\uDF75-\uDFFF]|\uD805[\uDC4B-\uDC4F\uDC5A-\uDC5D\uDC62-\uDC7F\uDCC6\uDCC8-\uDCCF\uDCDA-\uDD7F\uDDB6\uDDB7\uDDC1-\uDDD7\uDDDE-\uDDFF\uDE41-\uDE43\uDE45-\uDE4F\uDE5A-\uDE7F\uDEB9-\uDEBF\uDECA-\uDEFF\uDF1B\uDF1C\uDF2C-\uDF2F\uDF3A-\uDFFF]|\uD806[\uDC3B-\uDC9F\uDCEA-\uDCFE\uDD07\uDD08\uDD0A\uDD0B\uDD14\uDD17\uDD36\uDD39\uDD3A\uDD44-\uDD4F\uDD5A-\uDD9F\uDDA8\uDDA9\uDDD8\uDDD9\uDDE2\uDDE5-\uDDFF\uDE3F-\uDE46\uDE48-\uDE4F\uDE9A-\uDE9C\uDE9E-\uDEBF\uDEF9-\uDFFF]|\uD807[\uDC09\uDC37\uDC41-\uDC4F\uDC5A-\uDC71\uDC90\uDC91\uDCA8\uDCB7-\uDCFF\uDD07\uDD0A\uDD37-\uDD39\uDD3B\uDD3E\uDD48-\uDD4F\uDD5A-\uDD5F\uDD66\uDD69\uDD8F\uDD92\uDD99-\uDD9F\uDDAA-\uDEDF\uDEF7-\uDFAF\uDFB1-\uDFFF]|\uD808[\uDF9A-\uDFFF]|\uD809[\uDC6F-\uDC7F\uDD44-\uDFFF]|[\uD80A\uD80B\uD80E-\uD810\uD812-\uD819\uD824-\uD82B\uD82D\uD82E\uD830-\uD833\uD837\uD839\uD83D\uD83F\uD87B-\uD87D\uD87F\uD885-\uDB3F\uDB41-\uDBFF][\uDC00-\uDFFF]|\uD80D[\uDC2F-\uDFFF]|\uD811[\uDE47-\uDFFF]|\uD81A[\uDE39-\uDE3F\uDE5F\uDE6A-\uDECF\uDEEE\uDEEF\uDEF5-\uDEFF\uDF37-\uDF3F\uDF44-\uDF4F\uDF5A-\uDF62\uDF78-\uDF7C\uDF90-\uDFFF]|\uD81B[\uDC00-\uDE3F\uDE80-\uDEFF\uDF4B-\uDF4E\uDF88-\uDF8E\uDFA0-\uDFDF\uDFE2\uDFE5-\uDFEF\uDFF2-\uDFFF]|\uD821[\uDFF8-\uDFFF]|\uD823[\uDCD6-\uDCFF\uDD09-\uDFFF]|\uD82C[\uDD1F-\uDD4F\uDD53-\uDD63\uDD68-\uDD6F\uDEFC-\uDFFF]|\uD82F[\uDC6B-\uDC6F\uDC7D-\uDC7F\uDC89-\uDC8F\uDC9A-\uDC9C\uDC9F-\uDFFF]|\uD834[\uDC00-\uDD64\uDD6A-\uDD6C\uDD73-\uDD7A\uDD83\uDD84\uDD8C-\uDDA9\uDDAE-\uDE41\uDE45-\uDFFF]|\uD835[\uDC55\uDC9D\uDCA0\uDCA1\uDCA3\uDCA4\uDCA7\uDCA8\uDCAD\uDCBA\uDCBC\uDCC4\uDD06\uDD0B\uDD0C\uDD15\uDD1D\uDD3A\uDD3F\uDD45\uDD47-\uDD49\uDD51\uDEA6\uDEA7\uDEC1\uDEDB\uDEFB\uDF15\uDF35\uDF4F\uDF6F\uDF89\uDFA9\uDFC3\uDFCC\uDFCD]|\uD836[\uDC00-\uDDFF\uDE37-\uDE3A\uDE6D-\uDE74\uDE76-\uDE83\uDE85-\uDE9A\uDEA0\uDEB0-\uDFFF]|\uD838[\uDC07\uDC19\uDC1A\uDC22\uDC25\uDC2B-\uDCFF\uDD2D-\uDD2F\uDD3E\uDD3F\uDD4A-\uDD4D\uDD4F-\uDEBF\uDEFA-\uDFFF]|\uD83A[\uDCC5-\uDCCF\uDCD7-\uDCFF\uDD4C-\uDD4F\uDD5A-\uDFFF]|\uD83B[\uDC00-\uDDFF\uDE04\uDE20\uDE23\uDE25\uDE26\uDE28\uDE33\uDE38\uDE3A\uDE3C-\uDE41\uDE43-\uDE46\uDE48\uDE4A\uDE4C\uDE50\uDE53\uDE55\uDE56\uDE58\uDE5A\uDE5C\uDE5E\uDE60\uDE63\uDE65\uDE66\uDE6B\uDE73\uDE78\uDE7D\uDE7F\uDE8A\uDE9C-\uDEA0\uDEA4\uDEAA\uDEBC-\uDFFF]|\uD83C[\uDC00-\uDD2F\uDD4A-\uDD4F\uDD6A-\uDD6F\uDD8A-\uDFFF]|\uD83E[\uDC00-\uDFEF\uDFFA-\uDFFF]|\uD869[\uDEDE-\uDEFF]|\uD86D[\uDF35-\uDF3F]|\uD86E[\uDC1E\uDC1F]|\uD873[\uDEA2-\uDEAF]|\uD87A[\uDFE1-\uDFFF]|\uD87E[\uDE1E-\uDFFF]|\uD884[\uDF4B-\uDFFF]|\uDB40[\uDC00-\uDCFF\uDDF0-\uDFFF]/g;

export function githubSlug(heading) {
  return String(heading).toLowerCase().replace(GITHUB_SLUGGER_STRIP, "").replace(/ /g, "-");
}

// github-slugger's unique-slug algorithm: every ASSIGNED id is reserved, and
// the collision loop increments the original slug's counter while skipping
// ids that are already reserved. The headings "Sample", "Sample", "Sample-1"
// therefore yield "sample", "sample-1", "sample-1-1" (a base-count scheme
// would wrongly emit "sample-1" twice).
export function headingAnchors(headings) {
  const occurrences = Object.create(null);
  return headings.map((text) => {
    const base = githubSlug(text);
    let slug = base;
    while (Object.prototype.hasOwnProperty.call(occurrences, slug)) {
      occurrences[base] += 1;
      slug = `${base}-${occurrences[base]}`;
    }
    occurrences[slug] = 0;
    return { text, slug };
  });
}

// Frontmatter-, fence-, and code-span-aware Markdown structure: the ATX
// heading texts (document order) plus the destination of every non-image
// inline link. Like CommonMark, a link's label text, the `](` junction,
// and its destination may wrap across line breaks — and a link inside an
// ATX heading line is a real link whose destination must resolve — so the
// scan runs over the whole masked body, not line by line. Inline code spans
// may also span line breaks; they are blanked before link scanning so their
// contents never count as links. The authored Markdown uses no
// reference-style link definitions and no setext headings, so the ATX set
// is the complete anchor set.
export function extractMarkdownStructure(text) {
  const lines = String(text).replace(/\r\n?/g, "\n").split("\n");
  const headings = [];
  let inFrontmatter = false;
  let fence = null;
  const bodyLines = new Array(lines.length).fill("");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (i === 0 && line.trim() === "---") {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (line.trim() === "---") inFrontmatter = false;
      continue;
    }
    if (fence) {
      const close = line.match(/^ {0,3}(`{3,}|~{3,})[ \t]*$/);
      if (close && close[1][0] === fence.char && close[1].length >= fence.length) fence = null;
      continue;
    }
    const open = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (open) {
      fence = { char: open[1][0], length: open[1].length };
      continue;
    }
    bodyLines[i] = line;
    const atx = line.match(/^ {0,3}#{1,6}(?:[ \t]+(.*?))?[ \t]*$/);
    if (atx) {
      const text = atx[1] === undefined ? "" : atx[1].trim();
      headings.push(text.replace(/[ \t]+#+[ \t]*$/, ""));
    }
  }
  return { headings, links: extractInlineLinks(maskCodeSpans(bodyLines.join("\n"))) };
}

// Blank every inline code span (one space per character, so length and line
// boundaries are preserved). A code span may span line breaks but not a
// blank line (which ends its paragraph); a run of backticks closes only on
// a run of exactly the same length, and an unpaired run is literal text.
function maskCodeSpans(text) {
  let out = "";
  let i = 0;
  const n = text.length;
  while (i < n) {
    if (text[i] !== "`") {
      out += text[i];
      i += 1;
      continue;
    }
    let run = 1;
    while (i + run < n && text[i + run] === "`") run += 1;
    let j = i + run;
    let close = -1;
    while (j < n) {
      if (text[j] === "`") {
        let closeRun = 1;
        while (j + closeRun < n && text[j + closeRun] === "`") closeRun += 1;
        if (closeRun === run) {
          close = j;
          break;
        }
        j += closeRun;
      } else {
        if (text[j] === "\n" && /^[ \t]*\n/.test(text.slice(j + 1))) break;
        j += 1;
      }
    }
    if (close < 0) {
      out += text.slice(i, i + run);
      i += run;
    } else {
      out += " ".repeat(close + run - i);
      i = close + run;
    }
  }
  return out;
}

// The destination of every non-image inline link in code-span-masked text.
// A link is `[label](destination)`, optionally with a title: the label may
// wrap across line breaks (its brackets must stay balanced, and it may
// never cross a blank line); whitespace — including line breaks — may sit
// between `]` and `(`; the destination may be angle-bracketed (spaces are
// allowed inside `<>`), may contain balanced parentheses, and is optionally
// followed by a quoted or parenthesized title. A construct that fails to
// match is literal text and scanning resumes after its opening `[`.
function extractInlineLinks(text) {
  const links = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    const isImage = text[i] === "!" && text[i + 1] === "[";
    if (!isImage && text[i] !== "[") {
      i += 1;
      continue;
    }
    const end = scanLink(text, i + (isImage ? 1 : 0), isImage ? null : links);
    i = end > i ? end : i + 1;
  }
  return links;
}

function isLineWhitespace(ch) {
  return ch === " " || ch === "\t" || ch === "\n";
}

function scanLink(text, start, out) {
  const n = text.length;
  // Label: balanced brackets, may wrap lines, but never across a blank line.
  let depth = 1;
  let labelClose = -1;
  for (let j = start + 1; j < n; j += 1) {
    const ch = text[j];
    if (ch === "[") depth += 1;
    else if (ch === "]") {
      depth -= 1;
      if (depth === 0) {
        labelClose = j;
        break;
      }
    } else if (ch === "\n" && /^[ \t]*\n/.test(text.slice(j + 1))) break;
  }
  if (labelClose < 0) return -1;
  // `](` junction: whitespace, including line breaks, is allowed between.
  let p = labelClose + 1;
  while (p < n && isLineWhitespace(text[p])) p += 1;
  if (text[p] !== "(") return -1;
  // Destination: angle-bracketed (no line breaks or `<`, spaces allowed) or
  // bare (no whitespace; balanced parentheses allowed).
  p += 1;
  let destination;
  if (text[p] === "<") {
    const close = text.indexOf(">", p + 1);
    if (close < 0) return -1;
    const inner = text.slice(p + 1, close);
    if (inner.includes("\n") || inner.includes("<")) return -1;
    destination = inner;
    p = close + 1;
  } else {
    const destStart = p;
    let parens = 0;
    while (p < n) {
      const ch = text[p];
      if (ch === "(") parens += 1;
      else if (ch === ")") {
        if (parens === 0) break;
        parens -= 1;
      } else if (isLineWhitespace(ch)) break;
      p += 1;
    }
    destination = text.slice(destStart, p);
  }
  // Optional title (quoted or balanced parentheses), then the closing `)`.
  let t = p;
  while (t < n && isLineWhitespace(text[t])) t += 1;
  if (text[t] === '"' || text[t] === "'") {
    const close = text.indexOf(text[t], t + 1);
    if (close < 0) return -1;
    t = close + 1;
  } else if (text[t] === "(") {
    let parens = 1;
    t += 1;
    while (t < n && parens > 0) {
      if (text[t] === "(") parens += 1;
      else if (text[t] === ")") parens -= 1;
      t += 1;
    }
    if (parens !== 0) return -1;
  }
  while (t < n && isLineWhitespace(text[t])) t += 1;
  if (text[t] !== ")") return -1;
  if (out) out.push(destination);
  return t + 1;
}

// Coverage and known residual shapes of the link scan above; none of the
// residuals occurs in the current corpus. Covers: wrapped labels (line
// break inside the link — the dominant real case), heading-line links,
// same-file `#fragment` anchors, balanced-paren and angle-bracket
// destinations, multi-line code spans, fence/frontmatter exclusion; slugs
// are github-slugger 2.0.0-exact (byte-identical strip set, assigned-id
// reservation). Skipped as literal text (conservative false negatives): a
// destination beginning on the line after the label, an escaped `]`
// inside a label, an escaped quote inside a link title. Under-masked by
// the code-span pass: a wrapped label containing a code-only line,
// backtick pairing across an ATX heading boundary, an escaped opening
// backtick. Over-reported (false positives): an escaped-bracket literal
// (`\[…](…)`), and `]` and `(` separated by a blank line.

let skillReadBudgetCount = 0;
let skillLinkCount = 0;
let pluginBandCount = 0;

function markdownFilesUnder(subdir) {
  return walkFiles(join(repositoryRoot, subdir))
    .filter((absolute) => absolute.endsWith(".md"))
    .map((absolute) => ({ absolute, path: portablePath(relative(repositoryRoot, absolute)) }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

// Check A — every authored .md under skills/ fits the 45 KiB read budget.
function validateSkillReadBudget() {
  for (const { path, absolute } of markdownFilesUnder("skills")) {
    const size = statSync(absolute).size;
    if (size > SKILL_READ_BUDGET_BYTES) {
      fail(path, `authored read budget exceeded: ${size} bytes > ${SKILL_READ_BUDGET_BYTES} bytes (45 KiB)`, "OpenCode truncates skill loads and whole-file reads at 50 KiB (51,200 bytes); move content to a reference file loaded at a named loop point, or trim");
    }
    skillReadBudgetCount += 1;
  }
}

const anchorSets = new Map();
function anchorSetFor(absolute) {
  if (!anchorSets.has(absolute)) {
    const text = readFileSync(absolute, "utf8").replace(/^\uFEFF/, "");
    anchorSets.set(absolute, new Set(headingAnchors(extractMarkdownStructure(text).headings).map((anchor) => anchor.slug)));
  }
  return anchorSets.get(absolute);
}

// Check B — every relative Markdown link in the authored skills resolves:
// the target exists, and a fragment — into a local .md file, or a same-file
// `#fragment` link into the source file's own headings — is one of that
// file's GitHub heading slugs.
function validateSkillLinks() {
  for (const { path, absolute } of markdownFilesUnder("skills")) {
    const { links } = extractMarkdownStructure(readText(path));
    for (const rawTarget of links) {
      const target = rawTarget.trim();
      if (target === "" || target.startsWith("//") || target.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
      const hash = target.indexOf("#");
      const filePart = hash >= 0 ? target.slice(0, hash) : target;
      const fragment = hash >= 0 ? target.slice(hash + 1) : null;
      if (filePart === "") {
        // A same-file `#fragment` must be one of this file's own heading
        // slugs; a bare `#` is the top anchor and always resolves.
        if (fragment === null || fragment === "") continue;
        if (!anchorSetFor(absolute).has(fragment)) {
          fail(path, `link fragment '${fragment}' is not a heading anchor in ${path}`, "update the anchor to a heading's GitHub slug in this file");
          continue;
        }
        skillLinkCount += 1;
        continue;
      }
      const resolved = resolve(dirname(absolute), filePart);
      if (!existsSync(resolved)) {
        fail(path, `relative link target does not exist: ${target}`, "fix the link or add the referenced file");
        continue;
      }
      if (fragment !== null && fragment !== "" && filePart.endsWith(".md") && !anchorSetFor(resolved).has(fragment)) {
        fail(path, `link fragment '${fragment}' is not a heading anchor in ${portablePath(relative(repositoryRoot, resolved))}`, "update the anchor to the heading's GitHub slug");
      }
      skillLinkCount += 1;
    }
  }
}

function ipv4Octets(host) {
  const parts = host.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return null;
  const octets = parts.map(Number);
  return octets.every((octet) => octet >= 0 && octet <= 255) ? octets : null;
}

function isPrivateOrLoopbackHost(rawHost) {
  const host = rawHost.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  const octets = ipv4Octets(host);
  if (octets) {
    const [first, second] = octets;
    return first === 10
      || first === 127
      || (first === 172 && second >= 16 && second <= 31)
      || (first === 192 && second === 168);
  }

  if (host === "::1") return true;
  const groups = host.split(":");
  return groups.length === 8
    && groups.slice(0, 7).every((group) => /^0{1,4}$/.test(group))
    && /^0{0,3}1$/.test(groups[7]);
}

function privateEndpointHosts(text) {
  const hosts = new Set();
  const endpointEnd = String.raw`(?=$|[\s/?#<>"'\x60),.;!?}])`;
  const url = new RegExp(String.raw`\b[a-z][a-z0-9+.-]*:\/\/(?:[^@\s/?#<>"'\x60]+@)?(\[[^\]\s]+\]|\d{1,3}(?:\.\d{1,3}){3})(?::\d{1,5})?${endpointEnd}`, "gi");
  const ipv4Endpoint = new RegExp(String.raw`(?<![\w.])(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}${endpointEnd}`, "g");
  const ipv6Endpoint = new RegExp(String.raw`\[([^\]\s]+)\]:\d{1,5}${endpointEnd}`, "g");

  for (const pattern of [url, ipv4Endpoint, ipv6Endpoint]) {
    for (const match of text.matchAll(pattern)) {
      if (isPrivateOrLoopbackHost(match[1])) hosts.add(match[1].replace(/^\[|\]$/g, ""));
    }
  }
  return [...hosts];
}

function validateEndpointDetectorContract() {
  const positives = [
    `http://${"10"}.1.2.3/path`,
    `https://${"172"}.16.0.1`,
    `${"172"}.31.255.254:8443`,
    `ws://${"192"}.168.20.4/socket`,
    `tcp://${"127"}.42.0.9:9000`,
    `http://[${"::"}1]:3000`,
    `[${"0:0:0:0:0:0:0:"}1]:443`,
    `(endpoint: http://${"10"}.3.2.1:8080),`,
  ];
  const negatives = [
    `The address ${"10"}.1.2.3 is an example in prose.`,
    `Version ${"10"}.20.30.40`,
    `${"172"}.15.0.1:80`,
    `${"172"}.32.0.1:80`,
    `${"192"}.169.0.1:443`,
    `https://${"8"}.8.8.8/`,
  ];

  for (const fixture of positives) {
    if (privateEndpointHosts(fixture).length === 0) {
      fail("scripts/validate.mjs", "private-endpoint detector rejected a positive fixture", "restore RFC 1918 and loopback endpoint detection");
    }
  }
  for (const fixture of negatives) {
    if (privateEndpointHosts(fixture).length !== 0) {
      fail("scripts/validate.mjs", "private-endpoint detector accepted a negative fixture", "keep detection scoped to private/loopback URL and host:port references");
    }
  }
}

function validateSanitation() {
  const publicRepository = `${"ale" + "franz"}/AgenticAle`;
  const forbidden = [
    "git" + "ea",
    "homehub" + ".casa",
    "Ale" + "Franz",
    "Wants" + "ACracker",
    "code" + "-server",
    "/" + "root/",
    "GIT" + "EA_TOKEN",
    "local" + "host",
  ];

  for (const absolute of walkFiles(repositoryRoot)) {
    const path = portablePath(relative(repositoryRoot, absolute));
    const contents = readFileSync(absolute);
    if (contents.includes(0)) continue;
    const text = contents.toString("utf8");
    const screenedText = text.toLowerCase()
      .replaceAll(`https://github.com/${publicRepository}`.toLowerCase(), "PUBLIC_REPOSITORY")
      .replaceAll("https://alefranz.github.io/agenticale", "PUBLIC_SITE")
      .replaceAll(publicRepository.toLowerCase(), "PUBLIC_REPOSITORY")
      .replaceAll(publicRepository.toLowerCase().replace("/", "%2f"), "PUBLIC_REPOSITORY");
    for (const term of forbidden) {
      if (screenedText.includes(term.toLowerCase())) {
        fail(path, `forbidden personal/environment reference '${term}'`, "replace it with portable public guidance");
      }
    }
    const endpointHosts = privateEndpointHosts(text);
    if (endpointHosts.length > 0) {
      fail(path, `private or loopback endpoint host '${endpointHosts.join("', '")}'`, "replace it with a public example endpoint or portable placeholder");
    }
  }
}

validateEndpointDetectorContract();
validateBundleSurface();
validateSkillWork();
validateSkillReview();
validateSkillAutonomous();
validateSkillSourceLookup();
validateSkillPullRequest();
validateSkillConfigure();
validateSharedRoundsContract();
await validateModelConfigs();
validateAdapter();
validateQwenCodeAdapter();
validateCommandTemplates();
validateNeutralContracts();
validateSanitation();
validateSkillReadBudget();
validateSkillLinks();

if (failures.length > 0) {
  console.error(`Validation failed with ${failures.length} issue${failures.length === 1 ? "" : "s"}:`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Validation passed: ${requiredPaths.length} source-of-truth files, ${taskContracts.length} neutral task contracts, flat model configs, ${profileNames.length} OpenCode adapter profiles, the Qwen Code adapter, ${commandNames.length} adapter command templates, ${skillReadBudgetCount} skill files within the 45 KiB read budget, ${skillLinkCount} skill links resolving, ${pluginBandCount} committed plugin files under the 50 KiB host band, and sanitation.`);
}
