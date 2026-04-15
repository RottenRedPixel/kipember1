import { NextRequest, NextResponse } from 'next/server';
import { normalizeEmail, normalizePhone, requireApiUser } from '@/lib/auth-server';
import { ensureOwnedContributorAccess } from '@/lib/ember-access';
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
    const contributor = await ensureOwnedContributorAccess(auth.user.id, id);

    if (!contributor) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const body = await request.json();
    const name =
      body?.name === null
        ? null
        : typeof body?.name === 'string'
        ? body.name.trim() || null
        : contributor.name;
    const phoneNumber =
      body?.phoneNumber === null
        ? null
        : typeof body?.phoneNumber === 'string'
        ? normalizePhone(body.phoneNumber)
        : contributor.phoneNumber;
    const email =
      body?.email === null
        ? null
        : typeof body?.email === 'string'
        ? normalizeEmail(body.email)
        : contributor.email;

    if (!phoneNumber && !email) {
      return NextResponse.json(
        { error: 'Provide a phone number or email' },
        { status: 400 }
      );
    }

    const existing = await prisma.contributor.findFirst({
      where: {
        imageId: contributor.image.id,
        id: { not: contributor.id },
        OR: [
          ...(phoneNumber ? [{ phoneNumber }] : []),
          ...(email ? [{ email }] : []),
        ],
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'That contributor is already attached to this Ember' },
        { status: 400 }
      );
    }

    const updatedContributor = await prisma.contributor.update({
      where: { id: contributor.id },
      data: {
        name,
        phoneNumber,
        email,
      },
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
    });

    return NextResponse.json(updatedContributor);
  } catch (error) {
    console.error('Error updating contributor:', error);
    return NextResponse.json(
      { error: 'Failed to update contributor' },
      { status: 500 }
    );
  }
}
