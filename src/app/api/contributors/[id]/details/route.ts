import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { ensureOwnedContributorAccess } from '@/lib/ember';
import { prisma } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    void request;
    const auth = await requireApiUser();

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const contributor = await ensureOwnedContributorAccess(auth.user.id, id);

    if (!contributor) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const detail = await prisma.emberContributor.findUnique({
      where: { id: contributor.id },
      select: {
        id: true,
        inviteSent: true,
        createdAt: true,
        userId: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true,
          },
        },
        emberSession: {
          select: {
            status: true,
            currentStep: true,
            messages: {
              where: { role: 'user', questionType: { not: null } },
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                questionType: true,
                question: true,
                content: true,
                source: true,
                createdAt: true,
              },
            },
          },
        },
        voiceCalls: {
          orderBy: { createdAt: 'desc' },
          take: 3,
          select: {
            id: true,
            status: true,
            startedAt: true,
            endedAt: true,
            createdAt: true,
            callSummary: true,
            initiatedBy: true,
          },
        },
      },
    });

    if (!detail) {
      return NextResponse.json({ error: 'Contributor not found' }, { status: 404 });
    }

    const displayName = [detail.user?.firstName, detail.user?.lastName].filter(Boolean).join(' ') || null;

    return NextResponse.json({
      id: detail.id,
      inviteSent: detail.inviteSent,
      createdAt: detail.createdAt,
      name: displayName,
      email: detail.user?.email ?? null,
      phoneNumber: detail.user?.phoneNumber ?? null,
      avatarColor: null,
      user: detail.user,
      emberSession: detail.emberSession,
      voiceCalls: detail.voiceCalls,
    });
  } catch (error) {
    console.error('Error loading contributor details:', error);
    return NextResponse.json(
      { error: 'Failed to load contributor details' },
      { status: 500 }
    );
  }
}
