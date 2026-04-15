import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { ensureImageOwnerAccess } from '@/lib/ember-access';
import { prisma } from '@/lib/db';
import { ensureImageAnalysisForImage } from '@/lib/image-analysis';
import { generateWikiForImage } from '@/lib/wiki-generator';
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
    const image = await ensureImageOwnerAccess(auth.user.id, id);

    if (!image) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    await ensureImageAnalysisForImage(id);
    await generateWikiForImage(id);

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
