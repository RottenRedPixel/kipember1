import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import {
  emberSessionParticipantWhere,
  ensureEmberSession,
} from '@/lib/ember-sessions';

// One cookie per browser visiting via a guest share link. Lets each browser
// have its own EmberSession (chat history) so multiple guests sharing the
// same link don't read or contaminate each other's conversation.
const GUEST_BROWSER_COOKIE = 'kb-guest-browser';
const GUEST_BROWSER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
import { generateEmberChatReply } from '@/lib/ember-chat-reply';
import { reconcileEmberMessageSafely } from '@/lib/memory-reconciliation';
import { PROMPT_REMOVED_MESSAGE, isPromptRemovedError } from '@/lib/control-plane';
import { refreshVoiceCallFromProvider, shouldRefreshVoiceCallStatus } from '@/lib/voice-calls';

// GET - Fetch contributor info and session
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    void request;

    const { token } = await params;

    const tokenInclude = {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phoneNumber: true,
        },
      },
      image: {
        include: {
          owner: {
            select: {
              email: true,
            },
          },
        },
      },
      emberSession: {
        include: {
          messages: {
            orderBy: { createdAt: 'asc' as const },
          },
        },
      },
      voiceCalls: {
        orderBy: { createdAt: 'desc' as const },
        take: 1,
        select: {
          id: true,
          status: true,
          startedAt: true,
          endedAt: true,
          createdAt: true,
          updatedAt: true,
          analyzedAt: true,
          callSummary: true,
          memorySyncedAt: true,
        },
      },
    };

    const emberContributor = await prisma.emberContributor.findUnique({
      where: { token },
      include: tokenInclude,
    });

    if (!emberContributor) {
      return NextResponse.json(
        { error: 'Invalid or expired link' },
        {
          status: 404,
          headers: {
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    const latestVoiceCall = emberContributor.voiceCalls[0] ?? null;
    if (shouldRefreshVoiceCallStatus(latestVoiceCall)) {
      try {
        await refreshVoiceCallFromProvider(latestVoiceCall.id);
      } catch (refreshError) {
        console.error('Failed to refresh contributor voice call from provider:', refreshError);
      }
    }

    const refreshedContributor = await prisma.emberContributor.findUnique({
      where: { token },
      include: tokenInclude,
    });

    if (!refreshedContributor) {
      return NextResponse.json(
        { error: 'Invalid or expired link' },
        {
          status: 404,
          headers: {
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    return NextResponse.json(
      {
        contributor: {
          id: refreshedContributor.id,
          name: [refreshedContributor.user?.firstName, refreshedContributor.user?.lastName].filter(Boolean).join(' ') || refreshedContributor.user?.email || refreshedContributor.user?.phoneNumber || null,
          phoneNumber: refreshedContributor.user?.phoneNumber ?? null,
        },
        image: {
          id: refreshedContributor.image.id,
          filename: refreshedContributor.image.filename,
          mediaType: refreshedContributor.image.mediaType,
          posterFilename: refreshedContributor.image.posterFilename,
          durationSeconds: refreshedContributor.image.durationSeconds,
          originalName: refreshedContributor.image.originalName,
          title: refreshedContributor.image.title,
          description: refreshedContributor.image.description,
        },
        conversation: refreshedContributor.emberSession,
        latestVoiceCall: refreshedContributor.voiceCalls[0] ?? null,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching contributor:', error);
    return NextResponse.json(
      { error: 'Failed to load' },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}

// POST - Handle chat message from contributor / guest
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const { message } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const emberContributor = await prisma.emberContributor.findUnique({
      where: { token },
      select: {
        id: true,
        imageId: true,
        userId: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            phoneNumber: true,
            email: true,
          },
        },
      },
    });

    if (!emberContributor) {
      return NextResponse.json({ error: 'Invalid link' }, { status: 404 });
    }

    const contributor = {
      id: emberContributor.id,
      imageId: emberContributor.imageId,
      name: [emberContributor.user?.firstName, emberContributor.user?.lastName].filter(Boolean).join(' ') || null,
      phoneNumber: emberContributor.user?.phoneNumber ?? null,
      email: emberContributor.user?.email ?? null,
      userId: emberContributor.userId,
    };

    // A share-link placeholder has an anonymous User with all identity fields null.
    const isGuestShareLink =
      !contributor.name &&
      !contributor.phoneNumber &&
      !contributor.email;
    const chatRole = isGuestShareLink ? ('guest' as const) : ('contributor' as const);

    // Each guest browser gets its own session keyed by a per-browser cookie,
    // so two people clicking the same share link never see or influence each
    // other's chat. Logged-in contributors keep the original identity.
    const existingGuestBrowserId = request.cookies.get(GUEST_BROWSER_COOKIE)?.value;
    const guestBrowserId =
      chatRole === 'guest' ? existingGuestBrowserId || randomUUID() : null;

    // Helper: wrap any guest response with the browser cookie if we just
    // minted a new one. Owners/contributors never get this cookie.
    const withGuestCookie = (response: NextResponse) => {
      if (guestBrowserId && !existingGuestBrowserId) {
        response.cookies.set(GUEST_BROWSER_COOKIE, guestBrowserId, {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          maxAge: GUEST_BROWSER_COOKIE_MAX_AGE,
          path: '/',
        });
      }
      return response;
    };

    const sessionIdentity =
      chatRole === 'guest' && guestBrowserId
        ? {
            imageId: contributor.imageId,
            sessionType: 'chat' as const,
            participantType: 'guest' as const,
            participantId: guestBrowserId,
          }
        : {
            imageId: contributor.imageId,
            sessionType: 'chat' as const,
            participantType: 'contributor' as const,
            participantId: contributor.id,
          };

    let session = await prisma.emberSession.findUnique({
      where: emberSessionParticipantWhere(sessionIdentity),
    });

    const isStart = message === '__START__';

    if (!session) {
      session = await ensureEmberSession({
        ...sessionIdentity,
        // Don't claim the share-link EmberContributor row for guest sessions —
        // that row's emberContributorId is @unique and would conflict across
        // multiple guest browsers visiting the same link.
        emberContributorId: chatRole === 'guest' ? null : contributor.id,
        browserId: guestBrowserId,
        status: 'active',
      });

      const welcome = await generateEmberChatReply({
        imageId: contributor.imageId,
        sessionId: session.id,
        role: chatRole,
        trigger: 'welcome_first_open',
      });
      await prisma.emberMessage.create({
        data: {
          sessionId: session.id,
          role: 'assistant',
          content: welcome,
          source: 'web',
        },
      });

      if (isStart) {
        return withGuestCookie(NextResponse.json({ response: welcome }));
      }
    } else if (isStart) {
      // Guests always start fresh with the static welcome — no replay of the
      // previous conversation, no Claude call. They followed a share link to
      // look at this memory; the welcome is consistent and predictable.
      if (chatRole === 'guest') {
        const welcome = await generateEmberChatReply({
          imageId: contributor.imageId,
          sessionId: session.id,
          role: chatRole,
          trigger: 'welcome_returning',
        });
        await prisma.emberMessage.create({
          data: {
            sessionId: session.id,
            role: 'assistant',
            content: welcome,
            source: 'web',
          },
        });
        return withGuestCookie(NextResponse.json({ response: welcome }));
      }

      const userReplyCount = await prisma.emberMessage.count({
        where: { sessionId: session.id, role: 'user' },
      });

      if (userReplyCount > 0) {
        const latest = await prisma.emberMessage.findFirst({
          where: { sessionId: session.id, role: 'assistant' },
          orderBy: { createdAt: 'desc' },
        });
        if (latest) {
          return NextResponse.json({ response: latest.content });
        }
      } else {
        // Drop any prior unanswered welcomes so the next one reads the latest wiki.
        await prisma.emberMessage.deleteMany({
          where: { sessionId: session.id, role: 'assistant' },
        });
      }

      const welcome = await generateEmberChatReply({
        imageId: contributor.imageId,
        sessionId: session.id,
        role: chatRole,
        trigger: 'welcome_returning',
      });
      await prisma.emberMessage.create({
        data: {
          sessionId: session.id,
          role: 'assistant',
          content: welcome,
          source: 'web',
        },
      });
      return NextResponse.json({ response: welcome });
    }

    const userMessage = await prisma.emberMessage.create({
      data: {
        sessionId: session.id,
        role: 'user',
        content: message,
        source: 'web',
      },
    });

    const [reply] = await Promise.all([
      generateEmberChatReply({
        imageId: contributor.imageId,
        sessionId: session.id,
        role: chatRole,
        trigger: 'message',
      }),
      reconcileEmberMessageSafely(userMessage.id, 'contribute housekeeping'),
    ]);

    await prisma.emberMessage.create({
      data: {
        sessionId: session.id,
        role: 'assistant',
        content: reply,
        source: 'web',
      },
    });

    return withGuestCookie(NextResponse.json({ response: reply }));
  } catch (error) {
    console.error('Chat error:', error);
    if (isPromptRemovedError(error)) {
      return NextResponse.json({ error: PROMPT_REMOVED_MESSAGE }, { status: 500 });
    }
    return NextResponse.json({ error: 'Failed to process message' }, { status: 500 });
  }
}
