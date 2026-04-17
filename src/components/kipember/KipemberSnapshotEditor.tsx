'use client';

import Link from 'next/link';
import { FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import type {
  KipemberAttachment,
  KipemberContributor,
  KipemberVoiceCallClip,
} from '@/components/kipember/KipemberWikiContent';
import { type EmberMediaType } from '@/lib/media';

const fieldStyle = {
  background: 'var(--bg-input)',
  border: '1px solid var(--border-input)',
};

type SnapshotDetail = {
  id: string;
  filename: string;
  mediaType: EmberMediaType;
  posterFilename: string | null;
  originalName: string;
  title: string | null;
  canManage: boolean;
  owner?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  attachments: KipemberAttachment[];
  contributors: KipemberContributor[];
  voiceCallClips?: KipemberVoiceCallClip[];
  storyCut?: {
    script: string;
    updatedAt: string;
  } | null;
};

function SnapshotCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl px-4 py-3.5 flex flex-col gap-1"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
    >
      {children}
    </div>
  );
}

function SnapshotSection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span style={{ color: 'var(--text-secondary)' }}>{icon}</span>
        <h3 className="text-white font-medium text-base">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function stripExtension(value: string) {
  return value.replace(/\.[^.]+$/, '');
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function KipemberSnapshotEditor({
  detail,
  imageId,
  refreshDetail,
  onStatus,
}: {
  detail: SnapshotDetail | null;
  imageId: string | null;
  refreshDetail: () => Promise<unknown>;
  onStatus?: (message: string) => void;
}) {
  const [scriptDraft, setScriptDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState('');

  const emberTitle = detail?.title || (detail ? stripExtension(detail.originalName) : 'Ember');
  const savedScript = detail?.storyCut?.script || '';
  const isDirty = scriptDraft.trim() !== savedScript.trim();

  useEffect(() => {
    setScriptDraft(detail?.storyCut?.script || '');
  }, [detail]);

  async function handleSave() {
    if (!imageId || !detail?.canManage || saving) return;
    const next = scriptDraft.trim();
    if (!next) {
      setError('Snapshot text cannot be empty.');
      onStatus?.('Snapshot text cannot be empty.');
      return;
    }
    if (!isDirty) {
      onStatus?.('No changes to save.');
      return;
    }

    setSaving(true);
    setError('');
    onStatus?.('');

    try {
      const method = detail.storyCut ? 'PATCH' : 'POST';
      const body = detail.storyCut
        ? JSON.stringify({ title: emberTitle, script: next })
        : JSON.stringify({ title: emberTitle, script: next, autoScript: true });

      const response = await fetch(`/api/images/${imageId}/story-cuts`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Failed to save snapshot');

      const updated = payload?.storyCut;
      if (updated?.script) setScriptDraft(updated.script);
      onStatus?.('Snapshot saved.');
      await refreshDetail();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save snapshot';
      setError(message);
      onStatus?.(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRegenerate() {
    if (!imageId || !detail?.canManage || regenerating) return;
    setRegenerating(true);
    setError('');
    onStatus?.('');

    try {
      const response = await fetch(`/api/images/${imageId}/story-cuts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: emberTitle, regenerate: true }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Failed to regenerate snapshot');

      const generated = payload?.storyCut;
      if (generated?.script) setScriptDraft(generated.script);
      onStatus?.('Snapshot regenerated.');
      await refreshDetail();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to regenerate snapshot';
      setError(message);
      onStatus?.(message);
    } finally {
      setRegenerating(false);
    }
  }

  if (!detail || !imageId) {
    return (
      <SnapshotCard>
        <p className="text-white/60 text-sm">Loading snapshot...</p>
      </SnapshotCard>
    );
  }

  return (
    <SnapshotSection icon={<FileText size={17} />} title="Snapshot Text">
      <SnapshotCard>
        {detail.storyCut?.updatedAt ? (
          <p className="text-white/30 text-xs mb-2">Last updated: {formatDate(detail.storyCut.updatedAt)}</p>
        ) : (
          <p className="text-white/30 text-xs mb-2">No snapshot yet — regenerate to create one.</p>
        )}
        <textarea
          value={scriptDraft}
          onChange={(event) => setScriptDraft(event.target.value)}
          disabled={!detail.canManage}
          rows={8}
          className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none disabled:opacity-70"
          style={fieldStyle}
          placeholder="Snapshot text will appear here..."
        />
        {error ? <p className="text-rose-300 text-xs mt-1">{error}</p> : null}
        <div className="flex flex-wrap gap-3 mt-3">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!detail.canManage || saving || !isDirty}
            className="rounded-full px-5 text-white text-sm font-medium btn-primary disabled:opacity-60 cursor-pointer"
            style={{ background: '#f97316', minHeight: 44 }}
          >
            {saving ? 'Saving...' : 'Save Snapshot'}
          </button>
          {detail.storyCut?.script?.trim() ? (
            <Link
              href={`/home?id=${imageId}&m=play`}
              className="rounded-full px-5 text-white text-sm font-medium btn-secondary flex items-center justify-center"
              style={{ border: '1.5px solid var(--border-btn)', minHeight: 44 }}
            >
              Play Snapshot
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => void handleRegenerate()}
            disabled={!detail.canManage || regenerating}
            className="rounded-full px-5 text-white text-sm font-medium btn-secondary disabled:opacity-60 cursor-pointer"
            style={{ border: '1.5px solid var(--border-btn)', minHeight: 44 }}
          >
            {regenerating ? 'Regenerating...' : 'Regenerate'}
          </button>
        </div>
      </SnapshotCard>
    </SnapshotSection>
  );
}
