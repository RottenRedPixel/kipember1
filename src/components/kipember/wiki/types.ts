// ─── KipemberWikiContent — domain types ──────────────────────────────────────
// Extracted from KipemberWikiContent.tsx (Phase 1 of wiki feature-module split).
// KipemberWikiContent.tsx re-exports the public types from here so all existing
// import paths continue to work without modification.

import type { EmberMediaType } from '@/lib/media';

// ── Internal support types (not exported from the main file) ──────────────────

export type ConversationMessage = {
  id: string;
  role?: string | null;
  content: string;
  createdAt: string;
  source?: string | null;
  questionType?: string | null;
};

export type ConversationResponse = {
  id: string;
  questionType?: string | null;
  question?: string | null;
  answer: string;
  source?: string | null;
  createdAt: string;
};

export type ContributorVoiceCall = {
  id: string;
  createdAt: string;
  startedAt: string | null;
  callSummary: string | null;
  emberSession?: {
    id: string;
    messages: ConversationMessage[];
  } | null;
};

export type AnalysisSceneInsights = {
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

// ── Public exported types ─────────────────────────────────────────────────────

export type KipemberContributor = {
  id: string;
  userId?: string | null;
  name: string | null;
  email: string | null;
  phoneNumber: string | null;
  avatarColor?: string | null;
  inviteSent?: boolean;
  token?: string | null;
  createdAt: string;
  user?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    phoneNumber: string | null;
    avatarFilename?: string | null;
    hasPassword?: boolean;
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

export type KipemberEmberCallClip = {
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

export type KipemberEmberVoiceClip = {
  id: string;
  emberMessageId: string;
  contributorName: string;
  title: string;
  quote: string;
  significance: string | null;
  speaker: string | null;
  audioUrl: string;
  startMs: number;
  endMs: number;
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
  // group as inline toggles — flipping either calls PATCH /api/embers
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
    phoneNumber?: string | null;
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
  emberCallClips?: KipemberEmberCallClip[];
  emberVoiceClips?: KipemberEmberVoiceClip[];
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
