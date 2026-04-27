import { chat } from '@/lib/claude';
import { renderPromptTemplate } from '@/lib/control-plane';

export type EmberChatTrigger =
  | 'welcome_first_open'
  | 'welcome_returning'
  | 'message'
  | 'photo_upload'
  | 'video_upload';

export async function generateEmberChatReply(trigger: EmberChatTrigger): Promise<string> {
  const systemPrompt = await renderPromptTemplate(
    'ember_chat.reply',
    '',
    { trigger }
  );

  const response = await chat(
    systemPrompt,
    [{ role: 'user', content: `(trigger: ${trigger})` }],
    { capabilityKey: 'ember_chat.style', maxTokens: 120 }
  );

  return response.trim();
}
