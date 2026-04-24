import { chat } from '@/lib/claude';
import { renderPromptTemplate } from '@/lib/control-plane';
import { prisma } from '@/lib/db';

export type ChatWelcomeSituation = 'first_open' | 'returning';
export type ChatWelcomeRole = 'owner' | 'contributor' | 'guest';

const CHAT_WELCOME_FALLBACK_PROMPT = `You are Ember, an AI that helps people preserve memories tied to a specific photo or video.

Write a single short greeting (1–2 sentences, max 40 words) to open a chat with {{participantFirstName}}. Keep it warm and natural. Do NOT use "Hi!" or any exclamation. End with an open question that invites them to share what this moment means to them.

Context:
- Participant role: {{participantRole}}  (owner | contributor | guest)
- Ember title: {{emberTitle}}
- Ember description: {{emberDescription}}
- Situation: {{situation}}

Situation values:
- "first_open"   — participant's first message in this chat.
- "returning"    — participant completed a prior session; pick up where they left off without re-introducing yourself.

Output only the greeting. No preamble, no labels.`;

function cleanValue(value: string | null | undefined): string {
  return value?.trim() || '';
}

export async function generateChatWelcome(ctx: {
  imageId: string;
  participantRole: ChatWelcomeRole;
  participantFirstName?: string | null;
  situation: ChatWelcomeSituation;
}): Promise<string> {
  const image = await prisma.image.findUnique({
    where: { id: ctx.imageId },
    select: { title: true, originalName: true, description: true },
  });

  const emberTitle = cleanValue(image?.title) || cleanValue(image?.originalName).replace(/\.[^.]+$/, '') || 'this moment';
  const emberDescription = cleanValue(image?.description) || '(no description yet)';
  const participantFirstName =
    cleanValue(ctx.participantFirstName).split(/\s+/)[0] || 'there';

  const systemPrompt = await renderPromptTemplate(
    'chat.welcome',
    CHAT_WELCOME_FALLBACK_PROMPT,
    {
      participantFirstName,
      participantRole: ctx.participantRole,
      emberTitle,
      emberDescription,
      situation: ctx.situation,
    }
  );

  const response = await chat(systemPrompt, [], {
    capabilityKey: 'chat.welcome',
    maxTokens: 200,
  });

  return response.trim();
}
