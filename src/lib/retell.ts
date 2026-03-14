import Retell, { verify } from 'retell-sdk';
import { getAppBaseUrl } from '@/lib/app-url';

const DEFAULT_WEBHOOK_EVENTS = ['call_started', 'call_ended', 'call_analyzed'] as const;

let client: Retell | null = null;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

export function formatPhoneNumberE164(value: string): string {
  const digits = value.replace(/\D/g, '');

  if (value.startsWith('+')) {
    return `+${digits}`;
  }

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  if (digits.length < 10) {
    throw new Error('Phone number must include at least 10 digits');
  }

  return `+${digits}`;
}

export function getRetellClient(): Retell {
  if (!client) {
    client = new Retell({
      apiKey: requiredEnv('RETELL_API_KEY'),
    });
  }

  return client;
}

export function getRetellWebhookUrl(): string {
  const explicitWebhookUrl = process.env.RETELL_WEBHOOK_URL;
  if (explicitWebhookUrl) {
    return explicitWebhookUrl;
  }

  const baseUrl = getAppBaseUrl();
  return `${baseUrl}/api/retell/webhook`;
}

export async function verifyRetellSignature(
  rawBody: string,
  signature: string | null
): Promise<boolean> {
  if (!signature) {
    return false;
  }

  const apiKey = process.env.RETELL_API_KEY;
  if (!apiKey) {
    return false;
  }

  return verify(rawBody, apiKey, signature);
}

export async function createRetellPhoneCall({
  toNumber,
  metadata,
  dynamicVariables,
}: {
  toNumber: string;
  metadata: Record<string, string>;
  dynamicVariables: Record<string, string>;
}): Promise<Retell.PhoneCallResponse> {
  const client = getRetellClient();

  return client.call.createPhoneCall({
    from_number: formatPhoneNumberE164(requiredEnv('RETELL_FROM_NUMBER')),
    to_number: formatPhoneNumberE164(toNumber),
    override_agent_id: requiredEnv('RETELL_AGENT_ID'),
    metadata,
    retell_llm_dynamic_variables: dynamicVariables,
    agent_override: {
      agent: {
        webhook_events: [...DEFAULT_WEBHOOK_EVENTS],
        webhook_timeout_ms: 10000,
        webhook_url: getRetellWebhookUrl(),
      },
    },
  });
}

export async function retrieveRetellCall(callId: string): Promise<Retell.CallResponse> {
  return getRetellClient().call.retrieve(callId);
}
