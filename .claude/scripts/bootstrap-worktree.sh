#!/usr/bin/env bash
# SessionStart hook: bootstraps a fresh git worktree so `npm run dev` works.
# Silent when nothing is needed; emits a systemMessage when it does work.
set -u

# Only run inside .claude/worktrees/* paths.
case "$PWD" in
  *.claude/worktrees/*) ;;
  *) exit 0 ;;
esac

did_work=""

# Resolve the main repo root via the shared .git dir (portable across machines).
git_common_dir="$(git rev-parse --git-common-dir 2>/dev/null || true)"
if [ -n "$git_common_dir" ]; then
  case "$git_common_dir" in
    /*) main_repo="$(dirname "$git_common_dir")" ;;
    *)  main_repo="$(cd "$(dirname "$git_common_dir")" 2>/dev/null && pwd)" ;;
  esac

  if [ -n "${main_repo:-}" ] && [ ! -f .env ] && [ -f "$main_repo/.env" ]; then
    cp "$main_repo/.env" .env && did_work="copied .env"
  fi
fi

# Regenerate the Prisma client if missing. Prisma 7 emits client.ts, not client/.
if [ ! -f src/generated/prisma/client.ts ] && [ -f prisma/schema.prisma ]; then
  if npx --yes prisma generate >/dev/null 2>&1; then
    [ -n "$did_work" ] && did_work="$did_work, generated Prisma client" || did_work="generated Prisma client"
  fi
fi

if [ -n "$did_work" ]; then
  printf '{"systemMessage":"Worktree bootstrap: %s"}\n' "$did_work"
fi
