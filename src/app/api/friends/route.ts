import { NextRequest, NextResponse } from 'next/server';
import { normalizeEmail, requireApiUser } from '@/lib/auth-server';
import { sendFriendRequestEmail } from '@/lib/auth-email';
import { createUserAccount } from '@/lib/auth-users';
import { prisma } from '@/lib/db';
import {
  getFriendNetworkForUser,
  invalidateFriendNetworkForUser,
} from '@/lib/friend-network';
import { invalidateAccessibleImagesForUser } from '@/lib/image-summaries';
import { getUserDisplayName } from '@/lib/user-name';

export async function GET() {
  try {
    const auth = await requireApiUser();

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(await getFriendNetworkForUser(auth.user.id));
  } catch (error) {
    console.error('Friends fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to load friend network' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUser();

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Friend email is required' }, { status: 400 });
    }

    const normalizedEmail = normalizeEmail(email);

    if (normalizedEmail === auth.user.email) {
      return NextResponse.json(
        { error: 'You cannot add yourself to your network' },
        { status: 400 }
      );
    }

    const targetUser =
      (await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true },
      })) ||
      (await createUserAccount({
        email: normalizedEmail,
        phoneNumber: null,
        firstName: null,
        lastName: null,
      }));

    const existingFriendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: auth.user.id, addresseeId: targetUser.id },
          { requesterId: targetUser.id, addresseeId: auth.user.id },
        ],
      },
    });

    if (existingFriendship?.status === 'accepted') {
      return NextResponse.json(
        { error: 'That person is already in your Ember network' },
        { status: 400 }
      );
    }

    if (existingFriendship?.status === 'pending') {
      if (existingFriendship.addresseeId === auth.user.id) {
        const accepted = await prisma.friendship.update({
          where: { id: existingFriendship.id },
          data: {
            status: 'accepted',
            respondedAt: new Date(),
          },
        });

        invalidateFriendNetworkForUser(auth.user.id);
        invalidateFriendNetworkForUser(targetUser.id);
        invalidateAccessibleImagesForUser(auth.user.id);
        invalidateAccessibleImagesForUser(targetUser.id);

        return NextResponse.json({ friendship: accepted, autoAccepted: true });
      }

      return NextResponse.json(
        { error: 'A friend request is already pending' },
        { status: 400 }
      );
    }

    const friendship = existingFriendship
      ? await prisma.friendship.update({
          where: { id: existingFriendship.id },
          data: {
            requesterId: auth.user.id,
            addresseeId: targetUser.id,
            status: 'pending',
            respondedAt: null,
          },
        })
      : await prisma.friendship.create({
          data: {
            requesterId: auth.user.id,
            addresseeId: targetUser.id,
          },
        });

    try {
      const requesterName = getUserDisplayName(auth.user) || auth.user.email;
      await sendFriendRequestEmail({
        toEmail: targetUser.email,
        requesterName,
      });
    } catch (emailError) {
      console.error('Friend request email failed:', emailError);
    }

    invalidateFriendNetworkForUser(auth.user.id);

    return NextResponse.json({ friendship });
  } catch (error) {
    console.error('Friend request error:', error);
    return NextResponse.json(
      { error: 'Failed to add friend' },
      { status: 500 }
    );
  }
}
