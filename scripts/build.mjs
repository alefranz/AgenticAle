#!/usr/bin/env node

import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const buildStateName = ".agenticale-build.json";

export const roles = [
  "consult",
  "deep-review",
  "explore",
  "fix",
  "implement-hard",
  "implement",
  "review",
];

const roleSet = new Set(roles);
const effortLevels = new Set(["low", "medium", "high", "xhigh", "max"]);
const modelPresets = new Map([
  ["example", "examples/example.json"],
  ["local", "examples/local.json"],
  ["openai", "examples/openai.json"],
  ["gpt", "examples/gpt.json"],
  ["zen", "examples/gpt.json"],
]);

const openCodeFiles = [
  ...roles.map((role) => `agents/autonomous/${role}.md`),
  "commands/autonomous.md",
  "skills/autonomous-mode/SKILL.md",
  "skills/pull-request-description/SKILL.md",
  "skills/source-code-lookup/SKILL.md",
];

export const pluginManifest = {
  $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  name: "agenticale",
  version: "0.1.0",
  description: "Sequential autonomous development with specialized implementation, review, and consultation agents.",
  author: { name: "Ale Franz" },
  homepage: "https://github.com/alefranz/AgenticAle",
  repository: "https://github.com/alefranz/AgenticAle",
  license: "MIT",
  keywords: ["autonomous", "development", "review", "subagents"],
};

function usage() {
  return `Usage:
  node scripts/build.mjs [--output PATH] [--models PATH|PRESET | --no-model]
                         [--effort LEVEL] [--coordinator-effort LEVEL]
                         [--source-root PATH]

Builds two generated bundles from the checked-in OpenCode source files:
  <output>/opencode
  <output>/copilot/agenticale

Options:
  --output PATH         Build root (default: dist)
  --models PATH|PRESET  Role mapping (default: gpt; presets: gpt, openai,
                        zen, local, example)
  --no-model            Omit model and reasoning-effort defaults
  --effort LEVEL        Override effort for every Copilot worker
                        (default: mapped variant or high)
  --coordinator-effort LEVEL
                        Copilot coordinator effort (default: medium)
  --source-root PATH    Render a different source-code-lookup root
  --help                Show this help`;
}

function requireValue(argv, index, option) {
  if (index + 1 >= argv.length || !argv[index + 1] || argv[index + 1].startsWith("-")) {
    throw new Error(`${option} requires a value.`);
  }
  return argv[index + 1];
}

export function parseArguments(argv) {
  let output = join(repositoryRoot, "dist");
  let models = "gpt";
  let noModel = false;
  let effort = "high";
  let effortOverride = false;
  let coordinatorEffort = "medium";
  let sourceRoot = null;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--output") {
      output = resolve(requireValue(argv, index, argument));
      index += 1;
    } else if (argument.startsWith("--output=")) {
      output = resolve(argument.slice("--output=".length));
    } else if (argument === "--models") {
      models = requireValue(argv, index, argument);
      index += 1;
    } else if (argument.startsWith("--models=")) {
      models = argument.slice("--models=".length);
    } else if (argument === "--no-model") {
      noModel = true;
    } else if (argument === "--effort") {
      effort = requireValue(argv, index, argument);
      effortOverride = true;
      index += 1;
    } else if (argument.startsWith("--effort=")) {
      effort = argument.slice("--effort=".length);
      effortOverride = true;
    } else if (argument === "--coordinator-effort") {
      coordinatorEffort = requireValue(argv, index, argument);
      index += 1;
    } else if (argument.startsWith("--coordinator-effort=")) {
      coordinatorEffort = argument.slice("--coordinator-effort=".length);
    } else if (argument === "--source-root") {
      sourceRoot = resolve(requireValue(argv, index, argument));
      index += 1;
    } else if (argument.startsWith("--source-root=")) {
      sourceRoot = resolve(argument.slice("--source-root=".length));
    } else if (argument === "--help" || argument === "-h") {
      return { help: true };
    } else {
      throw new Error(`Unknown argument '${argument}'.`);
    }
  }

  if (noModel && argv.some((argument) => argument === "--models" || argument.startsWith("--models="))) {
    throw new Error("--models and --no-model cannot be used together.");
  }
  if (!effortLevels.has(effort)) throw new Error(`Invalid --effort '${effort}'.`);
  if (!effortLevels.has(coordinatorEffort)) {
    throw new Error(`Invalid --coordinator-effort '${coordinatorEffort}'.`);
  }
  if (resolve(output) === repositoryRoot) {
    throw new Error("--output must not be the repository root.");
  }

  return { output, models: noModel ? null : models, effort, effortOverride, coordinatorEffort, sourceRoot, help: false };
}

function parseFrontmatter(path, text) {
  const normalized = text.replace(/\r\n?/g, "\n");
  if (!normalized.startsWith("---\n")) throw new Error(`Missing frontmatter in ${path}.`);
  const end = normalized.indexOf("\n---\n", 4);
  if (end < 0) throw new Error(`Unclosed frontmatter in ${path}.`);
  const header = normalized.slice(4, end);
  const fields = new Map();
  for (const line of header.split("\n")) {
    const match = line.match(/^([A-Za-z][A-Za-z0-9-]*):(?:\s+(.*))?$/);
    if (match) fields.set(match[1], (match[2] ?? "").trim());
  }
  return { fields, body: normalized.slice(end + 5) };
}

function yamlString(value) {
  return JSON.stringify(value);
}

function modelPath(value) {
  const preset = modelPresets.get(value.toLowerCase());
  return preset ? join(repositoryRoot, preset) : resolve(value);
}

async function readModels(value) {
  if (value === null) return {};
  const path = modelPath(value);
  let parsed;
  try {
    parsed = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`Model mapping is not valid JSON: ${path}.`);
    throw error;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Model mapping must be a JSON object keyed by role name.");
  }
  for (const [role, model] of Object.entries(parsed)) {
    if (!roleSet.has(role)) throw new Error(`Unknown role in model mapping: ${role}.`);
    if (typeof model !== "string" || model.length > 256
        || !/^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._:/@+-]*(?:#[A-Za-z0-9][A-Za-z0-9._-]*)?$/.test(model)) {
      throw new Error(`Invalid model for ${role}; expected provider/model[#variant].`);
    }
  }
  return parsed;
}

function copilotModel(model) {
  const separator = model.indexOf("/");
  const withoutProvider = separator < 0 ? model : model.slice(separator + 1);
  return withoutProvider.replace(/#[A-Za-z0-9][A-Za-z0-9._-]*$/, "");
}

function copilotEffort(model, fallback, override) {
  if (override) return fallback;
  const variant = model.match(/#([A-Za-z0-9][A-Za-z0-9._-]*)$/)?.[1];
  return effortLevels.has(variant) ? variant : fallback;
}

function renderOpenCodeAgent(path, text, models) {
  const role = basename(path, ".md");
  const model = models[role];
  if (!model) return text;
  const normalized = text.replace(/\r\n?/g, "\n");
  const end = normalized.indexOf("\n---", 4);
  if (end < 0 || !/^mode: subagent$/m.test(normalized.slice(0, end))) {
    throw new Error(`Cannot render model into ${path}.`);
  }
  return `${normalized.slice(0, end).replace(/^mode: subagent$/m, `mode: subagent\nmodel: ${model}`)}${normalized.slice(end)}`;
}

function renderSourceRoot(text, sourceRoot) {
  if (sourceRoot === null) return text;
  const marker = 'Source root: "~/dev"';
  if (text.split(marker).length !== 2) throw new Error("Source-root marker is missing or ambiguous.");
  return text.replace(marker, `Source root: ${JSON.stringify(sourceRoot)}`);
}

function roleId(role) {
  return `agenticale-${role}`;
}

function renderCopilotBody(body) {
  return replaceAllRoleIds(body)
    .replaceAll("OpenCode", "GitHub Copilot")
    .replace(
      /Never use the\s+`question`\s+tool or wait for user input — both are denied\s+for you\./g,
      "Never ask the user a question or wait for user input; return an assumption or blocker instead.",
    );
}

function renderCopilotAgent(role, source, model, effort) {
  const path = `agents/autonomous/${role}.md`;
  const { fields, body } = parseFrontmatter(path, source);
  const lines = [
    "---",
    `name: ${yamlString(`AgenticAle ${role.replace(/(^|-)([a-z])/g, (_, prefix, letter) => `${prefix ? " " : ""}${letter.toUpperCase()}`)}`)}`,
    `description: ${yamlString(fields.get("description") ?? "AgenticAle autonomous worker.")}`,
    "tools: [\"*\"]",
    "agents: []",
    "user-invocable: false",
    "include-custom-instructions: true",
  ];
  if (model) {
    lines.push(`model: ${yamlString(copilotModel(model))}`);
    lines.push(`reasoningEffort: ${yamlString(effort)}`);
  }
  lines.push("---", "", renderCopilotBody(body).trimStart());
  return `${lines.join("\n").trimEnd()}\n`;
}

function replaceAllRoleIds(text) {
  let rendered = text;
  for (const role of roles) {
    rendered = rendered.replaceAll(`autonomous/${role}`, roleId(role));
  }
  return rendered.replaceAll("autonomous/*", "agenticale-*");
}

function renderCopilotProtocol(source) {
  const { body } = parseFrontmatter("skills/autonomous-mode/SKILL.md", source);
  let rendered = replaceAllRoleIds(body);
  rendered = rendered.replace(
    /Use the installed `agenticale-\*` agents available to OpenCode below, not the\ngeneric `general` or `explore` agents\./,
    "Use the installed `agenticale-*` custom agents listed below, not generic built-in agents.",
  );
  rendered = rendered.replace(
    /The `agenticale-\*` agent definitions[\s\S]*?fresh-context\nindependence is required\./,
    "The generated custom agents carry per-role model and reasoning-effort defaults. Users can override them through Copilot's subagent settings. Model diversity is optional, while fresh-context independence is required.",
  );
  rendered = rendered.replace(
    /`steps` is an OpenCode hard ceiling[\s\S]*?a fresh child and a disk handoff\./,
    "Copilot does not expose per-role hard step ceilings. Keep each round bounded through the task contract, the worker-round budget, the reset triggers below, and a fresh child plus disk handoff whenever a round becomes unhealthy.",
  );
  rendered = rendered.replace(
    /Child sessions are deliberately non-interactive: every `agenticale-\*` profile\ndenies the `question` tool and nested subagents, and the prompts forbid asking\./,
    "Child sessions are deliberately non-interactive. Their prompts forbid questions and nested delegation, and generated clients disable nested agents where that restriction is supported.",
  );
  rendered = rendered.replace(
    /Call `subagent` \(foreground\):/g,
    "Invoke one foreground custom subagent:",
  );
  rendered = rendered.replace(
    /### Step-cap recovery\n\nIf OpenCode ends a child because it reached its configured `steps` ceiling,[\s\S]*?stop and report it as blocked\./,
    "### Interrupted-round recovery\n\nIf Copilot ends a child before it produces a valid report, do not treat the task as complete. Record the interruption, start a fresh agent of the same routed role from the active handoff and final summary, and require one concrete `NEXT` action. If the same task is interrupted twice without a material decision or persisted outcome, stop and report it as blocked.",
  );
  return rendered
    .replaceAll("OpenCode", "GitHub Copilot")
    .replace(
      /\(the question tool and confirmation prompts\nare denied in child sessions and would leave you stuck\)/g,
      "(this child must not ask questions or wait for confirmation)",
    )
    .replace(
      /\(the question tool is denied\nand a prompt would leave you stuck\)/g,
      "(this child must not ask questions or wait for confirmation)",
    )
    .replace(
      /\(the question\ntool is denied and a prompt would leave you stuck\)/g,
      "(this child must not ask questions or wait for confirmation)",
    );
}

function renderCopilotSkill(source) {
  return `---\nname: autonomous-mode\ndescription: Run a long development goal in sequential worker and independent-review rounds with durable handoffs. Use only when the user explicitly asks for autonomous mode.\nuser-invocable: false\n---\n\n${renderCopilotProtocol(source).trimStart()}`;
}

function renderCoordinator(instructions, models, coordinatorEffort) {
  const model = models.consult ?? models["deep-review"] ?? models.review;
  const lines = [
    "---",
    `name: ${yamlString("AgenticAle Autonomous")}`,
    `description: ${yamlString("Coordinate an autonomous development goal through sequential specialist, review, and fix rounds.")}`,
    "tools: [\"*\"]",
    `agents: [${roles.map((role) => yamlString(roleId(role))).join(", ")}]`,
    "include-custom-instructions: true",
  ];
  if (model) {
    lines.push(`model: ${yamlString(copilotModel(model))}`);
    lines.push(`reasoningEffort: ${yamlString(coordinatorEffort)}`);
  }
  lines.push(
    "---",
    "",
    "# AgenticAle Autonomous",
    "",
    "Before coordinating any work, load the `autonomous-mode` skill by exact ID and treat it as the authoritative workflow. Do not substitute a similarly named built-in workflow.",
    "",
    instructions.trimStart(),
  );
  return `${lines.join("\n").trimEnd()}\n`;
}

function renderCopilotCommand(source) {
  const { fields, body } = parseFrontmatter("commands/autonomous.md", source);
  let rendered = replaceAllRoleIds(body)
    .replaceAll("OpenCode", "GitHub Copilot")
    .replace(
      /Child sessions are non-interactive, and the agenticale-\* profiles deny both\nquestions and nested subagents\./,
      "Child sessions are non-interactive: they must not ask questions or create nested subagents. Clients supporting the `agents` field enforce the nested-agent restriction.",
    );
  return `---\ndescription: ${yamlString(fields.get("description") ?? "Start or resume an AgenticAle autonomous goal.")}\nargument-hint: ${yamlString("[worker-round-budget] [goal]")}\n---\n\n${rendered.trimStart()}`;
}

async function writeText(path, contents) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents.replace(/\r\n?/g, "\n"), "utf8");
}

function assertSafeOutput(output) {
  const resolvedOutput = resolve(output);
  const difference = relative(repositoryRoot, resolvedOutput);
  if (resolvedOutput === repositoryRoot || difference === "") {
    throw new Error("Build output must not be the repository root.");
  }
  for (const sourceDirectory of ["agents", "commands", "skills", "scripts", "examples", ".git"]) {
    const source = join(repositoryRoot, sourceDirectory);
    const sourceDifference = relative(source, resolvedOutput);
    if (sourceDifference === "" || (!sourceDifference.startsWith("..") && !isAbsolute(sourceDifference))) {
      throw new Error(`Build output must not be inside the source directory ${sourceDirectory}.`);
    }
  }
}

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function assertBuildOutputOwned(output) {
  const statePath = join(output, buildStateName);
  let state = null;
  try {
    state = JSON.parse(await readFile(statePath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") {
      if (error instanceof SyntaxError) throw new Error(`Build state is invalid: ${statePath}.`);
      throw error;
    }
  }

  const validState = state
    && state.schema === 1
    && state.package === "agenticale"
    && Array.isArray(state.outputs)
    && state.outputs.join("\n") === "opencode\ncopilot/agenticale";
  if (state && !validState) throw new Error(`Build state is invalid: ${statePath}.`);

  const managedPaths = [join(output, "opencode"), join(output, "copilot", "agenticale")];
  if (!validState && (await Promise.all(managedPaths.map(pathExists))).some(Boolean)) {
    throw new Error(`Build output already contains unmanaged bundle paths: ${output}. Choose another --output or move them aside.`);
  }
  return statePath;
}

export async function buildBundles(options) {
  assertSafeOutput(options.output);
  const models = await readModels(options.models);
  const openCodeRoot = join(options.output, "opencode");
  const copilotRoot = join(options.output, "copilot", "agenticale");
  const statePath = await assertBuildOutputOwned(options.output);

  await rm(openCodeRoot, { recursive: true, force: true });
  await rm(copilotRoot, { recursive: true, force: true });
  await mkdir(options.output, { recursive: true });
  await writeFile(statePath, `${JSON.stringify({
    schema: 1,
    package: "agenticale",
    outputs: ["opencode", "copilot/agenticale"],
  }, null, 2)}\n`, "utf8");

  const sources = new Map();
  for (const path of openCodeFiles) {
    sources.set(path, await readFile(join(repositoryRoot, path), "utf8"));
  }

  for (const path of openCodeFiles) {
    let contents = sources.get(path);
    if (path.startsWith("agents/autonomous/")) contents = renderOpenCodeAgent(path, contents, models);
    if (path === "skills/source-code-lookup/SKILL.md") contents = renderSourceRoot(contents, options.sourceRoot);
    await writeText(join(openCodeRoot, path), contents);
  }

  await writeText(join(copilotRoot, "plugin.json"), `${JSON.stringify(pluginManifest, null, 2)}\n`);

  for (const role of roles) {
    await writeText(
      join(copilotRoot, "com.github.copilot", "agents", `${roleId(role)}.agent.md`),
      renderCopilotAgent(
        role,
        sources.get(`agents/autonomous/${role}.md`),
        models[role],
        copilotEffort(models[role] ?? "", options.effort, options.effortOverride),
      ),
    );
  }

  const command = renderCopilotCommand(sources.get("commands/autonomous.md"));
  const coordinatorInstructions = parseFrontmatter("generated autonomous command", command).body
    .replace(
      "Explicitly load the autonomous-mode skill by ID. Interpret the complete command\narguments as: $ARGUMENTS",
      "Interpret the user's complete request as the goal input.",
    )
    .replace(
      /Child sessions are non-interactive, and the agenticale-\* profiles deny both\nquestions and nested subagents\./,
      "Child sessions are non-interactive: they must not ask questions or create nested subagents. Clients supporting the `agents` field enforce the nested-agent restriction.",
    );
  await writeText(
    join(copilotRoot, "com.github.copilot", "agents", "agenticale-autonomous.agent.md"),
    renderCoordinator(coordinatorInstructions, models, options.coordinatorEffort),
  );
  await writeText(
    join(copilotRoot, "com.github.copilot", "commands", "autonomous.md"),
    command,
  );
  await writeText(
    join(copilotRoot, "skills", "autonomous-mode", "SKILL.md"),
    renderCopilotSkill(sources.get("skills/autonomous-mode/SKILL.md")),
  );
  await writeText(
    join(copilotRoot, "skills", "source-code-lookup", "SKILL.md"),
    renderSourceRoot(sources.get("skills/source-code-lookup/SKILL.md"), options.sourceRoot),
  );
  await writeText(
    join(copilotRoot, "skills", "pull-request-description", "SKILL.md"),
    sources.get("skills/pull-request-description/SKILL.md"),
  );

  return { openCodeRoot, copilotRoot, modelCount: Object.keys(models).length };
}

async function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
      console.log(usage());
      return;
    }
    const result = await buildBundles(options);
    console.log(`Built OpenCode bundle: ${result.openCodeRoot}`);
    console.log(`Built Copilot plugin: ${result.copilotRoot}`);
    console.log(result.modelCount > 0
      ? options.effortOverride
        ? `Applied ${result.modelCount} role model assignments; Copilot workers use ${options.effort} effort.`
        : `Applied ${result.modelCount} role model assignments with mapped worker effort (fallback: ${options.effort}).`
      : "Built model-neutral bundles; agents inherit the active session model and effort.");
  } catch (error) {
    console.error(`Build failed: ${error.message}`);
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
