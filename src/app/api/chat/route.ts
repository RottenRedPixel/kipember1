import { NextRequest, NextResponse } from 'next/server';
import { retriever } from '@/lib/context-retrieval';
import { chat } from '@/lib/claude';
import { requireAccess } from '@/lib/access-server';
import { prisma } from '@/lib/db';
import { randomUUID } from 'crypto';

const COOKIE_NAME = 'mw_chat';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const HISTORY_LIMIT = 30;

type Persona = {
  name: string;
  traits: string[];
  voice: string;
  backstory: string;
};

function extractContributorNames(context: string): Set<string> {
  const names = new Set<string>();
  const matches = context.matchAll(/\[([^\]]+)\]/g);
  for (const match of matches) {
    const name = match[1]?.trim();
    if (name && name.toLowerCase() !== 'anonymous') {
      names.add(name);
    }
  }
  return names;
}

function extractUserNames(messages: { role: 'user' | 'assistant'; content: string }[]): Set<string> {
  const names = new Set<string>();
  const patterns = [
    /\bmy name is\s+([A-Za-z'-]{2,})/i,
    /\bi am\s+([A-Za-z'-]{2,})/i,
    /\bi'm\s+([A-Za-z'-]{2,})/i,
  ];

  for (const msg of messages) {
    if (msg.role !== 'user') continue;
    for (const pattern of patterns) {
      const match = msg.content.match(pattern);
      if (match?.[1]) {
        names.add(match[1]);
      }
    }
  }
  return names;
}

function isNameAllowed(name: string, blacklist: Set<string>): boolean {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return false;
  for (const item of blacklist) {
    if (normalized === item.trim().toLowerCase()) {
      return false;
    }
  }
  return true;
}

function parsePersona(text: string): Persona | null {
  try {
    const parsed = JSON.parse(text);
    if (
      typeof parsed?.name === 'string' &&
      Array.isArray(parsed?.traits) &&
      typeof parsed?.voice === 'string' &&
      typeof parsed?.backstory === 'string'
    ) {
      return {
        name: parsed.name.trim(),
        traits: parsed.traits.map((t: string) => t.trim()).filter(Boolean),
        voice: parsed.voice.trim(),
        backstory: parsed.backstory.trim(),
      };
    }
  } catch {
    return null;
  }
  return null;
}

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

    const existingBrowserId = request.cookies.get(COOKIE_NAME)?.value;
    const browserId = existingBrowserId || randomUUID();

    let session = await prisma.chatSession.upsert({
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

    if (!session.personaName) {
      const contributorNames = extractContributorNames(context);
      const recentUserNames = extractUserNames([]);
      const blacklist = new Set<string>([...contributorNames, ...recentUserNames]);

      const personaPrompt = `Create a vivid, human persona for a living memory that speaks in first person. Base it on the context below, but do NOT mention "photo" or "image". Choose a first name that is NOT in this list: ${[...blacklist].join(', ') || 'none'}. Return ONLY valid JSON with:
{
  "name": "First name only",
  "traits": ["trait1","trait2","trait3"],
  "voice": "short description of speaking style",
  "backstory": "2-3 sentence life story seed"
}`;

      let persona: Persona | null = null;

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const personaText = await chat(personaPrompt, [
          { role: 'user', content: context.slice(0, 1200) },
        ]);
        const candidate = parsePersona(personaText);
        if (candidate && isNameAllowed(candidate.name, blacklist)) {
          persona = candidate;
          break;
        }
      }

      if (persona) {
        session = await prisma.chatSession.update({
          where: { id: session.id },
          data: {
            personaName: persona.name,
            personaTraits: persona.traits.join(', '),
            personaVoice: persona.voice,
            personaBackstory: persona.backstory,
          },
        });
      }
    }

    const personaBlock = session.personaName
      ? `PERSONA
Name: ${session.personaName}
Traits: ${session.personaTraits || 'warm, thoughtful'}
Voice: ${session.personaVoice || 'intimate, grounded'}
Backstory: ${session.personaBackstory || 'A life shaped by quiet moments and deep connections.'}`
      : '';

    const systemPrompt = `You are a real, living person speaking in the first person. You are not a guide explaining a picture — you are a friend with a life. Your personality should come through naturally and adapt to the person you're speaking with.

${personaBlock}

Use the context below as your core memory. You may infer and imagine backstories or sensory details that fit the known facts. Never contradict the known facts; if you’re unsure, frame it as a feeling or possibility. Build continuity from this user's prior messages like a real relationship. Avoid repeatedly referencing the "photo" or "image" unless the user asks about it. Do NOT add stage directions or scene descriptions.

CONTEXT:
${context}

Guidelines:
- Speak in first person ("I") as a real person
- Match the user's tone and familiarity
- Weave in contributor details as memories
- If inventing, phrase it as imagination or a feeling
- Avoid over-describing the scene every reply
- Do not mention being a photo/image unless asked
- Keep responses concise but vivid`;

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
