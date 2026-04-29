import { chat } from '@/lib/claude';
import { renderPromptTemplate } from '@/lib/control-plane';
import { prisma } from '@/lib/db';
import { getEmberTitle } from '@/lib/ember-title';
import { INTERVIEW_QUESTION_TYPES } from '@/lib/interview-flow';
import { parseConfirmedLocationContext } from '@/lib/location-suggestions';

export type EmberChatTrigger =
  | 'welcome_first_open'
  | 'welcome_returning'
  | 'message'
  | 'photo_upload'
  | 'video_upload'
  | 'followup';

export type EmberChatRole = 'owner' | 'contributor' | 'guest';

export type EmberChatPromptKey =
  | 'ember_chat.style'
  | 'ember_chat.guest_style'
  | 'ember_sms.style';

export type EmberChatContext = {
  imageId: string;
  sessionId?: string;
  role: EmberChatRole;
  trigger: EmberChatTrigger;
  promptKey?: EmberChatPromptKey;
  userFirstName?: string;
  isFirstEmber?: boolean;
};

const HISTORY_LIMIT = 12;

function extractEmotionalContext(json: string | null | undefined): string {
  if (!json) return '';
  try {
    const parsed = JSON.parse(json) as { emotionalContext?: Record<string, unknown> | null };
    const ec = parsed.emotionalContext;
    if (!ec || typeof ec !== 'object') return '';
    return Object.entries(ec)
      .filter(([, v]) => v != null && String(v).trim())
      .map(([k, v]) => `${k}: ${String(v).trim()}`)
      .join('\n');
  } catch {
    return '';
  }
}

function formatLocation(metadataJson: string | null | undefined): string {
  const parsed = parseConfirmedLocationContext(metadataJson);
  if (!parsed) return '';
  return [parsed.label, parsed.detail].filter(Boolean).join(', ');
}

function formatTaggedPeople(
  tags: Array<{
    label: string;
    user: { name: string | null } | null;
    contributor: { name: string | null } | null;
  }>
): string {
  const names = new Set<string>();
  for (const tag of tags) {
    const name = (tag.user?.name || tag.contributor?.name || tag.label || '').trim();
    if (name) names.add(name);
  }
  return Array.from(names).join(', ');
}

function computeInterviewCoverage({
  capturedAt,
  location,
  taggedPeople,
  claimTypes,
}: {
  capturedAt: string;
  location: string;
  taggedPeople: string;
  claimTypes: Set<string>;
}) {
  const covered = new Set<string>();
  if (taggedPeople) covered.add('who');
  if (capturedAt) covered.add('when');
  if (location || claimTypes.has('place')) covered.add('where');
  if (claimTypes.has('extra_story')) covered.add('what');
  if (claimTypes.has('why')) covered.add('why');

  const ordered = INTERVIEW_QUESTION_TYPES.filter((step) => step !== 'context');
  const answered = ordered.filter((step) => covered.has(step));
  const unanswered = ordered.filter((step) => !covered.has(step));

  return {
    answeredTopics: answered.join(', '),
    unansweredTopics: unanswered.join(', '),
    nextTopic: unanswered[0] ?? '',
    interviewProgress: `${answered.length} of ${ordered.length} answered`,
  };
}

export async function loadPromptVariables(imageId: string) {
  const image = await prisma.image.findUnique({
    where: { id: imageId },
    select: {
      title: true,
      originalName: true,
      analysis: {
        select: {
          summary: true,
          capturedAt: true,
          metadataJson: true,
          sceneInsightsJson: true,
        },
      },
      snapshot: { select: { script: true } },
      wiki: { select: { content: true } },
      tags: {
        orderBy: { createdAt: 'asc' },
        select: {
          label: true,
          user: { select: { name: true } },
          contributor: { select: { name: true } },
        },
      },
      memoryClaims: {
        where: { status: 'active' },
        select: { claimType: true },
      },
    },
  });

  if (!image) {
    return {
      title: '',
      snapshot: '',
      capturedAt: '',
      location: '',
      taggedPeople: '',
      visualScene: '',
      emotionalContext: '',
      wiki: '',
      answeredTopics: '',
      unansweredTopics: INTERVIEW_QUESTION_TYPES.filter((s) => s !== 'context').join(', '),
      nextTopic: 'who',
      interviewProgress: '0 of 6 answered',
    };
  }

  const capturedAt = image.analysis?.capturedAt ? image.analysis.capturedAt.toISOString() : '';
  const location = formatLocation(image.analysis?.metadataJson);
  const taggedPeople = formatTaggedPeople(image.tags);
  const claimTypes = new Set(image.memoryClaims.map((c) => c.claimType));
  const coverage = computeInterviewCoverage({ capturedAt, location, taggedPeople, claimTypes });

  return {
    title: getEmberTitle(image),
    snapshot: image.snapshot?.script ?? '',
    capturedAt,
    location,
    taggedPeople,
    visualScene: image.analysis?.summary ?? '',
    emotionalContext: extractEmotionalContext(image.analysis?.sceneInsightsJson),
    wiki: image.wiki?.content ?? '',
    ...coverage,
  };
}

async function loadHistory(sessionId: string | undefined) {
  if (!sessionId) return [];
  const rows = await prisma.emberMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
    take: HISTORY_LIMIT,
    select: { role: true, content: true },
  });
  return rows
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
}

function defaultChatPromptKey(role: EmberChatRole): EmberChatPromptKey {
  return role === 'guest' ? 'ember_chat.guest_style' : 'ember_chat.style';
}

export async function generateEmberChatReply(ctx: EmberChatContext): Promise<string> {
  const promptKey = ctx.promptKey ?? defaultChatPromptKey(ctx.role);
  const [vars, history] = await Promise.all([
    loadPromptVariables(ctx.imageId),
    loadHistory(ctx.sessionId),
  ]);

  const systemPrompt = await renderPromptTemplate(promptKey, '', {
    role: ctx.role,
    trigger: ctx.trigger,
    userFirstName: ctx.userFirstName ?? '',
    isFirstEmber: ctx.isFirstEmber === true ? 'true' : 'false',
    ...vars,
  });

  const messages =
    history.length > 0 ? history : [{ role: 'user' as const, content: `(trigger: ${ctx.trigger})` }];

  const response = await chat(systemPrompt, messages, {
    capabilityKey: promptKey,
    maxTokens: 120,
  });

  return response.trim();
}
