'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ChatInterface from '@/components/ChatInterface';
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
    mediaType: 'IMAGE' | 'VIDEO';
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

type ActivePanel = 'ask' | 'contributors' | 'shape' | 'share' | 'play' | 'storyCuts' | null;
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

const STORY_CIRCLE_STEPS = ['context', 'who', 'when', 'where', 'what', 'why', 'how'] as const;
const STORY_CUT_STYLE_OPTIONS: Array<{ value: StoryCutStyle; label: string }> = [
  { value: 'documentary', label: 'Documentary' },
  { value: 'publicRadio', label: 'Public Radio' },
  { value: 'newsReport', label: 'News Report' },
  { value: 'podcastNarrative', label: 'Podcast Narrative' },
  { value: 'movieTrailer', label: 'Movie Trailer' },
];
const STORY_CUT_DURATION_OPTIONS = [5, 20, 35, 50, 60] as const;

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

function FloatingCloseButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed right-4 top-[calc(env(safe-area-inset-top)+0.9rem)] z-[70] inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/18 bg-[rgba(12,12,12,0.58)] text-white shadow-[0_14px_32px_rgba(0,0,0,0.28)] backdrop-blur-md sm:right-5 sm:top-[calc(env(safe-area-inset-top)+1rem)]"
      aria-label={label}
    >
      <CloseIcon className="h-5 w-5" />
    </button>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  }) {
    const className =
      'flex w-full flex-col items-center gap-0 rounded-[0.85rem] bg-transparent px-1 py-0.5 text-center text-[var(--ember-text)] transition hover:text-[var(--ember-text)]';

  return (
    <button type="button" onClick={onClick} className={className} aria-label={label}>
      <span className="flex h-16 w-16 items-center justify-center text-[var(--ember-text)] sm:h-[4.35rem] sm:w-[4.35rem]">
        {icon}
      </span>
      <span className="-mt-2.5 text-[0.88rem] font-medium lowercase leading-none tracking-[-0.02em] text-[var(--ember-text)] sm:-mt-2 sm:text-[1.02rem]">
        {label}
      </span>
    </button>
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
        className="absolute inset-x-0 bottom-0 mx-auto max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-t-[2rem] border border-white/70 bg-[rgba(255,255,255,0.98)] shadow-[0_-18px_48px_rgba(17,17,17,0.18)] backdrop-blur-xl animate-[ember-sheet-rise_240ms_ease-out] sm:bottom-4 sm:rounded-[2rem]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b ember-divider px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="ember-eyebrow">Ember</p>
              <h2 className="ember-heading mt-3 text-3xl text-[var(--ember-text)]">{title}</h2>
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

        <div className="max-h-[calc(88vh-8rem)] overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
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
  const [deletingEmber, setDeletingEmber] = useState(false);
  const [autoTagPromptDismissed, setAutoTagPromptDismissed] = useState(false);
  const [locationPromptDismissed, setLocationPromptDismissed] = useState(false);
  const [leavingEmber, setLeavingEmber] = useState(false);
  const [askChatExpanded, setAskChatExpanded] = useState(true);
  const [tendTagPromptOpen, setTendTagPromptOpen] = useState(false);
  const [shapeOrigin, setShapeOrigin] = useState<'tend' | 'setup'>('tend');
  const [titleDraft, setTitleDraft] = useState('');
  const [titleSuggestions, setTitleSuggestions] = useState<string[]>([]);
  const [loadingTitleSuggestions, setLoadingTitleSuggestions] = useState(false);
  const [captionDraft, setCaptionDraft] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestionOption[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [locationDraft, setLocationDraft] = useState('');
  const [loadingLocationSuggestions, setLoadingLocationSuggestions] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [capturedAtDraft, setCapturedAtDraft] = useState('');
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
  const [voicePreference, setVoicePreference] = useState<NarrationPreference>('female');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const storyCutAudioRef = useRef<HTMLAudioElement | null>(null);
  const storyCutAudioUrlRef = useRef<string | null>(null);
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
    setCaptionDraft(image.description || '');
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
    setAutoTagPromptDismissed(false);
    setLocationPromptDismissed(false);
  }, [fromUpload, params.id]);

  useEffect(() => {
    if (
      requestedPanel === 'ask' ||
      requestedPanel === 'contributors' ||
      requestedPanel === 'shape' ||
      requestedPanel === 'share' ||
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

    if (storyCutAudioRef.current) {
      storyCutAudioRef.current.pause();
      storyCutAudioRef.current.currentTime = 0;
      storyCutAudioRef.current = null;
    }

    if (storyCutAudioUrlRef.current) {
      URL.revokeObjectURL(storyCutAudioUrlRef.current);
      storyCutAudioUrlRef.current = null;
    }

    setStoryCutPlaybackState('idle');
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

    setAskChatExpanded(true);
    setTendTagPromptOpen(false);
    setShapeOrigin('tend');
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

  const handleSaveImageDetails = async (updates: {
    title?: string | null;
    description?: string | null;
  }) => {
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
      setActionNotice('Ember details updated.');
      returnFromShapeDetail();
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

  const handleDeleteEmber = async () => {
    if (!image?.canManage || deletingEmber) {
      return;
    }

    const displayTitle = getEmberTitle(image);
    const confirmed = window.confirm(`Delete ${displayTitle}? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    setDeletingEmber(true);

    try {
      const response = await fetch(`/api/images/${image.id}`, {
        method: 'DELETE',
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to delete Ember');
      }

      router.push('/feed');
      router.refresh();
    } catch (deleteError) {
      setShareError(
        deleteError instanceof Error ? deleteError.message : 'Failed to delete Ember'
      );
    } finally {
      setDeletingEmber(false);
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
    if (storyCutAudioRef.current) {
      storyCutAudioRef.current.pause();
      storyCutAudioRef.current.currentTime = 0;
      storyCutAudioRef.current = null;
    }

    if (storyCutAudioUrlRef.current) {
      URL.revokeObjectURL(storyCutAudioUrlRef.current);
      storyCutAudioUrlRef.current = null;
    }

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

    const requestedVoiceId =
      storyCut && 'narratorVoiceId' in storyCut
        ? storyCut.narratorVoiceId || storyCut.emberVoiceId || null
        : storyCutNarratorVoiceId || storyCutEmberVoiceId || null;

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

      storyCutAudioUrlRef.current = audioUrl;
      storyCutAudioRef.current = audio;

      audio.onended = () => {
        stopStoryCutPlayback();
      };

      audio.onerror = () => {
        stopStoryCutPlayback();
        setStoryCutPlaybackError('Story Cut audio could not be played on this device.');
      };

      await audio.play();
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

  const handleLeaveEmber = async () => {
    if (!image?.viewerCanLeave || !image.viewerContributorId || leavingEmber) {
      return;
    }

    const confirmed = window.confirm(
      `Remove yourself from ${emberTitle}? You will lose access to this Ember unless you are added again.`
    );

    if (!confirmed) {
      return;
    }

    setLeavingEmber(true);
    setShareError('');

    try {
      const response = await fetch(`/api/contributors?id=${image.viewerContributorId}`, {
        method: 'DELETE',
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to leave this Ember');
      }

      router.replace('/feed');
    } catch (leaveError) {
      setShareError(
        leaveError instanceof Error ? leaveError.message : 'Failed to leave this Ember'
      );
      setLeavingEmber(false);
    }
  };

  useEffect(() => {
    if (activePanel !== 'shape') {
      return;
    }

    if (shapeView === 'editTitle' && titleSuggestions.length === 0 && !loadingTitleSuggestions) {
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
    setAskChatExpanded(true);
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
    <div className="mx-auto max-w-5xl px-3 pt-3 pb-28 sm:px-4 sm:pt-4 sm:pb-10">
        <section className="mx-auto w-full max-w-none">
          <div className="ember-photo-shell bg-white shadow-[0_18px_42px_rgba(17,17,17,0.08)]">
            <MediaPreview
              mediaType={image.mediaType}
              filename={image.filename}
            posterFilename={image.posterFilename}
            originalName={emberTitle}
            controls={image.mediaType === 'VIDEO'}
            className={`w-full ${
              image.mediaType === 'VIDEO'
                ? 'aspect-[0.84] object-contain bg-[var(--ember-charcoal)]'
                : 'aspect-[0.84] object-cover bg-[var(--ember-charcoal)]'
            }`}
          />
        </div>

        <div className="bg-white px-3 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] text-center sm:px-0 sm:pt-4 sm:pb-0">
          <h1 className="break-words text-[1.55rem] font-semibold leading-[1.02] tracking-[-0.045em] text-[var(--ember-text)] [overflow-wrap:anywhere] sm:text-[2.4rem]">
            {emberTitle}
          </h1>

            <div className="mx-auto mt-4 grid w-full grid-cols-4 justify-items-center gap-2 sm:mt-5 sm:max-w-3xl sm:gap-5">
              <ActionButton
                icon={<GeminiIcon className="h-full w-full" />}
                label="ask"
                onClick={() => {
                  setAskChatExpanded(true);
                  setActivePanel('ask');
                }}
              />
              <ActionButton
                icon={<PlayIcon className="h-full w-full" />}
                label="play"
                onClick={() => setActivePanel('play')}
              />
              <ActionButton
                icon={<CircleIcon className="h-full w-full" />}
                label="tend"
                onClick={() => {
                  setShapeView('menu');
                  setActivePanel('shape');
                }}
              />
              <ActionButton
                icon={<ShareIcon className="h-full w-full" />}
                label="share"
                onClick={() => setActivePanel('share')}
              />
          </div>

          {(actionNotice || shareError) && (
            <div className={`mt-2 text-sm ${shareError ? 'text-rose-600' : 'text-[var(--ember-muted)]'}`}>
              {shareError || actionNotice}
            </div>
          )}
        </div>

        {showSetupCards && (
          <section className="mt-4 rounded-[1.6rem] bg-white px-0 pb-2 sm:mt-5">
            <div className="flex items-center justify-between gap-3 px-3 sm:px-4">
              <h2 className="text-center text-[1.15rem] font-semibold tracking-[-0.03em] text-[var(--ember-text)]">
                User, lets complete these cards...
              </h2>
              {setupRequested && !fromUpload && (
                <button
                  type="button"
                  onClick={handleHideSetupCards}
                  className="rounded-full border border-[var(--ember-line-strong)] px-3 py-1.5 text-xs font-medium text-[var(--ember-muted)] hover:border-[rgba(255,102,33,0.24)] hover:text-[var(--ember-text)]"
                >
                  Hide
                </button>
              )}
            </div>

            <div className="mt-3 flex snap-x gap-3 overflow-x-auto px-3 pb-3 sm:px-4">
              {setupCards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={card.onClick}
                  className={`min-w-[12.5rem] snap-start rounded-[1.45rem] border px-4 py-4 text-left shadow-[0_12px_28px_rgba(17,17,17,0.06)] transition ${
                    card.selected
                      ? 'border-[rgba(41,98,255,0.3)] bg-[#2962ff] text-white'
                      : 'border-[rgba(20,20,20,0.08)] bg-white text-[var(--ember-text)] hover:border-[rgba(255,102,33,0.2)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className={`text-sm font-semibold ${card.selected ? 'text-white' : 'text-[var(--ember-text)]'}`}>
                      {card.title}
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                        card.selected
                          ? 'bg-white/18 text-white'
                          : card.status === 'Done'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-[var(--ember-soft)] text-[var(--ember-muted)]'
                      }`}
                    >
                      {card.status}
                    </span>
                  </div>
                  <p className={`mt-3 text-sm leading-6 ${card.selected ? 'text-white/86' : 'text-[var(--ember-muted)]'}`}>
                    {card.subtitle}
                  </p>
                </button>
              ))}
            </div>
          </section>
        )}
      </section>

      {activePanel === 'ask' && (
        <div className="fixed inset-0 z-50" onClick={closePanel}>
            <div className="flex min-h-full w-full items-stretch justify-center">
              <div
                className="flex h-screen w-full max-w-none flex-col overflow-hidden bg-transparent text-white"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="relative min-h-screen flex-1 overflow-hidden bg-transparent">
                  <MediaPreview
                    mediaType={image.mediaType}
                    filename={image.filename}
                    posterFilename={image.posterFilename}
                    originalName={emberTitle}
                    usePosterForVideo
                    controls={image.mediaType === 'VIDEO'}
                    className="h-full w-full object-contain bg-transparent"
                  />
                <FloatingCloseButton label="Close Ask Ember" onClick={closePanel} />

                <div
                  className={`pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 via-black/30 to-transparent px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:px-5 ${
                    askChatExpanded ? 'pt-[8vh] sm:pt-[10vh]' : 'pt-[52vh] sm:pt-[58vh]'
                  }`}
                >
                  <div className="pointer-events-auto mx-auto mb-3 flex max-w-3xl items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setAskChatExpanded((value) => !value)}
                      className="inline-flex items-center rounded-full border border-white/16 bg-[rgba(12,12,12,0.5)] px-4 py-2 text-sm font-medium text-white shadow-[0_12px_28px_rgba(0,0,0,0.22)] transition hover:border-[rgba(255,102,33,0.3)] hover:text-[var(--ember-orange)]"
                    >
                      {askChatExpanded ? 'Collapse chat' : 'Expand chat'}
                    </button>
                    <button
                      type="button"
                      onClick={closePanel}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/16 bg-[rgba(12,12,12,0.5)] text-white shadow-[0_12px_28px_rgba(0,0,0,0.22)]"
                      aria-label="Close Ask Ember"
                    >
                      <CloseIcon />
                    </button>
                  </div>
                  <div
                    className={`pointer-events-auto mx-auto max-w-3xl overflow-hidden rounded-[1.8rem] border border-white/10 bg-[rgba(12,12,12,0.5)] shadow-[0_24px_60px_rgba(0,0,0,0.3)] ${
                      askChatExpanded ? 'h-[82vh] sm:h-[78vh]' : 'h-[48vh] sm:h-[42vh]'
                    }`}
                  >
                    <ChatInterface imageId={image.id} subjectNoun={subjectNoun} variant="overlay" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
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
                        {block.mediaUrl && (
                          <div className="mt-3 overflow-hidden rounded-[1rem]">
                            <MediaPreview
                              mediaType="IMAGE"
                              filename={block.mediaUrl.replace('/api/uploads/', '')}
                              originalName={block.mediaName || 'Supporting media'}
                              className="aspect-[1.3] w-full object-cover bg-[var(--ember-soft)]"
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
        <div className="fixed inset-0 z-50 bg-black" onClick={closePanel}>
          <div className="flex min-h-full w-full items-stretch justify-center">
            <div
              className="flex h-screen w-full max-w-none flex-col overflow-hidden bg-black text-white"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="relative min-h-screen flex-1 overflow-hidden bg-black">
                <MediaPreview
                  mediaType={image.mediaType}
                  filename={image.filename}
                  posterFilename={image.posterFilename}
                  originalName={emberTitle}
                  usePosterForVideo
                  controls={image.mediaType === 'VIDEO'}
                  className="h-full w-full object-contain bg-black"
                />
                <FloatingCloseButton label="Close narration" onClick={closePanel} />

                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/45 to-transparent px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-16 sm:px-5">
                  <div className="pointer-events-auto mx-auto max-w-3xl overflow-hidden rounded-[1.8rem] border border-white/10 bg-[rgba(12,12,12,0.6)] shadow-[0_24px_60px_rgba(0,0,0,0.3)] backdrop-blur-xl">
                    <div className="max-h-[42vh] overflow-y-auto px-4 py-4 sm:max-h-[38vh] sm:px-5 sm:py-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
                            Listen to narration
                          </p>
                          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">
                            Hear the story out loud
                          </h2>
                        </div>
                        <button
                          type="button"
                          onClick={closePanel}
                          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/16 bg-[rgba(12,12,12,0.5)] text-white shadow-[0_12px_28px_rgba(0,0,0,0.22)]"
                          aria-label="Close narration"
                        >
                          <CloseIcon />
                        </button>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-white/72">
                        Choose a voice, listen to the Ember as a story, and read the final narration text below.
                      </p>

                      {image.storyCut && (
                        <div className="mt-6 rounded-[1.6rem] border border-white/10 bg-white/6 px-4 py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
                              Story Cut
                            </div>
                            <span className="rounded-full bg-[rgba(255,102,33,0.16)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[rgb(255,180,150)]">
                              {image.storyCut.style}
                            </span>
                            <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
                              {image.storyCut.durationSeconds}s
                            </span>
                          </div>
                          <h3 className="mt-3 text-lg font-semibold text-white">
                            {image.storyCut.title}
                          </h3>
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-white/88">
                            {image.storyCut.script}
                          </p>
                          <button
                            type="button"
                            onClick={() => void handlePlayStoryCut(image.storyCut)}
                            className="mt-5 inline-flex min-h-[3.1rem] w-full items-center justify-center rounded-full border border-white/12 bg-white/10 px-5 py-3 text-base font-semibold text-white transition hover:bg-white/14"
                          >
                            {storyCutPlaybackState === 'loading'
                              ? 'Preparing Story Cut...'
                              : storyCutPlaybackState === 'playing'
                                ? 'Stop Story Cut'
                                : 'Play Story Cut'}
                          </button>
                          {storyCutPlaybackError && (
                            <div className="mt-3 text-sm text-rose-200">{storyCutPlaybackError}</div>
                          )}
                        </div>
                      )}

                      <div className="mt-5 flex flex-wrap gap-2">
                        {(['female', 'male'] as NarrationPreference[]).map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setVoicePreference(option)}
                            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                              voicePreference === option
                                ? 'border-[var(--ember-orange)] bg-[rgba(255,102,33,0.14)] text-[var(--ember-orange)]'
                                : 'border-white/16 text-white/78'
                            }`}
                          >
                            {option === 'female' ? 'Female voice' : 'Male voice'}
                          </button>
                        ))}
                      </div>

                      {narrationError && (
                        <div className="mt-5 rounded-[1.2rem] border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                          {narrationError}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => void handleNarrationToggle()}
                        disabled={!image.wiki?.content}
                        className="mt-6 inline-flex min-h-[3.4rem] w-full items-center justify-center rounded-full bg-[var(--ember-orange)] px-5 py-3 text-base font-semibold text-white transition hover:bg-[var(--ember-orange-deep)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {narrationState === 'loading'
                          ? 'Generating narration...'
                          : narrationState === 'playing'
                            ? 'Stop narration'
                            : 'Listen to narration'}
                      </button>

                      {!image.wiki?.content && (
                        <p className="mt-3 text-sm text-white/55">
                          Generate the story on this page first.
                        </p>
                      )}

                      {narrationScript && (
                        <div className="mt-6 rounded-[1.6rem] border border-white/10 bg-white/6 px-4 py-4">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
                            Narration text
                          </div>
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-white/88">
                            {narrationScript}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <EmberSheet
        open={activePanel === 'contributors'}
        title="Contributors"
        subtitle="Review, invite, and manage the people connected to this memory."
        onClose={closePanel}
      >
        {image.canManage ? (
          <ContributorList
            imageId={image.id}
            ownerUserId={image.owner.id}
            contributors={image.contributors}
            friends={image.friends}
            onUpdate={fetchImage}
          />
        ) : (
            <div className="ember-panel rounded-[2rem] p-5">
              <div className="space-y-4">
              {image.viewerCanLeave && (
                <div className="rounded-[1.5rem] border border-[rgba(255,102,33,0.18)] bg-[rgba(255,102,33,0.04)] px-4 py-4">
                  <div className="text-sm leading-7 text-[var(--ember-text)]">
                    You are connected to this Ember as a contributor. If you no longer want to be part of it, you can remove yourself here.
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleLeaveEmber()}
                    disabled={leavingEmber}
                    className="ember-button-secondary mt-4 justify-center text-rose-700 disabled:opacity-60"
                  >
                    {leavingEmber ? 'Leaving...' : 'Leave Ember'}
                  </button>
                </div>
              )}
              {image.contributors.length === 0 ? (
                <p className="text-sm text-[var(--ember-muted)]">
                  No contributors have been added yet.
                </p>
              ) : (
                image.contributors.map((contributor) => {
                  const contributorLabel =
                    contributor.name ||
                    contributor.user?.name ||
                    contributor.email ||
                    contributor.phoneNumber ||
                    'Contributor';

                  return (
                    <div key={contributor.id} className="ember-card rounded-[1.5rem] px-4 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-semibold text-[var(--ember-text)]">{contributorLabel}</div>
                        {contributor.userId === image.currentUserId && (
                          <span className="ember-chip text-[var(--ember-orange-deep)]">You</span>
                        )}
                      </div>
                      {(contributor.email || contributor.phoneNumber) && (
                        <div className="mt-1 text-sm text-[var(--ember-muted)]">
                          {contributor.email || contributor.phoneNumber}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </EmberSheet>

      {activePanel === 'shape' && shapeView === 'menu' && (
        <div className="fixed inset-0 z-50" onClick={closePanel}>
          <div className="flex min-h-full w-full items-stretch justify-center">
            <div
              className="flex h-screen w-full max-w-none flex-col overflow-hidden bg-transparent text-white"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="relative min-h-screen flex-1 overflow-hidden bg-transparent">
                <MediaPreview
                  mediaType={image.mediaType}
                  filename={image.filename}
                  posterFilename={image.posterFilename}
                  originalName={emberTitle}
                  usePosterForVideo
                  controls={image.mediaType === 'VIDEO'}
                  className="h-full w-full object-contain bg-transparent"
                />
                <FloatingCloseButton label="Close Tend Ember" onClick={closePanel} />

                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 via-black/22 to-transparent px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-24 sm:px-5">
                  <div className="pointer-events-auto mx-auto max-w-lg rounded-[2rem] border border-white/70 bg-[rgba(255,255,255,0.96)] p-4 shadow-[0_24px_64px_rgba(17,17,17,0.22)]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="ember-eyebrow">Tend Ember</p>
                        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--ember-text)]">
                          Choose a tool
                        </h2>
                      </div>
                      <button
                        type="button"
                        onClick={closePanel}
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--ember-line)] bg-white text-[var(--ember-text)] shadow-[0_12px_28px_rgba(17,17,17,0.12)]"
                        aria-label="Close Tend Ember"
                      >
                        <CloseIcon />
                      </button>
                    </div>

                    <div className="mt-5 grid gap-3">
                      {image.canManage && (
                        <button
                          type="button"
                          onClick={handleOpenSetupCards}
                          className="rounded-[1.5rem] border border-[rgba(20,20,20,0.08)] bg-white px-5 py-4 text-left transition hover:border-[rgba(255,102,33,0.24)]"
                        >
                          <div className="text-lg font-semibold text-[var(--ember-text)]">Complete Setup</div>
                        </button>
                      )}
                      {image.canManage && (
                        <button
                          type="button"
                          onClick={() => openTendView('addContent')}
                          className="rounded-[1.5rem] border border-[rgba(20,20,20,0.08)] bg-white px-5 py-4 text-left transition hover:border-[rgba(255,102,33,0.24)]"
                        >
                          <div className="text-lg font-semibold text-[var(--ember-text)]">Add Content</div>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          closePanel();
                          router.push(`/image/${image.id}/wiki`);
                        }}
                        className="rounded-[1.5rem] border border-[rgba(20,20,20,0.08)] bg-white px-5 py-4 text-left transition hover:border-[rgba(255,102,33,0.24)]"
                      >
                        <div className="text-lg font-semibold text-[var(--ember-text)]">View Wiki</div>
                      </button>
                      {image.canManage && (
                        <button
                          type="button"
                          onClick={() => openTendView('editTitle')}
                          className="rounded-[1.5rem] border border-[rgba(20,20,20,0.08)] bg-white px-5 py-4 text-left transition hover:border-[rgba(255,102,33,0.24)]"
                        >
                          <div className="text-lg font-semibold text-[var(--ember-text)]">Edit Title</div>
                        </button>
                      )}
                      {image.canManage && (
                        <button
                          type="button"
                          onClick={() => openTendView('editCaption')}
                          className="rounded-[1.5rem] border border-[rgba(20,20,20,0.08)] bg-white px-5 py-4 text-left transition hover:border-[rgba(255,102,33,0.24)]"
                        >
                          <div className="text-lg font-semibold text-[var(--ember-text)]">Edit Caption</div>
                        </button>
                      )}
                      {image.canManage && (
                        <button
                          type="button"
                          onClick={() => openTendView('tag')}
                          className="rounded-[1.5rem] border border-[rgba(20,20,20,0.08)] bg-white px-5 py-4 text-left transition hover:border-[rgba(255,102,33,0.24)]"
                        >
                          <div className="text-lg font-semibold text-[var(--ember-text)]">Tag People</div>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleOpenContributors}
                        className="rounded-[1.5rem] border border-[rgba(20,20,20,0.08)] bg-white px-5 py-4 text-left transition hover:border-[rgba(255,102,33,0.24)]"
                      >
                        <div className="text-lg font-semibold text-[var(--ember-text)]">Add Contributors</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => openTendView('activity')}
                        className="rounded-[1.5rem] border border-[rgba(20,20,20,0.08)] bg-white px-5 py-4 text-left transition hover:border-[rgba(255,102,33,0.24)]"
                      >
                        <div className="text-lg font-semibold text-[var(--ember-text)]">View Activity</div>
                      </button>
                      {image.canManage && (
                        <button
                          type="button"
                          onClick={() => void handleDeleteEmber()}
                          disabled={deletingEmber}
                          className="rounded-[1.5rem] border border-[rgba(244,63,94,0.2)] bg-white px-5 py-4 text-left transition hover:border-[rgba(244,63,94,0.34)] disabled:opacity-60"
                        >
                          <div className="text-lg font-semibold text-rose-700">
                            {deletingEmber ? 'Deleting...' : 'Delete Ember'}
                          </div>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <EmberSheet
        open={activePanel === 'shape' && shapeView !== 'menu'}
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
              <div className="ember-panel rounded-[2rem] p-6">
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
                  <div className="mt-5 rounded-[1.5rem] border border-[var(--ember-line)] bg-white px-4 py-8 text-center text-sm text-[var(--ember-muted)]">
                    Loading the next Story Circle prompt...
                  </div>
                ) : (
                  <>
                    <div className="mt-5 rounded-[1.5rem] border border-[rgba(168,85,247,0.16)] bg-[rgba(168,85,247,0.08)] px-4 py-4">
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
                        className="ember-button-primary disabled:opacity-60"
                      >
                        {savingStoryCircle ? 'Saving response...' : 'Submit Response'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void loadStoryCircle()}
                        className="ember-button-secondary"
                      >
                        Refresh question
                      </button>
                    </div>
                  </>
                )}
              </div>

              <div className="ember-panel rounded-[2rem] p-6">
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
                    className="ember-button-primary disabled:opacity-60"
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
                  <div className="mt-5 rounded-[1.5rem] border border-[var(--ember-line)] bg-white px-4 py-4">
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
                <div className="ember-panel rounded-[2rem] p-6">
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
                <div className="ember-panel rounded-[2rem] p-6">
                  <p className="ember-eyebrow">Add more to the memory</p>
                  <h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-[var(--ember-text)]">
                    Keep telling the story
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--ember-muted)]">
                    Add more context by text or phone, then attach additional photos and videos below.
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
            <div className="ember-panel rounded-[2rem] p-6">
              <div className="text-sm leading-7 text-[var(--ember-muted)]">
                Pick the best name for this memory. Use one of Ember&apos;s suggestions or write your own.
              </div>
              <div className="mt-5 space-y-3">
                {loadingTitleSuggestions && titleSuggestions.length === 0 ? (
                  <div className="rounded-[1.5rem] border border-[var(--ember-line)] bg-white px-4 py-8 text-center text-sm text-[var(--ember-muted)]">
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
                  className="ember-button-secondary disabled:opacity-60"
                >
                  {loadingTitleSuggestions ? 'Letting Ember try...' : 'Let Ember Try'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveImageDetails({ title: titleDraft.trim() || null })}
                  disabled={savingDetails || !titleDraft.trim()}
                  className="ember-button-primary disabled:opacity-60"
                >
                  {savingDetails ? 'Saving...' : 'Save title'}
                </button>
              </div>
            </div>
          )}

          {shapeView === 'editCaption' && (
            <div className="ember-panel rounded-[2rem] p-6">
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
                  className="ember-button-primary disabled:opacity-60"
                >
                  {savingDetails ? 'Saving...' : 'Save caption'}
                </button>
              </div>
            </div>
          )}

          {shapeView === 'location' && (
            <div className="ember-panel rounded-[2rem] p-6">
              <div className="text-sm leading-7 text-[var(--ember-muted)]">
                GPS location data extracted from your photos. You can also type a manual location if needed.
              </div>

              <div className="mt-5 space-y-3">
                {loadingLocationSuggestions ? (
                  <div className="rounded-[1.5rem] border border-[var(--ember-line)] bg-white px-4 py-8 text-center text-sm text-[var(--ember-muted)]">
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
                  <div className="rounded-[1.5rem] border border-dashed border-[var(--ember-line-strong)] bg-white px-4 py-8 text-center text-sm text-[var(--ember-muted)]">
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
                  className="ember-button-primary w-full justify-center disabled:opacity-60"
                >
                  {savingLocation ? 'Saving location...' : 'Save Location'}
                </button>
              </div>
            </div>
          )}

          {shapeView === 'timeDate' && (
            <div className="ember-panel rounded-[2rem] p-6">
              <div className="text-sm leading-7 text-[var(--ember-muted)]">
                Timestamp data extracted from your photos.
              </div>

              {image.analysis?.capturedAt ? (
                <div className="mt-5 rounded-[1.6rem] border border-[rgba(255,158,36,0.25)] bg-[rgba(255,158,36,0.06)] px-4 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ember-orange-deep)]">
                    Photo Timestamp
                  </div>
                  <div className="mt-3 text-base font-semibold text-[var(--ember-text)]">
                    {new Date(image.analysis.capturedAt).toLocaleString()}
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-[1.6rem] border border-dashed border-[var(--ember-line-strong)] bg-white px-4 py-8 text-center text-sm text-[var(--ember-muted)]">
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
                  className="ember-button-primary w-full justify-center disabled:opacity-60"
                >
                  {savingCapturedAt ? 'Saving date & time...' : 'Save Date & Time'}
                </button>
              </div>
            </div>
          )}

          {shapeView === 'analysis' && (
            <div className="ember-panel rounded-[2rem] p-6">
              <div className="rounded-[1.6rem] border border-[rgba(168,85,247,0.16)] bg-[rgba(168,85,247,0.08)] px-5 py-5">
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
                  className="ember-button-primary mt-5 disabled:opacity-60"
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

      <EmberSheet
        open={activePanel === 'share'}
        title="Share Ember"
        subtitle="Share this Ember outward or into your Ember network."
        onClose={closePanel}
      >
        <div className="space-y-4">
          {image.canManage && (
            <div className="ember-panel rounded-[2rem] p-5">
              <p className="ember-eyebrow">Ember network</p>
              <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-lg font-semibold text-[var(--ember-text)]">Share to Ember feed</div>
                  <p className="mt-2 text-sm text-[var(--ember-muted)]">
                    Let accepted friends see this Ember in their feed.
                  </p>
                </div>

                <label className="inline-flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={shareToNetwork}
                    onChange={(event) => setShareToNetwork(event.target.checked)}
                    className="h-4 w-4 rounded border-[var(--ember-line-strong)] text-[var(--ember-orange)]"
                  />
                  <span className="text-sm font-medium text-[var(--ember-text)]">Share to network</span>
                </label>
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={handleShareSave}
                  disabled={savingShareState || shareToNetwork === image.shareToNetwork}
                  className="ember-button-primary disabled:opacity-60"
                >
                  {savingShareState ? 'Saving...' : 'Save network sharing'}
                </button>
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['facebook', 'Facebook', 'Open Facebook share composer for this Ember.'],
              ['x', 'X', 'Open an X post draft with this Ember link.'],
              ['instagram', 'Instagram', 'Copy the Ember link so you can paste it into Instagram.'],
              ['tiktok', 'TikTok', 'Copy the Ember link so you can use it in TikTok.'],
              ['email', 'Email', 'Open a new email draft with this Ember link.'],
              ['copy', 'Copy link', 'Copy a direct link to this Ember.'],
            ].map(([key, title, copy]) => (
              <button
                key={key}
                type="button"
                onClick={() =>
                  void handleShareAction(
                    key as 'facebook' | 'x' | 'email' | 'instagram' | 'tiktok' | 'copy'
                  )
                }
                className="ember-card rounded-[1.6rem] px-5 py-5 text-left transition hover:border-[rgba(255,102,33,0.24)]"
              >
                <div className="text-lg font-semibold text-[var(--ember-text)]">{title}</div>
                <p className="mt-2 text-sm text-[var(--ember-muted)]">{copy}</p>
              </button>
            ))}
          </div>
        </div>
      </EmberSheet>

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
