import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { chat } from '@/lib/claude';

// GET - Fetch contributor info and conversation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const contributor = await prisma.contributor.findUnique({
      where: { token },
      include: {
        image: true,
        conversation: {
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });

    if (!contributor) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
    }
    if (contributor.image.visibility === 'PRIVATE') {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
    }

    return NextResponse.json({
      contributor: {
        id: contributor.id,
        name: contributor.name,
      },
      image: {
        id: contributor.image.id,
        filename: contributor.image.filename,
        originalName: contributor.image.originalName,
        description: contributor.image.description,
      },
      conversation: contributor.conversation,
    });
  } catch (error) {
    console.error('Error fetching contributor:', error);
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 });
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
        image: true,
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
    if (contributor.image.visibility === 'PRIVATE') {
      return NextResponse.json({ error: 'Invalid link' }, { status: 404 });
    }

    // Create conversation if doesn't exist
    let conversation = contributor.conversation;
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
      const welcomeMsg = contributor.name
        ? `Hi ${contributor.name}! Thanks for sharing your memories about this image. Let's start - can you describe what you see or remember about this moment?`
        : `Hi! Thanks for sharing your memories about this image. Let's start - can you describe what you see or remember about this moment?`;

      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: 'assistant',
          content: welcomeMsg,
        },
      });
    }

    // Save user message
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: message,
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
      contributor,
      updatedConversation!,
      message
    );

    // Save assistant response
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: response.message,
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

    return NextResponse.json({
      response: response.message,
      isComplete: response.nextStep === 'completed',
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

async function generateInterviewResponse(
  contributor: any,
  conversation: any,
  userMessage: string
): Promise<{
  message: string;
  questionType?: string;
  question?: string;
  answer?: string;
  nextStep?: string;
}> {
  const currentStep = conversation.currentStep;
  const messages = conversation.messages;

  // If already completed
  if (currentStep === 'completed') {
    return {
      message: "Thanks again for sharing! Your memories have been recorded. Feel free to close this page.",
    };
  }

  // Get current step index and move to next
  const currentIndex = STEP_ORDER.indexOf(currentStep);
  const nextStep = STEP_ORDER[currentIndex + 1] || 'completed';

  // Build conversation history for Claude
  const conversationHistory = messages.map((m: any) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  // Use Claude to generate a natural follow-up
  const systemPrompt = `You are a friendly interviewer helping someone share memories about a photo.
You just received their answer to a question about "${currentStep}".

Your job:
1. Briefly acknowledge their response (1 short sentence)
2. Ask the next question naturally

${nextStep !== 'completed' ? `Next question topic: "${nextStep}"
Standard question: "${INTERVIEW_QUESTIONS[nextStep]}"
Rephrase it naturally based on the conversation flow.` : 'This was the last question. Thank them warmly for sharing their memories and let them know their stories have been saved.'}

Keep your response concise and conversational (2-3 sentences max).`;

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
