import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAccess } from '@/lib/access-server';
import { generateKidsStoryForImage, getKidsStory } from '@/lib/kids-story';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ imageId: string }> }
) {
  try {
    void request;
    const access = await requireAccess();
    if (access) return access;

    const { imageId } = await params;

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
    const access = await requireAccess();
    if (access) return access;

    const { imageId } = await params;
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
