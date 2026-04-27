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
const DEFAULT_TIMEOUT_MS = 5_000;
const RUNTIME_CONFIG_PATH = '/api/runtime/config';
const APPROVED_RUNTIME_PROMPT_KEYS = new Set([
  'image_analysis.initial_photo',
  'image_analysis.uploaded_photo',
  'title_generation.initial',
  'title_generation.regenerate',
  'snapshot_generation.initial',
  'snapshot_generation.regenerate',
  'ember_chat.style',
  'ember_voice.style',
  'ember_call.style',
]);

let cachedSnapshot: ControlPlaneSnapshot | null = null;
let cacheExpiresAt = 0;
let inFlightSnapshot: Promise<ControlPlaneSnapshot | null> | null = null;
let lastFetchErrorAt = 0;

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

export async function getPromptBody(promptKey: string, fallbackBody: string) {
  if (!APPROVED_RUNTIME_PROMPT_KEYS.has(promptKey)) {
    throw new Error(`Prompt key "${promptKey}" is not one of the nine runtime prompts.`);
  }

  const snapshot = await getControlPlaneSnapshot();
  const configuredBody = snapshot?.prompts?.[promptKey]?.body?.trim();
  if (!configuredBody && isControlPlaneConfigured()) {
    throw new Error(`Prompt key "${promptKey}" is missing from the control plane runtime config.`);
  }

  return configuredBody || fallbackBody;
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
  fallbackTemplate: string,
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
