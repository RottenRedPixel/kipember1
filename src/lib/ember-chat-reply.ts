import { chat } from '@/lib/claude';
import { renderPromptTemplate } from '@/lib/control-plane';
import { prisma } from '@/lib/db';
import { getEmberTitle } from '@/lib/ember-title';
import { INTERVIEW_QUESTION_TYPES } from '@/lib/interview-flow';
import {
  parseConfirmedLocationContext,
  parseLocationSuggestionsCache,
  type LocationSuggestion,
} from '@/lib/location-suggestions';
import { getUserDisplayName } from '@/lib/user-name';

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

function formatSuggestionsLocation(suggestions: LocationSuggestion[]): string {
  if (!suggestions.length) return '';
  // The reverse-geocoded address suggestion stores the actual formatted
  // address in `label` (and a metadata blurb in `detail` we want to skip).
  const place = suggestions.find((s) => s.kind === 'place')
    || suggestions.find((s) => s.kind === 'neighborhood')
    || suggestions.find((s) => s.kind === 'city');
  const address = suggestions.find((s) => s.kind === 'address');
  const parts = [place?.label, address?.label].filter(
    (value): value is string => Boolean(value && value.trim())
  );
  if (parts.length > 0) return parts.join(', ');
  return suggestions[0].label || '';
}

function formatLocation(
  metadataJson: string | null | undefined,
  latitude: number | null | undefined,
  longitude: number | null | undefined
): string {
  const confirmed = parseConfirmedLocationContext(metadataJson);
  if (confirmed) {
    return [confirmed.label, confirmed.detail].filter(Boolean).join(', ');
  }
  // Fall back to the cached reverse-geocoded suggestions so chat can answer
  // location questions for embers where the user never opened the Edit Place
  // slider — the wiki UI already shows the same data.
  if (latitude != null && longitude != null) {
    const cached = parseLocationSuggestionsCache(metadataJson, latitude, longitude);
    if (cached && cached.length > 0) {
      return formatSuggestionsLocation(cached);
    }
  }
  return '';
}

function describePosition(leftPct: number | null, topPct: number | null, widthPct: number | null, heightPct: number | null): string | null {
  if (leftPct == null || topPct == null || widthPct == null || heightPct == null) {
    return null;
  }
  const cx = leftPct + widthPct / 2;
  const cy = topPct + heightPct / 2;

  let horizontal: string;
  if (cx < 33) horizontal = 'left';
  else if (cx < 45) horizontal = 'left of center';
  else if (cx < 55) horizontal = 'center';
  else if (cx < 67) horizontal = 'right of center';
  else horizontal = 'right';

  let vertical: string | null = null;
  if (cy < 33) vertical = 'upper';
  else if (cy >= 67) vertical = 'lower';

  const zone = vertical ? `${vertical} ${horizontal}` : horizontal;
  return `${zone} side of the photo (centered around ${Math.round(cx)}% from the left, ${Math.round(cy)}% from the top)`;
}

function formatTaggedPeople(
  tags: Array<{
    label: string;
    leftPct: number | null;
    topPct: number | null;
    widthPct: number | null;
    heightPct: number | null;
    user: { firstName: string | null; lastName: string | null } | null;
    contributor: { name: string | null } | null;
  }>
): string {
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const tag of tags) {
    const name = (getUserDisplayName(tag.user) || tag.contributor?.name || tag.label || '').trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const position = describePosition(tag.leftPct, tag.topPct, tag.widthPct, tag.heightPct);
    lines.push(position ? `${name} — ${position}` : name);
  }
  return lines.join('\n');
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
          latitude: true,
          longitude: true,
        },
      },
      snapshot: { select: { script: true } },
      wiki: { select: { content: true } },
      tags: {
        orderBy: { createdAt: 'asc' },
        select: {
          label: true,
          leftPct: true,
          topPct: true,
          widthPct: true,
          heightPct: true,
          user: { select: { firstName: true, lastName: true } },
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
  const location = formatLocation(
    image.analysis?.metadataJson,
    image.analysis?.latitude ?? null,
    image.analysis?.longitude ?? null
  );
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
