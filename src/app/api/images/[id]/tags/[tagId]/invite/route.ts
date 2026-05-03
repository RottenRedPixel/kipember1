import { NextRequest, NextResponse } from 'next/server';
import { normalizeEmail, normalizePhone, requireApiUser } from '@/lib/auth-server';
import { sendContributorSmsInvite } from '@/lib/contributor-invites';
import { prisma } from '@/lib/db';
import { ensureEmberOwnerAccess } from '@/lib/ember';
import { invalidateSmartTitleSuggestions } from '@/lib/smart-title-suggestions';
import { generateWikiForImage } from '@/lib/wiki-generator';
import { getUserDisplayName } from '@/lib/user-name';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; tagId: string }> }
) {
  try {
    const auth = await requireApiUser();

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, tagId } = await params;
    const image = await ensureEmberOwnerAccess(auth.user.id, id);

    if (!image) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const sendText = body?.sendText !== false;

    const tag = await prisma.imageTag.findFirst({
      where: {
        id: tagId,
        imageId: id,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true,
          },
        },
        emberContributor: {
          select: {
            id: true,
            inviteSent: true,
            token: true,
            contributor: {
              select: {
                id: true,
                ownerId: true,
                name: true,
                email: true,
                phoneNumber: true,
                userId: true,
              },
            },
          },
        },
      },
    });

    if (!tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    const tagEmail = tag.user?.email || (tag.email ? normalizeEmail(tag.email) : null);
    const tagPhoneNumber = normalizePhone(tag.user?.phoneNumber || tag.phoneNumber);
    const tagName = getUserDisplayName(tag.user) || tag.emberContributor?.contributor.name || tag.label;

    type FlatContributor = {
      id: string;
      name: string | null;
      email: string | null;
      phoneNumber: string | null;
      inviteSent: boolean;
      token: string;
      userId: string | null;
    };

    const flattenEC = (ec: NonNullable<typeof tag.emberContributor>): FlatContributor => ({
      id: ec.id,
      name: ec.contributor.name,
      email: ec.contributor.email,
      phoneNumber: ec.contributor.phoneNumber,
      inviteSent: ec.inviteSent,
      token: ec.token,
      userId: ec.contributor.userId,
    });

    let contributor: FlatContributor | null = tag.emberContributor ? flattenEC(tag.emberContributor) : null;

    if (!contributor) {
      if (!tag.userId && !tagEmail && !tagPhoneNumber) {
        return NextResponse.json(
          { error: 'Add an email or phone number to this tag before inviting them' },
          { status: 400 }
        );
      }

      // Find or create the pool entry for the owner.
      let poolEntry = await prisma.contributor.findFirst({
        where: {
          ownerId: image.ownerId,
          OR: [
            ...(tag.userId ? [{ userId: tag.userId }] : []),
            ...(tagPhoneNumber ? [{ phoneNumber: tagPhoneNumber }] : []),
            ...(tagEmail ? [{ email: tagEmail }] : []),
          ],
        },
      });

      if (!poolEntry) {
        poolEntry = await prisma.contributor.create({
          data: {
            ownerId: image.ownerId,
            userId: tag.userId,
            name: tagName,
            email: tagEmail,
            phoneNumber: tagPhoneNumber,
          },
        });
      }

      // Find or create the ember-contributor join row.
      let createdEc = await prisma.emberContributor.findUnique({
        where: {
          contributorId_imageId: {
            contributorId: poolEntry.id,
            imageId: id,
          },
        },
        select: {
          id: true,
          inviteSent: true,
          token: true,
          contributor: {
            select: {
              id: true,
              ownerId: true,
              name: true,
              email: true,
              phoneNumber: true,
              userId: true,
            },
          },
        },
      });

      if (!createdEc) {
        createdEc = await prisma.emberContributor.create({
          data: {
            contributorId: poolEntry.id,
            imageId: id,
          },
          select: {
            id: true,
            inviteSent: true,
            token: true,
            contributor: {
              select: {
                id: true,
                ownerId: true,
                name: true,
                email: true,
                phoneNumber: true,
                userId: true,
              },
            },
          },
        });
      }

      contributor = flattenEC(createdEc);

      await prisma.imageTag.update({
        where: { id: tag.id },
        data: {
          emberContributorId: contributor.id,
          email: tagEmail,
          phoneNumber: tagPhoneNumber,
          label: tagName,
        },
      });
    }

    let textSent = false;

    if (sendText) {
      if (!contributor.phoneNumber) {
        return NextResponse.json(
          { error: 'A phone number is required to send a text invite for this tag' },
          { status: 400 }
        );
      }

      const inviteResult = await sendContributorSmsInvite(contributor.id);

      if (!inviteResult.success) {
        return NextResponse.json(
          { error: inviteResult.error || 'Failed to send the text invite' },
          { status: 502 }
        );
      }

      textSent = true;
      contributor = {
        ...contributor,
        inviteSent: true,
      };
    }

    await invalidateSmartTitleSuggestions(id).catch((titleError) => {
      console.error('Smart title cache reset failed after tag invite:', titleError);
    });

    await generateWikiForImage(id).catch((wikiError) => {
      console.error('Wiki refresh failed after tag invite:', wikiError);
    });

    return NextResponse.json({
      contributor,
      textSent,
    });
  } catch (error) {
    console.error('Tag invite error:', error);
    return NextResponse.json(
      { error: 'Failed to invite tagged person' },
      { status: 500 }
    );
  }
}
