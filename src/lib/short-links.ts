import { randomBytes } from 'crypto';
import { prisma } from '@/lib/db';
import { getAppBaseUrl, getShortLinkBaseUrl } from '@/lib/app-url';

function normalizeUrl(url: string): string {
  return url.replace(/\/$/, '');
}

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function buildTargetUrl(target: string): string {
  if (isAbsoluteUrl(target)) {
    return normalizeUrl(target);
  }

  const normalizedPath = target.startsWith('/') ? target : `/${target}`;
  return `${getAppBaseUrl()}${normalizedPath}`;
}

function generateShortCode(): string {
  return randomBytes(4).toString('hex');
}

export function buildShortLinkUrl(code: string): string {
  return `${getShortLinkBaseUrl()}/s/${code}`;
}

export async function getOrCreateShortLink(target: string) {
  const targetUrl = buildTargetUrl(target);

  const existing = await prisma.shortLink.findUnique({
    where: { targetUrl },
  });

  if (existing) {
    return {
      ...existing,
      shortUrl: buildShortLinkUrl(existing.code),
      targetUrl,
    };
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateShortCode();

    try {
      const created = await prisma.shortLink.create({
        data: {
          code,
          targetUrl,
        },
      });

      return {
        ...created,
        shortUrl: buildShortLinkUrl(created.code),
        targetUrl,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (!message.toLowerCase().includes('unique')) {
        throw error;
      }
    }
  }

  throw new Error('Failed to generate a unique short link');
}
