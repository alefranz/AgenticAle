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
 *   - version-1 policy normalization to role exceptions over version-2 tiers
 *   - concrete route resolution with source/provenance labels and reset
 *     semantics (`role: default`, `tier: default`, `inherit`)
 *   - strict version-1 export (compatible with the existing validator)
 *   - a `resolve` CLI that reads the installed baseline plus structured
 *     preference JSON (stdin or an explicit file) and prints a valid
 *     version-1 policy for the complete active runtime
 *
 * The module consumes structured preferences and concrete routes only. It does
 * NOT interpret Markdown prose (the orchestrator does, in context) and it
 * never reads preference files on its own: discoverPreferencePaths only
 * computes the candidate paths for the caller, and the `resolve` CLI reads
 * only the explicit baseline path plus the supplied structured input. Default
 * builds and publication must not call the discovery helper either.
 */

import { readFileSync } from "node:fs";
import { readFile, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";

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

export const RUNTIME_KEYS = ["copilot", "codex", "opencode"];

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

const TOP_LEVEL_V1_KEYS = ["provenance", "runtimes", "schemaVersion"];
const TOP_LEVEL_V2_KEYS = ["provenance", "roleTiers", "runtimes", "schemaVersion"];
const EXPLICIT_ENTRY_KEYS = ["fallbacks", "mode", "model", "reasoningEffort"];
const INHERIT_ENTRY_KEYS = ["mode"];
const RESET_ENTRY_KEYS = ["mode"];
const ROLE_TIER_ENTRY_KEYS = ["mode", "tier"];
const LAYER_KEYS = ["runtimes", "source"];
const RUNTIME_LAYER_KEYS = ["roles", "tiers"];

export class RoutingError extends Error {
  constructor(message) {
    super(message);
    this.name = "RoutingError";
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function checkFallbacks(label, fallbacks) {
  if (!Array.isArray(fallbacks)) {
    throw new RoutingError(`${label} fallbacks must be an array.`);
  }
  fallbacks.forEach((pair, index) => {
    if (!isPlainObject(pair)
        || JSON.stringify(Object.keys(pair).sort()) !== JSON.stringify(["model", "reasoningEffort"])) {
      throw new RoutingError(`${label} fallback ${index} must be a { model, reasoningEffort } pair.`);
    }
    if (typeof pair.model !== "string" || pair.model.length === 0) {
      throw new RoutingError(`${label} fallback ${index} requires a non-empty model.`);
    }
    if (!effortLevels.has(pair.reasoningEffort)) {
      throw new RoutingError(`${label} fallback ${index} has unsupported effort '${pair.reasoningEffort}'.`);
    }
  });
}

// Validates the explicit/inherit selection shape shared by version-1 routes,
// version-2 tier definitions, and version-2 role selections.
function checkSelectionEntry(label, entry) {
  if (entry.mode === "explicit") {
    if (JSON.stringify(Object.keys(entry).sort()) !== JSON.stringify(EXPLICIT_ENTRY_KEYS)) {
      throw new RoutingError(`${label} explicit entry must carry exactly: ${EXPLICIT_ENTRY_KEYS.join(", ")}.`);
    }
    if (typeof entry.model !== "string" || entry.model.length === 0) {
      throw new RoutingError(`${label} explicit route requires a non-empty model.`);
    }
    if (!effortLevels.has(entry.reasoningEffort)) {
      throw new RoutingError(`${label} explicit route requires a supported reasoningEffort (got '${entry.reasoningEffort}').`);
    }
    checkFallbacks(label, entry.fallbacks);
  } else if (entry.mode === "inherit") {
    if (JSON.stringify(Object.keys(entry).sort()) !== JSON.stringify(INHERIT_ENTRY_KEYS)) {
      throw new RoutingError(`${label} inherit entry must carry only 'mode'.`);
    }
  } else {
    throw new RoutingError(`${label} has invalid mode '${entry.mode}'.`);
  }
}

function validateTierDefinition(label, entry, { allowDefault }) {
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
  checkSelectionEntry(label, entry);
}

function validateRoleEntry(label, entry, { allowDefault }) {
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
  checkSelectionEntry(label, entry);
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
    for (const role of ROLES) {
      const entry = map[role];
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        throw new Error(`Routing ${runtime}/${role} must be an object.`);
      }
      if (entry.mode === "explicit") {
        if (JSON.stringify(Object.keys(entry).sort()) !== JSON.stringify(EXPLICIT_ENTRY_KEYS)) {
          throw new Error(`Routing ${runtime}/${role} explicit entry must carry exactly: ${EXPLICIT_ENTRY_KEYS.join(", ")}.`);
        }
        if (typeof entry.model !== "string" || entry.model.length === 0) {
          throw new Error(`Routing ${runtime}/${role} explicit route requires a non-empty model.`);
        }
        if (!effortLevels.has(entry.reasoningEffort)) {
          throw new Error(`Routing ${runtime}/${role} explicit route requires a supported reasoningEffort (got '${entry.reasoningEffort}').`);
        }
        if (!Array.isArray(entry.fallbacks)) {
          throw new Error(`Routing ${runtime}/${role} fallbacks must be an array.`);
        }
        entry.fallbacks.forEach((pair, index) => {
          if (!pair || typeof pair !== "object" || Array.isArray(pair)
              || JSON.stringify(Object.keys(pair).sort()) !== JSON.stringify(["model", "reasoningEffort"])) {
            throw new Error(`Routing ${runtime}/${role} fallback ${index} must be a { model, reasoningEffort } pair.`);
          }
          if (typeof pair.model !== "string" || pair.model.length === 0) {
            throw new Error(`Routing ${runtime}/${role} fallback ${index} requires a non-empty model.`);
          }
          if (!effortLevels.has(pair.reasoningEffort)) {
            throw new Error(`Routing ${runtime}/${role} fallback ${index} has unsupported effort '${pair.reasoningEffort}'.`);
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
      validateTierDefinition(`Routing ${runtime}/tier '${name}'`, entry, { allowDefault: false });
    }
    const roles = map.roles ?? {};
    if (!isPlainObject(roles)) {
      throw new RoutingError(`Routing runtime '${runtime}' roles must be an object.`);
    }
    for (const [role, entry] of Object.entries(roles)) {
      if (!ROLES.includes(role)) {
        throw new RoutingError(`Routing ${runtime}/roles has unknown role '${role}' (expected one of ${ROLES.join(", ")}).`);
      }
      validateRoleEntry(`Routing ${runtime}/role '${role}'`, entry, { allowDefault: false });
    }
  }
}

// Validates one structured preference layer and returns its normalized form
// { source, runtimes }. Layers are the structured image of interpreted
// Markdown preferences: per-runtime tier replacements, role selections, and
// reset instructions, each with a source label.
export function validatePreferenceLayer(layer, index) {
  const label = `Preference layer ${index + 1}`;
  if (!isPlainObject(layer)) {
    throw new RoutingError(`${label} must be a JSON object.`);
  }
  for (const key of Object.keys(layer)) {
    if (!LAYER_KEYS.includes(key)) {
      throw new RoutingError(`${label} has unknown key '${key}' (expected source, runtimes).`);
    }
  }
  if (layer.source !== undefined && (typeof layer.source !== "string" || layer.source.length === 0)) {
    throw new RoutingError(`${label} source, when present, must be a non-empty string.`);
  }
  const runtimes = layer.runtimes;
  if (runtimes !== undefined && (!isPlainObject(runtimes) || Object.keys(runtimes).length === 0)) {
    throw new RoutingError(`${label} runtimes, when present, must be a non-empty object.`);
  }
  for (const [runtime, map] of Object.entries(runtimes ?? {})) {
    if (!RUNTIME_KEYS.includes(runtime)) {
      throw new RoutingError(`${label} targets unsupported runtime '${runtime}' (expected one of ${RUNTIME_KEYS.join(", ")}).`);
    }
    if (!isPlainObject(map)) {
      throw new RoutingError(`${label} runtime '${runtime}' must be an object.`);
    }
    for (const key of Object.keys(map)) {
      if (!RUNTIME_LAYER_KEYS.includes(key)) {
        throw new RoutingError(`${label} runtime '${runtime}' has unknown key '${key}' (expected tiers, roles).`);
      }
    }
    for (const [name, entry] of Object.entries(map.tiers ?? {})) {
      if (RESERVED_INSTRUCTION_NAMES.includes(name)) {
        throw new RoutingError(`${label} uses reserved tier name '${name}' (a tier cannot be named 'default' or 'inherit').`);
      }
      validateTierDefinition(`${label} ${runtime}/tier '${name}'`, entry, { allowDefault: true });
    }
    for (const [role, entry] of Object.entries(map.roles ?? {})) {
      if (!ROLES.includes(role)) {
        throw new RoutingError(`${label} role '${role}' (runtime: ${runtime}) is not one of the seven routing roles (${ROLES.join(", ")}).`);
      }
      validateRoleEntry(`${label} ${runtime}/role '${role}'`, entry, { allowDefault: true });
    }
  }
  return {
    source: typeof layer.source === "string" && layer.source.length > 0 ? layer.source : `${label} (unnamed)`,
    runtimes: runtimes ?? {},
  };
}

// Accepts a single layer object, an array of layers ordered lowest to highest
// precedence, or null/undefined (no preferences) and returns the validated,
// source-labeled layer list.
export function normalizePreferenceInput(input) {
  if (input === null || input === undefined) return [];
  const layers = Array.isArray(input) ? input : [input];
  return layers.map((layer, index) => validatePreferenceLayer(layer, index));
}

// Merges preference layers over a version-2 baseline, lowest to highest
// precedence. Tier definitions and role selections merge separately, replacing
// entries atomically (a replacement carries its own model, effort, and
// fallbacks as one unit). Reset instructions operate on the merged state:
// `tier: default` restores the tier's installed-baseline definition (custom
// tiers without a baseline cannot be reset this way) and `role: default`
// clears the role exception so the role falls back to the default tier
// mapping. Role-to-tier references are NOT resolved here.
export function mergePreferenceLayers(baseline, layers) {
  validateV2Routing(baseline);
  const normalized = normalizePreferenceInput(layers);
  const merged = {
    roleTiers: { ...baseline.roleTiers },
    tiers: {},
    roles: {},
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
  for (const layer of normalized) {
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
  return {
    mode: "explicit",
    model: entry.model,
    reasoningEffort: entry.reasoningEffort,
    fallbacks: entry.fallbacks.map((pair) => ({ model: pair.model, reasoningEffort: pair.reasoningEffort })),
    provenance,
  };
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
  return { runtime, tiers, routes };
}

// Resolves one runtime to concrete routes (or intentional inheritance), with
// source/provenance labels on every route: where the role selection came from
// and, for tier references, where the tier definition came from.
export function resolveRuntime(baseline, layers, runtime) {
  if (!RUNTIME_KEYS.includes(runtime)) {
    throw new RoutingError(`Runtime '${runtime}' is not supported (expected one of ${RUNTIME_KEYS.join(", ")}).`);
  }
  const merged = mergePreferenceLayers(baseline, layers);
  if (!merged.tiers[runtime]) {
    throw new RoutingError(`Runtime '${runtime}' is not declared in the installed baseline.`);
  }
  return resolveMergedRuntime(merged, runtime);
}

// Resolves every runtime the baseline declares, in one pass.
export function resolveAllRuntimes(baseline, layers) {
  const merged = mergePreferenceLayers(baseline, layers);
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
export function applyBuildOverrides(baseline, { noModel = false, effort = null } = {}) {
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
    const roles = {};
    for (const role of ROLES) {
      const entry = v1.runtimes[runtime][role];
      if (entry.mode === "inherit") {
        roles[role] = { mode: "inherit" };
      } else {
        roles[role] = {
          mode: "explicit",
          model: entry.model,
          reasoningEffort: entry.reasoningEffort,
          fallbacks: entry.fallbacks.map((pair) => ({ model: pair.model, reasoningEffort: pair.reasoningEffort })),
        };
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
  for (const role of ROLES) {
    const raw = inventory[role];
    if (typeof raw !== "string" || raw.length === 0) {
      omitted.push(role);
      for (const runtime of Object.keys(v2.runtimes)) {
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
      const runtimeEntry = structuredClone(entry);
      if (runtime !== "opencode") {
        runtimeEntry.model = runtimeEntry.model.replace(/^(?:openai|opencode)\//i, "");
      }
      v2.runtimes[runtime].roles[role] = runtimeEntry;
    }
  }
  return { baseline: v2, omitted };
}

function routeToV1Entry(route) {
  if (route.mode === "inherit") return { mode: "inherit" };
  return {
    mode: "explicit",
    model: route.model,
    reasoningEffort: route.reasoningEffort,
    fallbacks: route.fallbacks.map((pair) => ({ model: pair.model, reasoningEffort: pair.reasoningEffort })),
  };
}

// Exports the concrete routes of one runtime as a strict version-1 policy.
// Source metadata stays in the resolution result, not in the export, so the
// export passes the existing strict validator unchanged.
export function exportV1(routes, runtime, provenance) {
  return {
    schemaVersion: 1,
    provenance,
    runtimes: {
      [runtime]: Object.fromEntries(ROLES.map((role) => [role, routeToV1Entry(routes[role])])),
    },
  };
}

// Exports every resolved runtime as a strict version-1 policy snapshot.
export function exportV1All(resolved, provenance) {
  const runtimes = {};
  for (const runtime of RUNTIME_KEYS) {
    if (!resolved.runtimes[runtime]) continue;
    runtimes[runtime] = Object.fromEntries(
      ROLES.map((role) => [role, routeToV1Entry(resolved.runtimes[runtime].routes[role])]),
    );
  }
  return { schemaVersion: 1, provenance, runtimes };
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

// Computes the preference-file discovery candidates for the caller. This does
// NOT read the files: absence is normal, and an existing-but-unreadable file
// is the caller's diagnostic. Deduplicates the path when the established
// project root and the home directory produce the same file.
export function discoverPreferencePaths({ projectRoot, homeDir = homedir() } = {}) {
  const paths = [];
  if (typeof projectRoot === "string" && projectRoot.length > 0) {
    paths.push(join(resolve(projectRoot), ".agenticale", "routing.md"));
  }
  paths.push(join(resolve(homeDir), ".agenticale", "routing.md"));
  return [...new Set(paths)];
}

function cliUsage() {
  return `Usage:
  node routing.mjs resolve --runtime RUNTIME [--baseline PATH] [--input PATH]

Resolves the installed version-2 routing baseline against structured
preference layers and prints a valid version-1 policy for the complete
active runtime on stdout.

  --runtime RUNTIME   Active runtime: copilot, codex, or opencode (required)
  --baseline PATH     Version-2 baseline (default: the packaged
                      references/routing.json beside this module)
  --input PATH        Structured preference JSON: an array of layers ordered
                      lowest to highest precedence (or a single layer object).
                      Reads stdin when omitted; empty input means no layers.

The input is structured JSON only: this command does not interpret Markdown
and does not discover preference files. Errors identify the affected runtime,
role/tier, and source.`;
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

  let inputText;
  if (options.input) {
    try {
      inputText = await readFile(options.input, "utf8");
    } catch (error) {
      throw new RoutingError(`Cannot read the preference input ${options.input}: ${error.message}`);
    }
  } else {
    if (process.stdin.isTTY) {
      throw new RoutingError("No preference input supplied: pipe structured preference JSON on stdin or pass --input PATH.");
    }
    inputText = readFileSync(0, "utf8");
  }
  let input;
  if (inputText.trim().length === 0) {
    input = [];
  } else {
    try {
      input = JSON.parse(inputText);
    } catch {
      throw new RoutingError("The preference input is not valid JSON.");
    }
  }

  const resolution = resolveRuntime(baseline, input, options.runtime);
  const policy = exportV1(resolution.routes, resolution.runtime, `Resolved from the installed version-2 baseline (${options.baseline}).`);
  process.stdout.write(`${JSON.stringify(policy, null, 2)}\n`);
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(cliUsage());
    return;
  }
  if (argv.length === 0 || argv[0] !== "resolve") {
    console.error(cliUsage());
    process.exitCode = 1;
    return;
  }
  let runtime = null;
  let baseline = null;
  let input = null;
  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--runtime") {
      runtime = requireCliValue(argv, index, argument);
      index += 1;
    } else if (argument === "--baseline") {
      baseline = resolve(requireCliValue(argv, index, argument));
      index += 1;
    } else if (argument === "--input") {
      input = resolve(requireCliValue(argv, index, argument));
      index += 1;
    } else {
      throw new RoutingError(`Unknown argument '${argument}'. Run with --help for usage.`);
    }
  }
  if (!runtime) throw new RoutingError("--runtime is required (copilot, codex, or opencode).");
  if (!RUNTIME_KEYS.includes(runtime)) {
    throw new RoutingError(`--runtime must be one of ${RUNTIME_KEYS.join(", ")} (got '${runtime}').`);
  }
  await runResolve({ runtime, baseline: baseline ?? packagedBaselinePath(), input });
}

if (process.argv[1] && await realpath(process.argv[1]) === await realpath(fileURLToPath(import.meta.url))) {
  await main().catch((error) => {
    const message = error instanceof RoutingError ? error.message : `Unexpected routing failure: ${error.message}`;
    console.error(`Routing error: ${message}`);
    process.exitCode = 1;
  });
}
