#!/usr/bin/env node
// Deterministic regression scenarios for the shared routing module
// (skills/work/scripts/routing.mjs): the phase 1-2 machine contracts of
// docs/model-routing-customization-plan.md section 10.1. These prove the
// resolver, validators, normalization, export, and the installed-fixture
// `resolve` and `startup` CLIs; they do not interpret prose and never touch
// the real user's home, plugin store, or live profile.

import { mkdtemp, mkdir, readFile, readdir, rm, cp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import {
  BASELINE_SOURCE,
  ROLES,
  RUNTIME_KEYS,
  STANDARD_TIERS,
  RoutingError,
  applyBuildOverrides,
  availableProfiles,
  discoverPreferencePaths,
  exportV1,
  isValidProfileName,
  legacyInventoryToV2,
  mergePreferenceLayers,
  mergeV2MissingRuntimes,
  normalizePreferenceInput,
  normalizeV1ToV2,
  resolveAllRuntimes,
  resolveRuntime,
  runtimeSupportsEffort,
  strictValidateRouting,
  validatePreferenceLayer,
  validateRouting,
  validateV2Routing,
} from "../skills/work/scripts/routing.mjs";

const repository = resolve(import.meta.dirname, "..");
const modulePath = join(repository, "skills", "work", "scripts", "routing.mjs");
const scratch = await mkdtemp(join(tmpdir(), "agenticale-routing-test-"));
let assertions = 0;

function check(condition, label) {
  assert.ok(condition, label);
  assertions += 1;
}

// Runs `fn` and requires a RoutingError whose message contains every needle.
function checkError(fn, label, needles = []) {
  let thrown = null;
  try {
    fn();
  } catch (error) {
    thrown = error;
  }
  check(
    thrown instanceof RoutingError,
    `${label} rejects with RoutingError (got: ${thrown ? `${thrown.name}: ${thrown.message}` : "no error"})`,
  );
  if (!(thrown instanceof RoutingError)) return;
  for (const needle of needles) {
    check(thrown.message.includes(needle), `${label} error identifies '${needle}'`);
  }
}

// The version-1 strict validator keeps its original contract: plain Error
// (not RoutingError) with the original messages.
function checkV1Error(fn, label, needles = []) {
  let thrown = null;
  try {
    fn();
  } catch (error) {
    thrown = error;
  }
  check(
    thrown instanceof Error && !(thrown instanceof RoutingError),
    `${label} rejects with the version-1 plain-Error contract (got: ${thrown ? `${thrown.name}: ${thrown.message}` : "no error"})`,
  );
  if (!(thrown instanceof Error)) return;
  for (const needle of needles) {
    check(thrown.message.includes(needle), `${label} error identifies '${needle}'`);
  }
}

// An explicit selection entry in the shared shape.
function explicit(model, reasoningEffort, fallbacks = []) {
  return { mode: "explicit", model, reasoningEffort, fallbacks };
}

// The version-1 baseline that preceded the version-2 contract, embedded so the
// 21-selection equivalence is testable without repository history.
const OLD_V1 = {
  schemaVersion: 1,
  provenance: "Packaged model and effort choices mirror examples/openai.json. Copilot and Codex use host-native bare model IDs; OpenCode keeps the openai/ provider prefix from the example. Availability and effort support are not verified against live accounts. Customize per runtime with routing.md (see references/ROUTING.md), or override at build time (--routing PATH / --models / --no-model / --effort).",
  runtimes: {
    copilot: {
      explore: explicit("gpt-6-luna", "medium"),
      implement: explicit("gpt-6-luna", "high"),
      "implement-hard": explicit("gpt-6.1-sol", "high"),
      fix: explicit("gpt-6-luna", "high"),
      review: explicit("gpt-6.1-sol", "high"),
      "deep-review": explicit("gpt-6.1-sol", "xhigh"),
      consult: explicit("gpt-6.1-sol", "xhigh"),
    },
    codex: {
      explore: explicit("gpt-6-luna", "medium"),
      implement: explicit("gpt-6-luna", "high"),
      "implement-hard": explicit("gpt-6.1-sol", "high"),
      fix: explicit("gpt-6-luna", "high"),
      review: explicit("gpt-6.1-sol", "high"),
      "deep-review": explicit("gpt-6.1-sol", "xhigh"),
      consult: explicit("gpt-6.1-sol", "xhigh"),
    },
    opencode: {
      explore: explicit("openai/gpt-6-luna", "medium"),
      implement: explicit("openai/gpt-6-luna", "high"),
      "implement-hard": explicit("openai/gpt-6.1-sol", "high"),
      fix: explicit("openai/gpt-6-luna", "high"),
      review: explicit("openai/gpt-6.1-sol", "high"),
      "deep-review": explicit("openai/gpt-6.1-sol", "xhigh"),
      consult: explicit("openai/gpt-6.1-sol", "xhigh"),
    },
  },
};

// The authored version-2 packaged baseline under test.
const packaged = JSON.parse(await readFile(join(repository, "skills", "work", "references", "routing.json"), "utf8"));
check(packaged.schemaVersion === 2, "packaged baseline is version-2");

// A compact synthetic baseline for preference scenarios: two runtimes so
// unrelated-runtime preservation is observable.
function synthetic() {
  return {
    schemaVersion: 2,
    provenance: "test baseline",
    roleTiers: {
      explore: "fast",
      implement: "fast",
      "implement-hard": "standard",
      fix: "fast",
      review: "standard",
      "deep-review": "deep",
      consult: "deep",
    },
    runtimes: {
      codex: {
        tiers: {
          fast: explicit("cx/fast", "max"),
          standard: explicit("cx/standard", "high"),
          deep: explicit("cx/deep", "xhigh"),
        },
        roles: {},
      },
      opencode: {
        tiers: {
          fast: explicit("oc/fast", "max"),
          standard: explicit("oc/standard", "high"),
          deep: explicit("oc/deep", "xhigh"),
        },
        roles: {},
      },
    },
  };
}

// A complete strict version-1 policy fixture, optionally mutated.
function v1Policy(mutate) {
  const policy = {
    schemaVersion: 1,
    runtimes: Object.fromEntries(
      RUNTIME_KEYS.map((runtime) => {
        const entries = {};
        for (const role of ROLES) {
          entries[role] = runtimeSupportsEffort(runtime)
            ? explicit(`m/${role}`, "high")
            : { mode: "explicit", model: `m/${role}`, fallbacks: [] };
        }
        return [runtime, entries];
      }),
    ),
  };
  if (mutate) mutate(policy);
  return policy;
}

try {
  // --- No preferences: the packaged baseline resolves to exactly the 21
  // concrete selections of the version-1 baseline, all explicit, all
  // default-tier-mapped, plus the 7 antigravity selections. ---
  const defaultResolution = resolveAllRuntimes(packaged, []);
  check(
    JSON.stringify(Object.keys(defaultResolution.runtimes).sort()) === JSON.stringify([...RUNTIME_KEYS].sort()),
    "no-preference resolution covers all four runtimes",
  );
  for (const runtime of ["copilot", "codex", "opencode"]) {
    for (const role of ROLES) {
      const route = defaultResolution.runtimes[runtime].routes[role];
      const old = OLD_V1.runtimes[runtime][role];
      check(
        route.mode === old.mode && route.model === old.model
          && route.reasoningEffort === old.reasoningEffort
          && JSON.stringify(route.fallbacks) === JSON.stringify(old.fallbacks),
        `packaged v2 ${runtime}/${role} equals the version-1 selection`,
      );
    }
  }

  // --- Antigravity defaults resolution ---
  const agRoutes = defaultResolution.runtimes.antigravity.routes;
  check(Object.keys(agRoutes).length === 7, "antigravity resolves all 7 roles");
  for (const role of ROLES) {
    const route = agRoutes[role];
    check(route.mode === "explicit", `antigravity/${role} mode is explicit`);
    check(route.reasoningEffort === undefined, `antigravity/${role} has no reasoningEffort`);
    check(Array.isArray(route.fallbacks) && route.fallbacks.length === 0, `antigravity/${role} has empty fallbacks`);
  }
  for (const role of ["explore", "implement", "fix"]) {
    check(agRoutes[role].model === "flash", `antigravity/${role} resolves to flash`);
  }
  for (const role of ["implement-hard", "review", "deep-review", "consult"]) {
    check(agRoutes[role].model === "pro", `antigravity/${role} resolves to pro`);
  }
  const agPolicy = exportV1(defaultResolution.runtimes.antigravity.routes, "antigravity", packaged.provenance);
  let agStrictError = null;
  try {
    strictValidateRouting(agPolicy);
  } catch (error) {
    agStrictError = error;
  }
  check(agStrictError === null, `antigravity export passes strictValidateRouting${agStrictError ? ` (${agStrictError.message})` : ""}`);
  const defaultRoute = defaultResolution.runtimes.codex.routes.review;
  check(
    defaultRoute.provenance.selection === "default-tier-mapping"
      && defaultRoute.provenance.tier === "standard"
      && defaultRoute.provenance.tierSource === BASELINE_SOURCE,
    "default resolution carries the default-tier-mapping provenance",
  );
  const policy = exportV1(defaultResolution.runtimes.codex.routes, "codex", packaged.provenance);
  let strictSnapshotError = null;
  try {
    strictValidateRouting(policy);
  } catch (error) {
    strictSnapshotError = error;
  }
  check(strictSnapshotError === null, `single-runtime export passes the strict version-1 contract${strictSnapshotError ? ` (${strictSnapshotError.message})` : ""}`);
  check(JSON.stringify(policy.runtimes.codex) === JSON.stringify(OLD_V1.runtimes.codex), "single-runtime export preserves the resolved selections");

  // --- v1 validator contract is unchanged for version-1 inputs. ---
  let v1ContractError = null;
  try {
    validateRouting(structuredClone(OLD_V1));
  } catch (error) {
    v1ContractError = error;
  }
  check(v1ContractError === null, `validateRouting keeps the version-1 contract${v1ContractError ? ` (${v1ContractError.message})` : ""}`);
  checkV1Error(() => strictValidateRouting(v1Policy((p) => { p.schemaVersion = 2; })), "strict v1 rejects a version-2 schemaVersion", ["schemaVersion must be 1"]);
  checkV1Error(() => strictValidateRouting(v1Policy((p) => { p.bogus = true; })), "strict v1 rejects unknown top-level key", ["unknown top-level key 'bogus'"]);
  checkV1Error(() => strictValidateRouting(v1Policy((p) => { delete p.runtimes.codex.consult; })), "strict v1 rejects a runtime missing a role", ["must map exactly the 7 keys"]);
  checkV1Error(() => strictValidateRouting(v1Policy((p) => { p.runtimes.codex.bogus = explicit("x", "low"); })), "strict v1 rejects an unknown route key", ["must map exactly the 7 keys"]);
  checkV1Error(() => strictValidateRouting(v1Policy((p) => { p.runtimes.codex.review.reasoningEffort = "ultra"; })), "strict v1 rejects unsupported effort", ["(got 'ultra')"]);
  checkV1Error(() => strictValidateRouting(v1Policy((p) => { p.runtimes.bogus = structuredClone(p.runtimes.codex); })), "strict v1 rejects unsupported runtime", ["unsupported runtime 'bogus'"]);
  checkV1Error(() => strictValidateRouting(v1Policy((p) => { p.runtimes.codex.review.fallbacks = [{ model: "x", reasoningEffort: "ultra" }]; })), "strict v1 rejects an unsupported fallback effort", ["fallback 0 has unsupported effort 'ultra'"]);
  checkV1Error(() => strictValidateRouting(v1Policy((p) => { p.runtimes.codex.review = { mode: "inherit", model: "x" }; })), "strict v1 rejects an inherit entry with extra fields", ["must carry only 'mode'"]);

  // --- v2 baseline validation (negatives). ---
  const mutatedV2 = (fn) => { const q = structuredClone(synthetic()); fn(q); return q; };
  checkError(() => validateV2Routing({ ...structuredClone(synthetic()), schemaVersion: 1 }), "v2 rejects a version-1 schemaVersion", ["schemaVersion must be 2"]);
  checkError(() => validateV2Routing(mutatedV2((q) => { q.bogus = true; })), "v2 rejects unknown top-level key", ["unknown top-level key 'bogus'"]);
  checkError(() => validateV2Routing(mutatedV2((q) => { q.roleTiers.review = "inherit"; })), "v2 rejects reserved instruction name in roleTiers", ["reserved instruction name 'inherit'"]);
  checkError(() => validateV2Routing(mutatedV2((q) => { delete q.roleTiers.consult; })), "v2 requires all seven roles in roleTiers", ["roleTiers must map exactly the 7 roles"]);
  checkError(() => validateV2Routing(mutatedV2((q) => { q.runtimes.codex.tiers.default = explicit("x", "low"); })), "v2 rejects reserved tier name 'default'", ["reserved tier name 'default'"]);
  checkError(() => validateV2Routing(mutatedV2((q) => { q.runtimes.codex.roles.review = { mode: "default" }; })), "v2 baseline rejects a reset entry", ["not allowed in a baseline"]);
  checkError(() => validateV2Routing(mutatedV2((q) => { q.runtimes.codex.roles.review = { mode: "tier", tier: "deep", extra: true }; })), "v2 rejects extra keys on a tier reference", ["must carry exactly: mode, tier"]);
  checkError(() => validateV2Routing(mutatedV2((q) => { q.runtimes.codex.tiers.fast = { mode: "explicit", model: "x", reasoningEffort: "low" }; })), "v2 rejects an explicit entry missing fallbacks", ["must carry exactly"]);
  checkError(() => validateV2Routing({ schemaVersion: 2, roleTiers: synthetic().roleTiers, runtimes: {} }), "v2 requires at least one runtime", ["at least one runtime"]);

  // --- Preference layer validation (negatives). ---
  checkError(() => validatePreferenceLayer({ source: "x", bogus: true }, 0), "preference layer rejects unknown key", ["unknown key 'bogus'"]);
  checkError(() => validatePreferenceLayer({ source: "" }, 0), "preference layer rejects an empty source", ["non-empty string"]);
  checkError(() => validatePreferenceLayer({ runtimes: {} }, 0), "preference layer rejects an empty runtimes object", ["non-empty object"]);
  checkError(() => validatePreferenceLayer({ runtimes: { bogus: {} } }, 0), "preference layer rejects an unsupported runtime", ["unsupported runtime 'bogus'"]);
  checkError(() => validatePreferenceLayer({ runtimes: { codex: { tiers: { default: explicit("x", "low") } } } }, 0), "preference layer rejects reserved tier name", ["reserved tier name 'default'"]);
  checkError(() => validatePreferenceLayer({ runtimes: { codex: { roles: { bogus: explicit("x", "low") } } } }, 0), "preference layer rejects an unknown role", ["not one of the seven routing roles"]);
  check(
    JSON.stringify(normalizePreferenceInput(null)) === JSON.stringify([]),
    "normalizePreferenceInput(null) means no layers",
  );
  check(
    JSON.stringify(normalizePreferenceInput({ source: "x" }).map((layer) => layer.source)) === JSON.stringify(["x"]),
    "a single layer object becomes one normalized layer",
  );
  check(normalizePreferenceInput([{ source: "a" }, { source: "b" }]).length === 2, "a layer array keeps its order");
  check(normalizePreferenceInput([{}])[0].source === "Preference layer 1 (unnamed)", "a missing source gets its labeled name");

  // --- Sparse preference: one overridden tier affects only its mapped roles;
  // unrelated tiers, roles, and runtimes retain their choices. ---
  const sparse = resolveAllRuntimes(synthetic(), [
    { source: "personal", runtimes: { codex: { tiers: { deep: explicit("alt/deep", "low") } } } },
  ]);
  check(sparse.runtimes.codex.routes["deep-review"].model === "alt/deep", "sparse tier override applies to the deep-mapped deep-review role");
  check(sparse.runtimes.codex.routes.consult.model === "alt/deep", "sparse tier override applies to the deep-mapped consult role");
  check(sparse.runtimes.codex.routes.explore.model === "cx/fast", "sparse tier override leaves unrelated codex roles at their tier");
  check(sparse.runtimes.opencode.routes["deep-review"].model === "oc/deep", "sparse tier override leaves the unrelated runtime untouched");
  check(
    sparse.runtimes.codex.routes["deep-review"].provenance.tier === "deep"
      && sparse.runtimes.codex.routes["deep-review"].provenance.tierSource === "personal",
    "sparse override carries the tier source label",
  );
  const merged = mergePreferenceLayers(synthetic(), []);
  check(merged.tiers.codex.fast.source === BASELINE_SOURCE, "unmerged tier definitions carry the baseline source");
  check(merged.roleTiers.review === "standard", "the role-to-tier map is copied verbatim");

  // --- Section 4.3 precedence examples (personal < repository < invocation). ---
  // 1. review: deep + repository replaces deep -> the repository deep wins.
  const p1 = resolveRuntime(synthetic(), [
    { source: "personal", runtimes: { codex: { roles: { review: { mode: "tier", tier: "deep" } } } } },
    { source: "repo", runtimes: { codex: { tiers: { deep: explicit("repo/deep", "low") } } } },
  ], "codex").routes.review;
  check(p1.mode === "explicit" && p1.model === "repo/deep" && p1.reasoningEffort === "low", "4.3/1 tier reference follows the repository's replaced tier");
  check(p1.provenance.roleSource === "personal" && p1.provenance.tierSource === "repo", "4.3/1 provenance carries both the role-selection and tier-definition sources");
  // 2. direct review selection + repository replaces standard -> direct wins.
  const p2 = resolveRuntime(synthetic(), [
    { source: "personal", runtimes: { codex: { roles: { review: explicit("pers/review", "medium") } } } },
    { source: "repo", runtimes: { codex: { tiers: { standard: explicit("repo/std", "low") } } } },
  ], "codex").routes.review;
  check(p2.model === "pers/review" && p2.reasoningEffort === "medium", "4.3/2 a direct role selection survives a tier replacement");
  check(p2.provenance.selection === "role-exception" && p2.provenance.roleSource === "personal", "4.3/2 provenance records the direct role source");
  // 3. direct review + repository review: default + replace standard -> the
  // repository's standard selection wins.
  const p3 = resolveRuntime(synthetic(), [
    { source: "personal", runtimes: { codex: { roles: { review: explicit("pers/review", "medium") } } } },
    { source: "repo", runtimes: { codex: { tiers: { standard: explicit("repo/std", "low") }, roles: { review: { mode: "default" } } } } },
  ], "codex").routes.review;
  check(p3.model === "repo/std" && p3.reasoningEffort === "low", "4.3/3 role reset falls back to the replaced standard tier");
  check(p3.provenance.selection === "default-tier-mapping" && p3.provenance.tier === "standard" && p3.provenance.tierSource === "repo", "4.3/3 provenance records the tier and its source");
  // 4. personal replaces fast + repository omits fast -> personal fast applies
  // to its default-mapped roles.
  const p4 = resolveRuntime(synthetic(), [
    { source: "personal", runtimes: { codex: { tiers: { fast: explicit("pers/fast", "medium") } } } },
    { source: "repo" },
  ], "codex").routes;
  for (const role of ["explore", "implement", "fix"]) {
    check(p4[role].model === "pers/fast", `4.3/4 personal fast applies to its default-mapped ${role} role`);
  }
  check(p4.review.model === "cx/standard", "4.3/4 unrelated roles keep their tier");
  // 5. review: inherit + repository omits review -> intentional inheritance.
  const p5 = resolveRuntime(synthetic(), [
    { source: "personal", runtimes: { codex: { roles: { review: { mode: "inherit" } } } } },
    { source: "repo" },
  ], "codex").routes.review;
  check(p5.mode === "inherit", "4.3/5 explicit inherit stays inherit");
  check(p5.provenance.selection === "role-exception" && p5.provenance.roleSource === "personal", "4.3/5 inherit provenance records the role source");
  // 6. review: deep + invocation directly selects review -> the invocation
  // pair applies to review only.
  const p6 = resolveRuntime(synthetic(), [
    { source: "personal", runtimes: { codex: { roles: { review: { mode: "tier", tier: "deep" } } } } },
    { source: "invocation", runtimes: { codex: { roles: { review: explicit("inv/review", "low") } } } },
  ], "codex").routes;
  check(p6.review.model === "inv/review" && p6.review.reasoningEffort === "low", "4.3/6 the invocation selection wins for review");
  check(p6.review.provenance.roleSource === "invocation", "4.3/6 provenance records the invocation source");
  check(p6.fix.model === "cx/fast", "4.3/6 the invocation pair applies to review only");
  // 7. deep tier with fallbacks + replace deep with a new pair only -> atomic
  // replacement removes the old fallbacks.
  const withFallbacks = synthetic();
  withFallbacks.runtimes.codex.tiers.deep = explicit("cx/deep", "xhigh", [
    { model: "cx/fb-1", reasoningEffort: "high" },
    { model: "cx/fb-2", reasoningEffort: "low" },
  ]);
  const p7 = resolveRuntime(withFallbacks, [
    { source: "repo", runtimes: { codex: { tiers: { deep: explicit("repo/deep", "low") } } } },
  ], "codex").routes["deep-review"];
  check(p7.model === "repo/deep" && p7.fallbacks.length === 0, "4.3/7 atomic replacement drops the replaced tier's fallbacks");
  // Conflicting direct selections: the higher layer wins atomically, no error.
  const p8 = resolveRuntime(synthetic(), [
    { source: "personal", runtimes: { codex: { roles: { review: explicit("pers/review", "medium") } } } },
    { source: "repo", runtimes: { codex: { roles: { review: explicit("repo/review", "low") } } } },
  ], "codex").routes.review;
  check(p8.model === "repo/review" && p8.provenance.roleSource === "repo", "conflicting direct selections resolve to the higher layer");

  // --- Additional tiers. ---
  const extra = resolveRuntime(synthetic(), [
    { source: "personal", runtimes: { codex: { tiers: { turbo: explicit("cx/turbo", "low") }, roles: { consult: { mode: "tier", tier: "turbo" } } } } },
  ], "codex").routes;
  check(extra.consult.model === "cx/turbo" && extra.consult.reasoningEffort === "low", "a custom tier selects a role");
  check(
    extra.consult.provenance.tier === "turbo" && extra.consult.provenance.tierSource === "personal"
      && extra.consult.provenance.roleSource === "personal",
    "custom tier provenance carries both sources",
  );
  check(extra.explore.model === "cx/fast", "custom tiers do not disturb default-mapped roles");

  // --- inherit vs default vs omission. ---
  const semantics = resolveRuntime(synthetic(), [
    { source: "personal", runtimes: { codex: { roles: { review: explicit("pers/review", "medium"), consult: { mode: "inherit" } } } } },
  ], "codex").routes;
  check(semantics.review.model === "pers/review", "a direct selection is explicit");
  check(semantics.consult.mode === "inherit", "inherit is intentional inheritance");
  check(semantics.explore.model === "cx/fast", "omission falls back to the default tier mapping");
  const semanticsAfterReset = resolveRuntime(synthetic(), [
    { source: "personal", runtimes: { codex: { roles: { review: explicit("pers/review", "medium"), consult: { mode: "inherit" } } } } },
    { source: "repo", runtimes: { codex: { roles: { review: { mode: "default" } } } } },
  ], "codex").routes;
  check(semanticsAfterReset.review.model === "cx/standard", "role: default clears the exception and restores the tier mapping");
  check(semanticsAfterReset.consult.mode === "inherit", "omission in a higher layer does not clear a lower inherit");

  // --- Both reset forms; a custom tier cannot be reset to default. ---
  const tierReset = resolveRuntime(synthetic(), [
    { source: "personal", runtimes: { codex: { tiers: { fast: explicit("pers/fast", "low") } } } },
    { source: "repo", runtimes: { codex: { tiers: { fast: { mode: "default" } } } } },
  ], "codex").routes.explore;
  check(tierReset.model === "cx/fast", "tier: default restores the installed-baseline tier definition");
  check(tierReset.provenance.tierSource === BASELINE_SOURCE, "tier reset provenance points back to the baseline");
  checkError(
    () => mergePreferenceLayers(synthetic(), [
      { source: "personal", runtimes: { codex: { tiers: { turbo: explicit("cx/turbo", "low") } } } },
      { source: "repo", runtimes: { codex: { tiers: { turbo: { mode: "default" } } } } },
    ]),
    "resetting a custom tier with default is rejected",
    ["'turbo'", "runtime: codex", "'repo'"],
  );

  // --- Undefined tier references and unknown roles are surfaced with source. ---
  checkError(
    () => resolveRuntime(synthetic(), [
      { source: "personal", runtimes: { codex: { roles: { review: { mode: "tier", tier: "nope" } } } } },
    ], "codex"),
    "a role referencing an undefined tier is rejected",
    ["'review'", "'nope'", "runtime: codex", "'personal'"],
  );
  checkError(
    () => resolveAllRuntimes(mutatedV2((q) => { delete q.runtimes.codex.tiers.deep; }), []),
    "a default tier mapping referencing a tier missing from a runtime is caught at resolution",
    ["'deep-review'", "'deep'", "runtime: codex"],
  );
  checkError(
    () => mergePreferenceLayers(synthetic(), [
      { source: "personal", runtimes: { codex: { roles: { coordinator: explicit("x", "low") } } } },
    ]),
    "an unknown role in a preference layer is rejected",
    ["'coordinator'", "runtime: codex"],
  );
  checkError(
    () => validateV2Routing(mutatedV2((q) => { q.roleTiers.coordinator = "fast"; delete q.roleTiers.consult; })),
    "an unknown role in baseline roleTiers is rejected",
    ["unknown role 'coordinator'"],
  );

  // --- Invalid selections carry runtime, role/tier, and source in errors. ---
  checkError(
    () => mergePreferenceLayers(synthetic(), [
      { source: "personal", runtimes: { codex: { tiers: { deep: explicit("x", "ultra") } } } },
    ]),
    "an unsupported tier effort is rejected",
    ["codex/tier 'deep'", "(got 'ultra')"],
  );
  checkError(
    () => mergePreferenceLayers(synthetic(), [
      { source: "repo", runtimes: { codex: { roles: { review: explicit("x", "ultra") } } } },
    ]),
    "an unsupported role-selection effort is rejected",
    ["codex/role 'review'", "(got 'ultra')"],
  );
  checkError(
    () => mergePreferenceLayers(synthetic(), [
      { source: "repo", runtimes: { codex: { roles: { review: { mode: "explicit", model: "", reasoningEffort: "low", fallbacks: [] } } } } },
    ]),
    "an empty model is rejected",
    ["codex/role 'review'", "non-empty model"],
  );
  checkError(
    () => mergePreferenceLayers(synthetic(), [
      { source: "repo", runtimes: { codex: { roles: { review: { mode: "auto" } } } } },
    ]),
    "an invalid mode is rejected",
    ["invalid mode 'auto'"],
  );
  const singleRuntime = mutatedV2((q) => { delete q.runtimes.opencode; });
  checkError(
    () => mergePreferenceLayers(singleRuntime, [
      { source: "repo", runtimes: { opencode: { tiers: { fast: explicit("x", "low") } } } },
    ]),
    "a layer targeting an undeclared runtime is rejected",
    ["targets runtime 'opencode'", "not declared in the installed baseline", "'repo'"],
  );
  checkError(
    () => mergePreferenceLayers(synthetic(), [
      { source: "repo", runtimes: { bogus: { tiers: {} } } },
    ]),
    "a layer targeting an unsupported runtime is rejected",
    ["unsupported runtime 'bogus'"],
  );

  // --- Personal and project routing.md override for antigravity ---
  const agPersonalLayer = {
    source: "personal routing.md",
    runtimes: {
      antigravity: {
        tiers: { fast: { mode: "explicit", model: "flash_lite", fallbacks: [] } },
        roles: { review: { mode: "inherit" } },
      },
    },
  };
  const agProjectLayer = {
    source: "project routing.md",
    runtimes: {
      antigravity: {
        roles: { consult: { mode: "explicit", model: "flash", fallbacks: [] } },
      },
    },
  };
  const agResolved = resolveRuntime(packaged, [agPersonalLayer, agProjectLayer], "antigravity");
  check(agResolved.routes.explore.model === "flash_lite", "personal routing.md tier override applies to fast tier in antigravity");
  check(agResolved.routes.review.mode === "inherit", "personal routing.md role override applies inherit in antigravity");
  check(agResolved.routes.consult.model === "flash", "project routing.md role override applies explicit model in antigravity");
  check(agResolved.routes["deep-review"].model === "pro", "untouched role in antigravity keeps baseline selection");

  // --- Effort-less entry is accepted for antigravity and rejected for codex ---
  const effortlessAg = {
    source: "repo",
    runtimes: {
      antigravity: {
        roles: { review: { mode: "explicit", model: "flash", fallbacks: [] } },
      },
    },
  };
  const validatedAgLayer = validatePreferenceLayer(effortlessAg, 0, { runtime: "antigravity" });
  check(validatedAgLayer.runtimes.antigravity.roles.review.model === "flash", "an effort-less entry is accepted for antigravity");

  const effortlessCodex = {
    source: "repo",
    runtimes: {
      codex: {
        roles: { review: { mode: "explicit", model: "gpt-6.1-sol", fallbacks: [] } },
      },
    },
  };
  checkError(
    () => validatePreferenceLayer(effortlessCodex, 0, { runtime: "codex" }),
    "an effort-less entry is rejected for codex",
    ["codex/role 'review'", "must carry exactly"],
  );

  // --- An entry with reasoningEffort on antigravity is rejected with RoutingError ---
  checkError(
    () => mergePreferenceLayers(packaged, [
      { source: "repo", runtimes: { antigravity: { roles: { review: explicit("pro", "high") } } } },
    ], "antigravity"),
    "an entry with reasoningEffort on antigravity role is rejected with RoutingError",
    ["antigravity/role 'review'", "must not include reasoningEffort"],
  );
  checkError(
    () => mergePreferenceLayers(packaged, [
      { source: "repo", runtimes: { antigravity: { tiers: { deep: explicit("pro", "high") } } } },
    ], "antigravity"),
    "an entry with reasoningEffort on antigravity tier is rejected with RoutingError",
    ["antigravity/tier 'deep'", "must not include reasoningEffort"],
  );

  // --- A fallback with reasoningEffort on antigravity is rejected with RoutingError ---
  checkError(
    () => mergePreferenceLayers(packaged, [
      {
        source: "repo",
        runtimes: {
          antigravity: {
            roles: {
              review: {
                mode: "explicit",
                model: "pro",
                fallbacks: [{ model: "flash", reasoningEffort: "medium" }],
              },
            },
          },
        },
      },
    ], "antigravity"),
    "a fallback with reasoningEffort on antigravity is rejected with RoutingError",
    ["antigravity/role 'review'", "fallback 0", "must not include reasoningEffort"],
  );

  // --- Atomic replacement at the role level removes old fallbacks. ---
  const atomicRole = resolveRuntime(synthetic(), [
    { source: "personal", runtimes: { codex: { roles: { review: explicit("pers/review", "medium", [{ model: "pers/fb", reasoningEffort: "low" }]) } } } },
    { source: "repo", runtimes: { codex: { roles: { review: explicit("repo/review", "low") } } } },
  ], "codex").routes.review;
  check(atomicRole.model === "repo/review" && atomicRole.fallbacks.length === 0, "atomic role replacement removes the previous fallbacks");

  // --- Configured fallback order survives normalization, export, and
  // resolution. ---
  const v1Fallbacks = structuredClone(OLD_V1);
  v1Fallbacks.runtimes.codex.review.fallbacks = [
    { model: "fb/first", reasoningEffort: "high" },
    { model: "fb/second", reasoningEffort: "low" },
  ];
  strictValidateRouting(v1Fallbacks);
  const v2Fallbacks = normalizeV1ToV2(v1Fallbacks, packaged);
  check(v2Fallbacks.provenance === v1Fallbacks.provenance, "normalization carries the version-1 provenance");
  check(
    JSON.stringify(v2Fallbacks.runtimes.codex.roles.review.fallbacks) === JSON.stringify(v1Fallbacks.runtimes.codex.review.fallbacks),
    "normalization preserves fallback order verbatim",
  );
  const fallbackPolicy = exportV1(resolveAllRuntimes(v2Fallbacks, []).runtimes.codex.routes, "codex", v2Fallbacks.provenance);
  check(
    JSON.stringify(fallbackPolicy.runtimes.codex.review.fallbacks) === JSON.stringify(v1Fallbacks.runtimes.codex.review.fallbacks),
    "export preserves fallback order",
  );

  // --- Version-1 imports: divergent roles, omitted -> inheritance,
  // undeclared runtimes -> packaged defaults. ---
  const divergent = structuredClone(OLD_V1);
  divergent.runtimes.codex.review.model = "openai/custom-review";
  const v2Divergent = normalizeV1ToV2(divergent, packaged);
  check(v2Divergent.runtimes.codex.roles.review.model === "openai/custom-review", "divergent roles are preserved verbatim");
  check(v2Divergent.runtimes.codex.roles["implement-hard"].model === "gpt-6.1-sol", "same-nominal-tier roles are not collapsed into tiers");
  check(
    resolveAllRuntimes(v2Divergent, []).runtimes.codex.routes.review.model === "openai/custom-review",
    "divergent roles win over their nominal tier at resolution",
  );
  const partialV1 = { schemaVersion: 1, runtimes: { codex: structuredClone(OLD_V1.runtimes.codex) } };
  strictValidateRouting(partialV1);
  const v2Partial = normalizeV1ToV2(partialV1, packaged);
  check(Object.keys(v2Partial.runtimes).length === 4, "a partial version-1 import keeps all four runtimes");
  check(JSON.stringify(v2Partial.runtimes.copilot.roles) === "{}", "undeclared runtimes keep the baseline defaults");
  const resolvedPartial = resolveAllRuntimes(v2Partial, []);
  check(resolvedPartial.runtimes.copilot.routes.review.model === OLD_V1.runtimes.copilot.review.model, "undeclared runtimes resolve to the packaged defaults");
  check(resolvedPartial.runtimes.codex.routes.explore.model === OLD_V1.runtimes.codex.explore.model, "declared runtimes keep the imported selections");
  const { merged: v2Merged, added } = mergeV2MissingRuntimes(
    {
      schemaVersion: 2,
      roleTiers: structuredClone(synthetic().roleTiers),
      runtimes: { codex: { tiers: { fast: explicit("mine/fast", "low"), standard: explicit("mine/std", "low"), deep: explicit("mine/deep", "low") }, roles: {} } },
    },
    packaged,
  );
  check(JSON.stringify(added) === JSON.stringify(["copilot", "opencode", "antigravity"]), "mergeV2MissingRuntimes reports the filled runtimes");
  check(v2Merged.runtimes.codex.tiers.fast.model === "mine/fast", "mergeV2MissingRuntimes leaves declared runtimes untouched");
  check(JSON.stringify(v2Merged.runtimes.copilot) === JSON.stringify(packaged.runtimes.copilot), "mergeV2MissingRuntimes fills undeclared runtimes from the packaged baseline");

  // --- Legacy --models inventory import. ---
  const { baseline: legacyV2, omitted } = legacyInventoryToV2(
    { explore: "openai/gpt-6-luna#max", review: "openai/gpt-6.1-sol" },
    synthetic(),
  );
  check(
    JSON.stringify([...omitted].sort()) === JSON.stringify(ROLES.filter((role) => !["explore", "review"].includes(role)).sort()),
    "the legacy import reports omitted roles",
  );
  check(
    legacyV2.runtimes.codex.roles.explore.mode === "explicit"
      && legacyV2.runtimes.codex.roles.explore.model === "gpt-6-luna"
      && legacyV2.runtimes.opencode.roles.explore.model === "openai/gpt-6-luna"
      && legacyV2.runtimes.codex.roles.explore.reasoningEffort === "max",
    "legacy OpenCode provider prefixes convert to native Codex model IDs",
  );
  check(legacyV2.runtimes.codex.roles.review.reasoningEffort === "high", "a missing variant carries the legacy default effort");
  check(legacyV2.runtimes.codex.roles.fix.mode === "inherit", "omitted legacy inventory entries remain inheritance");
  const legacyResolved = resolveAllRuntimes(legacyV2, []);
  check(legacyResolved.runtimes.codex.routes.explore.mode === "explicit" && legacyResolved.runtimes.codex.routes.fix.mode === "inherit", "legacy import resolves present and omitted roles correctly");
  checkError(() => legacyInventoryToV2({ bogus: "x" }, synthetic()), "the legacy import rejects an unknown role", ["Unknown role in model mapping: bogus"]);
  checkError(() => legacyInventoryToV2({ explore: "x#ultra" }, synthetic()), "the legacy import rejects an unsupported variant", ["#ultra"]);
  checkError(() => legacyInventoryToV2("nope", synthetic()), "the legacy import rejects a non-object inventory", ["JSON object keyed by role name"]);

  // --- Legacy --models import with packaged baseline leaves antigravity untouched ---
  const { baseline: legacyAgBaseline, skippedRuntimes } = legacyInventoryToV2(
    { explore: "openai/gpt-6-luna#max", review: "openai/gpt-6.1-sol" },
    packaged,
  );
  check(skippedRuntimes.includes("antigravity"), "legacyInventoryToV2 reports antigravity in skippedRuntimes");
  check(
    JSON.stringify(legacyAgBaseline.runtimes.antigravity) === JSON.stringify(packaged.runtimes.antigravity),
    "legacyInventoryToV2 leaves antigravity untouched",
  );
  check(Object.keys(legacyAgBaseline.runtimes.antigravity.roles).length === 0, "antigravity roles remain empty");

  // --- Build overrides. ---
  const noModelBaseline = applyBuildOverrides(synthetic(), { noModel: true });
  for (const runtime of Object.keys(noModelBaseline.runtimes)) {
    check(
      JSON.stringify(Object.values(noModelBaseline.runtimes[runtime].roles)) === JSON.stringify(ROLES.map(() => ({ mode: "inherit" }))),
      `--no-model turns every ${runtime} role into explicit inheritance`,
    );
  }
  check(
    resolveAllRuntimes(noModelBaseline, []).runtimes.codex.routes.review.mode === "inherit",
    "--no-model resolves every route to inheritance",
  );
  const effortBaseline = applyBuildOverrides(withFallbacks, { effort: "low" });
  check(effortBaseline.runtimes.codex.tiers.deep.reasoningEffort === "low", "--effort overrides explicit tier efforts");
  check(
    JSON.stringify(effortBaseline.runtimes.codex.tiers.deep.fallbacks) === JSON.stringify(withFallbacks.runtimes.codex.tiers.deep.fallbacks),
    "--effort leaves configured fallback pairs untouched",
  );
  check(JSON.stringify(applyBuildOverrides(synthetic(), { effort: null })) === JSON.stringify(synthetic()), "a null effort is a no-op");
  checkError(() => applyBuildOverrides(synthetic(), { effort: "ultra" }), "applyBuildOverrides rejects an invalid effort", ["Invalid --effort 'ultra'"]);

  // --- --effort skips antigravity with a notice ---
  const notices = [];
  const effortResult = applyBuildOverrides(packaged, {
    effort: "low",
    onNotice: (msg) => notices.push(msg),
  });
  check(notices.some((n) => n.includes("runtime 'antigravity' has no effort control; skipping --effort override.")), "--effort override reports notice for antigravity");
  check(effortResult.runtimes.codex.tiers.fast.reasoningEffort === "low", "--effort overrides codex tier effort");
  check(effortResult.runtimes.antigravity.tiers.fast.reasoningEffort === undefined, "--effort leaves antigravity tier without reasoningEffort");

  // --- Discovery helper: personal then project, dedup, exact roots. ---
  check(
    JSON.stringify(discoverPreferencePaths({ projectRoot: "/tmp/proj", homeDir: "/home/u" }))
      === JSON.stringify([join(resolve("/home/u"), ".agenticale", "routing.md"), join(resolve("/tmp/proj"), ".agenticale", "routing.md")]),
    "discovery lists the personal file before the project file",
  );
  check(discoverPreferencePaths({ projectRoot: "/home/u", homeDir: "/home/u" }).length === 1, "discovery dedups when the project root is the home directory");
  check(
    JSON.stringify(discoverPreferencePaths({ homeDir: "/home/u" })) === JSON.stringify([join(resolve("/home/u"), ".agenticale", "routing.md")]),
    "discovery lists only the home file without a project root",
  );

  // --- Named routing profiles: optional per-layer profile maps that expand
  // into extra precedence-ordered sub-layers when selected. ---

  // Layer shape: a valid profiles map normalizes; array/string are
  // layer-shape RoutingErrors; non-object values are dropped; empty is a
  // no-op; the unknown-key message names the new key.
  const profileLayer = {
    source: "personal routing.md",
    runtimes: { codex: { tiers: { fast: explicit("pers/fast", "medium") } } },
    profiles: { "server-b": { codex: { tiers: { fast: explicit("p-prof/fast", "max") } } } },
  };
  const normalizedProfileLayer = normalizePreferenceInput(profileLayer);
  check(normalizedProfileLayer[0].profiles["server-b"].codex.tiers.fast.model === "p-prof/fast", "a layer with a profiles map normalizes to a shape-checked profiles entry");
  checkError(() => validatePreferenceLayer({ source: "x", profiles: ["server-b"] }, 0), "profiles as an array is a layer-shape RoutingError", ["profiles", "JSON object"]);
  checkError(() => validatePreferenceLayer({ source: "x", profiles: "server-b" }, 0), "profiles as a string is a layer-shape RoutingError", ["profiles", "JSON object"]);
  checkError(() => validatePreferenceLayer({ source: "x", bogus: true }, 0), "the preference layer unknown-key message lists profiles", ["(expected source, runtimes, profiles)"]);
  const weirdProfiles = {
    source: "x",
    runtimes: { codex: { tiers: { fast: explicit("f/fast", "low") } } },
    profiles: { "server-b": "oops", fine: { codex: {} } },
  };
  const normalizedWeird = normalizePreferenceInput(weirdProfiles);
  check(Object.keys(normalizedWeird[0].profiles).join(",") === "fine", "a non-object profile value is dropped from the normalized layer");
  check(JSON.stringify(availableProfiles(weirdProfiles, "codex")) === JSON.stringify(["fine"]), "a non-object profile value is not available and causes no error");
  check(resolveRuntime(synthetic(), [weirdProfiles], "codex", "fine").routes.explore.model === "f/fast", "a valid other profile still resolves beside an invalid unselected one");
  const emptyProfiles = { source: "x", runtimes: { codex: { tiers: { fast: explicit("f/fast", "low") } } }, profiles: {} };
  check(
    JSON.stringify(resolveRuntime(synthetic(), [emptyProfiles], "codex").routes)
      === JSON.stringify(resolveRuntime(synthetic(), [{ source: "x", runtimes: emptyProfiles.runtimes }], "codex").routes),
    "an empty profiles object is a no-op",
  );

  // Profile identifier grammar.
  check(isValidProfileName("server-b"), "isValidProfileName accepts 'server-b'");
  check(isValidProfileName("alternate-provider"), "isValidProfileName accepts 'alternate-provider'");
  check(isValidProfileName("a"), "isValidProfileName accepts a single letter");
  check(isValidProfileName(`a${"b".repeat(39)}`), "isValidProfileName accepts a 40-character name");
  check(!isValidProfileName("Server-B"), "isValidProfileName rejects uppercase letters");
  check(!isValidProfileName("9lives"), "isValidProfileName rejects a leading digit");
  check(!isValidProfileName("server-"), "isValidProfileName rejects a trailing hyphen");
  check(!isValidProfileName(`a${"b".repeat(40)}`), "isValidProfileName rejects a 41-character name");
  check(!isValidProfileName("default"), "isValidProfileName rejects reserved 'default'");
  check(!isValidProfileName("inherit"), "isValidProfileName rejects reserved 'inherit'");
  check(!isValidProfileName(""), "isValidProfileName rejects the empty string");
  check(!isValidProfileName(42), "isValidProfileName rejects a non-string");
  checkError(
    () => resolveRuntime(synthetic(), [profileLayer], "codex", "Server-B"),
    "an invalid selected profile name is a grammar RoutingError",
    ["'Server-B'", "lowercase", "trailing hyphen", "40 characters", "reserved"],
  );
  checkError(
    () => resolveRuntime(synthetic(), [profileLayer], "codex", "inherit"),
    "selecting the reserved name 'inherit' is a grammar RoutingError",
    ["'inherit'", "reserved"],
  );

  // Partial profile: only the fast/routine-mapped roles change; the rest are
  // identical to the no-profile resolution.
  const partialProfileLayers = [{
    source: "personal routing.md",
    runtimes: { codex: { tiers: { fast: explicit("pers/fast", "medium") } } },
    profiles: {
      "server-b": { codex: { tiers: { fast: explicit("p-prof/fast", "max"), routine: explicit("p-prof/routine", "low") } } },
    },
  }];
  const partialWith = resolveRuntime(synthetic(), partialProfileLayers, "codex", "server-b");
  const partialWithout = resolveRuntime(synthetic(), partialProfileLayers, "codex");
  for (const role of ["explore", "implement", "fix"]) {
    check(partialWith.routes[role].model === "p-prof/fast", `a partial profile changes only the ${role} role mapped to the redefined tier`);
    check(
      partialWith.routes[role].provenance.tier === "fast"
        && partialWith.routes[role].provenance.tierSource === "personal routing.md (profile server-b)",
      `the ${role} route carries the profile sub-layer source`,
    );
  }
  for (const role of ["implement-hard", "review", "deep-review", "consult"]) {
    check(JSON.stringify(partialWith.routes[role]) === JSON.stringify(partialWithout.routes[role]), `the partial profile leaves ${role} at its no-profile resolution`);
  }

  // Precedence across the layer order: personal default < personal profile <
  // project default < project profile for the same key.
  const ePersDefault = { source: "personal routing.md", runtimes: { codex: { tiers: { fast: explicit("pers/fast", "medium") } } } };
  const ePersProfile = { source: "personal routing.md", profiles: { "server-b": { codex: { tiers: { fast: explicit("p-prof/fast", "low") } } } } };
  const eProjDefault = { source: "project routing.md", runtimes: { codex: { tiers: { fast: explicit("proj/fast", "medium") } } } };
  const eProjProfile = { source: "project routing.md", profiles: { "server-b": { codex: { tiers: { fast: explicit("proj-prof/fast", "low") } } } } };
  const eAll = resolveRuntime(synthetic(), [ePersDefault, ePersProfile, eProjDefault, eProjProfile], "codex", "server-b").routes.explore;
  check(eAll.model === "proj-prof/fast", "the project profile outranks the project default, the personal profile, and the personal default for the same key");
  const eNoProjProfile = resolveRuntime(synthetic(), [ePersDefault, ePersProfile, eProjDefault], "codex", "server-b").routes.explore;
  check(eNoProjProfile.model === "proj/fast", "without the project profile the project default outranks the personal profile");
  // With no project entries at all, the personal profile outranks the
  // personal default, completing the key-ordering proof.
  const eNoProjDefault = resolveRuntime(synthetic(), [ePersDefault, ePersProfile], "codex", "server-b").routes.explore;
  check(eNoProjDefault.model === "p-prof/fast", "without the project entries the personal profile outranks the personal default");
  const ePersRole = { source: "personal routing.md", profiles: { "server-b": { codex: { roles: { review: explicit("p-prof/review", "medium") } } } } };
  const eProjRole = { source: "project routing.md", profiles: { "server-b": { codex: { roles: { review: explicit("proj-prof/review", "low") } } } } };
  const eRoles = resolveRuntime(synthetic(), [ePersRole, eProjRole], "codex", "server-b").routes.review;
  check(
    eRoles.model === "proj-prof/review" && eRoles.provenance.roleSource === "project routing.md (profile server-b)",
    "a project profile direct selection outranks a matching personal profile direct selection",
  );

  // Complete seven-level precedence regression: baseline < personal default
  // < personal profile < project default < project profile <
  // invocation-Markdown default < invocation-Markdown profile < direct
  // invocation override. Each of the seven levels defines a distinct fast
  // tier (observed through the tier-mapped explore role) and a distinct
  // direct review selection; removing levels from the top down must hand the
  // win to the next-lower level, all the way down to the baseline.
  const sevenLevelSources = [
    ["personal routing.md", true],
    ["personal routing.md", false],
    ["project routing.md", true],
    ["project routing.md", false],
    ["invocation routing.md", true],
    ["invocation routing.md", false],
    ["direct invocation", true],
  ];
  const sevenLevels = sevenLevelSources.map(([source, isDefault], i) => {
    const section = { codex: { tiers: { fast: explicit(`lv${i + 1}/fast`, "low") }, roles: { review: explicit(`lv${i + 1}/review`, "low") } } };
    return isDefault
      ? { source, runtimes: section }
      : { source, profiles: { "server-b": section } };
  });
  const sevenFull = resolveRuntime(synthetic(), sevenLevels, "codex", "server-b");
  check(sevenFull.routes.explore.model === "lv7/fast", "seven-level precedence: the full stack resolves the tier-mapped explore role to the direct-invocation fast tier");
  check(sevenFull.routes.review.model === "lv7/review" && sevenFull.routes.review.provenance.roleSource === "direct invocation", "seven-level precedence: the full stack resolves review to the direct-invocation selection");
  for (let kept = 6; kept >= 0; kept -= 1) {
    const winner = kept > 0 ? `lv${kept}` : null;
    // Once the removal passes the lowest profile layer (level 2), no remaining
    // layer defines 'server-b', so the chain continues with ordinary routing;
    // the default sections still prove the remaining order down to baseline.
    const seven = resolveRuntime(synthetic(), sevenLevels.slice(0, kept), "codex", kept >= 2 ? "server-b" : null);
    const expectedExplore = winner ? `${winner}/fast` : "cx/fast";
    const expectedReview = winner ? `${winner}/review` : "cx/standard";
    check(seven.routes.explore.model === expectedExplore, `seven-level precedence: removing levels above ${winner ?? "the baseline"} makes the tier-mapped explore role follow ${winner ? `level ${winner}'s` : "the baseline's"} fast tier`);
    check(seven.routes.review.model === expectedReview, `seven-level precedence: removing levels above ${winner ?? "the baseline"} makes the direct review selection come from ${winner ? `level ${winner}` : "the baseline"}`);
  }

  // Cross-file profile extension: the same profile name in two layers merges
  // per key, and a tier reference in one layer resolves against the other.
  const fPers = { source: "personal routing.md", profiles: { "server-b": { codex: { tiers: { fast: explicit("p-prof/fast", "max") }, roles: { explore: { mode: "tier", tier: "routine" } } } } } };
  const fProj = { source: "project routing.md", profiles: { "server-b": { codex: { tiers: { routine: explicit("proj-prof/routine", "low") } } } } };
  const fResolved = resolveRuntime(synthetic(), [fPers, fProj], "codex", "server-b");
  check(fResolved.routes.explore.model === "proj-prof/routine", "a tier reference in one profile layer resolves against a tier defined by the same profile in another layer");
  check(
    fResolved.routes.explore.provenance.tier === "routine"
      && fResolved.routes.explore.provenance.tierSource === "project routing.md (profile server-b)"
      && fResolved.routes.explore.provenance.roleSource === "personal routing.md (profile server-b)",
    "cross-file profile extension records both profile sub-layer sources",
  );
  check(fResolved.routes.implement.model === "p-prof/fast" && fResolved.routes.fix.model === "p-prof/fast", "the personal profile key still applies where the project profile is silent");
  const fMerged = mergePreferenceLayers(synthetic(), [fPers, fProj], "codex", "server-b");
  check(
    fMerged.tiers.codex.fast.source === "personal routing.md (profile server-b)"
      && fMerged.tiers.codex.routine.source === "project routing.md (profile server-b)",
    "cross-file profiles merge per key under each defining layer's profile label",
  );

  // Role exceptions interact with a selected profile: direct selections
  // survive tier changes, tier-mapped roles follow redefinitions, and
  // `role: default` clears a lower direct selection over profile-adjusted
  // tiers.
  const gDirect = resolveRuntime(synthetic(), [
    { source: "personal routing.md", runtimes: { codex: { roles: { review: explicit("pers/review", "medium") } } } },
    { source: "personal routing.md", profiles: { "server-b": { codex: { tiers: { standard: explicit("p-prof/std", "low") } } } } },
  ], "codex", "server-b").routes.review;
  check(gDirect.model === "pers/review" && gDirect.provenance.selection === "role-exception", "a default-layer direct selection survives the selected profile's tier changes");
  const gMapped = resolveRuntime(synthetic(), [
    { source: "project routing.md", profiles: { "server-b": { codex: { tiers: { standard: explicit("proj-prof/std", "low") } } } } },
  ], "codex", "server-b").routes.review;
  check(gMapped.model === "proj-prof/std", "a role mapped to a profile-redefined tier follows the redefinition");
  const gClear = resolveRuntime(synthetic(), [
    { source: "personal routing.md", runtimes: { codex: { roles: { review: explicit("pers/review", "medium") } } } },
    { source: "project routing.md", profiles: { "server-b": { codex: { tiers: { standard: explicit("proj-prof/std", "low") }, roles: { review: { mode: "default" } } } } } },
  ], "codex", "server-b").routes.review;
  check(
    gClear.model === "proj-prof/std"
      && gClear.provenance.selection === "default-tier-mapping"
      && gClear.provenance.tier === "standard"
      && gClear.provenance.tierSource === "project routing.md (profile server-b)",
    "a profile role:default clears the lower direct selection over the profile-adjusted tiers",
  );

  // `tier: default` inside a selected profile restores the installed-baseline
  // definition, not a lower profile/default replacement.
  const hReset = resolveRuntime(synthetic(), [
    { source: "personal routing.md", runtimes: { codex: { tiers: { fast: explicit("pers/fast", "low") } } } },
    { source: "personal routing.md", profiles: { "server-b": { codex: { tiers: { fast: explicit("p-prof/fast", "low") } } } } },
    { source: "project routing.md", profiles: { "server-b": { codex: { tiers: { fast: { mode: "default" } } } } } },
  ], "codex", "server-b").routes.explore;
  check(hReset.model === "cx/fast" && hReset.provenance.tierSource === BASELINE_SOURCE, "tier:default in a selected profile restores the installed-baseline definition");

  // Atomic replacement: a profile tier replacement drops the replaced tier's
  // fallbacks, and a replacement without fallbacks yields an empty list.
  const withProfileFallbacks = synthetic();
  withProfileFallbacks.runtimes.codex.tiers.deep = explicit("cx/deep", "xhigh", [{ model: "cx/fb-1", reasoningEffort: "high" }]);
  const iAtomic = resolveRuntime(withProfileFallbacks, [
    { source: "personal routing.md", profiles: { "server-b": { codex: { tiers: { deep: explicit("p-prof/deep", "low") } } } } },
  ], "codex", "server-b").routes["deep-review"];
  check(iAtomic.model === "p-prof/deep" && iAtomic.fallbacks.length === 0, "a profile tier replacement drops the replaced tier's fallbacks");

  // Unknown and other-runtime-only profile selection.
  const jLayers = [
    { source: "personal routing.md", profiles: { "server-b": { codex: { tiers: { fast: explicit("p1", "low") } } } } },
    { source: "project routing.md", profiles: { "alternate-provider": { codex: { tiers: { fast: explicit("p2", "low") } } } } },
  ];
  let jMessage = "";
  try {
    resolveRuntime(synthetic(), jLayers, "codex", "nope");
  } catch (error) {
    jMessage = error.message;
  }
  check(
    jMessage === "Unknown routing profile 'nope' for runtime 'codex'. Available profiles for this runtime: alternate-provider, server-b.",
    "an unknown profile error is actionable and lists the sorted available names",
  );
  const kOther = { source: "personal routing.md", profiles: { "server-b": { opencode: { tiers: { fast: explicit("oc/fast", "low") } } } } };
  checkError(
    () => resolveRuntime(synthetic(), [kOther], "codex", "server-b"),
    "a profile defined only for another runtime is not a silent default resolution",
    ["'server-b'", "'codex'", "No routing profiles are defined for this runtime"],
  );
  const kOther2 = { source: "personal routing.md", profiles: { "server-b": { codex: { tiers: { fast: explicit("cx/fast", "low") } } } } };
  checkError(
    () => resolveRuntime(synthetic(), [kOther2], "opencode", "server-b"),
    "a profile defined only for codex is unavailable for opencode",
    ["'server-b'", "'opencode'", "No routing profiles are defined for this runtime"],
  );

  // Unselected invalid entries never block; the same broken entry in the
  // selected profile is rejected with the profile source label.
  const lBroken = {
    source: "personal routing.md",
    runtimes: { codex: { tiers: { deep: explicit("alt/deep", "low") } } },
    profiles: {
      "server-b": { codex: { roles: { review: { mode: "broken" } } } },
      alternate: { codex: {} },
    },
  };
  const lNoProfile = resolveRuntime(synthetic(), [lBroken], "codex");
  const lOtherProfile = resolveRuntime(synthetic(), [lBroken], "codex", "alternate");
  check(JSON.stringify(lNoProfile.routes) === JSON.stringify(resolveRuntime(synthetic(), [lBroken], "codex", null).routes), "a broken entry in an unselected profile does not block ordinary routing");
  check(JSON.stringify(lOtherProfile.routes) === JSON.stringify(lNoProfile.routes), "a broken entry in an unselected profile does not block a different profile selection");
  check(lNoProfile.routes["deep-review"].model === "alt/deep", "the default part of a layer with a broken unselected profile still applies");
  checkError(
    () => resolveRuntime(synthetic(), [lBroken], "codex", "server-b"),
    "the same broken entry in the selected profile is rejected",
    ["(profile server-b)", "codex/role 'review'", "invalid mode 'broken'"],
  );

  // `profile === "default"` is ordinary routing: identical resolution and
  // export.
  const mLayers = [{
    source: "personal routing.md",
    runtimes: { codex: { tiers: { fast: explicit("pers/fast", "medium") } } },
    profiles: { "server-b": { codex: { tiers: { fast: explicit("p-prof/fast", "low") } } } },
  }];
  const mNo = exportV1(resolveRuntime(synthetic(), mLayers, "codex").routes, "codex", "prov");
  const mDefault = exportV1(resolveRuntime(synthetic(), mLayers, "codex", "default").routes, "codex", "prov");
  check(JSON.stringify(mNo) === JSON.stringify(mDefault), "profile 'default' resolves and exports identically to ordinary routing");

  // resolveAllRuntimes passes the profile through for every runtime.
  const arLayers = [{ source: "personal routing.md", profiles: { "server-b": { codex: { tiers: { fast: explicit("p-prof/fast", "low") } }, opencode: { tiers: { fast: explicit("p-prof-oc/fast", "low") } } } } }];
  const arWith = resolveAllRuntimes(synthetic(), arLayers, "server-b");
  check(arWith.runtimes.codex.routes.explore.model === "p-prof/fast" && arWith.runtimes.opencode.routes.explore.model === "p-prof-oc/fast", "resolveAllRuntimes applies the selected profile to every declared runtime");
  checkError(
    () => resolveAllRuntimes(synthetic(), [{ source: "x", profiles: { "server-b": { codex: {} } } }], "nope"),
    "an unknown profile in resolveAllRuntimes is rejected with the available names",
    ["'nope'", "for this activation", "server-b"],
  );

  // availableProfiles: sorted per runtime, missing-runtime values and
  // reserved/invalid names excluded, null and single-object inputs accepted.
  const oLayers = [
    { source: "a", profiles: { "server-b": { codex: {}, opencode: {} }, default: { codex: {} }, inherit: { opencode: {} }, Upper: { codex: {} } } },
    { source: "b", runtimes: { codex: {} }, profiles: { "alternate-provider": { opencode: {} }, "server-b": { codex: {} } } },
  ];
  check(JSON.stringify(availableProfiles(oLayers, "codex")) === JSON.stringify(["server-b"]), "availableProfiles returns sorted unique names for the runtime");
  check(JSON.stringify(availableProfiles(oLayers, "opencode")) === JSON.stringify(["alternate-provider", "server-b"]), "availableProfiles unions across layers and excludes reserved and invalid names");
  check(JSON.stringify(availableProfiles(oLayers, "antigravity")) === JSON.stringify([]), "availableProfiles excludes a profile whose value lacks the runtime key");
  check(JSON.stringify(availableProfiles(oLayers)) === JSON.stringify(["alternate-provider", "server-b"]), "availableProfiles without a runtime uses any runtime key");
  check(JSON.stringify(availableProfiles(null)) === JSON.stringify([]), "availableProfiles(null) is empty");
  check(JSON.stringify(availableProfiles({ source: "c", profiles: { solo: { codex: {} } } }, "codex")) === JSON.stringify(["solo"]), "availableProfiles accepts a single layer object");
  check(
    JSON.stringify(availableProfiles([{ profiles: { empty: {}, "has-runtime": { codex: {} } } }]))
      === JSON.stringify(["has-runtime"]),
    "availableProfiles without a runtime excludes a value with no runtime keys and includes a value with a runtime key",
  );

  // A valid profile name that shadows a prototype-chain member
  // ('constructor') resolves through the layer that defines it even when a
  // higher-precedence layer has no profiles key at all.
  const cLayerA = { source: "personal routing.md", profiles: { constructor: { codex: { tiers: { fast: explicit("c-prof/fast", "max") } } } } };
  const cLayerB = { source: "project routing.md", runtimes: { codex: { tiers: { deep: explicit("cB/deep", "low") } } } };
  const cResolved = resolveRuntime(synthetic(), [cLayerA, cLayerB], "codex", "constructor");
  check(cResolved.routes.explore.model === "c-prof/fast", "a profile named 'constructor' resolves past a higher profiles-omitting layer without a prototype-chain hit");
  check(cResolved.routes["deep-review"].model === "cB/deep", "the profiles-omitting layer still contributes its default runtimes");
  check(JSON.stringify(availableProfiles([cLayerA, cLayerB], "codex")) === JSON.stringify(["constructor"]), "a prototype-shadowing profile name is reported available");

  // A defined-but-empty profile section for the active runtime is a no-op:
  // selecting it resolves to exactly the no-profile resolution.
  const cEmptySection = [{ source: "personal routing.md", profiles: { "empty-oc": { opencode: {} } } }];
  check(
    JSON.stringify(resolveRuntime(synthetic(), cEmptySection, "opencode", "empty-oc").routes)
      === JSON.stringify(resolveRuntime(synthetic(), cEmptySection, "opencode").routes),
    "selecting a profile whose section is empty for the active runtime equals the no-profile resolution",
  );

  // --- Installed-fixture `resolve` CLI: the module runs from an installed
  // location with the source checkout absent from its path, reads structured
  // JSON from stdin or --input, and emits a strict version-1 policy. ---
  const fixtureRoot = await mkdtemp(join(scratch, "installed-"));
  await mkdir(join(fixtureRoot, "scripts"), { recursive: true });
  await mkdir(join(fixtureRoot, "references"), { recursive: true });
  await cp(modulePath, join(fixtureRoot, "scripts", "routing.mjs"), { recursive: true });
  await writeFile(join(fixtureRoot, "references", "routing.json"), `${JSON.stringify(packaged, null, 2)}\n`, "utf8");
  const personalRoot = join(fixtureRoot, "home");
  await mkdir(personalRoot, { recursive: true });
  const cli = (args, input) => spawnSync(process.execPath, [join(fixtureRoot, "scripts", "routing.mjs"), ...args], {
    encoding: "utf8",
    input: input ?? "",
    cwd: fixtureRoot,
    env: { ...process.env, HOME: personalRoot, USERPROFILE: personalRoot },
  });
  const cliPref = JSON.stringify([{ source: "personal routing.md", runtimes: { codex: { tiers: { deep: explicit("alt/deep", "low") } } } }]);
  const cliRun = cli(["resolve", "--runtime", "codex"], cliPref);
  check(cliRun.status === 0, `installed-fixture resolve CLI exits 0 with stdin preferences${cliRun.status === 0 ? "" : ` (stderr: ${cliRun.stderr.trim()})`}`);
  const cliPolicy = JSON.parse(cliRun.stdout);
  let cliStrictError = null;
  try {
    strictValidateRouting(cliPolicy);
  } catch (error) {
    cliStrictError = error;
  }
  check(cliStrictError === null, `CLI output passes the strict version-1 contract${cliStrictError ? ` (${cliStrictError.message})` : ""}`);
  check(cliPolicy.schemaVersion === 1, "CLI emits a version-1 policy");
  check(JSON.stringify(Object.keys(cliPolicy.runtimes)) === JSON.stringify(["codex"]), "CLI emits only the active runtime");
  check(cliPolicy.runtimes.codex["deep-review"].model === "alt/deep" && cliPolicy.runtimes.codex["deep-review"].reasoningEffort === "low", "CLI applies the stdin tier preference");
  check(cliPolicy.runtimes.codex.explore.model === packaged.runtimes.codex.tiers.fast.model, "CLI leaves baseline routes at their packaged selection");
  await writeFile(join(fixtureRoot, "prefs.json"), cliPref, "utf8");
  const copilotPref = JSON.stringify([{ source: "project routing.md", runtimes: { copilot: { roles: { review: explicit("acme/copilot-review", "xhigh") } } } }]);
  await writeFile(join(fixtureRoot, "prefs.json"), copilotPref, "utf8");
  const cliInput = cli(["resolve", "--runtime", "copilot", "--input", join(fixtureRoot, "prefs.json")]);
  check(cliInput.status === 0, `installed-fixture resolve --input exits 0${cliInput.status === 0 ? "" : ` (stderr: ${cliInput.stderr.trim()})`}`);
  const cliInputPolicy = JSON.parse(cliInput.stdout);
  check(cliInputPolicy.runtimes.copilot.review.model === "acme/copilot-review" && cliInputPolicy.runtimes.copilot.review.reasoningEffort === "xhigh", "installed helper applies the interpreted Copilot customization");
  check(cliInputPolicy.runtimes.copilot["deep-review"].model === packaged.runtimes.copilot.tiers.deep.model, "a runtime-untouched role keeps its baseline selection");
  const personalPrefsPath = join(personalRoot, ".agenticale", "routing.json");
  const projectPrefsPath = join(fixtureRoot, ".agenticale", "routing.md");
  await mkdir(join(personalRoot, ".agenticale"), { recursive: true });
  await mkdir(join(fixtureRoot, ".agenticale"), { recursive: true });
  await writeFile(personalPrefsPath, "malformed legacy JSON", "utf8");
  await writeFile(projectPrefsPath, "# Copilot only\nUse gpt-6-luna for exploration.\n", "utf8");
  const undiscovered = cli(["resolve", "--runtime", "codex"]);
  check(undiscovered.status === 0, `resolver ignores user files unless supplied as structured input${undiscovered.status === 0 ? "" : ` (stderr: ${undiscovered.stderr.trim()})`}`);
  const undiscoveredPolicy = JSON.parse(undiscovered.stdout);
  check(undiscoveredPolicy.runtimes.codex.review.model === packaged.runtimes.codex.tiers.standard.model, "Markdown stays the human interface and does not block baseline resolution");
  const inactiveMalformed = cli(["resolve", "--runtime", "codex"], JSON.stringify([{ source: "project routing.md", runtimes: { copilot: { roles: { review: { mode: "broken" } } } } }]));
  check(inactiveMalformed.status === 0, "malformed inactive-runtime preferences do not block active runtime resolution");
  const activeMalformed = cli(["resolve", "--runtime", "codex"], JSON.stringify([{ source: "project routing.md", runtimes: { codex: { roles: { review: { mode: "broken" } } } } }]));
  check(activeMalformed.status === 1 && /codex\/role 'review'/.test(activeMalformed.stderr), "malformed active-runtime preferences identify the route");
  const explained = cli(["resolve", "--runtime", "codex", "--explain"], cliPref);
  check(explained.status === 0, "--explain returns route provenance");
  const explanation = JSON.parse(explained.stdout);
  check(explanation.policy.schemaVersion === 1 && explanation.routeProvenance["deep-review"].tierSource === "personal routing.md", "--explain preserves per-route provenance beside the strict policy");

  // The OpenCode preparation export: a complete seven-role policy for the
  // active runtime with a tier replacement carrying an ordered fallback list
  // and an intentional inheritance role. The fallback list is preserved
  // verbatim in the strict version-1 output — the seven-profile adapter cannot
  // execute it (runtimes/opencode.md), but the export must not lose it.
  const ocFb = [{ model: "acme/fb-1", reasoningEffort: "high" }, { model: "acme/fb-2", reasoningEffort: "medium" }];
  const cliOc = cli(["resolve", "--runtime", "opencode"], JSON.stringify([
    {
      source: "repo",
      runtimes: {
        opencode: {
          tiers: { deep: explicit("acme/deep", "xhigh", ocFb) },
          roles: { consult: { mode: "inherit" } },
        },
      },
    },
  ]));
  check(cliOc.status === 0, `installed-fixture opencode preparation export exits 0${cliOc.status === 0 ? "" : ` (stderr: ${cliOc.stderr.trim()})`}`);
  const cliOcPolicy = JSON.parse(cliOc.stdout);
  let cliOcStrictError = null;
  try {
    strictValidateRouting(cliOcPolicy);
  } catch (error) {
    cliOcStrictError = error;
  }
  check(cliOcStrictError === null, `opencode export passes the strict version-1 contract${cliOcStrictError ? ` (${cliOcStrictError.message})` : ""}`);
  check(JSON.stringify(Object.keys(cliOcPolicy.runtimes)) === JSON.stringify(["opencode"]), "opencode export contains only the active runtime");
  check(JSON.stringify(Object.keys(cliOcPolicy.runtimes.opencode).sort()) === JSON.stringify([...ROLES].sort()), "opencode export is complete: all seven roles");
  check(cliOcPolicy.runtimes.opencode["deep-review"].model === "acme/deep", "opencode export resolves the tier reference for its mapped roles");
  check(JSON.stringify(cliOcPolicy.runtimes.opencode["deep-review"].fallbacks) === JSON.stringify(ocFb), "opencode export preserves the requested fallback list and order");
  check(cliOcPolicy.runtimes.opencode.review.model === packaged.runtimes.opencode.tiers.standard.model, "opencode export leaves unmapped tiers at their packaged selection");
  check(JSON.stringify(cliOcPolicy.runtimes.opencode.consult) === JSON.stringify({ mode: "inherit" }), "opencode export preserves the intentional inheritance");
  check(cliOcPolicy.runtimes.opencode.explore.model === packaged.runtimes.opencode.tiers.fast.model, "opencode export leaves unmapped roles at their packaged selection");

  // Antigravity CLI resolve export
  const cliAg = cli(["resolve", "--runtime", "antigravity"]);
  check(cliAg.status === 0, `installed-fixture antigravity resolve CLI exits 0${cliAg.status === 0 ? "" : ` (stderr: ${cliAg.stderr.trim()})`}`);
  const cliAgPolicy = JSON.parse(cliAg.stdout);
  let cliAgStrictError = null;
  try {
    strictValidateRouting(cliAgPolicy);
  } catch (error) {
    cliAgStrictError = error;
  }
  check(cliAgStrictError === null, `antigravity CLI output passes strictValidateRouting${cliAgStrictError ? ` (${cliAgStrictError.message})` : ""}`);
  check(cliAgPolicy.runtimes.antigravity.explore.model === "flash", "antigravity CLI resolves explore to flash");
  check(cliAgPolicy.runtimes.antigravity.explore.reasoningEffort === undefined, "antigravity CLI route has no reasoningEffort");
  await writeFile(join(fixtureRoot, "references", "v1.json"), `${JSON.stringify(OLD_V1, null, 2)}\n`, "utf8");
  const cliV1 = cli(["resolve", "--runtime", "codex", "--baseline", join(fixtureRoot, "references", "v1.json")]);
  check(cliV1.status === 1 && /version-1 policy/.test(cliV1.stderr), "CLI rejects a version-1 baseline with an actionable message");
  const cliUnknownRuntime = cli(["resolve", "--runtime", "bogus"]);
  check(cliUnknownRuntime.status === 1 && /must be one of/.test(cliUnknownRuntime.stderr), "CLI rejects an unknown runtime");
  const cliBadJson = cli(["resolve", "--runtime", "codex"], "not json");
  check(cliBadJson.status === 1 && /not valid JSON/.test(cliBadJson.stderr), "CLI rejects non-JSON preference input");

  // Installed-fixture CLI with named profiles: --profile NAME and
  // --profile=NAME apply the profile, --explain reports it, unknown or
  // invalid names fail, and --profile default equals the no-profile run.
  const cliProfilePref = JSON.stringify([{
    source: "personal routing.md",
    runtimes: { codex: { tiers: { fast: explicit("pers/fast", "medium") } } },
    profiles: {
      "server-b": { codex: { tiers: { fast: explicit("p-prof/fast", "max") } } },
      "alternate-provider": { codex: { tiers: { deep: explicit("alt-prov/deep", "low") } } },
    },
  }]);
  const cliProf = cli(["resolve", "--runtime", "codex", "--profile", "server-b"], cliProfilePref);
  check(cliProf.status === 0, `resolve --profile applies the selected profile${cliProf.status === 0 ? "" : ` (stderr: ${cliProf.stderr.trim()})`}`);
  const cliProfPolicy = JSON.parse(cliProf.stdout);
  check(cliProfPolicy.runtimes.codex.explore.model === "p-prof/fast" && cliProfPolicy.runtimes.codex.explore.reasoningEffort === "max", "the CLI profile selection applies the profile tier");
  check(cliProfPolicy.runtimes.codex["deep-review"].model === packaged.runtimes.codex.tiers.deep.model, "the CLI profile selection leaves other tiers at the baseline");
  let cliProfStrictError = null;
  try {
    strictValidateRouting(cliProfPolicy);
  } catch (error) {
    cliProfStrictError = error;
  }
  check(cliProfStrictError === null, `CLI profile policy passes the strict version-1 contract (no new fields)${cliProfStrictError ? ` (${cliProfStrictError.message})` : ""}`);
  const cliProfEq = cli(["resolve", "--runtime", "codex", "--profile=alternate-provider"], cliProfilePref);
  check(cliProfEq.status === 0 && JSON.parse(cliProfEq.stdout).runtimes.codex["deep-review"].model === "alt-prov/deep", "the --profile=NAME form selects the profile");
  const cliProfExplain = cli(["resolve", "--runtime", "codex", "--profile", "server-b", "--explain"], cliProfilePref);
  check(cliProfExplain.status === 0, "--explain with a profile exits 0");
  const cliProfExplanation = JSON.parse(cliProfExplain.stdout);
  check(cliProfExplanation.profile === "server-b", "--explain reports the selected profile name");
  check(JSON.stringify(Object.keys(cliProfExplanation.policy).sort()) === JSON.stringify(["provenance", "runtimes", "schemaVersion"]), "--explain keeps the strict version-1 policy shape beside routeProvenance");
  check(JSON.stringify(Object.keys(cliProfExplanation.routeProvenance).sort()) === JSON.stringify([...ROLES].sort()), "--explain keeps per-role routeProvenance entries");
  check(cliProfExplanation.routeProvenance.explore.tierSource === "personal routing.md (profile server-b)", "--explain provenance tierSource carries the profile tag");
  check(JSON.stringify(cliProfExplanation.policy) === JSON.stringify(cliProfPolicy), "--explain policy matches the plain profile policy");
  const cliProfDefault = cli(["resolve", "--runtime", "codex", "--profile", "default"], cliProfilePref);
  const cliProfPlain = cli(["resolve", "--runtime", "codex"], cliProfilePref);
  check(cliProfDefault.status === 0 && cliProfPlain.status === 0, `--profile default exits 0${cliProfDefault.status === 0 ? "" : ` (stderr: ${cliProfDefault.stderr.trim()})`}`);
  check(JSON.stringify(cliProfDefault.stdout) === JSON.stringify(cliProfPlain.stdout), "--profile default equals the no-profile policy");
  const cliProfExplainDefault = cli(["resolve", "--runtime", "codex", "--profile", "default", "--explain"], cliProfilePref);
  check(cliProfExplainDefault.status === 0 && JSON.parse(cliProfExplainDefault.stdout).profile === null, "--profile default reports a null profile in --explain");
  const cliProfUnknown = cli(["resolve", "--runtime", "codex", "--profile", "nope"], cliProfilePref);
  check(cliProfUnknown.status === 1, "an unknown profile exits non-zero");
  check(cliProfUnknown.stderr.includes("server-b") && cliProfUnknown.stderr.includes("alternate-provider"), "the unknown-profile stderr lists the available names");
  const cliProfBadName = cli(["resolve", "--runtime", "codex", "--profile", "Bad-Name"], cliProfilePref);
  check(cliProfBadName.status === 1 && /Invalid routing profile 'Bad-Name'/.test(cliProfBadName.stderr), "an invalid profile name exits non-zero with the grammar error");

  // --- Installed-fixture `startup` CLI: the fast path probes the documented
  // preference locations without reading them, reports interpretation-required
  // or resolves the installed baseline directly, and compares opencode routes
  // against the installed agent profiles. A deep fixture mirrors the real
  // install layout so the install-relative agents directory works. ---
  const startupFixture = await mkdtemp(join(scratch, "startup-"));
  const startupHome = join(startupFixture, "home");
  const startupProject = join(startupFixture, "project");
  const startupAgentsDir = join(startupFixture, "agents", "agenticale");
  const startupBaselinePath = join(startupFixture, "skills", "work", "references", "routing.json");
  await mkdir(startupHome, { recursive: true });
  await mkdir(startupProject, { recursive: true });
  await mkdir(join(startupFixture, "skills", "work", "scripts"), { recursive: true });
  await mkdir(join(startupFixture, "skills", "work", "references"), { recursive: true });
  await cp(modulePath, join(startupFixture, "skills", "work", "scripts", "routing.mjs"), { recursive: true });
  await writeFile(startupBaselinePath, `${JSON.stringify(packaged, null, 2)}\n`, "utf8");
  const startupCli = (args, homeOverride = startupHome) => spawnSync(process.execPath, [join(startupFixture, "skills", "work", "scripts", "routing.mjs"), ...args], {
    encoding: "utf8",
    input: "",
    cwd: startupFixture,
    env: { ...process.env, HOME: homeOverride, USERPROFILE: homeOverride },
  });
  const personalRoutingMd = join(startupHome, ".agenticale", "routing.md");
  const projectRoutingMd = join(startupProject, ".agenticale", "routing.md");
  const putPersonalRouting = async () => {
    await mkdir(join(startupHome, ".agenticale"), { recursive: true });
    await writeFile(personalRoutingMd, "# Personal routing\nExplore on the fast tier.\n", "utf8");
  };
  const putProjectRouting = async () => {
    await mkdir(join(startupProject, ".agenticale"), { recursive: true });
    await writeFile(projectRoutingMd, "# Project routing\nReview on the standard tier.\n", "utf8");
  };
  const clearPersonal = () => rm(personalRoutingMd, { recursive: true, force: true });
  const clearProject = () => rm(projectRoutingMd, { recursive: true, force: true });
  const opencodeRouteFor = (role) => resolveRuntime(packaged, [], "opencode").routes[role];
  const agentProfileFile = (model, reasoningEffort) => {
    const lines = ["---", "description: Generated test profile.", "mode: subagent", "steps: 12"];
    if (model !== null) lines.push(`model: ${model}`);
    if (reasoningEffort !== null) lines.push(`reasoningEffort: ${reasoningEffort}`);
    lines.push("permissions:", '  - action: subagent', '    resource: "*"', "    effect: deny", "---", "", "# Role task contract", "");
    return lines.join("\n");
  };

  // 1. No preference files: exit 0, status resolved, both locations absent,
  // the packaged baseline resolution, and a read-only bootstrap (no files
  // created under the scratch home or project). A non-opencode runtime without
  // --agents-dir omits the agents key entirely (15).
  const st1 = startupCli(["startup", "--runtime", "codex", "--root", startupProject]);
  check(st1.status === 0, `startup with no preference files exits 0${st1.status === 0 ? "" : ` (stderr: ${st1.stderr.trim()})`}`);
  const st1Out = JSON.parse(st1.stdout);
  check(st1Out.status === "resolved", "no preference files resolve the installed baseline directly");
  check(JSON.stringify(Object.keys(st1Out)) === JSON.stringify(["status", "runtime", "profile", "preferenceFiles", "policy", "routeProvenance"]), "resolved output uses the documented key order and omits agents for non-opencode without --agents-dir");
  check(st1Out.runtime === "codex" && st1Out.profile === null, "resolved output reports the runtime and a null profile");
  check(st1Out.preferenceFiles.personal === "absent" && st1Out.preferenceFiles.project === "absent", "no preference files report both documented locations absent");
  let st1StrictError = null;
  try {
    strictValidateRouting(st1Out.policy);
  } catch (error) {
    st1StrictError = error;
  }
  check(st1StrictError === null, `startup policy passes strictValidateRouting${st1StrictError ? ` (${st1StrictError.message})` : ""}`);
  const st1Expected = exportV1(resolveRuntime(packaged, [], "codex").routes, "codex", "startup expected");
  check(JSON.stringify(st1Out.policy.runtimes) === JSON.stringify(st1Expected.runtimes), "startup policy equals the packaged baseline resolution");
  check(JSON.stringify(Object.keys(st1Out.routeProvenance).sort()) === JSON.stringify([...ROLES].sort()), "startup reports per-role routeProvenance for all seven roles");
  check(st1Out.routeProvenance.explore.selection === "default-tier-mapping" && st1Out.routeProvenance.explore.tier === "fast" && st1Out.routeProvenance.explore.tierSource === BASELINE_SOURCE, "startup provenance carries the default-tier-mapping labels");
  check(st1Out.policy.runtimes.codex.explore.model === packaged.runtimes.codex.tiers.fast.model, "the startup policy keeps the packaged explicit selection");
  const st1HomeEntries = await readdir(startupHome);
  check(st1HomeEntries.length === 0, "startup creates no files under the home directory (read-only bootstrap)");
  const st1ProjectEntries = await readdir(startupProject);
  check(st1ProjectEntries.length === 0, "startup creates no files under the project directory (read-only bootstrap)");

  // 14. Agents dir missing for opencode: every role "missing" + agentsNote.
  const st14 = startupCli(["startup", "--runtime", "opencode", "--root", startupProject]);
  check(st14.status === 0, `startup for opencode exits 0 with the installed agents directory missing${st14.status === 0 ? "" : ` (stderr: ${st14.stderr.trim()})`}`);
  const st14Out = JSON.parse(st14.stdout);
  check(st14Out.status === "resolved", "opencode resolves even when the agents directory is missing");
  check(JSON.stringify(Object.keys(st14Out.agents).sort()) === JSON.stringify([...ROLES].sort()), "opencode compares all seven agent profiles");
  for (const role of ROLES) {
    check(st14Out.agents[role].status === "missing", `a missing agents directory reports ${role} missing`);
  }
  check(typeof st14Out.agentsNote === "string" && st14Out.agentsNote.includes(startupAgentsDir) && st14Out.agentsNote.includes("does not exist"), "agentsNote explains the missing agents directory");

  // 2. Personal file present: interpretation-required listing exactly the
  // personal path, with no policy.
  await putPersonalRouting();
  const st2 = startupCli(["startup", "--runtime", "codex", "--root", startupProject]);
  check(st2.status === 0, `startup with a personal preference file exits 0${st2.status === 0 ? "" : ` (stderr: ${st2.stderr.trim()})`}`);
  const st2Out = JSON.parse(st2.stdout);
  check(st2Out.status === "interpretation-required", "a present preference file requires workflow interpretation");
  check(JSON.stringify(Object.keys(st2Out)) === JSON.stringify(["status", "runtime", "profile", "preferenceFiles", "presentFiles"]), "interpretation-required output uses the documented key order");
  check(JSON.stringify(st2Out.presentFiles) === JSON.stringify([personalRoutingMd]), "interpretation-required lists exactly the personal file");
  check(st2Out.preferenceFiles.personal === "present" && st2Out.preferenceFiles.project === "absent", "preferenceFiles records the personal file as present");
  check(st2Out.profile === null, "interpretation-required reports a null profile by default");
  check(!("policy" in st2Out) && !("routeProvenance" in st2Out) && !("agents" in st2Out), "interpretation-required resolves nothing and compares no agents");
  await clearPersonal();

  // 3. Project file present; both present.
  await putProjectRouting();
  const st3 = startupCli(["startup", "--runtime", "codex", "--root", startupProject]);
  const st3Out = JSON.parse(st3.stdout);
  check(st3.status === 0 && st3Out.status === "interpretation-required", "a project preference file requires interpretation");
  check(JSON.stringify(st3Out.presentFiles) === JSON.stringify([projectRoutingMd]), "interpretation-required lists exactly the project file");
  check(st3Out.preferenceFiles.personal === "absent" && st3Out.preferenceFiles.project === "present", "preferenceFiles records the project file as present");
  await putPersonalRouting();
  const st3b = startupCli(["startup", "--runtime", "codex", "--root", startupProject]);
  const st3bOut = JSON.parse(st3b.stdout);
  check(st3b.status === 0 && st3bOut.status === "interpretation-required", "both preference files present requires interpretation");
  check(JSON.stringify(st3bOut.presentFiles) === JSON.stringify([personalRoutingMd, projectRoutingMd]), "interpretation-required lists the personal file first, then the project file");
  check(st3bOut.preferenceFiles.personal === "present" && st3bOut.preferenceFiles.project === "present", "preferenceFiles records both files as present");
  await clearPersonal();
  await clearProject();

  // 4/5. A directory at the preference path simulates an unreadable file
  // without relying on chmod (the tests may run as root).
  await mkdir(personalRoutingMd, { recursive: true });
  const st4 = startupCli(["startup", "--runtime", "codex", "--root", startupProject]);
  check(st4.status === 1, "an unreadable personal preference file exits 1");
  check(st4.stderr.includes("personal") && st4.stderr.includes(personalRoutingMd) && st4.stderr.includes("cannot be read"), "the unreadable-personal error names the location, the path, and that it cannot be read");
  check(st4.stderr.includes("never creates or modifies preference files"), "the unreadable-personal error states that startup never writes preference files");
  check(st4.stdout === "", "an unreadable personal preference file prints no JSON on stdout");
  await clearPersonal();
  await mkdir(projectRoutingMd, { recursive: true });
  const st5 = startupCli(["startup", "--runtime", "codex", "--root", startupProject]);
  check(st5.status === 1, "an unreadable project preference file exits 1");
  check(st5.stderr.includes("project") && st5.stderr.includes(projectRoutingMd) && st5.stderr.includes("cannot be read"), "the unreadable-project error names the project location and the path");
  await clearProject();

  // 6. An unknown profile with no preference files fails with the same
  // actionable unknown-profile RoutingError resolve produces.
  const st6 = startupCli(["startup", "--runtime", "codex", "--root", startupProject, "--profile", "nope"]);
  check(st6.status === 1, "an unknown profile with no preference files exits 1");
  check(st6.stderr.includes("Unknown routing profile 'nope'"), "the startup unknown-profile error is the resolve unknown-profile error");
  check(st6.stderr.includes("add a '## Profile: nope' section"), "the startup unknown-profile error suggests adding a Profile section");
  check(st6.stderr.includes("omit the profile selector"), "the startup unknown-profile error suggests omitting the selector");

  // 7. --profile default equals the no-profile run.
  const st7a = startupCli(["startup", "--runtime", "codex", "--root", startupProject]);
  const st7b = startupCli(["startup", "--runtime", "codex", "--root", startupProject, "--profile", "default"]);
  check(st7a.status === 0 && st7b.status === 0, `startup --profile default exits 0${st7a.status === 0 && st7b.status === 0 ? "" : ` (stderr: ${st7a.stderr.trim()} ${st7b.stderr.trim()})`}`);
  check(JSON.stringify(st7a.stdout) === JSON.stringify(st7b.stdout), "startup --profile default equals the no-profile run");
  const st7c = startupCli(["startup", "--runtime", "codex", "--root", startupProject, "--profile=fast"]);
  check(st7c.status === 1 && st7c.stderr.includes("Unknown routing profile 'fast'"), "the --profile=NAME form with an unknown name fails like the space form");

  // 8. A customized installed baseline (install-time role exceptions) is
  // resolved directly by startup.
  const customBaseline = structuredClone(packaged);
  customBaseline.provenance = "customized install baseline";
  customBaseline.runtimes.codex.roles.review = explicit("custom/codex-review", "low");
  await writeFile(startupBaselinePath, `${JSON.stringify(customBaseline, null, 2)}\n`, "utf8");
  const st8 = startupCli(["startup", "--runtime", "codex", "--root", startupProject]);
  check(st8.status === 0, `startup resolves a customized installed baseline${st8.status === 0 ? "" : ` (stderr: ${st8.stderr.trim()})`}`);
  const st8Out = JSON.parse(st8.stdout);
  check(st8Out.status === "resolved", "a customized installed baseline still takes the short resolved path");
  check(st8Out.policy.runtimes.codex.review.model === "custom/codex-review" && st8Out.policy.runtimes.codex.review.reasoningEffort === "low", "install-time role choices are preserved in the startup resolution");
  check(st8Out.routeProvenance.review.selection === "role-exception" && st8Out.routeProvenance.review.roleSource === BASELINE_SOURCE, "the install-time role exception carries baseline provenance");
  check(st8Out.policy.runtimes.codex.explore.model === packaged.runtimes.codex.tiers.fast.model, "roles without install-time choices keep the packaged selection");
  await writeFile(startupBaselinePath, `${JSON.stringify(packaged, null, 2)}\n`, "utf8");

  // 9. Build the installed agent profiles so every opencode route matches.
  await mkdir(startupAgentsDir, { recursive: true });
  for (const role of ROLES) {
    const route = opencodeRouteFor(role);
    await writeFile(join(startupAgentsDir, `${role}.md`), agentProfileFile(route.model, route.reasoningEffort), "utf8");
  }
  const st9 = startupCli(["startup", "--runtime", "opencode", "--root", startupProject]);
  check(st9.status === 0, `startup with installed agent profiles exits 0${st9.status === 0 ? "" : ` (stderr: ${st9.stderr.trim()})`}`);
  const st9Out = JSON.parse(st9.stdout);
  check(st9Out.status === "resolved", "opencode with installed profiles resolves");
  check(!("agentsNote" in st9Out), "a fully readable agents directory produces no agentsNote");
  for (const role of ROLES) {
    check(st9Out.agents[role].status === "match", `the installed profile for ${role} matches the resolved route`);
  }

  // 10. One role file deleted: that role "missing", the others "match".
  await rm(join(startupAgentsDir, "consult.md"), { force: true });
  const st10 = startupCli(["startup", "--runtime", "opencode", "--root", startupProject]);
  const st10Out = JSON.parse(st10.stdout);
  check(st10Out.agents.consult.status === "missing", "a deleted agent profile file reports missing for its role");
  for (const role of ROLES.filter((r) => r !== "consult")) {
    check(st10Out.agents[role].status === "match", `the other agent profiles still match when ${role} is checked`);
  }
  await writeFile(join(startupAgentsDir, "consult.md"), agentProfileFile(opencodeRouteFor("consult").model, opencodeRouteFor("consult").reasoningEffort), "utf8");

  // 11. One role file with a different model and one with a different
  // reasoningEffort: "mismatch" with the expected/installed values in the note.
  const exploreRoute = opencodeRouteFor("explore");
  const reviewRoute = opencodeRouteFor("review");
  await writeFile(join(startupAgentsDir, "explore.md"), agentProfileFile("other/explore-model", exploreRoute.reasoningEffort), "utf8");
  await writeFile(join(startupAgentsDir, "review.md"), agentProfileFile(reviewRoute.model, "low"), "utf8");
  const st11 = startupCli(["startup", "--runtime", "opencode", "--root", startupProject]);
  const st11Out = JSON.parse(st11.stdout);
  check(st11Out.agents.explore.status === "mismatch", "a different model reports mismatch");
  check(st11Out.agents.explore.note.includes(exploreRoute.model) && st11Out.agents.explore.note.includes("other/explore-model"), "the model mismatch note names the expected and installed models");
  check(st11Out.agents.review.status === "mismatch", "a different reasoningEffort reports mismatch");
  check(st11Out.agents.review.note.includes(reviewRoute.reasoningEffort) && st11Out.agents.review.note.includes("'low'"), "the effort mismatch note names the expected and installed efforts");
  check(st11Out.agents.implement.status === "match", "an untouched agent profile still matches");
  await writeFile(join(startupAgentsDir, "explore.md"), agentProfileFile(exploreRoute.model, exploreRoute.reasoningEffort), "utf8");
  await writeFile(join(startupAgentsDir, "review.md"), agentProfileFile(reviewRoute.model, reviewRoute.reasoningEffort), "utf8");

  // 12. A route resolved to inherit matches a profile with no model line.
  const inheritBaseline = structuredClone(packaged);
  inheritBaseline.runtimes.opencode.roles.fix = { mode: "inherit" };
  await writeFile(startupBaselinePath, `${JSON.stringify(inheritBaseline, null, 2)}\n`, "utf8");
  await writeFile(join(startupAgentsDir, "fix.md"), agentProfileFile(null, null), "utf8");
  const st12 = startupCli(["startup", "--runtime", "opencode", "--root", startupProject]);
  const st12Out = JSON.parse(st12.stdout);
  check(st12Out.policy.runtimes.opencode.fix.mode === "inherit", "the inherit role exception resolves to inheritance");
  check(st12Out.agents.fix.status === "match", "an inherit route matches a profile with no model line");
  for (const role of ROLES.filter((r) => r !== "fix")) {
    check(st12Out.agents[role].status === "match", `the other installed profiles still match under the inherit baseline (${role})`);
  }
  await writeFile(startupBaselinePath, `${JSON.stringify(packaged, null, 2)}\n`, "utf8");
  await writeFile(join(startupAgentsDir, "fix.md"), agentProfileFile(opencodeRouteFor("fix").model, opencodeRouteFor("fix").reasoningEffort), "utf8");

  // 13. An agent file without frontmatter: "unreadable" with a note, other
  // roles unaffected.
  await writeFile(join(startupAgentsDir, "implement.md"), "# Implement task contract\n\nNo frontmatter here.\n", "utf8");
  const st13 = startupCli(["startup", "--runtime", "opencode", "--root", startupProject]);
  const st13Out = JSON.parse(st13.stdout);
  check(st13Out.agents.implement.status === "unreadable", "an agent file without frontmatter reports unreadable");
  check(typeof st13Out.agents.implement.note === "string" && st13Out.agents.implement.note.length > 0, "the unreadable agent entry carries a note with the reason");
  check(st13Out.agents.explore.status === "match", "the other agent profiles are unaffected by one unreadable file");
  await writeFile(join(startupAgentsDir, "implement.md"), agentProfileFile(opencodeRouteFor("implement").model, opencodeRouteFor("implement").reasoningEffort), "utf8");

  // 13b. A duplicated top-level frontmatter field makes the profile ambiguous:
  // "unreadable" with a note naming the duplicated field, while a valid
  // single-field profile still matches (no false positive).
  const dupExploreRoute = opencodeRouteFor("explore");
  const dupReviewRoute = opencodeRouteFor("review");
  const duplicateModelFile = [
    "---",
    "description: Generated test profile.",
    "mode: subagent",
    "steps: 12",
    `model: ${dupExploreRoute.model}`,
    "model: other/conflicting-model",
    `reasoningEffort: ${dupExploreRoute.reasoningEffort}`,
    "permissions:",
    '  - action: subagent',
    '    resource: "*"',
    "    effect: deny",
    "---",
    "",
    "# Role task contract",
    "",
  ].join("\n");
  await writeFile(join(startupAgentsDir, "explore.md"), duplicateModelFile, "utf8");
  const st13b = startupCli(["startup", "--runtime", "opencode", "--root", startupProject]);
  const st13bOut = JSON.parse(st13b.stdout);
  check(st13bOut.agents.explore.status === "unreadable", "a duplicated model frontmatter field reports unreadable");
  check(st13bOut.agents.explore.note.includes("'model'"), "the duplicated-model note names the 'model' field");
  check(st13bOut.agents.implement.status === "match", "a non-duplicate profile still matches alongside a duplicated one (no false positive)");
  await writeFile(join(startupAgentsDir, "explore.md"), agentProfileFile(dupExploreRoute.model, dupExploreRoute.reasoningEffort), "utf8");

  const duplicateEffortFile = [
    "---",
    "description: Generated test profile.",
    "mode: subagent",
    "steps: 12",
    `model: ${dupReviewRoute.model}`,
    `reasoningEffort: ${dupReviewRoute.reasoningEffort}`,
    "reasoningEffort: low",
    "permissions:",
    '  - action: subagent',
    '    resource: "*"',
    "    effect: deny",
    "---",
    "",
    "# Role task contract",
    "",
  ].join("\n");
  await writeFile(join(startupAgentsDir, "review.md"), duplicateEffortFile, "utf8");
  const st13c = startupCli(["startup", "--runtime", "opencode", "--root", startupProject]);
  const st13cOut = JSON.parse(st13c.stdout);
  check(st13cOut.agents.review.status === "unreadable", "a duplicated reasoningEffort frontmatter field reports unreadable");
  check(st13cOut.agents.review.note.includes("'reasoningEffort'"), "the duplicated-effort note names the 'reasoningEffort' field");
  check(st13cOut.agents.explore.status === "match", "the non-duplicate profile still matches after restoring explore.md");
  await writeFile(join(startupAgentsDir, "review.md"), agentProfileFile(dupReviewRoute.model, dupReviewRoute.reasoningEffort), "utf8");

  // 16. An explicit --agents-dir compares agent profiles even for a
  // non-opencode runtime, against that runtime's expected routes.
  const st16 = startupCli(["startup", "--runtime", "codex", "--root", startupProject, "--agents-dir", startupAgentsDir]);
  check(st16.status === 0, `startup with an explicit --agents-dir exits 0${st16.status === 0 ? "" : ` (stderr: ${st16.stderr.trim()})`}`);
  const st16Out = JSON.parse(st16.stdout);
  check("agents" in st16Out && JSON.stringify(Object.keys(st16Out.agents).sort()) === JSON.stringify([...ROLES].sort()), "an explicit --agents-dir compares all seven agent profiles for a non-opencode runtime");
  check(st16Out.agents.review.status === "mismatch", "the non-opencode comparison reports a mismatch against the opencode-labeled profiles");
  check(st16Out.agents.review.installed.model === "openai/gpt-6.1-sol" && st16Out.agents.review.expected.model === "gpt-6.1-sol", "the non-opencode comparison uses that runtime's expected model and the installed frontmatter values");

  // 17. CLI argument handling and help text.
  const st17a = startupCli(["startup"]);
  check(st17a.status === 1 && st17a.stderr.includes("--runtime is required"), "startup without --runtime exits 1 with the required-runtime error");
  const st17b = startupCli(["startup", "--runtime", "opencode", "--bogus"]);
  check(st17b.status === 1 && st17b.stderr.includes("Unknown argument '--bogus'"), "startup rejects unknown arguments");
  const st17c = startupCli(["startup", "--runtime", "bogus"]);
  check(st17c.status === 1 && /must be one of/.test(st17c.stderr), "startup validates the runtime like resolve");
  const st17d = startupCli(["--help"]);
  check(st17d.status === 0 && st17d.stdout.includes("startup"), "--help documents the startup subcommand");
  check(st17d.stdout.includes("--input") && st17d.stdout.includes("FILE PATH of structured preference") && st17d.stdout.includes("never inline JSON"), "--help makes clear that --input is a file path of structured preference JSON, never inline JSON");
  check(st17d.stdout.includes("omitted when there are no preferences"), "--help states that --input is omitted when there are no preferences");

  // 18. Root==home dedup: the shared file is reported once, not twice.
  await putPersonalRouting();
  const st18 = startupCli(["startup", "--runtime", "codex", "--root", startupHome]);
  check(st18.status === 0, `startup with --root at the home directory exits 0${st18.status === 0 ? "" : ` (stderr: ${st18.stderr.trim()})`}`);
  const st18Out = JSON.parse(st18.stdout);
  check(st18Out.status === "interpretation-required", "a file at the shared home location requires interpretation");
  check(st18Out.presentFiles.length === 1 && st18Out.presentFiles[0] === personalRoutingMd, "the shared file is reported once, not twice");
  check(st18Out.preferenceFiles.personal === "present" && st18Out.preferenceFiles.project === "not-checked", "the deduplicated project location stays not-checked while the personal location carries the shared file");
  await clearPersonal();
  const st18b = startupCli(["startup", "--runtime", "codex", "--root", startupHome]);
  const st18bOut = JSON.parse(st18b.stdout);
  check(st18b.status === 0 && st18bOut.status === "resolved", "root==home with no file takes the short resolved path");
  check(st18bOut.preferenceFiles.personal === "absent" && st18bOut.preferenceFiles.project === "not-checked", "root==home with no file reports the single location absent and the project key not-checked");
} finally {
  await rm(scratch, { recursive: true, force: true });
}

console.log(`Routing tests passed: ${assertions} assertions.`);
