'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type SettingsDetail = {
  shareToNetwork?: boolean;
  keepPrivate?: boolean;
  canManage?: boolean;
};

export default function SettingsSlider({
  detail,
  imageId,
  refreshDetail,
  onStatus,
}: {
  detail: SettingsDetail | null;
  imageId: string | null;
  refreshDetail: () => Promise<unknown>;
  onStatus?: (message: string) => void;
}) {
  const router = useRouter();
  const [networkValue, setNetworkValue] = useState(false);
  const [keepPrivateValue, setKeepPrivateValue] = useState(false);
  const [deletingImage, setDeletingImage] = useState(false);

  // Sync the toggles from the loaded detail.
  useEffect(() => {
    if (!detail) return;
    setNetworkValue(Boolean(detail.shareToNetwork));
    setKeepPrivateValue(Boolean(detail.keepPrivate));
  }, [detail]);

  async function handleSave() {
    if (!imageId) return;
    const response = await fetch(`/api/images/${imageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shareToNetwork: networkValue,
        keepPrivate: keepPrivateValue,
      }),
    });
    onStatus?.(response.ok ? 'Settings saved.' : 'Failed to save settings.');
    await refreshDetail();
  }

  async function handleDelete() {
    if (!imageId || !detail?.canManage || deletingImage) return;

    const confirmed = window.confirm('Delete this Ember? This cannot be undone.');
    if (!confirmed) return;

    setDeletingImage(true);
    onStatus?.('');

    try {
      const response = await fetch(`/api/images/${imageId}`, { method: 'DELETE' });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        onStatus?.(payload?.error || 'Failed to delete ember.');
        return;
      }

      router.push('/home');
      router.refresh();
    } catch (error) {
      onStatus?.(error instanceof Error ? error.message : 'Failed to delete ember.');
    } finally {
      setDeletingImage(false);
    }
  }

  return (
    <>
      <div
        className="rounded-xl px-4 py-4"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
      >
        <label
          className="flex items-center justify-between gap-4 cursor-pointer"
          style={{ minHeight: 44 }}
        >
          <span className="flex flex-col gap-0.5">
            <span className="text-white text-sm font-medium">Share to Network</span>
            <span className="text-white/40 text-xs">Not sure what this does</span>
          </span>
          <span className="relative flex-shrink-0" style={{ width: 48, height: 28 }}>
            <input
              type="checkbox"
              checked={networkValue}
              onChange={(event) => setNetworkValue(event.target.checked)}
              className="sr-only"
            />
            <span
              className="absolute inset-0 rounded-full transition-colors duration-200"
              style={{ background: networkValue ? '#f97316' : 'rgba(255,255,255,0.15)' }}
            />
            <span
              className="absolute top-0.5 left-0.5 rounded-full bg-white shadow transition-transform duration-200"
              style={{
                width: 24,
                height: 24,
                transform: networkValue ? 'translateX(20px)' : 'translateX(0)',
              }}
            />
          </span>
        </label>
      </div>

      <div
        className="rounded-xl px-4 py-4"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
      >
        <label
          className="flex items-center justify-between gap-4 cursor-pointer"
          style={{ minHeight: 44 }}
        >
          <span className="flex flex-col gap-0.5">
            <span className="text-white text-sm font-medium">Privacy Setting</span>
            <span className="text-white/40 text-xs">Allow guest view of this ember</span>
          </span>
          <span className="relative flex-shrink-0" style={{ width: 48, height: 28 }}>
            <input
              type="checkbox"
              checked={!keepPrivateValue}
              onChange={(event) => setKeepPrivateValue(!event.target.checked)}
              className="sr-only"
            />
            <span
              className="absolute inset-0 rounded-full transition-colors duration-200"
              style={{ background: !keepPrivateValue ? '#f97316' : 'rgba(255,255,255,0.15)' }}
            />
            <span
              className="absolute top-0.5 left-0.5 rounded-full bg-white shadow transition-transform duration-200"
              style={{
                width: 24,
                height: 24,
                transform: !keepPrivateValue ? 'translateX(20px)' : 'translateX(0)',
              }}
            />
          </span>
        </label>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void handleSave()}
          className="w-1/2 rounded-full px-5 text-white text-sm font-medium btn-primary"
          style={{ background: '#f97316', minHeight: 44 }}
        >
          Save Settings
        </button>
      </div>

      {detail?.canManage ? (
        <div
          className="rounded-xl px-4 py-4"
          style={{
            background: 'rgba(120, 26, 26, 0.18)',
            border: '1px solid rgba(248, 113, 113, 0.2)',
          }}
        >
          <p className="text-[rgba(255,220,220,0.92)] text-sm font-medium">Delete Ember</p>
          <p className="mt-2 text-[rgba(255,220,220,0.62)] text-xs leading-6">
            Permanently remove this Ember and its connected records.
          </p>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={deletingImage}
            className="mt-4 w-full rounded-full text-white text-sm font-medium disabled:opacity-40"
            style={{
              background: 'rgba(239,68,68,0.88)',
              minHeight: 44,
            }}
          >
            {deletingImage ? 'Deleting...' : 'Delete Ember'}
          </button>
        </div>
      ) : null}
    </>
  );
}
