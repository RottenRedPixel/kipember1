import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { prisma } from '@/lib/db';
import { ensureOwnedContributorAccess } from '@/lib/ember';
import { startVoiceCallForContributor } from '@/lib/voice-calls';
import { getVoiceEntry } from '@/lib/voice-catalog';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { contributorId } = await request.json();

    if (!contributorId || typeof contributorId !== 'string') {
      return NextResponse.json(
        { error: 'contributorId is required' },
        { status: 400 }
      );
    }

    const contributor = await ensureOwnedContributorAccess(auth.user.id, contributorId);
    if (!contributor) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const userRecord = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: { voicePreferenceId: true },
    });
    const retellVoiceId = getVoiceEntry(userRecord?.voicePreferenceId).retellId;

    const result = await startVoiceCallForContributor({
      emberContributorId: contributorId,
      initiatedBy: 'owner',
      retellVoiceId,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Error starting voice call:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to start voice call',
      },
      { status: 500 }
    );
  }
}
