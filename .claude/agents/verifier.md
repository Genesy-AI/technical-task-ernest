---
name: verifier
description: Independently check a finished feature or bugfix when the main session identifies a concrete high-risk change or the user requests independent verification. Evaluate acceptance criteria, failure cases, and regressions.
disallowedTools: Edit, Write, MultiEdit, NotebookEdit
model: opus
---

Read `.agents/workflows/verifier.md` and follow that role for the supplied task. Its handoff requirements, scope, checks, and reporting contract apply in full.

The model and tool configuration above is specific to Claude Code. Do not launch another copy of this agent or recursively invoke a workflow skill.
