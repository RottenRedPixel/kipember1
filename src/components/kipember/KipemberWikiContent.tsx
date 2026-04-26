'use client';

import Link from 'next/link';
import { Fragment, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  GitCompareArrows,
  Heart,
  History,
  Image as ImageIcon,
  Lightbulb,
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
import MediaPreview from '@/components/MediaPreview';
import { isAudioLikeFilename, type EmberMediaType } from '@/lib/media';

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

type LocationSuggestion = {
  id: string;
  label: string;
  detail: string | null;
  kind: string;
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
    name: string | null;
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
    name: string | null;
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
    name: string | null;
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

// ─── Placeholder Why / Emotional / Stories sections ──────────────────────────
// These mirror the styling from the (now-removed) Checklist screen with dummy
// data, ready to wire to real sources later.

const PLACEHOLDER_PERSON_COLORS = ['#2563eb', '#7c3aed', '#16a34a', '#b45309', '#db2777', '#0891b2'];

function colorForName(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PLACEHOLDER_PERSON_COLORS[h % PLACEHOLDER_PERSON_COLORS.length];
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

type PlaceholderPerson = {
  name: string;
  avatarUrl?: string | null;
  color: string;
};

type PlaceholderEntry = {
  value: string;
  source: PlaceholderPerson;
  channel: 'chat' | 'call';
  at: string;
};

function PlaceholderSourcePill({ entry }: { entry: PlaceholderEntry }) {
  return (
    <div className="flex items-center gap-1.5 mt-1.5">
      {entry.source.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={entry.source.avatarUrl}
          alt={entry.source.name}
          className="rounded-full object-cover flex-shrink-0"
          style={{ width: 18, height: 18 }}
        />
      ) : (
        <div
          className="rounded-full flex items-center justify-center text-white flex-shrink-0"
          style={{ width: 18, height: 18, background: entry.source.color, fontSize: 9, fontWeight: 600 }}
        >
          {initials(entry.source.name)}
        </div>
      )}
      <span className="text-white/60 text-[11px]">{entry.source.name.split(/\s+/)[0] || entry.source.name}</span>
      {entry.channel === 'chat' ? (
        <MessageCircle size={10} className="text-white/40" fill="currentColor" stroke="currentColor" />
      ) : (
        <Phone size={10} className="text-white/40" fill="currentColor" stroke="currentColor" />
      )}
      <span className="text-white/30 text-[10px]">· {relativeAt(entry.at)}</span>
    </div>
  );
}

function buildPlaceholderPeople() {
  const personA: PlaceholderPerson = { name: 'Owner', avatarUrl: null, color: PLACEHOLDER_PERSON_COLORS[0] };
  const personB: PlaceholderPerson = { name: 'Sarah', avatarUrl: null, color: colorForName('Sarah') };
  const personC: PlaceholderPerson = { name: 'Mom', avatarUrl: null, color: colorForName('Mom') };
  return { personA, personB, personC };
}

function PlaceholderEntryRow({ entry }: { entry: PlaceholderEntry }) {
  return (
    <div
      className="rounded-lg px-3 py-2 flex items-center gap-2.5"
      style={{ background: 'var(--bg-ember-bubble)', border: '1px solid var(--border-ember)' }}
    >
      {entry.source.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={entry.source.avatarUrl}
          alt={entry.source.name}
          className="rounded-full object-cover flex-shrink-0"
          style={{ width: 26, height: 26 }}
        />
      ) : (
        <div
          className="rounded-full flex items-center justify-center text-white flex-shrink-0"
          style={{ width: 26, height: 26, background: entry.source.color, fontSize: 10, fontWeight: 600 }}
        >
          {initials(entry.source.name)}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-white text-xs font-medium">
          {entry.source.name.split(/\s+/)[0] || entry.source.name}
        </p>
        <p className="text-white/60 text-[11px] mt-0.5">&ldquo;{entry.value}&rdquo;</p>
      </div>
      <div className="flex items-center gap-1 text-white/30 text-[10px] flex-shrink-0">
        {entry.channel === 'chat' ? (
          <MessageCircle size={10} fill="currentColor" stroke="currentColor" />
        ) : (
          <Phone size={10} fill="currentColor" stroke="currentColor" />
        )}
        <span>{relativeAt(entry.at)}</span>
      </div>
    </div>
  );
}

function PlaceholderWhyCard() {
  const { personC } = buildPlaceholderPeople();
  const at = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const entries: PlaceholderEntry[] = [
    {
      value: "We hadn't all been together since Christmas — the holidays were a blur",
      source: personC,
      channel: 'call',
      at,
    },
  ];
  return (
    <div className="flex flex-col gap-2">
      {entries.map((entry, i) => (
        <PlaceholderEntryRow key={i} entry={entry} />
      ))}
    </div>
  );
}

function PlaceholderEmotionalCard() {
  const { personA, personB, personC } = buildPlaceholderPeople();
  const t = (mins: number) => new Date(Date.now() - mins * 60_000).toISOString();
  const rows: Array<{
    person: PlaceholderPerson;
    value: string | null;
    channel: 'chat' | 'call' | null;
    at: string | null;
  }> = [
    { person: personA, value: 'happy, relaxed, proud', channel: 'chat', at: t(120) },
    { person: personB, value: 'tired but joyful', channel: 'call', at: t(30) },
    { person: personC, value: null, channel: null, at: null },
  ];
  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, i) => (
          <div
            key={i}
            className="rounded-lg px-3 py-2 flex items-center gap-2.5"
            style={{ background: 'var(--bg-ember-bubble)', border: '1px solid var(--border-ember)' }}
          >
            {row.person.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={row.person.avatarUrl}
                alt={row.person.name}
                className="rounded-full object-cover flex-shrink-0"
                style={{ width: 26, height: 26 }}
              />
            ) : (
              <div
                className="rounded-full flex items-center justify-center text-white flex-shrink-0"
                style={{ width: 26, height: 26, background: row.person.color, fontSize: 10, fontWeight: 600 }}
              >
                {initials(row.person.name)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium">
                {row.person.name.split(/\s+/)[0] || row.person.name}
              </p>
              {row.value ? (
                <p className="text-white/60 text-[11px] mt-0.5">&ldquo;{row.value}&rdquo;</p>
              ) : (
                <p className="text-white/25 text-[11px] mt-0.5 italic">no answer yet</p>
              )}
            </div>
            {row.value && row.channel ? (
              <div className="flex items-center gap-1 text-white/30 text-[10px] flex-shrink-0">
                {row.channel === 'chat' ? (
                  <MessageCircle size={10} fill="currentColor" stroke="currentColor" />
                ) : (
                  <Phone size={10} fill="currentColor" stroke="currentColor" />
                )}
                <span>{row.at ? relativeAt(row.at) : ''}</span>
              </div>
            ) : null}
          </div>
        ))}
    </div>
  );
}

function PlaceholderStoriesCard() {
  const { personA, personC } = buildPlaceholderPeople();
  const t = (mins: number) => new Date(Date.now() - mins * 60_000).toISOString();
  const stories: PlaceholderEntry[] = [
    {
      value: 'Liam laughed for the first time when his uncle made a face at him across the table.',
      source: personC,
      channel: 'call',
      at: t(1440),
    },
    {
      value: "Sarah brought her dog and the dog ate half the cake before anyone noticed.",
      source: personA,
      channel: 'chat',
      at: t(120),
    },
  ];
  return (
    <div className="flex flex-col gap-2">
      {stories.map((entry, i) => (
        <PlaceholderEntryRow key={i} entry={entry} />
      ))}
    </div>
  );
}

function DummyEmberCallCard({ personName, avatarUrl }: { personName: string; avatarUrl?: string | null }) {
  const first = personName.split(' ')[0] || personName;
  const baseTime = new Date();
  baseTime.setHours(14, 12, 0, 0);
  const t = (offsetMinutes: number) => new Date(baseTime.getTime() + offsetMinutes * 60_000).toISOString();
  const messages: Array<{
    role: 'assistant' | 'user';
    content: string;
    audioUrl: string | null;
    createdAt: string;
  }> = [
    { role: 'assistant', content: `Hey ${first}, can you walk me through what was happening in this moment?`, audioUrl: null, createdAt: t(0) },
    { role: 'user', content: `It was such a warm afternoon. Everyone had just sat down and we were finally all together in one place.`, audioUrl: '#', createdAt: t(1) },
    { role: 'assistant', content: 'Who else was there with you that day?', audioUrl: null, createdAt: t(2) },
    { role: 'user', content: `My sister, her two kids, and a couple of neighbors who stopped by. We didn't plan it — it just happened.`, audioUrl: '#', createdAt: t(3) },
  ];

  return (
    <WikiCard>
      <div className="flex items-center gap-2 mb-3">
        <AvatarCircle name={personName} avatarUrl={avatarUrl} size={29} />
        <div
          className="rounded-full flex items-center justify-center flex-shrink-0"
          style={{ width: 22, height: 22, background: '#f97316' }}
        >
          <Phone size={12} className="text-white" fill="currentColor" stroke="currentColor" />
        </div>
        <p className="text-white/30 text-xs font-medium">{personName}&apos;s Ember Call</p>
      </div>
      <div className="flex flex-col gap-3">
        {messages.map((msg, i) => {
          const isUser = msg.role === 'user';
          const msgDate = new Date(msg.createdAt);
          const prevMsg = messages[i - 1];
          const prevDate = prevMsg ? new Date(prevMsg.createdAt) : null;
          const showDateDivider = !prevDate || msgDate.toDateString() !== prevDate.toDateString();
          const timeLabel = msgDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
          const dateDividerLabel = msgDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          return (
            <div key={i}>
              {showDateDivider ? (
                <div className="flex justify-center my-2">
                  <span className="text-white/25 text-[10px]">{dateDividerLabel}</span>
                </div>
              ) : null}
              <div className={`flex flex-col gap-0.5 ${isUser ? 'items-end' : 'items-start'}`}>
                <span className="flex items-center gap-1 text-white text-xs font-bold">
                  <Phone size={9} />
                  {isUser ? first : 'ember'}
                </span>
                <div
                  className={`inline-block max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed text-white/80 ${isUser ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
                  style={{
                    background: isUser ? 'rgba(249,115,22,0.18)' : 'var(--bg-ember-bubble)',
                    border: isUser ? '1px solid rgba(249,115,22,0.45)' : '1px solid var(--border-ember)',
                  }}
                >
                  {msg.content}
                  {msg.audioUrl ? (
                    <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-white/10">
                      <a
                        href={msg.audioUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-5 w-5 items-center justify-center rounded-full flex-shrink-0"
                        style={{ background: 'rgba(249,115,22,0.85)' }}
                      >
                        <Play size={9} className="text-white" />
                      </a>
                      <span className="text-white/30 text-xs">Voice recording</span>
                    </div>
                  ) : null}
                </div>
                <span className="text-white/25 text-[10px] mt-0.5">{timeLabel}</span>
              </div>
            </div>
          );
        })}
      </div>
    </WikiCard>
  );
}

function AvatarCircle({
  name,
  avatarUrl,
  size = 32,
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

function formatCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined
) {
  if (latitude == null || longitude == null) {
    return null;
  }

  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
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
  children,
}: {
  icon: React.ReactNode;
  title: string;
  complete: boolean;
  badgeLabel?: React.ReactNode;
  editHref?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span style={{ color: 'var(--text-secondary)' }}>{icon}</span>
          <h3 className="text-white font-medium text-base">{title}</h3>
        </div>
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
      {children}
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
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [locationLookupPending, setLocationLookupPending] = useState(false);
  const contributors = detail?.contributors || [];
  const imageId = detail?.id || null;
  const ownerName = detail?.owner?.name || detail?.owner?.email || null;
  const ownerUserId = detail?.owner?.id;
  const activeContributors = contributors.filter((contributor) => (contributor.userId || contributor.user) && contributor.userId !== ownerUserId && contributor.user?.id !== ownerUserId);
  const pendingContributors = contributors.filter((contributor) => !contributor.userId && !contributor.user);
  const latitude =
    detail?.analysis?.confirmedLocation?.latitude ??
    detail?.analysis?.latitude ??
    null;
  const longitude =
    detail?.analysis?.confirmedLocation?.longitude ??
    detail?.analysis?.longitude ??
    null;
  const coordinateLine = formatCoordinates(latitude, longitude);
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
  const confirmedLocationLine = formatLocationLine(
    detail?.analysis?.confirmedLocation?.label,
    detail?.analysis?.confirmedLocation?.detail
  );
  const exactAddressSuggestion =
    locationSuggestions.find((suggestion) => suggestion.kind === 'address') || null;
  const nearbyPlaceSuggestion =
    locationSuggestions.find((suggestion) => suggestion.kind === 'place') ||
    locationSuggestions.find((suggestion) => suggestion.kind === 'neighborhood') ||
    locationSuggestions.find((suggestion) => suggestion.kind === 'city') ||
    null;
  const exactAddressLine = formatLocationLine(
    exactAddressSuggestion?.label,
    exactAddressSuggestion?.detail
  );
  const fallbackResolvedLocationLine = formatLocationLine(
    nearbyPlaceSuggestion?.label,
    nearbyPlaceSuggestion?.detail
  );
  const primaryLocationLine =
    confirmedLocationLine || fallbackResolvedLocationLine || exactAddressLine;
  const showExactAddress =
    Boolean(exactAddressLine) && exactAddressLine !== primaryLocationLine;

  useEffect(() => {
    if (!imageId || latitude == null || longitude == null) {
      setLocationSuggestions([]);
      setLocationLookupPending(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    async function loadLocationSuggestions() {
      setLocationLookupPending(true);

      try {
        const response = await fetch(`/api/images/${imageId}/location-suggestions`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to load location suggestions');
        }

        const payload = (await response.json()) as {
          suggestions?: LocationSuggestion[];
        };

        if (cancelled) {
          return;
        }

        setLocationSuggestions(
          Array.isArray(payload.suggestions) ? payload.suggestions : []
        );
      } catch (error) {
        if (cancelled || (error instanceof DOMException && error.name === 'AbortError')) {
          return;
        }

        console.error('Failed to resolve wiki location details:', error);
        setLocationSuggestions([]);
      } finally {
        if (!cancelled) {
          setLocationLookupPending(false);
        }
      }
    }

    void loadLocationSuggestions();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [imageId, latitude, longitude]);

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
        complete={Boolean(primaryLocationLine || coordinateLine)}
        editHref={detail?.id ? `/tend/edit-time-place?id=${detail.id}` : undefined}
      >
        <WikiCard>
          <p className="text-white/30 text-xs font-medium mb-1.5">Place</p>
          <p className="text-white font-medium text-sm">
            {primaryLocationLine || 'No location data available.'}
          </p>
          {detail?.analysis?.confirmedLocation?.confirmedAt ? (
            <p className="text-white/30 text-xs mt-1">
              (edited on {new Date(detail.analysis.confirmedLocation.confirmedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })})
            </p>
          ) : null}
          {showExactAddress ? (
            <>
              <p className="text-white/30 text-xs font-medium mt-3 mb-1.5">Exact Address</p>
              <p className="text-white/70 text-sm">{exactAddressLine}</p>
            </>
          ) : null}
          {coordinateLine ? (
            <>
              <p className="text-white/30 text-xs font-medium mt-3 mb-1.5">Coordinates</p>
              <p className="text-white/70 text-sm">{coordinateLine}</p>
            </>
          ) : null}
          {locationLookupPending && !exactAddressLine ? (
            <p className="text-white/30 text-xs mt-3">
              Looking up an address from the photo GPS metadata...
            </p>
          ) : null}
          <p className="text-white/30 text-xs mt-3">
            Source: {detail?.analysis?.confirmedLocation?.confirmedAt
              ? 'Manual entry'
              : (latitude != null && longitude != null)
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
                  contributor.user?.name ||
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

        <WikiCard>
          <p className="text-white/30 text-xs font-medium mb-2">Supporting Media</p>
          {visualAttachments.length > 0 ? (
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
          ) : (
            <p className="text-white/30 text-sm">No supporting media added yet.</p>
          )}
        </WikiCard>
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
      >
        <div className="flex flex-col gap-4">
          {detail?.chatBlocks && detail.chatBlocks.length > 0 ? (
            detail.chatBlocks.map((block) => (
              <Fragment key={block.personName}>
                <WikiCard>
                  <div className="flex items-center gap-2 mb-3">
                    <AvatarCircle name={block.personName} avatarUrl={block.avatarUrl} size={29} />
                    <div
                      className="rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ width: 22, height: 22, background: '#2563eb' }}
                    >
                      <MessageCircle size={12} className="text-white" fill="currentColor" stroke="currentColor" />
                    </div>
                    <p className="text-white/30 text-xs font-medium">{block.personName}&apos;s Ember Chat</p>
                  </div>
                  <div className="flex flex-col gap-3">
                    {block.messages.map((msg, i) => {
                      const isUser = msg.role === 'user';
                      const isVoice = msg.source === 'voice';
                      const msgDate = new Date(msg.createdAt);
                      const prevMsg = block.messages[i - 1];
                      const prevDate = prevMsg ? new Date(prevMsg.createdAt) : null;
                      const showDateDivider = !prevDate || msgDate.toDateString() !== prevDate.toDateString();
                      const timeLabel = Number.isNaN(msgDate.getTime()) ? null : msgDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                      const dateDividerLabel = Number.isNaN(msgDate.getTime()) ? null : msgDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                      return (
                        <div key={i}>
                          {showDateDivider && dateDividerLabel ? (
                            <div className="flex justify-center my-2">
                              <span className="text-white/25 text-[10px]">{dateDividerLabel}</span>
                            </div>
                          ) : null}
                          <div className={`flex flex-col gap-0.5 ${isUser ? 'items-end' : 'items-start'}`}>
                            <span className="flex items-center gap-1 text-white text-xs font-bold">
                              {isVoice ? <Phone size={9} /> : null}
                              {isUser ? block.personName.split(' ')[0] : 'ember'}
                            </span>
                            {msg.imageFilename ? (
                              <div className="max-w-[15%] rounded-xl overflow-hidden">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={`/api/uploads/${msg.imageFilename}`} alt="Uploaded" className="w-full h-auto object-cover" />
                              </div>
                            ) : (
                              <div
                                className={`inline-block max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed text-white/80 ${isUser ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
                                style={{
                                  background: isUser ? 'var(--bg-chat-user)' : 'var(--bg-ember-bubble)',
                                  border: isUser ? 'none' : '1px solid var(--border-ember)',
                                }}
                              >
                                {msg.content}
                                {msg.audioUrl ? (
                                  <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-white/10">
                                    <a
                                      href={msg.audioUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex h-5 w-5 items-center justify-center rounded-full flex-shrink-0"
                                      style={{ background: 'rgba(249,115,22,0.85)' }}
                                    >
                                      <Play size={9} className="text-white" />
                                    </a>
                                    <span className="text-white/30 text-xs">Voice recording</span>
                                  </div>
                                ) : null}
                              </div>
                            )}
                            {timeLabel ? (
                              <span className="text-white/25 text-[10px] mt-0.5">{timeLabel}</span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </WikiCard>
                <DummyEmberCallCard personName={block.personName} avatarUrl={block.avatarUrl} />
              </Fragment>
            ))
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

      <WikiSection icon={<Lightbulb size={17} />} title="Why" complete={false}>
        <PlaceholderWhyCard />
      </WikiSection>

      <WikiSection icon={<Heart size={17} />} title="Emotional state" complete={false}>
        <PlaceholderEmotionalCard />
      </WikiSection>

      <WikiSection icon={<Sparkles size={17} />} title="Extra stories" complete={false}>
        <PlaceholderStoriesCard />
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
                <p className="text-white/30 text-xs mt-4">Source: GPT-4o</p>
              </WikiCard>
            );
          })}
      </WikiSection>

      {detail?.canManage && imageId ? <MemoryReconciliationPanel imageId={imageId} /> : null}

    </div>
  );
}
