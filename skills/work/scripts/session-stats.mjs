#!/usr/bin/env node
/**
 * AgenticAle session usage stats helper.
 *
 * Packaged alongside the work skill and installed with it. Dependency-free
 * (Node builtins only, ESM) and read-only: it issues only `opencode api`
 * read queries against the running OpenCode server and changes nothing.
 *
 * Given a root session (default: the caller's OPENCODE_SESSION_ID), it walks
 * the whole session tree — the coordinator plus every nested child session —
 * and reports the overall duration, a per-session table with agent, model,
 * and token counts, totals, and a per-provider breakdown.
 *
 * Token semantics: Total = input + output + cache.read + cache.write.
 * Reasoning tokens are displayed in their own column and are NOT added into
 * Total, because reasoning may already be counted in output.
 */

import { execFileSync } from "node:child_process";
import { realpath } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export class StatsError extends Error {
  constructor(message) {
    super(message);
    this.name = "StatsError";
  }
}

// A usage error: bad arguments or a missing session id (exit 2), as opposed
// to a runtime failure (exit 1).
export class UsageError extends StatsError {
  constructor(message) {
    super(message);
    this.name = "UsageError";
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asString(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

// Normalizes one raw API session into the report shape, treating missing
// numbers as 0 and absent agent/model/title fields as null. parentID is the
// walk's parent (null for the root), not a field of the root object.
export function normalizeSession(raw, depth, parentID) {
  const session = isPlainObject(raw) ? raw : {};
  const model = isPlainObject(session.model) ? session.model : null;
  const tokens = isPlainObject(session.tokens) ? session.tokens : {};
  const cache = isPlainObject(tokens.cache) ? tokens.cache : {};
  const time = isPlainObject(session.time) ? session.time : {};
  const providerID = asString(model?.providerID);
  const modelID = asString(model?.id);
  return {
    id: asString(session.id),
    parentID,
    depth,
    agent: asString(session.agent),
    title: asString(session.title),
    model: model === null ? null : `${providerID ?? "-"}/${modelID ?? "-"}`,
    providerID,
    variant: asString(model?.variant),
    tokens: {
      input: asNumber(tokens.input),
      output: asNumber(tokens.output),
      reasoning: asNumber(tokens.reasoning),
      cacheRead: asNumber(cache.read),
      cacheWrite: asNumber(cache.write),
    },
    cost: asNumber(session.cost),
    time: {
      created: asNumber(time.created),
      updated: asNumber(time.updated),
    },
  };
}

// The pagination safety cap: 1000 pages of up to 100 sessions per parent.
const MAX_PAGES_PER_PARENT = 1000;

// Walks the session tree under rootData. fetchChildPage(parentID, cursor)
// returns one raw `session.list` page: { data, cursor: { next } }, where
// data may be an array or null (both mean an empty listing). Pages are
// followed through cursor.next until a page's data is empty or absent;
// cursor.next may be non-null on the last non-empty page, so the page data,
// not the cursor, decides termination. A visited set guards against cycles.
// Returns the flat, normalized session list with each session's depth.
export function collect(rootData, fetchChildPage) {
  if (!isPlainObject(rootData) || asString(rootData.id) === null) {
    throw new StatsError("The root session response is not a session object.");
  }
  const sessions = [];
  const visited = new Set();
  const pending = [{ raw: rootData, depth: 0, parentID: null }];
  while (pending.length > 0) {
    const item = pending.shift();
    if (visited.has(item.raw.id)) continue;
    visited.add(item.raw.id);
    sessions.push(normalizeSession(item.raw, item.depth, item.parentID));
    for (const child of directChildren(item.raw.id, fetchChildPage)) {
      if (!visited.has(child.id)) {
        pending.push({ raw: child, depth: item.depth + 1, parentID: item.raw.id });
      }
    }
  }
  return sessions;
}

function directChildren(parentID, fetchChildPage) {
  const children = [];
  let cursor = null;
  let pages = 0;
  for (;;) {
    if (pages >= MAX_PAGES_PER_PARENT) {
      throw new StatsError(`session ${parentID}: pagination did not terminate after ${MAX_PAGES_PER_PARENT} pages.`);
    }
    pages += 1;
    const fetched = fetchChildPage(parentID, cursor);
    const response = isPlainObject(fetched) ? fetched : {};
    const data = Array.isArray(response.data) ? response.data : null;
    if (data === null || data.length === 0) return children;
    for (const raw of data) {
      if (isPlainObject(raw) && asString(raw.id) !== null) children.push(raw);
    }
    cursor = isPlainObject(response.cursor) ? asString(response.cursor.next) : null;
    if (cursor === null) return children;
  }
}

// Display order: the root (depth 0) first, then every other session in
// ascending time.created, with the id as a deterministic tie-breaker.
export function displayOrder(sessions) {
  return [...sessions].sort((a, b) => {
    const rootRank = Number(a.depth > 0) - Number(b.depth > 0);
    if (rootRank !== 0) return rootRank;
    if (a.time.created !== b.time.created) return a.time.created - b.time.created;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

// Total = input + output + cache read + cache write. Reasoning is reported
// separately and not added here (it may already be counted in output).
export function sessionTotal(session) {
  return session.tokens.input + session.tokens.output + session.tokens.cacheRead + session.tokens.cacheWrite;
}

// Overall tree duration: min(time.created) to max(time.updated) across every
// session, in milliseconds, plus the whole-second count.
export function sessionDuration(sessions) {
  if (sessions.length === 0) return { start: 0, end: 0, seconds: 0 };
  let start = Infinity;
  let end = -Infinity;
  for (const session of sessions) {
    if (session.time.created > 0) start = Math.min(start, session.time.created);
    if (session.time.updated > 0) end = Math.max(end, session.time.updated);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end)) return { start: 0, end: 0, seconds: 0 };
  if (end < start) end = start;
  return { start, end, seconds: Math.round((end - start) / 1000) };
}

// Humanized whole seconds ("1h 04m 32s"), with no locale-dependent
// formatting.
export function formatDuration(seconds) {
  const total = Math.max(0, Math.trunc(Number.isFinite(seconds) ? seconds : 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(secs).padStart(2, "0")}s`;
  if (minutes > 0) return `${String(minutes).padStart(2, "0")}m ${String(secs).padStart(2, "0")}s`;
  return `${secs}s`;
}

export function totals(sessions) {
  const summary = {
    sessions: sessions.length,
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    reasoning: 0,
    total: 0,
    cost: 0,
  };
  for (const session of sessions) {
    summary.input += session.tokens.input;
    summary.output += session.tokens.output;
    summary.cacheRead += session.tokens.cacheRead;
    summary.cacheWrite += session.tokens.cacheWrite;
    summary.reasoning += session.tokens.reasoning;
    summary.total += sessionTotal(session);
    summary.cost += session.cost;
  }
  return summary;
}

// Groups by model.providerID (sessions with a null model are grouped as
// "-"), sorted by total tokens descending, provider name ascending on ties.
export function byProvider(sessions) {
  const groups = new Map();
  for (const session of sessions) {
    const provider = session.providerID ?? "-";
    let group = groups.get(provider);
    if (!group) {
      group = { provider, sessions: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, total: 0, cost: 0 };
      groups.set(provider, group);
    }
    group.sessions += 1;
    group.input += session.tokens.input;
    group.output += session.tokens.output;
    group.cacheRead += session.tokens.cacheRead;
    group.cacheWrite += session.tokens.cacheWrite;
    group.reasoning += session.tokens.reasoning;
    group.total += sessionTotal(session);
    group.cost += session.cost;
  }
  return [...groups.values()].sort((a, b) => (b.total - a.total) || (a.provider < b.provider ? -1 : a.provider > b.provider ? 1 : 0));
}

// Manual thousands grouping without locale data.
export function formatTokens(value) {
  const digits = String(Math.max(0, Math.trunc(Number.isFinite(value) ? value : 0)));
  let grouped = "";
  for (let index = 0; index < digits.length; index += 1) {
    if (index > 0 && (digits.length - index) % 3 === 0) grouped += ",";
    grouped += digits[index];
  }
  return grouped;
}

// Dollar amount with at least two decimals, thousands grouped the same way.
export function formatCost(value) {
  const number = Number.isFinite(value) ? value : 0;
  const [whole, fraction] = Math.abs(number).toFixed(2).split(".");
  return `${number < 0 ? "-" : ""}${formatTokens(Number(whole))}.${fraction}`;
}

// Caps a task title at the given width with a one-character ellipsis.
export function truncateTitle(title, maxWidth = 50) {
  if (title === null) return null;
  if (title.length <= maxWidth) return title;
  return `${title.slice(0, maxWidth - 1)}…`;
}

// Aligns a header row and data rows with two-space column gaps; each column
// is as wide as its widest cell.
function alignTable(headers, rows, aligns) {
  const widths = headers.map((header, index) => Math.max(header.length, ...rows.map((row) => row[index].length)));
  const line = (cells) => cells
    .map((value, index) => (aligns[index] === "right" ? value.padStart(widths[index]) : value.padEnd(widths[index])))
    .join("  ")
    .replace(/\s+$/, "");
  return [line(headers), ...rows.map((row) => line(row))].join("\n");
}

const TABLE_HEADERS = ["Agent", "Task", "Model", "In", "Out", "Cache R", "Cache W", "Reason", "Total", "Cost"];
const TABLE_ALIGNS = ["left", "left", "left", "right", "right", "right", "right", "right", "right", "right"];

function modelLabel(session) {
  if (session.model === null) return "-";
  return session.variant === null ? session.model : `${session.model} (${session.variant})`;
}

// The per-session table: root first, then children in ascending
// time.created, the agent column indented two spaces per depth level.
export function renderTable(sessions) {
  const rows = displayOrder(sessions).map((session) => [
    `${"  ".repeat(session.depth)}${session.agent ?? "-"}`,
    truncateTitle(session.title) ?? "-",
    modelLabel(session),
    formatTokens(session.tokens.input),
    formatTokens(session.tokens.output),
    formatTokens(session.tokens.cacheRead),
    formatTokens(session.tokens.cacheWrite),
    formatTokens(session.tokens.reasoning),
    formatTokens(sessionTotal(session)),
    formatCost(session.cost),
  ]);
  return alignTable(TABLE_HEADERS, rows, TABLE_ALIGNS);
}

// Builds the complete report object shared by the text and JSON outputs.
export function buildReport(rootData, fetchChildPage) {
  const sessions = collect(rootData, fetchChildPage);
  const ordered = displayOrder(sessions);
  const rootSession = ordered.find((session) => session.depth === 0) ?? ordered[0];
  return {
    root: rootSession?.id ?? null,
    duration: sessionDuration(sessions),
    sessions: ordered.map(({ id, parentID, depth, agent, title, model, variant, tokens, cost, time }) => ({
      id,
      parentID,
      depth,
      agent,
      title,
      model,
      variant,
      tokens,
      cost,
      time,
    })),
    totals: totals(sessions),
    byProvider: byProvider(sessions),
  };
}

// The text report: header block, per-session table, totals, BY PROVIDER.
export function renderReport(report) {
  const rootSession = report.sessions.find((session) => session.depth === 0) ?? report.sessions[0];
  const summary = report.totals;
  const lines = [
    rootSession.title ?? "-",
    `Coordinator: ${rootSession.agent ?? "-"} on ${modelLabel(rootSession)}`,
    `Session: ${rootSession.id}`,
    `Duration: ${formatDuration(report.duration.seconds)}`,
    `Sessions: ${formatTokens(summary.sessions)}`,
    "",
    renderTable(report.sessions),
    "",
    "Totals (Total excludes Reasoning, which may already be counted in Output):",
  ];
  const summaryRows = [
    ["Sessions", formatTokens(summary.sessions)],
    ["Input", formatTokens(summary.input)],
    ["Output", formatTokens(summary.output)],
    ["Cache read", formatTokens(summary.cacheRead)],
    ["Cache write", formatTokens(summary.cacheWrite)],
    ["Reasoning", formatTokens(summary.reasoning)],
    ["Total", formatTokens(summary.total)],
    ["Cost", formatCost(summary.cost)],
  ];
  const labelWidth = Math.max(...summaryRows.map(([label]) => label.length));
  for (const [label, value] of summaryRows) lines.push(`${label.padEnd(labelWidth)}: ${value}`);
  lines.push("");
  lines.push("BY PROVIDER");
  lines.push(alignTable(
    ["Provider", "Sessions", "In", "Out", "Cache R", "Cache W", "Reason", "Total", "Cost"],
    report.byProvider.map((group) => [
      group.provider,
      formatTokens(group.sessions),
      formatTokens(group.input),
      formatTokens(group.output),
      formatTokens(group.cacheRead),
      formatTokens(group.cacheWrite),
      formatTokens(group.reasoning),
      formatTokens(group.total),
      formatCost(group.cost),
    ]),
    ["left", "right", "right", "right", "right", "right", "right", "right", "right"],
  ));
  return lines.join("\n");
}

const API_TIMEOUT_MS = 30000;

// Runs one `opencode api` read query and returns its raw stdout, turning
// CLI, server, and session failures into actionable StatsErrors.
function runApi(args, context) {
  let output;
  try {
    output = execFileSync("opencode", ["api", ...args], {
      encoding: "utf8",
      timeout: API_TIMEOUT_MS,
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new StatsError("the 'opencode' CLI was not found on PATH; install OpenCode or run this on a machine that has it.");
    }
    const stderr = String(error?.stderr ?? "").trim();
    const stdout = String(error?.stdout ?? "").trim();
    if (stderr.includes("HTTP 404") || stdout.includes("SessionNotFoundError")) {
      throw new StatsError(`session ${context} not found (HTTP 404).`);
    }
    const detail = error?.killed || error?.signal
      ? `the opencode api call did not finish within ${Math.round(API_TIMEOUT_MS / 1000)}s`
      : (stderr || stdout || String(error?.message ?? "")).split("\n").pop().trim() || "unknown error";
    throw new StatsError(`cannot reach the running OpenCode server: ${detail}`);
  }
  return output;
}

function parseApiJson(output, context) {
  try {
    return JSON.parse(output);
  } catch {
    throw new StatsError(`the OpenCode API returned no usable JSON for ${context}.`);
  }
}

function makeFetchChildPage() {
  return (parentID, cursor) => {
    const args = ["session.list", "--param", `parentID=${parentID}`, "--param", "limit=100"];
    if (cursor !== null) args.push("--param", `cursor=${cursor}`);
    const parsed = parseApiJson(runApi(args, parentID), parentID);
    return {
      data: Array.isArray(parsed?.data) ? parsed.data : null,
      cursor: isPlainObject(parsed?.cursor) ? parsed.cursor : { next: null },
    };
  };
}

// Splits the CLI arguments: one positional session id and an optional
// --json flag. Bad arguments are UsageErrors (exit 2).
export function parseArgs(argv) {
  let sessionId = null;
  let json = false;
  for (const argument of argv) {
    if (argument === "--json") {
      json = true;
    } else if (argument.startsWith("-") && argument.length > 1) {
      throw new UsageError(`Unknown option '${argument}'. Run with --help for usage.`);
    } else if (sessionId !== null) {
      throw new UsageError(`Unexpected argument '${argument}'. One session id is accepted; run with --help for usage.`);
    } else {
      sessionId = argument;
    }
  }
  return { sessionId, json };
}

function cliUsage() {
  return `Usage:
  node session-stats.mjs [session-id] [--json]

Reports the usage of one session tree — the given session plus every nested
child session — as an overall duration, a per-session table with agent,
model, and token counts, totals, and a per-provider breakdown. Inside an
OpenCode session the calling session is the default, so no argument is
needed.

  session-id   Session to report (default: the OPENCODE_SESSION_ID
               environment variable of the calling OpenCode session)
  --json       Print the report as a JSON object instead of the text report

Only read-only API queries are issued against the running OpenCode server;
nothing is changed.`;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(cliUsage());
    return;
  }
  const { sessionId, json } = parseArgs(argv);
  const envSession = process.env.OPENCODE_SESSION_ID;
  const sessionID = sessionId ?? (typeof envSession === "string" && envSession.length > 0 ? envSession : null);
  if (sessionID === null) {
    console.error(cliUsage());
    console.error("No session id was given and OPENCODE_SESSION_ID is not set.");
    process.exitCode = 2;
    return;
  }
  const parsed = parseApiJson(runApi(["GET", `/api/session/${sessionID}`], sessionID), sessionID);
  const report = buildReport(parsed?.data, makeFetchChildPage());
  process.stdout.write(`${json ? JSON.stringify(report, null, 2) : renderReport(report)}\n`);
}

if (process.argv[1]
  && (await realpath(process.argv[1]).catch(() => null)) === await realpath(fileURLToPath(import.meta.url)).catch(() => null)) {
  await main().catch((error) => {
    const message = error instanceof StatsError ? error.message : `Unexpected stats failure: ${error.message}`;
    console.error(`Session stats error: ${message}`);
    process.exitCode = error instanceof UsageError ? 2 : 1;
  });
}
