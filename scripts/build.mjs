#!/usr/bin/env node

import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { lstat, mkdir, readFile, readdir, realpath, rm, stat, writeFile } from "node:fs/promises";
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
const RUNTIME_KEYS = ["copilot", "codex", "opencode"];
const TOP_LEVEL_ROUTING_KEYS = ["provenance", "runtimes", "schemaVersion"];
const EXPLICIT_ENTRY_KEYS = ["fallbacks", "mode", "model", "reasoningEffort"];
const INHERIT_ENTRY_KEYS = ["mode"];
const modelPresets = new Map([
  ["example", "examples/example.json"],
  ["local", "examples/local.json"],
  ["openai", "examples/openai.json"],
  ["gpt", "examples/gpt.json"],
  ["zen", "examples/gpt.json"],
]);

// The three output roots (relative to the build output directory) that the
// build owns and regenerates on every run.
const OUTPUT_ROOTS = ["plugin/agenticale", "standalone/.agents/skills", "opencode"];
const CURRENT_BUILD_STATE_VERSION = 2;
// The schema-1 baseline build owned the retired copilot package output.
const LEGACY_OUTPUT_ROOTS = ["opencode", "copilot/agenticale"];

// The four public skills that ship in every output root.
const SKILL_NAMES = ["work", "autonomous", "pull-request-description", "source-code-lookup"];

export const pluginManifest = {
  $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  name: "agenticale",
  version: "0.3.0",
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
                         [--routing PATH | --models PATH|PRESET] [--no-model]
                         [--effort LEVEL] [--source-root PATH]

Builds the skills-first bundle from the common core and the OpenCode adapter:
  <output>/plugin/agenticale            Agent Plugins 1.0 package (skills + plugin.json)
  <output>/standalone/.agents/skills    standalone (project) skill binding
  <output>/opencode                     OpenCode V2 binding (skills + generated profiles)

Options:
  --output PATH         Build root (default: dist)
  --routing PATH        Build from a caller-supplied routing file instead of the
                        packaged skills/work/references/routing.json
  --models PATH|PRESET  Legacy import: read an examples mapping and convert it to
                        the routing contract (presets: gpt, openai, zen, local,
                        example)
  --no-model            Omit model and reasoning-effort; every route inherits
  --effort LEVEL        Route-wide reasoning-effort override (low/medium/high/
                        xhigh/max); overrides the effort of every route
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
  let routing = null;
  let noModel = false;
  let effort = "high";
  let effortOverride = false;
  let coordinatorEffortRetired = false;
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
    } else if (argument === "--routing") {
      routing = requireValue(argv, index, argument);
      index += 1;
    } else if (argument.startsWith("--routing=")) {
      routing = argument.slice("--routing=".length);
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
      requireValue(argv, index, argument);
      index += 1;
      coordinatorEffortRetired = true;
    } else if (argument.startsWith("--coordinator-effort=")) {
      coordinatorEffortRetired = true;
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

  if (coordinatorEffortRetired) {
    console.log("Note: --coordinator-effort is retired; the session (coordinator) now owns its own effort, so this option is ignored.");
  }
  if (noModel && models) {
    throw new Error("--models and --no-model cannot be used together.");
  }
  if (routing && models) {
    throw new Error("Conflicting routing inputs: --routing and --models cannot be used together.");
  }
  if (!effortLevels.has(effort)) throw new Error(`Invalid --effort '${effort}'.`);
  if (resolve(output) === repositoryRoot) {
    throw new Error("--output must not be the repository root.");
  }

  return { output, models, routing, noModel, effort, effortOverride, sourceRoot, help: false };
}

function modelPath(value) {
  const preset = modelPresets.get(value.toLowerCase());
  return preset ? join(repositoryRoot, preset) : resolve(value);
}

async function readLegacyModels(value) {
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
    if (typeof model !== "string" || model.length === 0) throw new Error(`Invalid model for ${role}.`);
  }
  return parsed;
}

// Convert a legacy `role -> provider/model[#variant]` inventory into the
// versioned routing contract. Present roles become explicit routes for all
// three runtimes (the provider prefix is preserved verbatim); omitted roles
// become explicit inheritance. Legacy values without an effort variant carry
// the legacy default effort so the imported policy stays a complete, strict
// policy.
function legacyToRouting(inventory) {
  const runtimes = { copilot: {}, codex: {}, opencode: {} };
  const omitted = [];
  for (const role of roles) {
    const raw = inventory[role];
    if (typeof raw !== "string" || raw.length === 0) {
      omitted.push(role);
      for (const runtime of ["copilot", "codex", "opencode"]) {
        runtimes[runtime][role] = { mode: "inherit" };
      }
      continue;
    }
    const hash = raw.lastIndexOf("#");
    const model = hash >= 0 ? raw.slice(0, hash) : raw;
    const variant = hash >= 0 ? raw.slice(hash + 1) : null;
    const entry = { mode: "explicit", model, fallbacks: [] };
    if (variant) {
      if (!effortLevels.has(variant)) {
        throw new Error(`Legacy model for ${role} has unsupported effort variant '#${variant}'.`);
      }
      entry.reasoningEffort = variant;
    } else {
      entry.reasoningEffort = "high";
    }
    for (const runtime of ["copilot", "codex", "opencode"]) runtimes[runtime][role] = entry;
  }
  return {
    routing: {
      schemaVersion: 1,
      provenance: "Imported from a legacy --models inventory.",
      runtimes,
    },
    omitted,
  };
}

// The single authoritative routing-policy schema, shared by the builder (which
// validates packaged, imported, and caller-supplied policies) and by
// validate.mjs (which statically checks the shipped policy and the generated
// installs). Every declared policy is complete and strict:
//   - schemaVersion must be 1; provenance, when present, is a non-empty string.
//   - runtimes maps a non-empty subset of copilot/codex/opencode.
//   - each declared runtime maps exactly the seven keys (a missing key is an
//     error, not an implicit inheritance).
//   - explicit routes require a non-empty model and a supported effort and may
//     carry an ordered fallbacks list of { model, reasoningEffort } pairs.
//   - inherit routes carry only `mode`; model/effort/fallbacks are contradictory.
// Exact native model identifiers and the per-host effort set are adapter
// concerns; this validates the policy-level shape only.
export function strictValidateRouting(routing) {
  if (!routing || typeof routing !== "object" || Array.isArray(routing)) {
    throw new Error("Routing must be a JSON object.");
  }
  if (routing.schemaVersion !== 1) throw new Error("Routing schemaVersion must be 1.");
  for (const key of Object.keys(routing)) {
    if (!TOP_LEVEL_ROUTING_KEYS.includes(key)) {
      throw new Error(`Routing has unknown top-level key '${key}'.`);
    }
  }
  if (routing.provenance !== undefined && (typeof routing.provenance !== "string" || routing.provenance.length === 0)) {
    throw new Error("Routing provenance, when present, must be a non-empty string.");
  }
  if (!routing.runtimes || typeof routing.runtimes !== "object" || Array.isArray(routing.runtimes)) {
    throw new Error("Routing must include a runtimes object.");
  }
  const runtimeKeys = Object.keys(routing.runtimes);
  if (runtimeKeys.length === 0) throw new Error("Routing must declare at least one runtime.");
  for (const runtime of runtimeKeys) {
    if (!RUNTIME_KEYS.includes(runtime)) throw new Error(`Routing declares unsupported runtime '${runtime}'.`);
  }
  for (const runtime of runtimeKeys) {
    const map = routing.runtimes[runtime];
    if (!map || typeof map !== "object" || Array.isArray(map)) {
      throw new Error(`Routing runtime '${runtime}' must be an object of route entries.`);
    }
    const declaredKeys = Object.keys(map).sort();
    if (JSON.stringify(declaredKeys) !== JSON.stringify([...roles].sort())) {
      throw new Error(`Routing runtime '${runtime}' must map exactly the ${roles.length} keys: ${[...roles].sort().join(", ")}.`);
    }
    for (const role of roles) {
      const entry = map[role];
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        throw new Error(`Routing ${runtime}/${role} must be an object.`);
      }
      const entryKeys = Object.keys(entry).sort();
      if (entry.mode === "explicit") {
        if (JSON.stringify(entryKeys) !== JSON.stringify(EXPLICIT_ENTRY_KEYS)) {
          throw new Error(`Routing ${runtime}/${role} explicit entry must carry exactly: ${EXPLICIT_ENTRY_KEYS.join(", ")}.`);
        }
        if (typeof entry.model !== "string" || entry.model.length === 0) {
          throw new Error(`Routing ${runtime}/${role} explicit route requires a non-empty model.`);
        }
        if (!effortLevels.has(entry.reasoningEffort)) {
          throw new Error(`Routing ${runtime}/${role} explicit route requires a supported reasoningEffort (got '${entry.reasoningEffort}').`);
        }
        if (!Array.isArray(entry.fallbacks)) {
          throw new Error(`Routing ${runtime}/${role} fallbacks must be an array.`);
        }
        entry.fallbacks.forEach((pair, index) => {
          if (!pair || typeof pair !== "object" || Array.isArray(pair)
              || JSON.stringify(Object.keys(pair).sort()) !== JSON.stringify(["model", "reasoningEffort"])) {
            throw new Error(`Routing ${runtime}/${role} fallback ${index} must be a { model, reasoningEffort } pair.`);
          }
          if (typeof pair.model !== "string" || pair.model.length === 0) {
            throw new Error(`Routing ${runtime}/${role} fallback ${index} requires a non-empty model.`);
          }
          if (!effortLevels.has(pair.reasoningEffort)) {
            throw new Error(`Routing ${runtime}/${role} fallback ${index} has unsupported effort '${pair.reasoningEffort}'.`);
          }
        });
      } else if (entry.mode === "inherit") {
        if (JSON.stringify(entryKeys) !== JSON.stringify(INHERIT_ENTRY_KEYS)) {
          throw new Error(`Routing ${runtime}/${role} inherit entry must carry only 'mode'.`);
        }
      } else {
        throw new Error(`Routing ${runtime}/${role} has invalid mode '${entry.mode}'.`);
      }
    }
  }
}

// Validates the builder's routing inputs (packaged, imported, caller-supplied).
export function validateRouting(routing) {
  strictValidateRouting(routing);
}

// The packaged preset is the authoritative fallback for runtimes a caller
// policy leaves undeclared. It is always complete (all three runtimes), so it
// is also the packaged-build source.
async function loadPackagedRouting() {
  const packaged = JSON.parse(
    await readFile(join(repositoryRoot, "skills", "work", "references", "routing.json"), "utf8"),
  );
  validateRouting(packaged);
  return packaged;
}

// F6: the builder always emits all three targets, so the effective policy must
// declare every runtime. A caller policy that omits one would otherwise render
// that host's routes as model-less (silently inheriting). Fill any undeclared
// runtime from the packaged preset before the merged policy is validated and
// rendered. Declared runtimes are never touched, so caller choices win.
function mergeMissingRuntimes(routing, packaged) {
  const merged = structuredClone(routing);
  const added = [];
  for (const [runtime, map] of Object.entries(packaged.runtimes)) {
    if (!merged.runtimes[runtime]) {
      merged.runtimes[runtime] = structuredClone(map);
      added.push(runtime);
    }
  }
  return { merged, added };
}

async function loadRouting(options) {
  if (options.routing) {
    const path = resolve(options.routing);
    let parsed;
    try {
      parsed = JSON.parse(await readFile(path, "utf8"));
    } catch (error) {
      if (error instanceof SyntaxError) throw new Error(`Routing file is not valid JSON: ${path}.`);
      throw error;
    }
    validateRouting(parsed);
    const packaged = await loadPackagedRouting();
    const { merged, added } = mergeMissingRuntimes(parsed, packaged);
    validateRouting(merged);
    const note = added.length
      ? ` (undeclared runtime(s) ${added.join(", ")} merged from the packaged preset)`
      : "";
    return { routing: merged, routingSource: `--routing ${options.routing}${note}` };
  }

  if (options.models) {
    const inventory = await readLegacyModels(options.models);
    const { routing, omitted } = legacyToRouting(inventory);
    validateRouting(routing);
    const report = omitted.length
      ? `Imported legacy --models inventory; ${omitted.length} omitted key(s) converted to explicit inheritance (${omitted.join(", ")}).`
      : "Imported legacy --models inventory (all roles present; none converted to inheritance).";
    return { routing, routingSource: `--models ${options.models} (legacy import)`, importReport: report };
  }

  const packaged = await loadPackagedRouting();
  return { routing: packaged, routingSource: "packaged skills/work/references/routing.json" };
}

// F5: --effort is a route-wide reasoning-effort override and is only meaningful
// on explicit routes. Inheritance means inherit BOTH model and effort, so an
// effort override applied to any inherit route (or to the all-inherit result
// of --no-model) would produce contradictory outputs (a model-less profile
// labeled explicit, while the shipped policy still says inherit). Reject the
// combination up front, before any mutation.
function assertEffortOverrideCompatible(routing, options) {
  if (!options.effortOverride) return;
  if (options.noModel) {
    throw new Error("--effort cannot be combined with --no-model: --no-model inherits both model and effort, so a route-wide effort override is contradictory.");
  }
  const inherited = [];
  for (const [runtime, map] of Object.entries(routing.runtimes)) {
    for (const [role, entry] of Object.entries(map)) {
      if (entry.mode === "inherit") inherited.push(`${runtime}/${role}`);
    }
  }
  if (inherited.length > 0) {
    throw new Error(`--effort cannot be applied to routes that inherit (${inherited.join(", ")}). Inheritance means inherit both model and effort; remove --effort or set those routes to explicit.`);
  }
}

// Resolve a route (a routing key) for a given runtime to either an explicit
// { model, reasoningEffort } choice or an inherit choice. --no-model forces
// inheritance; --effort is a route-wide reasoning-effort override.
function resolveRoute(routing, runtime, route, options) {
  if (options.noModel) return { mode: "inherit" };
  const entry = routing.runtimes[runtime]?.[route];
  if (entry && entry.mode === "explicit") {
    const reasoningEffort = options.effortOverride ? options.effort : entry.reasoningEffort;
    return { mode: "explicit", model: entry.model, reasoningEffort };
  }
  // Inherit routes always inherit both model and effort. --effort can never
  // reach here on an inherit route: assertEffortOverrideCompatible rejects the
  // combination up front, so there is no effort-without-model path to render.
  return { mode: "inherit" };
}

// Each OpenCode profile is one routing key (seven profiles, one per key), so
// the profile name IS the routing key. The task-contract body is resolved
// separately: implement and implement-hard share implement.md.
const TASK_CONTRACT_FOR_PROFILE = {
  "implement-hard": "implement",
};
function taskContractFor(profileName) {
  return TASK_CONTRACT_FOR_PROFILE[profileName] ?? profileName;
}

function renderOpenCodeProfile(profile, resolved, body) {
  const lines = ["---"];
  lines.push(`description: ${profile.description}`);
  lines.push(`mode: ${profile.mode}`);
  lines.push(`steps: ${profile.steps}`);
  if (resolved.mode === "explicit") {
    if (resolved.model) lines.push(`model: ${resolved.model}`);
    if (resolved.reasoningEffort) lines.push(`reasoningEffort: ${resolved.reasoningEffort}`);
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

// Materialize the resolved routing policy: apply --no-model (every route
// inherits) and the route-wide --effort override (every explicit route's effort
// becomes the override). The result is a complete, strict policy ready to ship
// in every generated skill tree. Intentional inheritance and configured
// fallbacks are preserved.
function materializeRouting(routing, options) {
  const resolved = {
    schemaVersion: 1,
    provenance: routing.provenance,
    runtimes: {},
  };
  for (const runtime of Object.keys(routing.runtimes)) {
    resolved.runtimes[runtime] = {};
    for (const role of roles) {
      const entry = routing.runtimes[runtime][role];
      if (options.noModel || entry.mode === "inherit") {
        resolved.runtimes[runtime][role] = { mode: "inherit" };
        continue;
      }
      const next = { mode: "explicit", model: entry.model, fallbacks: entry.fallbacks };
      next.reasoningEffort = options.effortOverride ? options.effort : entry.reasoningEffort;
      resolved.runtimes[runtime][role] = next;
    }
  }
  return resolved;
}

// Copy the four public skills into a skills root, applying the source-root
// override to the source-code-lookup skill where supplied, and materializing
// the resolved routing policy into skills/work/references/routing.json so the
// installed policy reflects the caller's model/effort choices.
async function populateSkillsRoot(skillsRoot, sourceRoot, resolvedRouting) {
  for (const name of SKILL_NAMES) {
    await copyDirTree(join(repositoryRoot, "skills", name), join(skillsRoot, name));
  }
  if (sourceRoot !== null) {
    const lookupPath = join(skillsRoot, "source-code-lookup", "SKILL.md");
    const rendered = renderSourceRoot(await readFile(lookupPath, "utf8"), sourceRoot);
    await writeFile(lookupPath, rendered.replace(/\r\n?/g, "\n"), "utf8");
  }
  if (resolvedRouting !== null) {
    const routingPath = join(skillsRoot, "work", "references", "routing.json");
    await writeText(routingPath, `${JSON.stringify(resolvedRouting, null, 2)}\n`);
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
    throw new Error(`Refusing to build into a path outside the output root: ${anchor}.`);
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
  const { routing, routingSource, importReport } = await loadRouting(options);
  if (importReport) console.log(importReport);
  assertEffortOverrideCompatible(routing, options);
  const resolvedRouting = materializeRouting(routing, options);

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
    const resolved = resolveRoute(routing, "opencode", route, options);
    const bodySource = await readFile(
      join(repositoryRoot, "skills", "work", "references", "tasks", `${taskContractFor(route)}.md`),
      "utf8",
    );
    const body = bodySource.replace(/\r\n?/g, "\n").trim();
    profiles.push({ profile, route, resolved, text: renderOpenCodeProfile(profile, resolved, body) });
  }

  // Remove only the roots this build owns (including the retired baseline
  // copilot output when upgrading), leaving any other content under --output.
  for (const root of ownedRoots) {
    await rm(join(options.output, root), { recursive: true, force: true });
  }
  await mkdir(options.output, { recursive: true });

  const profileRecords = profiles.map(({ profile, route, resolved }) => {
    const record = { name: profile.name, route, steps: profile.steps, mode: resolved.mode };
    if (resolved.model) record.model = resolved.model;
    if (resolved.reasoningEffort) record.reasoningEffort = resolved.reasoningEffort;
    return record;
  });

  await writeFile(statePath, `${JSON.stringify({
    schemaVersion: 2,
    package: { name: pluginManifest.name, version: pluginManifest.version },
    routingSource,
    effortMode: options.effortOverride ? `route-wide override: ${options.effort}` : "per-route",
    noModel: options.noModel,
    sourceRoot: options.sourceRoot,
    outputs: OUTPUT_ROOTS,
    profiles: profileRecords,
  }, null, 2)}\n`, "utf8");

  // 1. Agent Plugins 1.0 package.
  await writeText(join(pluginRoot, "plugin.json"), `${JSON.stringify(pluginManifest, null, 2)}\n`);
  await populateSkillsRoot(join(pluginRoot, "skills"), options.sourceRoot, resolvedRouting);

  // 2. Standalone (project) skill binding.
  await populateSkillsRoot(standaloneSkillsRoot, options.sourceRoot, resolvedRouting);

  // 3. OpenCode V2 binding (generated profiles + discovered skills).
  for (const { profile, text } of profiles) {
    await writeText(join(openCodeRoot, profile.outputPath), text);
  }
  await populateSkillsRoot(join(openCodeRoot, "skills"), options.sourceRoot, resolvedRouting);

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
      console.log("Built model-neutral bundles; OpenCode profiles inherit the session model and effort.");
    } else if (options.effortOverride) {
      console.log(`Applied route-wide effort ${options.effort}; ${result.modelCount} of 7 OpenCode profiles carry explicit model routes.`);
    } else {
      console.log(`${result.modelCount} of 7 OpenCode profiles carry explicit model routes; the rest inherit the session model.`);
    }
  } catch (error) {
    console.error(`Build failed: ${error.message}`);
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
