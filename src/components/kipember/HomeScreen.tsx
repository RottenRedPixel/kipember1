'use client';

import Link from 'next/link';
import {
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Clock,
  Copy,
  LogOut,
  MapPin,
  Moon,
  MoreHorizontal,
  PencilLine,
  Plus,
  PlusCircle,
  ScanEye,
  ScanLine,
  Settings,
  Leaf,
  Link2,
  Mail,
  MessageCircle,
  Share2,
  Sun,
  UserStar,
  User,
  Users,
  X,
} from 'lucide-react';
import AppHeader from '@/components/kipember/AppHeader';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getPreviewMediaUrl } from '@/lib/media';
import KipemberPlayOverlay from '@/components/kipember/KipemberPlayOverlay';
import ContributorFlow from '@/components/kipember/workflows/ContributorFlow';
import OwnerFlow from '@/components/kipember/workflows/OwnerFlow';
import type { AccessibleImageSummary } from '@/lib/image-summaries';
import { getEmberTitle } from '@/lib/ember-title';

type AuthUser = {
  id: string;
  name: string | null;
  email: string;
  phoneNumber: string | null;
  avatarUrl?: string | null;
};

type ImageSummary = AccessibleImageSummary & {
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

type ImageDetail = ImageSummary & {
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
  image?: ImageSummary;
};

type HomeEmberFlow = 'owner' | 'contributor' | null;

function getDefaultHomeEmberFlow(accessType: ImageSummary['accessType'] | undefined): Exclude<HomeEmberFlow, null> {
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

function EmberMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" fill="white">
      <circle cx="36" cy="36" r="7.2" fill="#f97316" />
      <rect x="32.4" y="3.18" width="7.2" height="21.6" rx="3.6" ry="3.6" />
      <rect x="32.4" y="47.22" width="7.2" height="21.6" rx="3.6" ry="3.6" />
      <rect x="10.38" y="25.2" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(-22.02 49.98) rotate(-90)" />
      <rect x="54.42" y="25.2" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(22.02 94.02) rotate(-90)" />
      <rect x="47.97" y="9.63" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(29.55 -30.48) rotate(45)" />
      <rect x="16.83" y="40.77" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(42.45 .66) rotate(45)" />
      <rect x="16.83" y="9.63" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(-8.46 20.43) rotate(-45)" />
      <rect x="47.97" y="40.77" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(-21.36 51.57) rotate(-45)" />
    </svg>
  );
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

function WorkflowSlot({
  flow,
  imageId,
  onConversationStateChange,
}: {
  flow: HomeEmberFlow;
  imageId: string | null;
  onConversationStateChange: (hasConversation: boolean) => void;
}) {
  switch (flow) {
    case 'owner':
      return imageId ? (
        <OwnerFlow imageId={imageId} onConversationStateChange={onConversationStateChange} />
      ) : null;
    case 'contributor':
      return imageId ? (
        <ContributorFlow imageId={imageId} onConversationStateChange={onConversationStateChange} />
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
  initialImages = [],
}: {
  initialProfile?: AuthUser | null;
  initialImages?: ImageSummary[];
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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialProfile?.avatarUrl ?? null);
  const [images, setImages] = useState<ImageSummary[]>(initialImages);
  const [selectedImage, setSelectedImage] = useState<ImageDetail | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadKey, setUploadKey] = useState(0);
  const [createdImageId, setCreatedImageId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [storedTheme, setStoredTheme] = useState<string | null>(null);
  const [hasConversationHistory, setHasConversationHistory] = useState(false);
  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [photoOpacity, setPhotoOpacity] = useState(1);
  const [photoIsLandscape, setPhotoIsLandscape] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedImageId = params.get('id') || images[0]?.id || null;
  const hasExistingEmbers = images.length > 0;
  const selectedSummary = images.find((image) => image.id === selectedImageId) || null;
  const displayImage = selectedImage || selectedSummary;
  const defaultChatFlow = getDefaultHomeEmberFlow(displayImage?.accessType);
  const flow = parseHomeEmberFlow(rawFlow);
  const emberOpen = flow !== null;
  const chatExpanded = emberOpen && view === 'full';
  const railHidden = firstEmber || emberOpen || modal === 'share' || modal === 'tend' || modal === 'play';
  const title = displayImage ? getEmberTitle({ title: displayImage.title, originalName: stripExtension(displayImage.originalName) }) : 'Beach Day';
  const capturedAt = selectedImage?.analysis?.capturedAt ?? displayImage?.capturedAt ?? null;
  const subtitle = displayImage
    ? capturedAt
      ? new Date(capturedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : 'Date Unknown'
    : '';
  const mediaUrl = displayImage
      ? getPreviewMediaUrl({
        mediaType: displayImage.mediaType,
        filename: displayImage.filename,
        posterFilename: displayImage.posterFilename,
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

  const buildHomeHref = useCallback((updates: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    });
    const query = next.toString();
    return query ? `/home?${query}` : '/home';
  }, [params]);
  const isDarkTheme = params.get('theme')
    ? params.get('theme') !== 'light'
    : storedTheme !== 'light';

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
    void fetch('/api/profile', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return;
        const payload = await res.json();
        if (typeof payload?.user?.avatarUrl === 'string') {
          setAvatarUrl(payload.user.avatarUrl);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (createdImageId === null && initialImages.length > 0) {
      return;
    }

    void fetch('/api/images', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as ImageSummary[];
        setImages(payload);
      })
      .catch(() => undefined);
  }, [createdImageId, firstEmber, initialImages.length, router]);

  useEffect(() => {
    if (!selectedImageId || modal !== 'play') {
      setSelectedImage(null);
      return;
    }

    void fetch(`/api/images/${selectedImageId}?scope=play`)
      .then(async (response) => {
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as ImageDetail;
        setSelectedImage(payload);
      })
      .catch(() => undefined);
  }, [modal, selectedImageId]);

  useEffect(() => {
    setPhotoIndex(0);
    setPhotoOpacity(1);
    if (!selectedImageId || firstEmber) {
      setAttachments([]);
      return;
    }
    void fetch(`/api/images/${encodeURIComponent(selectedImageId)}/attachments`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) return;
        const payload = await r.json() as { attachments: ImageAttachment[] };
        setAttachments(payload.attachments ?? []);
      })
      .catch(() => undefined);
  }, [selectedImageId, firstEmber]);

  useEffect(() => {
    if (!selectedImageId || firstEmber) {
      setHasConversationHistory(false);
      return;
    }

    let cancelled = false;

    void fetch(`/api/chat?imageId=${encodeURIComponent(selectedImageId)}`, {
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
  }, [firstEmber, selectedImageId]);

  useEffect(() => {
    return () => {
      if (selectedPreviewUrl) {
        URL.revokeObjectURL(selectedPreviewUrl);
      }
    };
  }, [selectedPreviewUrl]);

  useEffect(() => {
    if (modal !== 'share' || !selectedImageId) {
      setShareToken(null);
      return;
    }

    void fetch(`/api/images/${selectedImageId}/share-token`, { method: 'POST' })
      .then(async (res) => {
        const payload = await res.json().catch(() => null);
        if (typeof payload?.token === 'string') {
          setShareToken(payload.token);
        }
      })
      .catch(() => undefined);
  }, [modal, selectedImageId]);

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
    setCreatedImageId(null);
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
        setImages((current) => [
          createdSummary,
          ...current.filter((image) => image.id !== createdSummary.id),
        ]);
      }
      setCreatedImageId(payload.id);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Failed to create ember');
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    if (!createdImageId || step !== 'processing') {
      return;
    }

    const timer = setTimeout(() => {
      setSelectedFile(null);
      setSelectedPreviewUrl('');
      router.replace(`/home?id=${createdImageId}&ember=owner`);
    }, 400);

    return () => clearTimeout(timer);
  }, [createdImageId, router, step]);

  return (
    <div className="fixed inset-0" style={{ background: 'var(--bg-screen)' }}>
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
        <>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `url(${currentPhotoUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(24px)',
              transform: 'scale(1.08)',
              opacity: photoOpacity * 0.7,
              transition: 'opacity 0.22s ease',
            }}
          />
          <img
            src={currentPhotoUrl}
            alt=""
            className="absolute pointer-events-none"
            onLoad={(e) => {
              const img = e.currentTarget;
              setPhotoIsLandscape(img.naturalWidth > img.naturalHeight);
            }}
            style={chatExpanded ? {
              top: 56,
              left: '50%',
              transform: 'translateX(-50%)',
              height: 'calc(25vh - 56px)',
              width: 'auto',
              objectFit: 'contain',
              objectPosition: 'center center',
              opacity: photoOpacity,
              transition: 'opacity 0.22s ease',
            } : (() => {
              const hasCrop = selectedImage?.cropX != null && selectedImage?.cropY != null;
              return {
                top: 56,
                bottom: 72,
                left: 0,
                right: 0,
                width: '100%',
                height: 'calc(100% - 128px)',
                objectFit: hasCrop ? 'cover' : (photoIsLandscape ? 'contain' : 'cover'),
                objectPosition: hasCrop
                  ? `${selectedImage!.cropX}% ${selectedImage!.cropY}%`
                  : 'center center',
                opacity: photoOpacity,
                transition: 'opacity 0.22s ease',
              };
            })()}
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 25%, transparent 55%, rgba(0,0,0,0.55) 100%)' }}
          />
        </>
      ) : null}

      <AppHeader
        avatarUrl={avatarUrl}
        userInitials={initials(profile?.name || profile?.email || 'ST')}
        userModalHref={selectedImageId ? `/account?imageId=${selectedImageId}` : '/account'}
      />

      {!firstEmber && displayImage && !chatExpanded ? (
        <div className="absolute left-4 z-20 pointer-events-none" style={{ top: 64 }}>
          <p className="text-white font-medium text-base leading-tight" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>{title}</p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>{subtitle}</p>
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
            {createdImageId ? 'Ember created!' : 'Igniting ember'}
          </p>
          <p className="mt-1 text-sm text-white/60">
            {uploadError || (createdImageId ? 'Opening your memory...' : 'Building the ember structure')}
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
            onClick={() => {
              setPhotoOpacity(0);
              setTimeout(() => {
                setPhotoIndex((i) => (i + 1) % allMedia.length);
                setPhotoIsLandscape(false);
                setPhotoOpacity(1);
              }, 220);
            }}
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
        <RailBtn icon={Leaf} label="tend" href={buildHomeHref({ m: 'tend' })} active={modal === 'tend'} />
        <RailBtn icon={ScanEye} label="view" href={buildHomeHref({ m: 'play' })} active={modal === 'play'} />
      </div>

      {modal === 'share' ? (
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
                  <button type="button" className="flex flex-col items-center gap-2 p-3 rounded-xl opacity-60 can-hover" onClick={() => shareUrl ? void navigator.clipboard.writeText(shareUrl) : undefined}><div className="w-11 h-11 flex items-center justify-center"><Link2 size={26} color="var(--text-primary)" strokeWidth={1.6} /></div><span className="text-white text-xs font-medium tracking-wide">Copy Link</span></button>
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
                  onClick={() => void navigator.clipboard.writeText(`${window.location.origin}/guest/${shareToken}`)}
                  className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-md cursor-pointer"
                >
                  <Copy size={16} color="white" strokeWidth={1.8} />
                </button>
              ) : null}
            </div>
          </div>
        </Modal>
      ) : null}

      {modal === 'tend' ? (
        <Modal closeHref={buildHomeHref({ m: null })}>
          <div className="flex flex-col items-center pt-6 pb-4 gap-2">
            <div className="rounded-full flex items-center justify-center" style={{ width: 55, height: 55, background: '#6a7c5c' }}>
              <Leaf size={28} color="#d4e8c2" strokeWidth={1.6} />
            </div>
            <span className="text-white text-base font-medium">Tend &amp; grow this ember</span>
          </div>
          <div className="mx-5" style={{ borderTop: '1px solid var(--border-default)' }} />
          <div className="px-5 py-6 grid grid-cols-3" style={{ gap: '36px 8px' }}>
            {displayImage?.accessType === 'contributor' ? (
              <>
                <SvgItem label="Add Content" href={selectedImageId ? `/home?id=${selectedImageId}&ember=contributor` : '/home?ember=contributor'} icon={PlusCircle} />
                <SvgItem label="Tag People" href={selectedImageId ? `/tend/tag-people?id=${selectedImageId}` : '/tend/tag-people'} icon={UserStar} />
                <SvgItem label="View Snapshot" href={selectedImageId ? `/tend/edit-snapshot?id=${selectedImageId}` : '/tend/edit-snapshot'} icon={ScanEye} />
              </>
            ) : (
              <>
                <SvgItem label="Edit Title" href={selectedImageId ? `/tend/edit-title?id=${selectedImageId}` : '/tend/edit-title'} icon={PencilLine} />
                <SvgItem label="Edit Time & Place" href={selectedImageId ? `/tend/edit-time-place?id=${selectedImageId}` : '/tend/edit-time-place'} icon={Clock} />
                <SvgItem label="Edit Snapshot" href={selectedImageId ? `/tend/edit-snapshot?id=${selectedImageId}` : '/tend/edit-snapshot'} icon={ScanEye} />
                <SvgItem label="Frame" href={selectedImageId ? `/tend/frame?id=${selectedImageId}` : '/tend/frame'} icon={ScanLine} />
                <SvgItem label="View Wiki" href={selectedImageId ? `/tend/view-wiki?id=${selectedImageId}` : '/tend/view-wiki'} icon={BookOpen} />
                <SvgItem label="Tag People" href={selectedImageId ? `/tend/tag-people?id=${selectedImageId}` : '/tend/tag-people'} icon={UserStar} />
                <SvgItem label="Settings" href={selectedImageId ? `/tend/settings?id=${selectedImageId}` : '/tend/settings'} icon={Settings} />
                <SvgItem label="Add Content" href={selectedImageId ? `/home?id=${selectedImageId}&ember=owner` : '/home?ember=owner'} icon={PlusCircle} />
                <SvgItem label="Contributors" href={selectedImageId ? `/tend/contributors?id=${selectedImageId}` : '/tend/contributors'} icon={Users} />
              </>
            )}
          </div>
        </Modal>
      ) : null}

      {modal === 'play' ? (
        <KipemberPlayOverlay
          key={`${selectedImageId || 'empty'}:${selectedImage?.wiki?.updatedAt || 'wiki'}:${selectedImage?.snapshot?.script ? 'snapshot' : 'fallback'}`}
          closeHref={buildHomeHref({ m: null })}
          imageId={selectedImageId}
          storyScript={selectedImage?.snapshot?.script || null}
        />
      ) : null}

      {!firstEmber ? (
        <div
          className="absolute bottom-0 left-0 right-0 z-30 flex flex-col overflow-hidden"
          style={{
            top: chatExpanded ? '25%' : emberOpen ? '55%' : 'auto',
            background: 'var(--bg-screen)',
            WebkitBackdropFilter: 'blur(20px)',
            backdropFilter: 'blur(20px)',
            borderTop: '1px solid var(--border-subtle)',
            borderRadius: emberOpen ? '20px 20px 0 0' : undefined,
            transition: 'top 200ms ease',
          }}
        >
          <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0">
            <Link
              href={
                flow
                  ? buildHomeHref({ ember: null, view: null, step: null, sub: null })
                  : buildHomeHref({ ember: defaultChatFlow, m: null, step: null, sub: null })
              }
              className="flex-1 text-left"
            >
              <span className="flex items-center gap-2">
                <EmberMark />
                <span className="text-base font-medium text-white">
                  <span style={{ color: '#f97316' }}>Ember</span> Chat
                </span>
              </span>
            </Link>
            {flow && !chatExpanded ? (
              <Link
                href={buildHomeHref({ view: 'full' })}
                className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
                style={{}}
                aria-label="Expand chat"
              >
                <ChevronUp size={18} color="var(--text-secondary)" strokeWidth={1.8} />
              </Link>
            ) : null}
            {flow && chatExpanded ? (
              <Link
                href={buildHomeHref({ view: null })}
                className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
                style={{}}
                aria-label="Collapse chat"
              >
                <ChevronDown size={18} color="var(--text-primary)" strokeWidth={1.8} />
              </Link>
            ) : null}
            <Link
              href={
                flow
                  ? buildHomeHref({ ember: null, view: null, step: null, sub: null })
                  : buildHomeHref({ ember: defaultChatFlow, m: null, step: null, sub: null })
              }
              className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
              style={{ background: flow ? 'rgba(255,255,255,0.15)' : '#f97316' }}
            >
              {flow ? (
                <X size={18} color="var(--text-primary)" strokeWidth={1.8} />
              ) : (
                <Plus size={20} color="white" strokeWidth={2} />
              )}
            </Link>
          </div>
          {flow ? (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <WorkflowSlot
                flow={flow}
                imageId={selectedImageId}
                onConversationStateChange={setHasConversationHistory}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
