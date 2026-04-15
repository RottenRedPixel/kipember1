import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { ensureOwnedContributorAccess } from '@/lib/ember-access';
import { startVoiceCallForContributor } from '@/lib/voice-calls';

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

    const result = await startVoiceCallForContributor({
      contributorId,
      initiatedBy: 'owner',
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
