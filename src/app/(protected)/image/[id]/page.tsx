'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ChatInterface from '@/components/ChatInterface';
import ContributorList from '@/components/ContributorList';
import TagManager from '@/components/TagManager';
import InteractiveImageTagger from '@/components/InteractiveImageTagger';
import AutoTagPrompt from '@/components/AutoTagPrompt';
import LocationSuggestionPrompt from '@/components/LocationSuggestionPrompt';
import MemoryTellMoreActions from '@/components/MemoryTellMoreActions';
import WikiView from '@/components/WikiView';
import { getEmberTitle } from '@/lib/ember-title';
import MediaPreview from '@/components/MediaPreview';
import { getPreviewMediaUrl } from '@/lib/media';
import ImageAttachmentGallery from '@/components/ImageAttachmentGallery';

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

type ActivePanel = 'ask' | 'contributors' | 'shape' | 'share' | null;
type ShapeView = 'menu' | 'tag';

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

function PersonIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M12 12.25a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" />
      <path d="M5 19.25c1.35-2.8 3.78-4.25 7-4.25s5.65 1.45 7 4.25" />
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

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ember-muted)]">
        {label}
      </div>
      <div className="mt-2 break-words text-sm leading-6 text-[var(--ember-text)]">
        {value}
      </div>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  href,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
}) {
  const className =
    'flex min-h-[5rem] items-center justify-center rounded-[1.6rem] bg-transparent px-3 py-3 text-center text-[var(--ember-orange)] transition hover:text-[var(--ember-orange-deep)]';

  const content = (
    <span className="flex h-14 w-14 items-center justify-center rounded-full">
      {icon}
    </span>
  );

  if (href) {
    return (
      <Link href={href} className={className} aria-label={label}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className} aria-label={label}>
      {content}
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
  const [generatingWiki, setGeneratingWiki] = useState(false);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [shapeView, setShapeView] = useState<ShapeView>('menu');
  const [deletingEmber, setDeletingEmber] = useState(false);
  const [autoTagPromptDismissed, setAutoTagPromptDismissed] = useState(false);
  const [locationPromptDismissed, setLocationPromptDismissed] = useState(false);
  const [leavingEmber, setLeavingEmber] = useState(false);
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
    void router.prefetch('/feed');
  }, [router]);

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
      setActivePanel(requestedPanel);

      if (requestedPanel === 'shape') {
        setShapeView(requestedShapeView === 'tag' ? 'tag' : 'menu');
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

  const focusStorySection = () => {
    if (typeof document === 'undefined') {
      return;
    }

    window.setTimeout(() => {
      document.getElementById('ember-story')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 160);
  };

  const handleOpenAttachmentPicker = () => {
    closePanel();
    window.dispatchEvent(new CustomEvent('ember:open-attachment-picker'));
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

  const handleGenerateWiki = async () => {
    if (!image || generatingWiki) {
      return;
    }

    const imageId = image.id;
    setGeneratingWiki(true);
    setShareError('');

    try {
      const response = await fetch(`/api/wiki/${imageId}`, {
        method: 'POST',
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to regenerate the memory story.');
      }

      await fetchImage();
      setActionNotice('Memory story updated.');
      focusStorySection();
    } catch (wikiError) {
      setShareError(
        wikiError instanceof Error
          ? wikiError.message
          : 'Failed to regenerate the memory story.'
      );
    } finally {
      setGeneratingWiki(false);
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
  const ownerConversationTarget = image.ownerConversationTarget;
  const autoTagStepComplete =
    autoTagPromptDismissed || !fromUpload || !image.canManage || image.tags.length > 0;

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

  const handleManualTagComplete = async () => {
    await fetchImage();
    closePanel();
    focusStorySection();
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 pb-28 sm:px-6 sm:pb-10">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/feed" className="text-sm font-medium text-[var(--ember-muted)] hover:text-[var(--ember-text)]">
          {'<- Back to feed'}
        </Link>
        {(actionNotice || shareError) && (
          <div className={`text-sm ${shareError ? 'text-rose-600' : 'text-[var(--ember-muted)]'}`}>
            {shareError || actionNotice}
          </div>
        )}
      </div>

      <section className="space-y-6">
        <div className="overflow-hidden rounded-[2.3rem] border border-white/90 bg-white shadow-[0_18px_42px_rgba(17,17,17,0.08)]">
          <MediaPreview
            mediaType={image.mediaType}
            filename={image.filename}
            posterFilename={image.posterFilename}
            originalName={emberTitle}
            controls={image.mediaType === 'VIDEO'}
            className="max-h-[44rem] w-full object-contain bg-[var(--ember-charcoal)]"
          />
        </div>

        <div>
          <h1 className="ember-heading break-all text-2xl leading-tight text-[var(--ember-text)] sm:break-words sm:text-4xl sm:[overflow-wrap:anywhere]">
            {emberTitle}
          </h1>
        </div>

        <div className="grid grid-cols-5 gap-3">
          <ActionButton
            icon={<GeminiIcon className="h-7 w-7" />}
            label="Ask Ember"
            onClick={() => setActivePanel('ask')}
          />
          <ActionButton
            icon={<PlayIcon className="h-7 w-7" />}
            label="Play Ember"
            href={`/image/${image.id}/play`}
          />
          <ActionButton
            icon={<PersonIcon className="h-7 w-7" />}
            label="Contributors"
            onClick={() => setActivePanel('contributors')}
          />
          <ActionButton
            icon={<CircleIcon className="h-7 w-7" />}
            label="Tend Ember"
            onClick={() => {
              setShapeView('menu');
              setActivePanel('shape');
            }}
          />
          <ActionButton
            icon={<ShareIcon className="h-7 w-7" />}
            label="Share Ember"
            onClick={() => setActivePanel('share')}
          />
        </div>

        {image.canManage && ownerConversationTarget && (
          <div className="ember-panel rounded-[2rem] p-5 sm:p-6">
            <p className="ember-eyebrow">Tell more</p>
            <h2 className="ember-heading mt-3 text-2xl text-[var(--ember-text)]">
              Add more to this memory
            </h2>
            <p className="ember-copy mt-2 text-sm">
              Type with Ember or have it call you so this Ember can keep growing.
            </p>
            <MemoryTellMoreActions
              className="mt-5"
              contributorToken={ownerConversationTarget.token}
              contributorId={ownerConversationTarget.id}
              phoneAvailable={Boolean(ownerConversationTarget.phoneNumber || ownerConversationTarget.user?.phoneNumber)}
              latestVoiceCall={ownerConversationTarget.voiceCalls[0] || null}
              onRefreshRequested={fetchImage}
            />
          </div>
        )}

        <section id="ember-story" className="ember-panel-strong rounded-[2rem] p-5 sm:p-6">
          {image.wiki ? (
            <div className="min-w-0">
              <WikiView content={image.wiki.content} />
            </div>
          ) : (
            <div className="rounded-[1.8rem] border border-dashed border-[rgba(20,20,20,0.12)] bg-white px-5 py-8">
              <h2 className="ember-heading text-3xl text-[var(--ember-text)]">
                No story yet
              </h2>
              <p className="ember-copy mt-3 max-w-3xl text-sm">
                Ember can turn the current photo, tags, contributor memories, and added content
                into a single story here. Generate it when you are ready.
              </p>
            </div>
          )}

          {image.canManage && (
            <div className="mt-6">
              <button
                type="button"
                onClick={() => void handleGenerateWiki()}
                disabled={generatingWiki}
                className="ember-button-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {generatingWiki
                  ? 'Regenerating...'
                  : image.wiki
                    ? 'Regenerate story'
                    : 'Generate story'}
              </button>
            </div>
          )}
        </section>

        <ImageAttachmentGallery
          imageId={image.id}
          canManage={image.canManage}
          attachments={image.attachments}
          onUpdate={fetchImage}
        />
      </section>

      <EmberSheet
        open={activePanel === 'ask'}
        title="Ask Ember"
        subtitle="Chat with this Ember without leaving the memory."
        onClose={closePanel}
      >
        <ChatInterface imageId={image.id} subjectNoun={subjectNoun} />
      </EmberSheet>

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

      <EmberSheet
        open={activePanel === 'shape'}
        title={shapeView === 'tag' ? 'Tag people' : 'Tend Ember'}
        subtitle={
          shapeView === 'tag'
            ? 'Pin people to the image, review tags, and turn them into contributor invites.'
            : 'Review added content and Tend Ember tools.'
        }
        onClose={closePanel}
      >
        {shapeView === 'menu' ? (
          <div className="space-y-4">
            <div className="ember-panel rounded-[2rem] p-5">
              <p className="ember-eyebrow">Added content</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <DetailBlock
                  label="Story"
                  value={
                    image.wiki
                      ? `Version ${image.wiki.version} updated ${new Date(
                          image.wiki.updatedAt
                        ).toLocaleDateString()}`
                      : 'No story has been generated yet.'
                  }
                />
                <DetailBlock
                  label="Contributor notes"
                  value={`${image.contributors.filter(
                    (contributor) => contributor.conversation?.status === 'completed'
                  ).length} completed memory threads`}
                />
                <DetailBlock label="Tagged people" value={`${image.tags.length} tagged records`} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  closePanel();
                  focusStorySection();
                }}
                className="ember-card rounded-[1.6rem] px-5 py-5 text-left transition hover:border-[rgba(255,102,33,0.24)]"
              >
                <div className="text-lg font-semibold text-[var(--ember-text)]">View story</div>
                <p className="mt-2 text-sm text-[var(--ember-muted)]">
                  Jump back to the main memory story on this page.
                </p>
              </button>

              {image.canManage && (
                <button
                  type="button"
                  onClick={handleOpenAttachmentPicker}
                  className="ember-card rounded-[1.6rem] px-5 py-5 text-left transition hover:border-[rgba(255,102,33,0.24)]"
                >
                  <div className="text-lg font-semibold text-[var(--ember-text)]">Add content</div>
                  <p className="mt-2 text-sm text-[var(--ember-muted)]">
                    Attach more photos or videos to this Ember.
                  </p>
                </button>
              )}

              {image.canManage && (
                <button
                  type="button"
                  onClick={() => setShapeView('tag')}
                  className="ember-card rounded-[1.6rem] px-5 py-5 text-left transition hover:border-[rgba(255,102,33,0.24)]"
                >
                  <div className="text-lg font-semibold text-[var(--ember-text)]">Tag people</div>
                  <p className="mt-2 text-sm text-[var(--ember-muted)]">
                    Add or update tags without cluttering the main screen.
                  </p>
                </button>
              )}

              <Link
                href="/feed"
                className="ember-card rounded-[1.6rem] px-5 py-5 transition hover:border-[rgba(255,102,33,0.24)]"
              >
                <div className="text-lg font-semibold text-[var(--ember-text)]">View feed</div>
                <p className="mt-2 text-sm text-[var(--ember-muted)]">
                  Return to your Ember feed.
                </p>
              </Link>

              {image.canManage && (
                <button
                  type="button"
                  onClick={() => void handleDeleteEmber()}
                  disabled={deletingEmber}
                  className="ember-card rounded-[1.6rem] px-5 py-5 text-left transition hover:border-[rgba(244,63,94,0.28)] disabled:opacity-60"
                >
                  <div className="text-lg font-semibold text-rose-700">
                    {deletingEmber ? 'Deleting...' : 'Delete Ember'}
                  </div>
                  <p className="mt-2 text-sm text-[var(--ember-muted)]">
                    Permanently remove this Ember and its connected records.
                  </p>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <button
              type="button"
              onClick={() => setShapeView('menu')}
              className="rounded-full border border-[var(--ember-line-strong)] px-4 py-2 text-sm font-medium text-[var(--ember-text)] hover:border-[rgba(255,102,33,0.24)]"
            >
              Back to Tend Ember tools
            </button>

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
          </div>
        )}
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
