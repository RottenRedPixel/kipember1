import { NextRequest, NextResponse } from 'next/server';
import { requireAccess } from '@/lib/access-server';
import { startVoiceCallForContributor } from '@/lib/voice-calls';

export async function POST(request: NextRequest) {
  try {
    const access = await requireAccess();
    if (access) return access;

    const { contributorId } = await request.json();

    if (!contributorId || typeof contributorId !== 'string') {
      return NextResponse.json(
        { error: 'contributorId is required' },
        { status: 400 }
      );
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
