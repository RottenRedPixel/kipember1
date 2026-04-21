import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { chat } from '@/lib/claude';
import { renderPromptTemplate } from '@/lib/control-plane';
import { isGuestUserEmail } from '@/lib/guest-embers';
import {
  buildInterviewKnownContextFromImage,
  getKnownInterviewSteps,
  getNextInterviewStep,
  INTERVIEW_QUESTIONS,
  isInterviewQuestionType,
  type InterviewKnownContext,
} from '@/lib/interview-flow';
import { generateWikiForImage } from '@/lib/wiki-generator';
import { refreshVoiceCallFromProvider, shouldRefreshVoiceCallStatus } from '@/lib/voice-calls';

const CONTRIBUTOR_FOLLOWUP_PROMPT = `You are Ember collecting one more memory detail after an interview was already completed.

Your job:
1. Briefly acknowledge the new detail without embellishing it.
2. Invite one more small detail only if it feels natural.

Rules:
- Do not add facts the contributor did not say.
- Keep it to at most 2 short sentences.
- Sound warm and concise.
- End by making it clear they can add more or stop whenever they want.`;

const CONTRIBUTOR_CORE_PROMPT_TEMPLATE = `You are Ember, guiding someone through a short memory interview about a photo.
You just received their answer to the "{{currentStep}}" topic.

Your job:
1. Briefly acknowledge only what they actually said.
2. Ask the next useful question naturally, or wrap up if the interview is complete.

Rules:
- Do not embellish, dramatize, or add facts the contributor did not say.
- Do not reinterpret objects or people. If the contributor says "statue", "doll", "decoration", or similar, keep that wording.
- Do not ask for facts already known from metadata, tags, or earlier answers.
- Do not ask for date/time if metadata already provides it.
- Do not ask for location if metadata already provides it.
- Keep the whole response to at most 2 short sentences.
- Sound warm, but restrained and grounded.

Known context:
{{knownFacts}}

{{nextStepInstructions}}`;

// GET - Fetch contributor info and session
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    void request;

    const { token } = await params;

    const contributor = await prisma.contributor.findUnique({
      where: { token },
      include: {
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
              orderBy: { createdAt: 'asc' },
            },
          },
        },
        voiceCalls: {
          orderBy: { createdAt: 'desc' },
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
      },
    });

    if (!contributor) {
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

    const latestVoiceCall = contributor.voiceCalls[0] ?? null;
    if (shouldRefreshVoiceCallStatus(latestVoiceCall)) {
      try {
        await refreshVoiceCallFromProvider(latestVoiceCall.id);
      } catch (refreshError) {
        console.error('Failed to refresh contributor voice call from provider:', refreshError);
      }
    }

    const refreshedContributor = await prisma.contributor.findUnique({
      where: { token },
      include: {
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
              orderBy: { createdAt: 'asc' },
            },
          },
        },
        voiceCalls: {
          orderBy: { createdAt: 'desc' },
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
      },
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
          name: refreshedContributor.name,
          phoneNumber: refreshedContributor.phoneNumber,
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
        guestFlow: isGuestUserEmail(refreshedContributor.image.owner.email),
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

// POST - Handle chat message from contributor
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

    const contributor = await prisma.contributor.findUnique({
      where: { token },
      include: {
        image: {
          include: {
            analysis: true,
            tags: {
              include: {
                user: {
                  select: {
                    name: true,
                    email: true,
                  },
                },
                contributor: {
                  select: {
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
        emberSession: {
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });

    if (!contributor) {
      return NextResponse.json({ error: 'Invalid link' }, { status: 404 });
    }

    // Create session if doesn't exist
    let session = contributor.emberSession;
    let welcomeMessage: string | null = null;
    if (!session) {
      try {
        session = await prisma.emberSession.create({
          data: {
            contributorId: contributor.id,
            imageId: contributor.image.id,
            sessionType: 'chat',
            status: 'active',
            currentStep: 'context',
          },
          include: {
            messages: true,
          },
        });
      } catch (e: unknown) {
        if ((e as { code?: string }).code === 'P2002') {
          session = await prisma.emberSession.findUnique({
            where: { contributorId: contributor.id },
            include: { messages: { orderBy: { createdAt: 'asc' } } },
          });
        } else {
          throw e;
        }
      }

      if (session) {
        // Add welcome message
        welcomeMessage = contributor.name
          ? `Hi ${contributor.name}! I'm Ember. Thanks for sharing your memories about this image. To start, can you describe what you see or remember about this moment?`
          : `Hi! I'm Ember. Thanks for sharing your memories about this image. To start, can you describe what you see or remember about this moment?`;

        await prisma.emberMessage.create({
          data: {
            sessionId: session.id,
            role: 'assistant',
            content: welcomeMessage,
            source: 'web',
          },
        });
      }
    }

    if (!session) {
      return NextResponse.json({ error: 'Failed to start session' }, { status: 500 });
    }

    if (message === '__START__') {
      if (session.status === 'completed') {
        const restartMessage =
          "I'm ready for more. Tell me any extra detail, correction, or small moment you want Ember to remember.";

        await prisma.emberSession.update({
          where: { id: session.id },
          data: {
            status: 'active',
            currentStep: 'followup',
          },
        });

        await prisma.emberMessage.create({
          data: {
            sessionId: session.id,
            role: 'assistant',
            content: restartMessage,
            source: 'web',
          },
        });

        return NextResponse.json({
          response: restartMessage,
          isComplete: false,
        });
      }

      const latestAssistantMessage =
        contributor.emberSession?.messages
          ?.slice()
          .reverse()
          .find((entry) => entry.role === 'assistant')?.content || welcomeMessage;

      return NextResponse.json({
        response: latestAssistantMessage || 'Thanks for joining the interview.',
        isComplete: session.status === 'completed',
      });
    }

    // Save user message
    await prisma.emberMessage.create({
      data: {
        sessionId: session.id,
        role: 'user',
        content: message,
        source: 'web',
      },
    });

    // Get updated session with all messages
    const updatedSession = await prisma.emberSession.findUnique({
      where: { id: session.id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });

    // Generate AI response based on interview flow
    const response = await generateInterviewResponse(
      updatedSession!,
      message,
      buildInterviewKnownContext(contributor)
    );

    // Save assistant response
    await prisma.emberMessage.create({
      data: {
        sessionId: session.id,
        role: 'assistant',
        content: response.message,
        source: 'web',
      },
    });

    // Save structured answer if applicable
    if (response.questionType && response.answer) {
      await prisma.emberMessage.create({
        data: {
          sessionId: session.id,
          role: 'user',
          content: response.answer,
          source: 'web',
          questionType: response.questionType,
          question: response.question || '',
        },
      });
    }

    // Update session step
    if (response.nextStep) {
      await prisma.emberSession.update({
        where: { id: session.id },
        data: {
          currentStep: response.nextStep,
          status: response.nextStep === 'completed' ? 'completed' : 'active',
        },
      });
    }

    let memoryCreated = false;
    const shouldRefreshWiki =
      response.nextStep === 'completed' || response.questionType === 'followup';

    if (shouldRefreshWiki) {
      try {
        await generateWikiForImage(contributor.imageId);
        memoryCreated = true;
      } catch (wikiError) {
        console.error('Failed to refresh memory after web interview:', wikiError);
      }
    }

    return NextResponse.json({
      response: response.message,
      isComplete: response.nextStep === 'completed',
      memoryCreated,
    });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({ error: 'Failed to process message' }, { status: 500 });
  }
}

type InterviewSession = {
  currentStep: string | null;
  status: string;
  messages: Array<{
    role: string;
    content: string;
    questionType?: string | null;
    question?: string | null;
  }>;
};

function buildInterviewKnownContext(contributor: {
  image: {
    originalName: string;
    title: string | null;
    description: string | null;
    analysis: {
      summary: string | null;
      visualDescription: string | null;
      capturedAt: Date | null;
      latitude: number | null;
      longitude: number | null;
      metadataJson: string | null;
    } | null;
    tags: Array<{
      label: string;
      user: {
        name: string | null;
        email: string;
      } | null;
      contributor: {
        name: string | null;
        email: string | null;
      } | null;
    }>;
  };
}): InterviewKnownContext {
  return buildInterviewKnownContextFromImage(contributor.image);
}

async function generateInterviewResponse(
  session: InterviewSession,
  userMessage: string,
  knownContext: InterviewKnownContext
): Promise<{
  message: string;
  questionType?: string;
  question?: string;
  answer?: string;
  nextStep?: string;
}> {
  const currentStep = session.currentStep ?? 'context';
  const messages = session.messages;
  const conversationHistory = messages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  // Structured answers are messages with questionType set
  const structuredAnswers = messages.filter((m) => m.role === 'user' && m.questionType);

  // If already completed
  if (currentStep === 'completed') {
    return {
      message: "Thanks again for sharing! Your memories have been recorded. Feel free to close this page.",
    };
  }

  if (currentStep === 'followup') {
    const shouldCloseFollowup = /^(no|nope|nah|that'?s all|thats all|nothing else|all i have|all i remember)\b/i.test(
      userMessage.trim()
    );

    if (shouldCloseFollowup) {
      return {
        message: 'Thanks. Ember has everything you wanted to add, and the memory will stay updated.',
        questionType: 'followup',
        question: 'Additional detail',
        answer: userMessage,
        nextStep: 'completed',
      };
    }

    const followupPrompt = await renderPromptTemplate(
      'contributor_interview.followup',
      CONTRIBUTOR_FOLLOWUP_PROMPT
    );

    const followupResponse = await chat(followupPrompt, [
      ...conversationHistory,
      { role: 'user', content: userMessage },
    ], {
      capabilityKey: 'voice.transcript_extract',
      maxTokens: 256,
    });

    return {
      message: followupResponse,
      questionType: 'followup',
      question: 'Additional detail',
      answer: userMessage,
      nextStep: 'followup',
    };
  }

  const answeredSteps = new Set(
    structuredAnswers
      .map((m) => m.questionType)
      .filter((qt): qt is string => Boolean(qt))
  );
  answeredSteps.add(currentStep);

  const nextStep = getNextInterviewStep({
    currentStep,
    answeredSteps,
    knownSteps: getKnownInterviewSteps(knownContext),
  });

  const knownFacts = [
    `Ember title: ${knownContext.imageTitle}`,
    knownContext.imageDescription
      ? `Image description: ${knownContext.imageDescription}`
      : null,
    knownContext.analysisSummary
      ? `Image analysis summary: ${knownContext.analysisSummary}`
      : null,
    knownContext.confirmedPeople.length > 0
      ? `Confirmed tagged people: ${knownContext.confirmedPeople.join(', ')}`
      : null,
    knownContext.knownWhen
      ? `Known capture time from metadata: ${knownContext.knownWhen}`
      : null,
    knownContext.knownWhere
      ? `Known location from metadata: ${knownContext.knownWhere}`
      : null,
    structuredAnswers.length > 0
      ? `Answers already collected:\n${structuredAnswers
          .map((m) => `- ${m.questionType}: ${m.content}`)
          .join('\n')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  const nextStepInstructions =
    nextStep !== 'completed'
      ? `Next question topic: "${nextStep}"
Standard question intent: "${INTERVIEW_QUESTIONS[nextStep]}"
Rephrase it naturally based on the conversation flow and known context.`
      : 'The interview is complete. Thank them briefly and say Ember will update the memory with what they shared.';
  const systemPrompt = await renderPromptTemplate(
    'contributor_interview.core',
    CONTRIBUTOR_CORE_PROMPT_TEMPLATE,
    {
      currentStep,
      knownFacts: knownFacts || 'No extra confirmed context.',
      nextStepInstructions,
    }
  );

  const aiResponse = await chat(systemPrompt, [
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ], {
    capabilityKey: 'voice.transcript_extract',
    maxTokens: 256,
  });

  return {
    message: aiResponse,
    questionType: currentStep,
    question: isInterviewQuestionType(currentStep)
      ? INTERVIEW_QUESTIONS[currentStep]
      : currentStep,
    answer: userMessage,
    nextStep: nextStep,
  };
}
