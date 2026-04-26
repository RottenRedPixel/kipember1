import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';
import { transcodeAudioToM4a } from '@/lib/audio-processing';
import { getElevenLabsApiKey, getElevenLabsModelId, resolveNarrationVoice } from '@/lib/elevenlabs';
import { normalizeTextForSpeech } from '@/lib/narration';
import { getUploadsDir } from '@/lib/uploads';

type SynthesizeArgs = {
  text: string;
  /** ElevenLabs voice id. If omitted, picks Ember's configured/default narration voice. */
  voiceId?: string;
  /** Filename prefix used to name the cached file (kept flat so /api/uploads/<filename> resolves). */
  filenamePrefix?: string;
  /** Voice gender to fall back to if `voiceId` is not provided. */
  preference?: 'male' | 'female';
};

export type SynthesizedSpeech = {
  /** Filename relative to the uploads dir (suitable for `/api/uploads/<filename>`). */
  filename: string;
  /** Absolute filesystem path. */
  absolutePath: string;
};

/**
 * Generate spoken audio for `text` via ElevenLabs and cache the result.
 * Returns the cached file's location. Idempotent per (voice, model, text).
 */
export async function synthesizeSpeech({
  text,
  voiceId,
  filenamePrefix = 'tts',
  preference = 'female',
}: SynthesizeArgs): Promise<SynthesizedSpeech> {
  const apiKey = getElevenLabsApiKey();
  if (!apiKey) {
    throw new Error('ElevenLabs is not configured');
  }

  const speechText = normalizeTextForSpeech(text);
  if (!speechText) {
    throw new Error('Cannot synthesize empty text');
  }

  const resolvedVoiceId = voiceId || (await resolveNarrationVoice(preference)).voiceId;
  const modelId = getElevenLabsModelId();
  const cacheKey = createHash('sha1').update(`${resolvedVoiceId}:${modelId}:${speechText}`).digest('hex');

  const filename = `${filenamePrefix}_${cacheKey}.m4a`;
  const uploadsDir = getUploadsDir();
  const outputPath = join(uploadsDir, filename);
  const tempMp3Path = join(uploadsDir, `${filenamePrefix}_${cacheKey}.mp3`);

  await fs.mkdir(uploadsDir, { recursive: true });

  try {
    await fs.access(outputPath);
    return { filename, absolutePath: outputPath };
  } catch {
    // fall through to render
  }

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${resolvedVoiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      Accept: 'audio/mpeg',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: speechText,
      model_id: modelId,
      output_format: 'mp3_44100_128',
      voice_settings: {
        stability: 0.46,
        similarity_boost: 0.76,
        style: 0.28,
        speed: 0.96,
        use_speaker_boost: true,
      },
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(errorText || 'ElevenLabs TTS request failed');
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(tempMp3Path, audioBuffer);

  try {
    await transcodeAudioToM4a({ inputPath: tempMp3Path, outputPath });
  } finally {
    await fs.unlink(tempMp3Path).catch(() => undefined);
  }

  return { filename, absolutePath: outputPath };
}
