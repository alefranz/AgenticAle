# Work

Work coordinates an everyday coding task through a focused implementation,
independent review, and fixes. It can also handle delivery when you explicitly
request a pull request. Invoke it when you want a change completed and checked
as one task, or when you want feedback on a change already in progress.

Work gives a coding task a clear path from implementation through independent
review, focused fixes, and delivery. A capable lower-cost or local implementer
may need extra focused implementation or fix passes, yet still cost less overall
than using the strongest model throughout. A fresh, stronger reviewer can catch
issues and give actionable feedback; checks and re-review can improve the
result. Added rounds count toward total effort, and savings and quality depend
on the task, models, provider, and account. A fresh reviewer provides
independence; it does not have to use a different model.

Throughout the task, concise progress narration connects the agents' work:
what was learned, what happens next, and why. You can follow the decisions in
the main conversation even when your client collapses the subagent activity.

## Try Work

Invoke the installed skill for a bounded task and describe the outcome you want:

- `/work Fix the date filtering bug`
- `/work Add CSV export for the report table`
- `/work Investigate why export is slow and recommend a fix`

Add `--pr` when you want Work to prepare and open a pull request. The examples
use conceptual slash syntax; select the installed skill or use the
client-specific invocation described in [setup](../../setup.md). Work starts
only when explicitly invoked. The invoking session coordinates the task; there
is no separate coordinator agent to choose.

## When to use it

Use Work for a bounded feature, bug fix, investigation that should produce a
concrete recommendation, or review feedback on a pull request. It is a good fit
when the task can be divided into clear implementation and review steps.

Other good fits include addressing review feedback on a branch and requesting a
pull request with `/work --pr`.

## The routing tiers

The packaged defaults assign a tier by role. These are named configurations,
not a universal ranking of models; see [Choosing models by role](../../guides/model-routing.md#choosing-models-by-role)
for concrete examples and customization guidance.

| Tier | Typical use in Work |
| --- | --- |
| Fast | Exploration |
| Routine | Implementation and focused fixes |
| Standard | Hard implementation and independent review |
| Deep | Conditional review of substantial interactions or risk |

## How a change request moves through Work

The coordinator reads the project instructions and current changes, then
briefly assesses what the request would touch: sources other actors can also
mutate, side effects that would survive an interruption, concurrent humans,
and compatibility surfaces. It inspects only as much as a concrete
uncertainty requires — a small question is answered with a direct read, and a
focused exploration round runs only when the question needs its own context,
with one question and a stop condition. No discovery round is mandatory, and a
question about subtle semantics is not automatically a fast route: each
exploration round's route is resolved through the routing contract. It then
sends a compact task packet to an implementation agent. After implementation,
a different agent reviews the result against the request, project conventions,
and relevant checks. The coordinator assigns a focused fix when the review
finds a defect, then verifies the result and delivers it according to your
request.

```mermaid
flowchart TD
    Task[Task] --> ExploreNeeded{Explore first?}
    ExploreNeeded -->|Yes| Explore[Focused exploration · fast tier]
    ExploreNeeded -->|No| Implement[Routine implementation · routine tier]
    Explore --> Implement
    Implement --> Review[Independent review · standard tier]
    Review --> SliceAccepted[Slice accepted]
    SliceAccepted --> MoreSlices{More slices useful?}
    MoreSlices -->|Yes| Implement
    MoreSlices -->|No| DeepReviewNeeded{Substantial interactions or high risk?}
    DeepReviewNeeded -->|Yes| DeepReview[Deep review of combined work · deep tier]
    DeepReviewNeeded -->|No| Checks[Acceptance checks and report]
    DeepReview --> Checks
```

Focused fixes use the routine tier; hard implementation uses the standard
tier. A blocking finding that needs concurrency, durability, state-machine, or
ownership reasoning keeps the fix role and its fix counters, but is
dispatched on the configured hard route — the standard tier in the packaged
defaults. The task role and the routing key are separate choices, the
configured policy decides the route, and a route the binding cannot honour is
reported rather than silently substituted. These are packaged defaults, and
routes remain configurable.

Every review uses the same findings gate:

```mermaid
flowchart TD
    Review[Review] --> Findings{Blocking findings?}
    Findings -->|Yes| Fix[Focused fix · configured routine or hard route]
    Fix --> Review
    Findings -->|No| Accepted[Accept this review]
```

A re-review closes the loop over the earlier report: each prior finding is
reported by ID as fixed, partially fixed, still open, or regressed, with new
defects kept separate from the consequences of an earlier unresolved issue.
When the acceptance involves recovery or interruption behavior, the evidence
comes through the real user entry or command selection that reaches that path,
including the interruption boundary around its external side effects — not
internal method tests alone. Targeted checks bound each slice; full-suite and
publishing checks belong to the integration boundary.

Work allows at most two fix cycles and three review passes per slice or
combined-review target. When a limit is reached with blockers remaining, Work
stops without another round of that type and reports which allowance is
exhausted, what is completed and what is blocked, and the recent material
progress. It recommends a bounded correction, a bounded replan, or a stop that
preserves the current work; where your host offers choices, it offers the
situation-appropriate ones, such as one additional fix-and-review cycle. A
granted extension adds exactly the named rounds — it never resets counters and
grants no extra scope, review, or Git rights — and declining or not answering
ends the stop. The stop report carries a copy-pasteable continuation prompt so
a fresh session can pick up where it left off.

Repeated findings on the same invariant are classified before another round:
a genuinely unmet invariant is a real design issue — the plan is reopened with
the original acceptance and counters intact — while reviewer standard drift is
settled once, not chased as a defect.

Each slice passes review before Work moves to the next one. Deep review is an
additional gate when the combined changes have substantial interactions or a
high-risk shared invariant; any blocking findings return through the fix and
review loop. An investigation-only request ends after exploration with findings
and a recommended next step. Work opens a pull request only when you explicitly
request PR delivery; otherwise it reports what it checked and any limitations.

## Progress narration

Before the first assignment, the coordinator explains the intended outcome and
first step. Subsequent updates link the last result to the next step. For example:

> The checks passed, but verification found that the rename breaks migration
> from older installs. I'm assigning a focused fix to preserve those paths.

Then, once that fix has been checked:

> The migration fix passes the targeted checks. An independent reviewer will
> now check the full change, including compatibility with older installs.

These updates explain the purpose of each assignment, significant trade-offs,
and what remains uncertain. Model names and routine round counters stay out of
the normal updates. A routing change, fallback, or limitation is explained when
it affects the work; an approaching budget limit is called out when it constrains
the next step. You can ask for model choices or routing details when useful.

This makes the main conversation a readable account of the work, with detailed
subagent activity available according to the client's interface. Where that
activity is collapsed, the progress updates let you follow the task without
opening every subtask. The skill controls the summaries, not the client's layout.

Narration adds tokens. The deliberate trade-off is a few sentences at meaningful
transitions to make decisions and verification easier to follow; the cost varies
with the task and number of rounds. Code shows the resulting behavior, while
these updates can explain why an approach changed, which trade-offs mattered,
and what was checked. They complement the diff and test evidence, and help you
decide where a closer look is worthwhile.

## What to provide

Describe the outcome you want, the relevant behavior, and any constraints that
affect the solution. Include a reproduction, expected result, or acceptance
examples when they clarify a bug or feature. Work reads the current checkout
and any applicable `AGENTS.md` instructions, so point out files or context that
are outside the repository when they matter.

For an investigation, say whether you want a recommendation or an implemented
fix. For pull request delivery, include `--pr` or clearly ask Work to open a PR.
Without that request, changes stay uncommitted in the current branch by default.
Work asks for your input when a meaningful behavior choice is unresolved,
required information is missing, a pull request destination is ambiguous, or
existing user edits overlap the requested change and cannot be safely attributed.

If the host explicitly reports provider quota or rate-limit exhaustion, Work
stops and reports the affected role, evidence, partial work, unchecked work, and
any supplied retry information. It preserves partial changes and does not
automatically retry, wait, switch models, or create durable recovery state.
Missing output or generic network, authentication, billing, or `429` errors
alone do not establish quota exhaustion. This stop is separate from an
allowance stop above and from Autonomous Mode's durable quota recovery. See
[troubleshooting](../../guides/troubleshooting.md#provider-quota-exhaustion).

## What you receive

Work returns the implemented change, relevant verification results, and any
remaining limitations. [Progress narration](#progress-narration) keeps the
decisions visible along the way, and an incomplete stop ends with the
copy-pasteable continuation prompt. If you request a PR, it prepares the change for review
and returns the PR link. If the task is investigation-only, it returns the
findings and a concrete next step.

## Implementation source

This guide explains the user-facing workflow. The authoritative instructions
are the [Work skill source](https://github.com/alefranz/AgenticAle/blob/main/skills/work/SKILL.md),
[shared round contract](https://github.com/alefranz/AgenticAle/blob/main/skills/work/references/rounds.md),
and [implementation task contract](https://github.com/alefranz/AgenticAle/blob/main/skills/work/references/tasks/implement.md).
Installation remains in the [setup guide](../../setup.md);
architecture and runtime support remain in the canonical
[architecture](../../architecture.md)
and [runtime compatibility](../../runtime-compatibility.md)
references.
