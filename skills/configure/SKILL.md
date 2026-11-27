---
name: configure
description: "Configure AgenticAle's per-role model routing and the Work worker-round allowance on explicit user request: discover what the host actually exposes, propose exact preference-file content (or an OpenCode or Qwen Code --models config and installer rerun), and write only after exact confirmation. Explicit-only: runs when the user asks to configure AgenticAle (on OpenCode or Qwen Code, the /configure command); the model does not start this skill on its own."
slash: true
disable-model-invocation: true
metadata:
  opencode/autoinvoke: false
---

# Configure AgenticAle

User-initiated setup skill for per-role model routing and the `## Work` worker-round allowance. It writes only configuration the user explicitly confirms, adds no scaffold command or packaged model inventory, and keeps no persistent state.

Explicit-only: run only when the user asks to configure AgenticAle (e.g., `/configure`). Never start it automatically or from inside a `work`, `review`, or `autonomous` round.

## Safety rules

1. **Read-only first.** Discovery and tuning read the host surface and existing files without writing.
2. **Evidence-backed names only.** Every proposed model name and variant must come from live host evidence or the user — never invent names or rely on memory/packaged inventories. A live listing proves availability, not quality or cost; mark role mappings as proposals.
3. **Interactive tuning.** Show the proposed content, iterate on user edits, and stop on confirmation.
4. **Write only on explicit confirmation** of the exact target path and exact content (for existing files, the exact diff). Consent is separate for each effect: a preference-file write, a `--models` JSON write, and running an installer.
5. **Re-read before writing.** If the target changed since confirmation, the confirmation is stale: re-propose against the new content and ask again.
6. **No partial or placeholder writes.** Cancellation, missing confirmation, or remaining placeholders means zero writes.
7. **Minimal edits.** Preserve unrelated assignments, sections, comments, and formatting in existing files; never rewrite, migrate, or delete them silently.
8. **No auto-launch or unverified claims.** Never launch workflows or installers automatically, and never claim routing is verified just because a write or install succeeded.

## Detect the surface, then discover

Select the runtime from the host's tool surface — never from the session's model name — and read its discovery reference:
[OpenCode](references/discovery/opencode.md),
[Qwen Code](references/discovery/qwen-code.md),
[Copilot](references/discovery/copilot.md),
[Copilot Local](references/discovery/copilot-local.md),
[Codex](references/discovery/codex.md),
[Antigravity](references/discovery/antigravity.md).
An unknown surface invents no tools and degrades via ladder step 3.

Model discovery applies to routing requests only; a Work-only allowance request skips this ladder and proceeds directly to `## Work`.

**Discovery ladder:**
1. **Host lists models live:** propose names from that listing using capability heuristics — a fast, cheap, capable model for `explore`, `implement`, and `fix` (low–medium variant where supported); a strong model for `implement-hard`; the strongest reasoning model for `review`, `review-deep`, and `consult` (high/xhigh where supported). Leave optional `implement-easy` and `consult-hard` unlisted unless requested (unlisted, they fall back to `implement` / `consult`).
2. **No live listing:** propose the role-slot structure with placeholders and ask the user for names (never write placeholders).
3. **Nothing to work with** (unknown host, no listing, no user names): explain that session-model inheritance everywhere (no preference file or no assignments) is valid, and stop the routing proposal.

Warn about host limitations documented in the discovery reference (e.g., Antigravity's fixed enum and absent effort control, Copilot Local's parent cost-tier ceiling, unconfirmed listings/efforts) before writing; the user's confirmed choice wins with the limitation stated, never silently downgraded.

## Per-spawn preference files

Target path precedence (checked once at activation, never merged): `<project-root>/.agenticale/preferences.md`, then `~/.agenticale/preferences.md`. A leading `--profile NAME` (or explicit `preferences.NAME.md`) targets that filename under the same precedence; report a missing named profile rather than falling back to `preferences.md`. Ask project vs. personal before writing and show the resolved path.

Format is a Markdown list of direct role lines: `- <role>: <provider/model[#variant]>` (or legacy `- <role>: <model>` / `- <role>: <model>, <effort>`). `<role>` is one of the nine worker keys (`explore`, `implement`, `implement-easy`, `implement-hard`, `fix`, `review`, `review-deep`, `consult`, `consult-hard`); there is no `coordinator` key. Unlisted roles inherit the session model; `#variant` (`low`, `medium`, `high`, `xhigh`, `max`) applies only where the host supports per-child effort.

Start new files from [examples/preferences.example.md](../../examples/preferences.example.md), replacing placeholders with confirmed names and uncommenting only confirmed lines. Show full content for a new file or a minimal diff for an existing file, then follow all Safety rules.

## OpenCode and Qwen Code (`--models` JSON + install refresh)

On OpenCode and Qwen Code, models are baked into generated agent files at install time; preference-file role lines do not apply (only `## Work` applies there). Never edit installed profiles, `opencode.jsonc`, `default_agent`, or Qwen's `settings.json` directly.

Follow the host discovery reference ([OpenCode](references/discovery/opencode.md) or [Qwen Code](references/discovery/qwen-code.md)) for live evidence, flat `--models` JSON rules (including optional `coordinator` key constraints and Qwen `openai/` codex executor details), and the exact installer refresh command (`install.mjs install` or `install.mjs qwen-install`). Each write and installer run requires separate explicit confirmation under the Safety rules.

## The Work worker-round allowance (all hosts)

Under a top-level `## Work` section in the selected preference file, `- worker rounds: N` (a positive integer) sets an exact cap for Work tasks (default is 24 worker rounds). It changes only the available Work worker rounds (not consultation, scope, permissions, or Autonomous Mode).

A Work-only allowance edit needs no model evidence and skips discovery. Apply the same Safety rules (exact path, full content or minimal diff, explicit confirmation, re-read before write, preserve routing lines). Reject invalid values with an actionable error instead of clamping or defaulting. Editing the file applies to future invocations only; it does not alter an active Work run.

## Verify and finish

Offer the host's user-driven verification path from its discovery reference (e.g., `/work --stats` on OpenCode; native session metadata on Qwen Code; native traces where exposed, noting unsupported `--stats` and unconfirmed effective models on Antigravity/other hosts). Never trust a child's self-reported model name, and never launch a workflow automatically.

Report what was proposed, exact paths written, consents given, what remains requested-only or unverified, and the next verification step. Keep state in session only.
