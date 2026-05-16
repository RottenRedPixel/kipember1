import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { getEmberAccessType } from '@/lib/ember';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * GET /api/embers/[id]/stories/clips-availability
 *
 * Returns the distinct speaker names for all EmberVoiceClip and EmberCallClip
 * records on this ember. StoriesSheet uses this to distinguish contributor
 * chips (the person has real recorded audio) from referenced chips (the person
 * is only mentioned in the wiki/claims).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const accessType = await getEmberAccessType(auth.user.id, id);
    if (!accessType) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

    const [voiceClips, callClips] = await Promise.all([
      prisma.emberVoiceClip.findMany({
        where: { emberId: id },
        select: { speaker: true },
        distinct: ['speaker'],
      }),
      prisma.emberCallClip.findMany({
        where: { emberId: id },
        select: { speaker: true },
        distinct: ['speaker'],
      }),
    ]);

    const voiceSpeakers = voiceClips.map((c) => c.speaker).filter((s): s is string => Boolean(s));
    const callSpeakers  = callClips.map((c) => c.speaker).filter((s): s is string => Boolean(s));

    return NextResponse.json({ voiceSpeakers, callSpeakers });
  } catch (error) {
    console.error('Clips availability error:', error);
    return NextResponse.json({ error: 'Failed to load clips availability' }, { status: 500 });
  }
}
