#!/usr/bin/env node

import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { lstat, mkdir, readFile, readdir, realpath, rm, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { DEFAULT_MODEL_CONFIG, formatModelValue, loadModelConfig } from "./model-config.mjs";

// Shared flat model configuration: the role list, the effort levels, the
// preset-name mapping, and the loader/validator the build, the installers,
// and the validator all share, so one schema is enforced everywhere.
//
// Model selection is a build-time input only: the generated OpenCode agent
// profiles carry the model frontmatter (one provider/model[#variant] line),
// and the workflow never resolves models at activation.

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const buildStateName = ".agenticale-build.json";

// The authored fragment appended as the final top-level section of the
// workflow skills in the plugin and standalone outputs (not the opencode
// output, not the three non-workflow skills).
const modelConfigFragmentPath = join(repositoryRoot, "adapters", "plugin", "model-configuration.md");
const workflowSkillNames = ["work", "review", "autonomous"];

// The four output roots (relative to the build output directory) that the
// build owns and regenerates on every run.
const OUTPUT_ROOTS = ["plugin/agenticale", "standalone/.agents/skills", "opencode", "qwen-code"];
const CURRENT_BUILD_STATE_VERSION = 3;
// The schema-1 baseline build owned the retired copilot package output.
const LEGACY_OUTPUT_ROOTS = ["opencode", "copilot/agenticale"];
// The schema-2 build predated the qwen-code output root.
const SCHEMA_2_OUTPUT_ROOTS = ["plugin/agenticale", "standalone/.agents/skills", "opencode"];

// The six public skills that ship in every output root.
const SKILL_NAMES = ["work", "review", "autonomous", "pull-request-description", "source-code-lookup", "configure"];

// The preferences starter is authored once at the repository root and copied
// verbatim into every output at configure/references/preferences.example.md
// (derived output, never a hand-edited source duplicate). The packaged
// configure SKILL.md link is repointed at that install-relative copy; the
// authored link keeps resolving in the source checkout.
const starterSourcePath = join(repositoryRoot, "examples", "preferences.example.md");
const starterAuthoredLink = "[examples/preferences.example.md](../../examples/preferences.example.md)";
const starterPackagedLink = "[preferences.example.md](references/preferences.example.md)";

export const pluginManifest = {
  $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  name: "agenticale",
  version: "0.36.0",
  description: "Reviewed coding tasks with focused specialist agents, optional PR delivery, and durable autonomous project work.",
  author: { name: "Ale Franz" },
  homepage: "https://github.com/alefranz/AgenticAle",
  repository: "https://github.com/alefranz/AgenticAle",
  license: "MIT",
  keywords: ["autonomous", "development", "review", "subagents"],
};

function usage() {
  return `Usage:
  node scripts/build.mjs [--output PATH]
                        [--models PATH|PRESET | --no-model]
                        [--source-root PATH]

Builds the skills-first bundle from the common core and the host adapters:
  <output>/plugin/agenticale            Agent Plugins 1.0 package (skills + plugin.json)
  <output>/standalone/.agents/skills    standalone (project) skill binding
  <output>/opencode                     OpenCode V2 binding (skills + generated profiles + command entries)
  <output>/qwen-code                    Qwen Code binding (skills + flat generated agent profiles)

Options:
  --output PATH         Build root (default: dist)
  --models PATH|PRESET  Flat per-role model config: a JSON object mapping worker
                        roles to "provider/model[#variant]" (presets: example,
                        local, openai, gpt, zen); a missing role inherits the
                        session model. The optional coordinator key assigns the
                        session coordinator; implement-easy and consult-hard
                        render only when listed
  --no-model            Omit model and variant; every role inherits and no
                        coordinator profile is generated
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
  let models = null;
  let noModel = false;
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

  if (noModel && models) {
    throw new Error("--models and --no-model cannot be used together.");
  }
  if (resolve(output) === repositoryRoot) {
    throw new Error("--output must not be the repository root.");
  }

  return { output, models, noModel, sourceRoot, help: false };
}

// The effective flat model config for this build: --models reads a caller
// config (a preset name or a path) directly; --no-model makes every role
// inherit and generates no coordinator; with neither, the packaged flat
// default is used.
async function loadModelOptions(options) {
  if (options.noModel) return { config: {}, coordinator: null, modelsSource: "none (--no-model)" };
  const value = options.models ?? DEFAULT_MODEL_CONFIG;
  const { config, coordinator } = await loadModelConfig(value);
  return { config, coordinator, modelsSource: options.models ? `--models ${options.models}` : DEFAULT_MODEL_CONFIG };
}

// Each OpenCode worker profile is one role, so the profile name IS the role.
// The task-contract body is resolved separately: implement, implement-easy,
// and implement-hard share implement.md; consult and consult-hard share
// consult.md.
const TASK_CONTRACT_FOR_PROFILE = {
  "implement-easy": "implement",
  "implement-hard": "implement",
  "consult-hard": "consult",
};
function taskContractFor(profileName) {
  return TASK_CONTRACT_FOR_PROFILE[profileName] ?? profileName;
}

// A listed role renders one explicit model line in provider/model[#variant]
// form (OpenCode V2 carries the variant on the model line; there is no
// separate reasoningEffort field); an unlisted role renders no model line and
// inherits the session model. The permissions block is omitted when empty
// (the coordinator keeps the normal ability to dispatch children).
function renderOpenCodeProfile(profile, assignment, body) {
  const lines = ["---"];
  lines.push(`description: ${profile.description}`);
  lines.push(`mode: ${profile.mode}`);
  if (profile.steps !== undefined) lines.push(`steps: ${profile.steps}`);
  if (assignment) lines.push(`model: ${formatModelValue(assignment)}`);
  if (profile.permissions.length > 0) {
    lines.push("permissions:");
    for (const permission of profile.permissions) {
      lines.push(`  - action: ${permission.action}`);
      lines.push(`    resource: ${JSON.stringify(permission.resource)}`);
      lines.push(`    effect: ${permission.effect}`);
    }
  }
  lines.push("---", "", body);
  return `${lines.join("\n").trimEnd()}\n`;
}

// Qwen Code binding: one flat agents/agenticale-<role>.md per worker profile.
// Qwen Code has no per-call model parameter and scans only the flat agents
// root, so the model is materialized in the definition at install time,
// exactly like the OpenCode profiles. A value whose provider equals the
// adapter's codex provider prefix renders the Codex external executor
// (background + executor only: the host rejects model/maxTurns/tools/
// disallowedTools on external agents); any other value — and every unlisted
// role — renders the direct form (maxTurns, background, disallowedTools, and
// one bare-model-id model line when listed). The bare id, not
// "provider:model", because the host's authType:modelId selector parses
// built-in auth types only.
function renderQwenCodeProfile(profile, agentName, assignment, codex, permissionToolNames, body) {
  const codexRouted = assignment !== null && assignment.model.startsWith(`${codex.providerPrefix}/`);
  const lines = ["---"];
  lines.push(`name: ${agentName}`);
  lines.push(`description: ${profile.description}`);
  lines.push("background: false");
  if (codexRouted) {
    lines.push("executor:");
    lines.push(`  kind: ${codex.kind ?? "codex"}`);
    lines.push(`  command: ${codex.command}`);
    lines.push("  args:");
    for (const arg of codex.baseArgs) lines.push(`    - ${JSON.stringify(arg)}`);
    lines.push(`    - ${JSON.stringify("-c")}`);
    lines.push(`    - ${JSON.stringify(`model="${assignment.model.slice(providerLength(assignment))}"`)}`);
    if (assignment.effort) {
      lines.push(`    - ${JSON.stringify("-c")}`);
      lines.push(`    - ${JSON.stringify(`model_reasoning_effort="${assignment.effort}"`)}`);
    }
  } else {
    if (profile.maxTurns !== undefined) lines.push(`maxTurns: ${profile.maxTurns}`);
    const tools = [];
    for (const permission of profile.permissions) {
      if (permission.effect !== "deny") continue;
      for (const tool of permissionToolNames[permission.action] ?? []) tools.push(tool);
    }
    if (tools.length > 0) {
      lines.push("disallowedTools:");
      for (const tool of tools) lines.push(`  - ${tool}`);
    }
    if (assignment) lines.push(`model: ${assignment.model.slice(providerLength(assignment))}`);
  }
  lines.push("---", "", body);
  return `${lines.join("\n").trimEnd()}\n`;
}

// The length of the "provider/" prefix of a parsed assignment (the provider
// component never contains a slash in the shared loader's validation).
function providerLength(assignment) {
  return assignment.model.indexOf("/") + 1;
}

async function copyDirTree(srcDir, destDir) {
  await mkdir(destDir, { recursive: true });
  const entries = await readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const src = join(srcDir, entry.name);
    const dest = join(destDir, entry.name);
    if (entry.isDirectory()) await copyDirTree(src, dest);
    else await writeFile(dest, await readFile(src, "utf8"), "utf8");
  }
}

function renderSourceRoot(text, sourceRoot) {
  if (sourceRoot === null) return text;
  const marker = 'Source root: "~/dev"';
  if (text.split(marker).length !== 2) throw new Error("Source-root marker is missing or ambiguous.");
  return text.replace(marker, `Source root: ${JSON.stringify(sourceRoot)}`);
}

// Copy the six public skills into a skills root. When modelConfigSection is
// given (the plugin and standalone outputs only), the authored
// model-configuration fragment is appended as the final top-level section of
// the work, review, and autonomous SKILL.md copies.
async function populateSkillsRoot(skillsRoot, sourceRoot, modelConfigSection) {
  for (const name of SKILL_NAMES) {
    await copyDirTree(join(repositoryRoot, "skills", name), join(skillsRoot, name));
  }
  // Package the preferences starter install-relative and repoint the
  // configure skill's starter link at the packaged copy.
  await writeText(join(skillsRoot, "configure", "references", "preferences.example.md"), await readFile(starterSourcePath, "utf8"));
  const configureSkillPath = join(skillsRoot, "configure", "SKILL.md");
  const configureText = await readFile(configureSkillPath, "utf8");
  if (configureText.split(starterAuthoredLink).length !== 2) {
    throw new Error("Configure starter link marker is missing or ambiguous.");
  }
  await writeText(configureSkillPath, configureText.replace(starterAuthoredLink, starterPackagedLink));
  if (sourceRoot !== null) {
    const lookupPath = join(skillsRoot, "source-code-lookup", "SKILL.md");
    const rendered = renderSourceRoot(await readFile(lookupPath, "utf8"), sourceRoot);
    await writeFile(lookupPath, rendered.replace(/\r\n?/g, "\n"), "utf8");
  }
  if (modelConfigSection !== null) {
    for (const name of workflowSkillNames) {
      const skillPath = join(skillsRoot, name, "SKILL.md");
      const text = (await readFile(skillPath, "utf8")).trimEnd();
      await writeText(skillPath, `${text}\n\n${modelConfigSection.trimEnd()}\n`);
    }
  }
}

// Copies the adapter-owned command templates (thin launchers that load the
// explicit-only skills by exact ID) into the OpenCode output. OpenCode V2 does
// not interpret the skills' `slash` portability field, so the /work, /review,
// /autonomous, and /configure entries must be installed command files. When
// the config assigns a session coordinator, each workflow command additionally
// binds the generated coordinator agent (`agent:`) and forces the current
// session (`subagent: false`); the skill load and $ARGUMENTS body stay
// untouched. The configure command declares `bindCoordinator: false`: setup is
// a user-owned conversation, not a workflow round, so it always stays a
// caller-session launcher. Without a coordinator the commands remain plain
// caller-session launchers.
async function populateCommandEntries(openCodeRoot, adapter, coordinatorAssignment) {
  const adapterDirectory = join(repositoryRoot, "adapters", "opencode");
  let coordinatorAgentId = null;
  if (coordinatorAssignment) {
    const outputPath = adapter.coordinator?.outputPath;
    if (typeof outputPath !== "string" || !outputPath.startsWith("agents/") || !outputPath.endsWith(".md")) {
      throw new Error("OpenCode adapter coordinator must declare an agents/<id>.md outputPath: adapters/opencode/adapter.json");
    }
    coordinatorAgentId = outputPath.slice("agents/".length, -".md".length);
  }
  for (const command of adapter.commands ?? []) {
    if (typeof command?.name !== "string" || typeof command?.source !== "string" || typeof command?.outputPath !== "string") {
      throw new Error("OpenCode adapter command entries must declare name, source, and outputPath strings: adapters/opencode/adapter.json");
    }
    const source = resolve(adapterDirectory, command.source);
    if (source !== adapterDirectory && !source.startsWith(adapterDirectory + sep)) {
      throw new Error(`OpenCode command source must stay inside the adapter directory: ${command.source}`);
    }
    if (!command.outputPath.startsWith("commands/")) {
      throw new Error(`OpenCode command output path must live under commands/: ${command.outputPath}`);
    }
    let text = (await readFile(source, "utf8")).replace(/\r\n?/g, "\n");
    if (coordinatorAgentId !== null && command.bindCoordinator !== false) {
      const lines = text.split("\n");
      const close = lines[0] === "---" ? lines.indexOf("---", 1) : -1;
      if (close < 0) throw new Error(`OpenCode command template must carry frontmatter: ${command.source}`);
      lines.splice(close, 0, `agent: ${coordinatorAgentId}`, "subagent: false");
      text = lines.join("\n");
    }
    await writeText(join(openCodeRoot, command.outputPath), text);
  }
}

async function writeText(path, contents) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents.replace(/\r\n?/g, "\n"), "utf8");
}

async function assertOutputLocationSafe(resolvedOutput, sourceDirectory, sourceRoot = repositoryRoot) {
  const source = await resolveRealPath(join(sourceRoot, sourceDirectory));
  const sourceDifference = relative(source, resolvedOutput);
  if (sourceDifference === "" || (!sourceDifference.startsWith("..") && !isAbsolute(sourceDifference))) {
    throw new Error(`Build output must not be inside the source directory ${sourceDirectory}.`);
  }
}

async function resolveRealPath(path) {
  try {
    return await realpath(path);
  } catch (error) {
    if (error.code === "ENOENT") return resolve(path);
    throw error;
  }
}

// Resolve the physical destination of a possibly-missing path by resolving its
// nearest EXISTING ancestor and re-appending the missing segments. A missing
// --output beneath a junction that points into a source directory must be
// reported at its physical location (inside the source directory), not the
// lexical spelling that hides the link.
async function physicalPath(path) {
  const requested = resolve(path);
  let existing = requested;
  const missing = [];
  while (!await pathExists(existing)) {
    const parent = dirname(existing);
    if (parent === existing) throw new Error(`Cannot resolve an existing ancestor for ${requested}.`);
    missing.unshift(basename(existing));
    existing = parent;
  }
  const physicalAncestor = await realpath(existing);
  return resolve(physicalAncestor, ...missing);
}

// Assert that `managedPath` (a managed output root under `outputRoot`) is
// physically contained in `outputRoot` at every level: the output root and each
// intermediate directory must be real directories (not symlinks/junctions), and
// the deepest existing ancestor of `managedPath` must physically resolve inside
// the real output root. Missing trailing segments are allowed because the build
// recreates them, so the deepest EXISTING ancestor is the containment anchor.
async function assertManagedRootContained(outputRoot, managedPath) {
  const realOutputRoot = await resolveRealPath(outputRoot);
  const prefix = realOutputRoot.endsWith(sep) ? realOutputRoot : realOutputRoot + sep;
  const segments = relative(outputRoot, managedPath).split(sep);
  let cursor = outputRoot;
  let lastExisting = null;
  for (const segment of segments) {
    cursor = join(cursor, segment);
    let st;
    try {
      st = await lstat(cursor);
    } catch (error) {
      if (error.code === "ENOENT") break; // missing trailing segment; anchor on the nearest existing ancestor
      throw error;
    }
    if (st.isSymbolicLink()) {
      throw new Error(`Refusing to build into a symlinked path: ${cursor}.`);
    }
    lastExisting = cursor;
    if (!st.isDirectory()) break; // a non-directory cannot have children; stop here
  }
  const anchor = lastExisting ?? outputRoot;
  const realAnchor = await resolveRealPath(anchor);
  if (realAnchor !== realOutputRoot && !realAnchor.startsWith(prefix)) {
    throw new Error(`Refusing to build into a path outside the output root: ${anchor}`);
  }
}

async function assertSafeOutput(output) {
  const resolvedOutput = resolve(output);
  if (resolvedOutput === repositoryRoot) {
    throw new Error("Build output must not be the repository root.");
  }
  for (const sourceDirectory of ["agents", "commands", "skills", "scripts", "examples", ".git"]) {
    await assertOutputLocationSafe(resolvedOutput, sourceDirectory);
  }

  // Physical confinement: resolve any symlinks in the output path and re-apply
  // the same location rules to where the build will actually write and delete,
  // so a symlinked --output cannot redirect work into a reserved source dir.
  // When the output does not yet exist, resolve its nearest existing ancestor
  // physically: a missing --output beneath a junction that points into a source
  // directory would otherwise compare two lexical fallbacks and slip through.
  const realOutput = await physicalPath(resolvedOutput);
  if (realOutput !== resolvedOutput) {
    const realRepositoryRoot = await resolveRealPath(repositoryRoot);
    if (realOutput === repositoryRoot || realOutput === realRepositoryRoot) {
      throw new Error("Build output must not be the repository root.");
    }
    for (const sourceDirectory of ["agents", "commands", "skills", "scripts", "examples", ".git"]) {
      await assertOutputLocationSafe(realOutput, sourceDirectory, realRepositoryRoot);
    }
  }

  // Physical confinement: every managed output root (current or retired) and
  // each intermediate directory between it and the output root must be
  // physically contained in the output root. A symlink or junction anywhere on
  // that path would let recursive deletion of the managed root follow the link
  // and remove content outside the output directory, so the build refuses the
  // run before mutating anything. Missing descendants resolve through their
  // nearest existing ancestor (the build creates the missing final segments).
  for (const root of [...OUTPUT_ROOTS, ...LEGACY_OUTPUT_ROOTS]) {
    await assertManagedRootContained(resolvedOutput, join(resolvedOutput, root));
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

  // Recognize the current (schema 3) build state, which uses `schemaVersion`
  // and a `package.name` object and owns the four current roots.
  const owns = (outputs, roots) => Array.isArray(outputs)
    && outputs.length === roots.length
    && outputs.every((root, index) => root === roots[index]);
  const isCurrent = state
    && state.schemaVersion === CURRENT_BUILD_STATE_VERSION
    && state.package?.name === "agenticale"
    && owns(state.outputs, OUTPUT_ROOTS);
  // Recognize the real schema-1 baseline state exactly as the old builder
  // wrote it: a top-level `schema` key (not `schemaVersion`) and a string
  // `package` (not `package.name`), owning the older two-root layout.
  const isLegacy = state
    && state.schema === 1
    && state.package === "agenticale"
    && owns(state.outputs, LEGACY_OUTPUT_ROOTS);
  // Recognize the schema-2 state (pre-qwen-code root) so an upgrade deletes
  // only the roots that version owned; the new qwen-code root is then treated
  // as newly introduced and content-conflict protected like any other.
  const isSchema2 = state
    && state.schemaVersion === 2
    && state.package?.name === "agenticale"
    && owns(state.outputs, SCHEMA_2_OUTPUT_ROOTS);
  if (state && !isCurrent && !isLegacy && !isSchema2) {
    throw new Error(`Build state is invalid: ${statePath}.`);
  }

  // Roots this run may delete are only those the existing state actually
  // owns. A current state owns all four current roots. The schema-1 baseline
  // owned only the older two-root layout (opencode + the now-retired copilot
  // package) and schema-2 owned the three-root layout, so on upgrade the
  // roots a version did not own are NOT deleted if they already hold content.
  const ownedRoots = isCurrent ? [...OUTPUT_ROOTS] : isLegacy ? [...LEGACY_OUTPUT_ROOTS] : isSchema2 ? [...SCHEMA_2_OUTPUT_ROOTS] : [];
  // Current roots the existing state does not own are newly introduced this
  // run. If any already holds content, deleting it would remove unmanaged
  // files, so refuse instead of overwriting.
  const newRoots = OUTPUT_ROOTS.filter((root) => !ownedRoots.includes(root));
  const newPaths = newRoots.map((root) => join(output, root));
  if (newRoots.length > 0 && (await Promise.all(newPaths.map(pathExists))).some(Boolean)) {
    throw new Error(`Build output already contains unmanaged bundle paths: ${output}. Choose another --output or move them aside.`);
  }
  return { statePath, ownedRoots };
}

export async function buildBundles(options) {
  await assertSafeOutput(options.output);
  const { config, coordinator, modelsSource } = await loadModelOptions(options);

  const adapter = JSON.parse(
    await readFile(join(repositoryRoot, "adapters", "opencode", "adapter.json"), "utf8"),
  );
  if (adapter.runtime !== "opencode") throw new Error("OpenCode adapter must declare runtime 'opencode'.");

  const openCodeRoot = join(options.output, "opencode");
  const pluginRoot = join(options.output, "plugin", "agenticale");
  const standaloneSkillsRoot = join(options.output, "standalone", ".agents", "skills");
  const { statePath, ownedRoots } = await assertBuildOutputOwned(options.output);

  const profiles = [];
  for (const profile of adapter.profiles) {
    const route = profile.name;
    const assignment = config[route] ?? null;
    // Optional worker profiles (implement-easy, consult-hard) render only
    // when the config lists them explicitly; the base roles always render.
    if (profile.optional && !assignment) continue;
    const bodySource = await readFile(
      join(repositoryRoot, "skills", "work", "references", "tasks", `${taskContractFor(route)}.md`),
      "utf8",
    );
    const body = bodySource.replace(/\r\n?/g, "\n").trim();
    profiles.push({ profile, route, assignment, text: renderOpenCodeProfile(profile, assignment, body) });
  }

  // The session coordinator is generated only when the config assigns it
  // (never under --no-model): one visible primary agent with the normal
  // ability to dispatch children and the adapter-owned coordinator body.
  let coordinatorProfile = null;
  if (coordinator) {
    const meta = adapter.coordinator;
    if (!meta || typeof meta.name !== "string" || typeof meta.outputPath !== "string" || typeof meta.body !== "string"
        || typeof meta.description !== "string" || typeof meta.mode !== "string" || !Array.isArray(meta.permissions)) {
      throw new Error("OpenCode adapter must declare coordinator metadata (name, outputPath, mode, description, body, permissions): adapters/opencode/adapter.json");
    }
    const adapterDirectory = join(repositoryRoot, "adapters", "opencode");
    const bodyPath = resolve(adapterDirectory, meta.body);
    if (bodyPath !== adapterDirectory && !bodyPath.startsWith(adapterDirectory + sep)) {
      throw new Error(`OpenCode coordinator body must stay inside the adapter directory: ${meta.body}`);
    }
    const bodySource = await readFile(bodyPath, "utf8");
    const body = bodySource.replace(/\r\n?/g, "\n").trim();
    coordinatorProfile = { meta, assignment: coordinator, text: renderOpenCodeProfile(meta, coordinator, body) };
  }

  // Qwen Code V2 binding: the same nine-profile surface rendered from the
  // qwen-code adapter. The flat install layout and the executor/direct model
  // routing are host constraints, so the profile set is derived from this
  // adapter's own metadata, not the OpenCode adapter's.
  const qwenAdapter = JSON.parse(
    await readFile(join(repositoryRoot, "adapters", "qwen-code", "adapter.json"), "utf8"),
  );
  if (qwenAdapter.runtime !== "qwen-code") throw new Error("Qwen Code adapter must declare runtime 'qwen-code'.");
  if (qwenAdapter.codex?.kind !== "codex" || qwenAdapter.codex?.providerPrefix !== "openai" || qwenAdapter.codex?.command !== "codex"
      || JSON.stringify(qwenAdapter.codex?.baseArgs ?? null) !== JSON.stringify(["app-server", "--stdio"])) {
    throw new Error("Qwen Code adapter must keep codex routing pinned to the openai prefix and the codex app-server stdio launch: adapters/qwen-code/adapter.json");
  }
  // The host constraint that matters at build time: the agents scan is
  // non-recursive, so every rendered file must sit at the top level of the
  // agents root under its flat agenticale-<role> name.
  for (const profile of qwenAdapter.profiles) {
    if (!profile || profile.outputPath !== `agents/agenticale-${profile.name}.md`) {
      throw new Error(`Qwen Code profile '${profile && profile.name}' must output the flat agents/agenticale-${profile && profile.name}.md path (the host scans only the top level of .qwen/agents/): adapters/qwen-code/adapter.json`);
    }
  }
  if (qwenAdapter.coordinator?.outputPath !== "agents/agenticale-coordinator.md") {
    throw new Error("Qwen Code coordinator must output the flat agents/agenticale-coordinator.md path: adapters/qwen-code/adapter.json");
  }
  const qwenProfiles = [];
  for (const profile of qwenAdapter.profiles) {
    const route = profile.name;
    const assignment = config[route] ?? null;
    if (profile.optional && !assignment) continue;
    const bodySource = await readFile(
      join(repositoryRoot, "skills", "work", "references", "tasks", `${taskContractFor(route)}.md`),
      "utf8",
    );
    const body = bodySource.replace(/\r\n?/g, "\n").trim();
    const agentName = `agenticale-${route}`;
    qwenProfiles.push({ profile, route, assignment, text: renderQwenCodeProfile(profile, agentName, assignment, qwenAdapter.codex, qwenAdapter.permissionToolNames, body) });
  }
  // The qwen-code coordinator renders only for Qwen-direct values: the
  // coordinating session switches models within Qwen's own provider registry,
  // and a codex-routed value is unreachable from a session. A shared build
  // (one config feeding every root) skips it with a state record rather than
  // failing the run; the installer enforces the strict rule.
  let qwenCoordinatorProfile = null;
  let qwenCoordinatorSkipped = null;
  if (coordinator) {
    if (coordinator.model.startsWith(`${qwenAdapter.codex.providerPrefix}/`)) {
      qwenCoordinatorSkipped = "codex-routed coordinator values cannot run as a Qwen Code session model";
    } else {
      const meta = qwenAdapter.coordinator;
      const adapterDirectory = join(repositoryRoot, "adapters", "qwen-code");
      const bodyPath = resolve(adapterDirectory, meta.body);
      if (bodyPath !== adapterDirectory && !bodyPath.startsWith(adapterDirectory + sep)) {
        throw new Error(`Qwen Code coordinator body must stay inside the adapter directory: ${meta.body}`);
      }
      const bodySource = await readFile(bodyPath, "utf8");
      const body = bodySource.replace(/\r\n?/g, "\n").trim();
      const text = renderQwenCodeProfile({ name: meta.name, description: meta.description, permissions: [] }, "agenticale-coordinator", coordinator, qwenAdapter.codex, qwenAdapter.permissionToolNames, body);
      qwenCoordinatorProfile = { meta, assignment: coordinator, text };
    }
  }

  // Remove only the roots this build owns (including the retired baseline
  // copilot output when upgrading), leaving any other content under --output.
  for (const root of ownedRoots) {
    await rm(join(options.output, root), { recursive: true, force: true });
  }
  await mkdir(options.output, { recursive: true });

  const profileRecords = profiles.map(({ profile, route, assignment }) => {
    const record = { name: profile.name, route, steps: profile.steps, mode: assignment ? "explicit" : "inherit" };
    if (assignment) record.model = formatModelValue(assignment);
    return record;
  });

  // Qwen Code profiles record their render mode: "codex" (executor block),
  // "explicit" (direct model line), or "inherit" (unlisted).
  const qwenProfileRecords = qwenProfiles.map(({ profile, route, assignment }) => {
    const record = {
      name: profile.name,
      route,
      maxTurns: profile.maxTurns,
      mode: assignment && assignment.model.startsWith(`${qwenAdapter.codex.providerPrefix}/`) ? "codex" : assignment ? "explicit" : "inherit",
    };
    if (assignment) record.model = formatModelValue(assignment);
    return record;
  });

  await writeFile(statePath, `${JSON.stringify({
    schemaVersion: 3,
    package: { name: pluginManifest.name, version: pluginManifest.version },
    modelsSource,
    noModel: options.noModel,
    sourceRoot: options.sourceRoot,
    outputs: OUTPUT_ROOTS,
    profiles: profileRecords,
    coordinator: coordinatorProfile ? { name: coordinatorProfile.meta.name, model: formatModelValue(coordinatorProfile.assignment) } : null,
    qwenCode: {
      profiles: qwenProfileRecords,
      coordinator: qwenCoordinatorProfile ? { name: qwenCoordinatorProfile.meta.name, model: formatModelValue(qwenCoordinatorProfile.assignment) } : null,
      coordinatorSkipped: qwenCoordinatorSkipped,
    },
  }, null, 2)}\n`, "utf8");

  const modelConfigSection = await readFile(modelConfigFragmentPath, "utf8");

  // 1. Agent Plugins 1.0 package.
  await writeText(join(pluginRoot, "plugin.json"), `${JSON.stringify(pluginManifest, null, 2)}\n`);
  await populateSkillsRoot(join(pluginRoot, "skills"), options.sourceRoot, modelConfigSection);

  // 2. Standalone (project) skill binding.
  await populateSkillsRoot(standaloneSkillsRoot, options.sourceRoot, modelConfigSection);

  // 3. OpenCode V2 binding (generated profiles + command entries + skills).
  for (const { profile, text } of profiles) {
    await writeText(join(openCodeRoot, profile.outputPath), text);
  }
  if (coordinatorProfile) {
    await writeText(join(openCodeRoot, coordinatorProfile.meta.outputPath), coordinatorProfile.text);
  }
  await populateCommandEntries(openCodeRoot, adapter, coordinator);
  await populateSkillsRoot(join(openCodeRoot, "skills"), options.sourceRoot, null);

  // 4. Qwen Code binding (flat generated agent profiles + skills).
  const qwenCodeRoot = join(options.output, "qwen-code");
  for (const { profile, text } of qwenProfiles) {
    await writeText(join(qwenCodeRoot, profile.outputPath), text);
  }
  if (qwenCoordinatorProfile) {
    await writeText(join(qwenCodeRoot, qwenCoordinatorProfile.meta.outputPath), qwenCoordinatorProfile.text);
  }
  await populateSkillsRoot(join(qwenCodeRoot, "skills"), options.sourceRoot, null);

  const explicitCount = profileRecords.filter((record) => record.mode === "explicit").length;
  return {
    openCodeRoot,
    qwenCodeRoot,
    pluginRoot,
    standaloneRoot: standaloneSkillsRoot,
    copilotRoot: pluginRoot,
    modelCount: explicitCount,
    profileCount: profileRecords.length,
    coordinator: coordinatorProfile !== null,
    qwenCoordinator: qwenCoordinatorProfile !== null,
    qwenCoordinatorSkipped: qwenCoordinatorSkipped,
  };
}

async function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
      console.log(usage());
      return;
    }
    const result = await buildBundles(options);
    console.log(`Built Agent Plugins package: ${result.pluginRoot}`);
    console.log(`Built standalone skills: ${result.standaloneRoot}`);
    console.log(`Built OpenCode binding: ${result.openCodeRoot}`);
    console.log(`Built Qwen Code binding: ${result.qwenCodeRoot}`);
    if (options.noModel) {
      console.log("Built model-neutral bundles; every OpenCode and Qwen Code profile inherits the session model and effort, and no coordinator profile is generated.");
    } else {
      console.log(`${result.modelCount} of ${result.profileCount} OpenCode worker profiles carry explicit model routes; the rest inherit the session model.`);
      if (result.coordinator) {
        console.log("Coordinator profile generated; the /work, /review, and /autonomous commands bind agenticale/coordinator in the current session.");
      }
      if (result.qwenCoordinatorSkipped) {
        console.log(`Qwen Code coordinator skipped: ${result.qwenCoordinatorSkipped}.`);
      }
    }
  } catch (error) {
    console.error(`Build failed: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && await realpath(process.argv[1]) === await realpath(fileURLToPath(import.meta.url))) {
  await main();
}
