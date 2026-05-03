import Retell, { verify } from 'retell-sdk';
import { getAppBaseUrl } from '@/lib/app-url';
import { getRemoteAgentConfig, getSettingValue, isFeatureEnabled } from '@/lib/control-plane';

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

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, '');
}

async function getConfiguredRetellAgentId(opts?: { useBetaAgent?: boolean }): Promise<string> {
  // Beta path: when the caller opts in, use the custom-LLM agent that
  // routes turns to /api/retell/llm. Lets us test the new pipeline
  // without touching production calls.
  if (opts?.useBetaAgent) {
    const beta = process.env.RETELL_AGENT_ID_BETA?.trim();
    if (beta) return beta;
    // Fall through to production agent if beta isn't configured.
  }
  const configuredAgent = await getRemoteAgentConfig('retell.memory_interviewer');
  return configuredAgent?.remoteIdentifier?.trim() || requiredEnv('RETELL_AGENT_ID');
}

export async function getRetellWebhookUrl(): Promise<string> {
  const explicitWebhookUrl = process.env.RETELL_WEBHOOK_URL;
  if (explicitWebhookUrl) {
    return explicitWebhookUrl;
  }

  const controlPlaneBaseUrl = await getSettingValue('links.base_url', '');
  const baseUrl =
    typeof controlPlaneBaseUrl === 'string' && controlPlaneBaseUrl.trim()
      ? normalizeBaseUrl(controlPlaneBaseUrl)
      : getAppBaseUrl();
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
  useBetaAgent,
}: {
  toNumber: string;
  metadata: Record<string, string>;
  dynamicVariables: Record<string, string>;
  useBetaAgent?: boolean;
}): Promise<Retell.PhoneCallResponse> {
  if (!(await isFeatureEnabled('voice_calls', true))) {
    throw new Error('Voice calls are disabled');
  }

  const client = getRetellClient();
  const [agentId, webhookUrl] = await Promise.all([
    getConfiguredRetellAgentId({ useBetaAgent }),
    getRetellWebhookUrl(),
  ]);

  return client.call.createPhoneCall({
    from_number: formatPhoneNumberE164(requiredEnv('RETELL_FROM_NUMBER')),
    to_number: formatPhoneNumberE164(toNumber),
    override_agent_id: agentId,
    metadata,
    retell_llm_dynamic_variables: dynamicVariables,
    agent_override: {
      agent: {
        webhook_events: [...DEFAULT_WEBHOOK_EVENTS],
        webhook_timeout_ms: 10000,
        webhook_url: webhookUrl,
      },
    },
  });
}

export async function createRetellWebCall({
  metadata,
  dynamicVariables,
  useBetaAgent,
}: {
  metadata: Record<string, string>;
  dynamicVariables: Record<string, string>;
  useBetaAgent?: boolean;
}): Promise<Retell.WebCallResponse> {
  if (!(await isFeatureEnabled('voice_calls', true))) {
    throw new Error('Voice calls are disabled');
  }

  const client = getRetellClient();
  const [agentId, webhookUrl] = await Promise.all([
    getConfiguredRetellAgentId({ useBetaAgent }),
    getRetellWebhookUrl(),
  ]);

  return client.call.createWebCall({
    agent_id: agentId,
    metadata,
    retell_llm_dynamic_variables: dynamicVariables,
    agent_override: {
      agent: {
        webhook_events: [...DEFAULT_WEBHOOK_EVENTS],
        webhook_timeout_ms: 10000,
        webhook_url: webhookUrl,
      },
    },
  });
}

export async function retrieveRetellCall(callId: string): Promise<Retell.CallResponse> {
  return getRetellClient().call.retrieve(callId);
}
