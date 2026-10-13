#!/usr/bin/env node

import { realpath } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { checkPluginVersion, parseVersion } from "./check-plugin-version.mjs";

// The caller gates this on successful CI. Tag lookup is mandatory: GitHub's
// release endpoint ignores target_commitish when the tag already exists.
export async function publishRelease({ version, sha, request }) {
  parseVersion(version);
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error("Release target must be an exact commit SHA.");
  const tag = `v${version}`;
  const tagPath = `git/ref/tags/${tag}`;
  async function tagCommit(ref) {
    let object = ref.object;
    for (let depth = 0; object.type === "tag" && depth < 8; depth += 1) {
      object = (await request("GET", `git/tags/${object.sha}`)).object;
    }
    if (object.type !== "commit" || object.sha !== sha) throw new Error(`Refusing release: ${tag} does not point to tested commit ${sha}.`);
  }
  let ref = await request("GET", tagPath, undefined, true);
  if (ref) await tagCommit(ref);
  const existing = await request("GET", `releases/tags/${tag}`, undefined, true);
  if (existing) {
    if (!ref || existing.draft || existing.prerelease) throw new Error(`Existing ${tag} release requires investigation; refusing to overwrite it.`);
    return { created: false, url: existing.html_url };
  }
  if (!ref) {
    try {
      ref = await request("POST", "git/refs", { ref: `refs/tags/${tag}`, sha });
    } catch (error) {
      // A simultaneous retry may have created the ref; validate it, never move it.
      ref = await request("GET", tagPath, undefined, true);
      if (!ref) throw error;
    }
    await tagCommit(ref);
  }
  const release = await request("POST", "releases", {
    tag_name: tag,
    target_commitish: sha,
    name: tag,
    generate_release_notes: true,
    draft: false,
    prerelease: false,
    make_latest: "legacy", // A delayed older run must not replace a newer latest release.
  });
  return { created: true, url: release.html_url };
}

export async function releasePlugin({ base, sha, request, cwd }) {
  const result = await checkPluginVersion({ base, head: sha, cwd });
  if (!result.versionIncreased) return { created: false, skipped: true };
  return publishRelease({ version: result.version, sha, request });
}

async function main() {
  const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repository, BASE_REF: base, RELEASE_SHA: sha } = process.env;
  if (!token || repository !== "alefranz/AgenticAle") throw new Error("Publishing requires GITHUB_TOKEN in alefranz/AgenticAle.");
  const request = async (method, path, body, allowMissing = false) => {
    const response = await fetch(`https://api.github.com/repos/${repository}/${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.status === 404 && allowMissing) return null;
    if (!response.ok) throw new Error(`GitHub ${method} ${path} failed (${response.status}): ${(await response.json()).message}`);
    return response.json();
  };
  const result = await releasePlugin({ base, sha, request });
  console.log(result.skipped ? "Plugin version unchanged; no release." : `${result.created ? "Published" : "Already published"}: ${result.url}`);
}

if (process.argv[1] && await realpath(process.argv[1]) === await realpath(fileURLToPath(import.meta.url))) {
  await main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
