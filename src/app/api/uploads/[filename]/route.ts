import { NextResponse } from 'next/server';
import { createReadStream, promises as fs } from 'fs';
import { join, extname } from 'path';

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
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    const uploadsDir =
      process.env.UPLOADS_DIR || join(process.cwd(), 'public', 'uploads');
    const filePath = join(uploadsDir, filename);

    await fs.access(filePath);
    const stat = await fs.stat(filePath);
    const range = request.headers.get('range');

    const contentType =
      CONTENT_TYPES[extname(filename).toLowerCase()] || 'application/octet-stream';

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
