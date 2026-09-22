#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");

const roles = new Map([
  ["consult", { steps: "20", readOnly: true }],
  ["deep-review", { steps: "72", readOnly: false }],
  ["explore", { steps: "24", readOnly: true }],
  ["fix", { steps: "48", readOnly: false }],
  ["implement-hard", { steps: "64", readOnly: false }],
  ["implement", { steps: "64", readOnly: false }],
  ["review", { steps: "56", readOnly: false }],
]);

const expectedBundleFiles = [
  ...[...roles.keys()].map((role) => `agents/autonomous/${role}.md`),
  "commands/autonomous.md",
  "skills/autonomous-mode/SKILL.md",
  "skills/pull-request-description/SKILL.md",
  "skills/source-code-lookup/SKILL.md",
].sort();

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

function parseFrontmatter(path, text) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  if (lines[0] !== "---") {
    fail(path, "missing opening frontmatter delimiter", "start the file with ---");
    return { fields: new Map(), permissions: [], body: text };
  }

  const close = lines.indexOf("---", 1);
  if (close < 0) {
    fail(path, "missing closing frontmatter delimiter", "add --- before the Markdown body");
    return { fields: new Map(), permissions: [], body: "" };
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
      fields.set(key, rawValue.trim());
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

    fail(path, `unsupported or malformed frontmatter line ${index + 1}: ${line.trim()}`, "use the documented scalar fields and permission-list indentation");
  }

  return { fields, permissions, metadata, body: lines.slice(close + 1).join("\n") };
}

function requireExactKeys(path, fields, expected) {
  for (const key of expected) {
    if (!fields.has(key)) fail(path, `missing required frontmatter key '${key}'`, `add ${key}: ...`);
  }
  for (const key of fields.keys()) {
    if (!expected.includes(key)) fail(path, `unsupported frontmatter key '${key}'`, `remove it or update the public bundle contract intentionally`);
  }
}

function validatePermission(path, permissions, action) {
  const matching = permissions.filter((entry) => entry.action === action);
  if (matching.length !== 1 || matching[0].resource !== "*" || matching[0].effect !== "deny") {
    fail(path, `role must deny '${action}' for resource '*' exactly once`, `restore the ${action} deny permission`);
  }
}

function validateExactPermissions(path, permissions, expectedActions) {
  const actualActions = permissions.map((entry) => entry.action).filter(Boolean).sort();
  const expected = [...expectedActions].sort();
  if (actualActions.join("\n") !== expected.join("\n")) {
    fail(path, `permission actions must be exactly: ${expected.join(", ")}`, "remove extra entries and restore missing denies");
  }
}

function validateAgent(role, contract) {
  const path = `agents/autonomous/${role}.md`;
  const text = readText(path);
  const { fields, permissions, body } = parseFrontmatter(path, text);
  requireExactKeys(path, fields, ["description", "mode", "steps", "permissions"]);

  if (!fields.get("description")) fail(path, "description must not be empty", "describe the role in one scalar line");
  if (fields.get("mode") !== "subagent") fail(path, "mode must be 'subagent'", "restore mode: subagent");
  if (fields.get("steps") !== contract.steps) fail(path, `steps must be ${contract.steps} for this role`, `restore steps: ${contract.steps}`);
  if (fields.get("permissions") !== "") fail(path, "permissions must be a block list", "put permission entries on indented lines");

  for (const entry of permissions) {
    if (!entry.action || !entry.resource || !entry.effect) {
      fail(path, "each permission needs action, resource, and effect", "complete the permission entry");
    }
  }
  validateExactPermissions(path, permissions, contract.readOnly ? ["subagent", "edit", "question"] : ["subagent", "question"]);
  validatePermission(path, permissions, "subagent");
  validatePermission(path, permissions, "question");
  if (contract.readOnly) validatePermission(path, permissions, "edit");

  if (!/unattended in a child session/i.test(body)) fail(path, "role body must state that the child is unattended", "restore the non-interactive child-session guard");
  if (!/Never use the\s+`question`\s+tool/i.test(body)) fail(path, "role body must forbid the question tool", "restore the explicit question-tool instruction");
}

function validateSkill() {
  const path = "skills/autonomous-mode/SKILL.md";
  const text = readText(path);
  const { fields, metadata, body } = parseFrontmatter(path, text);
  requireExactKeys(path, fields, ["name", "description", "version", "slash", "metadata"]);
  if (fields.get("name") !== "Autonomous Mode") fail(path, "name must be 'Autonomous Mode'", "restore the public skill name");
  if (!fields.get("description")) fail(path, "description must not be empty", "add the skill routing description");
  if (!/^[1-9]\d*$/.test(fields.get("version") ?? "")) fail(path, "version must be a positive integer", "use version: <integer>");
  if (fields.get("slash") !== "false") fail(path, "skill must not create a second slash entry", "set slash: false");
  if (fields.get("metadata") !== "" || metadata.size !== 1 || metadata.get("opencode/autoinvoke") !== "false") {
    fail(path, "skill must disable automatic invocation", "set metadata.opencode/autoinvoke to false");
  }

  for (const role of roles.keys()) {
    if (!body.includes(`\`autonomous/${role}\``)) {
      fail(path, `missing routing reference to autonomous/${role}`, `add the role to the agent-routing contract`);
    }
  }
}

function validateSourceLookupSkill() {
  const path = "skills/source-code-lookup/SKILL.md";
  const { fields, body } = parseFrontmatter(path, readText(path));
  requireExactKeys(path, fields, ["name", "description"]);
  if (fields.get("name") !== "source-code-lookup") fail(path, "skill name must match its folder", "set name: source-code-lookup");
  if (!fields.get("description")) fail(path, "description must not be empty", "describe when source lookup applies");
  if (body.split('Source root: "~/dev"').length !== 2) {
    fail(path, "skill must contain one installer source-root marker", 'keep one Source root: "~/dev" line');
  }
}

function validatePullRequestDescriptionSkill() {
  const path = "skills/pull-request-description/SKILL.md";
  const { fields, body } = parseFrontmatter(path, readText(path));
  requireExactKeys(path, fields, ["name", "description"]);
  if (fields.get("name") !== "pull-request-description") {
    fail(path, "skill name must match its folder", "set name: pull-request-description");
  }
  if (!fields.get("description")) fail(path, "description must not be empty", "describe when the skill applies");
  if (!/why/i.test(body) || !/validation/i.test(body)) {
    fail(path, "skill must cover intent and selective validation", "restore the PR narrative guidance");
  }
}

function validateCommand() {
  const path = "commands/autonomous.md";
  const text = readText(path);
  const { fields, body } = parseFrontmatter(path, text);
  requireExactKeys(path, fields, ["description", "agent"]);
  if (!fields.get("description")) fail(path, "description must not be empty", "describe the command in one scalar line");
  if (fields.get("agent") !== "build") fail(path, "agent must be 'build'", "restore agent: build");
  if (!body.includes("autonomous-mode skill")) fail(path, "command does not route to the autonomous-mode skill", "restore the explicit skill invocation");
  if (!body.includes("`autonomous/*`")) fail(path, "command does not route through the installed autonomous roles", "restore the autonomous/* routing instruction");
  if (!body.includes("$ARGUMENTS")) fail(path, "command does not accept the full goal text", "pass $ARGUMENTS to the coordinator");
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

function validateBundleSurface() {
  const actual = ["agents", "skills", "commands"]
    .flatMap((directory) => walkFiles(join(repositoryRoot, directory)))
    .map((path) => portablePath(relative(repositoryRoot, path)))
    .sort();

  for (const path of expectedBundleFiles) {
    if (!actual.includes(path)) fail(path, "required OpenCode V2 bundle file is missing", "restore it from the canonical public bundle");
  }
  for (const path of actual) {
    if (!expectedBundleFiles.includes(path)) fail(path, "unexpected file in the installable bundle", "remove stale/generated files or add the file to the public contract intentionally");
  }

  const obsoleteHelper = ["bin", `git-credential-${"git" + "ea"}`].join("/");
  if (existsSync(join(repositoryRoot, obsoleteHelper))) {
    fail(obsoleteHelper, "obsolete private credential helper is present", "remove it from the public source tree");
  }
}

function validateNeutrality() {
  const providerPatterns = [
    new RegExp(`${"open" + "ai"}/`, "i"),
    new RegExp(`${"anth" + "ropic"}/`, "i"),
    new RegExp(`${"google"}/(?:${"gem" + "ini"})`, "i"),
    new RegExp(`${"gpt"}-\\d`, "i"),
    new RegExp(`${"cla" + "ude"}-`, "i"),
    new RegExp(`${"gem" + "ini"}-`, "i"),
  ];

  for (const path of expectedBundleFiles) {
    if (!existsSync(join(repositoryRoot, path))) continue;
    const text = readText(path);
    const frontmatterEnd = text.indexOf("\n---", 4);
    const frontmatter = frontmatterEnd >= 0 ? text.slice(0, frontmatterEnd) : text;
    if (/^model\s*:/mi.test(frontmatter)) fail(path, "public defaults must not set a model", "remove model frontmatter so the active OpenCode model is inherited");
    for (const pattern of providerPatterns) {
      if (pattern.test(text)) fail(path, `provider-specific model reference matches ${pattern}`, "use capability-neutral wording and no provider/model identifier");
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

for (const [role, contract] of roles) {
  const path = `agents/autonomous/${role}.md`;
  if (existsSync(join(repositoryRoot, path)) && statSync(join(repositoryRoot, path)).isFile()) validateAgent(role, contract);
}
if (existsSync(join(repositoryRoot, "skills/autonomous-mode/SKILL.md"))) validateSkill();
if (existsSync(join(repositoryRoot, "skills/pull-request-description/SKILL.md"))) validatePullRequestDescriptionSkill();
if (existsSync(join(repositoryRoot, "skills/source-code-lookup/SKILL.md"))) validateSourceLookupSkill();
if (existsSync(join(repositoryRoot, "commands/autonomous.md"))) validateCommand();
validateNeutrality();
validateSanitation();

if (failures.length > 0) {
  console.error(`Validation failed with ${failures.length} issue${failures.length === 1 ? "" : "s"}:`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Validation passed: ${expectedBundleFiles.length} OpenCode V2 bundle files, ${roles.size} role contracts, routing, neutrality, and sanitation.`);
}
