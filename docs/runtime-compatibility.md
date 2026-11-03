# Runtime compatibility

This page is the per-runtime support and verification-status matrix for
AgenticAle. It records, for each target runtime and each capability, what a
live check verifies. It is a support matrix, not a claim of results.

**No live workflow has been run against any of these runtimes yet.** Version
inspection and documentation research are not live workflow verification, so
every capability below is currently **not tested**. Nothing here is marked
verified or limited; do not read the inspected client versions as proof that
the workflow runs on them.

Model and effort enforcement depends on each host: a skill can *request* a
model and effort for a child, but it cannot by itself prevent host-side
fallback when the host cannot honor the request, so requested settings,
effective settings, and enforcement are recorded separately. Credentials,
private endpoints, and full private transcripts are excluded from evidence;
live checks use local runtime traces or native tool metadata, and diagnostics
stay local rather than being sent to an external service merely to inspect
model routing.

## Inspected versions

The versions listed below were inspected while preparing this matrix. They
are inputs, not verified working versions; when a live check runs, the client
version and the bundled harness version are recorded separately when a client
embeds a harness.

| Surface | Inspected version |
| --- | --- |
| Copilot CLI | 1.0.89 |
| Codex CLI | 0.159.3 |
| OpenCode V2 | 2.0.9 |
| VS Code (Local harness / Agent Host) | 1.140.0 |
| Google Antigravity App | 2.23.1 |
| Google Antigravity CLI (agy) | 1.3.5 |

## Target runtimes

| # | Runtime | How it binds AgenticAle |
| --- | --- | --- |
| 1 | Copilot CLI | Direct skill invocation plus native per-call model/effort dispatch |
| 2 | Copilot Agent Host / standalone Copilot app | Copilot SDK-aligned runtime; same binding, verify bundled runtime/version |
| 3 | VS Code Local harness | `runSubagent` with an explicit model argument; separate restrictions and controls |
| 4 | Codex CLI | Direct skill invocation plus per-spawn model/reasoning dispatch |
| 5 | Official Codex VS Code extension | Shared plugin through the Codex marketplace, or standalone skill folders |
| 6 | Codex in the ChatGPT desktop app | Shared plugin through the Codex marketplace, or standalone skill folders |
| 7 | OpenCode V2 | Generated model-routing profiles, command entries, and direct skill invocation |
| 8 | Google Antigravity (App and CLI) | Shared plugin installed from a local clone; direct skill invocation; `antigravity` routing binding |

## Capabilities to record per runtime

For each capability, a live check records the client and bundled harness
version, the relevant tool input schema, a representative test prompt,
requested versus effective model and effort, the evidence location, and a
status of **verified**, **limited**, or **not tested**. No live check has run
yet, so every row is currently **not tested**.

| Capability | What it checks | Status |
| --- | --- | --- |
| Skill discovery | The five public skills (`work`, `review`, `autonomous`, `source-code-lookup`, `pull-request-description`) are found and invocable on the target | **not tested** |
| Raw child-tool input schema | The child-dispatch tool's actual input fields for model, effort, and context on the target | **not tested** |
| Requested model | The model the routing contract asked the child to use | **not tested** |
| Effective model | The model the host actually ran, from metadata or trace, not a child self-report | **not tested** |
| Requested effort | The reasoning effort the routing contract asked for | **not tested** |
| Effective effort | The reasoning effort the host actually applied | **not tested** |
| Isolation behavior | Each round runs in a fresh child context; nested delegation is restricted | **not tested** |
| Unsupported-route behavior | An unavailable model, unsupported effort, or conflicting default is reported, not silently inherited | **not tested** |
| Explicit skill invocation | `/work`, `/review`, `/autonomous`, `/work --pr` run only when the user invokes them | **not tested** |
| Negative activation | The workflows do not start from an ordinary prompt with no invocation | **not tested** |
| Resource loading without the checkout | Installed skill references (task contracts, `rounds.md`, routing) resolve from the install location, not this repository | **not tested** |

## How status is recorded

When a live check runs, each row records the client and harness versions, the
tool input schema, the test prompt, requested versus effective settings, the
evidence location, and a status of **verified**, **limited**, or
**not tested**. A host that silently substitutes a model without reliable
detection or control is recorded as not supporting strict routing for that
mode or version, never as a silent success. One client's result is never
inferred onto another client.

## Routing customization status

Model routing customization uses the Markdown preference files described in
[setup.md](setup.md#customizing-model-routing). The automated routing, build,
installer, validation, and publication checks pass. No live client run has
been recorded yet, and no live OpenCode profile has been changed. Every row
below is therefore **not tested** for live dispatch.

| Surface | Customization capability | Status |
| --- | --- | --- |
| Copilot (CLI and VS Code) | Markdown preference interpretation and per-call dispatch of resolved routes | **not tested** — no live client runs in this environment |
| Copilot (CLI and VS Code) | No-file default, personal-only, repository-over-personal, and explicit role-override behavior | **not tested** live; deterministic structured resolution is covered by `scripts/test-routing.mjs` |
| Codex (CLI, VS Code extension, desktop app) | Markdown preference interpretation and per-spawn dispatch of resolved routes | **not tested** — no live client runs in this environment |
| OpenCode V2 | Requested-versus-installed profile comparison and mismatch reporting | **not tested** — no live client runs in this environment; structured export and normalization covered by `scripts/test-routing.mjs` |
| OpenCode V2 | OpenCode profile-refresh activation | **not tested** (live profile mutation disallowed; temp-dir installer tests cover ownership/collision/rollback) |
| Google Antigravity (App and CLI) | Markdown preference interpretation and direct child dispatch of resolved routes | **not tested** (live); deterministic structured resolution is covered by `scripts/test-routing.mjs` |
| All surfaces | Install/update/uninstall preservation of user-owned `preferences.md`/`routing.md` files | **not tested** live; deterministic evidence in `scripts/test-installer.mjs` |
| All surfaces | Named routing profile selection, interpretation, and precedence | **not tested** live; deterministic structured resolution is covered by `scripts/test-routing.mjs` |
| OpenCode V2 | Named routing set (`agenticale/routing/<profile>/<role>`) preparation, requested-versus-prepared comparison, and staleness reporting | **not tested**; host acceptance of the identifier namespace is unverified |

The workflow interprets Markdown into structured preferences. No live client
run has been recorded yet. Live interpretation and dispatch checks follow the
same per-capability recording rules as the matrix above: record client and
bundled-runtime versions separately, requested versus effective settings from
native metadata or trace, and a status of **verified**, **limited**, or
**not tested**. Do not infer live behavior from deterministic local resolution.
