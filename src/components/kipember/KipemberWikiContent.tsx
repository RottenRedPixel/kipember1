'use client';

import Link from 'next/link';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  GitCompareArrows,
  Heart,
  History,
  Image as ImageIcon,
  Lightbulb,
  Map as MapIcon,
  MapPin,
  MessageCircle,
  Mic,
  PencilLine,
  Phone,
  Play,
  RefreshCw,
  ScanEye,
  Send,
  ShieldUser,
  Sparkles,
  Users,
} from 'lucide-react';
import ClipAudioPlayer from '@/components/ClipAudioPlayer';
import EmberCallCard from '@/components/kipember/EmberCallCard';
import EmberChatMessages from '@/components/kipember/EmberChatMessages';
import VoiceMessageList, { type VoiceMessage } from '@/components/kipember/workflows/VoiceMessageList';
import MediaPreview from '@/components/MediaPreview';
import { usePlaceResolution } from '@/components/kipember/usePlaceResolution';
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
  } | null;
  contributors: KipemberContributor[];
  attachments: KipemberAttachment[];
  tags?: KipemberTag[];
  voiceCallClips?: KipemberVoiceCallClip[];
  chatBlocks?: Array<{
    personName: string;
    avatarUrl?: string | null;
    isOwner?: boolean;
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

const PERSON_AVATAR_COLORS = ['#2563eb', '#7c3aed', '#16a34a', '#b45309', '#db2777', '#0891b2'];

function colorForName(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PERSON_AVATAR_COLORS[h % PERSON_AVATAR_COLORS.length];
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
  avatarUrl,
}: {
  name: string;
  value: string;
  source: string;
  createdAt: string;
  avatarUrl?: string | null;
}) {
  const isVoice = source === 'voice';
  const displayName = name.trim() || 'Someone';
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
          className="rounded-full flex items-center justify-center text-white flex-shrink-0"
          style={{
            width: 29,
            height: 29,
            background: colorForName(displayName),
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

type FindAvatar = (name: string) => string | null;

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
        <AvatarCircle name={block.personName} avatarUrl={block.avatarUrl} size={29} />
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
  findAvatar,
}: {
  claims: ReconciliationClaim[] | null;
  findAvatar: FindAvatar;
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
            avatarUrl={findAvatar(name)}
          />
        );
      })}
    </div>
  );
}

function EmotionalStateCard({
  claims,
  findAvatar,
}: {
  claims: ReconciliationClaim[] | null;
  findAvatar: FindAvatar;
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
            sourceAvatarUrl={findAvatar(sourceName)}
            subjectName={subjectName}
            subjectAvatarUrl={subjectName ? findAvatar(subjectName) : null}
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
  sourceAvatarUrl,
  subjectName,
  subjectAvatarUrl,
  value,
  source,
  createdAt,
}: {
  sourceName: string;
  sourceAvatarUrl?: string | null;
  subjectName: string;
  subjectAvatarUrl?: string | null;
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
        <Avatar name={sourceDisplay} avatarUrl={sourceAvatarUrl} />
        {subjectDisplay ? (
          <>
            <ChevronRight size={11} className="text-white/40" strokeWidth={2.5} />
            <Avatar name={subjectDisplay} avatarUrl={subjectAvatarUrl} />
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
  avatarUrl,
}: {
  name: string;
  avatarUrl?: string | null;
}) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: 24, height: 24 }}
      />
    );
  }
  return (
    <div
      className="rounded-full flex items-center justify-center text-white flex-shrink-0"
      style={{
        width: 24,
        height: 24,
        background: colorForName(name),
        fontSize: 10,
        fontWeight: 600,
      }}
    >
      {initials(name)}
    </div>
  );
}

function ExtraStoriesCard({
  claims,
  findAvatar,
}: {
  claims: ReconciliationClaim[] | null;
  findAvatar: FindAvatar;
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
            avatarUrl={findAvatar(name)}
          />
        );
      })}
    </div>
  );
}

function PlacesMentionedCard({
  claims,
  findAvatar,
}: {
  claims: ReconciliationClaim[] | null;
  findAvatar: FindAvatar;
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
            avatarUrl={findAvatar(name)}
          />
        );
      })}
    </div>
  );
}

function AvatarCircle({
  name,
  avatarUrl,
  size = 29,
  bgColor = 'rgba(255,255,255,0.15)',
}: {
  name: string;
  avatarUrl?: string | null;
  size?: number;
  bgColor?: string;
}) {
  return avatarUrl ? (
    <img
      src={avatarUrl}
      alt={name}
      className="rounded-full object-cover flex-shrink-0"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className="rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
      style={{ width: size, height: size, background: bgColor }}
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

function WikiBadge({ complete, label }: { complete: boolean; label?: React.ReactNode }) {
  // Three palettes:
  //   complete           → green
  //   not complete + default "Not Complete" → red
  //   not complete + custom label (e.g. "Need to tag 2 People") → orange
  const hasCustomLabel = label != null;
  const palette = complete
    ? { bg: 'rgba(34,197,94,0.15)', fg: '#4ade80' }
    : hasCustomLabel
      ? { bg: 'rgba(249,115,22,0.15)', fg: '#f97316' }
      : { bg: 'rgba(239,68,68,0.15)', fg: '#f87171' };
  return (
    <span
      className="text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0"
      style={{ background: palette.bg, color: palette.fg }}
    >
      {label ?? (complete ? 'Complete' : 'Not Complete')}
    </span>
  );
}

function WikiSection({
  icon,
  title,
  complete,
  badgeLabel,
  editHref,
  collapsible = false,
  defaultCollapsed = false,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  complete: boolean;
  badgeLabel?: React.ReactNode;
  editHref?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
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
    <div className="flex flex-col gap-3">
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
          {editHref ? (
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
          <WikiBadge complete={complete} label={badgeLabel} />
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
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
    >
      {children}
    </div>
  );
}

type ChatBlock = {
  personName: string;
  avatarUrl?: string | null;
  isOwner?: boolean;
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
        <AvatarCircle name={block.personName} avatarUrl={block.avatarUrl} size={29} />
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

function MemoryReconciliationPanel({ imageId }: { imageId: string }) {
  const [reconciliation, setReconciliation] = useState<ReconciliationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastRefreshResult, setLastRefreshResult] = useState<ReconciliationRefreshResponse | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function loadInitial() {
      setLoading(true);
      setError('');

      try {
        const nextReconciliation = await fetchReconciliationState(imageId, controller.signal);

        if (!cancelled) {
          setReconciliation(nextReconciliation);
        }
      } catch (loadError) {
        if (cancelled || (loadError instanceof DOMException && loadError.name === 'AbortError')) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : 'Failed to load reconciliation state');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadInitial();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [imageId]);

  async function handleRefresh() {
    setRefreshing(true);
    setError('');
    setLastRefreshResult(null);

    try {
      const response = await fetch(`/api/images/${imageId}/reconciliation`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to refresh reconciliation scan');
      }

      const payload = (await response.json()) as ReconciliationRefreshResponse;
      setLastRefreshResult(payload);
      setReconciliation(await fetchReconciliationState(imageId));
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Failed to refresh reconciliation scan');
    } finally {
      setRefreshing(false);
    }
  }

  const conflicts = reconciliation?.conflicts || [];
  const openConflicts = conflicts.filter((conflict) => conflict.status === 'open');
  const claims = reconciliation?.claims || [];

  return (
    <WikiSection
      icon={<GitCompareArrows size={17} />}
      title="Memory Reconciliation"
      complete={!loading && openConflicts.length === 0}
    >
      <WikiCard>
        <div className="flex items-start justify-between gap-3">
          <p className="text-white/70 text-sm leading-relaxed flex-1">
            Ember compares contributor answers, stores factual claims, and flags details that may need a human check.
          </p>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            aria-label={refreshing ? 'Scanning' : 'Refresh scan'}
            className="w-9 h-9 flex items-center justify-center rounded-full flex-shrink-0 disabled:opacity-50"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', cursor: refreshing || loading ? 'default' : 'pointer' }}
          >
            <RefreshCw size={14} color="rgba(255,255,255,0.8)" className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        {lastRefreshResult ? (
          <p className="text-white/35 text-xs mt-3">
            Scanned {lastRefreshResult.processedMessages} answers, found {lastRefreshResult.claimsCreated} claims and {lastRefreshResult.openConflictCount} open conflicts.
          </p>
        ) : null}

        {error ? (
          <div
            className="mt-4 rounded-xl px-3 py-2 text-xs text-orange-100"
            style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.25)' }}
          >
            {error}
          </div>
        ) : null}

        {loading ? (
          <p className="text-white/30 text-sm mt-4">Loading reconciliation state...</p>
        ) : openConflicts.length > 0 ? (
          <div className="mt-4 flex flex-col gap-3">
            {openConflicts.map((conflict) => (
              <div
                key={conflict.id}
                className="rounded-2xl p-4"
                style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.22)' }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <AlertTriangle size={15} className="text-orange-300" />
                  <p className="text-white text-sm font-medium">
                    {formatClaimType(conflict.claimType)}
                    {conflict.subject ? `: ${conflict.subject}` : ''}
                  </p>
                  <ReconciliationPill tone="warn">
                    {conflict.resolutionMode === 'visual_review' ? 'Visual review' : 'Ask humans'}
                  </ReconciliationPill>
                  {formatConfidence(conflict.confidence) ? (
                    <ReconciliationPill>{formatConfidence(conflict.confidence)}</ReconciliationPill>
                  ) : null}
                </div>

                <p className="text-white/65 text-sm leading-relaxed mt-3">{conflict.summary}</p>

                <div className="mt-3 grid gap-2">
                  {conflict.claims.map((item) => (
                    <div
                      key={`${conflict.id}-${item.claim.id}`}
                      className="rounded-xl px-3 py-2"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-white/35 text-xs">{getSourceName(item.claim)}</span>
                        <span className="text-white/25 text-[10px]">{formatLongDate(item.claim.createdAt)}</span>
                      </div>
                      <p className="text-white text-sm mt-1">{item.claim.value}</p>
                      {item.claim.rawText && item.claim.rawText !== item.claim.value ? (
                        <p className="text-white/35 text-xs mt-1">{item.claim.rawText}</p>
                      ) : null}
                    </div>
                  ))}
                </div>

                {conflict.outreachQuestion ? (
                  <div
                    className="mt-3 rounded-xl px-3 py-2"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    <p className="text-white/30 text-xs font-medium uppercase tracking-wider">Suggested clarification</p>
                    <p className="text-white/70 text-sm mt-1">{conflict.outreachQuestion}</p>
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-white/35"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                    title="Outreach will be added in the next phase."
                  >
                    <Send size={12} />
                    Ask contributors next
                  </button>
                  <button
                    type="button"
                    disabled
                    className="rounded-full px-3 py-1.5 text-xs font-medium text-white/35"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                    title="Manual resolution will be added in the next phase."
                  >
                    Keep both / resolve next
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            className="mt-4 rounded-2xl p-4"
            style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} className="text-emerald-300" />
              <p className="text-white text-sm font-medium">No open conflicts found.</p>
            </div>
            <p className="text-white/45 text-xs mt-2">
              {claims.length > 0
                ? `${claims.length} memory claims are currently tracked for this Ember.`
                : 'Run a scan after contributors add more structured memory details.'}
            </p>
          </div>
        )}
      </WikiCard>
    </WikiSection>
  );
}

const TAG_COLORS = ['#f97316', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#ef4444'];

export default function KipemberWikiContent({
  detail,
}: {
  detail: KipemberWikiDetail | null;
}) {
  const placeResolution = usePlaceResolution(detail);
  const contributors = detail?.contributors || [];
  const imageId = detail?.id || null;
  const ownerName = getUserDisplayName(detail?.owner) || detail?.owner?.email || null;
  const ownerUserId = detail?.owner?.id;

  const avatarLookup = useMemo(() => {
    const map = new Map<string, string>();
    const add = (name: string | null | undefined, url: string | null | undefined) => {
      const key = name?.trim().toLowerCase();
      if (!key || !url) return;
      if (!map.has(key)) map.set(key, url);
    };

    if (detail?.owner) {
      const name = getUserDisplayName(detail.owner) || detail.owner.email;
      if (detail.owner.avatarFilename) {
        add(name, `/api/uploads/${detail.owner.avatarFilename}`);
        // Also map the literal "Owner" since claims sometimes attribute to "Owner"
        add('Owner', `/api/uploads/${detail.owner.avatarFilename}`);
      }
    }
    for (const contributor of detail?.contributors ?? []) {
      const name = getUserDisplayName(contributor.user) || contributor.name;
      const filename = contributor.user?.avatarFilename;
      if (name && filename) {
        add(name, `/api/uploads/${filename}`);
      }
    }
    for (const tag of detail?.tags ?? []) {
      add(getUserDisplayName(tag.createdBy), tag.createdBy?.avatarUrl);
      add(tag.label, tag.createdBy?.avatarUrl);
    }
    return map;
  }, [detail]);

  const findAvatar = useCallback<FindAvatar>(
    (name: string) => avatarLookup.get(name.trim().toLowerCase()) ?? null,
    [avatarLookup]
  );

  const wikiClaims = useReconciliationClaims(imageId);
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
  const activeContributors = contributors.filter((contributor) => (contributor.userId || contributor.user) && contributor.userId !== ownerUserId && contributor.user?.id !== ownerUserId);
  // A real pending contributor has at least one identifier (name / email /
  // phoneNumber). Rows with all identity fields null are share-link
  // placeholders that anchor the share token — never surface them.
  const pendingContributors = contributors.filter((contributor) =>
    !contributor.userId &&
    !contributor.user &&
    Boolean(contributor.name || contributor.email || contributor.phoneNumber)
  );
  // Story Circle completion is gated on contributor (non-owner) engagement —
  // the owner's own sessions don't count. Auto-welcome assistant messages are
  // also excluded since they don't reflect real engagement.
  const contributorUserMessages = (detail?.chatBlocks || []).reduce(
    (sum, block) =>
      sum + (block.isOwner ? 0 : block.messages.filter((m) => m.role === 'user').length),
    0
  );
  const totalStoryMessages = contributorUserMessages;
  const isAudioAttachment = (attachment: KipemberAttachment) =>
    attachment.mediaType === 'AUDIO' ||
    isAudioLikeFilename(attachment.filename) ||
    isAudioLikeFilename(attachment.originalName);
  const visualAttachments = (detail?.attachments || []).filter(
    (attachment) => !isAudioAttachment(attachment)
  );
  const audioAttachments = (detail?.attachments || []).filter((attachment) =>
    isAudioAttachment(attachment)
  );
  const voiceCallClips = detail?.voiceCallClips || [];
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

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar py-5 flex flex-col gap-7 pb-10">
      <WikiSection
        icon={<ShieldUser size={17} />}
        title="Owner"
        complete={Boolean(ownerName)}
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
        icon={<FileText size={17} />}
        title="Title"
        complete={Boolean(detail?.title || detail?.originalName)}
        editHref={detail?.id ? `/tend/edit-title?id=${detail.id}` : undefined}
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
        editHref={detail?.id ? `/tend/edit-snapshot?id=${detail.id}` : undefined}
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

      <WikiSection
        icon={<Clock size={17} />}
        title="Time & Date"
        complete={Boolean(detail?.analysis?.capturedAt || detail?.createdAt)}
        editHref={detail?.id ? `/tend/edit-time-place?id=${detail.id}` : undefined}
      >
        <WikiCard>
          <p className="text-white/30 text-xs font-medium mb-1.5">Photo Timestamp</p>
          <p className="text-white font-medium text-sm">
            {formatLongDate(detail?.analysis?.capturedAt || detail?.createdAt)}
          </p>
          <p className="text-white/30 text-xs mt-3">
            Source: {detail?.analysis?.capturedAt ? 'Photo EXIF metadata' : 'Upload timestamp'}
          </p>
        </WikiCard>
      </WikiSection>

      <WikiSection
        icon={<MapPin size={17} />}
        title="Place"
        complete={Boolean(placeName || addressLines.length > 0 || coordinateLine)}
        editHref={detail?.id ? `/tend/edit-time-place?id=${detail.id}` : undefined}
      >
        <WikiCard>
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
                ? 'Photo GPS metadata'
                : 'Not set'}
          </p>
        </WikiCard>
      </WikiSection>

      <WikiSection
        icon={<Users size={17} />}
        title="Contributors"
        complete={activeContributors.length > 0 || pendingContributors.length > 0}
        editHref={detail?.id ? `/tend/contributors?id=${detail.id}` : undefined}
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
                    bgColor="rgba(255,255,255,0.08)"
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
        const detected =
          detail?.analysis?.sceneInsights?.peopleAndDemographics?.numberOfPeopleVisible ?? null;
        const tagged = detail?.tags?.length ?? 0;
        const peopleComplete = detected !== null && tagged >= detected;
        const remaining = detected !== null ? detected - tagged : 0;
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
            editHref={detail?.id ? `/tend/tag-people?id=${detail.id}` : undefined}
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

      <WikiSection
        icon={<ImageIcon size={17} />}
        title="Photos"
        complete={Boolean(detail?.originalName || visualAttachments.length)}
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
        complete={Boolean(
          detail?.analysis?.sceneInsights ||
            detail?.analysis?.summary ||
            detail?.analysis?.visualDescription ||
            detail?.analysis?.metadataSummary
        )}
        collapsible
        defaultCollapsed
      >
        <WikiCard>
          {detail ? (
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0"
                style={{ background: 'var(--bg-ember-bubble)', border: '1px solid var(--border-ember)' }}
              >
                <MediaPreview
                  mediaType={detail.mediaType}
                  filename={detail.filename}
                  posterFilename={detail.posterFilename}
                  originalName={detail.originalName}
                  usePosterForVideo
                  className="h-full w-full object-cover"
                />
              </div>
              <p className="text-white/50 text-xs font-medium break-words">{detail.originalName}</p>
            </div>
          ) : null}
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
        </WikiCard>

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
              <WikiCard key={`analysis-${attachment.id}`}>
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0"
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
                  <p className="text-white/50 text-xs font-medium break-words">{attachment.originalName}</p>
                </div>
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
              </WikiCard>
            );
          })}
      </WikiSection>

      <WikiSection
        icon={<History size={17} />}
        title="Story Circle"
        complete={totalStoryMessages > 0}
        badgeLabel={
          totalStoryMessages > 0 ? (
            'Complete'
          ) : (
            <>
              Need <span className="text-white">1</span> Contributor
            </>
          )
        }
        collapsible
        defaultCollapsed
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

      {voiceCallClips.length > 0 ? (
        <WikiSection icon={<Mic size={17} />} title="Voice Clips" complete>
          {voiceCallClips.map((clip) => (
            <WikiCard key={clip.id}>
              <p className="text-white text-sm font-medium">{clip.title}</p>
              <p className="text-white/30 text-xs mt-0.5">
                {clip.contributorName} · {formatLongDate(clip.createdAt)}
              </p>
              <p className="text-white/70 text-sm leading-relaxed mt-3">{clip.quote}</p>
              {clip.significance ? (
                <p className="text-white/50 text-xs leading-relaxed mt-2">{clip.significance}</p>
              ) : null}
              {clip.audioUrl ? (
                <ClipAudioPlayer
                  src={clip.audioUrl}
                  className="mt-4"
                  startMs={clip.startMs}
                  endMs={clip.endMs}
                />
              ) : null}
            </WikiCard>
          ))}
        </WikiSection>
      ) : null}

      {audioAttachments.length > 0 ? (
        <WikiSection icon={<Mic size={17} />} title="Recorded Audio" complete>
          {audioAttachments.map((attachment) => (
            <WikiCard key={attachment.id}>
              <p className="text-white text-sm font-medium">{attachment.originalName}</p>
              {attachment.description ? (
                <p className="text-white/60 text-xs mt-1 break-words">{attachment.description}</p>
              ) : null}
              <MediaPreview
                mediaType={attachment.mediaType}
                filename={attachment.filename}
                posterFilename={attachment.posterFilename}
                originalName={attachment.originalName}
                controls
                className="mt-4 w-full"
              />
            </WikiCard>
          ))}
        </WikiSection>
      ) : null}

      <WikiSection
        icon={<Lightbulb size={17} />}
        title="Why"
        complete={Boolean(whyClaims && whyClaims.length > 0)}
      >
        <WhyCard claims={whyClaims} findAvatar={findAvatar} />
      </WikiSection>

      <WikiSection
        icon={<Heart size={17} />}
        title="Emotional States"
        complete={Boolean(emotionClaims && emotionClaims.length > 0)}
      >
        <EmotionalStateCard claims={emotionClaims} findAvatar={findAvatar} />
      </WikiSection>

      <WikiSection
        icon={<Sparkles size={17} />}
        title="Extra Stories"
        complete={Boolean(extraStoryClaims && extraStoryClaims.length > 0)}
      >
        <ExtraStoriesCard claims={extraStoryClaims} findAvatar={findAvatar} />
      </WikiSection>

      <WikiSection
        icon={<MapIcon size={17} />}
        title="Places Mentioned"
        complete={Boolean(placeClaims && placeClaims.length > 0)}
      >
        <PlacesMentionedCard claims={placeClaims} findAvatar={findAvatar} />
      </WikiSection>

    </div>
  );
}
