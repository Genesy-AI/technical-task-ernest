# AI setup hooks

The project settings invoke these scripts through Bash. Hooks require Bash, `jq`,
and the existing package tools installed with pnpm. The health hook also uses
`nc`, Node, and Git; desktop notifications use macOS `osascript`.

Run the regression suite from the repository root with Python 3:

```sh
python3 -B -m unittest discover -s .claude/hooks/tests -v
```

Tests submit command strings as JSON to the guard; they never execute those
strings. Stop-hook tests use temporary Git repositories and a fake pnpm outside
the project to check dispatch, exit status, reports, and successful-run caching.

## Guard coverage

The guard recognizes common destructive Git actions, including global options
before the action, forced clean, force-push, hard reset, and worktree restore.
Index-only restore (`git restore --staged` or `-S`) remains allowed. Explicit
database staging, blanket staging, and direct edits to protected files retain
their existing restrictions.

This is a coarse command-pattern guard, not a shell parser or security boundary.
Quoted text can cause false positives. Aliases, scripts, dynamically constructed
commands, and directory-based staging can evade checks. Inspect staged paths and
use repository permissions or branch protection where enforcement is required.
The Git safety rules describe the main-branch policy; this hook does not enforce
all of those rules or determine whether a user authorized a push.

## Stop coverage

Changes under `backend/` or `frontend/` with extensions `ts`, `tsx`, `js`, `cjs`,
`json`, `prisma`, `sql`, `yaml`, `yml`, `css`, or `html` trigger the affected
package's typecheck and unit tests. This includes migration and package lockfile
changes. Other extensions, root-level configuration, and database contents do
not trigger these checks.

Passing package checks does not prove a SQL migration is safe or validate YAML
semantics. Verify migrations against disposable data and use the application
verification skill for runtime evidence. Record baseline failures before relying
on this hook. A second stop is intentionally allowed even when checks remain
red; report every unresolved failure rather than treating that bypass as success.
