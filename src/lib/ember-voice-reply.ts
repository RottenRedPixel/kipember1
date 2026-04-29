import { chat } from '@/lib/claude';
import { renderPromptTemplate } from '@/lib/control-plane';
import { loadPromptVariables, type EmberChatRole } from '@/lib/ember-chat-reply';

export type EmberVoiceTrigger =
  | 'welcome_first_open'
  | 'welcome_returning'
  | 'mic_message';

export async function generateEmberVoiceReply({
  imageId,
  role,
  trigger,
  transcript,
}: {
  imageId: string;
  role: EmberChatRole;
  trigger: EmberVoiceTrigger;
  transcript: string;
}): Promise<string> {
  const vars = await loadPromptVariables(imageId);
  const promptKey = role === 'guest' ? 'ember_voice.guest_style' : 'ember_voice.style';

  const systemPrompt = await renderPromptTemplate(promptKey, '', {
    role,
    trigger,
    transcript,
    ...vars,
  });

  const response = await chat(
    systemPrompt,
    [{ role: 'user', content: transcript || `(trigger: ${trigger})` }],
    { capabilityKey: promptKey, maxTokens: 160 }
  );

  return response.trim();
}
