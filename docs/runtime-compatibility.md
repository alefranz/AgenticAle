# Runtime compatibility

This is the durable output of the skills-first compatibility spike (plan §7).
It records what the runtime spike was *designed* to check, per target runtime
and per capability. It is a support matrix, not a claim of results.

**No live workflow was executed in this pass.** This migration is
documentation-only: version inspection and documentation research are not live
workflow verification. Every capability below is therefore **not tested**.
Nothing here is marked verified or limited; do not read the inspected client
versions as proof that the workflow runs on them.

Model and effort enforcement depends on each host. A skill can *request* a
model and effort for a child; it cannot by itself prevent host-side fallback
when the host cannot honor the request. The matrix therefore records requested
settings, effective settings, and enforcement separately, and the live pass
must fill them from native tool metadata or local runtime traces, not from a
child's self-reported model name.

Credentials, private endpoints, and full private transcripts are excluded from
evidence. Use local runtime traces or native tool metadata where available; do
not send diagnostics to an external service merely to inspect model routing.

## Inspected versions

Record the client version and the bundled harness version separately when a
client embeds a harness. These are the versions inspected for the spike; they
are inputs to the matrix, not verified working versions.

| Surface | Inspected version |
| --- | --- |
| Copilot CLI | 1.0.89 |
| Codex CLI | 0.159.3 |
| OpenCode V2 | 2.0.9 |
| VS Code (Local harness / Agent Host) | 1.140.0 |

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

## Capabilities to record per runtime

For each capability, the live pass records the client and bundled harness
version, the relevant tool input schema, a representative test prompt, requested
vs effective model and effort, the evidence location, and a status of
**verified**, **limited**, or **not tested**. In this documentation-only pass
every row is **not tested**.

| Capability | What it checks | Status (this pass) |
| --- | --- | --- |
| Skill discovery | The four public skills (`work`, `autonomous`, `source-code-lookup`, `pull-request-description`) are found and invocable on the target | **not tested** |
| Raw child-tool input schema | The child-dispatch tool's actual input fields for model, effort, and context on the target | **not tested** |
| Requested model | The model the routing contract asked the child to use | **not tested** |
| Effective model | The model the host actually ran, from metadata or trace, not a child self-report | **not tested** |
| Requested effort | The reasoning effort the routing contract asked for | **not tested** |
| Effective effort | The reasoning effort the host actually applied | **not tested** |
| Isolation behavior | Each round runs in a fresh child context; nested delegation is restricted | **not tested** |
| Unsupported-route behavior | An unavailable model, unsupported effort, or conflicting default is reported, not silently inherited | **not tested** |
| Explicit skill invocation | `/work`, `/autonomous`, `/work --pr` run only when the user invokes them | **not tested** |
| Negative activation | The workflows do not start from an ordinary prompt with no invocation | **not tested** |
| Resource loading without the checkout | Installed skill references (task contracts, `rounds.md`, routing) resolve from the install location, not this repository | **not tested** |

## How to fill this in

When a live pass runs, use the tiny fixture the plan prescribes. It is small on
purpose so a single available model pair can complete the whole matrix:

1. **Base pair.** Implement one small, verifiable change with one available
   model (for example the `implement` route), then review it with a *different*
   available model (the `review` route). Confirm requested and effective model
   for each child from metadata or trace.
2. **Explicit caller override.** Repeat one round with an explicit override and
   confirm the override reaches the actual child model.
3. **Unavailable model.** Request a model the account cannot run; confirm the
   host reports the failure rather than silently substituting or hiding it.
4. **Unsupported effort.** Request an effort level the host does not support;
   confirm the host rejects or applies an explicitly configured fallback.
5. **Auto / inheritance mode.** Run with `--no-model` so every route inherits;
   confirm the effective model matches the session model.
6. **Conflicting defaults.** Give the user-level and profile-level settings
   different routes; confirm which one wins is reported, not chosen silently.
7. **Negative activation.** Issue an ordinary coding prompt with no `/work` or
   `/autonomous` token; confirm no orchestrated round starts.
8. **Resource loading without the checkout.** Uninstall this repository from
   the target's discovery path and confirm the installed references still
   resolve.

For each row, capture the client and bundled harness version, the child tool's
input schema, the exact test prompt, requested and effective settings, and the
evidence location (trace file or metadata). Then set the row to **verified**,
**limited**, or **not tested**. If a host silently changes the model with no
reliable detection or control, mark strict routing unsupported for that mode or
version; do not record a silent success. If a client is unavailable, leave it
**not tested** and do not infer its result from another client.

Do not treat SDK-level support as proof the model-facing tool exposes it. The
release gate is per target: all required checks for a target must pass before
it is marked complete, and an unavailable desktop app or optional cloud surface
must not be labeled complete based on another client's result.

## Routing customization status (this pass)

Model routing customization (the `routing.md` preference files described in
[setup.md](setup.md#customizing-model-routing)) was implemented and
deterministically tested in this pass, but **no live client was run and the
live OpenCode profile was not mutated** (repository rules disallow it). Every
row below is therefore **not tested** for live interpretation or dispatch; the
deterministic-evidence column is test coverage in isolated temporary
directories, not a live pass.

| Surface | Customization capability | Status (this pass) |
| --- | --- | --- |
| Copilot (CLI and VS Code) | Preference discovery, interpretation, and per-call dispatch of resolved routes | **not tested** — no live client runs in this environment |
| Copilot (CLI and VS Code) | No-file default, personal-only, repository-over-personal, and explicit role-override behavior | **not tested** live; deterministic structured resolution covered by `scripts/test-routing.mjs` (204 assertions) |
| Codex (CLI, VS Code extension, desktop app) | Preference discovery, interpretation, and per-spawn dispatch of resolved routes | **not tested** — no live client runs in this environment |
| OpenCode V2 | Requested-versus-installed profile comparison and mismatch reporting | **not tested** — no live client runs in this environment; structured export and normalization covered by `scripts/test-routing.mjs` |
| OpenCode V2 | OpenCode profile-refresh activation | **not tested** (live profile mutation disallowed; temp-dir installer tests cover ownership/collision/rollback) |
| All surfaces | Install/update/uninstall preservation of user-owned `routing.md` files | **not tested** live; deterministic evidence in `scripts/test-installer.mjs` (248 assertions) |

The workflow-interpretation evaluation fixtures live in
`docs/routing-fixtures/` (ten fixtures for the prose-interpretation boundary).
They are evaluations to run against a live client, not evidence that was run.
Live interpretation and dispatch checks for the customization path follow the
same per-capability recording rules as the capability matrix above: record
client and bundled-runtime versions separately, requested versus effective
settings from native metadata or trace, and a status of **verified**,
**limited**, or **not tested**. Do not mark a capability verified without a
live pass; deterministic test coverage or another client's success does not
establish parity.
