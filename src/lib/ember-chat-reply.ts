import { chat } from '@/lib/claude';
import { renderPromptTemplate } from '@/lib/control-plane';
import { prisma } from '@/lib/db';
import { getEmberTitle } from '@/lib/ember-title';
import { parseConfirmedLocationContext } from '@/lib/location-suggestions';

export type EmberChatTrigger =
  | 'welcome_first_open'
  | 'welcome_returning'
  | 'message'
  | 'photo_upload'
  | 'video_upload'
  | 'followup';

export type EmberChatRole = 'owner' | 'contributor' | 'guest';

export type EmberChatPromptKey = 'ember_chat.style' | 'ember_sms.style';

export type EmberChatContext = {
  imageId: string;
  sessionId?: string;
  role: EmberChatRole;
  trigger: EmberChatTrigger;
  promptKey?: EmberChatPromptKey;
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
    };
  }

  return {
    title: getEmberTitle(image),
    snapshot: image.snapshot?.script ?? '',
    capturedAt: image.analysis?.capturedAt ? image.analysis.capturedAt.toISOString() : '',
    location: formatLocation(image.analysis?.metadataJson),
    taggedPeople: formatTaggedPeople(image.tags),
    visualScene: image.analysis?.summary ?? '',
    emotionalContext: extractEmotionalContext(image.analysis?.sceneInsightsJson),
    wiki: image.wiki?.content ?? '',
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

export async function generateEmberChatReply(ctx: EmberChatContext): Promise<string> {
  const promptKey = ctx.promptKey ?? 'ember_chat.style';
  const [vars, history] = await Promise.all([
    loadPromptVariables(ctx.imageId),
    loadHistory(ctx.sessionId),
  ]);

  const systemPrompt = await renderPromptTemplate(promptKey, '', {
    role: ctx.role,
    trigger: ctx.trigger,
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
