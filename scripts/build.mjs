#!/usr/bin/env node

import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { lstat, mkdir, readFile, readdir, realpath, rm, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { DEFAULT_MODEL_CONFIG, loadModelConfig } from "./model-config.mjs";

// Shared flat model configuration: the role list, the effort levels, the
// preset-name mapping, and the loader/validator the build, the installers,
// and the validator all share, so one schema is enforced everywhere.
//
// Model selection is a build-time input only: the seven generated OpenCode
// agent profiles carry the model/effort frontmatter, and the workflow never
// resolves models at activation.

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const buildStateName = ".agenticale-build.json";

// The authored fragment appended as the final top-level section of the
// workflow skills in the plugin and standalone outputs (not the opencode
// output, not the two non-workflow skills).
const modelConfigFragmentPath = join(repositoryRoot, "adapters", "plugin", "model-configuration.md");
const workflowSkillNames = ["work", "review", "autonomous"];

// The three output roots (relative to the build output directory) that the
// build owns and regenerates on every run.
const OUTPUT_ROOTS = ["plugin/agenticale", "standalone/.agents/skills", "opencode"];
const CURRENT_BUILD_STATE_VERSION = 2;
// The schema-1 baseline build owned the retired copilot package output.
const LEGACY_OUTPUT_ROOTS = ["opencode", "copilot/agenticale"];

// The five public skills that ship in every output root.
const SKILL_NAMES = ["work", "review", "autonomous", "pull-request-description", "source-code-lookup"];

export const pluginManifest = {
  $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  name: "agenticale",
  version: "0.23.0",
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

Builds the skills-first bundle from the common core and the OpenCode adapter:
  <output>/plugin/agenticale            Agent Plugins 1.0 package (skills + plugin.json)
  <output>/standalone/.agents/skills    standalone (project) skill binding
  <output>/opencode                     OpenCode V2 binding (skills + generated profiles + command entries)

Options:
  --output PATH         Build root (default: dist)
  --models PATH|PRESET  Flat per-role model config: a JSON object mapping roles
                        to "provider/model[#effort]" (presets: example, local,
                        openai, gpt, zen); a missing role inherits the session
                        model
  --no-model            Omit model and reasoning-effort; every role inherits
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
// inherit; with neither, the packaged flat default is used.
async function loadModelOptions(options) {
  if (options.noModel) return { config: {}, modelsSource: "none (--no-model)" };
  const value = options.models ?? DEFAULT_MODEL_CONFIG;
  const { config } = await loadModelConfig(value);
  return { config, modelsSource: options.models ? `--models ${options.models}` : DEFAULT_MODEL_CONFIG };
}

// Each OpenCode profile is one role (seven profiles, one per role), so the
// profile name IS the role. The task-contract body is resolved separately:
// implement and implement-hard share implement.md.
const TASK_CONTRACT_FOR_PROFILE = {
  "implement-hard": "implement",
};
function taskContractFor(profileName) {
  return TASK_CONTRACT_FOR_PROFILE[profileName] ?? profileName;
}

// A listed role renders explicit frontmatter (model, and the effort when the
// value carries one); an unlisted role renders neither line and inherits the
// session model.
function renderOpenCodeProfile(profile, assignment, body) {
  const lines = ["---"];
  lines.push(`description: ${profile.description}`);
  lines.push(`mode: ${profile.mode}`);
  lines.push(`steps: ${profile.steps}`);
  if (assignment) {
    lines.push(`model: ${assignment.model}`);
    if (assignment.effort) lines.push(`reasoningEffort: ${assignment.effort}`);
  }
  lines.push("permissions:");
  for (const permission of profile.permissions) {
    lines.push(`  - action: ${permission.action}`);
    lines.push(`    resource: ${JSON.stringify(permission.resource)}`);
    lines.push(`    effect: ${permission.effect}`);
  }
  lines.push("---", "", body);
  return `${lines.join("\n").trimEnd()}\n`;
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

// Copy the five public skills into a skills root. When modelConfigSection is
// given (the plugin and standalone outputs only), the authored
// model-configuration fragment is appended as the final top-level section of
// the work, review, and autonomous SKILL.md copies.
async function populateSkillsRoot(skillsRoot, sourceRoot, modelConfigSection) {
  for (const name of SKILL_NAMES) {
    await copyDirTree(join(repositoryRoot, "skills", name), join(skillsRoot, name));
  }
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
// and /autonomous entries must be installed command files.
async function populateCommandEntries(openCodeRoot, adapter) {
  const adapterDirectory = join(repositoryRoot, "adapters", "opencode");
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
    const text = (await readFile(source, "utf8")).replace(/\r\n?/g, "\n");
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

  // Recognize the current (schema 2) build state, which uses `schemaVersion`
  // and a `package.name` object and owns the three current roots.
  const isCurrent = state
    && state.schemaVersion === CURRENT_BUILD_STATE_VERSION
    && state.package?.name === "agenticale"
    && Array.isArray(state.outputs)
    && state.outputs.join("\n") === OUTPUT_ROOTS.join("\n");
  // Recognize the real schema-1 baseline state exactly as the old builder
  // wrote it: a top-level `schema` key (not `schemaVersion`) and a string
  // `package` (not `package.name`), owning the older two-root layout.
  const isLegacy = state
    && state.schema === 1
    && state.package === "agenticale"
    && Array.isArray(state.outputs)
    && state.outputs.join("\n") === LEGACY_OUTPUT_ROOTS.join("\n");
  if (state && !isCurrent && !isLegacy) {
    throw new Error(`Build state is invalid: ${statePath}.`);
  }

  // Roots this run may delete are only those the existing state actually
  // owns. A current state owns all three current roots. The schema-1 baseline
  // owned only the older two-root layout (opencode + the now-retired copilot
  // package), so on upgrade the current roots are NOT owned by it and must not
  // be deleted if they already hold content.
  const ownedRoots = isCurrent ? [...OUTPUT_ROOTS] : isLegacy ? [...LEGACY_OUTPUT_ROOTS] : [];
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
  const { config, modelsSource } = await loadModelOptions(options);

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
    const bodySource = await readFile(
      join(repositoryRoot, "skills", "work", "references", "tasks", `${taskContractFor(route)}.md`),
      "utf8",
    );
    const body = bodySource.replace(/\r\n?/g, "\n").trim();
    profiles.push({ profile, route, assignment, text: renderOpenCodeProfile(profile, assignment, body) });
  }

  // Remove only the roots this build owns (including the retired baseline
  // copilot output when upgrading), leaving any other content under --output.
  for (const root of ownedRoots) {
    await rm(join(options.output, root), { recursive: true, force: true });
  }
  await mkdir(options.output, { recursive: true });

  const profileRecords = profiles.map(({ profile, route, assignment }) => {
    const record = { name: profile.name, route, steps: profile.steps, mode: assignment ? "explicit" : "inherit" };
    if (assignment) {
      record.model = assignment.model;
      if (assignment.effort) record.reasoningEffort = assignment.effort;
    }
    return record;
  });

  await writeFile(statePath, `${JSON.stringify({
    schemaVersion: 2,
    package: { name: pluginManifest.name, version: pluginManifest.version },
    modelsSource,
    noModel: options.noModel,
    sourceRoot: options.sourceRoot,
    outputs: OUTPUT_ROOTS,
    profiles: profileRecords,
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
  await populateCommandEntries(openCodeRoot, adapter);
  await populateSkillsRoot(join(openCodeRoot, "skills"), options.sourceRoot, null);

  const explicitCount = profileRecords.filter((record) => record.mode === "explicit").length;
  return {
    openCodeRoot,
    pluginRoot,
    standaloneRoot: standaloneSkillsRoot,
    copilotRoot: pluginRoot,
    modelCount: explicitCount,
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
    if (options.noModel) {
      console.log("Built model-neutral bundles; every OpenCode profile inherits the session model and effort.");
    } else {
      console.log(`${result.modelCount} of 7 OpenCode profiles carry explicit model routes; the rest inherit the session model.`);
    }
  } catch (error) {
    console.error(`Build failed: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && await realpath(process.argv[1]) === await realpath(fileURLToPath(import.meta.url))) {
  await main();
}
