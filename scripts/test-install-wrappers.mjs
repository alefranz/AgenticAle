// Tests the POSIX shell install wrapper (scripts/install.sh) against a local
// HTTP fixture that emulates the GitHub release surface, so no network access
// is required. The wrapper resolves the latest tag via the /releases/latest
// redirect, downloads the tag archive, and delegates to scripts/install.mjs
// from the extracted tree. In these tests that entry point is a stub that
// records its argv to a file (and handles a `setup` argv), so the assertions
// verify the wrapper's resolution, download, layout check, option forwarding,
// consent handling, and exit-code propagation without running a real install.
//
// The wrapper is spawned as `/bin/sh scripts/install.sh` (dash in this
// environment; /bin/sh is used by absolute path so a case that empties the
// child PATH can still start the shell).
//
// This harness uses async child_process.spawn on purpose: the fixture server
// runs in-process, and spawnSync would block the event loop the server needs
// to answer the wrapper's curl calls (a guaranteed deadlock).
import { spawn } from "node:child_process";
import { mkdtemp, rm, mkdir, writeFile, readFile, readdir, chmod } from "node:fs/promises";
import http from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repo = resolve(import.meta.dirname, "..");
const scriptsDir = join(repo, "scripts");
const wrapperPath = join(scriptsDir, "install.sh");
const SH = "/bin/sh";
const OWNER_REPO = "/alefranz/AgenticAle";
const TAG = "v9.9.9";

const scratch = await mkdtemp(join(tmpdir(), "install-wrappers-test-"));
let assertions = 0;
function check(cond, label) {
  if (!cond) throw new Error(`Assertion failed: ${label}`);
  assertions += 1;
}

function run(command, args, { cwd = scratch, env, input, timeoutMs = 90000, keepStdin = false } = {}) {
  return new Promise((resolveRun) => {
    const child = spawn(command, args, { cwd, env: env ?? process.env, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    child.stdout.on("data", (d) => { stdout += d; });
    child.stderr.on("data", (d) => { stderr += d; });
    if (keepStdin) {
      // Leave stdin open (and write nothing): a process that waits for input
      // blocks and trips the timeout, proving it was waiting for input.
    } else {
      if (input !== undefined) child.stdin.write(input);
      child.stdin.end();
    }
    child.on("error", (error) => { clearTimeout(timer); resolveRun({ error, exit: null, timedOut, stdout, stderr }); });
    child.on("close", (code) => { clearTimeout(timer); resolveRun({ exit: code, timedOut, stdout, stderr }); });
  });
}

// The stub installer that stands in for the real scripts/install.mjs inside
// the fixture archive. It records its argv (one JSON line per invocation) and
// exits 0, or an exit code forced by env for failure-propagation tests.
const STUB_INSTALLER = [
  'import { appendFileSync } from "node:fs";',
  "const args = process.argv.slice(2);",
  'appendFileSync(process.env.AGENTICALE_STUB_RECORD ?? "stub-record.jsonl", JSON.stringify(args) + "\\n");',
  'if (args[0] === "setup") {',
  '  console.log("stub: routing setup complete");',
  '  process.exit(Number(process.env.AGENTICALE_STUB_SETUP_EXIT ?? "0"));',
  "}",
  'console.log("stub: install complete");',
  'process.exit(Number(process.env.AGENTICALE_STUB_EXIT ?? "0"));',
  "",
].join("\n");

// Build the fixture archive: a single top-level AgenticAle-<tag> directory
// (the layout GitHub produces) containing only the stub installer.
async function buildFixtureArchive(dir) {
  const top = join(dir, `AgenticAle-${TAG}`);
  await mkdir(join(top, "scripts"), { recursive: true });
  await writeFile(join(top, "scripts", "install.mjs"), STUB_INSTALLER, "utf8");
  const archivePath = join(dir, `${TAG}.tar.gz`);
  const r = await run("tar", ["-czf", archivePath, "-C", dir, `AgenticAle-${TAG}`], { cwd: dir });
  if (r.exit !== 0) throw new Error(`fixture tarball creation failed: ${r.stderr}`);
  return readFile(archivePath);
}

// Emulate the GitHub surface under a base url: /releases/latest redirects to
// /releases/tag/<tag> (or to latestLocation, or answers a plain 200 when
// latestBehavior is "plain"), and /archive/refs/tags/<name>.tar.gz serves the
// configured archive (a Buffer; may be a non-tarball for corruption tests).
function startFixtureServer({ latestTag, archives, requests, latestBehavior = "redirect", latestLocation = null }) {
  const server = http.createServer((req, res) => {
    requests.push(`${req.method} ${req.url}`);
    const url = req.url.split("?")[0];
    if (url === `${OWNER_REPO}/releases/latest`) {
      if (latestBehavior === "redirect") {
        res.writeHead(302, { Location: latestLocation === null ? `${OWNER_REPO}/releases/tag/${latestTag}` : latestLocation });
        res.end();
      } else {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<html>release page (no redirect)</html>");
      }
      return;
    }
    if (url === `${OWNER_REPO}/releases/tag/${latestTag}`) {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<html>release page</html>");
      return;
    }
    const prefix = `${OWNER_REPO}/archive/refs/tags/`;
    if (url.startsWith(prefix) && url.endsWith(".tar.gz")) {
      const name = url.slice(prefix.length, url.length - ".tar.gz".length);
      if (archives[name] !== undefined) {
        res.writeHead(200, { "Content-Type": "application/gzip" });
        res.end(archives[name]);
        return;
      }
    }
    res.writeHead(404, { "Content-Type": "text/html" });
    res.end("<html>404 not found</html>");
  });
  server.keepAliveTimeout = 100;
  return new Promise((resolveServer) => {
    server.listen(0, "127.0.0.1", () => {
      resolveServer({
        baseUrl: `http://127.0.0.1:${server.address().port}${OWNER_REPO}`,
        close: async () => {
          if (typeof server.closeAllConnections === "function") server.closeAllConnections();
          await new Promise((done) => server.close(done));
        },
      });
    });
  });
}

// Wrapper environment: an isolated TMPDIR (so leftover temp dirs are
// attributable) and the stub record file. Inherited values of the wrapper's
// own controls are removed so a host environment cannot skew a case.
function buildWrapperEnv(caseDir, recordPath, extra = {}) {
  const wrapperEnv = { ...process.env };
  for (const key of ["TMPDIR", "AGENTICALE_BASE_URL", "AGENTICALE_INSTALL_CONSENT", "AGENTICALE_STUB_RECORD", "AGENTICALE_STUB_EXIT", "AGENTICALE_STUB_SETUP_EXIT"]) {
    delete wrapperEnv[key];
  }
  Object.assign(wrapperEnv, { TMPDIR: join(caseDir, "tmp"), AGENTICALE_STUB_RECORD: recordPath, ...extra });
  return wrapperEnv;
}

async function readCase(caseDir, recordPath, result) {
  let record = [];
  try {
    const text = await readFile(recordPath, "utf8");
    record = text.split("\n").filter((line) => line.trim() !== "").map((line) => JSON.parse(line));
  } catch {
    // no record: the stub never ran
  }
  let cwdEntries = [];
  try {
    cwdEntries = await readdir(caseDir);
  } catch {
    // case dir absent: nothing was left behind in the caller's cwd either
  }
  let tmpEntries = [];
  try {
    // The isolated temp root (TMPDIR for this case): a leaked extraction
    // directory lands here, not in the caller's cwd.
    tmpEntries = await readdir(join(caseDir, "tmp"));
  } catch {
    // temp root absent: nothing was left behind in the isolated temp dir
  }
  return { record, cwdEntries, tmpEntries, ...result };
}

// Run the wrapper as `/bin/sh <wrapper> ...` with cwd = caseDir, so any file
// the wrapper leaves in the caller's working directory is observable there.
async function runCase(name, { args, env = {}, input } = {}) {
  const caseDir = join(scratch, name);
  await mkdir(join(caseDir, "tmp"), { recursive: true });
  const recordPath = join(scratch, "records", `${name}.jsonl`);
  const wrapperEnv = buildWrapperEnv(caseDir, recordPath, env);
  const result = await run(SH, [wrapperPath, ...args], { cwd: caseDir, env: wrapperEnv, input });
  return readCase(caseDir, recordPath, result);
}

// The shellQuote/runTtyCase pair drives the wrapper through script(1), which
// gives it a real PTY so the interactive consent prompt path is exercised.
const shellQuote = (value) => `'${value.replace(/'/g, `'\\''`)}'`;
let scriptBin = "";
async function runTtyCase(name, { args, env = {}, input = "", timeoutMs, keepStdin } = {}) {
  const caseDir = join(scratch, `tty-${name}`);
  await mkdir(join(caseDir, "tmp"), { recursive: true });
  const recordPath = join(scratch, "records", `tty-${name}.jsonl`);
  const wrapperEnv = buildWrapperEnv(caseDir, recordPath, env);
  const commandString = [SH, wrapperPath, ...args].map(shellQuote).join(" ");
  const result = await run(scriptBin, ["-qec", commandString, "/dev/null"], { cwd: caseDir, env: wrapperEnv, input, timeoutMs, keepStdin });
  return readCase(caseDir, recordPath, result);
}

// Run the wrapper the way the documented pinning one-liner does —
// `curl <url> | sh -s -- <args>`: the wrapper's bytes arrive on stdin and the
// arguments after `--` become its positional parameters (verified in dash and
// bash: with `-s` the shell name stays $0 and the operands fill $1..$n, so
// the wrapper's own parser receives them verbatim).
async function runStdinCase(name, { args, env = {} } = {}) {
  const caseDir = join(scratch, name);
  await mkdir(join(caseDir, "tmp"), { recursive: true });
  const recordPath = join(scratch, "records", `${name}.jsonl`);
  const wrapperEnv = buildWrapperEnv(caseDir, recordPath, env);
  const script = await readFile(wrapperPath, "utf8");
  const result = await run(SH, ["-s", "--", ...args], { cwd: caseDir, env: wrapperEnv, input: script });
  return readCase(caseDir, recordPath, result);
}

// Every fixture server is registered here and closed in the final finally, so
// an assertion failure cannot leave a server holding the harness open.
const fixtures = [];
try {
  await mkdir(join(scratch, "records"), { recursive: true });

  // --- The wrapper parses under dash ----------------------------------------
  {
    const r = await run(SH, ["-n", wrapperPath]);
    check(r.exit === 0, "sh -n: the wrapper parses cleanly under dash");
  }

  // --- Help -------------------------------------------------------------------
  {
    const r = await run(SH, [wrapperPath, "--help"]);
    check(r.exit === 0, "--help: exits 0");
    check(r.stdout.includes("Usage:"), "--help: prints usage");
    const h = await run(SH, [wrapperPath, "-h"]);
    check(h.exit === 0 && h.stdout.includes("Usage:"), "-h: aliases --help");
  }

  // --- Fixture ----------------------------------------------------------------
  const archiveSrc = join(scratch, "archive-src");
  await mkdir(archiveSrc, { recursive: true });
  const archive = await buildFixtureArchive(archiveSrc);
  const requests = [];
  const fixture = await startFixtureServer({ latestTag: TAG, archives: { [TAG]: archive }, requests });
  fixtures.push(fixture);
  const baseArgs = ["--base-url", fixture.baseUrl];

  // --- Latest-tag resolution ----------------------------------------------------
  {
    const before = requests.length;
    const r = await runCase("latest", { args: [...baseArgs, "--dry-run", "--target", join(scratch, "t-latest")] });
    const delta = requests.slice(before);
    check(r.exit === 0 && !r.timedOut, "latest: the wrapper exits 0");
    check(r.stdout.includes(`AgenticAle ${TAG} (latest release)`), "latest: the resolved tag is printed before the download");
    check(delta.some((q) => q.includes(`${OWNER_REPO}/releases/latest`)), "latest: /releases/latest was requested");
    check(delta.some((q) => q === `GET ${OWNER_REPO}/archive/refs/tags/${TAG}.tar.gz`), "latest: the tag archive was downloaded");
    check(r.record.length === 1 && JSON.stringify(r.record[0]) === JSON.stringify(["--target", join(scratch, "t-latest"), "--dry-run", "--no-model"]), "latest: the stub received the forwarded args with the default --no-model appended");
    check(!r.record.some((line) => line[0] === "setup"), "latest: the setup step did not run");
    check(r.cwdEntries.length === 1 && r.cwdEntries[0] === "tmp", "latest: nothing was left in the caller's working directory");
    check(r.tmpEntries.length === 0, "latest: the isolated temp root is empty after the run");
  }

  // --- Latest-tag redirect validation (F2) -----------------------------------
  {
    // (a) /releases/latest redirecting to an unrelated path (/login) must fail
    // before any download. The archive the bogus tag would name is served, so
    // a wrapper that accepted it would "install" tag login and succeed.
    const requestsLogin = [];
    const fixtureLogin = await startFixtureServer({ latestTag: TAG, archives: { login: archive }, requests: requestsLogin, latestLocation: `${OWNER_REPO}/login` });
    fixtures.push(fixtureLogin);
    const before = requestsLogin.length;
    const r = await runCase("latest-redirect-login", { args: ["--base-url", fixtureLogin.baseUrl, "--no-model"] });
    const delta = requestsLogin.slice(before);
    check(r.exit !== 0 && !r.timedOut, "bad redirect: a /releases/latest redirect to an unrelated path fails with a non-zero exit");
    check(r.stderr.includes("Could not resolve the latest release"), "bad redirect: the failure is reported as an unresolvable latest release");
    check(delta.some((q) => q.includes(`${OWNER_REPO}/releases/latest`)), "bad redirect: /releases/latest was requested");
    check(!delta.some((q) => q.includes(`${OWNER_REPO}/archive/`)), "bad redirect: no archive download was attempted");
    check(r.record.length === 0, "bad redirect: the installer was not invoked with a bogus tag");
  }
  {
    // (a2) /releases/latest redirecting to a nested path under the tag prefix
    // (/releases/tag/unrelated/v9.9.9) must fail pre-download: the entire
    // suffix after /releases/tag/ must itself be the tag, with nothing after
    // it. The archive the nested path's last segment would name is served, so
    // a wrapper that accepted the redirect would "install" tag v9.9.9.
    const requestsNested = [];
    const fixtureNested = await startFixtureServer({ latestTag: TAG, archives: { [TAG]: archive }, requests: requestsNested, latestLocation: `${OWNER_REPO}/releases/tag/unrelated/${TAG}` });
    fixtures.push(fixtureNested);
    const before = requestsNested.length;
    const r = await runCase("latest-redirect-nested", { args: ["--base-url", fixtureNested.baseUrl, "--no-model"] });
    const delta = requestsNested.slice(before);
    check(r.exit !== 0 && !r.timedOut, "nested redirect: a /releases/latest redirect to a nested path under the tag prefix fails with a non-zero exit");
    check(r.stderr.includes("Could not resolve the latest release"), "nested redirect: the failure is reported as an unresolvable latest release");
    check(delta.some((q) => q.includes(`${OWNER_REPO}/releases/latest`)), "nested redirect: /releases/latest was requested");
    check(!delta.some((q) => q.includes(`${OWNER_REPO}/archive/`)), "nested redirect: no archive download was attempted");
    check(r.record.length === 0, "nested redirect: the installer was not invoked with the nested tag");
  }
  {
    // (b) /releases/latest answering a plain 200 without redirecting must fail
    // before any download.
    const requestsPlain = [];
    const fixturePlain = await startFixtureServer({ latestTag: TAG, archives: { [TAG]: archive }, requests: requestsPlain, latestBehavior: "plain" });
    fixtures.push(fixturePlain);
    const before = requestsPlain.length;
    const r = await runCase("latest-plain", { args: ["--base-url", fixturePlain.baseUrl, "--no-model"] });
    const delta = requestsPlain.slice(before);
    check(r.exit !== 0 && !r.timedOut, "no redirect: a non-redirecting /releases/latest fails with a non-zero exit");
    check(r.stderr.includes("Could not resolve the latest release"), "no redirect: the failure is reported as an unresolvable latest release");
    check(!delta.some((q) => q.includes(`${OWNER_REPO}/archive/`)), "no redirect: no archive download was attempted");
    check(r.record.length === 0, "no redirect: the installer was not invoked");
  }
  {
    // A redirect to a different host must fail even when the path shape is a
    // valid /releases/tag/<tag>, because the tag must come from the base host.
    const other = await startFixtureServer({ latestTag: TAG, archives: {}, requests: [] });
    fixtures.push(other);
    const requestsCross = [];
    const fixtureCross = await startFixtureServer({ latestTag: TAG, archives: {}, requests: requestsCross, latestLocation: `${other.baseUrl}/releases/tag/${TAG}` });
    fixtures.push(fixtureCross);
    const before = requestsCross.length;
    const r = await runCase("latest-cross-host", { args: ["--base-url", fixtureCross.baseUrl, "--no-model"] });
    const delta = requestsCross.slice(before);
    check(r.exit !== 0 && !r.timedOut, "cross-host redirect: a redirect to a different host fails with a non-zero exit");
    check(r.stderr.includes("Could not resolve the latest release"), "cross-host redirect: the failure is reported as an unresolvable latest release");
    check(!delta.some((q) => q.includes(`${OWNER_REPO}/archive/`)), "cross-host redirect: no archive download was attempted on the base host");
    check(r.record.length === 0, "cross-host redirect: the installer was not invoked");
  }
  // (c) A valid /releases/tag/<tag> redirect still works: covered by the
  // "latest" case above (tag resolution, download, and delegation all succeed).

  // --- --version pin skips resolution -------------------------------------------
  {
    const before = requests.length;
    const r = await runCase("pinned", { args: [...baseArgs, "--version", TAG, "--no-model", "--target", join(scratch, "t-pinned")] });
    const delta = requests.slice(before);
    check(r.exit === 0 && !r.timedOut, "pinned: the wrapper exits 0");
    check(r.stdout.includes(`AgenticAle ${TAG} (pinned release)`), "pinned: the pinned tag is printed");
    check(!delta.some((q) => q.includes("/releases/latest")), "pinned: latest-tag resolution was skipped");
    check(r.record.length === 1 && JSON.stringify(r.record[0]) === JSON.stringify(["--target", join(scratch, "t-pinned"), "--no-model"]), "pinned: the stub received the forwarded args");
  }

  // --- Documented pinning one-liner: wrapper from stdin, pin after `--` ---------
  {
    // D1 regression: the documented form is
    // `curl <url> | sh -s -- --version TAG`. Spawn sh exactly that way
    // (wrapper bytes on stdin, the pinning args after `--`) against a fixture
    // whose /releases/latest would resolve a DIFFERENT tag with no served
    // archive: if the pinning argument did not survive the stdin hand-off to
    // the wrapper's parser, the wrapper would request /releases/latest (or
    // fail), and the pinned archive would not be downloaded. --version is a
    // wrapper option (tag resolution), not a forwarded installer option, so
    // the stub records the install argv without it.
    const requestsPinned = [];
    const fixturePinned = await startFixtureServer({ latestTag: TAG, archives: { "v0.17.0": archive }, requests: requestsPinned });
    fixtures.push(fixturePinned);
    const before = requestsPinned.length;
    const r = await runStdinCase("pinned-stdin", { args: ["--base-url", fixturePinned.baseUrl, "--version", "v0.17.0", "--no-model"] });
    const delta = requestsPinned.slice(before);
    check(r.exit === 0 && !r.timedOut, "stdin pin: the documented `sh -s -- --version TAG` form exits 0");
    check(r.stdout.includes("AgenticAle v0.17.0 (pinned release)"), "stdin pin: the pinning argument reached the wrapper's parser verbatim (the pinned tag is printed)");
    check(!delta.some((q) => q.includes("/releases/latest")), "stdin pin: no latest-resolution request was made");
    check(delta.some((q) => q === `GET ${OWNER_REPO}/archive/refs/tags/v0.17.0.tar.gz`), "stdin pin: the pinned release archive was downloaded");
    check(r.record.length === 1 && JSON.stringify(r.record[0]) === JSON.stringify(["--no-model"]), "stdin pin: the stub installer received the forwarded install argv");
    check(r.cwdEntries.length === 1 && r.cwdEntries[0] === "tmp", "stdin pin: nothing was left in the caller's working directory");
    check(r.tmpEntries.length === 0, "stdin pin: the isolated temp root is empty after the run");
  }

  // --- Wrapper option forms -------------------------------------------------------
  {
    const r = await runCase("version-eq", { args: [...baseArgs, `--version=${TAG}`, "--target", join(scratch, "t-veq")] });
    check(r.exit === 0, "--version=TAG: the equals form is accepted");
    check(r.stdout.includes(`AgenticAle ${TAG} (pinned release)`), "--version=TAG: the pin is honored");
  }
  {
    const r = await runCase("env-base-url", { args: ["--target", join(scratch, "t-eb")], env: { AGENTICALE_BASE_URL: fixture.baseUrl } });
    check(r.exit === 0 && r.stdout.includes(`AgenticAle ${TAG} (latest release)`), "AGENTICALE_BASE_URL: the environment variable supplies the base url");
  }

  // --- Prerequisites -----------------------------------------------------------------
  {
    const r = await runCase("no-node", { args: [...baseArgs, "--no-model"], env: { PATH: "/nonexistent" } });
    check(r.exit !== 0 && !r.timedOut, "no-node: a PATH without node fails with a non-zero exit");
    check(r.stderr.includes("Node.js is required"), "no-node: the error names the missing prerequisite");
    check(r.record.length === 0, "no-node: the installer was not invoked");
  }
  {
    const binDir = join(scratch, "old-node-bin");
    await mkdir(binDir, { recursive: true });
    await writeFile(join(binDir, "node"), "#!/bin/sh\nprintf 'v18.19.0\\n'\n", "utf8");
    await chmod(join(binDir, "node"), 0o755);
    const r = await run(SH, [wrapperPath, "--dry-run"], { env: { ...process.env, PATH: `${binDir}:${process.env.PATH}` } });
    check(r.exit !== 0, "node floor: a node older than 20 is rejected");
    check(r.stderr.includes("Node.js 20 or later"), "node floor: the error states the required version");
  }

  // --- Corrupt (non-tarball) download --------------------------------------------------
  {
    const corrupt = Buffer.from("<html><body>404 Not Found</body></html>");
    const fixture2 = await startFixtureServer({ latestTag: TAG, archives: { [TAG]: corrupt }, requests: [] });
    fixtures.push(fixture2);
    const r = await runCase("corrupt", { args: ["--base-url", fixture2.baseUrl, "--no-model"] });
    check(r.exit !== 0 && !r.timedOut, "corrupt: a non-tarball download fails with a non-zero exit");
    check(r.stderr.includes("not a readable gzip tarball"), "corrupt: the error identifies the bad archive");
    check(r.record.length === 0, "corrupt: the installer was not invoked");
    check(r.cwdEntries.length === 1 && r.cwdEntries[0] === "tmp", "corrupt: the temp dir was cleaned up");
    check(r.tmpEntries.length === 0, "corrupt: the isolated temp root is empty after the run");
  }

  // --- Option forwarding -----------------------------------------------------------------
  {
    const spaced = join(scratch, "has space", "repo");
    await mkdir(spaced, { recursive: true });
    const t = join(scratch, "t-spaced");
    const r = await runCase("spaced", { args: [...baseArgs, "--source-root", spaced, "--models", "example", "--effort", "high", "--replace", "--target", t] });
    check(r.exit === 0 && !r.timedOut, "spaced: the wrapper exits 0");
    check(r.record.length === 1 && JSON.stringify(r.record[0]) === JSON.stringify(["--models", "example", "--effort", "high", "--source-root", spaced, "--target", t, "--replace"]), "spaced: a spaced --source-root survives as a single discrete word among the forwarded options");
    check(!r.record[0].includes("--no-model"), "spaced: --no-model is absent when --models was given");
  }
  {
    const routingFile = join(scratch, "routing-fixture.json");
    await writeFile(routingFile, "{}\n", "utf8");
    const t = join(scratch, "t-routing");
    const r = await runCase("routing", { args: [...baseArgs, "--routing", routingFile, "--target", t] });
    check(r.record.length === 1 && JSON.stringify(r.record[0]) === JSON.stringify(["--routing", routingFile, "--target", t]), "routing: --routing is forwarded and --no-model is not appended");
    check(!r.record[0].includes("--no-model"), "routing: the default routing selection is not added on top of --routing");
  }

  // --- --dry-run ---------------------------------------------------------------------
  {
    const r = await runCase("dry-run", { args: [...baseArgs, "--dry-run", "--target", join(scratch, "t-dry")] });
    check(r.exit === 0 && !r.timedOut, "dry-run: the wrapper exits 0");
    check(r.record.length === 1 && r.record[0].includes("--dry-run"), "dry-run: the flag is forwarded to the installer");
    check(!r.record.some((line) => line[0] === "setup"), "dry-run: the setup step did not run");
    check(!r.stdout.includes("Tip:"), "dry-run: no setup tip is printed");
    check(r.cwdEntries.length === 1 && r.cwdEntries[0] === "tmp", "dry-run: nothing was left in the caller's working directory");
    check(r.tmpEntries.length === 0, "dry-run: the isolated temp root is empty after the run");
  }

  // --- --setup (non-TTY) ---------------------------------------------------------------
  {
    const tSetup = join(scratch, "t-setup");
    const r = await runCase("setup", { args: [...baseArgs, "--setup", "--target", tSetup] });
    check(r.exit === 0 && !r.timedOut, "setup: the wrapper exits 0");
    check(r.record.length === 2, "setup: two installer invocations (install, then setup)");
    check(JSON.stringify(r.record[1]) === JSON.stringify(["setup", "--target", tSetup]), "setup: an explicit --target is forwarded to the setup step so its guidance points at the installed target");
  }
  {
    // With no --target, the setup step must receive NO --target at all: setup
    // then resolves the same default directory the install used.
    const r = await runCase("setup-default-target", { args: [...baseArgs, "--setup"] });
    check(r.exit === 0 && !r.timedOut, "setup without --target: the wrapper exits 0");
    check(r.record.length === 2, "setup without --target: two installer invocations (install, then setup)");
    check(JSON.stringify(r.record[1]) === JSON.stringify(["setup"]), "setup without --target: the setup argv carries no --target");
    check(!JSON.stringify(r.record).includes("--target"), "setup without --target: no --target appears in any recorded invocation");
  }

  // --- Non-TTY without --setup -----------------------------------------------------------
  {
    const r = await runCase("non-tty", { args: [...baseArgs, "--target", join(scratch, "t-nt")] });
    check(r.exit === 0 && !r.timedOut, "non-tty: the wrapper does not hang without a TTY");
    check(r.record.length === 1 && !r.record.some((line) => line[0] === "setup"), "non-tty: the install ran and setup was skipped");
    check(r.stdout.includes("Tip: run with --setup"), "non-tty: a one-line tip mentions --setup");
  }

  // --- Exit-code propagation ------------------------------------------------------------
  {
    const r = await runCase("install-fail", { args: [...baseArgs, "--setup", "--target", join(scratch, "t-if")], env: { AGENTICALE_STUB_EXIT: "3" } });
    check(r.exit === 3, "install failure: the installer exit code (3) is propagated");
    check(r.record.length === 1 && !r.record.some((line) => line[0] === "setup"), "install failure: the setup step did not run after a failed install");
    check(r.cwdEntries.length === 1 && r.cwdEntries[0] === "tmp", "install failure: the temp dir was still cleaned up");
    check(r.tmpEntries.length === 0, "install failure: the isolated temp root is empty after the run");
  }
  {
    const r = await runCase("setup-fail", { args: [...baseArgs, "--setup", "--target", join(scratch, "t-sf")], env: { AGENTICALE_STUB_SETUP_EXIT: "7" } });
    check(r.exit === 7, "setup failure: the setup exit code (7) is propagated after a successful install");
    check(r.stdout.includes("stub: install complete"), "setup failure: the install itself succeeded");
    check(r.stderr.includes("routing setup step failed"), "setup failure: the setup failure is reported clearly");
    check(r.cwdEntries.length === 1 && r.cwdEntries[0] === "tmp", "setup failure: the temp dir was cleaned up");
    check(r.tmpEntries.length === 0, "setup failure: the isolated temp root is empty after the run");
  }

  // --- Rejection of unknown input ----------------------------------------------------------
  {
    const r = await runCase("unknown-opt", { args: [...baseArgs, "--frobnicate"] });
    check(r.exit !== 0 && r.stderr.includes("--frobnicate"), "unknown option: rejected with a non-zero exit and named");
    const p = await runCase("unexpected-arg", { args: [...baseArgs, "bogus-positional"] });
    check(p.exit !== 0 && p.stderr.includes("bogus-positional"), "unexpected positional argument: rejected and named");
    const m = await runCase("missing-value", { args: [...baseArgs, "--models"] });
    check(m.exit !== 0 && m.stderr.includes("--models"), "forwarded option missing its value: rejected");
  }

  // --- TTY consent prompt (via script(1), which provides a real PTY) ---------------------------
  const probe = await run(SH, ["-c", "command -v script"]);
  scriptBin = (probe.stdout || "").trim();
  if (scriptBin !== "") {
    {
      const r = await runTtyCase("yes", { args: [...baseArgs, "--target", join(scratch, "t-ty-y")], input: "y\n" });
      check(r.exit === 0 && !r.timedOut, "tty y: the wrapper exits 0 on a TTY");
      check(r.record.some((line) => line[0] === "setup"), "tty y: answering y runs the setup step");
    }
    {
      const r = await runTtyCase("no", { args: [...baseArgs, "--target", join(scratch, "t-ty-n")], input: "n\n" });
      check(!r.record.some((line) => line[0] === "setup"), "tty n: answering n skips the setup step");
    }
    {
      const r = await runTtyCase("default", { args: [...baseArgs, "--target", join(scratch, "t-ty-d")], input: "\n" });
      check(!r.record.some((line) => line[0] === "setup"), "tty default: an empty answer defaults to no");
    }
    {
      const r = await runTtyCase("consent-yes", { args: [...baseArgs, "--target", join(scratch, "t-ty-cy")], input: "\n", env: { AGENTICALE_INSTALL_CONSENT: "yes" } });
      check(r.record.some((line) => line[0] === "setup"), "consent seam: AGENTICALE_INSTALL_CONSENT=yes consents where the prompt would occur");
    }
    {
      const r = await runTtyCase("consent-no", { args: [...baseArgs, "--target", join(scratch, "t-ty-cn")], input: "\n", env: { AGENTICALE_INSTALL_CONSENT: "no" } });
      check(!r.record.some((line) => line[0] === "setup"), "consent seam: AGENTICALE_INSTALL_CONSENT=no declines where the prompt would occur");
    }
    {
      // F1 regression: a failing install on a TTY must return the installer's
      // exit code promptly and never present the consent prompt. stdin is kept
      // open with no input ever written: a wrapper that prompts (and blocks
      // on read) cannot exit and trips the timeout.
      const r = await runTtyCase("install-fail", { args: [...baseArgs, "--target", join(scratch, "t-ty-if")], env: { AGENTICALE_STUB_EXIT: "5" }, keepStdin: true, timeoutMs: 20000 });
      check(r.exit === 5 && !r.timedOut, "tty install failure: the failing installer's exit code (5) is returned promptly with no consent input ever written");
      check(!r.stdout.includes("Create a personal routing customization file"), "tty install failure: no consent prompt was presented after a failed install");
      check(r.record.length === 1 && !r.record.some((line) => line[0] === "setup"), "tty install failure: the stub was never invoked with a setup argv");
    }
  } else {
    console.log("note: script(1) is not available; the TTY prompt path was not exercised.");
  }

  console.log(`Install wrapper tests passed: ${assertions} assertions.`);
} finally {
  await Promise.allSettled(fixtures.map((f) => f.close()));
  await rm(scratch, { recursive: true, force: true });
}
