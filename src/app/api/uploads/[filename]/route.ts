import { NextResponse } from 'next/server';
import { createReadStream, promises as fs } from 'fs';
import { extname, basename } from 'path';
import { prisma } from '@/lib/db';
import { getUploadPath } from '@/lib/uploads';
import { shouldNormalizeAudioForIos, transcodeAudioToM4a } from '@/lib/audio-processing';

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.m4v': 'video/x-m4v',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.mpga': 'audio/mpeg',
  '.mpeg': 'audio/mpeg',
};

async function resolvePlayableUpload(filename: string) {
  const ext = extname(filename).toLowerCase();
  const originalPath = getUploadPath(filename);

  if (!shouldNormalizeAudioForIos(filename)) {
    return {
      filePath: originalPath,
      contentType: CONTENT_TYPES[ext] || 'application/octet-stream',
    };
  }

  const [attachment, image] = await Promise.all([
    prisma.imageAttachment.findFirst({
      where: {
        filename,
        mediaType: 'AUDIO',
      },
      select: { id: true },
    }),
    prisma.image.findFirst({
      where: {
        filename,
        mediaType: 'AUDIO',
      },
      select: { id: true },
    }),
  ]);

  if (!attachment && !image) {
    return {
      filePath: originalPath,
      contentType: CONTENT_TYPES[ext] || 'application/octet-stream',
    };
  }

  const derivedFilename = `${basename(filename, ext)}.ios.m4a`;
  const derivedPath = getUploadPath(derivedFilename);

  try {
    await fs.access(derivedPath);
    return {
      filePath: derivedPath,
      contentType: 'audio/mp4',
    };
  } catch {
    try {
      await transcodeAudioToM4a({
        inputPath: originalPath,
        outputPath: derivedPath,
      });
      return {
        filePath: derivedPath,
        contentType: 'audio/mp4',
      };
    } catch {
      return {
        filePath: originalPath,
        contentType: CONTENT_TYPES[ext] || 'application/octet-stream',
      };
    }
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    const { filePath, contentType } = await resolvePlayableUpload(filename);

    await fs.access(filePath);
    const stat = await fs.stat(filePath);
    const range = request.headers.get('range');

    if (range) {
      const [startText, endText] = range.replace(/bytes=/, '').split('-');
      const start = Number.parseInt(startText, 10);
      const end = endText ? Number.parseInt(endText, 10) : stat.size - 1;
      const safeStart = Number.isFinite(start) ? start : 0;
      const safeEnd = Number.isFinite(end) ? Math.min(end, stat.size - 1) : stat.size - 1;
      const stream = createReadStream(filePath, {
        start: safeStart,
        end: safeEnd,
      });

      return new NextResponse(stream as unknown as BodyInit, {
        status: 206,
        headers: {
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Content-Length': String(safeEnd - safeStart + 1),
          'Content-Range': `bytes ${safeStart}-${safeEnd}/${stat.size}`,
        },
      });
    }

    const stream = createReadStream(filePath);
    return new NextResponse(stream as unknown as BodyInit, {
      headers: {
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(stat.size),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
