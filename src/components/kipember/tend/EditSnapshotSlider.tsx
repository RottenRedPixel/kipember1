'use client';

import { ChevronDown, Clock, FileText, ScanEye, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type {
  KipemberAttachment,
  KipemberContributor,
  KipemberVoiceCallClip,
} from '@/components/kipember/KipemberWikiContent';
import { type EmberMediaType } from '@/lib/media';

type SnapshotDetail = {
  id: string;
  filename: string;
  mediaType: EmberMediaType;
  posterFilename: string | null;
  originalName: string;
  title: string | null;
  canManage?: boolean;
  owner?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null;
  attachments: KipemberAttachment[];
  contributors: KipemberContributor[];
  voiceCallClips?: KipemberVoiceCallClip[];
  tags?: Array<{ id: string; label: string }>;
  snapshot?: {
    script: string;
    style?: string;
    durationSeconds?: number;
    emberVoiceId?: string | null;
    updatedAt?: string;
  } | null;
};

function SnapshotCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl px-4 py-3.5 flex flex-col gap-1"
      style={{
        background: 'color-mix(in srgb, var(--bg-screen), var(--text-primary) 7%)',
        border: '1px solid var(--border-subtle)',
      }}
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

export default function EditSnapshotSlider({
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
  const [durationSeconds, setDurationSeconds] = useState(30);
  const [style, setStyle] = useState('documentary');
  const [voiceId, setVoiceId] = useState('');
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState('');
  const [requiredPeopleIds, setRequiredPeopleIds] = useState<Set<string>>(new Set());
  // Slider opens in 'view' mode showing only the snapshot block. Clicking
  // Edit reveals Length + People and unlocks the textarea. After a
  // successful save we snap back to 'view'.
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [savedMessage, setSavedMessage] = useState('');
  useEffect(() => {
    if (!savedMessage) return;
    const t = setTimeout(() => setSavedMessage(''), 3000);
    return () => clearTimeout(t);
  }, [savedMessage]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const emberTitle = detail?.title || (detail ? stripExtension(detail.originalName) : 'Ember');
  const savedScript = detail?.snapshot?.script || '';
  const savedDuration = detail?.snapshot?.durationSeconds ?? 10;
  const savedStyle = detail?.snapshot?.style || 'documentary';
  const savedVoiceId = detail?.snapshot?.emberVoiceId || '';
  const isDirty =
    scriptDraft.trim() !== savedScript.trim() ||
    durationSeconds !== savedDuration ||
    style !== savedStyle ||
    voiceId !== savedVoiceId;

  useEffect(() => {
    setScriptDraft(detail?.snapshot?.script || '');
    setDurationSeconds(detail?.snapshot?.durationSeconds ?? 10);
    setStyle(detail?.snapshot?.style || 'documentary');
    setVoiceId(detail?.snapshot?.emberVoiceId || '');
    // Default the people checklist to "all selected" so the regenerated
    // snapshot already names everyone tagged. The Title slider follows the
    // same pattern. Re-opening the slider always lands back in view mode.
    setRequiredPeopleIds(new Set((detail?.tags || []).map((tag) => tag.id)));
    setMode('view');
  }, [detail]);

  // Auto-resize textarea to fit content
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [scriptDraft]);

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
      const method = detail.snapshot ? 'PATCH' : 'POST';
      const body = JSON.stringify({ title: emberTitle, script: next, durationSeconds, style, emberVoiceId: voiceId || null });

      const response = await fetch(`/api/images/${imageId}/snapshot`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Failed to save snapshot');

      const updated = payload?.snapshot;
      if (updated?.script) setScriptDraft(updated.script);
      setSavedMessage('Snapshot saved.');
      setMode('view');
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
      const requiredPeople = (detail.tags || [])
        .filter((t) => requiredPeopleIds.has(t.id))
        .map((t) => t.label);

      const response = await fetch(`/api/images/${imageId}/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: emberTitle, regenerate: true, durationSeconds, style, emberVoiceId: voiceId || null, requiredPeople }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Failed to regenerate snapshot');

      const generated = payload?.snapshot;
      if (generated?.script) setScriptDraft(generated.script);
      setSavedMessage('Snapshot regenerated.');
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
    <>
    <div className="flex flex-col gap-6">
      {/* Snapshot Text */}
      <SnapshotSection icon={<ScanEye size={17} />} title="Snapshot">
      <SnapshotCard>
        <textarea
          ref={textareaRef}
          value={scriptDraft}
          onChange={(event) => setScriptDraft(event.target.value)}
          disabled={!detail.canManage}
          readOnly={mode === 'view'}
          className="w-full px-0 py-2 text-base font-medium text-white outline-none disabled:opacity-70 bg-transparent resize-none overflow-hidden read-only:cursor-default"
          style={{ minHeight: '4rem' }}
          placeholder="Snapshot text will appear here..."
        />
        {error ? <p className="text-rose-300 text-xs mt-1">{error}</p> : null}
        {detail.snapshot?.updatedAt ? (
          <p className="text-white/30 text-xs mt-1 border-t border-white/10 pt-2">Last updated: {formatDate(detail.snapshot.updatedAt)}</p>
        ) : (
          <p className="text-white/30 text-xs mt-1 border-t border-white/10 pt-2">No snapshot yet — regenerate to create one.</p>
        )}
      </SnapshotCard>
      </SnapshotSection>

      {/* Snapshot Length — only visible in edit mode */}
      {mode === 'edit' ? (
      <SnapshotSection icon={<Clock size={17} />} title="Length">
        <div className="px-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-white/60 text-xs font-medium">{durationSeconds}s</span>
          </div>
          <input
            type="range"
            min={0}
            max={60}
            step={5}
            value={durationSeconds}
            onChange={(e) => setDurationSeconds(Math.max(5, Number(e.target.value)))}
            disabled={!detail.canManage}
            className="w-full accent-orange-500 disabled:opacity-50"
          />
          <div className="flex justify-between mt-0.5">
            <span className="text-white/30 text-xs">0s</span>
            <span className="text-white/30 text-xs">60s</span>
          </div>
        </div>
      </SnapshotSection>
      ) : null}

      {/* Tagged People — only visible in edit mode */}
      {mode === 'edit' && detail.tags && detail.tags.length > 0 && (
        <SnapshotSection icon={<Users size={17} />} title="People">
          <SnapshotCard>
            <p className="text-white/40 text-xs mb-2">Check names to require in the regenerated snapshot.</p>
            <div className="flex flex-col gap-2">
              {detail.tags.length > 1 ? (
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={detail.tags.every((tag) => requiredPeopleIds.has(tag.id))}
                    onChange={(e) => {
                      if (!detail.tags) return;
                      setRequiredPeopleIds(
                        e.target.checked
                          ? new Set(detail.tags.map((tag) => tag.id))
                          : new Set()
                      );
                    }}
                    disabled={!detail.canManage}
                    className="accent-orange-500 w-4 h-4 shrink-0"
                  />
                  <span className="text-white/60 text-sm">Select all</span>
                </label>
              ) : null}
              {detail.tags.map((tag) => (
                <label key={tag.id} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requiredPeopleIds.has(tag.id)}
                    onChange={(e) => {
                      setRequiredPeopleIds((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(tag.id);
                        else next.delete(tag.id);
                        return next;
                      });
                    }}
                    disabled={!detail.canManage}
                    className="accent-orange-500 w-4 h-4 shrink-0"
                  />
                  <span className="text-white text-sm">{tag.label}</span>
                </label>
              ))}
            </div>
          </SnapshotCard>
        </SnapshotSection>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {mode === 'view' ? (
          <button
            type="button"
            onClick={() => { setMode('edit'); setSavedMessage(''); }}
            disabled={!detail.canManage}
            className="w-1/2 ml-auto rounded-full px-5 text-white text-sm font-medium disabled:opacity-60"
            style={{ background: '#f97316', border: 'none', minHeight: 44, cursor: detail.canManage ? 'pointer' : 'default' }}
          >
            Edit
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void handleRegenerate()}
              disabled={!detail.canManage || regenerating}
              className="flex-1 rounded-full px-5 text-white text-sm font-medium btn-secondary disabled:opacity-60 cursor-pointer"
              style={{ border: '1.5px solid var(--border-btn)', minHeight: 44 }}
            >
              {regenerating ? 'Regenerating...' : 'Regen Snapshot'}
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!detail.canManage || saving || !isDirty}
              className="flex-1 rounded-full px-5 text-white text-sm font-medium disabled:opacity-60"
              style={{
                background: isDirty ? '#f97316' : 'var(--bg-surface)',
                border: isDirty ? 'none' : '1px solid var(--border-subtle)',
                minHeight: 44,
                cursor: isDirty ? 'pointer' : 'default',
              }}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </>
        )}
      </div>
    </div>
    {savedMessage ? (
      <div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-sm text-white font-medium"
        style={{ background: 'rgba(34,197,94,0.9)', pointerEvents: 'none', whiteSpace: 'nowrap' }}
      >
        {savedMessage}
      </div>
    ) : null}
    </>
  );
}
