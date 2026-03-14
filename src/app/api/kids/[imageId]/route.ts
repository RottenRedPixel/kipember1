import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireApiUser } from '@/lib/auth-server';
import { ensureImageOwnerAccess, getImageAccessType } from '@/lib/ember-access';
import { generateKidsStoryForImage, getKidsStory } from '@/lib/kids-story';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ imageId: string }> }
) {
  try {
    void request;
    const auth = await requireApiUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { imageId } = await params;
    const accessType = await getImageAccessType(auth.user.id, imageId);

    if (!accessType) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const image = await prisma.image.findUnique({
      where: { id: imageId },
      include: {
        wiki: {
          select: {
            id: true,
            version: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    const story = await getKidsStory(imageId);

    return NextResponse.json({
      image: {
        id: image.id,
        filename: image.filename,
        originalName: image.originalName,
        description: image.description,
      },
      canManage: accessType === 'owner',
      wiki: image.wiki,
      story,
    });
  } catch (error) {
    console.error('Error fetching kids story:', error);
    return NextResponse.json(
      { error: 'Failed to fetch kids story' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ imageId: string }> }
) {
  try {
    void request;
    const auth = await requireApiUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { imageId } = await params;
    const image = await ensureImageOwnerAccess(auth.user.id, imageId);

    if (!image) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const story = await generateKidsStoryForImage(imageId);

    return NextResponse.json({ success: true, story });
  } catch (error) {
    console.error('Error generating kids story:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to generate kids story',
      },
      { status: 500 }
    );
  }
}
