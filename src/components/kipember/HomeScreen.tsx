'use client';

import Link from 'next/link';
import {
  ChevronDown,
  ChevronLeft,
  Home,
  Leaf,
  Link2,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Play,
  Share2,
  X,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getPreviewMediaUrl } from '@/lib/media';
import KipemberPlayOverlay from '@/components/kipember/KipemberPlayOverlay';
import ContributorAddFlow from '@/components/kipember/workflows/ContributorAddFlow';
import ContributorAddMoreFlow from '@/components/kipember/workflows/ContributorAddMoreFlow';
import OwnerAddFlow from '@/components/kipember/workflows/OwnerAddFlow';
import OwnerAddMoreFlow from '@/components/kipember/workflows/OwnerAddMoreFlow';
import WelcomeFlow from '@/components/kipember/workflows/WelcomeFlow';
import type { AccessibleImageSummary } from '@/lib/image-summaries';

type AuthUser = {
  id: string;
  name: string | null;
  email: string;
  phoneNumber: string | null;
};

type ImageSummary = AccessibleImageSummary & {
  createdAt: string | Date;
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
  storyCut: {
    script: string | null;
  } | null;
};

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

function Modal({ children, closeHref }: { children: React.ReactNode; closeHref: string }) {
  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center pb-24">
      <Link href={closeHref} className="absolute inset-0" />
      <div
        className="relative w-full max-w-sm mx-4 rounded-2xl overflow-hidden"
        style={{
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
  children,
}: {
  label: string;
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const inner = (
    <div className="flex flex-col items-center gap-1.5">
      <svg width={34} height={34} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
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
  flow: string | null;
  imageId: string | null;
  onConversationStateChange: (hasConversation: boolean) => void;
}) {
  switch (flow) {
    case 'welcome':
      return imageId ? (
        <WelcomeFlow imageId={imageId} onConversationStateChange={onConversationStateChange} />
      ) : null;
    case 'owner-add':
      return <OwnerAddFlow />;
    case 'contrib-add':
      return <ContributorAddFlow />;
    case 'owner-add-more':
      return <OwnerAddMoreFlow />;
    case 'contrib-add-more':
      return <ContributorAddMoreFlow />;
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
  const flow = params.get('ember');
  const mode = params.get('mode');
  const step = params.get('step');
  const firstEmber = mode === 'first-ember';
  const emberOpen = flow !== null;
  const railHidden = firstEmber || emberOpen || modal === 'share' || modal === 'tend' || modal === 'play' || modal === 'user';

  const [profile, setProfile] = useState<AuthUser | null>(initialProfile ?? null);
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedImageId = params.get('id') || images[0]?.id || null;
  const hasExistingEmbers = images.length > 0;
  const selectedSummary = images.find((image) => image.id === selectedImageId) || null;
  const displayImage = selectedImage || selectedSummary;
  const title = displayImage?.title || (displayImage ? stripExtension(displayImage.originalName) : 'Beach Day');
  const subtitle = selectedImage?.analysis?.capturedAt
    ? new Date(selectedImage.analysis.capturedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : displayImage?.createdAt
      ? new Date(displayImage.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : '';
  const mediaUrl = displayImage
      ? getPreviewMediaUrl({
        mediaType: displayImage.mediaType,
        filename: displayImage.filename,
        posterFilename: displayImage.posterFilename,
      })
    : '';

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
    if (createdImageId === null && initialImages.length > 0) {
      return;
    }

    void fetch('/api/images')
      .then(async (response) => {
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as ImageSummary[];
        setImages(payload);
        if (!firstEmber && payload.length === 0) {
          router.replace('/home?mode=first-ember');
        }
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
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || typeof payload?.id !== 'string') {
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'Failed to create ember');
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
      router.replace(`/home?id=${createdImageId}&ember=welcome`);
    }, 2400);

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

      {!firstEmber && mediaUrl ? (
        <>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `url(${mediaUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(24px)',
              transform: 'scale(1.08)',
              opacity: 0.7,
            }}
          />
          <img
            src={mediaUrl}
            alt=""
            className="absolute left-0 right-0 pointer-events-none w-full"
            style={{
              top: 72,
              bottom: 72,
              height: 'calc(100% - 144px)',
              objectFit: 'cover',
              objectPosition: 'center center',
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 25%, transparent 55%, rgba(0,0,0,0.55) 100%)' }}
          />
        </>
      ) : null}

      <div className="absolute top-0 left-0 right-0 z-20 flex items-center gap-3 px-4 pt-4 pb-4">
        <Link
          href="/"
          className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--bg-rail-btn)', WebkitBackdropFilter: 'blur(8px)', backdropFilter: 'blur(8px)' }}
        >
          <Home size={20} color="var(--text-primary)" strokeWidth={1.8} />
        </Link>
        {!firstEmber ? (
          <div className="pointer-events-none flex-1">
            <p className="text-white font-medium text-base leading-tight">{title}</p>
            <p className="text-white/60 text-xs">{subtitle}</p>
          </div>
        ) : null}
      </div>

      {firstEmber ? (
        <div
          className="absolute left-0 right-0 flex flex-col items-center justify-center gap-5"
          style={{ top: 72, bottom: 0 }}
        >
          <div
            className="flex flex-col items-center gap-4 mx-8 px-8 py-10 rounded-2xl"
            style={{ border: '1.5px dashed rgba(255,255,255,0.25)', background: 'rgba(0,0,0,0.6)' }}
          >
            <EmberMark size={56} />
            <div className="flex flex-col items-center gap-1.5 text-center">
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
              className="mt-1 px-6 rounded-full text-white text-sm font-medium flex items-center justify-center can-hover-dim"
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
        className={`absolute right-3 z-20 flex flex-col gap-0 items-center transition-opacity duration-200 ${
          railHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
        style={{ bottom: '11%' }}
      >
        <Link
          href={buildHomeHref({ m: 'user' })}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-colors ${
            modal === 'user' ? 'bg-white/20' : 'hover:bg-white/10 active:bg-white/20'
          }`}
        >
          <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: 'rgba(249,115,22,0.85)' }}>
            <span className="text-white text-sm font-medium">{initials(profile?.name || profile?.email || 'ST')}</span>
          </div>
          <span className="text-white text-xs font-medium lowercase">user</span>
        </Link>
        <RailBtn icon={Share2} label="share" href={buildHomeHref({ m: 'share' })} active={modal === 'share'} />
        <RailBtn icon={Leaf} label="tend" href={buildHomeHref({ m: 'tend' })} active={modal === 'tend'} />
        <RailBtn icon={Play} label="play" href={buildHomeHref({ m: 'play' })} active={modal === 'play'} />
      </div>

      {modal === 'user' ? (
        <Modal closeHref={buildHomeHref({ m: null })}>
          <div className="flex flex-col items-center pt-6 pb-4 gap-2">
            <div className="rounded-full flex items-center justify-center" style={{ width: 66, height: 66, background: 'rgba(249,115,22,0.85)' }}>
              <span className="text-white text-base font-medium">{initials(profile?.name || profile?.email || 'ST')}</span>
            </div>
            <span className="text-white text-base font-medium">{profile?.name || profile?.email || 'Ember User'}</span>
          </div>
          <div className="mx-5" style={{ borderTop: '1px solid var(--border-default)' }} />
          <div className="px-5 py-6 grid grid-cols-3" style={{ gap: '36px 8px' }}>
            <SvgItem label="My Embers" href="/user/my-embers"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></SvgItem>
            <SvgItem label="Shared Embers" href="/user/shared-embers"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></SvgItem>
            <SvgItem label="Create Ember" href="/home?mode=first-ember"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></SvgItem>
            <SvgItem label="Profile" href="/user/profile"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></SvgItem>
            <SvgItem label={isDarkTheme ? 'Light Mode' : 'Dark Mode'} href={buildHomeHref({ m: 'user', theme: isDarkTheme ? 'light' : 'dark' })}>
              {isDarkTheme ? (
                <>
                  <circle cx="12" cy="12" r="4" />
                  <line x1="12" y1="2" x2="12" y2="4" />
                  <line x1="12" y1="20" x2="12" y2="22" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="2" y1="12" x2="4" y2="12" />
                  <line x1="20" y1="12" x2="22" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </>
              ) : (
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              )}
            </SvgItem>
            <SvgItem label="Logout" onClick={handleLogout}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></SvgItem>
          </div>
        </Modal>
      ) : null}

      {modal === 'share' ? (
        <Modal closeHref={buildHomeHref({ m: null })}>
          <div className="flex flex-col items-center pt-6 pb-4 gap-2">
            <div className="rounded-full flex items-center justify-center" style={{ width: 66, height: 66, background: 'var(--bg-surface)' }}>
              <Share2 size={28} color="var(--text-primary)" strokeWidth={1.6} />
            </div>
            <span className="text-white text-base font-medium">Share this ember</span>
          </div>
          <div className="mx-5" style={{ borderTop: '1px solid var(--border-default)' }} />
          <div className="p-5 grid grid-cols-3 gap-1">
            <button type="button" className="flex flex-col items-center gap-2 p-3 rounded-xl opacity-60 can-hover" onClick={() => selectedImageId ? void navigator.clipboard.writeText(`${window.location.origin}/home?id=${selectedImageId}`) : undefined}><div className="w-11 h-11 flex items-center justify-center"><Link2 size={26} color="var(--text-primary)" strokeWidth={1.6} /></div><span className="text-white text-xs font-medium tracking-wide">Copy Link</span></button>
            <button type="button" className="flex flex-col items-center gap-2 p-3 rounded-xl opacity-60 can-hover" onClick={() => selectedImageId ? window.location.assign(`sms:?&body=${encodeURIComponent(`${window.location.origin}/home?id=${selectedImageId}`)}`) : undefined}><div className="w-11 h-11 flex items-center justify-center"><MessageCircle size={26} color="var(--text-primary)" strokeWidth={1.6} /></div><span className="text-white text-xs font-medium tracking-wide">Message</span></button>
            <a href={selectedImageId ? `mailto:?body=${encodeURIComponent(`${window.location.origin}/home?id=${selectedImageId}`)}` : undefined} className="flex flex-col items-center gap-2 p-3 rounded-xl opacity-60 can-hover"><div className="w-11 h-11 flex items-center justify-center"><Mail size={26} color="var(--text-primary)" strokeWidth={1.6} /></div><span className="text-white text-xs font-medium tracking-wide">Email</span></a>
            <a href={selectedImageId ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${window.location.origin}/home?id=${selectedImageId}`)}` : undefined} className="flex flex-col items-center gap-2 p-3 rounded-xl opacity-60 can-hover" target="_blank" rel="noreferrer"><div className="w-11 h-11 flex items-center justify-center"><FacebookIcon /></div><span className="text-white text-xs font-medium tracking-wide">Facebook</span></a>
            <a href={selectedImageId ? `https://twitter.com/intent/tweet?url=${encodeURIComponent(`${window.location.origin}/home?id=${selectedImageId}`)}` : undefined} className="flex flex-col items-center gap-2 p-3 rounded-xl opacity-60 can-hover" target="_blank" rel="noreferrer"><div className="w-11 h-11 flex items-center justify-center"><XIcon /></div><span className="text-white text-xs font-medium tracking-wide">X / Twitter</span></a>
            <button type="button" className="flex flex-col items-center gap-2 p-3 rounded-xl opacity-60 can-hover" onClick={() => selectedImageId ? navigator.share?.({ title, url: `${window.location.origin}/home?id=${selectedImageId}` }) : undefined}><div className="w-11 h-11 flex items-center justify-center"><MoreHorizontal size={26} color="var(--text-primary)" strokeWidth={1.6} /></div><span className="text-white text-xs font-medium tracking-wide">More</span></button>
          </div>
        </Modal>
      ) : null}

      {modal === 'tend' ? (
        <Modal closeHref={buildHomeHref({ m: null })}>
          <div className="flex flex-col items-center pt-6 pb-4 gap-2">
            <div className="rounded-full flex items-center justify-center" style={{ width: 66, height: 66, background: 'var(--bg-surface)' }}>
              <Leaf size={28} color="var(--text-primary)" strokeWidth={1.6} />
            </div>
            <span className="text-white text-base font-medium">Tend &amp; grow this ember</span>
          </div>
          <div className="mx-5" style={{ borderTop: '1px solid var(--border-default)' }} />
          <div className="px-5 py-6 grid grid-cols-3" style={{ gap: '36px 8px' }}>
            <SvgItem label="Add Content" href={selectedImageId ? `/tend/add-content?id=${selectedImageId}` : '/tend/add-content'}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></SvgItem>
            <SvgItem label="View Wiki" href={selectedImageId ? `/tend/view-wiki?id=${selectedImageId}` : '/tend/view-wiki'}><path d="M4 19V6a2 2 0 0 1 2-2h13" /><path d="M4 19a2 2 0 0 0 2 2h13V8H6a2 2 0 0 0-2 2" /></SvgItem>
            <SvgItem label="Edit Snapshot" href={selectedImageId ? `/tend/edit-snapshot?id=${selectedImageId}` : '/tend/edit-snapshot'}><rect x="3" y="3" width="18" height="14" rx="2" /><path d="M8 21h8M12 17v4" /><path d="M7 7l3.5 3.5L15 6" /></SvgItem>
            <SvgItem label="Tag People" href={selectedImageId ? `/tend/tag-people?id=${selectedImageId}` : '/tend/tag-people'}><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></SvgItem>
            <SvgItem label="Edit Title" href={selectedImageId ? `/tend/edit-title?id=${selectedImageId}` : '/tend/edit-title'}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></SvgItem>
            <SvgItem label="Contributors" href={selectedImageId ? `/tend/contributors?id=${selectedImageId}` : '/tend/contributors'}><circle cx="9" cy="8" r="3" /><circle cx="17" cy="8" r="3" /><path d="M2 20c0-3.3 3.1-6 7-6" /><path d="M22 20c0-3.3-3.1-6-7-6" /><path d="M12 20c0-3.3 2-5 4-5" /></SvgItem>
            <div className="col-span-3 flex justify-center">
              <SvgItem label="Settings" href={selectedImageId ? `/tend/settings?id=${selectedImageId}` : '/tend/settings'}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></SvgItem>
            </div>
          </div>
        </Modal>
      ) : null}

      {modal === 'play' ? (
        <KipemberPlayOverlay
          key={`${selectedImageId || 'empty'}:${selectedImage?.wiki?.updatedAt || 'wiki'}:${selectedImage?.storyCut?.script ? 'story-cut' : 'fallback'}`}
          closeHref={buildHomeHref({ m: null })}
          addHref={selectedImageId ? `/tend/add-content?id=${selectedImageId}` : '/tend/add-content'}
          imageId={selectedImageId}
          storyScript={selectedImage?.storyCut?.script || null}
          wikiContent={selectedImage?.wiki?.content || null}
        />
      ) : null}

      {!firstEmber ? (
        <div
          className="absolute bottom-0 left-0 right-0 z-30 flex flex-col"
          style={{ background: 'var(--bg-screen)', WebkitBackdropFilter: 'blur(20px)', backdropFilter: 'blur(20px)', borderTop: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center gap-3 pl-4 pr-[22px] py-3">
            <Link
              href={
                flow
                  ? buildHomeHref({ ember: null, step: null, sub: null })
                  : buildHomeHref({ ember: 'welcome', m: null, step: null, sub: null })
              }
              className="flex-1 text-left"
            >
              <span className="flex items-center gap-2">
                <EmberMark />
                <span className="text-base font-medium text-white">
                  {flow
                    ? 'Ember Chat'
                    : hasConversationHistory
                      ? 'Continue your journey here'
                      : 'Start your journey here'}
                </span>
              </span>
            </Link>
            <Link
              href={
                flow
                  ? buildHomeHref({ ember: null, step: null, sub: null })
                  : buildHomeHref({ ember: 'welcome', m: null, step: null, sub: null })
              }
              className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
              style={{ background: flow ? 'rgba(255,255,255,0.15)' : '#f97316' }}
            >
              {flow ? (
                <ChevronDown size={18} color="var(--text-primary)" strokeWidth={1.8} />
              ) : (
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              )}
            </Link>
          </div>
          {flow ? (
            <WorkflowSlot
              flow={flow}
              imageId={selectedImageId}
              onConversationStateChange={setHasConversationHistory}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
