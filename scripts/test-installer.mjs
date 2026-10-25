// Tests the two skills-first installers (install.mjs and install-standalone.mjs)
// against a throwaway target directory. They install the GENERATED build output,
// so these tests exercise the real install/update/migrate/collide/uninstall
// behaviours end to end and assert on both the on-disk tree and the state file.
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, readFile, writeFile, mkdir, symlink, access, readdir, cp, link, lstat, readlink, stat } from "node:fs/promises";
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
const versionThreeLinkPaths = linkPaths.filter((p) => !["commands/work.md", "skills/work-mode"].includes(p));
const versionTwoLinkPaths = versionThreeLinkPaths.filter((p) => p !== "skills/pull-request-description");
const legacyLinkPaths = versionTwoLinkPaths.filter((p) => p !== "skills/source-code-lookup");
const linkSet = (schema) =>
  schema === 1 ? legacyLinkPaths : schema === 2 ? versionTwoLinkPaths : schema === 3 ? versionThreeLinkPaths : linkPaths;

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
// The namespace names the profile directory: "agenticale" for the current
// layout, "autonomous" for pre-rename states.
async function makeGeneratedFixture(target, schema, profiles, skillFiles, namespace = "agenticale") {
  const entries = [];
  for (const name of profiles) {
    const p = `agents/${namespace}/${name}.md`;
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
    check(r.out.includes("pasting this prompt into an OpenCode session: Verify my AgenticAle routing for the opencode runtime"), "install fresh: the completion line carries the ready-to-paste verification prompt (same line, not a second print)");
    const state = await readState(t);
    check(state.schema === STATE_VERSION, "install fresh: state schema 6");
    check(state.mode === "copy", "install fresh: state mode copy");
    check(state.package === PACKAGE, "install fresh: state package");
    check(state.entries.length === 35, "install fresh: 35 entries");
    const profiles = state.entries.filter((e) => e.path.startsWith("agents/agenticale/"));
    check(profiles.length === 7, "install fresh: 7 generated profiles");
    check(state.entries.some((e) => e.path === "agents/agenticale/implement-hard.md"), "install fresh: implements implement-hard.md profile");
    check(state.entries.some((e) => e.path === "commands/work.md") && state.entries.some((e) => e.path === "commands/review.md") && state.entries.some((e) => e.path === "commands/autonomous.md"), "install fresh: three command entries in state");
    const files = (await relFiles(t)).filter((f) => f !== STATE);
    check(files.length === 35, "install fresh: 35 files on disk");
    const workCommand = await readFile(join(t, "commands", "work.md"), "utf8");
    check(workCommand.includes("`work`") && workCommand.includes("$ARGUMENTS"), "install fresh: work command loads the skill by exact ID");
    const reviewCommand = await readFile(join(t, "commands", "review.md"), "utf8");
    check(reviewCommand.includes("`review`") && reviewCommand.includes("$ARGUMENTS"), "install fresh: review command loads the skill by exact ID");
    const autonomousCommand = await readFile(join(t, "commands", "autonomous.md"), "utf8");
    check(autonomousCommand.includes("`autonomous`") && autonomousCommand.includes("$ARGUMENTS"), "install fresh: autonomous command loads the skill by exact ID");
    const srcLookup = await readFile(join(t, "skills", "source-code-lookup", "SKILL.md"), "utf8");
    check(srcLookup.includes('Source root: "~/dev"'), "install fresh: source root default marker");
    check(await exists(join(t, "skills", "work", "references", "routing.json")), "install fresh: materializes work/references/routing.json");
    check(await exists(join(t, "skills", "work", "references", "preferences.example.md")), "install fresh: materializes work/references/preferences.example.md");
    check(await exists(join(t, "skills", "work", "scripts", "routing.mjs")), "install fresh: materializes work/scripts/routing.mjs");
    check(await exists(join(t, "skills", "work", "scripts", "session-stats.mjs")), "install fresh: materializes work/scripts/session-stats.mjs");
  }
  {
    // The verification prompt's dynamic paths stay copy-pasteable when the
    // target contains spaces: every one of them is single-quoted.
    const t = join(scratch, "a-verify spaced target");
    const r = run("install.mjs", ["install", "--target", t, "--no-model"]);
    check(r.exit === 0, "install spaced target: exits 0");
    const helper = join(t, "skills", "work", "scripts", "routing.mjs");
    const profiles = join(t, "agents", "agenticale");
    const binding = join(t, "skills", "work", "references", "runtimes", "opencode.md");
    check(r.out.includes(`node '${helper}' startup --runtime opencode --root '`), "install spaced target: startup names the single-quoted helper path with --root");
    check(r.out.includes(`node '${helper}' resolve --runtime opencode --input '`), "install spaced target: resolve names the single-quoted helper path");
    check(r.out.includes(`'${profiles}'`), "install spaced target: the agent profiles directory is single-quoted");
    check(r.out.includes(`'${binding}'`), "install spaced target: the runtime binding path is single-quoted");
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
    const review = await readFile(join(t, "agents", "agenticale", "review.md"), "utf8");
    check(review.includes("model: acme/rev"), "models: review.md has model line");
    const consult = await readFile(join(t, "agents", "agenticale", "consult.md"), "utf8");
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
      ["unexpected profile", (s) => { s.entries = s.entries.filter((e) => e.path !== "agents/agenticale/consult.md"); s.entries.push({ path: "agents/agenticale/implhard.md", kind: "file", digest: digest(Buffer.from("x")) }); s.entries.push({ path: "agents/agenticale/consult.md", kind: "file", digest: digest(Buffer.from("y")) }); }, "Install state has an unexpected generated profile:"],
      ["partial skill mix", (s) => { s.entries = s.entries.filter((e) => !e.path.startsWith("skills/autonomous/")); }, "Install state does not contain a complete generated skill set (exactly the current five or the pre-review four skills):"],
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
  // B. Migration fixtures (schema 1-4 copy, schema 1-4 link, schema 5 generated).
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
    check(state.entries.length === 35, `migration copy schema ${schema}: 35 entries`);
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
    check(state.entries.length === 35, "migration generated schema 5: 35 entries");
    check(await exists(join(t, "agents", "agenticale", "implement-hard.md")), "migration generated schema 5: implement-hard profile now present");
    check(state.entries.some((e) => e.path === "agents/agenticale/implement-hard.md"), "migration generated schema 5: implement-hard in state");
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
    check(state2.entries.length === 35, "migration current-release schema 6: 35 entries");
    check((await readFile(join(t, "commands", "autonomous.md"), "utf8")).includes("$ARGUMENTS"), "migration current-release schema 6: command entries added");
  }
  {
    // Schema 6 state from the pre-review release (four skills, two command
    // entries) migrates by adding the review skill's files and the review
    // command entry; the legacy state must validate, not be rejected as
    // incomplete.
    const t = join(scratch, "b-gen6-prereview");
    const fresh = run("install.mjs", ["install", "--target", t, "--no-model"]);
    check(fresh.exit === 0, "migration pre-review schema 6: setup fresh exits 0");
    const state = JSON.parse(await readFile(join(t, STATE), "utf8"));
    const legacy = { ...state, entries: state.entries.filter((e) => !e.path.startsWith("skills/review/") && e.path !== "commands/review.md") };
    await writeFile(join(t, STATE), JSON.stringify(legacy, null, 2));
    await rm(join(t, "skills", "review"), { recursive: true });
    await rm(join(t, "commands", "review.md"));
    const r = run("install.mjs", ["install", "--target", t, "--no-model"]);
    check(r.exit === 0, "migration pre-review schema 6: exits 0 without --replace");
    check(!r.out.includes("Already up to date"), "migration pre-review schema 6: reconciles instead of reporting up-to-date");
    const state2 = await readState(t);
    check(state2.entries.length === 35, "migration pre-review schema 6: 35 entries");
    check(state2.entries.some((e) => e.path === "skills/review/SKILL.md"), "migration pre-review schema 6: the review skill is added");
    check((await readFile(join(t, "commands", "review.md"), "utf8")).includes("$ARGUMENTS"), "migration pre-review schema 6: the review command entry is added");
  }
  {
    // Modified retired-namespace file: after the rename the old profile paths are no
    // longer in the new inventory, so a user edit at agents/autonomous/consult.md
    // cannot collide — it is preserved (reported, not removed) while the renamed
    // profiles install without --replace.
    const t = join(scratch, "b-retired-modified");
    await mkdir(t, { recursive: true });
    await makeCopyFixture(t, 4);
    await writeFile(join(t, "agents", "autonomous", "consult.md"), "USER-EDITED-CONSULT\n");
    const r = run("install.mjs", ["install", "--target", t, "--no-model"]);
    check(r.exit === 0, "migration: modified retired profile refreshes without --replace");
    check(r.out.includes("preserve-modified: agents/autonomous/consult.md"), "migration: modified retired profile reported as preserved");
    check((await readFile(join(t, "agents", "autonomous", "consult.md"), "utf8")) === "USER-EDITED-CONSULT\n", "migration: the user edit is left in place");
    check(await exists(join(t, "agents", "agenticale", "consult.md")), "migration: the renamed profile is installed");
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
    check(state.schema === STATE_VERSION && state.mode === "copy" && state.entries.length === 35, "migration link schema 4: now schema 6 copy 35 entries");
    check((await readFile(join(t, "commands", "work.md"), "utf8")).includes("$ARGUMENTS"), "migration link schema 4: command links replaced by the generated files");
  }
  // Build the link inventory for a schema (the validator requires the exact
  // set; schema 4 carries the full set, schemas 1-3 the smaller retired sets).
  async function makeLinkFixture(target, srcDir, schema = 4) {
    await mkdir(srcDir, { recursive: true });
    const entries = [];
    for (const p of linkSet(schema)) {
      const dest = join(target, p);
      const stored = join(srcDir, p.replace(/\//g, "_").replace(/\.md$/, ".txt"));
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(stored, "linked\n");
      await symlink(stored, dest, "file");
      entries.push({ path: p, kind: "link", linkTarget: stored });
    }
    entries.sort((a, b) => a.path.localeCompare(b.path));
    await writeFile(join(target, STATE), JSON.stringify({
      entries, installedAt: new Date().toISOString(), mode: "link", package: PACKAGE, schema,
    }, null, 2));
  }
  for (const schema of [1, 2, 3]) {
    // Link schema 1-3 → converted to copy, mirroring the schema-4 link test.
    const t = join(scratch, `b-link${schema}`);
    const srcDir = join(scratch, `b-link${schema}-src`);
    await makeLinkFixture(t, srcDir, schema);
    // The retired command link (commands/autonomous.md) collides with the
    // generated command entries, so the conversion needs explicit approval,
    // as in b-link4.
    const blocked = run("install.mjs", ["install", "--target", t, "--no-model"]);
    check(blocked.exit === 1 && blocked.err.includes("Differing content already exists at:"), `migration link schema ${schema}: command links collide without --replace`);
    const r = run("install.mjs", ["install", "--target", t, "--no-model", "--replace"]);
    check(r.exit === 0, `migration link schema ${schema}: exits 0 with --replace`);
    check(r.out.includes(`  migrating from schema ${schema} link install`), `migration link schema ${schema}: migrating message`);
    check(r.out.includes("  converted: the previous link install was converted to a copy install of the generated bundle."), `migration link schema ${schema}: converted message`);
    const state = await readState(t);
    check(state.schema === STATE_VERSION && state.mode === "copy" && state.entries.length === 35, `migration link schema ${schema}: now schema 6 copy 35 entries`);
  }
  {
    // R6 + physical boundary: the stored retired profile link (agents/autonomous)
    // is a symlink the installer does NOT own (live target differs from the stored
    // one). It must never be deleted, and no profile copy may be written THROUGH it.
    // The new profiles install under the renamed namespace (agents/agenticale), so
    // the repointed old path is simply preserved and reported while the migration
    // still completes.
    const t = join(scratch, "b-link4-repoint");
    const srcDir = join(scratch, "b-link4-repoint-src");
    await makeLinkFixture(t, srcDir);
    const dest = join(t, "agents/autonomous");
    const otherTarget = join(srcDir, "elsewhere.txt");
    await writeFile(otherTarget, "other\n");
    await rm(dest);
    await symlink(otherTarget, dest, "file");
    // As in b-link4, the retired command links collide with the generated
    // command entries until the conversion is explicitly approved.
    const blocked = run("install.mjs", ["install", "--target", t, "--no-model"]);
    check(blocked.exit === 1 && blocked.err.includes("Differing content already exists at:"), "R6 link repoint: command links collide without --replace");
    const r = run("install.mjs", ["install", "--target", t, "--no-model", "--replace"]);
    check(r.exit === 0, "R6 link repoint: migration completes; the repointed retired link is left alone");
    check(r.out.includes("preserve-modified: agents/autonomous"), "R6 link repoint: repointed link reported as preserved");
    check((await lstat(dest)).isSymbolicLink(), "R6 link repoint: repointed link NOT deleted (still the same symlink)");
    check((await readlink(dest)) === otherTarget, "R6 link repoint: repointed link still points at the unowned target");
    check((await readFile(otherTarget, "utf8")) === "other\n", "R6 link repoint: repointed link's target content untouched");
    check(!(await exists(join(t, "agents", "autonomous", "consult.md"))), "R6 link repoint: no profile copies written through the old path");
    const state = await readState(t);
    check(state.schema === STATE_VERSION && state.mode === "copy" && state.entries.length === 35, "R6 link repoint: converted to schema 6 copy 35 entries");
    check(await exists(join(t, "agents", "agenticale", "consult.md")), "R6 link repoint: new profiles installed under the renamed namespace");
  }
  {
    // R6: a link replaced by a plain directory is preserved (ownership of the bytes
    // cannot be proven). The new profiles install under the renamed namespace
    // (agents/agenticale), so the real directory at the retired agents/autonomous
    // path keeps its pre-existing bytes while the migration still completes.
    const t = join(scratch, "b-link4-dir");
    const srcDir = join(scratch, "b-link4-dir-src");
    await makeLinkFixture(t, srcDir);
    const dest = join(t, "agents/autonomous");
    const kept = join(dest, "user-note.md");
    await rm(dest);
    await mkdir(dest, { recursive: true });
    await writeFile(kept, "USER-KEPT\n");
    // As in b-link4, the retired command links collide with the generated
    // command entries until the conversion is explicitly approved.
    const blocked = run("install.mjs", ["install", "--target", t, "--no-model"]);
    check(blocked.exit === 1 && blocked.err.includes("Differing content already exists at:"), "R6 link→dir: command links collide without --replace");
    const r = run("install.mjs", ["install", "--target", t, "--no-model", "--replace"]);
    check(r.exit === 0, "R6 link→dir: exits 0 with --replace");
    check(r.out.includes("preserve-modified: agents/autonomous"), "R6 link→dir: replaced-by-directory preserved");
    check((await readFile(kept, "utf8")) === "USER-KEPT\n", "R6 link→dir: pre-existing bytes in the preserved directory are not deleted");
    const state = await readState(t);
    check(state.schema === STATE_VERSION && state.mode === "copy" && state.entries.length === 35, "R6 link→dir: converted to schema 6 copy 35 entries");
    check(await exists(join(t, "agents", "agenticale", "consult.md")), "R6 link→dir: new profiles installed under the renamed namespace");
    check(!(await exists(join(t, "agents", "autonomous", "consult.md"))), "R6 link→dir: no profile copies written into the preserved directory");
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
  // B3a. Namespace rename: a schema-6 state from the pre-rename release
  //      (profiles under the old namespace) refreshes by retiring the old
  //      profiles under a backup while the new profiles are installed under
  //      the current namespace.
  // ---------------------------------------------------------------------
  {
    const t = join(scratch, "b3a-rename");
    await mkdir(t, { recursive: true });
    await makeGeneratedFixture(t, STATE_VERSION, PROFILES, fourSkills, "autonomous");
    const r = run("install.mjs", ["install", "--target", t, "--no-model"]);
    check(r.exit === 0, "namespace rename: the refresh exits 0");
    check(r.out.includes("migrate-remove: agents/autonomous/review.md") && r.out.includes("backup created:"), "namespace rename: the old profiles are retired under a backup");
    check(r.out.includes("create: agents/agenticale/review.md"), "namespace rename: the new profile paths are installed");
    const state = await readState(t);
    check(state.schema === STATE_VERSION && state.entries.length === 35, "namespace rename: 35 entries in the refreshed state");
    check(state.entries.every((e) => !e.path.startsWith("agents/autonomous/")), "namespace rename: no old-namespace entries remain in state");
    check(state.entries.some((e) => e.path === "agents/agenticale/implement-hard.md"), "namespace rename: the new implement-hard profile is in state");
    check(await exists(join(t, "agents", "agenticale", "implement-hard.md")), "namespace rename: the new implement-hard profile is on disk");
    check(!(await exists(join(t, "agents", "autonomous", "review.md"))), "namespace rename: the old profile files are removed");
    check(!(await exists(join(t, "agents", "autonomous"))), "namespace rename: the empty old-namespace directory is swept");
  }
  {
    // A pre-rename schema-5 generated copy (the six profiles under the old
    // namespace) refreshes through the dual-namespace acceptance: the
    // old-namespace profiles are retired under a backup while all seven current
    // profiles (including implement-hard) install under the renamed namespace.
    const t = join(scratch, "b3a-rename-schema5");
    await mkdir(t, { recursive: true });
    await makeGeneratedFixture(t, LEGACY_GENERATED_SCHEMA, LEGACY_PROFILES, fourSkills, "autonomous");
    const r = run("install.mjs", ["install", "--target", t, "--no-model"]);
    check(r.exit === 0, "namespace rename schema 5: the refresh exits 0");
    check(r.out.includes("migrate-remove: agents/autonomous/review.md") && r.out.includes("backup created:"), "namespace rename schema 5: the old profiles are retired under a backup");
    check(r.out.includes("create: agents/agenticale/implement-hard.md"), "namespace rename schema 5: the added implement-hard profile is created");
    const state = await readState(t);
    check(state.schema === STATE_VERSION && state.entries.length === 35, "namespace rename schema 5: 35 entries in the refreshed state");
    check(state.entries.every((e) => !e.path.startsWith("agents/autonomous/")), "namespace rename schema 5: no old-namespace entries remain in state");
    check(await exists(join(t, "agents", "agenticale", "implement-hard.md")), "namespace rename schema 5: the new implement-hard profile is on disk");
    check(!(await exists(join(t, "agents", "autonomous", "review.md"))), "namespace rename schema 5: the old profile files are removed");
    check(!(await exists(join(t, "agents", "autonomous"))), "namespace rename schema 5: the empty old-namespace directory is swept");
  }
  {
    // Already-upgraded upgrader: a user who migrated in an earlier release
    // re-runs the installer; everything is owned and up to date, so install
    // takes the "Already up to date." early return. The pre-rename
    // agents/autonomous residue — an empty directory the migration in that
    // earlier release left behind, absent from the state file — is still on
    // disk, so that early-return path must sweep empty retired package
    // directories too.
    const t = join(scratch, "b3a-residue");
    const fresh = run("install.mjs", ["install", "--target", t, "--no-model"]);
    check(fresh.exit === 0, "upgrader residue: the fresh install exits 0");
    await mkdir(join(t, "agents", "autonomous"), { recursive: true });
    const before = await readFile(join(t, STATE));
    const r = run("install.mjs", ["install", "--target", t, "--no-model"]);
    check(r.exit === 0, "upgrader residue: the re-run exits 0");
    check(r.out.includes("Already up to date."), "upgrader residue: reports already up to date");
    const after = await readFile(join(t, STATE));
    check(before.equals(after), "upgrader residue: the state file is untouched");
    check(!(await exists(join(t, "agents", "autonomous"))), "upgrader residue: the empty old-namespace directory is swept");
    check(await exists(join(t, "agents", "agenticale", "consult.md")), "upgrader residue: the current-namespace profiles are intact");
  }
  {
    // R6 sweep: a user-owned symlink to a regular FILE at a retired sweep path
    // (skills/work-mode). The deeper sweep candidate skills/work-mode/
    // references cannot be stat'd through a symlink-to-file (lstat throws
    // ENOTDIR), so the sweep must treat it as absent and skip it — the same
    // treatment pathStatus() documents — instead of failing an otherwise
    // successful install. Pre-fix this re-run exited 1 with the unhandled
    // ENOTDIR.
    const t = join(scratch, "b3a-link-to-file");
    const fresh = run("install.mjs", ["install", "--target", t, "--no-model"]);
    check(fresh.exit === 0, "link-to-file sweep: the fresh install exits 0");
    const fileDir = join(scratch, "b3a-link-to-file-src");
    await mkdir(fileDir, { recursive: true });
    const file = join(fileDir, "user-file.txt");
    await writeFile(file, "user file\n");
    const link = join(t, "skills", "work-mode");
    await symlink(file, link, "file");
    const r = run("install.mjs", ["install", "--target", t, "--no-model"]);
    check(r.exit === 0, "link-to-file sweep: the re-run exits 0 (no unhandled ENOTDIR)");
    check(r.out.includes("Already up to date."), "link-to-file sweep: reports already up to date");
    check((await lstat(link)).isSymbolicLink(), "link-to-file sweep: the user symlink survives");
    check((await readlink(link)) === file, "link-to-file sweep: the user symlink still points at the same file");
    check(await exists(join(t, "agents", "agenticale", "consult.md")), "link-to-file sweep: the current install is intact");
  }
  {
    // R6 sweep: a user-owned junction/symlink at a retired sweep path
    // (skills/work-mode) pointing OUTSIDE the target, where the linked
    // directory holds an empty references/ subdirectory. The sweep must skip
    // the candidate instead of rmdir'ing THROUGH the link — pre-fix the
    // external empty directory was deleted (user state outside the package's
    // ownership).
    const t = join(scratch, "b3a-linked-ancestor");
    const fresh = run("install.mjs", ["install", "--target", t, "--no-model"]);
    check(fresh.exit === 0, "linked-ancestor sweep: the fresh install exits 0");
    const external = join(scratch, "b3a-linked-ancestor-external");
    await mkdir(join(external, "references"), { recursive: true });
    const link = join(t, "skills", "work-mode");
    await symlink(external, link, "junction");
    const before = await readlink(link);
    const r = run("install.mjs", ["install", "--target", t, "--no-model"]);
    check(r.exit === 0, "linked-ancestor sweep: the re-run exits 0");
    check(r.out.includes("Already up to date."), "linked-ancestor sweep: reports already up to date");
    check((await lstat(link)).isSymbolicLink(), "linked-ancestor sweep: the user junction/symlink survives");
    check((await readlink(link)) === before, "linked-ancestor sweep: the link still points at the external directory");
    check(await exists(join(external, "references")), "linked-ancestor sweep: the external empty directory was NOT deleted through the link");
    check(await exists(join(t, "agents", "agenticale", "consult.md")), "linked-ancestor sweep: the current install is intact");
  }
  {
    // R6 sweep: a user-owned self-referencing (looping) symlink at a retired
    // sweep path (skills/work-mode -> itself). The deeper candidate
    // skills/work-mode/references cannot be probed at all: lstat follows the
    // intermediate components of the path, so the loop throws ELOOP. The
    // ancestor guard must skip the candidate BEFORE the probe, so the sweep
    // never traverses the user-owned link; pre-fix the probe rethrew the
    // ELOOP and the re-run exited 1 on a target whose fresh install exited 0.
    const t = join(scratch, "b3a-loop-link");
    const fresh = run("install.mjs", ["install", "--target", t, "--no-model"]);
    check(fresh.exit === 0, "loop-link sweep: the fresh install exits 0");
    const link = join(t, "skills", "work-mode");
    await symlink(link, link);
    const r = run("install.mjs", ["install", "--target", t, "--no-model"]);
    check(r.exit === 0, "loop-link sweep: the re-run exits 0 (no unhandled ELOOP)");
    check(r.out.includes("Already up to date."), "loop-link sweep: reports already up to date");
    check((await lstat(link)).isSymbolicLink(), "loop-link sweep: the user loop symlink survives");
    check((await readlink(link)) === link, "loop-link sweep: the user loop symlink is still self-referencing");
    check(await exists(join(t, "agents", "agenticale", "consult.md")), "loop-link sweep: the current install is intact");
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
    check(state.sourceLayout === "autonomous,pull-request-description,review,source-code-lookup,work", "standalone fresh: sourceLayout string");
    check(state.entries.length === 25, "standalone fresh: 25 entries");
    const files = (await relFiles(t)).filter((f) => f !== STANDALONE_STATE);
    check(files.length === 25, "standalone fresh: 25 files on disk");
    check(!files.some((f) => f.startsWith("agents/")), "standalone fresh: no agents/");
    check(!files.some((f) => f.startsWith("commands/")), "standalone fresh: no commands/");
    check(await exists(join(t, "work", "references", "routing.json")), "standalone fresh: materializes work/references/routing.json");
    check(await exists(join(t, "work", "references", "preferences.example.md")), "standalone fresh: materializes work/references/preferences.example.md");
    check(await exists(join(t, "work", "scripts", "routing.mjs")), "standalone fresh: materializes work/scripts/routing.mjs");
    // Idempotent.
    const before = await readFile(join(t, STANDALONE_STATE), "utf8");
    const r2 = run("install-standalone.mjs", ["install", "--target", t, "--no-model"]);
    check(r2.exit === 0 && r2.out.includes("Already up to date."), "standalone idempotent: Already up to date");
    check(before === await readFile(join(t, STANDALONE_STATE), "utf8"), "standalone idempotent: state unchanged");
  }
  {
    // Pre-review schema-1 state (the four skills, no review): an update adds
    // the review skill's files; the legacy state must validate, not be
    // rejected as incomplete.
    const t = join(scratch, "c-pre-review");
    const fresh = run("install-standalone.mjs", ["install", "--target", t, "--no-model"]);
    check(fresh.exit === 0, "standalone pre-review migration: setup fresh exits 0");
    const state = JSON.parse(await readFile(join(t, STANDALONE_STATE), "utf8"));
    const legacy = {
      ...state,
      sourceLayout: "autonomous,pull-request-description,source-code-lookup,work",
      entries: state.entries.filter((e) => !e.path.startsWith("review/")),
    };
    await writeFile(join(t, STANDALONE_STATE), JSON.stringify(legacy, null, 2));
    await rm(join(t, "review"), { recursive: true });
    const r = run("install-standalone.mjs", ["install", "--target", t, "--no-model"]);
    check(r.exit === 0, "standalone pre-review migration: exits 0 without --replace");
    check(!r.out.includes("Already up to date"), "standalone pre-review migration: reconciles instead of reporting up-to-date");
    const state2 = await readStandaloneState(t);
    check(state2.entries.length === 25, "standalone pre-review migration: 25 entries");
    check(state2.sourceLayout === "autonomous,pull-request-description,review,source-code-lookup,work", "standalone pre-review migration: the review skill is in the source layout");
    check(state2.entries.some((e) => e.path === "review/SKILL.md"), "standalone pre-review migration: the review skill is added");
  }
  {
    // A state carrying a partial skill mix — neither the current five nor the
    // pre-review four skills — is rejected before anything is written.
    const t = join(scratch, "c-partial-mix");
    const fresh = run("install-standalone.mjs", ["install", "--target", t, "--no-model"]);
    check(fresh.exit === 0, "standalone partial mix: setup fresh exits 0");
    const state = JSON.parse(await readFile(join(t, STANDALONE_STATE), "utf8"));
    const partial = { ...state, entries: state.entries.filter((e) => !e.path.startsWith("autonomous/")) };
    await writeFile(join(t, STANDALONE_STATE), JSON.stringify(partial, null, 2));
    const r = run("install-standalone.mjs", ["install", "--target", t, "--no-model"]);
    check(r.exit === 1 && r.err.includes("Install state does not contain a complete generated skill set (exactly the current five or the pre-review four skills):"), "standalone partial skill mix rejected");
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
  // E. User-owned preference files: a user's .agenticale/routing.md in the
  //    project and home roots must never be created, overwritten, or removed
  //    by install/update/uninstall, for both installers.
  // ---------------------------------------------------------------------
  {
    const home = await mkdtemp(join(scratch, "e-routing-home-"));
    const env = { HOME: home, USERPROFILE: home };
    const project = await mkdtemp(join(scratch, "e-routing-project-"));
    const projectPrefs = "# Project routing\nExplore with USER-PROJECT-PREFERENCES-1 at high effort.\n";
    const homePrefs = "# Personal routing\nReview with USER-HOME-PREFERENCES-2 at high effort.\n";
    await mkdir(join(project, ".agenticale"), { recursive: true });
    await mkdir(join(home, ".agenticale"), { recursive: true });
    await writeFile(join(project, ".agenticale", "routing.md"), projectPrefs, "utf8");
    await writeFile(join(home, ".agenticale", "routing.md"), homePrefs, "utf8");
    const assertPrefs = async (label) => {
      check((await readFile(join(project, ".agenticale", "routing.md"), "utf8")) === projectPrefs, `user routing.md: project file untouched after ${label}`);
      check((await readFile(join(home, ".agenticale", "routing.md"), "utf8")) === homePrefs, `user routing.md: home file untouched after ${label}`);
    };
    const target = join(project, ".agents", "skills");
    check((await run("install-standalone.mjs", ["install", "--target", target, "--no-model"], { cwd: project, env })).exit === 0, "user routing.md: standalone install exits 0");
    await assertPrefs("standalone install");
    check((await run("install-standalone.mjs", ["install", "--target", target, "--no-model"], { cwd: project, env })).exit === 0, "user routing.md: standalone update exits 0");
    await assertPrefs("standalone update");
    check((await run("install-standalone.mjs", ["uninstall", "--target", target], { cwd: project, env })).exit === 0, "user routing.md: standalone uninstall exits 0");
    await assertPrefs("standalone uninstall");
  }
  {
    // The installer never CREATES such files either: a root without
    // .agenticale/routing.md stays absent across install and uninstall.
    const home = await mkdtemp(join(scratch, "e-routing-bare-home-"));
    const env = { HOME: home, USERPROFILE: home };
    const project = await mkdtemp(join(scratch, "e-routing-bare-project-"));
    const target = join(project, ".agents", "skills");
    check((await run("install-standalone.mjs", ["install", "--target", target, "--no-model"], { cwd: project, env })).exit === 0, "user routing.md: bare standalone install exits 0");
    check(!(await exists(join(project, ".agenticale", "routing.md"))), "user routing.md: never created in the project root");
    check(!(await exists(join(home, ".agenticale", "routing.md"))), "user routing.md: never created in the home root");
    check((await run("install-standalone.mjs", ["uninstall", "--target", target], { cwd: project, env })).exit === 0, "user routing.md: bare standalone uninstall exits 0");
    check(!(await exists(join(project, ".agenticale", "routing.md"))), "user routing.md: still absent from the project root after uninstall");
  }
  {
    // Same contract for the OpenCode (profile) installer: the target root and
    // the isolated home keep their user-owned preference files intact.
    const home = await mkdtemp(join(scratch, "e-routing-oc-home-"));
    const env = { HOME: home, USERPROFILE: home };
    const target = join(scratch, "e-routing-oc");
    const prefs = "# OpenCode routing\nFix with USER-OC-PREFERENCES-3 at high effort.\n";
    await mkdir(join(target, ".agenticale"), { recursive: true });
    await mkdir(join(home, ".agenticale"), { recursive: true });
    await writeFile(join(target, ".agenticale", "routing.md"), prefs, "utf8");
    await writeFile(join(home, ".agenticale", "routing.md"), prefs, "utf8");
    const assertPrefs = async (label) => {
      check((await readFile(join(target, ".agenticale", "routing.md"), "utf8")) === prefs, `user routing.md: opencode target file untouched after ${label}`);
      check((await readFile(join(home, ".agenticale", "routing.md"), "utf8")) === prefs, `user routing.md: opencode home file untouched after ${label}`);
    };
    check((await run("install.mjs", ["install", "--target", target, "--no-model"], { cwd: target, env })).exit === 0, "user routing.md: opencode install exits 0");
    await assertPrefs("opencode install");
    check((await run("install.mjs", ["install", "--target", target, "--no-model"], { cwd: target, env })).exit === 0, "user routing.md: opencode update exits 0");
    await assertPrefs("opencode update");
    check((await run("install.mjs", ["uninstall", "--target", target], { cwd: target, env })).exit === 0, "user routing.md: opencode uninstall exits 0");
    await assertPrefs("opencode uninstall");
  }

  // ---------------------------------------------------------------------
  // E (preferences.md mirror): the same user-owned file contract applies to
  //    the default personal preferences name — install/update/uninstall for
  //    both installers never create, overwrite, or remove it.
  // ---------------------------------------------------------------------
  {
    const home = await mkdtemp(join(scratch, "e-prefs-home-"));
    const env = { HOME: home, USERPROFILE: home };
    const project = await mkdtemp(join(scratch, "e-prefs-project-"));
    const projectPrefs = "# Project preferences\nExplore with USER-PROJECT-PREFERENCES-1 at high effort.\n";
    const homePrefs = "# Personal preferences\nReview with USER-HOME-PREFERENCES-2 at high effort.\n";
    await mkdir(join(project, ".agenticale"), { recursive: true });
    await mkdir(join(home, ".agenticale"), { recursive: true });
    await writeFile(join(project, ".agenticale", "preferences.md"), projectPrefs, "utf8");
    await writeFile(join(home, ".agenticale", "preferences.md"), homePrefs, "utf8");
    const assertPrefs = async (label) => {
      check((await readFile(join(project, ".agenticale", "preferences.md"), "utf8")) === projectPrefs, `user preferences.md: project file untouched after ${label}`);
      check((await readFile(join(home, ".agenticale", "preferences.md"), "utf8")) === homePrefs, `user preferences.md: home file untouched after ${label}`);
    };
    const target = join(project, ".agents", "skills");
    check((await run("install-standalone.mjs", ["install", "--target", target, "--no-model"], { cwd: project, env })).exit === 0, "user preferences.md: standalone install exits 0");
    await assertPrefs("standalone install");
    check((await run("install-standalone.mjs", ["install", "--target", target, "--no-model"], { cwd: project, env })).exit === 0, "user preferences.md: standalone update exits 0");
    await assertPrefs("standalone update");
    check((await run("install-standalone.mjs", ["uninstall", "--target", target], { cwd: project, env })).exit === 0, "user preferences.md: standalone uninstall exits 0");
    await assertPrefs("standalone uninstall");
  }
  {
    // The installer never CREATES such files either: a root without
    // .agenticale/preferences.md stays absent across install and uninstall.
    const home = await mkdtemp(join(scratch, "e-prefs-bare-home-"));
    const env = { HOME: home, USERPROFILE: home };
    const project = await mkdtemp(join(scratch, "e-prefs-bare-project-"));
    const target = join(project, ".agents", "skills");
    check((await run("install-standalone.mjs", ["install", "--target", target, "--no-model"], { cwd: project, env })).exit === 0, "user preferences.md: bare standalone install exits 0");
    check(!(await exists(join(project, ".agenticale", "preferences.md"))), "user preferences.md: never created in the project root");
    check(!(await exists(join(home, ".agenticale", "preferences.md"))), "user preferences.md: never created in the home root");
    check((await run("install-standalone.mjs", ["uninstall", "--target", target], { cwd: project, env })).exit === 0, "user preferences.md: bare standalone uninstall exits 0");
    check(!(await exists(join(project, ".agenticale", "preferences.md"))), "user preferences.md: still absent from the project root after uninstall");
  }
  {
    // Same contract for the OpenCode (profile) installer: the target root and
    // the isolated home keep their user-owned preferences files intact.
    const home = await mkdtemp(join(scratch, "e-prefs-oc-home-"));
    const env = { HOME: home, USERPROFILE: home };
    const target = join(scratch, "e-prefs-oc");
    const prefs = "# OpenCode preferences\nFix with USER-OC-PREFERENCES-3 at high effort.\n";
    await mkdir(join(target, ".agenticale"), { recursive: true });
    await mkdir(join(home, ".agenticale"), { recursive: true });
    await writeFile(join(target, ".agenticale", "preferences.md"), prefs, "utf8");
    await writeFile(join(home, ".agenticale", "preferences.md"), prefs, "utf8");
    const assertPrefs = async (label) => {
      check((await readFile(join(target, ".agenticale", "preferences.md"), "utf8")) === prefs, `user preferences.md: opencode target file untouched after ${label}`);
      check((await readFile(join(home, ".agenticale", "preferences.md"), "utf8")) === prefs, `user preferences.md: opencode home file untouched after ${label}`);
    };
    check((await run("install.mjs", ["install", "--target", target, "--no-model"], { cwd: target, env })).exit === 0, "user preferences.md: opencode install exits 0");
    await assertPrefs("opencode install");
    check((await run("install.mjs", ["install", "--target", target, "--no-model"], { cwd: target, env })).exit === 0, "user preferences.md: opencode update exits 0");
    await assertPrefs("opencode update");
    check((await run("install.mjs", ["uninstall", "--target", target], { cwd: target, env })).exit === 0, "user preferences.md: opencode uninstall exits 0");
    await assertPrefs("opencode uninstall");
  }

  // ---------------------------------------------------------------------
  // E2. setup subcommand: the consented install-time setup creates the
  //     personal preferences file as a minimal scaffold with no role
  //     overrides, so the installed baseline routing applies, if and only if
  //     it is absent. It never
  //     overwrites an existing file, dry-run writes nothing, and the
  //     scaffold carries none of the example's illustrative identifiers.
  // ---------------------------------------------------------------------
  {
    const exampleText = await readFile(join(repo, "skills", "work", "references", "preferences.example.md"), "utf8");
    const illustrativeIds = [...new Set([...exampleText.matchAll(/[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*/g)].map((m) => m[0]))];
    check(illustrativeIds.length > 0, "setup: the example file carries illustrative identifiers");
    const assertNoIllustrativeIds = (label, content) => {
      for (const id of illustrativeIds) {
        check(!content.includes(id), `setup: ${label} carries no illustrative identifier '${id}'`);
      }
    };

    // Scaffold created at a custom personal path.
    const personal = join(scratch, "e2-created", "routing.md");
    const r = run("install.mjs", ["setup", "--personal-path", personal]);
    check(r.exit === 0, "setup: creates the scaffold and exits 0");
    check(r.out.includes(personal), "setup: prints the file path");
    const content = await readFile(personal, "utf8");
    check(!content.match(/^## (codex|copilot|opencode|antigravity)\b/m), "setup: scaffold carries no runtime section (baseline routing applies)");
    for (const role of ["explore", "implement", "implement-hard", "fix", "review", "deep-review", "consult"]) {
      check(!content.includes(`- ${role}:`), `setup: scaffold carries no role override for ${role}`);
    }
    assertNoIllustrativeIds("created scaffold", content);
    check(r.out.includes("preferences.example.md"), "setup: guidance names the packaged example");
    check(r.out.includes(".agenticale/preferences.md"), "setup: guidance names the project-scope file");
    check(r.out.includes("Paste this prompt into an OpenCode session"), "setup: prints a ready-to-paste prompt");
    check(r.out.includes(`preferences file at ${personal}`), "setup: the paste prompt names the created file");

    // Idempotent: a second run leaves the scaffold byte-identical.
    const again = run("install.mjs", ["setup", "--personal-path", personal]);
    check(again.exit === 0, "setup re-run: exits 0");
    check((await readFile(personal, "utf8")) === content, "setup re-run: scaffold byte-identical");
    check(again.out.includes("left untouched"), "setup re-run: reports left untouched");

    // A pre-existing file (different content) is left byte-identical, exit 0.
    const existing = join(scratch, "e2-existing", "routing.md");
    await mkdir(dirname(existing), { recursive: true });
    const owned = "# USER-OWNED routing\nReview with USER-CHOSEN-ROUTING.\n";
    await writeFile(existing, owned, "utf8");
    const r2 = run("install.mjs", ["setup", "--personal-path", existing]);
    check(r2.exit === 0, "setup existing: exits 0");
    check((await readFile(existing, "utf8")) === owned, "setup existing: file left byte-identical");
    check(r2.out.includes("left untouched"), "setup existing: left-untouched line");
    check(r2.out.includes(existing), "setup existing: prints the file path");
    check(r2.out.includes("preferences.example.md"), "setup existing: guidance still printed");
    check(r2.out.includes("Paste this prompt into an OpenCode session"), "setup existing: prompt still printed");

    // --dry-run writes nothing (absent and present cases).
    const dryAbsent = join(scratch, "e2-dry-absent", "routing.md");
    const r3 = run("install.mjs", ["setup", "--personal-path", dryAbsent, "--dry-run"]);
    check(r3.exit === 0 && r3.out.includes("Dry run complete; no files were changed."), "setup dry-run: no files changed message");
    check(r3.out.includes("would create"), "setup dry-run: plans the create");
    check(!(await exists(dryAbsent)), "setup dry-run: absent file not created");
    check(!(await exists(dirname(dryAbsent))), "setup dry-run: parent directory not created");
    const dryPresent = join(scratch, "e2-dry-present", "routing.md");
    await mkdir(dirname(dryPresent), { recursive: true });
    const owned2 = "USER-DRY-CONTENT\n";
    await writeFile(dryPresent, owned2, "utf8");
    const r4 = run("install.mjs", ["setup", "--personal-path", dryPresent, "--dry-run"]);
    check(r4.exit === 0 && (await readFile(dryPresent, "utf8")) === owned2, "setup dry-run: present file untouched");
    check(r4.out.includes("would leave untouched"), "setup dry-run: present file reported untouched");

    // Default personal path under an isolated home.
    const fakeHome = await mkdtemp(join(scratch, "e2-home-"));
    const r5 = run("install.mjs", ["setup"], { env: { HOME: fakeHome, USERPROFILE: fakeHome } });
    const def = join(fakeHome, ".agenticale", "preferences.md");
    check(r5.exit === 0, "setup default: exits 0");
    check(await exists(def), "setup default: creates ~/.agenticale/preferences.md");
    const defaultContent = await readFile(def, "utf8");
    assertNoIllustrativeIds("default scaffold", defaultContent);
    const r5b = run("install.mjs", ["setup"], { env: { HOME: fakeHome, USERPROFILE: fakeHome } });
    check(r5b.exit === 0, "setup default re-run: exits 0");
    check((await readFile(def, "utf8")) === defaultContent, "setup default re-run: existing scaffold left untouched");
    check(r5b.out.includes("left untouched"), "setup default re-run: reports left untouched");

    // Legacy sibling at the default home: a user's legacy
    // ~/.agenticale/routing.md with no preferences.md makes setup create
    // nothing and report the legacy path; the legacy file is never renamed,
    // migrated, or removed, and the guidance (including the paste prompt) is
    // still printed, targeting the legacy file — the user's effective file,
    // since no preferences.md exists for the prompt to read.
    const legacyHome = await mkdtemp(join(scratch, "e2-legacy-home-"));
    const legacyPath = join(legacyHome, ".agenticale", "routing.md");
    const legacyContent = "# USER-OWNED legacy routing\nReview with USER-CHOSEN-ROUTING.\n";
    await mkdir(join(legacyHome, ".agenticale"), { recursive: true });
    await writeFile(legacyPath, legacyContent, "utf8");
    const legacyEnv = { HOME: legacyHome, USERPROFILE: legacyHome };
    const absentPreferences = join(legacyHome, ".agenticale", "preferences.md");
    const r10 = run("install.mjs", ["setup"], { env: legacyEnv });
    check(r10.exit === 0, "setup legacy sibling: exits 0");
    check(r10.out.includes("create nothing"), "setup legacy sibling: reports it creates nothing");
    check(!r10.out.includes("would create nothing"), "setup legacy sibling: real run does not use the dry-run phrasing");
    check(r10.out.includes(legacyPath), "setup legacy sibling: names the legacy path");
    check(r10.out.includes("Paste this prompt into an OpenCode session"), "setup legacy sibling: guidance still printed");
    check(r10.out.includes(`personal preferences file at ${legacyPath}. Read the file`), "setup legacy sibling: the paste prompt targets the effective legacy file");
    check(!r10.out.includes(`personal preferences file at ${absentPreferences}`), "setup legacy sibling: the paste prompt does not name the absent preferences.md");
    check(!(await exists(absentPreferences)), "setup legacy sibling: preferences.md not created");
    check((await readFile(legacyPath, "utf8")) === legacyContent, "setup legacy sibling: legacy file byte-identical (not renamed, migrated, or removed)");
    const r11 = run("install.mjs", ["setup", "--dry-run"], { env: legacyEnv });
    check(r11.exit === 0, "setup legacy sibling --dry-run: exits 0");
    check(r11.out.includes("would create nothing"), "setup legacy sibling --dry-run: reports it would create nothing");
    check(r11.out.includes(legacyPath), "setup legacy sibling --dry-run: names the legacy path");
    check(r11.out.includes(`personal preferences file at ${legacyPath}. Read the file`), "setup legacy sibling --dry-run: the paste prompt targets the effective legacy file");
    check(!r11.out.includes(`personal preferences file at ${absentPreferences}`), "setup legacy sibling --dry-run: the paste prompt does not name the absent preferences.md");
    check(r11.out.includes("Dry run complete; no files were changed."), "setup legacy sibling --dry-run: no files changed message");
    check(!(await exists(absentPreferences)), "setup legacy sibling --dry-run: preferences.md still not created");
    check((await readFile(legacyPath, "utf8")) === legacyContent, "setup legacy sibling --dry-run: legacy file still byte-identical");

    // Both present at the default home: a user's preferences.md AND a
    // legacy routing.md. preferences.md takes precedence at the same scope,
    // so it is the effective file: setup creates nothing, touches neither
    // file, and the guidance — including the paste prompt — must target
    // preferences.md, never the ignored legacy file (the legacy-only
    // creation-suppressed line must not appear either).
    const bothHome = await mkdtemp(join(scratch, "e2-both-home-"));
    const bothPrefs = join(bothHome, ".agenticale", "preferences.md");
    const bothLegacy = join(bothHome, ".agenticale", "routing.md");
    const bothPrefsContent = "# USER-OWNED preferences\nFix with USER-PREFERENCES-FILE.\n";
    const bothLegacyContent = "# USER-OWNED legacy routing\nReview with USER-LEGACY-FILE.\n";
    await mkdir(join(bothHome, ".agenticale"), { recursive: true });
    await writeFile(bothPrefs, bothPrefsContent, "utf8");
    await writeFile(bothLegacy, bothLegacyContent, "utf8");
    const bothEnv = { HOME: bothHome, USERPROFILE: bothHome };
    const assertBothHome = async (label) => {
      check((await readFile(bothPrefs, "utf8")) === bothPrefsContent, `setup both present: preferences.md byte-identical after ${label}`);
      check((await readFile(bothLegacy, "utf8")) === bothLegacyContent, `setup both present: legacy routing.md byte-identical after ${label}`);
      check((await readdir(join(bothHome, ".agenticale"))).sort().join(",") === "preferences.md,routing.md", `setup both present: nothing new created in .agenticale after ${label}`);
    };
    const r20 = run("install.mjs", ["setup"], { env: bothEnv });
    check(r20.exit === 0, "setup both present: exits 0");
    check(r20.out.includes("left untouched"), "setup both present: reports preferences.md left untouched");
    check(!r20.out.includes("create nothing"), "setup both present: no legacy-only creation-suppressed line");
    check(r20.out.includes(`personal preferences file at ${bothPrefs}. Read the file`), "setup both present: the paste prompt targets the effective preferences.md");
    check(!r20.out.includes(bothLegacy), "setup both present: the output never names the ignored legacy path");
    await assertBothHome("real run");
    const r21 = run("install.mjs", ["setup", "--dry-run"], { env: bothEnv });
    check(r21.exit === 0, "setup both present --dry-run: exits 0");
    check(r21.out.includes("would leave untouched"), "setup both present --dry-run: would leave preferences.md untouched");
    check(!r21.out.includes("create nothing"), "setup both present --dry-run: no legacy-only creation-suppressed line");
    check(r21.out.includes(`personal preferences file at ${bothPrefs}. Read the file`), "setup both present --dry-run: the paste prompt targets the effective preferences.md");
    check(!r21.out.includes(bothLegacy), "setup both present --dry-run: the output never names the ignored legacy path");
    check(r21.out.includes("Dry run complete; no files were changed."), "setup both present --dry-run: no files changed message");
    await assertBothHome("dry-run");

    // D2: setup takes --target so the guidance names the packaged example
    // under the target the bundle was installed into (same default resolution
    // as install); without --target it still points at the default directory;
    // --dry-run + --target writes nothing. XDG_CONFIG_HOME is pinned so the
    // default directory is deterministic and distinct from the custom target.
    const fakeXDG = join(scratch, "e2-xdg");
    const customTarget = join(scratch, "e2-custom-target");
    const r7 = run("install.mjs", ["setup", "--target", customTarget, "--personal-path", join(scratch, "e2-t", "routing.md"), "--dry-run"], { env: { XDG_CONFIG_HOME: fakeXDG } });
    check(r7.exit === 0, "setup --target: exits 0");
    check(r7.out.includes(join(customTarget, "skills", "work", "references", "preferences.example.md")), "setup --target: guidance names the packaged example under the custom target");
    check(!r7.out.includes(fakeXDG), "setup --target: guidance does not reference the default configuration directory");
    const r8 = run("install.mjs", ["setup", "--personal-path", join(scratch, "e2-t2", "routing.md"), "--dry-run"], { env: { XDG_CONFIG_HOME: fakeXDG } });
    check(r8.exit === 0, "setup default target: exits 0");
    check(r8.out.includes(join(fakeXDG, "opencode", "skills", "work", "references", "preferences.example.md")), "setup default target: guidance names the packaged example under the default configuration directory");
    const dryCustom = join(scratch, "e2-dry-custom", "routing.md");
    const r9 = run("install.mjs", ["setup", "--target", customTarget, "--personal-path", dryCustom, "--dry-run"], { env: { XDG_CONFIG_HOME: fakeXDG } });
    check(r9.exit === 0 && r9.out.includes("Dry run complete; no files were changed."), "setup --target --dry-run: no files changed message");
    check(r9.out.includes(join(customTarget, "skills", "work", "references", "preferences.example.md")), "setup --target --dry-run: guidance still points at the custom target");
    check(!(await exists(dryCustom)), "setup --target --dry-run: absent personal file not created");
    check(!(await exists(dirname(dryCustom))), "setup --target --dry-run: parent directory not created");

    // The one-time post-install verification prompt: printed with the setup
    // guidance on the pasting-session line, and its text covers both helper
    // branches with the complete flags — the resolved/match comparison and
    // the interpretation-required resolve of the interpreted layers from a
    // temporary JSON file (never the Markdown), with the project preference
    // location checked via --root. Dry-run with a spaced target also pins
    // the single-quoted dynamic paths.
    const verifyXDG = join(scratch, "e2-verify-xdg");
    const verifyTarget = join(scratch, "e2-verify spaced target");
    const rv = run("install.mjs", ["setup", "--target", verifyTarget, "--personal-path", join(scratch, "e2-verify-personal", "routing.md"), "--dry-run"], { env: { XDG_CONFIG_HOME: verifyXDG } });
    check(rv.exit === 0, "setup verify prompt: dry-run exits 0");
    check(rv.out.includes("After editing, verify your routing by pasting this prompt into an OpenCode session: Verify my AgenticAle routing for the opencode runtime"), "setup verify prompt: the guidance line carries the prompt (same line, not a second print)");
    const verifyHelper = join(verifyTarget, "skills", "work", "scripts", "routing.mjs");
    check(rv.out.includes(`node '${verifyHelper}' startup --runtime opencode --root '`), "setup verify prompt: startup names the single-quoted helper path with --root (project location checked)");
    check(rv.out.includes("--root '<the project root of the session you are pasting this into: that working directory, or the directory containing its .agenticale folder; the home directory when there is no project>'"), "setup verify prompt: the --root placeholder is the session's project root with the home-directory fallback");
    check(rv.out.includes('if the result is the resolved policy, confirm every role in its agents output reports "match"'), "setup verify prompt: the resolved branch confirms every agents role reports match");
    check(rv.out.includes('if it reports "interpretation-required" because a preference file is present'), "setup verify prompt: the interpretation-required branch is named");
    check(rv.out.includes("read and interpret each listed preference file (a project file takes precedence over the personal file; any legacy file reported as ignored is never read)"), "setup verify prompt: project over personal, ignored legacy files never read");
    check(rv.out.includes("write the interpreted structured layers to a temporary JSON file as an array ordered lowest to highest precedence (personal first, then project)"), "setup verify prompt: interpreted layers go to a temporary JSON file, lowest to highest");
    check(rv.out.includes(`node '${verifyHelper}' resolve --runtime opencode --input '<that temporary JSON file>' --explain`), "setup verify prompt: resolve names the single-quoted helper path with --runtime opencode, the JSON --input, and --explain");
    check(rv.out.includes(`'${join(verifyTarget, "agents", "agenticale")}'`), "setup verify prompt: the agent profiles directory is single-quoted");
    check(rv.out.includes(`'${join(verifyTarget, "skills", "work", "references", "runtimes", "opencode.md")}'`), "setup verify prompt: the runtime binding path is single-quoted");

    // Arg shape: --personal-path is setup-only; install-only options are
    // rejected by setup; the --= form works.
    const bad1 = run("install.mjs", ["setup", "--no-model"]);
    check(bad1.exit === 1 && bad1.err.includes("apply only to install/uninstall, not setup."), "setup: install-only options rejected");
    const bad2 = run("install.mjs", ["install", "--target", join(scratch, "e2-x"), "--no-model", "--personal-path", join(scratch, "e2-x", "routing.md")]);
    check(bad2.exit === 1 && bad2.err.includes("--personal-path applies only to setup"), "install: --personal-path rejected");
    const bad3 = run("install.mjs", ["setup", "--personal-path"]);
    check(bad3.exit === 1 && bad3.err.includes("--personal-path requires a value"), "setup: --personal-path missing value");
    const eqPath = join(scratch, "e2-eq", "routing.md");
    const r6 = run("install.mjs", [`setup`, `--personal-path=${eqPath}`]);
    check(r6.exit === 0 && await exists(eqPath), "setup: --personal-path= form creates the scaffold");
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
    let review = await readFile(join(t, "agents", "agenticale", "review.md"), "utf8");
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
    check(updated.out.includes("migrate-remove: agents/agenticale/review.md") && updated.out.includes("backup created:"), "prep refresh: the update retires the old profiles under a backup");
    review = await readFile(join(t, "agents", "agenticale", "review.md"), "utf8");
    check(review.includes("model: acme/review-b"), "prep refresh: review profile now renders the requested model");
    check(await exists(join(t, "agents", "agenticale", "implement-hard.md")), "prep refresh: seven profiles retained with a distinct implement-hard");

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
    const fix = join(t, "agents", "agenticale", "fix.md");
    await writeFile(fix, "USER-EDITED-FIX\n", "utf8");
    const blockedMod = run("install.mjs", ["install", "--target", t, "--routing", pathB]);
    check(blockedMod.exit === 1 && blockedMod.err.includes("Differing content already exists at:"), "prep modified: a user-modified profile collides without --replace");
    check(blockedMod.err.includes("No changes were made."), "prep modified: the collision is reported before any mutation");
    let review = await readFile(join(t, "agents", "agenticale", "review.md"), "utf8");
    check(review.includes("model: acme/review-a"), "prep modified: the blocked update left the other profiles untouched");
    check((await readFile(fix, "utf8")) === "USER-EDITED-FIX\n", "prep modified: the user-modified profile is left in place");
    const replacedMod = run("install.mjs", ["install", "--target", t, "--routing", pathB, "--replace"]);
    check(replacedMod.exit === 0 && replacedMod.out.includes("preserve-modified: agents/agenticale/fix.md"), "prep modified: the user edit is reported as preserved");
    check(replacedMod.out.includes("backup created:"), "prep modified: --replace backs up the user edit before replacing");
    review = await readFile(join(t, "agents", "agenticale", "review.md"), "utf8");
    check(review.includes("model: acme/review-b"), "prep modified: --replace applies the new policy to the unmodified profiles");
    check((await readFile(fix, "utf8")) !== "USER-EDITED-FIX\n" && (await readFile(fix, "utf8")).includes("model: acme/fix-b"), "prep modified: --replace backs up and replaces the modified profile with the new policy");
  }

  console.log(`Installer tests passed: ${assertions} assertions.`);
} finally {
  await rm(scratch, { recursive: true, force: true });
}
