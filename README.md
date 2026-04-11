This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Retell voice calling

The app now supports outbound contributor voice interviews through Retell. Configure these environment variables before using the voice buttons:

```bash
RETELL_API_KEY=...
RETELL_AGENT_ID=...
RETELL_FROM_NUMBER=+1...
RETELL_WEBHOOK_URL=https://your-domain.com/api/retell/webhook
```

If `RETELL_WEBHOOK_URL` is omitted, the app falls back to `NEXT_PUBLIC_BASE_URL + /api/retell/webhook`.
On Render, if `NEXT_PUBLIC_BASE_URL` is omitted, the app also falls back to `https://$RENDER_EXTERNAL_HOSTNAME`.

Voice flow summary:

- Owner can start a voice interview from the contributor list.
- Contributor can request a phone interview from their invite page.
- Retell webhook events are verified and stored in `VoiceCall` / `VoiceCallEvent`.
- Final transcripts are extracted into the existing `Conversation.responses` table with `source="voice"` so wiki generation and image chat can use the same memory data.

## Automatic photo analysis

When a photo is uploaded, the app now tries to:

- read embedded photo metadata such as capture date, camera details, and GPS coordinates when present
- run visual analysis on the photo
- generate an initial wiki automatically before any contributor interviews

This requires `ANTHROPIC_API_KEY` to be configured. The optional `ANTHROPIC_IMAGE_ANALYSIS_MODEL` env var can override the default image-analysis model.

## Access control

Set `ACCESS_LOCK_ENABLED=true` if you want the app behind the passcode wall.
If `ACCESS_LOCK_ENABLED` is omitted or set to anything else, the app stays open and the password gate is bypassed.

## PostgreSQL migration

This app now targets PostgreSQL through Prisma.

- Set `DATABASE_URL` to your Postgres connection string, for example:
  - `postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public`
- Apply the baseline schema:
  - `npx prisma migrate deploy`
- If you are migrating existing local SQLite data, import it with:
  - `SQLITE_DATABASE_URL=file:./dev.db npm run db:import:sqlite`

The SQLite migration history that existed before the provider switch is archived in:

- `prisma/migrations_sqlite_archive`

Prisma does not safely replay SQLite migration files on PostgreSQL, so the active `prisma/migrations` directory now contains a fresh Postgres baseline migration.

## Render notes

This app now expects PostgreSQL plus durable file storage for uploads.

- Set `DATABASE_URL` to your Render Postgres connection string.
- Keep `UPLOADS_DIR=/var/data/uploads` if you are still storing uploaded media on Render disk.
- Deploy normally with the existing start command:
  - `prisma migrate deploy && next start`
- If you need to bring over the old SQLite data from Render, first download the SQLite file, then run:
  - `SQLITE_DATABASE_URL=file:/path/to/dev.db npm run db:import:sqlite`
