'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { X, ChevronLeft, MessageSquare, Phone, Link as LinkIcon, ChevronDown } from 'lucide-react';
import MediaPreview from '@/components/MediaPreview';

interface Contributor {
  id: string;
  phoneNumber: string | null;
  email: string | null;
  name: string | null;
  userId: string | null;
  token: string;
  inviteSent: boolean;
  createdAt: string;
  emberSession: {
    status: string;
    currentStep: string;
  } | null;
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
  }[];
}

type ContributorDetail = {
  id: string;
  name: string | null;
  email: string | null;
  phoneNumber: string | null;
  inviteSent: boolean;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    phoneNumber: string | null;
  } | null;
  emberSession: {
    status: string;
    currentStep: string | null;
    messages: {
      id: string;
      questionType: string | null;
      question: string | null;
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
  }[];
};

interface ContributorListProps {
  imageId: string;
  ownerUserId: string;
  emberTitle: string;
  mediaType: 'IMAGE' | 'VIDEO';
  filename: string;
  posterFilename: string | null;
  contributors: Contributor[];
  canManage: boolean;
  onUpdate: () => void;
  onClose: () => void;
}

type Screen = 'list' | 'detail' | 'add';
type ContributorFormMode = 'create' | 'edit';


function formatPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

function formatShortDate(value: string | null | undefined) {
  if (!value) {
    return 'Unknown';
  }

  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(value));
  } catch {
    return 'Unknown';
  }
}

function splitName(value: string | null | undefined) {
  const trimmed = value?.trim() || '';
  if (!trimmed) {
    return { firstName: '', lastName: '' };
  }

  const [firstName, ...rest] = trimmed.split(/\s+/);
  return {
    firstName,
    lastName: rest.join(' '),
  };
}

function contributorDisplayName(contributor: Contributor | ContributorDetail) {
  return (
    contributor.name ||
    contributor.user?.name ||
    contributor.email ||
    contributor.phoneNumber ||
    'Contributor'
  );
}

function contributorEmail(contributor: Contributor | ContributorDetail) {
  return contributor.email || contributor.user?.email || null;
}

function contributorPhone(contributor: Contributor | ContributorDetail) {
  return contributor.phoneNumber || contributor.user?.phoneNumber || null;
}

function formatQuestionLabel(question: string, questionType: string) {
  if (question.trim()) {
    return question.trim();
  }

  switch (questionType) {
    case 'context':
      return 'Context';
    case 'who':
      return 'Who is in this memory?';
    case 'what':
      return 'What happened?';
    case 'when':
      return 'When did it happen?';
    case 'where':
      return 'Where did it happen?';
    case 'why':
      return 'Why does it matter?';
    case 'how':
      return 'How did it unfold?';
    default:
      return questionType;
  }
}

function startCase(value: string | null | undefined) {
  if (!value) {
    return 'Not started';
  }

  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function getContributorStatusLabel(contributor: Contributor | ContributorDetail) {
  if ('emberSession' in contributor && contributor.emberSession?.status === 'completed') {
    return 'Story saved';
  }

  if ('voiceCalls' in contributor && contributor.voiceCalls.some((call) => Boolean(call.callSummary))) {
    return 'Heard';
  }

  if (contributor.inviteSent) {
    return 'Invited';
  }

  if ('emberSession' in contributor && contributor.emberSession) {
    return 'In progress';
  }

  return 'Waiting';
}

function getLatestVoiceCallLabel(
  voiceCalls: Array<{
    startedAt: string | null;
    createdAt: string;
  }>
) {
  if (!voiceCalls.length) {
    return 'No call yet';
  }

  return formatShortDate(voiceCalls[0]?.startedAt || voiceCalls[0]?.createdAt);
}

function ContributorActionCircle({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/8 text-white/78 backdrop-blur-xl transition hover:bg-white/12 hover:text-white disabled:opacity-35"
    >
      {icon}
    </button>
  );
}

function ContributorMetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.1rem] border border-white/10 bg-black/18 px-4 py-4 backdrop-blur-xl">
      <div className="text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-white/44">
        {label}
      </div>
      <div className="mt-2 text-sm font-medium leading-6 text-white/84">{value}</div>
    </div>
  );
}

function ContributorActionButton({
  label,
  onClick,
  disabled,
  tone = 'secondary',
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'secondary';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-[3.15rem] rounded-[1rem] px-4 py-3 text-sm font-semibold transition disabled:opacity-40 ${
        tone === 'primary'
          ? 'bg-[var(--ember-stage-accent)] text-white shadow-[0_16px_30px_rgba(249,115,22,0.26)]'
          : 'border border-white/12 bg-white/8 text-white/86 backdrop-blur-xl hover:bg-white/12'
      }`}
    >
      {label}
    </button>
  );
}

export default function ContributorList({
  imageId,
  ownerUserId,
  emberTitle,
  mediaType,
  filename,
  posterFilename,
  contributors,
  canManage,
  onUpdate,
  onClose,
}: ContributorListProps) {
  const [screen, setScreen] = useState<Screen>('list');
  const [formMode, setFormMode] = useState<ContributorFormMode>('create');
  const [selectedContributorId, setSelectedContributorId] = useState<string | null>(null);
  const [selectedContributorDetail, setSelectedContributorDetail] = useState<ContributorDetail | null>(
    null
  );
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [savingAction, setSavingAction] = useState<'save' | 'sms' | 'call' | null>(null);
  const [sendingContributorId, setSendingContributorId] = useState<string | null>(null);
  const [callingContributorId, setCallingContributorId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [languagePreference, setLanguagePreference] = useState('English');

  const selectedContributor =
    contributors.find((contributor) => contributor.id === selectedContributorId) || null;
  const selectedContributorIsOwner = selectedContributor?.userId === ownerUserId;
  const detailSource = selectedContributorDetail || selectedContributor;
  const responseCount = selectedContributorDetail?.emberSession?.messages?.filter((m) => m.questionType)?.length || 0;
  const latestVoiceCall =
    selectedContributorDetail?.voiceCalls?.[0] || selectedContributor?.voiceCalls?.[0] || null;
  const detailPhone = detailSource ? contributorPhone(detailSource) : null;
  const detailEmail = detailSource ? contributorEmail(detailSource) : null;
  const detailPrefers = detailPhone ? 'SMS / Phone' : detailEmail ? 'Email / Link' : 'Private link';

  useEffect(() => {
    if (!selectedContributorId || screen !== 'detail') {
      return;
    }

    let cancelled = false;

    async function loadContributorDetail() {
      setDetailLoading(true);
      setDetailError('');

      try {
        const response = await fetch(`/api/contributors/${selectedContributorId}/details`, {
          cache: 'no-store',
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(payload?.error || 'Failed to load contributor details');
        }

        if (!cancelled) {
          setSelectedContributorDetail(payload);
        }
      } catch (loadError) {
        if (!cancelled) {
          setDetailError(
            loadError instanceof Error
              ? loadError.message
              : 'Failed to load contributor details'
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
  }, [selectedContributorId, screen, contributors]);

  const resetForm = (contributor?: Contributor | ContributorDetail | null) => {
    const { firstName: nextFirst, lastName: nextLast } = splitName(
      contributor ? contributorDisplayName(contributor) : null
    );
    setFirstName(nextFirst);
    setLastName(nextLast);
    setPhoneNumber(formatPhoneNumber(contributor ? contributorPhone(contributor) || '' : ''));
    setEmail(contributor ? contributorEmail(contributor) || '' : '');
    setLanguagePreference('English');
  };

  const openAddContributor = () => {
    setError('');
    setNotice('');
    setFormMode('create');
    setSelectedContributorId(null);
    setSelectedContributorDetail(null);
    resetForm(null);
    setScreen('add');
  };

  const openEditContributor = () => {
    const source = selectedContributorDetail || selectedContributor;
    if (!source) {
      return;
    }

    setError('');
    setNotice('');
    setFormMode('edit');
    resetForm(source);
    setScreen('add');
  };

  const openContributorDetail = (contributorId: string) => {
    setError('');
    setNotice('');
    setSelectedContributorId(contributorId);
    setSelectedContributorDetail(null);
    setScreen('detail');
  };

  const closeCurrentScreen = () => {
    setError('');
    setNotice('');

    if (screen === 'list') {
      onClose();
      return;
    }

    if (screen === 'add' && formMode === 'edit' && selectedContributorId) {
      setScreen('detail');
      return;
    }

    setScreen('list');
  };

  const handleSendInvite = async (contributorId: string) => {
    setSendingContributorId(contributorId);
    setError('');
    setNotice('');

    try {
      const response = await fetch('/api/twilio/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contributorId }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Failed to send invite');
      }

      setNotice('Invite sent.');
      onUpdate();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Failed to send invite');
    } finally {
      setSendingContributorId(null);
    }
  };

  const handleStartVoiceCall = async (contributorId: string) => {
    setCallingContributorId(contributorId);
    setError('');
    setNotice('');

    try {
      const response = await fetch('/api/voice/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contributorId }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to start voice call');
      }

      setNotice('Phone interview started.');
      onUpdate();
    } catch (callError) {
      setError(callError instanceof Error ? callError.message : 'Failed to start voice call');
    } finally {
      setCallingContributorId(null);
    }
  };

  const copyLink = async (token: string) => {
    try {
      const url = `${window.location.origin}/contribute/${token}`;
      await navigator.clipboard.writeText(url);
      setError('');
      setNotice('Contributor link copied.');
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : 'Failed to copy link');
    }
  };

  const persistContributor = async (action: 'save' | 'sms' | 'call') => {
    setSavingAction(action);
    setError('');
    setNotice('');

    const nameValue = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ').trim() || null;
    const phoneValue = phoneNumber.replace(/\D/g, '') || null;
    const emailValue = email.trim() || null;

    if (!phoneValue && !emailValue) {
      setError('Add a phone number or email to continue.');
      setSavingAction(null);
      return;
    }

    try {
      const isEditing = formMode === 'edit' && selectedContributorId;
      const response = await fetch(
        isEditing ? `/api/contributors/${selectedContributorId}` : '/api/contributors',
        {
          method: isEditing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageId,
            name: nameValue,
            phoneNumber: phoneValue,
            email: emailValue,
          }),
        }
      );

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to save contributor');
      }

      const contributorId = payload?.id || selectedContributorId;
      const contributorToken = payload?.token || selectedContributor?.token || null;

      if (!contributorId) {
        throw new Error('Contributor could not be saved');
      }

      await onUpdate();
      setSelectedContributorId(contributorId);

      if (action === 'sms') {
        await handleSendInvite(contributorId);
      } else if (action === 'call') {
        await handleStartVoiceCall(contributorId);
      } else {
        setNotice(isEditing ? 'Contributor updated.' : 'Contributor saved.');
      }

      if (action === 'save' && !isEditing) {
        setScreen('list');
      } else if (action === 'save' && isEditing) {
        setScreen('detail');
      } else if (action === 'sms' && contributorToken) {
        setScreen('detail');
      } else if (action === 'call') {
        setScreen('detail');
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save contributor');
    } finally {
      setSavingAction(null);
    }
  };

  const handleRemoveContributor = async () => {
    if (!selectedContributorId) {
      return;
    }

    setError('');
    setNotice('');

    try {
      const response = await fetch(`/api/contributors?id=${selectedContributorId}`, {
        method: 'DELETE',
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to remove contributor');
      }

      setSelectedContributorId(null);
      setSelectedContributorDetail(null);
      setScreen('list');
      setNotice('Contributor removed.');
      onUpdate();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Failed to remove contributor');
    }
  };

  const screenTitle =
    screen === 'list'
      ? 'Contributors'
      : screen === 'detail'
        ? detailSource
          ? contributorDisplayName(detailSource)
          : 'Contributor'
        : formMode === 'edit'
          ? 'Edit Contributor'
          : 'Add Contributor';

  const screenSubtitle =
    screen === 'list'
      ? 'Invite people, collect more voices, and keep the memory growing.'
      : screen === 'detail'
        ? 'Review contact details, call history, and saved memory notes.'
        : 'Send a link, text an invite, or call them directly from here.';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-[var(--ember-stage-bg)] text-white">
      <MediaPreview
        mediaType={mediaType}
        filename={filename}
        posterFilename={posterFilename}
        originalName={emberTitle}
        usePosterForVideo
        className="ember-stage-blur-media"
      />
      <MediaPreview
        mediaType={mediaType}
        filename={filename}
        posterFilename={posterFilename}
        originalName={emberTitle}
        usePosterForVideo
        className="ember-stage-main-media"
      />
      <div className="ember-stage-gradient" />

      <div className="absolute left-0 right-0 top-0 z-20 flex items-center gap-3 px-4 pt-4 pb-4">
        <button
          type="button"
          onClick={screen === 'list' ? onClose : closeCurrentScreen}
          className="ember-stage-home-button"
          aria-label={screen === 'list' ? 'Close contributors' : 'Back'}
        >
          {screen === 'list' ? <X size={18} /> : <ChevronLeft size={20} />}
        </button>
        <div className="pointer-events-none min-w-0 flex-1">
          <p className="truncate text-base font-bold leading-tight text-white">{screenTitle}</p>
          <p className="truncate text-xs text-white/55">{screenSubtitle}</p>
        </div>
      </div>

      <div className="absolute inset-x-4 bottom-6 top-24 z-30 mx-auto max-w-[22.5rem] lg:max-w-[48rem] xl:max-w-[54rem]">
        <div className="ember-stage-glass flex h-full flex-col rounded-[1.6rem] px-5 py-5 lg:px-7 lg:py-6">
          {(error || notice) && (
            <div
              className={`mb-4 rounded-[1rem] border px-4 py-3 text-sm font-medium ${
                error
                  ? 'border-[rgba(255,119,119,0.35)] bg-[rgba(94,20,20,0.48)] text-[rgba(255,210,210,0.94)]'
                  : 'border-white/10 bg-white/10 text-white/84'
              }`}
            >
              {error || notice}
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {screen === 'list' && (
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="inline-flex rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-white/62">
                      Story circle
                    </span>
                    <h2 className="mt-4 max-w-[14rem] text-[1.95rem] font-bold leading-[0.96] tracking-[-0.05em] text-white lg:max-w-[24rem] lg:text-[2.35rem]">
                      Everyone shaping this ember
                    </h2>
                    <p className="mt-3 max-w-[17rem] text-sm leading-6 text-white/58 lg:max-w-[30rem]">
                      Invite family and friends, launch calls, or open the memories they already
                      added.
                    </p>
                  </div>

                  {canManage && (
                    <button
                      type="button"
                      onClick={openAddContributor}
                      className="rounded-full border border-white/12 bg-white/8 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-white/12"
                    >
                      Add new
                    </button>
                  )}
                </div>

                <div className="mt-6 grid gap-3 lg:grid-cols-2">
                  {contributors.length === 0 ? (
                    <div className="rounded-[1.3rem] border border-white/10 bg-white/8 px-5 py-6 text-sm leading-6 text-white/62 backdrop-blur-xl lg:col-span-2">
                      No contributors added yet. Start with one invite and let the story widen from
                      there.
                    </div>
                  ) : (
                    contributors.map((contributor) => {
                      const label = contributorDisplayName(contributor);
                      const phone = contributorPhone(contributor);
                      const emailAddress = contributorEmail(contributor);
                      const statusLabel = getContributorStatusLabel(contributor);

                      return (
                        <div
                          key={contributor.id}
                          className="rounded-[1.3rem] border border-white/10 bg-white/8 p-4 backdrop-blur-xl"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => openContributorDetail(contributor.id)}
                              className="min-w-0 flex-1 text-left"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="truncate text-[1.12rem] font-semibold tracking-[-0.03em] text-white">
                                  {label}
                                </span>
                                <span className="rounded-full border border-white/12 bg-black/20 px-2.5 py-1 text-[0.64rem] font-semibold uppercase tracking-[0.16em] text-white/62">
                                  {statusLabel}
                                </span>
                                {contributor.userId === ownerUserId && (
                                  <span className="rounded-full border border-[rgba(255,122,26,0.28)] bg-[rgba(255,122,26,0.16)] px-2.5 py-1 text-[0.64rem] font-semibold uppercase tracking-[0.16em] text-[rgba(255,201,170,0.92)]">
                                    Owner
                                  </span>
                                )}
                              </div>

                              <p className="mt-2 truncate text-sm text-white/58">
                                {phone ? formatPhoneNumber(phone) : emailAddress || 'Private invite link'}
                              </p>

                              <div className="mt-3 flex flex-wrap gap-2">
                                <span className="rounded-full border border-white/10 bg-black/18 px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-white/46">
                                  Joined {formatShortDate(contributor.createdAt)}
                                </span>
                                <span className="rounded-full border border-white/10 bg-black/18 px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-white/46">
                                  Latest call {getLatestVoiceCallLabel(contributor.voiceCalls)}
                                </span>
                              </div>
                            </button>
                          </div>

                          <div className="mt-4 flex items-center justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => openContributorDetail(contributor.id)}
                              className="text-sm font-semibold text-white/72 transition hover:text-white"
                            >
                              Open details
                            </button>

                            <div className="flex items-center gap-2">
                              <ContributorActionCircle
                                label={`Send SMS to ${label}`}
                                icon={<MessageSquare size={16} />}
                                onClick={() => void handleSendInvite(contributor.id)}
                                disabled={!canManage || !phone || sendingContributorId === contributor.id}
                              />
                              <ContributorActionCircle
                                label={`Call ${label}`}
                                icon={<Phone size={16} />}
                                onClick={() => void handleStartVoiceCall(contributor.id)}
                                disabled={!canManage || !phone || callingContributorId === contributor.id}
                              />
                              <ContributorActionCircle
                                label={`Copy link for ${label}`}
                                icon={<LinkIcon size={16} />}
                                onClick={() => void copyLink(contributor.token)}
                                disabled={!canManage}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {screen === 'detail' && selectedContributor && (
              <div className="space-y-4">
                {detailLoading ? (
                  <div className="rounded-[1.3rem] border border-white/10 bg-white/8 px-5 py-5 text-sm text-white/68 backdrop-blur-xl">
                    Loading contributor...
                  </div>
                ) : (
                  <>
                    <section className="rounded-[1.35rem] border border-white/10 bg-white/8 px-5 py-5 backdrop-blur-xl">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h2 className="truncate text-[1.72rem] font-bold leading-[1] tracking-[-0.05em] text-white">
                            {contributorDisplayName(detailSource || selectedContributor)}
                          </h2>
                          {detailPhone && (
                            <p className="mt-3 text-sm leading-6 text-white/68">
                              {formatPhoneNumber(detailPhone)}
                            </p>
                          )}
                          {detailEmail && (
                            <p className="mt-1 text-sm leading-6 text-white/68">{detailEmail}</p>
                          )}
                        </div>

                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="rounded-full border border-white/10 bg-black/18 px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-white/46">
                          {getContributorStatusLabel(detailSource || selectedContributor)}
                        </span>
                        <span className="rounded-full border border-white/10 bg-black/18 px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-white/46">
                          Joined {formatShortDate(detailSource?.createdAt || selectedContributor.createdAt)}
                        </span>
                        <span className="rounded-full border border-white/10 bg-black/18 px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-white/46">
                          {detailPrefers}
                        </span>
                      </div>
                    </section>

                    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                      <ContributorMetaCard
                        label="Latest Call"
                        value={getLatestVoiceCallLabel(detailSource?.voiceCalls || selectedContributor.voiceCalls)}
                      />
                      <ContributorMetaCard
                        label="Conversation"
                        value={startCase(selectedContributorDetail?.emberSession?.status || selectedContributor.emberSession?.status)}
                      />
                      <ContributorMetaCard label="Saved Answers" value={`${responseCount}`} />
                      <ContributorMetaCard label="Language" value={languagePreference} />
                    </section>

                    {canManage && (
                      <section className="grid grid-cols-3 gap-2">
                        <ContributorActionButton
                          label="Text invite"
                          onClick={() => {
                            if (detailPhone) {
                              void handleSendInvite(selectedContributor.id);
                            } else {
                              void copyLink(selectedContributor.token);
                            }
                          }}
                          disabled={
                            sendingContributorId === selectedContributor.id ||
                            (!detailPhone && !selectedContributor.token)
                          }
                        />
                        <ContributorActionButton
                          label="Call now"
                          onClick={() => {
                            if (detailPhone) {
                              void handleStartVoiceCall(selectedContributor.id);
                            } else {
                              void copyLink(selectedContributor.token);
                            }
                          }}
                          disabled={
                            callingContributorId === selectedContributor.id ||
                            (!detailPhone && !selectedContributor.token)
                          }
                        />
                        <ContributorActionButton
                          label="Copy link"
                          tone="primary"
                          onClick={() => void copyLink(selectedContributor.token)}
                          disabled={!selectedContributor.token}
                        />
                      </section>
                    )}

                    {!selectedContributorIsOwner && canManage && (
                      <div className="flex justify-center">
                        <button
                          type="button"
                          onClick={() => void handleRemoveContributor()}
                          className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(255,186,186,0.88)]"
                        >
                          Remove contributor
                        </button>
                      </div>
                    )}

                    <section className="rounded-[1.35rem] border border-white/10 bg-white/8 px-5 py-5 backdrop-blur-xl">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-[1.18rem] font-semibold tracking-[-0.03em] text-white">
                            Memory details
                          </h3>
                          <p className="mt-1 text-sm text-white/54">
                            Saved responses and voice summaries from this contributor.
                          </p>
                        </div>
                        <span className="rounded-full border border-white/10 bg-black/18 px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-white/46">
                          {responseCount} saved
                        </span>
                      </div>

                      {latestVoiceCall?.callSummary && (
                        <div className="mt-4 rounded-[1.05rem] border border-white/10 bg-black/18 px-4 py-4 text-sm leading-6 text-white/76">
                          {latestVoiceCall.callSummary}
                        </div>
                      )}

                      {detailError && (
                        <div className="mt-4 rounded-[1rem] border border-[rgba(255,119,119,0.35)] bg-[rgba(94,20,20,0.48)] px-4 py-3 text-sm font-medium text-[rgba(255,210,210,0.94)]">
                          {detailError}
                        </div>
                      )}

                      {(selectedContributorDetail?.emberSession?.messages?.filter((m) => m.questionType)?.length ?? 0) > 0 ? (
                        <div className="mt-4 grid gap-3 lg:grid-cols-2">
                          {selectedContributorDetail!.emberSession!.messages
                            .filter((m) => m.questionType)
                            .map((message) => (
                            <article
                              key={message.id}
                              className="rounded-[1.05rem] border border-white/8 bg-black/18 px-4 py-4"
                            >
                              <div className="text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-[rgba(255,201,170,0.92)]">
                                {formatQuestionLabel(message.question || '', message.questionType || '')}
                              </div>
                              <p className="mt-3 text-sm leading-6 text-white/78">
                                {message.content}
                              </p>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-4 text-sm leading-6 text-white/58">
                          No contributions saved yet for this contributor.
                        </p>
                      )}
                    </section>
                  </>
                )}
              </div>
            )}

            {screen === 'add' && (
              <div>
                <div>
                  <span className="inline-flex rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-white/62">
                    Invite flow
                  </span>
                  <h2 className="mt-4 max-w-[15rem] text-[1.95rem] font-bold leading-[0.96] tracking-[-0.05em] text-white lg:max-w-[24rem] lg:text-[2.35rem]">
                    {formMode === 'edit' ? 'Refine their details' : 'Bring someone into this ember'}
                  </h2>
                  <p className="mt-3 max-w-[17rem] text-sm leading-6 text-white/58 lg:max-w-[30rem]">
                    Save a private link, send a text invite, or start a live phone call as soon as
                    the contact is ready.
                  </p>
                </div>

                <div className="mt-6 rounded-[1rem] overflow-hidden border border-white/12 bg-white/8 backdrop-blur-xl">
                  <input
                    type="text"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    placeholder="First name"
                    className="w-full h-12 px-4 text-sm text-white placeholder-white/36 outline-none bg-transparent"
                  />
                  <input
                    type="text"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    placeholder="Last name"
                    className="w-full h-12 px-4 text-sm text-white placeholder-white/36 outline-none bg-transparent border-t border-white/10"
                  />
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(event) => setPhoneNumber(formatPhoneNumber(event.target.value))}
                    placeholder="Phone"
                    className="w-full h-12 px-4 text-sm text-white placeholder-white/36 outline-none bg-transparent border-t border-white/10"
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Email"
                    className="w-full h-12 px-4 text-sm text-white placeholder-white/36 outline-none bg-transparent border-t border-white/10"
                  />
                  <div className="relative border-t border-white/10">
                    <select
                      value={languagePreference}
                      onChange={(event) => setLanguagePreference(event.target.value)}
                      className="w-full h-12 appearance-none px-4 pr-11 text-sm text-white outline-none bg-transparent"
                    >
                      <option value="English">English</option>
                      <option value="Spanish">Spanish</option>
                      <option value="French">French</option>
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-white/56">
                      <ChevronDown size={16} />
                    </span>
                  </div>
                </div>

                {formMode === 'edit' ? (
                  <div className="mt-6 flex gap-3">
                    <ContributorActionButton
                      label="Cancel"
                      onClick={closeCurrentScreen}
                      disabled={savingAction !== null}
                    />
                    <ContributorActionButton
                      label={savingAction === 'save' ? 'Saving…' : 'Save'}
                      tone="primary"
                      onClick={() => void persistContributor('save')}
                      disabled={savingAction !== null || (!phoneNumber.trim() && !email.trim())}
                    />
                  </div>
                ) : (
                  <div className="mt-6 grid grid-cols-3 gap-2">
                    <ContributorActionButton
                      label="Call now"
                      onClick={() => void persistContributor('call')}
                      disabled={savingAction !== null || !phoneNumber.trim()}
                    />
                    <ContributorActionButton
                      label="Text invite"
                      onClick={() => void persistContributor('sms')}
                      disabled={savingAction !== null || !phoneNumber.trim()}
                    />
                    <ContributorActionButton
                      label={savingAction === 'save' ? 'Saving…' : 'Save'}
                      tone="primary"
                      onClick={() => void persistContributor('save')}
                      disabled={savingAction !== null || (!phoneNumber.trim() && !email.trim())}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
