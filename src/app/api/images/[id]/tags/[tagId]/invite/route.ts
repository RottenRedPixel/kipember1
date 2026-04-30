import { NextRequest, NextResponse } from 'next/server';
import { normalizeEmail, normalizePhone, requireApiUser } from '@/lib/auth-server';
import { sendContributorSmsInvite } from '@/lib/contributor-invites';
import { prisma } from '@/lib/db';
import { ensureImageOwnerAccess } from '@/lib/ember-access';
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
    const image = await ensureImageOwnerAccess(auth.user.id, id);

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
        contributor: {
          select: {
            id: true,
            name: true,
            email: true,
            phoneNumber: true,
            inviteSent: true,
            token: true,
            userId: true,
          },
        },
      },
    });

    if (!tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    const tagEmail = tag.user?.email || (tag.email ? normalizeEmail(tag.email) : null);
    const tagPhoneNumber = normalizePhone(tag.user?.phoneNumber || tag.phoneNumber);
    const tagName = getUserDisplayName(tag.user) || tag.contributor?.name || tag.label;

    let contributor = tag.contributor
      ? await prisma.contributor.findUnique({
          where: { id: tag.contributor.id },
          select: {
            id: true,
            name: true,
            email: true,
            phoneNumber: true,
            inviteSent: true,
            token: true,
            userId: true,
          },
        })
      : null;

    if (!contributor) {
      if (!tag.userId && !tagEmail && !tagPhoneNumber) {
        return NextResponse.json(
          { error: 'Add an email or phone number to this tag before inviting them' },
          { status: 400 }
        );
      }

      contributor =
        (await prisma.contributor.findFirst({
          where: {
            imageId: id,
            OR: [
              ...(tag.userId ? [{ userId: tag.userId }] : []),
              ...(tagPhoneNumber ? [{ phoneNumber: tagPhoneNumber }] : []),
              ...(tagEmail ? [{ email: tagEmail }] : []),
            ],
          },
          select: {
            id: true,
            name: true,
            email: true,
            phoneNumber: true,
            inviteSent: true,
            token: true,
            userId: true,
          },
        })) || null;

      if (!contributor) {
        contributor = await prisma.contributor.create({
          data: {
            imageId: id,
            userId: tag.userId,
            name: tagName,
            email: tagEmail,
            phoneNumber: tagPhoneNumber,
          },
          select: {
            id: true,
            name: true,
            email: true,
            phoneNumber: true,
            inviteSent: true,
            token: true,
            userId: true,
          },
        });
      }

      await prisma.imageTag.update({
        where: { id: tag.id },
        data: {
          contributorId: contributor.id,
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
