import { NextRequest, NextResponse } from 'next/server';
import { createReadStream, promises as fs } from 'fs';
import { requireApiUser } from '@/lib/auth-server';
import { getEmberAccessType } from '@/lib/ember-access';
import { getOrCreateAudioSegmentPath, resolveAudioSourceForMedia } from '@/lib/audio-segments';

function parseBoundedMs(value: string | null, fallback: number | null = null) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const accessType = await getEmberAccessType(auth.user.id, id);
    if (!accessType) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const mediaId = request.nextUrl.searchParams.get('mediaId') || '';
    if (!mediaId) {
      return NextResponse.json({ error: 'mediaId is required' }, { status: 400 });
    }

    const sourceInfo = await resolveAudioSourceForMedia(id, mediaId);
    if (!sourceInfo) {
      return NextResponse.json({ error: 'Audio source not found' }, { status: 404 });
    }

    const startMs = parseBoundedMs(
      request.nextUrl.searchParams.get('startMs'),
      sourceInfo.fallbackStartMs
    );
    const endMs = parseBoundedMs(
      request.nextUrl.searchParams.get('endMs'),
      sourceInfo.fallbackEndMs
    );

    if (startMs == null || endMs == null || endMs <= startMs) {
      return NextResponse.json({ error: 'Valid startMs and endMs are required' }, { status: 400 });
    }

    const outputPath = await getOrCreateAudioSegmentPath({
      imageId: id,
      mediaId,
      startMs,
      endMs,
    });

    const stat = await fs.stat(outputPath);
    const stream = createReadStream(outputPath);

    return new NextResponse(stream as unknown as BodyInit, {
      headers: {
        'Content-Type': 'audio/mp4',
        'Content-Length': String(stat.size),
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Audio segment error:', error);
    return NextResponse.json({ error: 'Failed to prepare audio segment' }, { status: 500 });
  }
}
