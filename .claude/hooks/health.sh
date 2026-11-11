#!/usr/bin/env bash
# SessionStart: print the state of the environment, so every session starts from facts.
# Whatever this prints is added to Claude's context.
root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
up() { nc -z localhost "$1" >/dev/null 2>&1 && echo up || echo DOWN; }

echo "Environment check"
echo "- Node $(node -v 2>/dev/null || echo missing); the repo expects $(cat "$root/backend/.nvmrc" 2>/dev/null || echo '?')"
echo "- Temporal server :7233 $(up 7233) (the backend exits at boot without it)"
echo "- Backend API     :4000 $(up 4000)"
echo "- Frontend        :5173 $(up 5173)"
echo "- Branch $(git -C "$root" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?'), $(git -C "$root" status --porcelain 2>/dev/null | wc -l | tr -d ' ') uncommitted file(s)"
exit 0
