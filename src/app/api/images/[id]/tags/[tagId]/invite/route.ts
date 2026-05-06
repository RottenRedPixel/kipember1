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
            userId: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                phoneNumber: true,
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
    const tagName = getUserDisplayName(tag.user) || (tag.emberContributor?.user ? getUserDisplayName(tag.emberContributor.user) : null) || tag.label;

    type FlatContributor = {
      id: string;
      name: string | null;
      email: string | null;
      phoneNumber: string | null;
      inviteSent: boolean;
      token: string;
      userId: string;
    };

    const flattenEC = (ec: NonNullable<typeof tag.emberContributor>): FlatContributor => ({
      id: ec.id,
      name: [ec.user?.firstName, ec.user?.lastName].filter(Boolean).join(' ') || null,
      email: ec.user?.email ?? null,
      phoneNumber: ec.user?.phoneNumber ?? null,
      inviteSent: ec.inviteSent,
      token: ec.token,
      userId: ec.userId,
    });

    let contributor: FlatContributor | null = tag.emberContributor ? flattenEC(tag.emberContributor) : null;

    if (!contributor) {
      if (!tag.userId && !tagEmail && !tagPhoneNumber) {
        return NextResponse.json(
          { error: 'Add an email or phone number to this tag before inviting them' },
          { status: 400 }
        );
      }

      // Find or create the User for this contributor.
      let userEntry = tag.userId
        ? await prisma.user.findUnique({ where: { id: tag.userId } })
        : await prisma.user.findFirst({
            where: {
              OR: [
                ...(tagPhoneNumber ? [{ phoneNumber: tagPhoneNumber }] : []),
                ...(tagEmail ? [{ email: tagEmail }] : []),
              ],
            },
          });

      if (!userEntry) {
        // Build firstName/lastName from tagName
        const nameParts = (tagName || '').trim().split(/\s+/);
        userEntry = await prisma.user.create({
          data: {
            firstName: nameParts[0] || null,
            lastName: nameParts.slice(1).join(' ') || null,
            email: tagEmail,
            phoneNumber: tagPhoneNumber,
          },
        });
      }

      // Find or create the ember-contributor join row.
      let createdEc = await prisma.emberContributor.findUnique({
        where: {
          userId_imageId: {
            userId: userEntry.id,
            imageId: id,
          },
        },
        select: {
          id: true,
          inviteSent: true,
          token: true,
          userId: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
            },
          },
        },
      });

      if (!createdEc) {
        createdEc = await prisma.emberContributor.create({
          data: {
            userId: userEntry.id,
            imageId: id,
          },
          select: {
            id: true,
            inviteSent: true,
            token: true,
            userId: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                phoneNumber: true,
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
