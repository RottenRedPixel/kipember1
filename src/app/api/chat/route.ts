import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { retriever } from '@/lib/context-retrieval';
import { prisma } from '@/lib/db';
import { getImageAccessType } from '@/lib/ember-access';
import { chat } from '@/lib/claude';

const COOKIE_NAME = 'mw_photo_chat_v2';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const HISTORY_LIMIT = 30;

function buildSystemPrompt(context: string): string {
  return `You answer questions about a specific photo using only the verified or clearly labeled information in the context below.

The context may include wiki content, image analysis, metadata, and contributor memories.

Rules:
- Do not roleplay as a person, character, memory, or living being.
- Do not pretend to be inside the photo.
- Do not invent names, relationships, events, motives, dialogue, or backstory.
- Treat contributor memories and explicit metadata as the strongest sources.
- Treat image analysis as likely or possible when it is not directly confirmed.
- If different sources disagree, say that the information is mixed.
- If the answer is not supported by the context, say you do not know yet.
- When useful, attribute details to contributors by name.
- Keep answers clear, conversational, and concise.

CONTEXT:
${context}`;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { imageId, message } = await request.json();

    if (!imageId || !message) {
      return NextResponse.json(
        { error: 'imageId and message are required' },
        { status: 400 }
      );
    }

    const accessType = await getImageAccessType(auth.user.id, imageId);
    if (!accessType) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const context = await retriever.retrieve(imageId, message);

    if (!context) {
      return NextResponse.json({
        response:
          "I don't have enough verified information about this photo yet. Try again after the wiki is generated or more contributor details are added.",
      });
    }

    const existingBrowserId = request.cookies.get(COOKIE_NAME)?.value;
    const browserId = existingBrowserId || randomUUID();

    const session = await prisma.chatSession.upsert({
      where: {
        browserId_imageId: {
          browserId,
          imageId,
        },
      },
      create: {
        browserId,
        imageId,
      },
      update: {},
    });

    const history = await prisma.chatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'asc' },
      take: HISTORY_LIMIT,
    });

    const conversationHistory = history.map((entry) => ({
      role: entry.role as 'user' | 'assistant',
      content: entry.content,
    }));

    await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: 'user',
        content: message,
      },
    });

    conversationHistory.push({ role: 'user', content: message });

    const response = await chat(buildSystemPrompt(context), conversationHistory);

    await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: 'assistant',
        content: response,
      },
    });

    const nextResponse = NextResponse.json({ response });
    if (!existingBrowserId) {
      nextResponse.cookies.set(COOKIE_NAME, browserId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: COOKIE_MAX_AGE,
        path: '/',
      });
    }

    return nextResponse;
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const imageId = searchParams.get('imageId');

    if (!imageId) {
      return NextResponse.json(
        { error: 'imageId is required' },
        { status: 400 }
      );
    }

    const accessType = await getImageAccessType(auth.user.id, imageId);
    if (!accessType) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const browserId = request.cookies.get(COOKIE_NAME)?.value;
    if (!browserId) {
      return NextResponse.json({ messages: [] });
    }

    const session = await prisma.chatSession.findUnique({
      where: {
        browserId_imageId: {
          browserId,
          imageId,
        },
      },
    });

    if (!session) {
      return NextResponse.json({ messages: [] });
    }

    const history = await prisma.chatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'asc' },
      take: HISTORY_LIMIT,
    });

    return NextResponse.json({
      messages: history.map((entry) => ({
        role: entry.role,
        content: entry.content,
      })),
    });
  } catch (error) {
    console.error('Chat history error:', error);
    return NextResponse.json(
      { error: 'Failed to load chat history' },
      { status: 500 }
    );
  }
}
