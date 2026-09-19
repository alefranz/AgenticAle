#!/usr/bin/env node

import {
  constants,
  copyFile,
  cp,
  lstat,
  mkdir,
  readFile,
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
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, posix, relative, resolve, win32 } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const stateName = ".autonomous-mode-install.json";
const backupDirectoryName = ".autonomous-mode-backups";
const packageName = "opencode-autonomous-mode";
const stateVersion = 2;

const copyPaths = [
  "agents/autonomous/consult.md",
  "agents/autonomous/deep-review.md",
  "agents/autonomous/explore.md",
  "agents/autonomous/fix.md",
  "agents/autonomous/implement-hard.md",
  "agents/autonomous/implement.md",
  "agents/autonomous/review.md",
  "commands/autonomous.md",
  "skills/autonomous-mode/SKILL.md",
  "skills/source-code-lookup/SKILL.md",
];

const legacyCopyPaths = copyPaths.filter((path) => path !== "skills/source-code-lookup/SKILL.md");

const linkPaths = [
  "agents/autonomous",
  "commands/autonomous.md",
  "skills/autonomous-mode",
  "skills/source-code-lookup",
];
const legacyLinkPaths = linkPaths.filter((path) => path !== "skills/source-code-lookup");
const roleNames = new Set(copyPaths
  .filter((path) => path.startsWith("agents/autonomous/"))
  .map((path) => basename(path, ".md")));
const modelPresets = new Map([
  ["example", "examples/example.json"],
  ["local", "examples/local.json"],
  ["openai", "examples/openai.json"],
  ["zen", "examples/gpt.json"],
]);

function usage() {
  return `Usage:
  node scripts/install.mjs [install] [--target PATH] [--source-root PATH] (--models PATH|PRESET | --no-model) [--link] [--replace] [--dry-run]
  node scripts/install.mjs uninstall [--target PATH] [--dry-run]

Options:
  --target PATH  OpenCode configuration directory (default: XDG_CONFIG_HOME/opencode
                 when set, otherwise ~/.config/opencode)
  --source-root PATH
                 Local source checkout root for the source-code-lookup skill
                 (copy installs only; default in the skill: ~/dev)
  --models PATH|PRESET
                 JSON mapping or bundled preset (openai, zen, local, example)
                 for copy installs; unspecified roles inherit the session model
  --no-model      Explicitly make every installed role inherit the session model
  --link         Link the four bundle units to this checkout instead of copying
  --replace      Back up and replace differing destinations during install/update
  --dry-run      Print the planned operation without changing the filesystem
  --help         Show this help`;
}

function parseArguments(argv) {
  let command = "install";
  let target;
  let sourceRoot;
  let modelsPath;
  let noModel = false;
  let link = false;
  let replace = false;
  let dryRun = false;
  let commandSeen = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "install" || argument === "uninstall") {
      if (commandSeen) throw new Error(`Only one command may be supplied (found '${argument}').`);
      command = argument;
      commandSeen = true;
    } else if (argument === "--target") {
      if (index + 1 >= argv.length) throw new Error("--target requires a path.");
      target = argv[index + 1];
      if (!target || target.startsWith("-")) throw new Error("--target requires a path, not another option.");
      index += 1;
    } else if (argument.startsWith("--target=")) {
      target = argument.slice("--target=".length);
      if (!target || target.startsWith("-")) throw new Error("--target requires a path, not another option.");
    } else if (argument === "--source-root") {
      if (sourceRoot !== undefined) throw new Error("--source-root may be supplied only once.");
      if (index + 1 >= argv.length) throw new Error("--source-root requires a path.");
      sourceRoot = argv[index + 1];
      if (!sourceRoot || sourceRoot.startsWith("-")) throw new Error("--source-root requires a path, not another option.");
      index += 1;
    } else if (argument.startsWith("--source-root=")) {
      if (sourceRoot !== undefined) throw new Error("--source-root may be supplied only once.");
      sourceRoot = argument.slice("--source-root=".length);
      if (!sourceRoot || sourceRoot.startsWith("-")) throw new Error("--source-root requires a path, not another option.");
    } else if (argument === "--models") {
      if (modelsPath !== undefined) throw new Error("--models may be supplied only once.");
      if (index + 1 >= argv.length) throw new Error("--models requires a path.");
      modelsPath = argv[index + 1];
      if (!modelsPath || modelsPath.startsWith("-")) throw new Error("--models requires a path, not another option.");
      index += 1;
    } else if (argument.startsWith("--models=")) {
      if (modelsPath !== undefined) throw new Error("--models may be supplied only once.");
      modelsPath = argument.slice("--models=".length);
      if (!modelsPath || modelsPath.startsWith("-")) throw new Error("--models requires a path, not another option.");
    } else if (argument === "--no-model") {
      noModel = true;
    } else if (argument === "--link") {
      link = true;
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

  if (command === "uninstall" && (link || replace || modelsPath !== undefined || noModel || sourceRoot !== undefined)) {
    throw new Error("--link, --replace, --models, --no-model, and --source-root apply only to install/update, not uninstall.");
  }
  if (modelsPath !== undefined && noModel) {
    throw new Error("--models and --no-model cannot be used together.");
  }
  if (command === "install" && modelsPath === undefined && !noModel) {
    throw new Error("Install requires --models PATH|PRESET or --no-model.");
  }
  if (link && modelsPath !== undefined) {
    throw new Error("--models requires a copy install; --link uses the source files directly.");
  }
  if (link && sourceRoot !== undefined) {
    throw new Error("--source-root requires a copy install; --link uses the source skill directly.");
  }

  const defaultBase = process.env.XDG_CONFIG_HOME
    ? resolve(process.env.XDG_CONFIG_HOME)
    : join(homedir(), ".config");

  return {
    command,
    target: resolve(target ?? join(defaultBase, "opencode")),
    mode: link ? "link" : "copy",
    modelsPath: modelsPath === undefined ? null : resolveModelsPath(modelsPath),
    sourceRoot: sourceRoot === undefined ? null : resolveSourceRoot(sourceRoot),
    noModel,
    replace,
    dryRun,
    help: false,
  };
}

async function readModelAssignments(path) {
  if (path === null) return {};
  const status = await pathStatus(path);
  if (!status?.isFile() || status.size > 65536) {
    throw new Error(`--models must name a JSON file no larger than 64 KiB: ${path}.`);
  }
  let value;
  try {
    value = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`--models is not valid JSON: ${path}.`);
    throw error;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("--models must contain a JSON object keyed by autonomous role name.");
  }
  for (const [role, model] of Object.entries(value)) {
    if (!roleNames.has(role)) throw new Error(`Unknown autonomous role in --models: ${role}.`);
    if (typeof model !== "string" || model.length > 256
        || !/^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._:/@+-]*(?:#[A-Za-z0-9][A-Za-z0-9._-]*)?$/.test(model)) {
      throw new Error(`Invalid model for autonomous/${role}; expected provider/model[#variant] without whitespace.`);
    }
  }
  return value;
}

function resolveModelsPath(value) {
  const presetPath = modelPresets.get(value.toLowerCase());
  return presetPath === undefined ? resolve(value) : join(repositoryRoot, presetPath);
}

function resolveSourceRoot(value) {
  if (value === "~") return homedir();
  if (value.startsWith("~/") || value.startsWith("~\\")) return resolve(homedir(), value.slice(2));
  return resolve(value);
}

function configuredCopyContent(path, content, models, sourceRoot) {
  if (path === "skills/source-code-lookup/SKILL.md" && sourceRoot !== null) {
    const text = content.toString("utf8");
    const defaultLine = 'Source root: "~/dev"';
    if (text.split(defaultLine).length !== 2) {
      throw new Error(`Bundle source root marker is missing or ambiguous: ${path}.`);
    }
    return Buffer.from(text.replace(defaultLine, `Source root: ${JSON.stringify(sourceRoot)}`), "utf8");
  }
  if (!path.startsWith("agents/autonomous/")) return content;
  const model = models[basename(path, ".md")];
  if (model === undefined) return content;
  const text = content.toString("utf8");
  const frontmatterEnd = text.indexOf("\n---", 4);
  const lineEnding = text.startsWith("---\r\n") ? "\r\n" : "\n";
  if (!text.startsWith(`---${lineEnding}`) || frontmatterEnd < 0) {
    throw new Error(`Bundle agent has invalid frontmatter: ${path}.`);
  }
  const frontmatter = text.slice(0, frontmatterEnd);
  if (!/^mode: subagent\r?$/m.test(frontmatter) || /^model:/m.test(frontmatter)) {
    throw new Error(`Bundle agent cannot accept a model override: ${path}.`);
  }
  const rendered = `${frontmatter.replace(/^mode: subagent\r?$/m, `mode: subagent${lineEnding}model: ${model}`)}${text.slice(frontmatterEnd)}`;
  return Buffer.from(rendered, "utf8");
}

function digest(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function pathStatus(path) {
  try {
    return await lstat(path);
  } catch (error) {
    if (error.code === "ENOENT") return null;
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

async function assertManagedParentSafe(target, path) {
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

async function desiredEntries(mode, target, models, sourceRoot) {
  if (mode === "copy") {
    return Promise.all(copyPaths.map(async (path) => {
      const source = join(repositoryRoot, path);
      const sourceStatus = await pathStatus(source);
      if (!sourceStatus?.isFile()) {
        throw new Error(`Bundle source is missing or not a file: ${source}. Run from a complete checkout.`);
      }
      const content = configuredCopyContent(path, await readFile(source), models, sourceRoot);
      return {
        path,
        kind: "file",
        source,
        content,
        destination: join(target, path),
        digest: digest(content),
      };
    }));
  }

  return Promise.all(linkPaths.map(async (path) => {
    const source = join(repositoryRoot, path);
    const sourceStatus = await pathStatus(source);
    if (!sourceStatus) {
      throw new Error(`Bundle source is missing: ${source}. Run from a complete checkout.`);
    }
    return {
      path,
      kind: "link",
      source,
      destination: join(target, path),
      linkTarget: resolve(source),
      directory: sourceStatus.isDirectory(),
    };
  }));
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

function validateState(value, statePath) {
  const topLevelKeys = ["entries", "installedAt", "mode", "package", "schema"];
  if (!value || typeof value !== "object" || Array.isArray(value)
      || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(topLevelKeys)
      || ![1, stateVersion].includes(value.schema) || value.package !== packageName
      || !["copy", "link"].includes(value.mode) || !Array.isArray(value.entries)
      || typeof value.installedAt !== "string" || !Number.isFinite(Date.parse(value.installedAt))) {
    throw new Error(`Install state is invalid: ${statePath}. Move it aside and retry, or restore a valid package state file.`);
  }
  const expectedPaths = value.mode === "copy"
    ? value.schema === 1 ? legacyCopyPaths : copyPaths
    : value.schema === 1 ? legacyLinkPaths : linkPaths;
  const expectedKind = value.mode === "copy" ? "file" : "link";
  if (value.entries.length !== expectedPaths.length) {
    throw new Error(`Install state does not contain the exact ${value.mode} entry set: ${statePath}. Move it aside and retry.`);
  }
  const seen = new Set();
  for (const entry of value.entries) {
    const safePath = typeof entry?.path === "string" && entry.path.length > 0
      && !entry.path.includes("\\") && !posix.isAbsolute(entry.path) && !win32.isAbsolute(entry.path)
      && posix.normalize(entry.path) === entry.path
      && !entry.path.split("/").some((part) => part === "." || part === "..");
    const expectedKeys = expectedKind === "file" ? ["digest", "kind", "path"] : ["kind", "linkTarget", "path"];
    const validPayload = expectedKind === "file"
      ? typeof entry?.digest === "string" && /^[0-9a-f]{64}$/.test(entry.digest)
      : typeof entry?.linkTarget === "string" && isAbsolute(entry.linkTarget)
        && resolve(entry.linkTarget) === entry.linkTarget;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)
        || JSON.stringify(Object.keys(entry).sort()) !== JSON.stringify(expectedKeys)
        || !safePath || entry.kind !== expectedKind || !expectedPaths.includes(entry.path)
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

async function installBundle(options) {
  const models = await readModelAssignments(options.modelsPath);
  options.target = await selectPhysicalTarget(options.target);
  const entries = await desiredEntries(options.mode, options.target, models, options.sourceRoot);
  for (const entry of entries) await assertManagedParentSafe(options.target, entry.destination);
  await assertManagedParentSafe(options.target, join(options.target, backupDirectoryName, "entry"));
  const existingState = await readState(options.target);
  const containerPlans = [];
  if (options.mode === "copy") {
    for (const path of ["agents/autonomous", "skills/autonomous-mode", "skills/source-code-lookup"]) {
      const destination = join(options.target, path);
      const status = await pathStatus(destination);
      if (status && (!status.isDirectory() || status.isSymbolicLink())) {
        containerPlans.push({
          action: "replace",
          entry: { path, destination, kind: "container" },
        });
      }
    }
  }
  const plans = [];

  for (const entry of entries) {
    const replacedContainer = containerPlans.some(({ entry: container }) =>
      entry.path.startsWith(`${container.path}/`));
    if (replacedContainer) {
      plans.push({ action: "create", entry });
      continue;
    }
    const destinationStatus = await pathStatus(entry.destination);
    if (!destinationStatus) plans.push({ action: "create", entry });
    else if (await entryMatches(entry)) plans.push({ action: "keep", entry });
    else plans.push({ action: "replace", entry });
  }

  const collisions = [...containerPlans, ...plans.filter((plan) => plan.action === "replace")];
  if (collisions.length > 0 && !options.replace) {
    const paths = collisions.map(({ entry }) => `  - ${entry.destination}`).join("\n");
    throw new Error(`Differing content already exists at:\n${paths}\nNo changes were made. Re-run with --replace to back it up and replace it.`);
  }

  console.log(`${options.dryRun ? "Dry-run install" : "Install"} (${options.mode}) -> ${options.target}`);
  for (const plan of containerPlans) console.log(`  ${plan.action}: ${plan.entry.path}`);
  for (const plan of plans) console.log(`  ${plan.action}: ${plan.entry.path}`);
  if (options.dryRun) {
    if (collisions.length > 0) console.log(`  backup: ${collisions.length} differing destination(s) under ${backupDirectoryName}/`);
    console.log("Dry run complete; no files were changed.");
    return;
  }

  await mkdir(options.target, { recursive: true });
  await assertPhysicalTargetStable(options.target);
  for (const entry of entries) await assertManagedParentSafe(options.target, entry.destination);

  let backupDirectory = null;
  if (collisions.length > 0) {
    backupDirectory = await createUniqueBackupDirectory(options.target);
    for (const { entry } of collisions) {
      await copyForBackup(entry.destination, join(backupDirectory, entry.path));
    }
    const statePath = join(options.target, stateName);
    if (await pathStatus(statePath)) await copyForBackup(statePath, join(backupDirectory, stateName));
    await writeFile(join(backupDirectory, "backup.json"), `${JSON.stringify({
      package: packageName,
      createdAt: new Date().toISOString(),
      target: options.target,
      entries: collisions.map(({ entry }) => entry.path),
    }, null, 2)}\n`, "utf8");
    console.log(`  backup created: ${backupDirectory}`);
  }

  const changedDestinations = [];
  try {
    for (const { entry } of containerPlans) {
      await removeDestination(entry.destination);
      changedDestinations.push(entry.destination);
    }
    for (const { action, entry } of plans) {
      if (action === "keep") continue;
      await assertManagedParentSafe(options.target, entry.destination);
      await mkdir(dirname(entry.destination), { recursive: true });
      await assertManagedParentSafe(options.target, entry.destination);
      if (action === "replace") await removeDestination(entry.destination);
      if (entry.kind === "file") {
        await writeFile(entry.destination, entry.content, { flag: "wx" });
      } else {
        const type = process.platform === "win32" && entry.directory ? "junction" : entry.directory ? "dir" : "file";
        await symlink(entry.source, entry.destination, type);
      }
      changedDestinations.push(entry.destination);
    }

    const storedEntries = entries.map(storedEntry);
    if (!equivalentState(existingState, options.mode, entries) || plans.some(({ action }) => action !== "keep")) {
      await mkdir(options.target, { recursive: true });
      await writeState(options.target, {
        schema: stateVersion,
        package: packageName,
        mode: options.mode,
        installedAt: new Date().toISOString(),
        entries: storedEntries,
      });
    }
  } catch (error) {
    let rollbackError = null;
    try {
      for (const destination of [...changedDestinations].reverse()) {
        if (await pathStatus(destination)) await removeDestination(destination);
      }
      if (backupDirectory) {
        for (const { entry } of collisions) {
          const backup = join(backupDirectory, entry.path);
          if (await pathStatus(backup)) await copyForBackup(backup, entry.destination);
        }
        const backedUpState = join(backupDirectory, stateName);
        if (await pathStatus(backedUpState)) {
          const currentState = join(options.target, stateName);
          if (await pathStatus(currentState)) await removeDestination(currentState);
          await copyForBackup(backedUpState, currentState);
        }
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

  console.log(plans.every(({ action }) => action === "keep") ? "Already up to date." : "Installation complete.");
  console.log("Next: configure OpenCode permissions for unattended child sessions; this installer leaves opencode.jsonc unchanged.");
  console.log("See the README section 'Configure OpenCode permissions' before starting /autonomous.");
}

async function removeEmptyPackageDirectories(target) {
  const directories = [
    "skills/autonomous-mode",
    "skills/source-code-lookup",
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
