import 'dotenv/config';

import { createHash, randomBytes } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@libsql/client';
import { chromium, devices } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const DEFAULT_BASE_URL = 'http://127.0.0.1:3000';
const DEFAULT_DB_PATH = path.join(repoRoot, 'dev.db');
const DEFAULT_OUTPUT_ROOT = path.join(
  repoRoot,
  'output',
  'playwright',
  'app-store-screenshots'
);
const SESSION_COOKIE_NAME = 'ember_session';
const CHAT_COOKIE_NAME = 'mw_photo_chat_v2';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const WAIT_TIMEOUT_MS = 20_000;
const AFTER_SCROLL_WAIT_MS = 450;
const AFTER_NAVIGATION_WAIT_MS = 700;
const QUERY = `
  SELECT
    i.id AS image_id,
    i.title AS title,
    i.originalName AS original_name,
    i.description AS description,
    i.mediaType AS media_type,
    i.createdAt AS created_at,
    i.ownerId AS owner_id,
    u.email AS owner_email,
    u.name AS owner_name,
    CASE WHEN w.id IS NULL THEN 0 ELSE 1 END AS has_wiki,
    COALESCE((SELECT COUNT(*) FROM "Contributor" c WHERE c.imageId = i.id), 0) AS contributor_count,
    COALESCE((SELECT COUNT(*) FROM "ImageAttachment" a WHERE a.imageId = i.id), 0) AS attachment_count,
    COALESCE((SELECT COUNT(*) FROM "ImageTag" t WHERE t.imageId = i.id), 0) AS tag_count,
    COALESCE((
      SELECT COUNT(*)
      FROM "Response" r
      JOIN "Conversation" cv ON cv.id = r.conversationId
      JOIN "Contributor" rc ON rc.id = cv.contributorId
      WHERE rc.imageId = i.id
    ), 0) AS response_count,
    COALESCE((
      SELECT COUNT(*)
      FROM "Message" m
      JOIN "Conversation" cm ON cm.id = m.conversationId
      JOIN "Contributor" mc ON mc.id = cm.contributorId
      WHERE mc.imageId = i.id
    ), 0) AS conversation_message_count,
    COALESCE((
      SELECT COUNT(*)
      FROM "VoiceCall" v
      JOIN "Contributor" vc ON vc.id = v.contributorId
      WHERE vc.imageId = i.id
    ), 0) AS voice_call_count,
    COALESCE((
      SELECT COUNT(*)
      FROM "ChatMessage" chm
      JOIN "ChatSession" chs ON chs.id = chm.sessionId
      WHERE chs.imageId = i.id
    ), 0) AS chat_message_count,
    (
      SELECT ranked.browser_id
      FROM (
        SELECT
          chs.browserId AS browser_id,
          COUNT(chm.id) AS message_count,
          MAX(chs.createdAt) AS latest_created_at
        FROM "ChatSession" chs
        LEFT JOIN "ChatMessage" chm ON chm.sessionId = chs.id
        WHERE chs.imageId = i.id
        GROUP BY chs.id, chs.browserId
      ) ranked
      ORDER BY ranked.message_count DESC, ranked.latest_created_at DESC
      LIMIT 1
    ) AS chat_browser_id
  FROM "Image" i
  JOIN "User" u ON u.id = i.ownerId
  LEFT JOIN "Wiki" w ON w.imageId = i.id
  ORDER BY i.createdAt DESC
`;

const DEVICE_PRESETS = {
  '6.9': {
    key: '6.9',
    label: 'iPhone 15 Pro Max (6.9)',
    folder: 'iphone-15-pro-max-6.9',
    viewport: { width: 430, height: 932 },
    acceptedPixels: { width: 1290, height: 2796 },
    device: devices['iPhone 15 Pro Max'],
  },
  '6.5': {
    key: '6.5',
    label: 'iPhone 11 Pro Max (6.5)',
    folder: 'iphone-11-pro-max-6.5',
    viewport: { width: 414, height: 896 },
    acceptedPixels: { width: 1242, height: 2688 },
    device: devices['iPhone 11 Pro Max'],
  },
};

function printHelp() {
  console.log(`
Usage:
  npm run screenshots:app-store
  npm run screenshots:app-store -- --device=6.9
  npm run screenshots:app-store -- --user-email=owner@example.com

Options:
  --device <all|6.9|6.5>        Capture one accepted iPhone size or both. Default: all
  --user-email <email>          Prefer a specific owner account from the sample DB
  --base-url <url>              Override the local web app URL. Default: http://127.0.0.1:3000
  --db-url <url-or-path>        Override the sqlite/libsql database URL or local path
  --output-dir <path>           Override the artifact directory
  --help                        Show this help text

Environment overrides:
  SCREENSHOT_DEVICE
  SCREENSHOT_USER_EMAIL
  SCREENSHOT_BASE_URL
  SCREENSHOT_DATABASE_URL
  SCREENSHOT_OUTPUT_DIR
`);
}

function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (!value.startsWith('--')) {
      continue;
    }

    const [rawKey, inlineValue] = value.slice(2).split('=');
    const key = rawKey.trim();

    if (key === 'help') {
      options.help = true;
      continue;
    }

    if (inlineValue !== undefined) {
      options[key] = inlineValue;
      continue;
    }

    const nextValue = argv[index + 1];
    if (!nextValue || nextValue.startsWith('--')) {
      throw new Error(`Missing value for --${key}`);
    }

    options[key] = nextValue;
    index += 1;
  }

  return options;
}

function getTimestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');

  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '-',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('');
}

function toDatabaseUrl(value) {
  if (!value) {
    const normalizedDefaultPath = DEFAULT_DB_PATH.replace(/\\/g, '/');
    return normalizedDefaultPath.startsWith('/') ? `file:${normalizedDefaultPath}` : `file:/${normalizedDefaultPath}`;
  }

  if (/^[a-z]+:/i.test(value)) {
    if (value.startsWith('file:') && /^[a-z]:/i.test(value.slice(5))) {
      return `file:/${value.slice(5).replace(/\\/g, '/')}`;
    }

    return value;
  }

  const absolutePath = path.isAbsolute(value) ? value : path.resolve(repoRoot, value);
  const normalizedPath = absolutePath.replace(/\\/g, '/');
  return normalizedPath.startsWith('/') ? `file:${normalizedPath}` : `file:/${normalizedPath}`;
}

function normalizeBaseUrl(value) {
  const url = new URL(value || DEFAULT_BASE_URL);
  return url.origin;
}

function numeric(value) {
  return Number(value || 0);
}

function hashSessionToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function sessionId() {
  return `appstore_${Date.now()}_${randomBytes(6).toString('hex')}`;
}

function ownerScore(images) {
  const topImages = [...images]
    .sort((left, right) => heroScore(right) - heroScore(left))
    .slice(0, 3);

  const hasWiki = images.some((image) => image.hasWiki);
  const hasStory = images.some((image) => image.storyEntryCount > 0);
  const hasChat = images.some((image) => image.chatMessageCount > 0 && image.chatBrowserId);

  return (
    topImages.reduce((sum, image, index) => sum + heroScore(image) / (index + 1), 0) +
    (hasWiki ? 30 : 0) +
    (hasStory ? 24 : 0) +
    (hasChat ? 20 : 0) +
    Math.min(images.length, 5) * 6
  );
}

function ownerPresentationPenalty(owner) {
  const email = owner.email.toLowerCase();
  const name = owner.name?.toLowerCase() || '';

  if (email.endsWith('@ember.local') || email.includes('legacy') || name.includes('legacy')) {
    return 36;
  }

  return 0;
}

function imageScore(image) {
  return (
    (image.title ? 6 : 0) +
    (image.description ? 10 : 0) +
    image.contributorCount * 5 +
    image.attachmentCount * 4 +
    image.tagCount * 4 +
    Math.min(image.responseCount, 12) * 3 +
    Math.min(image.conversationMessageCount, 12) * 2 +
    Math.min(image.voiceCallCount, 6) * 4 +
    Math.min(image.chatMessageCount, 12) * 2
  );
}

function heroScore(image) {
  return (
    imageScore(image) +
    (image.hasWiki ? 24 : 0) +
    (image.storyEntryCount > 0 ? 20 : 0) +
    (image.chatMessageCount > 0 && image.chatBrowserId ? 12 : 0)
  );
}

function chooseBestImage(images, scorer, { require = () => true, fallbackToAny = true } = {}) {
  const filtered = images.filter(require);
  const candidates = filtered.length > 0 || !fallbackToAny ? filtered : images;

  if (candidates.length === 0) {
    return null;
  }

  return [...candidates].sort((left, right) => {
    const scoreDelta = scorer(right) - scorer(left);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  })[0];
}

function friendlyTitle(image) {
  return image.title?.trim() || image.originalName;
}

async function loadImageRows(client) {
  const result = await client.execute(QUERY);

  return result.rows.map((row) => {
    const responseCount = numeric(row.response_count);
    const conversationMessageCount = numeric(row.conversation_message_count);
    const voiceCallCount = numeric(row.voice_call_count);

    return {
      id: String(row.image_id),
      title: row.title ? String(row.title) : null,
      originalName: String(row.original_name),
      description: row.description ? String(row.description) : null,
      mediaType: String(row.media_type),
      createdAt: String(row.created_at),
      ownerId: String(row.owner_id),
      ownerEmail: String(row.owner_email).toLowerCase(),
      ownerName: row.owner_name ? String(row.owner_name) : null,
      hasWiki: numeric(row.has_wiki) > 0,
      contributorCount: numeric(row.contributor_count),
      attachmentCount: numeric(row.attachment_count),
      tagCount: numeric(row.tag_count),
      responseCount,
      conversationMessageCount,
      voiceCallCount,
      storyEntryCount: responseCount + conversationMessageCount + voiceCallCount,
      chatMessageCount: numeric(row.chat_message_count),
      chatBrowserId: row.chat_browser_id ? String(row.chat_browser_id) : null,
    };
  });
}

function chooseUser(rows, preferredEmail) {
  const normalizedEmail = preferredEmail?.trim().toLowerCase() || null;
  const scopedRows = normalizedEmail
    ? rows.filter((row) => row.ownerEmail === normalizedEmail)
    : rows;

  if (scopedRows.length === 0) {
    const knownOwners = [...new Set(rows.map((row) => row.ownerEmail))].sort();
    throw new Error(
      normalizedEmail
        ? `No sample data found for ${normalizedEmail}. Known owners: ${knownOwners.join(', ')}`
        : 'No images found in the sample database.'
    );
  }

  const ownerMap = new Map();
  for (const row of scopedRows) {
    const existing = ownerMap.get(row.ownerId);
    if (existing) {
      existing.images.push(row);
      continue;
    }

    ownerMap.set(row.ownerId, {
      id: row.ownerId,
      email: row.ownerEmail,
      name: row.ownerName,
      images: [row],
    });
  }

  const owners = [...ownerMap.values()].sort((left, right) => {
    const scoreDelta =
      ownerScore(right.images) -
      ownerPresentationPenalty(right) -
      (ownerScore(left.images) - ownerPresentationPenalty(left));
    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    return left.email.localeCompare(right.email);
  });

  return owners[0];
}

function chooseScenario(owner) {
  const hero = chooseBestImage(owner.images, heroScore);
  if (!hero) {
    throw new Error(`No screenshot candidate images found for ${owner.email}.`);
  }

  const wiki = hero.hasWiki
    ? hero
    : chooseBestImage(owner.images, heroScore, {
        require: (image) => image.hasWiki,
      }) || hero;

  const story = hero.storyEntryCount > 0
    ? hero
    : chooseBestImage(owner.images, heroScore, {
        require: (image) => image.storyEntryCount > 0,
      }) || hero;

  const chat = hero.chatMessageCount > 0 && hero.chatBrowserId
    ? hero
    : chooseBestImage(owner.images, heroScore, {
        require: (image) => image.chatMessageCount > 0 && Boolean(image.chatBrowserId),
      }) || hero;

  return {
    owner,
    hero,
    wiki,
    story,
    chat,
  };
}

async function createUserSession(client, userId) {
  const token = randomBytes(32).toString('hex');
  const id = sessionId();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString();

  await client.execute({
    sql: `INSERT INTO "UserSession" ("id", "tokenHash", "userId", "expiresAt") VALUES (?, ?, ?, ?)`,
    args: [id, hashSessionToken(token), userId, expiresAt],
  });

  return { id, token, expiresAt };
}

async function deleteUserSession(client, id) {
  await client.execute({
    sql: `DELETE FROM "UserSession" WHERE "id" = ?`,
    args: [id],
  });
}

async function ensureServerReachable(baseUrl) {
  let response;
  try {
    response = await fetch(baseUrl, {
      redirect: 'manual',
      headers: {
        'user-agent': 'memory-wiki-app-store-screenshots/1.0',
      },
    });
  } catch (error) {
    throw new Error(
      `Could not reach ${baseUrl}. Start the local app with \`npm run dev\` and try again.`
    );
  }

  if (!response.ok && response.status !== 307 && response.status !== 308) {
    throw new Error(
      `The local app responded with ${response.status} at ${baseUrl}. Make sure the site is running before capturing screenshots.`
    );
  }
}

async function waitForLoad(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle', { timeout: 7_000 }).catch(() => undefined);
}

async function assertAuthorized(page) {
  if (new URL(page.url()).pathname === '/login') {
    throw new Error(
      'The screenshot browser was redirected to /login. The temporary session cookie did not stick.'
    );
  }
}

async function settleAfterScroll(page) {
  await page.waitForTimeout(AFTER_SCROLL_WAIT_MS);
}

async function scrollToLocator(page, locator, offset = 0) {
  await locator.waitFor({ state: 'visible', timeout: WAIT_TIMEOUT_MS });
  await locator.evaluate((element, scrollOffset) => {
    const top = Math.max(element.getBoundingClientRect().top + window.scrollY + scrollOffset, 0);
    window.scrollTo({ top, behavior: 'auto' });
  }, offset);

  await settleAfterScroll(page);
}

async function captureShot(page, filePath) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await page.screenshot({
    path: filePath,
    fullPage: false,
  });
}

function summarizeImage(image) {
  return {
    id: image.id,
    title: friendlyTitle(image),
    ownerEmail: image.ownerEmail,
    hasWiki: image.hasWiki,
    contributorCount: image.contributorCount,
    attachmentCount: image.attachmentCount,
    tagCount: image.tagCount,
    responseCount: image.responseCount,
    conversationMessageCount: image.conversationMessageCount,
    voiceCallCount: image.voiceCallCount,
    storyEntryCount: image.storyEntryCount,
    chatMessageCount: image.chatMessageCount,
  };
}

function resolveDeviceKeys(input) {
  const value = (input || 'all').toLowerCase();

  if (value === 'all' || value === 'both') {
    return ['6.9', '6.5'];
  }

  if (value in DEVICE_PRESETS) {
    return [value];
  }

  throw new Error(`Unsupported device "${input}". Use all, 6.9, or 6.5.`);
}

async function captureDeviceSet({
  browser,
  baseUrl,
  scenario,
  session,
  outputDir,
  deviceKey,
}) {
  const preset = DEVICE_PRESETS[deviceKey];
  const secure = baseUrl.startsWith('https://');
  const expires = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
  const context = await browser.newContext({
    ...preset.device,
    viewport: preset.viewport,
    screen: preset.viewport,
    colorScheme: 'light',
    locale: 'en-US',
    timezoneId: 'America/New_York',
  });

  await context.addCookies(
    [
      {
        name: SESSION_COOKIE_NAME,
        value: session.token,
        url: baseUrl,
        httpOnly: true,
        sameSite: 'Lax',
        secure,
        expires,
      },
      scenario.chat.chatBrowserId
        ? {
            name: CHAT_COOKIE_NAME,
            value: scenario.chat.chatBrowserId,
            url: baseUrl,
            httpOnly: true,
            sameSite: 'Lax',
            secure,
            expires,
          }
        : null,
    ].filter(Boolean)
  );

  const page = await context.newPage();

  const files = [];

  const recordFile = (filename, notes) => {
    const absolutePath = path.join(outputDir, preset.folder, filename);
    files.push({
      filename,
      path: absolutePath,
      notes,
    });
    return absolutePath;
  };

  await page.goto(`${baseUrl}/feed`, { waitUntil: 'domcontentloaded' });
  await waitForLoad(page);
  await assertAuthorized(page);
  await page.locator('article').first().waitFor({ state: 'visible', timeout: WAIT_TIMEOUT_MS });
  await scrollToLocator(page, page.getByText('Your Embers', { exact: true }), -72);
  await captureShot(page, recordFile('01-feed.png', 'Feed overview'));

  await page.goto(`${baseUrl}/image/${scenario.hero.id}`, { waitUntil: 'domcontentloaded' });
  await waitForLoad(page);
  await page.locator('h1').first().waitFor({
    state: 'visible',
    timeout: WAIT_TIMEOUT_MS,
  });
  await page.waitForTimeout(AFTER_NAVIGATION_WAIT_MS);
  await captureShot(page, recordFile('02-memory.png', 'Memory detail'));

  await page.goto(`${baseUrl}/image/${scenario.wiki.id}/wiki`, {
    waitUntil: 'domcontentloaded',
  });
  await waitForLoad(page);
  await page.locator('h1').first().waitFor({
    state: 'visible',
    timeout: WAIT_TIMEOUT_MS,
  });
  await scrollToLocator(page, page.getByText('Wiki', { exact: true }), -56);
  await captureShot(page, recordFile('03-wiki.png', 'Wiki synthesis'));

  await page.goto(`${baseUrl}/image/${scenario.story.id}/story-circle`, {
    waitUntil: 'domcontentloaded',
  });
  await waitForLoad(page);
  await page.getByRole('heading', { level: 1, name: 'Running memory thread' }).waitFor({
    state: 'visible',
    timeout: WAIT_TIMEOUT_MS,
  });
  await page.evaluate(() => {
    const panels = [...document.querySelectorAll('.ember-panel-strong')];
    const threadPanel = panels[1];

    if (threadPanel instanceof HTMLElement) {
      const top = Math.max(threadPanel.getBoundingClientRect().top + window.scrollY - 72, 0);
      window.scrollTo({ top, behavior: 'auto' });
      return;
    }

    window.scrollTo({ top: 880, behavior: 'auto' });
  });
  await settleAfterScroll(page);
  await captureShot(page, recordFile('04-story-circle.png', 'Story circle timeline'));

  await page.goto(`${baseUrl}/image/${scenario.chat.id}/chat`, {
    waitUntil: 'domcontentloaded',
  });
  await waitForLoad(page);
  await page.getByRole('heading', { name: 'Memory Q&A' }).waitFor({
    state: 'visible',
    timeout: WAIT_TIMEOUT_MS,
  });
  await page.evaluate(() => {
    const header = [...document.querySelectorAll('h2')].find(
      (element) => element.textContent?.trim() === 'Memory Q&A'
    );

    if (header) {
      const top = Math.max(header.getBoundingClientRect().top + window.scrollY - 88, 0);
      window.scrollTo({ top, behavior: 'auto' });
      return;
    }

    window.scrollTo({ top: 420, behavior: 'auto' });
  });
  await settleAfterScroll(page);
  await page.waitForTimeout(AFTER_NAVIGATION_WAIT_MS);
  await captureShot(page, recordFile('05-chat.png', 'Ask Ember chat view'));

  await context.close();

  return {
    device: preset.label,
    folder: path.join(outputDir, preset.folder),
    viewport: preset.viewport,
    deviceScaleFactor: preset.device.deviceScaleFactor,
    acceptedPixels: preset.acceptedPixels,
    files,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const baseUrl = normalizeBaseUrl(args['base-url'] || process.env.SCREENSHOT_BASE_URL || DEFAULT_BASE_URL);
  const dbUrl = toDatabaseUrl(args['db-url'] || process.env.SCREENSHOT_DATABASE_URL || process.env.DATABASE_URL || DEFAULT_DB_PATH);
  const preferredUserEmail = args['user-email'] || process.env.SCREENSHOT_USER_EMAIL || null;
  const outputRoot = path.resolve(
    repoRoot,
    args['output-dir'] || process.env.SCREENSHOT_OUTPUT_DIR || DEFAULT_OUTPUT_ROOT
  );
  const deviceKeys = resolveDeviceKeys(args.device || process.env.SCREENSHOT_DEVICE);
  const timestamp = getTimestamp();
  const runDir = path.join(outputRoot, timestamp);

  await mkdir(runDir, { recursive: true });
  await ensureServerReachable(baseUrl);

  const client = createClient({ url: dbUrl });
  let session = null;
  let browser = null;

  try {
    const rows = await loadImageRows(client);
    const owner = chooseUser(rows, preferredUserEmail);
    const scenario = chooseScenario(owner);

    session = await createUserSession(client, owner.id);
    browser = await chromium.launch({ headless: true });

    const captures = [];
    for (const deviceKey of deviceKeys) {
      captures.push(
        await captureDeviceSet({
          browser,
          baseUrl,
          scenario,
          session,
          outputDir: runDir,
          deviceKey,
        })
      );
    }

    const manifest = {
      createdAt: new Date().toISOString(),
      baseUrl,
      deviceSelection: deviceKeys,
      outputRoot,
      runDirectory: runDir,
      selectedOwner: {
        id: owner.id,
        email: owner.email,
        name: owner.name,
        imageCount: owner.images.length,
      },
      selection: {
        hero: summarizeImage(scenario.hero),
        wiki: summarizeImage(scenario.wiki),
        story: summarizeImage(scenario.story),
        chat: summarizeImage(scenario.chat),
      },
      captures,
    };

    const manifestPath = path.join(runDir, 'manifest.json');
    const latestPath = path.join(outputRoot, 'latest.json');

    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    await writeFile(
      latestPath,
      `${JSON.stringify(
        {
          updatedAt: manifest.createdAt,
          manifestPath,
          runDirectory: runDir,
        },
        null,
        2
      )}\n`,
      'utf8'
    );

    console.log(`Captured App Store screenshots for ${owner.email}`);
    console.log(`Run directory: ${runDir}`);
    console.log(`Manifest: ${manifestPath}`);
  } finally {
    if (browser) {
      await browser.close();
    }

    if (session) {
      await deleteUserSession(client, session.id).catch(() => undefined);
    }

    await client.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
