import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { prisma } from '@/lib/db';
import { getUserDisplayName } from '@/lib/user-name';

export async function GET() {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // List one EmberContributor row per ember (per attachment), then dedupe
  // across embers for display. Contributors are fetched via the direct User relation.
  const emberContributors = await prisma.emberContributor.findMany({
    where: {
      image: { ownerId: auth.user.id },
      // Exclude the owner's own contributor rows
      NOT: { userId: auth.user.id },
    },
    select: {
      id: true,
      userId: true,
      inviteSent: true,
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phoneNumber: true,
          email: true,
          avatarFilename: true,
        },
      },
      image: { select: { id: true, title: true, originalName: true } },
      voiceCalls: { select: { id: true } },
      emberSession: {
        select: {
          messages: { select: { id: true }, take: 1 },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  type Row = (typeof emberContributors)[number];
  type Aggregated = Row & { emberTitles: string[] };

  // Deduplicate by userId (or fall back to EC id for anonymous users).
  const seen = new Map<string, Aggregated>();

  for (const c of emberContributors) {
    const key = c.userId ?? c.id;
    const emberTitle = c.image.title || c.image.originalName.replace(/\.[^.]+$/, '');
    if (seen.has(key)) {
      seen.get(key)!.emberTitles.push(emberTitle);
    } else {
      seen.set(key, { ...c, emberTitles: [emberTitle] });
    }
  }

  type ContactStatus = 'contributed' | 'joined' | 'called' | 'sms_sent' | 'invited';

  function getStatus(c: Row): ContactStatus {
    // A real user has identity fields set; anonymous share-link placeholders have all null.
    const hasAccount = Boolean(c.user?.email || c.user?.phoneNumber || c.user?.firstName);
    const hasContributed = hasAccount && (
      (c.voiceCalls?.length ?? 0) > 0 ||
      (c.emberSession?.messages?.length ?? 0) > 0
    );
    if (hasContributed) return 'contributed';
    if (hasAccount) return 'joined';
    if ((c.voiceCalls?.length ?? 0) > 0) return 'called';
    if (c.inviteSent) return 'sms_sent';
    return 'invited';
  }

  const STATUS_ORDER: Record<ContactStatus, number> = {
    contributed: 0,
    joined: 1,
    called: 2,
    sms_sent: 3,
    invited: 4,
  };

  const contacts = Array.from(seen.values())
    .map((c) => ({
      id: c.id,
      emberId: c.image.id,
      name: getUserDisplayName(c.user) || null,
      phoneNumber: c.user?.phoneNumber ?? null,
      email: c.user?.email ?? null,
      avatarFilename: c.user?.avatarFilename ?? null,
      emberTitles: c.emberTitles,
      status: getStatus(c),
    }))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

  return NextResponse.json({ contacts });
}
