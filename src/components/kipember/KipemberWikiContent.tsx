'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowRightLeft,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Heart,
  History,
  Image as ImageIcon,
  Lightbulb,
  ListChecks,
  Lock,
  LockKeyhole,
  Map as MapIcon,
  MessageCircle,
  MessagesSquare,
  Mic,
  PencilLine,
  Phone,
  ScanEye,
  ShieldUser,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import EmberCallCard from '@/components/kipember/EmberCallCard';
import EmberChatMessages from '@/components/kipember/EmberChatMessages';
import VoiceMessageList, { type VoiceMessage } from '@/components/kipember/workflows/VoiceMessageList';
import MediaPreview from '@/components/MediaPreview';
import EditTitleSlider from '@/components/kipember/tend/EditTitleSlider';
import EditSnapshotSlider from '@/components/kipember/tend/EditSnapshotSlider';
import EditTimePlaceSlider from '@/components/kipember/tend/EditTimePlaceSlider';
import ContributorsSlider from '@/components/kipember/tend/ContributorsSlider';
import TagPeopleSlider from '@/components/kipember/tend/TagPeopleSlider';
import { getPreviewMediaUrl } from '@/lib/media';
import { usePlaceResolution } from '@/components/kipember/usePlaceResolution';
import { pastelForContributor, pastelForContributorIdentity } from '@/lib/contributor-color';
import { isAudioLikeFilename, type EmberMediaType } from '@/lib/media';
import { getUserDisplayName } from '@/lib/user-name';

type ConversationMessage = {
  id: string;
  role?: string | null;
  content: string;
  createdAt: string;
  source?: string | null;
  questionType?: string | null;
};

type ConversationResponse = {
  id: string;
  questionType?: string | null;
  question?: string | null;
  answer: string;
  source?: string | null;
  createdAt: string;
};

type ContributorVoiceCall = {
  id: string;
  createdAt: string;
  startedAt: string | null;
  callSummary: string | null;
  emberSession?: {
    id: string;
    messages: ConversationMessage[];
  } | null;
};

type AnalysisSceneInsights = {
  peopleAndDemographics?: {
    numberOfPeopleVisible?: number | null;
    estimatedAgeRanges?: string[];
    genderPresentation?: string | null;
    clothingAndStyle?: string | null;
    bodyLanguageAndExpressions?: string | null;
    spatialRelationships?: string | null;
    relationshipInference?: string | null;
  } | null;
  settingAndEnvironment?: {
    environmentType?: string | null;
    locationType?: string | null;
    timeOfDayAndLighting?: string | null;
    lightingDescription?: string | null;
    weatherConditions?: string | null;
    backgroundDetails?: string | null;
    architectureOrLandscape?: string | null;
  } | null;
  activitiesAndContext?: {
    whatAppearsToBeHappening?: string | null;
    socialDynamics?: string | null;
    interactionsBetweenPeople?: string | null;
    eventType?: string | null;
    visibleActivities?: string[];
  } | null;
  emotionalContext?: {
    overallMoodAndAtmosphere?: string | null;
    emotionalExpressions?: string | null;
    individualEmotions?: string | null;
    energyLevel?: string | null;
    socialEnergy?: string | null;
  } | null;
} | null;

export type KipemberContributor = {
  id: string;
  userId?: string | null;
  name: string | null;
  email: string | null;
  phoneNumber: string | null;
  avatarColor?: string | null;
  createdAt: string;
  user?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    phoneNumber: string | null;
    avatarFilename?: string | null;
  } | null;
  voiceCalls?: ContributorVoiceCall[];
  conversation: {
    messages: ConversationMessage[];
    responses?: ConversationResponse[];
  } | null;
};

export type KipemberTag = {
  id: string;
  label: string;
  leftPct?: number | null;
  topPct?: number | null;
  widthPct?: number | null;
  heightPct?: number | null;
  createdAt?: string | Date;
  createdBy?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    avatarUrl: string | null;
  } | null;
};

export type KipemberAttachment = {
  id: string;
  filename: string;
  mediaType: EmberMediaType;
  posterFilename: string | null;
  durationSeconds: number | null;
  originalName: string;
  description: string | null;
  analysisText?: string | null;
  createdAt: string;
};

export type KipemberVoiceCallClip = {
  id: string;
  contributorName: string;
  title: string;
  quote: string;
  significance: string | null;
  audioUrl: string | null;
  startMs: number | null;
  endMs: number | null;
  createdAt: string;
};

export type KipemberWikiDetail = {
  id: string;
  filename: string;
  mediaType: EmberMediaType;
  posterFilename: string | null;
  title: string | null;
  titleUpdatedAt?: string | null;
  originalName: string;
  description: string | null;
  canManage?: boolean;
  createdAt: string;
  // Per-ember privacy / sharing flags. Surfaced by the wiki's Control
  // group as inline toggles — flipping either calls PATCH /api/images
  // immediately and the parent refreshes detail.
  shareToNetwork?: boolean;
  keepPrivate?: boolean;
  snapshot?: {
    script: string;
  } | null;
  owner?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    avatarFilename?: string | null;
    createdAt?: string | null;
  } | null;
  analysis: {
    status?: string;
    summary: string | null;
    visualDescription?: string | null;
    metadataSummary?: string | null;
    mood?: string | null;
    activities?: string[];
    sceneInsights?: AnalysisSceneInsights;
    capturedAt: string | null;
    updatedAt?: string;
    latitude?: number | null;
    longitude?: number | null;
    confirmedLocation?: {
      label?: string;
      detail?: string | null;
      kind?: string;
      latitude?: number | null;
      longitude?: number | null;
      confirmedAt?: string | null;
    } | null;
    noContributors?: boolean | null;
    peopleObserved?: Array<unknown> | null;
  } | null;
  contributors: KipemberContributor[];
  attachments: KipemberAttachment[];
  tags?: KipemberTag[];
  voiceCallClips?: KipemberVoiceCallClip[];
  chatBlocks?: Array<{
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
  }>;
  voiceBlocks?: Array<{
    personName: string;
    avatarUrl: string | null;
    isOwner: boolean;
    personUserId?: string | null;
    personEmail?: string | null;
    personPhoneNumber?: string | null;
    personAvatarColor?: string | null;
    messages: Array<{
      role: string;
      content: string;
      audioUrl: string | null;
      createdAt: string;
    }>;
  }>;
  callBlocks?: Array<{
    personName: string;
    avatarUrl: string | null;
    personUserId?: string | null;
    personEmail?: string | null;
    personPhoneNumber?: string | null;
    personAvatarColor?: string | null;
    voiceCallId: string;
    recordingUrl: string | null;
    startedAt: string | null;
    endedAt: string | null;
    status: string;
    segments: Array<{
      index: number;
      role: string;
      speaker: string;
      content: string;
      startMs: number | null;
      endMs: number | null;
    }>;
  }>;
  guestChatBlock?: {
    // One entry per anonymous share-link visitor (keyed by the
    // kb-guest-browser cookie). Each visitor can have a chat timeline
    // and a voice timeline; either may be empty but at least one is
    // non-empty for the visitor to land here.
    visitors: Array<{
      visitorId: string;
      firstMessageAt: string;
      chatMessages: Array<{
        role: string;
        content: string;
        source: string;
        imageFilename?: string | null;
        audioUrl?: string | null;
        createdAt: string;
      }>;
      voiceMessages: Array<{
        role: string;
        content: string;
        audioUrl: string | null;
        createdAt: string;
      }>;
    }>;
    sessionCount: number;
  } | null;
};

type ReconciliationClaim = {
  id: string;
  claimType: string;
  subject: string;
  value: string;
  normalizedValue: string;
  rawText: string | null;
  confidence: number | null;
  evidenceKind: string;
  resolutionMode: string;
  status: string;
  questionType: string | null;
  source: string;
  contributorId: string | null;
  userId: string | null;
  metadata: unknown;
  createdAt: string;
};

type ReconciliationConflict = {
  id: string;
  claimType: string;
  subject: string;
  summary: string;
  status: string;
  resolutionMode: string;
  resolutionValue: string | null;
  resolutionNote: string | null;
  outreachQuestion: string | null;
  confidence: number | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  claims: Array<{
    stance: string;
    claim: ReconciliationClaim;
  }>;
};

type ReconciliationResponse = {
  claims: ReconciliationClaim[];
  conflicts: ReconciliationConflict[];
};

type ReconciliationRefreshResponse = {
  processedMessages: number;
  claimsCreated: number;
  conflictsCreated: number;
  openConflictCount: number;
};

function formatLongDate(value: string | null | undefined) {
  if (!value) {
    return 'Unknown';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// Identity bundle a single resolver hands back to every avatar surface.
// One person → one record, regardless of where they're being rendered.
// userId / email / phoneNumber drive the pool-stable color via
// pastelForContributorIdentity; avatarUrl wins over color when present.
type PersonIdentity = {
  userId: string | null;
  email: string | null;
  phoneNumber: string | null;
  id: string | null;
  avatarColor?: string | null;
  avatarUrl: string | null;
  // Owner gets a dedicated orange swatch so their avatar stays consistent
  // with the AppHeader, /account, and the wiki Owner card. Without this
  // flag the owner falls into the pool-key pastel and breaks the visual
  // continuity their other surfaces establish.
  isOwner?: boolean;
};

// Single source for the owner's bubble color. Matches AppHeader and the
// Account avatar so the owner reads as the same person on every surface.
const OWNER_AVATAR_BG = 'rgba(249,115,22,0.6)';

// Pastels are pale enough that dark text reads cleanly. The owner's
// orange tint is dark enough that white text reads better — same
// treatment AppHeader and the /account avatar use.
function avatarStylesForPerson(person: PersonIdentity | null, fallbackName: string) {
  if (person?.isOwner) return { background: OWNER_AVATAR_BG, color: '#ffffff' };
  if (person) return { background: person.avatarColor ?? pastelForContributorIdentity(person), color: '#1f2937' };
  return { background: pastelForContributor(fallbackName), color: '#1f2937' };
}

// Backwards-compat alias for sites that only need the bg.
function colorForPerson(person: PersonIdentity | null, fallbackName: string) {
  return avatarStylesForPerson(person, fallbackName).background;
}

function relativeAt(value: string) {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const m = Math.round(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d`;
  return `${Math.round(d / 7)}w`;
}

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

// Single resolver passed to every avatar surface. Returns the full
// identity bundle (or null if we don't recognize the name). Callers use
// person.avatarUrl when present, otherwise pastelForContributorIdentity
// for the color so the same person always lands on the same swatch.
type FindPerson = (name: string) => PersonIdentity | null;
// Backwards-compat alias for older call sites that only need the URL.
type FindAvatar = (name: string) => string | null;

type TrackerStepConfig = {
  slug: string;
  ownerRequired: boolean;
  contributorMin: number | null;
};

// Pulls the current admin tracker config (which slugs are enabled +
// completion rule per step). Returns null while loading — caller treats
// as "show all enabled steps with default rules" until we know better.
function useTrackerConfig() {
  const [config, setConfig] = useState<TrackerStepConfig[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/progress-tracker', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { steps?: TrackerStepConfig[] } | null) => {
        if (cancelled) return;
        if (data?.steps) {
          setConfig(data.steps);
        }
      })
      .catch(() => {
        // Silently keep null — wiki falls back to showing all steps.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return config;
}

function useReconciliationClaims(imageId: string | null | undefined) {
  const [claims, setClaims] = useState<ReconciliationClaim[] | null>(null);

  useEffect(() => {
    if (!imageId) {
      setClaims(null);
      return;
    }

    let cancelled = false;
    fetch(`/api/images/${imageId}/reconciliation`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: ReconciliationResponse | null) => {
        if (cancelled) return;
        setClaims(data?.claims ?? []);
      })
      .catch(() => {
        if (!cancelled) setClaims([]);
      });

    return () => {
      cancelled = true;
    };
  }, [imageId]);

  return claims;
}

function claimSourceLabelFromMetadata(metadata: unknown): string {
  if (!metadata || typeof metadata !== 'object') return 'Someone';
  const label = (metadata as Record<string, unknown>).sourceLabel;
  return typeof label === 'string' && label.trim() ? label.trim() : 'Someone';
}

function VoiceBlockCard({
  block,
}: {
  block: NonNullable<KipemberWikiDetail['voiceBlocks']>[number];
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
          style={{ width: 29, height: 29, background: '#22c55e' }}
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
          color="rgba(255,255,255,0.5)"
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
        </div>
      ) : null}
    </WikiCard>
  );
}

function WhyCard({
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

function EmotionalStateCard({
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

function ExtraStoriesCard({
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

function PlacesMentionedCard({
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

// People mentioned by contributors but not necessarily tagged on the photo —
// surfaced from MemoryClaim rows of type "person" produced by the
// housekeeping.person_extraction extractor. Unlike the other claim cards,
// the headline here is the SUBJECT (the mentioned person), with the
// speaker shown as attribution underneath — because for person claims the
// subject IS the point of the row.
function PeopleMentionedCard({
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

function AvatarCircle({
  name,
  avatarUrl,
  size = 29,
  bgColor,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: number;
  bgColor?: string;
}) {
  // No explicit color → deterministic pastel keyed on the person's name so
  // their bubble looks the same everywhere (chat blocks, claim rows, tag
  // chips, etc.). Initials read in white when the bg matches the orange
  // owner swatch and in dark grey on the lighter pastel palette.
  const fallbackBg = bgColor ?? pastelForContributor(name);
  const initialsColor = fallbackBg === OWNER_AVATAR_BG ? '#ffffff' : '#1f2937';
  return avatarUrl ? (
    <img
      src={avatarUrl}
      alt={name}
      className="rounded-full object-cover flex-shrink-0"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className="rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0"
      style={{ width: size, height: size, background: fallbackBg, color: initialsColor }}
    >
      {initials(name)}
    </div>
  );
}

function formatLocationLine(
  label: string | null | undefined,
  detail: string | null | undefined
) {
  const parts = [label, detail]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean);

  return parts.length > 0 ? parts.join(', ') : null;
}

function joinDistinct(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (!trimmed) {
      continue;
    }

    const normalized = trimmed.toLowerCase();
    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(trimmed);
  }

  return result;
}

function formatAnalysisList(values: string[] | undefined) {
  const items = joinDistinct(values || []);
  return items.length > 0 ? items.join(', ') : null;
}

function formatAnalysisFooterDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function appendAnalysisLine(
  lines: string[],
  label: string,
  value: string | null | undefined
) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (trimmed) {
    lines.push(`- **${label}:** ${trimmed}`);
  }
}

function buildStructuredAnalysisText(
  analysis: KipemberWikiDetail['analysis']
) {
  const sceneInsights = analysis?.sceneInsights;
  const people = sceneInsights?.peopleAndDemographics;
  const setting = sceneInsights?.settingAndEnvironment;
  const activities = sceneInsights?.activitiesAndContext;
  const emotional = sceneInsights?.emotionalContext;

  const numberOfPeople =
    typeof people?.numberOfPeopleVisible === 'number'
      ? `${people.numberOfPeopleVisible}`
      : null;
  const ageRanges = formatAnalysisList(people?.estimatedAgeRanges);
  const visibleActivities = formatAnalysisList(activities?.visibleActivities);
  const relationships = joinDistinct([
    people?.relationshipInference,
    people?.spatialRelationships,
  ]).join('. ');
  const background = joinDistinct([
    setting?.backgroundDetails,
    setting?.architectureOrLandscape,
  ]).join('. ');
  const overallMood = joinDistinct([
    emotional?.overallMoodAndAtmosphere,
    analysis?.mood,
  ]).join('. ');
  const socialDynamics = joinDistinct([
    activities?.socialDynamics,
    activities?.interactionsBetweenPeople,
    emotional?.socialEnergy,
  ]).join('. ');
  const summary = analysis?.summary || null;

  const hasStructuredContent = Boolean(
    numberOfPeople ||
      ageRanges ||
      people?.genderPresentation ||
      people?.clothingAndStyle ||
      people?.bodyLanguageAndExpressions ||
      relationships ||
      setting?.locationType ||
      setting?.timeOfDayAndLighting ||
      background ||
      activities?.whatAppearsToBeHappening ||
      activities?.eventType ||
      visibleActivities ||
      overallMood ||
      emotional?.emotionalExpressions ||
      socialDynamics ||
      summary
  );

  if (!hasStructuredContent) {
    return [
      analysis?.summary,
      analysis?.visualDescription,
      analysis?.metadataSummary,
    ]
      .filter((value): value is string => Boolean(value && value.trim()))
      .join('\n\n');
  }

  const sections: string[] = [];

  const peopleLines: string[] = [];
  appendAnalysisLine(peopleLines, 'Number of People', numberOfPeople);
  appendAnalysisLine(peopleLines, 'Estimated Age Ranges', ageRanges);
  appendAnalysisLine(peopleLines, 'Gender', people?.genderPresentation);
  appendAnalysisLine(peopleLines, 'Clothing', people?.clothingAndStyle);
  appendAnalysisLine(peopleLines, 'Body Language', people?.bodyLanguageAndExpressions);
  appendAnalysisLine(peopleLines, 'Relationships', relationships);
  if (peopleLines.length > 0) {
    sections.push('**PEOPLE:**');
    sections.push(...peopleLines);
  }

  const settingLines: string[] = [];
  appendAnalysisLine(
    settingLines,
    'Location Type',
    setting?.locationType || setting?.environmentType
  );
  appendAnalysisLine(
    settingLines,
    'Time of Day',
    setting?.timeOfDayAndLighting || setting?.lightingDescription
  );
  appendAnalysisLine(settingLines, 'Background', background);
  if (settingLines.length > 0) {
    sections.push('');
    sections.push('**SETTING & ENVIRONMENT:**');
    sections.push(...settingLines);
  }

  const activityLines: string[] = [];
  appendAnalysisLine(
    activityLines,
    "What's Happening",
    activities?.whatAppearsToBeHappening || visibleActivities
  );
  appendAnalysisLine(activityLines, 'Event Type', activities?.eventType);
  if (activityLines.length > 0) {
    sections.push('');
    sections.push('**ACTIVITIES & CONTEXT:**');
    sections.push(...activityLines);
  }

  const emotionalLines: string[] = [];
  appendAnalysisLine(emotionalLines, 'Overall Mood', overallMood);
  appendAnalysisLine(
    emotionalLines,
    'Emotional Expressions',
    emotional?.emotionalExpressions || emotional?.individualEmotions
  );
  appendAnalysisLine(emotionalLines, 'Social Dynamics', socialDynamics);
  if (emotionalLines.length > 0) {
    sections.push('');
    sections.push('**EMOTIONAL CONTEXT:**');
    sections.push(...emotionalLines);
  }

  const summaryLines: string[] = [];
  appendAnalysisLine(summaryLines, 'Summary', summary);
  if (summaryLines.length > 0) {
    sections.push('');
    sections.push('**SUMMARY:**');
    sections.push(...summaryLines);
  }

  return sections.join('\n');
}

// Per-block collapsible card for the Image Analysis section. Header shows
// the thumbnail + filename and toggles open/closed independently of the
// parent section; body is rendered only when expanded. Each block keeps
// its own state so users can inspect one photo at a time.
function CollapsibleAnalysisCard({
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
          color="rgba(255,255,255,0.5)"
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
          style={{ background: value ? '#f97316' : 'rgba(255,255,255,0.15)' }}
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

function PrivacyToggles({
  imageId,
  shareToNetwork,
  keepPrivate,
  refreshDetail,
  onStatus,
}: {
  imageId: string | null;
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
    if (!imageId) return;
    try {
      const response = await fetch(`/api/images/${imageId}`, {
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
          style={{ color: keepPrivateValue ? '#4ade80' : '#f97316' }}
        >
          {keepPrivateValue ? 'This ember is now private' : 'This ember is now public'}
        </p>
      </div>
    </WikiCard>
  );
}

function DeleteEmberCard({
  imageId,
  canManage,
  onStatus,
}: {
  imageId: string | null;
  canManage: boolean;
  onStatus?: (message: string) => void;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function performDelete() {
    if (!imageId || !canManage || deleting) return;
    setDeleting(true);
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
          background: 'rgba(239,68,68,0.12)',
          border: '1px solid rgba(239,68,68,0.55)',
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
              background: 'rgba(239,68,68,0.85)',
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
          background: 'rgba(239,68,68,0.85)',
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

// Collapsible cluster of wiki sections. Tapping the label toggles the
// whole group, including all sections inside it. Used for the five
// bands (Identity, Curation, Observed, Conversations, Control).
function WikiGroup({
  label,
  defaultCollapsed = false,
  children,
}: {
  label: string;
  defaultCollapsed?: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  return (
    <div className="flex flex-col gap-7">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
        className="flex items-center gap-3 px-1 py-2 cursor-pointer w-full"
        style={{ background: 'transparent', border: 'none' }}
      >
        <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
        <span className="text-white/30 text-xs uppercase tracking-wider font-medium">
          {label}
        </span>
        <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
      </button>
      {collapsed ? null : children}
    </div>
  );
}

function WikiBadge({
  complete,
  label,
  tracksProgress = false,
  count,
  loading = false,
}: {
  complete: boolean;
  label?: React.ReactNode;
  // When true, the badge is one of the steps that feeds the universal
  // ember progress tracker. We render a small white check inside the pill
  // so contributors can see at a glance which sections actually move the
  // progress bar.
  tracksProgress?: boolean;
  // For non-tracker badges only. When provided, the badge renders as
  // "Collected N" with N highlighted white. count === 0 flips the pill
  // grey to make it visually obvious nothing has been gathered yet.
  count?: number;
  // When true, data is still loading — render a neutral grey pill so the
  // badge doesn't flash from "Not Complete" to "Complete" on initial load.
  loading?: boolean;
}) {
  // Six palettes:
  //   loading                                                       → grey "—"
  //   tracksProgress + complete (a tracker step done)              → green "Complete" + check
  //   tracksProgress + !complete + custom label (e.g. "Need 1 …")  → orange
  //   tracksProgress + !complete + default                         → red "Not Complete"
  //   !tracksProgress + count === 0                                → grey "Collected 0"
  //   !tracksProgress + count > 0 (or no count given)              → blue "Collected [N]"
  const hasCustomLabel = label != null;
  // Each background pre-composites the 15% alpha tint against the wiki's
  // bg-screen so the pill stays fully opaque even when the wiki overlay
  // itself is partially transparent. Visual matches the original tinted
  // pills exactly in both dark and light themes.
  const grey = { bg: 'color-mix(in srgb, var(--bg-screen) 85%, rgb(148,163,184) 15%)', fg: '#94a3b8' };
  const palette = loading
    ? grey
    : tracksProgress
    ? complete
      ? { bg: 'color-mix(in srgb, var(--bg-screen) 85%, rgb(34,197,94) 15%)', fg: '#4ade80' }
      : hasCustomLabel
        ? { bg: 'color-mix(in srgb, var(--bg-screen) 85%, rgb(249,115,22) 15%)', fg: '#f97316' }
        : { bg: 'color-mix(in srgb, var(--bg-screen) 85%, rgb(239,68,68) 15%)', fg: '#f87171' }
    : count === 0
      ? grey
      : { bg: 'color-mix(in srgb, var(--bg-screen) 85%, rgb(59,130,246) 15%)', fg: '#60a5fa' };
  const collectedDefault =
    typeof count === 'number' ? (
      <>
        Collected <span className="text-white">{count}</span>
      </>
    ) : (
      'Collected'
    );
  return (
    <span
      className="text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 inline-flex items-center gap-1"
      style={{ background: palette.bg, color: palette.fg }}
    >
      {!loading && tracksProgress && complete ? (
        <Check size={11} strokeWidth={3} color="#ffffff" aria-hidden />
      ) : null}
      {loading ? '—' : (label ?? (tracksProgress ? (complete ? 'Complete' : 'Not Complete') : collectedDefault))}
    </span>
  );
}

// Universal ember progress bar — sits above the IDENTITY group at the
// top of the wiki. One green fill driven by completed tracker steps;
// remaining steps appear as tappable chips that scrollIntoView the
// matching WikiSection by its DOM id.
function EmberProgressBar({
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
              color="rgba(255,255,255,0.5)"
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
        style={{ background: 'rgba(255,255,255,0.08)' }}
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${percent}%`,
            background: '#4ade80',
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
                background: 'color-mix(in srgb, var(--bg-screen) 85%, rgb(148,163,184) 15%)',
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

function WikiSection({
  icon,
  title,
  complete,
  badgeLabel,
  editHref,
  onEdit,
  collapsible = false,
  defaultCollapsed = false,
  hideBadge = false,
  tracksProgress = false,
  count,
  id,
  loading = false,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  complete: boolean;
  badgeLabel?: React.ReactNode;
  editHref?: string;
  // When onEdit is set, the pencil renders as a button that opens the
  // in-page edit overlay instead of navigating. Takes precedence over
  // editHref so sections can opt into the overlay one at a time.
  onEdit?: () => void;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  // Sections under the Control group don't have a meaningful "complete"
  // state — Download, Privacy, and Delete are actions, not progress
  // milestones — so they suppress the green/red/orange badge entirely.
  hideBadge?: boolean;
  // True for the badges that feed the universal ember progress tracker
  // (the 11-item checklist). Rendered with a small white check inside the
  // pill so it's visually obvious which sections move the progress bar.
  tracksProgress?: boolean;
  // For non-tracker sections: the number of collected items. Drives the
  // "Collected N" label and flips the pill grey when N === 0.
  count?: number;
  // DOM id used by the progress-bar chips to scrollIntoView. Only
  // set on tracker sections (slugs match the trackerSteps list).
  id?: string;
  // When true, badge stays grey while async data is still loading.
  loading?: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const isHidden = collapsible && collapsed;

  const headerInner = (
    <>
      <span style={{ color: 'var(--text-secondary)' }}>{icon}</span>
      <h3 className="text-white font-medium text-base">{title}</h3>
      {collapsible ? (
        <ChevronDown
          size={14}
          color="rgba(255,255,255,0.5)"
          style={{
            transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
          }}
        />
      ) : null}
    </>
  );

  return (
    <div id={id} className="flex flex-col gap-3 scroll-mt-4">
      <div className="flex items-center justify-between">
        {collapsible ? (
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-expanded={!collapsed}
            className="flex items-center gap-2 cursor-pointer"
            style={{ background: 'transparent', border: 'none', padding: 0, minHeight: 44 }}
          >
            {headerInner}
          </button>
        ) : (
          <div className="flex items-center gap-2">{headerInner}</div>
        )}
        <div className="flex items-center gap-2">
          {onEdit ? (
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Edit ${title}`}
              className="flex items-center justify-center rounded-full can-hover cursor-pointer"
              style={{
                width: 28,
                height: 28,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              <PencilLine size={13} />
            </button>
          ) : editHref ? (
            <Link
              href={editHref}
              aria-label={`Edit ${title}`}
              className="flex items-center justify-center rounded-full can-hover"
              style={{
                width: 28,
                height: 28,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              <PencilLine size={13} />
            </Link>
          ) : null}
          {hideBadge ? null : (
            <WikiBadge
              complete={complete}
              label={badgeLabel}
              tracksProgress={tracksProgress}
              count={count}
              loading={loading}
            />
          )}
        </div>
      </div>
      {isHidden ? null : children}
    </div>
  );
}

function WikiCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl px-4 py-3.5 flex flex-col gap-1"
      style={{
        // Pre-composite the translucent --bg-surface against --bg-screen
        // so the card stays fully opaque even when the wiki overlay's
        // own background is partially transparent. Matches the visual
        // of the original translucent surface in either theme.
        background: 'color-mix(in srgb, var(--bg-screen), var(--text-primary) 7%)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {children}
    </div>
  );
}

// Place card with a collapse toggle. Collapsed (default) shows just the
// place name; expanded shows exact address, coordinates, and source.
function PlaceCard({
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
  const [collapsed, setCollapsed] = useState(true);
  const inner = (
    <>
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
        className="w-full flex items-center gap-2 cursor-pointer"
        style={{ background: 'transparent', border: 'none', padding: 0, minHeight: 36 }}
      >
        <div className="flex-1 text-left">
          <p className="text-white/30 text-xs font-medium mb-1.5">Place</p>
          <p className="text-white font-medium text-sm">
            {placeName || 'No location data available.'}
          </p>
        </div>
        <ChevronDown
          size={14}
          color="rgba(255,255,255,0.5)"
          style={{
            transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
          }}
        />
      </button>
      {!collapsed ? (
        <>
          {placeConfirmedAt ? (
            <p className="text-white/30 text-xs mt-1">
              (edited on {new Date(placeConfirmedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })})
            </p>
          ) : null}
          {showExactAddress ? (
            <>
              <p className="text-white/30 text-xs font-medium mt-3 mb-1.5">Exact Address</p>
              {addressLines.map((line, index) => (
                <p key={index} className="text-white/70 text-sm">
                  {line}
                </p>
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
      ) : null}
    </>
  );
  return bare ? inner : <WikiCard>{inner}</WikiCard>;
}

type ChatBlock = {
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

// Story Circle entries default to collapsed so the wiki opens compact.
// Click the header row to expand and read the messages.
function CollapsibleChatBlock({ block }: { block: ChatBlock }) {
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
          style={{ width: 29, height: 29, background: '#2563eb' }}
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
          color="rgba(255,255,255,0.5)"
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
        </div>
      ) : null}
    </WikiCard>
  );
}

type GuestChatBlock = NonNullable<KipemberWikiDetail['guestChatBlock']>;
type GuestVisitor = GuestChatBlock['visitors'][number];

// One collapsible chat card per anonymous share-link visitor.
// Anonymous browsers can't be told apart by name, so we label them
// ordinally ("Visitor 1", "Visitor 2", …) with the first-message date
// as a subtitle. Grey avatar + chat-bubble icon distinguishes these
// cards from the named contributor chat blocks in Story Circle.
function CollapsibleGuestVisitorChatBlock({
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
          style={{ width: 29, height: 29, background: '#6b7280' }}
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
          color="rgba(255,255,255,0.5)"
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

// Voice counterpart to CollapsibleGuestVisitorChatBlock. Mirrors the
// VoiceBlockCard pattern in Story Circle (collapsible card, audio
// playback list when expanded), but uses the same grey #6b7280 avatar
// as the chat card with a Mic icon swap so guest voice stays visually
// grouped with guest chat instead of with the green-mic owner/contributor
// voice cards.
function CollapsibleGuestVisitorVoiceBlock({
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
          style={{ width: 29, height: 29, background: '#6b7280' }}
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
          color="rgba(255,255,255,0.5)"
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

function getSourceName(claim: ReconciliationClaim) {
  const metadata = claim.metadata;
  if (
    metadata &&
    typeof metadata === 'object' &&
    'sourceLabel' in metadata &&
    typeof metadata.sourceLabel === 'string' &&
    metadata.sourceLabel.trim()
  ) {
    return metadata.sourceLabel.trim();
  }

  return 'Contributor';
}

function formatClaimType(value: string) {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}

function formatConfidence(value: number | null) {
  if (typeof value !== 'number') {
    return null;
  }

  return `${Math.round(value * 100)}% confidence`;
}

function ReconciliationPill({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'warn' | 'good';
}) {
  const stylesByTone = {
    neutral: {
      background: 'rgba(255,255,255,0.08)',
      color: 'rgba(255,255,255,0.55)',
      border: '1px solid rgba(255,255,255,0.08)',
    },
    warn: {
      background: 'rgba(249,115,22,0.13)',
      color: 'rgba(253,186,116,0.95)',
      border: '1px solid rgba(249,115,22,0.28)',
    },
    good: {
      background: 'rgba(34,197,94,0.13)',
      color: 'rgba(134,239,172,0.95)',
      border: '1px solid rgba(34,197,94,0.28)',
    },
  } as const;

  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em]"
      style={stylesByTone[tone]}
    >
      {children}
    </span>
  );
}

async function fetchReconciliationState(imageId: string, signal?: AbortSignal): Promise<ReconciliationResponse> {
  const response = await fetch(`/api/images/${imageId}/reconciliation`, {
    signal,
  });

  if (!response.ok) {
    throw new Error('Failed to load reconciliation state');
  }

  const payload = (await response.json()) as ReconciliationResponse;
  return {
    claims: Array.isArray(payload.claims) ? payload.claims : [],
    conflicts: Array.isArray(payload.conflicts) ? payload.conflicts : [],
  };
}


const TAG_COLORS = ['#f97316', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#ef4444'];

export default function KipemberWikiContent({
  detail,
  refreshDetail,
  onStatus,
}: {
  detail: KipemberWikiDetail | null;
  // Optional callbacks the wiki uses for the inline Privacy and Delete
  // controls in the Control group. When omitted (e.g. read-only render
  // surfaces) those interactions silently no-op.
  refreshDetail?: () => Promise<unknown> | unknown;
  onStatus?: (message: string) => void;
}) {
  const placeResolution = usePlaceResolution(detail);
  const contributors = detail?.contributors || [];
  const imageId = detail?.id || null;
  const ownerName = getUserDisplayName(detail?.owner) || detail?.owner?.email || null;
  const ownerUserId = detail?.owner?.id;
  // In-page edit overlay state — keeps the wiki (and the ember view
  // beneath it) mounted while the user edits a single field. Closing
  // the overlay returns to the wiki with scroll, expanded sections,
  // and progress-bar config all preserved.
  type EditingSlug = 'title' | 'snapshot' | 'time-place' | 'contributors' | 'tag-people' | null;
  const [editingSlug, setEditingSlug] = useState<EditingSlug>(null);
  // Visual open state — drives a CSS transition on `transform` so the
  // overlay slides in from the right on open and back out to the right
  // on close. Decoupled from `editingSlug` so we can run the slide-out
  // animation BEFORE unmounting (300ms delay matches the transition).
  const [overlayOpen, setOverlayOpen] = useState(false);
  useEffect(() => {
    if (!editingSlug) return;
    // Mount happened with overlayOpen=false → transform: translateX(100%).
    // Kick the transition on the next animation frame so the browser
    // commits the off-screen state before transitioning to onscreen.
    const id = requestAnimationFrame(() => setOverlayOpen(true));
    return () => cancelAnimationFrame(id);
  }, [editingSlug]);
  const closeEditOverlay = useCallback(() => {
    setOverlayOpen(false);
    setTimeout(() => {
      setEditingSlug(null);
      // Always pull fresh detail on close — covers Tag People (which
      // mutates tags via its own fetches without a refresh callback)
      // and any other slider that saved data while open. Title /
      // Snapshot / etc. also call refreshDetail directly on save, but
      // a duplicate refresh here is cheap and guarantees the badges
      // and progress bar reflect the latest state.
      void refreshDetail?.();
    }, 300);
  }, [refreshDetail]);

  // Single source of truth: name → person identity bundle. Every avatar
  // surface in the wiki resolves through this so the same contributor
  // gets the same avatar URL (when they have one) and the same pool-key
  // pastel color (when they don't), no matter which card renders them.
  const personLookup = useMemo(() => {
    const map = new Map<string, PersonIdentity>();
    const add = (name: string | null | undefined, identity: PersonIdentity) => {
      const key = name?.trim().toLowerCase();
      if (!key) return;
      if (!map.has(key)) map.set(key, identity);
    };
    // Map both the full name and the first name to the same identity so
    // surfaces like Story Circle (which addresses "Amado") and the
    // contributors row (which uses "Amado Batour") land on the same
    // pastel + avatar URL.
    const addAllNameForms = (name: string | null | undefined, identity: PersonIdentity) => {
      const trimmed = name?.trim();
      if (!trimmed) return;
      add(trimmed, identity);
      const firstName = trimmed.split(/\s+/)[0];
      if (firstName && firstName.toLowerCase() !== trimmed.toLowerCase()) {
        add(firstName, identity);
      }
    };

    if (detail?.owner) {
      const name = getUserDisplayName(detail.owner) || detail.owner.email;
      const identity: PersonIdentity = {
        userId: detail.owner.id ?? null,
        email: detail.owner.email ?? null,
        phoneNumber: null,
        id: detail.owner.id ?? null,
        avatarUrl: detail.owner.avatarFilename
          ? `/api/uploads/${detail.owner.avatarFilename}`
          : null,
        isOwner: true,
      };
      addAllNameForms(name, identity);
      // Claims sometimes attribute to the literal label "Owner".
      add('Owner', identity);
    }
    for (const contributor of detail?.contributors ?? []) {
      const name = getUserDisplayName(contributor.user) || contributor.name;
      const identity: PersonIdentity = {
        userId: contributor.user?.id ?? contributor.userId ?? null,
        email: contributor.email ?? contributor.user?.email ?? null,
        phoneNumber: contributor.phoneNumber ?? contributor.user?.phoneNumber ?? null,
        id: contributor.id ?? null,
        avatarColor: contributor.avatarColor ?? null,
        avatarUrl: contributor.user?.avatarFilename
          ? `/api/uploads/${contributor.user.avatarFilename}`
          : null,
      };
      addAllNameForms(name, identity);
    }
    for (const tag of detail?.tags ?? []) {
      // Map the tag's *creator* to their own identity (e.g. "Amado" → Amado).
      // Don't map the tag *label* — that would paint the tagged person with
      // the creator's photo. If the tagged person is a contributor with an
      // account, they're already in the lookup; otherwise findPerson returns
      // null and downstream callers fall back to a name-hashed pastel.
      const creator = tag.createdBy;
      if (creator) {
        const creatorName = getUserDisplayName(creator);
        addAllNameForms(creatorName, {
          userId: creator.id ?? null,
          email: creator.email ?? null,
          phoneNumber: null,
          id: creator.id ?? null,
          avatarUrl: creator.avatarUrl ?? null,
        });
      }
    }
    return map;
  }, [detail]);

  const findPerson = useCallback<FindPerson>(
    (name: string) => personLookup.get(name.trim().toLowerCase()) ?? null,
    [personLookup]
  );
  // Kept for surfaces that only consume the avatar URL (legacy call sites).
  // Prefer findPerson everywhere going forward.
  const findAvatar = useCallback<FindAvatar>(
    (name: string) => findPerson(name)?.avatarUrl ?? null,
    [findPerson]
  );

  const wikiClaims = useReconciliationClaims(imageId);
  // null = still fetching; used to keep tracker badges grey until resolved
  const wikiClaimsLoading = wikiClaims === null;
  const whyClaims = useMemo(
    () => (wikiClaims ? wikiClaims.filter((c) => c.claimType === 'why') : null),
    [wikiClaims]
  );
  const emotionClaims = useMemo(
    () => (wikiClaims ? wikiClaims.filter((c) => c.claimType === 'emotion') : null),
    [wikiClaims]
  );
  const extraStoryClaims = useMemo(
    () => (wikiClaims ? wikiClaims.filter((c) => c.claimType === 'extra_story') : null),
    [wikiClaims]
  );
  const placeClaims = useMemo(
    () => (wikiClaims ? wikiClaims.filter((c) => c.claimType === 'place') : null),
    [wikiClaims]
  );
  const personClaims = useMemo(
    () => (wikiClaims ? wikiClaims.filter((c) => c.claimType === 'person') : null),
    [wikiClaims]
  );
  const activeContributors = contributors.filter((contributor) => (contributor.userId || contributor.user) && contributor.userId !== ownerUserId && contributor.user?.id !== ownerUserId);
  // A real pending contributor has at least one identifier (name / email /
  // phoneNumber). Rows with all identity fields null are share-link
  // placeholders that anchor the share token — never surface them.
  const pendingContributors = contributors.filter((contributor) =>
    !contributor.userId &&
    !contributor.user &&
    Boolean(contributor.name || contributor.email || contributor.phoneNumber)
  );
  // Story Circle completion now requires BOTH owner and contributor user
  // messages — a complete story circle is one where the memory has been
  // narrated AND a contributor has weighed in. Auto-welcome assistant
  // messages are excluded since they don't reflect real engagement.
  const ownerUserMessages = (detail?.chatBlocks || []).reduce(
    (sum, block) =>
      sum + (block.isOwner ? block.messages.filter((m) => m.role === 'user').length : 0),
    0
  );
  const contributorUserMessages = (detail?.chatBlocks || []).reduce(
    (sum, block) =>
      sum + (block.isOwner ? 0 : block.messages.filter((m) => m.role === 'user').length),
    0
  );
  const totalStoryMessages = ownerUserMessages + contributorUserMessages;
  // Split why/emotion claims by attribution. Owner-sourced = userId matches
  // the ember owner. Contributor-sourced = any claim with a different userId
  // (logged-in contributor) or an emberContributorId. Guests have neither.
  const ownerWhyClaims = (whyClaims || []).filter(
    (c) => c.userId !== null && c.userId === ownerUserId
  );
  const contributorWhyClaims = (whyClaims || []).filter(
    (c) =>
      (c.userId !== null && c.userId !== ownerUserId) || c.contributorId !== null
  );
  const ownerEmotionClaims = (emotionClaims || []).filter(
    (c) => c.userId !== null && c.userId === ownerUserId
  );
  const contributorEmotionClaims = (emotionClaims || []).filter(
    (c) =>
      (c.userId !== null && c.userId !== ownerUserId) || c.contributorId !== null
  );
  // storyCircleComplete / whyComplete / emotionComplete are computed later
  // from the rule evaluator (uses admin-configurable thresholds).
  const isAudioAttachment = (attachment: KipemberAttachment) =>
    attachment.mediaType === 'AUDIO' ||
    isAudioLikeFilename(attachment.filename) ||
    isAudioLikeFilename(attachment.originalName);
  const visualAttachments = (detail?.attachments || []).filter(
    (attachment) => !isAudioAttachment(attachment)
  );
  const {
    placeName,
    addressLines,
    showExactAddress,
    coordinateLine,
    country: placeCountry,
    source: placeSource,
    confirmedAt: placeConfirmedAt,
    isLoading: locationLookupPending,
  } = placeResolution;

  // People-tagged check (lifted out of its render-time IIFE so the
  // progress tracker can read it).
  // Use peopleObserved (the same source as TagPeopleSlider) so the wiki
  // and the slider agree on how many people need tagging.
  const detectedPeopleCount = detail?.analysis?.peopleObserved?.length ?? null;
  const taggedPeopleCount = detail?.tags?.length ?? 0;
  const peopleComplete = taggedPeopleCount > 0;

  // Admin tracker config (which slugs are enabled + completion rule
  // per step). While loading, we fall back to "everything enabled with
  // default rules" so the bar doesn't briefly hide steps.
  const trackerConfig = useTrackerConfig();

  // Multi-party engagement: build a stable identity key for every
  // contributor on the ember (invited) and for every contributor that
  // has actually contributed messages / claims (engaged). The "All
  // invited" rule needs both to compute "X of Y".
  const makeIdentityKey = (input: {
    userId?: string | null;
    email?: string | null;
    phoneNumber?: string | null;
    name?: string | null;
  }): string | null => {
    if (input.userId) return `u:${input.userId}`;
    if (input.email) return `e:${input.email.trim().toLowerCase()}`;
    if (input.phoneNumber) return `p:${input.phoneNumber}`;
    if (input.name) return `n:${input.name.trim().toLowerCase()}`;
    return null;
  };

  const invitedContributorKeys = new Set<string>();
  const invitedKeyByContributorId = new Map<string, string>();
  for (const c of [...activeContributors, ...pendingContributors]) {
    const key = makeIdentityKey({
      userId: c.user?.id ?? c.userId ?? null,
      email: c.user?.email ?? c.email ?? null,
      phoneNumber: c.phoneNumber ?? null,
      name: c.name ?? null,
    });
    if (key) {
      invitedContributorKeys.add(key);
      invitedKeyByContributorId.set(c.id, key);
    }
  }

  const storyCircleEngagedKeys = new Set<string>();
  for (const block of detail?.chatBlocks ?? []) {
    if (block.isOwner) continue;
    if (!block.messages.some((m) => m.role === 'user')) continue;
    const key = makeIdentityKey({
      userId: block.personUserId ?? null,
      email: block.personEmail ?? null,
      phoneNumber: block.personPhoneNumber ?? null,
      name: block.personName ?? null,
    });
    if (key) storyCircleEngagedKeys.add(key);
  }

  const claimContributorKey = (claim: ReconciliationClaim): string | null => {
    if (claim.userId && claim.userId !== ownerUserId) return `u:${claim.userId}`;
    if (claim.contributorId) {
      return invitedKeyByContributorId.get(claim.contributorId) ?? `c:${claim.contributorId}`;
    }
    return null;
  };

  const whyEngagedKeys = new Set<string>();
  for (const claim of whyClaims ?? []) {
    const key = claimContributorKey(claim);
    if (key) whyEngagedKeys.add(key);
  }

  const emotionEngagedKeys = new Set<string>();
  for (const claim of emotionClaims ?? []) {
    const key = claimContributorKey(claim);
    if (key) emotionEngagedKeys.add(key);
  }

  type RuleResult = {
    complete: boolean;
    missingLabel: React.ReactNode | null; // shown on the missing chip when not complete
  };
  const evaluateMultiParty = (
    slug: string,
    ownerHas: boolean,
    engagedKeys: Set<string>
  ): RuleResult => {
    const cfg = trackerConfig?.find((s) => s.slug === slug);
    const ownerRequired = cfg?.ownerRequired ?? true;
    const contributorMin = cfg === undefined ? 1 : cfg.contributorMin; // default 1 to preserve prior behavior
    const ownerPart = !ownerRequired || ownerHas;
    const required =
      contributorMin === null ? invitedContributorKeys.size : contributorMin ?? 0;
    const haveCount = engagedKeys.size;
    const contributorPart = required === 0 ? true : haveCount >= required;
    const complete = ownerPart && contributorPart;
    let missingLabel: React.ReactNode | null = null;
    if (!complete && required > 0) {
      const denom = contributorMin === null ? 'All' : String(required);
      missingLabel = (
        <>
          <span className="text-white">{haveCount}</span>/{denom}
        </>
      );
    }
    return { complete, missingLabel };
  };

  const storyCircleResult = evaluateMultiParty(
    'story-circle',
    ownerUserMessages > 0,
    storyCircleEngagedKeys
  );
  const whyResult = evaluateMultiParty(
    'why',
    ownerWhyClaims.length > 0,
    whyEngagedKeys
  );
  const emotionResult = evaluateMultiParty(
    'emotional-states',
    ownerEmotionClaims.length > 0,
    emotionEngagedKeys
  );
  // Aliases for the wiki section badges — these consume the same rule
  // result, so the badge state matches the progress bar exactly.
  const storyCircleComplete = storyCircleResult.complete;
  const whyComplete = whyResult.complete;
  const emotionComplete = emotionResult.complete;

  // Universal ember progress tracker — the 10 steps that feed the
  // progress bar above IDENTITY. Order here is the order chips appear
  // when missing. Each `slug` matches the `id` rendered on its
  // WikiSection so chip taps can scrollIntoView.
  const allTrackerSteps: ReadonlyArray<{
    slug: string;
    label: string;
    complete: boolean;
    missingLabel?: React.ReactNode | null;
  }> = [
    {
      slug: 'contributors',
      label: 'Contributor',
      complete:
        activeContributors.length > 0 ||
        pendingContributors.length > 0 ||
        Boolean(detail?.analysis?.noContributors),
    },
    { slug: 'people', label: 'People', complete: peopleComplete },
    { slug: 'title', label: 'Title', complete: Boolean(detail?.title) },
    { slug: 'snapshot', label: 'Snapshot', complete: Boolean(detail?.snapshot?.script) },
    {
      slug: 'time-place',
      label: 'Time & Place',
      complete:
        Boolean(detail?.analysis?.capturedAt || detail?.createdAt) &&
        Boolean(placeName || addressLines.length > 0 || coordinateLine),
    },
    {
      slug: 'photos',
      label: 'Cover Photo',
      complete: Boolean(detail?.originalName || visualAttachments.length),
    },
    {
      slug: 'image-analysis',
      label: 'Image Analysis',
      complete: detail?.analysis?.status === 'ready',
    },
    {
      slug: 'story-circle',
      label: 'Story Circle',
      complete: storyCircleResult.complete,
      missingLabel: storyCircleResult.missingLabel,
    },
    {
      slug: 'why',
      label: 'Why',
      complete: whyResult.complete,
      missingLabel: whyResult.missingLabel,
    },
    {
      slug: 'emotional-states',
      label: 'Emotional States',
      complete: emotionResult.complete,
      missingLabel: emotionResult.missingLabel,
    },
  ];
  const enabledSlugs = trackerConfig ? new Set(trackerConfig.map((s) => s.slug)) : null;
  const trackerSteps = enabledSlugs
    ? allTrackerSteps.filter((step) => enabledSlugs.has(step.slug))
    : allTrackerSteps;

  // Map each editing slug to the inputs the overlay header needs
  // (icon + display label) so we can render the right edit slider
  // with the same visual chrome as the legacy /tend/[action] route.
  const editingMeta: Record<NonNullable<EditingSlug>, { label: string; icon: React.ReactNode }> = {
    title: { label: 'Edit Title', icon: <PencilLine size={22} color="var(--text-primary)" strokeWidth={1.6} /> },
    snapshot: { label: 'Edit Snapshot', icon: <ScanEye size={22} color="var(--text-primary)" strokeWidth={1.6} /> },
    'time-place': { label: 'Edit Time & Place', icon: <Clock size={22} color="var(--text-primary)" strokeWidth={1.6} /> },
    contributors: { label: 'Contributors', icon: <Users size={22} color="var(--text-primary)" strokeWidth={1.6} /> },
    'tag-people': { label: 'Tag People', icon: <Users size={22} color="var(--text-primary)" strokeWidth={1.6} /> },
  };
  const activeEditMeta = editingSlug ? editingMeta[editingSlug] : null;

  return (
    <>
    <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-7 pb-10">
      <EmberProgressBar steps={trackerSteps} />

      {/* IDENTITY — who is involved with this ember. */}
      <WikiGroup label="Identity">

      <WikiSection
        icon={<ShieldUser size={17} />}
        title="Owner"
        complete={Boolean(ownerName)}
        hideBadge
      >
        <WikiCard>
          {ownerName ? (
            <div className="flex items-center gap-3">
              <AvatarCircle
                name={ownerName}
                avatarUrl={detail?.owner?.avatarFilename ? `/api/uploads/${detail.owner.avatarFilename}` : null}
                bgColor="rgba(249,115,22,0.6)"
              />
              <span className="text-white text-sm font-medium">{ownerName}</span>
              {detail?.owner?.createdAt ? (
                <span className="ml-auto text-white/30 text-xs font-medium">
                  Member since {new Date(detail.owner.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
              ) : null}
            </div>
          ) : (
            <p className="text-white/30 text-sm">Owner data is not available.</p>
          )}
        </WikiCard>
      </WikiSection>

      <WikiSection
        icon={<Users size={17} />}
        title="Contributors"
        complete={
          activeContributors.length > 0 ||
          pendingContributors.length > 0 ||
          Boolean(detail?.analysis?.noContributors)
        }
        onEdit={detail?.id ? () => setEditingSlug('contributors') : undefined}
        tracksProgress
        loading={wikiClaimsLoading}
        id="tracker-contributors"
      >
        <WikiCard>
          {activeContributors.length === 0 && pendingContributors.length === 0 ? (
            <p className="text-white/30 text-sm">No contributors yet.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {activeContributors.map((contributor) => {
                const contributorName =
                  contributor.name ||
                  getUserDisplayName(contributor.user) ||
                  contributor.email ||
                  contributor.user?.email ||
                  contributor.phoneNumber ||
                  'Contributor';
                return (
                  <div key={contributor.id} className="flex items-center gap-3">
                    <AvatarCircle
                      name={contributorName}
                      avatarUrl={contributor.user?.avatarFilename ? `/api/uploads/${contributor.user.avatarFilename}` : null}
                      bgColor={contributor.avatarColor ?? pastelForContributorIdentity({
                        userId: contributor.user?.id ?? contributor.userId ?? null,
                        email: contributor.email ?? contributor.user?.email ?? null,
                        phoneNumber: contributor.phoneNumber ?? contributor.user?.phoneNumber ?? null,
                        id: contributor.id,
                      })}
                    />
                    <span className="text-white text-sm font-medium">{contributorName}</span>
                    <span className="ml-auto text-white/30 text-xs">Viewer</span>
                  </div>
                );
              })}
              {pendingContributors.map((contributor) => (
                <div key={contributor.id} className="flex items-center gap-3">
                  <AvatarCircle
                    name={contributor.name || contributor.email || contributor.phoneNumber || '?'}
                    bgColor={contributor.avatarColor ?? pastelForContributorIdentity({
                      userId: contributor.userId ?? null,
                      email: contributor.email ?? null,
                      phoneNumber: contributor.phoneNumber ?? null,
                      id: contributor.id,
                    })}
                  />
                  <span className="text-white/60 text-sm">{contributor.name || contributor.email || contributor.phoneNumber || 'Pending'}</span>
                  <span className="ml-auto text-white/30 text-xs">Invited</span>
                </div>
              ))}
            </div>
          )}
        </WikiCard>
      </WikiSection>

      {(() => {
        const detected = detectedPeopleCount;
        const remaining = detected !== null ? detected - taggedPeopleCount : 0;
        const peopleBadgeLabel: React.ReactNode =
          detected === null
            ? 'Not Complete'
            : peopleComplete
              ? 'Complete'
              : (
                  <>
                    Need to tag <span className="text-white">{remaining}</span>{' '}
                    {remaining === 1 ? 'Person' : 'People'}
                  </>
                );
        return (
          <WikiSection
            icon={<Users size={17} />}
            title="People"
            complete={peopleComplete}
            badgeLabel={peopleBadgeLabel}
            onEdit={detail?.id ? () => setEditingSlug('tag-people') : undefined}
            tracksProgress
            loading={wikiClaimsLoading}
            id="tracker-people"
          >
        <WikiCard>
          {detail?.tags && detail.tags.length > 0 ? (
            <div className="flex flex-col gap-2">
              {detail.tags.map((tag, i) => (
                <div key={tag.id} className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: TAG_COLORS[i % TAG_COLORS.length] }}
                  />
                  <p className="text-white text-sm">{tag.label}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-white/30 text-sm">No people tagged yet.</p>
          )}
        </WikiCard>
          </WikiSection>
        );
      })()}

      </WikiGroup>

      {/* CURATION — what the owner authored or curated. */}
      <WikiGroup label="Curation">

      <WikiSection
        icon={<FileText size={17} />}
        title="Title"
        complete={Boolean(detail?.title)}
        onEdit={detail?.id ? () => setEditingSlug('title') : undefined}
        tracksProgress
        loading={wikiClaimsLoading}
        id="tracker-title"
      >
        <WikiCard>
          <p className="text-white font-medium text-base">
            {detail?.title || detail?.originalName || 'Untitled Ember'}
          </p>
          <p className="text-white/30 text-xs">
            Source: {detail?.title ? 'Manual entry' : 'Original upload'}
          </p>
        </WikiCard>
      </WikiSection>

      <WikiSection
        icon={<ScanEye size={17} />}
        title="Snapshot"
        complete={Boolean(detail?.snapshot?.script)}
        onEdit={detail?.id ? () => setEditingSlug('snapshot') : undefined}
        tracksProgress
        loading={wikiClaimsLoading}
        id="tracker-snapshot"
      >
        <WikiCard>
          {detail?.snapshot?.script ? (
            <>
              <p className="text-white/90 text-sm leading-relaxed">{detail.snapshot.script}</p>
              <p className="text-white/30 text-xs">Source: AI generated</p>
            </>
          ) : (
            <p className="text-white/30 text-sm">No snapshot yet.</p>
          )}
        </WikiCard>
      </WikiSection>

      </WikiGroup>

      {/* OBSERVED — what the camera, EXIF, GPS, and image-analysis AI saw. */}
      <WikiGroup label="Observed">

      {/* Time & Place — merged section mirroring the Edit Time & Place
          slider. Photo Time on top, then a divider, then the
          collapsible place block, all inside a single WikiCard. */}
      <WikiSection
        icon={<Clock size={17} />}
        title="Time & Place"
        complete={
          Boolean(detail?.analysis?.capturedAt || detail?.createdAt) &&
          Boolean(placeName || addressLines.length > 0 || coordinateLine)
        }
        onEdit={detail?.id ? () => setEditingSlug('time-place') : undefined}
        tracksProgress
        loading={wikiClaimsLoading}
        id="tracker-time-place"
      >
        <WikiCard>
          <p className="text-white font-medium text-sm">
            {formatLongDate(detail?.analysis?.capturedAt || detail?.createdAt)}
          </p>
          <p className="text-white/30 text-xs">
            Source: {detail?.analysis?.capturedAt ? 'Photo EXIF metadata' : 'Upload timestamp'}
          </p>
          <div className="my-3 h-px" style={{ background: 'var(--border-subtle)' }} />
          <PlaceCard
            placeName={placeName}
            placeConfirmedAt={placeConfirmedAt}
            showExactAddress={showExactAddress}
            addressLines={addressLines}
            placeCountry={placeCountry}
            coordinateLine={coordinateLine}
            locationLookupPending={locationLookupPending}
            placeSource={placeSource}
            bare
          />
        </WikiCard>
      </WikiSection>

      <WikiSection
        icon={<ImageIcon size={17} />}
        title="Photos"
        complete={Boolean(detail?.originalName || visualAttachments.length)}
        tracksProgress
        loading={wikiClaimsLoading}
        id="tracker-photos"
      >
        <WikiCard>
          <p className="text-white/30 text-xs font-medium mb-2">Ember Cover Photo</p>
          <div className="flex items-start gap-3">
            <div
              className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0"
              style={{ background: 'var(--bg-ember-bubble)', border: '1px solid var(--border-ember)' }}
            >
              {detail ? (
                <MediaPreview
                  mediaType={detail.mediaType}
                  filename={detail.filename}
                  posterFilename={detail.posterFilename}
                  originalName={detail.originalName}
                  usePosterForVideo
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
              <p className="text-white text-sm font-medium break-words">
                {detail?.originalName || 'Main media'}
              </p>
              <p className="text-white/30 text-xs">
                Added: {formatLongDate(detail?.createdAt)}
              </p>
            </div>
          </div>
        </WikiCard>

        {visualAttachments.length > 0 ? (
          <WikiCard>
            <p className="text-white/30 text-xs font-medium mb-2">Supporting Media</p>
            <div className="flex flex-col gap-3">
              {visualAttachments.map((attachment) => (
                <div key={attachment.id} className="flex items-start gap-3">
                  <div
                    className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0"
                    style={{ background: 'var(--bg-ember-bubble)', border: '1px solid var(--border-ember)' }}
                  >
                    <MediaPreview
                      mediaType={attachment.mediaType}
                      filename={attachment.filename}
                      posterFilename={attachment.posterFilename}
                      originalName={attachment.originalName}
                      usePosterForVideo
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <p className="text-white text-sm font-medium break-words">
                      {attachment.originalName}
                    </p>
                    <p className="text-white/30 text-xs">
                      Added: {formatLongDate(attachment.createdAt)}
                    </p>
                    {attachment.description ? (
                      <p className="text-white/30 text-xs break-words">
                        {attachment.description}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </WikiCard>
        ) : null}
      </WikiSection>

      <WikiSection
        icon={<Sparkles size={17} />}
        title="Image Analysis"
        complete={detail?.analysis?.status === 'ready'}
        tracksProgress
        loading={wikiClaimsLoading}
        id="tracker-image-analysis"
      >
        {detail ? (
          <CollapsibleAnalysisCard
            thumbnail={
              <MediaPreview
                mediaType={detail.mediaType}
                filename={detail.filename}
                posterFilename={detail.posterFilename}
                originalName={detail.originalName}
                usePosterForVideo
                className="h-full w-full object-cover"
              />
            }
            filename={detail.originalName}
          >
            <div className="flex flex-col gap-1">
              {buildStructuredAnalysisText(detail?.analysis || null)
                .split('\n')
                .map((line, index) => {
                  const cleaned = line.replace(/\*\*/g, '').trim();

                  if (!cleaned) {
                    return <div key={`analysis-gap-${index}`} className="h-2" />;
                  }

                  const isBold = line.startsWith('**') && line.endsWith('**');
                  return (
                    <p
                      key={`analysis-line-${index}`}
                      className={isBold ? 'text-white text-sm font-medium mt-2' : 'text-white/70 text-sm leading-relaxed'}
                    >
                      {cleaned}
                    </p>
                  );
                })}
            </div>
            <p className="text-white/30 text-xs mt-4">
              Source: GPT-4o
              {formatAnalysisFooterDate(detail?.analysis?.updatedAt || null)
                ? ` · Analyzed: ${formatAnalysisFooterDate(detail?.analysis?.updatedAt || null)}`
                : ''}
              {' · Prompt: image_analysis.initial_photo'}
            </p>
          </CollapsibleAnalysisCard>
        ) : null}

        {visualAttachments
          .filter((a) => a.analysisText)
          .map((attachment) => {
            let parsedAnalysis: KipemberWikiDetail['analysis'] | null = null;
            try {
              parsedAnalysis = JSON.parse(attachment.analysisText!) as KipemberWikiDetail['analysis'];
            } catch {
              parsedAnalysis = null;
            }
            const analysisText = buildStructuredAnalysisText(parsedAnalysis);

            return (
              <CollapsibleAnalysisCard
                key={`analysis-${attachment.id}`}
                thumbnail={
                  <MediaPreview
                    mediaType={attachment.mediaType}
                    filename={attachment.filename}
                    posterFilename={attachment.posterFilename}
                    originalName={attachment.originalName}
                    usePosterForVideo
                    className="h-full w-full object-cover"
                  />
                }
                filename={attachment.originalName}
              >
                <div className="flex flex-col gap-1">
                  {analysisText.split('\n').map((line, index) => {
                    const cleaned = line.replace(/\*\*/g, '').trim();
                    if (!cleaned) return <div key={`att-gap-${attachment.id}-${index}`} className="h-2" />;
                    const isBold = line.startsWith('**') && line.endsWith('**');
                    return (
                      <p
                        key={`att-line-${attachment.id}-${index}`}
                        className={isBold ? 'text-white text-sm font-medium mt-2' : 'text-white/70 text-sm leading-relaxed'}
                      >
                        {cleaned}
                      </p>
                    );
                  })}
                </div>
                <p className="text-white/30 text-xs mt-4">Source: GPT-4o · Prompt: image_analysis.uploaded_photo</p>
              </CollapsibleAnalysisCard>
            );
          })}
      </WikiSection>

      </WikiGroup>

      {/* CONVERSATIONS — Story Circle conversations + everything the
          housekeeping extractors pulled out of them. */}
      <WikiGroup label="Conversations">

      <WikiSection
        icon={<History size={17} />}
        title="Story Circle"
        complete={storyCircleComplete}
        badgeLabel={
          storyCircleComplete ? (
            'Complete'
          ) : contributorUserMessages === 0 ? (
            <>
              Need <span className="text-white">1</span> Contributor
            </>
          ) : (
            'Not Complete'
          )
        }
        onEdit={detail?.id ? () => setEditingSlug('contributors') : undefined}
        collapsible
        defaultCollapsed
        tracksProgress
        loading={wikiClaimsLoading}
        id="tracker-story-circle"
      >
        <div className="flex flex-col gap-4">
          {(detail?.chatBlocks && detail.chatBlocks.length > 0) ||
          (detail?.voiceBlocks && detail.voiceBlocks.length > 0) ||
          (detail?.callBlocks && detail.callBlocks.length > 0) ? (
            <>
              {(detail?.chatBlocks ?? []).map((block) => {
                const voiceForPerson = (detail?.voiceBlocks ?? []).find(
                  (voice) => voice.personName === block.personName
                );
                const callsForPerson = (detail?.callBlocks ?? []).filter(
                  (call) => call.personName === block.personName
                );
                return (
                  <Fragment key={`person-${block.personName}`}>
                    <CollapsibleChatBlock block={block} />
                    {voiceForPerson ? (
                      <VoiceBlockCard block={voiceForPerson} />
                    ) : null}
                    {callsForPerson.map((call) => (
                      <EmberCallCard key={call.voiceCallId} block={call} />
                    ))}
                  </Fragment>
                );
              })}
              {(detail?.voiceBlocks ?? [])
                .filter((voice) =>
                  !(detail?.chatBlocks ?? []).some(
                    (block) => block.personName === voice.personName
                  )
                )
                .map((voice) => (
                  <VoiceBlockCard key={`voice-${voice.personName}`} block={voice} />
                ))}
              {(detail?.callBlocks ?? [])
                .filter(
                  (call) =>
                    !(detail?.chatBlocks ?? []).some(
                      (block) => block.personName === call.personName
                    ) &&
                    !(detail?.voiceBlocks ?? []).some(
                      (voice) => voice.personName === call.personName
                    )
                )
                .map((call) => (
                  <EmberCallCard key={call.voiceCallId} block={call} />
                ))}
            </>
          ) : (
            <WikiCard>
              <p className="text-white/30 text-sm">No conversations yet.</p>
            </WikiCard>
          )}
        </div>
      </WikiSection>

      <WikiSection
        icon={<Lightbulb size={17} />}
        title="Why"
        complete={whyComplete}
        tracksProgress
        loading={wikiClaimsLoading}
        id="tracker-why"
      >
        <WhyCard claims={whyClaims} findPerson={findPerson} />
      </WikiSection>

      <WikiSection
        icon={<Heart size={17} />}
        title="Emotional States"
        complete={emotionComplete}
        tracksProgress
        loading={wikiClaimsLoading}
        id="tracker-emotional-states"
      >
        <EmotionalStateCard claims={emotionClaims} findPerson={findPerson} />
      </WikiSection>

      <WikiSection
        icon={<Sparkles size={17} />}
        title="Extra Stories"
        complete={Boolean(extraStoryClaims && extraStoryClaims.length > 0)}
        count={extraStoryClaims?.length ?? 0}
      >
        <ExtraStoriesCard claims={extraStoryClaims} findPerson={findPerson} />
      </WikiSection>

      <WikiSection
        icon={<MapIcon size={17} />}
        title="Places Mentioned"
        complete={Boolean(placeClaims && placeClaims.length > 0)}
        count={placeClaims?.length ?? 0}
      >
        <PlacesMentionedCard claims={placeClaims} findPerson={findPerson} />
      </WikiSection>

      <WikiSection
        icon={<Users size={17} />}
        title="People Mentioned"
        complete={Boolean(personClaims && personClaims.length > 0)}
        count={personClaims?.length ?? 0}
      >
        <PeopleMentionedCard claims={personClaims} findPerson={findPerson} />
      </WikiSection>

      {/* Guest Talk — share-link visitor conversations live here as their
          own block, separate from Story Circle (which is about
          owner/contributor/voice/call). Lifted out so the wiki keeps a
          clear line between people-on-the-account and anonymous viewers
          dropped into the memory by a link. */}
      <WikiSection
        icon={<MessagesSquare size={17} />}
        title="Guest Talk"
        complete={Boolean(detail?.guestChatBlock && detail.guestChatBlock.visitors.length > 0)}
        count={detail?.guestChatBlock?.visitors.length ?? 0}
        collapsible
        defaultCollapsed
      >
        {detail?.guestChatBlock && detail.guestChatBlock.visitors.length > 0 ? (
          <div className="flex flex-col gap-4">
            {detail.guestChatBlock.visitors.map((visitor, idx) => {
              const visitorNumber = idx + 1;
              return (
                <Fragment key={visitor.visitorId}>
                  {visitor.chatMessages.length > 0 ? (
                    <CollapsibleGuestVisitorChatBlock
                      visitor={visitor}
                      visitorNumber={visitorNumber}
                    />
                  ) : null}
                  {visitor.voiceMessages.length > 0 ? (
                    <CollapsibleGuestVisitorVoiceBlock
                      visitor={visitor}
                      visitorNumber={visitorNumber}
                    />
                  ) : null}
                </Fragment>
              );
            })}
          </div>
        ) : (
          <WikiCard>
            <p className="text-white/30 text-sm">No guest conversations yet.</p>
          </WikiCard>
        )}
      </WikiSection>

      </WikiGroup>

      {/* CONTROL — owner-only ember controls. Privacy toggles and the
          delete action live inline here; Download is a placeholder until
          we ship the export pipeline. Defaults to collapsed so the
          destructive controls aren't right under the user's thumb. */}
      <WikiGroup label="Control" defaultCollapsed>

      <WikiSection icon={<Lock size={17} />} title="Privacy Setting" complete={false} hideBadge>
        <PrivacyToggles
          imageId={imageId}
          shareToNetwork={Boolean(detail?.shareToNetwork)}
          keepPrivate={Boolean(detail?.keepPrivate)}
          refreshDetail={refreshDetail}
          onStatus={onStatus}
        />
      </WikiSection>

      <WikiSection
        icon={<Download size={17} />}
        title="Download Ember"
        complete={false}
        hideBadge
      >
        <WikiCard>
          <p className="text-white/60 text-sm">
            Export this ember as a single archive — photos, wiki text, voice
            clips, call transcripts, and contributor history. Not yet
            available.
          </p>
        </WikiCard>
      </WikiSection>

      <WikiSection
        icon={<ArrowRightLeft size={17} />}
        title="Transfer Ember"
        complete={false}
        hideBadge
      >
        <WikiCard>
          <p className="text-white/60 text-sm">
            Hand this ember to another user. They become the owner — full
            admin rights over contributors, privacy, and content — and any
            ongoing costs (storage, voice, calls) move to their account. Not
            yet available.
          </p>
        </WikiCard>
      </WikiSection>

      <WikiSection
        icon={<LockKeyhole size={17} />}
        title="Lock Ember"
        complete={false}
        hideBadge
      >
        <WikiCard>
          <p className="text-white/60 text-sm">
            Freeze the wiki. Owner, contributor, and guest conversations keep
            recording into the archive, but new messages stop feeding the
            model — the wiki you see today is what stays. Not yet available.
          </p>
        </WikiCard>
      </WikiSection>

      <WikiSection icon={<Trash2 size={17} />} title="Delete Ember" complete={false} hideBadge>
        <DeleteEmberCard imageId={imageId} canManage={Boolean(detail?.canManage)} onStatus={onStatus} />
      </WikiSection>
      </WikiGroup>

    </div>

    {/* Edit overlay — slides in over the wiki (which itself is a modal
        over the ember view). The wiki stays mounted underneath so
        scroll, expanded sections, and progress bar all persist.
        Portaled to document.body so its fixed positioning is anchored
        to the viewport rather than the wiki's transform-containing
        block (the wiki's slide-in-right transform would otherwise
        capture our `fixed` and shift the peek off-axis). */}
    {editingSlug && imageId && activeEditMeta && refreshDetail && typeof document !== 'undefined'
      ? createPortal(
      <div className="fixed inset-0 z-50 flex justify-center">
        <div className="relative w-full max-w-xl h-full flex">
          <button
            type="button"
            onClick={closeEditOverlay}
            className="h-full"
            style={{ width: 'calc(8% + 10px)', cursor: 'pointer' }}
            aria-label="Back to wiki"
          />
          <div
            className="flex-1 h-full flex flex-col"
            style={{
              background: 'var(--bg-screen)',
              borderLeft: '1px solid var(--border-subtle)',
              transform: overlayOpen ? 'translateX(0)' : 'translateX(100%)',
              transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            <div
              className="flex items-center gap-3 px-4 flex-shrink-0"
              style={{ height: 56, borderBottom: '1px solid var(--border-subtle)' }}
            >
              <span className="flex-shrink-0">{activeEditMeta.icon}</span>
              <h2 className="flex-1 text-white font-medium text-base">{activeEditMeta.label}</h2>
              <button
                type="button"
                onClick={closeEditOverlay}
                aria-label="Close"
                className="w-9 h-9 flex items-center justify-center flex-shrink-0 rounded-full can-hover"
                style={{ opacity: 0.75, cursor: 'pointer' }}
              >
                <X size={20} color="var(--text-primary)" strokeWidth={1.8} />
              </button>
            </div>
            <div className="flex-1 px-5 min-h-0 flex flex-col overflow-y-auto no-scrollbar py-4 gap-4">
              {editingSlug === 'title' ? (
                <EditTitleSlider
                  detail={detail}
                  imageId={imageId}
                  refreshDetail={async () => {
                    await refreshDetail();
                  }}
                  onStatus={onStatus}
                />
              ) : null}
              {editingSlug === 'snapshot' ? (
                <EditSnapshotSlider
                  detail={detail}
                  imageId={imageId}
                  refreshDetail={async () => {
                    await refreshDetail();
                  }}
                  onStatus={onStatus}
                />
              ) : null}
              {editingSlug === 'time-place' ? (
                <EditTimePlaceSlider
                  detail={detail}
                  imageId={imageId}
                  refreshDetail={async () => {
                    await refreshDetail();
                  }}
                  onStatus={onStatus}
                />
              ) : null}
              {editingSlug === 'contributors' ? (
                <ContributorsSlider
                  detail={detail}
                  imageId={imageId}
                  refreshDetail={async () => {
                    await refreshDetail();
                  }}
                  onStatus={onStatus}
                />
              ) : null}
              {editingSlug === 'tag-people' && detail ? (
                <TagPeopleSlider
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  detail={detail as any}
                  imageId={imageId}
                  coverPhotoUrl={getPreviewMediaUrl({
                    mediaType: detail.mediaType,
                    filename: detail.filename,
                    posterFilename: detail.posterFilename,
                  })}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>,
          document.body,
        )
      : null}
    </>
  );
}
