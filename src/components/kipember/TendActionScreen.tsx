'use client';

declare global {
  interface Window {
    FaceDetector?: new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => {
      detect: (image: HTMLImageElement) => Promise<{ boundingBox: DOMRectReadOnly }[]>;
    };
  }
}

import Link from 'next/link';
import { ChevronLeft, MessageSquare, Pencil, Phone, ShieldUser, X } from 'lucide-react';
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

type TitleQuoteSuggestion = {
  title: string;
  contributorName: string;
  quote: string;
  source: 'voice' | 'text';
};

type TitleSuggestionResponse = {
  analysisSuggestions: string[];
  contextSuggestions: string[];
  contributorQuotes: TitleQuoteSuggestion[];
  suggestions: string[];
};

type FaceTag = {
  id: string;       // local React key (temp id before save, then db id)
  dbId: string | null; // null until saved to DB
  x: number; // center % of image width
  y: number; // center % of image height
  color: string;
  name: string;
};

const CIRCLE_SIZE = 12; // % of image width
const TAG_COLORS = ['#f97316', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#ef4444'];

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
  storyCut?: {
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
    name: string | null;
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
    contributor.user?.name ||
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
  const [detail, setDetail] = useState<TendDetail | null>(null);
  const [selectedContributorDetail, setSelectedContributorDetail] = useState<ContributorDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [sendingContributorId, setSendingContributorId] = useState('');
  const [callingContributorId, setCallingContributorId] = useState('');
  const [images, setImages] = useState<Array<{ id: string }>>([]);
  const [status, setStatus] = useState('');
  const [titleValue, setTitleValue] = useState('');
  const [titleSuggestions, setTitleSuggestions] = useState<TitleSuggestionResponse | null>(null);
  const [titleSuggestionsLoading, setTitleSuggestionsLoading] = useState(false);
  const [titleSuggestionsRefreshing, setTitleSuggestionsRefreshing] = useState(false);
  const [titleSuggestionsError, setTitleSuggestionsError] = useState('');
  const [networkValue, setNetworkValue] = useState(false);
  const [deletingImage, setDeletingImage] = useState(false);
  const [timeDateValue, setTimeDateValue] = useState('');
  const [timeDateSaving, setTimeDateSaving] = useState(false);
  const [locationLabel, setLocationLabel] = useState('');
  const [locationDetail, setLocationDetail] = useState('');
  const [locationLatitude, setLocationLatitude] = useState('');
  const [locationLongitude, setLocationLongitude] = useState('');
  const [locationSaving, setLocationSaving] = useState(false);
  const [addForm, setAddForm] = useState({ firstName: '', lastName: '', phone: '', email: '' });
  const [detectedFaces, setDetectedFaces] = useState<{ leftPct: number; topPct: number; widthPct: number; heightPct: number }[]>([]);
  const [imgAspectRatio, setImgAspectRatio] = useState(1);
  const [faceTags, setFaceTags] = useState<FaceTag[]>([]);
  const [taggingMode, setTaggingMode] = useState(true);
  const [draggingTagId, setDraggingTagId] = useState<string | null>(null);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const tagImgRef = useRef<HTMLImageElement | null>(null);
  const imageContainerRef = useRef<HTMLDivElement | null>(null);
  const dragStart = useRef<{ clientX: number; clientY: number; origX: number; origY: number } | null>(null);
  const faceTagsRef = useRef(faceTags);
  const savePositionRef = useRef<(tagId: string) => void>(() => {});

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
    setTitleValue(payload.title || payload.originalName?.replace(/\.[^.]+$/, '') || '');
    setNetworkValue(Boolean(payload.shareToNetwork));
    // Populate time/date
    const capturedAt = payload.analysis?.capturedAt;
    if (capturedAt) {
      const d = new Date(capturedAt);
      if (!Number.isNaN(d.getTime())) {
        // datetime-local expects "YYYY-MM-DDTHH:MM"
        const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
        setTimeDateValue(local);
      }
    }
    // Populate location
    const loc = payload.analysis?.confirmedLocation;
    setLocationLabel(loc?.label || '');
    setLocationDetail(loc?.detail || '');
    const lat = payload.analysis?.latitude ?? loc?.latitude ?? null;
    const lng = payload.analysis?.longitude ?? loc?.longitude ?? null;
    setLocationLatitude(lat != null ? String(lat) : '');
    setLocationLongitude(lng != null ? String(lng) : '');
  }

  useEffect(() => {
    if (!resolvedImageId) {
      return;
    }

    if (!detailPath) {
      return;
    }

    void fetch(detailPath)
      .then(async (response) => {
        if (!response.ok) {
          return;
        }
        applyDetail((await response.json()) as TendDetail);
      })
      .catch(() => undefined);
  }, [detailPath, resolvedImageId]);

  useEffect(() => {
    if (action !== 'edit-title' || !resolvedImageId) {
      setTitleSuggestions(null);
      setTitleSuggestionsLoading(false);
      setTitleSuggestionsRefreshing(false);
      setTitleSuggestionsError('');
      return;
    }

    let cancelled = false;

    async function loadSuggestions(refresh = false) {
      if (refresh) {
        setTitleSuggestionsRefreshing(true);
      } else {
        setTitleSuggestionsLoading(true);
      }

      setTitleSuggestionsError('');

      try {
        const response = await fetch(
          `/api/images/${resolvedImageId}/title-suggestions${refresh ? '?refresh=1' : ''}`,
          { cache: 'no-store' }
        );
        const payload = (await response.json().catch(() => null)) as
          | TitleSuggestionResponse
          | { error?: string }
          | null;

        if (cancelled) {
          return;
        }

        if (!response.ok || !payload || !('suggestions' in payload)) {
          setTitleSuggestions(null);
          setTitleSuggestionsError(
            payload && 'error' in payload
              ? payload.error || 'Failed to load title suggestions.'
              : 'Failed to load title suggestions.'
          );
          return;
        }

        setTitleSuggestions(payload);
      } catch (error) {
        if (!cancelled) {
          setTitleSuggestions(null);
          setTitleSuggestionsError(
            error instanceof Error ? error.message : 'Failed to load title suggestions.'
          );
        }
      } finally {
        if (!cancelled) {
          setTitleSuggestionsLoading(false);
          setTitleSuggestionsRefreshing(false);
        }
      }
    }

    void loadSuggestions();

    return () => {
      cancelled = true;
    };
  }, [action, resolvedImageId]);

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
  const listHref = resolvedImageId ? `/tend/contributors?id=${resolvedImageId}` : '/tend/contributors';
  const tendModalHref = resolvedImageId ? `/home?id=${resolvedImageId}&m=tend` : '/home?m=tend';
  const backHref = action === 'contributors' && view ? listHref : tendModalHref;
  const contributors: TendContributor[] = detail?.contributors || [];
  const contributor: TendContributor | null =
    contributors.find((item) => item.id === view) || null;
  const contributorSource = selectedContributorDetail || contributor;
  const contributorName = contributorDisplayName(contributorSource);
  const contributorPhoneNumber = contributorPhone(contributorSource);
  const contributorEmailAddress = contributorEmail(contributorSource);
  const contributorPhoneLabel = formatPhoneNumber(contributorPhoneNumber);
  const contributorPreference = getContributorPreference(
    contributorPhoneNumber,
    contributorEmailAddress
  );
  const contributionEntries = buildContributorContributions(selectedContributorDetail, contributor);
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

  async function saveTitle() {
    if (!resolvedImageId) {
      return;
    }
    const response = await fetch(`/api/images/${resolvedImageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: titleValue }),
    });
    setStatus(response.ok ? 'Title saved.' : 'Failed to save title.');
    await refreshDetail();
  }

  async function refreshTitleSuggestions() {
    if (!resolvedImageId) {
      return;
    }

    setTitleSuggestionsRefreshing(true);
    setTitleSuggestionsError('');

    try {
      const response = await fetch(`/api/images/${resolvedImageId}/title-suggestions?refresh=1`, {
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => null)) as
        | TitleSuggestionResponse
        | { error?: string }
        | null;

      if (!response.ok || !payload || !('suggestions' in payload)) {
        setTitleSuggestions(null);
        setTitleSuggestionsError(
          payload && 'error' in payload
            ? payload.error || 'Failed to refresh title suggestions.'
            : 'Failed to refresh title suggestions.'
        );
        return;
      }

      setTitleSuggestions(payload);
      setStatus('Title suggestions refreshed.');
    } catch (error) {
      setTitleSuggestionsError(
        error instanceof Error ? error.message : 'Failed to refresh title suggestions.'
      );
    } finally {
      setTitleSuggestionsRefreshing(false);
    }
  }

  async function saveTimeDate() {
    if (!resolvedImageId || !timeDateValue) return;
    setTimeDateSaving(true);
    setStatus('');
    try {
      const response = await fetch(`/api/images/${resolvedImageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capturedAt: new Date(timeDateValue).toISOString() }),
      });
      setStatus(response.ok ? 'Time & date saved.' : 'Failed to save time & date.');
      if (response.ok) await refreshDetail();
    } catch {
      setStatus('Failed to save time & date.');
    } finally {
      setTimeDateSaving(false);
    }
  }

  async function saveLocation() {
    if (!resolvedImageId || !locationLabel.trim()) {
      setStatus('A location name is required.');
      return;
    }
    setLocationSaving(true);
    setStatus('');
    try {
      const body: Record<string, unknown> = {
        label: locationLabel.trim(),
        detail: locationDetail.trim() || null,
        kind: 'place',
      };
      const lat = parseFloat(locationLatitude);
      const lng = parseFloat(locationLongitude);
      if (!Number.isNaN(lat)) body.latitude = lat;
      if (!Number.isNaN(lng)) body.longitude = lng;

      const response = await fetch(`/api/images/${resolvedImageId}/location-suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setStatus(response.ok ? 'Location saved.' : 'Failed to save location.');
      if (response.ok) await refreshDetail();
    } catch {
      setStatus('Failed to save location.');
    } finally {
      setLocationSaving(false);
    }
  }

  async function saveSettings() {
    if (!resolvedImageId) {
      return;
    }
    const response = await fetch(`/api/images/${resolvedImageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shareToNetwork: networkValue }),
    });
    setStatus(response.ok ? 'Settings saved.' : 'Failed to save settings.');
    await refreshDetail();
  }

  async function deleteEmber() {
    if (!resolvedImageId || !detail?.canManage || deletingImage) {
      return;
    }

    const confirmed = window.confirm('Delete this Ember? This cannot be undone.');
    if (!confirmed) {
      return;
    }

    setDeletingImage(true);
    setStatus('');

    try {
      const response = await fetch(`/api/images/${resolvedImageId}`, {
        method: 'DELETE',
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setStatus(payload?.error || 'Failed to delete ember.');
        return;
      }

      router.push('/home');
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to delete ember.');
    } finally {
      setDeletingImage(false);
    }
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

  async function addAttachment(file: File) {
    if (!resolvedImageId) {
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`/api/images/${resolvedImageId}/attachments`, {
      method: 'POST',
      body: formData,
    });
    const payload = await response.json().catch(() => ({}));
    setStatus(response.ok ? 'Content added.' : payload?.error || 'Failed to add content.');
    await refreshDetail();
  }

  // Keep refs in sync so drag-end closure always has fresh values
  useEffect(() => { faceTagsRef.current = faceTags; }, [faceTags]);
  savePositionRef.current = (tagId: string) => {
    const tag = faceTagsRef.current.find((t) => t.id === tagId);
    if (!tag?.dbId || !resolvedImageId) return;
    fetch(`/api/images/${resolvedImageId}/tags/${tag.dbId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leftPct: tag.x - CIRCLE_SIZE / 2,
        topPct: tag.y - (CIRCLE_SIZE * imgAspectRatio) / 2,
        widthPct: CIRCLE_SIZE,
        heightPct: CIRCLE_SIZE * imgAspectRatio,
        refreshWiki: false,
      }),
    }).catch(() => {});
  };

  // Load existing tags from detail when slider opens
  useEffect(() => {
    if (!detail?.tags) return;
    const positioned = detail.tags.filter(
      (t) => t.leftPct != null && t.topPct != null && t.widthPct != null && t.heightPct != null
    );
    if (positioned.length === 0) return;
    setFaceTags(
      positioned.map((t, i) => ({
        id: t.id,
        dbId: t.id,
        x: t.leftPct! + t.widthPct! / 2,
        y: t.topPct! + t.heightPct! / 2,
        color: TAG_COLORS[i % TAG_COLORS.length],
        name: t.label,
      }))
    );
  }, [detail?.tags]);

  useEffect(() => {
    if (!draggingTagId) return;
    const container = imageContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    function onMove(e: PointerEvent) {
      const d = dragStart.current;
      if (!d) return;
      const dx = ((e.clientX - d.clientX) / rect.width) * 100;
      const dy = ((e.clientY - d.clientY) / rect.height) * 100;
      setFaceTags((prev) =>
        prev.map((t) =>
          t.id === draggingTagId
            ? { ...t, x: Math.max(0, Math.min(100, d.origX + dx)), y: Math.max(0, Math.min(100, d.origY + dy)) }
            : t
        )
      );
    }

    function onUp() {
      const tagId = draggingTagId;
      setDraggingTagId(null);
      dragStart.current = null;
      if (tagId) savePositionRef.current(tagId);
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [draggingTagId]);

  async function handleImageClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!taggingMode || draggingTagId) return;
    const container = imageContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const color = TAG_COLORS[faceTags.length % TAG_COLORS.length];
    const tempId = `tag-${Date.now()}`;
    const defaultName = `Person ${faceTags.length + 1}`;
    setFaceTags((prev) => [...prev, { id: tempId, dbId: null, x, y, color, name: defaultName }]);
    setEditingTagId(tempId);
    setEditingName(defaultName);

    if (resolvedImageId) {
      const ar = imgAspectRatio;
      const res = await fetch(`/api/images/${resolvedImageId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: defaultName,
          leftPct: x - CIRCLE_SIZE / 2,
          topPct: y - (CIRCLE_SIZE * ar) / 2,
          widthPct: CIRCLE_SIZE,
          heightPct: CIRCLE_SIZE * ar,
          refreshWiki: false,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (res.ok && payload?.tag?.id) {
        const dbId = payload.tag.id as string;
        setFaceTags((prev) =>
          prev.map((t) => (t.id === tempId ? { ...t, id: dbId, dbId } : t))
        );
        setEditingTagId((prev) => (prev === tempId ? dbId : prev));
      }
    }
  }

  function handleCirclePointerDown(e: React.PointerEvent<HTMLDivElement>, tag: FaceTag) {
    if (!taggingMode) return;
    e.stopPropagation();
    e.preventDefault();
    dragStart.current = { clientX: e.clientX, clientY: e.clientY, origX: tag.x, origY: tag.y };
    setDraggingTagId(tag.id);
  }

  async function handleDeleteTag(id: string) {
    const tag = faceTags.find((t) => t.id === id);
    setFaceTags((prev) => prev.filter((t) => t.id !== id));
    if (editingTagId === id) setEditingTagId(null);
    if (tag?.dbId && resolvedImageId) {
      await fetch(`/api/images/${resolvedImageId}/tags/${tag.dbId}`, { method: 'DELETE' });
    }
  }

  function handleEditTag(tag: FaceTag) {
    setEditingTagId(tag.id);
    setEditingName(tag.name);
  }

  async function handleSaveTagName(id: string) {
    const tag = faceTags.find((t) => t.id === id);
    const name = editingName.trim() || tag?.name || 'Unknown';
    setFaceTags((prev) => prev.map((t) => (t.id === id ? { ...t, name } : t)));
    setEditingTagId(null);
    if (tag?.dbId && resolvedImageId) {
      await fetch(`/api/images/${resolvedImageId}/tags/${tag.dbId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: name, refreshWiki: false }),
      });
    }
  }

  const coverPhotoUrl = detail
    ? getPreviewMediaUrl({ mediaType: detail.mediaType, filename: detail.filename, posterFilename: detail.posterFilename })
    : null;

  const [detectingFaces, setDetectingFaces] = useState(false);

  async function handleDetectFaces() {
    const img = tagImgRef.current;
    if (!img || !resolvedImageId || detectingFaces) return;
    setDetectingFaces(true);
    setDetectedFaces([]);
    setImgAspectRatio(img.naturalWidth / img.naturalHeight);
    try {
      if (typeof window !== 'undefined' && window.FaceDetector) {
        const detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 20 });
        const faces = await detector.detect(img);
        setDetectedFaces(faces.map((f) => ({
          leftPct: (f.boundingBox.x / img.naturalWidth) * 100,
          topPct: (f.boundingBox.y / img.naturalHeight) * 100,
          widthPct: (f.boundingBox.width / img.naturalWidth) * 100,
          heightPct: (f.boundingBox.height / img.naturalHeight) * 100,
        })));
      } else {
        const res = await fetch(`/api/images/${resolvedImageId}/detect-faces`, { method: 'POST' });
        const payload = await res.json().catch(() => ({}));
        setDetectedFaces(payload?.faces ?? []);
      }
    } catch {
      // silently skip
    } finally {
      setDetectingFaces(false);
    }
  }

  if (!title) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 flex"
      style={coverPhotoUrl ? {
        backgroundImage: `url(${coverPhotoUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      } : undefined}
    >
      <Link href={backHref} className="w-[7%] h-full" />
      <div
        className="w-[93%] h-full flex flex-col slide-in-right"
        style={{ background: 'var(--bg-screen)', borderLeft: '1px solid var(--border-subtle)' }}
      >
        <div
          className="flex items-center gap-3 px-4 pt-6 pb-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          <Link
            href={backHref}
            className="w-11 h-11 flex items-center justify-center flex-shrink-0 rounded-full can-hover"
            style={{ opacity: 0.75 }}
          >
            <ChevronLeft size={22} color="var(--text-primary)" strokeWidth={1.8} />
          </Link>
          {TendIcon && !(action === 'contributors' && view) ? (
            <TendIcon size={22} color="var(--text-primary)" strokeWidth={1.6} className="flex-shrink-0" />
          ) : null}
          <h2 className="text-white font-medium text-base">
            {action === 'contributors' && contributorSource ? contributorName : title}
          </h2>
        </div>

        <div className="flex-1 px-5 min-h-0 flex flex-col overflow-y-auto no-scrollbar py-4 gap-4">
          {action === 'contributors' && !view ? (
            <>
              {contributors.length === 0 ? (
                <WikiCard>
                  <p className="text-white/30 text-sm">No contributors yet.</p>
                </WikiCard>
              ) : (
                contributors.map((item) => {
                  const label = contributorDisplayName(item);
                  const phoneNumber = contributorPhone(item);
                  const canTextOrCopy = Boolean(phoneNumber || item.token);
                  const textDisabled =
                    !canManageContributors ||
                    !canTextOrCopy ||
                    sendingContributorId === item.id;
                  const callDisabled =
                    !canManageContributors ||
                    !canTextOrCopy ||
                    callingContributorId === item.id;

                  const isOwner = item.userId === detail?.owner?.id || item.user?.id === detail?.owner?.id;

                  return (
                    <div
                      key={item.id}
                      className="flex items-center rounded-xl overflow-hidden"
                      style={{ background: 'rgba(255,255,255,0.05)' }}
                    >
                      <Link
                        href={`${listHref}&view=${item.id}`}
                        className="flex items-center gap-3 flex-1 px-4 py-3 can-hover"
                        style={{ minHeight: 44, opacity: 0.9 }}
                      >
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm font-medium"
                          style={{ background: isOwner ? 'rgba(249,115,22,0.75)' : 'rgba(100,116,139,0.6)' }}
                        >
                          {initials(label)}
                        </div>
                        <span className="text-white text-sm font-medium">{label}</span>
                        {isOwner ? (
                          <ShieldUser size={15} className="ml-auto flex-shrink-0" style={{ color: 'rgba(249,115,22,0.8)' }} />
                        ) : null}
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          if (phoneNumber) {
                            void handleStartVoiceCall(item.id);
                          } else {
                            void copyLink(item.token);
                          }
                        }}
                        disabled={callDisabled}
                        className="w-11 h-11 flex items-center justify-center can-hover flex-shrink-0 disabled:opacity-30"
                        style={{ opacity: callDisabled ? 0.3 : 0.75 }}
                        aria-label={`Call ${label}`}
                      >
                        <Phone size={15} color="var(--text-primary)" strokeWidth={1.8} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (phoneNumber) {
                            void handleSendInvite(item.id);
                          } else {
                            void copyLink(item.token);
                          }
                        }}
                        disabled={textDisabled}
                        className="w-11 h-11 flex items-center justify-center can-hover flex-shrink-0 mr-2 disabled:opacity-30"
                        style={{ opacity: textDisabled ? 0.3 : 0.75 }}
                        aria-label={`Text ${label}`}
                      >
                        <MessageSquare size={15} color="var(--text-primary)" strokeWidth={1.8} />
                      </button>
                    </div>
                  );
                })
              )}
              <div className="flex justify-end">
                <Link
                  href={`${listHref}&view=add`}
                  className="w-1/2 flex items-center justify-center gap-2 rounded-full px-5 text-white text-sm font-medium can-hover-dim btn-primary"
                  style={{ background: '#f97316', minHeight: 44 }}
                >
                  Add Contributor
                </Link>
              </div>
            </>
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
              <div
                className="rounded-xl px-4 py-4"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-white font-medium text-base">{contributorName}</p>
                    {contributorPhoneLabel ? (
                      <p className="text-white/60 text-sm mt-0.5">{contributorPhoneLabel}</p>
                    ) : null}
                    {contributorEmailAddress ? (
                      <p className="text-white/60 text-sm">{contributorEmailAddress}</p>
                    ) : null}
                  </div>
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0"
                    style={{
                      background:
                        ('userId' in contributorSource && contributorSource.userId === detail?.owner?.id) ||
                        contributorSource.user?.id === detail?.owner?.id
                          ? 'rgba(249,115,22,0.75)'
                          : 'rgba(100,116,139,0.6)',
                    }}
                  >
                    {initials(contributorName)}
                  </div>
                </div>
                <p className="text-white/30 text-xs mt-3">
                  <span className="text-white/60 font-medium">Joined Ember</span> ·{' '}
                  {formatDate(contributorSource.createdAt)}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <PrefRow label="Prefers" value={contributorPreference} />
                <PrefRow label="Contact Time" value="Not set" />
                <PrefRow label="Language" value="English" />
              </div>

              <div className="flex gap-3">
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
                  Send Now
                </button>
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)' }} className="pt-4">
                <p className="text-white font-medium text-sm mb-3">{contributionHeading}</p>

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
            </>
          ) : null}

          {action === 'view-wiki' ? <KipemberWikiContent detail={detail} /> : null}

          {action === 'edit-title' ? (
            <>
              {/* Ember title input — above suggestions */}
              <div
                className="rounded-xl px-4 py-3.5 flex flex-col gap-1"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
              >
                {detail?.titleUpdatedAt ? (
                  <p className="text-white/30 text-xs mb-2">
                    Last updated:{' '}
                    {new Date(detail.titleUpdatedAt).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                ) : null}
                <input
                  value={titleValue}
                  onChange={(event) => setTitleValue(event.target.value)}
                  placeholder="Ember title"
                  className="w-full px-0 py-2 text-sm text-white placeholder-white/30 outline-none bg-transparent border-t border-white/10"
                />
              </div>

              {/* Smart title suggestions */}
              <WikiCard>
                <p className="text-white text-sm font-medium mb-3">Smart title suggestions</p>

                {titleSuggestionsLoading ? (
                  <p className="text-white/45 text-sm">Loading suggestions...</p>
                ) : null}

                {titleSuggestionsError ? (
                  <p className="text-white/45 text-sm">{titleSuggestionsError}</p>
                ) : null}

                {!titleSuggestionsLoading && !titleSuggestionsError && titleSuggestions ? (
                  <div className="flex flex-col gap-4">
                    {[...titleSuggestions.analysisSuggestions, ...titleSuggestions.contextSuggestions].length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {[...titleSuggestions.analysisSuggestions, ...titleSuggestions.contextSuggestions].map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => setTitleValue(suggestion)}
                            className="rounded-full px-3 py-2 text-sm text-white text-left can-hover"
                            style={{
                              background:
                                titleValue.trim().toLowerCase() === suggestion.trim().toLowerCase()
                                  ? 'rgba(249,115,22,0.22)'
                                  : 'rgba(255,255,255,0.05)',
                              border:
                                titleValue.trim().toLowerCase() === suggestion.trim().toLowerCase()
                                  ? '1px solid rgba(249,115,22,0.7)'
                                  : '1px solid rgba(255,255,255,0.08)',
                            }}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {titleSuggestions.contributorQuotes.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        <p className="text-white/45 text-[11px] uppercase tracking-[0.18em]">
                          From Real Quotes
                        </p>
                        <div className="flex flex-col gap-2">
                          {titleSuggestions.contributorQuotes.map((suggestion) => (
                            <button
                              key={`quote-${suggestion.title}-${suggestion.contributorName}`}
                              type="button"
                              onClick={() => setTitleValue(suggestion.title)}
                              className="w-full rounded-xl px-4 py-3 text-left can-hover"
                              style={{
                                background:
                                  titleValue.trim().toLowerCase() === suggestion.title.trim().toLowerCase()
                                    ? 'rgba(249,115,22,0.18)'
                                    : 'rgba(255,255,255,0.05)',
                                border:
                                  titleValue.trim().toLowerCase() === suggestion.title.trim().toLowerCase()
                                    ? '1px solid rgba(249,115,22,0.65)'
                                    : '1px solid rgba(255,255,255,0.08)',
                              }}
                            >
                              <p className="text-white text-sm font-medium">{suggestion.title}</p>
                              <p className="text-white/45 text-xs mt-1">
                                {suggestion.contributorName} via {suggestion.source === 'voice' ? 'voice' : 'text'}
                              </p>
                              <p className="text-white/60 text-sm mt-2 leading-relaxed">
                                {suggestion.quote}
                              </p>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </WikiCard>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={refreshTitleSuggestions}
                  disabled={titleSuggestionsRefreshing || titleSuggestionsLoading}
                  className="flex-1 rounded-full px-5 text-white text-sm font-medium btn-secondary disabled:opacity-60 cursor-pointer"
                  style={{ border: '1.5px solid var(--border-btn)', minHeight: 44 }}
                >
                  {titleSuggestionsRefreshing ? 'Refreshing...' : 'Refresh Suggestions'}
                </button>
                <button
                  type="button"
                  onClick={saveTitle}
                  className="flex-1 rounded-full px-5 text-white text-sm font-medium btn-primary"
                  style={{ background: '#f97316', minHeight: 44 }}
                >
                  Save Title
                </button>
              </div>
            </>
          ) : null}

          {action === 'edit-snapshot' ? (
            <KipemberSnapshotEditor
              detail={detail}
              imageId={resolvedImageId}
              refreshDetail={refreshDetail}
              onStatus={setStatus}
            />
          ) : null}

          {action === 'add-content' ? (
            <>
              <label
                className="w-full rounded-full text-white text-sm font-medium btn-primary flex items-center justify-center"
                style={{ background: '#f97316', minHeight: 44 }}
              >
                Add Photo or Video
                <input
                  type="file"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void addAttachment(file);
                    }
                  }}
                />
              </label>
              {(detail?.attachments || []).map((attachment) => (
                <WikiCard key={attachment.id}>
                  <p className="text-white/90 text-sm">{attachment.originalName}</p>
                </WikiCard>
              ))}
            </>
          ) : null}

          {action === 'settings' ? (
            <>
              <div className="rounded-xl px-4 py-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                <label className="flex items-center justify-between text-white text-sm font-medium">
                  Share to network
                  <input type="checkbox" checked={networkValue} onChange={(event) => setNetworkValue(event.target.checked)} />
                </label>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={saveSettings}
                  className="w-1/2 rounded-full px-5 text-white text-sm font-medium btn-primary"
                  style={{ background: '#f97316', minHeight: 44 }}
                >
                  Save Settings
                </button>
              </div>
              {detail?.canManage ? (
                <div
                  className="rounded-xl px-4 py-4"
                  style={{
                    background: 'rgba(120, 26, 26, 0.18)',
                    border: '1px solid rgba(248, 113, 113, 0.2)',
                  }}
                >
                  <p className="text-[rgba(255,220,220,0.92)] text-sm font-medium">
                    Delete Ember
                  </p>
                  <p className="mt-2 text-[rgba(255,220,220,0.62)] text-xs leading-6">
                    Permanently remove this Ember and its connected records.
                  </p>
                  <button
                    type="button"
                    onClick={deleteEmber}
                    disabled={deletingImage}
                    className="mt-4 w-full rounded-full text-white text-sm font-medium disabled:opacity-40"
                    style={{
                      background: 'rgba(239,68,68,0.88)',
                      minHeight: 44,
                    }}
                  >
                    {deletingImage ? 'Deleting...' : 'Delete Ember'}
                  </button>
                </div>
              ) : null}
            </>
          ) : null}

          {action === 'edit-time-date' ? (
            <>
              <WikiCard>
                <p className="text-white/45 text-xs leading-relaxed mb-3">
                  Set the date and time this photo was taken. This updates the timestamp used across the wiki and snapshot.
                </p>
                <label className="flex flex-col gap-1.5">
                  <span className="text-white/45 text-xs font-medium uppercase tracking-wider">Date & Time</span>
                  <input
                    type="datetime-local"
                    value={timeDateValue}
                    onChange={(e) => setTimeDateValue(e.target.value)}
                    className="w-full h-11 rounded-xl px-4 text-sm text-white outline-none"
                    style={fieldStyle}
                  />
                </label>
              </WikiCard>
              <div className="flex gap-3">
                <Link
                  href={tendModalHref}
                  className="flex-1 rounded-full px-5 text-white text-sm font-medium btn-secondary flex items-center justify-center"
                  style={{ border: '1.5px solid var(--border-btn)', minHeight: 44 }}
                >
                  Cancel
                </Link>
                <button
                  type="button"
                  onClick={() => void saveTimeDate()}
                  disabled={timeDateSaving || !timeDateValue}
                  className="flex-1 rounded-full px-5 text-white text-sm font-medium btn-primary disabled:opacity-60 cursor-pointer"
                  style={{ background: '#f97316', minHeight: 44 }}
                >
                  {timeDateSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </>
          ) : null}

          {action === 'edit-location' ? (
            <>
              <WikiCard>
                <p className="text-white/45 text-xs leading-relaxed mb-3">
                  Set or correct the location for this ember. The name is required; coordinates and detail are optional.
                </p>
                <div className="flex flex-col gap-4">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-white/45 text-xs font-medium uppercase tracking-wider">Location Name</span>
                    <input
                      type="text"
                      value={locationLabel}
                      onChange={(e) => setLocationLabel(e.target.value)}
                      placeholder="e.g. Franklin Township, New Jersey"
                      className="w-full h-11 rounded-xl px-4 text-sm text-white outline-none"
                      style={fieldStyle}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-white/45 text-xs font-medium uppercase tracking-wider">Detail (optional)</span>
                    <input
                      type="text"
                      value={locationDetail}
                      onChange={(e) => setLocationDetail(e.target.value)}
                      placeholder="e.g. Tamarack Road"
                      className="w-full h-11 rounded-xl px-4 text-sm text-white outline-none"
                      style={fieldStyle}
                    />
                  </label>
                  <div className="flex gap-3">
                    <label className="flex flex-col gap-1.5 flex-1">
                      <span className="text-white/45 text-xs font-medium uppercase tracking-wider">Latitude</span>
                      <input
                        type="number"
                        step="any"
                        value={locationLatitude}
                        onChange={(e) => setLocationLatitude(e.target.value)}
                        placeholder="40.49973"
                        className="w-full h-11 rounded-xl px-4 text-sm text-white outline-none"
                        style={fieldStyle}
                      />
                    </label>
                    <label className="flex flex-col gap-1.5 flex-1">
                      <span className="text-white/45 text-xs font-medium uppercase tracking-wider">Longitude</span>
                      <input
                        type="number"
                        step="any"
                        value={locationLongitude}
                        onChange={(e) => setLocationLongitude(e.target.value)}
                        placeholder="-74.50159"
                        className="w-full h-11 rounded-xl px-4 text-sm text-white outline-none"
                        style={fieldStyle}
                      />
                    </label>
                  </div>
                </div>
              </WikiCard>
              <div className="flex gap-3">
                <Link
                  href={tendModalHref}
                  className="flex-1 rounded-full px-5 text-white text-sm font-medium btn-secondary flex items-center justify-center"
                  style={{ border: '1.5px solid var(--border-btn)', minHeight: 44 }}
                >
                  Cancel
                </Link>
                <button
                  type="button"
                  onClick={() => void saveLocation()}
                  disabled={locationSaving || !locationLabel.trim()}
                  className="flex-1 rounded-full px-5 text-white text-sm font-medium btn-primary disabled:opacity-60 cursor-pointer"
                  style={{ background: '#f97316', minHeight: 44 }}
                >
                  {locationSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </>
          ) : null}

          {action === 'tag-people' ? (
            <>
              {coverPhotoUrl ? (
                <div
                  ref={imageContainerRef}
                  className="w-full rounded-xl overflow-hidden relative"
                  style={{ border: '1px solid var(--border-subtle)', cursor: taggingMode ? 'crosshair' : 'default' }}
                  onClick={handleImageClick}
                >
                  <img
                    ref={tagImgRef}
                    src={coverPhotoUrl}
                    alt="Ember"
                    className="w-full h-auto block"
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      if (img.naturalWidth && img.naturalHeight) {
                        setImgAspectRatio(img.naturalWidth / img.naturalHeight);
                      }
                    }}
                  />
                  {/* Detected face circles */}
                  {detectedFaces.map((face, i) => {
                    const ar = imgAspectRatio;
                    const size = Math.max(face.widthPct, face.heightPct / ar);
                    const cx = face.leftPct + face.widthPct / 2;
                    const cy = face.topPct + face.heightPct / 2;
                    return (
                      <div
                        key={i}
                        className="absolute rounded-full pointer-events-none"
                        style={{
                          left: `${cx - size / 2}%`,
                          top: `${cy - (size * ar) / 2}%`,
                          width: `${size}%`,
                          aspectRatio: '1 / 1',
                          border: '2px solid rgba(255,255,255,0.85)',
                          boxShadow: '0 0 0 1px rgba(0,0,0,0.4)',
                        }}
                      />
                    );
                  })}
                  {/* Manual face tags */}
                  {faceTags.map((tag) => {
                    const ar = imgAspectRatio;
                    const left = tag.x - CIRCLE_SIZE / 2;
                    const top = tag.y - (CIRCLE_SIZE * ar) / 2;
                    return (
                      <div key={tag.id}>
                        <div
                          className="absolute rounded-full"
                          style={{
                            left: `${left}%`,
                            top: `${top}%`,
                            width: `${CIRCLE_SIZE}%`,
                            aspectRatio: '1 / 1',
                            border: `2.5px solid ${tag.color}`,
                            boxShadow: '0 0 0 1px rgba(0,0,0,0.5)',
                            cursor: taggingMode ? 'grab' : 'default',
                            touchAction: 'none',
                          }}
                          onPointerDown={(e) => handleCirclePointerDown(e, tag)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        {tag.name ? (
                          <div
                            className="absolute text-xs font-semibold px-1.5 py-0.5 rounded pointer-events-none"
                            style={{
                              left: `${tag.x}%`,
                              top: `${top + CIRCLE_SIZE * ar + 0.5}%`,
                              transform: 'translateX(-50%)',
                              background: 'rgba(0,0,0,0.65)',
                              color: tag.color,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {tag.name}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {/* Tag list */}
              {faceTags.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {faceTags.map((tag) => (
                    <div
                      key={tag.id}
                      className="flex items-center gap-3 px-4 rounded-xl"
                      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', minHeight: 44 }}
                    >
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: tag.color }} />
                      {editingTagId === tag.id ? (
                        <input
                          autoFocus
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onFocus={(e) => e.target.select()}
                          onBlur={() => handleSaveTagName(tag.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveTagName(tag.id);
                            if (e.key === 'Escape') setEditingTagId(null);
                          }}
                          className="flex-1 bg-transparent text-white text-sm outline-none"
                          placeholder="Enter name..."
                        />
                      ) : (
                        <span className="flex-1 text-white text-sm">{tag.name || 'Unnamed'}</span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleEditTag(tag)}
                        className="w-8 h-8 flex items-center justify-center rounded-full opacity-50 can-hover"
                        style={{ cursor: 'pointer' }}
                      >
                        <Pencil size={13} color="var(--text-primary)" strokeWidth={1.8} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTag(tag.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-full opacity-50 can-hover"
                        style={{ cursor: 'pointer' }}
                      >
                        <X size={14} color="#f87171" strokeWidth={1.8} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="flex gap-3">
                <button
                  type="button"
                  disabled
                  className="flex-1 flex items-center justify-center rounded-full text-white/30 text-sm font-medium disabled:opacity-50"
                  style={{ background: 'transparent', border: '1.5px solid var(--border-btn)', minHeight: 44, cursor: 'not-allowed' }}
                >
                  Auto Detect
                </button>
                <button
                  type="button"
                  onClick={() => setTaggingMode((v) => !v)}
                  className="flex-1 flex items-center justify-center rounded-full text-white text-sm font-medium"
                  style={{
                    background: taggingMode ? '#f97316' : 'transparent',
                    border: taggingMode ? 'none' : '1.5px solid var(--border-btn)',
                    minHeight: 44,
                    cursor: 'pointer',
                  }}
                >
                  {taggingMode ? 'Done Tagging' : 'Tag Faces'}
                </button>
              </div>
            </>
          ) : null}

          {status ? <p className="text-sm text-white/60">{status}</p> : null}
        </div>
      </div>
    </div>
  );
}
