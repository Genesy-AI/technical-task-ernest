---
name: temporal-workflow
description: House rules and checklist for Temporal workflows and activities in this repo. Use before adding or changing anything under backend/src/workflows or backend/src/worker.ts, or any code that starts, waits for or queries a workflow.
---

# Temporal workflows and activities

## Where things live

- Workflows are in `backend/src/workflows/`, exported from `index.ts`. The worker bundles this folder through `workflowsPath`.
- Activities are in `backend/src/workflows/activities/`, exported from `index.ts` and registered in `backend/src/worker.ts`.
- Server `localhost:7233`, namespace `default`, task queue `myQueue`. Web UI at http://localhost:8233.
- The worker runs inside the API process. If Temporal is down, the API exits at boot.
- The SDK is version 1.13.0. Check option names in `backend/node_modules/@temporalio/*/lib/*.d.ts`. Do not trust memory for them.
- pnpm only lets code import direct dependencies. `@temporalio/activity`, `@temporalio/common` and `@temporalio/testing` are not installed. Ask before adding one.

## Rules

1. Workflow code only orchestrates. No network, database or file access, and no Node or Prisma imports. Import activities as types only (`import type`).
2. Every side effect is an activity.
3. Every `proxyActivities` call sets `startToCloseTimeout` and a `retry` policy with `maximumAttempts`. The default policy retries forever.
4. Timeouts come from the measured latency of what is being called. Say where the number came from.
5. Every workflow start sets `workflowExecutionTimeout` as a backstop.
6. Activities separate transient failures (network, timeout, 5xx, 429), which may be retried, from permanent ones (authentication, validation, unreadable response), which must not be. Mark a permanent failure as non-retryable, either with a non-retryable `ApplicationFailure` or with a named error listed in the policy's `nonRetryableErrorTypes`.
7. An activity that calls HTTP sets its own request timeout a little below the activity timeout.
8. Workflow IDs are deterministic and built from the business key, for example `<purpose>-lead-<id>`. No timestamps or random values in a workflow ID.
9. One Temporal client per process. No connection per request.
10. Activity inputs and results are stored in workflow history. Keep them small and JSON-serialisable.
11. A workflow that is closed by a timeout or terminated runs no more code. Any status stored outside Temporal needs another way to reach an end state.
12. A result is written with a condition on what it was computed from. The lead can change while the workflow runs.

## Before saying it is done

- [ ] Every activity call has a timeout and bounded retries.
- [ ] The workflow start has an execution timeout.
- [ ] The workflow ID is deterministic.
- [ ] A slow or failing dependency ends in a reported outcome, not a hang.
- [ ] Anything stored outside Temporal still reaches an end state when the workflow times out or is terminated.
- [ ] A test covers the failure path.
- [ ] Seen in the Web UI or with the CLI that the run completed and nothing is left Running.

## Inspecting a run

- `temporal workflow list`
- `temporal workflow describe --workflow-id <id>`
- `temporal workflow show --workflow-id <id>`

## Testing

- Keep decision logic in plain functions and unit-test them with Vitest.
- Test the wiring (timeouts, retries, final writes) with the time-skipping environment from `@temporalio/testing` and mocked activities.

## Decisions

Add one line here each time a rule is agreed during the work, with its reason.

- (none yet)
