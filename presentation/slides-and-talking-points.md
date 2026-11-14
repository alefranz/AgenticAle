# Practical Agentic Engineering with AgenticAle
**Target Audience:** Software Engineers (primarily GitHub Copilot users)  
**Duration:** ~40 minutes presentation + 15–20 minutes Q&A (60 minutes total)

---

## Section 1: The Problem with Raw Agent Sessions (5–7 mins)

### Slide 1: Title — Beyond the Chat Window: Practical Agentic Engineering with AgenticAle
**On Slide:**
- **Title:** Practical Agentic Engineering with AgenticAle
- **Subtitle:** Fresh Context, Right-Sized Models, and Built-In Review Loops for Everyday Coding
- **Agenda:**
  1. Why single-thread AI coding sessions break down
  2. Deep dive: The `/work` skill & subagent orchestration
  3. Guardrail skills: `source-code-lookup` & `pull-request-description`
  4. AgenticAle vs. Copilot Fusion & Shared vs. Custom Skills
  5. Frontier experiment: `/autonomous` mode & local models

**Talking Points:**
- Welcome everyone. Most of us use GitHub Copilot or coding agents every day now, and for small edits or quick questions, a normal chat session is great.
- But as soon as you hand an agent a real engineering task—something that touches multiple files, requires investigating dependencies, and needs to end in a solid PR—raw single-thread chat starts showing cracks.
- Today I want to walk through **AgenticAle**, a portable set of agent skills, focusing mainly on `/work`: why it’s structured around fresh subagents and per-role model configuration, where it fits alongside tools like Copilot Fusion, and how it can even serve as a "glass box" to build intuition for agentic coding.

---

### Slide 2: Why Single-Context AI Coding Breaks Down
**On Slide:**
- **1. Context Rot & Anchoring**
  - Failed grep searches, half-read files, and dead-end edits pile up in the prompt window.
  - Later turns pay the attention & token tax of earlier mistakes.
- **2. Self-Review Bias**
  - Asking the same session *"Did you miss anything?"* rarely catches bugs—it shares the exact blind spots that wrote the code.
- **3. One-Size-Fits-All Model Selection**
  - Using a heavy reasoning model to locate files wastes time & quota.
  - Using a fast model for a gnarly edge case introduces subtle regressions.
- **4. The Manual Babysitting Tax**
  - Engineers end up manually resetting chats, copy-pasting summaries, and switching models mid-stream.

**Talking Points:**
- Let's name the four failure modes we've all experienced:
  - First, **context rot**: twenty minutes into a session, 70% of your context window is dead stack traces and files that turned out to be irrelevant. The model gets anchored to its initial wrong assumption.
  - Second, **self-review bias**: when an agent writes code and you ask it in the same thread to review its work, it almost always rubber-stamps it because the reasoning that produced the bug is still sitting right there in context.
  - Third, **wrong model for the job**: you either burn expensive reasoning quota on simple file discovery, or you leave a fast model on and watch it struggle on a tricky architectural fix.
  - Fourth, **cognitive overhead**: you *can* manually open new chats, paste context packets, and switch models yourself—but you shouldn't have to.

---

## Section 2: Core Deep Dive — The `/work` Skill (12–15 mins)

### Slide 3: Enter `/work` — Opinionated Subagent Orchestration
**On Slide:**
- **Core Idea:** Keep the main session as a lightweight **Coordinator**; dispatch every actual step to a **fresh child subagent**.
- **Explicit-Only (`/work`):** Never hijacks normal chat—you invoke it when a task deserves structured execution and review.
- **Workflow Loop:**
  `Coordinator` -> `Explore` (optional) -> `Implement` -> `Independent Review` -> `Fix` (if needed) -> `Delivery / PR`
- **Compromise by Design:**
  - Adds a small orchestration overhead (not meant for a 1-line typo fix).
  - In exchange: handles context hygiene, per-role model configuration, and independent review automatically for 90% of real tasks.

**Talking Points:**
- This is where the `/work` skill comes in. Its philosophy is simple: **automate good agentic hygiene so you don't have to think about it.**
- When you run `/work`, your main chat session stops writing code directly. Instead, it becomes the **Coordinator**.
- The Coordinator inspects the repo state, builds a focused **Task Packet** (just the facts, scope, and acceptance criteria—never the noisy conversation history), and spawns a **fresh subagent** for each phase.
- Yes, there is a deliberate trade-off: spawning subagents adds a bit of latency compared to a single-turn inline edit. That’s why `/work` is explicit-only. You use normal chat for quick questions, and `/work` when you want a task taken cleanly from prompt to reviewed code or PR.

---

### Slide 4: Fresh Context per Round & The Independent Review Gate
**On Slide:**
- **Task Packets (`references/rounds.md`):**
  - Each child gets: target outcome, exact scope, repo instructions, relevant file paths, and verification commands.
  - Each child returns: a compact structured report (keeping the Coordinator's context tiny).
- **Zero-Trust Independent Review:**
  - The `review` subagent starts with a **blank slate**.
  - Worker claims are explicitly labeled *unverified*—the reviewer inspects the actual git diff and untracked files against the original acceptance criteria.
  - If issues are found -> `fix` round -> re-review tracks findings by stable ID (`fixed`, `still open`, `regressed`).

**Talking Points:**
- Let's look at why fresh context matters most at the **Review Gate**.
- When the `implement` subagent finishes, it returns a short summary of what it changed and what tests it ran. All the 15 files it read along the way stay in its disposable context and disappear.
- Next, the Coordinator spins up a brand-new `review` subagent. Crucially, `rounds.md` instructs the reviewer to treat the worker's claims as **unverified**. The reviewer doesn't care that the worker struggled for 10 minutes on a regex—it only sees the original user goal and the actual diff on disk.
- If the reviewer finds a blocking issue, a `fix` subagent is dispatched, followed by a re-review that tracks every finding by ID until the gate is clean.

---

### Slide 5: Right Model for the Job — Per-Role Model Configuration
**On Slide:**
- **Seven Roles, One Model Each:**
  - `explore`, `implement`, `implement-hard`, `fix`, `review`, `deep-review`, `consult` — each gets its own model, and its own reasoning effort where the host supports it.
- **OpenCode: set at install time**
  - `--models PATH|PRESET` bakes a flat per-role config into the seven generated agent profiles; `--no-model` makes every role inherit the session model.
- **Other hosts: one optional preference file**
  - Direct role assignments (`.agenticale/preferences.md`, project first, then personal) — nothing else is interpreted.
- **Named setups with `--profile NAME`:**
  - Selects `preferences.NAME.md` at the same locations; a missing file is a clear error, never a silent fallback.

**Talking Points:**
- Alongside fresh context, `/work` solves model selection **per role**: each of the seven roles — `explore`, `implement`, `implement-hard`, `fix`, `review`, `deep-review`, `consult` — gets its own model, and where the host supports it, its own reasoning effort.
- On OpenCode the model configuration is set **at install time**: a flat per-role config — a JSON file or a bundled preset like `openai` — is baked into the seven generated agent profiles, so dispatching the role *is* the routing.
- On the other hosts (Copilot, Codex, Antigravity), the configuration is **one optional Markdown preference file** with direct role assignments like `- review: openai/gpt-6.1-sol, xhigh` — a project file wins over the personal one, and nothing else in the file is interpreted.
- For named setups, a leading `--profile NAME` selects `preferences.NAME.md` at the same locations — and a missing file is a concise, actionable error, never a silent fallback.
- When a task or review finding needs concurrency, subtle state, security, or difficult contract reasoning, `/work` runs the implement or fix contract on the `implement-hard` role, which you can point at your strongest model.

---

### Slide 6: From Prompt to High-Confidence PR (`/work --pr` & Power Flags)
**On Slide:**
- **`/work --pr <task>` (or `/work --pr=<PR-URL>`):**
  - Runs implementation -> local verification -> independent review -> fix loop -> coherent commits -> push -> creates/updates PR.
- **`/work --consult <task>`:**
  - Runs a read-only `consult` subagent *before* coding to challenge task framing, surface hidden edge cases, and ask only the questions that actually need human judgment.
- **`/work --outcome <measurable goal>`:**
  - Pre-registers a baseline & acceptance card (e.g., *"speed up export by 20%"*) before any code is written so the agent can't move the goalposts later.
- **Sequential Decomposition:**
  - Larger tasks are sliced into verifiable steps, completing and reviewing one slice at a time.

**Talking Points:**
- How does this feel in practice? With `/work --pr`, you can hand it a bug or feature, and by the time it opens or updates the pull request, the code has already survived local checks *and* at least one round of independent review.
- There are also two really useful opt-in flags:
  - `--consult` dispatches a deep-thinking consultant before a single line of code is written to challenge the requirements and surface trade-offs.
  - `--outcome` is for measurable targets like latency or bundle size: it pins the baseline metric upfront in an Outcome Card so the agent can't cheat or move the goalposts when evaluating candidates.

---

## Section 3: Supporting Skills — Guardrails Against AI Bad Habits (5 mins)

### Slide 7: `source-code-lookup` & `pull-request-description`
**On Slide:**
- **Problem:** What happens when a bug crosses into an internal NuGet/npm package, HTTP microservice, or message queue?
  - *Without guidance:* Models guess from types, hallucinate behavior, or start decompiling binaries in temp folders.
- **`source-code-lookup` Skill:**
  - Follows repo evidence (lockfiles, API clients, queue schemas) to identify the owning repo.
  - Checks local checkouts (`~/dev` / `SOURCE_ROOT`) or clones cleanly into canonical paths.
  - **Inspects the exact matching commit/version** (`git show` / `git grep`) without dirtying branches—and runs in a fresh `explore` subagent so external code doesn't bloat the worker's context!
- **`pull-request-description` Skill:**
  - Replaces robotic file-by-file diffs with **why** the change exists, reviewer-relevant operational risks, and **non-obvious validation** only.

**Talking Points:**
- Workflow orchestration is only half the story; we also need guardrails for common model bad habits.
- My favorite example is **`source-code-lookup`**. We've all seen what happens when an agent hits a mysterious behavior in an external package or another service: it starts guessing, or worse, runs a decompiler on a compiled package in `node_modules` or `.nuget`.
- With `source-code-lookup`, the agent checks lockfiles or service configs to find the exact repository and version, looks in your local `~/dev` folder (or clones it cleanly), and uses `git show` at the **exact commit matching the deployed version**. Even better, `/work` delegates heavy external lookups to an `explore` subagent, so reading 2,000 lines of another service only returns a 5-line factual answer to your worker.
- Similarly, **`pull-request-description`** stops agents from writing useless PR bodies like *"Updated foo.ts and ran tests"*, focusing instead on intent, rollout risks, and non-obvious validation.

---

## Section 4: Ecosystem & Strategy — Copilot Fusion & Skill Governance (8–10 mins)

### Slide 8: "Why Not Just Use GitHub Copilot Fusion?"
**On Slide:**
- **When Copilot Fusion Wins:**
  - Zero-ceremony interactive coding, quick questions, inline iterations, and automatic turn-by-turn model switching.
- **Why AgenticAle `/work` Still Matters:**
  1. **Architectural Workflow vs. Turn Routing:** Fusion picks a model per prompt; `/work` enforces *structural boundaries* (fresh context per role + mandatory independent review gate).
  2. **Explicit Role & Profile Control:** Pin exact models/efforts per role (`explore` vs. `review`) across your team.
  3. **The "Glass Box" Narration Feature:**
     - Before every round, the Coordinator narrates: *what was learned, what comes next, and why*.
     - Makes subagent orchestration transparent—turning `/work` into a **learning tool** to understand how agentic coding decomposes problems, escalates complexity, and catches bugs.

**Talking Points:**
- Since we use GitHub Copilot, a natural question is: *"Why not just use Copilot Fusion, which already routes between models automatically?"*
- And the honest answer is: for everyday interactive back-and-forth, **you should!** Fusion is great when you're in the driver's seat iterating turn by turn.
- Where `/work` shines is two things:
  - First, **workflow control**: Fusion switches models inside your conversation, whereas `/work` enforces fresh context isolation between the coder and the reviewer.
  - Second, **visibility and learning**: `/work` has a built-in narration contract. Before every subagent dispatch, the Coordinator writes a concise paragraph explaining *what the last agent found, what round is running next, and why*. Even when your IDE collapses subagent tool calls, you get a crystal-clear narrative of how an agentic system reasons, decomposes slices, and catches its own mistakes. It's one of the best ways to build intuition for agentic engineering.

---

### Slide 9: Shared Skills vs. Every Engineer/Org Forking Their Own
**On Slide:**
- **The Temptation:** *"Let's have every team or engineer write their own custom workflow prompts!"*
- **Why Forking Workflow Plumbing Hurts:**
  - Orchestration edge cases are surprisingly hard: preventing infinite review loops, preserving pre-existing dirty files, tracking re-review finding IDs, and handling quota resets (`rounds.md` is 350 lines of battle-tested edge cases).
- **The Layered Pattern (What to Share vs. What to Customize):**
  - **Keep Shared (Commodity Workflow Skills):** Context isolation, review/fix state machine, PR delivery (`work`, `review`).
  - **Customize Locally (Repo & Org Layer):**
    - `AGENTS.md` for repo architecture, build commands, and conventions.
    - `.agenticale/preferences.md` for per-role model configuration.
    - Domain-specific leaf skills (like internal deployment or telemetry lookup).

**Talking Points:**
- Stepping back from AgenticAle specifically: how should teams think about adopting shared skills versus every engineer or org rolling their own?
- It's tempting to think a review loop is just a 10-line prompt. Then you hit reality: What if the working tree already had uncommitted changes before `/work` started? What if the fixer fixes Bug A but introduces Bug B? What if the worker tries to delegate to another worker infinitely?
- Solve orchestration plumbing *once* in a shared, well-tested skill, and customize at the edges: put your repo rules in `AGENTS.md`, your model preferences in `.agenticale/preferences.md`, and write small domain-specific supporting skills for your org's unique tools.

---

## Section 5: The Frontier Experiment — `/autonomous` Mode (5 mins)

### Slide 10: `/autonomous` — A Self-Driving Backlog Loop
**On Slide:**
- **Same Core Primitives + Durable Disk State:**
  - Reuses `/work`'s task contracts and strict independent review gates, backed by `BACKLOG.md` and `.agenticale/handoffs/active.md`.
- **How It Runs:**
  - Pulls the next item from the backlog -> implements -> runs strict independent review -> updates/grooms the backlog -> records a compact two-line ledger entry and exact `NEXT` action.
- **Built for Subscription Windows & Local Models:**
  - **Quota-Aware:** Persists provider rate-limit cooldown & retry state in `active.md`—waits for your subscription usage window to reset and resumes cleanly without losing progress.
  - **Local Model Friendly (`--profile NAME` preference files):** Pair cloud reasoning for review/coordination with local models for routine worker rounds.
  - **Best Fit Today:** An awesome laboratory for hobby projects, greenfield prototypes, or overnight mechanical migrations.

**Talking Points:**
- Before we open up for questions, I want to spend 5 minutes on the most experimental part of the repo: **`/autonomous` mode**.
- Think of `/autonomous` as asking: *"What happens if we take `/work`'s fresh subagent and strict review primitives, and attach them to a durable project backlog on disk?"*
- Instead of keeping state only in the chat session, `/autonomous` maintains `BACKLOG.md` and `.agenticale/handoffs/active.md`. It picks a task, runs worker and strict review rounds, refines the backlog as it learns more about the codebase, and writes a durable checkpoint after every single round.
- Two features make it especially fun for hobby projects:
  1. **Subscription window awareness:** If you hit a provider quota limit at 2 AM, it records the exact state and cooldown window in the handoff file so it can wait or resume later with zero lost work.
  2. **Hybrid local/cloud configuration:** You can point routine coding roles at local models while keeping a strong cloud model for the reviewer.
- I wouldn't point `/autonomous` at a mission-critical production monorepo unattended tomorrow—but as a sandbox for side projects and seeing where long-horizon engineering is headed, it's eye-opening.

---

## Section 6: Wrap-Up & Discussion (15–20 mins)

### Slide 11: Choosing the Right Mode & Q&A
**On Slide:**
| Mode | Best When... | Context & Review Model |
| :--- | :--- | :--- |
| **Normal Chat / Copilot Fusion** | Quick edits, pair-programming in the loop, fast exploration | Single shared thread, auto-routed turns |
| **`/review`** | You wrote (or AI wrote) branch changes and want an unbiased audit | Fresh read-only reviewer subagent |
| **`/work` (`--pr`, `--consult`, `--outcome`)** | Multi-file features/bugs where you want high confidence & narration | Coordinator + fresh worker/reviewer subagents |
| **`/autonomous`** | Side projects, overnight backlogs, hybrid local/cloud experiments | Durable `BACKLOG.md` + `active.md` + quota recovery |

- **Takeaway:** Start with `/work` on your next medium-sized task—watch the narration between rounds, see what the independent reviewer catches, and let it handle the path to PR.

**Talking Points:**
- To wrap up, here is the mental model for when to reach for what:
  - Stay in normal chat or Copilot Fusion when you're moving fast on small interactive changes.
  - Reach for `/review` when you want a fresh, unbiased pair of eyes on your current branch.
  - Use `/work` (and `/work --pr`) as your default for real engineering tasks where context management, right-sized models, and independent review save you from babysitting.
  - And try `/autonomous` on a hobby project to experience self-driving backlog execution.
- Let's open it up for questions!

