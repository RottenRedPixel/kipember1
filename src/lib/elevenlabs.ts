type ElevenLabsVoice = {
  voice_id: string;
  name: string | null;
  category: string | null;
  description: string | null;
  labels: Record<string, string> | null;
};

type VoicePreference = 'male' | 'female';

const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';
const DEFAULT_MODEL_ID = 'eleven_multilingual_v2';
const VOICE_CACHE_TTL_MS = 10 * 60 * 1000;

let cachedVoices:
  | {
      expiresAt: number;
      voices: ElevenLabsVoice[];
    }
  | null = null;

function normalizeText(value: string | null | undefined) {
  return (value || '').trim().toLowerCase();
}

function containsAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

export function getElevenLabsApiKey() {
  return (
    process.env.ELEVENLABS ||
    process.env.elevenlabs ||
    process.env.ELEVENLABS_API_KEY ||
    process.env.elevenlabs_api_key ||
    null
  );
}

export function getElevenLabsModelId() {
  return process.env.ELEVENLABS_MODEL || process.env.elevenlabs_model || DEFAULT_MODEL_ID;
}

function getConfiguredVoiceId(preference: VoicePreference) {
  if (preference === 'male') {
    return (
      process.env.ELEVENLABS_MALE_VOICE_ID ||
      process.env.elevenlabs_male_voice_id ||
      null
    );
  }

  return (
    process.env.ELEVENLABS_FEMALE_VOICE_ID ||
    process.env.elevenlabs_female_voice_id ||
    null
  );
}

async function fetchVoices(apiKey: string) {
  if (cachedVoices && cachedVoices.expiresAt > Date.now()) {
    return cachedVoices.voices;
  }

  const response = await fetch(`${ELEVENLABS_API_BASE}/voices`, {
    headers: {
      'xi-api-key': apiKey,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const payload = await response.text().catch(() => '');
    throw new Error(payload || 'Failed to load ElevenLabs voices');
  }

  const payload = (await response.json()) as { voices?: ElevenLabsVoice[] };
  const voices = Array.isArray(payload.voices) ? payload.voices : [];

  cachedVoices = {
    voices,
    expiresAt: Date.now() + VOICE_CACHE_TTL_MS,
  };

  return voices;
}

function getVoiceScore(voice: ElevenLabsVoice, preference: VoicePreference) {
  const normalizedName = normalizeText(voice.name);
  const normalizedDescription = normalizeText(voice.description);
  const normalizedCategory = normalizeText(voice.category);
  const labelValues = Object.values(voice.labels || {}).map(normalizeText);
  const normalizedLabels = labelValues.join(' ');

  const femaleTerms = ['female', 'woman', 'girl', 'mother', 'sister', 'daughter'];
  const maleTerms = ['male', 'man', 'boy', 'father', 'brother', 'son'];
  const narrativeTerms = ['narration', 'narrative', 'story', 'audiobook', 'conversational'];

  let score = 0;
  const targetTerms = preference === 'female' ? femaleTerms : maleTerms;
  const opposingTerms = preference === 'female' ? maleTerms : femaleTerms;

  if (containsAny(normalizedLabels, targetTerms)) score += 12;
  if (containsAny(normalizedDescription, targetTerms)) score += 8;
  if (containsAny(normalizedName, targetTerms)) score += 6;

  if (containsAny(normalizedLabels, opposingTerms)) score -= 10;
  if (containsAny(normalizedDescription, opposingTerms)) score -= 6;
  if (containsAny(normalizedName, opposingTerms)) score -= 4;

  if (containsAny(normalizedCategory, narrativeTerms)) score += 4;
  if (containsAny(normalizedDescription, narrativeTerms)) score += 3;

  if (normalizeText(voice.category) === 'premade' || normalizeText(voice.category) === 'generated') {
    score += 1;
  }

  return score;
}

export async function resolveNarrationVoice(preference: VoicePreference) {
  const configuredVoiceId = getConfiguredVoiceId(preference);
  if (configuredVoiceId) {
    return {
      voiceId: configuredVoiceId,
      source: 'configured' as const,
    };
  }

  const apiKey = getElevenLabsApiKey();
  if (!apiKey) {
    throw new Error('ElevenLabs API key is not configured');
  }

  const voices = await fetchVoices(apiKey);
  if (voices.length === 0) {
    throw new Error('No ElevenLabs voices are available for this account');
  }

  const rankedVoices = [...voices].sort(
    (left, right) => getVoiceScore(right, preference) - getVoiceScore(left, preference)
  );

  const chosenVoice = rankedVoices[0];
  if (!chosenVoice?.voice_id) {
    throw new Error('No usable ElevenLabs voice was found');
  }

  return {
    voiceId: chosenVoice.voice_id,
    source: 'detected' as const,
  };
}

export type NarrationPreference = VoicePreference;
