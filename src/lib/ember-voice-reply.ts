import { chat } from '@/lib/claude';
import { renderPromptTemplate } from '@/lib/control-plane';
import { loadHistory, loadPromptVariables, type EmberChatRole } from '@/lib/ember-chat-reply';

export type EmberVoiceTrigger =
  | 'welcome_first_open'
  | 'welcome_returning'
  | 'mic_message';

export async function generateEmberVoiceReply({
  imageId,
  role,
  trigger,
  transcript,
  sessionId,
}: {
  imageId: string;
  role: EmberChatRole;
  trigger: EmberVoiceTrigger;
  transcript: string;
  sessionId?: string;
}): Promise<string> {
  const promptKey: 'ember_voice.owner_style' | 'ember_voice.contributor_style' | 'ember_voice.guest_style' =
    role === 'guest'
      ? 'ember_voice.guest_style'
      : role === 'contributor'
        ? 'ember_voice.contributor_style'
        : 'ember_voice.owner_style';

  const [vars, history] = await Promise.all([
    loadPromptVariables(imageId),
    loadHistory(sessionId),
  ]);

  const systemPrompt = await renderPromptTemplate(promptKey, '', {
    role,
    trigger,
    transcript,
    ...vars,
  });

  // Use full session history so voice builds on prior turns, same as chat.
  // The user message is already saved before this call, so history ends
  // with the current turn — no need to append it separately.
  const messages = history.length > 0
    ? history
    : [{ role: 'user' as const, content: transcript || `(trigger: ${trigger})` }];

  const response = await chat(
    systemPrompt,
    messages,
    { capabilityKey: promptKey, maxTokens: 160 }
  );

  return response.trim();
}
