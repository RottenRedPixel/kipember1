import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { requireApiUser } from '@/lib/auth-server';
import { retriever } from '@/lib/context-retrieval';
import { prisma } from '@/lib/db';
import { getImageAccessType } from '@/lib/ember-access';
import { chat } from '@/lib/claude';
import { getAskCaptureModel, getOpenAIClient } from '@/lib/openai';
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

function buildSystemPrompt(context: string): string {
  return `You answer questions about a specific photo using only the verified or clearly labeled information in the context below.

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
- Keep answers clear, conversational, and concise.
- If the user shares a new memory detail in their latest message, you may acknowledge it as something they just told you.
- If the user shares a concrete new detail without asking a direct question, respond briefly and ask at most one short follow-up question that would deepen the memory.

CONTEXT:
${context}`;
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
    const response = await chat(buildSystemPrompt(context), conversationHistory);
    return response.trim() || `I don't know enough yet to answer that about this ${subjectNoun}.`;
  } catch (error) {
    console.error('Ask Ember primary response failed:', error);
  }

  const reducedContext =
    context.length > ASK_RETRY_CONTEXT_LIMIT
      ? `${context.slice(0, ASK_RETRY_CONTEXT_LIMIT - 3).trimEnd()}...`
      : context;

  try {
    const response = await chat(
      buildSystemPrompt(reducedContext),
      conversationHistory.slice(-RECENT_TURNS_LIMIT)
    );
    return (
      response.trim() ||
      `I couldn't fully answer that right now, but I can still keep learning about this ${subjectNoun}.`
    );
  } catch (retryError) {
    console.error('Ask Ember retry response failed:', retryError);
  }

  return `I couldn't answer that right now, but I can still save what you tell me about this ${subjectNoun}.`;
}

function trimMemorySummary(value: string | null | undefined) {
  const cleaned = value?.replace(/\s+/g, ' ').trim() || null;
  if (!cleaned) {
    return null;
  }

  if (cleaned.length <= 360) {
    return cleaned;
  }

  return `${cleaned.slice(0, 357).trimEnd()}...`;
}

function isAskMemoryTopic(value: string | null | undefined): value is AskMemoryTopic {
  return (
    value === 'context' ||
    value === 'who' ||
    value === 'what' ||
    value === 'when' ||
    value === 'where' ||
    value === 'why' ||
    value === 'how' ||
    value === 'followup'
  );
}

function buildFallbackAskMemoryCapture(message: string): AskMemoryCapture {
  const cleaned = trimMemorySummary(message);
  if (!cleaned) {
    return {
      shouldStoreMemory: false,
      memoryTopic: null,
      memorySummary: null,
    };
  }

  const normalized = cleaned.toLowerCase();
  const shortReactionPatterns = [
    /^ok[.!]*$/,
    /^okay[.!]*$/,
    /^thanks?[.!]*$/,
    /^thank you[.!]*$/,
    /^cool[.!]*$/,
    /^great[.!]*$/,
    /^wow[.!]*$/,
    /^nice[.!]*$/,
    /^hi[.!]*$/,
    /^hello[.!]*$/,
  ];

  if (shortReactionPatterns.some((pattern) => pattern.test(normalized))) {
    return {
      shouldStoreMemory: false,
      memoryTopic: null,
      memorySummary: null,
    };
  }

  const looksLikeQuestion =
    cleaned.includes('?') ||
    /^(who|what|when|where|why|how|is|are|was|were|did|does|do|can|could|would|should)\b/i.test(
      cleaned
    );

  if (looksLikeQuestion || cleaned.length < 18) {
    return {
      shouldStoreMemory: false,
      memoryTopic: null,
      memorySummary: null,
    };
  }

  return {
    shouldStoreMemory: true,
    memoryTopic: 'followup',
    memorySummary: cleaned,
  };
}

function getStoredQuestion(questionType: AskMemoryTopic) {
  if (questionType === 'followup') {
    return 'What else would you like Ember to remember about this moment?';
  }

  return isInterviewQuestionType(questionType)
    ? INTERVIEW_QUESTIONS[questionType]
    : 'Additional detail shared in Ask Ember';
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

async function analyzeAskMemoryCapture({
  context,
  recentTurns,
  message,
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

  const response = await openai.responses.create({
    model: getAskCaptureModel(),
    input: [
      {
        role: 'developer',
        type: 'message',
        content: [
          {
            type: 'input_text',
            text: `You decide whether the user's newest Ask Ember message contains a durable memory detail that should be saved to Ember.

Rules:
- shouldStoreMemory should be true only when the user is clearly sharing, correcting, or confirming information about the memory, photo, people, place, timing, feelings, relationships, or what happened.
- If the message is only a question, greeting, reaction, or guess, return shouldStoreMemory false.
- If the message both asks something and shares a real memory detail, return shouldStoreMemory true.
- Do not store details that are already plainly present in KNOWN CONTEXT unless the user is adding nuance, correcting them, or making them more specific.
- memorySummary should be one concise sentence describing only the newly shared durable detail.
- memorySummary must not include the user's question unless the question itself contains the memory detail.
- memoryTopic should be the best fit: context, who, what, when, where, why, how, or followup.
- If you are unsure, return shouldStoreMemory false and nulls for the other fields.
- Return JSON only.`,
          },
        ],
      },
      {
        role: 'user',
        type: 'message',
        content: [
          {
            type: 'input_text',
            text: `KNOWN CONTEXT
${trimmedContext || 'None yet'}

RECENT ASK EMBER TURNS
${recentConversation || 'None yet'}

NEWEST USER MESSAGE
${message}`,
          },
        ],
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
    return {
      shouldStoreMemory: false,
      memoryTopic: null,
      memorySummary: null,
    };
  }

  return {
    shouldStoreMemory: true,
    memoryTopic: memoryTopic || 'followup',
    memorySummary,
  };
}

async function ensureContributorConversation(contributorId: string) {
  const existing = await prisma.conversation.findUnique({
    where: {
      contributorId,
    },
  });

  if (existing) {
    return existing;
  }

  try {
    return await prisma.conversation.create({
      data: {
        contributorId,
        status: 'active',
        currentStep: 'followup',
      },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const racedConversation = await prisma.conversation.findUnique({
      where: {
        contributorId,
      },
    });

    if (!racedConversation) {
      throw error;
    }

    return racedConversation;
  }
}

async function ensureChatSession({
  browserId,
  imageId,
  userId,
}: {
  browserId: string;
  imageId: string;
  userId: string;
}) {
  const existingUserSession = await prisma.chatSession.findUnique({
    where: {
      userId_imageId: {
        userId,
        imageId,
      },
    },
  });

  if (existingUserSession) {
    return existingUserSession;
  }

  try {
    return await prisma.chatSession.create({
      data: {
        browserId,
        imageId,
        userId,
      },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const racedUserSession = await prisma.chatSession.findUnique({
      where: {
        userId_imageId: {
          userId,
          imageId,
        },
      },
    });

    if (racedUserSession) {
      return racedUserSession;
    }

    const existingBrowserSession = await prisma.chatSession.findUnique({
      where: {
        browserId_imageId: {
          browserId,
          imageId,
        },
      },
    });

    if (existingBrowserSession) {
      if (existingBrowserSession.userId === userId) {
        return existingBrowserSession;
      }

      if (!existingBrowserSession.userId) {
        try {
          return await prisma.chatSession.update({
            where: { id: existingBrowserSession.id },
            data: { userId },
          });
        } catch (updateError) {
          if (!isUniqueConstraintError(updateError)) {
            throw updateError;
          }

          const racedUpdatedSession = await prisma.chatSession.findUnique({
            where: {
              userId_imageId: {
                userId,
                imageId,
              },
            },
          });

          if (racedUpdatedSession) {
            return racedUpdatedSession;
          }

          throw updateError;
        }
      }
    }

    const replacementBrowserId = randomUUID();
    try {
      return await prisma.chatSession.create({
        data: {
          browserId: replacementBrowserId,
          imageId,
          userId,
        },
      });
    } catch (retryError) {
      if (!isUniqueConstraintError(retryError)) {
        throw retryError;
      }

      const finalUserSession = await prisma.chatSession.findUnique({
        where: {
          userId_imageId: {
            userId,
            imageId,
          },
        },
      });

      if (finalUserSession) {
        return finalUserSession;
      }

      throw retryError;
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { imageId, message, inputMode } = await request.json();

    if (!imageId || !message) {
      return NextResponse.json(
        { error: 'imageId and message are required' },
        { status: 400 }
      );
    }

    const normalizedInputMode = inputMode === 'voice' ? 'voice' : 'web';

    const accessType = await getImageAccessType(auth.user.id, imageId);
    if (!accessType) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const context = await retriever.retrieve(imageId, message, ASK_CONTEXT_LIMIT);

    if (!context) {
      return NextResponse.json({
        response:
          "I don't have enough verified information about this photo yet. Try again after the wiki is generated or more contributor details are added.",
      });
    }

    const existingBrowserId = request.cookies.get(COOKIE_NAME)?.value;
    const browserId = existingBrowserId || randomUUID();
    const userId = auth.user.id;

    const session = await ensureChatSession({ browserId, imageId, userId });

    const history = await prisma.chatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'asc' },
      take: HISTORY_LIMIT,
    });

    const conversationHistory = history
      .filter((entry) => !entry.imageFilename) // skip image-only messages from AI context
      .map((entry) => ({
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

    const imageRecord = await prisma.image.findUnique({
      where: { id: imageId },
      select: { mediaType: true },
    });
    const subjectNoun = imageRecord?.mediaType === 'VIDEO' ? 'video' : 'photo';
    const response = await generateAskResponse({
      context,
      conversationHistory,
      subjectNoun,
    });
    let contributorConversation:
      | {
          contributorId: string;
          conversationId: string;
        }
      | null = null;
    let storedMemory: {
      saved: boolean;
      summary: string | null;
      topic: AskMemoryTopic | null;
    } = {
      saved: false,
      summary: null,
      topic: null,
    };

    try {
      const contributorRecord = await ensureUserContributorForImage(imageId, auth.user.id);

      if (contributorRecord) {
        const conversation = await ensureContributorConversation(contributorRecord.id);
        contributorConversation = {
          contributorId: contributorRecord.id,
          conversationId: conversation.id,
        };

        await prisma.message.createMany({
          data: [
            {
              conversationId: conversation.id,
              role: 'user',
              content: message,
              source: normalizedInputMode,
            },
            {
              conversationId: conversation.id,
              role: 'assistant',
              content: response,
              source: 'web',
            },
          ],
        });
      }
    } catch (conversationPersistError) {
      console.error('Ask Ember conversation persist error:', conversationPersistError);
    }

    try {
      const analyzedCapture = await analyzeAskMemoryCapture({
        context,
        recentTurns: conversationHistory,
        message,
      });
      const memoryCapture = analyzedCapture.shouldStoreMemory
        ? analyzedCapture
        : buildFallbackAskMemoryCapture(message);

      if (memoryCapture.shouldStoreMemory && contributorConversation) {
        const memorySummary = memoryCapture.memorySummary;
        const memoryTopic = memoryCapture.memoryTopic || 'followup';

        if (!memorySummary) {
          throw new Error('Memory capture indicated storage without a summary');
        }

        await prisma.response.create({
          data: {
            conversationId: contributorConversation.conversationId,
            questionType: memoryTopic,
            question: getStoredQuestion(memoryTopic),
            answer: memorySummary,
            source: normalizedInputMode,
          },
        });

        storedMemory = {
          saved: true,
          summary: memorySummary,
          topic: memoryTopic,
        };
      }
    } catch (captureError) {
      console.error('Ask Ember memory capture error:', captureError);
    }

    await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: 'assistant',
        content: response,
      },
    });

    const nextResponse = NextResponse.json({
      response,
      storedMemory,
    });
    if (!existingBrowserId || session.browserId !== browserId) {
      nextResponse.cookies.set(COOKIE_NAME, session.browserId, {
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

    const userId = auth.user.id;

    const [session, contributor] = await Promise.all([
      prisma.chatSession.findUnique({
        where: { userId_imageId: { userId, imageId } },
      }),
      prisma.contributor.findFirst({
        where: { imageId, userId },
        select: {
          id: true,
          conversation: {
            select: {
              responses: {
                where: { source: 'voice' },
                orderBy: { createdAt: 'asc' },
                select: { id: true, question: true, answer: true, createdAt: true },
              },
            },
          },
        },
      }),
    ]);

    // Load chat messages (may be null if no session yet)
    const history = session
      ? await prisma.chatMessage.findMany({
          where: { sessionId: session.id },
          orderBy: { createdAt: 'asc' },
          take: HISTORY_LIMIT,
        })
      : [];

    // Load voice clips for this contributor so we can attach audioUrl to responses
    const clips = contributor
      ? await prisma.voiceCallClip.findMany({
          where: { imageId, contributorId: contributor.id },
          select: { quote: true, audioUrl: true },
        })
      : [];

    // Build chat message entries
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

    // Build voice response entries (each Response = one assistant Q + one user A)
    const voiceResponses = contributor?.conversation?.responses ?? [];
    const voiceEntries: MergedEntry[] = voiceResponses.flatMap((response) => {
      // Try to find a matching clip whose quote appears in the answer
      const matchedClip = clips.find(
        (clip) =>
          clip.audioUrl &&
          clip.quote.trim().length > 10 &&
          response.answer.includes(clip.quote.trim().slice(0, 40))
      );
      const audioUrl = matchedClip?.audioUrl ?? null;

      return [
        {
          role: 'assistant',
          content: response.question,
          source: 'voice' as const,
          imageFilename: null,
          audioUrl: null,
          createdAt: response.createdAt.toISOString(),
        },
        {
          role: 'user',
          content: response.answer,
          source: 'voice' as const,
          imageFilename: null,
          audioUrl,
          createdAt: response.createdAt.toISOString(),
        },
      ];
    });

    // Merge and sort by createdAt
    const merged = [...chatEntries, ...voiceEntries].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    return NextResponse.json({ messages: merged });
  } catch (error) {
    console.error('Chat history error:', error);
    return NextResponse.json(
      { error: 'Failed to load chat history' },
      { status: 500 }
    );
  }
}

// PATCH — record an image upload event in chat history (no AI response)
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

    await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: 'user',
        content: '',
        imageFilename,
      },
    });

    const response = NextResponse.json({ ok: true });
    if (!existingBrowserId || session.browserId !== browserId) {
      response.cookies.set(COOKIE_NAME, session.browserId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: COOKIE_MAX_AGE,
        path: '/',
      });
    }

    return response;
  } catch (error) {
    console.error('Chat image record error:', error);
    return NextResponse.json({ error: 'Failed to record image' }, { status: 500 });
  }
}
