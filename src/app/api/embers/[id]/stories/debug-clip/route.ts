// TEST ROUTE — remove after confirming clip playback works end-to-end.
// GET /api/embers/[id]/stories/debug-clip?mediaId=xxx
// Runs the full clip resolution chain and reports exactly what fails.

import { promises as fs } from 'fs';
import { join } from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { getEmberAccessType } from '@/lib/ember';
import { resolveAudioSourceForMedia } from '@/lib/audio-segments';
import { getUploadsDir } from '@/lib/uploads';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: emberId } = await params;
  const accessType = await getEmberAccessType(auth.user.id, emberId);
  if (!accessType) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

  const mediaId = request.nextUrl.searchParams.get('mediaId');
  if (!mediaId) return NextResponse.json({ error: 'mediaId is required' }, { status: 400 });

  const result: Record<string, unknown> = { emberId, mediaId };

  // Step 1: check what DB records exist for this mediaId
  const [voiceClip, callClip, attachment] = await Promise.all([
    prisma.emberVoiceClip.findFirst({ where: { emberId, id: mediaId }, select: { id: true, audioFilename: true, startMs: true, endMs: true } }),
    prisma.emberCallClip.findFirst({ where: { emberId, id: mediaId }, select: { id: true, audioUrl: true, startMs: true, endMs: true } }),
    prisma.emberAttachment.findFirst({ where: { emberId, id: mediaId, mediaType: 'AUDIO' }, select: { id: true, filename: true } }),
  ]);

  result.dbRecords = {
    voiceClip: voiceClip ?? null,
    callClip: callClip ?? null,
    attachment: attachment ?? null,
  };

  // Step 2: resolve source
  let sourceInfo: Awaited<ReturnType<typeof resolveAudioSourceForMedia>> = null;
  try {
    sourceInfo = await resolveAudioSourceForMedia(emberId, mediaId);
    result.sourceInfo = sourceInfo;
  } catch (e) {
    result.sourceInfoError = String(e);
    return NextResponse.json(result);
  }

  if (!sourceInfo) {
    result.sourceInfo = null;
    result.verdict = 'resolveAudioSourceForMedia returned null — no DB record matched';
    return NextResponse.json(result);
  }

  // Step 3: if it's a local path, check if the file exists
  const isUrl = sourceInfo.source.startsWith('http');
  result.sourceIsUrl = isUrl;

  if (!isUrl) {
    try {
      await fs.access(sourceInfo.source);
      const stat = await fs.stat(sourceInfo.source);
      result.localFileExists = true;
      result.localFileBytes = stat.size;
    } catch {
      result.localFileExists = false;
      result.verdict = `Local file missing: ${sourceInfo.source}`;
    }
  } else {
    // HEAD request to check URL accessibility
    try {
      const head = await fetch(sourceInfo.source, { method: 'HEAD' });
      result.urlStatus = head.status;
      result.urlOk = head.ok;
      if (!head.ok) result.verdict = `URL returned ${head.status}: ${sourceInfo.source}`;
    } catch (e) {
      result.urlReachable = false;
      result.urlError = String(e);
      result.verdict = `URL unreachable: ${sourceInfo.source}`;
    }
  }

  // Step 4: check if a cached segment already exists
  const { createHash } = await import('crypto');
  const AUDIO_SEGMENT_VERSION = 'v2';
  if (sourceInfo.fallbackStartMs != null && sourceInfo.fallbackEndMs != null) {
    const cacheKey = createHash('sha1')
      .update(`${AUDIO_SEGMENT_VERSION}:${mediaId}:${sourceInfo.source}:${sourceInfo.fallbackStartMs}:${sourceInfo.fallbackEndMs}`)
      .digest('hex');
    const segPath = join(getUploadsDir(), '.segments', `${cacheKey}.m4a`);
    result.expectedSegmentPath = segPath;
    try { await fs.access(segPath); result.segmentCached = true; } catch { result.segmentCached = false; }
  } else {
    const cacheKey = createHash('sha1')
      .update(`${AUDIO_SEGMENT_VERSION}:${mediaId}:${sourceInfo.source}:full`)
      .digest('hex');
    const normPath = join(getUploadsDir(), '.normalized-audio', `${cacheKey}.m4a`);
    result.expectedNormalizedPath = normPath;
    try { await fs.access(normPath); result.normalizedCached = true; } catch { result.normalizedCached = false; }
  }

  if (!result.verdict) result.verdict = 'Source resolved OK — check ffmpeg logs if audio still silent';

  return NextResponse.json(result);
}
