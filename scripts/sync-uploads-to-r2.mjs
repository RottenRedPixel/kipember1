import 'dotenv/config';
import pg from 'pg';
import { S3Client, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

const { Client: PgClient } = pg;
const DEFAULT_SOURCE_BASE_URL =
  process.env.UPLOADS_SOURCE_BASE_URL ||
  process.env.UPLOADS_FALLBACK_BASE_URL ||
  'https://memory-wiki.onrender.com';
const DEFAULT_BUCKET = process.env.R2_BUCKET || 'ember-media-prod';
const CONCURRENCY = Number.parseInt(process.env.UPLOADS_SYNC_CONCURRENCY || '4', 10);

function getRequiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function createR2Client() {
  const accountId = getRequiredEnv('R2_ACCOUNT_ID');
  const accessKeyId = getRequiredEnv('R2_ACCESS_KEY_ID');
  const secretAccessKey = getRequiredEnv('R2_SECRET_ACCESS_KEY');

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

function buildSourceUrl(filename) {
  return new URL(`/api/uploads/${encodeURIComponent(filename)}`, DEFAULT_SOURCE_BASE_URL).toString();
}

async function objectExists(client, filename) {
  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: DEFAULT_BUCKET,
        Key: filename,
      })
    );
    return true;
  } catch (error) {
    const statusCode = error?.$metadata?.httpStatusCode;
    const name = error?.name;
    if (statusCode === 404 || name === 'NotFound' || name === 'NoSuchKey') {
      return false;
    }
    throw error;
  }
}

async function fetchKnownFilenames(pgClient) {
  const result = await pgClient.query(`
    select filename from "Image"
    union
    select "posterFilename" as filename from "Image" where "posterFilename" is not null
    union
    select filename from "ImageAttachment"
    union
    select "posterFilename" as filename from "ImageAttachment" where "posterFilename" is not null
    union
    select filename from "KidsStoryPanel"
  `);

  return result.rows
    .map((row) => row.filename)
    .filter((value) => typeof value === 'string' && value.trim().length > 0)
    .sort();
}

async function copyUpload(client, filename) {
  if (await objectExists(client, filename)) {
    return { status: 'skipped', filename };
  }

  const response = await fetch(buildSourceUrl(filename));
  if (!response.ok) {
    return {
      status: 'missing',
      filename,
      detail: `${response.status} ${response.statusText}`,
    };
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await client.send(
    new PutObjectCommand({
      Bucket: DEFAULT_BUCKET,
      Key: filename,
      Body: buffer,
      ContentType: response.headers.get('content-type') || undefined,
    })
  );

  return { status: 'uploaded', filename, bytes: buffer.length };
}

async function runWithConcurrency(items, worker, concurrency) {
  const queue = [...items];
  const results = [];

  async function runWorker() {
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) {
        return;
      }
      results.push(await worker(next));
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, concurrency) }, () => runWorker())
  );

  return results;
}

async function main() {
  const databaseUrl = getRequiredEnv('DATABASE_URL');
  const pgClient = new PgClient({ connectionString: databaseUrl });
  const r2Client = createR2Client();

  await pgClient.connect();

  try {
    const filenames = await fetchKnownFilenames(pgClient);
    console.log(`Found ${filenames.length} filenames to check in Postgres.`);
    console.log(`Source host: ${DEFAULT_SOURCE_BASE_URL}`);
    console.log(`Target bucket: ${DEFAULT_BUCKET}`);

    const results = await runWithConcurrency(
      filenames,
      async (filename) => {
        const result = await copyUpload(r2Client, filename);
        const detail =
          result.status === 'uploaded'
            ? ` (${result.bytes} bytes)`
            : result.detail
              ? ` (${result.detail})`
              : '';
        console.log(`${result.status.toUpperCase()}: ${filename}${detail}`);
        return result;
      },
      CONCURRENCY
    );

    const summary = results.reduce(
      (acc, result) => {
        acc[result.status] = (acc[result.status] || 0) + 1;
        return acc;
      },
      {}
    );

    console.log('Summary:', summary);
  } finally {
    await pgClient.end();
  }
}

main().catch((error) => {
  console.error('Failed to sync uploads to R2:', error);
  process.exitCode = 1;
});
