#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkDistributions, checkPluginVersion, compareVersions, emptyRef, parseVersion } from "./check-plugin-version.mjs";

export function fixture(version = "0.3.0") {
  const catalog = JSON.stringify({ metadata: { version }, plugins: [{ name: "agenticale", version, policy: { installation: "AVAILABLE" } }] });
  return new Map([
    ["plugins/agenticale/plugin.json", JSON.stringify({ name: "agenticale", version, description: "Workflow" })],
    ["plugins/agenticale/skills/work/SKILL.md", "Workflow\n"],
    [".github/plugin/marketplace.json", catalog],
    [".agents/plugins/marketplace.json", catalog],
  ]);
}

// Also imported by the release test, without executing this test suite.
export async function gitFixture() {
  const cwd = await mkdtemp(join(tmpdir(), "agenticale-version-test-"));
  function git(...args) { return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  git("init", "-b", "main");
  git("config", "user.name", "Version fixture");
  git("config", "user.email", "fixture@example.invalid");
  git("config", "core.autocrlf", "false");
  git("config", "commit.gpgsign", "false");
  async function write(files) {
    for (const [path, text] of files) {
      await mkdir(dirname(join(cwd, path)), { recursive: true });
      await writeFile(join(cwd, path), text);
    }
  }
  async function commit(message) { git("add", "."); git("commit", "-m", message); return git("rev-parse", "HEAD"); }
  return { cwd, git, write, commit, cleanup: () => rm(cwd, { recursive: true, force: true }) };
}

async function main() {
  const base = fixture();
  assert.equal(checkDistributions(base, fixture()).versionIncreased, false);
  assert.equal(checkDistributions(base, fixture("0.4.0")).versionIncreased, true);
  assert.equal(compareVersions("0.3.10", "0.3.9"), 1);
  assert.equal(compareVersions("1.0.0", "0.99.99"), 1);
  assert.equal(compareVersions("0.10.0", "0.9.100"), 1);
  for (const invalid of ["v0.4.0", "0.4", "00.4.0", "0.4.0-beta.1", "0.4.0+build", "-1.0.0", undefined]) {
    assert.throws(() => parseVersion(invalid), /Invalid plugin version/);
  }
  assert.throws(() => checkDistributions(base, fixture("0.2.9")), /cannot decrease/);
  const skill = "plugins/agenticale/skills/work/SKILL.md";
  const changed = fixture();
  changed.set(skill, "New capability\n");
  assert.throws(() => checkDistributions(base, changed), /without a version bump/);
  const bumped = fixture("0.4.0");
  bumped.set(skill, "New capability\n");
  assert.deepEqual(checkDistributions(base, bumped).changed, [skill]);
  const deleted = fixture();
  deleted.delete(skill);
  assert.throws(() => checkDistributions(base, deleted), /without a version bump/);
  const added = fixture();
  added.set("plugins/agenticale/skills/new/SKILL.md", "New skill\n");
  assert.throws(() => checkDistributions(base, added), /without a version bump/);
  for (const path of ["plugins/agenticale/plugin.json", ".github/plugin/marketplace.json", ".agents/plugins/marketplace.json"]) {
    const modified = fixture();
    const json = JSON.parse(modified.get(path));
    if (json.plugins) json.plugins[0].policy.installation = "INSTALLED_BY_DEFAULT";
    else json.description = "New description";
    modified.set(path, JSON.stringify(json));
    assert.throws(() => checkDistributions(base, modified), /without a version bump/);
  }
  const stale = fixture("0.4.0");
  stale.set(".agents/plugins/marketplace.json", base.get(".agents/plugins/marketplace.json"));
  assert.throws(() => checkDistributions(base, stale), /does not match plugin version/);
  const missing = fixture();
  missing.delete("plugins/agenticale/plugin.json");
  assert.throws(() => checkDistributions(base, missing), /Missing/);
  assert.equal(checkDistributions(new Map(), bumped).previousVersion, null);
  // A competing PR that now targets the same version must choose a fresh bump.
  const competing = fixture("0.4.0");
  competing.set(skill, "Another capability\n");
  assert.throws(() => checkDistributions(bumped, competing), /without a version bump/);

  const repo = await gitFixture();
  try {
    const script = fileURLToPath(new URL("check-plugin-version.mjs", import.meta.url));
    const fixtureScript = join(repo.cwd, "scripts", "check-plugin-version.mjs");
    await repo.write(new Map([["scripts/check-plugin-version.mjs", await readFile(script, "utf8")]]));
    await repo.write(base);
    const baseSha = await repo.commit("Initial plugin");
    await repo.write(new Map([["README.md", "Documentation only\n"], ["skills/work/SKILL.md", "Deferred core change\n"]]));
    const docsSha = await repo.commit("Docs and deferred source do not change distribution");
    assert.equal((await checkPluginVersion({ base: baseSha, head: docsSha, cwd: repo.cwd })).changed.length, 0);
    await repo.write(changed);
    await assert.rejects(checkPluginVersion({ base: baseSha, cwd: repo.cwd }), /without a version bump/);
    const failed = spawnSync(process.execPath, [fixtureScript, "--base", baseSha], { encoding: "utf8" });
    assert.equal(failed.status, 1);
    assert.match(failed.stderr, /without a version bump/);
    await repo.write(bumped);
    const headSha = await repo.commit("Versioned capability");
    assert.equal((await checkPluginVersion({ base: baseSha, head: headSha, cwd: repo.cwd })).version, "0.4.0");
    assert.equal((await checkPluginVersion({ base: baseSha, cwd: repo.cwd })).version, "0.4.0");
    assert.equal((await checkPluginVersion({ base: emptyRef, head: headSha, cwd: repo.cwd })).versionIncreased, true);
    await assert.rejects(checkPluginVersion({ base: "missing-ref", cwd: repo.cwd }));
    assert.equal(spawnSync(process.execPath, [fixtureScript], { encoding: "utf8" }).status, 1);
    const passed = spawnSync(process.execPath, [fixtureScript, "--base", baseSha, "--head", headSha], { encoding: "utf8" });
    assert.equal(passed.status, 0, passed.stderr);
    assert.match(passed.stdout, /0.3.0 -> 0.4.0/);
    // A review correction retains the PR's bumped version. It must pass against
    // the target branch; a same-version content change directly on main fails.
    const corrected = fixture("0.4.0");
    corrected.set(skill, "Reviewed capability\n");
    await repo.write(corrected);
    const correctedSha = await repo.commit("Review correction at the same PR version");
    assert.equal((await checkPluginVersion({ base: baseSha, head: correctedSha, cwd: repo.cwd })).version, "0.4.0");
    await assert.rejects(checkPluginVersion({ base: headSha, head: correctedSha, cwd: repo.cwd }), /without a version bump/);
    const correctedCli = spawnSync(process.execPath, [fixtureScript, "--base", baseSha, "--head", correctedSha], { encoding: "utf8" });
    assert.equal(correctedCli.status, 0, correctedCli.stderr);
  } finally { await repo.cleanup(); }
  console.log("Plugin version tests passed (content, catalogs, SemVer, concurrent PRs, and Git snapshots).");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
