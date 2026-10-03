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
const openaiMarketplacePath = join(repositoryRoot, ".agents", "plugins", "marketplace.json");

function usage() {
  return `Usage:
  node scripts/publish-default-plugin.mjs [--check]

Publishes the shared AgenticAle skills-only plugin and both marketplace
catalogs (Copilot .github/plugin/marketplace.json and OpenAI
.agents/plugins/marketplace.json) from the packaged routing by default.
--check verifies the committed plugin and both catalogs are current. No
model request is made.`;
}

// The OpenAI/Codex catalog is a distinct contract from the Copilot catalog:
// each plugin entry carries a `policy` object declaring how the plugin may be
// installed and whether it needs authentication. These are the host-documented
// enums (see the plugin-management packaging reference); validateOpenaiPolicy
// enforces them independently of this generator, and live installation can
// remain a manual pass.
const OPENAI_INSTALLATION_POLICIES = ["AVAILABLE", "INSTALLED_BY_DEFAULT", "NOT_AVAILABLE"];
const OPENAI_AUTHENTICATION_POLICIES = ["ON_INSTALL", "ON_USE"];

function validateOpenaiPolicy(manifest) {
  const plugins = manifest?.plugins;
  if (!Array.isArray(plugins) || plugins.length === 0) {
    throw new Error("OpenAI marketplace manifest must declare at least one plugin.");
  }
  for (const plugin of plugins) {
    const policy = plugin?.policy;
    if (!policy || typeof policy !== "object") {
      throw new Error(`OpenAI marketplace plugin '${plugin?.name}' must declare a policy object.`);
    }
    if (!OPENAI_INSTALLATION_POLICIES.includes(policy.installation)) {
      throw new Error(`OpenAI marketplace installation policy '${policy.installation}' is not a documented value (expected one of ${OPENAI_INSTALLATION_POLICIES.join(", ")}).`);
    }
    if (!OPENAI_AUTHENTICATION_POLICIES.includes(policy.authentication)) {
      throw new Error(`OpenAI marketplace authentication policy '${policy.authentication}' is not a documented value (expected one of ${OPENAI_AUTHENTICATION_POLICIES.join(", ")}).`);
    }
  }
}

function openaiMarketplaceManifest() {
  return {
    name: "agenticale",
    owner: { name: "Ale Franz" },
    metadata: {
      description: "AgenticAle workflows for reviewed coding tasks and autonomous projects.",
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
      policy: {
        installation: "INSTALLED_BY_DEFAULT",
        authentication: "ON_USE",
      },
    }],
  };
}

// The Copilot (Agent Plugins) catalog.
function marketplaceManifest() {
  return {
    name: "agenticale",
    owner: { name: "Ale Franz" },
    metadata: {
      description: "AgenticAle workflows for reviewed coding tasks and autonomous projects.",
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

async function readOptionalFile(path) {
  try {
    return (await readFile(path, "utf8")).replace(/\r\n?/g, "\n");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
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
    const openaiManifest = openaiMarketplaceManifest();
    validateOpenaiPolicy(openaiManifest);
    const expectedCopilotCatalog = `${JSON.stringify(marketplaceManifest(), null, 2)}\n`;
    const expectedOpenaiCatalog = `${JSON.stringify(openaiManifest, null, 2)}\n`;

    if (check) {
      const differences = await pluginDifferences(build.copilotRoot, publishedPluginRoot);
      const actualCopilot = await readOptionalFile(marketplacePath);
      if (actualCopilot !== expectedCopilotCatalog) differences.push(".github/plugin/marketplace.json");
      const actualOpenai = await readOptionalFile(openaiMarketplacePath);
      if (actualOpenai !== null) validateOpenaiPolicy(JSON.parse(actualOpenai));
      if (actualOpenai !== expectedOpenaiCatalog) differences.push(".agents/plugins/marketplace.json");
      if (differences.length > 0) {
        throw new Error(`Published plugin or catalogs are stale: ${differences.join(", ")}. Run node scripts/publish-default-plugin.mjs.`);
      }
      console.log(`Published plugin and both catalogs are current: ${pluginManifest.version}.`);
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
    await writeFile(marketplacePath, expectedCopilotCatalog, "utf8");
    await mkdir(dirname(openaiMarketplacePath), { recursive: true });
    await writeFile(openaiMarketplacePath, expectedOpenaiCatalog, "utf8");
    console.log(`Published default plugin ${pluginManifest.version} to ${publishedPluginRoot}.`);
    console.log(`Published Copilot marketplace catalog to ${marketplacePath}.`);
    console.log(`Published OpenAI marketplace catalog to ${openaiMarketplacePath}.`);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`Publish failed: ${error.message}`);
  process.exitCode = 1;
});
