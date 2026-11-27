## Decision consultation (independent second opinion)

This skill runs unattended, so the escape hatch for a decision the loop cannot settle is not
a question to the user: it is one foreground round with the consult contract — an
independent second opinion. On the two standard-setting paths — a standard unsettled by
the shared [Standard settlement](../../work/references/rounds.md#budgets-and-loop-continuation)
trigger, and a [convergence
declaration](../../work/references/rounds.md#budgets-and-loop-continuation) that requires a
closure decision — the consult is mandatory before any user question, within the
unchanged caps (one per decision, two per session); the one decision the loop then owes
— the settlement's proposed-standard decision, or the declaration's one decision —
proceeds through the [anti-ask gate](../SKILL.md#asking-the-user-anti-ask-gate), per the shared
contract's [Decision order](../../work/references/rounds.md#budgets-and-loop-continuation).
Everywhere else the consult
remains the available alternative to asking: when a [stop condition](stops.md) would end
in "ask the user a question" about a reversible judgement decision (a blocked task,
surviving blocking findings after a fix, a standard-setting question, or any decision
the state cannot settle), the main loop may run one consult round instead of asking. A
consult is also warranted before the loop commits to a clear, direct, complex choice — a
bounded focused decision whose framing benefits from independent review — not only when
the loop is stuck.

Where the installation configures the `consult-hard` route, dispatch the consult on it
directly when the decision's character is apparent: conflicting evidence, interacting
constraints, or a costly reversal. It is read-only, carries the same consult contract, and
consumes the same consultation allowance as an ordinary consult; when the route is not
configured, the decision runs on `consult`. A requested stronger advice the host cannot
honour is surfaced as a limitation, never silently substituted.

Give the consult exactly one decision: the question, the candidate options with what each
does to scope, budget, and risk, what was already tried and why it failed, the acceptance
conditions, and the cheap checks it may run. It returns one recommendation with a confidence
level; the main loop may adopt it. On the standalone settlement path — the settlement
trigger fires on its own, no saturation declaration pending — the consult instead names a
**proposed** standard for the open classes — a proposal, not a binding adoption, and the
loop never settles the standard on the consult's authority alone: it owes the user exactly
one decision — ratify, an alternative, or close now — offered through the
[anti-ask gate](../SKILL.md#asking-the-user-anti-ask-gate); the shared [Standard
settlement](../../work/references/rounds.md#budgets-and-loop-continuation) is the single authority for
that path. On the declaration closure path — a saturation declaration pending — the
settlement question is not a separate ratification question: per the shared contract's
[Decision order](../../work/references/rounds.md#budgets-and-loop-continuation), the unsettled
classes' settlement question joins the single combined declaration decision (its consult
order and closure options are the shared contract's); where every open class is already
settled, the declaration stands alone with its closure options. On either path the
consult never reopens an already-settled
class: the settlement trigger fires only for classes with no recorded settlement, and a
recorded class unsets only under the reopening conditions stated in the shared [Standard
settlement](../../work/references/rounds.md#budgets-and-loop-continuation). Any other consult adoption
is recorded like any other decision: a consult
outcome plus a state note citing the consult round and its report, marked as an
**independently advised decision the user can veto later**.

Consult does NOT apply to: irreversible actions (force-push, deleting branches, publishing a
release or pull request — those proceed through the
[anti-ask gate](../SKILL.md#asking-the-user-anti-ask-gate)), user preference or taste (likewise
question-eligible through the gate), and anything
`AGENTS.md` reserves to the user. A low-confidence consult, or one that hedges despite its
format, counts as no answer: the owed question then proceeds through the
[anti-ask gate](../SKILL.md#asking-the-user-anti-ask-gate) like any other. At most one consult per
decision and two per session. Consult rounds do not consume the worker-round budget.

A consult settles a reversible technical or design decision within the allowances that
remain; adopting its recommendation never starts a round the budgets do not cover. The fix →
review loop is gated by the effective worker budget, verified progress, the stall
safeguards, and the review-limit headroom condition
([Fix continuation and review justification](gates.md#fix-continuation-and-review-justification))
— each fix is a worker round charged to both budgets — not by per-target cycle counts.
Review, review-deep, and consult rounds keep their own accounting and stay
dispatchable after worker-budget exhaustion when justified, including the permitted review
of an exhausted task's completed changes. A consult cannot grant an allowance or justify a
correction beyond the budgets: evidence-backed task extensions within the progress ceiling
follow the shared contract, and any extension beyond them — past an explicit cap, the run
ceiling, or the completed-task limit — is a user-only decision through a named increment,
never delegated to a consult. An exhausted task allowance alone is not a run stop (see
[Task exhaustion is not a run stop](budgets.md#task-exhaustion-is-not-a-run-stop)). When the limits
that govern the next needed round are hit, stop under the [stop conditions](stops.md#stop-conditions) and offer
the user the named increment the continuation needs instead. The interactive budget grant offer
is a question-eligible situation that proceeds through the [anti-ask
gate](../SKILL.md#asking-the-user-anti-ask-gate).
