import { getEmberTitle } from '@/lib/ember-title';
import { parseConfirmedLocationContext } from '@/lib/location-suggestions';
import { getUserDisplayName } from '@/lib/user-name';

export const INTERVIEW_QUESTION_TYPES = ['context', 'who', 'when', 'where', 'what', 'why', 'how'] as const;

export type InterviewQuestionType = (typeof INTERVIEW_QUESTION_TYPES)[number];

export const INTERVIEW_STEP_ORDER: readonly InterviewQuestionType[] = [
  'context',
  'who',
  'when',
  'where',
  'what',
  'why',
  'how',
];

export type InterviewKnownContext = {
  imageTitle: string;
  imageDescription: string | null;
  analysisSummary: string | null;
  confirmedPeople: string[];
  knownWhen: string | null;
  knownWhere: string | null;
};

type InterviewContextImage = {
  originalName: string | null;
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
      firstName: string | null;
      lastName: string | null;
      email: string;
    } | null;
    emberContributor: {
      user: {
        firstName: string | null;
        lastName: string | null;
        email: string | null;
      } | null;
    } | null;
  }>;
};

export function isInterviewQuestionType(value: string): value is InterviewQuestionType {
  return INTERVIEW_QUESTION_TYPES.includes(value as InterviewQuestionType);
}

export function formatCapturedAtForInterview(value: Date | null | undefined) {
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

export function buildInterviewKnownContextFromImage(
  ember: InterviewContextImage
): InterviewKnownContext {
  const confirmedPeople = Array.from(
    new Set(
      ember.tags
        .map((tag) => getUserDisplayName(tag.user) || getUserDisplayName(tag.emberContributor?.user) || tag.label)
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value))
    )
  );

  const confirmedLocation = parseConfirmedLocationContext(ember.analysis?.metadataJson);
  const knownWhere = confirmedLocation
    ? [confirmedLocation.label, confirmedLocation.detail].filter(Boolean).join(', ')
    : ember.analysis?.latitude != null && ember.analysis?.longitude != null
      ? `GPS metadata already places this photo near ${ember.analysis.latitude.toFixed(5)}, ${ember.analysis.longitude.toFixed(5)}.`
      : null;

  return {
    imageTitle: getEmberTitle(ember),
    imageDescription: ember.description,
    analysisSummary: ember.analysis?.visualDescription || ember.analysis?.summary || null,
    confirmedPeople,
    knownWhen: formatCapturedAtForInterview(ember.analysis?.capturedAt),
    knownWhere,
  };
}

export function getKnownInterviewSteps(context: InterviewKnownContext) {
  const steps = new Set<InterviewQuestionType>();

  if (context.knownWhen) {
    steps.add('when');
  }

  if (context.knownWhere) {
    steps.add('where');
  }

  return steps;
}

export function getNextInterviewStep({
  currentStep,
  answeredSteps,
  knownSteps,
}: {
  currentStep: string;
  answeredSteps: Set<string>;
  knownSteps: Set<string>;
}) {
  const currentIndex = INTERVIEW_STEP_ORDER.indexOf(currentStep as InterviewQuestionType);

  for (let index = currentIndex + 1; index < INTERVIEW_STEP_ORDER.length; index += 1) {
    const candidate = INTERVIEW_STEP_ORDER[index];

    if (answeredSteps.has(candidate) || knownSteps.has(candidate)) {
      continue;
    }

    return candidate;
  }

  return 'completed';
}

export function getInterviewProgress({
  answeredSteps,
  knownSteps,
}: {
  answeredSteps: Set<string>;
  knownSteps: Set<string>;
}) {
  const requiredSteps = INTERVIEW_STEP_ORDER.filter((step) => !knownSteps.has(step));
  const answeredCount = requiredSteps.filter((step) => answeredSteps.has(step)).length;
  const nextStep = requiredSteps.find((step) => !answeredSteps.has(step)) ?? null;

  return {
    requiredSteps,
    answeredCount,
    totalCount: requiredSteps.length,
    nextStep,
    isComplete: nextStep === null,
  };
}
