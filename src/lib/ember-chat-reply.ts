import { chat } from '@/lib/claude';
import { renderPromptTemplate } from '@/lib/control-plane';
import { prisma } from '@/lib/db';
import { loadActiveClaimTypes, loadEmberContext } from '@/lib/ember-context';
import { INTERVIEW_QUESTION_TYPES } from '@/lib/interview-flow';

export type EmberChatTrigger =
  | 'welcome_first_open'
  | 'welcome_returning'
  | 'message'
  | 'photo_upload'
  | 'video_upload'
  | 'followup';

export type EmberChatRole = 'owner' | 'contributor' | 'guest';

export type EmberChatPromptKey =
  | 'ember_chat.owner_style'
  | 'ember_chat.contributor_style'
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
  const [context, claimTypes] = await Promise.all([
    loadEmberContext(imageId),
    loadActiveClaimTypes(imageId),
  ]);
  const coverage = computeInterviewCoverage({
    capturedAt: context.capturedAt,
    location: context.location,
    taggedPeople: context.taggedPeople,
    claimTypes,
  });

  return {
    title: context.title,
    snapshot: context.snapshot,
    capturedAt: context.capturedAt,
    location: context.location,
    taggedPeople: context.taggedPeople,
    visualScene: context.visualScene,
    emotionalContext: context.emotionalContext,
    claims: context.claims,
    // {{wiki}} is now the merged "everything we know" document — original
    // wiki markdown plus location, tagged people, and claims appended as
    // sections. Every surface that reads {{wiki}} sees the same picture.
    wiki: context.wiki,
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

// Stateless variant for guests: include only the most recent user message
// (so the model sees the actual question) but drop all prior turns. This
// keeps each guest's conversation isolated from other share-link visitors
// while still letting Claude see what was just asked.
async function loadCurrentUserMessage(sessionId: string | undefined) {
  if (!sessionId) return [];
  const row = await prisma.emberMessage.findFirst({
    where: { sessionId, role: 'user' },
    orderBy: { createdAt: 'desc' },
    select: { content: true },
  });
  if (!row) return [];
  return [{ role: 'user' as const, content: row.content }];
}

function defaultChatPromptKey(role: EmberChatRole): EmberChatPromptKey {
  if (role === 'guest') return 'ember_chat.guest_style';
  if (role === 'contributor') return 'ember_chat.contributor_style';
  return 'ember_chat.owner_style';
}

const GUEST_WELCOME_MESSAGE =
  "Hello, I'm ember — do you have any questions about this memory?";

export async function generateEmberChatReply(ctx: EmberChatContext): Promise<string> {
  // Guests always see the same opening line — no Claude call, no token cost,
  // no risk of the model inventing details before the guest has even asked.
  if (
    ctx.role === 'guest' &&
    (ctx.trigger === 'welcome_first_open' || ctx.trigger === 'welcome_returning')
  ) {
    return GUEST_WELCOME_MESSAGE;
  }

  // Acknowledge photo / video uploads so the user gets immediate feedback
  // that the file landed. Owner + contributor get a soft probe; guests just
  // get a thank-you (we don't probe guests).
  if (ctx.trigger === 'photo_upload') {
    return ctx.role === 'guest'
      ? 'Got it — thanks for sharing that photo.'
      : "Got it — I've added that photo to the memory. Want to tell me anything about it?";
  }
  if (ctx.trigger === 'video_upload') {
    return ctx.role === 'guest'
      ? 'Got it — thanks for sharing that video.'
      : "Got it — I've added that video to the memory. Want to share what's happening?";
  }

  const promptKey = ctx.promptKey ?? defaultChatPromptKey(ctx.role);
  // Guests get stateless replies — only the current user message is sent
  // to Claude, no prior turns. Avoids bleeding context across people who
  // share the same /guest/[token] link. Owners and contributors get full
  // session history so multi-turn flows still work for them.
  const [vars, history] = await Promise.all([
    loadPromptVariables(ctx.imageId),
    ctx.role === 'guest'
      ? loadCurrentUserMessage(ctx.sessionId)
      : loadHistory(ctx.sessionId),
  ]);

  const basePrompt = await renderPromptTemplate(promptKey, '', {
    role: ctx.role,
    trigger: ctx.trigger,
    userFirstName: ctx.userFirstName ?? '',
    isFirstEmber: ctx.isFirstEmber === true ? 'true' : 'false',
    ...vars,
  });

  // Guests are anonymous visitors — keep replies short and conversational.
  const systemPrompt =
    ctx.role === 'guest'
      ? `${basePrompt}\n\nIMPORTANT: Reply in 1–2 short sentences only. No lengthy descriptions.`
      : basePrompt;

  const messages =
    history.length > 0 ? history : [{ role: 'user' as const, content: `(trigger: ${ctx.trigger})` }];

  const response = await chat(systemPrompt, messages, {
    capabilityKey: promptKey,
    maxTokens: ctx.role === 'guest' ? 60 : 120,
  });

  return response.trim();
}
