import { NextRequest, NextResponse } from 'next/server';
import { normalizeEmail, normalizePhone, requireApiUser } from '@/lib/auth-server';
import { ensureEmberOwnerAccess } from '@/lib/ember';
import { prisma } from '@/lib/db';
import { invalidateSmartTitleSuggestions } from '@/lib/smart-title-suggestions';
import { generateWikiForImage } from '@/lib/wiki-generator';
import { getUserDisplayName } from '@/lib/user-name';

function parseOptionalPercentage(value: unknown): number | null {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.min(100, value));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser();

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const image = await ensureEmberOwnerAccess(auth.user.id, id);

    if (!image) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const body = await request.json();
    const {
      userId,
      contributorId,
      label,
      email,
      phoneNumber,
      leftPct,
      topPct,
      widthPct,
      heightPct,
    } = body;
    const shouldRefreshWiki = body?.refreshWiki !== false;

    let tagLabel: string | null = typeof label === 'string' && label.trim() ? label.trim() : null;
    let linkedUserId: string | null = null;
    let linkedContributorId: string | null = null;
    let tagEmail = typeof email === 'string' && email.trim() ? normalizeEmail(email) : null;
    let tagPhoneNumber = normalizePhone(phoneNumber);

    if (typeof userId === 'string' && userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phoneNumber: true,
        },
      });

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      linkedUserId = user.id;
      tagLabel = getUserDisplayName(user) || user.email;
      tagEmail = user.email;
      tagPhoneNumber = normalizePhone(user.phoneNumber);
    }

    if (typeof contributorId === 'string' && contributorId) {
      const ec = await prisma.emberContributor.findFirst({
        where: {
          id: contributorId,
          imageId: id,
        },
        select: {
          id: true,
          contributor: {
            select: {
              name: true,
              email: true,
              phoneNumber: true,
              userId: true,
            },
          },
        },
      });

      if (!ec) {
        return NextResponse.json({ error: 'Contributor not found' }, { status: 404 });
      }

      linkedContributorId = ec.id;
      linkedUserId = linkedUserId || ec.contributor.userId || null;
      tagLabel = ec.contributor.name || ec.contributor.email || tagLabel;
      tagEmail = ec.contributor.email || tagEmail;
      tagPhoneNumber = normalizePhone(ec.contributor.phoneNumber) || tagPhoneNumber;
    }

    if (!tagLabel) {
      return NextResponse.json({ error: 'A tag label is required' }, { status: 400 });
    }

    const tag = await prisma.imageTag.create({
      data: {
        imageId: id,
        userId: linkedUserId,
        emberContributorId: linkedContributorId,
        createdByUserId: auth.user.id,
        label: tagLabel,
        email: tagEmail,
        phoneNumber: tagPhoneNumber,
        leftPct: parseOptionalPercentage(leftPct),
        topPct: parseOptionalPercentage(topPct),
        widthPct: parseOptionalPercentage(widthPct),
        heightPct: parseOptionalPercentage(heightPct),
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
            contributor: {
              select: {
                id: true,
                name: true,
                email: true,
                phoneNumber: true,
              },
            },
          },
        },
      },
    });

    await invalidateSmartTitleSuggestions(id).catch((titleError) => {
      console.error('Smart title cache reset failed after tag create:', titleError);
    });

    if (shouldRefreshWiki) {
      await generateWikiForImage(id).catch((wikiError) => {
        console.error('Wiki refresh failed after tag create:', wikiError);
      });
    }

    return NextResponse.json({ tag });
  } catch (error) {
    console.error('Tag create error:', error);
    return NextResponse.json(
      { error: 'Failed to create tag' },
      { status: 500 }
    );
  }
}
