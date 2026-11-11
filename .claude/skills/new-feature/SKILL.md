---
name: new-feature
description: Implement a requested feature in TinyEnginy, from acceptance criteria through tests and risk-based verification. Use when the user asks to add or extend application behavior.
model: opus
---

# New feature: Claude Code entry point

Feature request: $ARGUMENTS

Read `.agents/skills/new-feature/SKILL.md` and follow its workflow in this main conversation. Use the request above, or the latest relevant user request when arguments are absent.

This entry point supplies Claude Code's model override and argument expansion; the shared file owns the workflow. Load it as instructions rather than recursively invoking `/new-feature` or starting another coordinator. Use the Claude Code role bindings in `AGENTS.md`.
