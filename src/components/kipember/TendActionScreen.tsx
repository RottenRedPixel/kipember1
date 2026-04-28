'use client';

declare global {
  interface Window {
    FaceDetector?: new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => {
      detect: (image: HTMLImageElement) => Promise<{ boundingBox: DOMRectReadOnly }[]>;
    };
  }
}

import Link from 'next/link';
import { Calendar, ChevronLeft, ChevronRight, Copy, Lightbulb, MapPin, MessageSquarePlus, Pencil, Phone, Settings, ShieldUser, TicketSlash, User, UserRound, Users, X } from 'lucide-react';
import Cropper from 'react-easy-crop';
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
import ContributorsListView from '@/components/kipember/ContributorsListView';
import type { UnifiedContributor } from '@/lib/contributors-pool';

const fieldStyle = {
  background: 'var(--bg-input)',
  border: '1px solid var(--border-input)',
};

const US_STATES = new Set<string>([
  'alabama','alaska','arizona','arkansas','california','colorado','connecticut',
  'delaware','florida','georgia','hawaii','idaho','illinois','indiana','iowa',
  'kansas','kentucky','louisiana','maine','maryland','massachusetts','michigan',
  'minnesota','mississippi','missouri','montana','nebraska','nevada',
  'new hampshire','new jersey','new mexico','new york','north carolina',
  'north dakota','ohio','oklahoma','oregon','pennsylvania','rhode island',
  'south carolina','south dakota','tennessee','texas','utah','vermont',
  'virginia','washington','west virginia','wisconsin','wyoming',
  'district of columbia',
  'al','ak','az','ar','ca','co','ct','de','fl','ga','hi','id','il','in','ia',
  'ks','ky','la','me','md','ma','mi','mn','ms','mo','mt','ne','nv','nh','nj',
  'nm','ny','nc','nd','oh','ok','or','pa','ri','sc','sd','tn','tx','ut','vt',
  'va','wa','wv','wi','wy','dc',
]);

function parseAddressParts(detail: string | null | undefined): {
  street: string;
  cityStateZip: string;
  country: string;
} {
  const empty = { street: '', cityStateZip: '', country: '' };
  if (typeof detail !== 'string') return empty;
  const parts = detail
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return empty;

  const last = parts[parts.length - 1];
  const isCountry = /^(USA|United States|US|U\.S\.|U\.S\.A\.)$/i.test(last);
  const country = isCountry ? parts.pop() ?? '' : '';

  // Pattern A: a "STATE ZIP" or "Statename ZIP" segment (e.g., "NY 11201").
  const stateZipIdx = parts.findIndex(
    (part) =>
      /\b[A-Z]{2}\s+\d{5}(-\d{4})?$/.test(part) ||
      /\b[A-Z][A-Za-z]+\s+\d{5}(-\d{4})?$/.test(part)
  );
  if (stateZipIdx > 0) {
    const street = parts.slice(0, stateZipIdx - 1).join(', ');
    const city = parts[stateZipIdx - 1];
    const stateZip = parts[stateZipIdx];
    return { street, cityStateZip: `${city}, ${stateZip}`, country };
  }

  // Pattern B: a US state name at the end without a ZIP.
  const tail = parts[parts.length - 1];
  if (parts.length >= 2 && tail && US_STATES.has(tail.toLowerCase())) {
    const stateIdx = parts.length - 1;
    const street = parts.slice(0, stateIdx - 1).join(', ');
    const city = parts[stateIdx - 1];
    const state = parts[stateIdx];
    return { street, cityStateZip: `${city}, ${state}`, country };
  }

  return { street: parts.join(', '), cityStateZip: '', country };
}

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
  const [titleValue, setTitleValue] = useState('');
  const [titleSuggestions, setTitleSuggestions] = useState<TitleSuggestionResponse | null>(null);
  const [titlePreferredPeopleIds, setTitlePreferredPeopleIds] = useState<Set<string>>(new Set());
  const [titleSuggestionsLoading, setTitleSuggestionsLoading] = useState(false);
  const [titleSuggestionsRefreshing, setTitleSuggestionsRefreshing] = useState(false);
  const [titleSuggestionsError, setTitleSuggestionsError] = useState('');
  const [networkValue, setNetworkValue] = useState(false);
  const [keepPrivateValue, setKeepPrivateValue] = useState(false);
  const [deletingImage, setDeletingImage] = useState(false);
  const [timeDateValue, setTimeDateValue] = useState('');
  const [timeDateSaving, setTimeDateSaving] = useState(false);
  const [locationLabel, setLocationLabel] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [locationCityStateZip, setLocationCityStateZip] = useState('');
  const [locationCountry, setLocationCountry] = useState('');
  const [locationLatitude, setLocationLatitude] = useState('');
  const [locationLongitude, setLocationLongitude] = useState('');
  const [savedLocationLabel, setSavedLocationLabel] = useState('');
  const [savedLocationAddress, setSavedLocationAddress] = useState('');
  const [savedLocationCityStateZip, setSavedLocationCityStateZip] = useState('');
  const [savedLocationCountry, setSavedLocationCountry] = useState('');
  const [savedLocationLat, setSavedLocationLat] = useState('');
  const [savedLocationLng, setSavedLocationLng] = useState('');
  const [locationSaving, setLocationSaving] = useState(false);
  const [frameCrop, setFrameCrop] = useState({ x: 0, y: 0 });
  const [frameZoom, setFrameZoom] = useState(1);
  const [frameCroppedArea, setFrameCroppedArea] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [savedFrameCrop, setSavedFrameCrop] = useState<{ x: number; y: number } | null>(null);
  const [frameIsDirty, setFrameIsDirty] = useState(false);
  const [frameResetPending, setFrameResetPending] = useState(false);
  const [frameSaving, setFrameSaving] = useState(false);
  const [addForm, setAddForm] = useState({ firstName: '', lastName: '', phone: '', email: '' });
  const [savedForm, setSavedForm] = useState({ firstName: '', lastName: '', phone: '', email: '' });
  const [editingContributor, setEditingContributor] = useState(false);
  const [savingContributor, setSavingContributor] = useState(false);
  const [contributorSubSection, setContributorSubSection] = useState<'profile' | 'contributions' | 'preferences' | null>(null);
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
  const frameInitRef = useRef(false);

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
    setTitleValue(payload.title || payload.originalName?.replace(/\.[^.]+$/, '') || '');
    setNetworkValue(Boolean(payload.shareToNetwork));
    setKeepPrivateValue(Boolean(payload.keepPrivate));
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
    const label = loc?.label || '';
    const fullAddress = loc?.detail || '';
    const parsedAddress = parseAddressParts(fullAddress);
    const lat = payload.analysis?.latitude ?? loc?.latitude ?? null;
    const lng = payload.analysis?.longitude ?? loc?.longitude ?? null;
    const latStr = lat != null ? parseFloat(lat.toFixed(5)).toString() : '';
    const lngStr = lng != null ? parseFloat(lng.toFixed(5)).toString() : '';
    setLocationLabel(label);
    setLocationAddress(parsedAddress.street);
    setLocationCityStateZip(parsedAddress.cityStateZip);
    setLocationCountry(parsedAddress.country);
    setLocationLatitude(latStr);
    setLocationLongitude(lngStr);
    setSavedLocationLabel(label);
    setSavedLocationAddress(parsedAddress.street);
    setSavedLocationCityStateZip(parsedAddress.cityStateZip);
    setSavedLocationCountry(parsedAddress.country);
    setSavedLocationLat(latStr);
    setSavedLocationLng(lngStr);
    // Populate frame crop
    if (payload.cropX != null && payload.cropY != null) {
      setSavedFrameCrop({ x: payload.cropX, y: payload.cropY });
    } else {
      setSavedFrameCrop(null);
    }
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
        const payload = (await response.json()) as TendDetail;
        applyDetail(payload);

        // After applyDetail: if on edit-time-place and confirmedLocation is absent,
        // fall back to GPS-resolved suggestions (same source the wiki uses)
        if (action === 'edit-time-place' && !payload.analysis?.confirmedLocation?.label) {
          void fetch(`/api/images/${resolvedImageId}/location-suggestions`)
            .then((res) => res.json())
            .then((data: {
              suggestions?: Array<{ id: string; label: string; detail: string | null; kind: string }>;
            }) => {
              const suggestions = data?.suggestions || [];
              const placeSuggestion =
                suggestions.find((s) => s.kind === 'place') ||
                suggestions.find((s) => s.kind === 'neighborhood') ||
                suggestions.find((s) => s.kind === 'city') ||
                null;
              const addressSuggestion = suggestions.find((s) => s.kind === 'address') || null;

              if (placeSuggestion) {
                setLocationLabel(placeSuggestion.label);
                setSavedLocationLabel(placeSuggestion.label);
              }
              if (addressSuggestion) {
                const fullAddress = [addressSuggestion.label, addressSuggestion.detail]
                  .filter(Boolean)
                  .join(', ');
                const parsed = parseAddressParts(fullAddress);
                setLocationAddress(parsed.street);
                setSavedLocationAddress(parsed.street);
                setLocationCityStateZip(parsed.cityStateZip);
                setSavedLocationCityStateZip(parsed.cityStateZip);
                setLocationCountry(parsed.country);
                setSavedLocationCountry(parsed.country);
              }
            })
            .catch(() => undefined);
        }
      })
      .catch(() => undefined);
  }, [detailPath, resolvedImageId]);

  // Guard: prevent react-easy-crop's mount-time onCropChange from marking frame dirty
  useEffect(() => {
    if (action !== 'frame') return;
    frameInitRef.current = false;
    const t = setTimeout(() => { frameInitRef.current = true; }, 150);
    return () => clearTimeout(t);
  }, [action]);

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
      const params = new URLSearchParams({ refresh: '1' });
      const preferredNames = (detail?.tags || [])
        .filter((tag) => titlePreferredPeopleIds.has(tag.id))
        .map((tag) => tag.label)
        .filter(Boolean);
      if (preferredNames.length > 0) params.set('preferredPeople', preferredNames.join(','));
      const response = await fetch(`/api/images/${resolvedImageId}/title-suggestions?${params.toString()}`, {
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
      const composedDetail = [locationAddress, locationCityStateZip, locationCountry]
        .map((s) => s.trim())
        .filter(Boolean)
        .join(', ') || null;
      const body: Record<string, unknown> = {
        label: locationLabel.trim(),
        detail: composedDetail,
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
      if (response.ok) {
        setSavedLocationLabel(locationLabel.trim());
        setSavedLocationAddress(locationAddress.trim());
        setSavedLocationCityStateZip(locationCityStateZip.trim());
        setSavedLocationCountry(locationCountry.trim());
        setSavedLocationLat(locationLatitude);
        setSavedLocationLng(locationLongitude);
        setStatus('Location saved.');
        await refreshDetail();
      } else {
        setStatus('Failed to save location.');
      }
    } catch {
      setStatus('Failed to save location.');
    } finally {
      setLocationSaving(false);
    }
  }

  async function saveFrame() {
    if (!resolvedImageId) return;
    if (!frameResetPending && !frameCroppedArea) return;
    setFrameSaving(true);
    try {
      const body = frameResetPending
        ? { crop: null }
        : {
            crop: {
              x: parseFloat((frameCroppedArea!.x + frameCroppedArea!.width / 2).toFixed(2)),
              y: parseFloat((frameCroppedArea!.y + frameCroppedArea!.height / 2).toFixed(2)),
              width: parseFloat(frameCroppedArea!.width.toFixed(2)),
              height: parseFloat(frameCroppedArea!.height.toFixed(2)),
            },
          };
      const response = await fetch(`/api/images/${resolvedImageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (response.ok) {
        if (frameResetPending) {
          setSavedFrameCrop(null);
          setFrameResetPending(false);
        } else {
          const cx = frameCroppedArea!.x + frameCroppedArea!.width / 2;
          const cy = frameCroppedArea!.y + frameCroppedArea!.height / 2;
          setSavedFrameCrop({ x: cx, y: cy });
        }
        setFrameIsDirty(false);
        setStatus('Frame saved.');
        await refreshDetail();
      } else {
        setStatus('Failed to save frame.');
      }
    } catch {
      setStatus('Failed to save frame.');
    } finally {
      setFrameSaving(false);
    }
  }

  async function saveSettings() {
    if (!resolvedImageId) {
      return;
    }
    const response = await fetch(`/api/images/${resolvedImageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shareToNetwork: networkValue, keepPrivate: keepPrivateValue }),
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
    : cachedCoverUrl;
  const fromExternal = searchParams.get('from') === 'account' || searchParams.get('from') === 'home';
  const peekBackgroundUrl = fromExternal ? null : coverPhotoUrl;

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
            <>
              {/* Ember title input */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <TicketSlash size={17} color="var(--text-secondary)" strokeWidth={1.6} />
                  <h3 className="text-white font-medium text-base">Title</h3>
                </div>
              <div
                className="rounded-xl px-4 py-3.5 flex flex-col gap-1"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
              >
                <input
                  value={titleValue}
                  onChange={(event) => setTitleValue(event.target.value.slice(0, 40))}
                  placeholder="Ember title"
                  maxLength={40}
                  className="w-full px-0 py-2 text-base font-medium text-white placeholder-white/30 outline-none bg-transparent"
                />
                {(detail?.titleUpdatedAt || detail?.createdAt) ? (
                  <p className="text-white/30 text-xs mt-1 border-t border-white/10 pt-2">
                    {detail.titleUpdatedAt ? 'Last updated' : 'Created'}:{' '}
                    {new Date(detail.titleUpdatedAt ?? detail.createdAt).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                ) : null}
              </div>
              </div>

              {/* Smart title suggestions */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span style={{ color: 'var(--text-secondary)' }}><Lightbulb size={17} /></span>
                  <h3 className="text-white font-medium text-base">Title Ideas</h3>
                </div>
              <WikiCard>

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

                  </div>
                ) : null}
              </WikiCard>
              </div>

              {/* People hints */}
              {detail?.tags && detail.tags.length > 0 ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span style={{ color: 'var(--text-secondary)' }}><Users size={17} /></span>
                    <h3 className="text-white font-medium text-base">People</h3>
                  </div>
                <WikiCard>
                  <div className="flex flex-col gap-2">
                    {detail.tags.map((tag) => (
                      <label key={tag.id} className="flex items-center gap-3 cursor-pointer" style={{ minHeight: 36 }}>
                        <input
                          type="checkbox"
                          checked={titlePreferredPeopleIds.has(tag.id)}
                          onChange={(e) => {
                            setTitlePreferredPeopleIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(tag.id);
                              else next.delete(tag.id);
                              return next;
                            });
                          }}
                          className="accent-orange-500 w-4 h-4 shrink-0"
                        />
                        <span className="text-white text-sm">{tag.label}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-white/30 text-xs mt-1 border-t border-white/10 pt-2">Check names to prefer in title suggestions.</p>
                </WikiCard>
                </div>
              ) : null}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={refreshTitleSuggestions}
                  disabled={titleSuggestionsRefreshing || titleSuggestionsLoading}
                  className="flex-1 rounded-full px-5 text-white text-sm font-medium btn-secondary disabled:opacity-60 cursor-pointer"
                  style={{ border: '1.5px solid var(--border-btn)', minHeight: 44 }}
                >
                  {titleSuggestionsRefreshing ? 'Regenerating...' : 'Regen Ideas'}
                </button>
                {(() => {
                  const savedTitleValue = detail ? (detail.title || detail.originalName?.replace(/\.[^.]+$/, '') || '') : '';
                  const isTitleDirty = titleValue.trim() !== savedTitleValue.trim();
                  return (
                    <button
                      type="button"
                      onClick={saveTitle}
                      disabled={!isTitleDirty}
                      className="flex-1 rounded-full px-5 text-white text-sm font-medium disabled:opacity-60"
                      style={{
                        background: isTitleDirty ? '#f97316' : 'var(--bg-surface)',
                        border: isTitleDirty ? 'none' : '1px solid var(--border-subtle)',
                        minHeight: 44,
                        cursor: isTitleDirty ? 'pointer' : 'default',
                      }}
                    >
                      Save
                    </button>
                  );
                })()}
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


          {action === 'settings' ? (
            <>
              <div className="rounded-xl px-4 py-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                <label className="flex items-center justify-between gap-4 cursor-pointer" style={{ minHeight: 44 }}>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-white text-sm font-medium">Share to Network</span>
                    <span className="text-white/40 text-xs">Not sure what this does</span>
                  </span>
                  <span
                    className="relative flex-shrink-0"
                    style={{ width: 48, height: 28 }}
                  >
                    <input
                      type="checkbox"
                      checked={networkValue}
                      onChange={(event) => setNetworkValue(event.target.checked)}
                      className="sr-only"
                    />
                    <span
                      className="absolute inset-0 rounded-full transition-colors duration-200"
                      style={{ background: networkValue ? '#f97316' : 'rgba(255,255,255,0.15)' }}
                    />
                    <span
                      className="absolute top-0.5 left-0.5 rounded-full bg-white shadow transition-transform duration-200"
                      style={{ width: 24, height: 24, transform: networkValue ? 'translateX(20px)' : 'translateX(0)' }}
                    />
                  </span>
                </label>
              </div>

              <div className="rounded-xl px-4 py-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                <label className="flex items-center justify-between gap-4 cursor-pointer" style={{ minHeight: 44 }}>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-white text-sm font-medium">Privacy Setting</span>
                    <span className="text-white/40 text-xs">Allow guest view of this ember</span>
                  </span>
                  <span
                    className="relative flex-shrink-0"
                    style={{ width: 48, height: 28 }}
                  >
                    <input
                      type="checkbox"
                      checked={!keepPrivateValue}
                      onChange={(event) => setKeepPrivateValue(!event.target.checked)}
                      className="sr-only"
                    />
                    <span
                      className="absolute inset-0 rounded-full transition-colors duration-200"
                      style={{ background: !keepPrivateValue ? '#f97316' : 'rgba(255,255,255,0.15)' }}
                    />
                    <span
                      className="absolute top-0.5 left-0.5 rounded-full bg-white shadow transition-transform duration-200"
                      style={{ width: 24, height: 24, transform: !keepPrivateValue ? 'translateX(20px)' : 'translateX(0)' }}
                    />
                  </span>
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

          {action === 'edit-time-place' ? (
            <>
              {/* Date & Time */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Calendar size={17} color="var(--text-secondary)" strokeWidth={1.6} />
                  <h3 className="text-white font-medium text-base">Time &amp; Date</h3>
                </div>
                <input
                  type="datetime-local"
                  value={timeDateValue}
                  onChange={(e) => setTimeDateValue(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl text-sm text-white outline-none cursor-pointer"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', colorScheme: 'dark' }}
                />
              </div>

              {/* Location fields */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <MapPin size={17} color="var(--text-secondary)" strokeWidth={1.6} />
                  <h3 className="text-white font-medium text-base">Place</h3>
                </div>
                <div className="rounded-xl px-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                  <input
                    type="text"
                    value={locationLabel}
                    onChange={(e) => setLocationLabel(e.target.value)}
                    placeholder="Name of location"
                    className="w-full h-12 px-0 text-sm text-white placeholder-white/30 outline-none bg-transparent"
                  />
                  <input
                    type="text"
                    value={locationAddress}
                    onChange={(e) => setLocationAddress(e.target.value)}
                    placeholder="Address"
                    className="w-full h-12 px-0 text-sm text-white placeholder-white/30 outline-none bg-transparent"
                    style={{ borderTop: '1px solid var(--border-subtle)' }}
                  />
                  <input
                    type="text"
                    value={locationCityStateZip}
                    onChange={(e) => setLocationCityStateZip(e.target.value)}
                    placeholder="City, State ZIP"
                    className="w-full h-12 px-0 text-sm text-white placeholder-white/30 outline-none bg-transparent"
                    style={{ borderTop: '1px solid var(--border-subtle)' }}
                  />
                  <input
                    type="text"
                    value={locationCountry}
                    onChange={(e) => setLocationCountry(e.target.value)}
                    placeholder="Country"
                    className="w-full h-12 px-0 text-sm text-white placeholder-white/30 outline-none bg-transparent"
                    style={{ borderTop: '1px solid var(--border-subtle)' }}
                  />
                </div>
              </div>

              {/* GPS coordinates */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <MapPin size={17} color="var(--text-secondary)" strokeWidth={1.6} />
                  <h3 className="text-white font-medium text-base">GPS Data</h3>
                </div>
                <div className="rounded-xl px-4 flex items-center gap-2 min-h-[48px]" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                  {locationLatitude && locationLongitude ? (
                    <>
                      <a
                        href={`https://maps.google.com/?q=${locationLatitude},${locationLongitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 py-3 text-sm text-white/80"
                      >
                        {locationLatitude}, {locationLongitude}
                      </a>
                      <button
                        type="button"
                        onClick={() => void navigator.clipboard.writeText(`${locationLatitude}, ${locationLongitude}`)}
                        className="flex-shrink-0 p-1 cursor-pointer"
                        aria-label="Copy coordinates"
                      >
                        <Copy size={15} color="var(--text-secondary)" strokeWidth={1.6} />
                      </button>
                    </>
                  ) : (
                    <input
                      type="text"
                      value={locationLatitude || locationLongitude}
                      onChange={(e) => {
                        const parts = e.target.value.split(',');
                        setLocationLatitude(parts[0]?.trim() ?? '');
                        setLocationLongitude(parts[1]?.trim() ?? '');
                      }}
                      placeholder="Latitude, Longitude"
                      className="flex-1 h-12 px-0 text-sm text-white placeholder-white/30 outline-none bg-transparent"
                    />
                  )}
                </div>
              </div>

              {/* Combined save */}
              <div className="flex gap-3">
                <Link
                  href={tendModalHref}
                  className="flex-1 rounded-full px-5 text-white text-sm font-medium btn-secondary flex items-center justify-center"
                  style={{ border: '1.5px solid var(--border-btn)', minHeight: 44 }}
                >
                  Cancel
                </Link>
                {(() => {
                  const capturedAt = detail?.analysis?.capturedAt;
                  let savedTimeDateValue = '';
                  if (capturedAt) {
                    const d = new Date(capturedAt);
                    if (!Number.isNaN(d.getTime())) {
                      savedTimeDateValue = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                    }
                  }
                  const isTimeDateDirty = Boolean(timeDateValue) && timeDateValue !== savedTimeDateValue;
                  const isLocationDirty =
                    locationLabel !== savedLocationLabel ||
                    locationAddress !== savedLocationAddress ||
                    locationCityStateZip !== savedLocationCityStateZip ||
                    locationCountry !== savedLocationCountry ||
                    locationLatitude !== savedLocationLat ||
                    locationLongitude !== savedLocationLng;
                  const isDirty = isTimeDateDirty || (Boolean(locationLabel.trim()) && isLocationDirty);
                  const isSaving = timeDateSaving || locationSaving;
                  async function saveAll() {
                    if (isTimeDateDirty) await saveTimeDate();
                    if (Boolean(locationLabel.trim()) && isLocationDirty) await saveLocation();
                  }
                  return (
                    <button
                      type="button"
                      onClick={() => void saveAll()}
                      disabled={isSaving || !isDirty}
                      className="flex-1 rounded-full px-5 text-white text-sm font-medium disabled:opacity-60"
                      style={{
                        background: isDirty ? '#f97316' : 'var(--bg-surface)',
                        border: isDirty ? 'none' : '1px solid var(--border-subtle)',
                        minHeight: 44,
                        cursor: isDirty ? 'pointer' : 'default',
                      }}
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                  );
                })()}
              </div>
            </>
          ) : null}

          {action === 'frame' ? (
            <>
              {coverPhotoUrl ? (
                <div className="flex flex-col gap-3">
                  <div
                    className="relative w-full rounded-xl overflow-hidden"
                    style={{ aspectRatio: '3 / 4' }}
                  >
                    <Cropper
                      image={coverPhotoUrl}
                      crop={frameCrop}
                      zoom={frameZoom}
                      aspect={3 / 4}
                      onCropChange={(c) => {
                        setFrameCrop(c);
                        if (frameInitRef.current) {
                          setFrameIsDirty(true);
                          setFrameResetPending(false);
                        }
                      }}
                      onZoomChange={(z) => {
                        setFrameZoom(z);
                        if (frameInitRef.current) {
                          setFrameIsDirty(true);
                          setFrameResetPending(false);
                        }
                      }}
                      onCropComplete={(croppedAreaPercentage) => {
                        setFrameCroppedArea(croppedAreaPercentage);
                      }}
                      style={{
                        containerStyle: { borderRadius: 12 },
                        mediaStyle: {},
                        cropAreaStyle: { border: '2px solid rgba(249,115,22,0.8)', borderRadius: 8 },
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <input
                      type="range"
                      min={1}
                      max={3}
                      step={0.01}
                      value={frameZoom}
                      onChange={(e) => {
                        setFrameZoom(Number(e.target.value));
                        if (frameInitRef.current) {
                          setFrameIsDirty(true);
                          setFrameResetPending(false);
                        }
                      }}
                      className="w-full"
                      style={{ accentColor: '#f97316' }}
                    />
                    <p className="text-center text-xs text-white/40">Drag to reframe · Pinch or slide to zoom</p>
                  </div>
                </div>
              ) : (
                <p className="text-white/40 text-sm text-center py-8">No photo available.</p>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setFrameCrop({ x: 0, y: 0 });
                    setFrameZoom(1);
                    setFrameResetPending(true);
                    setFrameIsDirty(true);
                  }}
                  className="flex-1 rounded-full px-5 text-white text-sm font-medium btn-secondary flex items-center justify-center"
                  style={{ border: '1.5px solid var(--border-btn)', minHeight: 44, cursor: 'pointer' }}
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => void saveFrame()}
                  disabled={frameSaving || !frameIsDirty || (!frameCroppedArea && !frameResetPending)}
                  className="flex-1 rounded-full px-5 text-white text-sm font-medium disabled:opacity-60"
                  style={{
                    background: frameIsDirty ? '#f97316' : 'var(--bg-surface)',
                    border: frameIsDirty ? 'none' : '1px solid var(--border-subtle)',
                    minHeight: 44,
                    cursor: frameIsDirty ? 'pointer' : 'default',
                  }}
                >
                  {frameSaving ? 'Saving...' : 'Save'}
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
