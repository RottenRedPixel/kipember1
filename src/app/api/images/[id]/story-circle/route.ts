import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { ensureImageOwnerAccess } from '@/lib/ember-access';
import {
  buildInterviewKnownContextFromImage,
  getInterviewProgress,
  getKnownInterviewSteps,
  INTERVIEW_QUESTIONS,
  isInterviewQuestionType,
} from '@/lib/interview-flow';
import { ensureOwnerContributorForImage } from '@/lib/owner-contributor';
import { prisma } from '@/lib/db';
import { generateWikiForImage } from '@/lib/wiki-generator';

function getFollowupPrompt() {
  return 'What else would you like Ember to remember about this moment?';
}

async function loadOwnerStoryCircleContributor(imageId: string, userId: string) {
  const contributor = await ensureOwnerContributorForImage(imageId, userId);
  if (!contributor) {
    return null;
  }

  return prisma.contributor.findUnique({
    where: { id: contributor.id },
    include: {
      image: {
        select: {
          id: true,
          originalName: true,
          title: true,
          description: true,
          analysis: {
            select: {
              summary: true,
              visualDescription: true,
              capturedAt: true,
              latitude: true,
              longitude: true,
              metadataJson: true,
            },
          },
          tags: {
            select: {
              label: true,
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
            select: {
              id: true,
              role: true,
              content: true,
              source: true,
              question: true,
              questionType: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });
}

function buildStoryCircleState(
  contributor: NonNullable<Awaited<ReturnType<typeof loadOwnerStoryCircleContributor>>>
) {
  const messages = contributor.emberSession?.messages || [];
  const responses = messages.filter(
    (m) =>
      m.role === 'user' &&
      m.questionType &&
      (isInterviewQuestionType(m.questionType) || m.questionType === 'followup')
  );
  const knownContext = buildInterviewKnownContextFromImage(contributor.image);
  const knownSteps = getKnownInterviewSteps(knownContext);
  const answeredSteps = new Set(
    responses.map((r) => r.questionType).filter((qt): qt is string => isInterviewQuestionType(qt ?? ''))
  );
  const progress = getInterviewProgress({
    answeredSteps,
    knownSteps,
  });

  return {
    questionType: progress.nextStep ?? 'followup',
    prompt: progress.nextStep
      ? INTERVIEW_QUESTIONS[progress.nextStep]
      : getFollowupPrompt(),
    answeredCount: progress.answeredCount,
    totalCount: progress.totalCount,
    isComplete: progress.isComplete,
    responses: responses.map((r) => ({
      id: r.id,
      questionType: r.questionType,
      question: r.question || r.questionType,
      answer: r.content,
      source: r.source,
      createdAt: r.createdAt,
    })),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    void request;
    const auth = await requireApiUser();

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const image = await ensureImageOwnerAccess(auth.user.id, id);

    if (!image) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const contributor = await loadOwnerStoryCircleContributor(id, auth.user.id);
    if (!contributor) {
      return NextResponse.json({ error: 'Failed to prepare Story Circle' }, { status: 500 });
    }

    const state = buildStoryCircleState(contributor);

    return NextResponse.json({
      prompt: state.prompt,
      questionType: state.questionType,
      answeredCount: state.answeredCount,
      totalCount: state.totalCount,
      responseCount: state.answeredCount,
      isComplete: state.isComplete,
      responses: state.responses,
    });
  } catch (error) {
    console.error('Story Circle question error:', error);
    return NextResponse.json(
      { error: 'Failed to prepare the Story Circle prompt' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser();

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const image = await ensureImageOwnerAccess(auth.user.id, id);

    if (!image) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const body = (await request.json().catch(() => null)) as
      | {
          answer?: string;
        }
      | null;

    const answer = typeof body?.answer === 'string' ? body.answer.trim() : '';

    if (!answer) {
      return NextResponse.json({ error: 'Answer is required' }, { status: 400 });
    }

    const contributor = await loadOwnerStoryCircleContributor(id, auth.user.id);
    if (!contributor) {
      return NextResponse.json({ error: 'Failed to prepare Story Circle' }, { status: 500 });
    }

    const state = buildStoryCircleState(contributor);
    const questionType = state.questionType;
    const question =
      questionType === 'followup'
        ? getFollowupPrompt()
        : isInterviewQuestionType(questionType)
          ? INTERVIEW_QUESTIONS[questionType]
          : getFollowupPrompt();

    let session = contributor.emberSession;
    if (!session) {
      try {
        session = await prisma.emberSession.create({
          data: {
            contributorId: contributor.id,
            imageId: contributor.image.id,
            sessionType: 'chat',
            status: 'active',
            currentStep: questionType === 'followup' ? 'completed' : questionType,
          },
          include: { messages: true },
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
    }

    if (!session) {
      return NextResponse.json({ error: 'Failed to prepare Story Circle session' }, { status: 500 });
    }

    await prisma.emberMessage.createMany({
      data: [
        {
          sessionId: session.id,
          role: 'assistant',
          content: question,
          source: 'web',
        },
        {
          sessionId: session.id,
          role: 'user',
          content: answer,
          source: 'web',
          questionType,
          question,
        },
      ],
    });

    const refreshedContributor = await loadOwnerStoryCircleContributor(id, auth.user.id);
    if (!refreshedContributor) {
      return NextResponse.json({ error: 'Failed to refresh Story Circle state' }, { status: 500 });
    }

    const nextState = buildStoryCircleState(refreshedContributor);

    await prisma.emberSession.update({
      where: { id: session.id },
      data: {
        status: nextState.isComplete ? 'completed' : 'active',
        currentStep:
          nextState.questionType === 'followup' && nextState.isComplete
            ? 'completed'
            : nextState.questionType,
      },
    });

    await generateWikiForImage(id);

    return NextResponse.json({
      success: true,
      prompt: nextState.prompt,
      questionType: nextState.questionType,
      answeredCount: nextState.answeredCount,
      totalCount: nextState.totalCount,
      responseCount: nextState.answeredCount,
      isComplete: nextState.isComplete,
      responses: nextState.responses,
    });
  } catch (error) {
    console.error('Story Circle save error:', error);
    return NextResponse.json(
      { error: 'Failed to save the Story Circle response' },
      { status: 500 }
    );
  }
}
