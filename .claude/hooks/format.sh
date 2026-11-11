#!/usr/bin/env bash
# PostToolUse (Edit|Write|MultiEdit): format the file that was just edited with its package's Prettier.
# Never blocks: a formatting failure must not interrupt the work. Needs jq.
input=$(cat)
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')
[ -n "$file" ] && [ -f "$file" ] || exit 0

root="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null)}"
case "$file" in
  "$root"/backend/*)  pkg="$root/backend" ;;
  "$root"/frontend/*) pkg="$root/frontend" ;;
  *) exit 0 ;;
esac

cd "$pkg" && pnpm exec prettier --write --ignore-unknown --log-level warn "$file" >/dev/null 2>&1
exit 0
