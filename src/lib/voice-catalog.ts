export type VoiceCatalogEntry = {
  id: string;
  name: string;
  gender: 'female' | 'male';
  /** Used for ElevenLabs TTS calls (synthesizeSpeech, snapshot-audio) */
  elevenLabsId: string;
  /** Used for Retell agent_override.agent.voice_id on phone/web calls */
  retellId: string;
};

export const VOICE_CATALOG: VoiceCatalogEntry[] = [
  { id: 'sarah',   name: 'Sarah',   gender: 'female', elevenLabsId: 'EXAVITQu4vr4xnSDxMaL', retellId: '11labs-Cleo'    },
  { id: 'alice',   name: 'Alice',   gender: 'female', elevenLabsId: 'Xb7hH8MSUJpSbSDYk0k2', retellId: '11labs-Dorothy' },
  { id: 'matilda', name: 'Matilda', gender: 'female', elevenLabsId: 'XrExE9yKIg1WjnnlVkGX', retellId: '11labs-Nia'     },
  { id: 'charlie', name: 'Charlie', gender: 'male',   elevenLabsId: 'IKne3meq5aSn9XLyUdCD', retellId: '11labs-charlie' },
  { id: 'george',  name: 'George',  gender: 'male',   elevenLabsId: 'JBFqnCBsd6RMkjVDRZzb', retellId: '11labs-Nico'    },
  { id: 'roger',   name: 'Roger',   gender: 'male',   elevenLabsId: 'CwhRBWXzGAHq8TQ4Fs17', retellId: '11labs-Joe'     },
];

export const DEFAULT_VOICE_ID = 'sarah';

export function getVoiceEntry(id: string | null | undefined): VoiceCatalogEntry {
  return VOICE_CATALOG.find((v) => v.id === id) ?? VOICE_CATALOG[0];
}
