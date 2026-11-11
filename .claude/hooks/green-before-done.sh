#!/usr/bin/env bash
# Stop: the agent may not finish its turn while type-check or unit tests are failing.
# Exit code 2 blocks the stop and sends the failures back to Claude. Needs jq.
# Needs a green baseline: fix or write down pre-existing failures first,
# or this blocks on errors the current change did not cause.
input=$(cat)

# Claude is already continuing because this hook blocked once. Let it stop, to avoid a loop.
[ "$(printf '%s' "$input" | jq -r '.stop_hook_active // false')" = "true" ] && exit 0

root="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null)}"
cd "$root" 2>/dev/null || exit 0

# Source, migration, and configuration changes on this branch, plus untracked files.
base=$(git merge-base HEAD origin/main 2>/dev/null || echo HEAD)
changed=$({ git diff --name-only "$base"; git ls-files --others --exclude-standard; } 2>/dev/null |
  grep -E '^(backend|frontend)/.*\.(ts|tsx|js|cjs|json|prisma|sql|yaml|yml|css|html)$')
[ -n "$changed" ] || exit 0

# Skip when nothing changed since the last green run, so plain questions stay fast.
state=$({
  git rev-parse HEAD
  git diff "$base"
  git ls-files --others --exclude-standard | while IFS= read -r f; do shasum "$f"; done
} 2>/dev/null | shasum | cut -d' ' -f1)
stamp="${TMPDIR:-/tmp}/green-$(printf '%s' "$root" | shasum | cut -c1-12)"
[ -f "$stamp" ] && [ "$(cat "$stamp")" = "$state" ] && exit 0

report=""
check() { # check <package> <command...>
  local pkg=$1
  shift
  local out
  if ! out=$(cd "$root/$pkg" && "$@" 2>&1); then
    report+=$'\n'"--- $pkg: $* ---"$'\n'"$(printf '%s\n' "$out" | tail -n 40)"$'\n'
  fi
}

if printf '%s\n' "$changed" | grep -q '^backend/'; then
  check backend pnpm exec tsc --noEmit -p .
  check backend pnpm exec vitest run
fi
if printf '%s\n' "$changed" | grep -q '^frontend/'; then
  check frontend pnpm exec tsc -b
  check frontend pnpm exec vitest run
fi

if [ -n "$report" ]; then
  {
    echo "Checks are failing. Fix them before finishing."
    echo "If a failure existed before your change, say which one and why. Do not hide it."
    printf '%s' "$report"
  } >&2
  exit 2
fi

printf '%s' "$state" >"$stamp"
exit 0
