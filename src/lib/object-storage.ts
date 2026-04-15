import { createReadStream } from 'fs';
import { S3Client, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { inferUploadMimeType } from '@/lib/uploads';

type ObjectStorageConfig = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

type StoredUploadObject = {
  body: BodyInit;
  contentType: string | null;
  contentLength: string | null;
  contentRange: string | null;
  etag: string | null;
  lastModified: string | null;
};

let cachedClient: S3Client | null = null;

function getObjectStorageConfig(): ObjectStorageConfig | null {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET?.trim() || 'ember-media-prod';

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    return null;
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
  };
}

function getObjectStorageClient(config: ObjectStorageConfig) {
  if (!cachedClient) {
    cachedClient = new S3Client({
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  return cachedClient;
}

function getObjectStorageKey(filename: string) {
  return filename;
}

function isNotFoundError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const maybeError = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return (
    maybeError.name === 'NoSuchKey' ||
    maybeError.name === 'NotFound' ||
    maybeError.$metadata?.httpStatusCode === 404
  );
}

export function isObjectStorageConfigured() {
  return Boolean(getObjectStorageConfig());
}

export async function uploadLocalFileToObjectStorage({
  filename,
  filePath,
  contentType,
}: {
  filename: string;
  filePath: string;
  contentType?: string | null;
}) {
  const config = getObjectStorageConfig();
  if (!config) {
    return false;
  }

  const client = getObjectStorageClient(config);
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: getObjectStorageKey(filename),
      Body: createReadStream(filePath),
      ContentType: contentType || inferUploadMimeType(filename) || undefined,
    })
  );

  return true;
}

export async function uploadBufferToObjectStorage({
  filename,
  body,
  contentType,
}: {
  filename: string;
  body: Buffer;
  contentType?: string | null;
}) {
  const config = getObjectStorageConfig();
  if (!config) {
    return false;
  }

  const client = getObjectStorageClient(config);
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: getObjectStorageKey(filename),
      Body: body,
      ContentType: contentType || inferUploadMimeType(filename) || undefined,
    })
  );

  return true;
}

export async function objectStorageHasUpload(filename: string) {
  const config = getObjectStorageConfig();
  if (!config) {
    return false;
  }

  const client = getObjectStorageClient(config);

  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: config.bucket,
        Key: getObjectStorageKey(filename),
      })
    );
    return true;
  } catch (error) {
    if (isNotFoundError(error)) {
      return false;
    }
    throw error;
  }
}

export async function getUploadFromObjectStorage({
  filename,
  range,
}: {
  filename: string;
  range?: string | null;
}): Promise<StoredUploadObject | null> {
  const config = getObjectStorageConfig();
  if (!config) {
    return null;
  }

  const client = getObjectStorageClient(config);

  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: getObjectStorageKey(filename),
        Range: range || undefined,
      })
    );

    if (!response.Body) {
      return null;
    }

    return {
      body: response.Body as BodyInit,
      contentType: response.ContentType ?? inferUploadMimeType(filename),
      contentLength:
        typeof response.ContentLength === 'number' ? String(response.ContentLength) : null,
      contentRange: response.ContentRange ?? null,
      etag: response.ETag ?? null,
      lastModified: response.LastModified?.toUTCString() ?? null,
    };
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}
