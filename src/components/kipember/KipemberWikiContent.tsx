'use client';

import { useEffect, useState } from 'react';
import {
  BookOpen,
  Clock,
  FileText,
  Image as ImageIcon,
  MapPin,
  Mic,
  Sparkles,
  User,
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
  storyElements?: {
    storyThisImageTells?: string | null;
    emberStory?: string | null;
    whyThisMomentMightMatter?: string | null;
    whatMakesThisPhotoSpecial?: string | null;
    meaningfulDetails?: string | null;
    whatMightHaveHappenedBefore?: string | null;
    whatMightHappenNext?: string | null;
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
  } | null;
  voiceCalls?: ContributorVoiceCall[];
  conversation: {
    messages: ConversationMessage[];
    responses?: ConversationResponse[];
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
  originalName: string;
  description: string | null;
  createdAt: string;
  storyCut?: {
    script: string;
  } | null;
  owner?: {
    id: string;
    name: string | null;
    email: string;
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
    } | null;
  } | null;
  contributors: KipemberContributor[];
  attachments: KipemberAttachment[];
  voiceCallClips?: KipemberVoiceCallClip[];
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
  const story = sceneInsights?.storyElements;

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
  const storyTells = joinDistinct([
    story?.storyThisImageTells,
    story?.emberStory,
    story?.whyThisMomentMightMatter,
    story?.whatMakesThisPhotoSpecial,
    story?.meaningfulDetails,
    analysis?.summary,
  ]).join(' ');

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
      storyTells ||
      story?.whatMightHaveHappenedBefore ||
      story?.whatMightHappenNext
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
    sections.push('**PEOPLE & DEMOGRAPHICS:**');
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

  const storyLines: string[] = [];
  appendAnalysisLine(storyLines, 'What Does This Tell Us?', storyTells);
  appendAnalysisLine(
    storyLines,
    'What Likely Happened Before?',
    story?.whatMightHaveHappenedBefore
  );
  appendAnalysisLine(
    storyLines,
    'What Likely Happened Next?',
    story?.whatMightHappenNext
  );
  if (storyLines.length > 0) {
    sections.push('');
    sections.push('**STORY ELEMENTS:**');
    sections.push(...storyLines);
  }

  return sections.join('\n');
}

function WikiBadge({ complete }: { complete: boolean }) {
  return (
    <span
      className="text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0"
      style={{
        background: complete ? 'rgba(34,197,94,0.15)' : 'rgba(249,115,22,0.15)',
        color: complete ? '#4ade80' : '#f97316',
      }}
    >
      {complete ? 'Complete' : 'Not Complete'}
    </span>
  );
}

function WikiSection({
  icon,
  title,
  complete,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  complete: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span style={{ color: 'var(--text-secondary)' }}>{icon}</span>
          <h3 className="text-white font-medium text-base">{title}</h3>
        </div>
        <WikiBadge complete={complete} />
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
  const contributorChats = contributors
    .map((contributor) => {
      const isOwner = contributor.userId === ownerUserId || contributor.user?.id === ownerUserId;
      const name =
        contributor.name ||
        contributor.user?.name ||
        contributor.email ||
        contributor.user?.email ||
        contributor.phoneNumber ||
        (isOwner ? ownerName : null) ||
        'Contributor';
      const messageEntries = (contributor.conversation?.messages || []).map((message) => ({
        id: `message-${message.id}`,
        createdAt: message.createdAt,
        role: message.role || null,
        source: message.source || null,
        text: message.content,
      }));
      const hasMessages = messageEntries.length > 0;
      const responseEntries = (contributor.conversation?.responses || []).flatMap((response) => {
        const entries: Array<{
          id: string;
          createdAt: string;
          role: string | null;
          source: string | null;
          text: string;
        }> = [];
        const shouldExpandPair = response.source === 'voice' || !hasMessages;

        if (shouldExpandPair && response.question?.trim()) {
          entries.push({
            id: `response-question-${response.id}`,
            createdAt: response.createdAt,
            role: 'assistant',
            source: response.source || null,
            text: response.question.trim(),
          });
        }

        if (response.answer?.trim()) {
          entries.push({
            id: `response-answer-${response.id}`,
            createdAt: response.createdAt,
            role: 'user',
            source: response.source || null,
            text: response.answer.trim(),
          });
        }

        return entries;
      });
      const voiceCallEntries = (contributor.voiceCalls || [])
        .filter((voiceCall) => voiceCall.callSummary?.trim())
        .map((voiceCall) => ({
          id: `voice-call-${voiceCall.id}`,
          createdAt: voiceCall.startedAt || voiceCall.createdAt,
          role: 'system',
          source: 'voice',
          text: voiceCall.callSummary?.trim() || '',
        }));

      const entries = [...voiceCallEntries, ...messageEntries, ...responseEntries]
        .filter((entry) => entry.text.trim().length > 0)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      return { contributorId: contributor.id, isOwner, name: name || 'Contributor', entries };
    })
    .filter((chat) => chat.entries.length > 0);
  const totalStoryMessages = contributorChats.reduce((sum, chat) => sum + chat.entries.length, 0);
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
        icon={<FileText size={17} />}
        title="Title"
        complete={Boolean(detail?.title || detail?.originalName)}
      >
        <WikiCard>
          <p className="text-white/30 text-xs font-medium uppercase tracking-wider">Ember Title</p>
          <p className="text-white font-medium text-base">
            {detail?.title || detail?.originalName || 'Untitled Ember'}
          </p>
          <p className="text-white/30 text-xs">
            Source: {detail?.title ? 'Manual entry' : 'Original upload'}
          </p>
        </WikiCard>
      </WikiSection>

      <WikiSection
        icon={<User size={17} />}
        title="Owner"
        complete={Boolean(ownerName)}
      >
        <WikiCard>
          {ownerName ? (
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
                style={{ background: 'rgba(249,115,22,0.6)' }}
              >
                {initials(ownerName)}
              </div>
              <span className="text-white text-sm font-medium">{ownerName}</span>
              <span className="ml-auto text-white/30 text-xs font-medium">Owner</span>
            </div>
          ) : (
            <p className="text-white/30 text-sm">Owner data is not available.</p>
          )}
        </WikiCard>
      </WikiSection>

      <WikiSection
        icon={<Users size={17} />}
        title="Contributors"
        complete={activeContributors.length > 0 || pendingContributors.length > 0}
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
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
                      style={{ background: 'rgba(255,255,255,0.15)' }}
                    >
                      {initials(contributorName)}
                    </div>
                    <span className="text-white text-sm font-medium">{contributorName}</span>
                    <span className="ml-auto text-white/30 text-xs">Viewer</span>
                  </div>
                );
              })}
              {pendingContributors.map((contributor) => (
                <div key={contributor.id} className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white/30 text-xs font-medium flex-shrink-0"
                    style={{ background: 'rgba(255,255,255,0.08)' }}
                  >
                    {initials(contributor.name || contributor.email || contributor.phoneNumber || '?')}
                  </div>
                  <span className="text-white/60 text-sm">{contributor.name || contributor.email || contributor.phoneNumber || 'Pending'}</span>
                  <span className="ml-auto text-white/30 text-xs">Invited</span>
                </div>
              ))}
            </div>
          )}
        </WikiCard>
      </WikiSection>

      <WikiSection
        icon={<FileText size={17} />}
        title="Snapshot"
        complete={Boolean(detail?.storyCut?.script)}
      >
        <WikiCard>
          {detail?.storyCut?.script ? (
            <p className="text-white/90 text-sm leading-relaxed">{detail.storyCut.script}</p>
          ) : (
            <p className="text-white/30 text-sm">No snapshot yet.</p>
          )}
        </WikiCard>
      </WikiSection>

      <WikiSection
        icon={<BookOpen size={17} />}
        title="Story Circle"
        complete={totalStoryMessages > 0}
      >
        <div className="flex flex-col gap-4">
          {contributorChats.length > 0 ? (
            contributorChats.map((chat, chatIndex) => (
              <div key={chat.contributorId}>
                {chatIndex > 0 && (
                  <div className="mb-4" style={{ borderTop: '1px solid var(--border-subtle)' }} />
                )}
                {/* Participant header */}
                <div className="flex items-center gap-2 px-1 mb-3">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-medium"
                    style={{ background: chat.isOwner ? 'rgba(249,115,22,0.85)' : 'var(--bg-surface)', border: chat.isOwner ? 'none' : '1px solid var(--border-default)' }}
                  >
                    {initials(chat.name)}
                  </div>
                  <span className="text-white/80 text-xs font-medium">{chat.name}</span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: chat.isOwner ? 'rgba(249,115,22,0.15)' : 'var(--bg-surface)', color: chat.isOwner ? 'rgba(249,115,22,0.9)' : 'var(--text-muted)', border: chat.isOwner ? '1px solid rgba(249,115,22,0.25)' : '1px solid var(--border-subtle)' }}
                  >
                    {chat.isOwner ? 'owner' : 'contributor'}
                  </span>
                </div>
                {/* Messages */}
                <div className="flex flex-col gap-2 px-1">
                  {chat.entries.map((message) => {
                    const isAi = message.role === 'assistant' || message.source === 'ai';
                    const isSystem = message.role === 'system';
                    return (
                      <div
                        key={message.id}
                        className={`flex flex-col gap-1 ${
                          isSystem ? 'items-center' : isAi ? 'items-start' : 'items-end'
                        }`}
                      >
                        <div className={`flex items-center gap-1.5 ${isAi ? '' : 'flex-row-reverse'}`}>
                          <span className="text-white/40 text-xs font-medium">
                            {isSystem ? 'Summary' : isAi ? 'ember' : 'you'}
                          </span>
                          <span className="text-white/20 text-xs">
                            {formatLongDate(message.createdAt)}
                          </span>
                        </div>
                        <div
                          className={`max-w-[85%] px-4 py-2.5 text-sm leading-relaxed text-white/90 ${
                            isSystem
                              ? 'rounded-2xl'
                              : isAi
                                ? 'rounded-2xl rounded-tl-sm'
                                : 'rounded-2xl rounded-tr-sm'
                          }`}
                          style={
                            isSystem
                              ? { background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.28)' }
                              : isAi
                              ? { background: 'var(--bg-ember-bubble)', border: '1px solid var(--border-ember)' }
                              : { background: 'var(--bg-chat-user)' }
                          }
                        >
                          {message.text}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            <WikiCard>
              <p className="text-white/30 text-sm">No story messages yet.</p>
            </WikiCard>
          )}
        </div>
      </WikiSection>

      <WikiSection
        icon={<ImageIcon size={17} />}
        title="Photos"
        complete={Boolean(detail?.originalName || visualAttachments.length)}
      >
        <WikiCard>
          <p className="text-white/30 text-xs font-medium mb-2">Ember Image</p>
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
                {detail?.title ? `Display title: ${detail.title}` : 'Primary Ember media'}
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

      <WikiSection
        icon={<MapPin size={17} />}
        title="Location"
        complete={Boolean(primaryLocationLine || coordinateLine)}
      >
        <WikiCard>
          <p className="text-white/30 text-xs font-medium mb-1.5">Location</p>
          <p className="text-white font-medium text-sm">
            {primaryLocationLine || 'No location data available.'}
          </p>
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
        </WikiCard>
      </WikiSection>

      <WikiSection
        icon={<Clock size={17} />}
        title="Time & Date"
        complete={Boolean(detail?.analysis?.capturedAt || detail?.createdAt)}
      >
        <WikiCard>
          <p className="text-white/30 text-xs font-medium mb-1.5">Photo Timestamp</p>
          <p className="text-white font-medium text-sm">
            {formatLongDate(detail?.analysis?.capturedAt || detail?.createdAt)}
          </p>
        </WikiCard>
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
          <p className="text-white/30 text-xs font-medium mb-2">AI Image Analysis</p>
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
                    className={isBold ? 'text-white/60 text-sm font-medium mt-2' : 'text-white/60 text-sm leading-relaxed'}
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
      </WikiSection>

    </div>
  );
}
