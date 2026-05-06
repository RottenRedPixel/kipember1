import { prisma } from './db';
import { generateFollowUpQuestion } from './claude';
import { sendSMS } from './twilio';
import {
  contributorChatSessionIdentity,
  emberSessionParticipantWhere,
  ensureEmberSession,
} from './ember-sessions';

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
  greeting: 'greeting',
  context: 'context',
  who: 'who',
  when: 'when',
  where: 'where',
  what: 'what',
  why: 'why',
  how: 'how',
  followup: '',
  closing: 'closing',
};

function getNextStep(currentStep: InterviewStep): InterviewStep | null {
  const currentIndex = INTERVIEW_STEPS.indexOf(currentStep);
  if (currentIndex === -1 || currentIndex >= INTERVIEW_STEPS.length - 1) {
    return null;
  }
  return INTERVIEW_STEPS[currentIndex + 1];
}

export async function startConversation(emberContributorId: string): Promise<string> {
  const emberContributor = await prisma.emberContributor.findUnique({
    where: { id: emberContributorId },
    include: {
      user: { select: { id: true, phoneNumber: true } },
      image: true,
    },
  });

  if (!emberContributor) throw new Error('Contributor not found');
  if (!emberContributor.user?.phoneNumber) throw new Error('Contributor does not have a phone number');

  const participantInput = {
    id: emberContributor.id,
    userId: emberContributor.userId,
    imageId: emberContributor.imageId,
    image: { ownerId: emberContributor.image.ownerId },
  };
  const identity = contributorChatSessionIdentity(participantInput);
  const session = await ensureEmberSession({
    ...identity,
    emberContributorId,
    userId: identity.participantType === 'owner' ? emberContributor.userId : null,
    status: 'pending',
    currentStep: 'greeting',
  });

  const greeting = STEP_QUESTIONS.greeting;

  await prisma.emberMessage.create({
    data: { sessionId: session.id, role: 'assistant', content: greeting, source: 'sms' },
  });

  const formattedPhone = emberContributor.user.phoneNumber.startsWith('+')
    ? emberContributor.user.phoneNumber
    : `+1${emberContributor.user.phoneNumber}`;

  await sendSMS(formattedPhone, greeting);
  return greeting;
}

export async function handleIncomingMessage(
  phoneNumber: string,
  message: string
): Promise<string> {
  const normalizedPhone = phoneNumber.replace(/\D/g, '').replace(/^1/, '');

  // Resolve the contributor pool entry by phone, then pick their most recent
  // ember attachment as the conversation target.
  const emberContributor = await prisma.emberContributor.findFirst({
    where: {
      user: { phoneNumber: { contains: normalizedPhone } },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { id: true, phoneNumber: true } },
      image: true,
    },
  });

  if (!emberContributor) {
    return "Sorry, I couldn't find your conversation. Please contact the person who invited you.";
  }

  const participantInput = {
    id: emberContributor.id,
    userId: emberContributor.userId,
    imageId: emberContributor.imageId,
    image: { ownerId: emberContributor.image.ownerId },
  };
  const identity = contributorChatSessionIdentity(participantInput);
  let session = await prisma.emberSession.findUnique({
    where: emberSessionParticipantWhere(identity),
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!session) {
    const created = await ensureEmberSession({
      ...identity,
      emberContributorId: emberContributor.id,
      userId: identity.participantType === 'owner' ? emberContributor.userId : null,
      status: 'pending',
      currentStep: 'greeting',
    });
    session = await prisma.emberSession.findUniqueOrThrow({
      where: { id: created.id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
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
      response = 'greeting';
      nextStep = null;
    }
  } else if (currentStep === 'closing') {
    response = STEP_QUESTIONS.closing;
    nextStep = null;
  } else if (currentStep === 'followup') {
    const lastAssistantMessage = [...session.messages].reverse().find((m) => m.role === 'assistant');
    await prisma.emberMessage.create({
      data: {
        sessionId: session.id,
        role: 'user',
        content: message,
        source: 'sms',
        question: lastAssistantMessage?.content || 'followup',
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

    const followUp = await generateFollowUpQuestion(conversationHistory, structuredResponses, {
      imageId: emberContributor.imageId,
    });

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

      const followUp = await generateFollowUpQuestion(conversationHistory, structuredResponses, {
        imageId: emberContributor.imageId,
      });

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
