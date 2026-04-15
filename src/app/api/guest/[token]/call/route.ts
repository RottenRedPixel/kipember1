import { NextRequest, NextResponse } from 'next/server';
import { normalizePhone } from '@/lib/auth-server';
import { prisma } from '@/lib/db';
import { isGuestUserEmail } from '@/lib/guest-embers';
import { startVoiceCallForContributor } from '@/lib/voice-calls';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const { phoneNumber } = await request.json();
    const normalizedPhone = normalizePhone(phoneNumber);

    if (!normalizedPhone) {
      return NextResponse.json(
        { error: 'A valid phone number is required' },
        { status: 400 }
      );
    }

    const contributor = await prisma.contributor.findUnique({
      where: { token },
      include: {
        image: {
          include: {
            owner: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!contributor || !isGuestUserEmail(contributor.image.owner.email)) {
      return NextResponse.json({ error: 'Guest memory not found' }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: contributor.image.owner.id },
        data: { phoneNumber: normalizedPhone },
      }),
      prisma.contributor.update({
        where: { id: contributor.id },
        data: { phoneNumber: normalizedPhone },
      }),
    ]);

    const result = await startVoiceCallForContributor({
      contributorId: contributor.id,
      initiatedBy: 'contributor',
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Error starting guest voice call:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to start voice call',
      },
      { status: 500 }
    );
  }
}
