#!/usr/bin/env node
/**
 * AgenticAle shared routing module.
 *
 * Packaged alongside the work skill and installed with it. Dependency-free
 * (Node builtins only, ESM) so it runs from an installed fixture with no
 * repository source present: the installed baseline is resolved relative to
 * this file, never relative to a checkout.
 *
 * This is the deterministic core of the routing contract described in
 * references/ROUTING.md:
 *   - version-1 (complete policy) and version-2 (defaults baseline) validation
 *   - structured preference-layer merging (lowest to highest precedence,
 *     atomic entry replacement, tier/role sections merged separately)
 *   - named routing profile selection and merging (optional per-layer profiles expand into extra precedence-ordered sub-layers)
 *   - version-1 policy normalization to role exceptions over version-2 tiers
 *   - concrete route resolution with source/provenance labels and reset
 *     semantics (`role: default`, `tier: default`, `inherit`)
 *   - the Work worker-round allowance: an optional `work` key on the
 *     version-2 baseline and on preference layers (default eight), resolved
 *     with the same layer precedence and reported with its source
 *   - strict version-1 export (compatible with the existing validator)
 *   - a `resolve` CLI that reads the installed baseline and an optional
 *     structured invocation patch, then exports the active runtime
 *   - a `startup` CLI fast path that probes the documented preference
 *     locations without reading them and either reports that interpretation
 *     is required or resolves the installed baseline directly, comparing the
 *     opencode routes (or an explicit --agents-dir) against the installed
 *     agent profiles
 *
 * Users express preferences in a preferences.md preference file (routing.md
 * remains accepted at each scope as a legacy name). When both files exist at
 * the same scope, preferences.md is the effective file and routing.md is
 * ignored. The workflow interprets the effective file into a structured
 * invocation patch for this deterministic resolver. The file's optional
 * top-level `## Work` section sets the Work workflow's worker-round
 * allowance; the workflow interprets it as a layer-level `work` key. It is
 * not runtime- or profile-scoped, and it changes only the available worker
 * rounds of the Work workflow, never how many rounds must run or any other
 * budget.
 */

import { constants, readFileSync } from "node:fs";
import { access, lstat, readFile, realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { basename, join, resolve } from "node:path";

// The seven exposed role names are compatibility commitments. New roles
// require a packaged tier mapping (and a versioned contract change), not a
// silent rename.
export const ROLES = [
  "explore",
  "implement",
  "implement-hard",
  "fix",
  "review",
  "deep-review",
  "consult",
];

export const RUNTIME_KEYS = ["copilot", "codex", "opencode", "antigravity"];

export const RUNTIME_CAPABILITIES = {
  copilot: { effort: true },
  codex: { effort: true },
  opencode: { effort: true },
  antigravity: { effort: false },
};

export function runtimeSupportsEffort(runtime) {
  return Boolean(RUNTIME_CAPABILITIES[runtime]?.effort);
}

export const EFFORT_LEVELS = ["low", "medium", "high", "xhigh", "max"];
const effortLevels = new Set(EFFORT_LEVELS);

// The standard tiers every installed baseline declares. Users may define
// additional named tiers; `default` and `inherit` are reserved instructions,
// not tier names.
export const STANDARD_TIERS = ["fast", "routine", "standard", "deep"];
export const RESERVED_INSTRUCTION_NAMES = ["default", "inherit"];

// Provenance label for entries that come from the installed (packaged or
// customized) baseline.
export const BASELINE_SOURCE = "installed baseline";

// The Work workflow's worker-round allowance when neither the installed
// baseline nor a preference layer declares a `work` budget: eight available
// worker rounds. The allowance is what is available, never what is required,
// and it applies to the Work workflow only.
export const DEFAULT_WORK_BUDGET = { workerRounds: 8 };

const TOP_LEVEL_V1_KEYS = ["provenance", "runtimes", "schemaVersion"];
const TOP_LEVEL_V2_KEYS = ["provenance", "roleTiers", "runtimes", "schemaVersion", "work"];
const EXPLICIT_ENTRY_KEYS = ["fallbacks", "mode", "model", "reasoningEffort"];
const EXPLICIT_ENTRY_KEYS_NO_EFFORT = ["fallbacks", "mode", "model"];
const INHERIT_ENTRY_KEYS = ["mode"];
const RESET_ENTRY_KEYS = ["mode"];
const ROLE_TIER_ENTRY_KEYS = ["mode", "tier"];
const LAYER_KEYS = ["profiles", "runtimes", "source", "work"];
const RUNTIME_LAYER_KEYS = ["roles", "tiers"];

// Named routing profile identifiers: 1-40 characters, starting with a
// lowercase letter, then lowercase letters, digits, or hyphens, with no
// trailing hyphen. `default` and `inherit` are reserved instructions, so a
// selected `default` means ordinary routing while any other invalid name is
// an error. Profile names in preference files are data: they are never
// rejected there, and reserved names are simply excluded from availability.
export function isValidProfileName(name) {
  return (
    typeof name === "string"
    && /^[a-z][a-z0-9-]{0,39}$/.test(name)
    && !name.endsWith("-")
    && !RESERVED_INSTRUCTION_NAMES.includes(name)
  );
}

export class RoutingError extends Error {
  constructor(message) {
    super(message);
    this.name = "RoutingError";
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Validates the optional work budget ({ workerRounds }) shared by the
// version-2 baseline and the structured preference layers: a plain object
// whose only allowed key is workerRounds, a positive integer — the Work
// workflow's worker-round allowance. Invalid values are actionable errors
// naming the label and the offending value; they are never silently
// defaulted or clamped.
function checkWorkBudget(label, work) {
  if (!isPlainObject(work)) {
    throw new RoutingError(`${label} work, when present, must be a JSON object (got ${JSON.stringify(work)}).`);
  }
  for (const key of Object.keys(work)) {
    if (key !== "workerRounds") {
      throw new RoutingError(`${label} work has unknown key '${key}' (expected only workerRounds).`);
    }
  }
  const rounds = work.workerRounds;
  if (!Number.isInteger(rounds) || rounds < 1) {
    throw new RoutingError(`${label} work.workerRounds must be an integer of at least 1 (the Work worker-round allowance; got ${JSON.stringify(rounds)}).`);
  }
}

function checkFallbacks(label, fallbacks, runtime) {
  if (!Array.isArray(fallbacks)) {
    throw new RoutingError(`${label} fallbacks must be an array.`);
  }
  const supportsEffort = runtime ? runtimeSupportsEffort(runtime) : true;
  const requiredKeys = supportsEffort ? ["model", "reasoningEffort"] : ["model"];
  fallbacks.forEach((pair, index) => {
    if (!isPlainObject(pair)) {
      throw new RoutingError(`${label} fallback ${index} must be a ${supportsEffort ? "{ model, reasoningEffort }" : "{ model }"} pair.`);
    }
    if (!supportsEffort && pair.reasoningEffort !== undefined) {
      throw new RoutingError(`${label} fallback ${index} must not include reasoningEffort for runtime '${runtime}' (runtime does not support effort).`);
    }
    if (JSON.stringify(Object.keys(pair).sort()) !== JSON.stringify(requiredKeys)) {
      throw new RoutingError(`${label} fallback ${index} must be a ${supportsEffort ? "{ model, reasoningEffort }" : "{ model }"} pair.`);
    }
    if (typeof pair.model !== "string" || pair.model.length === 0) {
      throw new RoutingError(`${label} fallback ${index} requires a non-empty model.`);
    }
    if (supportsEffort) {
      if (!effortLevels.has(pair.reasoningEffort)) {
        throw new RoutingError(`${label} fallback ${index} has unsupported effort '${pair.reasoningEffort}'.`);
      }
    }
  });
}

// Validates the explicit/inherit selection shape shared by version-1 routes,
// version-2 tier definitions, and version-2 role selections.
function checkSelectionEntry(label, entry, runtime) {
  if (entry.mode === "explicit") {
    const supportsEffort = runtime ? runtimeSupportsEffort(runtime) : true;
    if (!supportsEffort && entry.reasoningEffort !== undefined) {
      throw new RoutingError(`${label} explicit entry must not include reasoningEffort for runtime '${runtime}' (runtime does not support effort).`);
    }
    const expectedKeys = supportsEffort ? EXPLICIT_ENTRY_KEYS : EXPLICIT_ENTRY_KEYS_NO_EFFORT;
    if (JSON.stringify(Object.keys(entry).sort()) !== JSON.stringify(expectedKeys)) {
      throw new RoutingError(`${label} explicit entry must carry exactly: ${expectedKeys.join(", ")}.`);
    }
    if (typeof entry.model !== "string" || entry.model.length === 0) {
      throw new RoutingError(`${label} explicit route requires a non-empty model.`);
    }
    if (supportsEffort) {
      if (!effortLevels.has(entry.reasoningEffort)) {
        throw new RoutingError(`${label} explicit route requires a supported reasoningEffort (got '${entry.reasoningEffort}').`);
      }
    }
    checkFallbacks(label, entry.fallbacks, runtime);
  } else if (entry.mode === "inherit") {
    if (JSON.stringify(Object.keys(entry).sort()) !== JSON.stringify(INHERIT_ENTRY_KEYS)) {
      throw new RoutingError(`${label} inherit entry must carry only 'mode'.`);
    }
  } else {
    throw new RoutingError(`${label} has invalid mode '${entry.mode}'.`);
  }
}

function validateTierDefinition(label, entry, { allowDefault, runtime } = {}) {
  if (!isPlainObject(entry)) {
    throw new RoutingError(`${label} must be an object.`);
  }
  if (entry.mode === "default") {
    if (!allowDefault) {
      throw new RoutingError(`${label} mode 'default' is a preference reset and is not allowed in a baseline.`);
    }
    if (JSON.stringify(Object.keys(entry).sort()) !== JSON.stringify(RESET_ENTRY_KEYS)) {
      throw new RoutingError(`${label} reset entry must carry only 'mode'.`);
    }
    return;
  }
  checkSelectionEntry(label, entry, runtime);
}

function validateRoleEntry(label, entry, { allowDefault, runtime } = {}) {
  if (!isPlainObject(entry)) {
    throw new RoutingError(`${label} must be an object.`);
  }
  if (entry.mode === "default") {
    if (!allowDefault) {
      throw new RoutingError(`${label} mode 'default' is a preference reset and is not allowed in a baseline.`);
    }
    if (JSON.stringify(Object.keys(entry).sort()) !== JSON.stringify(RESET_ENTRY_KEYS)) {
      throw new RoutingError(`${label} reset entry must carry only 'mode'.`);
    }
    return;
  }
  if (entry.mode === "tier") {
    if (JSON.stringify(Object.keys(entry).sort()) !== JSON.stringify(ROLE_TIER_ENTRY_KEYS)) {
      throw new RoutingError(`${label} tier reference must carry exactly: mode, tier.`);
    }
    if (typeof entry.tier !== "string" || entry.tier.length === 0) {
      throw new RoutingError(`${label} tier reference requires a non-empty tier name.`);
    }
    if (RESERVED_INSTRUCTION_NAMES.includes(entry.tier)) {
      throw new RoutingError(`${label} tier reference uses reserved instruction name '${entry.tier}'.`);
    }
    return;
  }
  checkSelectionEntry(label, entry, runtime);
}

// The single authoritative version-1 policy schema (moved out of the builder).
// A version-1 policy is complete and strict: every declared runtime maps
// exactly the seven roles; explicit routes carry a non-empty model, a
// supported effort, and an ordered fallbacks list of { model, reasoningEffort }
// pairs; inherit routes carry only `mode`. Exact native identifiers and the
// per-host effort set are adapter concerns.
export function strictValidateRouting(routing) {
  if (!routing || typeof routing !== "object" || Array.isArray(routing)) {
    throw new Error("Routing must be a JSON object.");
  }
  if (routing.schemaVersion !== 1) throw new Error("Routing schemaVersion must be 1.");
  for (const key of Object.keys(routing)) {
    if (!TOP_LEVEL_V1_KEYS.includes(key)) {
      throw new Error(`Routing has unknown top-level key '${key}'.`);
    }
  }
  if (routing.provenance !== undefined && (typeof routing.provenance !== "string" || routing.provenance.length === 0)) {
    throw new Error("Routing provenance, when present, must be a non-empty string.");
  }
  if (!routing.runtimes || typeof routing.runtimes !== "object" || Array.isArray(routing.runtimes)) {
    throw new Error("Routing must include a runtimes object.");
  }
  const runtimeKeys = Object.keys(routing.runtimes);
  if (runtimeKeys.length === 0) throw new Error("Routing must declare at least one runtime.");
  for (const runtime of runtimeKeys) {
    if (!RUNTIME_KEYS.includes(runtime)) throw new Error(`Routing declares unsupported runtime '${runtime}'.`);
  }
  for (const runtime of runtimeKeys) {
    const map = routing.runtimes[runtime];
    if (!map || typeof map !== "object" || Array.isArray(map)) {
      throw new Error(`Routing runtime '${runtime}' must be an object of route entries.`);
    }
    const declaredKeys = Object.keys(map).sort();
    if (JSON.stringify(declaredKeys) !== JSON.stringify([...ROLES].sort())) {
      throw new Error(`Routing runtime '${runtime}' must map exactly the ${ROLES.length} keys: ${[...ROLES].sort().join(", ")}.`);
    }
    const supportsEffort = runtimeSupportsEffort(runtime);
    const expectedKeys = supportsEffort ? EXPLICIT_ENTRY_KEYS : EXPLICIT_ENTRY_KEYS_NO_EFFORT;
    const fallbackKeys = supportsEffort ? ["model", "reasoningEffort"] : ["model"];
    for (const role of ROLES) {
      const entry = map[role];
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        throw new Error(`Routing ${runtime}/${role} must be an object.`);
      }
      if (entry.mode === "explicit") {
        if (!supportsEffort && entry.reasoningEffort !== undefined) {
          throw new Error(`Routing ${runtime}/${role} explicit route must not specify reasoningEffort.`);
        }
        if (JSON.stringify(Object.keys(entry).sort()) !== JSON.stringify(expectedKeys)) {
          throw new Error(`Routing ${runtime}/${role} explicit entry must carry exactly: ${expectedKeys.join(", ")}.`);
        }
        if (typeof entry.model !== "string" || entry.model.length === 0) {
          throw new Error(`Routing ${runtime}/${role} explicit route requires a non-empty model.`);
        }
        if (supportsEffort) {
          if (!effortLevels.has(entry.reasoningEffort)) {
            throw new Error(`Routing ${runtime}/${role} explicit route requires a supported reasoningEffort (got '${entry.reasoningEffort}').`);
          }
        }
        if (!Array.isArray(entry.fallbacks)) {
          throw new Error(`Routing ${runtime}/${role} fallbacks must be an array.`);
        }
        entry.fallbacks.forEach((pair, index) => {
          if (!pair || typeof pair !== "object" || Array.isArray(pair)) {
            throw new Error(`Routing ${runtime}/${role} fallback ${index} must be a ${supportsEffort ? "{ model, reasoningEffort }" : "{ model }"} pair.`);
          }
          if (!supportsEffort && pair.reasoningEffort !== undefined) {
            throw new Error(`Routing ${runtime}/${role} fallback ${index} must not specify reasoningEffort.`);
          }
          if (JSON.stringify(Object.keys(pair).sort()) !== JSON.stringify(fallbackKeys)) {
            throw new Error(`Routing ${runtime}/${role} fallback ${index} must be a ${supportsEffort ? "{ model, reasoningEffort }" : "{ model }"} pair.`);
          }
          if (typeof pair.model !== "string" || pair.model.length === 0) {
            throw new Error(`Routing ${runtime}/${role} fallback ${index} requires a non-empty model.`);
          }
          if (supportsEffort) {
            if (!effortLevels.has(pair.reasoningEffort)) {
              throw new Error(`Routing ${runtime}/${role} fallback ${index} has unsupported effort '${pair.reasoningEffort}'.`);
            }
          }
        });
      } else if (entry.mode === "inherit") {
        if (JSON.stringify(Object.keys(entry).sort()) !== JSON.stringify(INHERIT_ENTRY_KEYS)) {
          throw new Error(`Routing ${runtime}/${role} inherit entry must carry only 'mode'.`);
        }
      } else {
        throw new Error(`Routing ${runtime}/${role} has invalid mode '${entry.mode}'.`);
      }
    }
  }
}

// Validates the builder's routing inputs (packaged, imported, caller-supplied).
export function validateRouting(routing) {
  strictValidateRouting(routing);
}

// Validates the version-2 defaults-baseline machine contract: a common
// role-to-tier map plus per-runtime tier definitions and optional role
// exceptions. Reset instructions (`default`) are preference-patch operations
// and are not allowed in a baseline.
export function validateV2Routing(routing) {
  if (!routing || typeof routing !== "object" || Array.isArray(routing)) {
    throw new RoutingError("Routing must be a JSON object.");
  }
  if (routing.schemaVersion !== 2) throw new RoutingError("Routing schemaVersion must be 2.");
  for (const key of Object.keys(routing)) {
    if (!TOP_LEVEL_V2_KEYS.includes(key)) {
      throw new RoutingError(`Routing has unknown top-level key '${key}'.`);
    }
  }
  if (routing.provenance !== undefined && (typeof routing.provenance !== "string" || routing.provenance.length === 0)) {
    throw new RoutingError("Routing provenance, when present, must be a non-empty string.");
  }
  if (routing.work !== undefined) {
    checkWorkBudget("Routing", routing.work);
  }
  if (!isPlainObject(routing.roleTiers)) {
    throw new RoutingError("Routing must include a roleTiers map.");
  }
  for (const [role, tier] of Object.entries(routing.roleTiers)) {
    if (!ROLES.includes(role)) {
      throw new RoutingError(`roleTiers has unknown role '${role}' (expected one of ${ROLES.join(", ")}).`);
    }
    if (typeof tier !== "string" || tier.length === 0) {
      throw new RoutingError(`roleTiers['${role}'] must be a non-empty tier name.`);
    }
    if (RESERVED_INSTRUCTION_NAMES.includes(tier)) {
      throw new RoutingError(`roleTiers['${role}'] uses reserved instruction name '${tier}' (not a tier name).`);
    }
  }
  if (Object.keys(routing.roleTiers).length !== ROLES.length) {
    throw new RoutingError(`roleTiers must map exactly the ${ROLES.length} roles: ${ROLES.join(", ")}.`);
  }
  if (!isPlainObject(routing.runtimes)) {
    throw new RoutingError("Routing must include a runtimes object.");
  }
  const runtimeKeys = Object.keys(routing.runtimes);
  if (runtimeKeys.length === 0) throw new RoutingError("Routing must declare at least one runtime.");
  for (const runtime of runtimeKeys) {
    if (!RUNTIME_KEYS.includes(runtime)) throw new RoutingError(`Routing declares unsupported runtime '${runtime}'.`);
  }
  for (const runtime of runtimeKeys) {
    const map = routing.runtimes[runtime];
    if (!isPlainObject(map)) {
      throw new RoutingError(`Routing runtime '${runtime}' must be an object.`);
    }
    for (const key of Object.keys(map)) {
      if (!["tiers", "roles"].includes(key)) {
        throw new RoutingError(`Routing runtime '${runtime}' has unknown key '${key}' (expected tiers, roles).`);
      }
    }
    const tiers = map.tiers ?? {};
    if (!isPlainObject(tiers) || Object.keys(tiers).length === 0) {
      throw new RoutingError(`Routing runtime '${runtime}' must declare at least one tier.`);
    }
    for (const [name, entry] of Object.entries(tiers)) {
      if (name.length === 0) {
        throw new RoutingError(`Routing runtime '${runtime}' has an empty tier name.`);
      }
      if (RESERVED_INSTRUCTION_NAMES.includes(name)) {
        throw new RoutingError(`Routing runtime '${runtime}' uses reserved tier name '${name}' (a tier cannot be named 'default' or 'inherit').`);
      }
      validateTierDefinition(`Routing ${runtime}/tier '${name}'`, entry, { allowDefault: false, runtime });
    }
    const roles = map.roles ?? {};
    if (!isPlainObject(roles)) {
      throw new RoutingError(`Routing runtime '${runtime}' roles must be an object.`);
    }
    for (const [role, entry] of Object.entries(roles)) {
      if (!ROLES.includes(role)) {
        throw new RoutingError(`Routing ${runtime}/roles has unknown role '${role}' (expected one of ${ROLES.join(", ")}).`);
      }
      validateRoleEntry(`Routing ${runtime}/role '${role}'`, entry, { allowDefault: false, runtime });
    }
  }
}

// Validates one structured preference layer and returns its normalized form
// { source, runtimes, profiles, work }. A runtime filter validates only the
// active runtime. Profile contents are NOT validated here: entries of an
// unselected profile must never block an otherwise valid selection; non-object
// profile values are dropped so they are unavailable but never errors. The
// layer-level `work` budget (the Work worker-round allowance) is validated
// for every layer regardless of the runtime filter and profile selection: it
// is not runtime- or profile-scoped.
export function validatePreferenceLayer(layer, index, options = {}) {
  const activeRuntime = options.runtime;
  const label = options.label ?? `Preference layer ${index + 1}`;
  if (!isPlainObject(layer)) {
    throw new RoutingError(`${label} must be a JSON object.`);
  }
  for (const key of Object.keys(layer)) {
    if (!LAYER_KEYS.includes(key)) {
      throw new RoutingError(`${label} has unknown key '${key}' (expected source, runtimes, profiles, work).`);
    }
  }
  if (layer.source !== undefined && (typeof layer.source !== "string" || layer.source.length === 0)) {
    throw new RoutingError(`${label} source, when present, must be a non-empty string.`);
  }
  // The work allowance is a user-facing budget, so its diagnostics name the
  // layer's source (e.g. "project preferences.md") when one is set, falling
  // back to the generic label otherwise. Other layer diagnostics keep the
  // generic label.
  const workLabel = typeof layer.source === "string" && layer.source.length > 0 ? layer.source : label;
  if (layer.work !== undefined) {
    checkWorkBudget(workLabel, layer.work);
  }
  const runtimes = layer.runtimes;
  if (runtimes !== undefined && (!isPlainObject(runtimes) || Object.keys(runtimes).length === 0)) {
    throw new RoutingError(`${label} runtimes, when present, must be a non-empty object.`);
  }
  for (const [runtimeName, map] of Object.entries(runtimes ?? {})) {
    if (activeRuntime && runtimeName !== activeRuntime) {
      continue;
    }
    if (!RUNTIME_KEYS.includes(runtimeName)) {
      throw new RoutingError(`${label} targets unsupported runtime '${runtimeName}' (expected one of ${RUNTIME_KEYS.join(", ")}).`);
    }
    if (!isPlainObject(map)) {
      throw new RoutingError(`${label} runtime '${runtimeName}' must be an object.`);
    }
    for (const key of Object.keys(map)) {
      if (!RUNTIME_LAYER_KEYS.includes(key)) {
        throw new RoutingError(`${label} runtime '${runtimeName}' has unknown key '${key}' (expected tiers, roles).`);
      }
    }
    for (const [name, entry] of Object.entries(map.tiers ?? {})) {
      if (RESERVED_INSTRUCTION_NAMES.includes(name)) {
        throw new RoutingError(`${label} uses reserved tier name '${name}' (a tier cannot be named 'default' or 'inherit').`);
      }
      validateTierDefinition(`${label} ${runtimeName}/tier '${name}'`, entry, { allowDefault: true, runtime: runtimeName });
    }
    for (const [role, entry] of Object.entries(map.roles ?? {})) {
      if (!ROLES.includes(role)) {
        throw new RoutingError(`${label} role '${role}' (runtime: ${runtimeName}) is not one of the seven routing roles (${ROLES.join(", ")}).`);
      }
      validateRoleEntry(`${label} ${runtimeName}/role '${role}'`, entry, { allowDefault: true, runtime: runtimeName });
    }
  }
  // An empty profiles object is a no-op and allowed; unlike runtimes, it may
  // be empty. Shape is checked, contents are not (see above).
  const profiles = {};
  if (layer.profiles !== undefined) {
    if (!isPlainObject(layer.profiles)) {
      throw new RoutingError(`${label} profiles, when present, must be a JSON object.`);
    }
    for (const [name, value] of Object.entries(layer.profiles)) {
      if (isPlainObject(value)) {
        profiles[name] = value;
      }
    }
  }
  return {
    source: typeof layer.source === "string" && layer.source.length > 0 ? layer.source : `${label} (unnamed)`,
    runtimes: activeRuntime
      ? Object.hasOwn(runtimes ?? {}, activeRuntime) ? { [activeRuntime]: runtimes[activeRuntime] } : {}
      : runtimes ?? {},
    profiles,
    work: layer.work !== undefined ? { workerRounds: layer.work.workerRounds } : null,
  };
}

// Accepts a single layer object, an array of layers ordered lowest to highest
// precedence, or null/undefined (no preferences) and returns the validated,
// source-labeled layer list.
export function normalizePreferenceInput(input, { runtime } = {}) {
  if (input === null || input === undefined) return [];
  const layers = Array.isArray(input) ? input : [input];
  // Entries for another host cannot affect this activation, so validate the
  // shared layer shape and the active runtime while ignoring inactive maps.
  return layers.map((layer, index) => validatePreferenceLayer(layer, index, { runtime }));
}

// Normalizes a profile selection: null, undefined, and the reserved name
// `default` all mean ordinary routing; any other value must be a valid
// profile name.
function normalizeProfileSelection(profile) {
  if (profile === null || profile === undefined || profile === "default") return null;
  if (!isValidProfileName(profile)) {
    throw new RoutingError(`Invalid routing profile '${profile}': profile names use lowercase letters, digits, and hyphens, start with a letter, have no trailing hyphen, and are at most 40 characters; 'default' and 'inherit' are reserved.`);
  }
  return profile;
}

// The names of the profiles available for a runtime (or for any runtime when
// no runtime is given), unique and sorted. A profile is available when some
// normalized layer carries a plain-object profile value containing that
// runtime key. Reserved (and otherwise invalid) names are excluded: they can
// never be selected. Accepts the same single-object/array/null input shape as
// normalizePreferenceInput.
export function availableProfiles(layers, runtime) {
  return availableProfileNames(normalizePreferenceInput(layers, { runtime }), runtime);
}

function availableProfileNames(normalized, runtime) {
  const names = new Set();
  for (const layer of normalized) {
    for (const [name, map] of Object.entries(layer.profiles ?? {})) {
      if (!isValidProfileName(name)) continue;
      if (runtime === undefined) {
        // Any-runtime availability: a defined-but-empty value (no own
        // runtime keys) cannot be selected, so it is not available.
        if (Object.keys(map).length === 0) continue;
        names.add(name);
      } else if (Object.hasOwn(map, runtime)) {
        names.add(name);
      }
    }
  }
  return [...names].sort();
}

function unknownProfileMessage(profile, runtime, available) {
  const scope = runtime === undefined ? "for this activation" : `for runtime '${runtime}'`;
  const availableText = available.length > 0
    ? (runtime === undefined
      ? `Available profiles: ${available.join(", ")}.`
      : `Available profiles for this runtime: ${available.join(", ")}.`)
    : (runtime === undefined
      ? `No routing profiles are defined; add a '## Profile: ${profile}' section to a preferences.md preference file (the legacy routing.md name is still accepted) or omit the profile selector.`
      : `No routing profiles are defined for this runtime; add a '## Profile: ${profile}' section to a preferences.md preference file (the legacy routing.md name is still accepted) or omit the profile selector.`);
  return `Unknown routing profile '${profile}' ${scope}. ${availableText}`;
}

// Expands a selected profile into per-layer sub-layers, preserving the
// supplied lowest-to-highest layer order: each layer contributes its default
// runtimes followed, when the layer defines the profile, by a profile
// sub-layer validated through the same machinery and labeled
// '<layer source> (profile <name>)'. Entries of unselected profiles are never
// visited, so they cannot block.
function expandProfileLayers(normalized, runtime, selectedProfile) {
  if (selectedProfile === null) return normalized;
  const expanded = [];
  normalized.forEach((layer, index) => {
    expanded.push(layer);
    // Own-property lookup: a valid profile name that shadows a
    // prototype-chain member (such as 'constructor') must not resolve to a
    // prototype value on a layer that does not define the profile.
    const profiles = layer.profiles ?? {};
    if (!Object.hasOwn(profiles, selectedProfile)) return;
    const profileRuntimes = profiles[selectedProfile];
    // A profile value with no runtime sections ({}), or with an empty
    // section for the active runtime, is a no-op: it contributes nothing
    // rather than an empty-runtimes sub-layer that would be a shape error.
    if (runtime === undefined) {
      if (Object.keys(profileRuntimes).length === 0) return;
    } else {
      const section = Object.hasOwn(profileRuntimes, runtime) ? profileRuntimes[runtime] : undefined;
      if (section === undefined || (isPlainObject(section) && Object.keys(section).length === 0)) return;
    }
    const source = `${layer.source} (profile ${selectedProfile})`;
    expanded.push(validatePreferenceLayer({ source, runtimes: profileRuntimes }, index, { runtime, label: source }));
  });
  return expanded;
}

// Merges preference layers over a version-2 baseline, lowest to highest
// precedence. Tier definitions and role selections merge separately, replacing
// entries atomically (a replacement carries its own model, effort, and
// fallbacks as one unit). Reset instructions operate on the merged state:
// `tier: default` restores the tier's installed-baseline definition (custom
// tiers without a baseline cannot be reset this way) and `role: default`
// clears the role exception so the role falls back to the default tier
// mapping. Role-to-tier references are NOT resolved here. The work budget
// (Work worker-round allowance) starts from the baseline's `work` (falling
// back to the packaged default) and is replaced atomically by each expanded
// layer that carries one. A profile selection
// (null/undefined/'default' mean ordinary routing) is checked for grammar and
// availability here and expanded into per-layer sub-layers, so every caller
// inherits the same rules. Profile sub-layers carry only a source and runtime
// sections, so profiles never carry a work budget.
export function mergePreferenceLayers(baseline, layers, runtime, profile = null) {
  validateV2Routing(baseline);
  const normalized = normalizePreferenceInput(layers, { runtime });
  const selectedProfile = normalizeProfileSelection(profile);
  if (selectedProfile !== null) {
    const available = availableProfileNames(normalized, runtime);
    if (!available.includes(selectedProfile)) {
      throw new RoutingError(unknownProfileMessage(selectedProfile, runtime, available));
    }
  }
  const expanded = expandProfileLayers(normalized, runtime, selectedProfile);
  const merged = {
    roleTiers: { ...baseline.roleTiers },
    tiers: {},
    roles: {},
    work: {
      workerRounds: (baseline.work !== undefined ? baseline.work : DEFAULT_WORK_BUDGET).workerRounds,
      source: BASELINE_SOURCE,
    },
  };
  for (const runtime of Object.keys(baseline.runtimes)) {
    merged.tiers[runtime] = {};
    for (const [name, entry] of Object.entries(baseline.runtimes[runtime].tiers ?? {})) {
      merged.tiers[runtime][name] = { entry: structuredClone(entry), source: BASELINE_SOURCE };
    }
    merged.roles[runtime] = {};
    for (const [role, entry] of Object.entries(baseline.runtimes[runtime].roles ?? {})) {
      merged.roles[runtime][role] = { entry: structuredClone(entry), source: BASELINE_SOURCE };
    }
  }
  for (const layer of expanded) {
    if (layer.work !== null) {
      merged.work = { workerRounds: layer.work.workerRounds, source: layer.source };
    }
    for (const [runtime, map] of Object.entries(layer.runtimes)) {
      if (!merged.tiers[runtime]) {
        throw new RoutingError(`Preference layer '${layer.source}' targets runtime '${runtime}', which is not declared in the installed baseline.`);
      }
      for (const [name, entry] of Object.entries(map.tiers ?? {})) {
        if (entry.mode === "default") {
          const existing = baseline.runtimes[runtime].tiers?.[name];
          if (!existing) {
            throw new RoutingError(`Tier '${name}' has no installed-baseline definition, so it cannot be reset with 'default' (runtime: ${runtime}, source: '${layer.source}').`);
          }
          merged.tiers[runtime][name] = { entry: structuredClone(existing), source: BASELINE_SOURCE };
        } else {
          merged.tiers[runtime][name] = { entry: structuredClone(entry), source: layer.source };
        }
      }
      for (const [role, entry] of Object.entries(map.roles ?? {})) {
        if (entry.mode === "default") {
          delete merged.roles[runtime][role];
        } else {
          merged.roles[runtime][role] = { entry: structuredClone(entry), source: layer.source };
        }
      }
    }
  }
  return merged;
}

function expandSelection(runtime, role, entry, provenance) {
  if (entry.mode === "inherit") {
    return { mode: "inherit", provenance };
  }
  const supportsEffort = runtimeSupportsEffort(runtime);
  const result = {
    mode: "explicit",
    model: entry.model,
  };
  if (supportsEffort) {
    result.reasoningEffort = entry.reasoningEffort;
    result.fallbacks = entry.fallbacks.map((pair) => ({ model: pair.model, reasoningEffort: pair.reasoningEffort }));
  } else {
    result.fallbacks = entry.fallbacks.map((pair) => ({ model: pair.model }));
  }
  result.provenance = provenance;
  return result;
}

function resolveMergedRuntime(merged, runtime) {
  const tiers = merged.tiers[runtime];
  const roles = merged.roles[runtime];
  const routes = {};
  for (const role of ROLES) {
    const roleSelection = roles[role];
    if (roleSelection) {
      const entry = roleSelection.entry;
      if (entry.mode === "tier") {
        const tier = tiers[entry.tier];
        if (!tier) {
          throw new RoutingError(`Role '${role}' references undefined tier '${entry.tier}' (runtime: ${runtime}; role selection source: '${roleSelection.source}').`);
        }
        routes[role] = expandSelection(runtime, role, tier.entry, {
          selection: "role-exception",
          roleSource: roleSelection.source,
          tier: entry.tier,
          tierSource: tier.source,
        });
      } else {
        routes[role] = expandSelection(runtime, role, entry, {
          selection: "role-exception",
          roleSource: roleSelection.source,
          tier: null,
          tierSource: null,
        });
      }
    } else {
      const tierName = merged.roleTiers[role];
      const tier = tiers[tierName];
      if (!tier) {
        throw new RoutingError(`Role '${role}' resolves to undefined tier '${tierName}' through the default tier mapping (runtime: ${runtime}).`);
      }
      routes[role] = expandSelection(runtime, role, tier.entry, {
        selection: "default-tier-mapping",
        roleSource: null,
        tier: tierName,
        tierSource: tier.source,
      });
    }
  }
  return { runtime, tiers, routes, work: { ...merged.work } };
}

// Resolves one runtime to concrete routes (or intentional inheritance), with
// source/provenance labels on every route: where the role selection came from
// and, for tier references, where the tier definition came from.
export function resolveRuntime(baseline, layers, runtime, profile = null) {
  if (!RUNTIME_KEYS.includes(runtime)) {
    throw new RoutingError(`Runtime '${runtime}' is not supported (expected one of ${RUNTIME_KEYS.join(", ")}).`);
  }
  const merged = mergePreferenceLayers(baseline, layers, runtime, profile);
  if (!merged.tiers[runtime]) {
    throw new RoutingError(`Runtime '${runtime}' is not declared in the installed baseline.`);
  }
  return resolveMergedRuntime(merged, runtime);
}

// Resolves every runtime the baseline declares, in one pass.
export function resolveAllRuntimes(baseline, layers, profile = null) {
  const merged = mergePreferenceLayers(baseline, layers, undefined, profile);
  const runtimes = {};
  for (const runtime of Object.keys(merged.tiers)) {
    runtimes[runtime] = resolveMergedRuntime(merged, runtime);
  }
  return { runtimes };
}

// Fills the runtimes a caller-supplied version-2 baseline leaves undeclared
// from the packaged (installed) baseline, so a build that renders every target
// gets a complete runtime set. Declared runtimes are never touched, so caller
// choices win. Returns the merged baseline plus the runtime names that were
// filled, for the caller's report.
export function mergeV2MissingRuntimes(input, packaged) {
  validateV2Routing(input);
  validateV2Routing(packaged);
  const merged = structuredClone(input);
  const added = [];
  for (const [runtime, map] of Object.entries(packaged.runtimes)) {
    if (!merged.runtimes[runtime]) {
      merged.runtimes[runtime] = structuredClone(map);
      added.push(runtime);
    }
  }
  return { merged, added };
}

// Applies the build-time flags to a version-2 baseline and returns the
// adjusted baseline. --no-model turns every role into an explicit inheritance
// exception (each route inherits both model and effort); --effort overrides
// the reasoningEffort of every explicit tier and role entry, leaving
// inheritance entries and configured fallback pairs untouched. Tier
// references resolve to the overridden tier definitions after the fact.
export function applyBuildOverrides(baseline, { noModel = false, effort = null, onNotice = null } = {}) {
  validateV2Routing(baseline);
  if (effort !== null && !effortLevels.has(effort)) {
    throw new RoutingError(`Invalid --effort '${effort}'.`);
  }
  const v2 = structuredClone(baseline);
  for (const runtime of Object.keys(v2.runtimes)) {
    const map = v2.runtimes[runtime];
    if (noModel) {
      map.roles = Object.fromEntries(ROLES.map((role) => [role, { mode: "inherit" }]));
      continue;
    }
    if (effort !== null && !runtimeSupportsEffort(runtime)) {
      const notice = `notice: runtime '${runtime}' has no effort control; skipping --effort override.`;
      if (typeof onNotice === "function") {
        onNotice(notice);
      } else {
        console.log(notice);
      }
      continue;
    }
    for (const entry of Object.values(map.tiers ?? {})) {
      if (effort !== null && entry.mode === "explicit") entry.reasoningEffort = effort;
    }
    for (const entry of Object.values(map.roles ?? {})) {
      if (effort !== null && entry.mode === "explicit") entry.reasoningEffort = effort;
    }
  }
  return v2;
}

// Normalizes a complete version-1 policy to version-2 role exceptions over the
// baseline's tiers. Every declared role becomes an exact direct exception
// (explicit selections keep model/effort/fallbacks; inherit stays inherit) so
// divergent roles in the same nominal tier are preserved verbatim. Runtimes
// the policy leaves undeclared keep the baseline's packaged defaults, and the
// policy's provenance, when present, is carried into the normalized baseline.
export function normalizeV1ToV2(v1, baseline) {
  strictValidateRouting(v1);
  validateV2Routing(baseline);
  const v2 = structuredClone(baseline);
  if (typeof v1.provenance === "string" && v1.provenance.length > 0) {
    v2.provenance = v1.provenance;
  }
  for (const runtime of Object.keys(v1.runtimes)) {
    const supportsEffort = runtimeSupportsEffort(runtime);
    const roles = {};
    for (const role of ROLES) {
      const entry = v1.runtimes[runtime][role];
      if (entry.mode === "inherit") {
        roles[role] = { mode: "inherit" };
      } else {
        const roleEntry = {
          mode: "explicit",
          model: entry.model,
        };
        if (supportsEffort) {
          roleEntry.reasoningEffort = entry.reasoningEffort;
          roleEntry.fallbacks = entry.fallbacks.map((pair) => ({ model: pair.model, reasoningEffort: pair.reasoningEffort }));
        } else {
          roleEntry.fallbacks = entry.fallbacks.map((pair) => ({ model: pair.model }));
        }
        roles[role] = roleEntry;
      }
    }
    v2.runtimes[runtime].roles = roles;
  }
  return v2;
}

// Converts a legacy `role -> provider/model[#variant]` inventory into version-2
// role exceptions. The openai/ and opencode/ prefixes in the legacy examples
// are OpenCode provider selectors, not model IDs for the Copilot/Codex native
// dispatch fields, so strip those known selectors for those runtimes. Preserve
// other provider names verbatim because their target-specific meaning cannot be
// inferred here. A missing variant carries the legacy default effort; omitted
// roles become explicit inheritance.
export function legacyInventoryToV2(inventory, baseline) {
  validateV2Routing(baseline);
  if (!isPlainObject(inventory)) {
    throw new RoutingError("Model mapping must be a JSON object keyed by role name.");
  }
  for (const [role, model] of Object.entries(inventory)) {
    if (!ROLES.includes(role)) throw new RoutingError(`Unknown role in model mapping: ${role}.`);
    if (typeof model !== "string" || model.length === 0) throw new RoutingError(`Invalid model for ${role}.`);
  }
  const v2 = structuredClone(baseline);
  const omitted = [];
  const skippedRuntimes = [];
  if (v2.runtimes.antigravity) {
    skippedRuntimes.push("antigravity");
  }
  for (const role of ROLES) {
    const raw = inventory[role];
    if (typeof raw !== "string" || raw.length === 0) {
      omitted.push(role);
      for (const runtime of Object.keys(v2.runtimes)) {
        if (runtime === "antigravity") continue;
        v2.runtimes[runtime].roles[role] = { mode: "inherit" };
      }
      continue;
    }
    const hash = raw.lastIndexOf("#");
    const model = hash >= 0 ? raw.slice(0, hash) : raw;
    const variant = hash >= 0 ? raw.slice(hash + 1) : null;
    if (variant !== null && !effortLevels.has(variant)) {
      throw new RoutingError(`Legacy model for ${role} has unsupported effort variant '#${variant}'.`);
    }
    const entry = { mode: "explicit", model, reasoningEffort: variant ?? "high", fallbacks: [] };
    for (const runtime of Object.keys(v2.runtimes)) {
      if (runtime === "antigravity") continue;
      const runtimeEntry = structuredClone(entry);
      if (runtime !== "opencode") {
        runtimeEntry.model = runtimeEntry.model.replace(/^(?:openai|opencode)\//i, "");
      }
      v2.runtimes[runtime].roles[role] = runtimeEntry;
    }
  }
  return { baseline: v2, omitted, skippedRuntimes };
}

function routeToV1Entry(route, runtime) {
  if (route.mode === "inherit") return { mode: "inherit" };
  const supportsEffort = runtime ? runtimeSupportsEffort(runtime) : route.reasoningEffort !== undefined;
  const entry = {
    mode: "explicit",
    model: route.model,
  };
  if (supportsEffort) {
    entry.reasoningEffort = route.reasoningEffort;
    entry.fallbacks = route.fallbacks.map((pair) => ({ model: pair.model, reasoningEffort: pair.reasoningEffort }));
  } else {
    entry.fallbacks = route.fallbacks.map((pair) => ({ model: pair.model }));
  }
  return entry;
}

// Exports the concrete routes of one runtime as a strict version-1 policy.
// Source metadata stays in the resolution result, not in the export, so the
// export passes the existing strict validator unchanged.
export function exportV1(routes, runtime, provenance) {
  return {
    schemaVersion: 1,
    provenance,
    runtimes: {
      [runtime]: Object.fromEntries(ROLES.map((role) => [role, routeToV1Entry(routes[role], runtime)])),
    },
  };
}

// The installed (packaged) version-2 baseline, resolved relative to this
// module so the helper works from an installed fixture with no repository
// source present.
export function packagedBaselinePath() {
  return fileURLToPath(new URL("../references/routing.json", import.meta.url));
}

export async function loadPackagedBaseline() {
  const routing = JSON.parse(await readFile(packagedBaselinePath(), "utf8"));
  validateV2Routing(routing);
  return routing;
}

// Computes the documented personal and project preference candidate lists,
// personal before project. Each location lists the documented filename first
// (preferences.md) and the legacy filename (routing.md); the selection of the
// effective file (and the ignored file) happens in startup, not here. The
// project entry is omitted when there is no project root or when the exact
// project root resolves to the home directory (dedup rule). Interpretation
// belongs to the workflow; the resolver accepts its bounded structured
// output through --input.
export function discoverPreferencePaths({ projectRoot, homeDir = homedir() } = {}) {
  const home = resolve(homeDir);
  const locations = [
    { location: "personal", candidates: [join(home, ".agenticale", "preferences.md"), join(home, ".agenticale", "routing.md")] },
  ];
  if (typeof projectRoot === "string" && projectRoot.length > 0) {
    const root = resolve(projectRoot);
    if (root !== home) {
      locations.push({ location: "project", candidates: [join(root, ".agenticale", "preferences.md"), join(root, ".agenticale", "routing.md")] });
    }
  }
  return locations;
}

// The OpenCode install places generated agent profiles at
// <install>/agents/agenticale/<role>.md: three levels up from this module
// (<install>/skills/work/scripts/routing.mjs).
export function installedAgentsDir() {
  return fileURLToPath(new URL("../../../agents/agenticale/", import.meta.url));
}

// Probes one documented preference location without ever reading or
// interpreting its contents: lstat (plus stat to follow a symlink, and an R_OK
// access probe for regular files) classifies it as "absent", "present", or
// "unreadable". A directory at the path is unreadable (EISDIR), as is a
// regular file that is not readable, and as is a symlink whose target does
// not exist (dangling): the location exists but cannot be proven empty.
// lstat-level failures other than ENOENT/ENOTDIR are treated as unreadable,
// because the location cannot then be proven empty.
async function inspectPreferenceFile(location, path) {
  let stats;
  try {
    stats = await lstat(path);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") {
      return { location, path, state: "absent" };
    }
    return { location, path, state: "unreadable", reason: error.code ?? error.message };
  }
  if (stats.isSymbolicLink()) {
    try {
      stats = await stat(path);
    } catch (error) {
      return {
        location,
        path,
        state: "unreadable",
        reason: `the path is a dangling symlink (its target does not exist) (${error.code ?? "unknown"})`,
      };
    }
  }
  if (!stats.isFile()) {
    return {
      location,
      path,
      state: "unreadable",
      reason: stats.isDirectory()
        ? "the path is a directory (EISDIR), not a preference file"
        : "the path is not a regular file",
    };
  }
  try {
    await access(path, constants.R_OK);
  } catch (error) {
    return { location, path, state: "unreadable", reason: error.code ?? error.message };
  }
  return { location, path, state: "present" };
}

function unreadablePreferenceFileError(info) {
  return new RoutingError(
    `The ${info.location} ${basename(info.path)} preference file ${info.path} exists but cannot be read: ${info.reason}. startup never creates or modifies preference files; make the file readable (or remove it) and retry.`,
  );
}

// Minimal frontmatter reader for generated agent profiles: the file must
// start with a '---' line and carry a closing '---' line. Only top-level
// 'model:' and 'reasoningEffort:' lines are extracted; this is not a general
// YAML parser, and indented (nested) lines are ignored. Returns
// { fields, duplicate }: fields is null when the file has no parseable
// frontmatter, and duplicate names the field (or is null) when the same
// top-level 'model:' or 'reasoningEffort:' line appears more than once, which
// makes the profile ambiguous.
function parseAgentFrontmatter(text) {
  const lines = text.split(/\r?\n/);
  if (lines.length === 0 || lines[0].trim() !== "---") return { fields: null, duplicate: null };
  let close = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === "---") {
      close = index;
      break;
    }
  }
  if (close === -1) return { fields: null, duplicate: null };
  const fields = {};
  let duplicate = null;
  for (let index = 1; index < close; index += 1) {
    const line = lines[index];
    if (line.length === 0 || line.startsWith(" ") || line.startsWith("\t")) continue;
    const colon = line.indexOf(":");
    if (colon <= 0) continue;
    const key = line.slice(0, colon).trim();
    if (key !== "model" && key !== "reasoningEffort") continue;
    let value = line.slice(colon + 1).trim();
    if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1);
    }
    if (fields[key] === undefined) {
      fields[key] = value;
    } else if (duplicate === null) {
      duplicate = key;
    }
  }
  return { fields, duplicate };
}

// Compares the resolved routes of one runtime against the installed agent
// profiles. Per-role statuses: "match", "mismatch" (with a compact note plus
// the expected and installed values), "missing" (no file), "unreadable"
// (file unreadable, no parseable frontmatter, or a duplicated 'model:' /
// 'reasoningEffort:' field that makes the profile ambiguous). A missing or unreadable
// agents directory reports every role as "missing" plus a directory-level
// agentsNote. An inherit route matches a profile with no 'model:' line; an
// explicit route matches on model equality and, for effort-capable runtimes,
// reasoningEffort equality.
async function compareAgentProfiles(agentsDir, routes, runtime) {
  let dirProblem = null;
  try {
    const dirStats = await stat(agentsDir);
    if (!dirStats.isDirectory()) {
      dirProblem = `agents directory ${agentsDir} is not a directory`;
    }
  } catch (error) {
    dirProblem = error.code === "ENOENT" || error.code === "ENOTDIR"
      ? `agents directory ${agentsDir} does not exist`
      : `agents directory ${agentsDir} cannot be read (${error.code ?? error.message})`;
  }
  if (dirProblem !== null) {
    return {
      agentsNote: `${dirProblem}; no installed agent profiles were found, so every role is reported missing.`,
      agents: Object.fromEntries(ROLES.map((role) => [role, { status: "missing" }])),
    };
  }
  const supportsEffort = runtimeSupportsEffort(runtime);
  const agents = {};
  for (const role of ROLES) {
    const profilePath = join(agentsDir, `${role}.md`);
    let text;
    try {
      text = await readFile(profilePath, "utf8");
    } catch (error) {
      if (error.code === "ENOENT" || error.code === "ENOTDIR") {
        agents[role] = { status: "missing" };
      } else {
        agents[role] = { status: "unreadable", note: `cannot read ${role}.md: ${error.code ?? error.message}` };
      }
      continue;
    }
    const parsed = parseAgentFrontmatter(text);
    if (parsed.fields === null) {
      agents[role] = {
        status: "unreadable",
        note: `${role}.md has no parseable frontmatter (expected a leading '---' block with a closing '---' line).`,
      };
      continue;
    }
    if (parsed.duplicate !== null) {
      agents[role] = {
        status: "unreadable",
        note: `${role}.md declares the '${parsed.duplicate}' frontmatter field more than once; the profile is ambiguous and cannot be compared.`,
      };
      continue;
    }
    const fields = parsed.fields;
    const route = routes[role];
    const installed = { model: fields.model ?? null };
    if (fields.reasoningEffort !== undefined) {
      installed.reasoningEffort = fields.reasoningEffort;
    }
    if (route.mode === "inherit") {
      if (installed.model === null) {
        agents[role] = { status: "match" };
      } else {
        agents[role] = {
          status: "mismatch",
          note: `expected inherit (no model line) but ${role}.md declares model '${installed.model}'.`,
          expected: { mode: "inherit" },
          installed,
        };
      }
      continue;
    }
    const expected = { model: route.model };
    if (supportsEffort) {
      expected.reasoningEffort = route.reasoningEffort;
    }
    const problems = [];
    if (installed.model !== expected.model) {
      problems.push(`model expected '${expected.model}' but ${role}.md declares '${installed.model}'`);
    }
    if (supportsEffort && installed.reasoningEffort !== expected.reasoningEffort) {
      problems.push(`reasoningEffort expected '${expected.reasoningEffort}' but ${role}.md declares '${installed.reasoningEffort ?? "(none)"}'`);
    }
    if (problems.length === 0) {
      agents[role] = { status: "match" };
    } else {
      agents[role] = { status: "mismatch", note: `${problems.join("; ")}.`, expected, installed };
    }
  }
  return { agentsNote: null, agents };
}

// The startup fast path: probe both documented filenames (preferences.md and
// the legacy routing.md) at each preference location without reading their
// contents. Selection per location: a present readable preferences.md is the
// effective file, and a routing.md beside it (readable or not) is never read
// or merged — it is only identified as ignored. A present but unreadable
// preferences.md is an error on every path, never a fallback to the legacy
// file. When preferences.md is absent, routing.md carries the existing
// semantics, including its unreadable error. When an effective file is
// present the workflow must interpret the Markdown itself and then call
// `resolve --input <file>` with the interpreted structured layers; when none
// is present the installed baseline is resolved directly with no preference
// layers (no temporary file is created), the selected profile is applied,
// and for opencode (or an explicit --agents-dir) the resolved routes are
// compared against the installed agent profiles.
async function runStartup(options) {
  const profile = normalizeProfileSelection(options.profile);
  const home = resolve(homedir());
  const candidatesFor = (base) => [
    join(base, ".agenticale", "preferences.md"),
    join(base, ".agenticale", "routing.md"),
  ];
  const targets = [{ location: "personal", candidates: candidatesFor(home) }];
  let projectChecked = false;
  if (options.root !== null) {
    const root = resolve(options.root);
    // Same dedup rule as discoverPreferencePaths: when the exact project root
    // resolves to the home directory the two documented locations are the
    // same directory; it is probed once, under 'personal', and the project
    // key stays 'not-checked'.
    if (root !== home) {
      targets.push({ location: "project", candidates: candidatesFor(root) });
      projectChecked = true;
    }
  }
  const stateByLocation = new Map();
  const presentFiles = [];
  for (const target of targets) {
    const [preferred, legacy] = target.candidates;
    const preferredInfo = await inspectPreferenceFile(target.location, preferred);
    // An unreadable effective candidate is an error on every path; a present
    // but unreadable preferences.md never falls back to the legacy file.
    if (preferredInfo.state === "unreadable") throw unreadablePreferenceFileError(preferredInfo);
    if (preferredInfo.state === "present") {
      // The documented file is the effective file. The legacy file, when
      // present at this scope (readable or not), is never read or merged; it
      // is only identified so the workflow can report it.
      const legacyInfo = await inspectPreferenceFile(target.location, legacy);
      stateByLocation.set(target.location, {
        state: "present",
        file: basename(preferred),
        path: preferred,
        ignored: legacyInfo.state === "absent" ? [] : [legacyInfo.path],
      });
      presentFiles.push(preferred);
      continue;
    }
    // No documented file: the legacy name carries the existing semantics,
    // including its unreadable error.
    const legacyInfo = await inspectPreferenceFile(target.location, legacy);
    if (legacyInfo.state === "unreadable") throw unreadablePreferenceFileError(legacyInfo);
    if (legacyInfo.state === "present") {
      stateByLocation.set(target.location, { state: "present", file: basename(legacy), path: legacy, ignored: [] });
      presentFiles.push(legacy);
    } else {
      stateByLocation.set(target.location, { state: "absent", file: null, path: null, ignored: [] });
    }
  }
  const preferenceFiles = {
    personal: stateByLocation.get("personal"),
    project: projectChecked ? stateByLocation.get("project") : { state: "not-checked", file: null, path: null, ignored: [] },
  };
  if (presentFiles.length > 0) {
    process.stdout.write(`${JSON.stringify({
      status: "interpretation-required",
      runtime: options.runtime,
      profile,
      preferenceFiles,
      presentFiles,
    }, null, 2)}\n`);
    return;
  }
  let baseline;
  try {
    baseline = await loadPackagedBaseline();
  } catch (error) {
    if (error instanceof RoutingError) throw error;
    throw new RoutingError(`Cannot load the installed baseline ${packagedBaselinePath()}: ${error.message}`);
  }
  const resolution = resolveRuntime(baseline, [], options.runtime, profile);
  const routeProvenance = Object.fromEntries(ROLES.map((role) => [role, resolution.routes[role].provenance]));
  const policy = exportV1(resolution.routes, resolution.runtime, `Resolved from the installed version-2 baseline (${packagedBaselinePath()}).`);
  const output = {
    status: "resolved",
    runtime: options.runtime,
    profile,
    preferenceFiles,
    policy,
    routeProvenance,
    work: { ...resolution.work },
  };
  if (options.runtime === "opencode" || options.agentsDir !== null) {
    const agentsDir = options.agentsDir !== null ? options.agentsDir : installedAgentsDir();
    const comparison = await compareAgentProfiles(agentsDir, resolution.routes, options.runtime);
    output.agents = comparison.agents;
    if (comparison.agentsNote !== null) output.agentsNote = comparison.agentsNote;
  }
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

function cliUsage() {
  return `Usage:
  node routing.mjs resolve --runtime RUNTIME [--baseline PATH] [--input PATH] [--profile NAME] [--explain]
  node routing.mjs startup --runtime RUNTIME [--root PATH] [--profile NAME] [--agents-dir PATH]

resolve reads the installed version-2 baseline and an optional structured
input layer, then prints a version-1 policy for the complete active runtime
on stdout. startup checks both documented filenames (preferences.md and the
legacy routing.md) at the documented preference locations without reading
their contents: when an effective file is present it prints an
"interpretation-required" result for the workflow (which then interprets the
Markdown and calls \`resolve --input <file>\`); when none is present it
resolves the installed baseline directly and, for opencode or with
--agents-dir, compares the resolved routes against the installed agent
profiles.

  --runtime RUNTIME   Active runtime: copilot, codex, opencode, or antigravity (required)
  --baseline PATH     (resolve) Version-2 baseline (default: the packaged
                      references/routing.json beside this module)
  --input PATH        (resolve) Optional FILE PATH of structured preference
                      JSON (one layer or an array of layers), typically the
                      interpreted form of a preferences.md preference file
                      (the legacy routing.md name is still accepted). It is
                      a path to a JSON file, never inline JSON, and it is
                      omitted when there are no preferences. A layer may also
                      carry an optional \`work\` key with the Work workflow's
                      worker-round allowance ({ "workerRounds": <positive integer>,
                      default 8): it changes only what is available to the Work
                      workflow, never what is required, and never any other budget.
  --profile NAME      Optional named routing profile from a preference layer's
                      profiles section; 'default' (or omission) selects
                      ordinary routing.
  --explain           (resolve) Wrap the policy with per-role selection/tier
                      provenance, the selected profile (null for ordinary
                      routing), and the effective work allowance
                      ({ workerRounds, source }).
  --root PATH         (startup) Project root for the project preference
                      location <root>/.agenticale/preferences.md (the legacy
                      routing.md name is still accepted; exact path, no
                      parent scanning); deduplicated against the personal
                      location when it is the home directory.
  --agents-dir PATH   (startup) Agents directory to compare against, holding
                      <role>.md files. Default for opencode:
                      <install>/agents/agenticale/ beside this skill.

resolve does not discover or parse user files: the workflow reads the
effective preference file (preferences.md, or the legacy routing.md) and
passes bounded structured preferences here as \`resolve --input <file>\`.
startup checks both documented filenames at the documented locations'
existence and readability; it never reads their contents. Its output reports
preferenceFiles per location (state, effective file, path, and ignored
files) and presentFiles (the effective files only); a present but unreadable
effective file is an error, never treated as absent, and an unreadable
ignored file is not an error. Errors identify runtime, role, tier, and
source.`;
}

function requireCliValue(argv, index, option) {
  if (index + 1 >= argv.length || !argv[index + 1] || argv[index + 1].startsWith("-")) {
    throw new RoutingError(`${option} requires a value that is not another option.`);
  }
  return argv[index + 1];
}

async function runResolve(options) {
  let baselineText;
  try {
    baselineText = await readFile(options.baseline, "utf8");
  } catch (error) {
    throw new RoutingError(`Cannot read the installed baseline ${options.baseline}: ${error.message}`);
  }
  let baseline;
  try {
    baseline = JSON.parse(baselineText);
  } catch {
    throw new RoutingError(`The installed baseline is not valid JSON: ${options.baseline}.`);
  }
  if (baseline?.schemaVersion === 1) {
    throw new RoutingError(`The installed baseline ${options.baseline} is a version-1 policy; the resolver expects the version-2 baseline (references/routing.json of a current install). Reinstall the plugin, or pass a version-2 baseline with --baseline.`);
  }
  validateV2Routing(baseline);

  let inputText = "";
  if (options.input) {
    try {
      inputText = await readFile(options.input, "utf8");
    } catch (error) {
      throw new RoutingError(`Cannot read the preference input ${options.input}: ${error.message}`);
    }
  } else if (!process.stdin.isTTY) {
    inputText = readFileSync(0, "utf8");
  }
  let input = [];
  if (inputText.trim().length === 0) {
    input = [];
  } else {
    try {
      input = JSON.parse(inputText);
    } catch {
      throw new RoutingError("The preference input is not valid JSON.");
    }
  }

  const profile = normalizeProfileSelection(options.profile);
  const resolution = resolveRuntime(baseline, input, options.runtime, profile);
  const routeProvenance = Object.fromEntries(ROLES.map((role) => [role, resolution.routes[role].provenance]));
  const policy = exportV1(resolution.routes, resolution.runtime, `Resolved from the installed version-2 baseline (${options.baseline}).`);
  const output = options.explain ? { policy, routeProvenance, profile, work: { ...resolution.work } } : policy;
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(cliUsage());
    return;
  }
  if (argv.length === 0 || (argv[0] !== "resolve" && argv[0] !== "startup")) {
    console.error(cliUsage());
    process.exitCode = 1;
    return;
  }
  const command = argv[0];
  let runtime = null;
  let profile = null;
  const resolveOptions = { baseline: null, input: null, explain: false };
  const startupOptions = { root: null, agentsDir: null };
  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--runtime") {
      runtime = requireCliValue(argv, index, argument);
      index += 1;
    } else if (argument === "--profile") {
      profile = requireCliValue(argv, index, argument);
      index += 1;
    } else if (argument.startsWith("--profile=")) {
      profile = argument.slice("--profile=".length);
    } else if (command === "resolve" && argument === "--baseline") {
      resolveOptions.baseline = resolve(requireCliValue(argv, index, argument));
      index += 1;
    } else if (command === "resolve" && argument === "--input") {
      resolveOptions.input = resolve(requireCliValue(argv, index, argument));
      index += 1;
    } else if (command === "resolve" && argument === "--explain") {
      resolveOptions.explain = true;
    } else if (command === "startup" && argument === "--root") {
      startupOptions.root = requireCliValue(argv, index, argument);
      index += 1;
    } else if (command === "startup" && argument === "--agents-dir") {
      startupOptions.agentsDir = resolve(requireCliValue(argv, index, argument));
      index += 1;
    } else {
      throw new RoutingError(`Unknown argument '${argument}'. Run with --help for usage.`);
    }
  }
  if (!runtime) throw new RoutingError("--runtime is required (copilot, codex, opencode, or antigravity).");
  if (!RUNTIME_KEYS.includes(runtime)) {
    throw new RoutingError(`--runtime must be one of ${RUNTIME_KEYS.join(", ")} (got '${runtime}').`);
  }
  if (command === "resolve") {
    await runResolve({
      runtime,
      baseline: resolveOptions.baseline ?? packagedBaselinePath(),
      input: resolveOptions.input,
      profile,
      explain: resolveOptions.explain,
    });
  } else {
    await runStartup({
      runtime,
      root: startupOptions.root,
      profile,
      agentsDir: startupOptions.agentsDir,
    });
  }
}

if (process.argv[1] && await realpath(process.argv[1]) === await realpath(fileURLToPath(import.meta.url))) {
  await main().catch((error) => {
    const message = error instanceof RoutingError ? error.message : `Unexpected routing failure: ${error.message}`;
    console.error(`Routing error: ${message}`);
    process.exitCode = 1;
  });
}
