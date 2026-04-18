import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireApiUser } from '@/lib/auth-server';
import { ensureOwnerContributorForImage } from '@/lib/owner-contributor';
import { generateWikiForImage } from '@/lib/wiki-generator';
import { persistUploadedMedia } from '@/lib/media-upload';
import {
  getAccessibleImagesForUser,
  invalidateAccessibleImagesForUser,
} from '@/lib/image-summaries';
import { generateSnapshotScript } from '@/lib/claude';
import { getEmberTitle } from '@/lib/ember-title';
import { parseConfirmedLocationContext } from '@/lib/location-suggestions';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const description = formData.get('description') as string;
    const shareToNetwork = (formData.get('shareToNetwork') as string | null) === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    let persistedMedia;
    try {
      persistedMedia = await persistUploadedMedia(file);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : 'Only images and MP4, MOV, WEBM, or M4V videos are supported',
        },
        { status: 400 }
      );
    }

    // Create database record
    const image = await prisma.image.create({
      data: {
        ownerId: auth.user.id,
        filename: persistedMedia.filename,
        mediaType: persistedMedia.mediaType,
        posterFilename: persistedMedia.posterFilename,
        durationSeconds: persistedMedia.durationSeconds,
        originalName: file.name,
        description: description || null,
        shareToNetwork,
      },
    });

    await ensureOwnerContributorForImage(image.id, auth.user.id);
    invalidateAccessibleImagesForUser(auth.user.id);

    let wikiGenerated = false;
    let warning: string | null = null;

    try {
      await generateWikiForImage(image.id);
      wikiGenerated = true;
    } catch (error) {
      console.error('Auto wiki generation failed:', error);
      warning =
        error instanceof Error
          ? error.message
          : `${persistedMedia.mediaType === 'VIDEO' ? 'Video' : 'Image'} uploaded, but the automatic wiki could not be generated`;
    }

    // Auto-generate snapshot script after analysis + wiki
    try {
      const imageForSnapshot = await prisma.image.findUnique({
        where: { id: image.id },
        include: { analysis: { select: { summary: true, metadataJson: true } } },
      });
      if (imageForSnapshot) {
        const title = getEmberTitle(imageForSnapshot);
        const summary = imageForSnapshot.analysis?.summary || null;
        const location = parseConfirmedLocationContext(imageForSnapshot.analysis?.metadataJson ?? null)?.label ?? null;
        const script = await generateSnapshotScript({ title, summary, location });
        if (script.trim()) {
          await prisma.storyCut.create({
            data: {
              imageId: image.id,
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
      }
    } catch (error) {
      console.error('Auto snapshot generation failed:', error);
    }

    if (persistedMedia.warning) {
      warning = warning ? `${persistedMedia.warning}. ${warning}` : persistedMedia.warning;
    }

    return NextResponse.json({
      id: image.id,
      mediaType: persistedMedia.mediaType,
      wikiGenerated,
      warning,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload media' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const auth = await requireApiUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(await getAccessibleImagesForUser(auth.user.id));
  } catch (error) {
    console.error('Error fetching images:', error);
    return NextResponse.json(
      { error: 'Failed to fetch images' },
      { status: 500 }
    );
  }
}
