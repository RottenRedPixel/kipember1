import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { ensureEmberOwnerAccess } from '@/lib/ember';
import { prisma } from '@/lib/db';
import { ensureImageAnalysisForImage } from '@/lib/image-analysis';
import { generateWikiForImage } from '@/lib/wiki-generator';
import { generateSnapshotScript } from '@/lib/snapshot-generator';
import { loadEmberSetupContext } from '@/lib/ember-setup-context';
import { parseConfirmedLocationContext } from '@/lib/location-suggestions';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    void request;
    const auth = await requireApiUser();

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const image = await ensureEmberOwnerAccess(auth.user.id, id);

    if (!image) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    await ensureImageAnalysisForImage(id);
    await generateWikiForImage(id);

    // Auto-generate snapshot script if one doesn't exist yet
    const existing = await prisma.snapshot.findUnique({ where: { imageId: id }, select: { id: true } });
    if (!existing) {
      const context = await loadEmberSetupContext(id);
      if (context) {
        const { imageTitle: title, image: imageRecord, confirmedPeople, confirmedLocation, contributorMemories, callSummaries, callHighlights } = context;
        const summary = imageRecord.analysis?.summary || null;
        const location = confirmedLocation?.label ?? parseConfirmedLocationContext(imageRecord.analysis?.metadataJson ?? null)?.label ?? null;
        try {
          const script = await generateSnapshotScript({
            title,
            summary,
            location,
            durationSeconds: 5,
            taggedPeople: confirmedPeople,
            wikiContent: imageRecord.wiki?.content ?? null,
            contributorMemories: contributorMemories.map((m) => ({ contributorName: m.contributorName, answer: m.answer })),
            callSummaries: callSummaries.map((c) => ({ contributorName: c.contributorName, summary: c.summary })),
            callHighlights: callHighlights.map((h) => ({ contributorName: h.contributorName, title: h.title, quote: h.quote })),
            promptKey: 'snapshot_generation.initial',
          });
          if (script.trim()) {
            await prisma.snapshot.create({
              data: {
                imageId: id,
                title,
                style: 'documentary',
                focus: '',
                durationSeconds: 5,
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
          }
        } catch (snapshotError) {
          console.error('Auto snapshot generation failed:', snapshotError);
        }
      }
    }

    const analysis = await prisma.imageAnalysis.findUnique({
      where: { imageId: id },
      select: {
        status: true,
        summary: true,
        visualDescription: true,
        metadataSummary: true,
        capturedAt: true,
        latitude: true,
        longitude: true,
        cameraMake: true,
        cameraModel: true,
        lensModel: true,
        metadataJson: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      analysis: analysis
        ? {
            ...analysis,
            confirmedLocation: parseConfirmedLocationContext(analysis.metadataJson),
          }
        : null,
    });
  } catch (error) {
    console.error('Manual image analysis error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to analyze image' },
      { status: 500 }
    );
  }
}
