#!/usr/bin/env node
// Deterministic regression scenarios for the shared routing module
// (skills/work/scripts/routing.mjs): the phase 1-2 machine contracts of
// docs/model-routing-customization-plan.md section 10.1. These prove the
// resolver, validators, normalization, export, and the installed-fixture
// `resolve` CLI; they do not interpret prose and never touch the real
// user's home, plugin store, or live profile.

import { mkdtemp, mkdir, readFile, rm, cp, writeFile } from "node:fs/promises";
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
  discoverPreferencePaths,
  exportV1,
  legacyInventoryToV2,
  mergePreferenceLayers,
  mergeV2MissingRuntimes,
  normalizePreferenceInput,
  normalizeV1ToV2,
  resolveAllRuntimes,
  resolveRuntime,
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
        for (const role of ROLES) entries[role] = explicit(`m/${role}`, "high");
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
  // default-tier-mapped. ---
  const defaultResolution = resolveAllRuntimes(packaged, []);
  check(
    JSON.stringify(Object.keys(defaultResolution.runtimes).sort()) === JSON.stringify([...RUNTIME_KEYS].sort()),
    "no-preference resolution covers all three runtimes",
  );
  for (const runtime of RUNTIME_KEYS) {
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
  check(Object.keys(v2Partial.runtimes).length === 3, "a partial version-1 import keeps all three runtimes");
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
  check(JSON.stringify(added) === JSON.stringify(["copilot", "opencode"]), "mergeV2MissingRuntimes reports the filled runtimes");
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
  await writeFile(join(fixtureRoot, "references", "v1.json"), `${JSON.stringify(OLD_V1, null, 2)}\n`, "utf8");
  const cliV1 = cli(["resolve", "--runtime", "codex", "--baseline", join(fixtureRoot, "references", "v1.json")]);
  check(cliV1.status === 1 && /version-1 policy/.test(cliV1.stderr), "CLI rejects a version-1 baseline with an actionable message");
  const cliUnknownRuntime = cli(["resolve", "--runtime", "bogus"]);
  check(cliUnknownRuntime.status === 1 && /must be one of/.test(cliUnknownRuntime.stderr), "CLI rejects an unknown runtime");
  const cliBadJson = cli(["resolve", "--runtime", "codex"], "not json");
  check(cliBadJson.status === 1 && /not valid JSON/.test(cliBadJson.stderr), "CLI rejects non-JSON preference input");
} finally {
  await rm(scratch, { recursive: true, force: true });
}

console.log(`Routing tests passed: ${assertions} assertions.`);
