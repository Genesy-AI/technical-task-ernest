# TinyEnginy: codebase analysis and technical roadmap

**Type:** Epic / technical roadmap
**Status:** Proposed
**Scope:** `backend/` (Express, Prisma, Temporal) and `frontend/` (React, TanStack Query)

## Summary

TinyEnginy works, but it grew feature by feature with no architectural boundaries. Every backend route lives in one
407-line `src/index.ts` and mixes HTTP parsing, validation, business rules, Prisma calls and Temporal calls. The
frontend has the same problem inside components: `LeadsList.tsx` is 452 lines and holds data fetching, mutations,
selection state and table rendering together. The API contract is written twice by hand (backend routes and
frontend types), and the two copies have already drifted apart into real bugs.

This document lists what we found, why it matters, and a phased plan to fix it. Each phase ships on its own and keeps the
app working. No phase requires a rewrite.

## Current state: findings

Evidence references point at the code as of this analysis.

### Backend

| # | Finding | Evidence | Impact |
|---|---------|----------|--------|
| B1 | All routes, CORS and error handling in one file | `backend/src/index.ts`: 10 routes in 407 lines | Hard to read, review and test; every change touches the same file |
| B2 | Business logic coupled to Prisma and Express | `prisma.lead.*` called directly from route handlers (e.g. `index.ts:34`, `:128`, `:205`, `:274`) | Logic cannot be unit-tested without a DB; changing the ORM touches every route |
| B3 | Validation is hand-written and repeated per route | The same `if (!req.body \|\| typeof req.body !== 'object')` block appears in 5 routes; `POST /leads` and `PATCH /leads/:id` validate almost nothing | Inconsistent rules and error messages; invalid data can reach the DB |
| B4 | Lead field rules are scattered | Email, country code, years at company and URL rules live in different places on each side (`csvParser.ts`, `messageGenerator.ts`, `parseYearsAtCompany.ts`) | The same rule can differ between the CSV import and the API |
| B5 | Inconsistent API contract | `POST /leads` and `PATCH` read `name`, but the frontend sends `firstName`; the frontend sends `PUT`, but the backend only defines `PATCH`; the CORS middleware does not allow `PATCH` (`index.ts:17`); `DELETE /leads/:id` returns an empty body; `verify-emails` returns `success: true` while other bulk routes do not | Create and update from the UI are broken today; every client must special-case each route |
| B6 | No central error handling | Some routes have `try/catch`, others (`GET /leads/:id`, `DELETE /leads/:id`) do not, so a missing id becomes an unhandled 500 | Unpredictable status codes and error shapes |
| B7 | Long-running work inside the HTTP request | `POST /leads/verify-emails` opens a new Temporal `Connection` per request (`index.ts:282`) and runs workflows one after another inside the request | Timeouts with many leads; connection leaks. The phone-enrichment route already uses a shared client and fire-and-forget workflows, so this route should follow it |
| B8 | `any` in the request path | `index.ts:223` (`lead: any`) | Type safety ends where it matters most, at untrusted input |
| B9 | No pagination | `GET /leads` returns `prisma.lead.findMany()` | Response size and render time grow with every lead |
| B10 | No observability or traceability | Logging is 7 unstructured `console.*` calls, only in `catch` blocks (e.g. `index.ts:107`, `:322`); no request id; no metrics; email verification workflow ids include `Date.now()` (`index.ts:291`), so they cannot be found from a lead id; provider calls log nothing about which provider answered, how long it took or why it failed | When a user reports "my lead has no phone" or "import failed", there is no way to follow that request through HTTP → use case → Temporal → provider and find the cause |

### Frontend

| # | Finding | Evidence | Impact |
|---|---------|----------|--------|
| F1 | Components mix logic and rendering | `LeadsList.tsx` (452 lines, 11 state/query/mutation hooks), `CsvImportModal.tsx` (357), `MessageTemplateModal.tsx` (292) | Hard to test behavior without rendering the whole table; hard to restyle without breaking logic |
| F2 | Hand-written API types drift from the backend | `frontend/src/api/types/leads/*.ts`; `create`, `getOne` and `update` declare only a few fields | Bugs like B5 compile without errors |
| F3 | `any` in the API layer and helpers | `api/utils.ts:45-49`, `api/types/leads/bulkImport.ts:18`, `api/mutations/useApiMutation.ts:49`, `globalTypes.d.ts:2` (`$TSFixMeFunction`) | The typed API helper is only as safe as its weakest cast |
| F4 | The build is red | `useApiMutation.ts:64`: the optimistic lead is missing `emailVerified`, so `tsc -b` and `pnpm build` fail | Nothing can be deployed from `main` |
| F5 | Lint does not run | ESLint 9 with a legacy `.eslintrc.cjs`; it only runs with `ESLINT_USE_FLAT_CONFIG=false` | Conventions are not enforced; existing `no-explicit-any` errors go unnoticed |
| F6 | Inconsistent mutation patterns | `useApiMutation` (optimistic, typed) is used only for `leads.create`; everything else calls `useMutation` directly and invalidates by hand | Every new feature reinvents caching and error handling |

### Tests

| Area | What exists | Gap |
|------|-------------|-----|
| Backend | Unit tests for `messageGenerator`, `parseYearsAtCompany`, phone providers and the phone-enrichment workflow core | No tests for any HTTP route, the CSV import rules, email verification or DB behavior |
| Frontend | `csvParser`, `LeadsList`, `MessageTemplateModal` | No tests for `CsvImportModal` or the API layer; no end-to-end flow |
| Integration | None | Nothing checks that the frontend and backend agree on the contract (which is how B5 shipped) |

## Target architecture

### Backend: hexagonal (ports and adapters)

The rule: dependencies point inward. The domain knows nothing about Express, Prisma or Temporal.

```text
backend/src/
  domain/                      # pure TypeScript, no framework imports
    lead/
      Lead.ts                  # entity: identity + invariants (e.g. a lead needs a first name)
      LeadRepository.ts        # port (interface)
      errors.ts                # DuplicateLeadError, LeadNotFoundError, ...
    shared/
      Email.ts  Phone.ts  CountryCode.ts  Url.ts  YearsAtCompany.ts   # value objects
  application/                 # use cases: orchestrate domain + ports, one class/function per use case
    CreateLead.ts  UpdateLead.ts  DeleteLeads.ts  ImportLeads.ts
    GenerateMessages.ts  VerifyEmails.ts  EnrichPhones.ts
    ports/                     # EmailVerifier, PhoneEnrichmentScheduler, Clock, ...
  infrastructure/              # adapters
    persistence/PrismaLeadRepository.ts
    temporal/TemporalPhoneEnrichmentScheduler.ts  worker.ts  workflows/
    providers/                 # OrionConnect, AstraDialer, NimbusLookup (already adapter-shaped)
  interfaces/http/             # Express: routers, zod schemas, error middleware, DTO mappers
    leads.router.ts  leads.schemas.ts  errorHandler.ts
  main.ts                      # composition root: wires adapters into use cases
```

Why hexagonal and not just "split the file": the problems are coupling (B2, B7), not file size. Ports let us test
`ImportLeads` with an in-memory repository in milliseconds, swap SQLite for MySQL/Postgres (`.env.sample` already
points at MySQL), and move email verification to the same async pattern as phone enrichment without touching the
business rules.

Trade-off: more files and some indirection for a small app. We limit it by skipping a port when there is only one
implementation and no testing benefit, and by not adding a DI framework (a hand-written composition root is enough).

### Frontend: controller-view

```text
frontend/src/features/leads/
  list/
    useLeadsListController.ts   # queries, mutations, selection, polling, toasts
    LeadsListView.tsx           # props in, JSX out; no hooks except local UI state
    LeadsList.tsx               # glue: const ctrl = useLeadsListController(); return <LeadsListView {...ctrl} />
  csv-import/ ...  message-template/ ...
```

## Roadmap

Ordered by dependency and value. Each item is a deliverable with acceptance criteria.

### Phase 0: stabilize (unblocks everything else)

**0.1 Green build and enforced conventions** (item 7)
- Fix `useApiMutation.ts:64` (F4). Migrate ESLint to flat config (F5).
- Turn on `@typescript-eslint/no-explicit-any` as an error, and `noUncheckedIndexedAccess` in `tsconfig`. Replace the
  existing `any` uses (B8, F3) with `unknown` + narrowing or real types; delete `$TSFixMeFunction`.
- Add Prettier and lint checks to CI and a pre-commit hook on staged files only.
- Write down short conventions in `CONTRIBUTING.md`: naming, one use case per file, no framework imports in
  `domain/`, errors as typed classes, no `any` (use `unknown` at trust boundaries).
- **Done when:** `pnpm build`, `pnpm lint` and `tsc` pass in both projects in CI, with zero `any`.

**0.2 Standardize API routes and contracts** (item 5)
- REST resource naming: `GET/POST /leads`, `GET/PATCH/DELETE /leads/:id`. Bulk work and actions follow one
  documented convention, for example `POST /leads/bulk-import`, `POST /leads/bulk-delete`,
  `POST /leads/generate-messages`, `POST /leads/verify-emails`, `POST /leads/enrich-phones` (today `DELETE /leads`
  with a body and `POST /leads/bulk` break the pattern).
- One field vocabulary everywhere: `firstName`, never `name` (fixes B5).
- `PATCH` for partial updates, allowed in CORS (or replace the hand-written CORS with the `cors` package configured
  from env).
- One response envelope. Success: the resource or `{ data, meta }` for lists. Error:
  `{ error: { code, message, details? } }`. Bulk endpoints keep partial success: `{ data: { succeeded, failed: [{ id | index, code, message }] } }`.
- Correct status codes: 201 on create, 204 on delete, 404 on unknown id, 400/422 on validation, 202 for started
  async work (phone enrichment, email verification).
- Pagination on `GET /leads` (cursor or `page`/`pageSize`) (B9).
- **Done when:** an OpenAPI document describes every route, and create/update from the UI work.

**0.3 Centralize validation with zod** (item 6)
- One zod schema per request (`body`, `params`, `query`) in `interfaces/http/*.schemas.ts`, applied by a small
  `validate(schema)` middleware. Handlers receive typed, parsed input (`z.infer`), never raw `req.body`.
- One error middleware maps `ZodError` → 400 and domain errors → their status (B6), replacing the copy-pasted checks
  (B3).
- Contract sharing: generate the OpenAPI document from the zod schemas (`zod-to-openapi`) and generate frontend types
  from it (`openapi-typescript`). This fixes F2 without a pnpm workspace. Alternative: a shared `contracts/` package
  imported by both projects; simpler at runtime, but it needs a workspace root, which the repo does not have today.
- **Done when:** no handler reads `req.body` directly, and the frontend types are generated, not hand-written.

### Phase 1: backend architecture (items 1-4)

Done incrementally, one route at a time (strangler pattern): the new router mounts next to the old handlers, and
each migrated route is deleted from `index.ts`.

**1.1 Domain entities and value objects** (item 2)
- `Lead` entity with identity and invariants. Value objects with private constructors and a
  `create(raw): Result<T, ValidationError>` factory: `Email`, `Phone` (E.164 normalization, which also gives the
  phone providers one format), `CountryCode` (ISO 3166-1 alpha-2), `Url`/`LinkedinUrl`, `YearsAtCompany`.
- The CSV import, the API schemas and the message generator all use these value objects, so a rule exists once (B4).
- Zod handles shape at the edge ("is this a string"); value objects handle meaning ("is this a valid phone").
- **Done when:** the field rules have unit tests and no rule is duplicated between import and API.

**1.2 Repository pattern** (item 4)
- `LeadRepository` port: `findById`, `findMany(filter, page)`, `findByEmails`, `save`, `saveMany`, `deleteMany`,
  `updateEnrichmentStatus`. A `PrismaLeadRepository` adapter maps Prisma rows ↔ `Lead` entities, so Prisma types never
  leave `infrastructure/`.
- An `InMemoryLeadRepository` for use-case tests.
- **Done when:** no file outside `infrastructure/persistence` imports `@prisma/client`.

**1.3 Application use cases** (item 3)
- `CreateLead`, `UpdateLead`, `GetLead`, `ListLeads`, `DeleteLeads`, `ImportLeads` (duplicate detection, per-row
  errors), `GenerateMessages`, `VerifyEmails`, `EnrichPhones`.
- Each one takes its ports through its constructor and returns a typed result; routers only parse input, call the use
  case and map the result to HTTP.
- `VerifyEmails` moves to the async model already used by `EnrichPhones`: start one workflow per lead with a stable
  workflow id, return 202, and let the UI poll a status field. This fixes B7.
- **Done when:** `index.ts` is gone, replaced by `main.ts` (composition) and routers.

**1.4 Architecture guardrails** (item 1)
- Enforce the dependency rule with `eslint-plugin-boundaries` or `dependency-cruiser` in CI (`domain` imports
  nothing, `application` imports only `domain`).
- One short ADR recording the hexagonal decision and its trade-offs.

### Phase 2: tests (item 8)

Built up alongside phases 0-1, not after them.

| Level | Backend | Frontend |
|-------|---------|----------|
| Unit | Value objects, entities, each use case with in-memory adapters | Controllers (`renderHook`), `csvParser`, formatters |
| Integration | Routers via `supertest` against a throwaway SQLite DB (contract, status codes, error shape); `PrismaLeadRepository` against the real DB; workflows with `@temporalio/testing` (time-skipping) | Views with React Testing Library + MSW mocking the API from the generated types |
| End-to-end | — | One Playwright smoke test per critical flow: CSV import → table, generate messages, verify emails, enrich phone |

- Contract test: the generated OpenAPI document is checked in CI; a change that breaks the frontend types fails the
  build.
- Coverage is a signal, not a target: require tests for every use case and every route, not a percentage.
- **Done when:** every route has an integration test and CI runs both suites on each PR.

### Phase 3: frontend responsibilities (item 9)

- Split `LeadsList`, `CsvImportModal` and `MessageTemplateModal` into controller hook + view, as shown above.
  Controllers own queries, mutations, polling and toasts; views get plain props and are trivial to test and restyle.
- Move to a feature-folder layout (`features/leads/...`), keep `components/` for shared UI (`FieldPicker`,
  `PhoneCell`).
- One mutation helper for every endpoint (extend `useApiMutation`), with consistent invalidation and error toasts
  (F6). Query keys from one factory (`leadsKeys.list(params)`).
- **Done when:** no view file calls `useQuery`/`useMutation`, and every controller has tests.

### Phase 4: observability and traceability

Goal: given a lead id, a request id or a user complaint, an engineer can find what happened, where and why, in
minutes and without adding `console.log` and redeploying. Fixes B10.

**4.1 Structured logging**
- Replace `console.*` with a structured logger (`pino`, JSON in production, pretty in development) behind a small
  `Logger` port, so the domain and use cases log without depending on the library.
- Standard fields on every line: `level`, `timestamp`, `service`, `env`, `requestId`, `traceId`, and business context
  when known (`leadId`, `useCase`, `workflowId`, `provider`).
- Log levels with a meaning: `error` = needs action, `warn` = degraded but handled (e.g. provider timeout before
  retry), `info` = business events (lead imported, enrichment started/finished), `debug` = off in production.
- Never log personal data in clear (emails, phones, names) or provider API keys: a redaction list in the logger config,
  with ids instead of values.

**4.2 Request and workflow traceability**
- HTTP middleware that reads or creates an `x-request-id`, stores it in `AsyncLocalStorage` so every log line of the
  request carries it, and returns it in the response header and in the error body (`{ error: { code, message,
  requestId } }`). The frontend shows it in error toasts, so a user report comes with the id to search for.
- OpenTelemetry tracing across the whole path: Express → use case → Prisma → Temporal client → workflow → activity →
  provider HTTP call. Temporal has an OpenTelemetry interceptor (`@temporalio/interceptors-opentelemetry`) that carries
  the trace context from the client into workflows and activities.
- Deterministic, searchable workflow ids (`verify-email-<leadId>`, `enrich-phone-<leadId>`, as phone enrichment already
  does) plus Temporal search attributes (`leadId`), so the Temporal UI answers "what happened to lead 42".
- Store the outcome per lead where the user can see it: which provider answered, when, and the last error code
  (phone enrichment already stores status and provider; email verification should do the same).

**4.3 Metrics and alerts**
- RED metrics per route (rate, errors, duration) and per provider (calls, success rate, latency, "no data" rate),
  exposed through OpenTelemetry to the metrics backend we choose (Prometheus/Grafana or Datadog).
- Temporal metrics: workflow failures, activity retries, task queue backlog.
- A few alerts tied to user impact, not noise: route error rate above a threshold, a provider failing most calls (a
  key expired or the API changed), the workflow backlog growing.

**4.4 Health and frontend errors**
- `GET /health` (process up) and `GET /ready` (DB and Temporal reachable) for deploys and load balancers.
- Frontend: a React error boundary and an error tracker (e.g. Sentry) that attaches the `requestId` of the failed API
  call, so a frontend error links to the backend trace.

- **Done when:** for a test lead, one search by `leadId` or `requestId` shows its HTTP request, its workflow, every
  provider attempt with duration and outcome, and any error, and no log line contains an email, phone or API key.

## Suggested sequencing

| Order | Work | Why at this point |
|-------|------|-------------------|
| 1 | 0.1 green build, lint, no `any` | Cheap; every later PR is checked automatically |
| 2 | 0.2 + 0.3 contracts and zod | Fixes user-visible bugs (create/update) and gives the new architecture its edge layer |
| 3 | 1.1 → 1.2 → 1.3, route by route, with 2 (tests) in each PR | Each migrated route arrives with its tests; the app keeps working throughout |
| 4 | 1.4 guardrails | Locks the structure in once it exists |
| 5 | 3 frontend controller-view | Can run in parallel with phase 1 by a second person; builds on the generated types from 0.3 |
| — | 4.1 logger + 4.2 request id | Start together with phase 0: cheap, and they make every later migration easier to debug. The error middleware from 0.3 is where the `requestId` goes into error responses |
| — | 4.2 tracing, 4.3 metrics, 4.4 | After phase 1, when use cases and adapters exist as clear places to add spans and metrics |

## Risks and trade-offs

- **Over-engineering:** hexagonal plus value objects is a lot of ceremony for one entity. We accept it because the
  product is about to add more entities (campaigns, enrichment providers, messages) and integrations; we keep ports only
  where there is a second implementation or a testing need.
- **Migration drift:** a half-migrated backend has two styles. The strangler approach and a tracked checklist of
  routes keep the window short.
- **Contract change for clients:** renaming routes and fields breaks any client other than our frontend. Today there is
  none; if that changes, version the API (`/v1`) before phase 0.2.
- **Generated types vs shared package:** generation adds a build step; a shared package needs a workspace. Generation
  is chosen because it also produces API documentation.

## Out of scope (follow-ups)

- Authentication and authorization (there is none today), rate limiting, and secrets management for the provider keys.
- Moving from SQLite to a server database for production, with migrations run in CI.
