import { chat } from '@/lib/claude';
import { renderPromptTemplate } from '@/lib/control-plane';

export type EmberChatTrigger =
  | 'welcome_first_open'
  | 'welcome_returning'
  | 'message'
  | 'photo_upload'
  | 'video_upload';

// Minimal stub — the real prompt lives in the control plane under
// `ember_chat.unified`. This only fires if that template is missing.
const EMBER_CHAT_UNIFIED_FALLBACK_PROMPT = `You are Ember.`;

export async function generateEmberChatReply(trigger: EmberChatTrigger): Promise<string> {
  const systemPrompt = await renderPromptTemplate(
    'ember_chat.style',
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
