#!/usr/bin/env node
// Deterministic unit tests for the work skill's session usage stats helper
// (skills/work/scripts/session-stats.mjs): the session tree walk across
// paginated child listings, empty-page termination (empty and null data),
// the cycle guard, depth recording, normalization of null/missing fields,
// totals (reasoning excluded from total), the per-provider grouping,
// duration and number formatting, and table rendering. These never touch
// the real OpenCode server; pass --live to additionally exercise the CLI
// against the running server for the calling session (OPENCODE_SESSION_ID).

import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";
import {
  StatsError,
  UsageError,
  buildReport,
  byProvider,
  collect,
  displayOrder,
  formatCost,
  formatDuration,
  formatTokens,
  normalizeSession,
  parseArgs,
  renderReport,
  renderTable,
  sessionDuration,
  sessionTotal,
  totals,
  truncateTitle,
} from "../skills/work/scripts/session-stats.mjs";

const repository = resolve(import.meta.dirname, "..");
const modulePath = join(repository, "skills", "work", "scripts", "session-stats.mjs");
let assertions = 0;

function check(condition, label) {
  assert.ok(condition, label);
  assertions += 1;
}

// Runs `fn` and requires a StatsError whose message contains every needle.
function checkError(fn, label, needles = []) {
  let thrown = null;
  try {
    fn();
  } catch (error) {
    thrown = error;
  }
  check(
    thrown instanceof StatsError,
    `${label} rejects with StatsError (got: ${thrown ? `${thrown.name}: ${thrown.message}` : "no error"})`,
  );
  if (!(thrown instanceof StatsError)) return;
  for (const needle of needles) {
    check(thrown.message.includes(needle), `${label} error identifies '${needle}'`);
  }
}

// A raw API session fixture with the fields the helper consumes.
function fixture(id, overrides = {}) {
  return {
    id,
    parentID: "ses_parent",
    agent: "agent",
    model: { id: "model", providerID: "prov", variant: "high" },
    cost: 0.5,
    tokens: { input: 10, output: 20, reasoning: 5, cache: { read: 1, write: 2 } },
    time: { created: 1000, updated: 2000 },
    title: "task",
    ...overrides,
  };
}

// A paginated child-listing server: a map of parentID to a sequence of raw
// pages, each { data, next } in the shape of a session.list response.
// Records every call so page counts and cursor values are observable.
function listingServer(pagesByParent) {
  const calls = [];
  const fetchChildPage = (parentID, cursor) => {
    calls.push({ parentID, cursor });
    const sequence = pagesByParent[parentID] ?? [];
    const index = cursor === null ? 0 : Number(cursor);
    const page = sequence[index] ?? { data: null, next: null };
    return { data: page.data, cursor: { previous: null, next: page.next ?? null } };
  };
  return { fetchChildPage, calls };
}

  // --- Tree walk across multiple cursor pages. ---
  const walkRoot = fixture("ses_walk_root", { parentID: undefined, time: { created: 100, updated: 9000 } });
  const walkA = fixture("ses_walk_a", { time: { created: 200, updated: 3000 } });
  const walkB = fixture("ses_walk_b", { time: { created: 150, updated: 2500 } });
  const walkC = fixture("ses_walk_c", { time: { created: 250, updated: 2800 } });
  const walkD = fixture("ses_walk_d", { time: { created: 260, updated: 2900 } });
  const walkServer = listingServer({
    ses_walk_root: [{ data: [walkA, walkB], next: "1" }, { data: [walkC], next: null }],
    ses_walk_a: [{ data: [walkD], next: null }],
    ses_walk_b: [{ data: [], next: null }],
    ses_walk_c: [{ data: null, next: "1" }],
  });
  const walkSessions = collect(walkRoot, walkServer.fetchChildPage);
  check(walkSessions.length === 5, "tree walk collects the root and all four nested children");
  const walkByID = Object.fromEntries(walkSessions.map((session) => [session.id, session]));
  check(walkByID.ses_walk_a.depth === 1 && walkByID.ses_walk_c.depth === 1, "direct children are recorded at depth 1");
  check(walkByID.ses_walk_d.depth === 2, "a grandchild is recorded at depth 2");
  check(walkByID.ses_walk_d.parentID === "ses_walk_a", "the grandchild records its actual parent");
  check(walkByID.ses_walk_a.parentID === "ses_walk_root", "a child records the root as its parent");
  check(walkServer.calls.some((call) => call.parentID === "ses_walk_root" && call.cursor === "1"), "cursor.next is followed to the second page");
  check(
    walkServer.calls.filter((call) => call.parentID === "ses_walk_c").length === 1,
    "a null-data page stops the walk even when cursor.next is non-null",
  );

  // --- Empty-page termination: empty data and null data both end the walk;
  // an empty page with a non-null cursor.next is the last page. ---
  const stopRoot = fixture("ses_stop_root", { parentID: undefined });
  const stopChild = fixture("ses_stop_child", { parentID: "ses_stop_root" });
  const stopServer = listingServer({
    ses_stop_root: [{ data: [stopChild], next: "1" }, { data: [], next: "2" }],
    ses_stop_child: [{ data: null, next: "1" }],
  });
  const stopSessions = collect(stopRoot, stopServer.fetchChildPage);
  check(stopSessions.length === 2, "an empty-data page with a non-null cursor.next terminates the walk");
  check(
    stopServer.calls.filter((call) => call.parentID === "ses_stop_root").length === 2,
    "the walk stops at the empty page and does not fetch a third page",
  );
  check(
    stopServer.calls.filter((call) => call.parentID === "ses_stop_child").length === 1,
    "a null-data page terminates the walk after a single fetch",
  );

  // --- Cycle guard: a child listing that references an already-visited
  // session (including the root) is skipped, not re-walked. ---
  const cycleRoot = fixture("ses_cycle_root", { parentID: undefined });
  const cycleA = fixture("ses_cycle_a", { parentID: "ses_cycle_root" });
  const cycleServer = listingServer({
    ses_cycle_root: [{ data: [cycleRoot, cycleA], next: null }],
    ses_cycle_a: [{ data: [cycleRoot], next: null }],
  });
  const cycleSessions = collect(cycleRoot, cycleServer.fetchChildPage);
  check(cycleSessions.length === 2, "the cycle guard skips already-visited sessions");
  check(
    cycleSessions.map((session) => session.id).join(",") === "ses_cycle_root,ses_cycle_a",
    "the cycle guard keeps the root at depth 0 exactly once",
  );
  check(
    cycleServer.calls.filter((call) => call.parentID === "ses_cycle_root").length === 1,
    "the cycle guard does not re-fetch the root's children",
  );

  // --- Normalization of null agent/model/title and missing token fields. ---
  const sparse = normalizeSession(
    fixture("ses_sparse", { agent: null, model: null, title: null, tokens: {}, cost: 0, time: {} }),
    1,
    "ses_sparse_parent",
  );
  check(sparse.agent === null && sparse.title === null, "null agent and title normalize to null");
  check(sparse.model === null && sparse.variant === null && sparse.providerID === null, "a null model normalizes to null model, variant, and provider");
  check(
    JSON.stringify(sparse.tokens) === JSON.stringify({ input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0 }),
    "missing token fields normalize to 0",
  );
  check(sparse.cost === 0 && sparse.time.created === 0 && sparse.time.updated === 0, "missing cost and time fields normalize to 0");
  check(sparse.parentID === "ses_sparse_parent" && sparse.depth === 1, "normalization records the supplied parent and depth");
  const partial = normalizeSession(fixture("ses_partial", { tokens: { input: 7, cache: { write: 3 } } }), 0, null);
  check(partial.tokens.input === 7 && partial.tokens.cacheWrite === 3, "partially present token fields keep their values");
  check(partial.tokens.output === 0 && partial.tokens.reasoning === 0 && partial.tokens.cacheRead === 0, "absent token fields stay 0 beside present ones");

  // --- Totals math: reasoning is displayed, not added into total. ---
  const sumA = normalizeSession(fixture("ses_sum_a", { tokens: { input: 10, output: 20, reasoning: 5, cache: { read: 1, write: 2 } }, cost: 0.5 }), 0, null);
  const sumB = normalizeSession(fixture("ses_sum_b", { tokens: { reasoning: 7 }, cost: 1.25 }), 1, "ses_sum_a");
  const sum = totals([sumA, sumB]);
  check(sum.sessions === 2, "totals count the sessions");
  check(sum.input === 10 && sum.output === 20 && sum.cacheRead === 1 && sum.cacheWrite === 2, "totals sum the token fields");
  check(sum.reasoning === 12, "totals sum the reasoning tokens");
  check(sum.total === 33, "totals add input, output, and cache but not reasoning");
  check(Math.abs(sum.cost - 1.75) < 1e-9, "totals sum the cost");
  check(sessionTotal(sumA) === 33, "sessionTotal excludes reasoning");
  check(JSON.stringify(totals([])) === JSON.stringify({ sessions: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, total: 0, cost: 0 }), "totals of an empty tree are zero");

  // --- byProvider grouping: null model is "-", sorted by total desc. ---
  const provA = normalizeSession(fixture("ses_prov_a", { model: { id: "m", providerID: "alpha", variant: null }, tokens: { input: 20 } }), 0, null);
  const provB = normalizeSession(fixture("ses_prov_b", { model: { id: "m", providerID: "beta", variant: "low" }, tokens: { input: 10 } }), 1, "ses_prov_a");
  const provNull = normalizeSession(fixture("ses_prov_null", { model: null, tokens: { input: 5 } }), 1, "ses_prov_a");
  const provGroups = byProvider([provB, provNull, provA]);
  check(
    provGroups.map((group) => group.provider).join(",") === "alpha,beta,-",
    "byProvider sorts by total tokens descending and groups a null model as '-'",
  );
  check(provGroups[0].total === 20 && provGroups[1].total === 10 && provGroups[2].total === 5, "byProvider carries the per-group totals");
  check(provGroups[0].sessions === 1 && provGroups[2].sessions === 1, "byProvider carries the per-group session counts");
  check(Math.abs(provGroups[0].cost - 0.5) < 1e-9, "byProvider carries the per-group cost");
  const tieA = normalizeSession(fixture("ses_tie_a", { model: { id: "m", providerID: "zeta", variant: null }, tokens: { input: 4 } }), 0, null);
  const tieB = normalizeSession(fixture("ses_tie_b", { model: { id: "m", providerID: "eta", variant: null }, tokens: { input: 4 } }), 1, "ses_tie_a");
  check(byProvider([tieB, tieA]).map((group) => group.provider).join(",") === "eta,zeta", "byProvider breaks total ties by provider name");

  // --- Duration math and humanization. ---
  check(
    JSON.stringify(sessionDuration([sumA, sumB])) === JSON.stringify({ start: 1000, end: 2000, seconds: 1 }),
    "sessionDuration spans min created to max updated across the tree",
  );
  check(JSON.stringify(sessionDuration([])) === JSON.stringify({ start: 0, end: 0, seconds: 0 }), "sessionDuration of an empty tree is zero");
  check(formatDuration(0) === "0s", "formatDuration(0) is 0s");
  check(formatDuration(42) === "42s", "formatDuration renders bare seconds");
  check(formatDuration(392) === "06m 32s", "formatDuration pads minutes and seconds");
  check(formatDuration(3692) === "1h 01m 32s", "formatDuration renders hours with zero-padded minutes and seconds");
  check(formatDuration(7325) === "2h 02m 05s", "formatDuration renders multiple hours");
  check(formatDuration(Number.NaN) === "0s", "formatDuration falls back to 0s for a non-number");

  // --- Number formatting: manual digit grouping, no locale. ---
  check(formatTokens(0) === "0", "formatTokens(0) is 0");
  check(formatTokens(999) === "999", "formatTokens leaves three digits ungrouped");
  check(formatTokens(1000) === "1,000", "formatTokens groups thousands");
  check(formatTokens(1234567) === "1,234,567", "formatTokens groups multiple thousands groups");
  check(formatTokens("nope") === "0", "formatTokens falls back to 0 for a non-number");
  check(formatCost(0) === "0.00", "formatCost keeps at least two decimals");
  check(formatCost(12.34) === "12.34", "formatCost formats a simple amount");
  check(formatCost(1234.5) === "1,234.50", "formatCost groups thousands and pads decimals");

  // --- Title truncation. ---
  check(truncateTitle("short") === "short", "truncateTitle leaves short titles alone");
  check(truncateTitle(null) === null, "truncateTitle passes null through");
  const truncated = truncateTitle("a".repeat(49) + "bc");
  check(truncated.length === 50 && truncated.endsWith("…"), "truncateTitle caps a long title at 50 characters with an ellipsis");

  // --- Table rendering: alignment, indentation, null fields, truncation. ---
  const tableRoot = normalizeSession(
    fixture("ses_table_root", { agent: "coordinator", model: { id: "m1", providerID: "prov", variant: "high" }, title: "x".repeat(60), time: { created: 1, updated: 9 } }),
    0,
    null,
  );
  const tableChild = normalizeSession(
    fixture("ses_table_child", { agent: null, model: null, title: null, tokens: {}, cost: 0, time: { created: 2, updated: 8 } }),
    2,
    "ses_table_root",
  );
  const table = renderTable([tableChild, tableRoot]);
  const tableLines = table.split("\n");
  check(tableLines.length === 3, "renderTable emits a header plus one line per session");
  check(
    ["Agent", "Task", "Model", "In", "Out", "Cache R", "Cache W", "Reason", "Total", "Cost"].every((header) => tableLines[0].includes(header)),
    "renderTable names every column in the header",
  );
  check(
    new Set(tableLines.map((line) => line.length)).size === 1,
    "renderTable aligns every line to the same width",
  );
  check(tableLines[1].includes("x".repeat(49) + "…"), "renderTable truncates a long title with an ellipsis");
  check(tableLines[2].startsWith("    -"), "a depth-2 null agent renders as '-' indented two spaces per level");
  check((tableLines[2].match(/-/g) ?? []).length >= 3, "null agent, title, and model all render as '-'");

  // --- Display order: root first, then ascending time.created, id ties. ---
  const order = displayOrder([
    normalizeSession(fixture("ses_order_1", { time: { created: 3000, updated: 4000 } }), 1, "ses_order_0"),
    normalizeSession(fixture("ses_order_0", { time: { created: 1000, updated: 5000 } }), 0, null),
    normalizeSession(fixture("ses_order_2", { time: { created: 2000, updated: 3000 } }), 2, "ses_order_1"),
    normalizeSession(fixture("ses_order_3", { time: { created: 2000, updated: 3500 } }), 1, "ses_order_0"),
  ]);
  check(
    order.map((session) => session.id).join(",") === "ses_order_0,ses_order_2,ses_order_3,ses_order_1",
    "displayOrder puts the root first, then ascending created with an id tie-break",
  );

  // --- Report assembly: the JSON shape shared by --json and the text
  // render. ---
  const reportRoot = fixture("ses_report_root", { parentID: undefined, agent: "coordinator", model: { id: "m1", providerID: "prov", variant: "high" }, title: "My task", time: { created: 1000, updated: 3693000 } });
  const reportChild = fixture("ses_report_child", { agent: "worker", model: { id: "m2", providerID: "other", variant: null }, tokens: { input: 100, output: 50, reasoning: 7, cache: { read: 1, write: 2 } }, cost: 3.5, time: { created: 2000, updated: 3692000 } });
  const reportServer = listingServer({ ses_report_root: [{ data: [reportChild], next: null }] });
  const report = buildReport(reportRoot, reportServer.fetchChildPage);
  check(report.root === "ses_report_root", "buildReport records the root session id");
  check(report.sessions.length === 2, "buildReport includes every session of the tree");
  check(
    JSON.stringify(Object.keys(report.sessions[0]).sort()) === JSON.stringify(["agent", "cost", "depth", "id", "model", "parentID", "title", "tokens", "time", "variant"].sort()),
    "buildReport sessions carry exactly the documented JSON fields",
  );
  check(report.sessions[0].id === "ses_report_root" && report.sessions[1].parentID === "ses_report_root", "buildReport orders the root first and records parent ids");
  check(report.duration.seconds === 3692, "buildReport duration spans min created to max updated across the tree");
  check(report.totals.total === 186, "buildReport totals sum the tree (33 root + 153 child, reasoning excluded)");
  check(report.byProvider[0].provider === "other", "buildReport byProvider sorts by total tokens descending");
  const reportText = renderReport(report);
  check(
    reportText.startsWith("My task\nCoordinator: coordinator on prov/m1 (high)\nSession: ses_report_root\nDuration: 1h 01m 32s\nSessions: 2"),
    "renderReport header lists title, coordinator, session id, duration, and session count",
  );
  check(reportText.includes("BY PROVIDER"), "renderReport includes the BY PROVIDER block");
  check(reportText.includes("prov/m1 (high)") && reportText.includes("other/m2"), "renderReport renders the model with the variant in parens");

  // --- collect and parseArgs error contracts. ---
  checkError(() => collect(null, () => ({ data: [] })), "collect rejects a non-object root", ["not a session object"]);
  checkError(
    () => collect(fixture("ses_loop_root"), () => ({ data: [fixture("ses_loop_child")], cursor: { next: "1" } })),
    "collect rejects non-terminating pagination",
    ["pagination did not terminate"],
  );
  check(JSON.stringify(parseArgs([])) === JSON.stringify({ sessionId: null, json: false }), "parseArgs accepts no arguments");
  check(JSON.stringify(parseArgs(["ses_x", "--json"])) === JSON.stringify({ sessionId: "ses_x", json: true }), "parseArgs accepts a positional session id and --json");
  checkError(() => parseArgs(["--bogus"]), "parseArgs rejects an unknown option", ["Unknown option"]);
  checkError(() => parseArgs(["ses_a", "ses_b"]), "parseArgs rejects a second positional argument", ["Unexpected argument"]);
  let parseError = null;
  try {
    parseArgs(["--bogus"]);
  } catch (error) {
    parseError = error;
  }
  check(parseError instanceof UsageError, "parseArgs argument errors are UsageErrors for the exit-2 path");

// Optional live check: exercises the CLI against the running OpenCode
// server for the calling session. Skips cleanly when the session id, the
// CLI, or the server is unavailable.
function runLive() {
  const sessionID = process.env.OPENCODE_SESSION_ID;
  if (typeof sessionID !== "string" || sessionID.length === 0) {
    console.log("Live check skipped: OPENCODE_SESSION_ID is not set.");
    return;
  }
  const runCli = (extra) => spawnSync(process.execPath, [modulePath, sessionID, ...extra], { encoding: "utf8", timeout: 180000 });
  const jsonRun = runCli(["--json"]);
  if (jsonRun.status !== 0) {
    const stderr = String(jsonRun.stderr ?? "").trim();
    if (/cannot reach the running OpenCode server/.test(stderr) || /not found on PATH/.test(stderr) || /not found \(HTTP 404\)/.test(stderr)) {
      console.log(`Live check skipped: ${stderr.split("\n").pop()}`);
      return;
    }
    check(false, `live --json run exits 0 (status ${jsonRun.status}; stderr: ${stderr})`);
    return;
  }
  let report = null;
  try {
    report = JSON.parse(jsonRun.stdout);
  } catch {
    check(false, "live --json output is valid JSON");
    return;
  }
  check(Array.isArray(report.sessions), "live report has a sessions array");
  check(report.sessions.length >= 1, "live report includes at least the root session");
  check(report.sessions.some((session) => session.id === sessionID), "live report includes the requested session id");
  check(typeof report.totals.total === "number" && Array.isArray(report.byProvider), "live report carries totals and a per-provider breakdown");
  const textRun = runCli([]);
  check(textRun.status === 0, `live text run exits 0${textRun.status === 0 ? "" : ` (stderr: ${textRun.stderr})`}`);
  check(textRun.stdout.includes("BY PROVIDER"), "live text report includes the BY PROVIDER block");
  const bogus = spawnSync(process.execPath, [modulePath, "ses_live_bogus_session"], { encoding: "utf8", timeout: 180000 });
  check(bogus.status === 1, `live bogus session id exits 1 (got ${bogus.status})`);
  check(/not found \(HTTP 404\)/.test(String(bogus.stderr ?? "")), "live bogus session id reports a friendly 404 error");
}

if (process.argv.includes("--live")) runLive();
console.log(`Session stats tests passed: ${assertions} assertions${process.argv.includes("--live") ? " (unit + live)" : " (unit)"}.`);
