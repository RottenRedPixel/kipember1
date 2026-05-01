import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';
import { requireApiUser } from '@/lib/auth-server';
import { ensureEmberOwnerAccess } from '@/lib/ember';
import { prisma } from '@/lib/db';
import { getUploadPath } from '@/lib/uploads';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const FACE_DETECT_PROMPT = `You are a face detector. Examine the image and return a tight bounding box for each visible human face.

Return ONLY a JSON object with this exact shape, no markdown, no commentary:

{
  "faces": [
    { "leftPct": <number 0-100>, "topPct": <number 0-100>, "widthPct": <number 0-100>, "heightPct": <number 0-100> }
  ]
}

Where:
- leftPct, topPct = the top-left corner of the face's bounding box, as a percentage of image width / height
- widthPct, heightPct = the box's size, as a percentage of image width / height
- Boxes should be tight to the visible face (forehead to chin, ear to ear), not generous
- Include partial faces if a recognizable portion is visible
- If the image has no faces, return { "faces": [] }
- Do not include speculation about identity — just box coordinates`;

type DetectedFace = { leftPct: number; topPct: number; widthPct: number; heightPct: number };

function isValidFace(value: unknown): value is DetectedFace {
  if (!value || typeof value !== 'object') return false;
  const f = value as Record<string, unknown>;
  return (
    typeof f.leftPct === 'number' &&
    typeof f.topPct === 'number' &&
    typeof f.widthPct === 'number' &&
    typeof f.heightPct === 'number' &&
    f.widthPct > 0 &&
    f.heightPct > 0
  );
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const ember = await ensureEmberOwnerAccess(auth.user.id, id);
    if (!ember) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

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
      max_tokens: 1500,
      system: FACE_DETECT_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: imageBuffer.toString('base64') },
            },
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

    let faces: DetectedFace[] = [];
    try {
      const parsed = JSON.parse(text) as { faces?: unknown };
      if (Array.isArray(parsed?.faces)) {
        faces = parsed.faces.filter(isValidFace);
      }
    } catch {
      // Empty response on parse failure — surfaces as "no faces detected" in the UI.
    }

    return NextResponse.json({ faces });
  } catch (error) {
    console.error('Face detection error:', error);
    return NextResponse.json({ error: 'Failed to detect faces' }, { status: 500 });
  }
}
