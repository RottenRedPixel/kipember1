import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { ensureEmberOwnerAccess } from '@/lib/ember';
import { prisma } from '@/lib/db';
import { generateStoryScript } from '@/lib/story-generator';
import { getEmberTitle } from '@/lib/ember-title';
import { parseConfirmedLocationContext } from '@/lib/location-suggestions';
import { getUserDisplayName } from '@/lib/user-name';
import { parseCallTranscriptSegments } from '@/lib/ember-clips';

export const runtime = 'nodejs';

// Resolve the display name from a claim's metadataJson sourceLabel.
function claimSourceLabel(metadataJson: string | null): string {
  if (!metadataJson) return '';
  try {
    const parsed = JSON.parse(metadataJson) as { sourceLabel?: unknown };
    return typeof parsed.sourceLabel === 'string' ? parsed.sourceLabel.trim() : '';
  } catch {
    return '';
  }
}

// POST — compose a story script from the user-selected facets and people.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const ember = await ensureEmberOwnerAccess(auth.user.id, id);
    if (!ember) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    // facets: claim type keys the user selected (e.g. ['why', 'emotion', 'place'])
    const facets: string[] = Array.isArray(body?.facets)
      ? (body.facets as unknown[]).filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      : [];
    // people: first-name strings of tagged people the user selected ([] = no filter)
    const people: string[] = Array.isArray(body?.people)
      ? (body.people as unknown[]).filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      : [];
    const durationSeconds =
      typeof body?.durationSeconds === 'number' && body.durationSeconds >= 5
        ? body.durationSeconds
        : 7;

    if (facets.length === 0 && people.length === 0) {
      return NextResponse.json({ error: 'Select at least one facet or person.' }, { status: 400 });
    }

    // Load ember base data
    const emberRecord = await prisma.ember.findUnique({
      where: { id },
      select: {
        title: true,
        originalName: true,
        analysis: {
          select: { metadataJson: true, capturedAt: true },
        },
        tags: {
          orderBy: { createdAt: 'asc' },
          select: {
            label: true,
            user: { select: { firstName: true, lastName: true } },
            emberContributor: {
              select: { user: { select: { firstName: true, lastName: true, email: true } } },
            },
          },
        },
        wiki: { select: { content: true } },
        memoryClaims: {
          where: { claimType: { in: facets } },
          select: { claimType: true, subject: true, value: true, metadataJson: true },
          orderBy: { createdAt: 'asc' },
        },
        emberContributors: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true, phoneNumber: true } },
            emberSession: {
              include: {
                messages: {
                  where: { role: 'user' },
                  orderBy: { createdAt: 'asc' },
                  select: { questionType: true, content: true, source: true },
                },
              },
            },
            voiceCalls: {
              orderBy: { createdAt: 'desc' },
              take: 3,
              select: {
                callSummary: true,
                transcript: true,
                transcriptObjectJson: true,
              },
            },
          },
        },
      },
    });

    if (!emberRecord) return NextResponse.json({ error: 'Ember not found' }, { status: 404 });

    const title = getEmberTitle(emberRecord);
    const location =
      parseConfirmedLocationContext(emberRecord.analysis?.metadataJson ?? null)?.label ?? null;

    const taggedPeople = Array.from(
      new Set(
        emberRecord.tags
          .map((t) => getUserDisplayName(t.user) || getUserDisplayName(t.emberContributor?.user) || t.label)
          .map((l) => l?.trim())
          .filter((l): l is string => Boolean(l))
      )
    );

    // Filter claims by selected people (if any)
    const claimsToUse =
      people.length > 0
        ? emberRecord.memoryClaims.filter((c) => {
            const label = claimSourceLabel(c.metadataJson).toLowerCase();
            return people.some((p) => label.includes(p.toLowerCase()));
          })
        : emberRecord.memoryClaims;

    const wikiContent = emberRecord.wiki?.content ?? null;

    // Only bail if there is truly nothing to work with
    if (claimsToUse.length === 0 && !wikiContent) {
      return NextResponse.json(
        { error: 'No material found for this ember yet.' },
        { status: 400 }
      );
    }

    // Format claims into readable context
    const claimTypeLabels: Record<string, string> = {
      why: 'Why this memory matters',
      emotion: 'Emotional states',
      extra_story: 'Extra stories',
      place: 'Places mentioned',
      person: 'People mentioned',
    };
    const grouped = new Map<string, string[]>();
    for (const claim of claimsToUse) {
      const heading = claimTypeLabels[claim.claimType] ?? claim.claimType;
      const source = claimSourceLabel(claim.metadataJson);
      const subject = claim.subject?.trim();
      const value = claim.value?.trim();
      if (!value) continue;
      const line = subject
        ? `- ${source} said about ${subject}: "${value}"`
        : `- ${source} said: "${value}"`;
      const list = grouped.get(heading) ?? [];
      list.push(line);
      grouped.set(heading, list);
    }
    const claimsContext = Array.from(grouped.entries())
      .map(([h, lines]) => `${h}:\n${lines.join('\n')}`)
      .join('\n\n');

    // Build VERBATIM QUOTES — the actual words people typed or said, attributed
    // and channel-labeled. This is the raw material the prompt is required to
    // quote from. Filtered by selected people when the user picked any.
    const peopleFilter = (name: string) =>
      people.length === 0 ||
      people.some((p) => name.toLowerCase().includes(p.toLowerCase()));

    const verbatimLines: string[] = [];
    const callSummaryLines: string[] = [];

    for (const ec of emberRecord.emberContributors) {
      const name =
        getUserDisplayName(ec.user) ||
        ec.user?.email ||
        ec.user?.phoneNumber ||
        'Contributor';
      if (!peopleFilter(name)) continue;

      // Chat / voice / sms messages (each EmberMessage with role='user')
      for (const m of ec.emberSession?.messages ?? []) {
        const text = m.content?.trim();
        if (!text) continue;
        const channel = m.source === 'voice' ? 'voice' : m.source === 'sms' ? 'sms' : 'chat';
        verbatimLines.push(`[${channel}] ${name}: "${text.replace(/"/g, "'")}"`);
      }

      // Call transcripts — every user-role turn becomes a verbatim line
      for (const v of ec.voiceCalls) {
        const segments = parseCallTranscriptSegments({
          transcript: v.transcript,
          transcriptObjectJson: v.transcriptObjectJson,
          contributorName: name,
        });
        for (const seg of segments) {
          if (seg.role !== 'user') continue;
          const text = seg.content?.trim();
          if (!text) continue;
          verbatimLines.push(`[call] ${name}: "${text.replace(/"/g, "'")}"`);
        }
        const summary = v.callSummary?.trim();
        if (summary) callSummaryLines.push(`${name}: ${summary}`);
      }
    }

    const verbatimQuotes = verbatimLines.join('\n');
    const contributorMemoriesContext = callSummaryLines.join('\n');

    // If the user explicitly selected one or more people, REQUIRE at least
    // one direct quote per selected speaker who actually has verbatim
    // material on file. The prompt enforces it. We compute the set here so
    // we don't ask for impossible quotes (selected person with no recorded
    // chat / voice / call content).
    const requiredQuoteSpeakers = people.length === 0
      ? []
      : people.filter((p) =>
          verbatimLines.some((line) => line.toLowerCase().includes(p.toLowerCase())),
        );
    const requiredQuotesInstruction = requiredQuoteSpeakers.length > 0
      ? `REQUIRED: include at least one direct verbatim quote (in straight double quotes "...") from each of these speakers, copied EXACTLY from the VERBATIM QUOTES section: ${requiredQuoteSpeakers.join(', ')}.`
      : '';

    const script = await generateStoryScript({
      title,
      location,
      taggedPeople,
      selectedPeople: people,
      durationSeconds,
      claimsContext,
      contributorMemoriesContext,
      wikiContent,
      verbatimQuotes,
      requiredQuotesInstruction,
    });

    if (!script.trim()) {
      return NextResponse.json({ error: 'Could not compose a story.' }, { status: 500 });
    }

    return NextResponse.json({ script });
  } catch (error) {
    console.error('Story compose error:', error);
    return NextResponse.json({ error: 'Failed to compose story.' }, { status: 500 });
  }
}
