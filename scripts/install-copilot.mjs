#!/usr/bin/env node

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { buildBundles, parseArguments } from "./build.mjs";

function usage() {
  return `Usage:
  node scripts/install-copilot.mjs [--models PATH|PRESET | --no-model]
                                   [--effort LEVEL]
                                   [--coordinator-effort LEVEL]
                                   [--source-root PATH] [--dry-run]

Builds a temporary Agent Plugins 1.0 package and installs it with
'copilot plugin install'. GitHub Copilot in VS Code discovers the same install.
The recommended default is the gpt preset, high worker effort, and low
coordinator effort. No model request is made by this installer.`;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => code === 0
      ? resolve()
      : reject(new Error(`${command} exited with code ${code}.`)));
  });
}

async function main() {
  const raw = process.argv.slice(2);
  if (raw.includes("--help") || raw.includes("-h")) {
    console.log(usage());
    return;
  }
  const dryRunIndex = raw.indexOf("--dry-run");
  const dryRun = dryRunIndex >= 0;
  if (dryRun) raw.splice(dryRunIndex, 1);

  const temporaryRoot = await mkdtemp(join(tmpdir(), "agenticale-copilot-"));
  try {
    const options = parseArguments([...raw, "--output", temporaryRoot]);
    const result = await buildBundles(options);
    if (dryRun) {
      console.log(`Dry run: would run copilot plugin install ${result.copilotRoot}`);
      return;
    }
    await run("copilot", ["plugin", "install", result.copilotRoot]);
    console.log("Installed AgenticAle for Copilot CLI and GitHub Copilot in VS Code.");
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`Copilot install failed: ${error.message}`);
  process.exitCode = 1;
});
