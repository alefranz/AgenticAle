## Invocation steering

Goal text supplied while state is already active steers the run. It is user
instruction for the coordinator, not a replacement goal: reconcile it against a fresh
re-read of `BACKLOG.md` and the snapshot before dispatching, and never overwrite active
work to apply it.

- **New work.** Explicit new outcomes are decomposed into backlog tasks like a round-0
  plan: each genuinely new task enters the backlog with its stable ID before any
  selection and receives its fresh allowance only at first selection. When
  decomposition needs source evidence, dispatch a focused explore round.
- **Continuation steering.** Text that adjusts the existing goal — emphasis, clarified
  acceptance, added constraints, or an explicit reordering of upcoming work — updates
  the backlog's open entries and the snapshot's acceptance only where the user's text
  explicitly supports the change. Selection changes apply at the next selection
  boundary under the normal readiness rules; the active slice and any running round
  are never interrupted. A reorder that changes the durable plan is a significant
  reconciliation, checkpointed before further dispatch.
- **Preserved state.** Steering keeps the run identity, the run ceiling (unless the
  invocation supplies an explicit numeric override), every consumed counter, the task
  allowance in force (including recorded progress extensions), fix/review counters,
  deferred packets, and open review gates. It grants no allowance — only a named user
  grant does — and bypasses no gate, dependency, or safety boundary.
- **Destructive replacement.** An explicit, unambiguous request to discard or replace
  named work is honoured only for what it names, preserving unrelated tasks and
  historical material. An ambiguous destructive request — "start over" or "replace the
  goal" without naming what is discarded — stops, and the clarifying question
  proceeds through the [anti-ask gate](../SKILL.md#asking-the-user-anti-ask-gate), before any
  state is rewritten.

The invocation text never goes into the human-owned steering surface (see
[Live steering](#live-steering)). Record the reconciliation in the existing backlog and
snapshot, then continue the recorded `NEXT` action unless the reconciled plan changes it
at a selection boundary. A significant reconciliation is persisted as an immediate
state-only checkpoint before any further dispatch (see
[Reconciliation checkpoints](persistence.md#reconciliation-checkpoints)).

## Live steering

The human can steer a running goal through one small, optional, human-owned file —
`.agenticale/steering.md` — with exactly two documented controls and no unrestricted command
channel:

```markdown
- mode: continue
- priority: T3, T2
```

- The file is absent by default: no file means `continue` and no priority. The coordinator
  reads it; it never creates, edits, or deletes it, and children never touch it.
- `mode` is `continue` (the default when the file or the line is absent) or `pause`. Only
  the exact value `pause` pauses the run; an unrecognized value changes nothing and is noted
  in the next report.
- `priority` is an optional comma-separated list of task IDs. It reorders only the NEXT task
  selection among ready tasks: named ready tasks are considered first, in listed order, then
  the remaining ready tasks in their normal backlog order. IDs exist from the moment a task
  enters the backlog, so a recorded task that has never been selected can be named; an ID
  absent from the backlog is unknown. Priority never interrupts the active task or a running
  round, and it never makes a blocked, dependent, unknown, worker-ineligible
  (allowance-exhausted), or otherwise not-ready task selectable; such IDs are skipped with a
  recorded note.

The coordinator re-reads the steering surface immediately before every new round dispatch —
worker, review, fix, consult, and deep review alike. Steering grants no allowance, scope,
Git right, or gate exception; content beyond the two documented controls is not an
instruction the loop executes. Invocation goal text is a separate explicit user channel (see
[Invocation steering](#invocation-steering)); it is never written into the steering surface.

On `pause`, the loop stops at the next safe checkpoint: a running child is allowed to settle
(rounds are strictly sequential, so at most one is in flight), its result and charge are
recorded, and the snapshot preserves the exact `NEXT` action and all counters. The loop then
stops with a pause report and the continuation prompt. It never interrupts a child
mid-round, polls the file, or starts a watcher or service. **The pause is persistent**: it
survives session ends and resumes. A fresh activation re-reads the surface: `continue` (or
an absent file) resumes the recorded `NEXT`; a still-present `pause` stops again without
dispatching. Only the human's own edit — setting `continue` or removing the pause — releases
it; continuation is normal when no pause is present. A pause noticed during a quota cooldown
wait is honored before the next launch after the wait; the wait itself keeps its existing
deadline rules.

**Legacy steering compatibility.** A legacy run may carry the human-owned `## Steering`
section in `BACKLOG.md` with the same two controls. The coordinator reads it when the new
steering file is absent, and never edits it. When both surfaces exist, `pause` in either
pauses the run (pause wins); `priority` comes from the new file when it defines one,
otherwise from the legacy section; a disagreement is noted in the next report, and neither
surface is ever auto-edited to resolve it. The one-time transition is the human's own act —
creating `.agenticale/steering.md`, optionally copying the controls — never the
coordinator's: the agent never migrates, rewrites, or deletes human steering content, and
the legacy section stays untouched as history when the new file exists.
