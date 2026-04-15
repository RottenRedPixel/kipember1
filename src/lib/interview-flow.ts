import { getEmberTitle } from '@/lib/ember-title';
import { parseConfirmedLocationContext } from '@/lib/location-suggestions';

export const INTERVIEW_QUESTIONS = {
  context: 'Can you describe what you see or what memory this image captures for you?',
  who: "Who are the people in this image? What's your relationship to them?",
  when: 'When was this taken? Do you remember the date, year, or occasion?',
  where: 'Where was this? What do you remember about the location?',
  what: 'What was happening at this moment? Any specific events or activities?',
  why: 'Why is this image or memory significant to you?',
  how: 'How did this moment come about? Any backstory?',
} as const;

export type InterviewQuestionType = keyof typeof INTERVIEW_QUESTIONS;

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
      name: string | null;
      email: string;
    } | null;
    contributor: {
      name: string | null;
      email: string | null;
    } | null;
  }>;
};

export function isInterviewQuestionType(value: string): value is InterviewQuestionType {
  return value in INTERVIEW_QUESTIONS;
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
  image: InterviewContextImage
): InterviewKnownContext {
  const confirmedPeople = Array.from(
    new Set(
      image.tags
        .map((tag) => tag.user?.name || tag.contributor?.name || tag.label)
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value))
    )
  );

  const confirmedLocation = parseConfirmedLocationContext(image.analysis?.metadataJson);
  const knownWhere = confirmedLocation
    ? [confirmedLocation.label, confirmedLocation.detail].filter(Boolean).join(', ')
    : image.analysis?.latitude != null && image.analysis?.longitude != null
      ? `GPS metadata already places this photo near ${image.analysis.latitude.toFixed(5)}, ${image.analysis.longitude.toFixed(5)}.`
      : null;

  return {
    imageTitle: getEmberTitle(image),
    imageDescription: image.description,
    analysisSummary: image.analysis?.visualDescription || image.analysis?.summary || null,
    confirmedPeople,
    knownWhen: formatCapturedAtForInterview(image.analysis?.capturedAt),
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
