import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAccess } from '@/lib/access-server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireAccess();
    if (access) return access;

    const { id } = await params;

    const image = await prisma.image.findUnique({
      where: { id },
      include: {
        contributors: {
          include: {
            conversation: {
              select: {
                status: true,
                currentStep: true,
              },
            },
            voiceCalls: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: {
                id: true,
                status: true,
                startedAt: true,
                endedAt: true,
                createdAt: true,
                callSummary: true,
                initiatedBy: true,
              },
            },
          },
        },
        wiki: true,
      },
    });

    if (!image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    return NextResponse.json(image);
  } catch (error) {
    console.error('Error fetching image:', error);
    return NextResponse.json(
      { error: 'Failed to fetch image' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireAccess();
    if (access) return access;

    const { id } = await params;

    await prisma.image.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting image:', error);
    return NextResponse.json(
      { error: 'Failed to delete image' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireAccess();
    if (access) return access;

    const { id } = await params;
    const body = await request.json();
    const visibilityInput = body?.visibility as string | undefined;

    if (!visibilityInput) {
      return NextResponse.json({ error: 'visibility is required' }, { status: 400 });
    }

    const visibility =
      visibilityInput === 'PUBLIC' || visibilityInput === 'SHARED' || visibilityInput === 'PRIVATE'
        ? visibilityInput
        : null;

    if (!visibility) {
      return NextResponse.json({ error: 'Invalid visibility value' }, { status: 400 });
    }

    const image = await prisma.image.update({
      where: { id },
      data: { visibility },
    });

    return NextResponse.json({ id: image.id, visibility: image.visibility });
  } catch (error) {
    console.error('Error updating image:', error);
    return NextResponse.json(
      { error: 'Failed to update image' },
      { status: 500 }
    );
  }
}
