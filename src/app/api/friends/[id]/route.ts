import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { prisma } from '@/lib/db';

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
    const { action } = await request.json();

    const friendship = await prisma.friendship.findUnique({
      where: { id },
    });

    if (!friendship) {
      return NextResponse.json({ error: 'Friend request not found' }, { status: 404 });
    }

    if (action === 'accept') {
      if (friendship.addresseeId !== auth.user.id || friendship.status !== 'pending') {
        return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
      }

      const updated = await prisma.friendship.update({
        where: { id },
        data: {
          status: 'accepted',
          respondedAt: new Date(),
        },
      });

      return NextResponse.json({ friendship: updated });
    }

    if (action === 'decline') {
      if (friendship.addresseeId !== auth.user.id || friendship.status !== 'pending') {
        return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
      }

      const updated = await prisma.friendship.update({
        where: { id },
        data: {
          status: 'declined',
          respondedAt: new Date(),
        },
      });

      return NextResponse.json({ friendship: updated });
    }

    if (action === 'cancel') {
      if (friendship.requesterId !== auth.user.id || friendship.status !== 'pending') {
        return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
      }

      await prisma.friendship.delete({
        where: { id },
      });

      return NextResponse.json({ success: true });
    }

    if (action === 'remove') {
      if (
        friendship.status !== 'accepted' ||
        (friendship.requesterId !== auth.user.id && friendship.addresseeId !== auth.user.id)
      ) {
        return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
      }

      await prisma.friendship.delete({
        where: { id },
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Friend action error:', error);
    return NextResponse.json(
      { error: 'Failed to update friend request' },
      { status: 500 }
    );
  }
}
