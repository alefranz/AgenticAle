---
name: pull-request-description
description: Draft or revise a pull request body that explains the change's purpose, reviewer-relevant context, risks, and non-obvious validation. Use for PR text, not Git hosting operations.
---

# Pull Request Description

Write a concise PR narrative for reviewers and future maintainers, grounded in the available issue, backlog, instructions, commits, code, and deployment context. Distinguish established facts from inferences; never invent a goal, risk, or validation result.

Lead with a short summary of the behavior or outcome. Focus the rest on why the change is needed, the goal it advances, and context the diff does not show:

- Reviewer-relevant operational notes: rollout or deployment concerns, compatibility or migration effects, feature flags, monitoring, dependencies, or practical gotchas.
- Unresolved problems, known limitations, and follow-up work, stated plainly when they exist.

Skip file-by-file or line-by-line diff narration; reviewers can read the diff. Keep the description proportionate to the change and omit empty sections.

Validation is selective: omit ordinary automated test commands, pass counts, and generic "tests pass" claims. Include validation only when a manual check, special setup, unusual fixture, or environment-specific observation helps reviewers judge confidence or remaining uncertainty.

This skill defines PR text only — it does not authorize creating a branch, committing, pushing, opening a PR, or using a Git-hosting service.
