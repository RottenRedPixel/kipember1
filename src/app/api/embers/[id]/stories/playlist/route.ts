import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { ensureEmberOwnerAccess, getEmberAccessType } from '@/lib/ember';
import { prisma } from '@/lib/db';
import { generatePlaylistNarration } from '@/lib/story-generator';
import { getEmberTitle } from '@/lib/ember-title';
import { parseConfirmedLocationContext } from '@/lib/location-suggestions';

export const runtime = 'nodejs';

// Significance values from clip extraction → facet keys they map to
const SIG_TO_FACET: Record<string, string> = {
  why: 'why',
  emotion: 'emotion',
  story: 'extra_story',
  extra_story: 'extra_story',
  place: 'place',
  person: 'person',
};

type ClipItem = {
  id: string;
  kind: 'voice' | 'call';
  speaker: string;
  quote: string;
  significance: string | null;
  startMs: number | null;
  endMs: number | null;
};

/**
 * POST /api/embers/[id]/stories/playlist
 *
 * Builds a mixed-audio blocks array: Ember narration interleaved with real
 * contributor voice clips. The LLM writes bridging narration around the clips
 * using the `story_generation.playlist` prompt.
 *
 * Returns { blocks: SnapshotBlock[] } for snapshot-audio, or
 * { blocks: null } if no matching clips exist (client falls back to /compose).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Accept session auth (owner or contributor) OR token-based guest access.
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

    const body = await request.json().catch(() => ({}));
    const facets: string[] = Array.isArray(body?.facets)
      ? (body.facets as unknown[]).filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      : [];
    const people: string[] = Array.isArray(body?.people)
      ? (body.people as unknown[]).filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      : [];
    const durationSeconds =
      typeof body?.durationSeconds === 'number' && body.durationSeconds >= 5
        ? Math.min(body.durationSeconds, 10)
        : 7;

    // Load ember context + all clips in parallel
    const [emberRecord, voiceClips, callClips] = await Promise.all([
      prisma.ember.findUnique({
        where: { id },
        select: {
          title: true,
          originalName: true,
          analysis: { select: { metadataJson: true } },
          memoryClaims: {
            select: { claimType: true, subject: true, value: true, metadataJson: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
      prisma.emberVoiceClip.findMany({
        where: { emberId: id },
        select: { id: true, speaker: true, quote: true, significance: true, startMs: true, endMs: true },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.emberCallClip.findMany({
        where: { emberId: id },
        select: { id: true, speaker: true, quote: true, significance: true, startMs: true, endMs: true },
        orderBy: { sortOrder: 'asc' },
      }),
    ]);

    if (!emberRecord) return NextResponse.json({ error: 'Ember not found' }, { status: 404 });

    // Merge all clips into a single typed list
    const allClips: ClipItem[] = [
      ...voiceClips.map((c) => ({ ...c, kind: 'voice' as const, speaker: c.speaker ?? '' })),
      ...callClips.map((c) => ({ ...c, kind: 'call' as const, speaker: c.speaker ?? '' })),
    ];

    // Filter by selected people (speaker name contains any selected first name)
    const peopleFiltered =
      people.length === 0
        ? allClips
        : allClips.filter((c) =>
            people.some(
              (p) =>
                c.speaker.toLowerCase().includes(p.toLowerCase()) ||
                p.toLowerCase().includes(c.speaker.toLowerCase().split(' ')[0])
            )
          );

    // Filter by selected facets (significance maps to facet key)
    const facetsFiltered =
      facets.length === 0
        ? peopleFiltered
        : peopleFiltered.filter((c) => {
            if (!c.significance) return true; // keep untagged clips
            const mapped = SIG_TO_FACET[c.significance] ?? c.significance;
            return facets.includes(mapped);
          });

    // Fall back to people-only filter if facet filter wiped everything out
    const selected = facetsFiltered.length > 0 ? facetsFiltered : peopleFiltered;

    if (selected.length === 0) {
      // No clips — signal client to fall back to /compose
      return NextResponse.json({ blocks: null });
    }

    // Pick up to 3 clips (prefer clips with significance over untagged)
    const ranked = [
      ...selected.filter((c) => c.significance),
      ...selected.filter((c) => !c.significance),
    ].slice(0, 3);

    // Build title + location context
    const title = getEmberTitle(emberRecord);
    const location =
      parseConfirmedLocationContext(emberRecord.analysis?.metadataJson ?? null)?.label ?? null;

    // Build claims context for the prompt (same format as /compose)
    const claimTypeLabels: Record<string, string> = {
      why: 'Why this memory matters',
      emotion: 'Emotional states',
      extra_story: 'Extra stories',
      place: 'Places mentioned',
      person: 'People mentioned',
    };
    const claimsToUse = facets.length > 0
      ? emberRecord.memoryClaims.filter((c) => facets.includes(c.claimType))
      : emberRecord.memoryClaims;
    const grouped = new Map<string, string[]>();
    for (const claim of claimsToUse) {
      const heading = claimTypeLabels[claim.claimType] ?? claim.claimType;
      const value = claim.value?.trim();
      if (!value) continue;
      const list = grouped.get(heading) ?? [];
      list.push(`- "${value}"`);
      grouped.set(heading, list);
    }
    const claimsContext = Array.from(grouped.entries())
      .map(([h, lines]) => `${h}:\n${lines.join('\n')}`)
      .join('\n\n');

    // Generate playlist narration from the LLM
    const inputClips = ranked.map((c, i) => ({
      index: i,
      speaker: c.speaker || 'Contributor',
      quote: c.quote,
    }));

    const segments = await generatePlaylistNarration({
      title,
      location,
      clips: inputClips,
      claimsContext,
      durationSeconds,
    });

    // Helper: build a media block for a clip
    type SnapshotBlock =
      | { type: 'voice'; content: string; order: number }
      | { type: 'media'; mediaId: string; mediaType: string; clipStartMs?: number; clipEndMs?: number; order: number };

    const clipBlock = (clip: ClipItem, ord: number): SnapshotBlock => {
      if (clip.kind === 'voice') {
        return { type: 'media', mediaId: clip.id, mediaType: 'AUDIO', order: ord };
      }
      if (clip.startMs != null && clip.endMs != null && clip.endMs > clip.startMs) {
        return { type: 'media', mediaId: clip.id, mediaType: 'AUDIO', clipStartMs: clip.startMs, clipEndMs: clip.endMs, order: ord };
      }
      return { type: 'media', mediaId: clip.id, mediaType: 'AUDIO', order: ord };
    };

    // Assemble blocks from LLM segments
    const blocks: SnapshotBlock[] = [];
    let order = 1;

    for (const seg of segments) {
      if (seg.type === 'narration' && seg.text) {
        blocks.push({ type: 'voice', content: seg.text, order: order++ });
      } else if (seg.type === 'clip') {
        const clip = ranked[seg.index];
        if (clip) blocks.push(clipBlock(clip, order++));
      }
    }

    // MANDATORY: if LLM narration failed or produced no clip references,
    // fall back to playing all ranked clips directly — clips are never optional.
    const hasClipBlock = blocks.some((b) => b.type === 'media');
    if (!hasClipBlock) {
      blocks.length = 0;
      order = 1;
      for (const clip of ranked) {
        blocks.push(clipBlock(clip, order++));
      }
    }

    return NextResponse.json({ blocks });
  } catch (error) {
    console.error('Playlist compose error:', error);
    return NextResponse.json({ error: 'Failed to compose playlist.' }, { status: 500 });
  }
}
