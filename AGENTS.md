<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Worktree setup

When starting a session in a fresh worktree under `.claude/worktrees/*`, two things are missing because they are gitignored and not copied over by `git worktree add`. Do both BEFORE running `preview_start`, otherwise the dev server will crash.

1. **`.env`** — copy from the main repo root: `cp D:/SANDBOX/kipember1/.env .env`
2. **Prisma client** (`src/generated/prisma/`) — regenerate: `npx prisma generate`

Symptoms if skipped:
- Missing `.env` → runtime error `DATABASE_URL is not configured` at `src/lib/db.ts:15`
- Missing Prisma client → build error `Module not found: Can't resolve '@/generated/prisma/client'`

Node_modules is per-worktree. If it is empty, run `npm install` (which also triggers `postinstall` → `prisma generate`, covering step 2).
