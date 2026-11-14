#!/usr/bin/env node
// Flat model configuration: a JSON object mapping a worker role to
// "provider/model" or "provider/model#effort", plus the optional top-level
// "coordinator" key that assigns the session coordinator (a session
// assignment, not a child worker role). Missing worker roles inherit the
// session model; there are no tiers, fallbacks, runtimes, or profiles. This
// module owns the role list, the effort levels, the preset-name mapping, and
// the loader/validator that the build, the installers, and the validator all
// share, so one schema is enforced everywhere.

import { dirname, join, resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");

// The nine child worker roles. The seven base roles always render an OpenCode
// profile (inheriting the session model when unlisted); the two optional
// roles render a profile only when the config lists them explicitly.
export const roles = [
  "explore",
  "implement",
  "implement-easy",
  "implement-hard",
  "fix",
  "review",
  "review-deep",
  "consult",
  "consult-hard",
];
export const roleSet = new Set(roles);
export const optionalRoles = ["implement-easy", "consult-hard"];
export const optionalRoleSet = new Set(optionalRoles);
// The session coordinator assignment is a distinct top-level config key, not
// a worker role: it selects the model of the coordinating session itself.
export const coordinatorKey = "coordinator";
export const effortLevels = ["low", "medium", "high", "xhigh", "max"];
export const effortSet = new Set(effortLevels);

// Bundled presets: a preset name maps to an examples/ file in the repository.
export const modelPresets = new Map([
  ["example", "examples/example.json"],
  ["local", "examples/local.json"],
  ["openai", "examples/openai.json"],
  ["gpt", "examples/gpt.json"],
  ["zen", "examples/gpt.json"],
]);

// The packaged default: the flat model config the build uses when no
// --models or --no-model option is given.
export const DEFAULT_MODEL_CONFIG = "adapters/opencode/models.json";

// Parse the string form of one role's value: "provider/model" or
// "provider/model#effort". Returns { model, effort } where effort is null
// when the value carries none. The value is written verbatim into generated
// frontmatter (as one "provider/model[#variant]" model line), so whitespace
// and control characters are rejected outright.
export function parseModelValue(value, role) {
  const label = `Model for role '${role}'`;
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string of the form "provider/model[#effort]"; got ${JSON.stringify(value)}.`);
  }
  if (/[\u0000-\u001f\u007f\s]/.test(value)) {
    throw new Error(`${label} must not contain whitespace or control characters (it is written verbatim into generated frontmatter): ${JSON.stringify(value)}.`);
  }
  const hashIndex = value.indexOf("#");
  const modelPart = hashIndex === -1 ? value : value.slice(0, hashIndex);
  const effortPart = hashIndex === -1 ? null : value.slice(hashIndex + 1);
  const slashIndex = modelPart.indexOf("/");
  if (slashIndex <= 0 || slashIndex === modelPart.length - 1) {
    throw new Error(`${label} must be "provider/model[#effort]" with non-empty provider and model components; got '${value}'.`);
  }
  if (effortPart !== null && !effortSet.has(effortPart)) {
    throw new Error(`${label} has an invalid reasoning effort '${effortPart}' (expected one of ${effortLevels.join(", ")}): '${value}'.`);
  }
  return { model: modelPart, effort: effortPart };
}

// The verbatim frontmatter form of a parsed assignment: one
// "provider/model[#variant]" value (OpenCode V2 carries the variant on the
// model line; there is no separate reasoningEffort field).
export function formatModelValue(assignment) {
  return assignment.effort ? `${assignment.model}#${assignment.effort}` : assignment.model;
}

// Resolve a --models value: a bundled preset name maps to its examples/
// file; the packaged default resolves against the repository root (so a
// build from any CWD finds it); anything else is a caller path, relative
// to the caller's CWD or absolute.
export function resolveModelPath(value) {
  if (value === DEFAULT_MODEL_CONFIG) return join(repositoryRoot, value);
  const preset = modelPresets.get(value.toLowerCase());
  return preset ? join(repositoryRoot, preset) : resolve(value);
}

// Load and validate a flat model config from a path or a preset name.
// Returns { config, coordinator, sourcePath } where config maps each present
// worker role to { model, effort } (effort null when absent) and coordinator
// is the parsed session-coordinator assignment or null. Every failure names
// the offending role and value. Missing worker roles are legal: they inherit.
export async function loadModelConfig(value) {
  const sourcePath = resolveModelPath(value);
  let text;
  try {
    text = await readFile(sourcePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`Model config file not found: ${sourcePath}.`);
    }
    throw error;
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Model config is not valid JSON: ${sourcePath}.`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Model config must be a JSON object mapping roles to "provider/model[#effort]" values: ${sourcePath}.`);
  }
  const config = {};
  let coordinator = null;
  for (const [role, rawValue] of Object.entries(parsed)) {
    if (role === coordinatorKey) {
      coordinator = parseModelValue(rawValue, coordinatorKey);
      continue;
    }
    if (!roleSet.has(role)) {
      const renameHint = role === "deep-review" ? " The 'deep-review' role was renamed to 'review-deep'." : "";
      throw new Error(`Unknown role in model config ${sourcePath}: '${role}' (expected one of ${roles.join(", ")}).${renameHint}`);
    }
    config[role] = parseModelValue(rawValue, role);
  }
  return { config, coordinator, sourcePath };
}
