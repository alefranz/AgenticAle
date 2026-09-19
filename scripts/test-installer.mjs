#!/usr/bin/env node

import {
  cpSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const installer = join(scriptDirectory, "install.mjs");
const stateName = ".autonomous-mode-install.json";
const fixtureRoot = mkdtempSync(join(tmpdir(), "autonomous-mode-installer-test-"));
let assertions = 0;

function assert(condition, message) {
  assertions += 1;
  if (!condition) throw new Error(message);
}

function runWith(installerPath, workingDirectory, arguments_, expectedStatus = 0) {
  const result = spawnSync(process.execPath, [installerPath, ...arguments_], {
    cwd: workingDirectory,
    encoding: "utf8",
  });
  assert(result.status === expectedStatus,
    `Expected exit ${expectedStatus}, got ${result.status}.\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  return result;
}

function run(arguments_, expectedStatus = 0) {
  return runWith(installer, repositoryRoot, arguments_, expectedStatus);
}

function target(name) {
  return join(fixtureRoot, name);
}

function installedFile(root, path) {
  return join(root, ...path.split("/"));
}

function createDirectoryLink(source, destination) {
  symlinkSync(source, destination, process.platform === "win32" ? "junction" : "dir");
}

function writeState(root, state) {
  writeFileSync(join(root, stateName), `${JSON.stringify(state, null, 2)}\n`);
}

function createCrLfBundle() {
  const root = target("crlf-bundle");
  for (const directory of ["agents", "commands", "skills"]) {
    cpSync(join(repositoryRoot, directory), join(root, directory), { recursive: true });
  }
  mkdirSync(join(root, "scripts"), { recursive: true });
  const crlfInstaller = join(root, "scripts", "install.mjs");
  cpSync(installer, crlfInstaller);
  const agent = join(root, "agents", "autonomous", "consult.md");
  writeFileSync(agent, readFileSync(agent, "utf8").replace(/\r?\n/g, "\r\n"));
  return { root, installer: crlfInstaller };
}

function assertRejectedState(name, mutate) {
  const root = target(`invalid-state-${name}`);
  run(["--target", root, "--no-model"]);
  const statePath = join(root, stateName);
  const state = JSON.parse(readFileSync(statePath, "utf8"));
  mutate(state);
  writeState(root, state);
  const ownedPath = installedFile(root, "agents/autonomous/consult.md");
  const result = run(["uninstall", "--target", root], 1);
  assert(result.stderr.includes("Install state"), `${name} state rejection should identify install state`);
  assert(existsSync(ownedPath), `${name} invalid state must be rejected before deleting owned files`);
  assert(existsSync(statePath), `${name} invalid state must remain available for recovery`);
}

try {
  const implicitModelChoiceTarget = target("implicit-model-choice");
  const implicitModelChoice = run(["--target", implicitModelChoiceTarget], 1);
  assert(implicitModelChoice.stderr.includes("requires --models PATH|PRESET or --no-model"),
    "install should require an explicit model mapping or inheritance choice");
  assert(!existsSync(implicitModelChoiceTarget), "missing model choice must not mutate the target");

  const copyTarget = target("copy");
  const firstCopy = run(["--target", copyTarget, "--no-model"]);
  assert(firstCopy.stdout.includes("Installation complete."), "copy install should report completion");
  assert(firstCopy.stdout.includes("leaves opencode.jsonc unchanged"),
    "copy install should remind users to configure permissions separately");
  const stateBefore = readFileSync(join(copyTarget, stateName), "utf8");
  const state = JSON.parse(stateBefore);
  assert(state.schema === 3 && state.mode === "copy" && state.entries.length === 11,
    "copy state should own exactly eleven files in schema v3");
  for (const entry of state.entries) {
    assert(existsSync(installedFile(copyTarget, entry.path)), `copy install omitted ${entry.path}`);
  }

  const secondCopy = run(["install", `--target=${copyTarget}`, "--no-model"]);
  assert(secondCopy.stdout.includes("Already up to date."), "second copy install should be idempotent");
  assert(readFileSync(join(copyTarget, stateName), "utf8") === stateBefore,
    "idempotent install should not rewrite state");

  const defaultLookup = readFileSync(installedFile(copyTarget, "skills/source-code-lookup/SKILL.md"), "utf8");
  assert(defaultLookup.includes('Source root: "~/dev"'), "default lookup skill should use ~/dev");
  const customSourceRoot = target("source roots with spaces");
  const customTarget = target("custom-source-root");
  run(["--target", customTarget, "--no-model", "--source-root", customSourceRoot]);
  const customLookup = readFileSync(installedFile(customTarget, "skills/source-code-lookup/SKILL.md"), "utf8");
  assert(customLookup.includes(`Source root: ${JSON.stringify(resolve(customSourceRoot))}`),
    "copy install should render the selected source root");
  assert(run(["--target", customTarget, "--no-model", `--source-root=${customSourceRoot}`])
    .stdout.includes("Already up to date."), "custom source root should be idempotent");
  assert(run(["--target", customTarget, "--no-model"], 1).stderr.includes("--replace"),
    "changing the source root should require explicit replacement");
  const sourceRootUpdate = run(["--target", customTarget, "--no-model", "--replace"]);
  assert(sourceRootUpdate.stdout.includes("backup created:"),
    "changing the source root with --replace should back up the previous skill");
  assert(readFileSync(installedFile(customTarget, "skills/source-code-lookup/SKILL.md"), "utf8")
    .includes('Source root: "~/dev"'), "replacement should restore the default source root");
  run(["uninstall", "--target", customTarget]);
  assert(!existsSync(installedFile(customTarget, "skills/source-code-lookup/SKILL.md")),
    "uninstall should remove the rendered lookup skill");

  const homeSourceTarget = target("home-source-root");
  run(["--target", homeSourceTarget, "--no-model", "--source-root", "~/source"]);
  assert(readFileSync(installedFile(homeSourceTarget, "skills/source-code-lookup/SKILL.md"), "utf8")
    .includes(`Source root: ${JSON.stringify(resolve(homedir(), "source"))}`),
    "a tilde source root should resolve against the user's home directory");
  run(["uninstall", "--target", homeSourceTarget]);

  const legacyTarget = target("legacy-copy");
  run(["--target", legacyTarget, "--no-model"]);
  const legacyState = JSON.parse(readFileSync(join(legacyTarget, stateName), "utf8"));
  legacyState.schema = 1;
  legacyState.entries = legacyState.entries.filter((entry) => ![
    "skills/pull-request-description/SKILL.md",
    "skills/source-code-lookup/SKILL.md",
  ].includes(entry.path));
  rmSync(installedFile(legacyTarget, "skills/source-code-lookup"), { recursive: true });
  writeState(legacyTarget, legacyState);
  run(["--target", legacyTarget, "--no-model"]);
  const updatedState = JSON.parse(readFileSync(join(legacyTarget, stateName), "utf8"));
  assert(updatedState.schema === 3 && updatedState.entries.length === 11,
    "updating an older copy install should add the new skill and advance the state schema");
  run(["uninstall", "--target", legacyTarget]);

  const versionTwoTarget = target("version-two-copy");
  run(["--target", versionTwoTarget, "--no-model"]);
  const versionTwoState = JSON.parse(readFileSync(join(versionTwoTarget, stateName), "utf8"));
  versionTwoState.schema = 2;
  versionTwoState.entries = versionTwoState.entries.filter((entry) => entry.path !== "skills/pull-request-description/SKILL.md");
  rmSync(installedFile(versionTwoTarget, "skills/pull-request-description"), { recursive: true });
  writeState(versionTwoTarget, versionTwoState);
  run(["--target", versionTwoTarget, "--no-model"]);
  const upgradedVersionTwoState = JSON.parse(readFileSync(join(versionTwoTarget, stateName), "utf8"));
  assert(upgradedVersionTwoState.schema === 3 && upgradedVersionTwoState.entries.length === 11,
    "updating a version-two copy install should add the PR skill and advance the state schema");
  run(["uninstall", "--target", versionTwoTarget]);

  const legacyUninstallTarget = target("legacy-uninstall");
  run(["--target", legacyUninstallTarget, "--no-model"]);
  const oldState = JSON.parse(readFileSync(join(legacyUninstallTarget, stateName), "utf8"));
  oldState.schema = 1;
  oldState.entries = oldState.entries.filter((entry) => ![
    "skills/pull-request-description/SKILL.md",
    "skills/source-code-lookup/SKILL.md",
  ].includes(entry.path));
  rmSync(installedFile(legacyUninstallTarget, "skills/source-code-lookup"), { recursive: true });
  writeState(legacyUninstallTarget, oldState);
  run(["uninstall", "--target", legacyUninstallTarget]);
  assert(!existsSync(installedFile(legacyUninstallTarget, "skills/autonomous-mode/SKILL.md")),
    "uninstall should accept the older nine-file state");

  const modelTarget = target("configured-models");
  const modelConfigA = target("models-a.json");
  const modelConfigB = target("models-b.json");
  writeFileSync(modelConfigA, JSON.stringify({
    explore: "example/fast-model#medium",
    implement: "example/fast-model#medium",
    review: "example/strong-model#high",
    "deep-review": "example/frontier-model#high",
  }));
  writeFileSync(modelConfigB, JSON.stringify({ review: "other-provider/new-model#xhigh" }));

  const crlfBundle = createCrLfBundle();
  const crlfModelConfig = join(crlfBundle.root, "models.json");
  const crlfTarget = target("crlf-configured-models");
  writeFileSync(crlfModelConfig, JSON.stringify({ consult: "example/consult-model#medium" }));
  runWith(crlfBundle.installer, crlfBundle.root,
    ["--target", crlfTarget, "--models", crlfModelConfig]);
  assert(readFileSync(installedFile(crlfTarget, "agents/autonomous/consult.md"), "utf8")
    .includes("mode: subagent\r\nmodel: example/consult-model#medium"),
  "configured model installation must support CRLF agent frontmatter");

  const presets = [
    ["openai", "openai/gpt-5.6-terra"],
    ["zen", "opencode/gpt-5.6-terra"],
    ["local", "local-llama/qwen3.8-27b#xhigh"],
    ["example", "local-llama/qwen3.8-27b#xhigh"],
  ];
  for (const [preset, expectedReviewModel] of presets) {
    const presetTarget = target(`preset-${preset}`);
    run(["--target", presetTarget, "--models", preset]);
    assert(readFileSync(installedFile(presetTarget, "agents/autonomous/review.md"), "utf8")
      .includes(`model: ${expectedReviewModel}`),
    `${preset} preset should render its bundled review model`);
    run(["uninstall", "--target", presetTarget]);
  }

  run(["--target", modelTarget, "--no-model"]);
  const modelReviewPath = installedFile(modelTarget, "agents/autonomous/review.md");
  const originalReview = readFileSync(modelReviewPath, "utf8");
  assert(!/^model:/m.test(originalReview), "default copy install should inherit the session model");
  const modelUpdateRefusal = run(["--target", modelTarget, "--models", modelConfigA], 1);
  assert(modelUpdateRefusal.stderr.includes("Differing content already exists"),
    "adding model assignments must require explicit replacement");
  assert(readFileSync(modelReviewPath, "utf8") === originalReview,
    "refused model update must preserve installed agents");
  const modelDryRun = run(["--target", modelTarget, "--models", modelConfigA, "--replace", "--dry-run"]);
  assert(modelDryRun.stdout.includes("Dry run complete") && readFileSync(modelReviewPath, "utf8") === originalReview,
    "configured dry run must not change the installed copy");
  run(["--target", modelTarget, "--models", modelConfigA, "--replace"]);
  const configuredReview = readFileSync(modelReviewPath, "utf8");
  assert(/^model: example\/strong-model#high$/m.test(configuredReview),
    "configured review agent should have its own model frontmatter");
  assert(/^model: example\/fast-model#medium$/m.test(
    readFileSync(installedFile(modelTarget, "agents/autonomous/explore.md"), "utf8")),
  "configured fast role should use its assigned model");
  assert(!/^model:/m.test(readFileSync(installedFile(modelTarget, "agents/autonomous/consult.md"), "utf8")),
    "unassigned role should continue to inherit the session model");
  const modelState = JSON.parse(readFileSync(join(modelTarget, stateName), "utf8"));
  assert(modelState.entries.find((entry) => entry.path === "agents/autonomous/review.md").digest
    === createHash("sha256").update(configuredReview).digest("hex"),
  "install state must hash rendered agent content");
  const modelStateBefore = readFileSync(join(modelTarget, stateName), "utf8");
  assert(run(["--target", modelTarget, "--models", modelConfigA]).stdout.includes("Already up to date."),
    "same model mapping should be idempotent");
  assert(readFileSync(join(modelTarget, stateName), "utf8") === modelStateBefore,
    "idempotent configured install should not rewrite state");
  run(["--target", modelTarget, "--models", modelConfigB], 1);
  assert(readFileSync(modelReviewPath, "utf8") === configuredReview,
    "refused mapping change must keep the prior configured role");
  run(["--target", modelTarget, "--models", modelConfigB, "--replace"]);
  assert(/^model: other-provider\/new-model#xhigh$/m.test(readFileSync(modelReviewPath, "utf8")),
    "explicit replacement should update a role model");
  const modelBackups = readdirSync(join(modelTarget, ".autonomous-mode-backups")).sort();
  assert(modelBackups.length === 2, "two model changes should create two backup directories");
  assert(readFileSync(installedFile(
    join(modelTarget, ".autonomous-mode-backups", modelBackups[1]),
    "agents/autonomous/review.md",
  ), "utf8") === configuredReview, "mapping replacement backup should preserve the previous configured agent");
  assert(!/^model:/m.test(readFileSync(installedFile(modelTarget, "agents/autonomous/explore.md"), "utf8")),
    "roles removed from the mapping should return to inheritance");
  run(["--target", modelTarget, "--replace", "--no-model"]);
  assert(readFileSync(modelReviewPath, "utf8") === originalReview,
    "explicit replacement with --no-model should restore the public defaults");
  run(["uninstall", "--target", modelTarget]);
  assert(!existsSync(modelReviewPath), "uninstall should remove an unchanged formerly configured agent");

  const invalidModels = [
    ["not-json", "{", "not valid JSON"],
    ["array", "[]", "JSON object"],
    ["unknown", JSON.stringify({ unknown: "example/model" }), "Unknown autonomous role"],
    ["number", JSON.stringify({ review: 42 }), "Invalid model"],
    ["injection", JSON.stringify({ review: "example/model\nsteps: 999" }), "Invalid model"],
    ["missing-provider", JSON.stringify({ review: "model-only" }), "Invalid model"],
  ];
  for (const [name, contents, errorText] of invalidModels) {
    const file = target(`invalid-models-${name}.json`);
    const destination = target(`invalid-models-${name}`);
    writeFileSync(file, contents);
    const result = run(["--target", destination, "--models", file], 1);
    assert(result.stderr.includes(errorText), `${name} model mapping should be rejected clearly`);
    assert(!existsSync(destination), `${name} model mapping must fail before target mutation`);
  }
  assert(run(["--target", target("missing-models-option"), "--models", "--dry-run"], 1)
    .stderr.includes("--models requires a path"), "missing --models value must not consume an option");
  assert(run(["--target", target("conflicting-model-options"), "--models", modelConfigA, "--no-model"], 1)
    .stderr.includes("cannot be used together"), "model mapping and inheritance opt-out must be exclusive");
  assert(run(["--target", target("linked-models"), "--link", "--models", modelConfigA], 1)
    .stderr.includes("requires a copy install"), "link installs must reject model rendering");
  assert(run(["--target", target("linked-source-root"), "--link", "--no-model", "--source-root", customSourceRoot], 1)
    .stderr.includes("requires a copy install"), "link installs must reject source-root rendering");
  assert(run(["--target", target("missing-source-root"), "--no-model", "--source-root", "--dry-run"], 1)
    .stderr.includes("--source-root requires a path"), "source root must not consume another option");
  assert(run(["uninstall", "--target", copyTarget, "--source-root", customSourceRoot], 1)
    .stderr.includes("only to install/update"), "uninstall must reject source-root input");
  assert(run(["--target", target("unselected-link"), "--link"], 1)
    .stderr.includes("requires --models PATH|PRESET or --no-model"), "link installs should require an explicit model choice");
  assert(run(["uninstall", "--target", copyTarget, "--models", modelConfigA], 1)
    .stderr.includes("only to install/update"), "uninstall must reject model mapping input");
  assert(run(["uninstall", "--target", copyTarget, "--no-model"], 1)
    .stderr.includes("only to install/update"), "uninstall must reject model inheritance input");

  const updatePath = installedFile(copyTarget, "agents/autonomous/consult.md");
  writeFileSync(updatePath, "locally customized model configuration\n");
  run(["--target", copyTarget, "--no-model"], 1);
  const update = run(["--target", copyTarget, "--replace", "--no-model"]);
  assert(update.stdout.includes("backup created:"), "explicit update replacement should create a backup");
  const updateBackups = readdirSync(join(copyTarget, ".autonomous-mode-backups"));
  assert(updateBackups.length === 1, "update should create one backup directory");
  const updateBackupPath = installedFile(
    join(copyTarget, ".autonomous-mode-backups", updateBackups[0]),
    "agents/autonomous/consult.md",
  );
  assert(readFileSync(updateBackupPath, "utf8") === "locally customized model configuration\n",
    "update backup should preserve a customized installed file");
  assert(readFileSync(updatePath, "utf8") !== "locally customized model configuration\n",
    "explicit update should restore current bundle content");

  const dryTarget = target("dry-run");
  const dryRun = run(["--target", dryTarget, "--dry-run", "--no-model"]);
  assert(dryRun.stdout.includes("Dry run complete"), "dry run should identify itself");
  assert(!existsSync(dryTarget), "dry run must not create the target");

  const collisionTarget = target("collision");
  const collisionPath = installedFile(collisionTarget, "commands/autonomous.md");
  mkdirSync(dirname(collisionPath), { recursive: true });
  writeFileSync(collisionPath, "user content\n");
  const collision = run(["--target", collisionTarget, "--no-model"], 1);
  assert(collision.stderr.includes("Differing content already exists"), "collision should be actionable");
  assert(readFileSync(collisionPath, "utf8") === "user content\n", "refused collision must remain unchanged");
  assert(!existsSync(join(collisionTarget, stateName)), "refused collision must not create install state");

  const replacement = run(["--target", collisionTarget, "--replace", "--no-model"]);
  assert(replacement.stdout.includes("backup created:"), "replacement should report its backup");
  const backupRoot = join(collisionTarget, ".autonomous-mode-backups");
  const backupDirectories = readdirSync(backupRoot);
  assert(backupDirectories.length === 1, "replacement should create one backup directory");
  const backedUpCollision = installedFile(join(backupRoot, backupDirectories[0]), "commands/autonomous.md");
  assert(readFileSync(backedUpCollision, "utf8") === "user content\n", "backup should preserve replaced content");
  assert(readFileSync(collisionPath, "utf8") !== "user content\n", "replacement should install bundle content");

  const modifiedTarget = target("uninstall-modified");
  const unrelatedPath = installedFile(modifiedTarget, "commands/user-command.md");
  mkdirSync(dirname(unrelatedPath), { recursive: true });
  writeFileSync(unrelatedPath, "unrelated profile content\n");
  run(["--target", modifiedTarget, "--no-model"]);
  const modifiedPath = installedFile(modifiedTarget, "agents/autonomous/implement.md");
  const unchangedPath = installedFile(modifiedTarget, "agents/autonomous/review.md");
  writeFileSync(modifiedPath, `${readFileSync(modifiedPath, "utf8")}\nuser customization\n`);
  const uninstall = run(["uninstall", "--target", modifiedTarget]);
  assert(uninstall.stdout.includes("Preserved 1 modified destination"), "uninstall should report preserved modifications");
  assert(existsSync(modifiedPath), "uninstall must preserve a modified installed file");
  assert(!existsSync(unchangedPath), "uninstall should remove an unchanged owned file");
  assert(!existsSync(join(modifiedTarget, stateName)), "uninstall should release package ownership state");
  assert(readFileSync(unrelatedPath, "utf8") === "unrelated profile content\n",
    "install and uninstall must not alter unrelated profile content");

  const linkTarget = target("link");
  let linksSupported = true;
  const linkInstall = spawnSync(process.execPath, [installer, "--target", linkTarget, "--link", "--no-model"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  if (linkInstall.status !== 0 && /privilege|operation not permitted|not permitted|EPERM/i.test(linkInstall.stderr)) {
    linksSupported = false;
    console.log("Link test skipped: this environment does not permit symbolic links/junctions.");
  } else {
    assert(linkInstall.status === 0, `link install failed unexpectedly:\n${linkInstall.stderr}`);
  }
  if (linksSupported) {
    const linkState = JSON.parse(readFileSync(join(linkTarget, stateName), "utf8"));
    assert(linkState.mode === "link" && linkState.entries.length === 5, "link state should own five links");
    for (const entry of linkState.entries) {
      assert(lstatSync(installedFile(linkTarget, entry.path)).isSymbolicLink(), `${entry.path} should be a link`);
    }
    run(["uninstall", "--target", linkTarget]);
    for (const entry of linkState.entries) {
      assert(!existsSync(installedFile(linkTarget, entry.path)), `uninstall should remove unchanged link ${entry.path}`);
    }
  }

  const missingTargetWorkingDirectory = target("missing-target-working-directory");
  mkdirSync(missingTargetWorkingDirectory, { recursive: true });
  const missingTarget = runWith(installer, missingTargetWorkingDirectory, ["--target", "--dry-run"], 1);
  assert(missingTarget.stderr.includes("--target requires a path"), "an option cannot be consumed as --target's value");
  assert(!existsSync(join(missingTargetWorkingDirectory, "--dry-run")),
    "a missing --target value must fail without creating an option-named directory");
  const inlineMissingTarget = runWith(installer, missingTargetWorkingDirectory, ["--target=--dry-run"], 1);
  assert(inlineMissingTarget.stderr.includes("--target requires a path"),
    "an option-looking inline --target value should be rejected");

  const physicalSelectedProfile = target("physical-selected-profile");
  const selectedProfileLink = target("selected-profile-link");
  mkdirSync(physicalSelectedProfile, { recursive: true });
  createDirectoryLink(physicalSelectedProfile, selectedProfileLink);
  run(["--target", selectedProfileLink, "--no-model"]);
  assert(existsSync(join(physicalSelectedProfile, stateName)),
    "an explicitly selected profile link should install into its physical directory");
  run(["uninstall", "--target", selectedProfileLink]);
  assert(!existsSync(join(physicalSelectedProfile, stateName)),
    "an explicitly selected profile link should uninstall from its physical directory");

  const externalCommands = target("external-commands");
  const linkedAncestorTarget = target("linked-ancestor");
  mkdirSync(externalCommands, { recursive: true });
  mkdirSync(linkedAncestorTarget, { recursive: true });
  createDirectoryLink(externalCommands, join(linkedAncestorTarget, "commands"));
  const linkedAncestorInstall = run(["--target", linkedAncestorTarget, "--no-model"], 1);
  assert(linkedAncestorInstall.stderr.includes("linked ancestor"), "install should reject a managed linked ancestor");
  assert(!existsSync(join(externalCommands, "autonomous.md")), "install must not write through a linked ancestor");
  assert(!existsSync(join(linkedAncestorTarget, stateName)), "linked-ancestor refusal must not create state");

  const externalBackups = target("external-backups");
  const linkedBackupTarget = target("linked-backup");
  mkdirSync(externalBackups, { recursive: true });
  mkdirSync(linkedBackupTarget, { recursive: true });
  createDirectoryLink(externalBackups, join(linkedBackupTarget, ".autonomous-mode-backups"));
  const linkedBackupInstall = run(["--target", linkedBackupTarget, "--no-model"], 1);
  assert(linkedBackupInstall.stderr.includes("linked ancestor"), "install should reject a linked backup root");
  assert(readdirSync(externalBackups).length === 0, "install must not write through a linked backup root");

  const redirectedUninstallTarget = target("redirected-uninstall");
  const redirectedUninstallExternal = target("redirected-uninstall-external");
  run(["--target", redirectedUninstallTarget, "--no-model"]);
  mkdirSync(redirectedUninstallExternal, { recursive: true });
  const installedCommand = installedFile(redirectedUninstallTarget, "commands/autonomous.md");
  const externalCommand = join(redirectedUninstallExternal, "autonomous.md");
  writeFileSync(externalCommand, readFileSync(installedCommand));
  rmSync(join(redirectedUninstallTarget, "commands"), { recursive: true });
  createDirectoryLink(redirectedUninstallExternal, join(redirectedUninstallTarget, "commands"));
  const redirectedUninstall = run(["uninstall", "--target", redirectedUninstallTarget], 1);
  assert(redirectedUninstall.stderr.includes("linked ancestor"), "uninstall should reject a redirected managed ancestor");
  assert(existsSync(externalCommand), "uninstall must not remove a matching file outside the selected profile");
  assert(existsSync(join(redirectedUninstallTarget, stateName)), "redirected uninstall must retain install state");

  assertRejectedState("schema", (value) => { value.schema += 1; });
  assertRejectedState("package", (value) => { value.package = "another-package"; });
  assertRejectedState("mode-kind", (value) => { value.mode = "link"; });
  assertRejectedState("duplicate", (value) => { value.entries[1] = { ...value.entries[0] }; });
  assertRejectedState("missing", (value) => { value.entries.pop(); });
  assertRejectedState("extra", (value) => {
    value.entries.push({ path: "commands/extra.md", kind: "file", digest: "0".repeat(64) });
  });
  assertRejectedState("traversal", (value) => { value.entries[0].path = "../outside.md"; });
  assertRejectedState("noncanonical", (value) => { value.entries[0].path = "agents/../outside.md"; });
  assertRejectedState("kind", (value) => { value.entries[0].kind = "link"; });
  assertRejectedState("digest", (value) => { value.entries[0].digest = "not-a-sha256"; });

  const overlapParent = target("overlap-parent");
  const isolatedCheckout = join(overlapParent, "checkout");
  mkdirSync(join(isolatedCheckout, "scripts"), { recursive: true });
  cpSync(installer, join(isolatedCheckout, "scripts", "install.mjs"));
  for (const bundlePath of ["agents", "commands", "skills"]) {
    cpSync(join(repositoryRoot, bundlePath), join(isolatedCheckout, bundlePath), { recursive: true });
  }
  const isolatedInstaller = join(isolatedCheckout, "scripts", "install.mjs");
  const sourceBefore = readFileSync(join(isolatedCheckout, "commands", "autonomous.md"), "utf8");
  const equalOverlap = runWith(isolatedInstaller, fixtureRoot, ["--target", isolatedCheckout, "--no-model"], 1);
  assert(equalOverlap.stderr.includes("must not overlap"), "target equal to checkout should be rejected");
  assert(!existsSync(join(isolatedCheckout, stateName)), "equal overlap must not adopt checkout sources as installed files");
  assert(readFileSync(join(isolatedCheckout, "commands", "autonomous.md"), "utf8") === sourceBefore,
    "equal overlap must not modify checkout sources");

  const containingOverlap = runWith(isolatedInstaller, fixtureRoot, ["--target", overlapParent, "--no-model"], 1);
  assert(containingOverlap.stderr.includes("must not overlap"), "target containing checkout should be rejected");
  assert(!existsSync(join(overlapParent, stateName)), "containing overlap must not create install state");

  const resolvedOverlapLink = target("resolved-overlap-link");
  createDirectoryLink(isolatedCheckout, resolvedOverlapLink);
  const resolvedOverlap = runWith(isolatedInstaller, fixtureRoot, ["--target", resolvedOverlapLink, "--link", "--replace", "--no-model"], 1);
  assert(resolvedOverlap.stderr.includes("must not overlap"), "resolved target links into checkout should be rejected");
  assert(readFileSync(join(isolatedCheckout, "commands", "autonomous.md"), "utf8") === sourceBefore,
    "resolved overlap must not replace sources with self-links");

  const linkedSourceCheckout = target("linked-source-checkout");
  mkdirSync(join(linkedSourceCheckout, "scripts"), { recursive: true });
  cpSync(installer, join(linkedSourceCheckout, "scripts", "install.mjs"));
  for (const bundlePath of ["agents", "commands", "skills"]) {
    cpSync(join(repositoryRoot, bundlePath), join(linkedSourceCheckout, bundlePath), { recursive: true });
  }
  const linkedSourceTarget = target("linked-source-target");
  const externalAgentSource = join(linkedSourceTarget, "source-agents");
  mkdirSync(linkedSourceTarget, { recursive: true });
  cpSync(join(linkedSourceCheckout, "agents", "autonomous"), externalAgentSource, { recursive: true });
  rmSync(join(linkedSourceCheckout, "agents", "autonomous"), { recursive: true });
  createDirectoryLink(externalAgentSource, join(linkedSourceCheckout, "agents", "autonomous"));
  const linkedSourceInstaller = join(linkedSourceCheckout, "scripts", "install.mjs");
  const linkedSourceOverlap = runWith(linkedSourceInstaller, fixtureRoot, ["--target", linkedSourceTarget, "--no-model"], 1);
  assert(linkedSourceOverlap.stderr.includes("resolved bundle sources must not overlap"),
    "a source link resolving inside the target should be rejected");
  assert(!existsSync(join(linkedSourceTarget, stateName)), "resolved source overlap must not create install state");

  console.log(`Installer tests passed: ${assertions} assertions${linksSupported ? "" : ", link coverage skipped"}.`);
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}
