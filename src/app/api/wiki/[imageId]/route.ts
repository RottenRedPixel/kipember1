import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateWikiForImage } from '@/lib/wiki-generator';
import { requireApiUser } from '@/lib/auth-server';
import { ensureImageOwnerAccess, getImageAccessType } from '@/lib/ember-access';

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

    const wiki = await prisma.wiki.findUnique({
      where: { imageId },
      include: {
        image: {
          select: {
            originalName: true,
            description: true,
            filename: true,
          },
        },
      },
    });

    if (!wiki) {
      return NextResponse.json({ error: 'Wiki not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...wiki,
      canManage: accessType === 'owner',
    });
  } catch (error) {
    console.error('Error fetching wiki:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wiki' },
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

    const content = await generateWikiForImage(imageId);

    return NextResponse.json({ success: true, content });
  } catch (error) {
    console.error('Error generating wiki:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate wiki' },
      { status: 500 }
    );
  }
}
