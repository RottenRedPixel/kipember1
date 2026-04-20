'use client';

import { useEffect, useState } from 'react';
import {
  Clock,
  FileText,
  History,
  Image as ImageIcon,
  MapPin,
  Mic,
  Phone,
  Play,
  ScanEye,
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
  createdAt: string;
  storyCut?: {
    script: string;
  } | null;
  owner?: {
    id: string;
    name: string | null;
    email: string;
    avatarFilename?: string | null;
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

function normalizeStoryText(value: string | null | undefined) {
  return value?.replace(/\s+/g, ' ').trim().toLowerCase() || '';
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
      const seenConversationEntries = new Set(
        messageEntries
          .map((entry) => {
            const normalizedText = normalizeStoryText(entry.text);
            if (!normalizedText) {
              return null;
            }

            return `${entry.role || 'unknown'}::${normalizedText}`;
          })
          .filter((entry): entry is string => Boolean(entry))
      );
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
          const questionText = response.question.trim();
          const questionKey = `assistant::${normalizeStoryText(questionText)}`;

          if (!seenConversationEntries.has(questionKey)) {
            seenConversationEntries.add(questionKey);
            entries.push({
              id: `response-question-${response.id}`,
              createdAt: response.createdAt,
              role: 'assistant',
              source: response.source || null,
              text: questionText,
            });
          }
        }

        if (response.answer?.trim()) {
          const answerText = response.answer.trim();
          const answerKey = `user::${normalizeStoryText(answerText)}`;

          if (!seenConversationEntries.has(answerKey)) {
            seenConversationEntries.add(answerKey);
            entries.push({
              id: `response-answer-${response.id}`,
              createdAt: response.createdAt,
              role: 'user',
              source: response.source || null,
              text: answerText,
            });
          }
        }

        return entries;
      });
      const voiceCallEntries: typeof messageEntries = [];

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
        icon={<ScanEye size={17} />}
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

      <WikiSection
        icon={<History size={17} />}
        title="Story Circle"
        complete={totalStoryMessages > 0}
      >
        <div className="flex flex-col gap-4">
          {detail?.chatBlocks && detail.chatBlocks.length > 0 ? (
            detail.chatBlocks.map((block) => (
              <WikiCard key={block.personName}>
                <div className="flex items-center gap-2 mb-3">
                  <AvatarCircle name={block.personName} avatarUrl={block.avatarUrl} size={22} />
                  <p className="text-white/30 text-xs font-medium">{block.personName}&apos;s Ember Chat</p>
                </div>
                <div className="flex flex-col gap-3">
                  {block.messages.map((msg, i) => {
                    const isUser = msg.role === 'user';
                    const isVoice = msg.source === 'voice';
                    return (
                      <div key={i} className={`flex flex-col gap-0.5 ${isUser ? 'items-end' : 'items-start'}`}>
                        <span className="flex items-center gap-1 text-white/30 text-xs">
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
                              background: isUser ? 'rgba(255,255,255,0.08)' : 'var(--bg-ember-bubble)',
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
                      </div>
                    );
                  })}
                </div>
              </WikiCard>
            ))
          ) : (
            <WikiCard>
              <p className="text-white/30 text-sm">No conversations yet.</p>
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
        icon={<Users size={17} />}
        title="Tagged People"
        complete={Boolean(detail?.tags && detail.tags.length > 0)}
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

    </div>
  );
}
