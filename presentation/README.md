# Practical Agentic Engineering with AgenticAle — Presentation

This folder contains the complete 60-minute presentation:
- **`index.html`**: Self-contained HTML presentation powered by Reveal.js (loaded via CDN, zero build steps).
- **`speaker.html`**: Dedicated standalone Speaker View page that synchronizes in real time with the presentation in a separate window or tab.
- **`slides-and-talking-points.md`**: The source outline, slide contents, and verbatim speaker talking points.

---

## Published on the Project Website

The presentation is also published on the project's GitHub Pages site:

- **Presentation:** <https://alefranz.github.io/AgenticAle/presentation/>
- **Speaker view (alongside it):** <https://alefranz.github.io/AgenticAle/presentation/speaker.html>

No extra step is needed: a successful push to `main` deploys it via the existing docs build/deployment workflow, which copies `index.html` and `speaker.html` into the site build output (see `docs/site-maintenance.md`). The speaker-window/tab sync works on the published site because both files are served from the same origin. A `Presentation` entry in the site navigation links to it.

---

## How to Open the Slides

### Option 1: Direct File Open (Zero Setup)
Simply double-click `presentation/index.html` or open it directly in any modern browser (Chrome, Edge, Firefox, Safari):
```bash
# Windows PowerShell
Start-Process "presentation\index.html"
```

### Option 2: Local HTTP Server (Optional)
If running over a local HTTP server:
```bash
# Using Node / npx
npx serve presentation

# Or using Python
python -m http.server 8000 --directory presentation
```
Then open the local server address printed in your terminal in a browser.

---

## Speaker Notes: 3 Ways to View

1. **Dedicated Speaker Window (Dual Display):**
   - Press **`S`** on your keyboard, or click **`🪟 Speaker Window`** in the bottom control bar.
   - Opens `speaker.html` as a pop-out window with live slide synchronization, current slide talking points, next slide preview, elapsed timer with pause/reset, wall clock, font size adjustment, and slide counter.
   - Drag this window to your podium / laptop screen while keeping `index.html` fullscreen on the projector display.

2. **Dedicated Speaker Tab (Separate Browser Tab):**
   - Click **`📑 Speaker Tab`** in the bottom control bar (or open `presentation/speaker.html` in another tab).
   - Syncs seamlessly in real-time across tabs via `BroadcastChannel` and local storage without needing a web server.
   - Navigating in either tab (using `←` / `→` or the on-screen buttons) keeps both tabs in lockstep.

3. **On-Screen Notes Drawer (Single-Screen / Rehearsal):**
   - Press **`N`** or click **`📝 Drawer`** to slide out in-page talking points without leaving the slide view.

---

## Keyboard Shortcuts & Presentation Controls

| Key | Action |
| :--- | :--- |
| `→` / `Space` | Next slide |
| `←` | Previous slide |
| **`S`** | **Open Speaker View in separate window** (elapsed timer, current talking points, next slide preview) |
| **`N`** | **Toggle On-Screen Notes Drawer** (instant in-slide rehearsal notes) |
| `F` | Toggle Fullscreen mode |
| `O` or `ESC` | Slide Overview / thumbnail grid |
| `?` | Show Reveal.js keyboard help |

---

## Slide Structure Overview

1. **Title & Profile:** Beyond the Chat Window: Practical Agentic Engineering with AgenticAle
2. **The Problem:** Why Single-Context AI Coding Breaks Down (context rot, self-review bias, model mismatch, babysitting tax)
3. **Core Deep Dive:** Enter `/work` — Opinionated Subagent Orchestration & workflow pipeline
4. **Context Hygiene:** Fresh Context per Round & The Zero-Trust Independent Review Gate
5. **Model Routing:** Right Model for the Job — Declarative 4-tier routing (`fast`, `routine`, `standard`, `deep`)
6. **PR Delivery:** From Prompt to High-Confidence PR (`/work --pr`, `--consult`, `--outcome`)
7. **Supporting Skills:** Guardrails against model bad habits (`source-code-lookup` & `pull-request-description`)
8. **Ecosystem & Strategy:** When to use Copilot Fusion vs. AgenticAle `/work` & the "Glass Box" narration feature
9. **Governance:** Shared commodity workflow skills vs. local repo customization (`AGENTS.md`, `preferences.md`)
10. **The Frontier Experiment:** `/autonomous` mode — durable on-disk state, quota recovery & local models
11. **Wrap-Up & Q&A:** Decision matrix and closing discussion
