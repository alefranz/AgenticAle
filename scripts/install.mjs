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
const stateName = ".autonomous-mode-install.json";
const backupDirectoryName = ".autonomous-mode-backups";
const packageName = "opencode-autonomous-mode";
const stateVersion = 6;
// Schema 5 was the first generated-copy schema, but it carried only the six
// pre-`implement-hard` profiles. Schema 6 adds the seventh `implement-hard`
// profile, so schema-5 generated states are migrated like the older schemas.
const legacyGeneratedSchema = 5;

// The current (schema 6) copy inventory installs the GENERATED OpenCode output,
// not the authored repo source. The destination layout is fixed; the exact set
// of files is discovered by walking the build output so it always matches what
// the build produced.
const generatedRoots = ["agents", "skills"];
const retiredCopyRoots = ["agents", "commands", "skills/autonomous-mode", "skills/work-mode"];

// The seven rendered OpenCode profiles the build emits (no coordinator).
const profileNames = new Set(["consult", "deep-review", "explore", "fix", "implement", "implement-hard", "review"]);
// The six profiles the retired schema-5 build emitted (no implement-hard).
const legacyProfileNames = new Set(["consult", "deep-review", "explore", "fix", "implement", "review"]);

// Retired (old install) path inventories, kept so older states (schema 1-4) can
// be validated and migrated. These are relative to the OpenCode target.
const copyPaths = [
  "agents/autonomous/consult.md",
  "agents/autonomous/deep-review.md",
  "agents/autonomous/explore.md",
  "agents/autonomous/fix.md",
  "agents/autonomous/implement-hard.md",
  "agents/autonomous/implement.md",
  "agents/autonomous/review.md",
  "commands/autonomous.md",
  "commands/work.md",
  "skills/autonomous-mode/SKILL.md",
  "skills/work-mode/SKILL.md",
  "skills/work-mode/references/rounds.md",
  "skills/pull-request-description/SKILL.md",
  "skills/source-code-lookup/SKILL.md",
];
const versionThreeCopyPaths = copyPaths.filter((path) => path !== "commands/work.md" && !path.startsWith("skills/work-mode/"));
const versionTwoCopyPaths = versionThreeCopyPaths.filter((path) => path !== "skills/pull-request-description/SKILL.md");
const legacyCopyPaths = versionTwoCopyPaths.filter((path) => path !== "skills/source-code-lookup/SKILL.md");

const linkPaths = [
  "agents/autonomous",
  "commands/autonomous.md",
  "commands/work.md",
  "skills/autonomous-mode",
  "skills/work-mode",
  "skills/pull-request-description",
  "skills/source-code-lookup",
];
const versionThreeLinkPaths = linkPaths.filter((path) => !["commands/work.md", "skills/work-mode"].includes(path));
const versionTwoLinkPaths = versionThreeLinkPaths.filter((path) => path !== "skills/pull-request-description");
const legacyLinkPaths = versionTwoLinkPaths.filter((path) => path !== "skills/source-code-lookup");

function usage() {
  return `Usage:
  node scripts/install.mjs [install] [--target PATH] [--source-root PATH]
                           (--models PATH|PRESET | --no-model) [--effort LEVEL]
                           [--routing PATH] [--replace] [--dry-run]
  node scripts/install.mjs uninstall [--target PATH] [--dry-run]

Installs the GENERATED OpenCode bundle (built to a temp root, then copied) into
the OpenCode configuration directory. It does not link or point at the authored
repository source. Older copy installs (schema 1-4) and link installs are
migrated to the generated copy layout on install.

Options:
  --target PATH  OpenCode configuration directory (default: XDG_CONFIG_HOME/opencode
                 when set, otherwise ~/.config/opencode)
  --source-root PATH
                 Local source checkout root for the source-code-lookup skill
                 (default in the skill: ~/dev)
  --models PATH|PRESET
                 JSON mapping or bundled preset (openai, zen, local, example)
                 converted to the routing contract; unspecified roles inherit
                 the session model
  --no-model      Explicitly make every route inherit the session model
  --effort LEVEL  Route-wide reasoning-effort override (low/medium/high/xhigh/max)
  --routing PATH  Build from a caller-supplied routing file instead of the
                  packaged skills/work/references/routing.json
  --replace      Back up and replace differing destinations during install/update
  --dry-run      Print the planned operation without changing the filesystem
  --help         Show this help`;
}

function parseArguments(argv) {
  let command = "install";
  let target;
  let sourceRoot;
  let models;
  let routing;
  let noModel = false;
  let effort;
  let effortOverride = false;
  let replace = false;
  let dryRun = false;
  let commandSeen = false;

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

  const defaultBase = process.env.XDG_CONFIG_HOME
    ? resolve(process.env.XDG_CONFIG_HOME)
    : join(homedir(), ".config");

  return {
    command,
    target: resolve(target ?? join(defaultBase, "opencode")),
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

// Build the OpenCode bundle into a TEMP root and return the copy entries for
// every generated file. This installs generated output, never authored source:
// the build renders the seven profiles and copies the four public skills, and we
// walk the produced tree so the inventory always matches what the build made.
// File contents are read into memory before the temp root is removed.
async function buildOpenCodeEntries(options) {
  const tempRoot = await mkdtemp(join(tmpdir(), "agenticale-opencode-"));
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
    return await readGeneratedEntries(join(tempRoot, "opencode"));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function readGeneratedEntries(openCodeRoot) {
  const rootStatus = await pathStatus(openCodeRoot);
  if (!rootStatus?.isDirectory()) throw new Error(`Generated OpenCode output is missing: ${openCodeRoot}.`);
  const entries = [];
  const walk = async (directory) => {
    for (const item of await readdir(directory, { withFileTypes: true })) {
      const absolute = join(directory, item.name);
      if (item.isDirectory()) await walk(absolute);
      else if (item.isFile()) {
        const relativePosix = relative(openCodeRoot, absolute).split(/[\\/]/).join("/");
        const root = relativePosix.split("/")[0];
        if (!generatedRoots.includes(root)) throw new Error(`Unexpected generated path outside bundle roots: ${relativePosix}.`);
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
  await walk(openCodeRoot);
  if (entries.length === 0) throw new Error("Generated OpenCode output contains no files.");
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

async function selectPhysicalTarget(target) {
  const physicalTarget = await physicalPath(target);
  const physicalRepository = await realpath(repositoryRoot);
  if (pathIsWithin(physicalRepository, physicalTarget) || pathIsWithin(physicalTarget, physicalRepository)) {
    throw new Error(`The target and this checkout must not overlap: ${target}. Choose a separate OpenCode profile.`);
  }
  for (const sourcePath of new Set([...copyPaths, ...linkPaths])) {
    const source = join(repositoryRoot, sourcePath);
    const status = await pathStatus(source);
    if (!status) continue;
    const physicalSource = await realpath(source);
    if (pathIsWithin(physicalSource, physicalTarget) || pathIsWithin(physicalTarget, physicalSource)) {
      throw new Error(`The target and resolved bundle sources must not overlap: ${target}. Choose a separate OpenCode profile.`);
    }
  }
  const status = await pathStatus(physicalTarget);
  if (status && !status.isDirectory()) {
    throw new Error(`The selected profile is not a directory: ${physicalTarget}.`);
  }
  return physicalTarget;
}

async function assertManagedParentSafe(target, path, allowedLinkedAncestors = null) {
  if (!pathIsWithin(target, path)) {
    throw new Error(`Managed path escapes the selected profile: ${path}.`);
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
      // F11: an owned link that this run's migration/retirement removes is
      // exempt. It will be replaced by a real directory inside the profile, so
      // it is not an external confinement hazard the way a foreign junction is.
      if (allowedLinkedAncestors && allowedLinkedAncestors.has(normalizedPath(current))) {
        continue;
      }
      throw new Error(`Managed path has a linked ancestor outside the physical profile boundary: ${current}.`);
    }
    if (!status.isDirectory()) {
      throw new Error(`Managed path ancestor is not a directory: ${current}.`);
    }
    const physical = await realpath(current);
    if (!pathIsWithin(target, physical)) {
      throw new Error(`Managed path resolves outside the selected profile: ${current}.`);
    }
  }
}

async function assertPhysicalTargetStable(target) {
  const status = await pathStatus(target);
  if (!status?.isDirectory() || status.isSymbolicLink() || normalizedPath(await realpath(target)) !== normalizedPath(target)) {
    throw new Error(`The selected profile no longer resolves to its verified physical directory: ${target}.`);
  }
}

function normalizedLinkTarget(path) {
  const withoutExtendedPrefix = process.platform === "win32" && path.startsWith("\\\\?\\")
    ? path.slice(4)
    : path;
  const normalized = resolve(withoutExtendedPrefix);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

async function currentLinkTarget(destination) {
  const value = await readlink(destination);
  return normalizedLinkTarget(resolve(dirname(destination), value));
}

async function entryMatches(entry) {
  const destinationStatus = await pathStatus(entry.destination);
  if (!destinationStatus) return false;
  if (entry.kind === "file") {
    if (!destinationStatus.isFile() || destinationStatus.isSymbolicLink()) return false;
    return digest(await readFile(entry.destination)) === entry.digest;
  }
  if (!destinationStatus.isSymbolicLink()) return false;
  return await currentLinkTarget(entry.destination) === normalizedLinkTarget(entry.linkTarget);
}

function storedEntry(entry) {
  return entry.kind === "file"
    ? { path: entry.path, kind: entry.kind, digest: entry.digest }
    : { path: entry.path, kind: entry.kind, linkTarget: entry.linkTarget };
}

function safeStatePath(path) {
  return typeof path === "string" && path.length > 0
    && !path.includes("\\") && !posix.isAbsolute(path) && !win32.isAbsolute(path)
    && posix.normalize(path) === path
    && !path.split("/").some((part) => part === "." || part === "..");
}

// Schema 5 (the generated-output install) has a dynamic file set because the
// skill files are walked from the build. It is still fully constrained: exactly
// the six rendered profiles plus only the four public skill directories, all as
// regular files with a digest.
function validateGeneratedEntries(entries, statePath, expectedProfiles) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error(`Install state does not contain the generated entry set: ${statePath}. Move it aside and retry.`);
  }
  const profiles = new Set();
  const skills = new Set();
  for (const entry of entries) {
    const validPayload = entry?.kind === "file"
      && typeof entry?.digest === "string" && /^[0-9a-f]{64}$/.test(entry.digest);
    if (!entry || typeof entry !== "object" || Array.isArray(entry)
        || JSON.stringify(Object.keys(entry).sort()) !== JSON.stringify(["digest", "kind", "path"])
        || !safeStatePath(entry.path) || !validPayload) {
      throw new Error(`Install state contains an invalid entry: ${statePath}. Move it aside and retry, or restore a valid package state file.`);
    }
    const parts = entry.path.split("/");
    if (parts[0] === "agents") {
      if (parts.length !== 3 || parts[1] !== "autonomous" || !parts[2].endsWith(".md") || !expectedProfiles.has(parts[2].replace(/\.md$/, ""))) {
        throw new Error(`Install state has an unexpected generated profile: ${statePath}. Move it aside and retry.`);
      }
      if (profiles.has(parts[2])) throw new Error(`Install state duplicates generated profile: ${statePath}.`);
      profiles.add(parts[2]);
    } else if (parts[0] === "skills") {
      if (!["work", "autonomous", "pull-request-description", "source-code-lookup"].includes(parts[1])) {
        throw new Error(`Install state has an unexpected generated skill: ${statePath}. Move it aside and retry.`);
      }
      skills.add(parts[1]);
    } else {
      throw new Error(`Install state has a generated path outside the bundle: ${statePath}.`);
    }
  }
  if (profiles.size !== expectedProfiles.size) {
    throw new Error(`Install state does not contain all expected generated profiles: ${statePath}. Move it aside and retry.`);
  }
  if (skills.size !== 4) {
    throw new Error(`Install state does not contain all four generated skills: ${statePath}. Move it aside and retry.`);
  }
}

function validateState(value, statePath) {
  const topLevelKeys = ["entries", "installedAt", "mode", "package", "schema"];
  if (!value || typeof value !== "object" || Array.isArray(value)
      || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(topLevelKeys)
      || ![1, 2, 3, 4, legacyGeneratedSchema, stateVersion].includes(value.schema) || value.package !== packageName
      || !["copy", "link"].includes(value.mode) || !Array.isArray(value.entries)
      || typeof value.installedAt !== "string" || !Number.isFinite(Date.parse(value.installedAt))) {
    throw new Error(`Install state is invalid: ${statePath}. Move it aside and retry, or restore a valid package state file.`);
  }
  if (value.schema === stateVersion) {
    if (value.mode !== "copy") {
      throw new Error(`Schema ${stateVersion} install state must be a copy install: ${statePath}. Move it aside and retry.`);
    }
    validateGeneratedEntries(value.entries, statePath, profileNames);
    return value;
  }
  if (value.schema === legacyGeneratedSchema) {
    if (value.mode !== "copy") {
      throw new Error(`Schema ${legacyGeneratedSchema} install state must be a copy install: ${statePath}. Move it aside and retry.`);
    }
    validateGeneratedEntries(value.entries, statePath, legacyProfileNames);
    return value;
  }

  const expectedPaths = value.mode === "copy"
    ? value.schema === 1 ? legacyCopyPaths : value.schema === 2 ? versionTwoCopyPaths : value.schema === 3 ? versionThreeCopyPaths : copyPaths
    : value.schema === 1 ? legacyLinkPaths : value.schema === 2 ? versionTwoLinkPaths : value.schema === 3 ? versionThreeLinkPaths : linkPaths;
  const expectedKind = value.mode === "copy" ? "file" : "link";
  if (value.entries.length !== expectedPaths.length) {
    throw new Error(`Install state does not contain the exact ${value.mode} entry set: ${statePath}. Move it aside and retry.`);
  }
  const seen = new Set();
  for (const entry of value.entries) {
    const expectedKeys = expectedKind === "file" ? ["digest", "kind", "path"] : ["kind", "linkTarget", "path"];
    const validPayload = expectedKind === "file"
      ? typeof entry?.digest === "string" && /^[0-9a-f]{64}$/.test(entry.digest)
      : typeof entry?.linkTarget === "string" && isAbsolute(entry.linkTarget)
        && resolve(entry.linkTarget) === entry.linkTarget;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)
        || JSON.stringify(Object.keys(entry).sort()) !== JSON.stringify(expectedKeys)
        || !safeStatePath(entry.path) || entry.kind !== expectedKind || !expectedPaths.includes(entry.path)
        || seen.has(entry.path) || !validPayload) {
      throw new Error(`Install state contains an invalid entry: ${statePath}. Move it aside and retry, or restore a valid package state file.`);
    }
    seen.add(entry.path);
  }
  if (expectedPaths.some((path) => !seen.has(path))) {
    throw new Error(`Install state does not contain the exact ${value.mode} entry set: ${statePath}. Move it aside and retry.`);
  }
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
    const target = await readlink(source);
    let type;
    if (process.platform === "win32") {
      try {
        type = (await stat(source)).isDirectory() ? "junction" : "file";
      } catch {
        type = "file";
      }
    }
    await symlink(target, destination, type);
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

function equivalentState(existing, mode, entries) {
  if (!existing || existing.mode !== mode || existing.entries.length !== entries.length) return false;
  return JSON.stringify(existing.entries) === JSON.stringify(entries.map(storedEntry));
}

// True when `candidate` is (or lives under) one of the removed paths, i.e. it
// sits inside a retired file/directory or a removed link that migration clears.
function isCoveredBy(removedPaths, candidate) {
  return removedPaths.some((path) => candidate === path || candidate.startsWith(`${path}/`));
}

// R11: Best-effort duplicate-source detection. If this OpenCode target already
// holds a state file owned by the standalone installer (or a plugin package),
// the same skills may be installed twice under different ownership. Surface the
// documented choice; do not block.
async function detectDuplicateSource(target) {
  const probeRoots = [target, dirname(target)];
  for (const root of probeRoots) {
    const candidates = [".agenticale-standalone-install.json", "plugin.json"];
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
  }
  return null;
}

// Reconcile an existing (owned) install with the new inventory. This runs for
// BOTH schema migrations and same-schema updates: an owned, UNMODIFIED entry
// that is no longer present in the new inventory is retired (removed), and an
// owned entry whose content or link target changed is preserved and reported.
// For links, ownership is verified by comparing the live link target to the
// stored one before anything is removed. The `inNew` flag is retained for
// reporting; removals are safe to perform for every retired entry because the
// new inventory is written over them.
async function planMigration(options, existingState, entries) {
  const newInventoryPaths = new Set(entries.map((entry) => entry.path));
  const newDigests = new Map(entries.map((entry) => [entry.path, entry.digest]));
  const newLinkTargets = new Map(entries.map((entry) => [entry.path, entry.linkTarget]).filter(([, value]) => value !== undefined));
  const removes = [];
  const preserved = [];
  for (const stored of existingState.entries) {
    const destination = join(options.target, stored.path);
    const inNew = newInventoryPaths.has(stored.path);
    const status = await pathStatus(destination);
    if (!status) continue; // already gone

    if (existingState.mode === "link") {
      const ownedLink = status.isSymbolicLink()
        && (await currentLinkTarget(destination)) === normalizedLinkTarget(stored.linkTarget);
      if (!ownedLink) {
        preserved.push({ path: stored.path, destination, inNew });
        continue;
      }
      if (!inNew || (newLinkTargets.get(stored.path) !== undefined && normalizedLinkTarget(newLinkTargets.get(stored.path)) !== normalizedLinkTarget(stored.linkTarget))) {
        removes.push({ path: stored.path, destination, inNew, link: true });
      }
      continue;
    }

    if (!status.isFile() || status.isSymbolicLink()) {
      // A link or directory where an owned file was tracked: we cannot prove
      // ownership of the current bytes, so preserve and report it.
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
  return { removes, preserved, linkConverted: existingState.mode === "link" };
}

async function installBundle(options) {
  options.target = await selectPhysicalTarget(options.target);
  const existingState = await readState(options.target);
  const migrated = existingState !== null && existingState.schema !== stateVersion;
  const entries = await buildOpenCodeEntries(options);
  for (const entry of entries) entry.destination = join(options.target, entry.path);

  // Reconcile the existing install with the new inventory for BOTH schema
  // migrations and same-schema updates (R12): unmodified owned files no longer
  // present are retired, modified ones are preserved.
  const migration = existingState !== null
    ? await planMigration(options, existingState, entries)
    : { removes: [], preserved: [], linkConverted: false };
  const duplicate = existingState === null ? await detectDuplicateSource(options.target) : null;
  const removedSet = migration.removes.map(({ path }) => path);

  await assertManagedParentSafe(options.target, join(options.target, backupDirectoryName, "entry"));
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

  console.log(`${options.dryRun ? "Dry-run " : ""}Install (copy, generated) -> ${options.target}`);
  if (migrated) console.log(`  migrating from schema ${existingState.schema} ${existingState.mode} install`);
  if (migration.linkConverted) {
    console.log("  converted: the previous link install was converted to a copy install of the generated bundle.");
  }
  if (duplicate) {
    console.log(`  notice: another AgenticAle install appears present (${duplicate}).`);
    console.log("    This installer owns the generated OpenCode bundle; the plugin/standalone installers own their own copies.");
    console.log("    Installing both can duplicate the four skills. Pick one source of truth and uninstall the other if that is not intended.");
  }
  for (const { path } of migration.removes) console.log(`  migrate-remove: ${path}`);
  for (const { path, inNew } of migration.preserved) {
    console.log(`  preserve-modified: ${path} (modified; left in place${inNew ? "; collides with the new file, re-run with --replace" : ""})`);
  }
  for (const plan of plans) console.log(`  ${plan.action}: ${plan.entry.path}`);
  if (options.dryRun) {
    if (collisions.length > 0 || migration.removes.length > 0) {
      console.log(`  backup: ${collisions.length + migration.removes.length} path(s) under ${backupDirectoryName}/`);
    }
    console.log("Dry run complete; no files were changed.");
    return;
  }

  // F10: "up to date" also requires the stored inventory to equal the new one.
  // A stale owned entry whose file is already absent schedules no removal, so the
  // file checks alone would falsely report up-to-date and skip reconciliation.
  const upToDate = !migrated
    && migration.removes.length === 0
    && plans.every(({ action }) => action === "keep")
    && equivalentState(existingState, "copy", entries);
  if (upToDate) {
    console.log("Already up to date.");
    console.log("Next: restart OpenCode and use the /work and /autonomous skills; this installer leaves opencode.jsonc unchanged.");
    console.log("See docs/setup.md for child-session permissions and docs/autonomous.md for unattended /autonomous runs.");
    return;
  }

  await mkdir(options.target, { recursive: true });
  await assertPhysicalTargetStable(options.target);

  const touchedPaths = new Set([
    ...migration.removes.map(({ path }) => path),
    ...plans.filter(({ action }) => action !== "keep").map(({ entry }) => entry.path),
  ]);
  const preExisting = new Set();
  for (const path of touchedPaths) {
    if (await pathStatus(join(options.target, path))) preExisting.add(path);
  }
  const statePath = join(options.target, stateName);
  const statePreExisted = (await pathStatus(statePath)) !== null;

  // F2: capture the pre-update state bytes in memory so rollback can restore
  // them independently of whether a content backup directory exists (a missing-
  // file repair backs up no content, yet still rewrites the state on success).
  // The mutation itself is still gated by the per-write assertManagedParentSafe
  // calls in the loop below; on failure we roll back and restore this state.
  const originalStateBytes = statePreExisted ? await readFile(statePath) : null;

  // F11: validate every planned mutation's existing ancestors BEFORE backing up
  // or changing any content. A foreign linked ancestor must reject the whole run
  // before the first mutation so there is nothing for rollback to undo. An owned
  // link the migration removes is exempt: it is replaced by a real directory in
  // the profile, so a plan writing through it is safe (it is removed first).
  const allowedLinkedAncestors = new Set(migration.removes.map(({ destination }) => normalizedPath(destination)));
  for (const { destination } of migration.removes) {
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
      removed: migration.removes.map(({ path }) => path),
      replaced: collisions.map(({ entry }) => entry.path),
    }, null, 2)}\n`, "utf8");
    console.log(`  backup created: ${backupDirectory}`);
  }

  // F11: only paths actually mutated by this run are rolled back; a planned path
  // whose parent check refused the operation is never added, so rollback can
  // never delete or rewrite a file the run itself refused to touch.
  const mutatedPaths = new Set();
  try {
    for (const { path, destination } of migration.removes) {
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

    if (!equivalentState(existingState, "copy", entries)) {
      await mkdir(options.target, { recursive: true });
      await writeState(options.target, {
        schema: stateVersion,
        package: packageName,
        mode: "copy",
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
        // Pre-existing and differing: remove, then restore the backed-up copy
        // (a backup directory exists whenever any pre-existing path was touched).
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
  console.log("Next: restart OpenCode and use the /work and /autonomous skills; this installer leaves opencode.jsonc unchanged.");
  console.log("See docs/setup.md for child-session permissions and docs/autonomous.md for unattended /autonomous runs.");
}

async function removeEmptyPackageDirectories(target) {
  const directories = [
    // Generated (schema 5) layout, leaf-first.
    "skills/work/references/runtimes",
    "skills/work/references/tasks",
    "skills/work/references",
    "skills/work/agents",
    "skills/work",
    "skills/autonomous/agents",
    "skills/autonomous",
    "skills/pull-request-description",
    "skills/source-code-lookup",
    // Retired (schema 1-4) layout, leaf-first.
    "skills/work-mode/references",
    "skills/work-mode",
    "skills/autonomous-mode",
    "commands",
    "agents/autonomous",
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
