## Model configuration (this installation)

At activation the workflow may read one optional preference file: first
`<project-root>/.agenticale/preferences.md`, then
`~/.agenticale/preferences.md`. A missing file is normal (no
customization); the workflow never creates or modifies preference files.

Format: a Markdown list of direct role assignments, one per line:

- `- <role>: <model>` or `- <role>: <model>, <effort>`
- `<role>` is one of: explore, implement, implement-hard, fix, review,
  deep-review, consult.
- Roles not listed use the host default.
- Nothing else is interpreted: no tiers, no fallbacks, no runtime sections,
  no profile sections, no merging of files.

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
credentials, or endpoints.

The same file may also carry the top-level `## Work` section documented in
the skill body (worker-round allowance); it is the only other supported
section.

Example `preferences.md`:

    - review: openai/gpt-6.1-sol, xhigh
    - deep-review: openai/gpt-6.1-sol, xhigh

    ## Work
    - worker rounds: 12
