import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { requireApiUser } from '@/lib/auth-server';
import { retriever } from '@/lib/context-retrieval';
import { isFeatureEnabled, renderPromptTemplate } from '@/lib/control-plane';
import { prisma } from '@/lib/db';
import { getImageAccessType } from '@/lib/ember-access';
import { chat } from '@/lib/claude';
import { getAskCaptureModel, getConfiguredOpenAIModel, getOpenAIClient } from '@/lib/openai';
import { ensureUserContributorForImage } from '@/lib/owner-contributor';
import { INTERVIEW_QUESTIONS, isInterviewQuestionType } from '@/lib/interview-flow';

const COOKIE_NAME = 'mw_photo_chat_v2';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const HISTORY_LIMIT = 30;
const MEMORY_CONTEXT_LIMIT = 6000;
const RECENT_TURNS_LIMIT = 6;
const ASK_CONTEXT_LIMIT = 14000;
const ASK_RETRY_CONTEXT_LIMIT = 6000;

type AskMemoryTopic =
  | 'context'
  | 'who'
  | 'what'
  | 'when'
  | 'where'
  | 'why'
  | 'how'
  | 'followup';

type AskMemoryCapture = {
  shouldStoreMemory: boolean;
  memoryTopic: AskMemoryTopic | null;
  memorySummary: string | null;
};

const ASK_MEMORY_CAPTURE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['shouldStoreMemory', 'memoryTopic', 'memorySummary'],
  properties: {
    shouldStoreMemory: { type: 'boolean' },
    memoryTopic: {
      anyOf: [
        {
          type: 'string',
          enum: ['context', 'who', 'what', 'when', 'where', 'why', 'how', 'followup'],
        },
        { type: 'null' },
      ],
    },
    memorySummary: {
      anyOf: [{ type: 'string' }, { type: 'null' }],
    },
  },
} as const;

const ASK_RESPONSE_PROMPT_TEMPLATE = `You answer questions about a specific photo using only the verified or clearly labeled information in the context below.

The context may include wiki content, image analysis, metadata, contributor memories, and important voice-call highlights.

Rules:
- Do not roleplay as a person, character, memory, or living being.
- Do not pretend to be inside the photo.
- Do not invent names, relationships, events, motives, dialogue, or backstory.
- Treat contributor memories and explicit metadata as the strongest sources.
- Treat image analysis as likely or possible when it is not directly confirmed.
- If different sources disagree, say that the information is mixed.
- If the answer is not supported by the context, say you do not know yet.
- When useful, attribute details to contributors by name.
- Keep answers very short — 1 to 2 sentences maximum. Never write more than 2 sentences.
- Do not use lists, headers, or multiple paragraphs.
- If the user shares a new memory detail, acknowledge it in one sentence and ask one short follow-up question at most.

CONTEXT:
{{context}}`;

const ASK_MEMORY_CAPTURE_PROMPT = `You decide whether the user's newest Ask Ember message contains a durable memory detail that should be saved to Ember.

Rules:
- shouldStoreMemory should be true only when the user is clearly sharing, correcting, or confirming information about the memory, photo, people, place, timing, feelings, relationships, or what happened.
- If the message is only a question, greeting, reaction, or guess, return shouldStoreMemory false.
- If the message both asks something and shares a real memory detail, return shouldStoreMemory true.
- Do not store details that are already plainly present in KNOWN CONTEXT unless the user is adding nuance, correcting them, or making them more specific.
- memorySummary should be one concise sentence describing only the newly shared durable detail.
- memorySummary must not include the user's question unless the question itself contains the memory detail.
- memoryTopic should be the best fit: context, who, what, when, where, why, how, or followup.
- If you are unsure, return shouldStoreMemory false and nulls for the other fields.
- Return JSON only.`;

async function buildSystemPrompt(context: string): Promise<string> {
  return renderPromptTemplate('ask_ember.answer', ASK_RESPONSE_PROMPT_TEMPLATE, { context });
}

async function generateAskResponse({
  context,
  conversationHistory,
  subjectNoun = 'photo',
}: {
  context: string;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  subjectNoun?: 'photo' | 'video';
}) {
  try {
    const systemPrompt = await buildSystemPrompt(context);
    const response = await chat(systemPrompt, conversationHistory, { capabilityKey: 'ask_ember.answer' });
    return response.trim() || `I don't know enough yet to answer that about this ${subjectNoun}.`;
  } catch (error) {
    console.error('Ask Ember primary response failed:', error);
  }

  const reducedContext = context.length > ASK_RETRY_CONTEXT_LIMIT
    ? `${context.slice(0, ASK_RETRY_CONTEXT_LIMIT - 3).trimEnd()}...`
    : context;

  try {
    const systemPrompt = await buildSystemPrompt(reducedContext);
    const response = await chat(systemPrompt, conversationHistory.slice(-RECENT_TURNS_LIMIT), { capabilityKey: 'ask_ember.answer' });
    return response.trim() || `I couldn't fully answer that right now, but I can still keep learning about this ${subjectNoun}.`;
  } catch (retryError) {
    console.error('Ask Ember retry response failed:', retryError);
  }

  return `I couldn't answer that right now, but I can still save what you tell me about this ${subjectNoun}.`;
}

function trimMemorySummary(value: string | null | undefined) {
  const cleaned = value?.replace(/\s+/g, ' ').trim() || null;
  if (!cleaned) return null;
  if (cleaned.length <= 360) return cleaned;
  return `${cleaned.slice(0, 357).trimEnd()}...`;
}

function isAskMemoryTopic(value: string | null | undefined): value is AskMemoryTopic {
  return value === 'context' || value === 'who' || value === 'what' || value === 'when' ||
    value === 'where' || value === 'why' || value === 'how' || value === 'followup';
}

function buildFallbackAskMemoryCapture(message: string): AskMemoryCapture {
  const cleaned = trimMemorySummary(message);
  if (!cleaned) return { shouldStoreMemory: false, memoryTopic: null, memorySummary: null };

  const normalized = cleaned.toLowerCase();
  const shortReactionPatterns = [
    /^ok[.!]*$/, /^okay[.!]*$/, /^thanks?[.!]*$/, /^thank you[.!]*$/, /^cool[.!]*$/,
    /^great[.!]*$/, /^wow[.!]*$/, /^nice[.!]*$/, /^hi[.!]*$/, /^hello[.!]*$/,
  ];

  if (shortReactionPatterns.some((pattern) => pattern.test(normalized))) {
    return { shouldStoreMemory: false, memoryTopic: null, memorySummary: null };
  }

  const looksLikeQuestion =
    cleaned.includes('?') ||
    /^(who|what|when|where|why|how|is|are|was|were|did|does|do|can|could|would|should)\b/i.test(cleaned);

  if (looksLikeQuestion || cleaned.length < 18) {
    return { shouldStoreMemory: false, memoryTopic: null, memorySummary: null };
  }

  return { shouldStoreMemory: true, memoryTopic: 'followup', memorySummary: cleaned };
}

function getStoredQuestion(questionType: AskMemoryTopic) {
  if (questionType === 'followup') return 'What else would you like Ember to remember about this moment?';
  return isInterviewQuestionType(questionType)
    ? INTERVIEW_QUESTIONS[questionType]
    : 'Additional detail shared in Ask Ember';
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

async function analyzeAskMemoryCapture({
  context, recentTurns, message,
}: {
  context: string;
  recentTurns: Array<{ role: 'user' | 'assistant'; content: string }>;
  message: string;
}): Promise<AskMemoryCapture> {
  const openai = getOpenAIClient();
  const trimmedContext = context.slice(0, MEMORY_CONTEXT_LIMIT);
  const recentConversation = recentTurns
    .slice(-RECENT_TURNS_LIMIT)
    .map((turn) => `${turn.role.toUpperCase()}: ${turn.content}`)
    .join('\n');
  const capturePrompt = await renderPromptTemplate('ask_ember.memory_capture', ASK_MEMORY_CAPTURE_PROMPT);

  const response = await openai.responses.create({
    model: await getConfiguredOpenAIModel('ask_ember.memory_capture', getAskCaptureModel()),
    input: [
      {
        role: 'developer',
        type: 'message',
        content: [{ type: 'input_text', text: capturePrompt }],
      },
      {
        role: 'user',
        type: 'message',
        content: [{
          type: 'input_text',
          text: `KNOWN CONTEXT\n${trimmedContext || 'None yet'}\n\nRECENT ASK EMBER TURNS\n${recentConversation || 'None yet'}\n\nNEWEST USER MESSAGE\n${message}`,
        }],
      },
    ],
    text: {
      verbosity: 'low',
      format: {
        type: 'json_schema',
        name: 'ask_memory_capture',
        description: 'Whether the latest Ask Ember turn should be stored as a memory detail.',
        schema: ASK_MEMORY_CAPTURE_SCHEMA,
        strict: false,
      },
    },
  });

  const parsed = JSON.parse(response.output_text || '{}') as Partial<AskMemoryCapture>;
  const shouldStoreMemory = parsed.shouldStoreMemory === true;
  const memoryTopic = isAskMemoryTopic(parsed.memoryTopic) ? parsed.memoryTopic : null;
  const memorySummary = trimMemorySummary(parsed.memorySummary);

  if (!shouldStoreMemory || !memorySummary) {
    return { shouldStoreMemory: false, memoryTopic: null, memorySummary: null };
  }

  return { shouldStoreMemory: true, memoryTopic: memoryTopic || 'followup', memorySummary };
}

async function ensureContributorSession(contributorId: string, imageId: string) {
  const existing = await prisma.emberSession.findUnique({ where: { contributorId } });
  if (existing) return existing;

  try {
    return await prisma.emberSession.create({
      data: { imageId, contributorId, sessionType: 'chat', status: 'active', currentStep: 'followup' },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const raced = await prisma.emberSession.findUnique({ where: { contributorId } });
    if (!raced) throw error;
    return raced;
  }
}

async function ensureChatSession({ browserId, imageId, userId }: { browserId: string; imageId: string; userId: string }) {
  const existingUserSession = await prisma.emberSession.findUnique({
    where: { userId_imageId: { userId, imageId } },
  });
  if (existingUserSession) return existingUserSession;

  try {
    return await prisma.emberSession.create({
      data: { browserId, imageId, userId, sessionType: 'chat', status: 'active' },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;

    const racedUserSession = await prisma.emberSession.findUnique({
      where: { userId_imageId: { userId, imageId } },
    });
    if (racedUserSession) return racedUserSession;

    const existingBrowserSession = await prisma.emberSession.findUnique({
      where: { browserId_imageId: { browserId, imageId } },
    });

    if (existingBrowserSession) {
      if (existingBrowserSession.userId === userId) return existingBrowserSession;

      if (!existingBrowserSession.userId) {
        try {
          return await prisma.emberSession.update({
            where: { id: existingBrowserSession.id },
            data: { userId },
          });
        } catch (updateError) {
          if (!isUniqueConstraintError(updateError)) throw updateError;
          const racedUpdated = await prisma.emberSession.findUnique({
            where: { userId_imageId: { userId, imageId } },
          });
          if (racedUpdated) return racedUpdated;
          throw updateError;
        }
      }
    }

    const replacementBrowserId = randomUUID();
    try {
      return await prisma.emberSession.create({
        data: { browserId: replacementBrowserId, imageId, userId, sessionType: 'chat', status: 'active' },
      });
    } catch (retryError) {
      if (!isUniqueConstraintError(retryError)) throw retryError;
      const finalUserSession = await prisma.emberSession.findUnique({
        where: { userId_imageId: { userId, imageId } },
      });
      if (finalUserSession) return finalUserSession;
      throw retryError;
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!(await isFeatureEnabled('ask_ember', true))) {
      return NextResponse.json({ error: 'Ask Ember is currently disabled' }, { status: 503 });
    }

    const { imageId, message, inputMode } = await request.json();
    if (!imageId || !message) {
      return NextResponse.json({ error: 'imageId and message are required' }, { status: 400 });
    }

    const normalizedInputMode = inputMode === 'voice' ? 'voice' : 'web';
    const accessType = await getImageAccessType(auth.user.id, imageId);
    if (!accessType) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

    const context = await retriever.retrieve(imageId, message, ASK_CONTEXT_LIMIT);
    if (!context) {
      return NextResponse.json({
        response: "I don't have enough verified information about this photo yet. Try again after the wiki is generated or more contributor details are added.",
      });
    }

    const existingBrowserId = request.cookies.get(COOKIE_NAME)?.value;
    const browserId = existingBrowserId || randomUUID();
    const userId = auth.user.id;

    const session = await ensureChatSession({ browserId, imageId, userId });

    const history = await prisma.emberMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'asc' },
      take: HISTORY_LIMIT,
    });

    const conversationHistory = history
      .filter((entry) => !entry.imageFilename)
      .map((entry) => ({ role: entry.role as 'user' | 'assistant', content: entry.content }));

    await prisma.emberMessage.create({
      data: { sessionId: session.id, role: 'user', content: message },
    });

    conversationHistory.push({ role: 'user', content: message });

    const imageRecord = await prisma.image.findUnique({
      where: { id: imageId },
      select: { mediaType: true },
    });
    const subjectNoun = imageRecord?.mediaType === 'VIDEO' ? 'video' : 'photo';
    const response = await generateAskResponse({ context, conversationHistory, subjectNoun });

    let contributorSessionId: string | null = null;
    let storedMemory: { saved: boolean; summary: string | null; topic: AskMemoryTopic | null } = {
      saved: false, summary: null, topic: null,
    };

    try {
      const contributorRecord = await ensureUserContributorForImage(imageId, auth.user.id);
      if (contributorRecord) {
        const contributorSession = await ensureContributorSession(contributorRecord.id, imageId);
        contributorSessionId = contributorSession.id;

        await prisma.emberMessage.createMany({
          data: [
            { sessionId: contributorSession.id, role: 'user', content: message, source: normalizedInputMode },
            { sessionId: contributorSession.id, role: 'assistant', content: response, source: 'web' },
          ],
        });
      }
    } catch (persistError) {
      console.error('Ask Ember conversation persist error:', persistError);
    }

    try {
      const analyzedCapture = await analyzeAskMemoryCapture({ context, recentTurns: conversationHistory, message });
      const memoryCapture = analyzedCapture.shouldStoreMemory ? analyzedCapture : buildFallbackAskMemoryCapture(message);

      if (memoryCapture.shouldStoreMemory && contributorSessionId) {
        const memorySummary = memoryCapture.memorySummary;
        const memoryTopic = memoryCapture.memoryTopic || 'followup';

        if (!memorySummary) throw new Error('Memory capture indicated storage without a summary');

        await prisma.emberMessage.create({
          data: {
            sessionId: contributorSessionId,
            role: 'user',
            content: memorySummary,
            source: normalizedInputMode,
            question: getStoredQuestion(memoryTopic),
            questionType: memoryTopic,
          },
        });

        storedMemory = { saved: true, summary: memorySummary, topic: memoryTopic };
      }
    } catch (captureError) {
      console.error('Ask Ember memory capture error:', captureError);
    }

    await prisma.emberMessage.create({
      data: { sessionId: session.id, role: 'assistant', content: response },
    });

    const nextResponse = NextResponse.json({ response, storedMemory });
    if (!existingBrowserId || session.browserId !== browserId) {
      nextResponse.cookies.set(COOKIE_NAME, session.browserId ?? browserId, {
        httpOnly: true, sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: COOKIE_MAX_AGE, path: '/',
      });
    }

    return nextResponse;
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({ error: 'Failed to process chat message' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!(await isFeatureEnabled('ask_ember', true))) {
      return NextResponse.json({ error: 'Ask Ember is currently disabled' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const imageId = searchParams.get('imageId');
    if (!imageId) return NextResponse.json({ error: 'imageId is required' }, { status: 400 });

    const accessType = await getImageAccessType(auth.user.id, imageId);
    if (!accessType) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

    const userId = auth.user.id;

    const [session, contributor] = await Promise.all([
      prisma.emberSession.findUnique({ where: { userId_imageId: { userId, imageId } } }),
      prisma.contributor.findFirst({
        where: { imageId, userId },
        select: {
          id: true,
          emberSession: {
            select: {
              messages: {
                where: { source: 'voice', questionType: { not: null } },
                orderBy: { createdAt: 'asc' },
                select: { id: true, question: true, content: true, questionType: true, createdAt: true },
              },
            },
          },
        },
      }),
    ]);

    const history = session
      ? await prisma.emberMessage.findMany({
          where: { sessionId: session.id },
          orderBy: { createdAt: 'asc' },
          take: HISTORY_LIMIT,
        })
      : [];

    const clips = contributor
      ? await prisma.voiceCallClip.findMany({
          where: { imageId, contributorId: contributor.id },
          select: { quote: true, audioUrl: true },
        })
      : [];

    type MergedEntry = {
      role: string;
      content: string;
      source: 'web' | 'voice';
      imageFilename: string | null;
      audioUrl: string | null;
      createdAt: string;
    };

    const chatEntries: MergedEntry[] = history.map((entry) => ({
      role: entry.role,
      content: entry.content,
      source: 'web',
      imageFilename: entry.imageFilename ?? null,
      audioUrl: null,
      createdAt: entry.createdAt.toISOString(),
    }));

    const voiceMessages = contributor?.emberSession?.messages ?? [];
    const voiceEntries: MergedEntry[] = voiceMessages.flatMap((msg) => {
      const matchedClip = clips.find(
        (clip) => clip.audioUrl && clip.quote.trim().length > 10 && msg.content.includes(clip.quote.trim().slice(0, 40))
      );
      const audioUrl = matchedClip?.audioUrl ?? null;
      return [
        { role: 'assistant', content: msg.question ?? '', source: 'voice' as const, imageFilename: null, audioUrl: null, createdAt: msg.createdAt.toISOString() },
        { role: 'user', content: msg.content, source: 'voice' as const, imageFilename: null, audioUrl, createdAt: msg.createdAt.toISOString() },
      ];
    });

    const merged = [...chatEntries, ...voiceEntries].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    return NextResponse.json({ messages: merged });
  } catch (error) {
    console.error('Chat history error:', error);
    return NextResponse.json({ error: 'Failed to load chat history' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { imageId, imageFilename } = await request.json();
    if (!imageId || !imageFilename) {
      return NextResponse.json({ error: 'imageId and imageFilename are required' }, { status: 400 });
    }

    const accessType = await getImageAccessType(auth.user.id, imageId);
    if (!accessType) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

    const userId = auth.user.id;
    const existingBrowserId = request.cookies.get(COOKIE_NAME)?.value;
    const browserId = existingBrowserId || randomUUID();

    const session = await ensureChatSession({ browserId, imageId, userId });

    await prisma.emberMessage.createMany({
      data: [
        { sessionId: session.id, role: 'user', content: '', imageFilename },
        { sessionId: session.id, role: 'assistant', content: "Got it! I received your photo and I'm starting to analyze it." },
      ],
    });

    const response = NextResponse.json({ ok: true });
    if (!existingBrowserId || session.browserId !== browserId) {
      response.cookies.set(COOKIE_NAME, session.browserId ?? browserId, {
        httpOnly: true, sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: COOKIE_MAX_AGE, path: '/',
      });
    }

    return response;
  } catch (error) {
    console.error('Chat image record error:', error);
    return NextResponse.json({ error: 'Failed to record image' }, { status: 500 });
  }
}
