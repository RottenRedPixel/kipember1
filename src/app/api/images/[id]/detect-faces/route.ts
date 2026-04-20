import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';
import { requireApiUser } from '@/lib/auth-server';
import { ensureImageOwnerAccess } from '@/lib/ember-access';
import { prisma } from '@/lib/db';
import { getUploadPath } from '@/lib/uploads';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const image = await ensureImageOwnerAccess(auth.user.id, id);
    if (!image) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

    const record = await prisma.image.findFirst({
      where: { id, ownerId: auth.user.id },
      select: { filename: true, mediaType: true, posterFilename: true },
    });

    if (!record || record.mediaType === 'AUDIO') {
      return NextResponse.json({ faces: [] });
    }

    const sourceFilename =
      record.mediaType === 'VIDEO' && record.posterFilename
        ? record.posterFilename
        : record.filename;

    const input = await readFile(getUploadPath(sourceFilename));
    const imageBuffer = await sharp(input)
      .rotate()
      .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 78 })
      .toBuffer();

    const response = await anthropic.messages.create({
      model: process.env.ANTHROPIC_FACE_MATCH_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: `Detect all human faces in the photo. Return a JSON object with a "faces" array. Each face has leftPct, topPct, widthPct, heightPct as numbers 0-100 representing the bounding box as percentages of the image. Return JSON only, no markdown.`,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: imageBuffer.toString('base64') },
            },
            { type: 'text', text: 'List all human faces with their bounding boxes.' },
          ],
        },
      ],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '');

    let faces: { leftPct: number; topPct: number; widthPct: number; heightPct: number }[] = [];
    try {
      const parsed = JSON.parse(text) as { faces?: unknown };
      if (Array.isArray(parsed?.faces)) {
        faces = (parsed.faces as unknown[]).filter(
          (f): f is typeof faces[number] =>
            typeof (f as Record<string,unknown>).leftPct === 'number' &&
            typeof (f as Record<string,unknown>).topPct === 'number' &&
            typeof (f as Record<string,unknown>).widthPct === 'number' &&
            typeof (f as Record<string,unknown>).heightPct === 'number'
        );
      }
    } catch {
      // return empty on parse failure
    }

    return NextResponse.json({ faces });
  } catch (error) {
    console.error('Face detection error:', error);
    return NextResponse.json({ error: 'Failed to detect faces' }, { status: 500 });
  }
}
