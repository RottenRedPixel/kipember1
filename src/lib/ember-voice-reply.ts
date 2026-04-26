import { chat } from '@/lib/claude';
import { renderPromptTemplate } from '@/lib/control-plane';

export type EmberVoiceTrigger =
  | 'welcome_first_open'
  | 'welcome_returning'
  | 'mic_message';

const EMBER_VOICE_UNIFIED_FALLBACK_PROMPT = `You are Ember, the voice that lives inside a memory-keeping app.

Whatever the user says, reply with ONE short sentence telling them you are being worked on right now and asking them to come back later. Vary the exact wording each time so it sounds natural and warm. Keep it under 25 words.

Hard rules for this surface (output is read aloud):
- Plain conversational sentences only. No markdown, no lists, no asterisks, no headings.
- Do not answer any question.
- Do not roleplay or invent facts about the photo, the user, or the memory.
- Do not ask follow-up questions.
- End cleanly with a period.

Trigger that produced this reply: {{trigger}}
User said: {{transcript}}`;

export async function generateEmberVoiceReply({
  trigger,
  transcript,
}: {
  trigger: EmberVoiceTrigger;
  transcript: string;
}): Promise<string> {
  const systemPrompt = await renderPromptTemplate(
    'ember_voice.unified',
    EMBER_VOICE_UNIFIED_FALLBACK_PROMPT,
    { trigger, transcript }
  );

  const response = await chat(
    systemPrompt,
    [{ role: 'user', content: transcript || `(trigger: ${trigger})` }],
    { capabilityKey: 'ember_voice.unified', maxTokens: 160 }
  );

  return response.trim();
}
