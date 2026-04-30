'use client';

declare global {
  interface Window {
    FaceDetector?: new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => {
      detect: (image: HTMLImageElement) => Promise<{ boundingBox: DOMRectReadOnly }[]>;
    };
  }
}

import Link from 'next/link';
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
import KipemberSnapshotEditor from '@/components/kipember/KipemberSnapshotEditor';
import EditTitleSlider from '@/components/kipember/tend/EditTitleSlider';
import EditTimePlaceSlider from '@/components/kipember/tend/EditTimePlaceSlider';
import SettingsSlider from '@/components/kipember/tend/SettingsSlider';
import FrameSlider from '@/components/kipember/tend/FrameSlider';
import TagPeopleSlider from '@/components/kipember/tend/TagPeopleSlider';
import ContributorsListView from '@/components/kipember/ContributorsListView';
import type { UnifiedContributor } from '@/lib/contributors-pool';
import { getUserDisplayName } from '@/lib/user-name';

const fieldStyle = {
  background: 'var(--bg-input)',
  border: '1px solid var(--border-input)',
};

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

type ConversationMessage = {
  id: string;
  role?: string | null;
  content: string;
  createdAt: string;
  source?: string | null;
};

type ConversationResponse = {
  id: string;
  questionType?: string | null;
  question?: string | null;
  answer: string;
  source?: string | null;
  createdAt: string;
};

type ContributorVoiceCall = {
  id: string;
  status?: string | null;
  startedAt: string | null;
  endedAt?: string | null;
  createdAt: string;
  callSummary: string | null;
  initiatedBy?: string | null;
};

type ImageTag = {
  id: string;
  label: string;
  leftPct?: number | null;
  topPct?: number | null;
  widthPct?: number | null;
  heightPct?: number | null;
};

type TendContributor = KipemberContributor & {
  token: string;
  inviteSent: boolean;
  voiceCalls: ContributorVoiceCall[];
  conversation: {
    status?: string | null;
    currentStep?: string | null;
    messages: ConversationMessage[];
    responses?: ConversationResponse[];
  } | null;
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

type ContributorDetail = {
  id: string;
  name: string | null;
  email: string | null;
  phoneNumber: string | null;
  inviteSent: boolean;
  createdAt: string;
  user?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    phoneNumber: string | null;
  } | null;
  conversation: {
    status: string | null;
    currentStep: string | null;
    responses: ConversationResponse[];
  } | null;
  voiceCalls: ContributorVoiceCall[];
};

type ContributorRecord = KipemberContributor | TendContributor | ContributorDetail;

type ContributorContribution = {
  id: string;
  label: string;
  timestamp: string;
  preview: string;
  sortAt: number;
};

function initials(value: string | null | undefined) {
  const label = value?.trim() || 'Contributor';
  return label
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function contributorDisplayName(contributor: ContributorRecord | null | undefined) {
  if (!contributor) {
    return 'Contributor';
  }

  return (
    contributor.name ||
    getUserDisplayName(contributor.user) ||
    contributor.email ||
    contributor.user?.email ||
    contributor.phoneNumber ||
    contributor.user?.phoneNumber ||
    'Contributor'
  );
}

function contributorEmail(contributor: ContributorRecord | null | undefined) {
  return contributor?.email || contributor?.user?.email || null;
}

function contributorPhone(contributor: ContributorRecord | null | undefined) {
  return contributor?.phoneNumber || contributor?.user?.phoneNumber || null;
}

function formatPhoneNumber(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const digits = value.replace(/\D/g, '');
  const normalized = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;

  if (normalized.length === 10) {
    return `${normalized.slice(0, 3)}.${normalized.slice(3, 6)}.${normalized.slice(6, 10)}`;
  }

  return value;
}

function formatContributionDate(value: string | null | undefined) {
  if (!value) {
    return 'Unknown';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getContributorPreference(
  phoneNumber: string | null,
  email: string | null
) {
  if (phoneNumber) {
    return 'SMS';
  }

  if (email) {
    return 'Email';
  }

  return 'Private Link';
}

function buildContributorContributions(
  contributor: ContributorDetail | null,
  fallbackContributor: TendContributor | null
) {
  if (!contributor && !fallbackContributor) {
    return [];
  }

  const voiceCallEntries: ContributorContribution[] = (contributor?.voiceCalls || []).map((voiceCall) => {
    const preview = voiceCall.callSummary?.trim() || 'Transcript preview is not available yet.';
    const atValue = voiceCall.startedAt || voiceCall.createdAt;

    return {
      id: `voice-call-${voiceCall.id}`,
      label: 'Phone Call',
      timestamp: formatContributionDate(atValue),
      preview,
      sortAt: new Date(atValue).getTime() || 0,
    };
  });

  const responseEntries: ContributorContribution[] = (contributor?.conversation?.responses || []).map(
    (response) => {
      const question = response.question?.trim();
      const answer = response.answer?.trim();
      const preview = question ? `${question} ${answer}`.trim() : answer || 'Saved response';

      return {
        id: `response-${response.id}`,
        label: 'Saved Response',
        timestamp: formatContributionDate(response.createdAt),
        preview,
        sortAt: new Date(response.createdAt).getTime() || 0,
      };
    }
  );

  const hasDetailContent = voiceCallEntries.length > 0 || responseEntries.length > 0;

  const fallbackEntries: ContributorContribution[] = hasDetailContent
    ? []
    : [
        ...((fallbackContributor?.conversation?.responses || []).map((response) => {
          const question = response.question?.trim();
          const answer = response.answer?.trim();
          const preview = question ? `${question} ${answer}`.trim() : answer || 'Saved response';

          return {
            id: `fallback-response-${response.id}`,
            label: 'Saved Response',
            timestamp: formatContributionDate(response.createdAt),
            preview,
            sortAt: new Date(response.createdAt).getTime() || 0,
          };
        }) as ContributorContribution[]),
        ...((fallbackContributor?.conversation?.messages || []).map((message) => ({
          id: `message-${message.id}`,
          label: 'Story Message',
          timestamp: formatContributionDate(message.createdAt),
          preview: message.content.trim() || 'Saved story message',
          sortAt: new Date(message.createdAt).getTime() || 0,
        })) as ContributorContribution[]),
      ];

  return [...voiceCallEntries, ...responseEntries, ...fallbackEntries].sort(
    (left, right) => right.sortAt - left.sortAt
  );
}

function PrefRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="w-full flex items-center justify-between px-4 rounded-xl"
      style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.07)',
        minHeight: 44,
        opacity: 0.9,
      }}
    >
      <span className="text-white text-sm font-medium">
        {label} <span className="text-white/60 font-normal">({value})</span>
      </span>
      <ChevronLeft size={18} color="var(--text-muted)" className="rotate-[-90deg]" />
    </div>
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
  const [contributorPool, setContributorPool] = useState<UnifiedContributor[] | null>(null);
  const [cachedCoverUrl, setCachedCoverUrl] = useState<string | null>(null);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id');
    if (id) setCachedCoverUrl(sessionStorage.getItem(`cover-${id}`));
  }, []);
  const [selectedContributorDetail, setSelectedContributorDetail] = useState<ContributorDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [sendingContributorId, setSendingContributorId] = useState('');
  const [callingContributorId, setCallingContributorId] = useState('');
  const [images, setImages] = useState<Array<{ id: string }>>([]);
  const [status, setStatus] = useState('');
  // Title slider state moved to EditTitleSlider — kept this comment as a
  // breadcrumb so future migrations of other sliders see the pattern.
  // Settings slider state moved to SettingsSlider.
  // Time/place slider state moved to EditTimePlaceSlider.
  // Frame slider state moved to FrameSlider.
  const [addForm, setAddForm] = useState({ firstName: '', lastName: '', phone: '', email: '' });
  const [savedForm, setSavedForm] = useState({ firstName: '', lastName: '', phone: '', email: '' });
  const [editingContributor, setEditingContributor] = useState(false);
  const [savingContributor, setSavingContributor] = useState(false);
  const [contributorSubSection, setContributorSubSection] = useState<'profile' | 'contributions' | 'preferences' | null>(null);
  // Tag-people slider state moved to TagPeopleSlider.

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
    // Settings toggles now live in SettingsSlider; it syncs from `detail`
    // via its own useEffect.
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

  // Load the unified contributor pool when on the contributors list view.
  // Powers both the "This Ember" and "All" filters; back-nav preserves filter via URL.
  useEffect(() => {
    if (action !== 'contributors' || view) return;
    let cancelled = false;
    async function load() {
      try {
        const qs = imageId ? `?emberId=${encodeURIComponent(imageId)}` : '';
        const res = await fetch(`/api/contributors/pool${qs}`, { cache: 'no-store' });
        if (!res.ok) return;
        const payload = (await res.json()) as { contributors?: UnifiedContributor[] };
        if (!cancelled && payload?.contributors) setContributorPool(payload.contributors);
      } catch {
        /* leave pool null; UI shows empty state */
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [action, view, imageId]);

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

  // Pre-populate edit form when contributor detail loads
  useEffect(() => {
    if (!contributorSource) return;
    const nameParts = contributorDisplayName(contributorSource).trim().split(/\s+/);
    const populated = {
      firstName: nameParts[0] ?? '',
      lastName: nameParts.slice(1).join(' '),
      phone: contributorPhone(contributorSource) ?? '',
      email: contributorEmail(contributorSource) ?? '',
    };
    setAddForm(populated);
    setSavedForm(populated);
    setContributorSubSection(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contributorSource?.id]);
  const contributorName = contributorDisplayName(contributorSource);
  const contributorPhoneNumber = contributorPhone(contributorSource);
  const contributorEmailAddress = contributorEmail(contributorSource);
  const contributorPhoneLabel = formatPhoneNumber(contributorPhoneNumber);
  const contributorPreference = getContributorPreference(
    contributorPhoneNumber,
    contributorEmailAddress
  );
  const contributionEntries = buildContributorContributions(selectedContributorDetail, contributor);

  const contributorSections: {
    key: 'profile' | 'contributions' | 'preferences';
    icon: React.ReactNode;
    label: string;
  }[] = [
    { key: 'profile',       icon: <User size={20} strokeWidth={1.6} />,            label: 'Profile' },
    { key: 'contributions', icon: <MessageSquarePlus size={20} strokeWidth={1.6} />, label: 'Contributions' },
    { key: 'preferences',   icon: <Settings size={20} strokeWidth={1.6} />,        label: 'Preferences' },
  ];
  const contributorSubMeta = contributorSubSection
    ? contributorSections.find((s) => s.key === contributorSubSection) || null
    : null;
  const contributorAvatarFilename = contributor?.user?.avatarFilename || null;
  const contributorCreatedAt = contributorSource?.createdAt || null;
  const contributionHeading = `${contributorName.split(/\s+/)[0] || 'Contributor'}'s Contributions`;
  const canManageContributors = Boolean(detail?.canManage);

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



  async function addContributor() {
    if (!resolvedImageId) {
      return;
    }
    const response = await fetch('/api/contributors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageId: resolvedImageId,
        name: `${addForm.firstName} ${addForm.lastName}`.trim(),
        phoneNumber: addForm.phone,
        email: addForm.email,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(payload?.error || 'Failed to add contributor.');
      return;
    }
    setStatus('Contributor added.');
    setAddForm({ firstName: '', lastName: '', phone: '', email: '' });
    await refreshDetail();
  }

  async function updateContributor() {
    if (!view) return;
    setSavingContributor(true);
    const response = await fetch(`/api/contributors/${view}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${addForm.firstName} ${addForm.lastName}`.trim(),
        phoneNumber: addForm.phone,
        email: addForm.email,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    setSavingContributor(false);
    if (!response.ok) {
      setStatus(payload?.error || 'Failed to update contributor.');
      return;
    }
    setSavedForm(addForm);
    setStatus('Saved.');
    await refreshDetail();
  }

  async function copyLink(token: string | null | undefined) {
    if (!token) {
      setStatus('No contributor link is available.');
      return;
    }

    try {
      const url = `${window.location.origin}/contribute/${token}`;
      await navigator.clipboard.writeText(url);
      setStatus('Contributor link copied.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to copy contributor link.');
    }
  }

  async function handleSendInvite(contributorId: string) {
    setSendingContributorId(contributorId);
    setDetailError('');

    try {
      const response = await fetch('/api/twilio/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contributorId }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setStatus(payload?.error || 'Failed to send the text invite.');
        return;
      }

      setStatus('Text invite sent.');
      await refreshDetail();

      if (view === contributorId) {
        await refreshContributorDetail(contributorId);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to send the text invite.');
    } finally {
      setSendingContributorId('');
    }
  }

  async function handleStartVoiceCall(contributorId: string) {
    setCallingContributorId(contributorId);
    setDetailError('');

    try {
      const response = await fetch('/api/voice/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contributorId }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setStatus(payload?.error || 'Failed to start the phone call.');
        return;
      }

      setStatus('Phone call started.');
      await refreshDetail();

      if (view === contributorId) {
        await refreshContributorDetail(contributorId);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to start the phone call.');
    } finally {
      setCallingContributorId('');
    }
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
        className="w-[93%] h-full flex flex-col slide-in-right"
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
          {action === 'contributors' && !view ? (
            (() => {
              if (!resolvedImageId) return null;
              const baseHref = `/tend/contributors?id=${resolvedImageId}`;
              const fromSuffix = fromParam ? `&from=${fromParam}` : '';
              const filtered = (contributorPool ?? []).filter((c) =>
                contributorFilter === 'ember' ? c.onThisEmber : true
              );
              return (
                <ContributorsListView
                  contributors={filtered}
                  context={{
                    kind: 'ember',
                    emberId: resolvedImageId,
                    canManage: canManageContributors,
                    addNewHref: `${baseHref}${filterSuffix}&view=add${fromSuffix}`,
                    rowDetailHref: ({ contributorIdOnThisEmber }) =>
                      `${baseHref}${filterSuffix}&view=${contributorIdOnThisEmber}${fromSuffix}`,
                    filter: contributorFilter,
                    filterHrefs: {
                      ember: `${baseHref}${fromSuffix}`,
                      all: `${baseHref}&filter=all${fromSuffix}`,
                    },
                  }}
                />
              );
            })()
          ) : null}

          {action === 'contributors' && view === 'add' ? (
            <>
              {[
                ['firstName', 'First Name'],
                ['lastName', 'Last Name (optional)'],
                ['phone', 'Phone'],
                ['email', 'Email (optional)'],
              ].map(([key, placeholder]) => (
                <input
                  key={key}
                  value={addForm[key as keyof typeof addForm]}
                  onChange={(event) =>
                    setAddForm((current) => ({ ...current, [key]: event.target.value }))
                  }
                  placeholder={placeholder}
                  className="w-full h-12 rounded-xl px-4 text-sm text-white placeholder-white/30 outline-none"
                  style={fieldStyle}
                />
              ))}
              <div className="py-2 flex gap-3">
                <Link
                  href={listHref}
                  className="flex-1 flex items-center justify-center rounded-full text-white text-sm font-medium btn-secondary"
                  style={{ background: 'transparent', border: '1.5px solid var(--border-btn)', minHeight: 44 }}
                >
                  Cancel
                </Link>
                <button
                  type="button"
                  onClick={addContributor}
                  className="flex-1 flex items-center justify-center rounded-full text-white text-sm font-medium can-hover-dim btn-primary"
                  style={{ background: '#f97316', minHeight: 44 }}
                >
                  Save
                </button>
              </div>
            </>
          ) : null}

          {action === 'contributors' && contributorSource ? (
            <>
              {/* ── Main view ── */}
              {!contributorSubSection ? (
                <div className="flex flex-col items-center gap-6 py-2">
                  {/* Avatar + name + Member since */}
                  <div className="flex flex-col items-center gap-3">
                    <div
                      className="rounded-full overflow-hidden flex items-center justify-center"
                      style={{ width: 80, height: 80, background: 'rgba(249,115,22,0.85)' }}
                    >
                      {contributorAvatarFilename ? (
                        <img src={`/api/uploads/${contributorAvatarFilename}`} alt={contributorName} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white text-2xl font-medium">{initials(contributorName)}</span>
                      )}
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-white font-semibold text-base">{contributorName}</span>
                      {contributorCreatedAt ? (
                        <span className="text-white/30 text-xs mt-1">
                          Member since {new Date(contributorCreatedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Menu */}
                  <div className="w-full rounded-xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                    {contributorSections.map((s, i) => (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => setContributorSubSection(s.key)}
                        className="w-full flex items-center gap-3 px-4"
                        style={{
                          minHeight: 52,
                          cursor: 'pointer',
                          borderTop: i > 0 ? '1px solid var(--border-subtle)' : undefined,
                        }}
                      >
                        <span style={{ color: 'var(--text-secondary)' }}>{s.icon}</span>
                        <span className="flex-1 text-left text-sm text-white">{s.label}</span>
                        <ChevronRight size={16} color="var(--text-secondary)" strokeWidth={1.8} />
                      </button>
                    ))}
                  </div>

                  {/* Call Now / Send Text Now */}
                  <div className="w-full flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (contributor && contributorPhoneNumber) {
                          void handleStartVoiceCall(contributor.id);
                        } else if (contributor?.token) {
                          void copyLink(contributor.token);
                        }
                      }}
                      disabled={
                        !canManageContributors ||
                        (!contributorPhoneNumber && !contributor?.token) ||
                        callingContributorId === contributor?.id
                      }
                      className="flex-1 flex items-center justify-center rounded-full text-white text-sm font-medium btn-secondary disabled:opacity-40"
                      style={{
                        background: 'transparent',
                        border: '1.5px solid var(--border-btn)',
                        minHeight: 44,
                      }}
                    >
                      {contributorPhoneNumber ? 'Call Now' : 'Copy Link'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (contributor && contributorPhoneNumber) {
                          void handleSendInvite(contributor.id);
                        } else if (contributor?.token) {
                          void copyLink(contributor.token);
                        }
                      }}
                      disabled={
                        !canManageContributors ||
                        (!contributorPhoneNumber && !contributor?.token) ||
                        sendingContributorId === contributor?.id
                      }
                      className="flex-1 flex items-center justify-center rounded-full text-white text-sm font-medium can-hover-dim btn-primary disabled:opacity-40"
                      style={{ background: '#f97316', minHeight: 44 }}
                    >
                      Send Text Now
                    </button>
                  </div>
                </div>
              ) : null}

              {/* ── Profile ── */}
              {contributorSubSection === 'profile' ? (
                <>
                  <div className="rounded-xl px-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                    <input
                      type="text"
                      value={addForm.firstName}
                      onChange={(e) => setAddForm((f) => ({ ...f, firstName: e.target.value }))}
                      placeholder="First name"
                      className="w-full h-12 px-0 text-sm text-white placeholder-white/30 outline-none bg-transparent"
                    />
                    <input
                      type="text"
                      value={addForm.lastName}
                      onChange={(e) => setAddForm((f) => ({ ...f, lastName: e.target.value }))}
                      placeholder="Last name"
                      className="w-full h-12 px-0 text-sm text-white placeholder-white/30 outline-none bg-transparent"
                      style={{ borderTop: '1px solid var(--border-subtle)' }}
                    />
                    <input
                      type="email"
                      value={addForm.email}
                      onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="Email"
                      className="w-full h-12 px-0 text-sm text-white placeholder-white/30 outline-none bg-transparent"
                      style={{ borderTop: '1px solid var(--border-subtle)' }}
                    />
                    <input
                      type="tel"
                      value={addForm.phone}
                      onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="Phone"
                      className="w-full h-12 px-0 text-sm text-white placeholder-white/30 outline-none bg-transparent"
                      style={{ borderTop: '1px solid var(--border-subtle)' }}
                    />
                  </div>
                  {(() => {
                    const isDirty =
                      addForm.firstName !== savedForm.firstName ||
                      addForm.lastName !== savedForm.lastName ||
                      addForm.phone !== savedForm.phone ||
                      addForm.email !== savedForm.email;
                    return (
                      <div className="flex justify-between items-center px-1">
                        {status ? <span className="text-xs text-white/50">{status}</span> : <span />}
                        <button
                          type="button"
                          onClick={() => void updateContributor()}
                          disabled={savingContributor || !isDirty}
                          className="w-1/2 rounded-full px-5 text-white text-sm font-medium transition-colors"
                          style={{
                            background: isDirty ? '#f97316' : 'var(--bg-surface)',
                            border: isDirty ? 'none' : '1px solid var(--border-subtle)',
                            minHeight: 44,
                            cursor: isDirty ? 'pointer' : 'default',
                            opacity: savingContributor ? 0.6 : 1,
                          }}
                        >
                          {savingContributor ? 'Updating…' : 'Update'}
                        </button>
                      </div>
                    );
                  })()}
                </>
              ) : null}

              {/* ── Contributions ── */}
              {contributorSubSection === 'contributions' ? (
                <div>
                  {detailLoading ? (
                    <div
                      className="rounded-xl px-4 py-3"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      <p className="text-white/30 text-xs italic">Loading contributor details...</p>
                    </div>
                  ) : null}

                  {detailError ? (
                    <div
                      className="rounded-xl px-4 py-3 mb-4"
                      style={{
                        background: 'rgba(94,20,20,0.48)',
                        border: '1px solid rgba(255,119,119,0.35)',
                      }}
                    >
                      <p className="text-[rgba(255,210,210,0.94)] text-sm">{detailError}</p>
                    </div>
                  ) : null}

                  {!detailLoading && !detailError && contributionEntries.length === 0 ? (
                    <p className="text-white/30 text-sm">No contributions yet.</p>
                  ) : null}

                  {!detailLoading && !detailError
                    ? contributionEntries.map((entry) => (
                        <div key={entry.id} className="mb-4">
                          <p className="text-white/60 text-xs font-medium mb-1">
                            {entry.label} · <span className="text-white/30">{entry.timestamp}</span>
                          </p>
                          <div
                            className="rounded-xl px-4 py-3"
                            style={{
                              background: 'rgba(255,255,255,0.04)',
                              border: '1px solid rgba(255,255,255,0.06)',
                            }}
                          >
                            <p className="text-white/45 text-xs leading-relaxed">
                              {entry.preview}
                            </p>
                          </div>
                        </div>
                      ))
                    : null}
                </div>
              ) : null}

              {/* ── Preferences ── */}
              {contributorSubSection === 'preferences' ? (
                <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                  <div className="flex items-center justify-between px-4" style={{ minHeight: 44 }}>
                    <span className="text-white text-sm font-medium">Prefers <span className="text-white/50 font-normal">({contributorPreference})</span></span>
                  </div>
                  <div className="flex items-center justify-between px-4" style={{ minHeight: 44, borderTop: '1px solid var(--border-subtle)' }}>
                    <span className="text-white text-sm font-medium">Contact Time <span className="text-white/50 font-normal">(Not set)</span></span>
                  </div>
                  <div className="flex items-center justify-between px-4" style={{ minHeight: 44, borderTop: '1px solid var(--border-subtle)' }}>
                    <span className="text-white text-sm font-medium">Language <span className="text-white/50 font-normal">(English)</span></span>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          {action === 'view-wiki' ? <KipemberWikiContent detail={detail} /> : null}

          {action === 'edit-title' ? (
            <EditTitleSlider
              detail={detail}
              imageId={resolvedImageId}
              refreshDetail={refreshDetail}
              onStatus={setStatus}
            />
          ) : null}

          {action === 'edit-snapshot' ? (
            <KipemberSnapshotEditor
              detail={detail}
              imageId={resolvedImageId}
              refreshDetail={refreshDetail}
              onStatus={setStatus}
            />
          ) : null}


          {action === 'settings' ? (
            <SettingsSlider
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
