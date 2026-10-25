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
const generatedRoots = ["agents", "commands", "skills"];

// The seven rendered OpenCode profiles the build emits (no coordinator).
const profileNames = new Set(["consult", "deep-review", "explore", "fix", "implement", "implement-hard", "review"]);
// The six profiles the retired schema-5 build emitted (no implement-hard).
const legacyProfileNames = new Set(["consult", "deep-review", "explore", "fix", "implement", "review"]);
// The three command entries the current build emits (thin launchers for the
// explicit-only skills; OpenCode does not interpret the skills' `slash` field).
const commandNames = new Set(["autonomous", "review", "work"]);
// The five public skills the current build installs, and the four public skills
// the pre-review release installed. A pre-review schema-6 state legally carries
// exactly the four, and migration adds the review skill's files.
const skillNames = new Set(["work", "review", "autonomous", "pull-request-description", "source-code-lookup"]);
const legacySkillNames = new Set(["work", "autonomous", "pull-request-description", "source-code-lookup"]);

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
  node scripts/install.mjs setup [--target PATH] [--personal-path PATH] [--dry-run]

Installs the GENERATED OpenCode bundle (built to a temp root, then copied) into
the OpenCode configuration directory. It does not link or point at the authored
repository source. Older copy installs (schema 1-4) and link installs are
migrated to the generated copy layout on install.

The setup subcommand creates the personal preferences file (default
~/.agenticale/preferences.md) as a minimal scaffold with no role overrides, so
the installed baseline routing applies, if and only if it is absent. It never
overwrites,
migrates, or removes a preference file, never creates the project-scope file,
and never prompts: explicit consent is the caller's job. With the default
path, if the target is absent but the legacy ~/.agenticale/routing.md
exists, setup creates nothing and reports the legacy path: a preferences.md
would take precedence over it, and only the user renames the file. For
setup, --target PATH (the same flag and default resolution as install)
selects the target whose installed
skills/work/references/preferences.example.md the printed guidance points at;
the target itself is never validated or modified. See
skills/work/references/ROUTING.md (User customization).

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
  --personal-path PATH
                  (setup) personal preferences file to create if absent
                  (default: ~/.agenticale/preferences.md)
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
  let personalPath;
  let commandSeen = false;

  const requireValue = (index, option) => {
    if (index + 1 >= argv.length || !argv[index + 1] || argv[index + 1].startsWith("-")) {
      throw new Error(`${option} requires a value that is not another option.`);
    }
    return argv[index + 1];
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "install" || argument === "uninstall" || argument === "setup") {
      if (commandSeen) throw new Error(`Only one command may be supplied (found '${argument}').`);
      command = argument;
      commandSeen = true;
    } else if (argument === "--personal-path") {
      if (personalPath !== undefined) throw new Error("--personal-path may be supplied only once.");
      personalPath = requireValue(index, "--personal-path");
      index += 1;
    } else if (argument.startsWith("--personal-path=")) {
      if (personalPath !== undefined) throw new Error("--personal-path may be supplied only once.");
      personalPath = argument.slice("--personal-path=".length);
      if (!personalPath || personalPath.startsWith("-")) throw new Error("--personal-path requires a path, not another option.");
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
  if (command !== "setup" && personalPath !== undefined) {
    throw new Error("--personal-path applies only to setup, not install or uninstall.");
  }
  if (command === "setup" && (sourceRoot !== undefined || replace || models !== undefined || routing !== undefined || noModel || effortOverride)) {
    throw new Error("--source-root, --replace, --models, --routing, --effort, and --no-model apply only to install/uninstall, not setup.");
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
    personalPath: personalPath === undefined ? null : resolveSourceRoot(personalPath),
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
// the build renders the seven profiles and copies the five public skills, and we
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
// the rendered profiles plus only the five public skill directories, all as
// regular files with a digest. The skill set must be exactly the current five
// skills or exactly the four skills of the pre-review release: migration adds
// the review skill's files, and a partial mix is rejected. Entries under
// commands/ must be one of the three known command entries, but a pre-command
// schema-6 state (older release installs) legally lacks them: migration adds
// the entries, so validation only checks shape, not presence.
function validateGeneratedEntries(entries, statePath, expectedProfiles) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error(`Install state does not contain the generated entry set: ${statePath}. Move it aside and retry.`);
  }
  const profiles = new Set();
  const skills = new Set();
  const commands = new Set();
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
      // The generated profile namespace was renamed; states written before the
      // rename still carry the old namespace directory. Accept both so those
      // states validate and refresh retires the old profile paths, installing
      // the new ones under the current namespace.
      if (parts.length !== 3 || !["agenticale", "autonomous"].includes(parts[1]) || !parts[2].endsWith(".md") || !expectedProfiles.has(parts[2].replace(/\.md$/, ""))) {
        throw new Error(`Install state has an unexpected generated profile: ${statePath}. Move it aside and retry.`);
      }
      if (profiles.has(parts[2])) throw new Error(`Install state duplicates generated profile: ${statePath}.`);
      profiles.add(parts[2]);
    } else if (parts[0] === "commands") {
      if (parts.length !== 2 || !parts[1].endsWith(".md") || !commandNames.has(parts[1].replace(/\.md$/, ""))) {
        throw new Error(`Install state has a generated path outside the bundle: ${statePath}.`);
      }
      if (commands.has(parts[1])) throw new Error(`Install state duplicates a generated command entry: ${statePath}.`);
      commands.add(parts[1]);
    } else if (parts[0] === "skills") {
      if (!skillNames.has(parts[1])) {
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
  const sortedSkillSet = [...skills].sort().join(",");
  if (sortedSkillSet !== [...skillNames].sort().join(",") && sortedSkillSet !== [...legacySkillNames].sort().join(",")) {
    throw new Error(`Install state does not contain a complete generated skill set (exactly the current five or the pre-review four skills): ${statePath}. Move it aside and retry.`);
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
    console.log("    Installing both can duplicate the five skills. Pick one source of truth and uninstall the other if that is not intended.");
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
    // Sweep here too: an already-migrated upgrader re-runs the installer and
    // takes this early return, but a pre-rename empty agents/autonomous left
    // behind by an earlier release is not in the state and no plan touches
    // it — only this pass can retire the now-empty directory.
    await removeEmptyPackageDirectories(options.target);
    console.log("Already up to date.");
    console.log("Next: restart OpenCode and use the /work, /review, and /autonomous commands; this installer leaves opencode.jsonc unchanged.");
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

  // Sweep empty retired package directories after a successful install, not
  // only on uninstall: a 0.7.x -> 0.8.x rename leaves an empty
  // agents/autonomous on disk that no plan schedules for removal, and users
  // should not have to uninstall just to clean it up. Runs after the
  // try/catch so a rolled-back install is never swept.
  await removeEmptyPackageDirectories(options.target);
  console.log("Installation complete.");
  console.log("Next: restart OpenCode and use the /work, /review, and /autonomous commands; this installer leaves opencode.jsonc unchanged.");
  console.log(`Verify your routing after install (and after editing your preferences) by pasting this prompt into an OpenCode session: ${verifyPromptFor(options.target)}`);
  console.log("See docs/setup.md for child-session permissions and docs/autonomous.md for unattended /autonomous runs.");
}

async function hasLinkedAncestor(target, candidate) {
  const difference = relative(target, dirname(candidate));
  let current = target;
  for (const component of (difference ? difference.split(/[\\/]/) : [])) {
    current = join(current, component);
    const status = await pathStatus(current);
    if (!status) return false; // absent: rmdir will no-op with ENOENT
    if (status.isSymbolicLink()) return true;
  }
  return false;
}

async function removeEmptyPackageDirectories(target) {
  // Runs both on uninstall and after a successful install. Only empty
  // directories under the physical target are removed. A candidate that is
  // itself a symlink, or that sits beneath a symlinked/junctioned ancestor,
  // is skipped, not deleted: an owned link is already handled by the removal
  // plan, so any remaining link is user-owned and must survive (the R6
  // invariant), and rmdir would otherwise follow the link into user state
  // outside the target. On Windows rmdir on a junction REMOVES the junction,
  // so the lstat check is required, not just an optimization.
  const directories = [
    // Generated (schema 5) layout, leaf-first.
    "agents/agenticale",
    "skills/work/references/runtimes",
    "skills/work/references/tasks",
    "skills/work/references",
    "skills/work/agents",
    "skills/work/scripts",
    "skills/work",
    "skills/review/agents",
    "skills/review",
    "skills/autonomous/agents",
    "skills/autonomous",
    "skills/pull-request-description",
    "skills/source-code-lookup",
    // Retired (schema 1-4 and pre-rename generated) layout, leaf-first.
    "skills/work-mode/references",
    "skills/work-mode",
    "skills/autonomous-mode",
    "commands",
    "agents/autonomous",
  ];
  for (const path of directories) {
    const candidate = join(target, path);
    // Ancestor guard BEFORE the probe: it must run first so no path
    // resolution traverses a user-owned link at all — otherwise probing the
    // deeper candidate through a looping symlink throws ELOOP (and would
    // reach external descendants through a non-looping link). The walk
    // itself only lstat's each ancestor COMPONENT and never follows the
    // final link, so a loop at an ancestor position cannot ELOOP it.
    if (await hasLinkedAncestor(target, candidate)) continue;
    try {
      const status = await lstat(candidate);
      if (status.isSymbolicLink()) continue;
    } catch (error) {
      // ENOENT means the candidate is absent. ENOTDIR means an ancestor is a
      // file or a symlink-to-file, so the deeper name path cannot exist as an
      // entry here either — pathStatus documents the same treatment, so skip
      // the candidate instead of failing the (already successful) install.
      // ELOOP is belt-and-suspenders for the TOCTOU window between the
      // ancestor check above and this lstat — a looping link could appear in
      // between; the link is left alone, mirroring the ENOTDIR handling in
      // the rmdir catch below.
      if (!["ENOENT", "ENOTDIR", "ELOOP"].includes(error.code)) throw error;
      continue;
    }
    try {
      await rmdir(candidate);
    } catch (error) {
      // ENOTDIR: belt-and-suspenders against the TOCTOU window between the
      // lstat above and this rmdir — if a directory was replaced by a
      // symlink in between, rmdir on the link throws ENOTDIR (Linux) and
      // the link is left alone.
      if (!["ENOENT", "ENOTEMPTY", "EEXIST", "ENOTDIR"].includes(error.code)) throw error;
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

// Minimal personal preferences scaffold: it carries no role overrides, so
// the installed baseline routing (which matches the generated agent
// profiles) applies by default; the user adds a runtime section with
// overrides to customize. It carries no illustrative model identifiers:
// those belong to preferences.example.md, where they are documented as
// illustrative only.
const routingScaffold = `# AgenticAle preferences (personal)

Personal preferences, created by the AgenticAle installer. By default every
role uses the installed baseline routing, which matches the agent profiles
generated at install time. To customize, add a runtime section with a
\`### Role overrides\` list that points a role at a specific model or tier. See
the installed preferences.example.md for the full format.
`;

// The one-time post-install verification, printed by the install and setup
// output: a prompt to paste into an OpenCode session, not a raw helper
// command. It tells the pasting session to run the `startup` bootstrap with
// `--root` set to its own project root (its working directory, or the
// directory containing the project's .agenticale; the home directory when
// there is no project — the helper deduplicates a root equal to home into
// the personal location), so the personal and the project preference
// locations are both checked. On the "resolved" result the session confirms
// every role in the `agents` output reports "match"; on the
// "interpretation-required" result it reads and interprets each listed
// preference file (a project file takes precedence over the personal one;
// any legacy file reported as ignored is never read), writes the interpreted
// structured layers (an array ordered lowest to highest precedence, personal
// first) to a temporary JSON file, and resolves them with
// `resolve --runtime opencode --input <file> --explain` — a path to that
// structured JSON, never inline JSON and never the Markdown file —
// comparing each route with the installed agent profiles. The dynamic paths
// are single-quoted so a target with spaces stays copy-pasteable.
const verifyPromptFor = (target) => {
  const helper = join(target, "skills", "work", "scripts", "routing.mjs");
  const rootPlaceholder = `<the project root of the session you are pasting this into: that working directory, or the directory containing its .agenticale folder; the home directory when there is no project>`;
  return `Verify my AgenticAle routing for the opencode runtime: run \`node '${helper}' startup --runtime opencode --root '${rootPlaceholder}'\`, which checks the personal preference location and that project location; if the result is the resolved policy, confirm every role in its agents output reports "match"; if it reports "interpretation-required" because a preference file is present, read and interpret each listed preference file (a project file takes precedence over the personal file; any legacy file reported as ignored is never read), write the interpreted structured layers to a temporary JSON file as an array ordered lowest to highest precedence (personal first, then project), then run \`node '${helper}' resolve --runtime opencode --input '<that temporary JSON file>' --explain\`, and compare each resolved route with its installed agent profile in '${join(target, "agents", "agenticale")}' (an "inherit" route matches a profile with no "model:" line, and an explicit route must match the profile's model and reasoning effort); report any mismatch, missing, or unreadable role along with the preparation/refresh procedure in '${join(target, "skills", "work", "references", "runtimes", "opencode.md")}'.`;
};

// Consent-gated personal preferences setup (the narrow exception documented
// in skills/work/references/ROUTING.md, "User customization"). Creates the
// personal preference file (default ~/.agenticale/preferences.md,
// overridable for tests and non-default layouts with --personal-path) if and
// only if it is absent. Anything already present at the path — file,
// directory, or link — is left untouched: preference files are never
// overwritten, migrated, or removed, and the project-scope file is never
// created. With the default path, a present legacy ~/.agenticale/routing.md
// whose preferences.md target is absent makes setup create nothing and
// report the legacy path: a preferences.md would take precedence over it,
// and only the user renames the file; in that legacy-only case the guidance
// and paste prompt target the legacy file, the user's effective file. When
// both exist, preferences.md is already effective and the guidance targets
// it. It never prompts and needs no TTY: explicit consent is the
// caller's job.
async function setupPersonalRouting(options) {
  const legacyPersonalPath = join(homedir(), ".agenticale", "routing.md");
  const personalPath = options.personalPath ?? join(homedir(), ".agenticale", "preferences.md");
  // The legacy guard applies to the default path only: with --personal-path
  // the caller names the target explicitly, so no legacy sibling is inferred.
  // (parseArguments resolves an omitted --personal-path to null.)
  const legacyPresent = options.personalPath === null
    ? (await pathStatus(legacyPersonalPath)) !== null
    : false;
  // The packaged example ships inside the installed skill. options.target is
  // the effective target: the caller's --target PATH, or the same default
  // resolution install and uninstall use (XDG_CONFIG_HOME/opencode when set,
  // otherwise ~/.config/opencode), so the guidance cannot drift from where an
  // install with that --target would have placed the example.
  const examplePath = join(options.target, "skills", "work", "references", "preferences.example.md");
  // The guidance and paste prompt must name the file the user will actually
  // read: preferences.md when it is created or already present, and the
  // legacy routing.md when setup creates nothing because only the legacy
  // file exists, so the prompt's "Read the file" step is true in both cases.
  const promptFor = (effectivePath) => `Help me customize my AgenticAle personal preferences file at ${effectivePath}. Read the file and the installed preferences example, tell me which model and effort each of the seven roles currently resolves to for the opencode runtime, and then walk me through the changes I want to make without inventing model identifiers my host does not support.`;
  const printGuidance = (effectivePath) => {
    console.log(`Edit the file to customize model routing: the packaged example is at ${examplePath} (the installed skill), and a project file <repo>/.agenticale/preferences.md takes precedence over this personal file (the legacy name routing.md is still accepted at each scope; a preferences.md takes precedence over a routing.md at the same scope).`);
    console.log("");
    console.log("Paste this prompt into an OpenCode session to continue customizing:");
    console.log("");
    console.log(promptFor(effectivePath));
    console.log("");
    console.log(`After editing, verify your routing by pasting this prompt into an OpenCode session: ${verifyPromptFor(options.target)}`);
  };

  const present = (await pathStatus(personalPath)) !== null;
  const effectivePersonalPath = legacyPresent && !present ? legacyPersonalPath : personalPath;
  console.log(`${options.dryRun ? "Dry-run " : ""}Routing setup -> ${personalPath}`);
  if (present) {
    console.log(`  ${options.dryRun ? "would leave" : "left"} untouched: ${personalPath} already exists; preference files are never overwritten, migrated, or removed`);
  } else if (legacyPresent) {
    console.log(`  ${options.dryRun ? "would create" : "create"} nothing: the legacy personal file ${legacyPersonalPath} exists, and a preferences.md would take precedence over it; the installer never renames, migrates, or removes preference files — rename ${legacyPersonalPath} to ${personalPath} yourself if you want the new name`);
  } else {
    console.log(`  ${options.dryRun ? "would create" : "create"}: minimal scaffold (no role overrides; the installed baseline routing applies)`);
  }
  if (options.dryRun) {
    printGuidance(effectivePersonalPath);
    console.log("Dry run complete; no files were changed.");
    return;
  }
  if (legacyPresent && !present) {
    // Default path only, legacy-only case: the target preferences.md is
    // absent and a legacy routing.md exists. Create nothing and leave both
    // files exactly as found; the guidance targets the legacy file, the
    // user's effective file. With preferences.md present it already takes
    // precedence (effectivePersonalPath), so the guidance below targets it.
    printGuidance(effectivePersonalPath);
    return;
  }
  if (!present) {
    await mkdir(dirname(personalPath), { recursive: true });
    try {
      // wx (create exclusively) is the second line of defense behind the
      // lstat probe: if the file appears in between, refuse instead of
      // overwriting, and report it as left untouched.
      await writeFile(personalPath, routingScaffold, { encoding: "utf8", flag: "wx" });
    } catch (error) {
      if (error.code === "EEXIST") {
        console.log(`  left untouched: ${personalPath} already exists; preference files are never overwritten, migrated, or removed`);
        printGuidance(personalPath);
        return;
      }
      throw error;
    }
  }
  printGuidance(personalPath);
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
    else if (options.command === "setup") await setupPersonalRouting(options);
    else await uninstallBundle(options);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    console.error("Run with --help for usage.");
    process.exitCode = 1;
  }
}

await main();
