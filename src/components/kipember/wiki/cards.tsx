'use client';

// ─── KipemberWikiContent — domain card components ─────────────────────────────
// Extracted from KipemberWikiContent.tsx (Phase 6 of wiki feature-module split).
// All components are pure/props-driven — zero closure dependencies on the main
// component state. Safe to import from any surface.

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ListChecks,
  MessageCircle,
  MessagesSquare,
  Mic,
  Pause,
  Phone,
  Play,
  Sparkles,
  Trash2,
} from 'lucide-react';
import EmberChatMessages from '@/components/kipember/EmberChatMessages';
import VoiceMessageList, { type VoiceMessage } from '@/components/kipember/workflows/VoiceMessageList';
import { pastelForContributorIdentity } from '@/lib/contributor-color';
import type { KipemberWikiDetail } from './types';
import type { ClaimSource, EmberStoryRecord, ReconciliationClaim } from './hooks';
import type { FindPerson, PersonIdentity } from './utils';
import {
  OWNER_AVATAR_BG,
  avatarStylesForPerson,
  claimSourceLabelFromMetadata,
  initials,
  relativeAt,
} from './utils';
import { AvatarCircle, RefreshFooter, WikiCard } from './atoms';

// ── ClaimRow ──────────────────────────────────────────────────────────────────

function ClaimRow({
  name,
  value,
  source,
  createdAt,
  person,
}: {
  name: string;
  value: string;
  source: string;
  createdAt: string;
  // Full identity for the speaker — drives both avatar URL and the
  // pool-key pastel so the same contributor lands on the same swatch
  // everywhere the wiki shows them.
  person: PersonIdentity | null;
}) {
  const isVoice = source === 'voice';
  const displayName = name.trim() || 'Someone';
  const avatarUrl = person?.avatarUrl ?? null;
  const styles = avatarStylesForPerson(person, displayName);
  return (
    <div
      className="rounded-lg px-3 py-2 flex items-center gap-2.5"
      style={{ background: 'var(--bg-ember-bubble)', border: '1px solid var(--border-ember)' }}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt={displayName}
          className="rounded-full object-cover flex-shrink-0"
          style={{ width: 29, height: 29 }}
        />
      ) : (
        <div
          className="rounded-full flex items-center justify-center flex-shrink-0"
          style={{
            width: 29,
            height: 29,
            background: styles.background,
            color: styles.color,
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {initials(displayName)}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-white text-xs font-medium">{displayName}</p>
        <p className="text-white/60 text-[11px] mt-0.5">&ldquo;{value}&rdquo;</p>
      </div>
      <div className="flex items-center gap-1 text-white/30 text-[10px] flex-shrink-0">
        {isVoice ? (
          <Phone size={10} fill="currentColor" stroke="currentColor" />
        ) : (
          <MessageCircle size={10} fill="currentColor" stroke="currentColor" />
        )}
        <span>{relativeAt(createdAt)}</span>
      </div>
    </div>
  );
}

// ── StoriesCard helpers ───────────────────────────────────────────────────────

type ScriptSegment =
  | { type: 'narration'; text: string }
  | { type: 'voice-clip' | 'call-clip'; speaker: string; text: string };

/** Try to parse a structured script (JSON array). Returns null for legacy plain text. */
function parseScriptSegments(script: string): ScriptSegment[] | null {
  if (!script.startsWith('[')) return null;
  try {
    const parsed: unknown = JSON.parse(script);
    if (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      typeof (parsed[0] as { type?: unknown }).type === 'string'
    ) {
      return parsed as ScriptSegment[];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Renders a story script with coloured segments:
 *   narrator (Ember TTS)     → white/60 (muted)
 *   voice-clip (contributor voice message) → green
 *   call-clip  (contributor call audio)    → blue
 */
function ScriptDisplay({ script }: { script: string }) {
  const segments = parseScriptSegments(script);
  if (!segments) {
    // Legacy plain-text script
    return <p className="text-white/60 text-xs leading-relaxed">&ldquo;{script}&rdquo;</p>;
  }
  return (
    <div className="flex flex-col gap-0.5">
      {segments.map((seg, i) => {
        if (seg.type === 'narration') {
          return (
            <p key={i} className="text-white/60 text-xs leading-relaxed">{seg.text}</p>
          );
        }
        // voice-clip = green (#4ade80), call-clip = blue (#60a5fa)
        const color = seg.type === 'call-clip' ? '#60a5fa' : '#4ade80';
        return (
          <p key={i} className="text-xs leading-relaxed" style={{ color }}>
            <span className="text-white/30">{seg.speaker}: </span>
            &ldquo;{seg.text}&rdquo;
          </p>
        );
      })}
    </div>
  );
}

// ── StoriesCard ───────────────────────────────────────────────────────────────

export function StoriesCard({ stories }: { stories: EmberStoryRecord[] | null }) {
  if (!stories || stories.length === 0) {
    return (
      <WikiCard>
        <p className="text-white/30 text-sm">No stories composed yet.</p>
      </WikiCard>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {stories.map((story) => {
        const chips = [...story.facets, ...story.people];
        return (
          <div
            key={story.id}
            className="rounded-lg px-3 py-2.5 flex flex-col gap-1.5"
            style={{ background: 'var(--bg-ember-bubble)', border: '1px solid var(--border-ember)' }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-white text-xs font-medium">
                {story.authorName ?? 'Unknown'}
                {story.authorType ? (
                  <span className="text-white/40 font-normal ml-1">({story.authorType})</span>
                ) : null}
              </span>
              <span className="text-white/30 text-[10px] flex-shrink-0">{relativeAt(story.createdAt)}</span>
            </div>
            {chips.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {chips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full px-2 text-[10px] font-medium"
                    style={{ background: 'var(--bg-drill-blocks)', color: 'rgba(255,255,255,0.5)', border: '1px solid var(--border-subtle)' }}
                  >
                    {chip}
                  </span>
                ))}
              </div>
            ) : null}
            <ScriptDisplay script={story.script} />
          </div>
        );
      })}
    </div>
  );
}

// ── VoiceBlockCard ────────────────────────────────────────────────────────────

export function VoiceBlockCard({
  block,
  onRefresh,
}: {
  block: NonNullable<KipemberWikiDetail['voiceBlocks']>[number];
  onRefresh?: () => unknown;
}) {
  const [collapsed, setCollapsed] = useState(true);
  const messages: VoiceMessage[] = block.messages.map((m) => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content,
    audioUrl: m.audioUrl,
    createdAt: m.createdAt,
  }));
  const messageCount = messages.length;
  return (
    <WikiCard>
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
        className="w-full flex items-center gap-2 cursor-pointer"
        style={{ background: 'transparent', border: 'none', padding: 0, minHeight: 44 }}
      >
        <div
          className="rounded-full flex items-center justify-center flex-shrink-0"
          style={{ width: 29, height: 29, background: 'var(--color-success)' }}
        >
          <Mic size={16} className="text-white" />
        </div>
        <AvatarCircle
          name={block.personName}
          avatarUrl={block.avatarUrl}
          size={29}
          bgColor={
            block.isOwner
              ? OWNER_AVATAR_BG
              : block.personAvatarColor ?? pastelForContributorIdentity({
                  userId: block.personUserId ?? null,
                  email: block.personEmail ?? null,
                  phoneNumber: block.personPhoneNumber ?? null,
                  id: block.personName,
                })
          }
        />
        <p className="flex-1 text-left text-white/30 text-xs font-medium">
          {block.personName}&apos;s Ember Voice
          <span className="ml-2 text-white/20">
            ({messageCount} {messageCount === 1 ? 'message' : 'messages'})
          </span>
        </p>
        <ChevronDown
          size={14}
          color="var(--text-secondary)"
          style={{
            transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
          }}
        />
      </button>
      {!collapsed ? (
        <div className="mt-3">
          <VoiceMessageList
            messages={messages}
            isUploading={false}
            emptyHint=""
            selfLabel={block.personName.split(' ')[0] || block.personName}
          />
          <RefreshFooter onRefresh={onRefresh} />
        </div>
      ) : null}
    </WikiCard>
  );
}

// ── WhyCard ───────────────────────────────────────────────────────────────────

export function WhyCard({
  claims,
  findPerson,
}: {
  claims: ReconciliationClaim[] | null;
  findPerson: FindPerson;
}) {
  if (claims === null || claims.length === 0) {
    return (
      <WikiCard>
        <p className="text-white/30 text-sm">Nothing captured yet.</p>
      </WikiCard>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {claims.map((claim) => {
        const name = claimSourceLabelFromMetadata(claim.metadata);
        return (
          <ClaimRow
            key={claim.id}
            name={name}
            value={claim.value}
            source={claim.source}
            createdAt={claim.createdAt}
            person={findPerson(name)}
          />
        );
      })}
    </div>
  );
}

// ── EmotionalStateCard ────────────────────────────────────────────────────────

export function EmotionalStateCard({
  claims,
  findPerson,
}: {
  claims: ReconciliationClaim[] | null;
  findPerson: FindPerson;
}) {
  if (claims === null || claims.length === 0) {
    return (
      <WikiCard>
        <p className="text-white/30 text-sm">Nothing captured yet.</p>
      </WikiCard>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {claims.map((claim) => {
        const sourceName = claimSourceLabelFromMetadata(claim.metadata);
        const subjectName = claim.subject?.trim() || '';
        return (
          <EmotionalClaimRow
            key={claim.id}
            sourceName={sourceName}
            sourcePerson={findPerson(sourceName)}
            subjectName={subjectName}
            subjectPerson={subjectName ? findPerson(subjectName) : null}
            value={claim.value}
            source={claim.source}
            createdAt={claim.createdAt}
          />
        );
      })}
    </div>
  );
}

// ── EmotionalClaimRow ─────────────────────────────────────────────────────────

function EmotionalClaimRow({
  sourceName,
  sourcePerson,
  subjectName,
  subjectPerson,
  value,
  source,
  createdAt,
}: {
  sourceName: string;
  sourcePerson: PersonIdentity | null;
  subjectName: string;
  subjectPerson: PersonIdentity | null;
  value: string;
  source: string;
  createdAt: string;
}) {
  const isVoice = source === 'voice';
  const sourceDisplay = sourceName.trim() || 'Someone';
  const subjectDisplay = subjectName.trim();

  return (
    <div
      className="rounded-lg px-3 py-2 flex items-center gap-2.5"
      style={{ background: 'var(--bg-ember-bubble)', border: '1px solid var(--border-ember)' }}
    >
      <div className="flex items-center flex-shrink-0" style={{ gap: 2 }}>
        <Avatar name={sourceDisplay} person={sourcePerson} size={29} />
        {subjectDisplay ? (
          <>
            <ChevronRight size={11} className="text-white/40" strokeWidth={2.5} />
            <Avatar name={subjectDisplay} person={subjectPerson} size={29} />
          </>
        ) : null}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-xs font-medium truncate">
          {sourceDisplay}
          {subjectDisplay ? (
            <>
              <span className="font-normal text-white/40"> on </span>
              {subjectDisplay}
            </>
          ) : null}
        </p>
        <p className="text-white/60 text-[11px] mt-0.5">&ldquo;{value}&rdquo;</p>
      </div>
      <div className="flex items-center gap-1 text-white/30 text-[10px] flex-shrink-0">
        {isVoice ? (
          <Phone size={10} fill="currentColor" stroke="currentColor" />
        ) : (
          <MessageCircle size={10} fill="currentColor" stroke="currentColor" />
        )}
        <span>{relativeAt(createdAt)}</span>
      </div>
    </div>
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({
  name,
  person,
  size = 24,
}: {
  name: string;
  person: PersonIdentity | null;
  size?: number;
}) {
  const avatarUrl = person?.avatarUrl ?? null;
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  const styles = avatarStylesForPerson(person, name);
  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0"
      style={{
        width: size,
        height: size,
        background: styles.background,
        color: styles.color,
        fontSize: size <= 24 ? 10 : 11,
        fontWeight: 600,
      }}
    >
      {initials(name)}
    </div>
  );
}

// ── ExtraStoriesCard ──────────────────────────────────────────────────────────

export function ExtraStoriesCard({
  claims,
  findPerson,
}: {
  claims: ReconciliationClaim[] | null;
  findPerson: FindPerson;
}) {
  if (claims === null || claims.length === 0) {
    return (
      <WikiCard>
        <p className="text-white/30 text-sm">Nothing captured yet.</p>
      </WikiCard>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {claims.map((claim) => {
        const name = claimSourceLabelFromMetadata(claim.metadata);
        return (
          <ClaimRow
            key={claim.id}
            name={name}
            value={claim.value}
            source={claim.source}
            createdAt={claim.createdAt}
            person={findPerson(name)}
          />
        );
      })}
    </div>
  );
}

// ── PlacesMentionedCard ───────────────────────────────────────────────────────

export function PlacesMentionedCard({
  claims,
  findPerson,
}: {
  claims: ReconciliationClaim[] | null;
  findPerson: FindPerson;
}) {
  if (claims === null || claims.length === 0) {
    return (
      <WikiCard>
        <p className="text-white/30 text-sm">Nothing captured yet.</p>
      </WikiCard>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {claims.map((claim) => {
        const name = claimSourceLabelFromMetadata(claim.metadata);
        return (
          <ClaimRow
            key={claim.id}
            name={name}
            value={claim.value}
            source={claim.source}
            createdAt={claim.createdAt}
            person={findPerson(name)}
          />
        );
      })}
    </div>
  );
}

// ── PeopleMentionedCard ───────────────────────────────────────────────────────

// People mentioned by contributors but not necessarily tagged on the photo —
// surfaced from MemoryClaim rows of type "person" produced by the
// housekeeping.person_extraction extractor. Unlike the other claim cards,
// the headline here is the SUBJECT (the mentioned person), with the
// speaker shown as attribution underneath — because for person claims the
// subject IS the point of the row.
export function PeopleMentionedCard({
  claims,
  findPerson,
}: {
  claims: ReconciliationClaim[] | null;
  findPerson: FindPerson;
}) {
  if (claims === null || claims.length === 0) {
    return (
      <WikiCard>
        <p className="text-white/30 text-sm">Nothing captured yet.</p>
      </WikiCard>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {claims.map((claim) => {
        // The avatar belongs to the speaker (the contributor who DID the
        // mentioning), not the subject — so this card mirrors how Why /
        // Place / Story claim rows attribute their content. The subject's
        // name is bolded inside the quoted text instead.
        const speaker = claimSourceLabelFromMetadata(claim.metadata);
        const speakerPerson = findPerson(speaker);
        const speakerAvatar = speakerPerson?.avatarUrl ?? null;
        const speakerStyles = avatarStylesForPerson(speakerPerson, speaker);
        const subject = claim.subject?.trim() || '';
        const isVoice = claim.source === 'voice';
        return (
          <div
            key={claim.id}
            className="rounded-lg px-3 py-2 flex items-center gap-2.5"
            style={{ background: 'var(--bg-ember-bubble)', border: '1px solid var(--border-ember)' }}
          >
            {speakerAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={speakerAvatar}
                alt={speaker}
                className="rounded-full object-cover flex-shrink-0"
                style={{ width: 29, height: 29 }}
              />
            ) : (
              <div
                className="rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  width: 29,
                  height: 29,
                  background: speakerStyles.background,
                  color: speakerStyles.color,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {initials(speaker)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium">{speaker}</p>
              <p className="text-white/60 text-[11px] mt-0.5">
                &ldquo;
                {subject ? (
                  <>
                    <span className="font-bold text-white">{subject}</span>
                    {claim.value ? ` ${claim.value}` : ''}
                  </>
                ) : (
                  claim.value
                )}
                &rdquo;
              </p>
            </div>
            <div className="flex items-center gap-1 text-white/30 text-[10px] flex-shrink-0">
              {isVoice ? (
                <Phone size={10} fill="currentColor" stroke="currentColor" />
              ) : (
                <MessageCircle size={10} fill="currentColor" stroke="currentColor" />
              )}
              <span>{relativeAt(claim.createdAt)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── CollapsibleAnalysisCard ───────────────────────────────────────────────────

// Per-block collapsible card for the Image Analysis section. Header shows
// the thumbnail + filename and toggles open/closed independently of the
// parent section; body is rendered only when expanded. Each block keeps
// its own state so users can inspect one photo at a time.
export function CollapsibleAnalysisCard({
  thumbnail,
  filename,
  defaultCollapsed = true,
  children,
}: {
  thumbnail: React.ReactNode;
  filename: string | null;
  defaultCollapsed?: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  return (
    <WikiCard>
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
        className="w-full flex items-center gap-3 cursor-pointer text-left"
        style={{ background: 'transparent', border: 'none', padding: 0, minHeight: 44 }}
      >
        <div
          className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0"
          style={{ background: 'var(--bg-ember-bubble)', border: '1px solid var(--border-ember)' }}
        >
          {thumbnail}
        </div>
        <p className="flex-1 text-white/50 text-xs font-medium break-words">{filename}</p>
        <ChevronDown
          size={14}
          color="var(--text-secondary)"
          style={{
            transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
          }}
        />
      </button>
      {collapsed ? null : <div className="mt-3">{children}</div>}
    </WikiCard>
  );
}

// ── PrivacyToggle ─────────────────────────────────────────────────────────────

// Inline privacy toggles for the Control group. PATCH the ember on
// every flip so the wire is the single source of truth — the local
// state stays in sync with `detail` via the parent's refreshDetail.
function PrivacyToggle({
  label,
  hint,
  value,
  onChange,
  disabled = false,
}: {
  // ReactNode (not just string) so callers can append muted status
  // suffixes like "(Not yet available)" without restyling the label.
  label: React.ReactNode;
  hint?: string;
  value: boolean;
  onChange: (next: boolean) => void;
  // Disabled toggles drop to 50% opacity and lose the pointer cursor
  // so they read clearly as inert. Used today by Share to Network
  // while the public-network feature is still off.
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-center justify-between gap-4 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      style={{ minHeight: 44, opacity: disabled ? 0.5 : 1 }}
    >
      <span className="flex flex-col gap-0.5">
        <span className="text-white text-sm font-medium">{label}</span>
        {hint ? <span className="text-white/40 text-xs">{hint}</span> : null}
      </span>
      <span className="relative flex-shrink-0" style={{ width: 48, height: 28 }}>
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only"
        />
        <span
          className="absolute inset-0 rounded-full transition-colors duration-200"
          style={{ background: value ? 'var(--color-accent)' : 'var(--border-default)' }}
        />
        <span
          className="absolute top-0.5 left-0.5 rounded-full bg-white shadow transition-transform duration-200"
          style={{
            width: 24,
            height: 24,
            transform: value ? 'translateX(20px)' : 'translateX(0)',
          }}
        />
      </span>
    </label>
  );
}

// ── PrivacyToggles ────────────────────────────────────────────────────────────

export function PrivacyToggles({
  emberId,
  shareToNetwork,
  keepPrivate,
  refreshDetail,
  onStatus,
}: {
  emberId: string | null;
  shareToNetwork: boolean;
  keepPrivate: boolean;
  refreshDetail?: () => Promise<unknown> | unknown;
  onStatus?: (message: string) => void;
}) {
  const [networkValue, setNetworkValue] = useState(shareToNetwork);
  const [keepPrivateValue, setKeepPrivateValue] = useState(keepPrivate);

  useEffect(() => {
    setNetworkValue(shareToNetwork);
  }, [shareToNetwork]);
  useEffect(() => {
    setKeepPrivateValue(keepPrivate);
  }, [keepPrivate]);

  async function patch(next: { shareToNetwork: boolean; keepPrivate: boolean }) {
    if (!emberId) return;
    try {
      const response = await fetch(`/api/embers/${emberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      onStatus?.(response.ok ? 'Privacy saved.' : 'Failed to save privacy.');
      if (response.ok) await refreshDetail?.();
    } catch (error) {
      onStatus?.(error instanceof Error ? error.message : 'Failed to save privacy.');
    }
  }

  return (
    <WikiCard>
      <div className="flex flex-col gap-2">
        <PrivacyToggle
          label={
            <>
              Share to Network{' '}
              <span className="text-white/40 font-normal">(Not yet available)</span>
            </>
          }
          hint="Show this ember in the public Ember network."
          value={networkValue}
          onChange={(v) => {
            setNetworkValue(v);
            void patch({ shareToNetwork: v, keepPrivate: keepPrivateValue });
          }}
          disabled
        />
        <div className="h-px" style={{ background: 'var(--border-subtle)' }} />
        <PrivacyToggle
          label="Keep Private"
          hint="Hide this ember from contributors who haven't been invited."
          value={keepPrivateValue}
          onChange={(v) => {
            setKeepPrivateValue(v);
            void patch({ shareToNetwork: networkValue, keepPrivate: v });
          }}
        />
        {/* Live status string under the Keep Private toggle so the user
            sees the consequence of the flip without having to interpret
            the toggle position. Green when private (matches the
            "completed/safe" semantic used elsewhere), orange when public
            (matches the brand action color, signaling "active to the
            world"). */}
        <p
          className="text-xs"
          style={{ color: keepPrivateValue ? 'var(--color-success)' : 'var(--color-accent)' }}
        >
          {keepPrivateValue ? 'This ember is now private' : 'This ember is now public'}
        </p>
      </div>
    </WikiCard>
  );
}

// ── DeleteEmberCard ───────────────────────────────────────────────────────────

export function DeleteEmberCard({
  emberId,
  canManage,
  onStatus,
}: {
  emberId: string | null;
  canManage: boolean;
  onStatus?: (message: string) => void;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function performDelete() {
    if (!emberId || !canManage || deleting) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/embers/${emberId}`, { method: 'DELETE' });
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
      setDeleting(false);
    }
  }

  // First press flips the whole card into a red confirmation state with a
  // sharper warning + two-button row (Cancel / Yes, Delete). Second press
  // on the confirm side actually fires the destructive call.
  if (confirming) {
    return (
      <div
        className="rounded-xl px-4 py-3.5 flex flex-col gap-1"
        style={{
          background: 'var(--color-error-bg)',
          border: '1px solid var(--color-error-border)',
        }}
      >
        <p className="text-white text-sm font-semibold mb-1">
          Are you absolutely sure?
        </p>
        <p className="text-[rgba(255,180,180,0.85)] text-xs leading-relaxed mb-3">
          This will permanently destroy every photo, the wiki, every voice
          message, every call recording and transcript, every contributor
          relationship, and every chat in this ember. None of it can be
          recovered.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={deleting}
            className="flex-1 rounded-full px-5 text-white text-sm font-medium disabled:opacity-50"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              minHeight: 44,
              cursor: deleting ? 'default' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void performDelete()}
            disabled={deleting}
            className="flex-1 flex items-center justify-center gap-2 rounded-full px-5 text-white text-sm font-medium disabled:opacity-50"
            style={{
              background: 'var(--color-error)',
              border: 'none',
              minHeight: 44,
              cursor: deleting ? 'default' : 'pointer',
            }}
          >
            <Trash2 size={14} />
            {deleting ? 'Deleting…' : 'Yes, Delete'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <WikiCard>
      <p className="text-white/60 text-sm mb-3">
        Permanently remove this ember and everything attached to it — photos,
        wiki, voice / call recordings, contributors, and conversations. This
        cannot be undone.
      </p>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={!canManage}
        className="w-1/2 ml-auto flex items-center justify-center gap-2 rounded-full px-5 text-white text-sm font-medium disabled:opacity-50"
        style={{
          background: 'var(--color-error)',
          border: 'none',
          minHeight: 44,
          cursor: !canManage ? 'default' : 'pointer',
        }}
      >
        <Trash2 size={14} />
        Delete Ember
      </button>
    </WikiCard>
  );
}

// ── EmberProgressBar ──────────────────────────────────────────────────────────

// Universal ember progress bar — sits above the IDENTITY group at the
// top of the wiki. One green fill driven by completed tracker steps;
// remaining steps appear as tappable chips that scrollIntoView the
// matching WikiSection by its DOM id.
export function EmberProgressBar({
  steps,
}: {
  steps: ReadonlyArray<{
    slug: string;
    label: string;
    complete: boolean;
    missingLabel?: React.ReactNode | null;
  }>;
}) {
  if (steps.length === 0) return null;
  const completed = steps.filter((s) => s.complete).length;
  const total = steps.length;
  const percent = Math.round((completed / total) * 100);
  const missing = steps.filter((s) => !s.complete);
  // Default to collapsed when there are missing chips so the wiki opens
  // compact — user can expand to see what's left. Once everything is
  // complete, missing list is empty and the chevron toggle is irrelevant.
  const [collapsed, setCollapsed] = useState(missing.length > 0);
  const showMissing = missing.length > 0 && !collapsed;

  const handleChipClick = (slug: string) => {
    const target = document.getElementById(`tracker-${slug}`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        {missing.length > 0 ? (
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-expanded={!collapsed}
            className="flex items-center gap-2 cursor-pointer"
            style={{ background: 'transparent', border: 'none', padding: 0, minHeight: 44 }}
          >
            <span style={{ color: 'var(--text-secondary)' }}>
              <ListChecks size={17} />
            </span>
            <h3 className="text-white font-medium text-base">Progress</h3>
            <ChevronDown
              size={14}
              color="var(--text-secondary)"
              style={{
                transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s ease',
              }}
            />
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span style={{ color: 'var(--text-secondary)' }}>
              <ListChecks size={17} />
            </span>
            <h3 className="text-white font-medium text-base">Progress</h3>
          </div>
        )}
        <span className="text-white/60 text-xs font-medium">
          <span className="text-white">{completed}</span> of {total}
        </span>
      </div>
      <div
        className="h-2 rounded-full overflow-hidden"
        style={{ background: 'var(--bg-input)' }}
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${percent}%`,
            background: 'var(--color-success)',
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      {showMissing ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-white/40 text-xs font-medium">Missing</span>
          {missing.map((step) => (
            <button
              key={step.slug}
              type="button"
              onClick={() => handleChipClick(step.slug)}
              className="text-xs font-medium px-2.5 py-1 rounded-full can-hover cursor-pointer inline-flex items-center gap-1.5"
              style={{
                background: 'color-mix(in srgb, var(--bg-sheets) 85%, rgb(148,163,184) 15%)',
                color: '#94a3b8',
                minHeight: 28,
                border: 'none',
              }}
            >
              <span>{step.label}</span>
              {step.missingLabel ? (
                <span className="opacity-80">· {step.missingLabel}</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ── PlaceCard ─────────────────────────────────────────────────────────────────

// Place card with a collapse toggle. Collapsed (default) shows just the
// place name; expanded shows exact address, coordinates, and source.
export function PlaceCard({
  placeName,
  placeConfirmedAt,
  showExactAddress,
  addressLines,
  placeCountry,
  coordinateLine,
  locationLookupPending,
  placeSource,
  bare = false,
}: {
  placeName: string | null;
  placeConfirmedAt: string | null;
  showExactAddress: boolean;
  addressLines: string[];
  placeCountry: string | null;
  coordinateLine: string | null;
  locationLookupPending: boolean;
  placeSource: 'manual' | 'gps' | 'none';
  // When true, render the place content without the outer WikiCard
  // wrapper so the caller can compose it into a larger card (e.g. the
  // merged Time & Place section, where time + place share one card).
  bare?: boolean;
}) {
  const inner = (
    <>
      <p className="text-white/30 text-xs font-medium mb-1.5">Place</p>
      <p className="text-white font-medium text-sm">
        {placeName || 'No location data available.'}
      </p>
      {placeConfirmedAt ? (
        <p className="text-white/30 text-xs mt-1">
          (edited on {new Date(placeConfirmedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })})
        </p>
      ) : null}
      {showExactAddress ? (
        <>
          <p className="text-white/30 text-xs font-medium mt-3 mb-1.5">Exact Address</p>
          {addressLines.map((line, index) => (
            <p key={index} className="text-white/70 text-sm">{line}</p>
          ))}
          {placeCountry ? (
            <p className="text-white/70 text-sm">{placeCountry}</p>
          ) : null}
        </>
      ) : placeCountry ? (
        <>
          <p className="text-white/30 text-xs font-medium mt-3 mb-1.5">Country</p>
          <p className="text-white/70 text-sm">{placeCountry}</p>
        </>
      ) : null}
      {coordinateLine ? (
        <>
          <p className="text-white/30 text-xs font-medium mt-3 mb-1.5">Coordinates</p>
          <p className="text-white/70 text-sm">{coordinateLine}</p>
        </>
      ) : null}
      {locationLookupPending && addressLines.length === 0 ? (
        <p className="text-white/30 text-xs mt-3">
          Looking up an address from the photo GPS metadata...
        </p>
      ) : null}
      <p className="text-white/30 text-xs mt-3">
        Source: {placeSource === 'manual'
          ? 'Manual entry'
          : placeSource === 'gps'
            ? 'Photo GPS metadata & Reverse Geocoded'
            : 'Not set'}
      </p>
    </>
  );
  return bare ? inner : <WikiCard>{inner}</WikiCard>;
}

// ── ChatBlock type ────────────────────────────────────────────────────────────

export type ChatBlock = {
  personName: string;
  avatarUrl?: string | null;
  isOwner?: boolean;
  personUserId?: string | null;
  personEmail?: string | null;
  personPhoneNumber?: string | null;
  personAvatarColor?: string | null;
  messages: Array<{
    role: string;
    content: string;
    source: string;
    imageFilename?: string | null;
    audioUrl?: string | null;
    createdAt: string;
  }>;
};

// ── CollapsibleChatBlock ──────────────────────────────────────────────────────

// Story Circle entries default to collapsed so the wiki opens compact.
// Click the header row to expand and read the messages.
export function CollapsibleChatBlock({ block, onRefresh }: { block: ChatBlock; onRefresh?: () => unknown }) {
  const [collapsed, setCollapsed] = useState(true);
  const messageCount = block.messages.length;
  return (
    <WikiCard>
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
        className="w-full flex items-center gap-2 cursor-pointer"
        style={{ background: 'transparent', border: 'none', padding: 0, minHeight: 44 }}
      >
        <div
          className="rounded-full flex items-center justify-center flex-shrink-0"
          style={{ width: 29, height: 29, background: 'var(--color-accent)' }}
        >
          <MessageCircle size={16} className="text-white" fill="currentColor" stroke="currentColor" />
        </div>
        <AvatarCircle
          name={block.personName}
          avatarUrl={block.avatarUrl}
          size={29}
          bgColor={
            block.isOwner
              ? OWNER_AVATAR_BG
              : block.personAvatarColor ?? pastelForContributorIdentity({
                  userId: block.personUserId ?? null,
                  email: block.personEmail ?? null,
                  phoneNumber: block.personPhoneNumber ?? null,
                  id: block.personName,
                })
          }
        />
        <p className="flex-1 text-left text-white/30 text-xs font-medium">
          {block.personName}&apos;s Ember Chat
          <span className="ml-2 text-white/20">
            ({messageCount} {messageCount === 1 ? 'message' : 'messages'})
          </span>
        </p>
        <ChevronDown
          size={14}
          color="var(--text-secondary)"
          style={{
            transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
          }}
        />
      </button>
      {!collapsed ? (
        <div className="mt-3">
          <EmberChatMessages
            messages={block.messages.map((msg) => ({
              role: msg.role === 'user' ? 'user' : 'assistant',
              content: msg.content,
              source: (msg.source as 'web' | 'voice' | 'sms') ?? 'web',
              imageFilename: msg.imageFilename ?? null,
              audioUrl: msg.audioUrl ?? null,
              createdAt: msg.createdAt,
            }))}
            selfLabel={block.personName.split(' ')[0] || block.personName}
          />
          <RefreshFooter onRefresh={onRefresh} />
        </div>
      ) : null}
    </WikiCard>
  );
}

// ── Guest visitor types ───────────────────────────────────────────────────────

type GuestChatBlock = NonNullable<KipemberWikiDetail['guestChatBlock']>;
export type GuestVisitor = GuestChatBlock['visitors'][number];

// ── CollapsibleGuestVisitorChatBlock ──────────────────────────────────────────

// One collapsible chat card per anonymous share-link visitor.
// Anonymous browsers can't be told apart by name, so we label them
// ordinally ("Visitor 1", "Visitor 2", …) with the first-message date
// as a subtitle. Grey avatar + chat-bubble icon distinguishes these
// cards from the named contributor chat blocks in Story Circle.
export function CollapsibleGuestVisitorChatBlock({
  visitor,
  visitorNumber,
}: {
  visitor: GuestVisitor;
  visitorNumber: number;
}) {
  const [collapsed, setCollapsed] = useState(true);
  const userMessageCount = visitor.chatMessages.filter((m) => m.role === 'user').length;
  const dateLabel = (() => {
    const first = visitor.chatMessages[0]?.createdAt ?? visitor.firstMessageAt;
    const d = new Date(first);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  })();
  return (
    <WikiCard>
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
        className="w-full flex items-center gap-2 cursor-pointer"
        style={{ background: 'transparent', border: 'none', padding: 0, minHeight: 44 }}
      >
        <div
          className="rounded-full flex items-center justify-center flex-shrink-0"
          style={{ width: 29, height: 29, background: 'var(--color-neutral)' }}
        >
          <MessagesSquare size={16} className="text-white" strokeWidth={2} />
        </div>
        <p className="flex-1 text-left text-white/30 text-xs font-medium">
          Visitor {visitorNumber}
          <span className="ml-2 text-white/20">
            ({userMessageCount} {userMessageCount === 1 ? 'question' : 'questions'}
            {dateLabel ? ` · ${dateLabel}` : ''})
          </span>
        </p>
        <ChevronDown
          size={14}
          color="var(--text-secondary)"
          style={{
            transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
          }}
        />
      </button>
      {!collapsed ? (
        <div className="mt-3">
          <EmberChatMessages
            messages={visitor.chatMessages.map((msg) => ({
              role: msg.role === 'user' ? 'user' : 'assistant',
              content: msg.content,
              source: (msg.source as 'web' | 'voice' | 'sms') ?? 'web',
              imageFilename: msg.imageFilename ?? null,
              audioUrl: msg.audioUrl ?? null,
              createdAt: msg.createdAt,
            }))}
            selfLabel={`Visitor ${visitorNumber}`}
          />
        </div>
      ) : null}
    </WikiCard>
  );
}

// ── CollapsibleGuestVisitorVoiceBlock ─────────────────────────────────────────

// Voice counterpart to CollapsibleGuestVisitorChatBlock. Mirrors the
// VoiceBlockCard pattern in Story Circle (collapsible card, audio
// playback list when expanded), but uses the same grey #6b7280 avatar
// as the chat card with a Mic icon swap so guest voice stays visually
// grouped with guest chat instead of with the green-mic owner/contributor
// voice cards.
export function CollapsibleGuestVisitorVoiceBlock({
  visitor,
  visitorNumber,
}: {
  visitor: GuestVisitor;
  visitorNumber: number;
}) {
  const [collapsed, setCollapsed] = useState(true);
  const messageCount = visitor.voiceMessages.length;
  const dateLabel = (() => {
    const first = visitor.voiceMessages[0]?.createdAt ?? visitor.firstMessageAt;
    const d = new Date(first);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  })();
  const messages: VoiceMessage[] = visitor.voiceMessages.map((m) => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content,
    audioUrl: m.audioUrl,
    createdAt: m.createdAt,
  }));
  return (
    <WikiCard>
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
        className="w-full flex items-center gap-2 cursor-pointer"
        style={{ background: 'transparent', border: 'none', padding: 0, minHeight: 44 }}
      >
        <div
          className="rounded-full flex items-center justify-center flex-shrink-0"
          style={{ width: 29, height: 29, background: 'var(--color-neutral)' }}
        >
          <Mic size={16} className="text-white" />
        </div>
        <p className="flex-1 text-left text-white/30 text-xs font-medium">
          Visitor {visitorNumber} Voice
          <span className="ml-2 text-white/20">
            ({messageCount} {messageCount === 1 ? 'message' : 'messages'}
            {dateLabel ? ` · ${dateLabel}` : ''})
          </span>
        </p>
        <ChevronDown
          size={14}
          color="var(--text-secondary)"
          style={{
            transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
          }}
        />
      </button>
      {!collapsed ? (
        <div className="mt-3">
          <VoiceMessageList
            messages={messages}
            isUploading={false}
            emptyHint=""
            selfLabel={`Visitor ${visitorNumber}`}
          />
        </div>
      ) : null}
    </WikiCard>
  );
}

// ── AudioClipItem type ────────────────────────────────────────────────────────

export type AudioClipItem = {
  id: string;
  kind: 'call' | 'voice';
  contributorName: string;
  title: string;
  quote: string;
  significance: string | null;
  audioUrl: string;
  startMs: number | null;
  endMs: number | null;
  createdAt: string;
};

// ── ClaimSourceRow ────────────────────────────────────────────────────────────
// Renders one source under an extraction card. The kind of source determines
// the icon (chat bubble / green mic / blue phone) and whether a play button
// is rendered. The text shown is verbatim — exactly what the user typed (chat)
// or what the transcript captured (voice/call). Never a paraphrase.

function ClaimSourceRow({ source }: { source: ClaimSource }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Only call source rows seek inside a shared parent recording. Voice rows
  // play their own per-message file from the start.
  const startSec = source.kind === 'call' && source.startMs != null ? source.startMs / 1000 : null;
  const endSec = source.kind === 'call' && source.endMs != null ? source.endMs / 1000 : null;

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) { el.pause(); return; }
    if (startSec !== null) el.currentTime = startSec;
    void el.play();
  }

  function handleTimeUpdate() {
    const el = audioRef.current;
    if (!el || endSec === null) return;
    if (el.currentTime >= endSec) {
      el.pause();
      if (startSec !== null) el.currentTime = startSec;
      setPlaying(false);
    }
  }

  const durationLabel = (() => {
    if (source.kind !== 'call') return null;
    if (source.startMs == null || source.endMs == null) return null;
    const ms = source.endMs - source.startMs;
    if (ms <= 0) return null;
    return `${(ms / 1000).toFixed(1).replace(/\.0$/, '')}s`;
  })();

  const isChat = source.kind === 'chat' || source.kind === 'sms';
  const isVoice = source.kind === 'voice';
  const isCall = source.kind === 'call';

  const audioUrl = isVoice ? source.audioUrl : isCall ? source.recordingUrl : null;
  const hasAudio = Boolean(audioUrl);

  const channelLabel = isCall ? 'Call' : isVoice ? 'Voice' : source.kind === 'sms' ? 'SMS' : 'Chat';

  return (
    <div className="flex items-start gap-2">
      {hasAudio ? (
        <button
          type="button"
          onClick={toggle}
          className="rounded-full flex items-center justify-center flex-shrink-0 cursor-pointer mt-0.5"
          style={{
            width: 28,
            height: 28,
            background: isCall ? '#2563eb' : '#22c55e',
            border: 'none',
          }}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause size={12} className="text-white" /> : <Play size={12} className="text-white" style={{ marginLeft: 1 }} />}
        </button>
      ) : (
        <div
          className="rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{
            width: 28,
            height: 28,
            background: 'rgba(249,115,22,0.85)',
            color: '#fff',
          }}
          aria-label="Chat message"
        >
          <MessageCircle size={12} fill="currentColor" stroke="currentColor" />
        </div>
      )}
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-white/80 text-xs italic leading-relaxed">&ldquo;{source.text}&rdquo;</p>
        <p className="text-white/30 text-[10px] mt-0.5">
          {channelLabel}{durationLabel ? ` · ${durationLabel}` : ''}
        </p>
      </div>
      {hasAudio ? (
        <audio
          ref={audioRef}
          src={audioUrl ?? undefined}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => { setPlaying(false); if (startSec !== null && audioRef.current) audioRef.current.currentTime = startSec; }}
          onTimeUpdate={handleTimeUpdate}
          preload="none"
        />
      ) : null}
    </div>
  );
}

// ── ClaimExtractionCard ──────────────────────────────────────────────────────
// The new (truthful) extraction card. One claim per card. The header shows
// the LLM's distilled paraphrase with an AI icon — that's clearly labeled as
// the model's summary. Underneath, one row per verbatim source (chat text the
// user actually typed, the audio they actually recorded, the call turn they
// actually said). If the LLM paraphrase didn't have a verbatim hit in any
// source (e.g. an emotion extracted from a long call but never said in those
// exact words), the card renders the header alone — we never fabricate audio.

export function ClaimExtractionCard({
  claim,
  person,
}: {
  claim: ReconciliationClaim;
  person: PersonIdentity | null;
}) {
  const displayName = (() => {
    const fromMeta = claimSourceLabelFromMetadata(claim.metadata);
    return fromMeta || 'Someone';
  })();
  const avatarUrl = person?.avatarUrl ?? null;
  const styles = avatarStylesForPerson(person, displayName);

  return (
    <div
      className="rounded-lg px-3 py-2.5 flex flex-col gap-2.5"
      style={{ background: 'var(--bg-ember-bubble)', border: '1px solid var(--border-ember)' }}
    >
      {/* AI-described header — the LLM's paraphrase, clearly attributed to the model. */}
      <div className="flex items-center gap-2.5">
        <div
          className="rounded-full flex items-center justify-center flex-shrink-0"
          style={{ width: 29, height: 29, background: 'rgba(168,85,247,0.85)', color: '#fff' }}
          aria-label="AI-described"
          title="AI-described"
        >
          <Sparkles size={14} fill="currentColor" stroke="currentColor" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-medium">
            {displayName}
            {claim.subject ? <span className="text-white/50 font-normal"> on <span className="text-white/70">{claim.subject}</span></span> : null}
          </p>
          <p className="text-white/60 text-[11px] mt-0.5">&ldquo;{claim.value}&rdquo;</p>
        </div>
        <div className="flex items-center gap-1 text-white/30 text-[10px] flex-shrink-0">
          <span>{relativeAt(claim.createdAt)}</span>
        </div>
      </div>

      {/* Verbatim source rows — one per channel where the claim's words appear. */}
      {claim.sources.length > 0 ? (
        <div className="flex flex-col gap-2 pl-1">
          {/* Small person-avatar hint to anchor the verbatim section to the speaker. */}
          <div className="flex items-center gap-2">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={displayName} className="rounded-full object-cover flex-shrink-0" style={{ width: 18, height: 18 }} />
            ) : (
              <div className="rounded-full flex items-center justify-center flex-shrink-0"
                style={{ width: 18, height: 18, background: styles.background, color: styles.color, fontSize: 8, fontWeight: 600 }}>
                {initials(displayName)}
              </div>
            )}
            <span className="text-white/30 text-[10px]">{displayName} said</span>
          </div>
          {claim.sources.map((source, i) => (
            <ClaimSourceRow key={`${claim.id}-src-${i}`} source={source} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ── UnifiedExtractionBlock ────────────────────────────────────────────────────

// Unified block: claim (distilled) + clip (verbatim + player) in one container.
// Either part may be absent — clip-only shows just the player row,
// claim-only shows just the claim row.
export function UnifiedExtractionBlock({
  clip,
  claimName,
  claimSubject,
  claimValue,
  claimSource,
  claimCreatedAt,
  person,
}: {
  clip: AudioClipItem | null;
  claimName: string | null;
  claimSubject: string | null;
  claimValue: string | null;
  claimSource: string | null;
  claimCreatedAt: string | null;
  person: PersonIdentity | null;
}) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const startSec = clip?.kind === 'call' && clip.startMs != null ? clip.startMs / 1000 : null;
  const endSec   = clip?.kind === 'call' && clip.endMs   != null ? clip.endMs   / 1000 : null;

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) { el.pause(); }
    else { if (startSec !== null) el.currentTime = startSec; void el.play(); }
  }

  function handleTimeUpdate() {
    const el = audioRef.current;
    if (!el || endSec === null) return;
    if (el.currentTime >= endSec) {
      el.pause();
      if (startSec !== null) el.currentTime = startSec;
      setPlaying(false);
    }
  }

  const durationLabel = (() => {
    if (!clip || clip.startMs === null || clip.endMs === null) return null;
    const ms = clip.endMs - clip.startMs;
    if (ms <= 0) return null;
    return `${(ms / 1000).toFixed(1).replace(/\.0$/, '')}s`;
  })();

  const displayName = claimName?.trim() || clip?.contributorName || 'Someone';
  const avatarUrl = person?.avatarUrl ?? null;
  const styles = avatarStylesForPerson(person, displayName);
  const hasClaim = claimName !== null && claimValue !== null;

  return (
    <div
      className="rounded-lg px-3 py-2.5 flex flex-col gap-2.5"
      style={{ background: 'var(--bg-ember-bubble)', border: '1px solid var(--border-ember)' }}
    >
      {/* Claim row — distilled extraction */}
      {hasClaim && (
        <div className="flex items-center gap-2.5">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={displayName} className="rounded-full object-cover flex-shrink-0" style={{ width: 29, height: 29 }} />
          ) : (
            <div className="rounded-full flex items-center justify-center flex-shrink-0"
              style={{ width: 29, height: 29, background: styles.background, color: styles.color, fontSize: 11, fontWeight: 600 }}>
              {initials(displayName)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium">
              {displayName}
              {claimSubject ? <span className="text-white/50 font-normal"> on <span className="text-white/70">{claimSubject}</span></span> : null}
            </p>
            <p className="text-white/60 text-[11px] mt-0.5">&ldquo;{claimValue}&rdquo;</p>
          </div>
          <div className="flex items-center gap-1 text-white/30 text-[10px] flex-shrink-0">
            {claimSource === 'voice'
              ? <Mic size={10} />
              : claimSource === 'call'
                ? <Phone size={10} fill="currentColor" stroke="currentColor" />
                : <MessageCircle size={10} fill="currentColor" stroke="currentColor" />}
            {claimCreatedAt ? <span>{relativeAt(claimCreatedAt)}</span> : null}
          </div>
        </div>
      )}

      {/* Clip row — verbatim audio */}
      {clip && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            className="rounded-full flex items-center justify-center flex-shrink-0 cursor-pointer"
            style={{ width: 32, height: 32, background: clip.kind === 'call' ? '#2563eb' : '#22c55e', border: 'none' }}
          >
            {playing ? <Pause size={13} className="text-white" /> : <Play size={13} className="text-white" style={{ marginLeft: 1 }} />}
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-white/70 text-xs italic leading-relaxed">&ldquo;{clip.quote}&rdquo;</p>
            <p className="text-white/30 text-[10px] mt-0.5">
              {clip.kind === 'call' ? 'Call' : 'Voice'}{durationLabel ? ` · ${durationLabel}` : ''}
            </p>
          </div>
          <audio
            ref={audioRef}
            src={clip.audioUrl}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => { setPlaying(false); if (startSec !== null && audioRef.current) audioRef.current.currentTime = startSec; }}
            onTimeUpdate={handleTimeUpdate}
            preload="none"
          />
        </div>
      )}
    </div>
  );
}

// ── AudioClipRow ──────────────────────────────────────────────────────────────

export function AudioClipRow({ clip }: { clip: AudioClipItem }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // For 'call' clips the audioUrl is the full recording — we seek to startMs and
  // stop at endMs. For 'voice' clips the file is already a trimmed segment, so we
  // play from 0. Only apply seek/stop logic when we have valid timing.
  const startSec = clip.kind === 'call' && clip.startMs != null ? clip.startMs / 1000 : null;
  const endSec   = clip.kind === 'call' && clip.endMs   != null ? clip.endMs   / 1000 : null;

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      if (startSec !== null) el.currentTime = startSec;
      void el.play();
    }
  }

  function handleTimeUpdate() {
    const el = audioRef.current;
    if (!el || endSec === null) return;
    if (el.currentTime >= endSec) {
      el.pause();
      if (startSec !== null) el.currentTime = startSec;
      setPlaying(false);
    }
  }

  const durationLabel = (() => {
    if (clip.startMs === null || clip.endMs === null) return null;
    const ms = clip.endMs - clip.startMs;
    if (ms <= 0) return null;
    const secs = (ms / 1000).toFixed(1).replace(/\.0$/, '');
    return `${secs}s`;
  })();

  return (
    <div
      className="flex flex-col gap-2 py-3 border-b last:border-b-0"
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={toggle}
          className="flex-shrink-0 flex items-center justify-center rounded-full cursor-pointer"
          style={{
            width: 32,
            height: 32,
            background: 'var(--color-accent)',
            border: 'none',
          }}
        >
          {playing ? <Pause size={14} className="text-white" /> : <Play size={14} className="text-white" style={{ marginLeft: 2 }} />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white text-sm font-medium">{clip.title}</span>
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ background: clip.kind === 'call' ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.15)', color: clip.kind === 'call' ? '#93c5fd' : '#6ee7b7' }}
            >
              {clip.kind === 'call' ? 'Call' : 'Voice'}
            </span>
            {durationLabel ? <span className="text-white/30 text-xs">{durationLabel}</span> : null}
          </div>
          <p className="text-white/50 text-xs mt-0.5">{clip.contributorName}</p>
          <p className="text-white/70 text-xs mt-1 italic">&ldquo;{clip.quote}&rdquo;</p>
          {clip.significance ? <p className="text-white/40 text-xs mt-0.5">{clip.significance}</p> : null}
        </div>
      </div>
      <audio
        ref={audioRef}
        src={clip.audioUrl}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); if (startSec !== null && audioRef.current) audioRef.current.currentTime = startSec; }}
        onTimeUpdate={handleTimeUpdate}
        preload="none"
      />
    </div>
  );
}
