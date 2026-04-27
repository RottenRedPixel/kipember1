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

export async function startConversation(contributorId: string): Promise<string> {
  const contributor = await prisma.contributor.findUnique({
    where: { id: contributorId },
    include: { image: true },
  });

  if (!contributor) throw new Error('Contributor not found');
  if (!contributor.phoneNumber) throw new Error('Contributor does not have a phone number');

  const identity = contributorChatSessionIdentity(contributor);
  const session = await ensureEmberSession({
    ...identity,
    contributorId,
    userId: identity.participantType === 'owner' ? contributor.userId : null,
    status: 'pending',
    currentStep: 'greeting',
  });

  const greeting = STEP_QUESTIONS.greeting;

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
      image: true,
    },
  });

  if (!contributor) {
    return "Sorry, I couldn't find your conversation. Please contact the person who invited you.";
  }

  const identity = contributorChatSessionIdentity(contributor);
  let session = await prisma.emberSession.findUnique({
    where: emberSessionParticipantWhere(identity),
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!session) {
    const created = await ensureEmberSession({
      ...identity,
      contributorId: contributor.id,
      userId: identity.participantType === 'owner' ? contributor.userId : null,
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
