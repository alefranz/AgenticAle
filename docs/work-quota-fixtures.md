# Work provider-quota behavior examples

These examples define expected coordinator behavior for the session-scoped
quota rule in `skills/work/SKILL.md`. They are review fixtures, not claims about
any runtime's exact output or a test of live provider behavior.

## Explicit exhaustion on launch

**Observed:** A child launch returns the host message `The usage limit has
been reached`, with no task report and no indication that work started.

**Expected:** Treat this as confirmed quota exhaustion for that child role.
Stop dispatching, report the exact evidence and any retry details, and leave
the task incomplete. Do not send a malformed-report correction, switch routes,
run the task in the coordinator, wait, or retry automatically.

## Explicit exhaustion after partial implementation

**Observed:** An implementation child has edited two files, then its host result
reports provider usage quota exhaustion and indicates the child is terminal.

**Expected:** Inspect and preserve both edits. Report the implement role, the
host evidence, completed and unchecked work, and retry details if provided. Keep
review and acceptance checks pending; do not dispatch a reviewer or publish a
pull request until the task resumes and passes its gates.

## Explicit exhaustion in any other role

**Observed:** A reviewer, fixer, explorer, consultant, or deep reviewer returns
explicit host/provider quota evidence, either at launch or after partial work.

**Expected:** Stop dispatch and report the role, evidence, partial work, and
unchecked work. In particular, do not mark an interrupted review clean, close
blocking findings after a partial fix, claim exploration is complete, or publish
the implementation as reviewed. Preserve partial changes and leave the task
incomplete until it resumes.

## Quota message without terminal status

**Observed:** The host reports an explicit rate limit, but available status does
not establish whether the child has stopped.

**Expected:** Do not launch overlapping work. Use the available host status to
establish termination if possible; otherwise report the unresolved child state
and stop further dispatch. Preserve the current working tree and task state.

## Ambiguous failures

**Observed:** A child returns an empty result, a generic `429`, a timeout, or an
authentication, network, billing, or account error without explicit quota
language or host metadata identifying quota exhaustion.

**Expected:** Do not classify it as quota exhaustion. Apply the existing
malformed-report or ordinary error policy for the observed failure. Do not
invent a retry deadline or durable cooldown state.

## Same model, independent reviewer

**Observed:** The review route inherits the session model or resolves to the
same model selected for implementation.

**Expected:** A fresh reviewer still provides an independent review. Model
identity alone does not establish or invalidate independence.
