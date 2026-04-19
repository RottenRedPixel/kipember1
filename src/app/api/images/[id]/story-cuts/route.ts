import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { ensureImageOwnerAccess } from '@/lib/ember-access';
import { prisma } from '@/lib/db';
import { generateSnapshotScript } from '@/lib/claude';
import { parseConfirmedLocationContext } from '@/lib/location-suggestions';
import { loadEmberSetupContext } from '@/lib/ember-setup-context';

export const runtime = 'nodejs';

// POST — generate (or regenerate) the snapshot script via Claude
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const image = await ensureImageOwnerAccess(auth.user.id, id);
    if (!image) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const manualScript = typeof body?.script === 'string' && body.script.trim() ? body.script.trim() : null;
    const durationSeconds = typeof body?.durationSeconds === 'number' && body.durationSeconds >= 5 ? body.durationSeconds : 30;
    const style = typeof body?.style === 'string' && body.style.trim() ? body.style.trim() : 'documentary';
    const emberVoiceId = body?.emberVoiceId === null ? null : (typeof body?.emberVoiceId === 'string' && body.emberVoiceId.trim() ? body.emberVoiceId.trim() : undefined);

    const context = await loadEmberSetupContext(id);
    if (!context) return NextResponse.json({ error: 'Ember not found' }, { status: 404 });

    const { image: imageRecord, imageTitle: title, confirmedPeople, confirmedLocation, contributorMemories, callSummaries, callHighlights } = context;
    const summary = imageRecord.analysis?.summary || null;
    const location = confirmedLocation?.label ?? parseConfirmedLocationContext(imageRecord.analysis?.metadataJson ?? null)?.label ?? null;

    const script = manualScript ?? await generateSnapshotScript({
      title,
      summary,
      location,
      durationSeconds,
      taggedPeople: confirmedPeople,
      wikiContent: imageRecord.wiki?.content ?? null,
      contributorMemories: contributorMemories.map((m) => ({ contributorName: m.contributorName, answer: m.answer })),
      callSummaries: callSummaries.map((c) => ({ contributorName: c.contributorName, summary: c.summary })),
      callHighlights: callHighlights.map((h) => ({ contributorName: h.contributorName, title: h.title, quote: h.quote })),
    });

    if (!script.trim()) {
      return NextResponse.json({ error: 'Could not generate snapshot text' }, { status: 500 });
    }

    const storyCut = await prisma.storyCut.upsert({
      where: { imageId: id },
      update: {
        title,
        script,
        style,
        durationSeconds,
        wordCount: script.split(/\s+/).filter(Boolean).length,
        ...(emberVoiceId !== undefined ? { emberVoiceId } : {}),
      },
      create: {
        imageId: id,
        title,
        style,
        focus: '',
        durationSeconds,
        wordCount: script.split(/\s+/).filter(Boolean).length,
        script,
        blocksJson: '[]',
        selectedMediaJson: '[]',
        selectedContributorJson: '[]',
        includeOwner: true,
        includeEmberVoice: true,
        includeNarratorVoice: false,
      },
    });

    return NextResponse.json({
      storyCut: {
        title: storyCut.title,
        script: storyCut.script,
        wordCount: storyCut.wordCount,
        updatedAt: storyCut.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Snapshot generation error:', error);
    return NextResponse.json({ error: 'Failed to generate snapshot' }, { status: 500 });
  }
}

// PATCH — save manual edits to the script
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const image = await ensureImageOwnerAccess(auth.user.id, id);
    if (!image) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const script = typeof body?.script === 'string' && body.script.trim() ? body.script.trim() : '';
    const title = typeof body?.title === 'string' && body.title.trim() ? body.title.trim() : null;
    const durationSeconds = typeof body?.durationSeconds === 'number' && body.durationSeconds >= 5 ? body.durationSeconds : null;
    const style = typeof body?.style === 'string' && body.style.trim() ? body.style.trim() : null;
    const emberVoiceId = body?.emberVoiceId === null ? null : (typeof body?.emberVoiceId === 'string' && body.emberVoiceId.trim() ? body.emberVoiceId.trim() : undefined);

    if (!script) {
      return NextResponse.json({ error: 'Snapshot script is required' }, { status: 400 });
    }

    const existing = await prisma.storyCut.findUnique({ where: { imageId: id } });
    if (!existing) {
      return NextResponse.json({ error: 'Generate a snapshot before editing it' }, { status: 404 });
    }

    const updated = await prisma.storyCut.update({
      where: { imageId: id },
      data: {
        script,
        title: title || existing.title,
        wordCount: script.split(/\s+/).filter(Boolean).length,
        ...(durationSeconds !== null ? { durationSeconds } : {}),
        ...(style !== null ? { style } : {}),
        ...(emberVoiceId !== undefined ? { emberVoiceId } : {}),
      },
    });

    return NextResponse.json({
      storyCut: {
        title: updated.title,
        script: updated.script,
        durationSeconds: updated.durationSeconds,
        wordCount: updated.wordCount,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Snapshot update error:', error);
    return NextResponse.json({ error: 'Failed to update snapshot' }, { status: 500 });
  }
}
