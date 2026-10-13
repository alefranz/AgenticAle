#!/usr/bin/env node

import assert from "node:assert/strict";
import { publishRelease, releasePlugin } from "./release-plugin.mjs";
import { fixture, gitFixture } from "./test-plugin-version.mjs";

const sha = "a".repeat(40);
const tag = "v0.4.0";
const ref = { object: { type: "commit", sha } };
const existing = { html_url: "https://github.com/example/repo/releases/tag/v0.4.0", draft: false, prerelease: false };
function mock(entries) {
  const calls = [];
  const request = async (method, path, body, allowMissing) => {
    calls.push({ method, path, body, allowMissing });
    assert.ok(entries.length, `Unexpected API call: ${method} ${path}`);
    const [expectedMethod, expectedPath, response] = entries.shift();
    assert.equal(method, expectedMethod);
    assert.equal(path, expectedPath);
    if (response instanceof Error) throw response;
    if (response === null) assert.equal(allowMissing, true);
    return response;
  };
  return { request, calls, done: () => assert.equal(entries.length, 0) };
}
async function run(entries, expectedCreated) {
  const api = mock(entries);
  const result = await publishRelease({ version: "0.4.0", sha, request: api.request });
  assert.equal(result.created, expectedCreated);
  api.done();
  return api.calls;
}

const calls = await run([
  ["GET", `git/ref/tags/${tag}`, null],
  ["GET", `releases/tags/${tag}`, null],
  ["POST", "git/refs", ref],
  ["POST", "releases", existing],
], true);
assert.deepEqual(calls[2].body, { ref: `refs/tags/${tag}`, sha });
assert.equal(calls[3].body.target_commitish, sha);
assert.equal(calls[3].body.tag_name, tag);
assert.equal(calls[3].body.generate_release_notes, true);
assert.equal(calls[3].body.make_latest, "legacy");
await run([["GET", `git/ref/tags/${tag}`, ref], ["GET", `releases/tags/${tag}`, existing]], false);
await run([["GET", `git/ref/tags/${tag}`, ref], ["GET", `releases/tags/${tag}`, null], ["POST", "releases", existing]], true);
await run([
  ["GET", `git/ref/tags/${tag}`, { object: { type: "tag", sha: "b".repeat(40) } }],
  ["GET", `git/tags/${"b".repeat(40)}`, ref],
  ["GET", `releases/tags/${tag}`, existing],
], false);
const wrongTag = mock([["GET", `git/ref/tags/${tag}`, { object: { type: "commit", sha: "b".repeat(40) } }]]);
await assert.rejects(publishRelease({ version: "0.4.0", sha, request: wrongTag.request }), /does not point to tested commit/);
wrongTag.done();
for (const change of [{ draft: true }, { prerelease: true }]) {
  const api = mock([["GET", `git/ref/tags/${tag}`, ref], ["GET", `releases/tags/${tag}`, { ...existing, ...change }]]);
  await assert.rejects(publishRelease({ version: "0.4.0", sha, request: api.request }), /requires investigation/);
  api.done();
}
await run([
  ["GET", `git/ref/tags/${tag}`, null], ["GET", `releases/tags/${tag}`, null],
  ["POST", "git/refs", new Error("Already created")], ["GET", `git/ref/tags/${tag}`, ref],
  ["POST", "releases", existing],
], true);
const denied = mock([
  ["GET", `git/ref/tags/${tag}`, null], ["GET", `releases/tags/${tag}`, null],
  ["POST", "git/refs", new Error("Permission denied")], ["GET", `git/ref/tags/${tag}`, null],
]);
await assert.rejects(publishRelease({ version: "0.4.0", sha, request: denied.request }), /Permission denied/);
denied.done();
await assert.rejects(publishRelease({ version: "0.4.0", sha: "main", request: () => assert.fail("No API call") }), /exact commit SHA/);

const repo = await gitFixture();
try {
  await repo.write(fixture());
  const base = await repo.commit("Initial plugin");
  await repo.write(new Map([["README.md", "Documentation\n"]]));
  const docsSha = await repo.commit("Docs only");
  const noApi = () => assert.fail("Unchanged or unversioned content must not publish");
  assert.equal((await releasePlugin({ base, sha: docsSha, cwd: repo.cwd, request: noApi })).skipped, true);
  const changed = fixture();
  changed.set("plugins/agenticale/skills/work/SKILL.md", "Changed\n");
  await repo.write(changed);
  const badSha = await repo.commit("Missing bump");
  await assert.rejects(releasePlugin({ base, sha: badSha, cwd: repo.cwd, request: noApi }), /without a version bump/);
  await repo.write(fixture("0.4.0"));
  const releaseSha = await repo.commit("Version bump");
  const api = mock([
    ["GET", `git/ref/tags/${tag}`, null], ["GET", `releases/tags/${tag}`, null],
    ["POST", "git/refs", { object: { type: "commit", sha: releaseSha } }], ["POST", "releases", existing],
  ]);
  assert.equal((await releasePlugin({ base, sha: releaseSha, cwd: repo.cwd, request: api.request })).created, true);
  assert.equal(api.calls[2].body.sha, releaseSha);
  api.done();
} finally { await repo.cleanup(); }
console.log("Release tests passed (exact SHA, no-op pushes, reruns, annotated/wrong tags, drafts, and permission failures).");
