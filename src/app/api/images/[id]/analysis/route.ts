import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { ensureImageOwnerAccess } from '@/lib/ember-access';
import { prisma } from '@/lib/db';
import { ensureImageAnalysisForImage } from '@/lib/image-analysis';
import { generateWikiForImage } from '@/lib/wiki-generator';
import { parseConfirmedLocationContext } from '@/lib/location-suggestions';
import { generateSnapshotScript } from '@/lib/claude';
import { getEmberTitle } from '@/lib/ember-title';

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
    const image = await ensureImageOwnerAccess(auth.user.id, id);

    if (!image) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    await ensureImageAnalysisForImage(id);
    await generateWikiForImage(id);

    // Auto-generate snapshot script if one doesn't exist yet
    const existing = await prisma.snapshot.findUnique({ where: { imageId: id }, select: { id: true } });
    if (!existing) {
      const imageForSnapshot = await prisma.image.findUnique({
        where: { id },
        include: {
          analysis: { select: { summary: true, metadataJson: true } },
        },
      });
      if (imageForSnapshot) {
        const title = getEmberTitle(imageForSnapshot);
        const summary = imageForSnapshot.analysis?.summary || null;
        const location = parseConfirmedLocationContext(imageForSnapshot.analysis?.metadataJson ?? null)?.label ?? null;
        try {
          const script = await generateSnapshotScript({ title, summary, location });
          if (script.trim()) {
            await prisma.snapshot.create({
              data: {
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
