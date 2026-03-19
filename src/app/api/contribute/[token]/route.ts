import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { chat } from '@/lib/claude';
import { getEmberTitle } from '@/lib/ember-title';
import { isGuestUserEmail } from '@/lib/guest-embers';
import { parseConfirmedLocationContext } from '@/lib/location-suggestions';
import { generateWikiForImage } from '@/lib/wiki-generator';
import { refreshVoiceCallFromProvider, shouldRefreshVoiceCallStatus } from '@/lib/voice-calls';

// GET - Fetch contributor info and conversation
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
        conversation: {
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
        conversation: {
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
        conversation: refreshedContributor.conversation,
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
        conversation: {
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
            },
            responses: true,
          },
        },
      },
    });

    if (!contributor) {
      return NextResponse.json({ error: 'Invalid link' }, { status: 404 });
    }

    // Create conversation if doesn't exist
    let conversation = contributor.conversation;
    let welcomeMessage: string | null = null;
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          contributorId: contributor.id,
          status: 'active',
          currentStep: 'context',
        },
        include: {
          messages: true,
          responses: true,
        },
      });

      // Add welcome message
      welcomeMessage = contributor.name
        ? `Hi ${contributor.name}! I'm Ember. Thanks for sharing your memories about this image. To start, can you describe what you see or remember about this moment?`
        : `Hi! I'm Ember. Thanks for sharing your memories about this image. To start, can you describe what you see or remember about this moment?`;

      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: 'assistant',
          content: welcomeMessage,
          source: 'web',
        },
      });
    }

    if (message === '__START__') {
      if (conversation.status === 'completed') {
        const restartMessage =
          "I'm ready for more. Tell me any extra detail, correction, or small moment you want Ember to remember.";

        await prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            status: 'active',
            currentStep: 'followup',
          },
        });

        await prisma.message.create({
          data: {
            conversationId: conversation.id,
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
        contributor.conversation?.messages
          ?.slice()
          .reverse()
          .find((entry) => entry.role === 'assistant')?.content || welcomeMessage;

      return NextResponse.json({
        response: latestAssistantMessage || 'Thanks for joining the interview.',
        isComplete: conversation.status === 'completed',
      });
    }

    // Save user message
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: message,
        source: 'web',
      },
    });

    // Get updated conversation with all messages
    const updatedConversation = await prisma.conversation.findUnique({
      where: { id: conversation.id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        responses: true,
      },
    });

    // Generate AI response based on interview flow
    const response = await generateInterviewResponse(
      updatedConversation!,
      message,
      buildInterviewKnownContext(contributor)
    );

    // Save assistant response
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: response.message,
        source: 'web',
      },
    });

    // Save response data if applicable
    if (response.questionType && response.answer) {
      await prisma.response.create({
        data: {
          conversationId: conversation.id,
          questionType: response.questionType,
          question: response.question || '',
          answer: response.answer,
          source: 'web',
        },
      });
    }

    // Update conversation step
    if (response.nextStep) {
      await prisma.conversation.update({
        where: { id: conversation.id },
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

const INTERVIEW_QUESTIONS: Record<string, string> = {
  context: "Can you describe what you see or what memory this image captures for you?",
  who: "Who are the people in this image? What's your relationship to them?",
  when: "When was this taken? Do you remember the date, year, or occasion?",
  where: "Where was this? What do you remember about the location?",
  what: "What was happening at this moment? Any specific events or activities?",
  why: "Why is this image or memory significant to you?",
  how: "How did this moment come about? Any backstory?",
};

const STEP_ORDER = ['context', 'who', 'when', 'where', 'what', 'why', 'how', 'completed'];

type InterviewConversation = {
  currentStep: string;
  messages: Array<{
    role: string;
    content: string;
  }>;
  responses?: Array<{
    questionType: string;
    answer: string;
  }>;
};

type InterviewKnownContext = {
  imageTitle: string;
  imageDescription: string | null;
  analysisSummary: string | null;
  confirmedPeople: string[];
  knownWhen: string | null;
  knownWhere: string | null;
};

function formatCapturedAtForInterview(value: Date | null | undefined) {
  if (!value) {
    return null;
  }

  return value.toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

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
  const confirmedPeople = Array.from(
    new Set(
      contributor.image.tags
        .map((tag) => tag.user?.name || tag.contributor?.name || tag.label)
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value))
    )
  );
  const confirmedLocation = parseConfirmedLocationContext(
    contributor.image.analysis?.metadataJson
  );
  const knownWhere = confirmedLocation
    ? [confirmedLocation.label, confirmedLocation.detail].filter(Boolean).join(', ')
    : contributor.image.analysis?.latitude != null && contributor.image.analysis?.longitude != null
      ? `GPS metadata already places this photo near ${contributor.image.analysis.latitude.toFixed(5)}, ${contributor.image.analysis.longitude.toFixed(5)}.`
      : null;

  return {
    imageTitle: getEmberTitle(contributor.image),
    imageDescription: contributor.image.description,
    analysisSummary:
      contributor.image.analysis?.visualDescription ||
      contributor.image.analysis?.summary ||
      null,
    confirmedPeople,
    knownWhen: formatCapturedAtForInterview(contributor.image.analysis?.capturedAt),
    knownWhere,
  };
}

function getKnownInterviewSteps(context: InterviewKnownContext) {
  const steps = new Set<string>();

  if (context.knownWhen) {
    steps.add('when');
  }

  if (context.knownWhere) {
    steps.add('where');
  }

  return steps;
}

function getNextInterviewStep({
  currentStep,
  answeredSteps,
  knownSteps,
}: {
  currentStep: string;
  answeredSteps: Set<string>;
  knownSteps: Set<string>;
}) {
  const currentIndex = STEP_ORDER.indexOf(currentStep);

  for (let index = currentIndex + 1; index < STEP_ORDER.length; index += 1) {
    const candidate = STEP_ORDER[index];

    if (candidate === 'completed') {
      return 'completed';
    }

    if (answeredSteps.has(candidate) || knownSteps.has(candidate)) {
      continue;
    }

    return candidate;
  }

  return 'completed';
}

async function generateInterviewResponse(
  conversation: InterviewConversation,
  userMessage: string,
  knownContext: InterviewKnownContext
): Promise<{
  message: string;
  questionType?: string;
  question?: string;
  answer?: string;
  nextStep?: string;
}> {
  const currentStep = conversation.currentStep;
  const messages = conversation.messages;
  const conversationHistory = messages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

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

    const followupPrompt = `You are Ember collecting one more memory detail after an interview was already completed.

Your job:
1. Briefly acknowledge the new detail without embellishing it.
2. Invite one more small detail only if it feels natural.

Rules:
- Do not add facts the contributor did not say.
- Keep it to at most 2 short sentences.
- Sound warm and concise.
- End by making it clear they can add more or stop whenever they want.`;

    const followupResponse = await chat(followupPrompt, [
      ...conversationHistory,
      { role: 'user', content: userMessage },
    ]);

    return {
      message: followupResponse,
      questionType: 'followup',
      question: 'Additional detail',
      answer: userMessage,
      nextStep: 'followup',
    };
  }

  const answeredSteps = new Set(
    (conversation.responses || [])
      .map((response) => response.questionType)
      .filter(Boolean)
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
    (conversation.responses || []).length > 0
      ? `Answers already collected:\n${(conversation.responses || [])
          .map((response) => `- ${response.questionType}: ${response.answer}`)
          .join('\n')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  const systemPrompt = `You are Ember, guiding someone through a short memory interview about a photo.
You just received their answer to the "${currentStep}" topic.

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
${knownFacts || 'No extra confirmed context.'}

${nextStep !== 'completed'
  ? `Next question topic: "${nextStep}"
Standard question intent: "${INTERVIEW_QUESTIONS[nextStep]}"
Rephrase it naturally based on the conversation flow and known context.`
  : 'The interview is complete. Thank them briefly and say Ember will update the memory with what they shared.'}`;

  const aiResponse = await chat(systemPrompt, [
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ]);

  return {
    message: aiResponse,
    questionType: currentStep,
    question: INTERVIEW_QUESTIONS[currentStep] || currentStep,
    answer: userMessage,
    nextStep: nextStep,
  };
}
