import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { prisma } from '@/lib/db';
import { ensureEmberOwnerAccess } from '@/lib/ember';
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
    const emberContributor = await ensureOwnerContributorForImage(
      imageId,
      auth.user.id
    );
    if (!emberContributor) {
      return NextResponse.json(
        { error: 'Could not prepare contributor record' },
        { status: 500 }
      );
    }

    const ownerUser = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: { phoneNumber: true },
    });

    if (!ownerUser?.phoneNumber) {
      return NextResponse.json(
        { error: 'Add a phone number to your profile first.' },
        { status: 400 }
      );
    }

    if (mode === 'call') {
      // Opt-in: pass ?beta=1 in the request URL to route through the
      // custom-LLM Retell agent (RETELL_AGENT_ID_BETA). Lets us test the
      // new pipeline against real owner phone numbers without affecting
      // contributor / guest production calls.
      const useBetaAgent = request.nextUrl.searchParams.get('beta') === '1';
      const result = await startVoiceCallForContributor({
        emberContributorId: emberContributor.id,
        initiatedBy: 'owner',
        useBetaAgent,
      });
      return NextResponse.json({ success: true, ...result });
    }

    const smsResult = await sendOwnerSelfSms(emberContributor.id);
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
