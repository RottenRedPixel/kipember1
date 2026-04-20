'use client';

import { Clock, FileText, Mic, Sliders, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type {
  KipemberAttachment,
  KipemberContributor,
  KipemberVoiceCallClip,
} from '@/components/kipember/KipemberWikiContent';
import { type EmberMediaType } from '@/lib/media';

type VoiceOption = {
  voiceId: string;
  name: string;
  label: string;
  category: string;
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
  tags?: Array<{ id: string; label: string }>;
  storyCut?: {
    script: string;
    style?: string;
    durationSeconds?: number;
    emberVoiceId?: string | null;
    updatedAt: string;
  } | null;
};

const STYLE_OPTIONS = [
  { value: 'documentary', label: 'Documentary' },
  { value: 'publicRadio', label: 'Public Radio' },
  { value: 'newsReport', label: 'News Report' },
  { value: 'podcastNarrative', label: 'Podcast Narrative' },
  { value: 'movieTrailer', label: 'Movie Trailer' },
];

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
  const [durationSeconds, setDurationSeconds] = useState(30);
  const [style, setStyle] = useState('documentary');
  const [voiceId, setVoiceId] = useState('');
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState('');
  const [requiredPeopleIds, setRequiredPeopleIds] = useState<Set<string>>(new Set());
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const emberTitle = detail?.title || (detail ? stripExtension(detail.originalName) : 'Ember');
  const savedScript = detail?.storyCut?.script || '';
  const isDirty = scriptDraft.trim() !== savedScript.trim();

  useEffect(() => {
    setScriptDraft(detail?.storyCut?.script || '');
    setDurationSeconds(detail?.storyCut?.durationSeconds ?? 10);
    setStyle(detail?.storyCut?.style || 'documentary');
    setVoiceId(detail?.storyCut?.emberVoiceId || '');
  }, [detail]);

  useEffect(() => {
    setLoadingVoices(true);
    fetch('/api/story-cuts/voices')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data?.voices)) setVoices(data.voices);
      })
      .catch(() => undefined)
      .finally(() => setLoadingVoices(false));
  }, []);

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
      const method = detail.storyCut ? 'PATCH' : 'POST';
      const body = JSON.stringify({ title: emberTitle, script: next, durationSeconds, style, emberVoiceId: voiceId || null });

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
      const requiredPeople = (detail.tags || [])
        .filter((t) => requiredPeopleIds.has(t.id))
        .map((t) => t.label);

      const response = await fetch(`/api/images/${imageId}/story-cuts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: emberTitle, regenerate: true, durationSeconds, style, emberVoiceId: voiceId || null, requiredPeople }),
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
    <div className="flex flex-col gap-6">
      {/* Snapshot Text */}
      <SnapshotSection icon={<FileText size={17} />} title="Text">
        <SnapshotCard>
          {detail.storyCut?.updatedAt ? (
            <p className="text-white/30 text-xs mb-2">Last updated: {formatDate(detail.storyCut.updatedAt)}</p>
          ) : (
            <p className="text-white/30 text-xs mb-2">No snapshot yet — regenerate to create one.</p>
          )}
          <textarea
            ref={textareaRef}
            value={scriptDraft}
            onChange={(event) => setScriptDraft(event.target.value)}
            disabled={!detail.canManage}
            className="w-full px-0 py-2 text-sm text-white outline-none disabled:opacity-70 bg-transparent border-t border-white/10 resize-none overflow-hidden"
            style={{ minHeight: '4rem' }}
            placeholder="Snapshot text will appear here..."
          />
          {error ? <p className="text-rose-300 text-xs mt-1">{error}</p> : null}
        </SnapshotCard>
      </SnapshotSection>

      {/* Snapshot Length */}
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

      {/* Tagged People */}
      {detail.tags && detail.tags.length > 0 && (
        <SnapshotSection icon={<Users size={17} />} title="People">
          <SnapshotCard>
            <p className="text-white/40 text-xs mb-2">Check a person to require their name in the regenerated snapshot.</p>
            <div className="flex flex-col gap-2">
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

      {/* Snapshot Style */}
      <SnapshotSection icon={<Sliders size={17} />} title="Style">
        <div className="px-1">
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            disabled={!detail.canManage}
            className="w-full h-11 rounded-xl px-4 text-sm text-white outline-none disabled:opacity-50 cursor-pointer"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)' }}
          >
            {STYLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </SnapshotSection>

      {/* Snapshot Voice */}
      <SnapshotSection icon={<Mic size={17} />} title="Voice">
        <div className="px-1">
          <select
            value={voiceId}
            onChange={(e) => setVoiceId(e.target.value)}
            disabled={!detail.canManage || loadingVoices}
            className="w-full h-11 rounded-xl px-4 text-sm text-white outline-none disabled:opacity-50 cursor-pointer"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)' }}
          >
            <option value="">Default voice</option>
            {voices.map((v) => (
              <option key={v.voiceId} value={v.voiceId}>{v.name}</option>
            ))}
          </select>
        </div>
      </SnapshotSection>

      {/* Actions */}
      <div className="flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={() => void handleRegenerate()}
          disabled={!detail.canManage || regenerating}
          className="rounded-full px-5 text-white text-sm font-medium btn-secondary disabled:opacity-60 cursor-pointer"
          style={{ border: '1.5px solid var(--border-btn)', minHeight: 44 }}
        >
          {regenerating ? 'Regenerating...' : 'Regenerate'}
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!detail.canManage || saving || !isDirty}
          className="rounded-full px-5 text-white text-sm font-medium btn-primary disabled:opacity-60 cursor-pointer"
          style={{ background: '#f97316', minHeight: 44 }}
        >
          {saving ? 'Saving...' : 'Save Snapshot'}
        </button>
      </div>
    </div>
  );
}
