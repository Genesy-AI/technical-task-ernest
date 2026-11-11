---
name: bugfix
description: Reproduce and fix a reported defect in TinyEnginy, add regression coverage, and verify according to risk. Use for incorrect existing behavior, errors, or regressions.
---

# Bugfix

Use the bug report supplied with the skill invocation, or the latest bug report in the conversation. If there is no concrete report, ask for the failing behavior and expected result. An investigation-only request stays read-only; invoking this skill does not authorize a fix beyond the user's request.

You coordinate this workflow in the main conversation. All paths below are relative to the repository root. Keep product decisions and communication with the user here. Follow the routing criteria in `AGENTS.md`; implementation delegation and independent verification are separate decisions.

## Reproduce and diagnose

1. Read `AGENTS.md` (including Git safety) and the relevant requirements in `README.md`. Inspect Git status and record the starting commit and existing local changes. For authorized implementation, create a feature branch if currently on main or master; otherwise retain the existing feature branch.
2. Reproduce the reported failure using the supplied input and public interface where practical. Capture expected versus actual behavior, including the relevant response, UI state, or stored data. Use disposable state for probes that mutate data.
3. If reproduction is blocked, inspect the available evidence and identify the smallest missing input or environment requirement. Do not declare the bug fixed because a different input succeeds.
4. Identify the failing path, likely edit surfaces, and concrete risks from the available evidence. Use the known mismatches in `AGENTS.md` as leads, not proof of the cause. Leave detailed implementation reading to whoever will implement and label unproven hypotheses in a delegated handoff.
5. For Temporal-related defects, inspect the task's execution history when available and use `.agents/skills/temporal-workflow/SKILL.md`. Distinguish an unusable or timed-out response from a documented negative result. Use `.agents/skills/frontend-design/SKILL.md` and `.agents/skills/vercel-react-best-practices/SKILL.md` when relevant to frontend work. Read these skills for inline work or pass their exact paths to the implementer.

## Fix inline or hand off

For inline work, establish the scope and checks below in the main session, then follow the `Implement and check` discipline in `.agents/workflows/implementer.md` without launching it. Otherwise delegate the implementer role through the current runtime, as described in `AGENTS.md`, passing `.agents/workflows/implementer.md` and a compact, factual handoff. Supply:

- The original report, exact reproduction input/steps, expected result, and observed failure or reproduction blocker.
- Repository/checkout, branch, starting commit, and pre-existing local changes.
- Relevant findings and hypotheses, entry points, shared helpers and invariants, and exact skill paths.
- `Allowed edit surfaces`: exact repository-relative files or narrow globs, including authorized new-file directories. Derive the scope before launching the writer.
- Exact reproduction and verification commands, plus baseline failures already observed. Use focused tests plus `pnpm exec tsc --noEmit -p .` and `pnpm exec vitest run` in `backend/`, or `pnpm exec tsc -b` and `pnpm exec vitest run` in `frontend/`, for affected application packages. Use relevant checks for tooling or documentation instead.

The executor confirms the cause, adds and runs the regression test, implements the correction and documentation, and runs its own checks. For delegated work, wait for the implementer's result before verification or another writer on the same files. Resolve missing context, scope, and product decisions in the main session. Run the affected package checks once after final formatting; rerun only checks affected by subsequent changes or unresolved failures.

## Verify the correction

1. Inspect the diff against the allowed surfaces and reported cause. For delegated work, check self-verification evidence and rerun the original reproduction or a focused regression test; for inline work, use the checks already observed. Label pre-existing failures separately; a bypassed hook does not make failed checks pass.
2. Reassess the actual diff using the independent-verification criteria in `AGENTS.md`. If none applies, confirm the original reproduction and relevant valid behavior in the main session, then deliver without launching a verifier. Runtime criteria still need appropriate evidence; follow `.agents/skills/verify-app/SKILL.md` when applicable. Missing proof remains unverified.
3. When independent verification is required and self-checks are complete, start an independent verifier through the current runtime, as described in `AGENTS.md`, passing `.agents/workflows/verifier.md` as its role instructions. Supply the concrete risk or explicit user request, original report, reproduction steps, expected result, checkout, starting commit, pre-existing changes, actual changed paths, and commands/results tied to the candidate checked. Ask for targeted acceptance, failure-case, and shared-behavior probes, not an automatic repeat of every package check. Wait for its independent report, with probes scoped to this task and existing service/data authorization.
4. Send confirmed in-scope findings to the original executor in one correction batch, then recheck those findings through the verifier if one was required, or inline otherwise. Report unresolved blockers after that bounded recheck; do not start repeated full audits or expand into unrelated defects.
5. If an agent, tool, service, or required authorization is unavailable, state the exact missing proof and leave the corresponding result unverified.

## Deliver

Explain the supported cause, the correction, and the evidence that the original reproduction now succeeds. List remaining failures or limitations. Commit, push, PR creation, and merge require an explicit user request for the corresponding action.
