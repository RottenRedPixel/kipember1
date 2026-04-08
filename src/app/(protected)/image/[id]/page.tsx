'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ContributorList from '@/components/ContributorList';
import TagManager from '@/components/TagManager';
import InteractiveImageTagger from '@/components/InteractiveImageTagger';
import ImageAttachmentGallery from '@/components/ImageAttachmentGallery';
import EmberActivityView from '@/components/EmberActivityView';
import MemoryTellMoreActions from '@/components/MemoryTellMoreActions';
import AutoTagPrompt from '@/components/AutoTagPrompt';
import LocationSuggestionPrompt from '@/components/LocationSuggestionPrompt';
import WikiView from '@/components/WikiView';
import WikiVoiceClipSection from '@/components/WikiVoiceClipSection';
import { getEmberTitle } from '@/lib/ember-title';
import type { RetellWebClient } from 'retell-client-js-sdk';
import MediaPreview from '@/components/MediaPreview';
import ClipAudioPlayer from '@/components/ClipAudioPlayer';
import { getPreviewMediaUrl } from '@/lib/media';
import type { NarrationPreference } from '@/lib/elevenlabs';

interface ImageRecord {
  id: string;
  filename: string;
  mediaType: 'IMAGE' | 'VIDEO';
  posterFilename: string | null;
  durationSeconds: number | null;
  originalName: string;
  title: string | null;
  description: string | null;
  createdAt: string;
  shareToNetwork: boolean;
  accessType: 'owner' | 'contributor' | 'network';
  canManage: boolean;
  currentUserId: string;
  viewerContributorId: string | null;
  viewerCanLeave: boolean;
  owner: {
    id: string;
    name: string | null;
    email: string;
  };
  contributors: {
    id: string;
    phoneNumber: string | null;
    email: string | null;
    name: string | null;
    userId: string | null;
    token: string;
    inviteSent: boolean;
    createdAt: string;
    user: {
      id: string;
      name: string | null;
      email: string;
      phoneNumber: string | null;
    } | null;
    conversation: {
      status: string;
      currentStep: string;
      messages: {
        id: string;
        role: string;
        content: string;
        source: string;
        createdAt: string;
      }[];
      responses: {
        id: string;
        questionType: string;
        question: string;
        answer: string;
        source: string;
        createdAt: string;
      }[];
    } | null;
    voiceCalls: {
      id: string;
      status: string;
      startedAt: string | null;
      endedAt: string | null;
      createdAt: string;
      callSummary: string | null;
      initiatedBy: string;
      memorySyncedAt: string | null;
    }[];
  }[];
  ownerConversationTarget: {
    id: string;
    phoneNumber: string | null;
    token: string;
    user: {
      id: string;
      name: string | null;
      email: string;
      phoneNumber: string | null;
    } | null;
    voiceCalls: {
      id: string;
      status: string;
      startedAt: string | null;
      endedAt: string | null;
      createdAt: string;
      callSummary: string | null;
      initiatedBy: string;
      memorySyncedAt: string | null;
    }[];
  } | null;
  tags: {
    id: string;
    label: string;
    email: string | null;
    phoneNumber: string | null;
    leftPct: number | null;
    topPct: number | null;
    widthPct: number | null;
    heightPct: number | null;
    userId: string | null;
    contributorId: string | null;
    user: {
      id: string;
      name: string | null;
      email: string;
      phoneNumber: string | null;
    } | null;
    contributor: {
      id: string;
      name: string | null;
      email: string | null;
      phoneNumber: string | null;
      inviteSent: boolean;
    } | null;
  }[];
  attachments: {
    id: string;
    filename: string;
    mediaType: 'IMAGE' | 'VIDEO' | 'AUDIO';
    posterFilename: string | null;
    durationSeconds: number | null;
    originalName: string;
    description: string | null;
    createdAt: string;
    updatedAt: string;
  }[];
  analysis: {
    status: string;
    summary: string | null;
    visualDescription: string | null;
    metadataSummary: string | null;
    capturedAt: string | null;
    latitude: number | null;
    longitude: number | null;
    cameraMake: string | null;
    cameraModel: string | null;
    lensModel: string | null;
    confirmedLocation: {
      label: string;
      detail: string | null;
      kind: string;
      confirmedAt: string;
    } | null;
    updatedAt: string;
  } | null;
  voiceCallClips: {
    id: string;
    voiceCallId: string;
    contributorId: string;
    contributorUserId: string | null;
    contributorName: string;
    title: string;
    quote: string;
    significance: string | null;
    speaker: string | null;
    audioUrl: string | null;
    startMs: number | null;
    endMs: number | null;
    canUseForTitle: boolean;
    createdAt: string;
  }[];
  friends: {
    id: string;
    name: string | null;
    email: string;
    phoneNumber: string | null;
  }[];
  tagIdentities: {
    id: string;
    label: string;
    email: string;
    phoneNumber: string;
    userId: string | null;
    contributorId: string | null;
  }[];
  wiki: {
    id: string;
    content: string;
    version: number;
    updatedAt: string;
  } | null;
  storyCut: {
    id: string;
    title: string;
    style: string;
    focus: string | null;
    durationSeconds: number;
    wordCount: number;
    script: string;
    blocks: Array<{
      type: 'media' | 'voice';
      mediaId?: string | null;
      mediaName?: string | null;
      mediaUrl?: string | null;
      mediaType?: 'IMAGE' | 'VIDEO' | 'AUDIO' | null;
      clipStartMs?: number | null;
      clipEndMs?: number | null;
      clipQuote?: string | null;
      speaker?: string | null;
      content?: string | null;
      voicePreference?: string | null;
      messageId?: string | null;
      userId?: string | null;
      order: number;
    }>;
    metadata: {
      focus?: string;
      emberTitle?: string;
      styleApplied?: string;
      totalContributors?: number;
      hasDirectQuotes?: boolean;
    } | null;
    selectedMediaIds: string[];
    selectedContributorIds: string[];
    includeOwner: boolean;
    includeEmberVoice: boolean;
    includeNarratorVoice: boolean;
    emberVoiceId: string | null;
    emberVoiceLabel: string | null;
    narratorVoiceId: string | null;
    narratorVoiceLabel: string | null;
    updatedAt: string;
  } | null;
  sportsMode: {
    id: string;
    sportType: string | null;
    subjectName: string | null;
    finalScore: string | null;
    outcome: string | null;
    updatedAt: string;
  } | null;
}

type IconProps = {
  className?: string;
};

type ActivePanel =
  | 'ask'
  | 'contributors'
  | 'memoryEntry'
  | 'shape'
  | 'share'
  | 'play'
  | 'storyCuts'
  | 'wiki'
  | null;
type ShapeView =
  | 'menu'
  | 'storyCircle'
  | 'tag'
  | 'addContent'
  | 'editTitle'
  | 'editCaption'
  | 'location'
  | 'timeDate'
  | 'analysis'
  | 'activity';

type LocationSuggestionOption = {
  id: string;
  label: string;
  detail: string | null;
  kind: string;
};

type StoryCutMediaItem = {
  id: string;
  label: string;
  kind: 'cover' | 'supporting' | 'voiceClip';
  previewUrl: string | null;
  mediaType: 'IMAGE' | 'VIDEO' | 'AUDIO';
  quote?: string | null;
  significance?: string | null;
  contributorName?: string | null;
  startMs?: number | null;
  endMs?: number | null;
};

type StoryCircleAnswer = {
  id: string;
  questionType: string;
  question: string;
  answer: string;
  source: string;
  createdAt: string;
};

type StoryCutStyle =
  | 'documentary'
  | 'publicRadio'
  | 'newsReport'
  | 'podcastNarrative'
  | 'movieTrailer';

type StoryCutBlock =
  | {
      type: 'media';
      mediaId: string | null;
      mediaName: string | null;
      mediaUrl: string | null;
      mediaType: 'IMAGE' | 'VIDEO' | 'AUDIO' | null;
      clipStartMs?: number | null;
      clipEndMs?: number | null;
      clipQuote?: string | null;
      order: number;
    }
  | {
      type: 'voice';
      speaker: string | null;
      content: string | null;
      voicePreference: string | null;
      messageId: string | null;
      userId: string | null;
      order: number;
    };

type StoryCutResult = {
  title: string;
  style: string;
  duration: number;
  wordCount: number;
  script: string;
  blocks: StoryCutBlock[];
  emberVoiceLines: string[];
  narratorVoiceLines: string[];
  ownerLines: string[];
  contributorLines: string[];
  metadata: {
    focus: string;
    emberTitle: string;
    styleApplied: string;
    totalContributors: number;
    hasDirectQuotes: boolean;
  };
};

type StoryCutVoiceOption = {
  voiceId: string;
  name: string;
  label: string;
  category: string | null;
};

type AskMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type AskVoiceClip = {
  id: string;
  contributorName: string;
  title: string;
  quote: string;
  significance: string | null;
  audioUrl: string | null;
  startMs: number | null;
  endMs: number | null;
};

const STORY_CIRCLE_STEPS = ['context', 'who', 'when', 'where', 'what', 'why', 'how'] as const;
const STORY_CUT_STYLE_OPTIONS: Array<{ value: StoryCutStyle; label: string }> = [
  { value: 'documentary', label: 'Documentary' },
  { value: 'publicRadio', label: 'Public Radio' },
  { value: 'newsReport', label: 'News Report' },
  { value: 'podcastNarrative', label: 'Podcast Narrative' },
  { value: 'movieTrailer', label: 'Movie Trailer' },
];
const STORY_CUT_DURATION_OPTIONS = [5, 20, 35, 50, 60] as const;
const SMART_CAPTION_VOICE_OPTIONS = ['Susan', 'Sarah', 'Roger', 'Ember'] as const;

function isStoryCutVoiceBlock(block: StoryCutBlock): block is Extract<StoryCutBlock, { type: 'voice' }> {
  return block.type === 'voice';
}

function isStoryCutAudioBlock(block: StoryCutBlock): block is Extract<StoryCutBlock, { type: 'media' }> {
  return block.type === 'media' && block.mediaType === 'AUDIO';
}

function normalizeStoryCutMediaToken(value: string | null | undefined) {
  return (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function GeminiIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 200 200" fill="none" className={className} aria-hidden="true">
      <path
        d="m99.5 5h-0.04c-40 0-73.75 32.61-73.75 74.81 0 40.17 33.12 73.57 73.7 73.57h0.05c40.45 0 74.25-33.1 74.25-73.69 0-40.27-32.99-74.69-74.21-74.69zm-0.09 143.2h-0.04c-37.75 0-68.66-31.32-68.66-68.47 0-36.5 30.7-69.99 68.75-69.99h0.04c38.21 0 69.81 31.65 69.81 69.76 0 37.32-31.99 68.7-69.9 68.7z"
        fill="currentColor"
      />
      <path
        d="m134.9 78.22c-8.01-1.78-18.36-3.73-24.87-10.94-5.42-6.02-7.27-14.05-8.79-23.46-0.49-3.06-2.77-3.67-3.47-0.07-2.08 10.14-4.98 20.5-13.11 26.28-5.78 4.26-11.76 6.28-19 7.83-2.78 0.6-3.37 2.62-0.47 3.11 10.36 1.86 20.27 5.2 25.26 12.86 4.01 6.16 5.92 12.5 7.44 20.87 0.57 3.16 2.86 2.54 3.1 0.16 1.52-10.03 5.28-20.02 13.17-25.35 6.26-4.2 12.97-6.03 20.74-8.25 2.53-0.77 2.76-2.42 0-3.04z"
        fill="currentColor"
      />
      <path
        d="m67.19 52.96c2.62-0.6 5.03-0.9 7.22-3.36 1.77-2.03 2.25-4.34 2.7-7.39 0.12-0.83 0.64-0.83 0.8 0 0.6 3.17 1.04 6.04 3.45 7.78 1.77 1.23 3.62 1.79 5.02 2.15 0.74 0.2 0.38 0.99-0.2 1.15-2.77 0.8-5.75 1.12-7.31 3.91-1.04 1.98-1.36 3.45-1.76 5.61-0.16 0.8-0.69 0.72-0.8 0.04-0.68-3.93-1.67-7.39-5.3-8.8-0.97-0.38-2.1-0.68-3.7-1.08-0.6-0.16-0.68 0.12-0.12-0.01z"
        fill="currentColor"
      />
    </svg>
  );
}

function PlayIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 200 200" fill="none" className={className} aria-hidden="true">
      <path
        d="m99.22 5c-39.01 0-70.72 31.71-70.72 71.64 0 39.13 31.11 70.39 70.72 70.39 39.32 0 70.78-31.64 70.78-70.75 0-38.64-30.81-71.28-70.78-71.28zm-0.03 137.4c-36.48 0-65.43-29.93-65.43-65.88 0-36.05 29.31-67.15 65.46-67.15 36.56 0 66.49 28.95 66.49 66.51 0 35.89-29.72 66.52-66.52 66.52z"
        fill="currentColor"
      />
      <path
        d="m127.4 72.57-38.51-24.38c-3.39-2.12-6.64-0.29-6.64 3.86v47.35c0 4.15 3.6 5.79 6.56 3.79l38.55-23.13c3.43-2.12 3.07-5.62 0.04-7.49z"
        fill="currentColor"
      />
    </svg>
  );
}

function CircleIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 200 200" fill="none" className={className} aria-hidden="true">
      <path
        d="m99.5 5c-40 0-72.23 32.71-72.23 73.69 0 40.59 31.96 71.8 71.85 71.8 40.16 0 73.19-32.2 73.19-71.8 0-39.88-31.64-73.69-72.81-73.69zm-0.22 4.49c37.63 0 68.78 30.5 68.78 68.94 0 37.29-30.84 67.47-69 67.47-37.22 0-66.84-30.43-66.84-67.09 0-37.65 30.23-69.32 67.06-69.32z"
        fill="currentColor"
      />
      <path
        d="m117 49.14c-9.04 0-14.54 6.6-16.95 10.62-2.41-4.02-7.91-10.45-16.95-10.45-11.15 0-19.8 8.81-19.8 20.12 0 14.33 15.97 27.46 36.75 44.85 20.88-17.73 36.84-30.86 36.84-44.85-0.09-10.69-8.45-20.29-19.89-20.29z"
        fill="currentColor"
      />
    </svg>
  );
}

function ShareIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 200 200" fill="none" className={className} aria-hidden="true">
      <path
        d="m100 5c-39.73 0-72.73 32.73-72.73 74.01 0 40.58 32.22 71.45 71.84 71.45 40.33 0 73.25-31.85 73.25-71.83 0-39.82-32.35-73.63-72.36-73.63zm-0.49 140.8c-37.19 0-67.09-30.37-67.09-67.28 0-36.39 30.39-68.93 67.89-68.93 36.82 0 67.93 30.25 67.93 68.36 0 36.98-30.86 67.85-68.73 67.85z"
        fill="currentColor"
      />
      <path
        d="m121.9 41.19c-8.09 0-13.69 7.27-13.07 16.05l-20.8 12.07c-3.07-2.92-5.7-4.1-9.64-4.1-7.71 0-12.86 6.17-12.86 13.18 0 7.38 6.41 12.88 12.76 12.77 4.72-0.08 7.35-1.9 9.83-4.18l21.09 11.13c-1.39 7.99 4.6 16.28 12.69 16.28 7.85 0 13.04-6.66 13.04-12.67 0-7.55-5.99-12.9-12.67-12.9-5.17 0-8.17 2.71-10.29 4.44l-21.29-12c0.46-3.35 0.07-4.17-0.06-5.96l21.02-12.12c3.27 3.63 6.55 4.53 10.06 4.53 7.45 0 13.09-6.29 13.09-12.95 0-7.14-5.73-13.57-12.9-13.57z"
        fill="currentColor"
      />
    </svg>
  );
}

function CloseIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M6 6 18 18" />
      <path d="M18 6 6 18" />
    </svg>
  );
}

function HomeIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="m4.5 10.5 7.5-6 7.5 6" />
      <path d="M7.5 10.5v8h9v-8" />
    </svg>
  );
}

function ExpandIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M8 4.5H4.5V8" />
      <path d="M16 4.5h3.5V8" />
      <path d="M4.5 16V19.5H8" />
      <path d="M16 19.5h3.5V16" />
    </svg>
  );
}

function SetupCardIcon({
  name,
  className = 'h-5 w-5',
}: {
  name:
    | 'storyCuts'
    | 'storyCircle'
    | 'title'
    | 'location'
    | 'timeDate'
    | 'taggedPeople'
    | 'supportingMedia'
    | 'analysis'
    | 'contributors';
  className?: string;
}) {
  switch (name) {
    case 'storyCuts':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <path d="M4.5 7.5h15" />
          <path d="M7 4.5v6" />
          <path d="M17 4.5v6" />
          <path d="M5.5 12.5h13" />
          <path d="M8.5 15.5h7" />
        </svg>
      );
    case 'storyCircle':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <path d="M5 6.5h14v9H9l-4 3v-12Z" />
        </svg>
      );
    case 'title':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <path d="M5 6h14" />
          <path d="M12 6v12" />
          <path d="M8 18h8" />
        </svg>
      );
    case 'location':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <path d="M12 20s5.5-5.54 5.5-10A5.5 5.5 0 1 0 6.5 10c0 4.46 5.5 10 5.5 10Z" />
          <circle cx="12" cy="10" r="1.9" />
        </svg>
      );
    case 'timeDate':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <path d="M7 4.5v3" />
          <path d="M17 4.5v3" />
          <rect x="4.5" y="6.5" width="15" height="13" rx="2" />
          <path d="M4.5 10h15" />
        </svg>
      );
    case 'taggedPeople':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <circle cx="9" cy="9" r="2.5" />
          <path d="M4.5 17c1-2.3 2.8-3.5 5-3.5 2.15 0 3.95 1.2 5 3.5" />
          <path d="m16 8.5 1.5 1.5L20.5 7" />
        </svg>
      );
    case 'supportingMedia':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <rect x="4.5" y="5" width="15" height="14" rx="2" />
          <circle cx="9" cy="10" r="1.2" />
          <path d="m7 16 3.2-3.2 2.2 2.2 3.6-4.1L18 13.2V16Z" />
        </svg>
      );
    case 'analysis':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <path d="m12 5 1.5 3.5L17 10l-3.5 1.5L12 15l-1.5-3.5L7 10l3.5-1.5Z" />
          <path d="M18.5 5.5v2" />
          <path d="M4 13.5h2" />
        </svg>
      );
    case 'contributors':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <circle cx="9" cy="8.5" r="2.4" />
          <circle cx="16.5" cy="9.5" r="1.9" />
          <path d="M4.5 17c1.2-2.3 3-3.5 5.1-3.5 2.1 0 3.9 1.2 5.1 3.5" />
        </svg>
      );
  }
}

function HeroRailButton({
  icon,
  label,
  onClick,
  tone,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  tone: 'light' | 'dark';
}) {
  void tone;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center rounded-[0.72rem] px-1 py-1.5 text-white transition hover:bg-white/8"
      aria-label={label}
    >
      <span className="flex min-w-[3.15rem] flex-col items-center justify-center gap-1">
        <span className="flex h-10 w-10 items-center justify-center">
          {icon}
        </span>
        <span className="text-[0.7rem] font-semibold leading-none tracking-[-0.02em]">
          {label}
        </span>
      </span>
    </button>
  );
}

function AskMicIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className}>
      <path d="M12 4.8a2.8 2.8 0 0 1 2.8 2.8v4.8a2.8 2.8 0 1 1-5.6 0V7.6A2.8 2.8 0 0 1 12 4.8Z" />
      <path d="M7.5 11.8a4.5 4.5 0 0 0 9 0" />
      <path d="M12 16.3v3.1" />
      <path d="M9.2 19.4h5.6" />
    </svg>
  );
}

function AskPlusIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function AskVoiceWaveform() {
  const bars = [14, 26, 18, 34, 22, 40, 28, 46, 31, 42, 24, 38, 26, 44, 30, 36, 22, 32, 18];

  return (
    <div className="flex items-end justify-center gap-[0.26rem] px-2 py-3">
      {bars.map((height, index) => (
        <span
          key={`${height}-${index}`}
          className="inline-block w-[0.24rem] rounded-full bg-white animate-pulse"
          style={{
            height: `${height}px`,
            animationDelay: `${index * 80}ms`,
            animationDuration: '1100ms',
          }}
        />
      ))}
    </div>
  );
}

function StopCircleIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.8" />
      <rect x="9.3" y="9.3" width="5.4" height="5.4" rx="0.8" fill="currentColor" />
    </svg>
  );
}

function AskEmberExperience({
  imageId,
  emberTitle,
  ownerLabel,
  subjectNoun,
  mediaType,
  filename,
  posterFilename,
  titleTone,
  railTone,
  hasRecordedContributions,
  importantVoiceClips,
  phoneCallAvailable,
  expanded,
  onExpandedChange,
  onRequestPhoneCall,
  onStoredMemory,
  onClose,
  onOpenShare,
  onOpenTend,
  onOpenPlay,
}: {
  imageId: string;
  emberTitle: string;
  ownerLabel: string;
  subjectNoun: 'photo' | 'video';
  mediaType: 'IMAGE' | 'VIDEO';
  filename: string;
  posterFilename: string | null;
  titleTone: 'light' | 'dark';
  railTone: 'light' | 'dark';
  hasRecordedContributions: boolean;
  importantVoiceClips: AskVoiceClip[];
  phoneCallAvailable: boolean;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onRequestPhoneCall: () => Promise<void>;
  onStoredMemory: () => void;
  onClose: () => void;
  onOpenShare: () => void;
  onOpenTend: () => void;
  onOpenPlay: () => void;
}) {
  const [messages, setMessages] = useState<AskMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [savedMemoryNotice, setSavedMemoryNotice] = useState('');
  const [pendingAttachmentFiles, setPendingAttachmentFiles] = useState<File[]>([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<unknown>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const pendingFocusRef = useRef(false);
  const listeningTranscriptRef = useRef('');

  const shouldShowExpanded = expanded || isListening;
  const shouldShowStarterPrompt = !hasRecordedContributions && messages.length === 0;
  const featuredVoiceClips = importantVoiceClips.slice(0, 3);

  useEffect(() => {
    if (!savedMemoryNotice) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSavedMemoryNotice('');
    }, 3200);

    return () => window.clearTimeout(timeoutId);
  }, [savedMemoryNotice]);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const response = await fetch(`/api/chat?imageId=${encodeURIComponent(imageId)}`);
        if (!response.ok) {
          return;
        }

        const data = await response.json();
        if (Array.isArray(data.messages)) {
          setMessages(data.messages);
          if (data.messages.length > 0) {
            onExpandedChange(true);
          }
        }
      } catch (error) {
        console.error('Failed to load ask history:', error);
      }
    };

    void loadHistory();
  }, [imageId, onExpandedChange]);

  useEffect(() => {
    if (!shouldShowExpanded) {
      return;
    }

    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, shouldShowExpanded]);

  useEffect(() => {
    if (!pendingFocusRef.current || !shouldShowExpanded) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      pendingFocusRef.current = false;
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [shouldShowExpanded]);

  useEffect(() => {
    return () => {
      const recognition = recognitionRef.current as
        | {
            stop?: () => void;
            abort?: () => void;
          }
        | null;

      recognition?.stop?.();
      recognition?.abort?.();
      mediaRecorderRef.current?.stop();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const resetPendingAttachments = useCallback(() => {
    setPendingAttachmentFiles([]);
    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = '';
    }
  }, []);

  const describePendingAttachments = useCallback((files: File[]) => {
    if (files.length === 0) {
      return 'this media';
    }

    if (files.length > 1) {
      return `these ${files.length} files`;
    }

    const file = files[0];
    const mimeType = file.type.toLowerCase();

    if (mimeType.startsWith('image/')) {
      return 'this photo';
    }

    if (mimeType.startsWith('video/')) {
      return 'this clip';
    }

    if (mimeType.startsWith('audio/')) {
      return 'this audio clip';
    }

    return 'this file';
  }, []);

  const uploadPendingAttachments = useCallback(async () => {
    if (pendingAttachmentFiles.length === 0 || uploadingAttachments) {
      return;
    }

    setUploadingAttachments(true);
    setVoiceError('');

    const filesToUpload = [...pendingAttachmentFiles];
    const filesLabel = describePendingAttachments(filesToUpload);
    const formData = new FormData();
    filesToUpload.forEach((file) => {
      formData.append('files', file);
    });

    try {
      const response = await fetch(`/api/images/${imageId}/attachments`, {
        method: 'POST',
        body: formData,
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to add supporting media');
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `I added ${filesLabel} to your ember as supporting media.`,
        },
      ]);
      setSavedMemoryNotice(`Added ${filesLabel} to this ember.`);

      const warnings = Array.isArray(payload?.warnings)
        ? payload.warnings.filter((warning: unknown): warning is string => typeof warning === 'string')
        : [];

      if (warnings.length > 0) {
        setVoiceError(warnings.join(' '));
      }

      resetPendingAttachments();
      onStoredMemory();
    } catch (error) {
      setVoiceError(error instanceof Error ? error.message : 'Failed to add supporting media');
    } finally {
      setUploadingAttachments(false);
    }
  }, [
    describePendingAttachments,
    imageId,
    onStoredMemory,
    pendingAttachmentFiles,
    resetPendingAttachments,
    uploadingAttachments,
  ]);

  const handleAttachmentSelection = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(event.target.files || []).filter((file) => file.size > 0);

      if (selectedFiles.length === 0) {
        return;
      }

      setPendingAttachmentFiles(selectedFiles);
      setSavedMemoryNotice('');
      pendingFocusRef.current = false;
      onExpandedChange(true);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Do you want to add ${describePendingAttachments(selectedFiles)} to your ember?`,
        },
      ]);
    },
    [describePendingAttachments, onExpandedChange]
  );

  const persistVoiceNote = useCallback(
    async (audioBlob: Blob, transcript: string) => {
      const mimeType = audioBlob.type || 'audio/webm';
      const ext = mimeType.includes('mp4')
        ? 'm4a'
        : mimeType.includes('ogg')
          ? 'ogg'
          : mimeType.includes('mpeg')
            ? 'mp3'
            : 'webm';
      const file = new File([audioBlob], `ask-ember-${Date.now()}.${ext}`, {
        type: mimeType,
      });
      const formData = new FormData();
      formData.append('imageId', imageId);
      formData.append('file', file);
      if (transcript.trim()) {
        formData.append('transcript', transcript.trim());
      }

      const response = await fetch('/api/chat/audio', {
        method: 'POST',
        body: formData,
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to save Ask voice note');
      }

      return payload;
    },
    [imageId]
  );

  const submitMessage = useCallback(
    async (
      rawMessage: string,
      source: 'text' | 'voice' = 'text',
      audioBlob?: Blob | null
    ) => {
      const userMessage = rawMessage.trim();
      if ((!userMessage && !audioBlob) || isLoading) {
        return;
      }

      if (pendingAttachmentFiles.length > 0 && userMessage) {
        const normalized = userMessage.trim().toLowerCase();
        const confirmsUpload = /^(yes|yep|yeah|sure|ok|okay|add|upload|save|include|do it)\b/.test(
          normalized
        );
        const cancelsUpload = /^(no|nope|cancel|skip|not now|don't|do not)\b/.test(normalized);

        if (confirmsUpload) {
          setInput('');
          setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
          await uploadPendingAttachments();
          return;
        }

        if (cancelsUpload) {
          const filesLabel = describePendingAttachments(pendingAttachmentFiles);
          setInput('');
          setMessages((prev) => [
            ...prev,
            { role: 'user', content: userMessage },
            {
              role: 'assistant',
              content: `Okay, I won't add ${filesLabel} right now.`,
            },
          ]);
          resetPendingAttachments();
          return;
        }
      }

      if (!hasRecordedContributions && messages.length === 0 && userMessage) {
        const normalized = userMessage.trim().toLowerCase();
        const confirmsPhoneCall =
          /^(yes|yeah|yep|sure|ok|okay)\b/.test(normalized) ||
          /\b(call me|phone call|call my phone|have ember call|have ember call me)\b/.test(
            normalized
          );

        if (confirmsPhoneCall) {
          setInput('');
          setVoiceError('');
          setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
          setIsLoading(true);

          try {
            await onRequestPhoneCall();
            setMessages((prev) => [
              ...prev,
              {
                role: 'assistant',
                content:
                  'Ember is calling your phone now. If you want, you can also keep adding details here by chat.',
              },
            ]);
          } catch (error) {
            setVoiceError(
              error instanceof Error ? error.message : 'Failed to start the phone call'
            );
          } finally {
            setIsLoading(false);
          }

          return;
        }
      }

      setInput('');
      setVoiceError('');
      if (userMessage) {
        setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
      }
      setIsLoading(true);
      onExpandedChange(true);

      try {
        let savedAudio = false;
        let audioSaveWarning = '';
        let resolvedMessage = userMessage;

        if (source === 'voice' && audioBlob && audioBlob.size > 0) {
          try {
            const persistedAudio = await persistVoiceNote(audioBlob, userMessage);
            savedAudio = true;
            if (!resolvedMessage && typeof persistedAudio?.transcript === 'string') {
              resolvedMessage = persistedAudio.transcript.trim();
            }
          } catch (audioError) {
            audioSaveWarning =
              audioError instanceof Error ? audioError.message : 'Failed to save voice note.';
          }
        }

        if (!resolvedMessage) {
          if (savedAudio) {
            setSavedMemoryNotice('Saved voice note to this ember.');
            onStoredMemory();
          }
          if (audioSaveWarning) {
            setVoiceError(audioSaveWarning);
          }
          return;
        }

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageId,
            message: resolvedMessage,
            inputMode: source,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to get response');
        }

        const data = await response.json();
        setMessages((prev) => [...prev, { role: 'assistant', content: data.response }]);

        if (data?.storedMemory?.saved || savedAudio) {
          const summary =
            typeof data.storedMemory.summary === 'string' ? data.storedMemory.summary.trim() : '';
          const savedParts = [
            summary ? `Saved to this ember: ${summary}` : data?.storedMemory?.saved ? 'Saved to this ember.' : '',
            savedAudio ? 'Voice note stored.' : '',
          ].filter(Boolean);
          setSavedMemoryNotice(savedParts.join(' '));
          onStoredMemory();
        }
        if (audioSaveWarning) {
          setVoiceError(audioSaveWarning);
        }
      } catch (error) {
        console.error('Ask Ember error:', error);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `Sorry, I couldn't answer that about this ${subjectNoun} right now.`,
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [
      describePendingAttachments,
      imageId,
      isLoading,
      onExpandedChange,
      onStoredMemory,
      pendingAttachmentFiles,
      persistVoiceNote,
      resetPendingAttachments,
      subjectNoun,
      hasRecordedContributions,
      messages.length,
      onRequestPhoneCall,
      uploadPendingAttachments,
    ]
  );

  const prefersServerSideVoiceTranscription = useMemo(() => {
    if (typeof navigator === 'undefined') {
      return false;
    }

    const ua = navigator.userAgent || '';
    const platform = navigator.platform || '';
    const maxTouchPoints = navigator.maxTouchPoints || 0;
    const isIOS =
      /iPad|iPhone|iPod/i.test(ua) || (platform === 'MacIntel' && maxTouchPoints > 1);
    const isSafari =
      /Safari/i.test(ua) &&
      !/Chrome|CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|SamsungBrowser/i.test(ua);

    return isIOS || isSafari;
  }, []);

  const handleVoiceToggle = useCallback(() => {
    const recognition = recognitionRef.current as
      | {
          stop?: () => void;
        }
      | null;

    if (isListening) {
      if (recognition?.stop) {
        recognition.stop();
      } else if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      return;
    }

    type InlineSpeechRecognition = {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onstart: (() => void) | null;
      onerror: ((event: { error?: string }) => void) | null;
      onresult:
        | ((event: {
            results: ArrayLike<ArrayLike<{ transcript: string }>>;
          }) => void)
        | null;
      onend: (() => void) | null;
      start: () => void;
      stop: () => void;
    };

    const browserWindow = typeof window !== 'undefined' ? (window as Window & {
      SpeechRecognition?: new () => InlineSpeechRecognition;
      webkitSpeechRecognition?: new () => InlineSpeechRecognition;
    }) : null;

    const SpeechRecognitionCtor =
      browserWindow?.SpeechRecognition || browserWindow?.webkitSpeechRecognition || null;
    const canRecordAudio =
      typeof MediaRecorder !== 'undefined' && typeof navigator?.mediaDevices?.getUserMedia === 'function';
    const shouldUseRecorderOnly =
      canRecordAudio && (prefersServerSideVoiceTranscription || !SpeechRecognitionCtor);

    if (shouldUseRecorderOnly) {
      void (async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          mediaStreamRef.current = stream;
          recordedChunksRef.current = [];
          listeningTranscriptRef.current = '';
          setInput('');
          setVoiceError('');
          setIsListening(true);
          onExpandedChange(true);

          const recorder = new MediaRecorder(stream);
          recorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              recordedChunksRef.current.push(event.data);
            }
          };
          recorder.onerror = () => {
            setVoiceError('Voice input failed.');
            setIsListening(false);
          };
          recorder.onstop = () => {
            const chunks = [...recordedChunksRef.current];
            recordedChunksRef.current = [];
            mediaRecorderRef.current = null;
            mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
            mediaStreamRef.current = null;
            setIsListening(false);

            const audioBlob =
              chunks.length > 0
                ? new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
                : null;

            if (audioBlob && audioBlob.size > 0) {
              void submitMessage('', 'voice', audioBlob);
              return;
            }

            setVoiceError('Voice input failed.');
          };

          mediaRecorderRef.current = recorder;
          recorder.start();
        } catch (error) {
          setVoiceError(
            error instanceof Error ? error.message : 'Microphone access was denied.'
          );
          setIsListening(false);
        }
      })();

      return;
    }

    if (!SpeechRecognitionCtor) {
      setVoiceError('Voice input is not available in this browser.');
      pendingFocusRef.current = true;
      onExpandedChange(true);
      return;
    }

    const nextRecognition = new SpeechRecognitionCtor() as InlineSpeechRecognition;
    nextRecognition.continuous = false;
    nextRecognition.interimResults = true;
    nextRecognition.lang = 'en-US';
    listeningTranscriptRef.current = '';

    nextRecognition.onstart = () => {
      setVoiceError('');
      setIsListening(true);
      onExpandedChange(true);
    };

    nextRecognition.onerror = (event) => {
      setIsListening(false);
      setVoiceError(event.error === 'not-allowed' ? 'Microphone access was denied.' : 'Voice input failed.');
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };

    nextRecognition.onresult = (event) => {
      let transcript = '';
      for (const result of Array.from(event.results)) {
        transcript += result[0]?.transcript ?? '';
      }
      listeningTranscriptRef.current = transcript.trim();
      setInput(transcript.trim());
    };

    nextRecognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
      const finalTranscript = listeningTranscriptRef.current.trim();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        return;
      }
      if (finalTranscript) {
        void submitMessage(finalTranscript, 'voice');
      }
      listeningTranscriptRef.current = '';
    };

    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        recordedChunksRef.current = [];

        const recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
          }
        };
        recorder.onstop = () => {
          const chunks = [...recordedChunksRef.current];
          recordedChunksRef.current = [];
          mediaRecorderRef.current = null;
          mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;

          const finalTranscript = listeningTranscriptRef.current.trim();
          listeningTranscriptRef.current = '';
          const audioBlob = chunks.length > 0 ? new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }) : null;

          if (audioBlob && audioBlob.size > 0) {
            void submitMessage(finalTranscript, 'voice', audioBlob);
            return;
          }

          if (finalTranscript) {
            void submitMessage(finalTranscript, 'voice');
          }
        };

        mediaRecorderRef.current = recorder;
        recognitionRef.current = nextRecognition;
        recorder.start();
        nextRecognition.start();
      } catch (error) {
        setVoiceError(
          error instanceof Error ? error.message : 'Microphone access was denied.'
        );
        setIsListening(false);
      }
    })();
  }, [isListening, onExpandedChange, prefersServerSideVoiceTranscription, submitMessage]);

  const handleCompactComposerClick = () => {
    pendingFocusRef.current = true;
    onExpandedChange(true);
  };

  const handleStarterPhoneCall = useCallback(async () => {
    if (!phoneCallAvailable) {
      setVoiceError('Add a phone number to your profile so Ember can call you.');
      return;
    }

    setVoiceError('');
    setIsLoading(true);

    try {
      await onRequestPhoneCall();
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            'Ember is calling your phone now. You can stay here or keep adding details in chat.',
        },
      ]);
    } catch (error) {
      setVoiceError(error instanceof Error ? error.message : 'Failed to start the phone call');
    } finally {
      setIsLoading(false);
    }
  }, [onRequestPhoneCall, phoneCallAvailable]);

  const lastAssistantMessage =
    [...messages].reverse().find((message) => message.role === 'assistant') || null;

  return (
    <div className="ember-overlay-shell z-50 overflow-y-auto bg-white" onClick={onClose}>
      <div className="relative min-h-full w-full bg-white" onClick={(event) => event.stopPropagation()}>
        <div
          className={`relative overflow-hidden bg-[#a8ba91] ${
            shouldShowExpanded ? 'h-[42dvh] min-h-[18rem]' : 'h-[70dvh] min-h-[24rem]'
          }`}
        >
          <MediaPreview
            mediaType={mediaType}
            filename={filename}
            posterFilename={posterFilename}
            originalName={emberTitle}
            usePosterForVideo
            controls={mediaType === 'VIDEO'}
            className={`h-full w-full ${mediaType === 'VIDEO' ? 'object-contain bg-[#a8ba91]' : 'object-cover bg-[#a8ba91]'}`}
          />
          <div className="pointer-events-none absolute inset-0 bg-white/28" />
          <div className="absolute left-5 top-3.5 right-24">
            <h1
              className={`max-w-[14rem] break-words text-[2rem] font-semibold leading-[1.04] tracking-[-0.05em] [overflow-wrap:anywhere] ${
                titleTone === 'dark'
                  ? 'text-black drop-shadow-[0_1px_2px_rgba(255,255,255,0.28)]'
                  : 'text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.12)]'
              }`}
            >
              {emberTitle}
            </h1>
          </div>

          {!shouldShowExpanded && (
            <div className="absolute right-2 top-1/2 z-10 flex w-[4.75rem] -translate-y-1/2 flex-col gap-2 rounded-[1rem] bg-black/25 px-1.5 py-3 backdrop-blur-[1px] transition-colors hover:bg-black">
              <HeroRailButton
                icon={<ShareIcon className="h-full w-full" />}
                label="Share"
                tone={railTone}
                onClick={onOpenShare}
              />
              <HeroRailButton
                icon={<CircleIcon className="h-full w-full" />}
                label="Tend"
                tone={railTone}
                onClick={onOpenTend}
              />
              <HeroRailButton
                icon={<PlayIcon className="h-full w-full" />}
                label="Play"
                tone={railTone}
                onClick={onOpenPlay}
              />
              <HeroRailButton
                icon={<GeminiIcon className="h-full w-full" />}
                label="Ask"
                tone="light"
                onClick={() => onExpandedChange(true)}
              />
            </div>
          )}
        </div>

        <div
          className={`bg-[var(--ember-orange)] text-white ${
            shouldShowExpanded
              ? 'min-h-[58dvh] px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+1.1rem)]'
              : 'min-h-[30dvh] px-4 pt-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]'
          }`}
        >
          {!shouldShowExpanded ? (
            <div className="flex flex-col">
              <div className="mx-auto mt-4 max-w-[18rem] text-center text-[1.05rem] font-medium leading-[1.28] tracking-[-0.02em]">
                {hasRecordedContributions
                  ? 'Ask ember anything or add more details about this memory.'
                  : 'Start this memory by chatting with Ember or having Ember call your phone.'}
              </div>

              <button
                type="button"
                onClick={handleCompactComposerClick}
                className="mt-8 flex h-14 w-full items-center justify-between bg-white px-4 text-left text-[0.98rem] text-[#9b9b9b]"
              >
                <span>Ask or add details</span>
                <span
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleVoiceToggle();
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border-[2px] border-black text-black"
                >
                  <AskMicIcon className="h-5 w-5" />
                </span>
              </button>

              {voiceError && <div className="mt-3 text-sm text-white/85">{voiceError}</div>}

              {savedMemoryNotice && (
                <div className="mt-3 rounded-[0.95rem] bg-white/14 px-3 py-2 text-sm font-medium text-white/96">
                  {savedMemoryNotice}
                </div>
              )}

              {featuredVoiceClips.length > 0 && (
                <div className="mt-4 space-y-3">
                  <div className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-white/72">
                    Important voice moments
                  </div>
                  {featuredVoiceClips.map((clip) => (
                    <div key={clip.id} className="rounded-[1rem] bg-white/10 px-3 py-3 text-left">
                      <div className="text-sm font-semibold text-white">{clip.title}</div>
                      <div className="mt-1 text-xs font-medium text-white/72">
                        {clip.contributorName}
                      </div>
                      <div className="mt-2 text-sm leading-5 text-white/94">
                        &quot;{clip.quote}&quot;
                      </div>
                      {clip.significance && (
                        <div className="mt-2 text-xs leading-5 text-white/72">
                          {clip.significance}
                        </div>
                      )}
                      {clip.audioUrl && (
                        <audio controls preload="none" className="mt-3 w-full" src={clip.audioUrl} />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col">
              <div className="flex items-start justify-between gap-4">
                <div className="text-[1rem] font-semibold leading-none tracking-[-0.02em] text-white">
                  Ask Ember <span className="font-normal text-white/88">| {ownerLabel}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onExpandedChange(false)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/35 px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-white"
                  >
                    <ExpandIcon className="h-3.5 w-3.5" />
                    Collapse
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex h-8 w-8 items-center justify-center text-white"
                    aria-label="Close Ask Ember"
                  >
                    <CloseIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="mt-4 pr-1">
                {shouldShowStarterPrompt && !isLoading ? (
                  <div className="space-y-4 pt-4 text-center">
                    <div className="text-[1.2rem] font-semibold leading-[1.18] tracking-[-0.03em] text-white">
                      Hi, I&apos;m Ember.
                    </div>
                    <div className="text-[1rem] font-medium leading-[1.3] text-white/94">
                      Tell me what was happening in this {subjectNoun}, who was there, or any detail you
                      want to preserve.
                    </div>
                    <div className="text-sm leading-6 text-white/88">
                      If you&apos;d rather talk, I can have the Ember agent call your phone. Just say yes, or
                      tap below.
                    </div>
                    <div className="flex justify-center">
                      <button
                        type="button"
                        onClick={() => void handleStarterPhoneCall()}
                        disabled={!phoneCallAvailable || isLoading}
                        className="rounded-[1rem] border border-white/60 bg-white/12 px-4 py-3 text-sm font-semibold tracking-[-0.01em] text-white disabled:opacity-55"
                      >
                        {phoneCallAvailable ? 'Have Ember call me' : 'Phone call unavailable'}
                      </button>
                    </div>
                  </div>
                ) : messages.length === 0 && !isLoading && featuredVoiceClips.length === 0 ? (
                  <div className="pt-8 text-center text-[1rem] font-medium leading-[1.3] text-white/96">
                    Start asking ember about this {subjectNoun}, or add new details so they get saved.
                  </div>
                ) : (
                  <div className="space-y-5">
                    {savedMemoryNotice && (
                      <div className="rounded-[0.95rem] bg-white/14 px-3 py-2 text-sm font-medium text-white/96">
                        {savedMemoryNotice}
                      </div>
                    )}

                    {featuredVoiceClips.length > 0 && (
                      <div className="space-y-3">
                        <div className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-white/72">
                          Important voice moments
                        </div>
                        {featuredVoiceClips.map((clip) => (
                          <div key={clip.id} className="rounded-[1rem] bg-white/10 px-3 py-3 text-left">
                            <div className="text-sm font-semibold text-white">{clip.title}</div>
                            <div className="mt-1 text-xs font-medium text-white/72">
                              {clip.contributorName}
                            </div>
                            <div className="mt-2 text-sm leading-5 text-white/94">
                              &quot;{clip.quote}&quot;
                            </div>
                            {clip.significance && (
                              <div className="mt-2 text-xs leading-5 text-white/72">
                                {clip.significance}
                              </div>
                            )}
                            {clip.audioUrl && (
                              <audio controls preload="none" className="mt-3 w-full" src={clip.audioUrl} />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {messages.map((message, index) => (
                      <div key={`${message.role}-${index}`}>
                        <div
                          className={
                            message.role === 'user'
                              ? 'ml-auto max-w-[88%] text-right text-[1.2rem] font-semibold leading-[1.18] tracking-[-0.04em] text-black'
                              : 'mr-auto max-w-[88%] text-left text-[1rem] font-medium leading-[1.2] tracking-[-0.02em] text-white'
                          }
                        >
                          {message.content}
                        </div>
                      </div>
                    ))}

                    {isLoading && (
                      <div className="mr-auto max-w-[80%] text-left text-[1rem] font-medium leading-[1.2] text-white/92">
                        Ember is thinking...
                      </div>
                    )}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {lastAssistantMessage && !isListening ? null : null}

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitMessage(input, 'text');
                }}
                className="mt-4"
              >
                <div className="flex h-14 items-center bg-white px-3 text-black">
                    <button
                      type="button"
                      onClick={() => attachmentInputRef.current?.click()}
                      className="mr-2 inline-flex h-9 w-9 items-center justify-center text-black/88"
                      aria-label="Add supporting media"
                    >
                      <AskPlusIcon className="h-5 w-5" />
                    </button>
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="Ask or add details"
                    className="min-w-0 flex-1 bg-transparent text-[0.98rem] text-black outline-none placeholder:text-[#9b9b9b]"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => void handleVoiceToggle()}
                    className="ml-2 inline-flex h-9 w-9 items-center justify-center rounded-full border-[2px] border-black text-black"
                    aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
                  >
                    <AskMicIcon className="h-5 w-5" />
                  </button>
                </div>
                <input
                  ref={attachmentInputRef}
                  type="file"
                  accept="image/*,video/*,audio/*"
                  multiple
                  className="hidden"
                  onChange={handleAttachmentSelection}
                />
              </form>

              {pendingAttachmentFiles.length > 0 && (
                <div className="mt-4 rounded-[1rem] bg-white/12 px-3 py-3 text-left">
                  <div className="text-[0.98rem] font-medium leading-[1.25] text-white">
                    Do you want to add {describePendingAttachments(pendingAttachmentFiles)} to your ember?
                  </div>
                  <div className="mt-3 space-y-1.5 text-sm text-white/88">
                    {pendingAttachmentFiles.map((file) => (
                      <div key={`${file.name}-${file.size}-${file.lastModified}`}>{file.name}</div>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void uploadPendingAttachments()}
                      disabled={uploadingAttachments}
                      className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[var(--ember-orange)] disabled:opacity-60"
                    >
                      {uploadingAttachments ? 'Adding...' : 'Add to ember'}
                    </button>
                    <button
                      type="button"
                      onClick={resetPendingAttachments}
                      disabled={uploadingAttachments}
                      className="rounded-full border border-white/35 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {isListening && (
                <div className="mt-5">
                  <AskVoiceWaveform />
                </div>
              )}

              {voiceError && !isListening && (
                <div className="mt-3 text-sm text-white/88">{voiceError}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AddToMemoryChoiceExperience({
  emberTitle,
  mediaType,
  filename,
  posterFilename,
  titleTone,
  phoneCallAvailable,
  isCalling,
  errorMessage,
  onClose,
  onStartChat,
  onRequestPhoneCall,
}: {
  emberTitle: string;
  mediaType: 'IMAGE' | 'VIDEO';
  filename: string;
  posterFilename: string | null;
  titleTone: 'light' | 'dark';
  phoneCallAvailable: boolean;
  isCalling: boolean;
  errorMessage: string;
  onClose: () => void;
  onStartChat: () => void;
  onRequestPhoneCall: () => Promise<void>;
}) {
  return (
    <div className="ember-overlay-shell z-50 overflow-y-auto bg-white" onClick={onClose}>
      <div className="relative min-h-full w-full bg-white" onClick={(event) => event.stopPropagation()}>
        <div className="relative h-[70dvh] min-h-[24rem] overflow-hidden bg-[#a8ba91]">
          <MediaPreview
            mediaType={mediaType}
            filename={filename}
            posterFilename={posterFilename}
            originalName={emberTitle}
            usePosterForVideo
            controls={mediaType === 'VIDEO'}
            className={`h-full w-full ${
              mediaType === 'VIDEO' ? 'object-contain bg-[#a8ba91]' : 'object-cover bg-[#a8ba91]'
            }`}
          />
          <div className="pointer-events-none absolute inset-0 bg-white/28" />
          <div className="absolute left-5 top-3.5 right-20">
            <h1
              className={`max-w-[14rem] break-words text-[2rem] font-semibold leading-[1.04] tracking-[-0.05em] [overflow-wrap:anywhere] ${
                titleTone === 'dark'
                  ? 'text-black drop-shadow-[0_1px_2px_rgba(255,255,255,0.28)]'
                  : 'text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.12)]'
              }`}
            >
              {emberTitle}
            </h1>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center text-white"
            aria-label="Close add to this memory"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-[30dvh] bg-[var(--ember-orange)] px-6 pt-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] text-center text-white">
          <p className="text-[1.2rem] font-semibold leading-[1.18] tracking-[-0.03em]">
            How would you like to add to this memory?
          </p>
          <p className="mt-2 text-sm leading-6 text-white/90">
            Chat with Ember here, or have the Ember agent call your phone and collect the story by voice.
          </p>

          <div className="mt-5 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onStartChat}
              className="rounded-[1rem] bg-white px-4 py-3 text-sm font-semibold tracking-[-0.01em] text-[var(--ember-text)] shadow-[0_12px_24px_rgba(17,17,17,0.14)]"
            >
              Chat with Ember
            </button>
            <button
              type="button"
              onClick={() => {
                void onRequestPhoneCall().catch(() => {});
              }}
              disabled={!phoneCallAvailable || isCalling}
              className="rounded-[1rem] border border-white/70 bg-white/12 px-4 py-3 text-sm font-semibold tracking-[-0.01em] text-white disabled:opacity-55"
            >
              {isCalling ? 'Calling...' : phoneCallAvailable ? 'Receive a phone call' : 'Phone call unavailable'}
            </button>
          </div>

          {errorMessage && <div className="mt-3 text-sm text-white/92">{errorMessage}</div>}
        </div>
      </div>
    </div>
  );
}

function PlayNarrationExperience({
  emberTitle,
  mediaType,
  filename,
  posterFilename,
  titleTone,
  railTone,
  dateLabel,
  canPlay,
  narrationState,
  narrationScript,
  narrationError,
  onStartOrStop,
  onStopAndClose,
  onOpenShare,
  onOpenTend,
  onOpenAsk,
}: {
  emberTitle: string;
  mediaType: 'IMAGE' | 'VIDEO';
  filename: string;
  posterFilename: string | null;
  titleTone: 'light' | 'dark';
  railTone: 'light' | 'dark';
  dateLabel: string;
  canPlay: boolean;
  narrationState: 'idle' | 'loading' | 'playing';
  narrationScript: string;
  narrationError: string;
  onStartOrStop: () => void;
  onStopAndClose: () => void;
  onOpenShare: () => void;
  onOpenTend: () => void;
  onOpenAsk: () => void;
}) {
  const autoStartedRef = useRef(false);

  useEffect(() => {
    if (!canPlay) {
      return;
    }

    if (autoStartedRef.current) {
      return;
    }

    autoStartedRef.current = true;
    onStartOrStop();
  }, [canPlay, onStartOrStop]);

  const supportingCopy =
    narrationState === 'loading'
      ? 'Preparing the snapshot for this ember...'
      : narrationScript || 'Ember is getting the snapshot ready.';

  return (
    <div className="ember-overlay-shell z-50 bg-white">
      <div className="relative h-full w-full overflow-hidden">
        <div className="relative h-[70%] overflow-hidden bg-[#a8ba91]">
          <MediaPreview
            mediaType={mediaType}
            filename={filename}
            posterFilename={posterFilename}
            originalName={emberTitle}
            usePosterForVideo
            controls={mediaType === 'VIDEO'}
            className={`h-full w-full ${mediaType === 'VIDEO' ? 'object-contain bg-[#a8ba91]' : 'object-cover bg-[#a8ba91]'}`}
          />
          <div className="pointer-events-none absolute inset-0 bg-white/28" />

          <div className="absolute left-5 top-3.5 right-24">
            <h1
              className={`max-w-[14rem] break-words text-[2rem] font-semibold leading-[1.04] tracking-[-0.05em] [overflow-wrap:anywhere] ${
                titleTone === 'dark'
                  ? 'text-black drop-shadow-[0_1px_2px_rgba(255,255,255,0.28)]'
                  : 'text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.12)]'
              }`}
            >
              {emberTitle}
            </h1>
          </div>

          <div className="absolute right-2 top-1/2 z-10 flex w-[4.75rem] -translate-y-1/2 flex-col gap-2 rounded-[1rem] bg-black/25 px-1.5 py-3 backdrop-blur-[1px] transition-colors hover:bg-black">
            <HeroRailButton
              icon={<ShareIcon className="h-full w-full" />}
              label="Share"
              tone={railTone}
              onClick={onOpenShare}
            />
            <HeroRailButton
              icon={<CircleIcon className="h-full w-full" />}
              label="Tend"
              tone={railTone}
              onClick={onOpenTend}
            />
            <HeroRailButton
              icon={<StopCircleIcon className="h-full w-full" />}
              label={narrationState === 'loading' ? 'Loading' : 'Stop'}
              tone="light"
              onClick={onStopAndClose}
            />
            <HeroRailButton
              icon={<GeminiIcon className="h-full w-full" />}
              label="Ask"
              tone={railTone}
              onClick={onOpenAsk}
            />
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 top-[70%] flex flex-col bg-[var(--ember-orange)] px-7 pt-5 pb-[calc(env(safe-area-inset-bottom)+1.1rem)] text-white">
          <div className="text-center">
            <div className="text-[0.95rem] font-medium leading-none tracking-[-0.02em] text-white/92 sm:text-[1.05rem]">
              {dateLabel}
            </div>
          </div>

          <div className="mt-5 flex-1 overflow-y-auto">
            {narrationError ? (
              <div className="mx-auto max-w-[18rem] text-center text-[1.05rem] font-medium leading-[1.3] tracking-[-0.02em] text-white">
                {narrationError}
              </div>
            ) : (
              <p className="mx-auto max-w-[18rem] whitespace-pre-wrap text-center text-[1.05rem] font-medium leading-[1.3] tracking-[-0.02em] text-white sm:max-w-[22rem] sm:text-[1.2rem]">
                {supportingCopy}
              </p>
            )}

            {!canPlay && (
              <p className="mx-auto mt-4 max-w-[17rem] text-center text-sm leading-6 text-white/88">
                Generate the snapshot first so Ember has something to play here.
              </p>
            )}
          </div>

          {(narrationState === 'loading' || narrationState === 'playing') && (
            <div className="mt-4">
              <AskVoiceWaveform />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EditPencilIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="m4.5 19.5 4.1-.8 9.25-9.25-3.3-3.3L5.3 15.4l-.8 4.1Z" />
      <path d="m13.8 6.9 3.3 3.3" />
    </svg>
  );
}

function ChevronDownIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className} aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function SmartTitleExperience({
  titleDraft,
  savedTitle,
  generatedDateLabel,
  analysisSuggestions,
  contextSuggestions,
  contributorQuotes,
  loadingTitleSuggestions,
  savingDetails,
  isEditing,
  errorMessage,
  noticeMessage,
  onTitleChange,
  onPickSuggestion,
  onEditToggle,
  onSave,
  onCancel,
  onRegenerate,
  onClose,
}: {
  titleDraft: string;
  savedTitle: string;
  generatedDateLabel: string;
  analysisSuggestions: string[];
  contextSuggestions: string[];
  contributorQuotes: Array<{
    title: string;
    contributorName: string;
    quote: string;
    source: 'voice' | 'text';
  }>;
  loadingTitleSuggestions: boolean;
  savingDetails: boolean;
  isEditing: boolean;
  errorMessage: string;
  noticeMessage: string;
  onTitleChange: (value: string) => void;
  onPickSuggestion: (value: string) => void;
  onEditToggle: () => void;
  onSave: () => void;
  onCancel: () => void;
  onRegenerate: () => void;
  onClose: () => void;
}) {
  const hasUnsavedChanges = (titleDraft.trim() || '') !== (savedTitle.trim() || '');
  const suggestionGroups = [
    {
      id: 'analysis',
      heading: 'From AI Analysis',
      subheading: 'Based on what Ember can see in the photo',
      suggestions: analysisSuggestions,
    },
    {
      id: 'context',
      heading: 'From Real Context',
      subheading: 'Based on owner and contributor text or voice details',
      suggestions: contextSuggestions,
    },
  ];

  return (
    <div className="ember-overlay-shell z-50 bg-[#bfd8dc]">
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between px-5 pt-4">
          <h2 className="text-[1.05rem] font-semibold tracking-[-0.03em] text-black sm:text-[1.2rem]">
            Smart Title
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center text-black"
            aria-label="Close Smart Title"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-3">
          <div className="bg-white px-4 py-4 shadow-[0_8px_18px_rgba(0,0,0,0.04)]">
            <div className="flex items-start gap-3">
              {isEditing ? (
                <input
                  autoFocus
                  value={titleDraft}
                  onChange={(event) => onTitleChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      onSave();
                    }

                    if (event.key === 'Escape') {
                      event.preventDefault();
                      onCancel();
                    }
                  }}
                  className="min-w-0 flex-1 border-none bg-transparent text-[1.12rem] font-semibold italic tracking-[-0.03em] text-[#192124] outline-none"
                  placeholder="Untitled Ember"
                />
              ) : (
                <div className="min-w-0 flex-1 text-[1.12rem] font-semibold italic leading-[1.35] tracking-[-0.03em] text-[#192124]">
                  {titleDraft.trim() || savedTitle || 'Untitled Ember'}
                </div>
              )}

              <button
                type="button"
                onClick={onEditToggle}
                disabled={savingDetails}
                className="inline-flex h-8 w-8 items-center justify-center text-black disabled:opacity-50"
                aria-label={isEditing ? 'Save title' : 'Edit title'}
              >
                <EditPencilIcon className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-end justify-between gap-4 px-1">
            <div className="text-[0.92rem] leading-[1.3] tracking-[-0.02em] text-black/85">
              <span className="font-semibold text-black">Ember Generated Smart Title</span>
              <span className="text-white/92"> | {generatedDateLabel}</span>
            </div>
            <div className="flex items-center gap-3">
              {hasUnsavedChanges && (
                <button
                  type="button"
                  onClick={onSave}
                  disabled={savingDetails}
                  className="min-h-[3rem] min-w-[6.6rem] bg-[#365d61] px-5 py-3 text-[0.95rem] font-semibold text-white disabled:opacity-60"
                >
                  {savingDetails ? 'SAVING' : 'SAVE'}
                </button>
              )}
              <button
                type="button"
                onClick={onRegenerate}
                disabled={loadingTitleSuggestions}
                className="min-h-[3rem] min-w-[8.2rem] bg-[#365d61] px-5 py-3 text-[0.95rem] font-semibold text-white disabled:opacity-60"
              >
                {loadingTitleSuggestions ? 'GENERATING' : 'REGENERATE'}
              </button>
            </div>
          </div>

          {(errorMessage || noticeMessage) && (
            <div className="px-1 pt-4 text-sm font-medium text-black/78">
              {errorMessage || noticeMessage}
            </div>
          )}

          <div className="mt-5 space-y-5">
            {loadingTitleSuggestions &&
            analysisSuggestions.length === 0 &&
            contextSuggestions.length === 0 &&
            contributorQuotes.length === 0 ? (
              <div className="rounded-[1.45rem] bg-white px-4 py-8 text-center text-sm text-black/65 shadow-[0_8px_18px_rgba(0,0,0,0.04)]">
                Generating smart title options...
              </div>
            ) : (
              <>
                {suggestionGroups.map((group) => (
                  <div
                    key={group.id}
                    className="rounded-[1.45rem] bg-white px-4 py-4 shadow-[0_8px_18px_rgba(0,0,0,0.04)]"
                  >
                    <div className="text-[0.9rem] font-semibold tracking-[-0.02em] text-black">
                      {group.heading}
                    </div>
                    <div className="mt-1 text-sm leading-6 text-black/62">
                      {group.subheading}
                    </div>

                    <div className="mt-4 space-y-3">
                      {group.suggestions.length > 0 ? (
                        group.suggestions.map((suggestion) => {
                          const selected =
                            titleDraft.trim().toLowerCase() === suggestion.trim().toLowerCase();

                          return (
                            <button
                              key={`${group.id}-${suggestion}`}
                              type="button"
                              onClick={() => onPickSuggestion(suggestion)}
                              className={`w-full rounded-[1.2rem] border px-4 py-3 text-left text-[1rem] font-medium leading-[1.35] tracking-[-0.02em] transition ${
                                selected
                                  ? 'border-[rgba(41,98,255,0.26)] bg-[rgba(41,98,255,0.06)] text-[#192124]'
                                  : 'border-[rgba(20,20,20,0.08)] bg-white text-[#192124]'
                              }`}
                            >
                              {suggestion}
                            </button>
                          );
                        })
                      ) : (
                        <div className="rounded-[1.2rem] border border-dashed border-[rgba(20,20,20,0.12)] px-4 py-4 text-sm text-black/55">
                          No suggestions yet in this group.
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                <div className="rounded-[1.45rem] bg-white px-4 py-4 shadow-[0_8px_18px_rgba(0,0,0,0.04)]">
                  <div className="text-[0.9rem] font-semibold tracking-[-0.02em] text-black">
                    Exact Contributor Quotes
                  </div>
                  <div className="mt-1 text-sm leading-6 text-black/62">
                    AI-shaped title options pulled from real owner and contributor wording
                  </div>

                  <div className="mt-4 space-y-3">
                    {contributorQuotes.length > 0 ? (
                      contributorQuotes.map((quoteItem, index) => {
                        const selected =
                          titleDraft.trim().toLowerCase() === quoteItem.title.trim().toLowerCase();

                        return (
                        <button
                          key={`${quoteItem.contributorName}-${quoteItem.quote}-${index}`}
                          type="button"
                          onClick={() => onPickSuggestion(quoteItem.title)}
                          className={`w-full rounded-[1.2rem] border px-4 py-4 text-left transition ${
                            selected
                              ? 'border-[rgba(41,98,255,0.26)] bg-[rgba(41,98,255,0.06)]'
                              : 'border-[rgba(20,20,20,0.08)] bg-white'
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-black">
                              {quoteItem.contributorName}
                            </span>
                            <span className="rounded-full bg-[rgba(255,102,33,0.08)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ember-orange-deep)]">
                              {quoteItem.source === 'voice' ? 'Voice' : 'Text'}
                            </span>
                          </div>
                          <div className="mt-3 text-[1.02rem] font-semibold italic leading-[1.35] tracking-[-0.02em] text-[#192124]">
                            {quoteItem.title}
                          </div>
                          <blockquote className="mt-2 text-[0.92rem] leading-6 text-black/65">
                            From: &ldquo;{quoteItem.quote}&rdquo;
                          </blockquote>
                        </button>
                      );
                      })
                    ) : (
                      <div className="rounded-[1.2rem] border border-dashed border-[rgba(20,20,20,0.12)] px-4 py-4 text-sm text-black/55">
                        No quote-based title options yet.
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SmartCaptionExperience({
  captionDraft,
  savedCaption,
  generatedDateLabel,
  selectedVoice,
  loadingCaptionSuggestion,
  savingDetails,
  isEditing,
  errorMessage,
  noticeMessage,
  onCaptionChange,
  onVoiceChange,
  onEditToggle,
  onSave,
  onCancel,
  onRegenerate,
  onClose,
}: {
  captionDraft: string;
  savedCaption: string;
  generatedDateLabel: string;
  selectedVoice: (typeof SMART_CAPTION_VOICE_OPTIONS)[number];
  loadingCaptionSuggestion: boolean;
  savingDetails: boolean;
  isEditing: boolean;
  errorMessage: string;
  noticeMessage: string;
  onCaptionChange: (value: string) => void;
  onVoiceChange: (value: (typeof SMART_CAPTION_VOICE_OPTIONS)[number]) => void;
  onEditToggle: () => void;
  onSave: () => void;
  onCancel: () => void;
  onRegenerate: () => void;
  onClose: () => void;
}) {
  const displayCaption =
    captionDraft.trim() ||
    savedCaption.trim() ||
    `"${generatedDateLabel}..."`;

  return (
    <div className="ember-overlay-shell z-50 bg-[#bfd8dc]">
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between px-5 pt-4">
          <h2 className="text-[1.05rem] font-semibold tracking-[-0.03em] text-black sm:text-[1.2rem]">
            Smart Caption
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center text-black"
            aria-label="Close Smart Caption"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2.5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-3">
          <div className="bg-white px-4 py-4 shadow-[0_8px_18px_rgba(0,0,0,0.04)]">
            <div className="flex items-start justify-end">
              <button
                type="button"
                onClick={onEditToggle}
                disabled={savingDetails}
                className="inline-flex h-8 w-8 items-center justify-center text-black disabled:opacity-50"
                aria-label={isEditing ? 'Save caption' : 'Edit caption'}
              >
                <EditPencilIcon className="h-4.5 w-4.5" />
              </button>
            </div>

            {isEditing ? (
              <textarea
                autoFocus
                value={captionDraft}
                onChange={(event) => onCaptionChange(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                    event.preventDefault();
                    onSave();
                  }

                  if (event.key === 'Escape') {
                    event.preventDefault();
                    onCancel();
                  }
                }}
                rows={7}
                className="mt-1 min-h-[14rem] w-full resize-none border-none bg-transparent text-center text-[1.02rem] font-medium italic leading-[1.4] tracking-[-0.03em] text-[#275a5f] outline-none"
                placeholder="Add a smart caption..."
              />
            ) : (
              <p className="mt-1 whitespace-pre-wrap text-center text-[1.02rem] font-medium italic leading-[1.4] tracking-[-0.03em] text-[#275a5f]">
                {displayCaption}
              </p>
            )}
          </div>

          <div className="mt-4 px-1 text-[0.92rem] leading-[1.3] tracking-[-0.02em] text-black/85">
            <span className="font-semibold text-black">Ember Generated Smart Caption</span>
            <span className="text-white/92"> | {generatedDateLabel}</span>
          </div>

          <div className="relative mt-4">
            <select
              value={selectedVoice}
              onChange={(event) =>
                onVoiceChange(event.target.value as (typeof SMART_CAPTION_VOICE_OPTIONS)[number])
              }
              className="h-[3.9rem] w-full appearance-none bg-white px-5 pr-12 text-[1.02rem] font-medium tracking-[-0.03em] text-[#959595] outline-none"
            >
              {SMART_CAPTION_VOICE_OPTIONS.map((voice) => (
                <option key={voice} value={voice}>
                  Voice ({voice})
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center justify-center text-black">
              <ChevronDownIcon className="h-5 w-5" />
            </span>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={onRegenerate}
              disabled={loadingCaptionSuggestion}
              className="min-h-[3rem] min-w-[8.2rem] bg-[#365d61] px-5 py-3 text-[0.95rem] font-semibold text-white disabled:opacity-60"
            >
              {loadingCaptionSuggestion ? 'GENERATING' : 'REGENERATE'}
            </button>
          </div>

          {(errorMessage || noticeMessage) && (
            <div className="px-1 pt-4 text-sm font-medium text-black/78">
              {errorMessage || noticeMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TendSettingsIcon({ className = 'h-8 w-8' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.8v2.4" />
      <path d="M12 18.8v2.4" />
      <path d="m5.5 5.5 1.7 1.7" />
      <path d="m16.8 16.8 1.7 1.7" />
      <path d="M2.8 12h2.4" />
      <path d="M18.8 12h2.4" />
      <path d="m5.5 18.5 1.7-1.7" />
      <path d="m16.8 7.2 1.7-1.7" />
    </svg>
  );
}

function TendAddContentIcon({ className = 'h-8 w-8' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className} aria-hidden="true">
      <rect x="4.2" y="4.2" width="15.6" height="15.6" rx="2.2" strokeDasharray="3.5 2.5" />
      <path d="M12 8v8" />
      <path d="M8 12h8" />
    </svg>
  );
}

function TendWikiIcon({ className = 'h-8 w-8' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.45" className={className} aria-hidden="true">
      <path d="M4.5 6h3l2 9 2.5-9h2l2.5 9 2-9h2.5" />
    </svg>
  );
}

function TendStoryCutIcon({ className = 'h-8 w-8' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
      <rect x="3.5" y="5" width="12.5" height="10.5" rx="1.4" />
      <path d="M7.2 3.8v2.3" />
      <path d="M12.3 3.8v2.3" />
      <path d="M7.2 14.8v2.3" />
      <path d="M12.3 14.8v2.3" />
      <path d="m9.1 8.4 3.2 1.85-3.2 1.85Z" fill="currentColor" stroke="none" />
      <path d="m18.2 15.8 2.3 2.3" />
      <path d="m19 14.4 1.8 1.8" />
      <path d="m17.2 17.5 2.3-2.3" />
    </svg>
  );
}

function TendTagPeopleIcon({ className = 'h-8 w-8' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className} aria-hidden="true">
      <circle cx="12" cy="8.2" r="3.3" />
      <path d="M5.4 19c1.2-3.1 3.6-4.8 6.6-4.8 3.1 0 5.5 1.7 6.6 4.8" />
      <path d="m18.3 4.6.9 1.8 1.8.9-1.8.9-.9 1.8-.9-1.8-1.8-.9 1.8-.9Z" />
    </svg>
  );
}

function TendEditTitleIcon({ className = 'h-8 w-8' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
      <path d="M4.5 7h8" />
      <path d="M4.5 11.5h6.5" />
      <path d="M4.5 16h8.5" />
      <path d="m15.2 9.2 4.4 4.4" />
      <path d="m14.2 18.5 5.8-5.8" />
      <path d="m13.6 19.1 2.4-.5-.5 2.4-2 .1Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TendContributorsIcon({ className = 'h-8 w-8' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className} aria-hidden="true">
      <circle cx="12" cy="8" r="3.1" />
      <path d="M5.2 18.7c1.3-3.2 3.8-4.9 6.8-4.9 3.1 0 5.5 1.7 6.8 4.9" />
      <path d="M18.5 4.4v3.2" />
      <path d="M16.9 6h3.2" />
    </svg>
  );
}

function TendMenuButton({
  icon,
  label,
  onClick,
  disabled = false,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-[6.2rem] flex-col items-center justify-center gap-2 rounded-[1.1rem] px-2 text-center transition ${
        disabled ? 'cursor-not-allowed opacity-45' : 'hover:bg-white/10'
      }`}
    >
      <span className="flex h-9 w-9 items-center justify-center text-white">
        {icon}
      </span>
      <span className="text-[0.84rem] font-semibold leading-[1.15] tracking-[-0.02em] text-[#27464a]">
        {label}
      </span>
    </button>
  );
}

function TendMenuExperience({
  emberTitle,
  mediaType,
  filename,
  posterFilename,
  titleTone,
  canManage,
  onClose,
  onOpenSettings,
  onOpenAddContent,
  onOpenWiki,
  onOpenStoryCut,
  onOpenTagPeople,
  onOpenEditTitle,
  onOpenContributors,
}: {
  emberTitle: string;
  mediaType: 'IMAGE' | 'VIDEO';
  filename: string;
  posterFilename: string | null;
  titleTone: 'light' | 'dark';
  canManage: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  onOpenAddContent: () => void;
  onOpenWiki: () => void;
  onOpenStoryCut: () => void;
  onOpenTagPeople: () => void;
  onOpenEditTitle: () => void;
  onOpenContributors: () => void;
}) {
  return (
    <div className="ember-overlay-shell z-50 bg-white">
      <div className="relative h-full w-full overflow-hidden">
        <div className="relative h-[60%] overflow-hidden bg-[#a8ba91]">
          <MediaPreview
            mediaType={mediaType}
            filename={filename}
            posterFilename={posterFilename}
            originalName={emberTitle}
            usePosterForVideo
            controls={mediaType === 'VIDEO'}
            className={`h-full w-full ${mediaType === 'VIDEO' ? 'object-contain bg-[#a8ba91]' : 'object-cover bg-[#a8ba91]'}`}
          />
          <div className="pointer-events-none absolute inset-0 bg-white/28" />

          <div className="absolute left-5 top-3.5 right-24">
            <h1
              className={`max-w-[14rem] break-words text-[2rem] font-semibold leading-[1.04] tracking-[-0.05em] [overflow-wrap:anywhere] ${
                titleTone === 'dark'
                  ? 'text-black drop-shadow-[0_1px_2px_rgba(255,255,255,0.28)]'
                  : 'text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.12)]'
              }`}
            >
              {emberTitle}
            </h1>
          </div>
        </div>

        <div className="absolute inset-x-0 top-[3rem] bottom-[34%] bg-[#bfd8dc]">
          <div className="flex justify-end px-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center text-white"
              aria-label="Close Tend Ember"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-y-5 px-5 pt-1">
            <TendMenuButton
              icon={<TendSettingsIcon className="h-full w-full" />}
              label="Settings"
              onClick={onOpenSettings}
              disabled={!canManage}
            />
            <TendMenuButton
              icon={<TendAddContentIcon className="h-full w-full" />}
              label="Add Content"
              onClick={onOpenAddContent}
              disabled={!canManage}
            />
            <TendMenuButton
              icon={<TendWikiIcon className="h-full w-full" />}
              label="View Wiki"
              onClick={onOpenWiki}
            />
            <TendMenuButton
              icon={<TendStoryCutIcon className="h-full w-full" />}
              label="Snapshot"
              onClick={onOpenStoryCut}
              disabled={!canManage}
            />
            <TendMenuButton
              icon={<TendTagPeopleIcon className="h-full w-full" />}
              label="Tag People"
              onClick={onOpenTagPeople}
              disabled={!canManage}
            />
            <TendMenuButton
              icon={<TendEditTitleIcon className="h-full w-full" />}
              label="Smart Title"
              onClick={onOpenEditTitle}
              disabled={!canManage}
            />
            <TendMenuButton
              icon={<TendContributorsIcon className="h-full w-full" />}
              label="Contributors"
              onClick={onOpenContributors}
            />
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 top-[66%] flex items-start justify-center bg-[var(--ember-orange)] px-8 pt-5 text-center text-white">
          <p className="max-w-[17rem] text-[1.05rem] font-medium leading-[1.28] tracking-[-0.02em] sm:max-w-[20rem] sm:text-[1.25rem]">
            Tend to your ember&apos;s growth with these options.
          </p>
        </div>
      </div>
    </div>
  );
}

function ShareEmberExperience({
  canManage,
  shareToNetwork,
  savingShareState,
  shareError,
  actionNotice,
  onClose,
  onShareNetworkChange,
  onSaveNetworkSharing,
  onShareAction,
}: {
  canManage: boolean;
  shareToNetwork: boolean;
  savingShareState: boolean;
  shareError: string;
  actionNotice: string;
  onClose: () => void;
  onShareNetworkChange: (checked: boolean) => void;
  onSaveNetworkSharing: () => void;
  onShareAction: (
    target: 'facebook' | 'x' | 'email' | 'instagram' | 'tiktok' | 'copy'
  ) => void;
}) {
  const shareMethods: Array<{
    key: 'copy' | 'email' | 'facebook' | 'x' | 'instagram' | 'tiktok';
    label: string;
  }> = [
    { key: 'copy', label: 'Copy Link' },
    { key: 'email', label: 'Email' },
    { key: 'facebook', label: 'Facebook' },
    { key: 'x', label: 'X' },
    { key: 'instagram', label: 'Instagram' },
    { key: 'tiktok', label: 'TikTok' },
  ];

  return (
    <div className="ember-overlay-shell z-50 bg-[#bfd8dc]">
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between px-5 pt-4">
          <h2 className="text-[1.05rem] font-semibold tracking-[-0.03em] text-black sm:text-[1.2rem]">
            Share Ember
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center text-black"
            aria-label="Close Share Ember"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-7 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-10">
          <div className="mx-auto flex max-w-[18rem] flex-col items-center justify-center gap-4">
            {shareMethods.map((method) => (
              <button
                key={method.key}
                type="button"
                onClick={() => onShareAction(method.key)}
                className="min-h-[3.35rem] w-full rounded-[1.2rem] border border-white/75 bg-white/35 px-4 py-3 text-center text-[1rem] font-medium tracking-[-0.02em] text-white shadow-[0_10px_24px_rgba(255,255,255,0.08)] transition hover:bg-white/42"
              >
                {method.label}
              </button>
            ))}
          </div>

          {canManage && (
            <div className="mx-auto mt-8 max-w-[18rem] rounded-[1.25rem] border border-white/60 bg-white/28 px-4 py-4">
              <label className="flex items-center justify-between gap-3 text-sm font-medium text-black">
                <span>Share to Ember feed</span>
                <input
                  type="checkbox"
                  checked={shareToNetwork}
                  onChange={(event) => onShareNetworkChange(event.target.checked)}
                  className="h-4 w-4 rounded border-white/70 text-[var(--ember-orange)]"
                />
              </label>
              <button
                type="button"
                onClick={onSaveNetworkSharing}
                disabled={savingShareState}
                className="mt-4 min-h-[2.8rem] w-full rounded-[1rem] bg-white px-4 py-2 text-sm font-semibold text-[var(--ember-orange)] disabled:opacity-60"
              >
                {savingShareState ? 'Saving...' : 'Save Sharing'}
              </button>
            </div>
          )}

          {(shareError || actionNotice) && (
            <div className="mx-auto mt-6 max-w-[18rem] text-center text-sm font-medium text-black/76">
              {shareError || actionNotice}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WikiOverlayExperience({
  imageId,
  wikiContent,
  wikiUpdatedAt,
  voiceCallClips,
  attachments,
  canManage,
  generating,
  onGenerate,
  onClose,
}: {
  imageId: string;
  wikiContent: string | null;
  wikiUpdatedAt: string | null;
  voiceCallClips: Array<{
    id: string;
    contributorName: string;
    title: string;
    quote: string;
    significance: string | null;
    audioUrl: string | null;
    startMs: number | null;
    endMs: number | null;
    createdAt: string;
  }>;
  attachments: Array<{
    id: string;
    filename: string;
    mediaType: 'IMAGE' | 'VIDEO' | 'AUDIO';
    posterFilename: string | null;
    durationSeconds: number | null;
    originalName: string;
    description: string | null;
  }>;
  canManage: boolean;
  generating: boolean;
  onGenerate: () => void;
  onClose: () => void;
}) {
  const audioAttachments = attachments.filter((attachment) => attachment.mediaType === 'AUDIO');
  const visualAttachments = attachments.filter((attachment) => attachment.mediaType !== 'AUDIO');

  return (
    <div className="ember-overlay-shell z-50 bg-[#bfd8dc]">
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between px-5 pt-4">
          <h2 className="text-[1.05rem] font-semibold tracking-[-0.03em] text-black sm:text-[1.2rem]">
            Ember Wiki
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center text-black"
            aria-label="Close Ember Wiki"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-[calc(env(safe-area-inset-bottom)+1.4rem)] pt-10">
          {wikiContent ? (
            <div className="mx-auto max-w-[22rem] space-y-8 sm:max-w-[24rem]">
              <div className="rounded-[1.8rem] bg-white/44 px-5 py-6 shadow-[0_12px_26px_rgba(0,0,0,0.08)]">
                <WikiView content={wikiContent} variant="overlay" />
              </div>

              <WikiVoiceClipSection clips={voiceCallClips} imageId={imageId} variant="overlay" />

              {audioAttachments.length > 0 && (
                <section className="rounded-[1.8rem] bg-white/34 px-5 py-6 shadow-[0_12px_26px_rgba(0,0,0,0.06)]">
                  <h3 className="text-center text-[1.2rem] font-semibold tracking-[-0.03em] text-[var(--ember-text)]">
                    Recorded Audio
                  </h3>
                  <div className="mt-5 space-y-3">
                    {audioAttachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="rounded-[1.25rem] bg-white/78 px-4 py-4 text-left shadow-[0_8px_18px_rgba(0,0,0,0.05)]"
                      >
                        <div className="text-sm font-semibold text-[var(--ember-text)]">
                          {attachment.originalName}
                        </div>
                        <div className="mt-2 text-[11px] leading-5 text-[var(--ember-muted)]">
                          {attachment.description?.trim() || 'Recorded voice note'}
                        </div>
                        <MediaPreview
                          mediaType={attachment.mediaType}
                          filename={attachment.filename}
                          posterFilename={attachment.posterFilename}
                          originalName={attachment.originalName}
                          controls
                          className="mt-4 w-full"
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {visualAttachments.length > 0 && (
                <section className="rounded-[1.8rem] bg-white/34 px-5 py-6 shadow-[0_12px_26px_rgba(0,0,0,0.06)]">
                  <h3 className="text-center text-[1.2rem] font-semibold tracking-[-0.03em] text-[var(--ember-text)]">
                    Supporting Media
                  </h3>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    {visualAttachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="overflow-hidden rounded-[1.1rem] bg-white/78 text-left shadow-[0_8px_18px_rgba(0,0,0,0.05)]"
                      >
                        <MediaPreview
                          mediaType={attachment.mediaType}
                          filename={attachment.filename}
                          posterFilename={attachment.posterFilename}
                          originalName={attachment.originalName}
                          usePosterForVideo
                          className="h-24 w-full object-cover"
                        />
                        <div className="space-y-1 px-3 py-3">
                          <div className="text-xs font-semibold text-[var(--ember-text)]">
                            {attachment.originalName}
                          </div>
                          <div className="text-[11px] leading-5 text-[var(--ember-muted)]">
                            {attachment.description?.trim() || 'No note added yet.'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          ) : (
            <div className="mx-auto max-w-[18rem] text-center text-[1.04rem] font-medium leading-[1.35] tracking-[-0.02em] text-white">
              Generate the story first and the Ember Wiki will show here.
            </div>
          )}

          {wikiUpdatedAt && (
            <div className="mx-auto mt-8 max-w-[18rem] text-center text-xs font-medium uppercase tracking-[0.18em] text-black/52">
              Updated {new Date(wikiUpdatedAt).toLocaleString()}
            </div>
          )}

          {canManage && (
            <div className="mx-auto mt-8 max-w-[18rem]">
              <button
                type="button"
                onClick={onGenerate}
                disabled={generating}
                className="min-h-[3.2rem] w-full rounded-[1rem] bg-[rgba(27,75,74,0.9)] px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-white transition disabled:opacity-60"
              >
                {generating ? 'Generating...' : 'Regenerate Wiki'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmberSheet({
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-[rgba(17,17,17,0.42)]" onClick={onClose}>
      <div
        className="ember-sheet-surface absolute bottom-0 left-1/2 max-h-[88vh] w-full max-w-[26rem] -translate-x-1/2 overflow-hidden animate-[ember-sheet-rise_240ms_ease-out]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b ember-divider px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="ember-heading text-[1.8rem] text-[var(--ember-text)]">{title}</h2>
              <p className="ember-copy mt-2 text-sm">{subtitle}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--ember-line-strong)] bg-white text-[var(--ember-text)] hover:border-[rgba(255,102,33,0.24)]"
              aria-label="Close panel"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        <div className="ember-sheet-body">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function ImagePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [image, setImage] = useState<ImageRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [shareToNetwork, setShareToNetwork] = useState(false);
  const [savingShareState, setSavingShareState] = useState(false);
  const [shareError, setShareError] = useState('');
  const [actionNotice, setActionNotice] = useState('');
  const [memoryEntryError, setMemoryEntryError] = useState('');
  const [startingMemoryCall, setStartingMemoryCall] = useState(false);
  const [generatingWiki, setGeneratingWiki] = useState(false);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [shapeView, setShapeView] = useState<ShapeView>('menu');
  const [autoTagPromptDismissed, setAutoTagPromptDismissed] = useState(false);
  const [locationPromptDismissed, setLocationPromptDismissed] = useState(false);
  const [askChatExpanded, setAskChatExpanded] = useState(false);
  const [tendTagPromptOpen, setTendTagPromptOpen] = useState(false);
  const [shapeOrigin, setShapeOrigin] = useState<'tend' | 'setup'>('tend');
  const [titleDraft, setTitleDraft] = useState('');
  const [titleSuggestions, setTitleSuggestions] = useState<string[]>([]);
  const [groupedTitleSuggestions, setGroupedTitleSuggestions] = useState<{
    analysis: string[];
    context: string[];
  }>({
    analysis: [],
    context: [],
  });
  const [titleContributorQuotes, setTitleContributorQuotes] = useState<
    Array<{
      title: string;
      contributorName: string;
      quote: string;
      source: 'voice' | 'text';
    }>
  >([]);
  const [loadingTitleSuggestions, setLoadingTitleSuggestions] = useState(false);
  const [editingSmartTitle, setEditingSmartTitle] = useState(false);
  const [captionDraft, setCaptionDraft] = useState('');
  const [loadingCaptionSuggestion, setLoadingCaptionSuggestion] = useState(false);
  const [editingSmartCaption, setEditingSmartCaption] = useState(false);
  const [smartCaptionVoice, setSmartCaptionVoice] =
    useState<(typeof SMART_CAPTION_VOICE_OPTIONS)[number]>('Susan');
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestionOption[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [locationDraft, setLocationDraft] = useState('');
  const [loadingLocationSuggestions, setLoadingLocationSuggestions] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [capturedAtDraft, setCapturedAtDraft] = useState('');
  const [heroOverlayTone, setHeroOverlayTone] = useState<{
    title: 'light' | 'dark';
    rail: 'light' | 'dark';
  }>({
    title: 'light',
    rail: 'dark',
  });
  const [savingCapturedAt, setSavingCapturedAt] = useState(false);
  const [analysisRunning, setAnalysisRunning] = useState(false);
  const [storyCirclePrompt, setStoryCirclePrompt] = useState('');
  const [storyCircleQuestionType, setStoryCircleQuestionType] = useState('');
  const [storyCircleAnswer, setStoryCircleAnswer] = useState('');
  const [storyCircleAnswers, setStoryCircleAnswers] = useState<StoryCircleAnswer[]>([]);
  const [storyCircleCount, setStoryCircleCount] = useState(0);
  const [storyCircleTotalCount, setStoryCircleTotalCount] = useState(0);
  const [storyCircleComplete, setStoryCircleComplete] = useState(false);
  const [loadingStoryCircle, setLoadingStoryCircle] = useState(false);
  const [savingStoryCircle, setSavingStoryCircle] = useState(false);
  const [storyCircleVoiceState, setStoryCircleVoiceState] = useState<
    'idle' | 'starting' | 'active' | 'ending'
  >('idle');
  const [storyCircleVoiceError, setStoryCircleVoiceError] = useState('');
  const [storyCircleVoiceTranscript, setStoryCircleVoiceTranscript] = useState('');
  const [storyCutStyle, setStoryCutStyle] = useState<StoryCutStyle>('documentary');
  const [storyCutDuration, setStoryCutDuration] = useState<number>(10);
  const [storyCutTitle, setStoryCutTitle] = useState('');
  const [storyCutFocus, setStoryCutFocus] = useState(
    'The emotional heart of the moment and why it matters.'
  );
  const [storyCutSelectedMediaIds, setStoryCutSelectedMediaIds] = useState<string[]>([]);
  const [storyCutSelectedContributorIds, setStoryCutSelectedContributorIds] = useState<string[]>([]);
  const [storyCutIncludeOwner, setStoryCutIncludeOwner] = useState(true);
  const [storyCutIncludeEmberVoice, setStoryCutIncludeEmberVoice] = useState(true);
  const [storyCutIncludeNarratorVoice, setStoryCutIncludeNarratorVoice] = useState(false);
  const [storyCutVoiceOptions, setStoryCutVoiceOptions] = useState<StoryCutVoiceOption[]>([]);
  const [loadingStoryCutVoices, setLoadingStoryCutVoices] = useState(false);
  const [storyCutEmberVoiceId, setStoryCutEmberVoiceId] = useState('');
  const [storyCutNarratorVoiceId, setStoryCutNarratorVoiceId] = useState('');
  const [storyCutLoading, setStoryCutLoading] = useState(false);
  const [storyCutError, setStoryCutError] = useState('');
  const [storyCutData, setStoryCutData] = useState<StoryCutResult | null>(null);
  const [storyCutScriptDraft, setStoryCutScriptDraft] = useState('');
  const [storyCutBlocksDraft, setStoryCutBlocksDraft] = useState<StoryCutBlock[]>([]);
  const [storyCutNewMediaId, setStoryCutNewMediaId] = useState('');
  const [savingStoryCutScript, setSavingStoryCutScript] = useState(false);
  const [storyCutPlaybackState, setStoryCutPlaybackState] = useState<'idle' | 'loading' | 'playing'>('idle');
  const [storyCutPlaybackError, setStoryCutPlaybackError] = useState('');
  const [setupFocus, setSetupFocus] = useState<
    | 'storyCuts'
    | 'storyCircle'
    | 'title'
    | 'location'
    | 'timeDate'
    | 'taggedPeople'
    | 'supportingMedia'
    | 'analysis'
    | 'contributors'
  >('storyCuts');
  const [savingDetails, setSavingDetails] = useState(false);
  const [narrationState, setNarrationState] = useState<'idle' | 'loading' | 'playing'>('idle');
  const [narrationError, setNarrationError] = useState('');
  const [narrationScript, setNarrationScript] = useState('');
  const [voicePreference] = useState<NarrationPreference>('female');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const narrationRequestRef = useRef(0);
  const heroStageRef = useRef<HTMLDivElement | null>(null);
  const storyCutAudioRef = useRef<HTMLAudioElement | null>(null);
  const storyCutAudioUrlRef = useRef<string | null>(null);
  const storyCutAmbientAudioRefs = useRef<HTMLAudioElement[]>([]);
  const storyCutPlaybackRequestRef = useRef(0);
  const retellWebClientRef = useRef<RetellWebClient | null>(null);
  const storyCircleSyncTimerRef = useRef<number | null>(null);
  const fromUpload = searchParams.get('fromUpload') === '1';
  const setupRequested = searchParams.get('setup') === '1';
  const requestedPanel = searchParams.get('panel');
  const requestedShapeView = searchParams.get('view');

  const fetchImage = useCallback(async () => {
    try {
      const response = await fetch(`/api/images/${params.id}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Image not found');
      }

      setImage(payload);
      setShareToNetwork(payload.shareToNetwork);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load image');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  const normalizeImageStoryCut = useCallback(
    (
      source:
        | StoryCutResult
        | (NonNullable<ImageRecord['storyCut']> & {
            metadata?: Partial<StoryCutResult['metadata']> | null;
            selectedMediaIds?: string[];
            selectedContributorIds?: string[];
          })
    ): NonNullable<ImageRecord['storyCut']> => ({
      id: 'id' in source && typeof source.id === 'string' ? source.id : image?.storyCut?.id || 'snapshot',
      title: source.title,
      style: source.style,
      focus: source.metadata?.focus || ('focus' in source ? source.focus || null : null),
      durationSeconds: 'duration' in source ? source.duration : source.durationSeconds,
      wordCount: source.wordCount,
      script: source.script,
      blocks: source.blocks as NonNullable<ImageRecord['storyCut']>['blocks'],
      metadata: source.metadata || null,
      selectedMediaIds:
        'selectedMediaIds' in source && Array.isArray(source.selectedMediaIds)
          ? source.selectedMediaIds
          : storyCutSelectedMediaIds,
      selectedContributorIds:
        'selectedContributorIds' in source && Array.isArray(source.selectedContributorIds)
          ? source.selectedContributorIds
          : storyCutSelectedContributorIds,
      includeOwner:
        'includeOwner' in source && typeof source.includeOwner === 'boolean'
          ? source.includeOwner
          : storyCutIncludeOwner,
      includeEmberVoice:
        'includeEmberVoice' in source && typeof source.includeEmberVoice === 'boolean'
          ? source.includeEmberVoice
          : storyCutIncludeEmberVoice,
      includeNarratorVoice:
        'includeNarratorVoice' in source && typeof source.includeNarratorVoice === 'boolean'
          ? source.includeNarratorVoice
          : false,
      emberVoiceId:
        'emberVoiceId' in source && typeof source.emberVoiceId === 'string'
          ? source.emberVoiceId
          : storyCutEmberVoiceId || null,
      emberVoiceLabel:
        'emberVoiceLabel' in source && typeof source.emberVoiceLabel === 'string'
          ? source.emberVoiceLabel
          : storyCutVoiceOptions.find((voice) => voice.voiceId === storyCutEmberVoiceId)?.label || null,
      narratorVoiceId:
        'narratorVoiceId' in source && typeof source.narratorVoiceId === 'string'
          ? source.narratorVoiceId
          : null,
      narratorVoiceLabel:
        'narratorVoiceLabel' in source && typeof source.narratorVoiceLabel === 'string'
          ? source.narratorVoiceLabel
          : null,
      updatedAt:
        'updatedAt' in source && typeof source.updatedAt === 'string'
          ? source.updatedAt
          : new Date().toISOString(),
    }),
    [
      image?.storyCut?.id,
      storyCutEmberVoiceId,
      storyCutIncludeEmberVoice,
      storyCutIncludeOwner,
      storyCutSelectedContributorIds,
      storyCutSelectedMediaIds,
      storyCutVoiceOptions,
    ]
  );

  const normalizeStoryCutBlocks = useCallback((blocks: StoryCutBlock[]) => {
    return blocks.map((block, index) => ({
      ...block,
      order: index + 1,
    }));
  }, []);

  const handleRegenerateWiki = async () => {
    if (!image?.canManage || generatingWiki) {
      return;
    }

    setGeneratingWiki(true);
    setShareError('');
    setActionNotice('');

    try {
      const response = await fetch(`/api/wiki/${params.id}`, {
        method: 'POST',
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to regenerate wiki');
      }

      await fetchImage();
      setActionNotice('Wiki regenerated.');
    } catch (err) {
      setShareError(err instanceof Error ? err.message : 'Failed to regenerate wiki');
    } finally {
      setGeneratingWiki(false);
    }
  };

  useEffect(() => {
    fetchImage();
  }, [fetchImage]);

  useEffect(() => {
    if (!image) {
      return;
    }

    setTitleDraft(image.title?.trim() || getEmberTitle(image));
    setGroupedTitleSuggestions({
      analysis: [],
      context: [],
    });
    setTitleContributorQuotes([]);
    setEditingSmartTitle(false);
    setCaptionDraft(image.description || '');
    setEditingSmartCaption(false);
    setLocationDraft(image.analysis?.confirmedLocation?.label || '');
    setCapturedAtDraft(
      image.analysis?.capturedAt
        ? new Date(image.analysis.capturedAt).toISOString().slice(0, 16)
        : ''
    );
    setStoryCutTitle(image.storyCut?.title || getEmberTitle(image));
    setStoryCutFocus(
      image.storyCut?.focus ||
        image.storyCut?.metadata?.focus ||
        `What made ${getEmberTitle(image)} memorable and emotionally meaningful.`
    );
    setStoryCutStyle(
      (image.storyCut?.style as StoryCutStyle | undefined) || 'documentary'
    );
      setStoryCutDuration(image.storyCut?.durationSeconds || 10);
    setStoryCutSelectedMediaIds(
      image.storyCut?.selectedMediaIds?.length
        ? image.storyCut.selectedMediaIds
        : [image.id, ...image.attachments.map((attachment) => attachment.id)]
    );
    setStoryCutSelectedContributorIds(image.storyCut?.selectedContributorIds || []);
    setStoryCutIncludeOwner(image.storyCut?.includeOwner ?? true);
    setStoryCutIncludeEmberVoice(image.storyCut?.includeEmberVoice ?? true);
    setStoryCutEmberVoiceId(image.storyCut?.emberVoiceId || '');
    setStoryCutData(
      image.storyCut
        ? {
            title: image.storyCut.title,
            style: image.storyCut.style,
            duration: image.storyCut.durationSeconds,
            wordCount: image.storyCut.wordCount,
            script: image.storyCut.script,
            blocks: image.storyCut.blocks as StoryCutBlock[],
            emberVoiceLines: image.storyCut.blocks
              .filter(
                (block): block is StoryCutBlock & { type: 'voice'; speaker?: string | null; content?: string | null } =>
                  block.type === 'voice' && block.speaker === 'EMBER VOICE' && Boolean(block.content)
              )
              .map((block) => block.content || ''),
            narratorVoiceLines: [],
            ownerLines: [],
            contributorLines: [],
            metadata: {
              focus:
                image.storyCut.focus ||
                image.storyCut.metadata?.focus ||
                `What made ${getEmberTitle(image)} memorable and emotionally meaningful.`,
              emberTitle:
                image.storyCut.metadata?.emberTitle || image.storyCut.title || getEmberTitle(image),
              styleApplied: image.storyCut.metadata?.styleApplied || image.storyCut.style,
              totalContributors:
                image.storyCut.metadata?.totalContributors || image.contributors.length,
              hasDirectQuotes: image.storyCut.metadata?.hasDirectQuotes || false,
            },
          }
        : null
    );
    setStoryCutScriptDraft(image.storyCut?.script || '');
    setStoryCutBlocksDraft(
      normalizeStoryCutBlocks((image.storyCut?.blocks as StoryCutBlock[] | undefined) || [])
    );
    setNarrationScript(image.storyCut?.script || '');
    setStoryCutError('');
  }, [image, normalizeStoryCutBlocks]);

  useEffect(() => {
    if (!image) {
      if (storyCutNewMediaId) {
        setStoryCutNewMediaId('');
      }
      return;
    }

    const nextMediaIds = [
      image.id,
      ...image.attachments.map((attachment) => attachment.id),
      ...image.voiceCallClips.filter((clip) => Boolean(clip.audioUrl)).map((clip) => clip.id),
    ];

    if (nextMediaIds.length === 0) {
      if (storyCutNewMediaId) {
        setStoryCutNewMediaId('');
      }
      return;
    }

    if (!storyCutNewMediaId || !nextMediaIds.includes(storyCutNewMediaId)) {
      const preferredMedia =
        image.voiceCallClips.find((clip) => Boolean(clip.audioUrl))?.id ||
        image.attachments.find((attachment) => attachment.mediaType === 'AUDIO')?.id ||
        image.attachments[0]?.id ||
        image.id;
      setStoryCutNewMediaId(preferredMedia || '');
    }
  }, [image, storyCutNewMediaId]);

  useEffect(() => {
    void router.prefetch('/feed');
  }, [router]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }

      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }

      if (storyCutAudioRef.current) {
        storyCutAudioRef.current.pause();
        storyCutAudioRef.current.src = '';
      }

      if (storyCutAudioUrlRef.current) {
        URL.revokeObjectURL(storyCutAudioUrlRef.current);
        storyCutAudioUrlRef.current = null;
      }

      for (const ambientAudio of storyCutAmbientAudioRefs.current) {
        ambientAudio.pause();
        ambientAudio.currentTime = 0;
        ambientAudio.src = '';
      }
      storyCutAmbientAudioRefs.current = [];
    };
  }, []);

  useEffect(() => {
    if (!actionNotice && !shareError) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setActionNotice('');
      setShareError('');
    }, 2800);
    return () => window.clearTimeout(timeoutId);
  }, [actionNotice, shareError]);

  useEffect(() => {
    const shouldShowSetupCards = Boolean(image?.canManage && setupRequested && !fromUpload);

    if (!image || shouldShowSetupCards) {
      setHeroOverlayTone({ title: 'light', rail: 'dark' });
      return;
    }

    let cancelled = false;

    const computeOverlayTone = () => {
      const heroEl = heroStageRef.current;
      if (!heroEl) {
        return;
      }

      const bounds = heroEl.getBoundingClientRect();
      if (!bounds.width || !bounds.height) {
        return;
      }

      const sourceImage = new Image();
      sourceImage.crossOrigin = 'anonymous';
      sourceImage.decoding = 'async';

      sourceImage.onload = () => {
        if (cancelled) {
          return;
        }

        const naturalWidth = sourceImage.naturalWidth || sourceImage.width;
        const naturalHeight = sourceImage.naturalHeight || sourceImage.height;
        if (!naturalWidth || !naturalHeight) {
          return;
        }

        const containerAspect = bounds.width / bounds.height;
        const sourceAspect = naturalWidth / naturalHeight;

        let sourceX = 0;
        let sourceY = 0;
        let sourceWidth = naturalWidth;
        let sourceHeight = naturalHeight;

        if (sourceAspect > containerAspect) {
          sourceWidth = naturalHeight * containerAspect;
          sourceX = (naturalWidth - sourceWidth) / 2;
        } else {
          sourceHeight = naturalWidth / containerAspect;
          sourceY = (naturalHeight - sourceHeight) / 2;
        }

        const sampleTone = (rect: {
          x: number;
          y: number;
          width: number;
          height: number;
        }): 'light' | 'dark' => {
          const canvas = document.createElement('canvas');
          canvas.width = 24;
          canvas.height = 24;
          const context = canvas.getContext('2d', { willReadFrequently: true });

          if (!context) {
            return 'light';
          }

          const sx = sourceX + sourceWidth * rect.x;
          const sy = sourceY + sourceHeight * rect.y;
          const sw = Math.max(1, sourceWidth * rect.width);
          const sh = Math.max(1, sourceHeight * rect.height);

          context.drawImage(sourceImage, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

          const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
          let luminanceTotal = 0;

          for (let index = 0; index < data.length; index += 4) {
            const red = data[index] / 255;
            const green = data[index + 1] / 255;
            const blue = data[index + 2] / 255;

            const linearize = (value: number) =>
              value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;

            const luminance =
              0.2126 * linearize(red) +
              0.7152 * linearize(green) +
              0.0722 * linearize(blue);

            luminanceTotal += luminance;
          }

          const averageLuminance = luminanceTotal / (data.length / 4);
          const whiteContrast = 1.05 / (averageLuminance + 0.05);
          const blackContrast = (averageLuminance + 0.05) / 0.05;

          return whiteContrast >= blackContrast ? 'light' : 'dark';
        };

        const nextTone = {
          title: sampleTone({ x: 0.03, y: 0.03, width: 0.48, height: 0.17 }),
          rail: sampleTone({ x: 0.79, y: 0.2, width: 0.18, height: 0.63 }),
        };

        setHeroOverlayTone((current) =>
          current.title === nextTone.title && current.rail === nextTone.rail ? current : nextTone
        );
      };

      sourceImage.src = getPreviewMediaUrl({
        mediaType: image.mediaType,
        filename: image.filename,
        posterFilename: image.posterFilename,
      });
    };

    computeOverlayTone();
    window.addEventListener('resize', computeOverlayTone);

    return () => {
      cancelled = true;
      window.removeEventListener('resize', computeOverlayTone);
    };
  }, [image, fromUpload, setupRequested]);

  useEffect(() => {
    setAutoTagPromptDismissed(false);
    setLocationPromptDismissed(false);
  }, [fromUpload, params.id]);

  useEffect(() => {
    if (
      requestedPanel === 'ask' ||
      requestedPanel === 'contributors' ||
      requestedPanel === 'shape' ||
      requestedPanel === 'share' ||
      requestedPanel === 'wiki' ||
      requestedPanel === 'storyCuts'
    ) {
      if (requestedPanel === 'ask') {
        setAskChatExpanded(true);
      }
      setActivePanel(requestedPanel);

      if (requestedPanel === 'shape') {
        if (
          requestedShapeView === 'storyCircle' ||
          requestedShapeView === 'tag' ||
          requestedShapeView === 'addContent' ||
          requestedShapeView === 'editTitle' ||
          requestedShapeView === 'editCaption' ||
          requestedShapeView === 'location' ||
          requestedShapeView === 'timeDate' ||
          requestedShapeView === 'analysis' ||
          requestedShapeView === 'activity'
        ) {
          setShapeView(requestedShapeView);
        } else {
          setShapeView('menu');
        }
      }

      return;
    }

    if (activePanel) {
      return;
    }

    setShapeView('menu');
  }, [activePanel, requestedPanel, requestedShapeView]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    if (!activePanel) {
      document.body.style.removeProperty('overflow');
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [activePanel]);

  const closePanel = () => {
    if (activePanel === 'play') {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }

      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }

      setNarrationState('idle');
      setNarrationError('');
    }

    if (activePanel === 'storyCuts') {
      setStoryCutError('');
    }

    stopStoryCutPlayback();
    setStoryCutPlaybackError('');

    if (
      (activePanel === 'shape' && shapeView === 'storyCircle') ||
      storyCircleVoiceState === 'active' ||
      storyCircleVoiceState === 'starting' ||
      storyCircleVoiceState === 'ending'
    ) {
      stopStoryCircleWebCall();
      setStoryCircleVoiceState('idle');
    }

    setAskChatExpanded(false);
    setTendTagPromptOpen(false);
    setShapeOrigin('tend');
    setMemoryEntryError('');
    setEditingSmartTitle(false);
    setEditingSmartCaption(false);
    setActivePanel(null);
    setShapeView('menu');

    if (requestedPanel || requestedShapeView) {
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.delete('panel');
      nextParams.delete('view');

      const nextQuery = nextParams.toString();
      router.replace(nextQuery ? `/image/${params.id}?${nextQuery}` : `/image/${params.id}`);
    }
  };

  const openTendView = (view: ShapeView, origin: 'tend' | 'setup' = 'tend') => {
    setShapeOrigin(origin);
    setShapeView(view);
    setActivePanel('shape');
  };

  const returnFromShapeDetail = () => {
    if (shapeView === 'storyCircle') {
      stopStoryCircleWebCall();
      setStoryCircleVoiceState('idle');
    }

    if (shapeOrigin === 'setup') {
      closePanel();
      return;
    }

    setShapeView('menu');
  };

  const handleSaveImageDetails = async (
    updates: {
      title?: string | null;
      description?: string | null;
    },
    options?: {
      closeAfterSave?: boolean;
      successMessage?: string;
    }
  ) => {
    if (!image || savingDetails) {
      return;
    }

    setSavingDetails(true);
    setShareError('');

    try {
      const response = await fetch(`/api/images/${image.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to update this Ember.');
      }

      await fetchImage();
      setActionNotice(options?.successMessage || 'Ember details updated.');

      if (options?.closeAfterSave !== false) {
        returnFromShapeDetail();
      }
    } catch (detailsError) {
      setShareError(
        detailsError instanceof Error ? detailsError.message : 'Failed to update this Ember.'
      );
    } finally {
      setSavingDetails(false);
    }
  };

  const loadTitleSuggestions = useCallback(async (forceRefresh = false) => {
    if (!image?.canManage) {
      return;
    }

    setLoadingTitleSuggestions(true);
    setShareError('');

    try {
      const response = await fetch(
        `/api/images/${image.id}/title-suggestions${forceRefresh ? '?refresh=1' : ''}`,
        {
        cache: 'no-store',
        }
      );
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to generate title suggestions');
      }

      const analysisSuggestions = Array.isArray(payload?.analysisSuggestions)
        ? (payload.analysisSuggestions as string[])
        : [];
      const contextSuggestions = Array.isArray(payload?.contextSuggestions)
        ? (payload.contextSuggestions as string[])
        : [];
      const contributorQuotes = Array.isArray(payload?.contributorQuotes)
        ? (payload.contributorQuotes as Array<{
            title: string;
            contributorName: string;
            quote: string;
            source: 'voice' | 'text';
          }>)
        : [];
      setGroupedTitleSuggestions({
        analysis: analysisSuggestions,
        context: contextSuggestions,
      });
      setTitleContributorQuotes(contributorQuotes);
      setTitleSuggestions(
        Array.isArray(payload?.suggestions)
          ? payload.suggestions
          : Array.from(
              new Set([
                ...analysisSuggestions,
                ...contextSuggestions,
                ...contributorQuotes.map((item) => item.title),
              ])
            )
      );
    } catch (titleError) {
      setShareError(
        titleError instanceof Error
          ? titleError.message
          : 'Failed to generate title suggestions'
      );
    } finally {
      setLoadingTitleSuggestions(false);
    }
  }, [image?.canManage, image?.id]);

  const handleLetEmberTryTitle = async () => {
    if (!image?.canManage) {
      return;
    }

    setLoadingTitleSuggestions(true);
    setShareError('');

    try {
      const response = await fetch(`/api/images/${image.id}/title-suggestions`, {
        method: 'POST',
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to generate a title');
      }

      if (payload?.title) {
        setTitleDraft(payload.title);
        setGroupedTitleSuggestions((current) => ({
          ...current,
          context: Array.from(
            new Set([payload.title, ...current.context].map((title) => title.trim()))
          ).slice(0, 3),
        }));
        setTitleSuggestions((current) => {
          const next = [payload.title, ...current].filter(Boolean);
          return Array.from(new Set(next.map((title: string) => title.trim()))).slice(0, 4);
        });
      }
    } catch (titleError) {
      setShareError(
        titleError instanceof Error ? titleError.message : 'Failed to generate a title'
      );
    } finally {
      setLoadingTitleSuggestions(false);
    }
  };

  const handleSaveSmartTitle = async () => {
    if (!image || savingDetails) {
      return;
    }

    const nextTitle = titleDraft.trim() || null;
    const currentTitle = image.title?.trim() || null;

    if (nextTitle === currentTitle) {
      setEditingSmartTitle(false);
      return;
    }

    await handleSaveImageDetails(
      { title: nextTitle },
      {
        closeAfterSave: false,
        successMessage: 'Smart title updated.',
      }
    );
    setEditingSmartTitle(false);
  };

  const handleRegenerateSmartTitle = async () => {
    if (!image?.canManage) {
      return;
    }

    setEditingSmartTitle(false);
    await loadTitleSuggestions(true);
  };

  const handleSaveSmartCaption = async () => {
    if (!image || savingDetails) {
      return;
    }

    const nextCaption = captionDraft.trim() || null;
    const currentCaption = image.description?.trim() || null;

    if (nextCaption === currentCaption) {
      setEditingSmartCaption(false);
      return;
    }

    await handleSaveImageDetails(
      { description: nextCaption },
      {
        closeAfterSave: false,
        successMessage: 'Smart caption updated.',
      }
    );
    setEditingSmartCaption(false);
  };

  const handleRegenerateSmartCaption = async () => {
    if (!image?.canManage) {
      return;
    }

    setEditingSmartCaption(false);
    setLoadingCaptionSuggestion(true);
    setShareError('');

    try {
      const response = await fetch(`/api/images/${image.id}/caption-suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice: smartCaptionVoice }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to generate a smart caption');
      }

      if (!payload?.caption) {
        throw new Error('Failed to generate a smart caption');
      }

      setCaptionDraft(payload.caption);

      await handleSaveImageDetails(
        { description: payload.caption },
        {
          closeAfterSave: false,
          successMessage: 'Smart caption regenerated.',
        }
      );
    } catch (captionError) {
      setShareError(
        captionError instanceof Error
          ? captionError.message
          : 'Failed to generate a smart caption'
      );
    } finally {
      setLoadingCaptionSuggestion(false);
    }
  };

  const loadLocationSuggestions = useCallback(async () => {
    if (!image?.canManage) {
      return;
    }

    setLoadingLocationSuggestions(true);
    setShareError('');

    try {
      const response = await fetch(`/api/images/${image.id}/location-suggestions`, {
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to load location suggestions');
      }

      const nextSuggestions = Array.isArray(payload?.suggestions)
        ? payload.suggestions
        : [];

      setLocationSuggestions(nextSuggestions);
      setSelectedLocationId(nextSuggestions[0]?.id || '');
    } catch (locationError) {
      setShareError(
        locationError instanceof Error
          ? locationError.message
          : 'Failed to load location suggestions'
      );
    } finally {
      setLoadingLocationSuggestions(false);
    }
  }, [image?.canManage, image?.id]);

  const handleSaveLocation = async () => {
    if (!image?.canManage || savingLocation) {
      return;
    }

    const selectedSuggestion =
      locationSuggestions.find((suggestion) => suggestion.id === selectedLocationId) || null;
    const label = locationDraft.trim() || selectedSuggestion?.label || '';

    if (!label) {
      setShareError('Add a location before saving it.');
      return;
    }

    setSavingLocation(true);
    setShareError('');

    try {
      const response = await fetch(`/api/images/${image.id}/location-suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label,
          detail: selectedSuggestion?.detail || null,
          kind: selectedSuggestion?.kind || 'manual',
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to save the location');
      }

      await fetchImage();
      setActionNotice('Location saved for this Ember.');
      returnFromShapeDetail();
    } catch (locationError) {
      setShareError(
        locationError instanceof Error ? locationError.message : 'Failed to save the location'
      );
    } finally {
      setSavingLocation(false);
    }
  };

  const handleSaveCapturedAt = async () => {
    if (!image?.canManage || savingCapturedAt) {
      return;
    }

    setSavingCapturedAt(true);
    setShareError('');

    try {
      const response = await fetch(`/api/images/${image.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          capturedAt: capturedAtDraft ? new Date(capturedAtDraft).toISOString() : null,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to save the date and time');
      }

      await fetchImage();
      setActionNotice('Date and time saved for this Ember.');
      returnFromShapeDetail();
    } catch (capturedAtError) {
      setShareError(
        capturedAtError instanceof Error
          ? capturedAtError.message
          : 'Failed to save the date and time'
      );
    } finally {
      setSavingCapturedAt(false);
    }
  };

  const handleRunImageAnalysis = async () => {
    if (!image?.canManage || analysisRunning) {
      return;
    }

    setAnalysisRunning(true);
    setShareError('');

    try {
      const response = await fetch(`/api/images/${image.id}/analysis`, {
        method: 'POST',
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to analyze the image');
      }

      await fetchImage();
      setActionNotice('Image analysis refreshed.');
    } catch (analysisError) {
      setShareError(
        analysisError instanceof Error ? analysisError.message : 'Failed to analyze the image'
      );
    } finally {
      setAnalysisRunning(false);
    }
  };

  const applyStoryCircleState = useCallback((payload: unknown) => {
    const record =
      payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};

    setStoryCirclePrompt(typeof record.prompt === 'string' ? record.prompt : '');
    setStoryCircleQuestionType(
      typeof record.questionType === 'string' ? record.questionType : ''
    );
    setStoryCircleCount(
      typeof record.answeredCount === 'number'
        ? record.answeredCount
        : typeof record.responseCount === 'number'
          ? record.responseCount
          : 0
    );
    setStoryCircleTotalCount(typeof record.totalCount === 'number' ? record.totalCount : 0);
    setStoryCircleComplete(record.isComplete === true);
    setStoryCircleAnswers(
      Array.isArray(record.responses) ? (record.responses as StoryCircleAnswer[]) : []
    );
  }, []);

  const loadStoryCircle = useCallback(async () => {
    if (!image?.canManage) {
      return;
    }

    setLoadingStoryCircle(true);
    setShareError('');

    try {
      const response = await fetch(`/api/images/${image.id}/story-circle`, {
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to prepare Story Circle');
      }

      applyStoryCircleState(payload);
    } catch (storyError) {
      setShareError(
        storyError instanceof Error ? storyError.message : 'Failed to prepare Story Circle'
      );
    } finally {
      setLoadingStoryCircle(false);
    }
  }, [applyStoryCircleState, image?.canManage, image?.id]);

  const handleSubmitStoryCircle = async () => {
    if (!image?.canManage || !storyCircleAnswer.trim() || savingStoryCircle) {
      return;
    }

    setSavingStoryCircle(true);
    setShareError('');

    try {
      const response = await fetch(`/api/images/${image.id}/story-circle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answer: storyCircleAnswer.trim(),
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to save the Story Circle response');
      }

      setStoryCircleAnswer('');
      applyStoryCircleState(payload);
      await fetchImage();
      setActionNotice('Story Circle response saved.');
    } catch (storyError) {
      setShareError(
        storyError instanceof Error
          ? storyError.message
          : 'Failed to save the Story Circle response'
      );
    } finally {
      setSavingStoryCircle(false);
    }
  };

  const scheduleStoryCircleSyncRefresh = useCallback(() => {
    if (storyCircleSyncTimerRef.current) {
      window.clearTimeout(storyCircleSyncTimerRef.current);
    }

    storyCircleSyncTimerRef.current = window.setTimeout(() => {
      storyCircleSyncTimerRef.current = null;
      void Promise.all([fetchImage(), loadStoryCircle()]);
    }, 4500);
  }, [fetchImage, loadStoryCircle]);

  const stopStoryCircleWebCall = useCallback(() => {
    try {
      retellWebClientRef.current?.stopCall();
    } catch (stopError) {
      console.error('Failed to stop Story Circle web call:', stopError);
    }
  }, []);

  const startStoryCircleWebCall = useCallback(async () => {
    if (!image?.canManage || storyCircleVoiceState === 'starting' || storyCircleVoiceState === 'active') {
      return;
    }

    setStoryCircleVoiceState('starting');
    setStoryCircleVoiceError('');
    setStoryCircleVoiceTranscript('');
    setShareError('');

    try {
      const response = await fetch(`/api/images/${image.id}/story-circle/web-call`, {
        method: 'POST',
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || typeof payload?.accessToken !== 'string') {
        throw new Error(payload?.error || 'Failed to start the live Story Circle call');
      }

      const { RetellWebClient } = await import('retell-client-js-sdk');
      const client = new RetellWebClient();

      client.on('call_started', () => {
        setStoryCircleVoiceState('active');
        setActionNotice('Live Story Circle call connected.');
      });

      client.on('call_ended', () => {
        setStoryCircleVoiceState('idle');
        setActionNotice('Live Story Circle call ended. Ember is syncing it now.');
        scheduleStoryCircleSyncRefresh();
      });

      client.on('update', (update: { transcript?: string }) => {
        if (typeof update?.transcript === 'string' && update.transcript.trim()) {
          setStoryCircleVoiceTranscript(update.transcript.trim());
        }
      });

      client.on('error', (callError: { message?: string }) => {
        setStoryCircleVoiceError(
          typeof callError?.message === 'string' && callError.message.trim()
            ? callError.message
            : 'The live Story Circle call hit an error.'
        );
        setStoryCircleVoiceState('idle');
        scheduleStoryCircleSyncRefresh();
      });

      retellWebClientRef.current = client;
      await client.startCall({
        accessToken: payload.accessToken,
      });
    } catch (callError) {
      setStoryCircleVoiceError(
        callError instanceof Error
          ? callError.message
          : 'Failed to start the live Story Circle call'
      );
      setStoryCircleVoiceState('idle');
    }
  }, [image?.canManage, image?.id, scheduleStoryCircleSyncRefresh, storyCircleVoiceState]);

  const handleShareSave = async () => {
    if (!image) {
      return;
    }

    setSavingShareState(true);
    setShareError('');

    try {
      const response = await fetch(`/api/images/${image.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareToNetwork }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to update sharing');
      }

      setImage((prev) => (prev ? { ...prev, shareToNetwork: payload.shareToNetwork } : prev));
      setActionNotice('Ember network sharing updated.');
    } catch (err) {
      setShareError(err instanceof Error ? err.message : 'Failed to update sharing');
    } finally {
      setSavingShareState(false);
    }
  };

  const openShareWindow = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer,width=720,height=640');
  };

  const handleShareAction = async (
    target: 'facebook' | 'x' | 'email' | 'instagram' | 'tiktok' | 'copy'
  ) => {
    if (!image) {
      return;
    }

    const shareUrl = `${window.location.origin}/image/${image.id}`;
    const displayTitle = getEmberTitle(image);
    const shareText = `Take a look at ${displayTitle} on Ember`;

    try {
      if (target === 'facebook') {
        openShareWindow(
          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`
        );
        setActionNotice('Opened Facebook sharing.');
        return;
      }

      if (target === 'x') {
        openShareWindow(
          `https://twitter.com/intent/tweet?url=${encodeURIComponent(
            shareUrl
          )}&text=${encodeURIComponent(shareText)}`
        );
        setActionNotice('Opened X sharing.');
        return;
      }

      if (target === 'email') {
        window.location.href = `mailto:?subject=${encodeURIComponent(
          displayTitle
        )}&body=${encodeURIComponent(`${shareText}\n\n${shareUrl}`)}`;
        return;
      }

      if (!navigator.clipboard?.writeText) {
        throw new Error('Copy and social prep are not available on this device.');
      }

      await navigator.clipboard.writeText(shareUrl);

      if (target === 'instagram') {
        setActionNotice('Ember link copied for Instagram sharing.');
        return;
      }

      if (target === 'tiktok') {
        setActionNotice('Ember link copied for TikTok sharing.');
        return;
      }

      setActionNotice('Ember link copied.');
    } catch (shareActionError) {
      setShareError(
        shareActionError instanceof Error
          ? shareActionError.message
          : 'Failed to prepare share link.'
      );
    }
  };

  const stopNarration = useCallback(() => {
    narrationRequestRef.current += 1;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }

    setNarrationState('idle');
  }, []);

  const stopStoryCutPlayback = useCallback(() => {
    storyCutPlaybackRequestRef.current += 1;

    if (storyCutAudioRef.current) {
      storyCutAudioRef.current.pause();
      storyCutAudioRef.current.currentTime = 0;
      storyCutAudioRef.current = null;
    }

    if (storyCutAudioUrlRef.current) {
      URL.revokeObjectURL(storyCutAudioUrlRef.current);
      storyCutAudioUrlRef.current = null;
    }

    for (const ambientAudio of storyCutAmbientAudioRefs.current) {
      ambientAudio.pause();
      ambientAudio.currentTime = 0;
      ambientAudio.src = '';
    }
    storyCutAmbientAudioRefs.current = [];

    setStoryCutPlaybackState('idle');
  }, []);

  const playStoryCutAudioSegment = useCallback(
    async ({
      src,
      objectUrl,
      startMs,
      endMs,
      playbackRequestId,
      errorMessage,
    }: {
      src: string;
      objectUrl?: string | null;
      startMs?: number | null;
      endMs?: number | null;
      playbackRequestId: number;
      errorMessage: string;
    }) => {
      const audio = new Audio(src);
      let settled = false;

      if (objectUrl) {
        storyCutAudioUrlRef.current = objectUrl;
      }
      storyCutAudioRef.current = audio;
      audio.preload = 'auto';

      const ensureMetadataAndSeek = async () => {
        const clipStartSeconds =
          typeof startMs === 'number' && Number.isFinite(startMs) ? Math.max(0, startMs / 1000) : null;

        if (audio.readyState < 1) {
          await new Promise<void>((resolve, reject) => {
            const handleLoaded = () => {
              audio.removeEventListener('loadedmetadata', handleLoaded);
              audio.removeEventListener('error', handleError);
              resolve();
            };
            const handleError = () => {
              audio.removeEventListener('loadedmetadata', handleLoaded);
              audio.removeEventListener('error', handleError);
              reject(new Error(errorMessage));
            };

            audio.addEventListener('loadedmetadata', handleLoaded);
            audio.addEventListener('error', handleError);
            audio.load();
          });
        }

        if (clipStartSeconds != null) {
          const maxStart =
            Number.isFinite(audio.duration) && audio.duration > 0
              ? Math.min(clipStartSeconds, audio.duration)
              : clipStartSeconds;
          audio.currentTime = maxStart;
        }
      };

      const cleanup = () => {
        audio.onended = null;
        audio.onerror = null;
        audio.onpause = null;
        audio.ontimeupdate = null;

        if (storyCutAudioRef.current === audio) {
          storyCutAudioRef.current = null;
        }

        if (objectUrl && storyCutAudioUrlRef.current === objectUrl) {
          URL.revokeObjectURL(objectUrl);
          storyCutAudioUrlRef.current = null;
        }
      };

      await new Promise<void>((resolve, reject) => {
        const finish = () => {
          if (settled) {
            return;
          }

          settled = true;
          cleanup();
          resolve();
        };

        const fail = () => {
          if (settled) {
            return;
          }

          settled = true;
          cleanup();
          reject(new Error(errorMessage));
        };

        audio.onended = () => {
          finish();
        };

        audio.onerror = () => {
          fail();
        };

        audio.onpause = () => {
          if (settled) {
            return;
          }

          if (storyCutPlaybackRequestRef.current !== playbackRequestId) {
            finish();
          }
        };

        const clipEndSeconds =
          typeof endMs === 'number' && Number.isFinite(endMs) ? Math.max(0, endMs / 1000) : null;

        if (clipEndSeconds != null) {
          audio.ontimeupdate = () => {
            if (audio.currentTime >= clipEndSeconds) {
              finish();
              audio.pause();
            }
          };
        }

        void ensureMetadataAndSeek()
          .then(() => audio.play())
          .then(() => {
            if (storyCutPlaybackRequestRef.current !== playbackRequestId) {
              finish();
              audio.pause();
              return;
            }

            setStoryCutPlaybackState('playing');
          })
          .catch(() => {
            fail();
          });
      });
    },
    []
  );

  const handleNarrationToggle = async () => {
    if (!image?.storyCut?.script && !image?.wiki?.content) {
      return;
    }

    if (narrationState === 'loading' || narrationState === 'playing') {
      stopNarration();
      return;
    }

    setNarrationError('');
    setNarrationState('loading');
    const narrationRequestId = narrationRequestRef.current + 1;
    narrationRequestRef.current = narrationRequestId;

    try {
      let script =
        storyCutData?.script?.trim() ||
        image?.storyCut?.script?.trim() ||
        storyCutScriptDraft.trim() ||
        narrationScript;
      const preferredVoiceId = image?.storyCut?.emberVoiceId || storyCutEmberVoiceId || null;

      if (script) {
        setNarrationScript(script);
      }

      if (!script) {
        const scriptResponse = await fetch('/api/narration/script', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: image.wiki?.content || '',
          }),
        });

        const scriptPayload = await scriptResponse.json().catch(() => null);

        if (!scriptResponse.ok) {
          throw new Error(scriptPayload?.error || 'Narration text could not be prepared.');
        }

        if (narrationRequestRef.current !== narrationRequestId) {
          return;
        }

        script = scriptPayload?.script || '';
        setNarrationScript(script);
      }

      const response = await fetch('/api/narration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script,
          voiceId: preferredVoiceId,
          voicePreference,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Narration could not be generated.');
      }

      const audioBlob = await response.blob();
      if (narrationRequestRef.current !== narrationRequestId) {
        return;
      }

      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      audioUrlRef.current = audioUrl;
      audioRef.current = audio;

      audio.onended = () => {
        stopNarration();
      };

      audio.onerror = () => {
        stopNarration();
        setNarrationError('Narration could not be played on this device.');
      };

      await audio.play();
      setNarrationState('playing');
    } catch (playError) {
      if (narrationRequestRef.current !== narrationRequestId) {
        return;
      }
      stopNarration();
      setNarrationError(
        playError instanceof Error ? playError.message : 'Narration could not be generated.'
      );
    }
  };

  const handlePlayStoryCut = async (storyCut: StoryCutResult | ImageRecord['storyCut']) => {
    if (!storyCut) {
      return;
    }

    const effectiveScript =
      ('script' in storyCut ? storyCutScriptDraft.trim() : '') || storyCut?.script || '';

    if (!effectiveScript) {
      return;
    }

    if (storyCutPlaybackState === 'loading' || storyCutPlaybackState === 'playing') {
      stopStoryCutPlayback();
      return;
    }

    setStoryCutPlaybackState('loading');
    setStoryCutPlaybackError('');
    const playbackRequestId = storyCutPlaybackRequestRef.current + 1;
    storyCutPlaybackRequestRef.current = playbackRequestId;

    const requestedVoiceId =
      storyCut && 'narratorVoiceId' in storyCut
        ? storyCut.emberVoiceId || null
        : storyCutEmberVoiceId || null;

    try {
      if (image?.id && Array.isArray(storyCut.blocks) && storyCut.blocks.length > 0) {
        try {
          const renderedStoryCutResponse = await fetch(`/api/images/${image.id}/story-cut-audio`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              script: effectiveScript,
              blocks: storyCut.blocks,
              voiceId: requestedVoiceId,
            }),
          });

          if (!renderedStoryCutResponse.ok) {
            const payload = await renderedStoryCutResponse.json().catch(() => null);
            throw new Error(payload?.error || 'Snapshot audio could not be prepared on this device.');
          }

          const renderedStoryCutBlob = await renderedStoryCutResponse.blob();
          const renderedStoryCutUrl = URL.createObjectURL(renderedStoryCutBlob);

          await playStoryCutAudioSegment({
            src: renderedStoryCutUrl,
            objectUrl: renderedStoryCutUrl,
            playbackRequestId,
            errorMessage: 'Snapshot audio could not be prepared on this device.',
          });
          stopStoryCutPlayback();
          return;
        } catch (renderedPlaybackError) {
          console.error('Falling back to block playback for Snapshot:', renderedPlaybackError);
        }
      }

      const mediaLookup = new Map<string, StoryCutMediaItem>(
        storyCutMediaItems.map((media) => [media.id, media])
      );
      const resolveFallbackMedia = (block: Extract<StoryCutBlock, { type: 'media' }>) => {
        const blockName = normalizeStoryCutMediaToken(block.mediaName);
        const blockQuote = normalizeStoryCutMediaToken(block.clipQuote);

        return (
          (block.mediaId ? mediaLookup.get(block.mediaId) || null : null) ||
          storyCutMediaItems.find((media) => {
            if (block.mediaType && media.mediaType !== block.mediaType) {
              return false;
            }

            const mediaName = normalizeStoryCutMediaToken(media.label);
            if (blockName && (mediaName === blockName || mediaName.includes(blockName) || blockName.includes(mediaName))) {
              return true;
            }

            const mediaQuote = normalizeStoryCutMediaToken(media.quote);
            if (blockQuote && mediaQuote && (mediaQuote === blockQuote || mediaQuote.includes(blockQuote) || blockQuote.includes(mediaQuote))) {
              return true;
            }

            return false;
          }) ||
          null
        );
      };
      const sortedBlocks: StoryCutBlock[] = Array.isArray(storyCut.blocks)
        ? [...(storyCut.blocks as StoryCutBlock[])].sort((left, right) => left.order - right.order)
        : [];
      const playbackBlocks: StoryCutBlock[] = sortedBlocks.length
        ? sortedBlocks.reduce<StoryCutBlock[]>((accumulator, block) => {
            if (isStoryCutVoiceBlock(block)) {
              const nextContent = block.content?.trim() || '';
              if (!nextContent) {
                return accumulator;
              }

              const lastBlock = accumulator[accumulator.length - 1];
              if (lastBlock && isStoryCutVoiceBlock(lastBlock)) {
                accumulator[accumulator.length - 1] = {
                  ...lastBlock,
                  content: `${lastBlock.content?.trim() || ''} ${nextContent}`.trim(),
                };
                return accumulator;
              }

              accumulator.push({
                ...block,
                content: nextContent,
              });
              return accumulator;
            }

            if (!isStoryCutAudioBlock(block)) {
              return accumulator;
            }

            const fallbackMedia = resolveFallbackMedia(block);
            const attachmentTrack =
              fallbackMedia?.id && image
                ? image.attachments.find(
                    (attachment) => attachment.id === fallbackMedia.id && attachment.mediaType === 'AUDIO'
                  ) || null
                : null;
            const voiceClipTrack =
              fallbackMedia?.id && image
                ? image.voiceCallClips.find(
                    (clip) => clip.id === fallbackMedia.id && Boolean(clip.audioUrl)
                  ) || null
                : null;
            const resolvedUrl =
              block.mediaUrl ||
              (attachmentTrack ? `/api/uploads/${attachmentTrack.filename}` : null) ||
              voiceClipTrack?.audioUrl ||
              (fallbackMedia?.mediaType === 'AUDIO' ? fallbackMedia.previewUrl || null : null);

            if (!resolvedUrl) {
              return accumulator;
            }

            accumulator.push({
              ...block,
              mediaUrl: resolvedUrl,
              clipStartMs:
                fallbackMedia?.startMs ?? voiceClipTrack?.startMs ??
                (typeof block.clipStartMs === 'number' ? block.clipStartMs : null),
              clipEndMs:
                fallbackMedia?.endMs ?? voiceClipTrack?.endMs ??
                (typeof block.clipEndMs === 'number' ? block.clipEndMs : null),
            });
            return accumulator;
          }, [])
        : [
            {
              type: 'voice',
              speaker: 'Ember',
              content: effectiveScript,
              voicePreference: 'ember',
              messageId: null,
              userId: null,
              order: 1,
            },
          ];

      for (const block of playbackBlocks) {
        if (storyCutPlaybackRequestRef.current !== playbackRequestId) {
          return;
        }

        if (isStoryCutVoiceBlock(block)) {
          const line = block.content?.trim() || '';
          if (!line) {
            continue;
          }

          const response = await fetch('/api/narration', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              script: line,
              voiceId: requestedVoiceId,
              voicePreference: voicePreference,
            }),
          });

          if (!response.ok) {
            const payload = await response.json().catch(() => null);
            throw new Error(payload?.error || 'Snapshot audio could not be generated.');
          }

          const audioBlob = await response.blob();
          const audioUrl = URL.createObjectURL(audioBlob);

          if (storyCutPlaybackRequestRef.current !== playbackRequestId) {
            URL.revokeObjectURL(audioUrl);
            return;
          }

          await playStoryCutAudioSegment({
            src: audioUrl,
            objectUrl: audioUrl,
            playbackRequestId,
            errorMessage: 'Snapshot audio could not be played on this device.',
          });
          continue;
        }

        if (!isStoryCutAudioBlock(block) || !block.mediaUrl) {
          continue;
        }

        try {
          const clipSegmentSrc =
            image?.id &&
            block.mediaId &&
            typeof block.clipStartMs === 'number' &&
            Number.isFinite(block.clipStartMs) &&
            typeof block.clipEndMs === 'number' &&
            Number.isFinite(block.clipEndMs) &&
            block.clipEndMs > block.clipStartMs
              ? `/api/images/${image.id}/audio-segment?${new URLSearchParams({
                  mediaId: block.mediaId,
                  startMs: String(block.clipStartMs),
                  endMs: String(block.clipEndMs),
                }).toString()}`
              : null;

          await playStoryCutAudioSegment({
            src: clipSegmentSrc || block.mediaUrl,
            startMs: clipSegmentSrc ? null : block.clipStartMs ?? null,
            endMs: clipSegmentSrc ? null : block.clipEndMs ?? null,
            playbackRequestId,
            errorMessage: 'A selected audio clip could not be played on this device.',
          });
        } catch (clipPlaybackError) {
          console.error('Skipping unsupported Snapshot clip:', clipPlaybackError);
          setStoryCutPlaybackError('One audio clip was skipped because this device could not play it.');
          continue;
        }
      }

      stopStoryCutPlayback();
    } catch (storyCutPlaybackIssue) {
      stopStoryCutPlayback();
      setStoryCutPlaybackError(
        storyCutPlaybackIssue instanceof Error
          ? storyCutPlaybackIssue.message
          : 'Snapshot audio could not be generated.'
      );
    }
  };

  const handleGenerateStoryCut = async () => {
    if (!image?.canManage || storyCutLoading) {
      return;
    }

    setStoryCutLoading(true);
    setStoryCutError('');

    try {
      const response = await fetch(`/api/images/${image.id}/story-cuts`, {
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
          emberVoiceId: storyCutEmberVoiceId || null,
          emberVoiceLabel:
            storyCutVoiceOptions.find((voice) => voice.voiceId === storyCutEmberVoiceId)?.label ||
            null,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.storyCut) {
        throw new Error(payload?.error || 'Failed to generate Snapshot');
      }

      const nextStoryCut = payload.storyCut as StoryCutResult;
      setStoryCutData(nextStoryCut);
      setStoryCutScriptDraft(nextStoryCut.script || '');
      setStoryCutBlocksDraft(normalizeStoryCutBlocks((nextStoryCut.blocks as StoryCutBlock[]) || []));
      setNarrationScript(nextStoryCut.script || '');
      setImage((current) =>
        current
          ? {
              ...current,
              storyCut: normalizeImageStoryCut(nextStoryCut),
            }
          : current
      );
      await fetchImage();
      setActionNotice('Snapshot generated.');
    } catch (storyCutGenerationError) {
      setStoryCutError(
        storyCutGenerationError instanceof Error
          ? storyCutGenerationError.message
          : 'Failed to generate Snapshot'
      );
    } finally {
      setStoryCutLoading(false);
    }
  };

  const handleSaveStoryCutScript = async () => {
    if (!image?.canManage || !storyCutData || savingStoryCutScript) {
      return;
    }

    const nextScript = storyCutScriptDraft.trim();
    const nextBlocks = normalizeStoryCutBlocks(storyCutBlocksDraft);
    if (!nextScript) {
      setStoryCutError('Snapshot text cannot be empty.');
      return;
    }

    if (nextScript === storyCutData.script.trim() && !storyCutBlocksChanged) {
      return;
    }

    setSavingStoryCutScript(true);
    setStoryCutError('');

    try {
      const response = await fetch(`/api/images/${image.id}/story-cuts`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: storyCutTitle.trim() || storyCutData.title,
          script: nextScript,
          blocks: nextBlocks,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.storyCut) {
        throw new Error(payload?.error || 'Failed to save Snapshot edits');
      }

      const updatedStoryCut = payload.storyCut as NonNullable<ImageRecord['storyCut']>;
      setStoryCutData((current) =>
        current
          ? {
              ...current,
              title: updatedStoryCut.title,
              style: updatedStoryCut.style,
              duration: updatedStoryCut.durationSeconds,
              wordCount: updatedStoryCut.wordCount,
              script: updatedStoryCut.script,
              blocks: updatedStoryCut.blocks as StoryCutBlock[],
              metadata: {
                focus:
                  updatedStoryCut.focus ||
                  updatedStoryCut.metadata?.focus ||
                  current.metadata.focus,
                emberTitle:
                  updatedStoryCut.metadata?.emberTitle ||
                  updatedStoryCut.title ||
                  current.metadata.emberTitle,
                styleApplied:
                  updatedStoryCut.metadata?.styleApplied ||
                  updatedStoryCut.style ||
                  current.metadata.styleApplied,
                totalContributors:
                  updatedStoryCut.metadata?.totalContributors ||
                  current.metadata.totalContributors,
                hasDirectQuotes:
                  updatedStoryCut.metadata?.hasDirectQuotes ??
                  current.metadata.hasDirectQuotes,
              },
            }
          : current
      );
      setStoryCutScriptDraft(updatedStoryCut.script);
      setStoryCutBlocksDraft(
        normalizeStoryCutBlocks((updatedStoryCut.blocks as StoryCutBlock[]) || [])
      );
      setNarrationScript(updatedStoryCut.script || '');
      setImage((current) =>
        current
          ? {
              ...current,
              storyCut: normalizeImageStoryCut(updatedStoryCut),
            }
          : current
      );
      await fetchImage();
      setActionNotice('Snapshot edits saved.');
    } catch (storyCutSaveError) {
      setStoryCutError(
        storyCutSaveError instanceof Error
          ? storyCutSaveError.message
          : 'Failed to save Snapshot edits'
      );
    } finally {
      setSavingStoryCutScript(false);
    }
  };

  const loadStoryCutVoices = useCallback(async () => {
    if (storyCutVoiceOptions.length > 0 || loadingStoryCutVoices) {
      return;
    }

    setLoadingStoryCutVoices(true);

    try {
      const response = await fetch('/api/story-cuts/voices', {
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to load voice options');
      }

      const nextVoices = Array.isArray(payload?.voices)
        ? (payload.voices as StoryCutVoiceOption[])
        : [];
      setStoryCutVoiceOptions(nextVoices);

      if (!storyCutEmberVoiceId && nextVoices[0]?.voiceId) {
        setStoryCutEmberVoiceId(nextVoices[0].voiceId);
      }
    } catch (voiceError) {
      setStoryCutError(
        voiceError instanceof Error ? voiceError.message : 'Failed to load voice options'
      );
    } finally {
      setLoadingStoryCutVoices(false);
    }
  }, [loadingStoryCutVoices, storyCutEmberVoiceId, storyCutVoiceOptions.length]);

  useEffect(() => {
    if (activePanel !== 'shape') {
      return;
    }

    if (
      shapeView === 'editTitle' &&
      groupedTitleSuggestions.analysis.length === 0 &&
      groupedTitleSuggestions.context.length === 0 &&
      !loadingTitleSuggestions
    ) {
      void loadTitleSuggestions();
    }

    if (shapeView === 'location' && locationSuggestions.length === 0 && !loadingLocationSuggestions) {
      void loadLocationSuggestions();
    }

    if (shapeView === 'storyCircle' && !storyCirclePrompt && !loadingStoryCircle) {
      void loadStoryCircle();
    }
  }, [
    activePanel,
    shapeView,
    groupedTitleSuggestions.analysis.length,
    groupedTitleSuggestions.context.length,
    loadingTitleSuggestions,
    loadTitleSuggestions,
    locationSuggestions.length,
    loadingLocationSuggestions,
    loadLocationSuggestions,
    storyCirclePrompt,
    loadingStoryCircle,
    loadStoryCircle,
  ]);

  useEffect(() => {
    if (activePanel === 'storyCuts') {
      void loadStoryCutVoices();
    }
  }, [activePanel, loadStoryCutVoices]);

  useEffect(() => {
    return () => {
      if (storyCircleSyncTimerRef.current) {
        window.clearTimeout(storyCircleSyncTimerRef.current);
      }

      try {
        retellWebClientRef.current?.stopCall();
      } catch (stopError) {
        console.error('Failed to stop Story Circle web call on cleanup:', stopError);
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="ember-panel w-full max-w-xl rounded-[2rem] p-8 text-center">
          <p className="ember-eyebrow">Ember</p>
          <div className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-[var(--ember-text)]">
            {fromUpload ? 'Finalizing your upload' : 'Loading Ember...'}
          </div>
          <p className="mt-3 text-sm text-[var(--ember-muted)]">
            {fromUpload
              ? 'Opening the new Ember, pulling in scene detail, and checking for familiar faces.'
              : 'Pulling this Ember into view.'}
          </p>
        </div>
      </div>
    );
  }

  if (error || !image) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="ember-panel rounded-[2rem] p-8 text-center">
          <p className="mb-4 text-rose-600">{error || 'Image not found'}</p>
          <Link href="/feed" className="font-medium text-[var(--ember-orange-deep)] hover:text-[var(--ember-orange)]">
            Back to feed
          </Link>
        </div>
      </div>
    );
  }

  const subjectNoun = image.mediaType === 'VIDEO' ? 'video' : 'photo';
  const emberTitle = getEmberTitle(image);
  const playNarrationDateLabel = new Date(
    image.analysis?.capturedAt || image.createdAt
  ).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const smartGeneratedDateLabel = playNarrationDateLabel;
  const previewMediaUrl = getPreviewMediaUrl({
    mediaType: image.mediaType,
    filename: image.filename,
    posterFilename: image.posterFilename,
  });
  const autoTagStepComplete =
    autoTagPromptDismissed || !fromUpload || !image.canManage || image.tags.length > 0;
  const activityMessages = image.contributors
    .flatMap((contributor) =>
      (contributor.conversation?.messages || []).map((message) => ({
        id: message.id,
        contributorId: contributor.id,
        contributorLabel:
          contributor.name ||
          contributor.user?.name ||
          contributor.email ||
          contributor.phoneNumber ||
          'Contributor',
        role: message.role,
        source: message.source,
        content: message.content,
        createdAt: message.createdAt,
      }))
  )
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  const ownerContributorRecord =
    image.contributors.find((contributor) => contributor.userId === image.currentUserId) || null;
  const currentConversationTarget = image.canManage
    ? image.ownerConversationTarget
    : ownerContributorRecord;
  const currentConversationPhoneAvailable = Boolean(
    currentConversationTarget?.phoneNumber || currentConversationTarget?.user?.phoneNumber
  );
  const hasRecordedContributions = image.contributors.some((contributor) => {
    const hasUserMessages = (contributor.conversation?.messages || []).some(
      (message) => message.role === 'user' && message.content.trim().length > 0
    );
    const hasResponses = (contributor.conversation?.responses || []).some(
      (response) => response.answer.trim().length > 0
    );
    const hasVoiceMemory = contributor.voiceCalls.some(
      (voiceCall) => Boolean(voiceCall.memorySyncedAt || voiceCall.callSummary?.trim())
    );

    return hasUserMessages || hasResponses || hasVoiceMemory;
  });
  const storyCircleKnownSteps = new Set<string>();
  if (image.analysis?.capturedAt) {
    storyCircleKnownSteps.add('when');
  }
  if (
    image.analysis?.confirmedLocation?.label ||
    (image.analysis?.latitude != null && image.analysis?.longitude != null)
  ) {
    storyCircleKnownSteps.add('where');
  }
  const ownerStoryCircleAnsweredFromConversation = new Set(
    (ownerContributorRecord?.conversation?.responses || [])
      .map((response) => response.questionType)
      .filter((questionType) =>
        STORY_CIRCLE_STEPS.includes(questionType as (typeof STORY_CIRCLE_STEPS)[number])
      )
  ).size;
  const ownerStoryCircleCount = Math.max(
    storyCircleCount,
    ownerStoryCircleAnsweredFromConversation
  );
  const ownerStoryCircleTotal =
    storyCircleTotalCount ||
    STORY_CIRCLE_STEPS.filter((step) => !storyCircleKnownSteps.has(step)).length;
  const storyCircleVoiceBusy =
    storyCircleVoiceState === 'starting' ||
    storyCircleVoiceState === 'active' ||
    storyCircleVoiceState === 'ending';
  const locationComplete = Boolean(image.analysis?.confirmedLocation?.label);
  const timeDateComplete = Boolean(image.analysis?.capturedAt);
  const titleComplete = Boolean(image.title?.trim());
  const tagsComplete = image.tags.length > 0;
  const supportingMediaComplete = image.attachments.length > 0;
  const analysisComplete = Boolean(image.analysis?.summary || image.analysis?.visualDescription);
  const contributorComplete = image.contributors.length > 1;
  const selectedLocationSuggestion =
    locationSuggestions.find((suggestion) => suggestion.id === selectedLocationId) || null;
  const showFirstRunGuide = image.canManage && fromUpload;
  const showSetupCards = image.canManage && setupRequested && !fromUpload;
  const storyCutMediaItems: StoryCutMediaItem[] = [
    {
      id: image.id,
      label: 'Ember Image',
      kind: 'cover' as const,
      previewUrl:
        image.mediaType === 'VIDEO' && image.posterFilename
          ? `/api/uploads/${image.posterFilename}`
          : `/api/uploads/${image.filename}`,
      mediaType: image.mediaType,
    },
    ...image.attachments.map((attachment) => ({
      id: attachment.id,
      label: attachment.originalName,
      kind: 'supporting' as const,
      previewUrl:
        attachment.mediaType === 'VIDEO' && attachment.posterFilename
          ? `/api/uploads/${attachment.posterFilename}`
          : `/api/uploads/${attachment.filename}`,
      mediaType: attachment.mediaType,
      })),
    ...image.voiceCallClips
      .filter((clip) => Boolean(clip.audioUrl))
      .map((clip) => ({
        id: clip.id,
        label: clip.title,
        kind: 'voiceClip' as const,
        previewUrl: clip.audioUrl,
        mediaType: 'AUDIO' as const,
        quote: clip.quote,
        significance: clip.significance,
        contributorName: clip.contributorName,
        startMs: clip.startMs,
        endMs: clip.endMs,
      })),
  ];
  const getStoryCutMediaItem = (mediaId: string) =>
    storyCutMediaItems.find((media) => media.id === mediaId) || null;
  const buildStoryCutMediaBlock = (
    media: StoryCutMediaItem
  ): Extract<StoryCutBlock, { type: 'media' }> => ({
    type: 'media',
    mediaId: media.id,
    mediaName: media.label,
    mediaUrl: media.previewUrl,
    mediaType: media.mediaType,
    clipStartMs: media.startMs ?? null,
    clipEndMs: media.endMs ?? null,
    clipQuote: media.quote ?? null,
    order: 0,
  });
  const selectedStoryCutAmbientAudioCount = storyCutMediaItems.filter(
    (media) =>
      media.mediaType === 'AUDIO' && storyCutSelectedMediaIds.includes(media.id)
  ).length;
  const storyCutContributorChoices = image.contributors
    .filter((contributor) => (contributor.conversation?.responses || []).length > 0)
    .map((contributor) => ({
      id: contributor.id,
      label:
        contributor.name ||
        contributor.user?.name ||
        contributor.email ||
        contributor.phoneNumber ||
        'Contributor',
      isOwner: contributor.userId === image.owner.id,
      contributedCount: contributor.conversation?.responses.length || 0,
    }));
  const setupCards = [
    {
      id: 'storyCuts' as const,
      icon: 'storyCuts' as const,
      title: 'Snapshot',
      subtitle: 'Creator',
      status: 'Ready',
      selected: setupFocus === 'storyCuts',
      onClick: () => {
        setSetupFocus('storyCuts');
        setActivePanel('storyCuts');
      },
    },
    {
      id: 'storyCircle' as const,
      icon: 'storyCircle' as const,
      title: 'Story Circle',
      subtitle: 'The narrative behind this ember',
      status:
        ownerStoryCircleTotal > 0
          ? `${Math.min(ownerStoryCircleCount, ownerStoryCircleTotal)} of ${ownerStoryCircleTotal}`
          : 'Ready',
      selected: setupFocus === 'storyCircle',
      onClick: () => {
        setSetupFocus('storyCircle');
        openTendView('storyCircle', 'setup');
      },
    },
    {
      id: 'title' as const,
      icon: 'title' as const,
      title: 'Title',
      subtitle: 'Pick the perfect title',
      status: titleComplete ? 'Done' : 'Not Done',
      selected: setupFocus === 'title',
      onClick: () => {
        setSetupFocus('title');
        openTendView('editTitle', 'setup');
      },
    },
    {
      id: 'location' as const,
      icon: 'location' as const,
      title: 'Location',
      subtitle: 'Where this moment happened',
      status: locationComplete ? 'Done' : 'Not Done',
      selected: setupFocus === 'location',
      onClick: () => {
        setSetupFocus('location');
        openTendView('location', 'setup');
      },
    },
    {
      id: 'timeDate' as const,
      icon: 'timeDate' as const,
      title: 'Time & Date',
      subtitle: timeDateComplete
        ? new Date(image.analysis!.capturedAt!).toLocaleDateString()
        : 'When this moment happened',
      status: timeDateComplete ? 'Done' : 'Not Done',
      selected: setupFocus === 'timeDate',
      onClick: () => {
        setSetupFocus('timeDate');
        openTendView('timeDate', 'setup');
      },
    },
    {
      id: 'taggedPeople' as const,
      icon: 'taggedPeople' as const,
      title: 'Tagged People',
      subtitle: 'Identify and tag people in this image',
      status: tagsComplete ? 'Done' : 'Not Done',
      selected: setupFocus === 'taggedPeople',
      onClick: () => {
        setSetupFocus('taggedPeople');
        openTendView('tag', 'setup');
      },
    },
    {
      id: 'supportingMedia' as const,
      icon: 'supportingMedia' as const,
      title: 'Supporting Media',
      subtitle: 'Add more context with extra media',
      status: supportingMediaComplete ? 'Done' : 'Not Done',
      selected: setupFocus === 'supportingMedia',
      onClick: () => {
        setSetupFocus('supportingMedia');
        openTendView('addContent', 'setup');
      },
    },
    {
      id: 'analysis' as const,
      icon: 'analysis' as const,
      title: 'Image Analysis',
      subtitle: 'Deep analysis of this image',
      status: analysisComplete ? 'Done' : 'Not Done',
      selected: setupFocus === 'analysis',
      onClick: () => {
        setSetupFocus('analysis');
        openTendView('analysis', 'setup');
      },
    },
    {
      id: 'contributors' as const,
      icon: 'contributors' as const,
      title: 'Contributors',
      subtitle: 'Invite people to edit and contribute',
      status: contributorComplete ? 'Done' : 'Not Done',
      selected: setupFocus === 'contributors',
      onClick: () => {
        setSetupFocus('contributors');
        setActivePanel('contributors');
      },
    },
  ];
  const setupRailCards = setupCards.filter((card) =>
    ['storyCuts', 'storyCircle', 'title', 'analysis', 'contributors'].includes(card.id)
  );

  const handleAutoTagDismiss = () => {
    setAutoTagPromptDismissed(true);
  };

  const handleManualTagFromPrompt = () => {
    setAutoTagPromptDismissed(true);
    openTendView('tag', 'setup');
  };

  const handleAutoTagApplied = async (labels: string[]) => {
    await fetchImage();

    try {
      const response = await fetch(`/api/wiki/${image.id}`, {
        method: 'POST',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Failed to refresh the wiki after auto-tagging');
      }
    } catch (wikiError) {
      setShareError(
        wikiError instanceof Error
          ? wikiError.message
          : 'Failed to refresh the wiki after auto-tagging'
      );
    }

    setAutoTagPromptDismissed(true);
    openTendView('tag', 'setup');
    setActionNotice(
      labels.length > 0
        ? `Auto-tagged ${labels.join(labels.length === 2 ? ' and ' : ', ')}. Add any remaining tags, then close when you are ready to continue.`
        : 'Auto-tagged familiar faces. Add any remaining tags, then close when you are ready to continue.'
    );
  };

  const handleLocationPromptDismiss = () => {
    setLocationPromptDismissed(true);
  };

  const handleLocationApplied = (locationLabel: string) => {
    setActionNotice(`Added ${locationLabel} into the Ember story and refreshed the wiki.`);
    void fetchImage();
  };

  const handleTendAutoTagApplied = async (labels: string[]) => {
    await fetchImage();

    try {
      const response = await fetch(`/api/wiki/${image.id}`, {
        method: 'POST',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Failed to refresh the wiki after auto-tagging');
      }
    } catch (wikiError) {
      setShareError(
        wikiError instanceof Error
          ? wikiError.message
          : 'Failed to refresh the wiki after auto-tagging'
      );
    }

    setTendTagPromptOpen(false);
    setActionNotice(
      labels.length > 0
        ? `Auto-tagged ${labels.join(labels.length === 2 ? ' and ' : ', ')}.`
        : 'Auto-tagged familiar faces.'
    );
  };

  const handleManualTagComplete = async () => {
    await fetchImage();
    closePanel();
    router.push(`/image/${image.id}/wiki`);
  };

  const handleOpenContributors = () => {
    setShapeView('menu');
    setActivePanel('contributors');
  };

  const replaceImageQuery = (mutate: (nextParams: URLSearchParams) => void) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    mutate(nextParams);
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `/image/${params.id}?${nextQuery}` : `/image/${params.id}`);
  };

  const handleOpenSetupCards = () => {
    setAskChatExpanded(false);
    setTendTagPromptOpen(false);
    setShapeOrigin('tend');
    setActivePanel(null);
    setShapeView('menu');

    replaceImageQuery((nextParams) => {
      nextParams.set('setup', '1');
      nextParams.delete('fromUpload');
      nextParams.delete('panel');
      nextParams.delete('view');
    });
  };

  const handleHideSetupCards = () => {
    replaceImageQuery((nextParams) => {
      nextParams.delete('setup');
      nextParams.delete('fromUpload');
      nextParams.delete('panel');
      nextParams.delete('view');
    });
  };

  const openAskPanel = () => {
    setMemoryEntryError('');
    setAskChatExpanded(true);
    setActivePanel('ask');
  };

  const openMemoryEntryPanel = () => {
    setMemoryEntryError('');
    setActivePanel('memoryEntry');
  };

  const handleRequestMemoryPhoneCall = async () => {
    if (!currentConversationTarget) {
      throw new Error('Ember could not find your memory thread for this photo yet.');
    }

    if (!currentConversationPhoneAvailable) {
      throw new Error('Add a phone number to your profile so Ember can call you.');
    }

    if (startingMemoryCall) {
      return;
    }

    setStartingMemoryCall(true);
    setMemoryEntryError('');
    setShareError('');
    setActionNotice('');

    try {
      const response = await fetch(
        image.canManage
          ? '/api/voice/call'
          : `/api/contribute/${encodeURIComponent(currentConversationTarget.token)}/call`,
        image.canManage
          ? {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contributorId: currentConversationTarget.id }),
            }
          : {
              method: 'POST',
            }
      );

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to start the phone call.');
      }

      setActionNotice('Ember is calling your phone now.');
      setActivePanel(null);
      await fetchImage();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to start the phone call.';
      setMemoryEntryError(message);
      throw error instanceof Error ? error : new Error(message);
    } finally {
      setStartingMemoryCall(false);
    }
  };

  const handleStartFirstRunAsk = () => {
    setActivePanel('memoryEntry');
    replaceImageQuery((nextParams) => {
      nextParams.delete('setup');
      nextParams.delete('fromUpload');
      nextParams.delete('view');
      nextParams.delete('panel');
    });
  };

  const handleStartFirstRunContributors = () => {
    setActivePanel(null);
    replaceImageQuery((nextParams) => {
      nextParams.delete('setup');
      nextParams.delete('fromUpload');
      nextParams.delete('view');
      nextParams.set('panel', 'contributors');
    });
  };

  const handleDeleteEmber = async () => {
    if (!image?.canManage) {
      return;
    }

    const confirmed = window.confirm(
      'Delete this Ember permanently? This removes the photo, story, wiki, and related contributions.'
    );

    if (!confirmed) {
      return;
    }

    setShareError('');
    setActionNotice('');

    try {
      const response = await fetch(`/api/images/${image.id}`, {
        method: 'DELETE',
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to delete Ember.');
      }

      router.replace('/feed');
    } catch (deleteError) {
      setShareError(
        deleteError instanceof Error ? deleteError.message : 'Failed to delete Ember.'
      );
    }
  };

  const toggleStoryCutMediaSelection = (mediaId: string) => {
    if (mediaId === image.id) {
      return;
    }

    setStoryCutSelectedMediaIds((current) => {
      const exists = current.includes(mediaId);
      const next = exists ? current.filter((id) => id !== mediaId) : [...current, mediaId];
      return next.includes(image.id) ? next : [image.id, ...next];
    });
  };

  const toggleStoryCutContributorSelection = (contributorId: string) => {
    setStoryCutSelectedContributorIds((current) =>
      current.includes(contributorId)
        ? current.filter((id) => id !== contributorId)
        : [...current, contributorId]
    );
  };

  const updateStoryCutBlocksDraft = (
    updater: StoryCutBlock[] | ((current: StoryCutBlock[]) => StoryCutBlock[])
  ) => {
    setStoryCutBlocksDraft((current) =>
      normalizeStoryCutBlocks(typeof updater === 'function' ? updater(current) : updater)
    );
  };

  const handleAddStoryCutVoiceBlock = () => {
    updateStoryCutBlocksDraft((current) => [
      ...current,
      {
        type: 'voice',
        speaker: 'Ember',
        content: '',
        voicePreference: 'Ember',
        messageId: null,
        userId: null,
        order: current.length + 1,
      },
    ]);
  };

  const handleAddStoryCutMediaBlock = () => {
    const media = storyCutNewMediaId ? getStoryCutMediaItem(storyCutNewMediaId) : null;

    if (!media) {
      return;
    }

    updateStoryCutBlocksDraft((current) => [...current, buildStoryCutMediaBlock(media)]);
  };

  const handleMoveStoryCutBlock = (index: number, direction: -1 | 1) => {
    updateStoryCutBlocksDraft((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      const [block] = next.splice(index, 1);
      next.splice(nextIndex, 0, block);
      return next;
    });
  };

  const handleRemoveStoryCutBlock = (index: number) => {
    updateStoryCutBlocksDraft((current) => current.filter((_, blockIndex) => blockIndex !== index));
  };

  const handleUpdateStoryCutVoiceBlock = (index: number, content: string) => {
    updateStoryCutBlocksDraft((current) =>
      current.map((block, blockIndex) =>
        blockIndex === index && block.type === 'voice'
          ? {
              ...block,
              content,
            }
          : block
      )
    );
  };

  const handleReplaceStoryCutMediaBlock = (index: number, mediaId: string) => {
    const media = getStoryCutMediaItem(mediaId);

    if (!media) {
      return;
    }

    updateStoryCutBlocksDraft((current) =>
      current.map((block, blockIndex) =>
        blockIndex === index && block.type === 'media' ? buildStoryCutMediaBlock(media) : block
      )
    );
  };

  const storyCutBlocksChanged = Boolean(
    storyCutData &&
      JSON.stringify(normalizeStoryCutBlocks(storyCutBlocksDraft)) !==
        JSON.stringify(normalizeStoryCutBlocks((storyCutData.blocks as StoryCutBlock[]) || []))
  );
  const storyCutEditorPreview = storyCutData
    ? ({
        ...storyCutData,
        script: storyCutScriptDraft.trim() || storyCutData.script,
        blocks: normalizeStoryCutBlocks(storyCutBlocksDraft),
      } as StoryCutResult)
    : null;

  const playOverlayStoryCut = storyCutData || image.storyCut || null;
  const playOverlayUsesStoryCut = Boolean(playOverlayStoryCut?.script?.trim());
  const playOverlayCanPlay = Boolean(
    playOverlayStoryCut?.script?.trim() || image.wiki?.content?.trim()
  );
  const playOverlayState = playOverlayUsesStoryCut
    ? storyCutPlaybackState
    : narrationState;
  const playOverlayScript = playOverlayUsesStoryCut
    ? playOverlayStoryCut?.script?.trim() || ''
    : narrationScript;
  const playOverlayError = playOverlayUsesStoryCut
    ? storyCutPlaybackError
    : narrationError;
  const stopPlayOverlayAudio = () => {
    stopNarration();
    stopStoryCutPlayback();
    setStoryCutPlaybackError('');
  };

  return (
    <div className="min-h-[calc(100dvh-2.7rem)] bg-white">
      <section className="mx-auto w-full">
        {showFirstRunGuide ? (
          <div className="flex min-h-[calc(100dvh-2.7rem)] flex-col bg-white">
            <div
              ref={heroStageRef}
              className="relative h-[70dvh] min-h-[24rem] overflow-hidden bg-[#a8ba91]"
            >
              <MediaPreview
                mediaType={image.mediaType}
                filename={image.filename}
                posterFilename={image.posterFilename}
                originalName={emberTitle}
                controls={image.mediaType === 'VIDEO'}
                className={`h-full w-full ${
                  image.mediaType === 'VIDEO'
                    ? 'object-contain bg-[#a8ba91]'
                    : 'object-cover bg-[#a8ba91]'
                }`}
              />

              <div className="pointer-events-none absolute inset-0 bg-white/18" />

              <div className="absolute left-5 top-4 right-24 sm:left-6 sm:top-5">
                <div className="inline-flex rounded-full bg-white/72 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ember-text)]">
                  New Ember
                </div>
                <h1
                  className={`mt-3 max-w-[14rem] break-words text-[2rem] font-semibold leading-[1.04] tracking-[-0.05em] [overflow-wrap:anywhere] sm:max-w-[18rem] sm:text-[2.45rem] ${
                    heroOverlayTone.title === 'dark'
                      ? 'text-black drop-shadow-[0_1px_2px_rgba(255,255,255,0.28)]'
                      : 'text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.12)]'
                  }`}
                >
                  {emberTitle}
                </h1>
              </div>

              <button
                type="button"
                onClick={handleHideSetupCards}
                className="absolute right-4 top-4 rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ember-text)] shadow-[0_10px_24px_rgba(17,17,17,0.12)]"
              >
                Skip
              </button>
            </div>

            <div className="flex min-h-[30dvh] flex-col items-center bg-[var(--ember-orange)] px-6 pt-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] text-center text-white">
              <p className="max-w-[16rem] text-[1.2rem] font-semibold leading-[1.18] tracking-[-0.03em] sm:max-w-[19rem] sm:text-[1.5rem]">
                Your Ember is ready.
              </p>
              <p className="mt-2 max-w-[17rem] text-sm leading-6 text-white/92 sm:max-w-[20rem] sm:text-[0.98rem]">
                Add to this memory while it&apos;s fresh, invite people who were there, or finish the setup details.
              </p>

              <div className="mt-5 flex w-full max-w-[18rem] flex-col gap-2.5 sm:max-w-[19rem]">
                <button
                  type="button"
                  onClick={handleStartFirstRunAsk}
                  className="rounded-[1rem] bg-white px-4 py-3 text-sm font-semibold tracking-[-0.01em] text-[var(--ember-text)] shadow-[0_12px_24px_rgba(17,17,17,0.14)]"
                >
                  Add to this memory
                </button>
                <button
                  type="button"
                  onClick={handleStartFirstRunContributors}
                  className="rounded-[1rem] border border-white/70 bg-white/12 px-4 py-3 text-sm font-semibold tracking-[-0.01em] text-white"
                >
                  Invite contributors
                </button>
                <button
                  type="button"
                  onClick={handleOpenSetupCards}
                  className="rounded-[1rem] px-4 py-2.5 text-sm font-medium text-white/92 underline decoration-white/60 underline-offset-4"
                >
                  Complete setup
                </button>
              </div>

              {(actionNotice || shareError) && (
                <div className="mt-3 max-w-[17rem] text-sm text-white/92 sm:max-w-[20rem]">
                  {shareError || actionNotice}
                </div>
              )}
            </div>
          </div>
        ) : showSetupCards ? (
          <div className="flex min-h-[calc(100dvh-2.7rem)] flex-col bg-white">
            <div
              ref={heroStageRef}
              className="relative h-[70dvh] min-h-[24rem] overflow-hidden bg-[#a8ba91]"
            >
              <MediaPreview
                mediaType={image.mediaType}
                filename={image.filename}
                posterFilename={image.posterFilename}
                originalName={emberTitle}
                controls={image.mediaType === 'VIDEO'}
                className={`h-full w-full ${
                  image.mediaType === 'VIDEO'
                    ? 'object-contain bg-[#a8ba91]'
                    : 'object-cover bg-[#a8ba91]'
                }`}
              />

              <div className="pointer-events-none absolute inset-0 bg-white/18" />

              <div className="absolute left-5 top-4 right-24 sm:left-6 sm:top-5">
                <div className="inline-flex rounded-full bg-white/72 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ember-text)]">
                  Settings
                </div>
                <h1
                  className={`mt-3 max-w-[14rem] break-words text-[2rem] font-semibold leading-[1.04] tracking-[-0.05em] [overflow-wrap:anywhere] sm:max-w-[18rem] sm:text-[2.45rem] ${
                    heroOverlayTone.title === 'dark'
                      ? 'text-black drop-shadow-[0_1px_2px_rgba(255,255,255,0.28)]'
                      : 'text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.12)]'
                  }`}
                >
                  {emberTitle}
                </h1>
              </div>

              <button
                type="button"
                onClick={handleHideSetupCards}
                className="absolute right-4 top-4 rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ember-text)] shadow-[0_10px_24px_rgba(17,17,17,0.12)]"
              >
                Done
              </button>
            </div>

            <div className="flex min-h-[30dvh] flex-col bg-[var(--ember-orange)] px-5 pt-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] text-white">
              <div className="text-center">
                <p className="text-[1.2rem] font-semibold leading-[1.18] tracking-[-0.03em] sm:text-[1.45rem]">
                  Complete this Ember.
                </p>
                <p className="mt-2 text-sm leading-6 text-white/90">
                  Fine tune the memory, invite people in, or remove it entirely.
                </p>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2.5">
                {setupCards.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={card.onClick}
                    className="rounded-[1rem] bg-white/14 px-3 py-3 text-left text-white shadow-[0_10px_24px_rgba(17,17,17,0.1)]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-[0.9rem] bg-white/16 text-white">
                        <SetupCardIcon name={card.icon} className="h-4.5 w-4.5" />
                      </span>
                      <span className="rounded-full bg-white/16 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/92">
                        {card.status}
                      </span>
                    </div>
                    <div className="mt-3 text-[0.98rem] font-semibold tracking-[-0.02em]">
                      {card.title}
                    </div>
                    <p className="mt-1.5 text-xs leading-5 text-white/82">
                      {card.subtitle}
                    </p>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => void handleDeleteEmber()}
                className="mt-4 rounded-[1rem] border border-white/35 bg-[rgba(127,29,29,0.22)] px-4 py-3 text-sm font-semibold tracking-[-0.01em] text-white"
              >
                Delete Ember
              </button>

              {(actionNotice || shareError) && (
                <div className="mt-3 text-center text-sm text-white/92">
                  {shareError || actionNotice}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-[calc(100dvh-2.7rem)] min-h-[calc(100dvh-2.7rem)] flex-col bg-white">
            <div
              ref={heroStageRef}
              className="relative min-h-0 basis-[70%] overflow-hidden bg-[#a8ba91]"
            >
              <MediaPreview
                mediaType={image.mediaType}
                filename={image.filename}
                posterFilename={image.posterFilename}
                originalName={emberTitle}
                controls={image.mediaType === 'VIDEO'}
                className={`h-full w-full ${
                  image.mediaType === 'VIDEO'
                    ? 'object-contain bg-[#a8ba91]'
                    : 'object-cover bg-[#a8ba91]'
                }`}
              />

              <div className="pointer-events-none absolute inset-0 bg-white/28" />

              <div className="absolute left-5 top-3.5 right-24 sm:left-6 sm:top-5 sm:right-28">
                <h1
                  className={`max-w-[14rem] break-words text-[2rem] font-semibold leading-[1.04] tracking-[-0.05em] [overflow-wrap:anywhere] sm:max-w-[18rem] sm:text-[2.45rem] ${
                    heroOverlayTone.title === 'dark'
                      ? 'text-black drop-shadow-[0_1px_2px_rgba(255,255,255,0.28)]'
                      : 'text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.12)]'
                  }`}
                >
                  {emberTitle}
                </h1>
              </div>

              <div className="absolute right-2 top-1/2 z-10 flex w-[4.75rem] -translate-y-1/2 flex-col gap-2 rounded-[1rem] bg-black/25 px-1.5 py-3 backdrop-blur-[1px] transition-colors hover:bg-black sm:right-4">
                <HeroRailButton
                  icon={<ShareIcon className="h-full w-full" />}
                  label="Share"
                  tone={heroOverlayTone.rail}
                  onClick={() => setActivePanel('share')}
                />
                <HeroRailButton
                  icon={<CircleIcon className="h-full w-full" />}
                  label="Tend"
                  tone={heroOverlayTone.rail}
                  onClick={() => {
                    setShapeView('menu');
                    setActivePanel('shape');
                  }}
                />
                <HeroRailButton
                  icon={<PlayIcon className="h-full w-full" />}
                  label="Play"
                  tone={heroOverlayTone.rail}
                  onClick={() => setActivePanel('play')}
                />
                <HeroRailButton
                  icon={<GeminiIcon className="h-full w-full" />}
                  label="Ask"
                  tone={heroOverlayTone.rail}
                  onClick={() => {
                    setAskChatExpanded(true);
                    setActivePanel('ask');
                  }}
                />
              </div>
            </div>

            <div className="flex min-h-0 basis-[30%] flex-col items-center bg-[var(--ember-orange)] px-7 py-5 text-center text-white">
              <p className="max-w-[16rem] text-[1.05rem] font-medium leading-[1.3] tracking-[-0.02em] sm:max-w-[20rem] sm:text-[1.45rem]">
                Explore this ember and invite friends &amp; family to add to the memory.
              </p>

              {!hasRecordedContributions && (
                <button
                  type="button"
                  onClick={openMemoryEntryPanel}
                  className="mt-4 rounded-[1rem] bg-white px-4 py-3 text-sm font-semibold tracking-[-0.01em] text-[var(--ember-text)] shadow-[0_12px_24px_rgba(17,17,17,0.14)]"
                >
                  Add to this memory
                </button>
              )}

              {(actionNotice || shareError) && (
                <div className="mt-4 max-w-[16rem] text-sm text-white/92 sm:max-w-[20rem]">
                  {shareError || actionNotice}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {activePanel === 'memoryEntry' && (
        <AddToMemoryChoiceExperience
          emberTitle={emberTitle}
          mediaType={image.mediaType}
          filename={image.filename}
          posterFilename={image.posterFilename}
          titleTone={heroOverlayTone.title}
          phoneCallAvailable={currentConversationPhoneAvailable}
          isCalling={startingMemoryCall}
          errorMessage={memoryEntryError}
          onClose={closePanel}
          onStartChat={openAskPanel}
          onRequestPhoneCall={handleRequestMemoryPhoneCall}
        />
      )}

      {activePanel === 'ask' && (
        <AskEmberExperience
          imageId={image.id}
          emberTitle={emberTitle}
          ownerLabel={image.owner.name || image.owner.email}
          subjectNoun={subjectNoun}
          mediaType={image.mediaType}
          filename={image.filename}
          posterFilename={image.posterFilename}
          titleTone={heroOverlayTone.title}
          railTone={heroOverlayTone.rail}
          hasRecordedContributions={hasRecordedContributions}
          importantVoiceClips={image.voiceCallClips.map((clip) => ({
            id: clip.id,
            contributorName: clip.contributorName,
            title: clip.title,
            quote: clip.quote,
            significance: clip.significance,
            audioUrl: clip.audioUrl,
            startMs: clip.startMs,
            endMs: clip.endMs,
          }))}
          phoneCallAvailable={currentConversationPhoneAvailable}
          expanded={askChatExpanded}
          onExpandedChange={setAskChatExpanded}
          onRequestPhoneCall={handleRequestMemoryPhoneCall}
          onStoredMemory={() => {
            void fetchImage();
          }}
          onClose={closePanel}
          onOpenShare={() => setActivePanel('share')}
          onOpenTend={() => {
            setShapeView('menu');
            setActivePanel('shape');
          }}
          onOpenPlay={() => setActivePanel('play')}
        />
      )}

      <EmberSheet
        open={activePanel === 'storyCuts'}
        title="Snapshot"
        subtitle="Build the short playable version of this memory that Ember uses in Play."
        onClose={closePanel}
      >
        <div className="space-y-5">
          <div className="ember-panel rounded-[2rem] p-6">
            <p className="ember-eyebrow">Snapshot Creator</p>
            <h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-[var(--ember-text)]">
              Compose the playable snapshot for this ember
            </h3>

            <div className="mt-5 rounded-[1.45rem] border border-[rgba(41,98,255,0.14)] bg-[rgba(41,98,255,0.05)] px-4 py-4">
              <div className="text-sm font-semibold text-[var(--ember-text)]">
                {image.owner.name || image.owner.email}
              </div>
              <div className="mt-1 text-sm text-[var(--ember-muted)]">Editing this ember</div>
            </div>

            <label className="mt-5 block text-sm font-medium text-[var(--ember-text)]">
              <div className="mb-2">Story Title</div>
              <input
                type="text"
                value={storyCutTitle}
                onChange={(event) => setStoryCutTitle(event.target.value)}
                className="ember-input"
                placeholder="Untitled Ember"
              />
            </label>

            <label className="mt-5 block text-sm font-medium text-[var(--ember-text)]">
              <div className="mb-2">Story Style</div>
              <select
                value={storyCutStyle}
                onChange={(event) => setStoryCutStyle(event.target.value as StoryCutStyle)}
                className="ember-input"
              >
                {STORY_CUT_STYLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-5 block text-sm font-medium text-[var(--ember-text)]">
              <div className="mb-2">Story Focus</div>
              <input
                type="text"
                value={storyCutFocus}
                onChange={(event) => setStoryCutFocus(event.target.value)}
                className="ember-input"
                placeholder="What should this story focus on?"
              />
            </label>

            <div className="mt-5">
              <div className="text-sm font-medium text-[var(--ember-text)]">Story Length</div>
              <div className="mt-4 rounded-[1.45rem] border border-[var(--ember-line)] bg-white px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-[var(--ember-muted)]">Duration</span>
                  <span className="text-sm font-semibold text-[#2962ff]">{storyCutDuration} seconds</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={60}
                  step={5}
                  value={storyCutDuration}
                  onChange={(event) => setStoryCutDuration(Number(event.target.value))}
                  className="mt-4 w-full accent-[var(--ember-orange)]"
                />
                <div className="mt-2 flex justify-between text-[11px] text-[var(--ember-muted)]">
                  {STORY_CUT_DURATION_OPTIONS.map((seconds) => (
                    <span key={seconds}>{seconds}s</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5">
              <div className="text-sm font-medium text-[var(--ember-text)]">Media Selection</div>
              <p className="mt-2 text-sm leading-6 text-[var(--ember-muted)]">
                Choose which photos and media files to include in your story.
              </p>
              {selectedStoryCutAmbientAudioCount > 0 && (
                <div className="mt-3 rounded-[1.2rem] border border-[rgba(255,102,33,0.18)] bg-[rgba(255,102,33,0.05)] px-4 py-3 text-sm text-[var(--ember-orange-deep)]">
                  {selectedStoryCutAmbientAudioCount} audio
                  {selectedStoryCutAmbientAudioCount === 1 ? ' clip can' : ' clips can'} be
                  woven into the Snapshot where Ember thinks they fit best.
                </div>
              )}
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {storyCutMediaItems.map((media) => {
                  const selected = storyCutSelectedMediaIds.includes(media.id);
                  return (
                    <button
                      key={media.id}
                      type="button"
                      onClick={() => toggleStoryCutMediaSelection(media.id)}
                      className={`rounded-[1.4rem] border p-3 text-left transition ${
                        selected
                          ? 'border-[rgba(41,98,255,0.35)] bg-[rgba(41,98,255,0.06)]'
                          : 'border-[var(--ember-line)] bg-white'
                      }`}
                    >
                      <div className="overflow-hidden rounded-[1.15rem]">
                        {media.kind === 'voiceClip' ? (
                          <div className="flex aspect-[1.1] w-full flex-col justify-between bg-[var(--ember-soft)] p-4 text-left">
                            <div>
                              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ember-orange)]">
                                Voice clip
                              </div>
                              <div className="mt-2 text-sm font-semibold text-[var(--ember-text)]">
                                {media.contributorName || 'Contributor'}
                              </div>
                              {media.quote && (
                                <div className="mt-2 line-clamp-4 text-sm leading-6 text-[var(--ember-muted)]">
                                  &quot;{media.quote}&quot;
                                </div>
                              )}
                            </div>
                            {media.startMs != null && media.endMs != null && (
                              <div className="mt-3 text-xs font-medium text-[var(--ember-muted)]">
                                Clip range: {Math.floor(media.startMs / 1000 / 60)}:
                                {Math.floor((media.startMs / 1000) % 60)
                                  .toString()
                                  .padStart(2, '0')}
                                -
                                {Math.floor(media.endMs / 1000 / 60)}:
                                {Math.floor((media.endMs / 1000) % 60)
                                  .toString()
                                  .padStart(2, '0')}
                              </div>
                            )}
                          </div>
                        ) : (
                          <MediaPreview
                            mediaType={media.mediaType}
                            filename={
                              media.kind === 'cover'
                                ? image.filename
                                : image.attachments.find((attachment) => attachment.id === media.id)?.filename || image.filename
                            }
                            posterFilename={
                              media.kind === 'cover'
                                ? image.posterFilename
                                : image.attachments.find((attachment) => attachment.id === media.id)?.posterFilename || null
                            }
                            originalName={media.label}
                            usePosterForVideo
                            className="aspect-[1.1] w-full object-cover bg-[var(--ember-soft)]"
                          />
                        )}
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-[var(--ember-text)]">{media.label}</div>
                          <div className="mt-1 text-xs text-[var(--ember-muted)]">
                            {media.kind === 'cover'
                              ? 'Cover media'
                              : media.kind === 'voiceClip'
                                ? 'Retell call clip'
                                : 'Supporting media'}
                          </div>
                        </div>
                        <span
                          className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-[11px] font-semibold ${
                            selected
                              ? 'bg-[#2962ff] text-white'
                              : 'bg-[var(--ember-soft)] text-[var(--ember-muted)]'
                          }`}
                        >
                          {selected ? '✓' : ''}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-5">
              <div className="text-sm font-medium text-[var(--ember-text)]">Voices</div>
              <p className="mt-2 text-sm leading-6 text-[var(--ember-muted)]">
                Select which voices and Ember agents you want used in this story.
              </p>

              <div className="mt-4 space-y-3">
                <button
                  type="button"
                  onClick={() => setStoryCutIncludeOwner((value) => !value)}
                  className={`w-full rounded-[1.4rem] border px-4 py-4 text-left transition ${
                    storyCutIncludeOwner
                      ? 'border-[rgba(41,98,255,0.35)] bg-[rgba(41,98,255,0.06)]'
                      : 'border-[var(--ember-line)] bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-[var(--ember-text)]">Owner</div>
                      <div className="mt-1 text-sm text-[var(--ember-muted)]">
                        Include the owner&apos;s exact Story Circle/chat contributions.
                      </div>
                    </div>
                    <span className="rounded-full bg-[rgba(255,199,87,0.32)] px-3 py-1 text-xs font-semibold text-[var(--ember-orange-deep)]">
                      Owner
                    </span>
                  </div>
                </button>

                {storyCutContributorChoices
                  .filter((contributor) => !contributor.isOwner)
                  .map((contributor) => {
                    const selected = storyCutSelectedContributorIds.includes(contributor.id);
                    return (
                      <button
                        key={contributor.id}
                        type="button"
                        onClick={() => toggleStoryCutContributorSelection(contributor.id)}
                        className={`w-full rounded-[1.4rem] border px-4 py-4 text-left transition ${
                          selected
                            ? 'border-[rgba(41,98,255,0.35)] bg-[rgba(41,98,255,0.06)]'
                            : 'border-[var(--ember-line)] bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-base font-semibold text-[var(--ember-text)]">
                              {contributor.label}
                            </div>
                            <div className="mt-1 text-sm text-[var(--ember-muted)]">
                              Contributed: {contributor.contributedCount > 0 ? 'Yes' : 'No'}
                            </div>
                          </div>
                          <span
                            className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-[11px] font-semibold ${
                              selected
                                ? 'bg-[#2962ff] text-white'
                                : 'bg-[var(--ember-soft)] text-[var(--ember-muted)]'
                            }`}
                          >
                            {selected ? '✓' : ''}
                          </span>
                        </div>
                      </button>
                    );
                  })}
              </div>

              <div className="mt-5">
                <div className="text-sm font-medium text-[var(--ember-text)]">Ember Agents</div>

                <div className="mt-3 rounded-[1.4rem] border border-[var(--ember-line)] bg-white px-4 py-4">
                  <button
                    type="button"
                    onClick={() => setStoryCutIncludeEmberVoice((value) => !value)}
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <div>
                      <div className="text-base font-semibold text-[var(--ember-text)]">Ember AI</div>
                      <div className="mt-1 text-sm text-[var(--ember-muted)]">AI Storyteller</div>
                    </div>
                    <span
                      className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-[11px] font-semibold ${
                        storyCutIncludeEmberVoice
                          ? 'bg-[#2962ff] text-white'
                          : 'bg-[var(--ember-soft)] text-[var(--ember-muted)]'
                      }`}
                    >
                      {storyCutIncludeEmberVoice ? '✓' : ''}
                    </span>
                  </button>
                  <div className="mt-4 text-sm font-medium text-[var(--ember-text)]">Voice Selection</div>
                  <select
                    value={storyCutEmberVoiceId}
                    onChange={(event) => setStoryCutEmberVoiceId(event.target.value)}
                    className="ember-input mt-2"
                    disabled={loadingStoryCutVoices || storyCutVoiceOptions.length === 0}
                  >
                    <option value="">{loadingStoryCutVoices ? 'Loading voices...' : 'Select a voice'}</option>
                    {storyCutVoiceOptions.map((voice) => (
                      <option key={voice.voiceId} value={voice.voiceId}>
                        {voice.label}
                      </option>
                    ))}
                  </select>
                </div>

                {false && (
                  <div className="mt-4 rounded-[1.4rem] border border-[var(--ember-line)] bg-white px-4 py-4">
                  <button
                    type="button"
                    onClick={() => setStoryCutIncludeNarratorVoice((value) => !value)}
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <div>
                      <div className="text-base font-semibold text-[var(--ember-text)]">Narrator</div>
                      <div className="mt-1 text-sm text-[var(--ember-muted)]">Story Guide</div>
                    </div>
                    <span
                      className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-[11px] font-semibold ${
                        storyCutIncludeNarratorVoice
                          ? 'bg-[#2962ff] text-white'
                          : 'bg-[var(--ember-soft)] text-[var(--ember-muted)]'
                      }`}
                    >
                      {storyCutIncludeNarratorVoice ? '✓' : ''}
                    </span>
                  </button>
                  <div className="mt-4 text-sm font-medium text-[var(--ember-text)]">Voice Selection</div>
                  <select
                    value={storyCutNarratorVoiceId}
                    onChange={(event) => setStoryCutNarratorVoiceId(event.target.value)}
                    className="ember-input mt-2"
                    disabled={loadingStoryCutVoices || storyCutVoiceOptions.length === 0}
                  >
                    <option value="">{loadingStoryCutVoices ? 'Loading voices...' : 'Select a voice'}</option>
                    {storyCutVoiceOptions.map((voice) => (
                      <option key={voice.voiceId} value={voice.voiceId}>
                        {voice.label}
                      </option>
                    ))}
                  </select>
                  </div>
                )}
              </div>
            </div>

            {storyCutError && (
              <div className="mt-5 rounded-[1.4rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {storyCutError}
              </div>
            )}

            {storyCutPlaybackError && (
              <div className="mt-4 rounded-[1.4rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {storyCutPlaybackError}
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleGenerateStoryCut()}
                disabled={storyCutLoading}
                className="ember-button-primary disabled:opacity-60"
              >
                {storyCutLoading
                    ? 'Generating Snapshot...'
                  : storyCutData
                    ? 'Generate New Snapshot'
                    : 'Generate New Snapshot'}
              </button>
              {storyCutData && (
                <button
                  type="button"
                  onClick={() => void (storyCutEditorPreview ? handlePlayStoryCut(storyCutEditorPreview) : null)}
                  className="ember-button-secondary"
                >
                  {storyCutPlaybackState === 'loading'
                    ? 'Preparing audio...'
                    : storyCutPlaybackState === 'playing'
                      ? 'Stop Snapshot'
                      : 'Play Snapshot'}
                </button>
              )}
              {storyCutData && (
                <button
                  type="button"
                  onClick={() => void handleSaveStoryCutScript()}
                  disabled={savingStoryCutScript}
                  className="ember-button-secondary disabled:opacity-60"
                >
                  {savingStoryCutScript ? 'Saving...' : 'Save Snapshot'}
                </button>
              )}
              <button
                type="button"
                onClick={closePanel}
                className="ember-button-secondary"
              >
                Done
              </button>
            </div>
          </div>

          {storyCutData && (
            <>
              <div className="ember-panel rounded-[2rem] p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[rgba(255,102,33,0.1)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ember-orange)]">
                    {storyCutData.style}
                  </span>
                  <span className="rounded-full bg-[var(--ember-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ember-muted)]">
                    {storyCutData.duration}s
                  </span>
                  <span className="rounded-full bg-[var(--ember-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ember-muted)]">
                    {storyCutData.wordCount} words
                  </span>
                </div>
                <h3 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-[var(--ember-text)]">
                  {storyCutData.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-[var(--ember-muted)]">
                  {storyCutData.metadata.focus}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedStoryCutAmbientAudioCount > 0 && (
                    <span className="rounded-full bg-[rgba(255,102,33,0.1)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ember-orange)]">
                      {selectedStoryCutAmbientAudioCount} recorded clips
                    </span>
                  )}
                  {storyCutIncludeOwner && (
                    <span className="rounded-full bg-[rgba(255,199,87,0.32)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ember-orange-deep)]">
                      Owner voice
                    </span>
                  )}
                  {storyCutIncludeEmberVoice && (
                    <span className="rounded-full bg-[rgba(168,85,247,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[rgb(139,92,246)]">
                      Ember AI
                    </span>
                  )}
                </div>

                <div className="mt-5 rounded-[1.6rem] border border-[var(--ember-line)] bg-white px-4 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ember-muted)]">
                    Snapshot script
                  </div>
                  <textarea
                    value={storyCutScriptDraft}
                    onChange={(event) => setStoryCutScriptDraft(event.target.value)}
                    className="ember-input mt-3 min-h-[12rem] whitespace-pre-wrap text-sm leading-7 text-[var(--ember-text)]"
                  />
                </div>
              </div>

              <div className="ember-panel rounded-[2rem] p-6">
                <p className="ember-eyebrow">Snapshot blocks</p>
                <div className="mt-4 rounded-[1.45rem] border border-[var(--ember-line)] bg-white px-4 py-4">
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                    <select
                      value={storyCutNewMediaId}
                      onChange={(event) => setStoryCutNewMediaId(event.target.value)}
                      className="ember-input"
                    >
                      {storyCutMediaItems.map((media) => (
                        <option key={media.id} value={media.id}>
                          {media.label} {media.kind === 'voiceClip' ? '• voice clip' : media.mediaType === 'AUDIO' ? '• audio' : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAddStoryCutMediaBlock}
                      className="ember-button-secondary"
                    >
                      Add Media Block
                    </button>
                    <button
                      type="button"
                      onClick={handleAddStoryCutVoiceBlock}
                      className="ember-button-secondary"
                    >
                      Add Voice Block
                    </button>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {storyCutBlocksDraft.map((block, index) =>
                    block.type === 'voice' ? (
                      <div
                        key={`voice-${index}-${block.messageId || block.speaker || 'generated'}`}
                        className="rounded-[1.45rem] border border-[var(--ember-line)] bg-white px-4 py-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ember-muted)]">
                              Voice {index + 1}
                            </span>
                            <span className="rounded-full bg-[rgba(41,98,255,0.08)] px-2.5 py-1 text-[11px] font-semibold text-[#2962ff]">
                              {block.speaker || 'Voice'}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleMoveStoryCutBlock(index, -1)}
                              disabled={index === 0}
                              className="rounded-full border border-[var(--ember-line)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ember-muted)] disabled:opacity-40"
                            >
                              Up
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveStoryCutBlock(index, 1)}
                              disabled={index === storyCutBlocksDraft.length - 1}
                              className="rounded-full border border-[var(--ember-line)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ember-muted)] disabled:opacity-40"
                            >
                              Down
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveStoryCutBlock(index)}
                              className="rounded-full border border-rose-200 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-600"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                        <textarea
                          value={block.content || ''}
                          onChange={(event) => handleUpdateStoryCutVoiceBlock(index, event.target.value)}
                          className="ember-input mt-3 min-h-[7rem] whitespace-pre-wrap text-sm leading-7 text-[var(--ember-text)]"
                          placeholder="Add the Ember narration for this block"
                        />
                      </div>
                    ) : (
                      <div
                        key={`media-${index}-${block.mediaId || block.mediaName || 'media'}`}
                        className="rounded-[1.45rem] border border-[rgba(255,102,33,0.18)] bg-[rgba(255,102,33,0.05)] px-4 py-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ember-orange-deep)]">
                            Media {index + 1}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleMoveStoryCutBlock(index, -1)}
                              disabled={index === 0}
                              className="rounded-full border border-[rgba(255,102,33,0.2)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ember-orange-deep)] disabled:opacity-40"
                            >
                              Up
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveStoryCutBlock(index, 1)}
                              disabled={index === storyCutBlocksDraft.length - 1}
                              className="rounded-full border border-[rgba(255,102,33,0.2)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ember-orange-deep)] disabled:opacity-40"
                            >
                              Down
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveStoryCutBlock(index)}
                              className="rounded-full border border-rose-200 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-600"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                        <select
                          value={block.mediaId || ''}
                          onChange={(event) => handleReplaceStoryCutMediaBlock(index, event.target.value)}
                          className="ember-input mt-3"
                        >
                          {storyCutMediaItems.map((media) => (
                            <option key={media.id} value={media.id}>
                              {media.label} {media.kind === 'voiceClip' ? '• voice clip' : media.mediaType === 'AUDIO' ? '• audio' : ''}
                            </option>
                          ))}
                        </select>
                        <div className="mt-2 text-sm font-medium text-[var(--ember-text)]">
                          {block.mediaName || 'Supporting media'}
                        </div>
                        <div className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ember-muted)]">
                          {block.mediaType || 'MEDIA'}
                        </div>
                        {block.clipQuote && (
                          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ember-muted)]">
                            {block.clipQuote}
                          </span>
                        )}
                        {block.mediaUrl && (
                          <div className="mt-3 overflow-hidden rounded-[1rem]">
                            {block.mediaType === 'AUDIO' ? (
                              <ClipAudioPlayer
                                src={block.mediaUrl}
                                startMs={block.clipStartMs}
                                endMs={block.clipEndMs}
                                className="w-full"
                              />
                            ) : (
                              <MediaPreview
                                mediaType={block.mediaType || 'IMAGE'}
                                filename={block.mediaUrl.replace('/api/uploads/', '')}
                                originalName={block.mediaName || 'Supporting media'}
                                className="aspect-[1.3] w-full object-cover bg-[var(--ember-soft)]"
                              />
                            )}
                          </div>
                        )}
                      </div>
                    )
                  )}
                  {storyCutBlocksDraft.length === 0 && (
                    <div className="rounded-[1.45rem] border border-dashed border-[var(--ember-line)] bg-white px-4 py-5 text-sm text-[var(--ember-muted)]">
                      Add voice or media blocks to shape the Snapshot sequence manually.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </EmberSheet>

      {activePanel === 'play' && (
        <PlayNarrationExperience
          emberTitle={emberTitle}
          mediaType={image.mediaType}
          filename={image.filename}
          posterFilename={image.posterFilename}
          titleTone={heroOverlayTone.title}
          railTone={heroOverlayTone.rail}
          dateLabel={playNarrationDateLabel}
          canPlay={playOverlayCanPlay}
          narrationState={playOverlayState}
          narrationScript={playOverlayScript}
          narrationError={playOverlayError}
          onStartOrStop={() =>
            void (
              playOverlayUsesStoryCut && playOverlayStoryCut
                ? handlePlayStoryCut(playOverlayStoryCut)
                : handleNarrationToggle()
            )
          }
          onStopAndClose={closePanel}
          onOpenShare={() => {
            stopPlayOverlayAudio();
            setActivePanel('share');
          }}
          onOpenTend={() => {
            stopPlayOverlayAudio();
            setShapeView('menu');
            setActivePanel('shape');
          }}
          onOpenAsk={() => {
            stopPlayOverlayAudio();
            setAskChatExpanded(true);
            setActivePanel('ask');
          }}
        />
      )}

      {activePanel === 'contributors' && (
        <ContributorList
          imageId={image.id}
          ownerUserId={image.owner.id}
          contributors={image.contributors}
          canManage={image.canManage}
          onUpdate={fetchImage}
          onClose={closePanel}
        />
      )}

      {activePanel === 'shape' && shapeView === 'menu' && (
        <TendMenuExperience
          emberTitle={emberTitle}
          mediaType={image.mediaType}
          filename={image.filename}
          posterFilename={image.posterFilename}
          titleTone={heroOverlayTone.title}
          canManage={image.canManage}
          onClose={closePanel}
          onOpenSettings={handleOpenSetupCards}
          onOpenAddContent={() => openTendView('addContent')}
          onOpenWiki={() => {
            setActivePanel('wiki');
          }}
          onOpenStoryCut={() => setActivePanel('storyCuts')}
          onOpenTagPeople={() => openTendView('tag')}
          onOpenEditTitle={() => openTendView('editTitle')}
          onOpenContributors={handleOpenContributors}
        />
      )}

      {activePanel === 'shape' && shapeView === 'editTitle' && (
        <SmartTitleExperience
          titleDraft={titleDraft}
          savedTitle={image.title?.trim() || emberTitle}
          generatedDateLabel={smartGeneratedDateLabel}
          analysisSuggestions={groupedTitleSuggestions.analysis}
          contextSuggestions={groupedTitleSuggestions.context}
          contributorQuotes={titleContributorQuotes}
          loadingTitleSuggestions={loadingTitleSuggestions}
          savingDetails={savingDetails}
          isEditing={editingSmartTitle}
          errorMessage={shareError}
          noticeMessage={actionNotice}
          onTitleChange={setTitleDraft}
          onPickSuggestion={(value) => {
            setTitleDraft(value);
            setEditingSmartTitle(false);
          }}
          onEditToggle={() => {
            if (editingSmartTitle) {
              void handleSaveSmartTitle();
              return;
            }

            setEditingSmartTitle(true);
          }}
          onSave={() => void handleSaveSmartTitle()}
          onCancel={() => {
            setTitleDraft(image.title?.trim() || emberTitle);
            setEditingSmartTitle(false);
          }}
          onRegenerate={() => void handleRegenerateSmartTitle()}
          onClose={closePanel}
        />
      )}

      {activePanel === 'shape' && shapeView === 'editCaption' && (
        <SmartCaptionExperience
          captionDraft={captionDraft}
          savedCaption={image.description || ''}
          generatedDateLabel={smartGeneratedDateLabel}
          selectedVoice={smartCaptionVoice}
          loadingCaptionSuggestion={loadingCaptionSuggestion}
          savingDetails={savingDetails}
          isEditing={editingSmartCaption}
          errorMessage={shareError}
          noticeMessage={actionNotice}
          onCaptionChange={setCaptionDraft}
          onVoiceChange={setSmartCaptionVoice}
          onEditToggle={() => {
            if (editingSmartCaption) {
              void handleSaveSmartCaption();
              return;
            }

            setEditingSmartCaption(true);
          }}
          onSave={() => void handleSaveSmartCaption()}
          onCancel={() => {
            setCaptionDraft(image.description || '');
            setEditingSmartCaption(false);
          }}
          onRegenerate={() => void handleRegenerateSmartCaption()}
          onClose={closePanel}
        />
      )}

      <EmberSheet
        open={
          activePanel === 'shape' &&
          shapeView !== 'menu' &&
          shapeView !== 'editTitle' &&
          shapeView !== 'editCaption'
        }
        title={
          shapeView === 'storyCircle'
            ? 'Story Circle'
            : shapeView === 'tag'
            ? 'Tag People'
            : shapeView === 'addContent'
              ? 'Add Content'
              : shapeView === 'editTitle'
                ? 'Edit Title'
                : shapeView === 'editCaption'
                  ? 'Edit Caption'
                  : shapeView === 'location'
                    ? 'Location Information'
                    : shapeView === 'timeDate'
                      ? 'Time & Date Information'
                      : shapeView === 'analysis'
                        ? 'AI Image Analysis'
                  : 'Ember Activity'
        }
        subtitle={
          shapeView === 'storyCircle'
            ? 'Share the story behind this moment with one thoughtful response at a time.'
            : shapeView === 'tag'
            ? 'Pin people to the image, review tags, and run familiar-face matching.'
            : shapeView === 'addContent'
              ? 'Attach additional photos or videos to this Ember.'
            : shapeView === 'editTitle'
              ? 'Refine the generated title for this Ember.'
              : shapeView === 'editCaption'
                ? 'Add or update a caption for this Ember.'
                : shapeView === 'location'
                  ? 'Save a known place for this Ember from GPS or manual entry.'
                  : shapeView === 'timeDate'
                    ? 'Review extracted timestamp data and optionally override it.'
                    : shapeView === 'analysis'
                      ? 'Run or refresh the visual memory analysis for this image.'
                  : 'Review the wiki and media activity connected to this Ember.'
        }
        onClose={closePanel}
      >
        <div className="space-y-5">
          <button
            type="button"
            onClick={() => {
              setShapeView('menu');
              setTendTagPromptOpen(false);
            }}
            className="rounded-full border border-[var(--ember-line-strong)] px-4 py-2 text-sm font-medium text-[var(--ember-text)] hover:border-[rgba(255,102,33,0.24)]"
          >
            {shapeOrigin === 'setup' ? 'Back to setup cards' : 'Back to Tend Ember'}
          </button>

          {shapeView === 'storyCircle' && (
            <div className="space-y-5">
              <div className="ember-sheet-panel p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="ember-eyebrow">Default question order</p>
                    <div className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-[var(--ember-text)]">
                      Share the story behind this moment
                    </div>
                    <p className="mt-3 text-sm leading-7 text-[var(--ember-muted)]">
                      Ember walks through the same owner and contributor questions here, one at a time, in order.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="ember-chip">
                      {ownerStoryCircleTotal > 0
                        ? `${Math.min(ownerStoryCircleCount, ownerStoryCircleTotal)} of ${ownerStoryCircleTotal}`
                        : 'Ready'}
                    </span>
                    {storyCircleComplete && <span className="ember-chip">Core questions done</span>}
                  </div>
                </div>

                {loadingStoryCircle ? (
                  <div className="ember-muted-card mt-5 px-4 py-8 text-center text-sm text-[var(--ember-muted)]">
                    Loading the next Story Circle prompt...
                  </div>
                ) : (
                  <>
                    <div className="ember-purple-card mt-5 px-4 py-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[rgb(139,92,246)]">
                        {storyCircleQuestionType === 'followup'
                          ? 'Open follow-up'
                          : `Step ${Math.min(ownerStoryCircleCount + 1, Math.max(ownerStoryCircleTotal, 1))}`}
                      </div>
                      <p className="mt-3 text-base leading-7 text-[var(--ember-text)]">
                        {storyCirclePrompt || 'Tell Ember something meaningful about this moment.'}
                      </p>
                    </div>

                    <label className="mt-5 block text-sm font-medium text-[var(--ember-text)]">
                      <div className="mb-2">Your response</div>
                      <textarea
                        value={storyCircleAnswer}
                        onChange={(event) => setStoryCircleAnswer(event.target.value)}
                        className="ember-textarea"
                        rows={5}
                        placeholder={
                          storyCircleQuestionType === 'followup'
                            ? 'Add any extra detail, correction, or small memory...'
                            : 'Type your answer here...'
                        }
                      />
                    </label>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => void handleSubmitStoryCircle()}
                        disabled={!storyCircleAnswer.trim() || savingStoryCircle}
                        className="ember-setup-primary disabled:opacity-60"
                      >
                        {savingStoryCircle ? 'Saving response...' : 'Submit Response'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void loadStoryCircle()}
                        className="ember-setup-secondary"
                      >
                        Refresh question
                      </button>
                    </div>
                  </>
                )}
              </div>

              <div className="ember-sheet-panel p-5 sm:p-6">
                <p className="ember-eyebrow">Live voice option</p>
                <h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-[var(--ember-text)]">
                  Talk to the Story Circle bot here
                </h3>
                <p className="mt-3 text-sm leading-7 text-[var(--ember-muted)]">
                  This uses the same Ember voice interviewer directly in your browser instead of calling your phone.
                </p>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (storyCircleVoiceBusy) {
                        stopStoryCircleWebCall();
                        setStoryCircleVoiceState('ending');
                        return;
                      }

                      void startStoryCircleWebCall();
                    }}
                    className="ember-setup-primary disabled:opacity-60"
                  >
                    {storyCircleVoiceState === 'starting'
                      ? 'Connecting...'
                      : storyCircleVoiceState === 'ending'
                        ? 'Ending...'
                        : storyCircleVoiceState === 'active'
                          ? 'End live call'
                          : 'Talk live with Ember'}
                  </button>
                </div>

                {storyCircleVoiceTranscript && (
                  <div className="ember-muted-card mt-5 px-4 py-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ember-muted)]">
                      Live transcript
                    </div>
                    <p className="mt-3 text-sm leading-7 text-[var(--ember-text)]">
                      {storyCircleVoiceTranscript}
                    </p>
                  </div>
                )}

                {storyCircleVoiceError && (
                  <div className="mt-4 text-sm text-rose-600">{storyCircleVoiceError}</div>
                )}
              </div>

              {storyCircleAnswers.length > 0 && (
                <div className="ember-sheet-panel p-5 sm:p-6">
                  <p className="ember-eyebrow">Previous answers</p>
                  <div className="mt-4 space-y-3">
                    {storyCircleAnswers
                      .slice()
                      .reverse()
                      .slice(0, 3)
                      .map((entry) => (
                        <div
                          key={entry.id}
                          className="rounded-[1.5rem] border border-[var(--ember-line)] bg-white px-4 py-4"
                        >
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ember-muted)]">
                            {new Date(entry.createdAt).toLocaleString()}
                          </div>
                          <div className="mt-3 text-sm font-medium text-[var(--ember-text)]">
                            {entry.question}
                          </div>
                          <p className="mt-2 text-sm leading-7 text-[var(--ember-muted)]">
                            {entry.answer}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {shapeView === 'addContent' && (
            <div className="space-y-5">
              {image.ownerConversationTarget && (
                <div className="ember-sheet-panel p-5 sm:p-6">
                  <p className="ember-eyebrow">Add more to the memory</p>
                  <h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-[var(--ember-text)]">
                    Keep telling the story
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--ember-muted)]">
                    Add more context by text or phone, then attach additional photos, videos, and audio below.
                  </p>

                  <div className="mt-5">
                    <MemoryTellMoreActions
                      contributorToken={image.ownerConversationTarget.token}
                      contributorId={image.ownerConversationTarget.id}
                      phoneAvailable={Boolean(
                        image.ownerConversationTarget.phoneNumber ||
                          image.ownerConversationTarget.user?.phoneNumber
                      )}
                      latestVoiceCall={image.ownerConversationTarget.voiceCalls[0] || null}
                      onRefreshRequested={fetchImage}
                    />
                  </div>
                </div>
              )}

              <ImageAttachmentGallery
                imageId={image.id}
                canManage={image.canManage}
                attachments={image.attachments}
                onUpdate={fetchImage}
              />
            </div>
          )}

          {shapeView === 'editTitle' && (
            <div className="ember-sheet-panel p-5 sm:p-6">
              <div className="text-sm leading-7 text-[var(--ember-muted)]">
                Pick the best name for this memory. Use one of Ember&apos;s suggestions or write your own.
              </div>
              <div className="mt-5 space-y-3">
                {loadingTitleSuggestions && titleSuggestions.length === 0 ? (
                  <div className="ember-muted-card px-4 py-8 text-center text-sm text-[var(--ember-muted)]">
                    Generating title ideas...
                  </div>
                ) : (
                  titleSuggestions.map((suggestion) => (
                    <div
                      key={suggestion}
                      className={`flex items-center gap-3 rounded-[1.35rem] border px-4 py-3 ${
                        titleDraft.trim() === suggestion.trim()
                          ? 'border-[rgba(41,98,255,0.26)] bg-[rgba(41,98,255,0.06)]'
                          : 'border-[var(--ember-line)] bg-white'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setTitleDraft(suggestion)}
                        className="min-w-0 flex-1 text-left text-base font-medium text-[var(--ember-text)]"
                      >
                        {suggestion}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setTitleSuggestions((current) =>
                            current.filter((item) => item !== suggestion)
                          )
                        }
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-rose-500 hover:bg-rose-50"
                        aria-label={`Remove ${suggestion}`}
                      >
                        <CloseIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <label className="mt-5 block text-sm font-medium text-[var(--ember-text)]">
                <div className="mb-2">Add your own title</div>
                <input
                  type="text"
                  value={titleDraft}
                  onChange={(event) => setTitleDraft(event.target.value)}
                  className="ember-input"
                />
              </label>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleLetEmberTryTitle()}
                  disabled={loadingTitleSuggestions}
                  className="ember-setup-primary w-full justify-center disabled:opacity-60 sm:w-auto"
                >
                  {loadingTitleSuggestions ? 'Letting Ember try...' : 'Let Ember Try'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveImageDetails({ title: titleDraft.trim() || null })}
                  disabled={savingDetails || !titleDraft.trim()}
                  className="ember-setup-secondary disabled:opacity-60"
                >
                  {savingDetails ? 'Saving...' : 'Save title'}
                </button>
              </div>
            </div>
          )}

          {shapeView === 'editCaption' && (
            <div className="ember-sheet-panel p-5 sm:p-6">
              <div className="text-sm leading-7 text-[var(--ember-muted)]">
                Add a caption or short note that should stay attached to this Ember.
              </div>
              <label className="mt-5 block text-sm font-medium text-[var(--ember-text)]">
                <div className="mb-2">Caption</div>
                <textarea
                  value={captionDraft}
                  onChange={(event) => setCaptionDraft(event.target.value)}
                  className="ember-textarea"
                  rows={5}
                  placeholder="Add a caption for this Ember..."
                />
              </label>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleSaveImageDetails({ description: captionDraft.trim() || null })}
                  disabled={savingDetails}
                  className="ember-setup-primary disabled:opacity-60"
                >
                  {savingDetails ? 'Saving...' : 'Save caption'}
                </button>
              </div>
            </div>
          )}

          {shapeView === 'location' && (
            <div className="ember-sheet-panel p-5 sm:p-6">
              <div className="text-sm leading-7 text-[var(--ember-muted)]">
                GPS location data extracted from your photos. You can also type a manual location if needed.
              </div>

              <div className="mt-5 space-y-3">
                {loadingLocationSuggestions ? (
                  <div className="ember-muted-card px-4 py-8 text-center text-sm text-[var(--ember-muted)]">
                    Loading nearby places...
                  </div>
                ) : locationSuggestions.length > 0 ? (
                  locationSuggestions.map((suggestion) => {
                    const selected = suggestion.id === selectedLocationId;
                    return (
                      <button
                        key={suggestion.id}
                        type="button"
                        onClick={() => {
                          setSelectedLocationId(suggestion.id);
                          setLocationDraft(suggestion.label);
                        }}
                        className={`w-full rounded-[1.4rem] border px-4 py-4 text-left ${
                          selected
                            ? 'border-[rgba(41,98,255,0.26)] bg-[rgba(41,98,255,0.06)]'
                            : 'border-[var(--ember-line)] bg-white'
                        }`}
                      >
                        <div className="text-base font-semibold text-[var(--ember-text)]">
                          {suggestion.label}
                        </div>
                        {suggestion.detail && (
                          <div className="mt-1 text-sm text-[var(--ember-muted)]">
                            {suggestion.detail}
                          </div>
                        )}
                      </button>
                    );
                  })
                ) : (
                  <div className="ember-muted-card border-dashed px-4 py-8 text-center text-sm text-[var(--ember-muted)]">
                    No GPS location data found in uploaded images.
                  </div>
                )}
              </div>

              <label className="mt-5 block text-sm font-medium text-[var(--ember-text)]">
                <div className="mb-2">Manual Location (Optional)</div>
                <input
                  type="text"
                  value={locationDraft}
                  onChange={(event) => setLocationDraft(event.target.value)}
                  placeholder="Enter location name..."
                  className="ember-input"
                />
              </label>

              <p className="mt-2 text-sm text-[var(--ember-muted)]">
                You can manually specify where this Ember was created.
              </p>

              <div className="mt-5">
                <button
                  type="button"
                  onClick={() => void handleSaveLocation()}
                  disabled={savingLocation || (!locationDraft.trim() && !selectedLocationSuggestion)}
                  className="ember-setup-primary w-full justify-center disabled:opacity-60"
                >
                  {savingLocation ? 'Saving location...' : 'Save Location'}
                </button>
              </div>
            </div>
          )}

          {shapeView === 'timeDate' && (
            <div className="ember-sheet-panel p-5 sm:p-6">
              <div className="text-sm leading-7 text-[var(--ember-muted)]">
                Timestamp data extracted from your photos.
              </div>

              {image.analysis?.capturedAt ? (
                <div className="ember-orange-card mt-5 px-4 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ember-orange-deep)]">
                    Photo Timestamp
                  </div>
                  <div className="mt-3 text-base font-semibold text-[var(--ember-text)]">
                    {new Date(image.analysis.capturedAt).toLocaleString()}
                  </div>
                </div>
              ) : (
                <div className="ember-muted-card mt-5 border-dashed px-4 py-8 text-center text-sm text-[var(--ember-muted)]">
                  No timestamp data was found in the current image metadata.
                </div>
              )}

              <label className="mt-5 block text-sm font-medium text-[var(--ember-text)]">
                <div className="mb-2">Manual Date &amp; Time (Optional)</div>
                <input
                  type="datetime-local"
                  value={capturedAtDraft}
                  onChange={(event) => setCapturedAtDraft(event.target.value)}
                  className="ember-input"
                />
              </label>

              <p className="mt-2 text-sm text-[var(--ember-muted)]">
                You can manually specify when this Ember was created.
              </p>

              <div className="mt-5">
                <button
                  type="button"
                  onClick={() => void handleSaveCapturedAt()}
                  disabled={savingCapturedAt}
                  className="ember-setup-primary w-full justify-center disabled:opacity-60"
                >
                  {savingCapturedAt ? 'Saving date & time...' : 'Save Date & Time'}
                </button>
              </div>
            </div>
          )}

          {shapeView === 'analysis' && (
            <div className="ember-sheet-panel p-5 sm:p-6">
              <div className="ember-purple-card px-5 py-5">
                <div className="text-base font-semibold text-[var(--ember-text)]">
                  {analysisComplete ? 'AI analysis is ready' : 'Ready for AI analysis'}
                </div>
                <p className="mt-3 text-sm leading-7 text-[var(--ember-muted)]">
                  {image.analysis?.visualDescription ||
                    image.analysis?.summary ||
                    'Get detailed insights about people, objects, emotions, environment, and more in your image.'}
                </p>

                <button
                  type="button"
                  onClick={() => void handleRunImageAnalysis()}
                  disabled={analysisRunning}
                  className="ember-setup-primary mt-5 disabled:opacity-60"
                >
                  {analysisRunning ? 'Analyzing Image...' : analysisComplete ? 'Refresh Analysis' : 'Analyze Image'}
                </button>
              </div>
            </div>
          )}

          {shapeView === 'tag' && (
            <>
              {image.canManage && (
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setTendTagPromptOpen(true)}
                    className="ember-button-secondary"
                  >
                    Look for familiar faces
                  </button>
                </div>
              )}

              <InteractiveImageTagger
                imageId={image.id}
                mediaType={image.mediaType}
                imageUrl={
                  image.mediaType === 'VIDEO'
                    ? image.posterFilename
                      ? `/api/uploads/${image.posterFilename}`
                      : null
                    : `/api/uploads/${image.filename}`
                }
                videoUrl={image.mediaType === 'VIDEO' ? `/api/uploads/${image.filename}` : null}
                durationSeconds={image.durationSeconds}
                imageName={emberTitle}
                tags={image.tags}
                contributors={image.contributors.map((contributor) => ({
                  id: contributor.id,
                  name: contributor.name,
                  email: contributor.email,
                  phoneNumber: contributor.phoneNumber,
                  userId: contributor.userId,
                }))}
                friends={image.friends}
                tagIdentities={image.tagIdentities}
                canManage={image.canManage}
                onUpdate={fetchImage}
                onTagCreated={handleManualTagComplete}
              />

              <TagManager
                imageId={image.id}
                tags={image.tags}
                contributors={image.contributors.map((contributor) => ({
                  id: contributor.id,
                  name: contributor.name,
                  email: contributor.email,
                  phoneNumber: contributor.phoneNumber,
                  userId: contributor.userId,
                }))}
                friends={image.friends}
                canManage={image.canManage}
                onUpdate={fetchImage}
              />

              <AutoTagPrompt
                imageId={image.id}
                imageName={emberTitle}
                mediaUrl={previewMediaUrl}
                enabled={activePanel === 'shape' && shapeView === 'tag' && tendTagPromptOpen}
                existingTagCount={0}
                onApplied={handleTendAutoTagApplied}
                onAddManualTags={() => setTendTagPromptOpen(false)}
                onDismiss={() => setTendTagPromptOpen(false)}
              />
            </>
          )}

          {shapeView === 'activity' && (
            <EmberActivityView
              emberTitle={emberTitle}
              originalName={image.originalName}
              description={image.description}
              createdAt={image.createdAt}
              titleSaved={Boolean(image.title?.trim())}
              mediaType={image.mediaType}
              filename={image.filename}
              posterFilename={image.posterFilename}
              contributors={image.contributors}
              tags={image.tags}
              attachments={image.attachments}
              analysis={image.analysis}
              messages={activityMessages}
            />
          )}
        </div>
      </EmberSheet>

      {activePanel === 'wiki' && (
        <WikiOverlayExperience
          imageId={image.id}
          wikiContent={image.wiki?.content || null}
          wikiUpdatedAt={image.wiki?.updatedAt || null}
          voiceCallClips={image.voiceCallClips}
          attachments={image.attachments}
          canManage={image.canManage}
          generating={generatingWiki}
          onGenerate={() => {
            void handleRegenerateWiki();
          }}
          onClose={closePanel}
        />
      )}

      {activePanel === 'share' && (
        <ShareEmberExperience
          canManage={image.canManage}
          shareToNetwork={shareToNetwork}
          savingShareState={savingShareState}
          shareError={shareError}
          actionNotice={actionNotice}
          onClose={closePanel}
          onShareNetworkChange={setShareToNetwork}
          onSaveNetworkSharing={() => void handleShareSave()}
          onShareAction={(target) => {
            void handleShareAction(target);
          }}
        />
      )}

      <AutoTagPrompt
        imageId={image.id}
        imageName={emberTitle}
        mediaUrl={previewMediaUrl}
        enabled={
          fromUpload &&
          image.canManage &&
          !showFirstRunGuide &&
          image.tags.length === 0 &&
          !autoTagPromptDismissed &&
          !activePanel
        }
        existingTagCount={image.tags.length}
        onApplied={handleAutoTagApplied}
        onAddManualTags={handleManualTagFromPrompt}
        onDismiss={handleAutoTagDismiss}
      />

      <LocationSuggestionPrompt
        imageId={image.id}
        imageName={emberTitle}
        enabled={
          fromUpload &&
          image.canManage &&
          !showFirstRunGuide &&
          autoTagStepComplete &&
          !locationPromptDismissed &&
          !activePanel
        }
        onApplied={handleLocationApplied}
        onDismiss={handleLocationPromptDismiss}
      />
    </div>
  );
}
