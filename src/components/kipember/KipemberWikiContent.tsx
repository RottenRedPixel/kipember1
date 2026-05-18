'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowRightLeft,
  ChevronDown,
  Link2,
  CircleCheckBig,
  CircleHelp,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Heart,
  History,
  Image as ImageIcon,
  Lightbulb,
  ListChecks,
  Lock,
  LockKeyhole,
  Map as MapIcon,
  MessageCircle,
  MessageSquareShare,
  MessagesSquare,
  Mic,
  Pause,
  PencilLine,
  Phone,
  Play,
  Plus,
  ScanEye,
  ShieldUser,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import EmberCallCard from '@/components/kipember/EmberCallCard';
import EmberChatMessages from '@/components/kipember/EmberChatMessages';
import VoiceMessageList, { type VoiceMessage } from '@/components/kipember/workflows/VoiceMessageList';
import MediaPreview from '@/components/MediaPreview';
import EditTitleSlider from '@/components/kipember/tend/EditTitleSlider';
import EditSnapshotSlider from '@/components/kipember/tend/EditSnapshotSlider';
import EditTimePlaceSlider from '@/components/kipember/tend/EditTimePlaceSlider';
import ContributorsSlider from '@/components/kipember/tend/ContributorsSlider';
import TagPeopleSlider from '@/components/kipember/tend/TagPeopleSlider';
import { getPreviewMediaUrl } from '@/lib/media';
import { usePlaceResolution } from '@/components/kipember/usePlaceResolution';
import { pastelForContributor, pastelForContributorIdentity } from '@/lib/contributor-color';
import { isAudioLikeFilename } from '@/lib/media';
import { getUserDisplayName } from '@/lib/user-name';
import { useToast } from '@/lib/toast';
import type {
  KipemberAttachment,
  KipemberContributor,
  KipemberEmberCallClip,
  KipemberEmberVoiceClip,
  KipemberTag,
  KipemberWikiDetail,
} from './wiki/types';

// Re-export public types so existing import paths keep working.
export type {
  KipemberAttachment,
  KipemberContributor,
  KipemberEmberCallClip,
  KipemberEmberVoiceClip,
  KipemberTag,
  KipemberWikiDetail,
} from './wiki/types';
import type {
  EmberStoryRecord,
  ReconciliationClaim,
} from './wiki/hooks';
import {
  useEmberStories,
  useReconciliationClaims,
  useTrackerConfig,
} from './wiki/hooks';

import type { FindAvatar, FindPerson, PersonIdentity } from './wiki/utils';
import {
  OWNER_AVATAR_BG,
  avatarStylesForPerson,
  buildStructuredAnalysisText,
  claimSourceLabelFromMetadata,
  colorForPerson,
  formatAnalysisFooterDate,
  formatLongDate,
  initials,
  relativeAt,
} from './wiki/utils';
import {
  AvatarCircle,
  ReconciliationPill,
  RefreshFooter,
  WikiBadge,
  WikiCard,
  WikiGroup,
  WikiSection,
} from './wiki/atoms';
import {
  ClaimExtractionCard,
  CollapsibleAnalysisCard,
  CollapsibleChatBlock,
  CollapsibleGuestVisitorChatBlock,
  CollapsibleGuestVisitorVoiceBlock,
  DeleteEmberCard,
  EmberProgressBar,
  PlaceCard,
  PrivacyToggles,
  StoriesCard,
  VoiceBlockCard,
} from './wiki/cards';

const TAG_COLORS = ['var(--color-accent)', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#ef4444'];

export default function KipemberWikiContent({
  detail,
  refreshDetail,
  onStatus,
}: {
  detail: KipemberWikiDetail | null;
  // Optional callbacks the wiki uses for the inline Privacy and Delete
  // controls in the Control group. When omitted (e.g. read-only render
  // surfaces) those interactions silently no-op.
  refreshDetail?: () => Promise<unknown> | unknown;
  onStatus?: (message: string) => void;
}) {
  const placeResolution = usePlaceResolution(detail);
  const { toast } = useToast();
  const contributors = detail?.contributors || [];
  const emberId = detail?.id || null;
  const ownerName = getUserDisplayName(detail?.owner) || null;
  const ownerUserId = detail?.owner?.id;
  // In-page edit overlay state â€” keeps the wiki (and the ember view
  // beneath it) mounted while the user edits a single field. Closing
  // the overlay returns to the wiki with scroll, expanded sections,
  // and progress-bar config all preserved.
  type EditingSlug = 'title' | 'snapshot' | 'time-place' | 'contributors' | 'add-contributor' | 'tag-people' | null;
  const [editingSlug, setEditingSlug] = useState<EditingSlug>(null);
  // Visual open state â€” drives a CSS transition on `transform` so the
  // overlay slides in from the right on open and back out to the right
  // on close. Decoupled from `editingSlug` so we can run the slide-out
  // animation BEFORE unmounting (300ms delay matches the transition).
  const [overlayOpen, setOverlayOpen] = useState(false);
  useEffect(() => {
    if (!editingSlug) return;
    // Mount happened with overlayOpen=false â†’ transform: translateX(100%).
    // Kick the transition on the next animation frame so the browser
    // commits the off-screen state before transitioning to onscreen.
    const id = requestAnimationFrame(() => setOverlayOpen(true));
    return () => cancelAnimationFrame(id);
  }, [editingSlug]);
  const closeEditOverlay = useCallback(() => {
    setOverlayOpen(false);
    setTimeout(() => {
      setEditingSlug(null);
      setManageInitialExpandedId(null);
      // Always pull fresh detail on close â€” covers Tag People (which
      // mutates tags via its own fetches without a refresh callback)
      // and any other slider that saved data while open. Title /
      // Snapshot / etc. also call refreshDetail directly on save, but
      // a duplicate refresh here is cheap and guarantees the badges
      // and progress bar reflect the latest state.
      void refreshDetail?.();
    }, 300);
  }, [refreshDetail]);

  // Single source of truth: name â†’ person identity bundle. Every avatar
  // surface in the wiki resolves through this so the same contributor
  // gets the same avatar URL (when they have one) and the same pool-key
  // pastel color (when they don't), no matter which card renders them.
  const personLookup = useMemo(() => {
    const map = new Map<string, PersonIdentity>();
    const add = (name: string | null | undefined, identity: PersonIdentity) => {
      const key = name?.trim().toLowerCase();
      if (!key) return;
      if (!map.has(key)) map.set(key, identity);
    };
    // Map both the full name and the first name to the same identity so
    // surfaces like Story Circle (which addresses "Amado") and the
    // contributors row (which uses "Amado Batour") land on the same
    // pastel + avatar URL.
    const addAllNameForms = (name: string | null | undefined, identity: PersonIdentity) => {
      const trimmed = name?.trim();
      if (!trimmed) return;
      add(trimmed, identity);
      const firstName = trimmed.split(/\s+/)[0];
      if (firstName && firstName.toLowerCase() !== trimmed.toLowerCase()) {
        add(firstName, identity);
      }
    };

    if (detail?.owner) {
      const name = getUserDisplayName(detail.owner) || detail.owner.phoneNumber || null;
      const identity: PersonIdentity = {
        userId: detail.owner.id ?? null,
        email: detail.owner.email ?? null,
        phoneNumber: null,
        id: detail.owner.id ?? null,
        avatarUrl: detail.owner.avatarFilename
          ? `/api/uploads/${detail.owner.avatarFilename}`
          : null,
        isOwner: true,
      };
      addAllNameForms(name, identity);
      // Claims sometimes attribute to the literal label "Owner".
      add('Owner', identity);
    }
    for (const contributor of detail?.contributors ?? []) {
      const name = getUserDisplayName(contributor.user) || contributor.name;
      const identity: PersonIdentity = {
        userId: contributor.user?.id ?? contributor.userId ?? null,
        email: contributor.email ?? contributor.user?.email ?? null,
        phoneNumber: contributor.phoneNumber ?? contributor.user?.phoneNumber ?? null,
        id: contributor.id ?? null,
        avatarColor: contributor.avatarColor ?? null,
        avatarUrl: contributor.user?.avatarFilename
          ? `/api/uploads/${contributor.user.avatarFilename}`
          : null,
      };
      addAllNameForms(name, identity);
    }
    for (const tag of detail?.tags ?? []) {
      // Map the tag's *creator* to their own identity (e.g. "Amado" â†’ Amado).
      // Don't map the tag *label* â€” that would paint the tagged person with
      // the creator's photo. If the tagged person is a contributor with an
      // account, they're already in the lookup; otherwise findPerson returns
      // null and downstream callers fall back to a name-hashed pastel.
      const creator = tag.createdBy;
      if (creator) {
        const creatorName = getUserDisplayName(creator);
        addAllNameForms(creatorName, {
          userId: creator.id ?? null,
          email: creator.email ?? null,
          phoneNumber: null,
          id: creator.id ?? null,
          avatarUrl: creator.avatarUrl ?? null,
        });
      }
    }
    return map;
  }, [detail]);

  const findPerson = useCallback<FindPerson>(
    (name: string) => personLookup.get(name.trim().toLowerCase()) ?? null,
    [personLookup]
  );
  // Kept for surfaces that only consume the avatar URL (legacy call sites).
  // Prefer findPerson everywhere going forward.
  const findAvatar = useCallback<FindAvatar>(
    (name: string) => findPerson(name)?.avatarUrl ?? null,
    [findPerson]
  );

  const wikiClaims = useReconciliationClaims(emberId);
  const emberStories = useEmberStories(emberId);
  // null = still fetching; used to keep tracker badges grey until resolved
  const wikiClaimsLoading = wikiClaims === null;
  const whyClaims = useMemo(
    () => (wikiClaims ? wikiClaims.filter((c) => c.claimType === 'why') : null),
    [wikiClaims]
  );
  const emotionClaims = useMemo(
    () => (wikiClaims ? wikiClaims.filter((c) => c.claimType === 'emotion') : null),
    [wikiClaims]
  );
  const extraStoryClaims = useMemo(
    () => (wikiClaims ? wikiClaims.filter((c) => c.claimType === 'extra_story') : null),
    [wikiClaims]
  );
  const placeClaims = useMemo(
    () => (wikiClaims ? wikiClaims.filter((c) => c.claimType === 'place') : null),
    [wikiClaims]
  );
  const personClaims = useMemo(
    () => (wikiClaims ? wikiClaims.filter((c) => c.claimType === 'person') : null),
    [wikiClaims]
  );
  const activeContributors = contributors.filter((contributor) => (contributor.userId || contributor.user) && contributor.userId !== ownerUserId && contributor.user?.id !== ownerUserId);

  const [sendingSmsContributorId, setSendingSmsContributorId] = useState<string | null>(null);
  const [sentSmsIds, setSentSmsIds] = useState<Set<string>>(new Set());
  async function sendInviteSms(contributorId: string) {
    setSendingSmsContributorId(contributorId);
    try {
      const res = await fetch(`/api/contributors/${contributorId}/send-invite-sms`, { method: 'POST' });
      if (res.ok) {
        setSentSmsIds((prev) => new Set(prev).add(contributorId));
        toast('Invite SMS sent!', { type: 'success' });
      } else {
        toast('Could not send SMS.', { type: 'error' });
      }
    } catch {
      toast('Could not send SMS.', { type: 'error' });
    } finally {
      setSendingSmsContributorId(null);
    }
  }

  const [copiedContributorId, setCopiedContributorId] = useState<string | null>(null);
  function copyContributorLink(contributorId: string, token: string) {
    const url = `${window.location.origin}/inbound/${token}`;
    void navigator.clipboard.writeText(url).then(
      () => {
        setCopiedContributorId(contributorId);
        setTimeout(() => setCopiedContributorId((prev) => prev === contributorId ? null : prev), 2000);
        toast('Invite link copied!', { type: 'success' });
      },
      () => toast('Could not copy link.', { type: 'error' })
    );
  }

  const [callingContributorId, setCallingContributorId] = useState<string | null>(null);
  const [calledIds, setCalledIds] = useState<Set<string>>(new Set());
  async function callContributor(contributorId: string) {
    setCallingContributorId(contributorId);
    try {
      const res = await fetch('/api/voice/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contributorId }),
      });
      if (res.ok) {
        setCalledIds((prev) => new Set(prev).add(contributorId));
        toast('Calling contributorâ€¦', { type: 'success' });
      } else {
        toast('Could not place call.', { type: 'error' });
      }
    } catch {
      toast('Could not place call.', { type: 'error' });
    } finally {
      setCallingContributorId(null);
    }
  }

  const [manageInitialExpandedId, setManageInitialExpandedId] = useState<string | null>(null);
  const openContributorRow = (contributorId: string) => {
    setManageInitialExpandedId(contributorId);
    setEditingSlug('contributors');
  };

  // A real pending contributor has at least one identifier (name / email /
  // phoneNumber). Rows with all identity fields null are share-link
  // placeholders that anchor the share token â€” never surface them.
  const pendingContributors = contributors.filter((contributor) =>
    !contributor.userId &&
    !contributor.user &&
    Boolean(contributor.name || contributor.email || contributor.phoneNumber)
  );
  // Story Circle completion now requires BOTH owner and contributor user
  // messages â€” a complete story circle is one where the memory has been
  // narrated AND a contributor has weighed in. Auto-welcome assistant
  // messages are excluded since they don't reflect real engagement.
  const ownerUserMessages = (detail?.chatBlocks || []).reduce(
    (sum, block) =>
      sum + (block.isOwner ? block.messages.filter((m) => m.role === 'user').length : 0),
    0
  );
  const contributorUserMessages = (detail?.chatBlocks || []).reduce(
    (sum, block) =>
      sum + (block.isOwner ? 0 : block.messages.filter((m) => m.role === 'user').length),
    0
  );
  const totalStoryMessages = ownerUserMessages + contributorUserMessages;
  // Split why/emotion claims by attribution. Owner-sourced = userId matches
  // the ember owner. Contributor-sourced = any claim with a different userId
  // (logged-in contributor) or an emberContributorId. Guests have neither.
  const ownerWhyClaims = (whyClaims || []).filter(
    (c) => c.userId !== null && c.userId === ownerUserId
  );
  const contributorWhyClaims = (whyClaims || []).filter(
    (c) =>
      (c.userId !== null && c.userId !== ownerUserId) || c.contributorId !== null
  );
  const ownerEmotionClaims = (emotionClaims || []).filter(
    (c) => c.userId !== null && c.userId === ownerUserId
  );
  const contributorEmotionClaims = (emotionClaims || []).filter(
    (c) =>
      (c.userId !== null && c.userId !== ownerUserId) || c.contributorId !== null
  );
  // storyCircleComplete / whyComplete / emotionComplete are computed later
  // from the rule evaluator (uses admin-configurable thresholds).
  const isAudioAttachment = (attachment: KipemberAttachment) =>
    attachment.mediaType === 'AUDIO' ||
    isAudioLikeFilename(attachment.filename) ||
    isAudioLikeFilename(attachment.originalName);
  const visualAttachments = (detail?.attachments || []).filter(
    (attachment) => !isAudioAttachment(attachment)
  );
  const {
    placeName,
    addressLines,
    showExactAddress,
    coordinateLine,
    country: placeCountry,
    source: placeSource,
    confirmedAt: placeConfirmedAt,
    isLoading: locationLookupPending,
  } = placeResolution;

  // People-tagged check (lifted out of its render-time IIFE so the
  // progress tracker can read it).
  // Use peopleObserved (the same source as TagPeopleSlider) so the wiki
  // and the slider agree on how many people need tagging.
  const detectedPeopleCount = detail?.analysis?.peopleObserved?.length ?? null;
  const taggedPeopleCount = detail?.tags?.length ?? 0;
  const peopleComplete = taggedPeopleCount > 0;

  // Admin tracker config (which slugs are enabled + completion rule
  // per step). While loading, we fall back to "everything enabled with
  // default rules" so the bar doesn't briefly hide steps.
  const trackerConfig = useTrackerConfig();

  // Multi-party engagement: build a stable identity key for every
  // contributor on the ember (invited) and for every contributor that
  // has actually contributed messages / claims (engaged). The "All
  // invited" rule needs both to compute "X of Y".
  const makeIdentityKey = (input: {
    userId?: string | null;
    email?: string | null;
    phoneNumber?: string | null;
    name?: string | null;
  }): string | null => {
    if (input.userId) return `u:${input.userId}`;
    if (input.email) return `e:${input.email.trim().toLowerCase()}`;
    if (input.phoneNumber) return `p:${input.phoneNumber}`;
    if (input.name) return `n:${input.name.trim().toLowerCase()}`;
    return null;
  };

  const invitedContributorKeys = new Set<string>();
  const invitedKeyByContributorId = new Map<string, string>();
  for (const c of [...activeContributors, ...pendingContributors]) {
    const key = makeIdentityKey({
      userId: c.user?.id ?? c.userId ?? null,
      email: c.user?.email ?? c.email ?? null,
      phoneNumber: c.phoneNumber ?? null,
      name: c.name ?? null,
    });
    if (key) {
      invitedContributorKeys.add(key);
      invitedKeyByContributorId.set(c.id, key);
    }
  }

  const storyCircleEngagedKeys = new Set<string>();
  for (const block of detail?.chatBlocks ?? []) {
    if (block.isOwner) continue;
    if (!block.messages.some((m) => m.role === 'user')) continue;
    const key = makeIdentityKey({
      userId: block.personUserId ?? null,
      email: block.personEmail ?? null,
      phoneNumber: block.personPhoneNumber ?? null,
      name: block.personName ?? null,
    });
    if (key) storyCircleEngagedKeys.add(key);
  }

  const claimContributorKey = (claim: ReconciliationClaim): string | null => {
    if (claim.userId && claim.userId !== ownerUserId) return `u:${claim.userId}`;
    if (claim.contributorId) {
      return invitedKeyByContributorId.get(claim.contributorId) ?? `c:${claim.contributorId}`;
    }
    return null;
  };

  const whyEngagedKeys = new Set<string>();
  for (const claim of whyClaims ?? []) {
    const key = claimContributorKey(claim);
    if (key) whyEngagedKeys.add(key);
  }

  const emotionEngagedKeys = new Set<string>();
  for (const claim of emotionClaims ?? []) {
    const key = claimContributorKey(claim);
    if (key) emotionEngagedKeys.add(key);
  }

  type RuleResult = {
    complete: boolean;
    missingLabel: React.ReactNode | null; // shown on the missing chip when not complete
  };
  const evaluateMultiParty = (
    slug: string,
    ownerHas: boolean,
    engagedKeys: Set<string>
  ): RuleResult => {
    const cfg = trackerConfig?.find((s) => s.slug === slug);
    const ownerRequired = cfg?.ownerRequired ?? true;
    const contributorMin = cfg === undefined ? 1 : cfg.contributorMin; // default 1 to preserve prior behavior
    const ownerPart = !ownerRequired || ownerHas;
    const required =
      contributorMin === null ? invitedContributorKeys.size : contributorMin ?? 0;
    const haveCount = engagedKeys.size;
    const contributorPart = required === 0 ? true : haveCount >= required;
    const complete = ownerPart && contributorPart;
    let missingLabel: React.ReactNode | null = null;
    if (!complete && required > 0) {
      const denom = contributorMin === null ? 'All' : String(required);
      missingLabel = (
        <>
          <span className="text-white">{haveCount}</span>/{denom}
        </>
      );
    }
    return { complete, missingLabel };
  };

  const storyCircleResult = evaluateMultiParty(
    'story-circle',
    ownerUserMessages > 0,
    storyCircleEngagedKeys
  );
  const whyResult = evaluateMultiParty(
    'why',
    ownerWhyClaims.length > 0,
    whyEngagedKeys
  );
  const emotionResult = evaluateMultiParty(
    'emotional-states',
    ownerEmotionClaims.length > 0,
    emotionEngagedKeys
  );
  // Aliases for the wiki section badges â€” these consume the same rule
  // result, so the badge state matches the progress bar exactly.
  const storyCircleComplete = storyCircleResult.complete;
  const whyComplete = whyResult.complete;
  const emotionComplete = emotionResult.complete;

  // Universal ember progress tracker â€” the 10 steps that feed the
  // progress bar above IDENTITY. Order here is the order chips appear
  // when missing. Each `slug` matches the `id` rendered on its
  // WikiSection so chip taps can scrollIntoView.
  const allTrackerSteps: ReadonlyArray<{
    slug: string;
    label: string;
    complete: boolean;
    missingLabel?: React.ReactNode | null;
  }> = [
    {
      slug: 'contributors',
      label: 'Contributor',
      complete:
        activeContributors.length > 0 ||
        pendingContributors.length > 0 ||
        Boolean(detail?.analysis?.noContributors),
    },
    { slug: 'people', label: 'Tag People', complete: peopleComplete },
    { slug: 'title', label: 'Title', complete: Boolean(detail?.title) },
    { slug: 'snapshot', label: 'Snapshot', complete: Boolean(detail?.snapshot?.script) },
    {
      slug: 'time-place',
      label: 'Time & Place',
      complete:
        Boolean(detail?.analysis?.capturedAt || detail?.createdAt) &&
        Boolean(placeName || addressLines.length > 0 || coordinateLine),
    },
    {
      slug: 'photos',
      label: 'Cover Photo',
      complete: Boolean(detail?.originalName || visualAttachments.length),
    },
    {
      slug: 'image-analysis',
      label: 'Image Analysis',
      complete: detail?.analysis?.status === 'ready',
    },
    {
      slug: 'story-circle',
      label: 'Story Circle',
      complete: storyCircleResult.complete,
      missingLabel: storyCircleResult.missingLabel,
    },
    {
      slug: 'why',
      label: 'Why',
      complete: whyResult.complete,
      missingLabel: whyResult.missingLabel,
    },
    {
      slug: 'emotional-states',
      label: 'Emotional States',
      complete: emotionResult.complete,
      missingLabel: emotionResult.missingLabel,
    },
  ];
  const enabledSlugs = trackerConfig ? new Set(trackerConfig.map((s) => s.slug)) : null;
  const trackerSteps = enabledSlugs
    ? allTrackerSteps.filter((step) => enabledSlugs.has(step.slug))
    : allTrackerSteps;

  // Map each editing slug to the inputs the overlay header needs
  // (icon + display label) so we can render the right edit slider.
  const editingMeta: Record<NonNullable<EditingSlug>, { label: string; icon: React.ReactNode }> = {
    title: { label: 'Edit Title', icon: <PencilLine size={22} color="var(--text-primary)" strokeWidth={1.6} /> },
    snapshot: { label: 'Edit Snapshot', icon: <ScanEye size={22} color="var(--text-primary)" strokeWidth={1.6} /> },
    'time-place': { label: 'Edit Time & Place', icon: <Clock size={22} color="var(--text-primary)" strokeWidth={1.6} /> },
    contributors: { label: 'Contributors', icon: <Users size={22} color="var(--text-primary)" strokeWidth={1.6} /> },
    'add-contributor': { label: 'Contributors', icon: <Users size={22} color="var(--text-primary)" strokeWidth={1.6} /> },
    'tag-people': { label: 'Tag People', icon: <Users size={22} color="var(--text-primary)" strokeWidth={1.6} /> },
  };
  const activeEditMeta = editingSlug ? editingMeta[editingSlug] : null;

  return (
    <>
    <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-7 pb-10">
      <EmberProgressBar steps={trackerSteps} />

      {/* IDENTITY â€” who is involved with this ember. */}
      <WikiGroup label="Identity">

      <WikiSection
        icon={<ShieldUser size={17} />}
        title="Owner"
        complete={Boolean(ownerName)}
        hideBadge
      >
        <WikiCard>
          {ownerName ? (
            <div className="flex items-center gap-3">
              <AvatarCircle
                name={ownerName}
                avatarUrl={detail?.owner?.avatarFilename ? `/api/uploads/${detail.owner.avatarFilename}` : null}
                bgColor={OWNER_AVATAR_BG}
              />
              <span className="text-white text-sm font-medium">{ownerName}</span>
              {detail?.owner?.createdAt ? (
                <span className="ml-auto text-white/30 text-xs font-medium">
                  Member since {new Date(detail.owner.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
              ) : null}
            </div>
          ) : (
            <p className="text-white/30 text-sm">Owner data is not available.</p>
          )}
        </WikiCard>
      </WikiSection>

      <WikiSection
        icon={<Users size={17} />}
        title="Contributors"
        complete={
          activeContributors.length > 0 ||
          pendingContributors.length > 0 ||
          Boolean(detail?.analysis?.noContributors)
        }
        tracksProgress
        loading={wikiClaimsLoading}
        id="tracker-contributors"
      >
        <div className="flex flex-col gap-2.5">
            {activeContributors.map((contributor) => {
              const contributorName =
                contributor.name ||
                getUserDisplayName(contributor.user) ||
                contributor.phoneNumber ||
                contributor.user?.phoneNumber ||
                'Contributor';
              const chatCount = contributor.conversation?.messages.filter((m) => m.role === 'user').length ?? 0;
              const contributedCalls = contributor.voiceCalls?.filter((c) => c.callSummary) ?? [];
              const callCount = contributedCalls.length;
              const totalContributions = chatCount + callCount;
              return (
                <WikiCard key={contributor.id} onClick={() => openContributorRow(contributor.id)}>
                  <div className="flex items-center gap-3 min-w-0">
                    <AvatarCircle
                      name={contributorName}
                      avatarUrl={contributor.user?.avatarFilename ? `/api/uploads/${contributor.user.avatarFilename}` : null}
                      bgColor={contributor.avatarColor ?? pastelForContributorIdentity({
                        userId: contributor.user?.id ?? contributor.userId ?? null,
                        email: contributor.email ?? contributor.user?.email ?? null,
                        phoneNumber: contributor.phoneNumber ?? contributor.user?.phoneNumber ?? null,
                        id: contributor.id,
                      })}
                    />
                    <span className="text-white text-sm font-medium flex-1 min-w-0">
                      {contributorName.length > 15 ? contributorName.slice(0, 15).trimEnd() + 'â€¦' : contributorName}
                      <span className="font-normal ml-1 text-xs" style={{ color: 'var(--text-muted)' }}>(<span style={{ color: totalContributions > 0 ? 'var(--color-success)' : 'var(--text-muted)', fontWeight: 600 }}>{totalContributions}</span>)</span>
                    </span>
                    <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <div
                        title="Send invite SMS"
                        className="flex items-center justify-center rounded-full transition-colors cursor-pointer bg-white/[0.07] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/[0.14]"
                        style={{ width: 30, height: 30, opacity: sendingSmsContributorId === contributor.id ? 0.5 : 1 }}
                        onClick={() => void sendInviteSms(contributor.id)}
                      >
                        <MessageSquareShare size={14} color={contributor.inviteSent || sentSmsIds.has(contributor.id) ? 'var(--color-success)' : 'var(--text-muted)'} />
                      </div>
                      <div
                        title="Call contributor"
                        className="flex items-center justify-center rounded-full transition-colors cursor-pointer bg-white/[0.07] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/[0.14]"
                        style={{ width: 30, height: 30, opacity: callingContributorId === contributor.id ? 0.5 : 1 }}
                        onClick={() => void callContributor(contributor.id)}
                      >
                        <Phone size={14} color={callCount > 0 || calledIds.has(contributor.id) ? 'var(--color-success)' : 'var(--text-muted)'} />
                      </div>
                      {contributor.token ? (
                        <div
                          title="Copy invite link"
                          className="flex items-center justify-center rounded-full transition-colors cursor-pointer bg-white/[0.07] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/[0.14]"
                          style={{ width: 30, height: 30 }}
                          onClick={() => copyContributorLink(contributor.id, contributor.token!)}
                        >
                          <Link2 size={14} color={copiedContributorId === contributor.id ? 'var(--color-success)' : 'var(--text-muted)'} />
                        </div>
                      ) : null}
                      <span style={{ color: 'var(--border-default)', fontSize: 12 }}>|</span>
                      <div
                        title={contributor.user?.hasPassword ? 'Account created' : 'No account yet'}
                        className="flex items-center justify-center rounded-full flex-shrink-0 bg-white/[0.07]"
                        style={{ width: 30, height: 30 }}
                      >
                        {contributor.user?.hasPassword
                          ? <CircleCheckBig size={17} color="rgba(34,197,94,0.7)" />
                          : <CircleHelp size={17} color="var(--text-muted)" />
                        }
                      </div>
                    </div>
                  </div>
                </WikiCard>
              );
            })}
            {pendingContributors.map((contributor) => {
              const pendingChatCount = contributor.conversation?.messages.filter((m) => m.role === 'user').length ?? 0;
              const pendingCallCount = contributor.voiceCalls?.filter((c) => c.callSummary).length ?? 0;
              const pendingTotal = pendingChatCount + pendingCallCount;
              return (
              <WikiCard key={contributor.id} onClick={() => openContributorRow(contributor.id)}>
                <div className="flex items-center gap-3 min-w-0">
                  <AvatarCircle
                    name={contributor.name || contributor.phoneNumber || '?'}
                    bgColor={contributor.avatarColor ?? pastelForContributorIdentity({
                      userId: contributor.userId ?? null,
                      email: contributor.email ?? null,
                      phoneNumber: contributor.phoneNumber ?? null,
                      id: contributor.id,
                    })}
                  />
                  <span className="text-white/60 text-sm flex-1 min-w-0">
                    {((n) => n.length > 15 ? n.slice(0, 15).trimEnd() + 'â€¦' : n)(contributor.name || contributor.phoneNumber || 'Pending')}
                    <span className="font-normal ml-1 text-xs" style={{ color: 'var(--text-muted)' }}>(<span style={{ color: pendingTotal > 0 ? 'var(--color-success)' : 'var(--text-muted)', fontWeight: 600 }}>{pendingTotal}</span>)</span>
                  </span>
                  <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <div
                      title="Send invite SMS"
                      className="flex items-center justify-center rounded-full transition-colors cursor-pointer bg-white/[0.07] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/[0.14]"
                      style={{ width: 30, height: 30, opacity: sendingSmsContributorId === contributor.id ? 0.5 : 1 }}
                      onClick={() => void sendInviteSms(contributor.id)}
                    >
                      <MessageSquareShare size={14} color={contributor.inviteSent || sentSmsIds.has(contributor.id) ? 'var(--color-success)' : 'var(--text-muted)'} />
                    </div>
                    <div
                      title="Call contributor"
                      className="flex items-center justify-center rounded-full transition-colors cursor-pointer bg-white/[0.07] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/[0.14]"
                      style={{ width: 30, height: 30, opacity: callingContributorId === contributor.id ? 0.5 : 1 }}
                      onClick={() => void callContributor(contributor.id)}
                    >
                      <Phone size={14} color={pendingCallCount > 0 || calledIds.has(contributor.id) ? 'var(--color-success)' : 'var(--text-muted)'} />
                    </div>
                    {contributor.token ? (
                      <div
                        title="Copy invite link"
                        className="flex items-center justify-center rounded-full transition-colors cursor-pointer bg-white/[0.07] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/[0.14]"
                        style={{ width: 30, height: 30 }}
                        onClick={() => copyContributorLink(contributor.id, contributor.token!)}
                      >
                        <Link2 size={14} color={copiedContributorId === contributor.id ? 'var(--color-success)' : 'var(--text-muted)'} />
                      </div>
                    ) : null}
                    <span style={{ color: 'var(--border-default)', fontSize: 12 }}>|</span>
                    <div
                      title="No account yet"
                      className="flex items-center justify-center rounded-full flex-shrink-0 bg-white/[0.07]"
                      style={{ width: 30, height: 30 }}
                    >
                      <CircleHelp size={17} color="var(--text-muted)" />
                    </div>
                  </div>
                </div>
              </WikiCard>
              );
            })}
          </div>
      </WikiSection>

      {/* Rendered outside WikiSection so the section's whole-card hover
          doesn't glow this button along with it. */}
      <button
        type="button"
        onClick={() => setEditingSlug('add-contributor')}
        disabled={!detail?.id}
        className="w-full rounded-xl px-4 py-3.5 flex items-center justify-center text-white text-sm font-medium cursor-pointer [@media(hover:hover)]:hover:brightness-110 transition-[filter] duration-150 disabled:opacity-50"
        style={{
          background: 'var(--bg-overlay)',
          border: '2px dashed rgba(255, 255, 255, 0.18)',
          minHeight: 44,
          marginTop: -4,
        }}
      >
        Add A Contributor
      </button>

      {(() => {
        const detected = detectedPeopleCount;
        const remaining = detected !== null ? detected - taggedPeopleCount : 0;
        const peopleBadgeLabel: React.ReactNode =
          detected === null
            ? 'Not Complete'
            : peopleComplete
              ? 'Complete'
              : (
                  <>
                    Need to tag <span className="text-white">{remaining}</span>{' '}
                    {remaining === 1 ? 'Person' : 'People'}
                  </>
                );
        return (
          <WikiSection
            icon={<Users size={17} />}
            title="Tag People"
            complete={peopleComplete}
            badgeLabel={peopleBadgeLabel}
            onEdit={detail?.id ? () => setEditingSlug('tag-people') : undefined}
            tracksProgress
            loading={wikiClaimsLoading}
            id="tracker-people"
          >
        <WikiCard>
          {detail?.tags && detail.tags.length > 0 ? (
            <div className="flex flex-col gap-2">
              {detail.tags.map((tag, i) => (
                <div key={tag.id} className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: TAG_COLORS[i % TAG_COLORS.length] }}
                  />
                  <p className="text-white text-sm">{tag.label}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-white/30 text-sm">No people tagged yet.</p>
          )}
        </WikiCard>
          </WikiSection>
        );
      })()}

      </WikiGroup>

      {/* CURATION â€” what the owner authored or curated. */}
      <WikiGroup label="Curation">

      <WikiSection
        icon={<FileText size={17} />}
        title="Title"
        complete={Boolean(detail?.title)}
        onEdit={detail?.id ? () => setEditingSlug('title') : undefined}
        tracksProgress
        loading={wikiClaimsLoading}
        id="tracker-title"
      >
        <WikiCard>
          <p className="text-white font-medium text-base">
            {detail?.title || detail?.originalName || 'Untitled Ember'}
          </p>
          <p className="text-white/30 text-xs">
            Source: {detail?.title ? 'Manual entry' : 'Original upload'}
          </p>
        </WikiCard>
      </WikiSection>

      <WikiSection
        icon={<ScanEye size={17} />}
        title="Snapshot"
        complete={Boolean(detail?.snapshot?.script)}
        onEdit={detail?.id ? () => setEditingSlug('snapshot') : undefined}
        tracksProgress
        loading={wikiClaimsLoading}
        id="tracker-snapshot"
      >
        <WikiCard>
          {detail?.snapshot?.script ? (
            <>
              <p className="text-white/90 text-sm leading-relaxed">{detail.snapshot.script}</p>
              <p className="text-white/30 text-xs">Source: AI generated</p>
            </>
          ) : (
            <p className="text-white/30 text-sm">No snapshot yet.</p>
          )}
        </WikiCard>
      </WikiSection>

      </WikiGroup>

      {/* OBSERVED â€” what the camera, EXIF, GPS, and image-analysis AI saw. */}
      <WikiGroup label="Observed">

      {/* Time & Place â€” merged section mirroring the Edit Time & Place
          slider. Photo Time on top, then a divider, then the
          collapsible place block, all inside a single WikiCard. */}
      <WikiSection
        icon={<Clock size={17} />}
        title="Time & Place"
        complete={
          Boolean(detail?.analysis?.capturedAt || detail?.createdAt) &&
          Boolean(placeName || addressLines.length > 0 || coordinateLine)
        }
        onEdit={detail?.id ? () => setEditingSlug('time-place') : undefined}
        tracksProgress
        loading={wikiClaimsLoading}
        id="tracker-time-place"
      >
        <WikiCard>
          <p className="text-white font-medium text-sm">
            {formatLongDate(detail?.analysis?.capturedAt || detail?.createdAt)}
          </p>
          <p className="text-white/30 text-xs">
            Source: {detail?.analysis?.capturedAt ? 'Photo EXIF metadata' : 'Upload timestamp'}
          </p>
          <div className="my-3 h-px" style={{ background: 'var(--border-subtle)' }} />
          <PlaceCard
            placeName={placeName}
            placeConfirmedAt={placeConfirmedAt}
            showExactAddress={showExactAddress}
            addressLines={addressLines}
            placeCountry={placeCountry}
            coordinateLine={coordinateLine}
            locationLookupPending={locationLookupPending}
            placeSource={placeSource}
            bare
          />
        </WikiCard>
      </WikiSection>

      <WikiSection
        icon={<ImageIcon size={17} />}
        title="Photos"
        complete={Boolean(detail?.originalName || visualAttachments.length)}
        tracksProgress
        loading={wikiClaimsLoading}
        id="tracker-photos"
      >
        <WikiCard>
          <p className="text-white/30 text-xs font-medium mb-2">Ember Cover Photo</p>
          <div className="flex items-start gap-3">
            <div
              className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0"
              style={{ background: 'var(--bg-ember-bubble)', border: '1px solid var(--border-ember)' }}
            >
              {detail ? (
                <MediaPreview
                  mediaType={detail.mediaType}
                  filename={detail.filename}
                  posterFilename={detail.posterFilename}
                  originalName={detail.originalName}
                  usePosterForVideo
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
              <p className="text-white text-sm font-medium break-words">
                {detail?.originalName || 'Main media'}
              </p>
              <p className="text-white/30 text-xs">
                Added: {formatLongDate(detail?.createdAt)}
              </p>
            </div>
          </div>
        </WikiCard>

        {visualAttachments.length > 0 ? (
          <WikiCard>
            <p className="text-white/30 text-xs font-medium mb-2">Supporting Media</p>
            <div className="flex flex-col gap-3">
              {visualAttachments.map((attachment) => (
                <div key={attachment.id} className="flex items-start gap-3">
                  <div
                    className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0"
                    style={{ background: 'var(--bg-ember-bubble)', border: '1px solid var(--border-ember)' }}
                  >
                    <MediaPreview
                      mediaType={attachment.mediaType}
                      filename={attachment.filename}
                      posterFilename={attachment.posterFilename}
                      originalName={attachment.originalName}
                      usePosterForVideo
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <p className="text-white text-sm font-medium break-words">
                      {attachment.originalName}
                    </p>
                    <p className="text-white/30 text-xs">
                      Added: {formatLongDate(attachment.createdAt)}
                    </p>
                    {attachment.description ? (
                      <p className="text-white/30 text-xs break-words">
                        {attachment.description}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </WikiCard>
        ) : null}
      </WikiSection>

      <WikiSection
        icon={<Sparkles size={17} />}
        title="Image Analysis"
        complete={detail?.analysis?.status === 'ready'}
        tracksProgress
        loading={wikiClaimsLoading}
        id="tracker-image-analysis"
      >
        {detail ? (
          <CollapsibleAnalysisCard
            thumbnail={
              <MediaPreview
                mediaType={detail.mediaType}
                filename={detail.filename}
                posterFilename={detail.posterFilename}
                originalName={detail.originalName}
                usePosterForVideo
                className="h-full w-full object-cover"
              />
            }
            filename={detail.originalName}
          >
            <div className="flex flex-col gap-1">
              {buildStructuredAnalysisText(detail?.analysis || null)
                .split('\n')
                .map((line, index) => {
                  const cleaned = line.replace(/\*\*/g, '').trim();

                  if (!cleaned) {
                    return <div key={`analysis-gap-${index}`} className="h-2" />;
                  }

                  const isBold = line.startsWith('**') && line.endsWith('**');
                  return (
                    <p
                      key={`analysis-line-${index}`}
                      className={isBold ? 'text-white text-sm font-medium mt-2' : 'text-white/70 text-sm leading-relaxed'}
                    >
                      {cleaned}
                    </p>
                  );
                })}
            </div>
            <p className="text-white/30 text-xs mt-4">
              Source: GPT-4o
              {formatAnalysisFooterDate(detail?.analysis?.updatedAt || null)
                ? ` Â· Analyzed: ${formatAnalysisFooterDate(detail?.analysis?.updatedAt || null)}`
                : ''}
              {' Â· Prompt: image_analysis.initial_photo'}
            </p>
          </CollapsibleAnalysisCard>
        ) : null}

        {visualAttachments
          .filter((a) => a.analysisText)
          .map((attachment) => {
            let parsedAnalysis: KipemberWikiDetail['analysis'] | null = null;
            try {
              parsedAnalysis = JSON.parse(attachment.analysisText!) as KipemberWikiDetail['analysis'];
            } catch {
              parsedAnalysis = null;
            }
            const analysisText = buildStructuredAnalysisText(parsedAnalysis);

            return (
              <CollapsibleAnalysisCard
                key={`analysis-${attachment.id}`}
                thumbnail={
                  <MediaPreview
                    mediaType={attachment.mediaType}
                    filename={attachment.filename}
                    posterFilename={attachment.posterFilename}
                    originalName={attachment.originalName}
                    usePosterForVideo
                    className="h-full w-full object-cover"
                  />
                }
                filename={attachment.originalName}
              >
                <div className="flex flex-col gap-1">
                  {analysisText.split('\n').map((line, index) => {
                    const cleaned = line.replace(/\*\*/g, '').trim();
                    if (!cleaned) return <div key={`att-gap-${attachment.id}-${index}`} className="h-2" />;
                    const isBold = line.startsWith('**') && line.endsWith('**');
                    return (
                      <p
                        key={`att-line-${attachment.id}-${index}`}
                        className={isBold ? 'text-white text-sm font-medium mt-2' : 'text-white/70 text-sm leading-relaxed'}
                      >
                        {cleaned}
                      </p>
                    );
                  })}
                </div>
                <p className="text-white/30 text-xs mt-4">Source: GPT-4o Â· Prompt: image_analysis.uploaded_photo</p>
              </CollapsibleAnalysisCard>
            );
          })}
      </WikiSection>

      </WikiGroup>

      {/* CONVERSATIONS â€” Story Circle conversations + everything the
          housekeeping extractors pulled out of them. */}
      <WikiGroup label="Conversations">

      <WikiSection
        icon={<History size={17} />}
        title="Story Circle"
        complete={storyCircleComplete}
        badgeLabel={
          storyCircleComplete ? (
            'Complete'
          ) : contributorUserMessages === 0 ? (
            <>
              Need <span className="text-white">1</span> Contributor
            </>
          ) : (
            'Not Complete'
          )
        }
        collapsible
        defaultCollapsed
        tracksProgress
        loading={wikiClaimsLoading}
        id="tracker-story-circle"
      >
        <div className="flex flex-col gap-4">
          {(detail?.chatBlocks && detail.chatBlocks.length > 0) ||
          (detail?.voiceBlocks && detail.voiceBlocks.length > 0) ||
          (detail?.callBlocks && detail.callBlocks.length > 0) ? (
            <>
              {(detail?.chatBlocks ?? []).map((block) => {
                const voiceForPerson = (detail?.voiceBlocks ?? []).find(
                  (voice) => voice.personName === block.personName
                );
                const callsForPerson = (detail?.callBlocks ?? []).filter(
                  (call) => call.personName === block.personName
                );
                return (
                  <Fragment key={`person-${block.personName}`}>
                    <CollapsibleChatBlock block={block} onRefresh={refreshDetail} />
                    {voiceForPerson ? (
                      <VoiceBlockCard block={voiceForPerson} onRefresh={refreshDetail} />
                    ) : null}
                    {callsForPerson.map((call) => (
                      <EmberCallCard key={call.voiceCallId} block={call} defaultCollapsed onRefresh={refreshDetail} />
                    ))}
                  </Fragment>
                );
              })}
              {(detail?.voiceBlocks ?? [])
                .filter((voice) =>
                  !(detail?.chatBlocks ?? []).some(
                    (block) => block.personName === voice.personName
                  )
                )
                .map((voice) => (
                  <VoiceBlockCard key={`voice-${voice.personName}`} block={voice} onRefresh={refreshDetail} />
                ))}
              {(detail?.callBlocks ?? [])
                .filter(
                  (call) =>
                    !(detail?.chatBlocks ?? []).some(
                      (block) => block.personName === call.personName
                    ) &&
                    !(detail?.voiceBlocks ?? []).some(
                      (voice) => voice.personName === call.personName
                    )
                )
                .map((call) => (
                  <EmberCallCard key={call.voiceCallId} block={call} defaultCollapsed onRefresh={refreshDetail} />
                ))}
            </>
          ) : (
            <WikiCard>
              <p className="text-white/30 text-sm">No conversations yet.</p>
            </WikiCard>
          )}
        </div>
      </WikiSection>

      <WikiSection
        icon={<Lightbulb size={17} />}
        title="Extractions"
        complete={Boolean(
          whyComplete || emotionComplete ||
          (extraStoryClaims && extraStoryClaims.length > 0) ||
          (placeClaims && placeClaims.length > 0) ||
          (personClaims && personClaims.length > 0)
        )}
        count={
          (whyClaims?.length ?? 0) +
          (emotionClaims?.length ?? 0) +
          (extraStoryClaims?.length ?? 0) +
          (placeClaims?.length ?? 0) +
          (personClaims?.length ?? 0)
        }
        collapsible
        defaultCollapsed
        loading={wikiClaimsLoading}
      >
        {(() => {
          // New extractions UI: one card per claim, no clip pairing. The card
          // shows the LLM's distilled paraphrase on top and the verbatim
          // source(s) — chat / voice / call — underneath. See ClaimExtractionCard.
          function renderCategory(icon: React.ReactNode, label: string, claims: ReconciliationClaim[] | null) {
            const list = claims ?? [];
            return (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span style={{ color: 'var(--text-secondary)' }}>{icon}</span>
                  <h4 className="text-white/70 font-medium text-sm">{label}</h4>
                </div>
                {list.length === 0 ? (
                  <WikiCard><p className="text-white/30 text-sm">Nothing captured yet.</p></WikiCard>
                ) : (
                  <div className="flex flex-col gap-2">
                    {list.map((claim) => {
                      const name = claimSourceLabelFromMetadata(claim.metadata);
                      return (
                        <ClaimExtractionCard
                          key={claim.id}
                          claim={claim}
                          person={name ? findPerson(name) : null}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <div className="flex flex-col gap-6">
              {renderCategory(<Lightbulb size={15} />, 'Why', whyClaims)}
              {renderCategory(<Heart size={15} />, 'Emotional States', emotionClaims)}
              {renderCategory(<Sparkles size={15} />, 'Extra Stories', extraStoryClaims)}
              {renderCategory(<MapIcon size={15} />, 'Places Mentioned', placeClaims)}
              {renderCategory(<Users size={15} />, 'People Mentioned', personClaims)}
            </div>
          );
        })()}
      </WikiSection>

      </WikiGroup>

      {/* PUBLIC â€” activity from share-link visitors who are not on the
          account. Kept separate from Conversations (which covers
          owner / contributor / voice / call) so there's a clear line
          between people-on-the-account and anonymous viewers. */}
      <WikiGroup label="Public">

      <WikiSection
        icon={<Sparkles size={17} />}
        title="Guest Stories"
        complete={Boolean(emberStories && emberStories.length > 0)}
        count={emberStories?.length ?? 0}
        collapsible
        defaultCollapsed
      >
        <StoriesCard stories={emberStories} />
      </WikiSection>

      {/* Guest Talk â€” share-link visitor conversations live here as their
          own block, separate from Story Circle (which is about
          owner/contributor/voice/call). Lifted out so the wiki keeps a
          clear line between people-on-the-account and anonymous viewers
          dropped into the memory by a link. */}
      <WikiSection
        icon={<MessagesSquare size={17} />}
        title="Guest Talk"
        complete={Boolean(detail?.guestChatBlock && detail.guestChatBlock.visitors.length > 0)}
        count={detail?.guestChatBlock?.visitors.length ?? 0}
        collapsible
        defaultCollapsed
      >
        {detail?.guestChatBlock && detail.guestChatBlock.visitors.length > 0 ? (
          <div className="flex flex-col gap-4">
            {detail.guestChatBlock.visitors.map((visitor, idx) => {
              const visitorNumber = idx + 1;
              return (
                <Fragment key={visitor.visitorId}>
                  {visitor.chatMessages.length > 0 ? (
                    <CollapsibleGuestVisitorChatBlock
                      visitor={visitor}
                      visitorNumber={visitorNumber}
                    />
                  ) : null}
                  {visitor.voiceMessages.length > 0 ? (
                    <CollapsibleGuestVisitorVoiceBlock
                      visitor={visitor}
                      visitorNumber={visitorNumber}
                    />
                  ) : null}
                </Fragment>
              );
            })}
          </div>
        ) : (
          <WikiCard>
            <p className="text-white/30 text-sm">No guest conversations yet.</p>
          </WikiCard>
        )}
      </WikiSection>

      </WikiGroup>

      {/* CONTROL â€” owner-only ember controls. Privacy toggles and the
          delete action live inline here; Download is a placeholder until
          we ship the export pipeline. Defaults to collapsed so the
          destructive controls aren't right under the user's thumb. */}
      <WikiGroup label="Control" defaultCollapsed>

      <WikiSection icon={<Lock size={17} />} title="Privacy Setting" complete={false} hideBadge>
        <PrivacyToggles
          emberId={emberId}
          shareToNetwork={Boolean(detail?.shareToNetwork)}
          keepPrivate={Boolean(detail?.keepPrivate)}
          refreshDetail={refreshDetail}
          onStatus={onStatus}
        />
      </WikiSection>

      <WikiSection
        icon={<Download size={17} />}
        title="Download Ember"
        complete={false}
        hideBadge
      >
        <WikiCard>
          <p className="text-white/60 text-sm">
            Export this ember as a single archive â€” photos, wiki text, voice
            clips, call transcripts, and contributor history. Not yet
            available.
          </p>
        </WikiCard>
      </WikiSection>

      <WikiSection
        icon={<ArrowRightLeft size={17} />}
        title="Transfer Ember"
        complete={false}
        hideBadge
      >
        <WikiCard>
          <p className="text-white/60 text-sm">
            Hand this ember to another user. They become the owner â€” full
            admin rights over contributors, privacy, and content â€” and any
            ongoing costs (storage, voice, calls) move to their account. Not
            yet available.
          </p>
        </WikiCard>
      </WikiSection>

      <WikiSection
        icon={<LockKeyhole size={17} />}
        title="Lock Ember"
        complete={false}
        hideBadge
      >
        <WikiCard>
          <p className="text-white/60 text-sm">
            Freeze the wiki. Owner, contributor, and guest conversations keep
            recording into the archive, but new messages stop feeding the
            model â€” the wiki you see today is what stays. Not yet available.
          </p>
        </WikiCard>
      </WikiSection>

      <WikiSection icon={<Trash2 size={17} />} title="Delete Ember" complete={false} hideBadge>
        <DeleteEmberCard emberId={emberId} canManage={Boolean(detail?.canManage)} onStatus={onStatus} />
      </WikiSection>
      </WikiGroup>

    </div>

    {/* Edit overlay â€” slides in over the wiki (which itself is a modal
        over the ember view). The wiki stays mounted underneath so
        scroll, expanded sections, and progress bar all persist.
        Portaled to document.body so its fixed positioning is anchored
        to the viewport rather than the wiki's transform-containing
        block (the wiki's slide-in-right transform would otherwise
        capture our `fixed` and shift the peek off-axis). */}
    {editingSlug && emberId && activeEditMeta && refreshDetail && typeof document !== 'undefined'
      ? createPortal(
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="relative w-full max-w-xl h-full flex">
          <button
            type="button"
            onClick={closeEditOverlay}
            className="h-full"
            style={{ width: '8%', cursor: 'pointer' }}
            aria-label="Back to wiki"
          />
          <div
            className="flex-1 h-full flex flex-col"
            style={{
              background: 'var(--bg-drill)',
              borderLeft: '1px solid var(--border-subtle)',
              transform: overlayOpen ? 'translateX(0)' : 'translateX(100%)',
              transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            <div
              className="flex items-center gap-3 px-4 flex-shrink-0"
              style={{ height: 56, borderBottom: '1px solid var(--border-subtle)' }}
            >
              <span className="flex-shrink-0">{activeEditMeta.icon}</span>
              <h2 className="flex-1 text-white font-medium text-base">{activeEditMeta.label}</h2>
              <button
                type="button"
                onClick={closeEditOverlay}
                aria-label="Close"
                className="w-9 h-9 flex items-center justify-center flex-shrink-0 rounded-full can-hover"
                style={{ opacity: 0.75, cursor: 'pointer' }}
              >
                <X size={20} color="var(--text-primary)" strokeWidth={1.8} />
              </button>
            </div>
            <div className="relative flex-1 px-5 min-h-0 flex flex-col overflow-y-auto no-scrollbar py-4 gap-4">
              {editingSlug === 'title' ? (
                <EditTitleSlider
                  detail={detail}
                  emberId={emberId}
                  refreshDetail={async () => {
                    await refreshDetail();
                  }}
                  onStatus={onStatus}
                />
              ) : null}
              {editingSlug === 'snapshot' ? (
                <EditSnapshotSlider
                  detail={detail}
                  emberId={emberId}
                  refreshDetail={async () => {
                    await refreshDetail();
                  }}
                  onStatus={onStatus}
                />
              ) : null}
              {editingSlug === 'time-place' ? (
                <EditTimePlaceSlider
                  detail={detail}
                  emberId={emberId}
                  refreshDetail={async () => {
                    await refreshDetail();
                  }}
                  onStatus={onStatus}
                />
              ) : null}
              {editingSlug === 'contributors' ? (
                <ContributorsSlider
                  detail={detail}
                  emberId={emberId}
                  refreshDetail={async () => {
                    await refreshDetail();
                  }}
                  onStatus={onStatus}
                  mode="manage"
                  initialExpandedId={manageInitialExpandedId}
                />
              ) : null}
              {editingSlug === 'add-contributor' ? (
                <ContributorsSlider
                  detail={detail}
                  emberId={emberId}
                  refreshDetail={async () => {
                    await refreshDetail();
                  }}
                  onStatus={onStatus}
                  mode="add"
                  onSaved={() => closeEditOverlay()}
                />
              ) : null}
              {editingSlug === 'tag-people' && detail ? (
                <TagPeopleSlider
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  detail={detail as any}
                  emberId={emberId}
                  coverPhotoUrl={getPreviewMediaUrl({
                    mediaType: detail.mediaType,
                    filename: detail.filename,
                    posterFilename: detail.posterFilename,
                  })}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>,
          document.body,
        )
      : null}
    </>
  );
}
