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
