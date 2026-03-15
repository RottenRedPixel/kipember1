import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { ensureImageOwnerAccess, getAcceptedFriends, getImageAccessType } from '@/lib/ember-access';
import { prisma } from '@/lib/db';

export async function GET(
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
    const accessType = await getImageAccessType(auth.user.id, id);

    if (!accessType) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    const image = await prisma.image.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        contributors: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phoneNumber: true,
              },
            },
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
        tags: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phoneNumber: true,
              },
            },
            contributor: {
              select: {
                id: true,
                name: true,
                email: true,
                phoneNumber: true,
                inviteSent: true,
              },
            },
          },
        },
        wiki: {
          select: { id: true },
        },
        sportsMode: {
          select: {
            id: true,
            sportType: true,
            subjectName: true,
            finalScore: true,
            outcome: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    const friends = accessType === 'owner' ? await getAcceptedFriends(auth.user.id) : [];

    return NextResponse.json({
      id: image.id,
      filename: image.filename,
      mediaType: image.mediaType,
      posterFilename: image.posterFilename,
      durationSeconds: image.durationSeconds,
      originalName: image.originalName,
      description: image.description,
      createdAt: image.createdAt,
      shareToNetwork: image.shareToNetwork,
      owner: image.owner,
      accessType,
      canManage: accessType === 'owner',
      contributors: image.contributors,
      tags: image.tags,
      friends,
      wiki: image.wiki,
      sportsMode: image.sportsMode,
    });
  } catch (error) {
    console.error('Error fetching image:', error);
    return NextResponse.json(
      { error: 'Failed to load image' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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
    const ownedImage = await ensureImageOwnerAccess(auth.user.id, id);

    if (!ownedImage) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    await prisma.image.delete({
      where: { id: ownedImage.id },
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
    const auth = await requireApiUser();

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const ownedImage = await ensureImageOwnerAccess(auth.user.id, id);

    if (!ownedImage) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const body = await request.json();

    if (typeof body?.shareToNetwork !== 'boolean') {
      return NextResponse.json(
        { error: 'shareToNetwork must be a boolean' },
        { status: 400 }
      );
    }

    const image = await prisma.image.update({
      where: { id },
      data: {
        shareToNetwork: body.shareToNetwork,
      },
      select: {
        id: true,
        shareToNetwork: true,
      },
    });

    return NextResponse.json(image);
  } catch (error) {
    console.error('Error updating image:', error);
    return NextResponse.json(
      { error: 'Failed to update image' },
      { status: 500 }
    );
  }
}
