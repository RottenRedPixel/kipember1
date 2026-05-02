/**
 * Maps a prompt key to whether the admin preview endpoint can render it
 * with real ember data, and how. The preview is intentionally limited
 * to prompts whose call-site context can be reconstructed from a single
 * emberId — i.e. the chat/voice/Ember AI surfaces. Other prompts (image
 * analysis, snapshot, wiki, etc.) need extra runtime context (mode,
 * required people, voice style, etc.) that isn't available in the admin
 * UI yet, so they show a "preview not yet wired" message.
 */
export const PREVIEWABLE_PROMPT_KEYS = new Set<string>([
  'ember_chat.style',
  'ember_chat.guest_style',
  'ember_voice.style',
  'ember_voice.guest_style',
  'ember_call.style',
  'ember_sms.style',
]);

export function isPreviewSupportedForKey(promptKey: string): boolean {
  return PREVIEWABLE_PROMPT_KEYS.has(promptKey);
}
