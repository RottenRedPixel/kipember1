import { chat } from '@/lib/claude';
import { renderPromptTemplate } from '@/lib/control-plane';

export type EmberVoiceTrigger =
  | 'welcome_first_open'
  | 'welcome_returning'
  | 'mic_message';

export async function generateEmberVoiceReply({
  trigger,
  transcript,
}: {
  trigger: EmberVoiceTrigger;
  transcript: string;
}): Promise<string> {
  const systemPrompt = await renderPromptTemplate(
    'ember_voice.reply',
    '',
    { trigger, transcript }
  );

  const response = await chat(
    systemPrompt,
    [{ role: 'user', content: transcript || `(trigger: ${trigger})` }],
    { capabilityKey: 'ember_voice.style', maxTokens: 160 }
  );

  return response.trim();
}
