# Phone enrichment (Temporal)

Objective: find a lead's phone number through three providers in sequence with a Temporal workflow, and show progress in the leads table.
Branch: `feat/phone-enrichment`. Delivery: `ask-on-risk`. Test runner: `pnpm vitest run` (backend and frontend).

## Specs

- S1 (README, verbatim): "Implement a Temporal workflow that finds a lead's phone number by querying three providers in sequence: Call Provider One → if no phone found, Call Provider Two → if no phone found, Call Provider Three → if no phone found, mark as No data found."
- S2 (verbatim): "Each provider call is an activity with: Short timeout; Retry policy (e.g. 3 attempts, exponential backoff)"
- S3 (verbatim): "Stop early when a phone is found."
- S4 (verbatim): "Idempotent workflow (only one per lead)."
- S5 (verbatim): "Abstraction layer to handle different provider inputs." User (L2): "it fine for me to have one adapter per provider".
- S6 (verbatim): "Show process feedback to the user"
- S7 (verbatim): "Update frontend accordingly"
- S8 Provider APIs (README, verbatim):
  - Orion Connect: Base URL `https://api.enginy.ai/api/tmp/orionConnect`; Request `{ "fullName": "Ada Lovelace", "companyWebsite": "example.com" }`; Authentication: Request header 'x-auth-me' with key 'mySecretKey123'; Response: `POST { "phone": string | null }`
  - Astra Dialer: Base URL `https://api.enginy.ai/api/tmp/astraDialer`; Request `POST { "email": "john.doe@example.com" }`; Authentication: Request header 'apiKey' with key '1234jhgf'; Response `{ "phoneNmbr": string | null | undefined }`
  - Nimbus Lookup: Base URL `https://api.enginy.ai/api/tmp/numbusLookup`; Request `POST { "email": "john.doe@example.com", jobTitle: "CTO" }`; Authentication: Get parameter 'api' with key '000099998888'; Response `{ "number": number, "countryCode": "string" }`
- Assumptions (defaults from the plan, user said "go ahead" without choosing):
  - A1 Order: Orion Connect → Astra Dialer → Nimbus Lookup (README order).
  - A2 Orion `companyWebsite` comes from the email domain; free-mail domains (gmail, yahoo, hotmail…) make Orion skip the lead.
  - A3 Leads that already have a phone number are skipped.
  - A4 A finished lead can be enriched again; only one run at a time per lead.
  - A5 No real provider calls and no `@temporalio/testing` dependency without explicit approval; workflow logic lives in a plain function tested with Vitest.
  - A6 `FAILED` (some provider errored, none found a phone) is reported separately from `NOT_FOUND` ("No data found").

## Tasks

- [x] T1 [S1,S6] Prisma migration `add_phone_enrichment_status`: `phoneEnrichmentStatus`, `phoneEnrichmentProvider` on `lead`. Route: inline. Evidence: migration applied, client regenerated, typecheck ok.
- [x] T2 [S5,S8,S2] Provider adapters + registry + tests (`backend/src/providers/`). Route: inline. RED: module missing; GREEN: 12 tests.
- [x] T3 [S1-S4] Activities, workflow (plain-function core) + tests. Route: inline. RED: module missing; GREEN: 6 tests; Temporal bundler ok.
- [x] T4 [S4,S6] `POST /leads/enrich-phones` + shared Temporal client + `.env` keys. Route: inline. Evidence: local Temporal run with fake activities (see L4).
- [x] T5 [S6,S7] Frontend: types, endpoint, Enrich Phone action, `PhoneCell` states, polling every 2s while IN_PROGRESS, start/finish toasts, tests. Route: inline. RED: 4 failing; GREEN: 7 LeadsList tests.

Route evidence: one parent session, units depend on one shared contract; no Writer trigger reason (no parallel launch, no context backstop).

## Log

- L1 (2026-11-13, user, verbatim): "I want to implement this feature \"Implement a Temporal workflow that finds a lead's phone number by querying three providers in sequence: Call Provider One → if no phone found, Call Provider Two → if no phone found, Call Provider Three → if no phone found, mark as No data found. Requirements Each provider call is an activity with: Short timeout Retry policy (e.g. 3 attempts, exponential backoff) Stop early when a phone is found. Idempotent workflow (only one per lead). Abstraction layer to handle different provider inputs. Show process feedback to the user Update frontend accordingly\". Generate a plan for me"
- L2 (2026-11-13, user, verbatim): "Regarding the provider, it fine for me to have one adapter per provider, go ahead"
- L3 Commits: the working tree already holds uncommitted user work in the same files (`backend/src/index.ts`, `schema.prisma`, `LeadsList.tsx`, `getMany.ts`). Work-unit commits would sweep that work in, so commits are deferred to the user.
- L4 (2026-11-13) Local Temporal check, own worker and task queue, fake activities (no provider calls, no DB): Orion retryable error tried 3 times (1s, 2s backoff), Astra ProviderClientError tried once, Nimbus found and the workflow stopped; duplicate start refused (WorkflowExecutionAlreadyStartedError); re-run after finish allowed. Backend suite 46 passed.
- L5 Not verified: real provider responses (no authorization to call api.enginy.ai); Nimbus `countryCode` format is a guess (numeric prefixed with +, other values dropped).
- L6 (2026-11-13) Closing checks: backend 46 tests pass, typecheck ok; frontend LeadsList 7 tests pass, typecheck only the pre-existing `emailVerified` error, ESLint clean on touched files. Frontend `csvParser` has 2 failing tests caused by the user's separate edit (missing `case 'yearsatcompany'`), outside this feature.
- L7 Pending for the user: restart the API (dev script is plain ts-node, no reload) so the new worker code and route load; approve or run a real-provider check; commit (deferred, see L3).
