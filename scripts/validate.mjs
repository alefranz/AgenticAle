#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { strictValidateRouting } from "./build.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");

// The seven routing keys that define every route across all three runtimes.
const routes = [
  "consult",
  "deep-review",
  "explore",
  "fix",
  "implement-hard",
  "implement",
  "review",
];

// The six capability-neutral task contracts authored under skills/work/references/tasks.
// implement-hard shares the `implement` contract, so there is no seventh file.
const taskContracts = [
  "consult",
  "deep-review",
  "explore",
  "fix",
  "implement",
  "review",
];

const runtimes = ["codex", "copilot", "opencode"];
const profileNames = ["consult", "deep-review", "explore", "fix", "implement", "implement-hard", "review"];
const skillNames = ["work", "autonomous", "pull-request-description", "source-code-lookup"];
const retiredSkillNames = ["work-mode", "autonomous-mode"];

// The NEW authored source-of-truth layout validate.mjs must assert exists.
const requiredPaths = [
  "skills/work/SKILL.md",
  "skills/work/agents/openai.yaml",
  "skills/work/references/rounds.md",
  "skills/work/references/ROUTING.md",
  "skills/work/references/routing.json",
  "skills/work/references/runtimes/copilot.md",
  "skills/work/references/runtimes/copilot-local.md",
  "skills/work/references/runtimes/codex.md",
  "skills/work/references/runtimes/opencode.md",
  ...taskContracts.map((name) => `skills/work/references/tasks/${name}.md`),
  "skills/autonomous/SKILL.md",
  "skills/autonomous/agents/openai.yaml",
  "skills/pull-request-description/SKILL.md",
  "skills/source-code-lookup/SKILL.md",
  "adapters/opencode/adapter.json",
  "adapters/opencode/README.md",
].sort();

// The RETIRED layout that must be gone from the authored source tree.
const retiredPaths = [
  "commands",
  "agents/autonomous",
  "skills/work-mode",
  "skills/autonomous-mode",
  "plugins/agenticale/com.github.copilot",
];

const failures = [];

function portablePath(path) {
  return path.split(sep).join("/");
}

function fail(path, message, remedy) {
  failures.push(`${path}: ${message}${remedy ? `; ${remedy}` : ""}`);
}

function readText(path) {
  return readFileSync(join(repositoryRoot, path), "utf8").replace(/^\uFEFF/, "");
}

function looksLikeUnquotedColonScalar(value) {
  const trimmed = value.trim();
  if (trimmed === "") return false;
  const first = trimmed[0];
  if (first === '"' || first === "'" || first === "|" || first === ">" || first === "{" || first === "[" || first === "-") return false;
  return trimmed.includes(": ");
}

function parseFrontmatter(path, text) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  if (lines[0] !== "---") {
    fail(path, "missing opening frontmatter delimiter", "start the file with ---");
    return { fields: new Map(), permissions: [], metadata: new Map(), body: text };
  }

  const close = lines.indexOf("---", 1);
  if (close < 0) {
    fail(path, "missing closing frontmatter delimiter", "add --- before the Markdown body");
    return { fields: new Map(), permissions: [], metadata: new Map(), body: "" };
  }

  const fields = new Map();
  const permissions = [];
  const metadata = new Map();
  let currentPermission = null;
  let inPermissions = false;
  let inMetadata = false;

  for (let index = 1; index < close; index += 1) {
    const line = lines[index];
    if (line.trim() === "") continue;

    const topLevel = line.match(/^([A-Za-z][A-Za-z0-9-]*):(?:\s+(.*))?$/);
    if (topLevel) {
      const [, key, rawValue = ""] = topLevel;
      if (fields.has(key)) {
        fail(path, `duplicate frontmatter key '${key}'`, "keep exactly one value");
      }
      const value = rawValue.trim();
      if (looksLikeUnquotedColonScalar(value)) {
        fail(path, `frontmatter for '${key}' is invalid YAML (an unquoted scalar contains ": ")`, "quote the value or use a block scalar");
      }
      fields.set(key, value);
      inPermissions = key === "permissions";
      inMetadata = key === "metadata";
      currentPermission = null;
      continue;
    }

    if (inPermissions) {
      const item = line.match(/^  - action:\s+(.+)$/);
      if (item) {
        currentPermission = { action: item[1].trim() };
        permissions.push(currentPermission);
        continue;
      }
      const property = line.match(/^    (resource|effect):\s+(.+)$/);
      if (property && currentPermission) {
        currentPermission[property[1]] = property[2].trim().replace(/^(["'])(.*)\1$/, "$2");
        continue;
      }
    }

    if (inMetadata) {
      const property = line.match(/^  ([A-Za-z][A-Za-z0-9/-]*):\s+(.+)$/);
      if (property) {
        const [, key, value] = property;
        if (metadata.has(key)) fail(path, `duplicate metadata key '${key}'`, "keep exactly one value");
        metadata.set(key, value.trim());
        continue;
      }
    }

    fail(path, `unsupported or malformed frontmatter line ${index + 1}: ${line.trim()}`, "use the documented scalar fields, permission list, and metadata keys");
  }

  return { fields, permissions, metadata, body: lines.slice(close + 1).join("\n") };
}

function requireExactKeys(path, fields, expected) {
  for (const key of expected) {
    if (!fields.has(key)) fail(path, `missing required frontmatter key '${key}'`, `add ${key}: ...`);
  }
  for (const key of fields.keys()) {
    if (!expected.includes(key)) fail(path, `unsupported frontmatter key '${key}'`, "remove it or update the public skill contract intentionally");
  }
}

function requireMetadataFlags(path, metadata) {
  if (metadata.get("opencode/autoinvoke") !== "false") {
    fail(path, "metadata must set opencode/autoinvoke to false", "add opencode/autoinvoke: false");
  }
  const expectedFlags = new Set(["opencode/autoinvoke"]);
  for (const key of metadata.keys()) {
    if (!expectedFlags.has(key)) fail(path, `unexpected metadata key '${key}'`, "keep only the explicit-only invocation metadata flag");
  }
}

function validateSkillWork() {
  const path = "skills/work/SKILL.md";
  const { fields, metadata, body } = parseFrontmatter(path, readText(path));
  requireExactKeys(path, fields, ["name", "description", "version", "slash", "disable-model-invocation", "metadata"]);
  if (fields.get("name") !== "work") fail(path, "name must be 'work'", "set name: work");
  if (!fields.get("description")) fail(path, "description must not be empty", "add the skill routing description");
  if (!/^[1-9]\d*$/.test(fields.get("version") ?? "")) fail(path, "version must be a positive integer", "use version: <integer>");
  if (fields.get("slash") !== "true") fail(path, "slash must be true", "set slash: true");
  if (fields.get("disable-model-invocation") !== "true") {
    fail(path, "disable-model-invocation must be true (explicit-only)", "set disable-model-invocation: true");
  }
  requireMetadataFlags(path, metadata);
  if (!body.includes("](references/rounds.md)")) {
    fail(path, "body must link the shared round contract references/rounds.md", "link the shared round contract");
  }
  if (!body.includes("references/tasks/")) {
    fail(path, "body must reference references/tasks/", "keep the task-contract routing reference");
  }
}

function validateSkillAutonomous() {
  const path = "skills/autonomous/SKILL.md";
  const { fields, metadata, body } = parseFrontmatter(path, readText(path));
  requireExactKeys(path, fields, ["name", "description", "slash", "disable-model-invocation", "metadata"]);
  if (fields.has("version")) fail(path, "must not declare a version key", "remove the version key");
  if (fields.get("name") !== "autonomous") fail(path, "name must be 'autonomous'", "set name: autonomous");
  if (!fields.get("description")) fail(path, "description must not be empty", "add the skill routing description");
  if (fields.get("slash") !== "true") fail(path, "slash must be true", "set slash: true");
  if (fields.get("disable-model-invocation") !== "true") {
    fail(path, "disable-model-invocation must be true (explicit-only)", "set disable-model-invocation: true");
  }
  requireMetadataFlags(path, metadata);
  if (!body.includes("](../work/references/rounds.md)")) {
    fail(path, "body must link the shared round contract ../work/references/rounds.md", "link the shared round contract");
  }
}

function validateSkillSourceLookup() {
  const path = "skills/source-code-lookup/SKILL.md";
  const { fields, body } = parseFrontmatter(path, readText(path));
  requireExactKeys(path, fields, ["name", "description"]);
  if (fields.get("name") !== "source-code-lookup") fail(path, "skill name must match its folder", "set name: source-code-lookup");
  if (!fields.get("description")) fail(path, "description must not be empty", "describe when source lookup applies");
  if (body.split('Source root: "~/dev"').length !== 2) {
    fail(path, "skill must contain exactly one installer source-root marker", 'keep one Source root: "~/dev" line');
  }
}

function validateSkillPullRequest() {
  const path = "skills/pull-request-description/SKILL.md";
  const { fields, body } = parseFrontmatter(path, readText(path));
  requireExactKeys(path, fields, ["name", "description"]);
  if (fields.get("name") !== "pull-request-description") fail(path, "skill name must match its folder", "set name: pull-request-description");
  if (!fields.get("description")) fail(path, "description must not be empty", "describe when the skill applies");
  if (!/why/i.test(body) || !/validation/i.test(body)) {
    fail(path, "skill must cover intent and selective validation", "restore the PR narrative guidance");
  }
}

function validateRoutingContract() {
  const path = "skills/work/references/routing.json";
  let routing;
  try {
    routing = JSON.parse(readText(path));
  } catch (error) {
    fail(path, `routing contract is not valid JSON (${error.message})`, "restore a parseable routing contract");
    return;
  }
  try {
    strictValidateRouting(routing);
  } catch (error) {
    fail(path, `routing contract violates the shared strict schema (${error.message})`, "align routing.json with the documented contract in references/ROUTING.md");
  }
  if (routing.schemaVersion !== 1) {
    fail(path, "schemaVersion must be 1", "bump the routing schemaVersion intentionally");
  }
  if (typeof routing.provenance !== "string" || routing.provenance.length === 0) {
    fail(path, "provenance must be a non-empty string", "record where the routing values came from");
  }
  if (!routing.runtimes || typeof routing.runtimes !== "object" || Array.isArray(routing.runtimes)) {
    fail(path, "routing must include a runtimes object", "add the runtimes object");
    return;
  }
  const runtimeKeys = Object.keys(routing.runtimes).sort();
  if (JSON.stringify(runtimeKeys) !== JSON.stringify(runtimes)) {
    fail(path, `runtimes must be exactly ${runtimes.join(", ")}`, "keep one entry per supported runtime");
  }
  for (const runtime of runtimes) {
    const map = routing.runtimes[runtime];
    if (!map || typeof map !== "object" || Array.isArray(map)) {
      fail(path, `missing runtime '${runtime}'`, `add the ${runtime} runtime`);
      continue;
    }
    const keys = Object.keys(map);
    if (JSON.stringify([...keys].sort()) !== JSON.stringify([...routes].sort())) {
      fail(path, `runtime '${runtime}' must map exactly the ${routes.length} routes`, `map exactly: ${routes.join(", ")}`);
    }
    for (const route of routes) {
      const entry = map[route];
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        fail(path, `runtime '${runtime}' is missing route '${route}'`, `add the ${runtime}/${route} route`);
        continue;
      }
      if (entry.mode !== "explicit") {
        fail(path, `route ${runtime}/${route} must use mode "explicit"`, "restore mode: explicit (no fallbacks)");
      }
      if (typeof entry.model !== "string" || entry.model.length === 0) {
        fail(path, `route ${runtime}/${route} must have a non-empty model string`, "set the provider-qualified model");
      }
      if (typeof entry.reasoningEffort !== "string" || entry.reasoningEffort.length === 0) {
        fail(path, `route ${runtime}/${route} must have a non-empty reasoningEffort string`, "set the reasoning effort");
      }
      if (!Array.isArray(entry.fallbacks) || entry.fallbacks.length !== 0) {
        fail(path, `route ${runtime}/${route} fallbacks must be an empty array (no fallbacks)`, "remove the fallbacks");
      }
    }
  }
}

function denyActions(permissions) {
  return permissions
    .filter((permission) => permission && permission.action && permission.effect === "deny")
    .map((permission) => permission.action)
    .sort();
}

function validateAdapter() {
  const path = "adapters/opencode/adapter.json";
  let adapter;
  try {
    adapter = JSON.parse(readText(path));
  } catch (error) {
    fail(path, `adapter is not valid JSON (${error.message})`, "restore a parseable adapter");
    return;
  }
  if (adapter.runtime !== "opencode") {
    fail(path, "adapter runtime must be 'opencode'", "restore runtime: opencode");
  }
  const keyByRoute = adapter.keyByRoute;
  if (!keyByRoute || typeof keyByRoute !== "object" || Array.isArray(keyByRoute)) {
    fail(path, "adapter must include a keyByRoute map", "add the keyByRoute map");
  } else {
    if (JSON.stringify(Object.keys(keyByRoute).sort()) !== JSON.stringify([...routes].sort())) {
      fail(path, "keyByRoute must map exactly the seven routes", `map exactly: ${routes.join(", ")}`);
    }
    for (const route of routes) {
      if (keyByRoute[route] !== route) {
        fail(path, `keyByRoute["${route}"] must be "${route}" (each route maps 1:1 to its own profile)`, `set keyByRoute["${route}"] = "${route}"`);
      }
    }
  }
  if (!Array.isArray(adapter.profiles)) {
    fail(path, "adapter must include a profiles array", "add the profiles array");
    return;
  }
  const names = adapter.profiles.map((profile) => profile.name).sort();
  if (JSON.stringify(names) !== JSON.stringify([...profileNames].sort())) {
    fail(path, `profiles must be exactly ${profileNames.join(", ")} (no coordinator)`, "remove the coordinator and any extra profile");
  }
  const expectedSteps = { explore: 24, implement: 64, "implement-hard": 64, fix: 48, review: 56, "deep-review": 72, consult: 20 };
  const readOnlyDeny = ["edit", "question", "subagent"];
  const standardDeny = ["question", "subagent"];
  for (const profile of adapter.profiles) {
    const profilePath = `${path}#profiles.${profile && profile.name}`;
    if (!profile || typeof profile.name !== "string" || !profileNames.includes(profile.name)) {
      fail(path, "every profile must be one of the seven route names", "use the documented profile names");
      continue;
    }
    const profileKeys = Object.keys(profile).sort();
    if (JSON.stringify(profileKeys) !== JSON.stringify(["description", "mode", "name", "outputPath", "permissions", "steps"].sort())) {
      fail(profilePath, "profile must carry only metadata (no model/effort/body)", "remove model, reasoningEffort, and body text; keep metadata only");
    }
    if (profile.mode !== "subagent") fail(profilePath, "profile mode must be 'subagent'", "restore mode: subagent");
    if (typeof profile.steps !== "number") {
      fail(profilePath, "profile steps must be a number", "restore a numeric steps value");
    } else if (profile.steps !== expectedSteps[profile.name]) {
      fail(profilePath, `profile steps must be ${expectedSteps[profile.name]}`, `restore steps: ${expectedSteps[profile.name]}`);
    }
    if (typeof profile.description !== "string" || profile.description.length === 0) {
      fail(profilePath, "profile description must be non-empty", "describe the profile in one line");
    }
    if (!Array.isArray(profile.permissions)) {
      fail(profilePath, "profile must have a permissions array", "add the permission list");
      continue;
    }
    for (const permission of profile.permissions) {
      if (!permission || permission.resource !== "*" || permission.effect !== "deny") {
        fail(profilePath, "every permission must deny resource '*'", "use effect: deny with resource: *");
      }
    }
    const expectedDeny = profile.name === "explore" || profile.name === "consult" ? readOnlyDeny : standardDeny;
    if (JSON.stringify(denyActions(profile.permissions)) !== JSON.stringify(expectedDeny)) {
      fail(profilePath, `profile must deny exactly ${expectedDeny.join(", ")}`, "restore the exact deny permission set");
    }
  }
  const adapterText = readText(path);
  if (/task contract/i.test(adapterText)) {
    fail(path, "adapter must not contain task-contract body text", "keep the adapter metadata-only; bodies come from skills/work/references/tasks");
  }
}

function validateNeutralContracts() {
  const providerPatterns = [
    { pattern: /openai\//i, label: "openai/" },
    { pattern: /anthropic\//i, label: "anthropic/" },
    { pattern: /google\/gemini/i, label: "google/gemini" },
    { pattern: /gpt-\d/i, label: "gpt-<n>" },
    { pattern: /claude-/i, label: "claude-" },
    { pattern: /gemini-/i, label: "gemini-" },
  ];
  const tasksDir = join(repositoryRoot, "skills", "work", "references", "tasks");
  let actual = [];
  if (existsSync(tasksDir) && statSync(tasksDir).isDirectory()) {
    actual = readdirSync(tasksDir).sort();
  }
  const expectedFiles = taskContracts.map((name) => `${name}.md`).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expectedFiles)) {
    fail("skills/work/references/tasks", `task contracts must be exactly ${taskContracts.join(", ")} (no implement-hard, no coordinator)`, "implement-hard shares the implement contract");
  }
  for (const name of taskContracts) {
    const path = `skills/work/references/tasks/${name}.md`;
    if (!existsSync(join(repositoryRoot, path))) {
      fail(path, "required task contract is missing", "restore the capability-neutral task contract");
      continue;
    }
    const text = readText(path);
    for (const { pattern, label } of providerPatterns) {
      if (pattern.test(text)) {
        fail(path, `capability-neutral contract must not reference provider/model '${label}'`, "use capability-neutral wording; routing lives in routing.json");
      }
    }
  }
}

// The OpenAI-hosted-agent policy file for each invocation skill must opt out of
// implicit model invocation (plan: the skills are invoked by the user, not auto-run).
function validateOpenaiPolicy(path) {
  const text = readText(path).replace(/\r\n?/g, "\n");
  const policy = text.match(/^policy:\s*\n(?:[ \t]+.*\n?)*?([ \t]+allow_implicit_invocation:\s*(true|false))/m);
  if (!policy) {
    fail(path, "missing policy.allow_implicit_invocation", "add policy: { allow_implicit_invocation: false }");
    return;
  }
  if (policy[2] !== "false") {
    fail(path, "policy.allow_implicit_invocation must be false", "set policy.allow_implicit_invocation: false");
  }
}

function validateBundleSurface() {
  for (const path of requiredPaths) {
    if (!existsSync(join(repositoryRoot, path))) {
      fail(path, "required source-of-truth file is missing", "restore it from the skills-first layout");
    }
  }
  for (const policy of ["skills/work/agents/openai.yaml", "skills/autonomous/agents/openai.yaml"]) {
    if (existsSync(join(repositoryRoot, policy))) validateOpenaiPolicy(policy);
  }
  for (const path of retiredPaths) {
    if (existsSync(join(repositoryRoot, path))) {
      fail(path, "retired layout path is still present", "remove the retired authored source");
    }
  }
  if (existsSync(join(repositoryRoot, "commands")) && statSync(join(repositoryRoot, "commands")).isDirectory()) {
    for (const file of readdirSync(join(repositoryRoot, "commands"))) {
      if (file.endsWith(".md")) fail(`commands/${file}`, "retired command file is still present", "remove commands/*.md");
    }
  }

  // Positive check on the committed shared package: it should contain plugin.json
  // and the four skills, and none of the retired paths.
  const packageRoot = "plugins/agenticale";
  if (existsSync(join(repositoryRoot, packageRoot))) {
    if (!existsSync(join(repositoryRoot, packageRoot, "plugin.json"))) {
      fail(`${packageRoot}/plugin.json`, "committed package is missing plugin.json", "restore the Agent Plugins manifest");
    }
    for (const name of skillNames) {
      if (!existsSync(join(repositoryRoot, packageRoot, "skills", name, "SKILL.md"))) {
        fail(`${packageRoot}/skills/${name}/SKILL.md`, "committed package is missing a public skill", "restore the generated skill");
      }
    }
    for (const name of ["work", "autonomous"]) {
      const generated = join(packageRoot, "skills", name, "SKILL.md");
      if (!existsSync(join(repositoryRoot, generated))) continue;
      const { fields } = parseFrontmatter(generated, readText(generated));
      for (const [key, value] of fields) {
        if (looksLikeUnquotedColonScalar(value)) {
          fail(generated, `generated frontmatter for '${key}' is invalid YAML (an unquoted scalar contains ": ")`, "quote the value in the authored source");
        }
      }
    }
    for (const name of retiredSkillNames) {
      if (existsSync(join(repositoryRoot, packageRoot, "skills", name))) {
        fail(`${packageRoot}/skills/${name}`, "committed package must not ship a retired skill", "remove the retired skill from the package");
      }
    }
    if (existsSync(join(repositoryRoot, packageRoot, "com.github.copilot"))) {
      fail(`${packageRoot}/com.github.copilot`, "committed package must not ship a per-role Copilot directory", "remove the retired Copilot catalog");
    }
  }

  const obsoleteHelper = ["bin", `git-credential-${"git" + "ea"}`].join("/");
  if (existsSync(join(repositoryRoot, obsoleteHelper))) {
    fail(obsoleteHelper, "obsolete private credential helper is present", "remove it from the public source tree");
  }
}

function walkFiles(directory) {
  if (!existsSync(directory)) return [];
  const results = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) results.push(...walkFiles(absolute));
    else if (entry.isFile()) results.push(absolute);
  }
  return results;
}

function ipv4Octets(host) {
  const parts = host.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return null;
  const octets = parts.map(Number);
  return octets.every((octet) => octet >= 0 && octet <= 255) ? octets : null;
}

function isPrivateOrLoopbackHost(rawHost) {
  const host = rawHost.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  const octets = ipv4Octets(host);
  if (octets) {
    const [first, second] = octets;
    return first === 10
      || first === 127
      || (first === 172 && second >= 16 && second <= 31)
      || (first === 192 && second === 168);
  }

  if (host === "::1") return true;
  const groups = host.split(":");
  return groups.length === 8
    && groups.slice(0, 7).every((group) => /^0{1,4}$/.test(group))
    && /^0{0,3}1$/.test(groups[7]);
}

function privateEndpointHosts(text) {
  const hosts = new Set();
  const endpointEnd = String.raw`(?=$|[\s/?#<>"'\x60),.;!?}])`;
  const url = new RegExp(String.raw`\b[a-z][a-z0-9+.-]*:\/\/(?:[^@\s/?#<>"'\x60]+@)?(\[[^\]\s]+\]|\d{1,3}(?:\.\d{1,3}){3})(?::\d{1,5})?${endpointEnd}`, "gi");
  const ipv4Endpoint = new RegExp(String.raw`(?<![\w.])(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}${endpointEnd}`, "g");
  const ipv6Endpoint = new RegExp(String.raw`\[([^\]\s]+)\]:\d{1,5}${endpointEnd}`, "g");

  for (const pattern of [url, ipv4Endpoint, ipv6Endpoint]) {
    for (const match of text.matchAll(pattern)) {
      if (isPrivateOrLoopbackHost(match[1])) hosts.add(match[1].replace(/^\[|\]$/g, ""));
    }
  }
  return [...hosts];
}

function validateEndpointDetectorContract() {
  const positives = [
    `http://${"10"}.1.2.3/path`,
    `https://${"172"}.16.0.1`,
    `${"172"}.31.255.254:8443`,
    `ws://${"192"}.168.20.4/socket`,
    `tcp://${"127"}.42.0.9:9000`,
    `http://[${"::"}1]:3000`,
    `[${"0:0:0:0:0:0:0:"}1]:443`,
    `(endpoint: http://${"10"}.3.2.1:8080),`,
  ];
  const negatives = [
    `The address ${"10"}.1.2.3 is an example in prose.`,
    `Version ${"10"}.20.30.40`,
    `${"172"}.15.0.1:80`,
    `${"172"}.32.0.1:80`,
    `${"192"}.169.0.1:443`,
    `https://${"8"}.8.8.8/`,
  ];

  for (const fixture of positives) {
    if (privateEndpointHosts(fixture).length === 0) {
      fail("scripts/validate.mjs", "private-endpoint detector rejected a positive fixture", "restore RFC 1918 and loopback endpoint detection");
    }
  }
  for (const fixture of negatives) {
    if (privateEndpointHosts(fixture).length !== 0) {
      fail("scripts/validate.mjs", "private-endpoint detector accepted a negative fixture", "keep detection scoped to private/loopback URL and host:port references");
    }
  }
}

function validateSanitation() {
  const publicRepository = `${"ale" + "franz"}/AgenticAle`;
  const forbidden = [
    "git" + "ea",
    "homehub" + ".casa",
    "Ale" + "Franz",
    "Wants" + "ACracker",
    "code" + "-server",
    "/" + "root/",
    "GIT" + "EA_TOKEN",
    "local" + "host",
  ];

  for (const absolute of walkFiles(repositoryRoot)) {
    const path = portablePath(relative(repositoryRoot, absolute));
    const contents = readFileSync(absolute);
    if (contents.includes(0)) continue;
    const text = contents.toString("utf8");
    const screenedText = text.toLowerCase()
      .replaceAll(`https://github.com/${publicRepository}`.toLowerCase(), "PUBLIC_REPOSITORY")
      .replaceAll(publicRepository.toLowerCase(), "PUBLIC_REPOSITORY");
    for (const term of forbidden) {
      if (screenedText.includes(term.toLowerCase())) {
        fail(path, `forbidden personal/environment reference '${term}'`, "replace it with portable public guidance");
      }
    }
    const endpointHosts = privateEndpointHosts(text);
    if (endpointHosts.length > 0) {
      fail(path, `private or loopback endpoint host '${endpointHosts.join("', '")}'`, "replace it with a public example endpoint or portable placeholder");
    }
  }
}

validateEndpointDetectorContract();
validateBundleSurface();
validateSkillWork();
validateSkillAutonomous();
validateSkillSourceLookup();
validateSkillPullRequest();
validateRoutingContract();
validateAdapter();
validateNeutralContracts();
validateSanitation();

if (failures.length > 0) {
  console.error(`Validation failed with ${failures.length} issue${failures.length === 1 ? "" : "s"}:`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Validation passed: ${requiredPaths.length} source-of-truth files, ${taskContracts.length} neutral task contracts, routing contract, ${profileNames.length} adapter profiles, and sanitation.`);
}
