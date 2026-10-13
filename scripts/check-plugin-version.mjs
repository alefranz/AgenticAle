#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFile, readdir, realpath } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const manifestPath = "plugins/agenticale/plugin.json";
const catalogPaths = [".github/plugin/marketplace.json", ".agents/plugins/marketplace.json"];
const distributionPaths = ["plugins/agenticale", ...catalogPaths];
export const emptyRef = "0".repeat(40);

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 16 * 1024 * 1024 });
}

export function parseVersion(version) {
  if (typeof version !== "string" || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error(`Invalid plugin version '${version}'; use stable MAJOR.MINOR.PATCH.`);
  }
  return version.split(".").map(BigInt);
}

export function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
  }
  return 0;
}

// Compare committed distribution, not source paths: publisher --check separately
// ensures the current artifacts were generated from the authored source.
export async function distributionSnapshot({ ref, cwd = repositoryRoot } = {}) {
  const files = new Map();
  if (ref === emptyRef) return files; // Initial push has no previous tree.
  if (ref !== undefined) {
    const sha = git(["rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`], cwd).trim();
    const paths = git(["ls-tree", "-r", "--name-only", "-z", sha, "--", ...distributionPaths], cwd).split("\0").filter(Boolean);
    for (const path of paths) files.set(path, git(["show", `${sha}:${path}`], cwd).replace(/\r\n?/g, "\n"));
  } else {
    async function visit(path) {
      for (const entry of await readdir(join(cwd, path), { withFileTypes: true })) {
        const child = `${path}/${entry.name}`;
        if (entry.isDirectory()) await visit(child);
        else if (entry.isFile()) files.set(child, (await readFile(join(cwd, child), "utf8")).replace(/\r\n?/g, "\n"));
        else throw new Error(`Unexpected distribution entry: ${child}`);
      }
    }
    await visit("plugins/agenticale");
    for (const path of catalogPaths) files.set(path, (await readFile(join(cwd, path), "utf8")).replace(/\r\n?/g, "\n"));
  }
  return files;
}

function normalizedDistribution(files) {
  const normalized = new Map(files);
  const manifestText = files.get(manifestPath);
  if (!manifestText) throw new Error(`Missing ${manifestPath}; regenerate the plugin.`);
  const manifest = JSON.parse(manifestText);
  const version = manifest.version;
  parseVersion(version);
  delete manifest.version;
  normalized.set(manifestPath, JSON.stringify(manifest));
  for (const path of catalogPaths) {
    const text = files.get(path);
    if (!text) throw new Error(`Missing ${path}; regenerate the catalogs.`);
    const catalog = JSON.parse(text);
    const plugin = catalog.plugins?.find((entry) => entry.name === "agenticale");
    if (catalog.metadata?.version !== version || plugin?.version !== version) {
      throw new Error(`${path} does not match plugin version ${version}; regenerate the catalogs.`);
    }
    delete catalog.metadata.version;
    delete plugin.version;
    normalized.set(path, JSON.stringify(catalog));
  }
  return { files: normalized, version };
}

export function checkDistributions(baseFiles, headFiles) {
  const head = normalizedDistribution(headFiles);
  if (baseFiles.size === 0) return { version: head.version, previousVersion: null, versionIncreased: true, changed: [...head.files.keys()].sort() };
  const base = normalizedDistribution(baseFiles);
  const comparison = compareVersions(head.version, base.version);
  if (comparison < 0) throw new Error(`Plugin version cannot decrease: ${base.version} -> ${head.version}.`);
  const changed = [...new Set([...base.files.keys(), ...head.files.keys()])]
    .filter((path) => base.files.get(path) !== head.files.get(path)).sort();
  if (changed.length && comparison === 0) {
    throw new Error(`Distributed plugin changed without a version bump (${head.version}): ${changed.join(", ")}. Increase pluginManifest.version in scripts/build.mjs and regenerate the plugin and catalogs.`);
  }
  return { version: head.version, previousVersion: base.version, versionIncreased: comparison > 0, changed };
}

export async function checkPluginVersion({ base, head, cwd = repositoryRoot }) {
  if (!base) throw new Error("A target branch or previous commit is required (--base REF).");
  return checkDistributions(await distributionSnapshot({ ref: base, cwd }), await distributionSnapshot({ ref: head, cwd }));
}

async function main() {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!["--base", "--head"].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith("--") || options[args[i].slice(2)]) {
      throw new Error("Usage: node scripts/check-plugin-version.mjs --base REF [--head REF] (defaults to working tree).");
    }
    options[args[i].slice(2)] = args[i + 1];
  }
  const result = await checkPluginVersion(options);
  console.log(`Plugin version valid: ${result.previousVersion ?? "initial"} -> ${result.version}; ${result.changed.length} changed distribution files.`);
}

if (process.argv[1] && await realpath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
