#!/usr/bin/env node

import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { buildBundles, parseArguments, pluginManifest } from "./build.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const publishedPluginRoot = join(repositoryRoot, "plugins", "agenticale");
const marketplacePath = join(repositoryRoot, ".github", "plugin", "marketplace.json");

function usage() {
  return `Usage:
  node scripts/publish-default-plugin.mjs [--check]

Without --check, regenerates the committed default Copilot plugin and its
marketplace manifest from the canonical sources. With --check, exits nonzero
if either committed artifact is stale. The published defaults are the gpt
model preset, high worker effort, and low coordinator effort.`;
}

function marketplaceManifest() {
  return {
    name: "agenticale",
    owner: { name: "Ale Franz" },
    metadata: {
      description: "AgenticAle plugins for autonomous software development workflows.",
      version: pluginManifest.version,
    },
    plugins: [{
      name: pluginManifest.name,
      source: "./plugins/agenticale",
      description: pluginManifest.description,
      version: pluginManifest.version,
      author: pluginManifest.author,
      homepage: pluginManifest.homepage,
      repository: pluginManifest.repository,
      license: pluginManifest.license,
      keywords: pluginManifest.keywords,
      category: "development",
      tags: ["autonomous", "coding", "review"],
      strict: true,
    }],
  };
}

async function fileMap(root) {
  const result = new Map();
  async function visit(directory) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile()) {
        const contents = (await readFile(absolute, "utf8")).replace(/\r\n?/g, "\n");
        result.set(relative(root, absolute).split(sep).join("/"), contents);
      }
    }
  }
  await visit(root);
  return result;
}

async function pluginDifferences(expectedRoot, actualRoot) {
  const [expected, actual] = await Promise.all([fileMap(expectedRoot), fileMap(actualRoot)]);
  const paths = [...new Set([...expected.keys(), ...actual.keys()])].sort();
  return paths.filter((path) => expected.get(path) !== actual.get(path));
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(usage());
    return;
  }
  if (args.some((argument) => argument !== "--check")) {
    throw new Error(`Unknown argument '${args.find((argument) => argument !== "--check")}'.`);
  }
  const check = args.includes("--check");
  const temporaryRoot = await mkdtemp(join(tmpdir(), "agenticale-publish-"));
  try {
    const build = await buildBundles(parseArguments(["--output", temporaryRoot]));
    const expectedMarketplace = `${JSON.stringify(marketplaceManifest(), null, 2)}\n`;

    if (check) {
      const differences = await pluginDifferences(build.copilotRoot, publishedPluginRoot);
      let actualMarketplace = null;
      try {
        actualMarketplace = (await readFile(marketplacePath, "utf8")).replace(/\r\n?/g, "\n");
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      if (actualMarketplace !== expectedMarketplace) differences.push(".github/plugin/marketplace.json");
      if (differences.length > 0) {
        throw new Error(`Published Copilot plugin is stale: ${differences.join(", ")}. Run node scripts/publish-default-plugin.mjs.`);
      }
      console.log(`Published Copilot plugin is current: ${pluginManifest.version}.`);
      return;
    }

    const expectedPublishedRoot = join(repositoryRoot, "plugins", "agenticale");
    if (resolve(publishedPluginRoot) !== resolve(expectedPublishedRoot)) {
      throw new Error("Refusing to replace an unexpected published-plugin path.");
    }
    await rm(publishedPluginRoot, { recursive: true, force: true });
    await mkdir(dirname(publishedPluginRoot), { recursive: true });
    await cp(build.copilotRoot, publishedPluginRoot, { recursive: true });
    await mkdir(dirname(marketplacePath), { recursive: true });
    await writeFile(marketplacePath, expectedMarketplace, "utf8");
    console.log(`Published default Copilot plugin ${pluginManifest.version} to ${publishedPluginRoot}.`);
    console.log(`Published marketplace manifest to ${marketplacePath}.`);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`Publish failed: ${error.message}`);
  process.exitCode = 1;
});
