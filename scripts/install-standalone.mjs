#!/usr/bin/env node

import {
  constants,
  copyFile,
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  realpath,
  rename,
  rm,
  rmdir,
  stat,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, posix, relative, resolve, win32 } from "node:path";
import { fileURLToPath } from "node:url";
import { buildBundles } from "./build.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const stateName = ".agenticale-standalone-install.json";
const backupDirectoryName = ".agents-standalone-backups";
const packageName = "agenticale-standalone";
const stateVersion = 1;

// The four public skills the standalone installer owns. The exact file set is
// discovered by walking the generated standalone build output so the inventory
// always matches what the build produced.
const skillNames = new Set(["work", "autonomous", "pull-request-description", "source-code-lookup"]);

function usage() {
  return `Usage:
  node scripts/install-standalone.mjs [install] [--scope project|user]
                                      [--target PATH] [--source-root PATH]
                                      (--models PATH|PRESET | --no-model)
                                      [--effort LEVEL] [--routing PATH]
                                      [--replace] [--dry-run]
  node scripts/install-standalone.mjs uninstall [--scope project|user]
                                               [--target PATH] [--dry-run]

Installs the GENERATED standalone skills (built to a temp root, then copied)
into a project or user skills folder. It installs skill resources only and
does not require any native agent or plugin. The four skill folders (work,
autonomous, pull-request-description, source-code-lookup) are written directly
under the destination.

This installer serves Codex CLI, the VS Code extension, Codex in the ChatGPT
desktop app, and other clients that read a .agents/skills directory.

Scopes (used to pick the default destination; --target overrides both):
  project  <current working directory>/.agents/skills
  user     ~/.agents/skills, Codex's user-level skill discovery location
           (on Windows, %USERPROFILE%\\.agents\\skills)

Options:
  --target PATH  Explicit destination; the .agents/skills folder the four
                 skill folders are written directly under (wins over --scope)
  --scope project|user
                 Which default destination to use (default: project)
  --source-root PATH
                 Local source checkout root for the source-code-lookup skill
                 (default in the skill: ~/dev)
  --models PATH|PRESET
                 JSON mapping or bundled preset (openai, zen, local, example)
                 converted to the routing contract
  --no-model      Explicitly make every route inherit the session model
  --effort LEVEL  Route-wide reasoning-effort override (low/medium/high/xhigh/max)
  --routing PATH  Build from a caller-supplied routing file instead of the
                  packaged skills/work/references/routing.json
  --replace      Back up and replace differing destinations during install/update
  --dry-run      Print the planned operation without changing the filesystem
  --help         Show this help

Safety:
  The destination must not overlap this repository checkout. Differing content
  already at a destination fails the install (changing nothing) unless
  --replace is given, in which case it is backed up under
  .agents-standalone-backups/ first and replaced. Owned files are tracked in
  .agenticale-standalone-install.json (schema 1) with sha256 digests. A dry run
  prints the plan and changes nothing. A failed install is rolled back
  best-effort. Uninstall removes only unmodified owned files, preserves and
  reports modified ones, removes empty directories, and deletes the state
  file.`;
}

function parseArguments(argv) {
  let command = "install";
  let commandSeen = false;
  let scope = "project";
  let target;
  let sourceRoot;
  let models;
  let routing;
  let noModel = false;
  let effort;
  let effortOverride = false;
  let replace = false;
  let dryRun = false;

  const requireValue = (index, option) => {
    if (index + 1 >= argv.length || !argv[index + 1] || argv[index + 1].startsWith("-")) {
      throw new Error(`${option} requires a value that is not another option.`);
    }
    return argv[index + 1];
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "install" || argument === "uninstall") {
      if (commandSeen) throw new Error(`Only one command may be supplied (found '${argument}').`);
      command = argument;
      commandSeen = true;
    } else if (argument === "--scope") {
      if (scope !== "project") throw new Error("--scope may be supplied only once.");
      scope = requireValue(index, "--scope");
      index += 1;
    } else if (argument.startsWith("--scope=")) {
      if (scope !== "project") throw new Error("--scope may be supplied only once.");
      scope = argument.slice("--scope=".length);
    } else if (argument === "--target") {
      target = requireValue(index, "--target");
      index += 1;
    } else if (argument.startsWith("--target=")) {
      target = argument.slice("--target=".length);
      if (!target || target.startsWith("-")) throw new Error("--target requires a path, not another option.");
    } else if (argument === "--source-root") {
      if (sourceRoot !== undefined) throw new Error("--source-root may be supplied only once.");
      sourceRoot = requireValue(index, "--source-root");
      index += 1;
    } else if (argument.startsWith("--source-root=")) {
      if (sourceRoot !== undefined) throw new Error("--source-root may be supplied only once.");
      sourceRoot = argument.slice("--source-root=".length);
      if (!sourceRoot || sourceRoot.startsWith("-")) throw new Error("--source-root requires a path, not another option.");
    } else if (argument === "--models") {
      if (models !== undefined) throw new Error("--models may be supplied only once.");
      models = requireValue(index, "--models");
      index += 1;
    } else if (argument.startsWith("--models=")) {
      if (models !== undefined) throw new Error("--models may be supplied only once.");
      models = argument.slice("--models=".length);
    } else if (argument === "--routing") {
      if (routing !== undefined) throw new Error("--routing may be supplied only once.");
      routing = requireValue(index, "--routing");
      index += 1;
    } else if (argument.startsWith("--routing=")) {
      if (routing !== undefined) throw new Error("--routing may be supplied only once.");
      routing = argument.slice("--routing=".length);
    } else if (argument === "--no-model") {
      noModel = true;
    } else if (argument === "--effort") {
      if (effort !== undefined) throw new Error("--effort may be supplied only once.");
      effort = requireValue(index, "--effort");
      effortOverride = true;
      index += 1;
    } else if (argument.startsWith("--effort=")) {
      if (effort !== undefined) throw new Error("--effort may be supplied only once.");
      effort = argument.slice("--effort=".length);
      effortOverride = true;
    } else if (argument === "--replace") {
      replace = true;
    } else if (argument === "--dry-run") {
      dryRun = true;
    } else if (argument === "--help" || argument === "-h") {
      return { help: true };
    } else {
      throw new Error(`Unknown argument '${argument}'.`);
    }
  }

  if (scope !== "project" && scope !== "user") {
    throw new Error(`--scope must be 'project' or 'user' (got '${scope}').`);
  }
  if (command === "uninstall" && (replace || models !== undefined || routing !== undefined || noModel || effortOverride || sourceRoot !== undefined)) {
    throw new Error("--replace, --models, --routing, --effort, --no-model, and --source-root apply only to install/update, not uninstall.");
  }
  if (models !== undefined && noModel) {
    throw new Error("--models and --no-model cannot be used together.");
  }
  if (routing !== undefined && models !== undefined) {
    throw new Error("--routing and --models cannot be used together.");
  }
  if (command === "install" && models === undefined && routing === undefined && !noModel) {
    throw new Error("Install requires --models PATH|PRESET, --routing PATH, or --no-model.");
  }

  const defaultTarget = target
    ? resolve(target)
    : scope === "user"
      ? join(homedir(), ".agents", "skills")
      : join(process.cwd(), ".agents", "skills");

  return {
    command,
    scope,
    target: defaultTarget,
    models,
    routing: routing === undefined ? null : resolve(routing),
    sourceRoot: sourceRoot === undefined ? null : resolveSourceRoot(sourceRoot),
    noModel,
    effort,
    effortOverride,
    replace,
    dryRun,
    help: false,
  };
}

function resolveSourceRoot(value) {
  if (value === "~") return homedir();
  if (value.startsWith("~/") || value.startsWith("~\\")) return resolve(homedir(), value.slice(2));
  return resolve(value);
}

// Build the standalone bundle into a TEMP root and return the copy entries for
// every generated skill file. This installs generated output, never authored
// source: the build copies the four public skills and we walk the produced
// tree so the inventory always matches what the build made. File contents are
// read into memory before the temp root is removed.
async function buildStandaloneEntries(options) {
  const tempRoot = await mkdtemp(join(tmpdir(), "agenticale-standalone-"));
  try {
    await buildBundles({
      output: tempRoot,
      models: options.models ?? null,
      routing: options.routing ?? null,
      noModel: options.noModel,
      effort: options.effort ?? "high",
      effortOverride: options.effortOverride,
      sourceRoot: options.sourceRoot,
    });
    return await readStandaloneEntries(join(tempRoot, "standalone", ".agents", "skills"));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function readStandaloneEntries(skillsRoot) {
  const rootStatus = await pathStatus(skillsRoot);
  if (!rootStatus?.isDirectory()) throw new Error(`Generated standalone output is missing: ${skillsRoot}.`);
  const entries = [];
  const walk = async (directory) => {
    for (const item of await readdir(directory, { withFileTypes: true })) {
      const absolute = join(directory, item.name);
      if (item.isDirectory()) await walk(absolute);
      else if (item.isFile()) {
        const relativePosix = relative(skillsRoot, absolute).split(/[\\/]/).join("/");
        const root = relativePosix.split("/")[0];
        if (!skillNames.has(root)) throw new Error(`Unexpected generated path outside the four public skills: ${relativePosix}.`);
        const content = await readFile(absolute);
        entries.push({
          path: relativePosix,
          kind: "file",
          content,
          digest: digest(content),
        });
      }
    }
  };
  await walk(skillsRoot);
  if (entries.length === 0) throw new Error("Generated standalone output contains no files.");
  entries.sort((a, b) => a.path.localeCompare(b.path));
  return entries;
}

function digest(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function pathStatus(path) {
  try {
    return await lstat(path);
  } catch (error) {
    // ENOENT means the entry is absent. ENOTDIR means an ancestor is a file or
    // a symlink-to-file, so the deeper path also does not exist as an entry
    // (lstat resolves the name path through each parent; it cannot descend into
    // one). On POSIX both mean "not present here", so treat ENOTDIR as absent
    // too. Windows does not surface ENOTDIR for these name paths.
    if (error.code === "ENOENT" || error.code === "ENOTDIR") return null;
    throw error;
  }
}

function normalizedPath(path) {
  const normalized = resolve(path);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function pathIsWithin(root, candidate) {
  const difference = relative(normalizedPath(root), normalizedPath(candidate));
  return difference === "" || (!difference.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
    && difference !== ".." && !isAbsolute(difference));
}

async function physicalPath(path) {
  const requested = resolve(path);
  let existing = requested;
  const missing = [];
  while (!await pathStatus(existing)) {
    const parent = dirname(existing);
    if (parent === existing) throw new Error(`Cannot resolve an existing ancestor for ${requested}.`);
    missing.unshift(basename(existing));
    existing = parent;
  }
  const physicalAncestor = await realpath(existing);
  return resolve(physicalAncestor, ...missing);
}

// The destination must not overlap this repository checkout (in either
// direction), so a project-scope install into the repo we are shipping from is
// rejected rather than mutating the source tree.
async function selectPhysicalTarget(target) {
  const physicalTarget = await physicalPath(target);
  const physicalRepository = await realpath(repositoryRoot);
  if (pathIsWithin(physicalRepository, physicalTarget) || pathIsWithin(physicalTarget, physicalRepository)) {
    throw new Error(`The target and this checkout must not overlap: ${target}. Choose a separate standalone skills folder.`);
  }
  const status = await pathStatus(physicalTarget);
  if (status && !status.isDirectory()) {
    throw new Error(`The selected destination is not a directory: ${physicalTarget}.`);
  }
  return physicalTarget;
}

async function assertManagedParentSafe(target, path, allowedLinkedAncestors = null) {
  if (!pathIsWithin(target, path)) {
    throw new Error(`Managed path escapes the selected destination: ${path}.`);
  }
  const parent = dirname(path);
  const difference = relative(target, parent);
  let current = target;
  const components = difference ? difference.split(/[\\/]/) : [];
  for (const component of components) {
    current = join(current, component);
    const status = await pathStatus(current);
    if (!status) break;
    if (status.isSymbolicLink()) {
      // F11: an owned link that this run's retirement removes is exempt. It will
      // be replaced by a real directory inside the destination, so it is not an
      // external confinement hazard the way a foreign junction is.
      if (allowedLinkedAncestors && allowedLinkedAncestors.has(normalizedPath(current))) {
        continue;
      }
      throw new Error(`Managed path has a linked ancestor outside the physical destination boundary: ${current}.`);
    }
    if (!status.isDirectory()) {
      throw new Error(`Managed path ancestor is not a directory: ${current}.`);
    }
    const physical = await realpath(current);
    if (!pathIsWithin(target, physical)) {
      throw new Error(`Managed path resolves outside the selected destination: ${current}.`);
    }
  }
}

async function assertPhysicalTargetStable(target) {
  const status = await pathStatus(target);
  if (!status?.isDirectory() || status.isSymbolicLink() || normalizedPath(await realpath(target)) !== normalizedPath(target)) {
    throw new Error(`The selected destination no longer resolves to its verified physical directory: ${target}.`);
  }
}

async function entryMatches(entry) {
  const destinationStatus = await pathStatus(entry.destination);
  if (!destinationStatus) return false;
  if (!destinationStatus.isFile() || destinationStatus.isSymbolicLink()) return false;
  return digest(await readFile(entry.destination)) === entry.digest;
}

function storedEntry(entry) {
  return { path: entry.path, kind: entry.kind, digest: entry.digest };
}

function safeStatePath(path) {
  return typeof path === "string" && path.length > 0
    && !path.includes("\\") && !posix.isAbsolute(path) && !win32.isAbsolute(path)
    && posix.normalize(path) === path
    && !path.split("/").some((part) => part === "." || part === "..");
}

// Schema 1: a fully-constrained, dynamic file set because the skill files are
// walked from the build. Only the four public skill directories are allowed,
// all as regular files with a sha256 digest.
function validateEntries(entries, statePath) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error(`Install state does not contain the entry set: ${statePath}. Move it aside and retry.`);
  }
  const seenSkills = new Set();
  const seenPaths = new Set();
  for (const entry of entries) {
    const validPayload = entry?.kind === "file"
      && typeof entry?.digest === "string" && /^[0-9a-f]{64}$/.test(entry.digest);
    if (!entry || typeof entry !== "object" || Array.isArray(entry)
        || JSON.stringify(Object.keys(entry).sort()) !== JSON.stringify(["digest", "kind", "path"])
        || !safeStatePath(entry.path) || !validPayload) {
      throw new Error(`Install state contains an invalid entry: ${statePath}. Move it aside and retry, or restore a valid package state file.`);
    }
    const parts = entry.path.split("/");
    if (!skillNames.has(parts[0])) {
      throw new Error(`Install state has an unexpected generated skill: ${statePath}. Move it aside and retry.`);
    }
    seenSkills.add(parts[0]);
    if (seenPaths.has(entry.path)) throw new Error(`Install state duplicates a path: ${statePath}.`);
    seenPaths.add(entry.path);
  }
  if (seenSkills.size !== skillNames.size) {
    throw new Error(`Install state does not contain all four generated skills: ${statePath}. Move it aside and retry.`);
  }
}

function validateState(value, statePath) {
  const topLevelKeys = ["entries", "installedAt", "package", "schema", "scope", "sourceLayout"];
  if (!value || typeof value !== "object" || Array.isArray(value)
      || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(topLevelKeys)
      || value.schema !== stateVersion || value.package !== packageName
      || !["project", "user"].includes(value.scope) || !Array.isArray(value.entries)
      || typeof value.installedAt !== "string" || !Number.isFinite(Date.parse(value.installedAt))
      || typeof value.sourceLayout !== "string") {
    throw new Error(`Install state is invalid: ${statePath}. Move it aside and retry, or restore a valid package state file.`);
  }
  validateEntries(value.entries, statePath);
  return value;
}

async function readState(target, required = false) {
  const statePath = join(target, stateName);
  const status = await pathStatus(statePath);
  if (!status) {
    if (required) {
      throw new Error(`No install state found at ${statePath}. Nothing can be safely uninstalled from this target.`);
    }
    return null;
  }
  if (!status.isFile() || status.isSymbolicLink()) {
    throw new Error(`Install state is not a regular file: ${statePath}. Move it aside and retry.`);
  }
  try {
    return validateState(JSON.parse(await readFile(statePath, "utf8")), statePath);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Install state is not valid JSON: ${statePath}. Move it aside and retry.`);
    }
    throw error;
  }
}

async function createUniqueBackupDirectory(target) {
  const root = join(target, backupDirectoryName);
  await assertManagedParentSafe(target, join(root, "entry"));
  await mkdir(root, { recursive: true });
  await assertManagedParentSafe(target, join(root, "entry"));
  const base = new Date().toISOString().replace(/[:.]/g, "-");
  for (let suffix = 0; suffix < 1000; suffix += 1) {
    const candidate = join(root, suffix === 0 ? base : `${base}-${suffix}`);
    try {
      await mkdir(candidate, { recursive: false });
      return candidate;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
  throw new Error(`Could not allocate a backup directory under ${root}.`);
}

async function copyForBackup(source, destination) {
  const sourceStatus = await lstat(source);
  await mkdir(dirname(destination), { recursive: true });
  if (sourceStatus.isSymbolicLink()) {
    const linkTarget = await readlink(source);
    let type;
    if (process.platform === "win32") {
      try {
        type = (await stat(source)).isDirectory() ? "junction" : "file";
      } catch {
        type = "file";
      }
    }
    await symlink(linkTarget, destination, type);
  } else if (sourceStatus.isDirectory()) {
    await cp(source, destination, { recursive: true, errorOnExist: true, force: false, verbatimSymlinks: true });
  } else {
    await copyFile(source, destination, constants.COPYFILE_EXCL);
  }
}

async function removeDestination(path) {
  const status = await lstat(path);
  if (status.isDirectory() && !status.isSymbolicLink()) {
    await rm(path, { recursive: true, force: false });
  } else {
    await unlink(path);
  }
}

async function writeState(target, state) {
  const statePath = join(target, stateName);
  const temporary = `${statePath}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  try {
    await rename(temporary, statePath);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

function equivalentState(existing, scope, sourceLayout, entries) {
  if (!existing || existing.scope !== scope || existing.sourceLayout !== sourceLayout || existing.entries.length !== entries.length) return false;
  return JSON.stringify(existing.entries) === JSON.stringify(entries.map(storedEntry));
}

// True when `candidate` is (or lives under) one of the removed paths.
function isCoveredBy(removedPaths, candidate) {
  return removedPaths.some((path) => candidate === path || candidate.startsWith(`${path}/`));
}

// R11/F7: duplicate-source detection across the scopes Codex actually discovers
// (user and project .agents/skills), not just this destination. The same four
// skills can be installed into two scopes and both will surface in a client
// selector, so a fresh install into one scope must notice an AgenticAle marker
// left by ANY installer in a sibling discoverable scope. Surface the documented
// choice; do not block. Plugin stores are probed too, but their state is less
// reliably detectable, so the notice also names the explicit choice to make.
const DUPLICATE_SOURCE_MARKERS = [
  ".agenticale-standalone-install.json",
  ".autonomous-mode-install.json",
];

// The skill scopes Codex discovers locally. --target can point anywhere, so we
// always probe the canonical user and project roots in addition to the target.
async function discoverableSkillRoots(target) {
  const roots = [
    join(homedir(), ".agents", "skills"),
    join(process.cwd(), ".agents", "skills"),
  ];
  if (target) roots.push(target);
  return [...new Set(roots.map((root) => resolve(root)))];
}

async function findAgenticaleMarker(root) {
  const candidates = [...DUPLICATE_SOURCE_MARKERS, "plugin.json"];
  for (const marker of candidates) {
    const markerPath = join(root, marker);
    if (marker === "plugin.json") {
      const status = await pathStatus(markerPath);
      if (!status?.isFile()) continue;
      try {
        const manifest = JSON.parse(await readFile(markerPath, "utf8"));
        if (manifest?.name === "agenticale") return markerPath;
      } catch {
        // unreadable manifest; not our package
      }
    } else if (await pathStatus(markerPath)) {
      return markerPath;
    }
  }
  return null;
}

async function detectDuplicateSource(target) {
  for (const root of await discoverableSkillRoots(target)) {
    for (const probe of [root, dirname(root)]) {
      const marker = await findAgenticaleMarker(probe);
      if (marker) return marker;
    }
  }
  return null;
}

// R12: reconcile an existing current-schema install with the new inventory.
// Unmodified owned files no longer present in the new inventory are retired;
// modified ones are preserved and reported.
async function planRetirement(existingState, entries, target) {
  const newInventoryPaths = new Set(entries.map((entry) => entry.path));
  const newDigests = new Map(entries.map((entry) => [entry.path, entry.digest]));
  const removes = [];
  const preserved = [];
  for (const stored of existingState.entries) {
    const destination = join(target, stored.path);
    const inNew = newInventoryPaths.has(stored.path);
    const status = await pathStatus(destination);
    if (!status) continue; // already gone
    if (!status.isFile() || status.isSymbolicLink()) {
      preserved.push({ path: stored.path, destination, inNew });
      continue;
    }
    const unmodified = digest(await readFile(destination)) === stored.digest;
    if (!unmodified) {
      preserved.push({ path: stored.path, destination, inNew });
      continue;
    }
    if (!inNew || newDigests.get(stored.path) !== stored.digest) {
      removes.push({ path: stored.path, destination, inNew });
    }
  }
  return { removes, preserved };
}

async function installBundle(options) {
  options.target = await selectPhysicalTarget(options.target);
  const existingState = await readState(options.target);
  const entries = await buildStandaloneEntries(options);
  for (const entry of entries) entry.destination = join(options.target, entry.path);

  const retirement = existingState !== null
    ? await planRetirement(existingState, entries, options.target)
    : { removes: [], preserved: [] };
  const removedSet = retirement.removes.map(({ path }) => path);
  const duplicate = existingState === null ? await detectDuplicateSource(options.target) : null;

  const plans = [];
  for (const entry of entries) {
    if (isCoveredBy(removedSet, entry.path)) {
      plans.push({ action: "create", entry });
      continue;
    }
    const destinationStatus = await pathStatus(entry.destination);
    if (!destinationStatus) plans.push({ action: "create", entry });
    else if (await entryMatches(entry)) plans.push({ action: "keep", entry });
    else plans.push({ action: "replace", entry });
  }

  const collisions = plans.filter((plan) => plan.action === "replace");
  if (collisions.length > 0 && !options.replace) {
    const paths = collisions.map(({ entry }) => `  - ${entry.destination}`).join("\n");
    throw new Error(`Differing content already exists at:\n${paths}\nNo changes were made. Re-run with --replace to back it up and replace it.`);
  }

  const sourceLayout = [...skillNames].sort().join(",");
  console.log(`${options.dryRun ? "Dry-run " : ""}Install (standalone skills) -> ${options.target}`);
  if (duplicate) {
    console.log(`  notice: another AgenticAle install appears present (${duplicate}).`);
    console.log("    This installer owns only the standalone skill set; the plugin/OpenCode installers own their own copies.");
    console.log("    Installing both can duplicate the four skills. Pick one source of truth and uninstall the other if that is not intended.");
  }
  for (const { path } of retirement.removes) console.log(`  retire: ${path}`);
  for (const { path, inNew } of retirement.preserved) {
    console.log(`  preserve-modified: ${path} (modified; left in place${inNew ? "; collides with the new file, re-run with --replace" : ""})`);
  }
  for (const plan of plans) console.log(`  ${plan.action}: ${plan.entry.path}`);
  if (options.dryRun) {
    if (collisions.length > 0 || retirement.removes.length > 0) {
      console.log(`  backup: ${collisions.length + retirement.removes.length} path(s) under ${backupDirectoryName}/`);
    }
    console.log("Dry run complete; no files were changed.");
    return;
  }

  const upToDate = retirement.removes.length === 0
    && plans.every(({ action }) => action === "keep")
    && equivalentState(existingState, options.scope, sourceLayout, entries);
  if (upToDate) {
    console.log("Already up to date.");
    console.log("Next: point your client at this .agents/skills folder; this installer installs skill resources only and requires no native agent.");
    return;
  }

  await mkdir(options.target, { recursive: true });
  await assertPhysicalTargetStable(options.target);

  const touchedPaths = new Set([
    ...retirement.removes.map(({ path }) => path),
    ...plans.filter(({ action }) => action !== "keep").map(({ entry }) => entry.path),
  ]);
  const preExisting = new Set();
  for (const path of touchedPaths) {
    if (await pathStatus(join(options.target, path))) preExisting.add(path);
  }
  const statePath = join(options.target, stateName);
  const statePreExisted = (await pathStatus(statePath)) !== null;

  // F2: capture the pre-update state bytes in memory so rollback can restore
  // them independently of whether a content backup directory exists. The
  // mutation itself is gated by the per-write assertManagedParentSafe calls in
  // the loop below; on failure we roll back and restore this state.
  const originalStateBytes = statePreExisted ? await readFile(statePath) : null;

  // F11: validate every planned mutation's existing ancestors BEFORE backing up
  // or changing any content. A foreign linked ancestor must reject the whole run
  // before the first mutation so there is nothing for rollback to undo. An owned
  // path the retirement removes is exempt: it is replaced by a real directory in
  // the destination, so a plan writing through it is safe (it is removed first).
  const allowedLinkedAncestors = new Set(retirement.removes.map(({ destination }) => normalizedPath(destination)));
  for (const { destination } of retirement.removes) {
    await assertManagedParentSafe(options.target, destination);
  }
  for (const { action, entry } of plans) {
    if (action === "keep") continue;
    await assertManagedParentSafe(options.target, entry.destination, allowedLinkedAncestors);
  }

  let backupDirectory = null;
  if (preExisting.size > 0) {
    backupDirectory = await createUniqueBackupDirectory(options.target);
    for (const path of preExisting) await copyForBackup(join(options.target, path), join(backupDirectory, path));
    if (statePreExisted) await copyForBackup(statePath, join(backupDirectory, stateName));
    await writeFile(join(backupDirectory, "backup.json"), `${JSON.stringify({
      package: packageName,
      createdAt: new Date().toISOString(),
      target: options.target,
      removed: retirement.removes.map(({ path }) => path),
      replaced: collisions.map(({ entry }) => entry.path),
    }, null, 2)}\n`, "utf8");
    console.log(`  backup created: ${backupDirectory}`);
  }

  // F11: only paths actually mutated by this run are rolled back; a planned path
  // whose parent check refused the operation is never added, so rollback can
  // never delete or rewrite a file the run itself refused to touch.
  const mutatedPaths = new Set();
  try {
    for (const { path, destination } of retirement.removes) {
      await assertManagedParentSafe(options.target, destination);
      await removeDestination(destination);
      mutatedPaths.add(path);
    }
    for (const { action, entry } of plans) {
      if (action === "keep") continue;
      await assertManagedParentSafe(options.target, entry.destination);
      await mkdir(dirname(entry.destination), { recursive: true });
      await assertManagedParentSafe(options.target, entry.destination);
      if (action === "replace") await removeDestination(entry.destination);
      // F13: register the path before the write. A replace has already removed
      // the destination, and a create/replace write can leave a partial file
      // before failing; either way the path must be rolled back.
      mutatedPaths.add(entry.path);
      await writeFile(entry.destination, entry.content, { flag: "wx" });
    }

    if (!equivalentState(existingState, options.scope, sourceLayout, entries)) {
      await mkdir(options.target, { recursive: true });
      await writeState(options.target, {
        schema: stateVersion,
        package: packageName,
        scope: options.scope,
        sourceLayout,
        installedAt: new Date().toISOString(),
        entries: entries.map(storedEntry),
      });
    }
  } catch (error) {
    let rollbackError = null;
    try {
      // F11: confine restoration to the paths this run actually mutated, and
      // re-check each parent so a restoration cannot follow a link either.
      for (const path of mutatedPaths) {
        const destination = join(options.target, path);
        await assertManagedParentSafe(options.target, destination);
        if (!preExisting.has(path)) {
          // Created or removed by this run: undo by deleting it again.
          if (await pathStatus(destination)) await removeDestination(destination);
          continue;
        }
        // Pre-existing and differing: remove, then restore the backed-up copy.
        if (await pathStatus(destination)) await removeDestination(destination);
        if (backupDirectory) {
          const backup = join(backupDirectory, path);
          if (await pathStatus(backup)) {
            await assertManagedParentSafe(options.target, destination);
            await copyForBackup(backup, destination);
          }
        }
      }
      // F2: restore the pre-update state from memory (not the backup directory),
      // and only when it changed, so a missing-file repair still keeps ownership.
      if (await pathStatus(statePath)) {
        const currentStateBytes = await readFile(statePath);
        if (originalStateBytes === null) {
          await removeDestination(statePath);
        } else if (currentStateBytes.compare(originalStateBytes) !== 0) {
          await writeFile(statePath, originalStateBytes, { encoding: "utf8" });
        }
      } else if (originalStateBytes !== null) {
        await writeFile(statePath, originalStateBytes, { encoding: "utf8" });
      }
    } catch (rollbackFailure) {
      rollbackError = rollbackFailure;
    }
    const recovery = backupDirectory
      ? ` Backup retained at ${backupDirectory}.`
      : " No existing differing content was replaced.";
    const rollback = rollbackError
      ? ` Automatic rollback also failed: ${rollbackError.message}.`
      : " Partial install changes were rolled back.";
    throw new Error(`Installation did not complete: ${error.message}.${rollback}${recovery}`);
  }

  console.log("Installation complete.");
  console.log("Next: point your client at this .agents/skills folder; this installer installs skill resources only and requires no native agent.");
}

async function removeEmptyPackageDirectories(target) {
  const directories = [
    // Leaf-first, matching the four public skill layouts.
    "work/references/runtimes",
    "work/references/tasks",
    "work/references",
    "work/agents",
    "work",
    "autonomous/agents",
    "autonomous",
    "pull-request-description",
    "source-code-lookup",
    backupDirectoryName,
  ];
  for (const path of directories) {
    try {
      await rmdir(join(target, path));
    } catch (error) {
      if (!["ENOENT", "ENOTEMPTY", "EEXIST"].includes(error.code)) throw error;
    }
  }
}

async function uninstallBundle(options) {
  options.target = await selectPhysicalTarget(options.target);
  const state = await readState(options.target, true);
  const plans = [];
  for (const stored of state.entries) {
    const entry = { ...stored, destination: join(options.target, stored.path) };
    await assertManagedParentSafe(options.target, entry.destination);
    const destinationStatus = await pathStatus(entry.destination);
    if (!destinationStatus) plans.push({ action: "missing", entry });
    else if (await entryMatches(entry)) plans.push({ action: "remove", entry });
    else plans.push({ action: "preserve-modified", entry });
  }

  console.log(`${options.dryRun ? "Dry-run uninstall" : "Uninstall"} -> ${options.target}`);
  for (const plan of plans) console.log(`  ${plan.action}: ${plan.entry.path}`);
  if (options.dryRun) {
    console.log("Dry run complete; no files were changed.");
    return;
  }

  await assertPhysicalTargetStable(options.target);
  for (const { entry } of plans) await assertManagedParentSafe(options.target, entry.destination);

  for (const { action, entry } of plans) {
    if (action === "remove") await removeDestination(entry.destination);
  }
  await unlink(join(options.target, stateName));
  await removeEmptyPackageDirectories(options.target);

  const preserved = plans.filter(({ action }) => action === "preserve-modified").length;
  console.log(`Uninstall complete.${preserved ? ` Preserved ${preserved} modified destination(s).` : ""}`);
}

async function main() {
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
    if (options.help) {
      console.log(usage());
      return;
    }
    if (options.command === "install") await installBundle(options);
    else await uninstallBundle(options);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    console.error("Run with --help for usage.");
    process.exitCode = 1;
  }
}

await main();
