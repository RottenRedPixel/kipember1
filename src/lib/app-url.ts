function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, '');
}

export function getAppBaseUrl(): string {
  const explicitBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (explicitBaseUrl) {
    return normalizeBaseUrl(explicitBaseUrl);
  }

  const renderHostname = process.env.RENDER_EXTERNAL_HOSTNAME;
  if (renderHostname) {
    return `https://${normalizeBaseUrl(renderHostname)}`;
  }

  return 'http://localhost:3000';
}
