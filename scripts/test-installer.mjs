// Tests the two skills-first installers (install.mjs and install-standalone.mjs)
// against a throwaway target directory. They install the GENERATED build output,
// so these tests exercise the real install/update/migrate/collide/uninstall
// behaviours end to end and assert on both the on-disk tree and the state file.
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, readFile, writeFile, mkdir, symlink, access, readdir, cp, link, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";

const repo = resolve(import.meta.dirname, "..");
const scriptsDir = join(repo, "scripts");
const STATE = ".autonomous-mode-install.json";
const STANDALONE_STATE = ".agenticale-standalone-install.json";
const STATE_VERSION = 6;
const LEGACY_GENERATED_SCHEMA = 5;
const PACKAGE = "opencode-autonomous-mode";

// The seven rendered OpenCode profiles the current (schema 6) build emits.
const PROFILES = ["consult", "deep-review", "explore", "fix", "implement", "implement-hard", "review"];
// The six profiles the retired schema-5 build emitted (no implement-hard).
const LEGACY_PROFILES = PROFILES.filter((name) => name !== "implement-hard");

const scratch = await mkdtemp(join(tmpdir(), "installer-test-"));
let assertions = 0;
function check(cond, label) {
  if (!cond) throw new Error(`Assertion failed: ${label}`);
  assertions += 1;
}
const digest = (b) => createHash("sha256").update(b).digest("hex");
const run = (script, args, { cwd = scratch, env } = {}) => {
  const r = spawnSync(process.execPath, [join(scriptsDir, script), ...args], {
    encoding: "utf8",
    cwd,
    env: env ? { ...process.env, ...env } : process.env,
  });
  return { exit: r.status, out: (r.stdout || "").trim(), err: (r.stderr || "").trim() };
};
async function listFiles(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    let entries;
    try {
      entries = await readdir(d, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const p = join(d, e.name);
      if (e.isDirectory()) stack.push(p);
      else out.push(p);
    }
  }
  return out.sort();
}
async function relFiles(dir) {
  const files = await listFiles(dir);
  return files.map((f) => f.slice(dir.length + 1).split(/[\\/]/).join("/")).sort();
}
async function exists(p) {
  return access(p).then(() => true, () => false);
}

// Retired (old layout) path inventories, kept in lockstep with install.mjs so we
// can build schema 1-4 fixtures and assert the migration removes/preserves them.
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
const versionThreeCopyPaths = copyPaths.filter((p) => p !== "commands/work.md" && !p.startsWith("skills/work-mode/"));
const versionTwoCopyPaths = versionThreeCopyPaths.filter((p) => p !== "skills/pull-request-description/SKILL.md");
const legacyCopyPaths = versionTwoCopyPaths.filter((p) => p !== "skills/source-code-lookup/SKILL.md");
const copySet = (schema) =>
  schema === 1 ? legacyCopyPaths : schema === 2 ? versionTwoCopyPaths : schema === 3 ? versionThreeCopyPaths : copyPaths;
const linkPaths = [
  "agents/autonomous",
  "commands/autonomous.md",
  "commands/work.md",
  "skills/autonomous-mode",
  "skills/work-mode",
  "skills/pull-request-description",
  "skills/source-code-lookup",
];

async function readState(target) {
  return JSON.parse(await readFile(join(target, STATE), "utf8"));
}
async function readStandaloneState(target) {
  return JSON.parse(await readFile(join(target, STANDALONE_STATE), "utf8"));
}

async function makeCopyFixture(target, schema) {
  const paths = copySet(schema);
  const entries = [];
  for (const p of paths) {
    const dest = join(target, p);
    await mkdir(dirname(dest), { recursive: true });
    const content = `OLD ${schema} ${p}\n`;
    await writeFile(dest, content);
    entries.push({ path: p, kind: "file", digest: digest(Buffer.from(content)) });
  }
  entries.sort((a, b) => a.path.localeCompare(b.path));
  await writeFile(join(target, STATE), JSON.stringify({
    entries,
    installedAt: new Date().toISOString(),
    mode: "copy",
    package: PACKAGE,
    schema,
  }, null, 2));
  return entries;
}

// Build a valid generated (copy) state file with a chosen schema and profile
// set. Files are created on disk with deterministic content so digests match.
async function makeGeneratedFixture(target, schema, profiles, skillFiles) {
  const entries = [];
  for (const name of profiles) {
    const p = `agents/autonomous/${name}.md`;
    const content = `GEN ${schema} ${p}\n`;
    await mkdir(dirname(join(target, p)), { recursive: true });
    await writeFile(join(target, p), content, { encoding: "utf8" });
    entries.push({ path: p, kind: "file", digest: digest(Buffer.from(content)) });
  }
  for (const p of skillFiles) {
    const content = `GEN ${schema} ${p}\n`;
    await mkdir(dirname(join(target, p)), { recursive: true });
    await writeFile(join(target, p), content, { encoding: "utf8" });
    entries.push({ path: p, kind: "file", digest: digest(Buffer.from(content)) });
  }
  entries.sort((a, b) => a.path.localeCompare(b.path));
  await writeFile(join(target, STATE), JSON.stringify({
    entries,
    installedAt: new Date().toISOString(),
    mode: "copy",
    package: PACKAGE,
    schema,
  }, null, 2));
  return entries;
}

const fourSkills = [
  "skills/work/SKILL.md",
  "skills/autonomous/SKILL.md",
  "skills/pull-request-description/SKILL.md",
  "skills/source-code-lookup/SKILL.md",
];

try {
  // ---------------------------------------------------------------------
  // A. install.mjs — generated copy install, arg validation, and state.
  // ---------------------------------------------------------------------
  {
    const t = join(scratch, "a-model-choice");
    const r = run("install.mjs", ["install", "--target", t]);
    check(r.exit === 1, "install: no model choice exits 1");
    check(r.err.includes("Install requires --models PATH|PRESET, --routing PATH, or --no-model."), "install: no-model-choice message");
  }
  {
    const t = join(scratch, "a-fresh");
    const r = run("install.mjs", ["install", "--target", t, "--no-model"]);
    check(r.exit === 0, "install fresh --no-model exits 0");
    check(r.out.includes("Installation complete."), "install fresh: Installation complete");
    const state = await readState(t);
    check(state.schema === STATE_VERSION, "install fresh: state schema 6");
    check(state.mode === "copy", "install fresh: state mode copy");
    check(state.package === PACKAGE, "install fresh: state package");
    check(state.entries.length === 30, "install fresh: 30 entries");
    const profiles = state.entries.filter((e) => e.path.startsWith("agents/autonomous/"));
    check(profiles.length === 7, "install fresh: 7 generated profiles");
    check(state.entries.some((e) => e.path === "agents/autonomous/implement-hard.md"), "install fresh: implements implement-hard.md profile");
    check(state.entries.some((e) => e.path === "commands/work.md") && state.entries.some((e) => e.path === "commands/autonomous.md"), "install fresh: two command entries in state");
    const files = (await relFiles(t)).filter((f) => f !== STATE);
    check(files.length === 30, "install fresh: 30 files on disk");
    const workCommand = await readFile(join(t, "commands", "work.md"), "utf8");
    check(workCommand.includes("`work`") && workCommand.includes("$ARGUMENTS"), "install fresh: work command loads the skill by exact ID");
    const autonomousCommand = await readFile(join(t, "commands", "autonomous.md"), "utf8");
    check(autonomousCommand.includes("`autonomous`") && autonomousCommand.includes("$ARGUMENTS"), "install fresh: autonomous command loads the skill by exact ID");
    const srcLookup = await readFile(join(t, "skills", "source-code-lookup", "SKILL.md"), "utf8");
    check(srcLookup.includes('Source root: "~/dev"'), "install fresh: source root default marker");
    check(await exists(join(t, "skills", "work", "references", "routing.json")), "install fresh: materializes work/references/routing.json");
    check(await exists(join(t, "skills", "work", "references", "routing.example.json")), "install fresh: materializes work/references/routing.example.json");
    check(await exists(join(t, "skills", "work", "scripts", "routing.mjs")), "install fresh: materializes work/scripts/routing.mjs");
  }
  {
    // Idempotent re-install: no rewrites, same state.
    const t = join(scratch, "a-fresh");
    const before = await readFile(join(t, STATE), "utf8");
    const r = run("install.mjs", ["install", "--target", t, "--no-model"]);
    check(r.exit === 0, "install idempotent exits 0");
    check(r.out.includes("Already up to date."), "install idempotent: Already up to date");
    const after = await readFile(join(t, STATE), "utf8");
    check(before === after, "install idempotent: state unchanged");
  }
  {
    // --source-root renders into source-code-lookup; then a real change needs --replace.
    const t = join(scratch, "a-sourcroot");
    const src = join(scratch, "a-sourcroot-src");
    await mkdir(src, { recursive: true });
    const first = run("install.mjs", ["install", "--target", t, "--no-model", "--source-root", src]);
    check(first.exit === 0, "source-root install exits 0");
    let sk = await readFile(join(t, "skills", "source-code-lookup", "SKILL.md"), "utf8");
    check(sk.includes(`Source root: ${JSON.stringify(src)}`), "source-root install: rendered JSON-encoded path");
    const dest = join(t, "skills", "source-code-lookup", "SKILL.md");
    await writeFile(dest, "HACKED\n");
    const blocked = run("install.mjs", ["install", "--target", t, "--no-model", "--source-root", src]);
    check(blocked.exit === 1, "source-root re-install w/o --replace exits 1");
    check(blocked.err.includes("Differing content already exists at:"), "source-root collision message");
    check(blocked.err.includes("--replace"), "source-root collision mentions --replace");
    check((await readFile(dest, "utf8")) === "HACKED\n", "source-root: file untouched on blocked re-install");
    const replaced = run("install.mjs", ["install", "--target", t, "--no-model", "--source-root", src, "--replace"]);
    check(replaced.exit === 0, "source-root --replace exits 0");
    check(replaced.out.includes("backup created:"), "source-root --replace: backup created");
    sk = await readFile(dest, "utf8");
    check(sk.includes(`Source root: ${JSON.stringify(src)}`), "source-root --replace: file restored");
  }
  {
    // --models subset renders model lines only for the roles present.
    const t = join(scratch, "a-models");
    const map = join(scratch, "a-models.json");
    await writeFile(map, JSON.stringify({ review: "acme/rev#high" }));
    const r = run("install.mjs", ["install", "--target", t, "--models", map]);
    check(r.exit === 0, "models install exits 0");
    const review = await readFile(join(t, "agents", "autonomous", "review.md"), "utf8");
    check(review.includes("model: acme/rev"), "models: review.md has model line");
    const consult = await readFile(join(t, "agents", "autonomous", "consult.md"), "utf8");
    check(!consult.includes("model: "), "models: consult.md has no model line");
  }
  {
    // Invalid model mappings are rejected before anything is written.
    const notJson = join(scratch, "bad1.json");
    await writeFile(notJson, "{nope");
    let r = run("install.mjs", ["install", "--target", join(scratch, "bad1"), "--models", notJson]);
    check(r.exit === 1 && r.err.includes("Model mapping is not valid JSON"), "models: not-valid-JSON rejected");
    check(!(await exists(join(scratch, "bad1"))), "models: bad JSON writes nothing");

    const arr = join(scratch, "bad2.json");
    await writeFile(arr, "[]");
    r = run("install.mjs", ["install", "--target", join(scratch, "bad2"), "--models", arr]);
    check(r.exit === 1 && r.err.includes("Model mapping must be a JSON object keyed by role name"), "models: array rejected");

    const unknown = join(scratch, "bad3.json");
    await writeFile(unknown, JSON.stringify({ bogus: "x/y#low" }));
    r = run("install.mjs", ["install", "--target", join(scratch, "bad3"), "--models", unknown]);
    check(r.exit === 1 && r.err.includes("Unknown role in model mapping"), "models: unknown role rejected");
  }
  {
    // Arg-shape errors.
    const missing = run("install.mjs", ["install", "--target", join(scratch, "x1"), "--models"]);
    check(missing.exit === 1 && missing.err.includes("--models requires a value that is not another option."), "models: missing value");
    const both = run("install.mjs", ["install", "--target", join(scratch, "x2"), "--models", join(scratch, "m.json"), "--no-model"]);
    check(both.exit === 1 && both.err.includes("--models and --no-model cannot be used together."), "models+no-model rejected");
    const routingMap = join(scratch, "r.json");
    await writeFile(routingMap, JSON.stringify({}));
    const both2 = run("install.mjs", ["install", "--target", join(scratch, "x3"), "--models", join(scratch, "m.json"), "--routing", routingMap]);
    check(both2.exit === 1 && both2.err.includes("--routing and --models cannot be used together."), "models+routing rejected");
  }
  {
    // Collision on an already-installed tree: blocked, then --replace.
    const t = join(scratch, "a-collide");
    const fresh = run("install.mjs", ["install", "--target", t, "--no-model"]);
    check(fresh.exit === 0, "collision setup fresh exits 0");
    const dest = join(t, "skills", "work", "SKILL.md");
    await writeFile(dest, "HACKED\n");
    const blocked = run("install.mjs", ["install", "--target", t, "--no-model"]);
    check(blocked.exit === 1 && blocked.err.includes("Differing content already exists at:"), "collision: blocked");
    const replaced = run("install.mjs", ["install", "--target", t, "--no-model", "--replace"]);
    check(replaced.exit === 0 && replaced.out.includes("backup created:"), "collision: --replace restores");
    check((await readFile(dest, "utf8")) !== "HACKED\n", "collision: file restored");
  }
  {
    // Dry-run writes nothing.
    const t = join(scratch, "a-dry");
    const r = run("install.mjs", ["install", "--target", t, "--no-model", "--dry-run"]);
    check(r.exit === 0 && r.out.includes("Dry run complete; no files were changed."), "dry-run: no files changed message");
    check(!(await exists(join(t, STATE))), "dry-run: no state file");
    check(!(await exists(join(t, "skills"))), "dry-run: no files created");
  }
  {
    // Uninstall preserves a modified destination and removes owned files + state.
    const t = join(scratch, "a-uninstall");
    const fresh = run("install.mjs", ["install", "--target", t, "--no-model"]);
    check(fresh.exit === 0, "uninstall setup fresh exits 0");
    const dest = join(t, "skills", "work", "SKILL.md");
    await writeFile(dest, "USER-EDITED\n");
    const r = run("install.mjs", ["uninstall", "--target", t]);
    check(r.exit === 0 && r.out.includes("Uninstall complete. Preserved 1 modified destination(s)."), "uninstall: preserved modified");
    check((await readFile(dest, "utf8")) === "USER-EDITED\n", "uninstall: modified file preserved");
    check(!(await exists(join(t, STATE))), "uninstall: state removed");
    check(!(await exists(join(t, "skills", "source-code-lookup", "SKILL.md"))), "uninstall: owned file removed");
  }
  {
    // Non-overlap: target == repo and target inside repo are both rejected pre-write.
    const r1 = run("install.mjs", ["install", "--target", repo, "--no-model"]);
    check(r1.exit === 1 && r1.err.includes("The target and this checkout must not overlap:"), "non-overlap: target==repo");
    const r2 = run("install.mjs", ["install", "--target", join(repo, "nested-profile"), "--no-model"]);
    check(r2.exit === 1 && r2.err.includes("The target and this checkout must not overlap:"), "non-overlap: target inside repo");
    check(!(await exists(join(repo, "nested-profile"))), "non-overlap: nothing written for inside-repo target");
  }
  {
    // State-rejection matrix: mutate a valid schema-6 state, expect exit 1 + message.
    const valid = join(scratch, "a-state-valid");
    const fresh = run("install.mjs", ["install", "--target", valid, "--no-model"]);
    check(fresh.exit === 0, "state matrix: valid base install exits 0");
    const base = await readState(valid);
    const statePath = join(valid, STATE);
    const cases = [
      ["wrong top-level keys", (s) => { s.extra = 1; }, "Install state is invalid:"],
      ["wrong package", (s) => { s.package = "nope"; }, "Install state is invalid:"],
      ["schema 6 link mode", (s) => { s.mode = "link"; }, `Schema ${STATE_VERSION} install state must be a copy install:`],
      ["path outside bundle", (s) => { s.entries.push({ path: "commands/extra.md", kind: "file", digest: digest(Buffer.from("x")) }); }, "Install state has a generated path outside the bundle:"],
      ["unexpected profile", (s) => { s.entries = s.entries.filter((e) => e.path !== "agents/autonomous/consult.md"); s.entries.push({ path: "agents/autonomous/implhard.md", kind: "file", digest: digest(Buffer.from("x")) }); s.entries.push({ path: "agents/autonomous/consult.md", kind: "file", digest: digest(Buffer.from("y")) }); }, "Install state has an unexpected generated profile:"],
    ];
    for (const [label, mutate, expect] of cases) {
      const s = JSON.parse(JSON.stringify(base));
      mutate(s);
      await writeFile(statePath, JSON.stringify(s, null, 2));
      const r = run("install.mjs", ["install", "--target", valid, "--no-model"]);
      check(r.exit === 1 && r.err.includes(expect), `state matrix: ${label} rejected`);
    }
  }

  // ---------------------------------------------------------------------
  // B. Migration fixtures (schema 1-4 copy, schema 4 link, schema 5 generated).
  // ---------------------------------------------------------------------
  for (const schema of [1, 2, 3, 4]) {
    const t = join(scratch, `b-copy${schema}`);
    await mkdir(t, { recursive: true });
    await makeCopyFixture(t, schema);
    // Modify one retired file that the new inventory REUSES (commands/autonomous.md):
    // the new bundle ships its own generated command entries, so the plain re-run
    // collides and the modified entry is only replaced after explicit approval.
    const modPath = join(t, "commands", "autonomous.md");
    await writeFile(modPath, "USER-EDITED\n");
    const blocked = run("install.mjs", ["install", "--target", t, "--no-model"]);
    check(blocked.exit === 1 && blocked.err.includes("Differing content already exists at:"), `migration copy schema ${schema}: modified command entry collides without --replace`);
    const r = run("install.mjs", ["install", "--target", t, "--no-model", "--replace"]);
    check(r.exit === 0, `migration copy schema ${schema}: exits 0 with --replace`);
    check(r.out.includes(`  migrating from schema ${schema} copy install`), `migration copy schema ${schema}: migrating message`);
    check(r.out.includes("preserve-modified: commands/autonomous.md"), `migration copy schema ${schema}: modified command entry reported`);
    const state = await readState(t);
    check(state.schema === STATE_VERSION, `migration copy schema ${schema}: advanced to schema ${STATE_VERSION}`);
    check(state.entries.length === 30, `migration copy schema ${schema}: 30 entries`);
    check(r.out.includes("backup created:"), `migration copy schema ${schema}: replaced command entry backed up`);
    check((await readFile(modPath, "utf8")).includes("$ARGUMENTS"), `migration copy schema ${schema}: commands/autonomous.md now carries the generated entry`);
    check((await readFile(join(t, "commands", "work.md"), "utf8")).includes("$ARGUMENTS"), `migration copy schema ${schema}: commands/work.md now carries the generated entry`);
  }
  {
    // Schema 5 (six-profile generated) → schema 6 adds the implement-hard profile.
    const t = join(scratch, "b-gen5");
    await mkdir(t, { recursive: true });
    await makeGeneratedFixture(t, LEGACY_GENERATED_SCHEMA, LEGACY_PROFILES, fourSkills);
    const r = run("install.mjs", ["install", "--target", t, "--no-model"]);
    check(r.exit === 0, "migration generated schema 5: exits 0");
    check(r.out.includes(`  migrating from schema ${LEGACY_GENERATED_SCHEMA} copy install`), "migration generated schema 5: migrating message");
    const state = await readState(t);
    check(state.schema === STATE_VERSION, "migration generated schema 5: advanced to schema 6");
    check(state.entries.length === 30, "migration generated schema 5: 30 entries");
    check(await exists(join(t, "agents", "autonomous", "implement-hard.md")), "migration generated schema 5: implement-hard profile now present");
    check(state.entries.some((e) => e.path === "agents/autonomous/implement-hard.md"), "migration generated schema 5: implement-hard in state");
    check((await readFile(join(t, "commands", "work.md"), "utf8")).includes("$ARGUMENTS"), "migration generated schema 5: command entries added");
  }
  {
    // Schema 6 state from the CURRENT release (no command entries) migrates by
    // adding the two command entries; the legacy state must validate, not be
    // rejected as incomplete.
    const t = join(scratch, "b-gen6-nocommands");
    const fresh = run("install.mjs", ["install", "--target", t, "--no-model"]);
    check(fresh.exit === 0, "migration current-release schema 6: setup fresh exits 0");
    const state = JSON.parse(await readFile(join(t, STATE), "utf8"));
    const legacy = { ...state, entries: state.entries.filter((e) => !e.path.startsWith("commands/")) };
    await writeFile(join(t, STATE), JSON.stringify(legacy, null, 2));
    await rm(join(t, "commands"), { recursive: true });
    const r = run("install.mjs", ["install", "--target", t, "--no-model"]);
    check(r.exit === 0, "migration current-release schema 6: exits 0 without --replace");
    check(!r.out.includes("Already up to date"), "migration current-release schema 6: reconciles instead of reporting up-to-date");
    const state2 = await readState(t);
    check(state2.entries.length === 30, "migration current-release schema 6: 30 entries");
    check((await readFile(join(t, "commands", "autonomous.md"), "utf8")).includes("$ARGUMENTS"), "migration current-release schema 6: command entries added");
  }
  {
    // Modified-but-REUSED file (consult.md is in the new inventory) collides without --replace.
    const t = join(scratch, "b-collide-reused");
    await mkdir(t, { recursive: true });
    await makeCopyFixture(t, 4);
    await writeFile(join(t, "agents", "autonomous", "consult.md"), "USER-EDITED-CONSULT\n");
    const r = run("install.mjs", ["install", "--target", t, "--no-model"]);
    check(r.exit === 1 && r.err.includes("Differing content already exists at:"), "migration: modified reused file collides without --replace");
    const r2 = run("install.mjs", ["install", "--target", t, "--no-model", "--replace"]);
    check(r2.exit === 0 && r2.out.includes("preserve-modified: agents/autonomous/consult.md"), "migration: modified reused file reported with --replace");
  }
  {
    // Link schema 4 → converted to copy.
    const t = join(scratch, "b-link4");
    const srcDir = join(scratch, "b-link4-src");
    await mkdir(srcDir, { recursive: true });
    const entries = [];
    for (const p of linkPaths) {
      const dest = join(t, p);
      const target = join(srcDir, p.replace(/\//g, "_").replace(/\.md$/, ".txt"));
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(target, "linked\n");
      await symlink(target, dest, "file");
      entries.push({ path: p, kind: "link", linkTarget: target });
    }
    entries.sort((a, b) => a.path.localeCompare(b.path));
    await writeFile(join(t, STATE), JSON.stringify({
      entries, installedAt: new Date().toISOString(), mode: "link", package: PACKAGE, schema: 4,
    }, null, 2));
    // The two retired command links now collide with the generated command
    // entries, so the conversion needs explicit approval.
    const blocked = run("install.mjs", ["install", "--target", t, "--no-model"]);
    check(blocked.exit === 1 && blocked.err.includes("Differing content already exists at:"), "migration link schema 4: command links collide without --replace");
    const r = run("install.mjs", ["install", "--target", t, "--no-model", "--replace"]);
    check(r.exit === 0, "migration link schema 4: exits 0 with --replace");
    check(r.out.includes("  migrating from schema 4 link install"), "migration link schema 4: migrating message");
    check(r.out.includes("  converted: the previous link install was converted to a copy install of the generated bundle."), "migration link schema 4: converted message");
    const state = await readState(t);
    check(state.schema === STATE_VERSION && state.mode === "copy" && state.entries.length === 30, "migration link schema 4: now schema 6 copy 30 entries");
    check((await readFile(join(t, "commands", "work.md"), "utf8")).includes("$ARGUMENTS"), "migration link schema 4: command links replaced by the generated files");
  }
  // Build the full schema-4 link inventory (the validator requires the exact set).
  async function makeLinkFixture(target, srcDir) {
    await mkdir(srcDir, { recursive: true });
    const entries = [];
    for (const p of linkPaths) {
      const dest = join(target, p);
      const stored = join(srcDir, p.replace(/\//g, "_").replace(/\.md$/, ".txt"));
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(stored, "linked\n");
      await symlink(stored, dest, "file");
      entries.push({ path: p, kind: "link", linkTarget: stored });
    }
    entries.sort((a, b) => a.path.localeCompare(b.path));
    await writeFile(join(target, STATE), JSON.stringify({
      entries, installedAt: new Date().toISOString(), mode: "link", package: PACKAGE, schema: 4,
    }, null, 2));
  }
  {
    // R6 + physical boundary: the profile home (agents/autonomous) is a symlink the
    // installer does NOT own (live target differs from the stored one). It must never
    // be deleted, and the profile copies must not be written THROUGH it — the install
    // fails safely and rolls back rather than writing outside the managed root.
    const t = join(scratch, "b-link4-repoint");
    const srcDir = join(scratch, "b-link4-repoint-src");
    await makeLinkFixture(t, srcDir);
    const dest = join(t, "agents/autonomous");
    const otherTarget = join(srcDir, "elsewhere.txt");
    await writeFile(otherTarget, "other\n");
    await rm(dest);
    await symlink(otherTarget, dest, "file");
    // --replace clears the retired-command-link collision so the install reaches
    // the repointed profile home, which it must refuse rather than write through.
    const r = run("install.mjs", ["install", "--target", t, "--no-model", "--replace"]);
    check(r.exit === 1, "R6 link repoint: non-owned profile link fails the install safely");
    check(r.out.includes("preserve-modified: agents/autonomous"), "R6 link repoint: repointed link reported as preserved");
    check(await exists(dest), "R6 link repoint: repointed link NOT deleted");
    check(!(await exists(join(t, "agents", "autonomous", "consult.md"))), "R6 link repoint: no profile copies written through the link (rollback)");
  }
  {
    // R6: a link replaced by a plain directory is preserved (ownership of the bytes
    // cannot be proven), and — unlike a symlink — a real directory is inside the
    // managed root, so the profile copies write into it and the install completes.
    const t = join(scratch, "b-link4-dir");
    const srcDir = join(scratch, "b-link4-dir-src");
    await makeLinkFixture(t, srcDir);
    const dest = join(t, "agents/autonomous");
    await rm(dest);
    await mkdir(dest, { recursive: true });
    // As in b-link4, the retired command links collide with the generated
    // command entries until the conversion is explicitly approved.
    const blocked = run("install.mjs", ["install", "--target", t, "--no-model"]);
    check(blocked.exit === 1 && blocked.err.includes("Differing content already exists at:"), "R6 link→dir: command links collide without --replace");
    const r = run("install.mjs", ["install", "--target", t, "--no-model", "--replace"]);
    check(r.exit === 0, "R6 link→dir: exits 0 with --replace");
    check(r.out.includes("preserve-modified: agents/autonomous"), "R6 link→dir: replaced-by-directory preserved");
    const state = await readState(t);
    check(state.schema === STATE_VERSION && state.mode === "copy" && state.entries.length === 30, "R6 link→dir: converted to schema 6 copy 30 entries");
    check(await exists(join(t, "agents", "autonomous", "consult.md")), "R6 link→dir: profile copies written into the preserved directory");
  }

  // ---------------------------------------------------------------------
  // B2. Same-schema (R12) retirement: an owned file no longer in the inventory
  //     is removed on a schema-6 → schema-6 update.
  // ---------------------------------------------------------------------
  {
    const t = join(scratch, "b2-retire");
    const fresh = run("install.mjs", ["install", "--target", t, "--no-model"]);
    check(fresh.exit === 0, "R12 retirement setup exits 0");
    // Add an owned, unmodified extra file under skills/work/ that the new
    // inventory does not carry, plus its matching state entry.
    const extraRel = "skills/work/references/legacy-note.md";
    const extra = join(t, extraRel);
    const content = "legacy note\n";
    await writeFile(extra, content, "utf8");
    const state = await readState(t);
    state.entries.push({ path: extraRel, kind: "file", digest: digest(Buffer.from(content)) });
    state.entries.sort((a, b) => a.path.localeCompare(b.path));
    await writeFile(join(t, STATE), JSON.stringify(state, null, 2));
    const r = run("install.mjs", ["install", "--target", t, "--no-model"]);
    check(r.exit === 0, "R12 retirement: exits 0");
    check(r.out.includes(`  migrate-remove: ${extraRel}`), "R12 retirement: extra owned file migrated away");
    check(!(await exists(extra)), "R12 retirement: extra owned file removed");
    const state2 = await readState(t);
    check(!state2.entries.some((e) => e.path === extraRel), "R12 retirement: extra file no longer in state");
  }

  // ---------------------------------------------------------------------
  // B3. R11 duplicate-source detection: a fresh install into a target that also
  //     carries a standalone marker surfaces a non-blocking notice.
  // ---------------------------------------------------------------------
  {
    const t = join(scratch, "b3-dup");
    await mkdir(t, { recursive: true });
    await writeFile(join(t, STANDALONE_STATE), JSON.stringify({ schema: 1, entries: [] }, null, 2));
    const r = run("install.mjs", ["install", "--target", t, "--no-model"]);
    check(r.exit === 0, "R11 duplicate: exits 0 (non-blocking)");
    check(r.out.includes("notice: another AgenticAle install appears present"), "R11 duplicate: notice printed");
    // Re-running against an OWNED install must not re-emit the duplicate notice.
    const r2 = run("install.mjs", ["install", "--target", t, "--no-model"]);
    check(r2.exit === 0, "R11 duplicate: re-run exits 0");
    check(!r2.out.includes("notice: another AgenticAle install appears present"), "R11 duplicate: no notice on owned re-run");
  }

  // ---------------------------------------------------------------------
  // C. install-standalone.mjs
  // ---------------------------------------------------------------------
  {
    const t = join(scratch, "c-model-choice");
    const r = run("install-standalone.mjs", ["install", "--target", t]);
    check(r.exit === 1 && r.err.includes("Install requires --models PATH|PRESET, --routing PATH, or --no-model."), "standalone: no model choice exits 1");
  }
  {
    const t = join(scratch, "c-fresh");
    const r = run("install-standalone.mjs", ["install", "--target", t, "--no-model"]);
    check(r.exit === 0 && r.out.includes("Installation complete."), "standalone fresh: exits 0 + complete");
    const state = await readStandaloneState(t);
    check(state.schema === 1, "standalone fresh: schema 1");
    check(state.scope === "project", "standalone fresh: scope project");
    check(state.sourceLayout === "autonomous,pull-request-description,source-code-lookup,work", "standalone fresh: sourceLayout string");
    check(state.entries.length === 22, "standalone fresh: 22 entries");
    const files = (await relFiles(t)).filter((f) => f !== STANDALONE_STATE);
    check(files.length === 22, "standalone fresh: 22 files on disk");
    check(!files.some((f) => f.startsWith("agents/")), "standalone fresh: no agents/");
    check(!files.some((f) => f.startsWith("commands/")), "standalone fresh: no commands/");
    check(await exists(join(t, "work", "references", "routing.json")), "standalone fresh: materializes work/references/routing.json");
    check(await exists(join(t, "work", "references", "routing.example.json")), "standalone fresh: materializes work/references/routing.example.json");
    check(await exists(join(t, "work", "scripts", "routing.mjs")), "standalone fresh: materializes work/scripts/routing.mjs");
    // Idempotent.
    const before = await readFile(join(t, STANDALONE_STATE), "utf8");
    const r2 = run("install-standalone.mjs", ["install", "--target", t, "--no-model"]);
    check(r2.exit === 0 && r2.out.includes("Already up to date."), "standalone idempotent: Already up to date");
    check(before === await readFile(join(t, STANDALONE_STATE), "utf8"), "standalone idempotent: state unchanged");
  }
  {
    // Collision ± --replace.
    const t = join(scratch, "c-collide");
    const fresh = run("install-standalone.mjs", ["install", "--target", t, "--no-model"]);
    check(fresh.exit === 0, "standalone collision setup exits 0");
    const dest = join(t, "work", "SKILL.md");
    await writeFile(dest, "HACKED\n");
    const blocked = run("install-standalone.mjs", ["install", "--target", t, "--no-model"]);
    check(blocked.exit === 1 && blocked.err.includes("Differing content already exists at:"), "standalone collision: blocked");
    const replaced = run("install-standalone.mjs", ["install", "--target", t, "--no-model", "--replace"]);
    check(replaced.exit === 0 && replaced.out.includes("backup created:"), "standalone collision: --replace restores + backup");
    check((await readFile(dest, "utf8")) !== "HACKED\n", "standalone collision: file restored");
  }
  {
    // Dry-run writes nothing.
    const t = join(scratch, "c-dry");
    const r = run("install-standalone.mjs", ["install", "--target", t, "--no-model", "--dry-run"]);
    check(r.exit === 0 && r.out.includes("Dry run complete; no files were changed."), "standalone dry-run: no files changed");
    check(!(await exists(join(t, STANDALONE_STATE))), "standalone dry-run: no state");
    check(!(await exists(join(t, "work", "SKILL.md"))), "standalone dry-run: no files");
  }
  {
    // Uninstall removes owned files + state, preserves a modified one.
    const t = join(scratch, "c-uninstall");
    const fresh = run("install-standalone.mjs", ["install", "--target", t, "--no-model"]);
    check(fresh.exit === 0, "standalone uninstall setup exits 0");
    const dest = join(t, "work", "SKILL.md");
    await writeFile(dest, "USER-EDITED\n");
    const r = run("install-standalone.mjs", ["uninstall", "--target", t]);
    check(r.exit === 0 && r.out.includes("Uninstall complete. Preserved 1 modified destination(s)."), "standalone uninstall: preserved modified");
    check((await readFile(dest, "utf8")) === "USER-EDITED\n", "standalone uninstall: modified preserved");
    check(!(await exists(join(t, STANDALONE_STATE))), "standalone uninstall: state removed");
    check(!(await exists(join(t, "source-code-lookup", "SKILL.md"))), "standalone uninstall: owned removed");
  }
  {
    // Non-overlap: target == repo rejected pre-write.
    const r = run("install-standalone.mjs", ["install", "--target", repo, "--no-model"]);
    check(r.exit === 1 && r.err.includes("The target and this checkout must not overlap:") && r.err.includes("standalone skills folder"), "standalone non-overlap: target==repo");
    check(!(await exists(join(repo, STANDALONE_STATE))), "standalone non-overlap: nothing written");
  }
  {
    // F2: a failed missing-file repair (junction over a reference directory) must
    // not delete the ownership state file on rollback.
    const t = join(scratch, "a-f2");
    const fresh = run("install.mjs", ["install", "--target", t, "--no-model"]);
    check(fresh.exit === 0, "F2 opencode setup fresh exits 0");
    const before = await readFile(join(t, STATE), "utf8");
    const refDir = join(t, "skills", "work", "references", "runtimes");
    const empty = join(scratch, "a-f2-empty");
    await mkdir(empty, { recursive: true });
    await rm(refDir, { recursive: true });
    await symlink(empty, refDir, "junction");
    const failed = run("install.mjs", ["install", "--target", t, "--no-model"]);
    check(failed.exit === 1 && /linked ancestor/.test(failed.err), "F2 opencode failed repair is refused");
    const after = await readFile(join(t, STATE), "utf8");
    check(after === before, "F2 opencode state file preserved after failed repair (ownership intact)");
  }
  {
    // F2 (standalone): same missing-file-repair rollback must preserve state.
    const t = join(scratch, "c-f2");
    const fresh = run("install-standalone.mjs", ["install", "--target", t, "--no-model"]);
    check(fresh.exit === 0, "F2 standalone setup fresh exits 0");
    const before = await readFile(join(t, STANDALONE_STATE), "utf8");
    const refDir = join(t, "work", "references", "runtimes");
    const empty = join(scratch, "c-f2-empty");
    await mkdir(empty, { recursive: true });
    await rm(refDir, { recursive: true });
    await symlink(empty, refDir, "junction");
    const failed = run("install-standalone.mjs", ["install", "--target", t, "--no-model"]);
    check(failed.exit === 1 && /linked ancestor/.test(failed.err), "F2 standalone failed repair is refused");
    const after = await readFile(join(t, STANDALONE_STATE), "utf8");
    check(after === before, "F2 standalone state file preserved after failed repair (ownership intact)");
  }
  {
    // F10: a stale owned entry whose file is already absent must be reconciled
    // out of state on rerun, not reported "Already up to date".
    const t = join(scratch, "a-f10");
    const fresh = run("install.mjs", ["install", "--target", t, "--no-model"]);
    check(fresh.exit === 0, "F10 setup fresh exits 0");
    const state = JSON.parse(await readFile(join(t, STATE), "utf8"));
    state.entries.push({ path: "skills/work/references/runtimes/claude.md", kind: "file", digest: digest(Buffer.from("stale\n")) });
    await writeFile(join(t, STATE), JSON.stringify(state, null, 2));
    const rerun = run("install.mjs", ["install", "--target", t, "--no-model"]);
    check(rerun.exit === 0, "F10 rerun exits 0");
    check(!rerun.out.includes("Already up to date"), "F10 rerun reconciles instead of reporting up-to-date");
    const reconciled = JSON.parse(await readFile(join(t, STATE), "utf8"));
    check(!reconciled.entries.some((e) => e.path === "skills/work/references/runtimes/claude.md"), "F10 stale entry reconciled out of state");
  }

  // F11: a POPULATED external junction over a reference directory. Unlike the
  // empty F2 fixture, the external directory holds a real codex.md that is also
  // hard-linked outside the install. A refused update must not delete/recreate
  // that external file: its content, identity (ino), and link count must all be
  // preserved, and the ownership state bytes must be unchanged.
  async function f11Fixture(script, refRel, stateName, label) {
    const t = join(scratch, label);
    const fresh = run(script, ["install", "--target", t, "--no-model"]);
    check(fresh.exit === 0, `F11 ${label}: fresh install exits 0`);
    const beforeState = await readFile(join(t, stateName), "utf8");
    const refDir = join(t, refRel);
    const external = join(scratch, `${label}-ext`);
    await cp(refDir, external, { recursive: true });
    const codex = join(external, "codex.md");
    await writeFile(codex, "external-custom-content\n", "utf8");
    // Second hard link to the external file, outside the install, so a
    // delete/recreate would drop the link count from 2 to 1 and be observable.
    const secondLink = join(scratch, `${label}-second-link`);
    await link(codex, secondLink);
    await rm(refDir, { recursive: true });
    await symlink(external, refDir, "junction");
    const failed = run(script, ["install", "--target", t, "--no-model", "--replace"]);
    check(failed.exit === 1 && /linked ancestor/.test(failed.err), `F11 ${label}: populated-junction update is refused`);
    const before = await stat(codex);
    const afterStat = await stat(codex);
    check(afterStat.nlink === 2, `F11 ${label}: external codex.md link count stays 2 (not deleted/recreated)`);
    check((await readFile(codex, "utf8")) === "external-custom-content\n", `F11 ${label}: external codex.md content unchanged`);
    check(afterStat.ino === before.ino, `F11 ${label}: external codex.md identity (ino) unchanged`);
    check(await readFile(join(t, stateName), "utf8") === beforeState, `F11 ${label}: ownership state bytes unchanged`);
  }
  await f11Fixture("install.mjs", "skills/work/references/runtimes", STATE, "a-f11");
  await f11Fixture("install-standalone.mjs", "work/references/runtimes", STANDALONE_STATE, "c-f11");

  // F13: a replacement write that fails (ENOSPC) after the destination has been
  // removed must still be rolled back. The installer registers a replacement in
  // the rollback set before the write, so a failing write leaves the pre-existing
  // content restored and the ownership state untouched, never a missing/partial
  // destination. A one-shot write failure is injected via a --require hook that
  // wraps fs.promises.writeFile for a single destination path.
  const f13Hook = join(scratch, "f13-fail-write.cjs");
  await writeFile(f13Hook,
    'const fs = require("fs");\n' +
    'const orig = fs.promises.writeFile;\n' +
    'fs.promises.writeFile = async function (path, ...args) {\n' +
    '  const target = process.env.F13_FAIL_WRITE;\n' +
    '  const normalizedPath = String(path).replace(/\\\\/g, "/");\n' +
    '  if (target && normalizedPath.endsWith("/" + target)) {\n' +
    '    const err = new Error("ENOSPC: no space left on device, open \'" + path + "\'");\n' +
    '    err.code = "ENOSPC";\n' +
    '    throw err;\n' +
    '  }\n' +
    '  return orig(path, ...args);\n' +
    '};\n');
  async function f13Fixture(script, skillRel, stateName, label) {
    const t = join(scratch, label);
    const fresh = run(script, ["install", "--target", t, "--no-model"]);
    check(fresh.exit === 0, `F13 ${label}: fresh install exits 0`);
    const beforeState = await readFile(join(t, stateName), "utf8");
    const skill = join(t, skillRel);
    const custom = "F13 custom work content\n";
    await writeFile(skill, custom, "utf8");
    const failed = run(script, ["install", "--target", t, "--no-model", "--replace"], {
      // Match the managed path suffix because installers canonicalize target
      // roots; temp-directory symlinks differ between Linux, macOS, and Windows.
      env: { NODE_OPTIONS: `--require ${f13Hook}`, F13_FAIL_WRITE: `${label}/${skillRel}` },
    });
    check(failed.exit === 1 && /ENOSPC/.test(failed.err), `F13 ${label}: injected replacement-write failure exits 1`);
    check(/rolled back/.test(failed.err), `F13 ${label}: reports a rollback`);
    check((await readFile(skill, "utf8")) === custom, `F13 ${label}: destination restored to pre-existing content (not missing/partial)`);
    check(await readFile(join(t, stateName), "utf8") === beforeState, `F13 ${label}: ownership state bytes unchanged`);
  }
  await f13Fixture("install.mjs", "skills/work/SKILL.md", STATE, "a-f13");
  await f13Fixture("install-standalone.mjs", "work/SKILL.md", STANDALONE_STATE, "c-f13");

  // F7: duplicate-source detection must span the scopes Codex actually
  //     discovers. A fresh install into the user scope leaves a marker that an
  //     unrelated project-scope install elsewhere should notice, and vice
  //     versa. Run both under an isolated fake home so the real user home and
  //     repo are untouched, with the two scopes pointing at separate trees.
  {
    const fakeHome = await mkdtemp(join(scratch, "f7-home-"));
    const fakeEnv = { USERPROFILE: fakeHome, HOME: fakeHome, APPDATA: join(fakeHome, "AppData", "Roaming"), LOCALAPPDATA: join(fakeHome, "AppData", "Local") };
    const projectDir = await mkdtemp(join(scratch, "f7-project-"));
    const userTarget = join(fakeHome, ".agents", "skills");
    const projectTarget = join(projectDir, ".agents", "skills");

    // Install into the user scope (fake home) — no competing install exists yet.
    const rUser = run("install-standalone.mjs", ["install", "--no-model", "--target", userTarget], { cwd: scratch, env: fakeEnv });
    check(rUser.exit === 0, "F7 standalone: user-scope install exits 0");
    check(!rUser.out.includes("notice: another AgenticAle install appears present"), "F7 standalone: no duplicate notice on first install");

    // A project-scope install elsewhere (different cwd, different target) should
    // still notice the user-scope install in the discoverable home root.
    const rProject = run("install-standalone.mjs", ["install", "--no-model", "--target", projectTarget], { cwd: projectDir, env: fakeEnv });
    check(rProject.exit === 0, "F7 standalone: project-scope install exits 0 (non-blocking)");
    check(rProject.out.includes("notice: another AgenticAle install appears present"), "F7 standalone: duplicate notice spans scopes");
    check(rProject.out.includes("Pick one source of truth"), "F7 standalone: notice documents the explicit choice");

    // The already-owned project re-run must not re-emit the notice.
    const rProjectAgain = run("install-standalone.mjs", ["install", "--no-model", "--target", projectTarget], { cwd: projectDir, env: fakeEnv });
    check(rProjectAgain.exit === 0, "F7 standalone: owned project re-run exits 0");
    check(!rProjectAgain.out.includes("notice: another AgenticAle install appears present"), "F7 standalone: no duplicate notice on owned re-run");
  }

  // ---------------------------------------------------------------------
  // E. User-owned preference files: a user's .agenticale/routing.json in the
  //    project and home roots must never be created, overwritten, or removed
  //    by install/update/uninstall, for both installers.
  // ---------------------------------------------------------------------
  {
    const home = await mkdtemp(join(scratch, "e-routing-home-"));
    const env = { HOME: home, USERPROFILE: home };
    const project = await mkdtemp(join(scratch, "e-routing-project-"));
    const projectPrefs = JSON.stringify({ schemaVersion: 2, runtimes: { codex: { roles: { explore: { mode: "explicit", model: "USER-PROJECT-PREFERENCES-1", reasoningEffort: "high", fallbacks: [] } } } } });
    const homePrefs = JSON.stringify({ schemaVersion: 2, runtimes: { codex: { roles: { review: { mode: "explicit", model: "USER-HOME-PREFERENCES-2", reasoningEffort: "high", fallbacks: [] } } } } });
    await mkdir(join(project, ".agenticale"), { recursive: true });
    await mkdir(join(home, ".agenticale"), { recursive: true });
    await writeFile(join(project, ".agenticale", "routing.json"), projectPrefs, "utf8");
    await writeFile(join(home, ".agenticale", "routing.json"), homePrefs, "utf8");
    const assertPrefs = async (label) => {
      check((await readFile(join(project, ".agenticale", "routing.json"), "utf8")) === projectPrefs, `user routing.json: project file untouched after ${label}`);
      check((await readFile(join(home, ".agenticale", "routing.json"), "utf8")) === homePrefs, `user routing.json: home file untouched after ${label}`);
    };
    const target = join(project, ".agents", "skills");
    check((await run("install-standalone.mjs", ["install", "--target", target, "--no-model"], { cwd: project, env })).exit === 0, "user routing.json: standalone install exits 0");
    await assertPrefs("standalone install");
    check((await run("install-standalone.mjs", ["install", "--target", target, "--no-model"], { cwd: project, env })).exit === 0, "user routing.json: standalone update exits 0");
    await assertPrefs("standalone update");
    check((await run("install-standalone.mjs", ["uninstall", "--target", target], { cwd: project, env })).exit === 0, "user routing.json: standalone uninstall exits 0");
    await assertPrefs("standalone uninstall");
  }
  {
    // The installer never CREATES such files either: a root without
    // .agenticale/routing.json stays absent across install and uninstall.
    const home = await mkdtemp(join(scratch, "e-routing-bare-home-"));
    const env = { HOME: home, USERPROFILE: home };
    const project = await mkdtemp(join(scratch, "e-routing-bare-project-"));
    const target = join(project, ".agents", "skills");
    check((await run("install-standalone.mjs", ["install", "--target", target, "--no-model"], { cwd: project, env })).exit === 0, "user routing.json: bare standalone install exits 0");
    check(!(await exists(join(project, ".agenticale", "routing.json"))), "user routing.json: never created in the project root");
    check(!(await exists(join(home, ".agenticale", "routing.json"))), "user routing.json: never created in the home root");
    check((await run("install-standalone.mjs", ["uninstall", "--target", target], { cwd: project, env })).exit === 0, "user routing.json: bare standalone uninstall exits 0");
    check(!(await exists(join(project, ".agenticale", "routing.json"))), "user routing.json: still absent from the project root after uninstall");
  }
  {
    // Same contract for the OpenCode (profile) installer: the target root and
    // the isolated home keep their user-owned preference files intact.
    const home = await mkdtemp(join(scratch, "e-routing-oc-home-"));
    const env = { HOME: home, USERPROFILE: home };
    const target = join(scratch, "e-routing-oc");
    const prefs = JSON.stringify({ schemaVersion: 2, runtimes: { opencode: { roles: { fix: { mode: "explicit", model: "USER-OC-PREFERENCES-3", reasoningEffort: "high", fallbacks: [] } } } } });
    await mkdir(join(target, ".agenticale"), { recursive: true });
    await mkdir(join(home, ".agenticale"), { recursive: true });
    await writeFile(join(target, ".agenticale", "routing.json"), prefs, "utf8");
    await writeFile(join(home, ".agenticale", "routing.json"), prefs, "utf8");
    const assertPrefs = async (label) => {
      check((await readFile(join(target, ".agenticale", "routing.json"), "utf8")) === prefs, `user routing.json: opencode target file untouched after ${label}`);
      check((await readFile(join(home, ".agenticale", "routing.json"), "utf8")) === prefs, `user routing.json: opencode home file untouched after ${label}`);
    };
    check((await run("install.mjs", ["install", "--target", target, "--no-model"], { cwd: target, env })).exit === 0, "user routing.json: opencode install exits 0");
    await assertPrefs("opencode install");
    check((await run("install.mjs", ["install", "--target", target, "--no-model"], { cwd: target, env })).exit === 0, "user routing.json: opencode update exits 0");
    await assertPrefs("opencode update");
    check((await run("install.mjs", ["uninstall", "--target", target], { cwd: target, env })).exit === 0, "user routing.json: opencode uninstall exits 0");
    await assertPrefs("opencode uninstall");
  }

  // ---------------------------------------------------------------------
  // F. OpenCode preparation refresh: rerun the existing installer with a
  //    different --routing policy (the explicit profile-update path). Requested
  //    versus installed policies are compared through the installer's own
  //    safeguards: a mismatch is never applied silently (the whole update is
  //    blocked, no partial application), and a profile the user has modified
  //    is never overwritten without an explicit --replace (its edit is
  //    backed up first).
  // ---------------------------------------------------------------------
  const prepRoles = (suffix, reviewModel) => Object.fromEntries(
    ["explore", "implement", "implement-hard", "fix", "review", "deep-review", "consult"].map((name) => [name, name === "review"
      ? { mode: "explicit", model: reviewModel, reasoningEffort: "high", fallbacks: [{ model: `acme/review-${suffix}-fb`, reasoningEffort: "medium" }] }
      : { mode: "explicit", model: `acme/${name}-${suffix}`, reasoningEffort: "high", fallbacks: [] }]),
  );
  // The shape the preparation procedure exports: a complete version-1 policy
  // for the active runtime only.
  const policyA = { schemaVersion: 1, runtimes: { opencode: prepRoles("a", "acme/review-a") } };
  const policyB = { schemaVersion: 1, runtimes: { opencode: prepRoles("b", "acme/review-b") } };
  const pathA = join(scratch, "f-prep-a.json");
  const pathB = join(scratch, "f-prep-b.json");
  await writeFile(pathA, JSON.stringify(policyA), "utf8");
  await writeFile(pathB, JSON.stringify(policyB), "utf8");
  {
    const t = join(scratch, "f-prep");
    const fresh = run("install.mjs", ["install", "--target", t, "--routing", pathA]);
    check(fresh.exit === 0, "prep refresh: fresh install with --routing exits 0");
    let review = await readFile(join(t, "agents", "autonomous", "review.md"), "utf8");
    check(review.includes("model: acme/review-a"), "prep refresh: review profile renders the requested model");
    check(!review.includes("acme/review-a-fb"), "prep refresh: the requested fallback is not materialized into the profile");

    // Idempotent re-run with the same requested policy: a no-op.
    const same = run("install.mjs", ["install", "--target", t, "--routing", pathA]);
    check(same.exit === 0 && same.out.includes("Already up to date."), "prep refresh: the same requested policy is a no-op");

    // The documented refresh command updates the existing installation: the
    // owned, unmodified profiles are retired and recreated under the normal
    // ownership, backup, and rollback safeguards (no --replace is needed for
    // owned content).
    const updated = run("install.mjs", ["install", "--target", t, "--routing", pathB]);
    check(updated.exit === 0 && updated.out.includes("Installation complete."), "prep refresh: the installer update applies the new requested policy");
    check(updated.out.includes("migrate-remove: agents/autonomous/review.md") && updated.out.includes("backup created:"), "prep refresh: the update retires the old profiles under a backup");
    review = await readFile(join(t, "agents", "autonomous", "review.md"), "utf8");
    check(review.includes("model: acme/review-b"), "prep refresh: review profile now renders the requested model");
    check(await exists(join(t, "agents", "autonomous", "implement-hard.md")), "prep refresh: seven profiles retained with a distinct implement-hard");

    // The refreshed install's own helper (install-relative, no checkout)
    // resolves its packaged routing baseline to the selected OpenCode routes.
    const helper = spawnSync(process.execPath, [join(t, "skills", "work", "scripts", "routing.mjs"), "resolve", "--runtime", "opencode"], { encoding: "utf8", input: "" });
    check(helper.status === 0, `prep refresh: the installed helper runs from the target without the checkout${helper.status === 0 ? "" : ` (stderr: ${helper.stderr.trim()})`}`);
    const helperPolicy = JSON.parse(helper.stdout);
    check(JSON.stringify(helperPolicy.runtimes.opencode) === JSON.stringify(policyB.runtimes.opencode), "prep refresh: the installed helper resolves the installed OpenCode routes");
  }
  {
    // A profile the user has modified blocks the whole requested-policy update
    // (all-or-nothing, no partial application), and --replace preserves the
    // modified profile while applying the rest of the new policy.
    const t = join(scratch, "f-prep-modified");
    const fresh = run("install.mjs", ["install", "--target", t, "--routing", pathA]);
    check(fresh.exit === 0, "prep modified: setup install exits 0");
    const fix = join(t, "agents", "autonomous", "fix.md");
    await writeFile(fix, "USER-EDITED-FIX\n", "utf8");
    const blockedMod = run("install.mjs", ["install", "--target", t, "--routing", pathB]);
    check(blockedMod.exit === 1 && blockedMod.err.includes("Differing content already exists at:"), "prep modified: a user-modified profile collides without --replace");
    check(blockedMod.err.includes("No changes were made."), "prep modified: the collision is reported before any mutation");
    let review = await readFile(join(t, "agents", "autonomous", "review.md"), "utf8");
    check(review.includes("model: acme/review-a"), "prep modified: the blocked update left the other profiles untouched");
    check((await readFile(fix, "utf8")) === "USER-EDITED-FIX\n", "prep modified: the user-modified profile is left in place");
    const replacedMod = run("install.mjs", ["install", "--target", t, "--routing", pathB, "--replace"]);
    check(replacedMod.exit === 0 && replacedMod.out.includes("preserve-modified: agents/autonomous/fix.md"), "prep modified: the user edit is reported as preserved");
    check(replacedMod.out.includes("backup created:"), "prep modified: --replace backs up the user edit before replacing");
    review = await readFile(join(t, "agents", "autonomous", "review.md"), "utf8");
    check(review.includes("model: acme/review-b"), "prep modified: --replace applies the new policy to the unmodified profiles");
    check((await readFile(fix, "utf8")) !== "USER-EDITED-FIX\n" && (await readFile(fix, "utf8")).includes("model: acme/fix-b"), "prep modified: --replace backs up and replaces the modified profile with the new policy");
  }

  console.log(`Installer tests passed: ${assertions} assertions.`);
} finally {
  await rm(scratch, { recursive: true, force: true });
}
