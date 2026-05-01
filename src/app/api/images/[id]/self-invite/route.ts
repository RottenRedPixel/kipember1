import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { ensureEmberOwnerAccess } from '@/lib/ember-access';
import { ensureOwnerContributorForImage } from '@/lib/owner-contributor';
import { startVoiceCallForContributor } from '@/lib/voice-calls';
import { sendOwnerSelfSms } from '@/lib/owner-self-invite';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: imageId } = await params;
    const { mode } = await request.json();

    if (mode !== 'call' && mode !== 'text') {
      return NextResponse.json(
        { error: 'mode must be "call" or "text"' },
        { status: 400 }
      );
    }

    const image = await ensureEmberOwnerAccess(auth.user.id, imageId);
    if (!image) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    // Owner is automatically a contributor on their own memory. This
    // upsert also syncs name/phone/email from the user profile so the
    // call/text goes to whatever's currently on file.
    const contributor = await ensureOwnerContributorForImage(
      imageId,
      auth.user.id
    );
    if (!contributor) {
      return NextResponse.json(
        { error: 'Could not prepare contributor record' },
        { status: 500 }
      );
    }

    if (!contributor.phoneNumber) {
      return NextResponse.json(
        { error: 'Add a phone number to your profile first.' },
        { status: 400 }
      );
    }

    if (mode === 'call') {
      const result = await startVoiceCallForContributor({
        contributorId: contributor.id,
        initiatedBy: 'owner',
      });
      return NextResponse.json({ success: true, ...result });
    }

    const smsResult = await sendOwnerSelfSms(contributor.id);
    if (!smsResult.success) {
      return NextResponse.json(
        { error: smsResult.error || 'Failed to send text' },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Self invite error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to send self invite',
      },
      { status: 500 }
    );
  }
}
