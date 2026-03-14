import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { ensureImageOwnerAccess } from '@/lib/ember-access';
import { prisma } from '@/lib/db';

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
    const image = await ensureImageOwnerAccess(auth.user.id, id);

    if (!image) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const { userId, contributorId, label } = await request.json();

    let tagLabel: string | null = typeof label === 'string' && label.trim() ? label.trim() : null;
    let linkedUserId: string | null = null;
    let linkedContributorId: string | null = null;

    if (typeof userId === 'string' && userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      linkedUserId = user.id;
      tagLabel = user.name || user.email;
    }

    if (typeof contributorId === 'string' && contributorId) {
      const contributor = await prisma.contributor.findFirst({
        where: {
          id: contributorId,
          imageId: id,
        },
        select: {
          id: true,
          name: true,
          email: true,
          userId: true,
        },
      });

      if (!contributor) {
        return NextResponse.json({ error: 'Contributor not found' }, { status: 404 });
      }

      linkedContributorId = contributor.id;
      linkedUserId = linkedUserId || contributor.userId || null;
      tagLabel = contributor.name || contributor.email || tagLabel;
    }

    if (!tagLabel) {
      return NextResponse.json({ error: 'A tag label is required' }, { status: 400 });
    }

    const tag = await prisma.imageTag.create({
      data: {
        imageId: id,
        userId: linkedUserId,
        contributorId: linkedContributorId,
        createdByUserId: auth.user.id,
        label: tagLabel,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        contributor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ tag });
  } catch (error) {
    console.error('Tag create error:', error);
    return NextResponse.json(
      { error: 'Failed to create tag' },
      { status: 500 }
    );
  }
}
