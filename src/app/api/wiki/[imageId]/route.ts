import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateWikiForImage } from '@/lib/wiki-generator';
import { requireAccess } from '@/lib/access-server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ imageId: string }> }
) {
  try {
    const access = await requireAccess();
    if (access) return access;

    const { imageId } = await params;

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

    return NextResponse.json(wiki);
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
    const access = await requireAccess();
    if (access) return access;

    const { imageId } = await params;

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
