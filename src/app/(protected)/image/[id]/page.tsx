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

type ActivePanel = 'ask' | 'contributors' | 'shape' | 'share' | 'play' | null;
type ShapeView =
  | 'menu'
  | 'tag'
  | 'addContent'
  | 'editTitle'
  | 'editCaption'
  | 'activity';

function GeminiIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 256 256" fill="currentColor" className={className}>
      <path d="M128 16C137 74 182 119 240 128C182 137 137 182 128 240C119 182 74 137 16 128C74 119 119 74 128 16Z" />
    </svg>
  );
}

function PlayIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="m8 5.75 10 6.25L8 18.25V5.75Z" />
    </svg>
  );
}

function CircleIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <circle cx="12" cy="12" r="7.25" />
    </svg>
  );
}

function ShareIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="18" cy="5" r="3" fill="currentColor" stroke="none" />
      <circle cx="6" cy="12" r="3" fill="currentColor" stroke="none" />
      <circle cx="18" cy="19" r="3" fill="currentColor" stroke="none" />
      <line x1="8.6" y1="10.7" x2="15.4" y2="6.3" />
      <line x1="8.6" y1="13.3" x2="15.4" y2="17.7" />
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
    'flex flex-col items-center gap-1 rounded-[0.85rem] bg-transparent px-1 py-0.5 text-center text-[var(--ember-text)] transition hover:text-[var(--ember-text)]';

  const content = (
    <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(20,20,20,0.34)] bg-white text-[var(--ember-text)] sm:h-14 sm:w-14">
      {icon}
    </span>
  );

  return (
    <button type="button" onClick={onClick} className={className} aria-label={label}>
      {content}
      <span className="text-[0.82rem] font-medium lowercase tracking-[-0.02em] text-[var(--ember-text)] sm:text-[0.95rem]">
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
  const [titleDraft, setTitleDraft] = useState('');
  const [captionDraft, setCaptionDraft] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);
  const [narrationState, setNarrationState] = useState<'idle' | 'loading' | 'playing'>('idle');
  const [narrationError, setNarrationError] = useState('');
  const [narrationScript, setNarrationScript] = useState('');
  const [voicePreference, setVoicePreference] = useState<NarrationPreference>('female');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const fromUpload = searchParams.get('fromUpload') === '1';
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
    if (requestedPanel === 'ask' || requestedPanel === 'contributors' || requestedPanel === 'shape' || requestedPanel === 'share') {
      if (requestedPanel === 'ask') {
        setAskChatExpanded(true);
      }
      setActivePanel(requestedPanel);

      if (requestedPanel === 'shape') {
        if (
          requestedShapeView === 'tag' ||
          requestedShapeView === 'addContent' ||
          requestedShapeView === 'editTitle' ||
          requestedShapeView === 'editCaption' ||
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

    setAskChatExpanded(true);
    setTendTagPromptOpen(false);
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

  const openTendView = (view: ShapeView) => {
    setShapeView(view);
    setActivePanel('shape');
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
      setShapeView('menu');
    } catch (detailsError) {
      setShareError(
        detailsError instanceof Error ? detailsError.message : 'Failed to update this Ember.'
      );
    } finally {
      setSavingDetails(false);
    }
  };

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

  const handleAutoTagDismiss = () => {
    setAutoTagPromptDismissed(true);
  };

  const handleManualTagFromPrompt = () => {
    setAutoTagPromptDismissed(true);
    setShapeView('tag');
    setActivePanel('shape');
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
    setShapeView('tag');
    setActivePanel('shape');
    setActionNotice(
      labels.length > 0
        ? `Auto-tagged ${labels.join(labels.length === 2 ? ' and ' : ', ')}. Add any remaining tags, then close when you are ready to continue.`
        : 'Auto-tagged familiar faces. Add any remaining tags, then close when you are ready to continue.'
    );
  };

  const handleLocationPromptDismiss = () => {
    setLocationPromptDismissed(true);
    if (fromUpload) {
      router.replace(`/image/${image.id}`);
    }
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

  return (
    <div className="mx-auto max-w-5xl px-3 pt-3 pb-28 sm:px-4 sm:pt-4 sm:pb-10">
      <section className="mx-auto w-full max-w-none">
        <div className="overflow-hidden rounded-[1.05rem] border border-[rgba(20,20,20,0.08)] bg-white shadow-[0_18px_42px_rgba(17,17,17,0.08)] sm:rounded-[2.1rem]">
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

          <div className="mt-3 grid grid-cols-4 gap-1 sm:mt-3 sm:max-w-xl sm:gap-2">
            <ActionButton
              icon={<GeminiIcon className="h-7 w-7" />}
              label="ask"
              onClick={() => {
                setAskChatExpanded(true);
                setActivePanel('ask');
              }}
            />
            <ActionButton
              icon={<PlayIcon className="h-7 w-7" />}
              label="play"
              onClick={() => setActivePanel('play')}
            />
            <ActionButton
              icon={<CircleIcon className="h-7 w-7" />}
              label="tend"
              onClick={() => {
                setShapeView('menu');
                setActivePanel('shape');
              }}
            />
            <ActionButton
              icon={<ShareIcon className="h-5 w-5 sm:h-6 sm:w-6" />}
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
                <button
                  type="button"
                  onClick={closePanel}
                  className="absolute right-4 top-[max(env(safe-area-inset-top),1rem)] inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/92 text-[var(--ember-text)] shadow-[0_10px_24px_rgba(17,17,17,0.18)]"
                  aria-label="Close Ask Ember"
                >
                  <CloseIcon />
                </button>

                <div
                  className={`pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 via-black/30 to-transparent px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:px-5 ${
                    askChatExpanded ? 'pt-[8vh] sm:pt-[10vh]' : 'pt-[52vh] sm:pt-[58vh]'
                  }`}
                >
                  <div className="pointer-events-auto mx-auto mb-3 flex max-w-3xl justify-end">
                    <button
                      type="button"
                      onClick={() => setAskChatExpanded((value) => !value)}
                      className="inline-flex items-center rounded-full border border-white/16 bg-[rgba(12,12,12,0.5)] px-4 py-2 text-sm font-medium text-white shadow-[0_12px_28px_rgba(0,0,0,0.22)] transition hover:border-[rgba(255,102,33,0.3)] hover:text-[var(--ember-orange)]"
                    >
                      {askChatExpanded ? 'Collapse chat' : 'Expand chat'}
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
                <button
                  type="button"
                  onClick={closePanel}
                  className="absolute right-4 top-[max(env(safe-area-inset-top),1rem)] inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/92 text-[var(--ember-text)] shadow-[0_10px_24px_rgba(17,17,17,0.18)]"
                  aria-label="Close narration"
                >
                  <CloseIcon />
                </button>

                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/45 to-transparent px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-16 sm:px-5">
                  <div className="pointer-events-auto mx-auto max-w-3xl overflow-hidden rounded-[1.8rem] border border-white/10 bg-[rgba(12,12,12,0.6)] shadow-[0_24px_60px_rgba(0,0,0,0.3)] backdrop-blur-xl">
                    <div className="max-h-[42vh] overflow-y-auto px-4 py-4 sm:max-h-[38vh] sm:px-5 sm:py-5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
                        Listen to narration
                      </p>
                      <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">
                        Hear the story out loud
                      </h2>
                      <p className="mt-3 text-sm leading-7 text-white/72">
                        Choose a voice, listen to the Ember as a story, and read the final narration text below.
                      </p>

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
                <button
                  type="button"
                  onClick={closePanel}
                  className="absolute right-4 top-[max(env(safe-area-inset-top),1rem)] inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/92 text-[var(--ember-text)] shadow-[0_10px_24px_rgba(17,17,17,0.18)]"
                  aria-label="Close Tend Ember"
                >
                  <CloseIcon />
                </button>

                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 via-black/22 to-transparent px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-24 sm:px-5">
                  <div className="pointer-events-auto mx-auto max-w-lg rounded-[2rem] border border-white/70 bg-[rgba(255,255,255,0.96)] p-4 shadow-[0_24px_64px_rgba(17,17,17,0.22)]">
                    <p className="ember-eyebrow">Tend Ember</p>
                    <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--ember-text)]">
                      Choose a tool
                    </h2>

                    <div className="mt-5 grid gap-3">
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
          shapeView === 'tag'
            ? 'Tag People'
            : shapeView === 'addContent'
              ? 'Add Content'
              : shapeView === 'editTitle'
                ? 'Edit Title'
                : shapeView === 'editCaption'
                  ? 'Edit Caption'
                  : 'Ember Activity'
        }
        subtitle={
          shapeView === 'tag'
            ? 'Pin people to the image, review tags, and run familiar-face matching.'
            : shapeView === 'addContent'
              ? 'Attach additional photos or videos to this Ember.'
              : shapeView === 'editTitle'
                ? 'Refine the generated title for this Ember.'
                : shapeView === 'editCaption'
                  ? 'Add or update a caption for this Ember.'
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
            Back to Tend Ember
          </button>

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
                Ember generated this title from the current memory. You can refine it here.
              </div>
              <label className="mt-5 block text-sm font-medium text-[var(--ember-text)]">
                <div className="mb-2">Title</div>
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
