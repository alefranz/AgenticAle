#!/usr/bin/env node

import { strict as assert } from "node:assert";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildBundles, parseArguments, roles } from "./build.mjs";

const fixtureRoot = await mkdtemp(join(tmpdir(), "agenticale-build-test-"));
let assertions = 0;

function check(value, message) {
  assertions += 1;
  assert.ok(value, message);
}

async function text(path) {
  return readFile(path, "utf8");
}

async function files(path) {
  const entries = await readdir(path, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => entry.isDirectory()
    ? (await files(join(path, entry.name))).map((child) => `${entry.name}/${child}`)
    : [entry.name]));
  return nested.flat().sort();
}

try {
  const output = join(fixtureRoot, "default");
  const options = parseArguments(["--output", output]);
  const result = await buildBundles(options);

  check((await files(result.openCodeRoot)).length === 11, "OpenCode build should contain eleven bundle files");
  check((await files(result.copilotRoot)).length === 13, "Copilot plugin should contain manifest, agents, command, and skills");

  const manifest = JSON.parse(await text(join(result.copilotRoot, "plugin.json")));
  check(manifest.$schema === "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json", "manifest should opt into Agent Plugins 1.0");
  check(manifest.name === "agenticale", "plugin should use a portable lowercase name");

  const expectedModels = {
    explore: "gpt-5.6-luna",
    implement: "gpt-5.6-luna",
    "implement-hard": "gpt-5.6-terra",
    fix: "gpt-5.6-luna",
    review: "gpt-5.6-terra",
    "deep-review": "gpt-5.6-sol",
    consult: "gpt-5.6-sol",
  };
  for (const role of roles) {
    const agent = await text(join(result.copilotRoot, "com.github.copilot", "agents", `agenticale-${role}.agent.md`));
    check(agent.includes(`model: "${expectedModels[role]}"`), `${role} should derive its Copilot model from examples/gpt.json`);
    check(agent.includes('reasoningEffort: "high"'), `${role} should use high effort`);
    check(agent.includes("agents: []"), `${role} should disable nested subagents where supported`);
  }

  const coordinator = await text(join(result.copilotRoot, "com.github.copilot", "agents", "agenticale-autonomous.agent.md"));
  check(coordinator.includes('model: "gpt-5.6-sol"'), "coordinator should use the strongest configured role model");
  check(coordinator.includes('reasoningEffort: "low"'), "coordinator should use low effort");
  for (const role of roles) check(coordinator.includes(`"agenticale-${role}"`), `coordinator should allow ${role}`);
  check(!coordinator.includes("autonomous/explore"), "Copilot protocol should not retain OpenCode role IDs");
  check(coordinator.includes("load the `autonomous-mode` skill by exact ID"), "coordinator should explicitly load the generated protocol skill");
  check(coordinator.length < 30000, "coordinator should remain below GitHub's custom-agent prompt limit");
  check(!coordinator.includes("$ARGUMENTS"), "selected coordinator should consume the user's request directly");
  check(!coordinator.includes("deny both\nquestions"), "coordinator should not overstate Copilot question-tool enforcement");

  const autonomousSkill = await text(join(result.copilotRoot, "skills", "autonomous-mode", "SKILL.md"));
  check(/^name: autonomous-mode$/m.test(autonomousSkill), "Copilot skill name should match its directory");
  check(/^user-invocable: false$/m.test(autonomousSkill), "Copilot protocol skill should stay loadable without appearing as a slash command");
  check(!/^slash:|^version:|^metadata:/m.test(autonomousSkill), "Copilot skill should omit OpenCode-only metadata");
  check(!autonomousSkill.includes("configured `steps` ceiling"), "Copilot skill should not promise OpenCode step ceilings");
  check(!autonomousSkill.includes("available to OpenCode"), "Copilot skill should not retain OpenCode routing language");
  check(!autonomousSkill.includes("question tool is denied"), "Copilot skill should not claim unsupported question-tool enforcement");

  const openCodeExplore = await text(join(result.openCodeRoot, "agents", "autonomous", "explore.md"));
  check(/^model: opencode\/gpt-5\.6-luna$/m.test(openCodeExplore), "OpenCode build should preserve the provider-qualified model");

  const neutralOutput = join(fixtureRoot, "neutral");
  const neutral = await buildBundles(parseArguments(["--output", neutralOutput, "--no-model"]));
  const neutralAgent = await text(join(neutral.copilotRoot, "com.github.copilot", "agents", "agenticale-review.agent.md"));
  check(!/^model:|^reasoningEffort:/m.test(neutralAgent), "model-neutral build should inherit session model and effort");

  const customRoot = join(fixtureRoot, "source checkouts");
  const rooted = await buildBundles(parseArguments(["--output", join(fixtureRoot, "rooted"), "--source-root", customRoot]));
  const lookup = await text(join(rooted.copilotRoot, "skills", "source-code-lookup", "SKILL.md"));
  check(lookup.includes(`Source root: ${JSON.stringify(customRoot)}`), "source-root override should reach Copilot skill");

  const badModels = join(fixtureRoot, "bad-models.json");
  await writeFile(badModels, JSON.stringify({ unknown: "provider/model" }));
  await assert.rejects(
    buildBundles(parseArguments(["--output", join(fixtureRoot, "bad"), "--models", badModels])),
    /Unknown role/,
  );
  assertions += 1;
  assert.throws(() => parseArguments(["--output", join(fixtureRoot, "bad-effort"), "--effort", "extreme"]), /Invalid --effort/);
  assertions += 1;
  assert.throws(() => parseArguments(["--output", join(fixtureRoot, "conflict"), "--models", "gpt", "--no-model"]), /cannot be used together/);
  assertions += 1;

  const unmanagedOutput = join(fixtureRoot, "unmanaged");
  await mkdir(join(unmanagedOutput, "opencode"), { recursive: true });
  await assert.rejects(
    buildBundles(parseArguments(["--output", unmanagedOutput])),
    /unmanaged bundle paths/,
  );
  assertions += 1;

  console.log(`Build tests passed: ${assertions} assertions.`);
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
