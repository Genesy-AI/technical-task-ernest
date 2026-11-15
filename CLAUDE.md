# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

TinyEnginy, a take-home exercise: a small leads manager (CSV import, message templates, email verification through Temporal). `README.md` holds the task list (bugs, new lead fields, a phone-enrichment Temporal workflow, a PR review, `IMPROVEMENTS.md`) and the third-party provider API specs (URLs, auth headers, request and response shapes). Read it before working on any of those tasks.

`backend/` and `frontend/` are two separate pnpm projects with no workspace root. Run every command from inside one of them. Node version: `v22` (`.nvmrc`).

## Commands

Backend (`cd backend`):

```zsh
temporal server start-dev     # must be running first; the API process exits if it can't reach localhost:7233
pnpm dev                      # nodemon + ts-node on src/index.ts, port 4000 (also starts the Temporal worker)
pnpm migrate:dev              # after editing prisma/schema.prisma: creates a migration and regenerates the client
pnpm gen:prisma               # regenerate the Prisma client only
pnpm vitest run               # all tests once (`pnpm test` is watch mode in a TTY)
pnpm vitest run src/utils/messageGenerator.test.ts -t "test name"   # a single file / test
pnpm exec tsc --noEmit -p .   # typecheck
```

Frontend (`cd frontend`):

```zsh
pnpm dev                      # Vite dev server; API base URL comes from frontend/.env (VITE_API_URL=http://localhost:4000)
pnpm vitest run               # jsdom + @testing-library/jest-dom
pnpm vitest run src/utils/csvParser.test.ts -t "test name"
pnpm exec tsc -b --noEmit     # typecheck (`pnpm build` runs `tsc -b` first)
ESLINT_USE_FLAT_CONFIG=false pnpm lint
```

Baseline state of `main` (so you don't mistake it for a regression you caused):
- `pnpm lint` fails outright under ESLint 9 because the config is the legacy `.eslintrc.cjs`. With `ESLINT_USE_FLAT_CONFIG=false` it runs and reports existing errors (mostly `no-explicit-any`).
- The frontend typecheck, and so `pnpm build`, fails: the optimistic lead in `src/api/mutations/useApiMutation.ts` is missing `emailVerified`.
- Both test suites pass.

Prettier settings are the same in both projects: no semicolons, single quotes, `printWidth: 110`, `trailingComma: es5`. `pnpm format` rewrites the whole project, so prefer formatting only the files you touched.

## Backend architecture

- **One Express file.** Every route lives in `src/index.ts`: CRUD on `/leads`, plus `POST /leads/bulk` (CSV import), `POST /leads/generate-messages` and `POST /leads/verify-emails`. CORS is a hand-written middleware in the same file. Bulk endpoints return HTTP 200 with per-lead `errors` arrays instead of failing the whole request. `POST /leads` and `PATCH /leads/:id` read `name` from the body, not `firstName`.
- **Same-process Temporal worker.** `src/index.ts` calls `runTemporalWorker()` (`src/worker.ts`) after `app.listen`. The worker uses namespace `default` and task queue `myQueue`, loads workflows from `src/workflows/index.ts`, and registers every export of `src/workflows/activities/index.ts` as an activity. To add an activity, export it from that barrel. Workflow files run in Temporal's deterministic sandbox: import activities only as types through `proxyActivities`, and keep I/O, Prisma and `Date.now()`-style code in activities.
- **Email verification flow.** `/leads/verify-emails` opens a new Temporal `Connection` on every request, then for each lead runs `client.workflow.execute(verifyEmailWorkflow)` one after another inside the HTTP request, and writes `emailVerified` from the result. The activity (`activities/utils.ts`) is a stub whose behavior depends on the email string.
- **Database.** Prisma with SQLite. The DB file `prisma/dev.db` is committed, and the URL is hard-coded in `schema.prisma` as `file:./dev.db`. `.env.sample` (a MySQL URL) is not used. The only model is `lead`.
- **Message templates.** `src/utils/messageGenerator.ts` replaces `{fieldName}` placeholders using its own `availableFields` map. It throws on an unknown field and on an empty value; the route catches the error per lead.

## Frontend architecture

- **Stack.** Vite, React 18, TanStack Query v5, Tailwind v4 (through `@tailwindcss/vite`, no PostCSS config), react-hot-toast (styled in `src/Providers.tsx`). `@` resolves to `src/` in the vitest config only.
- **API layer.** `src/api/modules/leads.ts` declares each endpoint as `endpoint<Output, Input>(method, pathOrBuilder)` (`src/api/utils.ts`). GET sends its input as query params; other methods send it as the JSON body. Request and response types are written by hand in `src/api/types/leads/*.ts` and are not shared with the backend, so keep them in sync yourself.
- **Data fetching.** `LeadsList` loads leads with `useQuery({ queryKey: ['leads', 'getMany'] })`. Components mostly call `useMutation` with `api.leads.*` directly and invalidate `['leads', 'getMany']` when they finish. The typed `useApiMutation` helper (`src/api/mutations/useApiMutation.ts`) is only wired for `leads.create`, with an optimistic update.
- **Known mismatches.** `api.leads.update` sends `PUT /leads/:id`, but the backend only defines `PATCH`, and the CORS middleware does not allow `PATCH`. `api.leads.create` and `update` send `firstName`, but those backend routes read `name`.
- **CSV import.** `src/utils/csvParser.ts` (PapaParse) lowercases headers and strips non-letters before a `switch`, so `country_code` and `Country Code` both map to `countrycode`. `src/components/CsvImportModal.tsx` reads the file with `FileReader.readAsText`, shows a preview, and posts the valid rows to `/leads/bulk`. Sample files, including ones with errors and missing fields, are in `docs/*.csv`. UI wireframes: `docs/ui-wireframes.png`.

## Adding or changing a lead field

Lead fields are listed by hand in many places. A new field has to be added to each of these:

1. `backend/prisma/schema.prisma`, then `pnpm migrate:dev`.
2. `backend/src/index.ts`: the explicit `data` mapping in `POST /leads/bulk` (and in `POST /leads` / `PATCH` if relevant).
3. `backend/src/utils/messageGenerator.ts`: the `Lead` interface and `availableFields`.
4. `frontend/src/api/types/leads/getMany.ts` and `bulkImport.ts`. These are the only type files with the full field list; `create`, `getOne` and `update` declare only a few fields.
5. `frontend/src/utils/csvParser.ts`: `CsvLead` and the header `switch`.
6. `frontend/src/components/CsvImportModal.tsx`: the mapping before `bulkImport` and the "Optional:" help text.
7. `frontend/src/components/LeadsList.tsx`: the table columns.
8. `frontend/src/components/MessageTemplateModal.tsx`: the hard-coded `availableFields` array.
9. `frontend/src/api/mutations/useApiMutation.ts`: the defaults of the optimistic lead.
