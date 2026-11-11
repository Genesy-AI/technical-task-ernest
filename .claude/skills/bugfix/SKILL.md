---
name: bugfix
description: Reproduce and fix a reported defect in TinyEnginy, add regression coverage, and verify according to risk. Use for incorrect existing behavior, errors, or regressions.
model: opus
---

# Bugfix: Claude Code entry point

Bug report: $ARGUMENTS

Read `.agents/skills/bugfix/SKILL.md` and follow its workflow in this main conversation. Use the request above, or the latest relevant user request when arguments are absent.

This entry point supplies Claude Code's model override and argument expansion; the shared file owns the workflow. Load it as instructions rather than recursively invoking `/bugfix` or starting another coordinator. Use the Claude Code role bindings in `AGENTS.md`.
