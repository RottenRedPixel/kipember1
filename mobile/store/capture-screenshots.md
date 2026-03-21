# Automated App Store Screenshots

This repo includes a local capture script for the first iPhone App Store screenshot set. It uses Playwright against the running web app, chooses the richest owner/image combination from the sample sqlite database, creates a temporary local auth session, and exports viewport screenshots at accepted iPhone sizes.

## Prerequisites

- Start the web app locally from the repo root:

```bash
npm run dev
```

- Make sure the sample database exists locally. By default the script uses:

```text
file:C:/Users/cbarr/memory-wiki/dev.db
```

- Chromium must be installed for Playwright. This repo already has the dependency and browser install path set up.

## Run

From the repo root:

```bash
npm run screenshots:app-store
```

That captures both supported iPhone classes:

- `6.9"` via `iPhone 15 Pro Max`
- `6.5"` via `iPhone 11 Pro Max`

Artifacts are written to:

```text
output/playwright/app-store-screenshots/<timestamp>/
```

Each run contains:

- `iphone-15-pro-max-6.9/01-feed.png`
- `iphone-15-pro-max-6.9/02-memory.png`
- `iphone-15-pro-max-6.9/03-wiki.png`
- `iphone-15-pro-max-6.9/04-story-circle.png`
- `iphone-15-pro-max-6.9/05-chat.png`
- `iphone-11-pro-max-6.5/...`
- `manifest.json`

The latest successful run is also written to:

```text
output/playwright/app-store-screenshots/latest.json
```

## Useful overrides

Capture only one device class:

```bash
npm run screenshots:app-store -- --device=6.9
```

Force a specific owner from the sample data:

```bash
npm run screenshots:app-store -- --user-email=cbarrettjr@gmail.com
```

Override the local app URL or DB path:

```bash
npm run screenshots:app-store -- --base-url=http://127.0.0.1:3000 --db-url=file:/C:/Users/cbarr/memory-wiki/dev.db
```

Equivalent environment variables are supported:

- `SCREENSHOT_DEVICE`
- `SCREENSHOT_USER_EMAIL`
- `SCREENSHOT_BASE_URL`
- `SCREENSHOT_DATABASE_URL`
- `SCREENSHOT_OUTPUT_DIR`

## Notes

- The script does not reuse your real login. It inserts and removes a temporary `ember_session` row in `UserSession`.
- For chat screenshots, it reuses the richest existing `mw_photo_chat_v2` browser session from the sample data when available so the screenshot shows actual message history.
- If the local site is not running, the script stops immediately with a clear error instead of producing partial output.
