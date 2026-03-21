const configuredAppUrl = process.env.EXPO_PUBLIC_EMBER_APP_URL?.trim() ?? '';
const placeholderHosts = new Set([
  'your-ember-domain.com',
  'staging.your-ember-domain.com',
  'example.com',
]);

type EmberAppConfig =
  | {
      isReady: true;
      url: string;
      origin: string;
      host: string;
    }
  | {
      isReady: false;
      message: string;
    };

function normalizeUrl(value: string) {
  if (!value) {
    return '';
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    return value;
  }

  return `https://${value}`;
}

export function getEmberAppConfig(): EmberAppConfig {
  if (!configuredAppUrl) {
    return {
      isReady: false,
      message:
        'Set EXPO_PUBLIC_EMBER_APP_URL in mobile/.env before launching the app.',
    };
  }

  try {
    const parsed = new URL(normalizeUrl(configuredAppUrl));

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return {
        isReady: false,
        message:
          'EXPO_PUBLIC_EMBER_APP_URL must use http:// or https:// so the WebView can load it.',
      };
    }

    if (placeholderHosts.has(parsed.hostname)) {
      return {
        isReady: false,
        message:
          'Replace the placeholder EXPO_PUBLIC_EMBER_APP_URL with your real Ember site before building this app.',
      };
    }

    return {
      isReady: true,
      url: parsed.toString(),
      origin: parsed.origin,
      host: parsed.host,
    };
  } catch {
    return {
      isReady: false,
      message:
        'EXPO_PUBLIC_EMBER_APP_URL is not a valid URL. Example: https://your-ember-domain.com',
    };
  }
}

export function isInternalEmberUrl(url: string, origin: string) {
  if (
    url.startsWith('about:') ||
    url.startsWith('blob:') ||
    url.startsWith('data:')
  ) {
    return true;
  }

  try {
    const parsed = new URL(url);
    return parsed.origin === origin;
  } catch {
    return false;
  }
}
