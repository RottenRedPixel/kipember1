import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { ensureImageOwnerAccess } from '@/lib/ember-access';
import { prisma } from '@/lib/db';
import { persistUploadedMedia } from '@/lib/media-upload';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const image = await ensureImageOwnerAccess(auth.user.id, id);

    if (!image) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const rawDescription = formData.get('description');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const description =
      typeof rawDescription === 'string' && rawDescription.trim().length > 0
        ? rawDescription.trim()
        : null;

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

    const attachment = await prisma.imageAttachment.create({
      data: {
        imageId: image.id,
        filename: persistedMedia.filename,
        mediaType: persistedMedia.mediaType,
        posterFilename: persistedMedia.posterFilename,
        durationSeconds: persistedMedia.durationSeconds,
        originalName: file.name,
        description,
      },
      select: {
        id: true,
        filename: true,
        mediaType: true,
        posterFilename: true,
        durationSeconds: true,
        originalName: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      attachment,
      warning: persistedMedia.warning,
    });
  } catch (error) {
    console.error('Attachment upload error:', error);
    return NextResponse.json({ error: 'Failed to add content' }, { status: 500 });
  }
}
