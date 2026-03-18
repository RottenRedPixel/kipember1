import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createGuestOwnerUser } from '@/lib/guest-embers';
import { persistUploadedMedia } from '@/lib/media-upload';
import { ensureOwnerContributorForImage } from '@/lib/owner-contributor';
import { generateWikiForImage } from '@/lib/wiki-generator';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const description = formData.get('description') as string;

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

    const guestOwner = await createGuestOwnerUser();
    const image = await prisma.image.create({
      data: {
        ownerId: guestOwner.id,
        filename: persistedMedia.filename,
        mediaType: persistedMedia.mediaType,
        posterFilename: persistedMedia.posterFilename,
        durationSeconds: persistedMedia.durationSeconds,
        originalName: file.name,
        description: description || null,
        shareToNetwork: false,
      },
    });

    const contributor = await ensureOwnerContributorForImage(image.id, guestOwner.id);
    if (!contributor) {
      throw new Error('Failed to initialize the guest memory');
    }

    let warning: string | null = null;
    try {
      await generateWikiForImage(image.id);
    } catch (error) {
      console.error('Guest auto wiki generation failed:', error);
      warning =
        error instanceof Error
          ? error.message
          : `${persistedMedia.mediaType === 'VIDEO' ? 'Video' : 'Image'} uploaded, but the automatic memory draft could not be generated`;
    }

    if (persistedMedia.warning) {
      warning = warning ? `${persistedMedia.warning}. ${warning}` : persistedMedia.warning;
    }

    return NextResponse.json({
      token: contributor.token,
      imageId: image.id,
      mediaType: persistedMedia.mediaType,
      warning,
    });
  } catch (error) {
    console.error('Guest upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload media' },
      { status: 500 }
    );
  }
}
