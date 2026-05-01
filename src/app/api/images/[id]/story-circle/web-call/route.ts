import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { ensureEmberOwnerAccess } from '@/lib/ember-access';
import { ensureOwnerContributorForImage } from '@/lib/owner-contributor';
import { startWebVoiceCallForContributor } from '@/lib/voice-calls';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    void request;
    const auth = await requireApiUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const image = await ensureEmberOwnerAccess(auth.user.id, id);
    if (!image) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const contributor = await ensureOwnerContributorForImage(id, auth.user.id);
    if (!contributor) {
      return NextResponse.json(
        { error: 'Failed to prepare the owner contributor record' },
        { status: 500 }
      );
    }

    const result = await startWebVoiceCallForContributor({
      contributorId: contributor.id,
      initiatedBy: 'owner',
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Error starting Story Circle web call:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to start the live Story Circle call',
      },
      { status: 500 }
    );
  }
}
