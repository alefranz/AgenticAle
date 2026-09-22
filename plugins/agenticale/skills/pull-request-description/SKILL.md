---
name: pull-request-description
description: Draft or revise a pull request body that explains the change's purpose, reviewer-relevant context, risks, and non-obvious validation. Use for PR text, not Git hosting operations.
---

# Pull Request Description

Write a concise PR narrative for reviewers and future maintainers. Ground it
in the available issue, backlog, instructions, commits, code, and deployment
context. Distinguish established facts from inferences; do not invent a goal,
risk, or validation result.

Lead with a short summary of the behavior or outcome. Focus the remaining body
on why the change is needed, the goal it advances, and context a code diff will
not make clear. Include only reviewer-relevant operational notes: rollout or
deployment concerns, compatibility or migration effects, feature flags,
monitoring, dependencies, or practical gotchas. Call out unresolved problems,
known limitations, and follow-up work plainly when they exist.

Do not narrate routine implementation details or restate each changed file or
line; reviewers can read the diff. Keep the description proportionate to the
change and omit empty sections.

Validation is selective. Do not list ordinary automated test commands, broad
pass counts, or generic "tests pass" claims. Mention validation only when a
manual check, special setup, unusual fixture, environment-specific observation,
or other non-obvious evidence helps a reviewer understand confidence or
remaining uncertainty.

This skill defines PR content only. It does not authorize creating a branch,
committing, pushing, opening a pull request, or using a Git-hosting service.
