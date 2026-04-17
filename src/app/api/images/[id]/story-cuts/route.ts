import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { ensureImageOwnerAccess } from '@/lib/ember-access';
import { prisma } from '@/lib/db';
import { generateSnapshotScript } from '@/lib/claude';
import { getEmberTitle } from '@/lib/ember-title';
import { parseConfirmedLocationContext } from '@/lib/location-suggestions';

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

    const imageRecord = await prisma.image.findUnique({
      where: { id },
      include: {
        analysis: { select: { summary: true, metadataJson: true } },
      },
    });

    if (!imageRecord) return NextResponse.json({ error: 'Ember not found' }, { status: 404 });

    const title = getEmberTitle(imageRecord);
    const summary = imageRecord.analysis?.summary || null;
    const location = parseConfirmedLocationContext(imageRecord.analysis?.metadataJson ?? null)?.label ?? null;

    const script = manualScript ?? await generateSnapshotScript({ title, summary, location });

    if (!script.trim()) {
      return NextResponse.json({ error: 'Could not generate snapshot text' }, { status: 500 });
    }

    const storyCut = await prisma.storyCut.upsert({
      where: { imageId: id },
      update: {
        title,
        script,
        wordCount: script.split(/\s+/).filter(Boolean).length,
      },
      create: {
        imageId: id,
        title,
        style: 'documentary',
        focus: '',
        durationSeconds: 10,
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
      },
    });

    return NextResponse.json({
      storyCut: {
        title: updated.title,
        script: updated.script,
        wordCount: updated.wordCount,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Snapshot update error:', error);
    return NextResponse.json({ error: 'Failed to update snapshot' }, { status: 500 });
  }
}
