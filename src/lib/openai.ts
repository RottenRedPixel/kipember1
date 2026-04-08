import OpenAI from 'openai';

let client: OpenAI | null = null;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

export function getOpenAIClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: requiredEnv('OPENAI_API_KEY'),
    });
  }

  return client;
}

export function getKidsImageModel(): string {
  return process.env.OPENAI_KIDS_IMAGE_MODEL || 'gpt-image-1.5';
}

export function getImageAnalysisModel(): string {
  return process.env.OPENAI_IMAGE_ANALYSIS_MODEL || 'gpt-5-mini';
}

export function getWikiModel(): string {
  return process.env.OPENAI_WIKI_MODEL || 'gpt-5-mini';
}

export function getWikiStructureModel(): string {
  return process.env.OPENAI_WIKI_STRUCTURE_MODEL || 'gpt-5.4-mini';
}

export function getNarrationCleanupModel(): string {
  return process.env.OPENAI_NARRATION_MODEL || 'gpt-5-mini';
}

export function getStoryCutsModel(): string {
  return process.env.OPENAI_STORY_CUTS_MODEL || 'gpt-5.4-mini';
}

export function getAskCaptureModel(): string {
  return process.env.OPENAI_ASK_CAPTURE_MODEL || 'gpt-5-mini';
}

export function getAudioTranscriptionModel(): string {
  return process.env.OPENAI_AUDIO_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe';
}
