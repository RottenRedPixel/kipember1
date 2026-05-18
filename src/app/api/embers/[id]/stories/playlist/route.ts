import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { getEmberAccessType } from '@/lib/ember';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * POST /api/embers/[id]/stories/playlist
 *
 * EXPERIMENT (2026-05-17): text-only stories.
 *
 * Historically this route wove real contributor audio clips
 * (EmberVoiceClip / EmberCallClip) between LLM-written bridging narration.
 * The clip-extraction pipeline kept producing clips whose displayed quote
 * didn't match the audio they sliced — quotes paraphrased, audio defaulted
 * to the first user turn ("Hello?"). After three days of fighting that
 * mismatch, we removed the audio-clip weave from Stories entirely.
 *
 * Now: always return { blocks: null } so the client falls through to
 * `/compose`, which writes a single narrator script from chat / voice /
 * call transcripts + claims + wiki. ElevenLabs renders the whole story
 * as narrator audio. Truthful by design — the narrator is clearly the AI
 * summarising, not pretending to be a contributor.
 *
 * To re-enable clip weaving later, restore from git history (commit
 * before the bypass). The full prior logic is preserved there.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Auth gate is kept so guests / contributors / owners get the same 401/403
  // shape they did before. The actual story generation happens in /compose.
  const tokenParam = request.nextUrl.searchParams.get('token');
  if (tokenParam) {
    const [contributor, emberByShare] = await Promise.all([
      prisma.emberContributor.findUnique({ where: { token: tokenParam }, select: { emberId: true } }),
      prisma.ember.findUnique({ where: { shareToken: tokenParam }, select: { id: true } }),
    ]);
    const allowed = contributor?.emberId === id || emberByShare?.id === id;
    if (!allowed) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  } else {
    const auth = await requireApiUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const accessType = await getEmberAccessType(auth.user.id, id);
    if (!accessType || accessType === 'network') {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }
  }

  return NextResponse.json({ blocks: null });
}
