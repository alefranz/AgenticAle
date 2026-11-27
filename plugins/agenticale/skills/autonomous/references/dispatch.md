## Task dispatch and capability

Before dispatching any round, select the actual runtime binding from
`../../work/references/runtimes/` for the host actually being used, from the tools the host
exposes; never infer the runtime from a selected model name. Do this at start and on
every fresh resume.

The workflow never selects a model: on OpenCode and Qwen Code the model is
baked into the installed agent profile for the role at install time; on
other surfaces the binding's native fields carry a role assignment only
where the host supports it and the installation's preference file provides
one. When the installation configures a
coordinator, the OpenCode command entry runs this workflow in the current session on the
`agenticale/coordinator` profile from the first turn, including on a fresh resume; on
Qwen Code the workflow instead reads the flat `agenticale-coordinator` agent file
(read-only, at most once at activation), adopts its posture for the caller session, and
records the requested model line against the session's effective model; without one, the
caller session's own model coordinates. A role whose installed profile
is missing or unreadable blocks only that role's dispatch, reported with the binding's
refresh procedure; an unavailable role never blocks unrelated work. The workflow creates
or modifies no configuration file; a missing preference file is normal. The only other
configuration evidence it may read is the install-ownership manifest the active runtime
binding documents, read-only at most once at activation and solely to establish whether a
needed optional route was configured in the current install inventory, including when a
leftover profile file is present; it never resolves models from that manifest and never
modifies it. Where the active runtime binding documents a flat coordinator agent file,
the workflow may also read that file read-only at most once at activation to adopt the
coordinating posture; it never writes it or dispatches it. The selected preference file
is read at most
once at activation and stays fixed for the activation; a fresh resume starts fresh, and
the prior state's model choices are diagnostic history that never override the current
installation — report a material change to a role's installed model selection. The
preference file's `## Work` allowance is Work-specific and never sets an autonomous
budget.

A role with no installed profile (or no binding support) must not silently inherit the
session model in place of a role the installation names. An explicit model request the
host cannot honour is reported as a limitation, never silently substituted; when native
metadata makes the effective settings available, record requested versus effective, and
a child's self-reported model name never establishes what it ran on. A configuration
change takes effect only at the next fresh resume: it never changes an already-running
child, never resets budgets or review counters, never bypasses quota recovery, and never
authorizes automatic provider switching.

Route each round to a fresh child carrying the matching task contract from the work
skill's [references/tasks/](../../work/references/tasks/) directory, selected by the shared
[routing policy](../../work/references/rounds.md#routing-policy), which binds this workflow
exactly as it binds reviewed task work:

| Round purpose | Task contract |
| --- | --- |
| One-question source discovery | [explore](../../work/references/tasks/explore.md) |
| Implementation slice (default) | [implement](../../work/references/tasks/implement.md) |
| Explicitly prescribed, bounded, mechanically verifiable slice (only when configured) | implement contract on `implement-easy` |
| Hard implementation slice — visible correctness risk | implement contract on `implement-hard` |
| Review-findings fix pass | [fix](../../work/references/tasks/fix.md) |
| Hard fix pass — concurrency, durability, state-machine, ownership reasoning | fix contract on `implement-hard` |
| Per-slice independent review | [review](../../work/references/tasks/review.md) |
| Integration audit / escalated slice review | [review-deep](../../work/references/tasks/review-deep.md) |
| Second opinion on one bounded focused decision | [consult](../../work/references/tasks/consult.md) |
| Focused decision with conflicting evidence, interacting constraints, or costly reversal (only when configured) | consult contract on `consult-hard` |

Route selection follows the shared routing policy exactly: `implement` is the default;
`implement-easy` only when configured AND the slice is explicitly prescribed, bounded, and
mechanically verifiable; `implement-hard` dispatches directly — no consultation first — when
the slice's correctness risk is visible, assessed per slice with no category exemptions and
reassessed at every slice boundary and fresh resume (earlier dispatch records are diagnostic
history, not a route lock); a hard fix keeps the fix task role and the fix counters,
dispatched on `implement-hard` with the bounded fix contract carried explicitly in the packet
(or an equivalently scoped implement contract where the installed profile body differs),
recording task role, dispatched role, and the reason. An unconfigured optional route falls
back to its base route; never silently substitute a stronger or weaker role, and surface a
requested role the binding cannot honour. In strict mode the slice's applicable required
gate is a review round even when every role runs the same model — a clearly mechanical
slice is gated by its coordinator-run deterministic check, with an independent review
only when risk warrants one; in standard mode the slice's applicable required gate is
the coordinator-run normal verification, and that gate requirement does not relax when
every role runs the same model.
Hard slices are prime candidates for the [deep review escalation](gates.md#review-deep-gates).

## Non-interactive child sessions

Child sessions are deliberately non-interactive: their prompts forbid questions and
nested delegation, and the child must not wait for user input. Consequences for the
coordinator:

- Compose every round prompt so it needs no user decision; when a choice cannot be made
  locally, state the choice to make in the prompt itself.
- If a report comes back `blocked` on a decision, run the second opinion only where the
  [Decision consultation](consultation.md#decision-consultation-independent-second-opinion) rule owes a
  consult; the question this branch would put to the user proceeds through the
  [anti-ask gate](../SKILL.md#asking-the-user-anti-ask-gate) — for an irreversible action or a
  user-reserved decision no consult is owed, so the question goes straight to the gate.
  Never route a user-facing question through a child subagent.
- A tool denial inside a round is a report item, not a retry: re-scope the next round or
  handle the path from the main loop.
- The main loop runs unattended and defaults to a documented assumption recorded in the
  state. Every question to the user routes through the
  [anti-ask gate](../SKILL.md#asking-the-user-anti-ask-gate), the single entry for questions: only a
  situation on the gate's closed list is question-eligible, and even that candidate passes
  the gate's three checks — a recorded decision binds, an owed consult runs first, and a
  covered continuation is never asked — before it reaches the user; a question that fails
  the gate is a guard breach, reported, not sent. Never for routine continuation or a
  preference the state can decide.
