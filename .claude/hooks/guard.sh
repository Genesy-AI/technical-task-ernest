#!/usr/bin/env bash
# PreToolUse (Bash|Edit|Write|MultiEdit): refuse the few actions that are expensive to undo in this repo.
# Exit code 2 blocks the tool call and shows the message to Claude. Needs jq.
# The patterns are deliberately coarse; see README.md for coverage and limitations.
input=$(cat)
tool=$(printf '%s' "$input" | jq -r '.tool_name // empty')

deny() {
  printf 'Blocked by .claude/hooks/guard.sh: %s\n' "$1" >&2
  exit 2
}

if [ "$tool" = "Bash" ]; then
  cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')
  has() { printf '%s' "$cmd" | grep -Eq -- "$1"; }
  # Allow intervening Git global options (including quoted paths) before the action.
  # Do not cross shell command separators. This is pattern matching, not shell parsing.
  git='git[[:space:]]+([^;&|]*[[:space:]])?'

  has 'prisma +migrate +reset|prisma +db +push.*--force-reset' &&
    deny 'this wipes the database. Ask the user; the seed backup is the way back to a known state.'
  has "${git}push[^;&|]*(--force|[[:space:]]-f([[:space:]]|$))" &&
    deny 'no forced pushes.'
  has "${git}reset[[:space:]]+--hard|${git}clean[[:space:]][^;&|]*(--force|-[a-zA-Z]*f)|${git}checkout[[:space:]]+(--|\.)( |$)" &&
    deny 'this discards uncommitted work. Ask the user.'

  # Unstaging alone preserves worktree contents. Check each restore independently
  # so an index-only restore cannot exempt a later worktree restore in the same call.
  while IFS= read -r restore; do
    if printf '%s' "$restore" | grep -Eq -- '(^|[[:space:]])(--worktree|-[a-zA-Z]*W[a-zA-Z]*)([[:space:]]|$)' ||
      ! printf '%s' "$restore" | grep -Eq -- '(^|[[:space:]])(--staged|-[a-zA-Z]*S[a-zA-Z]*)([[:space:]]|$)'; then
      deny 'this discards uncommitted work. Ask the user.'
    fi
  done < <(printf '%s' "$cmd" | grep -Eo -- "${git}restore([[:space:]][^;&|]*)?([[:space:]]|$)")

  has "${git}add[[:space:]]+(-A|--all|\.)( |$)|${git}commit[[:space:]]+-[a-zA-Z]*a" &&
    deny 'stage explicit paths. Blanket staging would include backend/prisma/dev.db.'
  has "${git}add[[:space:]][^;&|]*dev\\.db" &&
    deny 'backend/prisma/dev.db must not be committed.'
  exit 0
fi

file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')
case "$file" in
  */pnpm-lock.yaml)
    deny 'lockfiles are changed by pnpm, not by hand.' ;;
  */prisma/dev.db)
    deny 'the database file is not edited directly.' ;;
  */prisma/migrations/*/migration.sql)
    [ -e "$file" ] && deny 'existing migrations are append-only. Create a new one with pnpm migrate:dev.' ;;
esac
exit 0
