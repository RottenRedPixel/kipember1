import { prisma } from '@/lib/db';
import {
  APPROVED_PROMPT_KEYS,
  getPromptAliasChain,
} from '@/lib/prompt-registry';

type ControlPlaneModelRoute = {
  capabilityKey: string;
  integrationKey: string;
  model: string;
  fallbackModel: string | null;
  status: string;
  configJson: unknown;
  updatedAt: string;
};

type ControlPlanePrompt = {
  promptKey: string;
  title: string;
  body: string;
  versionNumber: number;
  publishedAt: string | null;
  updatedAt: string;
  configJson: unknown;
};

type ControlPlaneSetting = {
  key: string;
  namespace: string;
  valueType: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON';
  value: unknown;
  updatedAt: string;
};

type ControlPlaneFeatureFlag = {
  key: string;
  enabled: boolean;
  rolloutJson: unknown;
  updatedAt: string;
};

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
  modelRoutes: Record<string, ControlPlaneModelRoute>;
  prompts: Record<string, ControlPlanePrompt>;
  settings: Record<string, ControlPlaneSetting>;
  featureFlags: Record<string, ControlPlaneFeatureFlag>;
  remoteAgents: Record<string, ControlPlaneRemoteAgent>;
};

const DEFAULT_CACHE_TTL_MS = 30_000;
const PROMPT_OVERRIDE_CACHE_TTL_MS = 2_000;
const DEFAULT_TIMEOUT_MS = 5_000;
const RUNTIME_CONFIG_PATH = '/api/runtime/config';
export const PROMPT_REMOVED_MESSAGE = 'prompt removed';

let cachedSnapshot: ControlPlaneSnapshot | null = null;
let cacheExpiresAt = 0;
let inFlightSnapshot: Promise<ControlPlaneSnapshot | null> | null = null;
let lastFetchErrorAt = 0;

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
  return error instanceof PromptRemovedError ||
    (error instanceof Error && error.message === PROMPT_REMOVED_MESSAGE);
}

function getControlPlaneBaseUrl() {
  return process.env.CONTROL_PLANE_BASE_URL?.trim().replace(/\/$/, '') || '';
}

function getControlPlaneApiKey() {
  return process.env.CONTROL_PLANE_API_KEY?.trim() || '';
}

function getCacheTtlMs() {
  const parsed = Number.parseInt(process.env.CONTROL_PLANE_CACHE_TTL_MS || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CACHE_TTL_MS;
}

function getTimeoutMs() {
  const parsed = Number.parseInt(process.env.CONTROL_PLANE_TIMEOUT_MS || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

function logFetchError(error: unknown) {
  const now = Date.now();
  if (now - lastFetchErrorAt < 30_000) {
    return;
  }

  lastFetchErrorAt = now;
  console.error('Control plane fetch failed:', error);
}

function isControlPlaneConfigured() {
  return Boolean(getControlPlaneBaseUrl() && getControlPlaneApiKey());
}

async function fetchControlPlaneSnapshot(): Promise<ControlPlaneSnapshot | null> {
  if (!isControlPlaneConfigured()) {
    return null;
  }

  const response = await fetch(`${getControlPlaneBaseUrl()}${RUNTIME_CONFIG_PATH}`, {
    method: 'GET',
    headers: {
      'x-runtime-api-key': getControlPlaneApiKey(),
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(getTimeoutMs()),
  });

  if (!response.ok) {
    throw new Error(`Control plane responded with ${response.status}`);
  }

  const payload = (await response.json()) as ControlPlaneSnapshot;
  if (!payload || typeof payload !== 'object') {
    throw new Error('Control plane returned an invalid payload');
  }

  return payload;
}

export async function getControlPlaneSnapshot() {
  const now = Date.now();
  if (cachedSnapshot && now < cacheExpiresAt) {
    return cachedSnapshot;
  }

  if (!inFlightSnapshot) {
    inFlightSnapshot = fetchControlPlaneSnapshot()
      .then((snapshot) => {
        cachedSnapshot = snapshot;
        cacheExpiresAt = Date.now() + getCacheTtlMs();
        return snapshot;
      })
      .catch((error) => {
        logFetchError(error);
        return cachedSnapshot;
      })
      .finally(() => {
        inFlightSnapshot = null;
      });
  }

  return inFlightSnapshot;
}

export async function getCapabilityModel(capabilityKey: string, fallbackModel: string) {
  const snapshot = await getControlPlaneSnapshot();
  const configuredModel = snapshot?.modelRoutes?.[capabilityKey]?.model?.trim();
  return configuredModel || fallbackModel;
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

  if (!resolution) {
    if (isControlPlaneConfigured() || (await getPromptOverrides()).size === 0) {
      // No override and no CP body anywhere in the alias chain — preserve current behavior.
      throw new PromptRemovedError();
    }
    return fallbackBody;
  }

  return resolution.body;
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

export async function isFeatureEnabled(flagKey: string, fallback = false) {
  const snapshot = await getControlPlaneSnapshot();
  const configured = snapshot?.featureFlags?.[flagKey];
  return typeof configured?.enabled === 'boolean' ? configured.enabled : fallback;
}

export async function getSettingValue<T>(settingKey: string, fallback: T) {
  const snapshot = await getControlPlaneSnapshot();
  const configuredValue = snapshot?.settings?.[settingKey]?.value;
  return (configuredValue === undefined ? fallback : (configuredValue as T));
}

export async function getRemoteAgentConfig(remoteAgentKey: string) {
  const snapshot = await getControlPlaneSnapshot();
  return snapshot?.remoteAgents?.[remoteAgentKey] || null;
}
