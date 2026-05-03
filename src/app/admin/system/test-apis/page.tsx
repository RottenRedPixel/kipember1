'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

type Quota = {
  label: string;
  remaining: number | string | null;
  limit: number | string | null;
  resetAt: string | null;
};

type ProviderCheck = {
  key: string;
  label: string;
  configured: boolean;
  ok: boolean;
  status: number | null;
  latencyMs: number;
  message: string;
  quota: Quota | null;
};

type ApiResponse = {
  checkedAt: string;
  providers: ProviderCheck[];
};

function formatNumber(value: number | string | null) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  return value.toLocaleString();
}

function formatReset(iso: string | null) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const seconds = Math.max(0, Math.round((t - Date.now()) / 1000));
  if (seconds < 60) return `resets in ${seconds}s`;
  if (seconds < 3600) return `resets in ${Math.round(seconds / 60)}m`;
  return `resets in ${Math.round(seconds / 3600)}h`;
}

function StatusDot({ ok, configured }: { ok: boolean; configured: boolean }) {
  const color = !configured ? '#9ca3af' : ok ? '#22c55e' : '#ef4444';
  return (
    <span
      aria-hidden
      className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
      style={{ background: color }}
    />
  );
}

export default function AdminTestApisPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/system/test-apis', { cache: 'no-store' });
      if (!res.ok) {
        setError(`Request failed (${res.status})`);
        return;
      }
      const payload = (await res.json()) as ApiResponse;
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="p-4 lg:p-8">
      <div className="flex items-baseline justify-between mb-2">
        <h1 className="text-xl lg:text-2xl font-semibold">Test APIs</h1>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Checking…' : 'Refresh'}
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-5">
        {data
          ? `Last checked ${new Date(data.checkedAt).toLocaleTimeString()}`
          : 'Pinging each provider with a cheap, non-billable endpoint to verify auth, reachability, and where available, remaining quota.'}
      </p>

      {error ? (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(data?.providers ?? []).map((p) => (
          <div
            key={p.key}
            className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col gap-2"
          >
            <div className="flex items-center gap-2.5">
              <StatusDot ok={p.ok} configured={p.configured} />
              <h2 className="text-sm font-semibold text-gray-900 flex-1">{p.label}</h2>
              {p.status !== null ? (
                <span className="text-xs font-mono text-gray-500">{p.status}</span>
              ) : null}
            </div>
            <p className="text-xs text-gray-600">{p.message}</p>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              {p.configured ? <span>{p.latencyMs} ms</span> : <span>not configured</span>}
              {p.quota ? (
                <span>
                  · {p.quota.label}: {formatNumber(p.quota.remaining)}
                  {p.quota.limit !== null ? ` / ${formatNumber(p.quota.limit)}` : ''}
                  {p.quota.resetAt ? ` (${formatReset(p.quota.resetAt)})` : ''}
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {!data && !loading && !error ? (
        <p className="text-sm text-gray-500">No data yet.</p>
      ) : null}
    </div>
  );
}
