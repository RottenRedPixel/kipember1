import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { prisma } from '@/lib/db';

async function requireOwnedAttachment(userId: string, imageId: string, attachmentId: string) {
  const attachment = await prisma.imageAttachment.findFirst({
    where: {
      id: attachmentId,
      imageId,
      image: {
        ownerId: userId,
      },
    },
  });

  return attachment;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const auth = await requireApiUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, attachmentId } = await params;
    const attachment = await requireOwnedAttachment(auth.user.id, id, attachmentId);

    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    const body = await request.json();
    if (typeof body?.description !== 'string' && body?.description !== null) {
      return NextResponse.json({ error: 'description must be a string or null' }, { status: 400 });
    }

    const nextDescription =
      typeof body.description === 'string' && body.description.trim().length > 0
        ? body.description.trim()
        : null;

    const updated = await prisma.imageAttachment.update({
      where: { id: attachment.id },
      data: {
        description: nextDescription,
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

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Attachment update error:', error);
    return NextResponse.json({ error: 'Failed to update content' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    void request;
    const auth = await requireApiUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, attachmentId } = await params;
    const attachment = await requireOwnedAttachment(auth.user.id, id, attachmentId);

    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    await prisma.imageAttachment.delete({
      where: { id: attachment.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Attachment delete error:', error);
    return NextResponse.json({ error: 'Failed to remove content' }, { status: 500 });
  }
}
