import { prisma } from '@/lib/db';
import {
  APPROVED_PROMPT_KEYS,
  getPromptAliasChain,
} from '@/lib/prompt-registry';

const PROMPT_OVERRIDE_CACHE_TTL_MS = 2_000;
export const PROMPT_REMOVED_MESSAGE = 'prompt removed';

let overrideCache: Map<string, string> | null = null;
let overrideCacheExpiresAt = 0;
let inFlightOverrides: Promise<Map<string, string>> | null = null;

export class PromptRemovedError extends Error {
  constructor() {
    super(PROMPT_REMOVED_MESSAGE);
    this.name = 'PromptRemovedError';
  }
}

export function isPromptRemovedError(error: unknown) {
  return (
    error instanceof PromptRemovedError ||
    (error instanceof Error && error.message === PROMPT_REMOVED_MESSAGE)
  );
}

async function fetchPromptOverrides(): Promise<Map<string, string>> {
  const rows = await prisma.promptOverride.findMany({
    select: { key: true, body: true },
  });
  const map = new Map<string, string>();
  for (const row of rows) {
    const trimmed = row.body?.trim();
    if (trimmed) {
      map.set(row.key, trimmed);
    }
  }
  return map;
}

export async function getPromptOverrides(): Promise<Map<string, string>> {
  const now = Date.now();
  if (overrideCache && now < overrideCacheExpiresAt) {
    return overrideCache;
  }

  if (!inFlightOverrides) {
    inFlightOverrides = fetchPromptOverrides()
      .then((map) => {
        overrideCache = map;
        overrideCacheExpiresAt = Date.now() + PROMPT_OVERRIDE_CACHE_TTL_MS;
        return map;
      })
      .catch((error) => {
        console.error('Prompt override fetch failed:', error);
        return overrideCache || new Map<string, string>();
      })
      .finally(() => {
        inFlightOverrides = null;
      });
  }

  return inFlightOverrides;
}

export function invalidatePromptOverrideCache() {
  overrideCache = null;
  overrideCacheExpiresAt = 0;
}

export type PromptResolution = {
  body: string;
  source: 'override' | 'override-alias';
  resolvedKey: string;
};

export async function resolvePrompt(promptKey: string): Promise<PromptResolution | null> {
  if (!APPROVED_PROMPT_KEYS.has(promptKey)) {
    throw new Error(`Prompt key "${promptKey}" is not registered. Add it to PROMPT_REGISTRY.`);
  }

  const overrides = await getPromptOverrides();
  const chain = getPromptAliasChain(promptKey);

  for (let index = 0; index < chain.length; index += 1) {
    const candidate = chain[index];
    const overrideBody = overrides.get(candidate)?.trim();
    if (overrideBody) {
      return {
        body: overrideBody,
        source: index > 0 ? 'override-alias' : 'override',
        resolvedKey: candidate,
      };
    }
  }

  return null;
}

export async function getPromptBody(promptKey: string, fallbackBody = '') {
  const resolution = await resolvePrompt(promptKey);
  if (resolution) return resolution.body;
  if (fallbackBody) return fallbackBody;
  throw new PromptRemovedError();
}

function templateValueToString(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value, null, 2);
}

export function renderTemplate(
  template: string,
  values: Record<string, unknown> = {}
) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) =>
    templateValueToString(values[key])
  );
}

export async function renderPromptTemplate(
  promptKey: string,
  fallbackTemplate = '',
  values: Record<string, unknown> = {}
) {
  const template = await getPromptBody(promptKey, fallbackTemplate);
  return renderTemplate(template, values);
}

// The following helpers used to read from a remote control-plane snapshot.
// That source is gone — they now always return their fallback so that callers
// can keep their existing signatures while we phase the calls out.

type ControlPlaneRemoteAgent = {
  key: string;
  displayName: string;
  integrationKey: string;
  remoteIdentifier: string | null;
  model: string | null;
  promptBindings: unknown;
  configJson: unknown;
  updatedAt: string;
};

type ControlPlaneSnapshot = {
  generatedAt: string;
  modelRoutes: Record<string, { model?: string }>;
  prompts: Record<string, { body: string }>;
  settings: Record<string, { value: unknown }>;
  featureFlags: Record<string, { enabled: boolean }>;
  remoteAgents: Record<string, ControlPlaneRemoteAgent>;
};

export async function getCapabilityModel(_capabilityKey: string, fallbackModel: string) {
  return fallbackModel;
}

export async function isFeatureEnabled(_flagKey: string, fallback = false) {
  return fallback;
}

export async function getSettingValue<T>(_settingKey: string, fallback: T) {
  return fallback;
}

export async function getRemoteAgentConfig(
  _remoteAgentKey: string
): Promise<ControlPlaneRemoteAgent | null> {
  return null;
}

export async function getControlPlaneSnapshot(): Promise<ControlPlaneSnapshot | null> {
  return null;
}
