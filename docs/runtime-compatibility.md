# Runtime compatibility

This page is the per-runtime support and verification-status matrix for
AgenticAle. It records, for each target runtime and each capability, what a
live check verifies. It is a support matrix, not a claim of results.

**One narrow live pass is recorded**: an OpenCode V2 `/work` routing pass on
2026-11-14 (see [Recorded live passes](#recorded-live-passes)). It verifies
only the coordinator command binding and the implement/review child model
selections it exercised. Every other capability and runtime below remains
**not tested**; version inspection and documentation research are not live
workflow verification. Do not read the inspected client versions — or the
one recorded pass — as proof that the workflows run everywhere.

Model and effort enforcement depends on each host: a skill can *request* a
model and effort for a child, but it cannot by itself prevent host-side
fallback when the host cannot honor the request, so requested settings,
effective settings, and enforcement are recorded separately. Credentials,
private endpoints, and full private transcripts are excluded from evidence;
live checks use local runtime traces or native tool metadata, and diagnostics
stay local rather than being sent to an external service merely to inspect
model configuration.

## Inspected versions

The versions listed below were inspected while preparing this matrix. They
are inputs, not verified working versions; when a live check runs, the client
version and the bundled harness version are recorded separately when a client
embeds a harness.

| Surface | Inspected version |
| --- | --- |
| Copilot CLI | 1.0.89 |
| Codex CLI | 0.159.3 |
| OpenCode V2 | 2.3.0 (recorded live pass); 2.0.9 inspected earlier |
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
| 7 | OpenCode V2 | Generated model-carrying agent profiles, command entries, and direct skill invocation |
| 8 | Google Antigravity (App and CLI) | Shared plugin installed from a local clone; direct skill invocation; `antigravity` runtime binding |

## Capabilities to record per runtime

For each capability, a live check records the client and bundled harness
version, the relevant tool input schema, a representative test prompt,
requested versus effective model and effort, the evidence location, and a
status of **verified**, **limited**, or **not tested**. Statuses below are
**limited** only where the [recorded 2026-11-14 OpenCode pass](#recorded-live-passes)
provides narrow evidence; everything else is **not tested**.

| Capability | What it checks | Status |
| --- | --- | --- |
| Skill discovery | The five public skills (`work`, `review`, `autonomous`, `source-code-lookup`, `pull-request-description`) are found and invocable on the target | **limited** — OpenCode V2: the `/work` command entry and `work` skill ran from a temporary install, and the implement/review profiles dispatched; the other skills and hosts are **not tested** |
| Raw child-tool input schema | The child-dispatch tool's actual input fields for model, effort, and context on the target | **not tested** |
| Requested model | The model the role configuration (generated profile or preference file) asked the child to use | **limited** — OpenCode V2: coordinator, implement, and review selections in the recorded pass; other roles and hosts **not tested** |
| Effective model | The model the host actually ran, from metadata or trace, not a child self-report | **limited** — OpenCode V2: native coordinator assistant metadata and implement/review child metadata in the recorded pass; other roles and hosts **not tested** |
| Requested effort | The reasoning effort the role configuration asked for | **limited** — OpenCode V2: the `#variant` selections in the recorded pass; other roles and hosts **not tested** |
| Effective effort | The reasoning effort the host actually applied | **limited** — OpenCode V2: variants recorded in native metadata in the recorded pass; other roles and hosts **not tested** |
| Isolation behavior | Each round runs in a fresh child context; nested delegation is restricted | **limited** — OpenCode V2: fresh implement and review child sessions observed; the nested-delegation restriction was not exercised |
| Unsupported-role behavior | An unavailable model or unsupported effort is reported, not silently inherited; a missing selected preference file is an actionable error, never a silent fallback | **not tested** |
| Explicit skill invocation | `/work`, `/review`, `/autonomous`, `/work --pr` run only when the user invokes them | **limited** — OpenCode V2 `/work` invoked explicitly in the recorded pass; `/review`, `/autonomous`, `/work --pr` and other hosts **not tested** |
| Negative activation | The workflows do not start from an ordinary prompt with no invocation | **not tested** |
| Resource loading without the checkout | Installed skill references (task contracts, `rounds.md`, runtime bindings) resolve from the install location, not this repository | **not tested** — the recorded pass ran from a temporary install, but install-relative resolution was not independently inspected |

## How status is recorded

When a live check runs, each row records the client and harness versions, the
tool input schema, the test prompt, requested versus effective settings, the
evidence location, and a status of **verified**, **limited**, or
**not tested**. A host that silently substitutes a model without reliable
detection or control is recorded as not supporting strict model selection for
that mode or version, never as a silent success. One client's result is never
inferred onto another client.

## Model configuration status

Model configuration uses the flat per-role config installed at build time
(OpenCode profiles) and the one optional Markdown preference file described in
[setup.md](setup.md#customizing-model-routing). The automated model-config,
build, installer, validation, and publication checks pass. One narrow live
OpenCode pass is recorded below; it used a temporary install and a temporary
flat config, and changed no personal profile. Every other row remains
**not tested** for live dispatch.

| Surface | Customization capability | Status |
| --- | --- | --- |
| Copilot (CLI and VS Code) | Preference-file interpretation and per-call dispatch of role assignments | **not tested** — no live client runs in this environment |
| Copilot (CLI and VS Code) | No-file default, personal-only, project-over-personal, and explicit role-assignment behavior | **not tested** live; deterministic model-config validation is covered by `scripts/test-models.mjs` |
| Codex (CLI, VS Code extension, desktop app) | Preference-file interpretation and per-spawn dispatch of role assignments | **not tested** — no live client runs in this environment |
| OpenCode V2 | Generated-profile model/effort rendering from the flat config | **limited** — the recorded pass confirmed the coordinator, implement, and review profile selections from native metadata (temporary config); profile rendering is covered deterministically by `scripts/test-models.mjs`; the packaged default inventory and the other roles are **not tested** live |
| OpenCode V2 | Model changes via installer rerun with a different `--models` config | **not tested** (live profile mutation disallowed; temp-dir installer tests cover ownership/collision/rollback) |
| Google Antigravity (App and CLI) | Preference-file interpretation and direct child dispatch of role assignments | **not tested** (live); deterministic model-config validation is covered by `scripts/test-models.mjs` |
| All surfaces | Install/update/uninstall preservation of user-owned preference files | **not tested** live; deterministic evidence in `scripts/test-installer.mjs` |
| All surfaces | `--profile NAME` selection of `preferences.NAME.md`, including the missing-file error | **not tested** live; the workflow interprets the file itself, with no deterministic coverage |

Live interpretation and dispatch
checks follow the same per-capability recording rules as the matrix above:
record client and bundled-runtime versions separately, requested versus
effective settings from native metadata or trace, and a status of
**verified**, **limited**, or **not tested**. Do not infer live behavior from
deterministic local checks, and do not extend the recorded pass beyond the
capabilities it actually exercised.

## Recorded live passes

### 2026-11-14 — OpenCode V2 `/work` routing (narrow)

- **Client and setup**: OpenCode v2.3.0 against a private server, with an
  isolated `XDG_CONFIG_HOME` and a temporary install that reused the host
  account's provider access. No personal profile, `default_agent`, or global
  configuration was changed. The install used a temporary flat model config
  naming `openai/gpt-6.1-sol` variants available on that account — not the
  packaged default inventory and not the mixed-provider `example` preset.
- **Coordinator command binding**: the session was created on
  `openai/gpt-6.1-sol#high`; invoking the generated `/work` command entry
  switched the SAME session to agent `agenticale/coordinator` on
  `openai/gpt-6.1-sol#medium` from the first turn. The host performed both
  the model switch and the agent switch, and the coordinator's assistant
  metadata recorded the medium variant. Requested and effective selections
  matched for the coordinator.
- **Worker selections**: the implement child's assistant metadata recorded
  `openai/gpt-6.1-sol` with the low variant, together with a native response
  identifier and usage; the reviewer child's session metadata recorded
  `openai/gpt-6.1-sol` with the high variant. These are native host records,
  not child self-reports.
- **Task scope**: one bounded `/work` task — a one-word README correction —
  completed through implementation and independent review. No fix round,
  consultation, deep review, or PR delivery was exercised.
- **Cleanup**: the private server was stopped and the temporary copied
  provider configuration was removed.
- **Evidence**: sanitized local evidence under the temporary smoke root
  `/tmp/opencode/agenticale-routing-smoke-aRvawl/` (`evidence.json`,
  `children.json`, `completed-messages.json`,
  `worker-assistant-messages.json`). Raw private transcripts, endpoints, and
  session/message/response identifiers are deliberately not committed; the
  evidence is local and ephemeral.
- **Not covered by this pass**: the `/review` and `/autonomous` command
  entries, the mixed-provider `example` preset as written, the optional
  `implement-easy`/`consult-hard` routes (configured or fallback), fix
  rounds, quota recovery, preference-file dispatch on any host, and every
  non-OpenCode runtime. Source fixtures and deterministic tests remain
  interpretation checks, not live tests.
