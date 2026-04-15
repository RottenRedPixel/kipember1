function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, '');
}

function isLocalHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '[::1]'
  );
}

function tryParseUrl(url?: string | null): URL | null {
  if (!url) {
    return null;
  }

  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function getEmailAddressDomain(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const atIndex = value.lastIndexOf('@');
  if (atIndex === -1 || atIndex === value.length - 1) {
    return null;
  }

  const domain = value.slice(atIndex + 1).trim().toLowerCase();
  return domain || null;
}

function getRenderBaseUrl(): string | null {
  const explicitRenderUrl = process.env.RENDER_EXTERNAL_URL;
  if (explicitRenderUrl) {
    return normalizeBaseUrl(explicitRenderUrl);
  }

  const renderHostname = process.env.RENDER_EXTERNAL_HOSTNAME;
  if (renderHostname) {
    return `https://${normalizeBaseUrl(renderHostname)}`;
  }

  return null;
}

export function getAppBaseUrl(): string {
  const explicitBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const parsedExplicitBaseUrl = tryParseUrl(explicitBaseUrl);
  const renderBaseUrl = getRenderBaseUrl();

  if (
    parsedExplicitBaseUrl &&
    (!renderBaseUrl || !isLocalHost(parsedExplicitBaseUrl.hostname))
  ) {
    return normalizeBaseUrl(parsedExplicitBaseUrl.toString());
  }

  if (renderBaseUrl) {
    return renderBaseUrl;
  }

  if (explicitBaseUrl) {
    return normalizeBaseUrl(explicitBaseUrl);
  }

  return 'http://localhost:3000';
}

export function getShortLinkBaseUrl(): string {
  const explicitShortBaseUrl = process.env.SHORT_LINK_BASE_URL;
  const parsedExplicitShortBaseUrl = tryParseUrl(explicitShortBaseUrl);

  if (parsedExplicitShortBaseUrl) {
    return normalizeBaseUrl(parsedExplicitShortBaseUrl.toString());
  }

  if (explicitShortBaseUrl) {
    return normalizeBaseUrl(explicitShortBaseUrl);
  }

  const emailDomain = getEmailAddressDomain(
    process.env.SMTP_FROM_EMAIL || process.env.MAILGUN_FROM_EMAIL
  );

  if (emailDomain) {
    return `https://${emailDomain}`;
  }

  return getAppBaseUrl();
}

export function getRequestBaseUrl(request: { headers: Headers }): string {
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();

  if (forwardedHost) {
    const protocol = forwardedProto || 'https';
    return `${protocol}://${forwardedHost}`;
  }

  const host = request.headers.get('host')?.split(',')[0]?.trim();
  if (host) {
    const parsedHostUrl = tryParseUrl(`http://${host}`);
    if (parsedHostUrl && !isLocalHost(parsedHostUrl.hostname)) {
      const protocol = forwardedProto || 'https';
      return `${protocol}://${host}`;
    }
  }

  return getAppBaseUrl();
}
