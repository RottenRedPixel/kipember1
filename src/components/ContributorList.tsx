'use client';

import { useEffect, useState, type ReactNode } from 'react';

interface Contributor {
  id: string;
  phoneNumber: string | null;
  email: string | null;
  name: string | null;
  userId: string | null;
  token: string;
  inviteSent: boolean;
  createdAt: string;
  conversation: {
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
  conversation: {
    status: string;
    currentStep: string;
    responses: {
      id: string;
      questionType: string;
      question: string;
      answer: string;
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
  contributors: Contributor[];
  canManage: boolean;
  onUpdate: () => void;
  onClose: () => void;
}

type Screen = 'list' | 'detail' | 'add';
type ContributorFormMode = 'create' | 'edit';

function CloseIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className={className}>
      <path d="M6 6 18 18" />
      <path d="M18 6 6 18" />
    </svg>
  );
}

function PencilIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="m4 20 4.5-1 9-9-3.5-3.5-9 9L4 20Z" />
      <path d="m13.5 6.5 3.5 3.5" />
    </svg>
  );
}

function SmsIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className}>
      <path d="M4.5 6.5h15v10h-9l-4 3v-13Z" />
    </svg>
  );
}

function PhoneIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className}>
      <path d="M7.6 5.8c.6-.6 1.5-.8 2.3-.3l1.8 1.1c.8.5 1.1 1.5.7 2.3l-.9 1.7c1.3 2.5 3.3 4.5 5.8 5.8l1.7-.9c.8-.4 1.8-.1 2.3.7l1.1 1.8c.5.8.3 1.7-.3 2.3l-1.2 1.2c-.9.9-2.3 1.2-3.5.8-5.7-1.7-10.3-6.3-12-12-.4-1.2-.1-2.6.8-3.5l1.4-1.2Z" />
    </svg>
  );
}

function LinkIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className}>
      <path d="M10.5 13.5 13.5 10.5" />
      <path d="M8.2 15.8 6.7 17.3a3.2 3.2 0 0 1-4.5-4.5l2.8-2.8a3.2 3.2 0 0 1 4.5 0" />
      <path d="m15.8 8.2 1.5-1.5a3.2 3.2 0 0 1 4.5 4.5L19 14a3.2 3.2 0 0 1-4.5 0" />
    </svg>
  );
}

function ChevronDownIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function formatPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
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

function ContributorActionSquare({
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
      className="inline-flex h-8 w-8 items-center justify-center bg-white/65 text-[#2b5e61] transition hover:bg-white disabled:opacity-40"
    >
      {icon}
    </button>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between bg-white px-5 py-4 text-[1.05rem] text-[#1b1b1b]">
      <div>
        <span className="font-semibold">{label}</span>{' '}
        <span className="font-normal text-[#333]">({value})</span>
      </div>
      <ChevronDownIcon className="h-5 w-5 text-[#1b1b1b]" />
    </div>
  );
}

export default function ContributorList({
  imageId,
  ownerUserId,
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

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to send invite');
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

  const joinedDate = selectedContributorDetail?.createdAt || selectedContributor?.createdAt || null;
  const detailPhone = detailSource ? contributorPhone(detailSource) : null;
  const detailEmail = detailSource ? contributorEmail(detailSource) : null;
  const detailPrefers = detailPhone ? 'SMS' : detailEmail ? 'Email' : 'SMS';
  const latestVoiceCall = selectedContributorDetail?.voiceCalls?.[0] || selectedContributor?.voiceCalls?.[0] || null;

  return (
    <div
      className={`ember-overlay-shell z-50 overflow-y-auto ${
        screen === 'add' ? 'bg-[#b997d3]' : 'bg-[#bfd8dc]'
      }`}
    >
      <div className="min-h-full px-4 pb-8 pt-4">
        {(error || notice) && (
          <div
            className={`mb-4 px-4 py-3 text-sm font-medium ${
              error ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
            }`}
          >
            {error || notice}
          </div>
        )}

        {screen === 'list' && (
          <div className="min-h-full">
            <div className="flex items-center justify-between">
              <h2 className="text-[2.15rem] font-semibold tracking-[-0.04em] text-black">
                Contributors
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 w-10 items-center justify-center text-black"
                aria-label="Close contributors"
              >
                <CloseIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="mt-8 space-y-6">
              {contributors.length === 0 ? (
                <div className="py-8 text-lg text-black/70">No contributors added yet.</div>
              ) : (
                contributors.map((contributor) => {
                  const label = contributorDisplayName(contributor);
                  const phone = contributorPhone(contributor);

                  return (
                    <div key={contributor.id} className="flex items-center justify-between gap-4">
                      <button
                        type="button"
                        onClick={() => openContributorDetail(contributor.id)}
                        className="min-w-0 flex-1 text-left text-[2rem] leading-none tracking-[-0.03em] text-black"
                      >
                        <span className="block truncate">{label}</span>
                      </button>

                      <div className="flex items-center gap-3">
                        <ContributorActionSquare
                          label={`Send SMS to ${label}`}
                          icon={<SmsIcon className="h-4 w-4" />}
                          onClick={() => void handleSendInvite(contributor.id)}
                          disabled={!canManage || !phone || sendingContributorId === contributor.id}
                        />
                        <ContributorActionSquare
                          label={`Call ${label}`}
                          icon={<PhoneIcon className="h-4 w-4" />}
                          onClick={() => void handleStartVoiceCall(contributor.id)}
                          disabled={!canManage || !phone || callingContributorId === contributor.id}
                        />
                        <ContributorActionSquare
                          label={`Copy link for ${label}`}
                          icon={<LinkIcon className="h-4 w-4" />}
                          onClick={() => void copyLink(contributor.token)}
                          disabled={!canManage}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {canManage && (
              <div className="mt-24 flex justify-center">
                <button
                  type="button"
                  onClick={openAddContributor}
                  className="min-w-[8.4rem] bg-[#2c696c] px-7 py-4 text-[1.1rem] font-semibold tracking-[-0.02em] text-white"
                >
                  ADD NEW
                </button>
              </div>
            )}
          </div>
        )}

        {screen === 'detail' && selectedContributor && (
          <div className="min-h-full">
            <div className="flex items-center justify-between">
              <h2 className="text-[2.05rem] font-semibold tracking-[-0.04em] text-black">
                View Contributor
              </h2>
              <button
                type="button"
                onClick={closeCurrentScreen}
                className="inline-flex h-10 w-10 items-center justify-center text-black"
                aria-label="Close contributor view"
              >
                <CloseIcon className="h-6 w-6" />
              </button>
            </div>

            {detailLoading && (
              <div className="mt-8 bg-white px-5 py-5 text-base text-[#234]">Loading contributor...</div>
            )}

            {!detailLoading && (
              <>
                <div className="mt-5 bg-white px-5 py-5 text-black">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[2.05rem] font-semibold leading-none tracking-[-0.05em]">
                        {contributorDisplayName(detailSource || selectedContributor)}
                      </div>
                      {detailPhone && (
                        <div className="mt-2 text-[1.65rem] leading-none">
                          {formatPhoneNumber(detailPhone)}
                        </div>
                      )}
                      {detailEmail && (
                        <div className="mt-2 text-[1.4rem] leading-none">
                          {detailEmail}
                        </div>
                      )}
                    </div>

                    {canManage && (
                      <button
                        type="button"
                        onClick={openEditContributor}
                        className="inline-flex h-10 w-10 items-center justify-center text-black"
                        aria-label="Edit contributor"
                      >
                        <PencilIcon className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-3 text-[1.15rem] font-semibold text-black">
                  Joined Ember{' '}
                  <span className="font-normal text-white/90">
                    | {joinedDate ? new Date(joinedDate).toLocaleDateString() : 'Unknown'}
                  </span>
                </div>

                <div className="mt-4 space-y-4">
                  <DetailRow label="Prefers" value={detailPrefers} />
                  <DetailRow label="SMS Time" value="Early Morning PST" />
                  <DetailRow label="Call Time" value="Early Morning PST" />
                  <DetailRow label="Language" value="English" />
                </div>

                {canManage && (
                  <div className="mt-6 flex gap-3 px-4">
                    <button
                      type="button"
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
                      className="flex-1 bg-[#2c696c] px-4 py-4 text-[1.05rem] font-semibold text-white disabled:opacity-50"
                    >
                      SCHEDULED
                    </button>
                    <button
                      type="button"
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
                      className="flex-1 bg-[#2c696c] px-4 py-4 text-[1.05rem] font-semibold text-white disabled:opacity-50"
                    >
                      SEND NOW
                    </button>
                  </div>
                )}

                {!selectedContributorIsOwner && canManage && (
                  <div className="mt-4 flex justify-center">
                    <button
                      type="button"
                      onClick={() => void handleRemoveContributor()}
                      className="text-sm font-semibold uppercase tracking-[0.12em] text-[#7c2020]"
                    >
                      Remove Contributor
                    </button>
                  </div>
                )}

                <div className="mt-8 border-t border-black/20 pt-5 text-black">
                  <h3 className="text-[2.15rem] font-semibold tracking-[-0.04em]">
                    {contributorDisplayName(detailSource || selectedContributor)}
                    ’s Contributions
                  </h3>

                  {latestVoiceCall?.callSummary && (
                    <div className="mt-4 bg-white/70 px-4 py-4 text-[1rem] leading-6 text-[#2d2d2d]">
                      {latestVoiceCall.callSummary}
                    </div>
                  )}

                  {detailError && (
                    <div className="mt-4 bg-rose-100 px-4 py-3 text-sm font-medium text-rose-700">
                      {detailError}
                    </div>
                  )}

                  {selectedContributorDetail?.conversation?.responses?.length ? (
                    <div className="mt-5 space-y-4 pb-8">
                      {selectedContributorDetail.conversation.responses.map((response) => (
                        <div key={response.id} className="px-1">
                          <div className="text-right text-[1rem] font-semibold italic text-[#45256d]">
                            {formatQuestionLabel(response.question, response.questionType)}
                          </div>
                          <p className="mt-2 text-[1rem] leading-6 text-white/95">
                            {response.answer}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 text-[1rem] text-black/70">
                      No contributions saved yet for this contributor.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {screen === 'add' && (
          <div className="min-h-full">
            <div className="flex items-center justify-between">
              <h2 className="text-[2.15rem] font-semibold tracking-[-0.04em] text-white">
                {formMode === 'edit' ? 'Edit Contributor' : 'Add Contributor'}
              </h2>
              <button
                type="button"
                onClick={closeCurrentScreen}
                className="inline-flex h-10 w-10 items-center justify-center text-white"
                aria-label="Close contributor form"
              >
                <CloseIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="mt-10 space-y-4">
              <input
                type="text"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                placeholder="First Name"
                className="w-full bg-white px-5 py-4 text-[1.2rem] text-[#333] placeholder:text-[#b6b6b6] outline-none"
              />
              <input
                type="text"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                placeholder="Last Name (optional)"
                className="w-full bg-white px-5 py-4 text-[1.2rem] text-[#333] placeholder:text-[#b6b6b6] outline-none"
              />
              <input
                type="tel"
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(formatPhoneNumber(event.target.value))}
                placeholder="Phone"
                className="w-full bg-white px-5 py-4 text-[1.2rem] text-[#333] placeholder:text-[#b6b6b6] outline-none"
              />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email (optional)"
                className="w-full bg-white px-5 py-4 text-[1.2rem] text-[#333] placeholder:text-[#b6b6b6] outline-none"
              />

              <div className="relative">
                <select
                  value={languagePreference}
                  onChange={(event) => setLanguagePreference(event.target.value)}
                  className="w-full appearance-none bg-white px-5 py-4 text-[1.2rem] text-[#666] outline-none"
                >
                  <option>Language Preference</option>
                  <option>English</option>
                  <option>Spanish</option>
                  <option>French</option>
                </select>
                <span className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-[#8d8d8d]">
                  <ChevronDownIcon className="h-5 w-5" />
                </span>
              </div>
            </div>

            <div className="mt-24 grid grid-cols-3 gap-1">
              <button
                type="button"
                onClick={() => void persistContributor('call')}
                disabled={savingAction !== null || !phoneNumber.trim()}
                className="bg-[#e05d89] px-3 py-6 text-[1rem] font-semibold leading-5 text-white disabled:opacity-50"
              >
                CALL
                <br />
                NOW
              </button>
              <button
                type="button"
                onClick={() => void persistContributor('sms')}
                disabled={savingAction !== null || !phoneNumber.trim()}
                className="bg-[#e95f8d] px-3 py-6 text-[1rem] font-semibold leading-5 text-white disabled:opacity-50"
              >
                SMS
                <br />
                NOW
              </button>
              <button
                type="button"
                onClick={() => void persistContributor('save')}
                disabled={savingAction !== null || (!phoneNumber.trim() && !email.trim())}
                className="bg-[#7b5ea3] px-3 py-6 text-[1rem] font-semibold leading-5 text-white disabled:opacity-50"
              >
                SAVE
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
