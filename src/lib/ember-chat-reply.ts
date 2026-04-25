import { chat } from '@/lib/claude';
import { renderPromptTemplate } from '@/lib/control-plane';

export type EmberChatTrigger =
  | 'welcome_first_open'
  | 'welcome_returning'
  | 'message'
  | 'photo_upload'
  | 'video_upload'
  | 'voice_message';

const EMBER_CHAT_UNIFIED_FALLBACK_PROMPT = `You are Ember, the chat that lives inside a memory-keeping app.

Whatever the user says or does, reply with ONE short sentence telling them you are being worked on right now and asking them to come back later. Vary the exact wording each time so it sounds natural and warm. Keep it under 25 words.

Hard rules:
- Do not answer any question.
- Do not roleplay, do not pretend to know anything about the photo, the user, or the memory.
- Do not invent names, places, dates, or details.
- Do not ask follow-up questions.
- End cleanly with a period — no question marks, no exclamation marks.

Trigger that produced this reply: {{trigger}}`;

export async function generateEmberChatReply(trigger: EmberChatTrigger): Promise<string> {
  const systemPrompt = await renderPromptTemplate(
    'ember_chat.unified',
    EMBER_CHAT_UNIFIED_FALLBACK_PROMPT,
    { trigger }
  );

  const response = await chat(
    systemPrompt,
    [{ role: 'user', content: `(trigger: ${trigger})` }],
    { capabilityKey: 'ember_chat.unified', maxTokens: 120 }
  );

  return response.trim();
}
