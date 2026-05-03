import { NextResponse } from 'next/server';
import { getCurrentAuth } from '@/lib/auth-server';
import { isAdmin } from '@/lib/admin-access';

export const dynamic = 'force-dynamic';

type Quota = {
  label: string;
  remaining: number | string | null;
  limit: number | string | null;
  resetAt: string | null;
};

type ProviderCheck = {
  key: string;
  label: string;
  usedFor: string;
  configured: boolean;
  ok: boolean;
  status: number | null;
  latencyMs: number;
  message: string;
  quota: Quota | null;
};

const USED_FOR: Record<string, string> = {
  anthropic:
    'Powers every Claude call — chat + voice replies, wiki structure & rewrite, snapshot scripts, title ideas, captions, and the housekeeping extractors (why / emotion / extra story / place).',
  openai:
    'Image analysis on upload, audio transcription for voice messages, and the OpenAI-side suggestion calls (smart titles, people detection, location ranking).',
  elevenlabs:
    'Text-to-speech for the play-button snapshot audio and the per-block voice clips. Character usage drains fast — keep an eye on the quota here.',
  retell: 'Backbone for the live phone-call experience — outbound dials, in-call agent, and post-call recording / transcript ingest.',
  google_maps:
    'Reverse-geocoding the photo EXIF GPS into a place candidate (paired with Claude in location-suggestions.ts).',
  voipms:
    'Sends the SMS invitations and share-link texts (contributor invites, guest links). Account balance shown is real spendable credit.',
};

const TIMEOUT_MS = 7000;

async function timedFetch(url: string, init: RequestInit): Promise<{ res: Response; latencyMs: number } | { error: string; latencyMs: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const start = Date.now();
  try {
    const res = await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' });
    return { res, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : String(err),
      latencyMs: Date.now() - start,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function unixToIso(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return new Date(n * 1000).toISOString();
}

async function checkAnthropic(): Promise<Omit<ProviderCheck, 'usedFor'>> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return { key: 'anthropic', label: 'Anthropic (Claude)', configured: false, ok: false, status: null, latencyMs: 0, message: 'ANTHROPIC_API_KEY not set', quota: null };
  }
  const out = await timedFetch('https://api.anthropic.com/v1/models', {
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
  });
  if ('error' in out) {
    return { key: 'anthropic', label: 'Anthropic (Claude)', configured: true, ok: false, status: null, latencyMs: out.latencyMs, message: out.error, quota: null };
  }
  const { res, latencyMs } = out;
  const remaining = res.headers.get('anthropic-ratelimit-tokens-remaining');
  const limit = res.headers.get('anthropic-ratelimit-tokens-limit');
  const reset = res.headers.get('anthropic-ratelimit-tokens-reset');
  const quota: Quota | null = remaining || limit
    ? { label: 'Tokens this minute', remaining: remaining ? Number(remaining) : null, limit: limit ? Number(limit) : null, resetAt: reset || null }
    : null;
  return {
    key: 'anthropic',
    label: 'Anthropic (Claude)',
    configured: true,
    ok: res.ok,
    status: res.status,
    latencyMs,
    message: res.ok ? 'Auth + reachability OK' : await briefError(res, 'Anthropic'),
    quota,
  };
}

async function checkOpenAI(): Promise<Omit<ProviderCheck, 'usedFor'>> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return { key: 'openai', label: 'OpenAI', configured: false, ok: false, status: null, latencyMs: 0, message: 'OPENAI_API_KEY not set', quota: null };
  }
  const out = await timedFetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${key}` },
  });
  if ('error' in out) {
    return { key: 'openai', label: 'OpenAI', configured: true, ok: false, status: null, latencyMs: out.latencyMs, message: out.error, quota: null };
  }
  const { res, latencyMs } = out;
  // The /v1/models endpoint does not return per-model TPM headers — those
  // are populated only by completion calls. So we report reachability +
  // auth only here. A "Run real call" button could be added later for a
  // proper TPM check.
  return {
    key: 'openai',
    label: 'OpenAI',
    configured: true,
    ok: res.ok,
    status: res.status,
    latencyMs,
    message: res.ok ? 'Auth + reachability OK (no TPM info on /models)' : await briefError(res, 'OpenAI'),
    quota: null,
  };
}

async function checkElevenLabs(): Promise<Omit<ProviderCheck, 'usedFor'>> {
  const key = process.env.ELEVENLABS_API_KEY || process.env.ELEVENLABS;
  if (!key) {
    return { key: 'elevenlabs', label: 'ElevenLabs', configured: false, ok: false, status: null, latencyMs: 0, message: 'ELEVENLABS_API_KEY not set', quota: null };
  }
  const out = await timedFetch('https://api.elevenlabs.io/v1/user/subscription', {
    headers: { 'xi-api-key': key },
  });
  if ('error' in out) {
    return { key: 'elevenlabs', label: 'ElevenLabs', configured: true, ok: false, status: null, latencyMs: out.latencyMs, message: out.error, quota: null };
  }
  const { res, latencyMs } = out;
  let quota: Quota | null = null;
  let extra = '';
  if (res.ok) {
    try {
      const body = (await res.json()) as {
        character_count?: number;
        character_limit?: number;
        next_character_count_reset_unix?: number;
        tier?: string;
      };
      const used = body.character_count ?? 0;
      const cap = body.character_limit ?? 0;
      quota = {
        label: 'Characters used',
        remaining: cap > 0 ? Math.max(cap - used, 0) : null,
        limit: cap || null,
        resetAt: unixToIso(body.next_character_count_reset_unix),
      };
      if (body.tier) extra = ` · ${body.tier} tier`;
    } catch {
      // body parse failed — leave quota null
    }
  }
  return {
    key: 'elevenlabs',
    label: 'ElevenLabs',
    configured: true,
    ok: res.ok,
    status: res.status,
    latencyMs,
    message: res.ok ? `Auth + reachability OK${extra}` : await briefError(res, 'ElevenLabs'),
    quota,
  };
}

async function checkRetell(): Promise<Omit<ProviderCheck, 'usedFor'>> {
  const key = process.env.RETELL_API_KEY;
  if (!key) {
    return { key: 'retell', label: 'Retell (voice calls)', configured: false, ok: false, status: null, latencyMs: 0, message: 'RETELL_API_KEY not set', quota: null };
  }
  // Retell exposes a list-agents endpoint that's cheap and authenticated.
  const out = await timedFetch('https://api.retellai.com/list-agents', {
    headers: { Authorization: `Bearer ${key}` },
  });
  if ('error' in out) {
    return { key: 'retell', label: 'Retell (voice calls)', configured: true, ok: false, status: null, latencyMs: out.latencyMs, message: out.error, quota: null };
  }
  const { res, latencyMs } = out;
  return {
    key: 'retell',
    label: 'Retell (voice calls)',
    configured: true,
    ok: res.ok,
    status: res.status,
    latencyMs,
    message: res.ok ? 'Auth + reachability OK' : await briefError(res, 'Retell'),
    quota: null,
  };
}

async function checkGoogleMaps(): Promise<Omit<ProviderCheck, 'usedFor'>> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    return { key: 'google_maps', label: 'Google Maps', configured: false, ok: false, status: null, latencyMs: 0, message: 'GOOGLE_MAPS_API_KEY not set', quota: null };
  }
  // Geocode a known landmark — cheapest billable call that proves the key
  // works against the Geocoding API.
  const out = await timedFetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=Empire+State+Building&key=${encodeURIComponent(key)}`,
    {}
  );
  if ('error' in out) {
    return { key: 'google_maps', label: 'Google Maps', configured: true, ok: false, status: null, latencyMs: out.latencyMs, message: out.error, quota: null };
  }
  const { res, latencyMs } = out;
  let ok = res.ok;
  let message = res.ok ? 'Auth + reachability OK' : await briefError(res, 'Google Maps');
  if (res.ok) {
    try {
      const body = (await res.json()) as { status?: string; error_message?: string };
      if (body.status !== 'OK') {
        ok = false;
        message = body.error_message ? `${body.status}: ${body.error_message}` : (body.status || 'Unknown error');
      }
    } catch {
      // body parse failed
    }
  }
  return {
    key: 'google_maps',
    label: 'Google Maps',
    configured: true,
    ok,
    status: res.status,
    latencyMs,
    message,
    quota: null,
  };
}

async function checkVoipMs(): Promise<Omit<ProviderCheck, 'usedFor'>> {
  const user = process.env.VOIPMS_API_USERNAME;
  const pass = process.env.VOIPMS_API_PASSWORD;
  if (!user || !pass) {
    return { key: 'voipms', label: 'voip.ms (SMS)', configured: false, ok: false, status: null, latencyMs: 0, message: 'VOIPMS_API_USERNAME / PASSWORD not set', quota: null };
  }
  const url = `https://voip.ms/api/v1/rest.php?api_username=${encodeURIComponent(user)}&api_password=${encodeURIComponent(pass)}&method=getBalance`;
  const out = await timedFetch(url, {});
  if ('error' in out) {
    return { key: 'voipms', label: 'voip.ms (SMS)', configured: true, ok: false, status: null, latencyMs: out.latencyMs, message: out.error, quota: null };
  }
  const { res, latencyMs } = out;
  let ok = res.ok;
  let message = res.ok ? 'Auth + reachability OK' : await briefError(res, 'voip.ms');
  let quota: Quota | null = null;
  if (res.ok) {
    try {
      const body = (await res.json()) as {
        status?: string;
        balance?: { current_balance?: string };
      };
      if (body.status !== 'success') {
        ok = false;
        message = body.status || 'Unknown error';
      } else if (body.balance?.current_balance !== undefined) {
        quota = {
          label: 'Account balance',
          remaining: `$${body.balance.current_balance}`,
          limit: null,
          resetAt: null,
        };
      }
    } catch {
      // body parse failed
    }
  }
  return {
    key: 'voipms',
    label: 'voip.ms (SMS)',
    configured: true,
    ok,
    status: res.status,
    latencyMs,
    message,
    quota,
  };
}

async function briefError(res: Response, provider: string): Promise<string> {
  let body = '';
  try {
    body = (await res.text()).trim().slice(0, 200);
  } catch {
    // ignore
  }
  if (res.status === 401 || res.status === 403) return `${provider}: bad or expired credentials (${res.status})`;
  if (res.status === 429) return `${provider}: rate-limited or quota exhausted (429)`;
  if (res.status === 402) return `${provider}: payment required (402)`;
  return body ? `${res.status}: ${body}` : `HTTP ${res.status}`;
}

export async function GET() {
  const auth = await getCurrentAuth();
  if (!auth || !isAdmin(auth.user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const providers = (await Promise.all([
    checkAnthropic(),
    checkOpenAI(),
    checkElevenLabs(),
    checkRetell(),
    checkGoogleMaps(),
    checkVoipMs(),
  ])).map((p) => ({ ...p, usedFor: USED_FOR[p.key] ?? '' }));

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    providers,
  });
}
