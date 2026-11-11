---
name: verify-app
description: Bring the app to a known state and verify runtime acceptance criteria after an application change. Use for observable UI, API, data, or Temporal behavior; documentation-only and configuration-only changes use their own checks.
---

# Verify in the running product

Unit tests are not enough for anything the user sees. A task is done when it was seen working.

## 1. Known state

- Temporal dev server on `localhost:7233`, started with `temporal server start-dev`. The backend exits at boot without it.
- Backend on `http://localhost:4000`, started with `pnpm run dev` in `backend/`.
- Frontend on `http://localhost:5173`, started with `pnpm run dev` in `frontend/`.
- Database `backend/prisma/dev.db`. The optional seed backup location is `~/tinyenginy-dev.db.seed`; setup does not create it. Check that it exists and validates before proposing a restore.

If a service is down, say so and stop. Do not start long-running servers or restore the database unless the user asks. Restoring discards local data.

### Prepare the backup once

Before changing application data, stop the backend and its worker and confirm that the current database is the baseline the user wants to preserve. If data has already changed, do not label a snapshot as the original seed. From the repository root, inspect it with:

```sh
sqlite3 -readonly backend/prisma/dev.db \
  'PRAGMA integrity_check; SELECT id, email FROM lead WHERE id IN (1, 2) ORDER BY id;'
```

For the supplied baseline, expect `ok`, `1|john.doe@example.com`, and `2|jane.smith@example.com`. Stop if integrity fails or the fixture rows differ; resolve the intended baseline first. Those two rows identify the test fixtures, not a complete check of every row.

After confirming the baseline, create a consistent SQLite backup without replacing an existing backup:

```sh
if [ -e "$HOME/tinyenginy-dev.db.seed" ]; then
  printf '%s\n' 'Backup already exists; validate it instead of overwriting it.' >&2
else
  sqlite3 -readonly backend/prisma/dev.db ".backup '$HOME/tinyenginy-dev.db.seed'"
fi
```

Validate the backup using the same integrity and fixture query:

```sh
sqlite3 -readonly "$HOME/tinyenginy-dev.db.seed" \
  'PRAGMA integrity_check; SELECT id, email FROM lead WHERE id IN (1, 2) ORDER BY id;'
```

Require the same expected output before relying on it. Keep backups outside the repository. SQLite's [`.backup` command](https://www.sqlite.org/cli.html) copies the database through SQLite rather than copying an open database file directly.

To restore after explicit user authorization, stop the backend and worker, validate the backup again, and use SQLite's `.restore` command on `backend/prisma/dev.db`. Then run `pnpm migrate:dev` in `backend/` to apply newer migrations and repeat the integrity/fixture check before restarting. A missing or invalid backup blocks restoration; never substitute a reset or create an empty database.

## 2. Drive the product

Use the browser tools available in the current runtime for UI criteria. If browser access is unavailable, report the missing visual proof; API or database checks do not substitute for observing a required UI behavior. Fixed points in the seed data and the example files:

- Lead 1, `john.doe@example.com`. Email verification answers "invalid".
- Lead 2, `jane.smith@example.com`. Email verification takes 20 seconds.
- `docs/leads-ok-1.csv`. Five clean rows.
- `docs/leads-ok-missing fields.csv`. Rows with missing required and optional fields.
- `docs/leads-with-errors.csv`. Missing fields, invalid emails, a duplicate (rows 3 and 4), invalid country codes (`XXX` and `12`), a name with accents (row 2), an empty row (row 23).

## 3. Evidence to collect

- A screenshot of the UI state that proves the behaviour.
- For an API change, the request and the response with its status code.
- For a data change, the row, read with `sqlite3 -readonly backend/prisma/dev.db`.
- For a Temporal change, `temporal workflow list` showing nothing left Running, and `temporal workflow show --workflow-id <id>` for one run.

## 4. Report

For each acceptance criterion, say pass or fail and give the evidence. List what could not be checked and why. Never report "works" for something that was not observed.
