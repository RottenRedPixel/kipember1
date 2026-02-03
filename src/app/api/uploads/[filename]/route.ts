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

    const stream = createReadStream(filePath);
    const contentType =
      CONTENT_TYPES[extname(filename).toLowerCase()] || 'application/octet-stream';

    return new NextResponse(stream as unknown as BodyInit, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
