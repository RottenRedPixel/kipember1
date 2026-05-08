import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { ensureOwnedContributorAccess } from '@/lib/ember';
import { sendContributorSmsInvite } from '@/lib/contributor-invites';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const emberContributor = await ensureOwnedContributorAccess(auth.user.id, id);
    if (!emberContributor) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const result = await sendContributorSmsInvite(id);

    if (!result.success) {
      return NextResponse.json({ error: result.error ?? 'Failed to send SMS' }, { status: 500 });
    }

    return NextResponse.json({ success: true, inviteUrl: result.inviteUrl });
  } catch (error) {
    console.error('Error sending contributor SMS invite:', error);
    return NextResponse.json({ error: 'Failed to send SMS invite' }, { status: 500 });
  }
}
