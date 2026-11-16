# AgenticAle preferences (starter)

<!--
Copy-pasteable starter for the optional AgenticAle preference file.

To use it:
1. Copy this file to <project-root>/.agenticale/preferences.md (one
   project) or ~/.agenticale/preferences.md (all projects). When both
   exist, the project file wins; the files are never merged.
2. Replace each <placeholder> with a real model name from your host's live
   model listing (or one you know your account exposes), then uncomment
   the lines you want. The `configure` skill can discover the names with
   you and propose the exact content before anything is written.
3. As shipped, every assignment below is commented: this file makes no
   assignments. A missing or empty preference file is a valid
   configuration — every role inherits the host's session model.

Host notes:
On OpenCode, role lines in this file do NOT apply — models are fixed in
the generated agent profiles at install time. Use the configure skill (or
the installer's --models option) to change them. The ## Work section below
DOES apply on OpenCode.
On Antigravity, only the fixed enum values inherit, flash_lite, flash, and
pro are valid model selections, and no #variant/effort is accepted.
On hosts without per-child effort control, omit the #variant suffix.
Value forms: `- <role>: <provider/model[#variant]>` (combined), or the
legacy `- <role>: <model>` / `- <role>: <model>, <effort>`. Use one form
per line. Variants: low, medium, high, xhigh, max — where the host
supports them.
Nothing else is interpreted: no tiers, no runtime sections, no merging.
There is no coordinator key; the host owns the session model.
-->

<!--
Cheap, fast, capable models for discovery and routine work (low–medium
variant where the host supports effort):
-->
<!-- - explore: <provider/model#variant> -->
<!-- - implement: <provider/model#variant> -->
<!-- - fix: <provider/model#variant> -->

<!--
Strong reasoning for risk-visible implementation and fixes (high/xhigh
where supported):
-->
<!-- - implement-hard: <provider/model#variant> -->

<!--
Strongest reasoning for independent review and consultation (high/xhigh
where supported):
-->
<!-- - review: <provider/model#variant> -->
<!-- - review-deep: <provider/model#variant> -->
<!-- - consult: <provider/model#variant> -->

<!--
Optional routes — unlisted by default. When implement-easy or consult-hard
is not listed, the shared routing policy dispatches the base route
(implement or consult) with its existing assignment: a defined fallback,
not an error. Uncomment one only to opt in. A listed route the host cannot
honor surfaces a limitation — it is never silently substituted.
-->
<!-- - implement-easy: <provider/model#variant> -->
<!-- - consult-hard: <provider/model#variant> -->

## Work

<!--
The Work worker-round allowance: a positive integer, default 12 when
absent. It is how many worker rounds are available to a Work task, not how
many must run. Work-only: Autonomous Mode keeps its own budgets. An
invalid value is an actionable error, never silently defaulted or clamped.
A change applies to new Work invocations; an active invocation keeps the
allowance it read at activation.
-->
<!-- - worker rounds: 12 -->

<!--
Packaging: this authored root copy is the canonical starter. The build
copies it verbatim into every packaged output at
skills/configure/references/preferences.example.md (configure/references/
preferences.example.md in a standalone skills install), so plugin,
standalone, and OpenCode installs reach it install-relative; the configure
skill and the model-configuration fragment point at that packaged copy.
-->
