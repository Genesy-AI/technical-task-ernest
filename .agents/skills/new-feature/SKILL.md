---
name: new-feature
description: Implement a requested feature in TinyEnginy, from acceptance criteria through tests and risk-based verification. Use when the user asks to add or extend application behavior.
---

# New feature

Use the feature request supplied with the skill invocation, or the latest feature request in the conversation. If there is no concrete request, ask what the user wants to build. A planning-only request stays read-only; invoking this skill does not authorize implementation beyond the user's request.

You coordinate this workflow in the main conversation. All paths below are relative to the repository root. Keep product decisions and communication with the user here. Follow the routing criteria in `AGENTS.md`; implementation delegation and independent verification are separate decisions.

## Establish the scope

1. Read `AGENTS.md` (including Git safety) and the relevant challenge requirements in `README.md`.
2. Inspect Git status and record the starting commit and existing local changes. For authorized implementation, create a feature branch if currently on main or master; otherwise retain the existing feature branch. Preserve work already present.
3. State observable acceptance criteria from the request. Resolve missing product decisions that affect the implementation; use existing conventions for routine technical choices. Do not require another approval when the request is already clear and authorized.
4. Gather enough context to identify the affected flow, edit surfaces, and concrete risks. For a lead attribute, consider database storage, server validation, API types, CSV parsing **and the import request mapping**, optimistic state, display, and templates where applicable. Leave detailed implementation reading to whoever will implement.
5. Identify applicable skills by path: `.agents/skills/temporal-workflow/SKILL.md` for Temporal work; `.agents/skills/frontend-design/SKILL.md` and `.agents/skills/vercel-react-best-practices/SKILL.md` when relevant to frontend changes. Read them for inline work or pass their exact paths to the implementer.

## Implement inline or hand off

For inline work, establish the scope and checks below in the main session, then follow the `Implement and check` discipline in `.agents/workflows/implementer.md` without launching it. Otherwise delegate the implementer role through the current runtime, as described in `AGENTS.md`, passing `.agents/workflows/implementer.md` and a compact, factual handoff. Supply:

- The original request and observable acceptance criteria.
- Repository/checkout, branch, starting commit, and pre-existing local changes.
- Relevant findings, entry points, existing helpers and invariants, and exact skill paths.
- `Allowed edit surfaces`: exact repository-relative files or narrow globs, including authorized new-file directories. Derive these from the task; do not ask the worker to invent its own scope.
- Exact verification commands and any baseline failures already observed. Use focused tests plus `pnpm exec tsc --noEmit -p .` and `pnpm exec vitest run` in `backend/`, or `pnpm exec tsc -b` and `pnpm exec vitest run` in `frontend/`, for affected application packages. For tooling or documentation, supply the checks relevant to those files instead.

The executor owns code, regression tests, documentation, formatting, and self-checks. For delegated work, wait for the implementer's result before verification or another writer on the same files. Resolve scope or product questions in the main session. Run the affected package checks once after final formatting; rerun only checks affected by subsequent changes or unresolved failures.

## Verify

1. Inspect the final diff against the allowed surfaces and acceptance criteria. For delegated work, check self-verification evidence and rerun one focused reported check; for inline work, use the checks already observed. Distinguish new failures from baseline failures; a successful automatic hook exit is not proof that every check passed.
2. Reassess the actual diff using the independent-verification criteria in `AGENTS.md`. If none applies, complete the acceptance checks in the main session and deliver without launching a verifier. Runtime criteria still need appropriate evidence; follow `.agents/skills/verify-app/SKILL.md` when applicable. Missing proof remains unverified.
3. When independent verification is required and self-checks are complete, start an independent verifier through the current runtime, as described in `AGENTS.md`, passing `.agents/workflows/verifier.md` as its role instructions. Supply the concrete risk or explicit user request, original criteria, checkout, starting commit, pre-existing changes, actual changed paths, and commands/results tied to the candidate checked. Ask for targeted acceptance, failure-case, and shared-behavior probes, not an automatic repeat of every package check. Wait for its report; its verdict must come from the code and independent evidence, not the executor's completion claim.
4. Send confirmed in-scope findings to the original executor in one correction batch, then recheck those findings through the verifier if one was required, or inline otherwise. Report unresolved blockers after that bounded recheck instead of starting repeated full audits. Product scope changes remain the user's decision.
5. If an agent, tool, service, or required authorization is unavailable, report exactly what remains blocked or unverified. Do not silently replace a missing independent check with a claim of completion.

## Deliver

Report what changed, the outcome for each acceptance criterion, checks and evidence, and any unresolved limitations. Do not mark an unmet criterion complete. Commit, push, PR creation, and merge require an explicit user request for the corresponding action.
