'use client';

declare global {
  interface Window {
    FaceDetector?: new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => {
      detect: (image: HTMLImageElement) => Promise<{ boundingBox: DOMRectReadOnly }[]>;
    };
  }
}

import { ChevronLeft, ChevronRight, MessageSquarePlus, Phone, Settings, ShieldUser, User, UserRound } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { TEND_ACTIONS, TEND_ICONS } from '@/app/tend/constants';
import { getPreviewMediaUrl } from '@/lib/media';
import KipemberWikiContent, {
  type KipemberAttachment,
  type KipemberContributor,
  type KipemberWikiDetail,
} from '@/components/kipember/KipemberWikiContent';
import EditSnapshotSlider from '@/components/kipember/tend/EditSnapshotSlider';
import EditTitleSlider from '@/components/kipember/tend/EditTitleSlider';
import EditTimePlaceSlider from '@/components/kipember/tend/EditTimePlaceSlider';
import FrameSlider from '@/components/kipember/tend/FrameSlider';
import TagPeopleSlider from '@/components/kipember/tend/TagPeopleSlider';
import ContributorsSlider, {
  type ContributorDetail,
  type TendContributor,
} from '@/components/kipember/tend/ContributorsSlider';
import { getUserDisplayName } from '@/lib/user-name';

function formatDate(value: string | null | undefined) {
  if (!value) {
    return 'Unknown';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function WikiCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl px-4 py-3.5 flex flex-col gap-1" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
      {children}
    </div>
  );
}

type ImageTag = {
  id: string;
  label: string;
  leftPct?: number | null;
  topPct?: number | null;
  widthPct?: number | null;
  heightPct?: number | null;
};

type TendDetail = KipemberWikiDetail & {
  canManage: boolean;
  shareToNetwork: boolean;
  keepPrivate: boolean;
  cropX: number | null;
  cropY: number | null;
  cropWidth: number | null;
  cropHeight: number | null;
  snapshot?: {
    title: string;
    style: string;
    focus: string | null;
    durationSeconds: number;
    wordCount: number;
    script: string;
    metadata: {
      focus: string;
    } | null;
    selectedMediaIds: string[];
    selectedContributorIds: string[];
    includeOwner: boolean;
    includeEmberVoice: boolean;
    emberVoiceId?: string | null;
    updatedAt: string;
  } | null;
  contributors: TendContributor[];
  attachments: KipemberAttachment[];
  tags: ImageTag[];
};

type ContributorRecord = KipemberContributor | TendContributor | ContributorDetail;

type ContributorSubSection = 'profile' | 'contributions' | 'preferences' | null;

// Tiny helpers the parent header still uses for contributors. The full
// helper set lives in ContributorsSlider.
function contributorDisplayName(c: ContributorRecord | null | undefined) {
  if (!c) return 'Contributor';
  return (
    c.name ||
    getUserDisplayName(c.user) ||
    c.email ||
    c.user?.email ||
    c.phoneNumber ||
    c.user?.phoneNumber ||
    'Contributor'
  );
}

export default function TendActionScreen({ action }: { action: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const title = TEND_ACTIONS[action];
  const imageId = searchParams.get('id');
  const view = searchParams.get('view');
  const filterParam = searchParams.get('filter');
  const contributorFilter: 'ember' | 'all' = filterParam === 'all' ? 'all' : 'ember';
  const [detail, setDetail] = useState<TendDetail | null>(null);
  const [cachedCoverUrl, setCachedCoverUrl] = useState<string | null>(null);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id');
    if (id) setCachedCoverUrl(sessionStorage.getItem(`cover-${id}`));
  }, []);
  // selectedContributorDetail + load effect stay in the parent because the
  // slider's header (back button, icon, title) needs the contributor's name
  // derived from it. The slider receives them as props.
  const [selectedContributorDetail, setSelectedContributorDetail] =
    useState<ContributorDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [images, setImages] = useState<Array<{ id: string }>>([]);
  const [status, setStatus] = useState('');
  // Slider state moved to component files:
  //   edit-title       -> EditTitleSlider
  //   edit-time-place  -> EditTimePlaceSlider
  //   frame            -> FrameSlider
  //   tag-people       -> TagPeopleSlider
  //   contributors     -> ContributorsSlider (most state moved; selected
  //                       detail + sub-section stay here for the header)
  const [contributorSubSection, setContributorSubSection] =
    useState<ContributorSubSection>(null);

  useEffect(() => {
    if (imageId) {
      return;
    }

    void fetch('/api/images')
      .then(async (response) => {
        if (!response.ok) {
          return;
        }
        setImages((await response.json()) as Array<{ id: string }>);
      })
      .catch(() => undefined);
  }, [imageId]);

  const resolvedImageId = imageId || images[0]?.id || null;
  const detailPath = resolvedImageId
    ? action === 'contributors'
      ? `/api/images/${resolvedImageId}?scope=contributors`
      : `/api/images/${resolvedImageId}`
    : null;

  function applyDetail(payload: TendDetail) {
    setDetail(payload);
    const url = getPreviewMediaUrl({ mediaType: payload.mediaType, filename: payload.filename, posterFilename: payload.posterFilename });
    if (url && resolvedImageId) {
      sessionStorage.setItem(`cover-${resolvedImageId}`, url);
      setCachedCoverUrl(url);
    }
    // Privacy toggles + Delete now live inline in the wiki Control group
    // (KipemberWikiContent), which calls PATCH/DELETE /api/images directly.
    // Time/date and location/GPS state lives in EditTimePlaceSlider now;
    // it syncs from `detail` via its own useEffect.
    // Frame crop state lives in FrameSlider now; it syncs from `detail`
    // via its own useEffect.
  }

  useEffect(() => {
    if (!resolvedImageId) {
      return;
    }

    if (!detailPath) {
      return;
    }

    const controller = new AbortController();

    void fetch(detailPath, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as TendDetail;
        if (controller.signal.aborted) {
          return;
        }
        applyDetail(payload);
      })
      .catch(() => undefined);

    return () => {
      controller.abort();
    };
  }, [detailPath, resolvedImageId]);

  useEffect(() => {
    if (action !== 'contributors' || !view || view === 'add') {
      setSelectedContributorDetail(null);
      setDetailLoading(false);
      setDetailError('');
      return;
    }

    let cancelled = false;

    async function loadContributorDetail() {
      setDetailLoading(true);
      setDetailError('');

      try {
        const response = await fetch(`/api/contributors/${view}/details`, {
          cache: 'no-store',
        });

        const payload = await response.json().catch(() => null);

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          setSelectedContributorDetail(null);
          setDetailError(payload?.error || 'Failed to load contributor details.');
          return;
        }

        setSelectedContributorDetail(payload as ContributorDetail);
      } catch (error) {
        if (!cancelled) {
          setSelectedContributorDetail(null);
          setDetailError(
            error instanceof Error ? error.message : 'Failed to load contributor details.'
          );
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    }

    void loadContributorDetail();

    return () => {
      cancelled = true;
    };
  }, [action, view]);

  const TendIcon = TEND_ICONS[action];
  const filterSuffix = contributorFilter === 'all' ? '&filter=all' : '';
  const listHref = resolvedImageId ? `/tend/contributors?id=${resolvedImageId}${filterSuffix}` : '/tend/contributors';
  const tendModalHref = resolvedImageId ? `/ember/${resolvedImageId}?m=tend` : '/home';
  const fromParam = searchParams.get('from');
  const backHref = fromParam === 'account'
    ? '/account'
    : fromParam === 'home'
    ? '/home'
    : action === 'contributors' && view ? listHref : tendModalHref;
  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(backHref);
    }
  };
  const contributors: TendContributor[] = detail?.contributors || [];
  const contributor: TendContributor | null =
    contributors.find((item) => item.id === view) || null;
  const contributorSource = selectedContributorDetail || contributor;
  const contributorName = contributorDisplayName(contributorSource);

  // Header sub-section meta (only used when the contributor slider is in a
  // sub-section view). Mirrors what the slider has internally.
  const contributorSubSections: {
    key: 'profile' | 'contributions' | 'preferences';
    icon: React.ReactNode;
    label: string;
  }[] = [
    { key: 'profile', icon: <User size={20} strokeWidth={1.6} />, label: 'Profile' },
    {
      key: 'contributions',
      icon: <MessageSquarePlus size={20} strokeWidth={1.6} />,
      label: 'Contributions',
    },
    { key: 'preferences', icon: <Settings size={20} strokeWidth={1.6} />, label: 'Preferences' },
  ];
  const contributorSubMeta = contributorSubSection
    ? contributorSubSections.find((s) => s.key === contributorSubSection) || null
    : null;

  async function refreshDetail() {
    if (!resolvedImageId) {
      return null;
    }
    if (!detailPath) {
      return null;
    }
    const response = await fetch(detailPath, {
      cache: 'no-store',
    });
    if (response.ok) {
      const payload = (await response.json()) as TendDetail;
      applyDetail(payload);
      return payload;
    }

    return null;
  }

  // The slider needs to refresh the loaded contributor detail after actions
  // like sending an invite or starting a call.
  async function refreshContributorDetail(contributorId: string) {
    const response = await fetch(`/api/contributors/${contributorId}/details`, {
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to load contributor details.');
    }
    setSelectedContributorDetail(payload as ContributorDetail);
    setDetailError('');
    return payload as ContributorDetail;
  }


  const coverPhotoUrl = detail
    ? getPreviewMediaUrl({ mediaType: detail.mediaType, filename: detail.filename, posterFilename: detail.posterFilename })
    : cachedCoverUrl;
  const fromExternal = searchParams.get('from') === 'account' || searchParams.get('from') === 'home';
  const peekBackgroundUrl = fromExternal ? null : coverPhotoUrl;


  if (!title) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 flex justify-center"
      style={{ background: 'var(--bg-screen)' }}
    >
      <div
        className="relative w-full max-w-xl h-full flex"
        style={peekBackgroundUrl ? {
          backgroundImage: `url(${peekBackgroundUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        } : undefined}
      >
      <button type="button" onClick={handleBack} className="w-[7%] h-full" style={{ cursor: 'pointer' }} aria-label="Back" />
      <div
        className="flex-1 h-full flex flex-col slide-in-right"
        style={{ background: 'var(--bg-screen)', borderLeft: '1px solid var(--border-subtle)' }}
      >
        <div
          className="flex items-center gap-3 px-4 pt-6 pb-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          {contributorSubMeta ? (
            <button
              type="button"
              onClick={() => setContributorSubSection(null)}
              className="w-11 h-11 flex items-center justify-center flex-shrink-0 rounded-full can-hover"
              style={{ opacity: 0.75, cursor: 'pointer' }}
            >
              <ChevronLeft size={22} color="var(--text-primary)" strokeWidth={1.8} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleBack}
              className="w-11 h-11 flex items-center justify-center flex-shrink-0 rounded-full can-hover"
              style={{ opacity: 0.75, cursor: 'pointer' }}
            >
              <ChevronLeft size={22} color="var(--text-primary)" strokeWidth={1.8} />
            </button>
          )}
          {contributorSubMeta ? (
            <span className="flex-shrink-0" style={{ color: 'var(--text-primary)' }}>
              {contributorSubMeta.icon}
            </span>
          ) : TendIcon && !(action === 'contributors' && view) ? (
            <TendIcon size={22} color="var(--text-primary)" strokeWidth={1.6} className="flex-shrink-0" />
          ) : null}
          <h2 className="text-white font-medium text-base">
            {contributorSubMeta
              ? contributorSubMeta.label
              : action === 'contributors' && contributorSource
              ? contributorName
              : title}
          </h2>
        </div>

        <div className="flex-1 px-5 min-h-0 flex flex-col overflow-y-auto no-scrollbar py-4 gap-4">
          {action === 'contributors' ? (
            <ContributorsSlider
              detail={detail}
              imageId={resolvedImageId}
              view={view}
              fromParam={fromParam}
              contributorFilter={contributorFilter}
              subSection={contributorSubSection}
              onSubSectionChange={setContributorSubSection}
              selectedContributorDetail={selectedContributorDetail}
              detailLoading={detailLoading}
              detailError={detailError}
              setDetailError={setDetailError}
              refreshContributorDetail={refreshContributorDetail}
              refreshDetail={refreshDetail}
              onStatus={setStatus}
              status={status}
            />
          ) : null}

          {action === 'view-wiki' ? (
            <KipemberWikiContent
              detail={detail}
              refreshDetail={refreshDetail}
              onStatus={setStatus}
            />
          ) : null}

          {action === 'edit-title' ? (
            <EditTitleSlider
              detail={detail}
              imageId={resolvedImageId}
              refreshDetail={refreshDetail}
              onStatus={setStatus}
            />
          ) : null}

          {action === 'edit-snapshot' ? (
            <EditSnapshotSlider
              detail={detail}
              imageId={resolvedImageId}
              refreshDetail={refreshDetail}
              onStatus={setStatus}
            />
          ) : null}


          {action === 'edit-time-place' ? (
            <EditTimePlaceSlider
              detail={detail}
              imageId={resolvedImageId}
              refreshDetail={refreshDetail}
              onStatus={setStatus}
            />
          ) : null}

          {action === 'frame' ? (
            <FrameSlider
              detail={detail}
              imageId={resolvedImageId}
              coverPhotoUrl={coverPhotoUrl}
              refreshDetail={refreshDetail}
              onStatus={setStatus}
            />
          ) : null}

          {action === 'tag-people' ? (
            <TagPeopleSlider
              detail={detail}
              imageId={resolvedImageId}
              coverPhotoUrl={coverPhotoUrl}
            />
          ) : null}

          {status ? <p className="text-sm text-white/60">{status}</p> : null}
        </div>
      </div>
      </div>
    </div>
  );
}
