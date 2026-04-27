import { chat } from '@/lib/claude';
import { renderPromptTemplate } from '@/lib/control-plane';

export type EmberVoiceTrigger =
  | 'welcome_first_open'
  | 'welcome_returning'
  | 'mic_message';

// Minimal stub — the real prompt lives in the control plane under
// `ember_voice.style`. This only fires if that template is missing.
const EMBER_VOICE_UNIFIED_FALLBACK_PROMPT = `You are Ember.`;

export async function generateEmberVoiceReply({
  trigger,
  transcript,
}: {
  trigger: EmberVoiceTrigger;
  transcript: string;
}): Promise<string> {
  const systemPrompt = await renderPromptTemplate(
    'ember_voice.style',
    EMBER_VOICE_UNIFIED_FALLBACK_PROMPT,
    { trigger, transcript }
  );

  const response = await chat(
    systemPrompt,
    [{ role: 'user', content: transcript || `(trigger: ${trigger})` }],
    { capabilityKey: 'ember_voice.style', maxTokens: 160 }
  );

  return response.trim();
}
