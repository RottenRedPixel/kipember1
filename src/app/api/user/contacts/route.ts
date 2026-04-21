import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { prisma } from '@/lib/db';

export async function GET() {
  const auth = await requireApiUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const contributors = await prisma.contributor.findMany({
    where: {
      image: { ownerId: auth.user.id },
      OR: [
        { userId: null },
        { NOT: { userId: auth.user.id } },
      ],
    },
    select: {
      id: true,
      name: true,
      phoneNumber: true,
      email: true,
      inviteSent: true,
      userId: true,
      user: { select: { name: true, avatarFilename: true } },
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

  // Deduplicate by userId (if linked) or phone/email
  const seen = new Map<string, (typeof contributors)[number] & { emberTitles: string[] }>();

  for (const c of contributors) {
    const key = c.userId ?? c.phoneNumber ?? c.email ?? c.id;
    const emberTitle = c.image.title || c.image.originalName.replace(/\.[^.]+$/, '');
    if (seen.has(key)) {
      seen.get(key)!.emberTitles.push(emberTitle);
    } else {
      seen.set(key, { ...c, emberTitles: [emberTitle] });
    }
  }

  type ContactStatus = 'contributed' | 'joined' | 'called' | 'sms_sent' | 'invited';

  function getStatus(c: (typeof contributors)[number]): ContactStatus {
    const hasAccount = Boolean(c.userId);
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
      name: c.user?.name || c.name,
      phoneNumber: c.phoneNumber,
      email: c.email,
      avatarFilename: c.user?.avatarFilename ?? null,
      emberTitles: c.emberTitles,
      status: getStatus(c),
    }))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

  return NextResponse.json({ contacts });
}
