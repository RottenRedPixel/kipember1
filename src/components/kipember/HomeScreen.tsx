'use client';

import Link from 'next/link';
import {
  ChevronLeft,
  Copy,
  LogOut,
  MapPin,
  Moon,
  MoreHorizontal,
  ScanEye,
  Leaf,
  Link2,
  Mail,
  MessageCircle,
  Share2,
  Sun,
  User,
  X,
} from 'lucide-react';
import EmberModalShell, { EmberMark, type EmberModalSurface } from '@/components/kipember/EmberModalShell';
export type { EmberModalSurface } from '@/components/kipember/EmberModalShell';
import AppHeader from '@/components/kipember/AppHeader';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getPreviewMediaUrl } from '@/lib/media';
import KipemberPlayOverlay from '@/components/kipember/KipemberPlayOverlay';
import KipemberWikiOverlay from '@/components/kipember/KipemberWikiOverlay';
import KipemberAccountOverlay from '@/components/kipember/KipemberAccountOverlay';
import ContributorFlow from '@/components/kipember/workflows/ContributorFlow';
import OwnerFlow from '@/components/kipember/workflows/OwnerFlow';
import type { EmberSummary as BaseEmberSummary } from '@/lib/ember';
import { getEmberTitle } from '@/lib/ember-title';
import { getUserDisplayName } from '@/lib/user-name';

type AuthUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phoneNumber: string | null;
  avatarUrl?: string | null;
};

type EmberSummary = BaseEmberSummary & {
  createdAt: string | Date;
  capturedAt: string | Date | null;
};

type ImageAttachment = {
  id: string;
  filename: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'AUDIO';
  posterFilename: string | null;
  durationSeconds: number | null;
  originalName: string;
  description: string | null;
};

type EmberDetail = EmberSummary & {
  analysis: {
    summary: string | null;
    capturedAt: string | null;
  } | null;
  wiki: {
    content: string;
    version: number;
    updatedAt: string;
  } | null;
  snapshot: {
    script: string | null;
  } | null;
  cropX: number | null;
  cropY: number | null;
  cropWidth: number | null;
  cropHeight: number | null;
};

type CreateEmberResponse = {
  id?: string;
  mediaType?: string;
  warning?: string | null;
  error?: string;
  image?: EmberSummary;
};

type HomeEmberFlow = 'owner' | 'contributor' | null;

function getDefaultHomeEmberFlow(accessType: EmberSummary['accessType'] | undefined): Exclude<HomeEmberFlow, null> {
  return accessType === 'contributor' ? 'contributor' : 'owner';
}

function parseHomeEmberFlow(flow: string | null): HomeEmberFlow {
  switch (flow) {
    case 'owner':
    case 'contributor':
      return flow;
    default:
      return null;
  }
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

function stripExtension(value: string) {
  return value.replace(/\.[^.]+$/, '');
}

function Modal({ children, closeHref, cardStyle }: { children: React.ReactNode; closeHref: string; cardStyle?: React.CSSProperties }) {
  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center pb-24">
      <Link href={closeHref} className="absolute inset-0" />
      <div
        className="relative w-full max-w-sm mx-4 rounded-2xl overflow-hidden"
        style={cardStyle ?? {
          background: 'var(--bg-modal)',
          WebkitBackdropFilter: 'blur(5px)',
          backdropFilter: 'blur(5px)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <Link href={closeHref} className="absolute top-3 right-3 text-white/60 z-10 w-8 h-8 flex items-center justify-center">
          <X size={18} />
        </Link>
        {children}
      </div>
    </div>
  );
}

function SvgItem({
  label,
  href,
  onClick,
  icon: Icon,
}: {
  label: string;
  href?: string;
  onClick?: () => void;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
}) {
  const inner = (
    <div className="flex flex-col items-center gap-1.5">
      <Icon size={28} strokeWidth={1.6} />
      <span className="text-xs text-center leading-tight">{label}</span>
    </div>
  );

  if (href) {
    return href.startsWith('/') ? (
      <Link href={href} className="svg-item">
        {inner}
      </Link>
    ) : (
      <a href={href} className="svg-item" target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noreferrer' : undefined}>
        {inner}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className="svg-item" style={{ cursor: 'pointer' }}>
      {inner}
    </button>
  );
}

function RailBtn({
  icon: Icon,
  label,
  href,
  active,
}: {
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  label: string;
  href: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-colors ${
        active ? 'bg-white/20' : 'hover:bg-white/10 active:bg-white/20'
      }`}
    >
      <div
        className="w-11 h-11 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.40)', WebkitBackdropFilter: 'blur(8px)', backdropFilter: 'blur(8px)' }}
      >
        <Icon size={23} color="var(--text-primary)" strokeWidth={1.8} />
      </div>
      <span className="text-white text-xs font-medium lowercase">{label}</span>
    </Link>
  );
}

// The Ember Modal is the expandable bottom sheet that overlays the ember
// view. It has three positions (closed, position 1 = mini, position 2 =
// full / expanded) and three surfaces inside it (Ember Chat, Ember Voice,
// Ember Call). This file holds the shared types so HomeScreen and the
// workflow components stay in sync.
export type EmberModalPosition = 'closed' | 'position-1' | 'position-2';

function WorkflowSlot({
  flow,
  emberId,
  onConversationStateChange,
  emberModalSurface,
}: {
  flow: HomeEmberFlow;
  emberId: string | null;
  onConversationStateChange: (hasConversation: boolean) => void;
  emberModalSurface: EmberModalSurface;
}) {
  switch (flow) {
    case 'owner':
      return emberId ? (
        <OwnerFlow emberId={emberId} onConversationStateChange={onConversationStateChange} emberModalSurface={emberModalSurface} />
      ) : null;
    case 'contributor':
      return emberId ? (
        <ContributorFlow emberId={emberId} onConversationStateChange={onConversationStateChange} emberModalSurface={emberModalSurface} />
      ) : null;
    default:
      return null;
  }
}

function FacebookIcon() {
  return (
    <svg width={26} height={26} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width={26} height={26} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export default function HomeScreen({
  initialProfile,
  initialEmbers = [],
  initialEmberId,
  initialAvatarUrl,
}: {
  initialProfile?: AuthUser | null;
  initialEmbers?: EmberSummary[];
  initialEmberId?: string;
  initialAvatarUrl?: string | null;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const modal = params.get('m');
  const rawFlow = params.get('ember');
  const view = params.get('view');
  const mode = params.get('mode');
  const step = params.get('step');
  const firstEmber = mode === 'first-ember';

  const [profile, setProfile] = useState<AuthUser | null>(initialProfile ?? null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl ?? initialProfile?.avatarUrl ?? null);
  const [embers, setEmbers] = useState<EmberSummary[]>(initialEmbers);
  const [selectedEmber, setSelectedEmber] = useState<EmberDetail | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadKey, setUploadKey] = useState(0);
  const [createdEmberId, setCreatedEmberId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [storedTheme, setStoredTheme] = useState<string | null>(null);
  const [hasConversationHistory, setHasConversationHistory] = useState(false);
  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [photoOpacity, setPhotoOpacity] = useState(1);
  const [photoFadeMs, setPhotoFadeMs] = useState(900);
  const [photoSwapX, setPhotoSwapX] = useState(0);
  const [photoSwapSettling, setPhotoSwapSettling] = useState(false);
  const [photoIsLandscape, setPhotoIsLandscape] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  const [dragY, setDragY] = useState(0);
  const [swipeSettling, setSwipeSettling] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const swipeWrapperRef = useRef<HTMLDivElement | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipeActiveRef = useRef(false);
  const swipeAxisRef = useRef<'x' | 'y' | null>(null);
  const pendingEntryRef = useRef(0);

  const selectedEmberId = initialEmberId || params.get('id') || embers[0]?.id || null;
  const hasExistingEmbers = embers.length > 0;
  const selectedSummary = embers.find((ember) => ember.id === selectedEmberId) || null;
  const displayEmber = selectedEmber || selectedSummary;
  const defaultChatFlow = getDefaultHomeEmberFlow(displayEmber?.accessType);
  const flow = parseHomeEmberFlow(rawFlow);
  // The Ember Modal is the expandable bottom sheet over the ember view.
  // Position closed = no ?ember= flow; position 1 = sheet visible at ~65%
  // (mini); position 2 = sheet expanded to ~25% (full). The two booleans
  // are derived shortcuts callers reach for most often.
  const emberModalPosition: EmberModalPosition = !flow
    ? 'closed'
    : view === 'full'
      ? 'position-2'
      : 'position-1';
  const emberModalOpen = emberModalPosition !== 'closed';
  const emberModalExpanded = emberModalPosition === 'position-2';
  const rawChatParam = params.get('chat');
  const emberModalSurface: EmberModalSurface =
    rawChatParam === 'voice' ? 'voice' : rawChatParam === 'calls' ? 'calls' : 'chats';
  const railHidden = firstEmber || emberModalOpen || modal === 'share' || modal === 'play';
  // Enable the swipe wrapper when either axis is usable: vertical needs more
  // than one ember in the carousel, horizontal needs at least one attachment
  // beyond the cover photo. The per-axis handlers below still gate on the
  // right condition, so the wrapper only needs to be live for one to work.
  const swipeEnabled =
    !firstEmber && !emberModalOpen && !modal && !step && (embers.length > 1 || attachments.length > 0);
  const title = displayEmber ? getEmberTitle({ title: displayEmber.title, originalName: stripExtension(displayEmber.originalName) }) : 'Beach Day';
  const capturedAt = selectedEmber?.analysis?.capturedAt ?? displayEmber?.capturedAt ?? null;
  const subtitle = displayEmber
    ? capturedAt
      ? new Date(capturedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : 'Date Unknown'
    : '';
  const mediaUrl = displayEmber
      ? getPreviewMediaUrl({
        mediaType: displayEmber.mediaType,
        filename: displayEmber.filename,
        posterFilename: displayEmber.posterFilename,
      })
    : '';

  const allMedia = mediaUrl
    ? [
        { url: mediaUrl },
        ...attachments.map((a) => ({
          url: getPreviewMediaUrl({ mediaType: a.mediaType, filename: a.filename, posterFilename: a.posterFilename }),
        })),
      ]
    : [];
  const currentPhotoUrl = allMedia[photoIndex]?.url ?? mediaUrl;
  const nextPhotoUrl = allMedia.length > 1 ? allMedia[(photoIndex + 1) % allMedia.length]?.url : null;

  const currentEmberIndex = selectedEmberId ? embers.findIndex((i) => i.id === selectedEmberId) : -1;
  const prevEmber = currentEmberIndex > 0 ? embers[currentEmberIndex - 1] : null;
  const nextEmber = currentEmberIndex >= 0 && currentEmberIndex < embers.length - 1 ? embers[currentEmberIndex + 1] : null;
  const prevEmberPreloadUrl = prevEmber
    ? getPreviewMediaUrl({ mediaType: prevEmber.mediaType, filename: prevEmber.filename, posterFilename: prevEmber.posterFilename })
    : null;
  const nextEmberPreloadUrl = nextEmber
    ? getPreviewMediaUrl({ mediaType: nextEmber.mediaType, filename: nextEmber.filename, posterFilename: nextEmber.posterFilename })
    : null;

  const buildHomeHref = useCallback((updates: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    next.delete('id');
    Object.entries(updates).forEach(([key, value]) => {
      if (key === 'id') return;
      if (value === null) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    });
    const query = next.toString();
    if (selectedEmberId) {
      return query ? `/ember/${selectedEmberId}?${query}` : `/ember/${selectedEmberId}`;
    }
    return query ? `/home?${query}` : '/home';
  }, [params, selectedEmberId]);
  const isDarkTheme = params.get('theme')
    ? params.get('theme') !== 'light'
    : storedTheme !== 'light';

  // Wraps any clipboard.writeText so the share modal can flash a brief
  // "Link copied" confirmation. Falls back gracefully when the clipboard
  // API isn't available (older browsers, insecure context) — the visual
  // feedback still fires so the user gets a confirmation either way.
  const copyShareLink = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* clipboard API unavailable — visual feedback below still fires */
    }
    setCopyStatus('copied');
    setTimeout(() => setCopyStatus('idle'), 2000);
  }, []);

  const SWIPE_THRESHOLD = 80;

  const commitEmberSwipe = useCallback((targetId: string) => {
    const swipingUp = dragY < 0;
    pendingEntryRef.current = swipingUp ? 1 : -1;
    setSwipeSettling(true);
    setDragY(swipingUp ? -window.innerHeight : window.innerHeight);
    setTimeout(() => {
      router.push(`/ember/${targetId}`);
    }, 320);
  }, [dragY, router]);

  const allMediaLength = allMedia.length;

  const commitPhotoSwipe = useCallback((direction: 'next' | 'prev') => {
    if (allMediaLength <= 1) return;
    setPhotoSwapSettling(true);
    setPhotoSwapX(direction === 'next' ? -window.innerWidth : window.innerWidth);
    setTimeout(() => {
      setPhotoIndex((i) => (i + (direction === 'next' ? 1 : -1) + allMediaLength) % allMediaLength);
      setPhotoIsLandscape(false);
      setPhotoSwapSettling(false);
      setPhotoSwapX(direction === 'next' ? window.innerWidth : -window.innerWidth);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setPhotoSwapSettling(true);
          setPhotoSwapX(0);
        });
      });
      setTimeout(() => setPhotoSwapSettling(false), 350);
    }, 320);
  }, [allMediaLength]);

  const handleEmberSwipeDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!swipeEnabled) return;
    swipeStartRef.current = { x: e.clientX, y: e.clientY };
    swipeActiveRef.current = false;
    swipeAxisRef.current = null;
    setSwipeSettling(false);
  }, [swipeEnabled]);

  const handleEmberSwipeMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!swipeEnabled || !swipeStartRef.current) return;
    const dx = e.clientX - swipeStartRef.current.x;
    const dy = e.clientY - swipeStartRef.current.y;
    if (!swipeActiveRef.current) {
      if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx) * 1.4) {
        swipeActiveRef.current = true;
        swipeAxisRef.current = 'y';
        try { swipeWrapperRef.current?.setPointerCapture(e.pointerId); } catch { /* noop */ }
      } else if (allMediaLength > 1 && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        swipeActiveRef.current = true;
        swipeAxisRef.current = 'x';
        try { swipeWrapperRef.current?.setPointerCapture(e.pointerId); } catch { /* noop */ }
      } else return;
    }
    if (swipeAxisRef.current === 'y') {
      let next = dy;
      if (dy < 0 && !nextEmber) next = dy * 0.25;
      if (dy > 0 && !prevEmber) next = dy * 0.25;
      setDragY(next);
    } else {
      setPhotoSwapX(dx);
    }
  }, [allMediaLength, nextEmber, prevEmber, swipeEnabled]);

  const handleEmberSwipeEnd = useCallback(() => {
    if (!swipeStartRef.current) return;
    const wasActive = swipeActiveRef.current;
    const axis = swipeAxisRef.current;
    const dy = dragY;
    const dx = photoSwapX;
    swipeStartRef.current = null;
    swipeActiveRef.current = false;
    swipeAxisRef.current = null;
    if (!wasActive) return;
    if (axis === 'y') {
      if (dy <= -SWIPE_THRESHOLD && nextEmber) {
        commitEmberSwipe(nextEmber.id);
        return;
      }
      if (dy >= SWIPE_THRESHOLD && prevEmber) {
        commitEmberSwipe(prevEmber.id);
        return;
      }
      setSwipeSettling(true);
      setDragY(0);
      setTimeout(() => setSwipeSettling(false), 300);
    } else {
      if (dx <= -SWIPE_THRESHOLD) {
        commitPhotoSwipe('next');
        return;
      }
      if (dx >= SWIPE_THRESHOLD) {
        commitPhotoSwipe('prev');
        return;
      }
      setPhotoSwapSettling(true);
      setPhotoSwapX(0);
      setTimeout(() => setPhotoSwapSettling(false), 300);
    }
  }, [commitEmberSwipe, commitPhotoSwipe, dragY, nextEmber, photoSwapX, prevEmber]);

  useEffect(() => {
    if (pendingEntryRef.current !== 0) {
      const dir = pendingEntryRef.current;
      pendingEntryRef.current = 0;
      // Place new ember off-screen on the entry side without transition,
      // then animate it in on the next paint. Start at opacity 0 so the
      // photo fades in via the img onLoad handler.
      setSwipeSettling(false);
      setDragY(dir * window.innerHeight);
      setPhotoOpacity(0);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setSwipeSettling(true);
          setDragY(0);
        });
      });
      return;
    }
    setSwipeSettling(false);
    setDragY(0);
  }, [selectedEmberId]);

  useEffect(() => {
    if (profile) {
      return;
    }

    void fetch('/api/profile')
      .then(async (response) => {
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as { user: AuthUser };
        setProfile(payload.user);
      })
      .catch(() => undefined);
  }, [profile]);

  useEffect(() => {
    if (avatarUrl) return;
    void fetch('/api/profile', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return;
        const payload = await res.json();
        if (typeof payload?.user?.avatarUrl === 'string') {
          setAvatarUrl(payload.user.avatarUrl);
        }
      })
      .catch(() => undefined);
    // intentional: only fall back to client fetch on initial mount when no
    // server-provided avatar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void fetch('/api/images', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as EmberSummary[];
        setEmbers(payload);
      })
      .catch(() => undefined);
  }, [createdEmberId]);

  // Poll for image-analysis completion: while the currently-selected ember has
  // no title, refetch the image list every 3s. Once a title comes back (image
  // analysis sets it), stop polling. Bail after ~2 minutes to avoid runaway.
  const selectedEmberHasTitle = Boolean(
    selectedEmberId &&
      embers.find((img) => img.id === selectedEmberId)?.title?.trim()
  );
  useEffect(() => {
    if (!selectedEmberId || selectedEmberHasTitle) return;
    const startedAt = Date.now();
    const interval = setInterval(() => {
      if (Date.now() - startedAt > 120_000) {
        clearInterval(interval);
        return;
      }
      void fetch('/api/images', { cache: 'no-store' })
        .then(async (response) => {
          if (!response.ok) return;
          const payload = (await response.json()) as EmberSummary[];
          setEmbers(payload);
        })
        .catch(() => undefined);
    }, 3_000);
    return () => clearInterval(interval);
  }, [selectedEmberId, selectedEmberHasTitle]);

  useEffect(() => {
    if (!selectedEmberId || modal !== 'play') {
      setSelectedEmber(null);
      return;
    }

    void fetch(`/api/images/${selectedEmberId}?scope=play`)
      .then(async (response) => {
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as EmberDetail;
        setSelectedEmber(payload);
      })
      .catch(() => undefined);
  }, [modal, selectedEmberId]);

  useEffect(() => {
    setPhotoIndex(0);
    setPhotoOpacity(1);
    if (!selectedEmberId || firstEmber) {
      setAttachments([]);
      return;
    }
    void fetch(`/api/images/${encodeURIComponent(selectedEmberId)}/attachments`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) return;
        const payload = await r.json() as { attachments: ImageAttachment[] };
        setAttachments(payload.attachments ?? []);
      })
      .catch(() => undefined);
  }, [selectedEmberId, firstEmber]);

  useEffect(() => {
    if (!selectedEmberId || firstEmber) {
      setHasConversationHistory(false);
      return;
    }

    let cancelled = false;

    void fetch(`/api/chat?imageId=${encodeURIComponent(selectedEmberId)}`, {
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) {
          if (!cancelled) {
            setHasConversationHistory(false);
          }
          return;
        }

        const payload = await response.json();
        if (!cancelled) {
          setHasConversationHistory(
            Array.isArray(payload.messages) && payload.messages.length > 0
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasConversationHistory(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [firstEmber, selectedEmberId]);

  useEffect(() => {
    return () => {
      if (selectedPreviewUrl) {
        URL.revokeObjectURL(selectedPreviewUrl);
      }
    };
  }, [selectedPreviewUrl]);

  useEffect(() => {
    if (modal !== 'share' || !selectedEmberId) {
      setShareToken(null);
      return;
    }

    void fetch(`/api/images/${selectedEmberId}/share-token`, { method: 'POST' })
      .then(async (res) => {
        const payload = await res.json().catch(() => null);
        if (typeof payload?.token === 'string') {
          setShareToken(payload.token);
        }
      })
      .catch(() => undefined);
  }, [modal, selectedEmberId]);

  useEffect(() => {
    const stored = localStorage.getItem('ember-theme');
    if (stored) {
      setStoredTheme(stored);
      document.documentElement.dataset.theme = stored;
    }
  }, []);

  useEffect(() => {
    const theme = params.get('theme');
    if (!theme) {
      return;
    }

    localStorage.setItem('ember-theme', theme);
    document.documentElement.dataset.theme = theme;
    setStoredTheme(theme);
  }, [params]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/signin');
    router.refresh();
  }

  async function handleCreateEmber() {
    if (!selectedFile) {
      return;
    }

    setUploading(true);
    setUploadError('');
    setCreatedEmberId(null);
    setUploadKey((value) => value + 1);
    router.push(buildHomeHref({ step: 'processing', mode: 'first-ember' }));

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch('/api/images', { method: 'POST', body: formData });
      const payload = (await response.json().catch(() => ({}))) as CreateEmberResponse;
      if (!response.ok || typeof payload?.id !== 'string') {
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'Failed to create ember');
      }
      const createdSummary = payload.image;
      if (createdSummary) {
        setEmbers((current) => [
          createdSummary,
          ...current.filter((ember) => ember.id !== createdSummary.id),
        ]);
      }
      setCreatedEmberId(payload.id);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Failed to create ember');
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    if (!createdEmberId || step !== 'processing') {
      return;
    }

    const timer = setTimeout(() => {
      setSelectedFile(null);
      setSelectedPreviewUrl('');
      router.replace(`/ember/${createdEmberId}?ember=owner`);
    }, 400);

    return () => clearTimeout(timer);
  }, [createdEmberId, router, step]);

  return (
    <div className="fixed inset-0 flex justify-center" style={{ background: 'var(--bg-screen)' }}>
      <AppHeader
        avatarUrl={avatarUrl}
        userInitials={initials(getUserDisplayName(profile) || profile?.email || 'ST')}
        userModalHref={buildHomeHref({ m: 'account' })}
      />
      <div className="relative w-full max-w-xl h-full fade-in">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) {
            return;
          }
          if (selectedPreviewUrl) {
            URL.revokeObjectURL(selectedPreviewUrl);
          }
          setSelectedFile(file);
          setSelectedPreviewUrl(URL.createObjectURL(file));
          setUploadError('');
          router.push(buildHomeHref({ mode: 'first-ember', step: 'confirm', m: null, ember: null }));
        }}
      />

      {!firstEmber && currentPhotoUrl ? (
        <div
          ref={swipeWrapperRef}
          className="absolute left-0 right-0 bottom-0"
          style={{
            // Start below the AppHeader (56px tall) so the swipe layer
            // never overlaps the header's tap targets. iOS Safari can
            // forward touchstart on a touch-action: none layer to
            // overlapping fixed siblings (logo / HOME / EMBERS / avatar)
            // and silently swallow their click events. Pulling the
            // wrapper's top edge down to 56 removes the overlap and
            // restores tap-through to the header on mobile.
            top: 56,
            transform: dragY ? `translateY(${dragY}px)` : undefined,
            transition: swipeSettling ? 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
            pointerEvents: swipeEnabled ? 'auto' : 'none',
            touchAction: swipeEnabled ? 'none' : 'auto',
            overflow: 'hidden',
          }}
          onPointerDown={handleEmberSwipeDown}
          onPointerMove={handleEmberSwipeMove}
          onPointerUp={handleEmberSwipeEnd}
          onPointerCancel={handleEmberSwipeEnd}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              transform: photoSwapX ? `translateX(${photoSwapX}px)` : undefined,
              transition: photoSwapSettling ? 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
            }}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: `url(${currentPhotoUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: 'blur(24px)',
                transform: 'scale(1.08)',
                opacity: photoOpacity * 0.7,
                transition: `opacity ${photoFadeMs}ms ease-in-out`,
              }}
            />
            <img
              src={currentPhotoUrl}
              alt=""
              className="absolute pointer-events-none"
              onLoad={(e) => {
                const img = e.currentTarget;
                setPhotoIsLandscape(img.naturalWidth > img.naturalHeight);
                setPhotoOpacity(1);
              }}
              style={(() => {
                const cx = displayEmber?.cropX;
                const cy = displayEmber?.cropY;
                const cw = displayEmber?.cropWidth;
                const ch = displayEmber?.cropHeight;
                const hasCrop = !emberModalExpanded && cx != null && cy != null && cx >= 0 && cx <= 100 && cy >= 0 && cy <= 100;
                const scale = hasCrop && cw != null && ch != null && cw > 0 && ch > 0
                  ? Math.min(100 / cw, 100 / ch)
                  : 1;
                // The swipe wrapper's top edge already sits at viewport
                // y=56 (below the AppHeader). The img is absolutely
                // positioned within that wrapper, so its `top` must be 0
                // to land at viewport y=56 — using `top: 56` here would
                // double-offset the photo down by 56px and clip its
                // bottom behind the ember sheet at full detent.
                if (emberModalExpanded) return {
                  top: 0,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  height: 'calc(25vh - 56px)',
                  width: 'auto',
                  objectFit: 'contain' as const,
                  objectPosition: 'center center',
                  opacity: photoOpacity,
                  transition: `opacity ${photoFadeMs}ms ease-in-out`,
                };
                return {
                  top: 0,
                  bottom: 72,
                  left: 0,
                  right: 0,
                  width: '100%',
                  // Explicit height matches the implicit (top:0 +
                  // bottom:72) value but makes the cleanup explicit so
                  // the browser doesn't carry over the expanded state's
                  // calc(25vh - 56px) when the modal closes.
                  height: 'calc(100% - 72px)',
                  objectFit: hasCrop ? ('cover' as const) : ('contain' as const),
                  objectPosition: hasCrop ? `${cx}% ${cy}%` : 'center center',
                  transform: hasCrop && scale > 1.01 ? `scale(${scale.toFixed(3)})` : undefined,
                  transformOrigin: hasCrop ? `${cx}% ${cy}%` : 'center',
                  opacity: photoOpacity,
                  transition: `opacity ${photoFadeMs}ms ease-in-out`,
                };
              })()}
            />
          </div>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 25%, transparent 55%, rgba(0,0,0,0.55) 100%)' }}
          />
          {allMedia.length > 1 && !emberModalExpanded ? (
            <div
              className="absolute left-1/2 flex items-center gap-1.5 pointer-events-none"
              style={{ bottom: 88, transform: 'translateX(-50%)' }}
            >
              {allMedia.map((_, idx) => (
                <div
                  key={idx}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    background: idx === photoIndex ? '#ffffff' : 'rgba(255,255,255,0.35)',
                    boxShadow: idx === photoIndex ? '0 1px 3px rgba(0,0,0,0.5)' : 'none',
                    transition: 'background 200ms ease',
                  }}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {prevEmberPreloadUrl ? <img src={prevEmberPreloadUrl} alt="" aria-hidden="true" style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} /> : null}
      {nextEmberPreloadUrl ? <img src={nextEmberPreloadUrl} alt="" aria-hidden="true" style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} /> : null}

      {!firstEmber && displayEmber && !emberModalExpanded ? (
        <div
          className="absolute left-4 z-20 pointer-events-none"
          style={{
            top: 64,
            opacity: dragY === 0 ? 1 : 0,
            transition: 'opacity 0.36s ease',
          }}
        >
          <p className="text-white font-medium text-base leading-tight" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
            {selectedEmberHasTitle ? title : ' '}
          </p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
            {selectedEmberHasTitle ? subtitle : ' '}
          </p>
        </div>
      ) : null}

      {firstEmber ? (
        <div
          className="absolute left-0 right-0 flex flex-col items-center justify-center px-5"
          style={{ top: 56, bottom: 0 }}
        >
          <div
            className="w-full flex flex-col items-center gap-3 rounded-2xl px-6 py-8"
            style={{ maxWidth: 420, background: 'var(--bg-surface)' }}
          >
            <EmberMark size={44} />
            <div className="flex flex-col items-center gap-1 text-center">
              <p className="text-white font-medium text-base">
                {hasExistingEmbers ? 'Create a new ember' : 'Create your first ember'}
              </p>
              <p className="text-white/60 text-sm leading-snug">
                {hasExistingEmbers
                  ? 'Choose a photo or video to start another memory.'
                  : "Let's start with a photo that will help build this memory into a glowing ember."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-8 rounded-full text-white text-sm font-medium cursor-pointer can-hover-dim"
              style={{ background: '#f97316', minHeight: 44 }}
            >
              Choose Photo
            </button>
          </div>
        </div>
      ) : null}

      {step === 'confirm' && selectedPreviewUrl ? (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center px-6" style={{ background: 'var(--bg-screen)' }}>
          <div className="absolute top-4 left-4">
            <button
              type="button"
              onClick={() => router.push(buildHomeHref({ mode: 'first-ember', step: null }))}
              className="w-11 h-11 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.1)' }}
            >
              <ChevronLeft size={22} color="var(--text-primary)" strokeWidth={1.8} />
            </button>
          </div>
          <div className="w-full rounded-2xl overflow-hidden" style={{ maxWidth: 420, border: '1px solid var(--border-default)' }}>
            <img src={selectedPreviewUrl} alt="Selected photo" className="w-full h-auto block" />
          </div>
          <div className="w-full flex flex-col gap-5 mt-7" style={{ maxWidth: 420 }}>
            <p className="text-white font-medium text-base text-center leading-snug">
              {hasExistingEmbers
                ? 'Create a new ember from this photo?'
                : 'Create an ember from this photo?'}
            </p>
            {uploadError ? <p className="text-sm text-center text-red-300">{uploadError}</p> : null}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => router.push(buildHomeHref({ mode: 'first-ember', step: null }))}
                className="flex-1 flex items-center justify-center rounded-full text-sm font-medium can-hover-dim btn-secondary"
                style={{ minHeight: 44, background: 'transparent', border: '1.5px solid var(--border-btn)' }}
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleCreateEmber}
                disabled={uploading}
                className="flex-1 flex items-center justify-center rounded-full text-sm font-medium text-white can-hover-dim btn-primary disabled:opacity-60"
                style={{ minHeight: 44, background: '#f97316' }}
              >
                {uploading ? 'Creating...' : 'Create Ember'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {step === 'processing' ? (
        <div key={uploadKey} className="absolute inset-0 z-50 flex flex-col items-center justify-center px-8" style={{ background: 'var(--bg-screen)' }}>
          <style>{'@keyframes kipSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }'}</style>
          <div className="rounded-full flex items-center justify-center" style={{ width: 96, height: 96, background: 'rgba(249,115,22,0.15)', border: '1.5px solid rgba(249,115,22,0.55)', animation: 'kipSpin 1.5s linear infinite' }}>
            <EmberMark size={40} />
          </div>
          <p className="mt-8 font-medium text-base text-white">
            {createdEmberId ? 'Ember created!' : 'Igniting ember'}
          </p>
          <p className="mt-1 text-sm text-white/60">
            {uploadError || (createdEmberId ? 'Opening your memory...' : 'Building the ember structure')}
          </p>
        </div>
      ) : null}

      <div
        className={`absolute right-2 z-20 flex flex-col gap-0 items-center transition-opacity duration-200 ${
          railHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
        style={{ bottom: '9%' }}
      >
        {allMedia.length > 1 && nextPhotoUrl ? (
          <button
            type="button"
            onClick={() => commitPhotoSwipe('next')}
            className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-white/10 active:bg-white/20 cursor-pointer"
          >
            <div className="relative w-11 h-11">
              <div className="w-11 h-11 rounded-full overflow-hidden">
                <img src={nextPhotoUrl} alt="" className="w-full h-full object-cover" />
              </div>
              {allMedia.length > 1 ? (
                <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1" style={{ background: '#f97316', fontSize: 10, fontWeight: 600, color: '#fff', lineHeight: 1 }}>
                  {allMedia.length}
                </div>
              ) : null}
            </div>
            <span className="text-white text-xs font-medium lowercase">more</span>
          </button>
        ) : null}
        <RailBtn icon={Share2} label="share" href={buildHomeHref({ m: 'share' })} active={modal === 'share'} />
        <RailBtn
          icon={Leaf}
          label="tend"
          href={selectedEmberId ? buildHomeHref({ m: 'wiki' }) : '/home'}
          active={modal === 'wiki'}
        />
        <RailBtn icon={ScanEye} label="view" href={buildHomeHref({ m: 'play' })} active={modal === 'play'} />
      </div>

      {modal === 'share' && shareToken ? (
        <Modal closeHref={buildHomeHref({ m: null })}>
          <div className="flex flex-col items-center pt-6 pb-4 gap-2">
            <div className="rounded-full flex items-center justify-center" style={{ width: 55, height: 55, background: '#4a6172' }}>
              <Share2 size={28} color="#c8dce8" strokeWidth={1.6} />
            </div>
            <span className="text-white text-base font-medium">Share this ember</span>
          </div>
          <div className="mx-5" style={{ borderTop: '1px solid var(--border-default)' }} />
          <div className="p-5 grid grid-cols-3 gap-1">
            {(() => {
              const shareUrl = shareToken ? `${window.location.origin}/guest/${shareToken}` : null;
              return (
                <>
                  <button type="button" className="flex flex-col items-center gap-2 p-3 rounded-xl opacity-60 can-hover" onClick={() => shareUrl ? void copyShareLink(shareUrl) : undefined}><div className="w-11 h-11 flex items-center justify-center"><Link2 size={26} color="var(--text-primary)" strokeWidth={1.6} /></div><span className="text-white text-xs font-medium tracking-wide">Copy Link</span></button>
                  <button type="button" className="flex flex-col items-center gap-2 p-3 rounded-xl opacity-60 can-hover" onClick={() => shareUrl ? window.location.assign(`sms:?&body=${encodeURIComponent(shareUrl)}`) : undefined}><div className="w-11 h-11 flex items-center justify-center"><MessageCircle size={26} color="var(--text-primary)" strokeWidth={1.6} /></div><span className="text-white text-xs font-medium tracking-wide">Message</span></button>
                  <a href={shareUrl ? `mailto:?body=${encodeURIComponent(shareUrl)}` : undefined} className="flex flex-col items-center gap-2 p-3 rounded-xl opacity-60 can-hover"><div className="w-11 h-11 flex items-center justify-center"><Mail size={26} color="var(--text-primary)" strokeWidth={1.6} /></div><span className="text-white text-xs font-medium tracking-wide">Email</span></a>
                  <a href={shareUrl ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}` : undefined} className="flex flex-col items-center gap-2 p-3 rounded-xl opacity-60 can-hover" target="_blank" rel="noreferrer"><div className="w-11 h-11 flex items-center justify-center"><FacebookIcon /></div><span className="text-white text-xs font-medium tracking-wide">Facebook</span></a>
                  <a href={shareUrl ? `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}` : undefined} className="flex flex-col items-center gap-2 p-3 rounded-xl opacity-60 can-hover" target="_blank" rel="noreferrer"><div className="w-11 h-11 flex items-center justify-center"><XIcon /></div><span className="text-white text-xs font-medium tracking-wide">X / Twitter</span></a>
                  <button type="button" className="flex flex-col items-center gap-2 p-3 rounded-xl opacity-60 can-hover" onClick={() => shareUrl ? navigator.share?.({ title, url: shareUrl }) : undefined}><div className="w-11 h-11 flex items-center justify-center"><MoreHorizontal size={26} color="var(--text-primary)" strokeWidth={1.6} /></div><span className="text-white text-xs font-medium tracking-wide">More</span></button>
                </>
              );
            })()}
          </div>
          <div className="mx-5 mb-5">
            {/* Confirmation lives above the URL row so the user sees
                feedback right after tapping Copy Link or the inline copy
                icon. Auto-clears after 2s via copyShareLink. */}
            {copyStatus === 'copied' ? (
              <p className="text-xs text-center mb-2" style={{ color: '#4ade80' }}>
                Link copied to clipboard
              </p>
            ) : null}
            <div
              className="flex items-center gap-2 rounded-xl px-3 py-2.5"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
            >
              <span className="flex-1 text-xs text-white/50 truncate">
                {shareToken ? `${window.location.origin}/guest/${shareToken}` : 'Generating link…'}
              </span>
              {shareToken ? (
                <button
                  type="button"
                  onClick={() => void copyShareLink(`${window.location.origin}/guest/${shareToken}`)}
                  className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-md cursor-pointer"
                >
                  <Copy size={16} color="white" strokeWidth={1.8} />
                </button>
              ) : null}
            </div>
          </div>
        </Modal>
      ) : null}

      {/* The Tend modal was archived once every entry it surfaced got
          a wiki section pencil. The Tend rail button now jumps straight
          to /tend/view-wiki. We can resurrect this block from git
          history if we ever want a multi-action launcher again. */}

      {modal === 'play' ? (
        <KipemberPlayOverlay
          key={`${selectedEmberId || 'empty'}:${selectedEmber?.wiki?.updatedAt || 'wiki'}:${selectedEmber?.snapshot?.script ? 'snapshot' : 'fallback'}`}
          closeHref={buildHomeHref({ m: null })}
          imageId={selectedEmberId}
          storyScript={selectedEmber?.snapshot?.script || null}
        />
      ) : null}

      {!firstEmber ? (
        <EmberModalShell
          isOpen={emberModalOpen}
          isExpanded={emberModalExpanded}
          openHref={buildHomeHref({ ember: defaultChatFlow, m: null, step: null, sub: null })}
          closeHref={buildHomeHref({ ember: null, view: null, step: null, sub: null })}
          expandHref={buildHomeHref({ view: 'full' })}
          collapseHref={buildHomeHref({ view: null })}
          surface={emberModalSurface}
          tabs={[
            { label: 'Chat', surface: 'chats', href: buildHomeHref({ chat: null }) },
            { label: 'Voice', surface: 'voice', href: buildHomeHref({ chat: 'voice' }) },
            { label: 'Call', surface: 'calls', href: buildHomeHref({ chat: 'calls' }) },
          ]}
        >
          {flow ? (
            <WorkflowSlot
              flow={flow}
              emberId={selectedEmberId}
              onConversationStateChange={setHasConversationHistory}
              emberModalSurface={emberModalSurface}
            />
          ) : null}
        </EmberModalShell>
      ) : null}
      </div>

      {/* Wiki and Account modals are rendered as siblings of AppHeader at
          the root level (outside the fade-in inner wrapper) so their z-40
          beats the header's z-30. Inside the fade-in wrapper, the wrapper
          would create a stacking context that traps these modals below
          the header. */}
      {modal === 'wiki' ? (
        <KipemberWikiOverlay
          key={selectedEmberId || 'empty'}
          closeHref={buildHomeHref({ m: null })}
          imageId={selectedEmberId}
        />
      ) : null}

      {modal === 'account' ? (
        <KipemberAccountOverlay closeHref={buildHomeHref({ m: null })} />
      ) : null}
    </div>
  );
}
