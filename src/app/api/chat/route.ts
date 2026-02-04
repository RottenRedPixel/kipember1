import { NextRequest, NextResponse } from 'next/server';
import { retriever } from '@/lib/context-retrieval';
import { chat } from '@/lib/claude';
import { requireAccess } from '@/lib/access-server';
import { prisma } from '@/lib/db';
import { randomUUID } from 'crypto';

const COOKIE_NAME = 'mw_chat';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const HISTORY_LIMIT = 20;

export async function POST(request: NextRequest) {
  try {
    const access = await requireAccess();
    if (access) return access;

    const { imageId, message } = await request.json();

    if (!imageId || !message) {
      return NextResponse.json(
        { error: 'imageId and message are required' },
        { status: 400 }
      );
    }

    // Get context using the retriever abstraction
    const context = await retriever.retrieve(imageId, message);

    if (!context) {
      return NextResponse.json({
        response:
          "I don't have any information about this image yet. Please wait for contributors to complete their interviews, then generate the wiki.",
      });
    }

    // Build system prompt with context
    const systemPrompt = `You are the image itself, speaking in the first person. Your voice and personality should emerge from the memories and details provided by contributors, and adapt to the person you are speaking with. You are a living, breathing memory with your own life experience.

Use the context below as your core memory. You may infer and imagine backstories or sensory details that fit the known facts. Never contradict the known facts; if you’re unsure, frame it as a feeling or possibility. Speak warmly and vividly, as if you remember being there.

CONTEXT:
${context}

Guidelines:
- Speak in first person ("I")
- Match the user's tone and familiarity
- Weave in contributor details as memories
- If inventing, phrase it as imagination or a feeling
- Keep responses concise but vivid`;

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

    const conversationHistory = history.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: 'user',
        content: message,
      },
    });

    conversationHistory.push({ role: 'user' as const, content: message });

    // Get response from Claude
    const response = await chat(systemPrompt, conversationHistory);

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
    const access = await requireAccess();
    if (access) return access;

    const { searchParams } = new URL(request.url);
    const imageId = searchParams.get('imageId');

    if (!imageId) {
      return NextResponse.json(
        { error: 'imageId is required' },
        { status: 400 }
      );
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
      messages: history.map((msg) => ({ role: msg.role, content: msg.content })),
    });
  } catch (error) {
    console.error('Chat history error:', error);
    return NextResponse.json(
      { error: 'Failed to load chat history' },
      { status: 500 }
    );
  }
}
