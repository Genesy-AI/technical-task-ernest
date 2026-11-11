# AGENTS.md

This file provides guidance to AI coding agents working in this repository.

## What this is

"TinyEnginy" take-home: a small lead-management app. `README.md` holds the task list (two bug fixes, two features, a PR review, and an `IMPROVEMENTS.md` roadmap) and the phone-provider API specs for the Temporal enrichment workflow. Read it before starting any task.

Two independent pnpm packages, no root workspace: run package commands from inside `backend/` or `frontend/`. Node version comes from each `.nvmrc` (v22).

## Development workflows

- `new-feature` uses `.agents/skills/new-feature/SKILL.md` for feature implementation and acceptance checks.
- `bugfix` uses `.agents/skills/bugfix/SKILL.md` for reproduction, diagnosis, correction, and regression checks.

Custom skills and reusable role instructions are maintained under `.agents/`. Use the current tool's skill invocation syntax; automatic skill selection remains enabled. All paths in these instructions are relative to the repository root.

The main session owns context, acceptance criteria, routing, and delivery. Choose implementation and verification separately:

- Implement small, understood, low-risk changes in the main session. Keep work inline when it needs frequent back-and-forth or shares substantial context across phases. Delegate a bounded, self-contained task using the implementer role in `.agents/workflows/implementer.md` when a compact handoff keeps detailed implementation work out of the main conversation. Either executor owns code, regression tests, documentation, and self-checks.
- Use the independent verifier role in `.agents/workflows/verifier.md` after self-checks when the user requests independent verification or the change has a concrete high-risk consequence: irreversible stored-data changes; security, permissions, or guards; compatibility changes to consumed APIs, configuration, or workflow contracts; concurrency or async ordering; delivery, installation, CI, or dependency changes; or runtime behavior for which no meaningful automated check exists. Name the applicable risk. Task size, delegation, and model choice alone do not require a verifier. Passive documentation needs structural checks unless independent verification is explicitly requested.

The verifier independently checks original requirements, relevant failure cases, and shared behavior. The executor runs the affected package checks once on the final candidate; the main session spot-checks delegated evidence, and the verifier runs targeted probes instead of automatically repeating the full suite. Repeat broader checks only for changed code, failures, stale evidence, or a specific uncovered concern. Missing or failed required checks leave work incomplete; they are not a reason to skip proof. Confirmed in-scope findings return to the original executor for one correction batch and a focused recheck, with unresolved blockers reported honestly.

### Runtime bindings

- **Claude Code:** invoke `/new-feature <description>` or `/bugfix <description>`. The thin entry points in `.claude/skills/` request Opus for that turn; subsequent turns use the session's selected model. For delegated work, use `.claude/agents/implementer.md` (Sonnet) and `.claude/agents/verifier.md` (Opus). These definitions load the shared role instructions. Keep their defaults unless the user requests another model, and report any unavailable or substituted model honestly.
- **Codex:** invoke `$new-feature` or `$bugfix` with the request, or use automatic discovery from `.agents/skills/`. Use native subagent tools when the routing calls for delegation, and pass the exact shared role and skill paths with the bounded handoff. Follow the session's configured model/effort assignments; Claude model aliases and agent frontmatter do not configure Codex. The main session retains its selected model.
- **Other compatible agents:** load the shared skill and use the runtime's native delegation with the same role instructions and handoff. Use inline execution when the routing permits it. If required independent verification or another required capability is unavailable, report the missing proof and leave that result unverified; self-review cannot replace an independent verifier.

Native tools and permissions remain runtime-specific. Shared role instructions constrain worker behavior; they do not install a sandbox or grant tools. Hooks in `.claude/settings.json` run only in Claude Code. Other runtimes must run the workflow's checks explicitly and use their own permission controls.

Both workflows reuse the shared Temporal, frontend, and application-verification skills when relevant. In Claude Code, `.claude/agents/codebase-auditor.md` is available for a requested broad audit; it is not a required workflow step. Keep detailed procedures in the skills. Planning and investigation requests remain read-only unless implementation is requested.

### Installing and maintaining skills

Keep shared skill bodies in `.agents/skills/<name>/SKILL.md`. Claude Code discovers them through relative links in `.claude/skills/`; `new-feature` and `bugfix` use small Claude entry-point adapters to retain their model override and argument expansion. Edit their shared workflow bodies under `.agents/skills/`, not the adapters. The two Claude agent definitions similarly load the shared roles from `.agents/workflows/`.

For third-party installation, use `npx skills add <owner/repo> --agent codex claude-code` and choose symlink mode. Add another agent only when needed. Keep `skills-lock.json` for installer-managed skills; locally authored skills do not need invented registry or hash entries. Installed third-party skills may have their own runtime extensions and should be checked before use in another tool.

Discovery references: [Codex skills](https://learn.chatgpt.com/docs/build-skills#where-codex-loads-local-skills), [Claude skills](https://code.claude.com/docs/en/skills#choose-where-skills-load), and [Skills CLI](https://github.com/vercel-labs/skills/blob/main/docs/commands.md).

## Git safety

- Work on a feature branch. Do not commit directly to main or master.
- Never push directly to main or master, including through refspecs such as HEAD:main.
- Push feature branches only when the user explicitly requests it.
- Never force-push.
- Stage explicit file paths. Never stage backend/prisma/dev.db.
- Preserve existing uncommitted work. Ask before destructive Git operations.

## Commands

Backend (`cd backend`):

```zsh
pnpm install
pnpm migrate:dev            # prisma migrate dev; run after every schema.prisma change
pnpm gen:prisma             # regenerate Prisma client
temporal server start-dev   # must be running on localhost:7233 before `pnpm dev`
pnpm dev                    # nodemon + ts-node, API on :4000 (also starts the Temporal worker)
pnpm build                  # tsc typecheck/emit
pnpm format                 # prettier
```

Frontend (`cd frontend`):

```zsh
pnpm install
pnpm dev                    # vite dev server
pnpm build                  # tsc -b && vite build
pnpm lint                   # eslint, --max-warnings 0
pnpm format
```

Tests (Vitest in both packages; `pnpm test` starts watch mode):

```zsh
pnpm vitest run                                   # whole suite, once
pnpm vitest run src/utils/csvParser.test.ts       # single file
pnpm vitest run -t "name of the test"             # single test by name
```

AI setup hook tests run from the repository root:

```zsh
python3 -B -m unittest discover -s .claude/hooks/tests -v
```

See `.claude/hooks/README.md` for dependencies, coverage, and guard limitations.

## Architecture

### Backend (`backend/src`)

- `index.ts` is the whole API: Express 5 app, a module-level `PrismaClient`, hand-written CORS middleware, and every `/leads` route inline. There is no router/service/validation layer. The last lines call `runTemporalWorker()`, so **the API server and the Temporal worker run in one process**; if Temporal is not reachable the process exits.
- `worker.ts` registers the worker on task queue `myQueue`, namespace `default`, loading workflows from `workflows/index.ts` and activities from `workflows/activities/index.ts`. New workflows and activities must be re-exported from those index files to be picked up.
- `workflows/workflows.ts` runs in Temporal's deterministic sandbox: only import from `@temporalio/workflow` and use `import type` for activities. Anything with I/O (HTTP calls, Prisma) belongs in an activity.
- The `verify-emails` route opens a new Temporal `Connection` per request and runs `client.workflow.execute` sequentially per lead, blocking the HTTP response until all workflows finish, then writes `emailVerified` itself.
- `utils/messageGenerator.ts` fills message templates from lead fields; it is the only backend code with tests.
- Persistence is SQLite via Prisma with a single `lead` model. The datasource URL is hardcoded to `file:./dev.db` in `prisma/schema.prisma` (`.env.sample`'s MySQL URL is unused), and `prisma/dev.db` is committed.

### Frontend (`frontend/src`)

- React 18 + Vite + Tailwind 4 + TanStack Query. The UI is `LeadsList` plus two modals (`CsvImportModal`, `MessageTemplateModal`).
- API layer: `api/utils.ts` exposes `endpoint<Output, Input>(method, path | pathBuilder)`; `api/modules/leads.ts` declares each endpoint with it; `api/index.ts` assembles them into the `api` object. Input/output types live one file per endpoint in `api/types/leads/` and are hand-maintained copies of the backend shapes, so a backend contract change needs a matching edit there.
- `api/mutations/useApiMutation.ts` is a typed lookup (`useApiMutation('leads.create')`) into a central options map with optimistic updates against the `['leads', 'getMany']` query key. Only `leads.create` is registered; the optimistic lead object there must be extended when lead fields are added.
- CSV import is parsed and validated client-side in `utils/csvParser.ts` (papaparse) and then posted to `POST /leads/bulk`, which re-filters and deduplicates by first+last name. Sample files, including ones with invalid data, are in `docs/`.
- API base URL comes from `VITE_API_URL` in the committed `frontend/.env`; `utils/axios.ts` throws at import time if it is missing.

### Adding a lead field touches

`prisma/schema.prisma` (+ migration) → `POST /leads/bulk` create payload in `backend/src/index.ts` → `messageGenerator.ts` → frontend `api/types/leads/*` → `csvParser.ts` → `LeadsList` columns → `MessageTemplateModal` → the optimistic lead in `useApiMutation.ts`.

## Known mismatches

- Frontend `leads.update` sends `PUT /leads/:id`; the backend only defines `PATCH /leads/:id`.
- `POST /leads` reads `name` from the body (not `firstName`), while its error message says `firstName`.
- The `verifyEmail` activity can sleep 20s while its `startToCloseTimeout` is 1 second and no retry limit is set.
