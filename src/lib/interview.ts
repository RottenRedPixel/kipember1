import { prisma } from './db';
import { chat, generateFollowUpQuestion } from './claude';
import { sendSMS } from './twilio';

const INTERVIEW_STEPS = [
  'greeting',
  'context',
  'who',
  'when',
  'where',
  'what',
  'why',
  'how',
  'followup',
  'closing',
] as const;

type InterviewStep = (typeof INTERVIEW_STEPS)[number];

const STEP_QUESTIONS: Record<InterviewStep, string> = {
  greeting:
    "Hi! You've been invited to share your memories about a special image. I'll ask you a few questions to capture your story. Reply YES to begin!",
  context:
    "Great! Let's start. Can you describe what you see or remember about this image? What memory does it capture for you?",
  who: "Who are the people in this image? What's your relationship to them?",
  when: 'When was this? Do you remember the date, year, or occasion?',
  where: 'Where was this taken? What do you remember about the location?',
  what: 'What was happening at this moment? Any specific events or activities?',
  why: 'Why is this image or memory significant to you?',
  how: 'How did this moment come about? Any backstory you can share?',
  followup: '',
  closing:
    "Thank you so much for sharing your memories! Your stories have been recorded and will help create a rich history of this moment. You can view the memory wiki when it's ready!",
};

function getNextStep(currentStep: InterviewStep): InterviewStep | null {
  const currentIndex = INTERVIEW_STEPS.indexOf(currentStep);
  if (currentIndex === -1 || currentIndex >= INTERVIEW_STEPS.length - 1) {
    return null;
  }
  return INTERVIEW_STEPS[currentIndex + 1];
}

export async function startConversation(contributorId: string): Promise<string> {
  const contributor = await prisma.contributor.findUnique({
    where: { id: contributorId },
    include: { image: true },
  });

  if (!contributor) throw new Error('Contributor not found');
  if (!contributor.phoneNumber) throw new Error('Contributor does not have a phone number');

  let session = await prisma.emberSession.findUnique({ where: { contributorId } });

  if (!session) {
    session = await prisma.emberSession.create({
      data: {
        imageId: contributor.imageId,
        contributorId,
        sessionType: 'chat',
        status: 'pending',
        currentStep: 'greeting',
      },
    });
  }

  const greeting = contributor.name
    ? `Hi ${contributor.name}! ${STEP_QUESTIONS.greeting}`
    : STEP_QUESTIONS.greeting;

  await prisma.emberMessage.create({
    data: { sessionId: session.id, role: 'assistant', content: greeting, source: 'sms' },
  });

  const formattedPhone = contributor.phoneNumber.startsWith('+')
    ? contributor.phoneNumber
    : `+1${contributor.phoneNumber}`;

  await sendSMS(formattedPhone, greeting);
  return greeting;
}

export async function handleIncomingMessage(
  phoneNumber: string,
  message: string
): Promise<string> {
  const normalizedPhone = phoneNumber.replace(/\D/g, '').replace(/^1/, '');

  const contributor = await prisma.contributor.findFirst({
    where: { phoneNumber: { contains: normalizedPhone } },
    include: {
      emberSession: {
        include: {
          messages: { orderBy: { createdAt: 'asc' } },
        },
      },
      image: true,
    },
  });

  if (!contributor) {
    return "Sorry, I couldn't find your conversation. Please contact the person who invited you.";
  }

  let session = contributor.emberSession;

  if (!session) {
    session = await prisma.emberSession.create({
      data: {
        imageId: contributor.imageId,
        contributorId: contributor.id,
        sessionType: 'chat',
        status: 'pending',
        currentStep: 'greeting',
      },
      include: { messages: true },
    });
  }

  await prisma.emberMessage.create({
    data: { sessionId: session.id, role: 'user', content: message, source: 'sms' },
  });

  const currentStep = (session.currentStep ?? 'greeting') as InterviewStep;
  let response: string;
  let nextStep: InterviewStep | null;

  if (currentStep === 'greeting') {
    if (message.toLowerCase().includes('yes')) {
      nextStep = 'context';
      response = STEP_QUESTIONS.context;
      await prisma.emberSession.update({
        where: { id: session.id },
        data: { status: 'active', currentStep: nextStep },
      });
    } else {
      response = "No problem! When you're ready to share your memories, just reply YES to begin.";
      nextStep = null;
    }
  } else if (currentStep === 'closing') {
    response = "Thanks again for sharing! Your memories have been recorded. Feel free to reach out if you have more to add!";
    nextStep = null;
  } else if (currentStep === 'followup') {
    const lastAssistantMessage = [...session.messages].reverse().find((m) => m.role === 'assistant');
    await prisma.emberMessage.create({
      data: {
        sessionId: session.id,
        role: 'user',
        content: message,
        source: 'sms',
        question: lastAssistantMessage?.content || 'Follow-up question',
        questionType: 'followup',
      },
    });

    const structuredResponses = session.messages
      .filter((m) => m.questionType)
      .map((m) => ({ questionType: m.questionType!, answer: m.content }));

    const conversationHistory = session.messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const followUp = await generateFollowUpQuestion(conversationHistory, structuredResponses);

    if (followUp) {
      response = followUp;
      nextStep = 'followup';
    } else {
      response = STEP_QUESTIONS.closing;
      nextStep = 'closing';
      await prisma.emberSession.update({
        where: { id: session.id },
        data: { status: 'completed', currentStep: 'closing' },
      });
    }
  } else {
    await prisma.emberMessage.create({
      data: {
        sessionId: session.id,
        role: 'user',
        content: message,
        source: 'sms',
        question: STEP_QUESTIONS[currentStep],
        questionType: currentStep,
      },
    });

    nextStep = getNextStep(currentStep);

    if (nextStep === 'followup') {
      const structuredResponses = session.messages
        .filter((m) => m.questionType)
        .map((m) => ({ questionType: m.questionType!, answer: m.content }));

      const conversationHistory = session.messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      const followUp = await generateFollowUpQuestion(conversationHistory, structuredResponses);

      if (followUp) {
        response = followUp;
        nextStep = 'followup';
      } else {
        response = STEP_QUESTIONS.closing;
        nextStep = 'closing';
        await prisma.emberSession.update({
          where: { id: session.id },
          data: { status: 'completed', currentStep: 'closing' },
        });
      }
    } else if (nextStep) {
      response = STEP_QUESTIONS[nextStep];
    } else {
      response = STEP_QUESTIONS.closing;
      nextStep = 'closing';
      await prisma.emberSession.update({
        where: { id: session.id },
        data: { status: 'completed', currentStep: 'closing' },
      });
    }

    if (nextStep && nextStep !== 'closing') {
      await prisma.emberSession.update({
        where: { id: session.id },
        data: { currentStep: nextStep },
      });
    }
  }

  await prisma.emberMessage.create({
    data: { sessionId: session.id, role: 'assistant', content: response, source: 'sms' },
  });

  return response;
}
