'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
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
import { getEmberTitle } from '@/lib/ember-title';
import type { RetellWebClient } from 'retell-client-js-sdk';
import MediaPreview from '@/components/MediaPreview';
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

type ActivePanel = 'ask' | 'contributors' | 'shape' | 'share' | 'play' | 'storyCuts' | 'wiki' | null;
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
  const colorClass = tone === 'dark' ? 'text-black' : 'text-white';
  const shadowClass =
    tone === 'dark'
      ? 'drop-shadow-[0_1px_2px_rgba(255,255,255,0.28)]'
      : 'drop-shadow-[0_1px_3px_rgba(0,0,0,0.28)]';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center rounded-[1.1rem] px-2 py-2 transition hover:opacity-75 ${colorClass}`}
      aria-label={label}
    >
      <span className={`flex min-w-[3.55rem] flex-col items-center justify-center gap-1 ${shadowClass}`}>
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
  expanded,
  onExpandedChange,
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
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
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
  const inputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<unknown>(null);
  const pendingFocusRef = useRef(false);
  const listeningTranscriptRef = useRef('');

  const shouldShowExpanded = expanded || messages.length > 0 || isListening;

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
    };
  }, []);

  const submitMessage = useCallback(
    async (rawMessage: string) => {
      const userMessage = rawMessage.trim();
      if (!userMessage || isLoading) {
        return;
      }

      setInput('');
      setVoiceError('');
      setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
      setIsLoading(true);
      onExpandedChange(true);

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageId,
            message: userMessage,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to get response');
        }

        const data = await response.json();
        setMessages((prev) => [...prev, { role: 'assistant', content: data.response }]);
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
    [imageId, isLoading, onExpandedChange, subjectNoun]
  );

  const handleVoiceToggle = useCallback(() => {
    const recognition = recognitionRef.current as
      | {
          stop?: () => void;
        }
      | null;

    if (isListening) {
      recognition?.stop?.();
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
      if (finalTranscript) {
        void submitMessage(finalTranscript);
      }
      listeningTranscriptRef.current = '';
    };

    recognitionRef.current = nextRecognition;
    nextRecognition.start();
  }, [isListening, onExpandedChange, submitMessage]);

  const handleCompactComposerClick = () => {
    pendingFocusRef.current = true;
    onExpandedChange(true);
  };

  const lastAssistantMessage =
    [...messages].reverse().find((message) => message.role === 'assistant') || null;

  return (
    <div className="ember-overlay-shell z-50 bg-white" onClick={onClose}>
      <div className="relative h-full w-full overflow-hidden" onClick={(event) => event.stopPropagation()}>
        <div className={`relative overflow-hidden bg-[#a8ba91] ${shouldShowExpanded ? 'h-[40%]' : 'h-[60%]'}`}>
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
            <div className="absolute right-2 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-5 pr-1">
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
                onClick={() => onExpandedChange(false)}
              />
            </div>
          )}
        </div>

        <div
          className={`absolute inset-x-0 bottom-0 bg-[var(--ember-orange)] text-white ${
            shouldShowExpanded ? 'top-[40%]' : 'top-[60%]'
          }`}
        >
          {!shouldShowExpanded ? (
            <div className="flex h-full flex-col px-4 pt-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
              <div className="mx-auto mt-4 max-w-[18rem] text-center text-[1.05rem] font-medium leading-[1.28] tracking-[-0.02em]">
                Have a conversation with ember about this memory.
              </div>

              <button
                type="button"
                onClick={handleCompactComposerClick}
                className="mt-8 flex h-14 w-full items-center justify-between bg-white px-4 text-left text-[0.98rem] text-[#9b9b9b]"
              >
                <span>Ask Anything</span>
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
            </div>
          ) : (
            <div className="flex h-full flex-col px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+0.8rem)]">
              <div className="flex items-start justify-between gap-4">
                <div className="text-[1rem] font-semibold leading-none tracking-[-0.02em] text-white">
                  Ask Ember <span className="font-normal text-white/88">| {ownerLabel}</span>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-8 w-8 items-center justify-center text-white"
                  aria-label="Close Ask Ember"
                >
                  <CloseIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 flex-1 overflow-y-auto pr-1">
                {messages.length === 0 && !isLoading ? (
                  <div className="pt-8 text-center text-[1rem] font-medium leading-[1.3] text-white/96">
                    Start asking ember about this {subjectNoun}.
                  </div>
                ) : (
                  <div className="space-y-5">
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
                  void submitMessage(input);
                }}
                className="mt-4"
              >
                <div className="flex h-14 items-center bg-white px-3 text-black">
                  <button type="button" className="mr-2 inline-flex h-9 w-9 items-center justify-center text-black/88">
                    <AskPlusIcon className="h-5 w-5" />
                  </button>
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="Ask Anything"
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
              </form>

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
      ? 'Preparing the narration for this ember...'
      : narrationScript || 'Ember is getting the story ready.';

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

          <div className="absolute right-2 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-5 pr-1">
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

        <div className="absolute inset-x-0 bottom-0 top-[60%] flex flex-col bg-[var(--ember-orange)] px-7 pt-5 pb-[calc(env(safe-area-inset-bottom)+1.1rem)] text-white">
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
                Generate the story first so Ember has narration to play here.
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
  loadingTitleSuggestions,
  savingDetails,
  isEditing,
  errorMessage,
  noticeMessage,
  onTitleChange,
  onEditToggle,
  onSave,
  onCancel,
  onRegenerate,
  onClose,
}: {
  titleDraft: string;
  savedTitle: string;
  generatedDateLabel: string;
  loadingTitleSuggestions: boolean;
  savingDetails: boolean;
  isEditing: boolean;
  errorMessage: string;
  noticeMessage: string;
  onTitleChange: (value: string) => void;
  onEditToggle: () => void;
  onSave: () => void;
  onCancel: () => void;
  onRegenerate: () => void;
  onClose: () => void;
}) {
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
            <button
              type="button"
              onClick={onRegenerate}
              disabled={loadingTitleSuggestions}
              className="min-h-[3rem] min-w-[8.2rem] bg-[#365d61] px-5 py-3 text-[0.95rem] font-semibold text-white disabled:opacity-60"
            >
              {loadingTitleSuggestions ? 'GENERATING' : 'REGENERATE'}
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

function TendViewFeedIcon({ className = 'h-8 w-8' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className} aria-hidden="true">
      <path d="M5 18.5a13.5 13.5 0 0 1 13.5-13.5" />
      <path d="M5 12.8A6.8 6.8 0 0 1 11.8 6" />
      <path d="M5 7.6A1.1 1.1 0 1 0 5 9.8 1.1 1.1 0 0 0 5 7.6Z" fill="currentColor" stroke="none" />
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

function TendEditCaptionIcon({ className = 'h-8 w-8' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
      <rect x="3.8" y="5" width="16.4" height="11.5" rx="2.1" />
      <path d="M7 9h10" />
      <path d="M7 12h7.2" />
      <path d="m9.2 16.5-2.3 2.2" />
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
  onOpenFeed,
  onOpenWiki,
  onOpenStoryCut,
  onOpenTagPeople,
  onOpenEditTitle,
  onOpenEditCaption,
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
  onOpenFeed: () => void;
  onOpenWiki: () => void;
  onOpenStoryCut: () => void;
  onOpenTagPeople: () => void;
  onOpenEditTitle: () => void;
  onOpenEditCaption: () => void;
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
              icon={<TendViewFeedIcon className="h-full w-full" />}
              label="View Feed"
              onClick={onOpenFeed}
            />
            <TendMenuButton
              icon={<TendWikiIcon className="h-full w-full" />}
              label="View Wiki"
              onClick={onOpenWiki}
            />
            <TendMenuButton
              icon={<TendStoryCutIcon className="h-full w-full" />}
              label="Story Cut"
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
              label="Edit Title"
              onClick={onOpenEditTitle}
              disabled={!canManage}
            />
            <TendMenuButton
              icon={<TendEditCaptionIcon className="h-full w-full" />}
              label="Edit Caption"
              onClick={onOpenEditCaption}
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
  wikiContent,
  wikiUpdatedAt,
  onClose,
}: {
  wikiContent: string | null;
  wikiUpdatedAt: string | null;
  onClose: () => void;
}) {
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
            <div className="mx-auto max-w-[20rem] whitespace-pre-wrap text-center text-[1.04rem] font-medium leading-[1.4] tracking-[-0.02em] text-white sm:max-w-[24rem] sm:text-[1.1rem]">
              {wikiContent}
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
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [shapeView, setShapeView] = useState<ShapeView>('menu');
  const [autoTagPromptDismissed, setAutoTagPromptDismissed] = useState(false);
  const [locationPromptDismissed, setLocationPromptDismissed] = useState(false);
  const [askChatExpanded, setAskChatExpanded] = useState(false);
  const [tendTagPromptOpen, setTendTagPromptOpen] = useState(false);
  const [shapeOrigin, setShapeOrigin] = useState<'tend' | 'setup'>('tend');
  const [titleDraft, setTitleDraft] = useState('');
  const [titleSuggestions, setTitleSuggestions] = useState<string[]>([]);
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
  const [storyCutIncludeNarratorVoice, setStoryCutIncludeNarratorVoice] = useState(true);
  const [storyCutVoiceOptions, setStoryCutVoiceOptions] = useState<StoryCutVoiceOption[]>([]);
  const [loadingStoryCutVoices, setLoadingStoryCutVoices] = useState(false);
  const [storyCutEmberVoiceId, setStoryCutEmberVoiceId] = useState('');
  const [storyCutNarratorVoiceId, setStoryCutNarratorVoiceId] = useState('');
  const [storyCutLoading, setStoryCutLoading] = useState(false);
  const [storyCutError, setStoryCutError] = useState('');
  const [storyCutData, setStoryCutData] = useState<StoryCutResult | null>(null);
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

  useEffect(() => {
    fetchImage();
  }, [fetchImage]);

  useEffect(() => {
    if (!image) {
      return;
    }

    setTitleDraft(image.title?.trim() || getEmberTitle(image));
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
    setStoryCutIncludeNarratorVoice(image.storyCut?.includeNarratorVoice ?? true);
    setStoryCutEmberVoiceId(image.storyCut?.emberVoiceId || '');
    setStoryCutNarratorVoiceId(image.storyCut?.narratorVoiceId || '');
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
            narratorVoiceLines: image.storyCut.blocks
              .filter(
                (block): block is StoryCutBlock & { type: 'voice'; speaker?: string | null; content?: string | null } =>
                  block.type === 'voice' && block.speaker === 'NARRATOR' && Boolean(block.content)
              )
              .map((block) => block.content || ''),
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
    setStoryCutError('');
  }, [image]);

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
    const shouldShowSetupCards = Boolean(image?.canManage && (fromUpload || setupRequested));

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
        setAskChatExpanded(false);
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

  const loadTitleSuggestions = useCallback(async () => {
    if (!image?.canManage) {
      return;
    }

    setLoadingTitleSuggestions(true);
    setShareError('');

    try {
      const response = await fetch(`/api/images/${image.id}/title-suggestions`, {
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to generate title suggestions');
      }

      setTitleSuggestions(Array.isArray(payload?.suggestions) ? payload.suggestions : []);
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

      if (!payload?.title) {
        throw new Error('Failed to generate a title');
      }

      setTitleDraft(payload.title);
      setTitleSuggestions((current) => {
        const next = [payload.title, ...current].filter(Boolean);
        return Array.from(new Set(next.map((title: string) => title.trim()))).slice(0, 4);
      });

      await handleSaveImageDetails(
        { title: payload.title },
        {
          closeAfterSave: false,
          successMessage: 'Smart title regenerated.',
        }
      );
    } catch (titleError) {
      setShareError(
        titleError instanceof Error ? titleError.message : 'Failed to generate a title'
      );
    } finally {
      setLoadingTitleSuggestions(false);
    }
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

  const handleNarrationToggle = async () => {
    if (!image?.wiki?.content) {
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
      let script = narrationScript;

      if (!script) {
        const scriptResponse = await fetch('/api/narration/script', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: image.wiki.content,
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
    if (!storyCut?.script) {
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
        ? storyCut.narratorVoiceId || storyCut.emberVoiceId || null
        : storyCutNarratorVoiceId || storyCutEmberVoiceId || null;
    const selectedMediaIds =
      storyCut && 'selectedMediaIds' in storyCut && Array.isArray(storyCut.selectedMediaIds)
        ? storyCut.selectedMediaIds
        : storyCutSelectedMediaIds;
    const ambientTracks = selectedMediaIds
      .filter((mediaId) => mediaId !== image?.id)
      .map((mediaId) => image?.attachments.find((attachment) => attachment.id === mediaId) || null)
      .filter(
        (
          attachment
        ): attachment is ImageRecord['attachments'][number] =>
          attachment !== null && attachment.mediaType === 'AUDIO'
      )
      .map((attachment) => ({
        id: attachment.id,
        url: `/api/uploads/${attachment.filename}`,
      }));

    try {
      const response = await fetch('/api/narration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: storyCut.script,
          voiceId: requestedVoiceId,
          voicePreference: voicePreference,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Story Cut audio could not be generated.');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      if (storyCutPlaybackRequestRef.current !== playbackRequestId) {
        URL.revokeObjectURL(audioUrl);
        return;
      }

      storyCutAudioUrlRef.current = audioUrl;
      storyCutAudioRef.current = audio;

      const ambientAudios = ambientTracks.map((track) => {
        const ambientAudio = new Audio(track.url);
        ambientAudio.preload = 'auto';
        ambientAudio.volume = 0.18;
        return ambientAudio;
      });
      storyCutAmbientAudioRefs.current = ambientAudios;

      if (ambientAudios.length === 1) {
        ambientAudios[0].loop = true;
      } else if (ambientAudios.length > 1) {
        ambientAudios.forEach((ambientAudio, index) => {
          ambientAudio.onended = () => {
            if (storyCutPlaybackRequestRef.current !== playbackRequestId) {
              return;
            }

            const nextAudio = ambientAudios[index + 1] || ambientAudios[0];
            if (!nextAudio) {
              return;
            }

            nextAudio.currentTime = 0;
            void nextAudio.play().catch(() => {});
          };
        });
      }

      audio.onended = () => {
        stopStoryCutPlayback();
      };

      audio.onerror = () => {
        stopStoryCutPlayback();
        setStoryCutPlaybackError('Story Cut audio could not be played on this device.');
      };

      await audio.play();
      if (storyCutPlaybackRequestRef.current !== playbackRequestId) {
        stopStoryCutPlayback();
        return;
      }

      if (ambientAudios.length > 0) {
        ambientAudios[0].currentTime = 0;
        void ambientAudios[0].play().catch(() => {});
      }

      setStoryCutPlaybackState('playing');
    } catch (storyCutPlaybackIssue) {
      stopStoryCutPlayback();
      setStoryCutPlaybackError(
        storyCutPlaybackIssue instanceof Error
          ? storyCutPlaybackIssue.message
          : 'Story Cut audio could not be generated.'
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
          includeNarratorVoice: storyCutIncludeNarratorVoice,
          emberVoiceId: storyCutEmberVoiceId || null,
          narratorVoiceId: storyCutNarratorVoiceId || null,
          emberVoiceLabel:
            storyCutVoiceOptions.find((voice) => voice.voiceId === storyCutEmberVoiceId)?.label ||
            null,
          narratorVoiceLabel:
            storyCutVoiceOptions.find((voice) => voice.voiceId === storyCutNarratorVoiceId)?.label ||
            null,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.storyCut) {
        throw new Error(payload?.error || 'Failed to generate Story Cuts');
      }

      setStoryCutData(payload.storyCut as StoryCutResult);
      await fetchImage();
      setActionNotice('Story Cut generated.');
    } catch (storyCutGenerationError) {
      setStoryCutError(
        storyCutGenerationError instanceof Error
          ? storyCutGenerationError.message
          : 'Failed to generate Story Cuts'
      );
    } finally {
      setStoryCutLoading(false);
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

      if (!storyCutNarratorVoiceId) {
        const preferredNarrator =
          nextVoices.find((voice) =>
            /narrat|story|guide|podcast|radio/i.test(voice.label || voice.name)
          ) || nextVoices[1] || nextVoices[0];
        if (preferredNarrator?.voiceId) {
          setStoryCutNarratorVoiceId(preferredNarrator.voiceId);
        }
      }
    } catch (voiceError) {
      setStoryCutError(
        voiceError instanceof Error ? voiceError.message : 'Failed to load voice options'
      );
    } finally {
      setLoadingStoryCutVoices(false);
    }
  }, [
    loadingStoryCutVoices,
    storyCutEmberVoiceId,
    storyCutNarratorVoiceId,
    storyCutVoiceOptions.length,
  ]);

  useEffect(() => {
    if (activePanel !== 'shape') {
      return;
    }

    if (
      shapeView === 'editTitle' &&
      !titleDraft.trim() &&
      titleSuggestions.length === 0 &&
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
    titleDraft,
    titleSuggestions.length,
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
  const showSetupCards = image.canManage && (fromUpload || setupRequested);
  const storyCutMediaItems = [
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
  ];
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
      title: 'Story Cuts',
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

  const handleOpenSetupCards = () => {
    setAskChatExpanded(false);
    setTendTagPromptOpen(false);
    setShapeOrigin('tend');
    setActivePanel(null);
    setShapeView('menu');

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set('setup', '1');
    nextParams.delete('panel');
    nextParams.delete('view');

    router.replace(`/image/${params.id}?${nextParams.toString()}`);
  };

  const handleHideSetupCards = () => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('setup');
    nextParams.delete('fromUpload');

    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `/image/${params.id}?${nextQuery}` : `/image/${params.id}`);
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

  return (
    <div className="min-h-[calc(100dvh-2.7rem)] bg-white">
      <section className="mx-auto w-full">
        {showSetupCards ? (
          <div className="ember-screen-card overflow-hidden">
            <div className="ember-setup-hero">
              <MediaPreview
                mediaType={image.mediaType}
                filename={image.filename}
                posterFilename={image.posterFilename}
                originalName={emberTitle}
                controls={image.mediaType === 'VIDEO'}
                className={`w-full ${
                  image.mediaType === 'VIDEO'
                    ? 'aspect-[0.98] object-contain bg-[var(--ember-charcoal)] sm:aspect-[0.72]'
                    : 'aspect-[0.98] object-cover bg-[var(--ember-charcoal)] sm:aspect-[0.72]'
                }`}
              />
              <div className="ember-setup-veil" />
              <div className="absolute left-4 top-4 right-24 sm:left-6 sm:top-6">
                <h1 className="max-w-[14rem] text-[1.7rem] font-semibold leading-[1.02] tracking-[-0.045em] text-white sm:max-w-[26rem] sm:text-[2.7rem]">
                  {emberTitle}
                </h1>
              </div>

              <div className="absolute right-3 top-3 flex flex-col gap-2 sm:right-5 sm:top-5">
                <button
                  type="button"
                  onClick={() => router.push('/feed')}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-[1.15rem] bg-[rgba(238,240,246,0.9)] text-[#667084] shadow-[0_14px_30px_rgba(15,21,36,0.18)] backdrop-blur-md"
                  aria-label="Back to feed"
                >
                  <HomeIcon className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={handleHideSetupCards}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-[1.15rem] bg-[rgba(238,240,246,0.9)] text-[#667084] shadow-[0_14px_30px_rgba(15,21,36,0.18)] backdrop-blur-md"
                  aria-label="Hide setup cards"
                >
                  <ExpandIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="ember-setup-rail">
                {setupRailCards.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={card.onClick}
                    className={`ember-setup-rail-button ${
                      card.selected ? 'ember-setup-rail-button-active' : ''
                    }`}
                    aria-label={card.title}
                  >
                    <SetupCardIcon name={card.icon} className="h-[1.125rem] w-[1.125rem]" />
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white pt-3 pb-1">
              <div className="relative px-4 sm:px-5">
                <h2 className="mx-auto max-w-[18rem] text-center text-[1.1rem] font-semibold tracking-[-0.035em] text-[var(--ember-text)] sm:max-w-none sm:text-[1.15rem]">
                  User, lets complete these cards...
                </h2>
                {setupRequested && !fromUpload && (
                  <button
                    type="button"
                    onClick={handleHideSetupCards}
                    className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-[var(--ember-line-strong)] px-3 py-1.5 text-xs font-medium text-[var(--ember-muted)] hover:border-[rgba(255,102,33,0.24)] hover:text-[var(--ember-text)]"
                  >
                    Hide
                  </button>
                )}
              </div>

              <div className="ember-setup-stack mt-3">
                {setupCards.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={card.onClick}
                    className={`ember-setup-card ${card.selected ? 'ember-setup-card-active' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span
                        className={`inline-flex h-10 w-10 items-center justify-center rounded-[1rem] ${
                          card.selected
                            ? 'bg-white/18 text-white'
                            : 'bg-[var(--ember-blue-soft)] text-[var(--ember-blue)]'
                        }`}
                      >
                        <SetupCardIcon name={card.icon} className="h-5 w-5" />
                      </span>
                      <span className="ember-setup-badge">{card.status}</span>
                    </div>
                    <div className="mt-4 text-[1rem] font-semibold tracking-[-0.02em]">
                      {card.title}
                    </div>
                    <p
                      className={`mt-2 text-sm leading-6 ${
                        card.selected ? 'text-white/84' : 'text-[var(--ember-muted)]'
                      }`}
                    >
                      {card.subtitle}
                    </p>
                  </button>
                ))}
              </div>

              {(actionNotice || shareError) && (
                <div
                  className={`px-4 pb-3 text-center text-sm ${
                    shareError ? 'text-rose-600' : 'text-[var(--ember-muted)]'
                  }`}
                >
                  {shareError || actionNotice}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex min-h-[calc(100dvh-2.7rem)] flex-col bg-white">
            <div
              ref={heroStageRef}
              className="relative min-h-[55vh] flex-[0_0_58vh] overflow-hidden bg-[#a8ba91]"
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

              <div className="absolute right-2 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-5 pr-1 sm:right-4 sm:gap-6">
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
                    setAskChatExpanded(false);
                    setActivePanel('ask');
                  }}
                />
              </div>
            </div>

            <div className="flex flex-1 flex-col items-center bg-[var(--ember-orange)] px-7 py-5 text-center text-white">
              <p className="max-w-[16rem] text-[1.05rem] font-medium leading-[1.3] tracking-[-0.02em] sm:max-w-[20rem] sm:text-[1.45rem]">
                Explore this ember and invite friends &amp; family to add to the memory.
              </p>

              {(actionNotice || shareError) && (
                <div className="mt-4 max-w-[16rem] text-sm text-white/92 sm:max-w-[20rem]">
                  {shareError || actionNotice}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

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
          expanded={askChatExpanded}
          onExpandedChange={setAskChatExpanded}
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
        title="Story Cuts"
        subtitle="Build a styled, audio-ready version of this memory. Play still handles the simple listen-to-narration experience."
        onClose={closePanel}
      >
        <div className="space-y-5">
          <div className="ember-panel rounded-[2rem] p-6">
            <p className="ember-eyebrow">Story Cuts Creator</p>
            <h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-[var(--ember-text)]">
              Compose your own version of this ember
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
                  {selectedStoryCutAmbientAudioCount === 1 ? ' track will' : ' tracks will'} mix
                  under the narrated Story Cut.
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
                        <MediaPreview
                          mediaType={media.mediaType}
                          filename={media.kind === 'cover' ? image.filename : image.attachments.find((attachment) => attachment.id === media.id)?.filename || image.filename}
                          posterFilename={
                            media.kind === 'cover'
                              ? image.posterFilename
                              : image.attachments.find((attachment) => attachment.id === media.id)?.posterFilename || null
                          }
                          originalName={media.label}
                          usePosterForVideo
                          className="aspect-[1.1] w-full object-cover bg-[var(--ember-soft)]"
                        />
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-[var(--ember-text)]">{media.label}</div>
                          <div className="mt-1 text-xs text-[var(--ember-muted)]">
                            {media.kind === 'cover' ? 'Cover media' : 'Supporting media'}
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
                  ? 'Generating Story Cut...'
                  : storyCutData
                    ? 'Generate New Story Cut'
                    : 'Generate New Story Cut'}
              </button>
              {storyCutData && (
                <button
                  type="button"
                  onClick={() => void handlePlayStoryCut(storyCutData)}
                  className="ember-button-secondary"
                >
                  {storyCutPlaybackState === 'loading'
                    ? 'Preparing audio...'
                    : storyCutPlaybackState === 'playing'
                      ? 'Stop Story Cut'
                      : 'Play Story Cut'}
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
                      {selectedStoryCutAmbientAudioCount} ambient audio
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
                  {storyCutIncludeNarratorVoice && (
                    <span className="rounded-full bg-[rgba(41,98,255,0.08)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#2962ff]">
                      Narrator
                    </span>
                  )}
                </div>

                <div className="mt-5 rounded-[1.6rem] border border-[var(--ember-line)] bg-white px-4 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ember-muted)]">
                    Story script
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--ember-text)]">
                    {storyCutData.script}
                  </p>
                </div>
              </div>

              <div className="ember-panel rounded-[2rem] p-6">
                <p className="ember-eyebrow">Story blocks</p>
                <div className="mt-4 space-y-3">
                  {storyCutData.blocks.map((block) =>
                    block.type === 'voice' ? (
                      <div
                        key={`voice-${block.order}-${block.messageId || block.speaker || 'generated'}`}
                        className="rounded-[1.45rem] border border-[var(--ember-line)] bg-white px-4 py-4"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ember-muted)]">
                            Voice {block.order}
                          </span>
                          <span className="rounded-full bg-[rgba(41,98,255,0.08)] px-2.5 py-1 text-[11px] font-semibold text-[#2962ff]">
                            {block.speaker || 'Voice'}
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-7 text-[var(--ember-text)]">
                          {block.content}
                        </p>
                      </div>
                    ) : (
                      <div
                        key={`media-${block.order}-${block.mediaId || block.mediaName || 'media'}`}
                        className="rounded-[1.45rem] border border-[rgba(255,102,33,0.18)] bg-[rgba(255,102,33,0.05)] px-4 py-4"
                      >
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ember-orange-deep)]">
                          Media {block.order}
                        </div>
                        <div className="mt-2 text-sm font-medium text-[var(--ember-text)]">
                          {block.mediaName || 'Supporting media'}
                        </div>
                        <div className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ember-muted)]">
                          {block.mediaType || 'MEDIA'}
                        </div>
                        {block.mediaUrl && (
                          <div className="mt-3 overflow-hidden rounded-[1rem]">
                            <MediaPreview
                              mediaType={block.mediaType || 'IMAGE'}
                              filename={block.mediaUrl.replace('/api/uploads/', '')}
                              originalName={block.mediaName || 'Supporting media'}
                              controls={block.mediaType === 'AUDIO'}
                              className={`w-full bg-[var(--ember-soft)] ${
                                block.mediaType === 'AUDIO'
                                  ? 'rounded-[1rem]'
                                  : 'aspect-[1.3] object-cover'
                              }`}
                            />
                          </div>
                        )}
                      </div>
                    )
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
          canPlay={Boolean(image.wiki?.content)}
          narrationState={narrationState}
          narrationScript={narrationScript}
          narrationError={narrationError}
          onStartOrStop={() => void handleNarrationToggle()}
          onStopAndClose={closePanel}
          onOpenShare={() => {
            stopNarration();
            setActivePanel('share');
          }}
          onOpenTend={() => {
            stopNarration();
            setShapeView('menu');
            setActivePanel('shape');
          }}
          onOpenAsk={() => {
            stopNarration();
            setAskChatExpanded(false);
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
          onOpenFeed={() => {
            closePanel();
            router.push('/feed');
          }}
          onOpenWiki={() => {
            setActivePanel('wiki');
          }}
          onOpenStoryCut={() => setActivePanel('storyCuts')}
          onOpenTagPeople={() => openTendView('tag')}
          onOpenEditTitle={() => openTendView('editTitle')}
          onOpenEditCaption={() => openTendView('editCaption')}
          onOpenContributors={handleOpenContributors}
        />
      )}

      {activePanel === 'shape' && shapeView === 'editTitle' && (
        <SmartTitleExperience
          titleDraft={titleDraft}
          savedTitle={image.title?.trim() || emberTitle}
          generatedDateLabel={smartGeneratedDateLabel}
          loadingTitleSuggestions={loadingTitleSuggestions}
          savingDetails={savingDetails}
          isEditing={editingSmartTitle}
          errorMessage={shareError}
          noticeMessage={actionNotice}
          onTitleChange={setTitleDraft}
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
          wikiContent={image.wiki?.content || null}
          wikiUpdatedAt={image.wiki?.updatedAt || null}
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
