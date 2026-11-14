## Model configuration (this installation)

At activation the workflow may read one optional preference file: first
`<project-root>/.agenticale/preferences.md`, then
`~/.agenticale/preferences.md`. A missing file is normal (no
customization); the workflow never creates or modifies preference files.

Format: a Markdown list of direct role assignments, one per line:

- `- <role>: <provider/model[#variant]>` — one combined value, for example
  `openai/gpt-6.1-sol#high`. The optional `#variant` suffix carries the
  reasoning variant (`low`, `medium`, `high`, `xhigh`, `max`); where the
  host exposes separate model and effort fields, the variant is passed as
  the effort selection.
- The earlier forms stay accepted: `- <role>: <model>` (no effort) and
  `- <role>: <model>, <effort>` (for example
  `- review: openai/gpt-6.1-sol, xhigh`). The comma form means the same
  assignment as the combined `#variant` form, so existing preference files
  keep working unchanged; use one form or the other on a line.
- `<role>` is one of the nine child worker keys: explore, implement,
  implement-easy, implement-hard, fix, review, review-deep, consult,
  consult-hard. There is no coordinator key: the host owns the session
  model, and this file never changes it. Where a Sol-class model is
  available on your account, a medium variant (for example
  `openai/gpt-6.1-sol#medium`) is a reasonable session default to select in
  the host itself.
- Roles not listed use the host default (the session model).
- `implement-easy` and `consult-hard` are optional routes. When they are not
  listed, the shared routing policy dispatches the base route (`implement`
  or `consult`) with its existing assignment — a defined fallback, not an
  error. When one IS listed but the host cannot honor the requested
  selection, the workflow surfaces the limitation; it never silently
  substitutes a weaker route.
- Nothing else is interpreted: no tiers, no fallbacks beyond the optional
  routes above, no runtime sections, no profile sections, no merging of
  files.

A leading `--profile NAME` option (or an unambiguous natural-language
equivalent) selects the file `preferences.NAME.md` instead, again project
first, then personal. `NAME` is 1-40 characters: a lowercase letter, then
lowercase letters, digits, or hyphens, with no trailing hyphen; `default`
and `inherit` are reserved. A missing selected file is a concise, actionable
error listing the files that exist at the checked locations — never a
silent fallback. The selected file is read once at activation and stays
fixed; the selection stays in session state for the activation.

Application: where the active runtime binding exposes per-spawn model/effort
fields, the role's assignment is passed at dispatch; where the host cannot
select a model per child, the assignment has no effect (say so when the
user asks for it). A profile never changes the session model, runtime,
credentials, or endpoints. The effective selection is established only from
native host evidence (runtime metadata or local traces), never from a
child's self-reported model name; keep an unknown effective setting unknown.

The same file may also carry the top-level `## Work` section documented in
the skill body (worker-round allowance); it is the only other supported
section.

Example `preferences.md` (both value forms are accepted):

    - review: openai/gpt-6.1-sol#xhigh
    - review-deep: openai/gpt-6.1-sol, xhigh
    - consult-hard: openai/gpt-6.1-sol#xhigh

    ## Work
    - worker rounds: 12
