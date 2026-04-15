'use client';
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type {
  KipemberAttachment,
  KipemberContributor,
  KipemberVoiceCallClip,
} from '@/components/kipember/KipemberWikiContent';
import { getPreviewMediaUrl, type EmberMediaType } from '@/lib/media';

const fieldStyle = {
  background: 'var(--bg-input)',
  border: '1px solid var(--border-input)',
};

const STORY_CUT_STYLE_OPTIONS = [
  { value: 'documentary', label: 'Documentary' },
  { value: 'publicRadio', label: 'Public Radio' },
  { value: 'newsReport', label: 'News Report' },
  { value: 'podcastNarrative', label: 'Podcast Narrative' },
  { value: 'movieTrailer', label: 'Movie Trailer' },
] as const;

const STORY_CUT_DURATION_OPTIONS = [5, 10, 20, 35, 50, 60] as const;

type StoryCutStyle = (typeof STORY_CUT_STYLE_OPTIONS)[number]['value'];

type StoryCutMetadata = {
  focus: string;
};

type StoryCutRecord = {
  title: string;
  style: string;
  focus: string | null;
  durationSeconds: number;
  wordCount: number;
  script: string;
  metadata: StoryCutMetadata | null;
  selectedMediaIds: string[];
  selectedContributorIds: string[];
  includeOwner: boolean;
  includeEmberVoice: boolean;
  updatedAt: string;
} | null;

type GeneratedStoryCut = {
  title: string;
  style: string;
  duration: number;
  wordCount: number;
  script: string;
  metadata: StoryCutMetadata;
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
  storyCut?: StoryCutRecord;
};

type StoryCutEditorRecord = {
  title: string;
  style: string;
  focus: string | null;
  durationSeconds: number;
  wordCount: number;
  script: string;
  selectedMediaIds: string[];
  selectedContributorIds: string[];
  includeOwner: boolean;
  includeEmberVoice: boolean;
  updatedAt: string;
};

type StoryCutMediaItem = {
  id: string;
  label: string;
  kind: 'cover' | 'supporting' | 'voiceClip';
  thumbnailUrl: string;
  quote?: string | null;
  contributorName?: string | null;
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

function stripExtension(value: string) {
  return value.replace(/\.[^.]+$/, '');
}

function normalizeStoryCutStyle(value: string | null | undefined): StoryCutStyle {
  const normalized = (value || '').trim().toLowerCase();

  if (normalized === 'public radio') {
    return 'publicRadio';
  }
  if (normalized === 'news report') {
    return 'newsReport';
  }
  if (normalized === 'podcast narrative') {
    return 'podcastNarrative';
  }
  if (normalized === 'movie trailer') {
    return 'movieTrailer';
  }

  return STORY_CUT_STYLE_OPTIONS.some((option) => option.value === normalized)
    ? (normalized as StoryCutStyle)
    : 'documentary';
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return 'Unknown';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function normalizeStoryCutRecord(
  source: NonNullable<StoryCutRecord> | GeneratedStoryCut,
  fallback: {
    selectedMediaIds: string[];
    selectedContributorIds: string[];
    includeOwner: boolean;
    includeEmberVoice: boolean;
  }
): StoryCutEditorRecord {
  if ('durationSeconds' in source) {
    return {
      title: source.title,
      style: source.style,
      focus: source.focus || source.metadata?.focus || null,
      durationSeconds: source.durationSeconds,
      wordCount: source.wordCount,
      script: source.script,
      selectedMediaIds: source.selectedMediaIds || fallback.selectedMediaIds,
      selectedContributorIds: source.selectedContributorIds || fallback.selectedContributorIds,
      includeOwner: source.includeOwner,
      includeEmberVoice: source.includeEmberVoice,
      updatedAt: source.updatedAt,
    };
  }

  return {
    title: source.title,
    style: source.style,
    focus: source.metadata?.focus || null,
    durationSeconds: source.duration,
    wordCount: source.wordCount,
    script: source.script,
    selectedMediaIds: fallback.selectedMediaIds,
    selectedContributorIds: fallback.selectedContributorIds,
    includeOwner: fallback.includeOwner,
    includeEmberVoice: fallback.includeEmberVoice,
    updatedAt: new Date().toISOString(),
  };
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
  const [storyCutStyle, setStoryCutStyle] = useState<StoryCutStyle>('documentary');
  const [storyCutDuration, setStoryCutDuration] = useState(10);
  const [storyCutTitle, setStoryCutTitle] = useState('');
  const [storyCutFocus, setStoryCutFocus] = useState('');
  const [storyCutSelectedMediaIds, setStoryCutSelectedMediaIds] = useState<string[]>([]);
  const [storyCutSelectedContributorIds, setStoryCutSelectedContributorIds] = useState<string[]>([]);
  const [storyCutIncludeOwner, setStoryCutIncludeOwner] = useState(true);
  const [storyCutIncludeEmberVoice, setStoryCutIncludeEmberVoice] = useState(true);
  const [storyCutLoading, setStoryCutLoading] = useState(false);
  const [savingStoryCutScript, setSavingStoryCutScript] = useState(false);
  const [storyCutError, setStoryCutError] = useState('');
  const [storyCutData, setStoryCutData] = useState<StoryCutEditorRecord | null>(null);
  const [storyCutScriptDraft, setStoryCutScriptDraft] = useState('');

  const emberTitle = detail?.title || (detail ? stripExtension(detail.originalName) : 'Ember');
  const storyCutMediaItems: StoryCutMediaItem[] = detail
    ? [
        {
          id: detail.id,
          label: 'Ember Image',
          kind: 'cover',
          thumbnailUrl: getPreviewMediaUrl({
            mediaType: detail.mediaType,
            filename: detail.filename,
            posterFilename: detail.posterFilename,
          }),
        },
        ...detail.attachments.map((attachment) => ({
          id: attachment.id,
          label: attachment.originalName,
          kind: 'supporting' as const,
          thumbnailUrl: getPreviewMediaUrl({
            mediaType: attachment.mediaType,
            filename: attachment.filename,
            posterFilename: attachment.posterFilename,
          }),
        })),
        ...(detail.voiceCallClips || [])
          .filter((clip) => Boolean(clip.audioUrl))
          .map((clip) => ({
            id: clip.id,
            label: clip.title,
            kind: 'voiceClip' as const,
            thumbnailUrl: getPreviewMediaUrl({ mediaType: 'AUDIO', filename: clip.id }),
            quote: clip.quote,
            contributorName: clip.contributorName,
          })),
      ]
    : [];
  const storyCutContributorChoices = (detail?.contributors || [])
    .filter((contributor) => (contributor.conversation?.responses || []).length > 0)
    .map((contributor) => ({
      id: contributor.id,
      label:
        contributor.name ||
        contributor.user?.name ||
        contributor.email ||
        contributor.phoneNumber ||
        'Contributor',
      isOwner: contributor.userId === detail?.owner?.id,
      contributedCount: contributor.conversation?.responses?.length || 0,
    }));
  const snapshotDirty = Boolean(
    storyCutData &&
      (storyCutScriptDraft.trim() !== storyCutData.script.trim() ||
        (storyCutTitle.trim() || storyCutData.title) !== storyCutData.title)
  );

  useEffect(() => {
    if (!detail) {
      return;
    }

    setStoryCutStyle(normalizeStoryCutStyle(detail.storyCut?.style));
    setStoryCutDuration(detail.storyCut?.durationSeconds || 10);
    setStoryCutTitle(detail.storyCut?.title || emberTitle);
    setStoryCutFocus(
      detail.storyCut?.focus ||
        detail.storyCut?.metadata?.focus ||
        `What made ${emberTitle} memorable and emotionally meaningful.`
    );
    setStoryCutSelectedMediaIds(detail.storyCut?.selectedMediaIds || []);
    setStoryCutSelectedContributorIds(detail.storyCut?.selectedContributorIds || []);
    setStoryCutIncludeOwner(detail.storyCut?.includeOwner ?? true);
    setStoryCutIncludeEmberVoice(detail.storyCut?.includeEmberVoice ?? true);

    if (detail.storyCut) {
      const nextStoryCut = normalizeStoryCutRecord(detail.storyCut, {
        selectedMediaIds: detail.storyCut.selectedMediaIds || [],
        selectedContributorIds: detail.storyCut.selectedContributorIds || [],
        includeOwner: detail.storyCut.includeOwner ?? true,
        includeEmberVoice: detail.storyCut.includeEmberVoice ?? true,
      });
      setStoryCutData(nextStoryCut);
      setStoryCutScriptDraft(nextStoryCut.script || '');
    } else {
      setStoryCutData(null);
      setStoryCutScriptDraft('');
    }
  }, [detail, emberTitle]);

  function toggleStoryCutMediaSelection(mediaId: string) {
    setStoryCutSelectedMediaIds((current) =>
      current.includes(mediaId)
        ? current.filter((item) => item !== mediaId)
        : [...current, mediaId]
    );
  }

  function toggleStoryCutContributorSelection(contributorId: string) {
    setStoryCutSelectedContributorIds((current) =>
      current.includes(contributorId)
        ? current.filter((item) => item !== contributorId)
        : [...current, contributorId]
    );
  }

  async function handleGenerateStoryCut() {
    if (!imageId || !detail?.canManage || storyCutLoading) {
      return;
    }

    setStoryCutLoading(true);
    setStoryCutError('');
    onStatus?.('');

    try {
      const response = await fetch(`/api/images/${imageId}/story-cuts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          style: storyCutStyle,
          durationSeconds: storyCutDuration,
          storyFocus: storyCutFocus.trim(),
          storyTitle: storyCutTitle.trim() || emberTitle,
          selectedMediaIds: storyCutSelectedMediaIds,
          selectedContributorIds: storyCutSelectedContributorIds,
          includeOwner: storyCutIncludeOwner,
          includeEmberVoice: storyCutIncludeEmberVoice,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        storyCut?: GeneratedStoryCut;
        error?: string;
      } | null;

      if (!response.ok || !payload?.storyCut) {
        throw new Error(payload?.error || 'Failed to generate Snapshot');
      }

      const nextStoryCut = normalizeStoryCutRecord(payload.storyCut, {
        selectedMediaIds: storyCutSelectedMediaIds,
        selectedContributorIds: storyCutSelectedContributorIds,
        includeOwner: storyCutIncludeOwner,
        includeEmberVoice: storyCutIncludeEmberVoice,
      });

      setStoryCutData(nextStoryCut);
      setStoryCutScriptDraft(nextStoryCut.script || '');
      onStatus?.('Snapshot generated.');
      await refreshDetail();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate Snapshot';
      setStoryCutError(message);
      onStatus?.(message);
    } finally {
      setStoryCutLoading(false);
    }
  }

  async function handleSaveStoryCutScript() {
    if (!imageId || !detail?.canManage || !storyCutData || savingStoryCutScript) {
      return;
    }

    const nextScript = storyCutScriptDraft.trim();
    if (!nextScript) {
      setStoryCutError('Snapshot text cannot be empty.');
      onStatus?.('Snapshot text cannot be empty.');
      return;
    }

    if (!snapshotDirty) {
      onStatus?.('Snapshot is already up to date.');
      return;
    }

    setSavingStoryCutScript(true);
    setStoryCutError('');
    onStatus?.('');

    try {
      const response = await fetch(`/api/images/${imageId}/story-cuts`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: storyCutTitle.trim() || storyCutData.title,
          script: nextScript,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        storyCut?: NonNullable<StoryCutRecord>;
        error?: string;
      } | null;

      if (!response.ok || !payload?.storyCut) {
        throw new Error(payload?.error || 'Failed to save Snapshot edits');
      }

      const updatedStoryCut = normalizeStoryCutRecord(payload.storyCut, {
        selectedMediaIds: storyCutSelectedMediaIds,
        selectedContributorIds: storyCutSelectedContributorIds,
        includeOwner: storyCutIncludeOwner,
        includeEmberVoice: storyCutIncludeEmberVoice,
      });

      setStoryCutData(updatedStoryCut);
      setStoryCutTitle(updatedStoryCut.title);
      setStoryCutScriptDraft(updatedStoryCut.script);
      onStatus?.('Snapshot saved.');
      await refreshDetail();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save Snapshot edits';
      setStoryCutError(message);
      onStatus?.(message);
    } finally {
      setSavingStoryCutScript(false);
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
      <SnapshotCard>
        <p className="text-white/30 text-xs font-medium mb-2">Snapshot Setup</p>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            value={storyCutTitle}
            onChange={(event) => setStoryCutTitle(event.target.value)}
            disabled={!detail.canManage}
            className="w-full h-12 rounded-xl px-4 text-sm text-white placeholder-white/30 outline-none disabled:opacity-70"
            style={fieldStyle}
            placeholder="Snapshot title"
          />
          <select
            value={storyCutStyle}
            onChange={(event) => setStoryCutStyle(event.target.value as StoryCutStyle)}
            disabled={!detail.canManage}
            className="w-full h-12 rounded-xl px-4 text-sm text-white outline-none disabled:opacity-70"
            style={fieldStyle}
          >
            {STORY_CUT_STYLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value} style={{ color: '#111' }}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <textarea
          value={storyCutFocus}
          onChange={(event) => setStoryCutFocus(event.target.value)}
          disabled={!detail.canManage}
          rows={4}
          className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 outline-none disabled:opacity-70 mt-4"
          style={fieldStyle}
          placeholder="What should this snapshot focus on?"
        />

        <div className="flex flex-wrap gap-2 mt-4">
          {STORY_CUT_DURATION_OPTIONS.map((duration) => (
            <button
              key={duration}
              type="button"
              onClick={() => setStoryCutDuration(duration)}
              disabled={!detail.canManage}
              className="rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] disabled:opacity-60"
              style={{
                background:
                  storyCutDuration === duration ? 'rgba(249,115,22,0.18)' : 'rgba(255,255,255,0.05)',
                border:
                  storyCutDuration === duration
                    ? '1px solid rgba(249,115,22,0.45)'
                    : '1px solid rgba(255,255,255,0.09)',
                color: storyCutDuration === duration ? '#fdba74' : 'rgba(255,255,255,0.72)',
              }}
            >
              {duration}s
            </button>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-2 mt-4">
          <button
            type="button"
            onClick={() => setStoryCutIncludeOwner((value) => !value)}
            disabled={!detail.canManage}
            className="rounded-xl px-4 py-3 text-left disabled:opacity-60"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="text-white text-sm font-medium">Owner Voice</div>
            <div className="text-white/45 text-xs mt-1">
              {storyCutIncludeOwner ? 'Included' : 'Excluded'}
            </div>
          </button>
          <button
            type="button"
            onClick={() => setStoryCutIncludeEmberVoice((value) => !value)}
            disabled={!detail.canManage}
            className="rounded-xl px-4 py-3 text-left disabled:opacity-60"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="text-white text-sm font-medium">Ember Voice</div>
            <div className="text-white/45 text-xs mt-1">
              {storyCutIncludeEmberVoice ? 'Included' : 'Excluded'}
            </div>
          </button>
        </div>

        <div className="flex flex-wrap gap-3 mt-5">
          <button
            type="button"
            onClick={() => void handleGenerateStoryCut()}
            disabled={!detail.canManage || storyCutLoading}
            className="rounded-full px-5 text-white text-sm font-medium btn-primary disabled:opacity-60"
            style={{ background: '#f97316', minHeight: 44 }}
          >
            {storyCutLoading ? 'Generating Snapshot...' : storyCutData ? 'Generate New Snapshot' : 'Generate Snapshot'}
          </button>
          {storyCutData?.script?.trim() ? (
            <Link
              href={`/home?id=${imageId}&m=play`}
              className="rounded-full px-5 text-white text-sm font-medium btn-secondary flex items-center justify-center"
              style={{ border: '1.5px solid var(--border-btn)', minHeight: 44 }}
            >
              Play Snapshot
            </Link>
          ) : null}
          {storyCutData ? (
            <button
              type="button"
              onClick={() => void handleSaveStoryCutScript()}
              disabled={!detail.canManage || savingStoryCutScript || !snapshotDirty}
              className="rounded-full px-5 text-white text-sm font-medium btn-secondary disabled:opacity-60"
              style={{ border: '1.5px solid var(--border-btn)', minHeight: 44 }}
            >
              {savingStoryCutScript ? 'Saving...' : 'Save Snapshot'}
            </button>
          ) : null}
        </div>
      </SnapshotCard>

      <SnapshotCard>
        <p className="text-white/30 text-xs font-medium mb-2">Selected Media</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {storyCutMediaItems.map((media) => {
            const selected = storyCutSelectedMediaIds.includes(media.id);

            return (
              <button
                key={media.id}
                type="button"
                onClick={() => toggleStoryCutMediaSelection(media.id)}
                disabled={!detail.canManage}
                className="rounded-xl p-3 text-left disabled:opacity-60"
                style={{
                  background: selected ? 'rgba(249,115,22,0.16)' : 'rgba(255,255,255,0.03)',
                  border: selected
                    ? '1px solid rgba(249,115,22,0.45)'
                    : '1px solid rgba(255,255,255,0.07)',
                }}
              >
                <div className="overflow-hidden rounded-lg bg-black/20">
                  {media.kind === 'voiceClip' ? (
                    <div className="aspect-[1.2] p-4 flex flex-col justify-between">
                      <div>
                        <div className="text-[#fdba74] text-[11px] font-semibold uppercase tracking-[0.14em]">
                          Voice Clip
                        </div>
                        <div className="mt-2 text-white text-sm font-medium">
                          {media.contributorName || 'Contributor'}
                        </div>
                        {media.quote ? (
                          <div className="mt-2 text-white/55 text-xs leading-relaxed line-clamp-4">
                            &quot;{media.quote}&quot;
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <img src={media.thumbnailUrl} alt={media.label} className="aspect-[1.2] w-full object-cover" />
                  )}
                </div>
                <div className="mt-3 text-white text-sm font-medium truncate">{media.label}</div>
              </button>
            );
          })}
        </div>
      </SnapshotCard>

      <SnapshotCard>
        <p className="text-white/30 text-xs font-medium mb-2">Contributor Voices</p>
        <div className="space-y-2">
          {storyCutContributorChoices
            .filter((contributor) => !contributor.isOwner)
            .map((contributor) => {
              const selected = storyCutSelectedContributorIds.includes(contributor.id);

              return (
                <button
                  key={contributor.id}
                  type="button"
                  onClick={() => toggleStoryCutContributorSelection(contributor.id)}
                  disabled={!detail.canManage}
                  className="w-full rounded-xl px-4 py-4 text-left disabled:opacity-60"
                  style={{
                    background: selected ? 'rgba(249,115,22,0.16)' : 'rgba(255,255,255,0.03)',
                    border: selected
                      ? '1px solid rgba(249,115,22,0.45)'
                      : '1px solid rgba(255,255,255,0.07)',
                  }}
                >
                  <div className="text-white text-sm font-medium">{contributor.label}</div>
                  <div className="text-white/45 text-xs mt-1">
                    {contributor.contributedCount} saved response{contributor.contributedCount === 1 ? '' : 's'}
                  </div>
                </button>
              );
            })}
          {storyCutContributorChoices.filter((contributor) => !contributor.isOwner).length === 0 ? (
            <div
              className="rounded-xl px-4 py-4 text-white/40 text-sm"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              No contributor story responses have been saved yet.
            </div>
          ) : null}
        </div>
      </SnapshotCard>

      {storyCutError ? (
        <SnapshotCard>
          <p className="text-rose-300 text-sm">{storyCutError}</p>
        </SnapshotCard>
      ) : null}

      {storyCutData ? (
        <SnapshotCard>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[rgba(249,115,22,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#fdba74]">
              {storyCutData.style}
            </span>
            <span className="rounded-full bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
              {storyCutData.durationSeconds}s
            </span>
            <span className="rounded-full bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
              {storyCutData.wordCount} words
            </span>
          </div>
          <h3 className="mt-4 text-white text-lg font-medium">{storyCutData.title}</h3>
          <p className="mt-2 text-white/55 text-sm leading-relaxed">
            {storyCutData.focus || storyCutFocus}
          </p>
          <p className="text-white/30 text-xs mt-3">
            Last updated: {formatDate(storyCutData.updatedAt)}
          </p>
          <textarea
            value={storyCutScriptDraft}
            onChange={(event) => setStoryCutScriptDraft(event.target.value)}
            disabled={!detail.canManage}
            className="w-full min-h-[14rem] rounded-xl px-4 py-3 text-sm text-white outline-none disabled:opacity-70 mt-4"
            style={fieldStyle}
          />
        </SnapshotCard>
      ) : null}
    </>
  );
}
