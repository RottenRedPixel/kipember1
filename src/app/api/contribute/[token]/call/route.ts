import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { startVoiceCallForContributor } from '@/lib/voice-calls';
import { getVoiceEntry } from '@/lib/voice-catalog';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    void request;
    const { token } = await params;

    const emberContributor = await prisma.emberContributor.findUnique({
      where: { token },
      include: { ember: { select: { ownerId: true } } },
    });

    if (!emberContributor) {
      return NextResponse.json({ error: 'Invalid link' }, { status: 404 });
    }

    const ownerRecord = await prisma.user.findUnique({
      where: { id: emberContributor.ember.ownerId },
      select: { voicePreferenceId: true },
    });
    const retellVoiceId = getVoiceEntry(ownerRecord?.voicePreferenceId).retellId;

    const result = await startVoiceCallForContributor({
      emberContributorId: emberContributor.id,
      initiatedBy: 'contributor',
      retellVoiceId,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Error starting contributor voice call:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to start voice call',
      },
      { status: 500 }
    );
  }
}
