'use client';

import { useCallback, useEffect, useState } from 'react';
import LogoutButton from '@/components/LogoutButton';
import { getUserDisplayName } from '@/lib/user-name';

type FriendUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phoneNumber: string | null;
};

type FriendItem = {
  id: string;
  user: FriendUser;
};

type PendingRequest = {
  id: string;
  user: FriendUser;
  createdAt: string;
};

function formatPersonLabel(user: FriendUser) {
  return getUserDisplayName(user) || user.phoneNumber || '';
}

export default function ProfileWorkspace() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<PendingRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = useCallback(async () => {
    try {
      setError('');

      const [profileResponse, friendsResponse] = await Promise.all([
        fetch('/api/profile'),
        fetch('/api/friends'),
      ]);

      if (!profileResponse.ok || !friendsResponse.ok) {
        throw new Error('Failed to load profile');
      }

      const profilePayload = await profileResponse.json();
      const friendsPayload = await friendsResponse.json();

      setFirstName(profilePayload.user.firstName || '');
      setLastName(profilePayload.user.lastName || '');
      setPhoneNumber(profilePayload.user.phoneNumber || '');
      setFriends(friendsPayload.friends || []);
      setIncomingRequests(friendsPayload.incomingRequests || []);
      setOutgoingRequests(friendsPayload.outgoingRequests || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleProfileSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingProfile(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, phoneNumber }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to save profile');
      }

      setFirstName(payload.user.firstName || '');
      setLastName(payload.user.lastName || '');
      setPhoneNumber(payload.user.phoneNumber || '');
      setSuccess('Profile updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleFriendAction = async (
    id: string,
    action: 'accept' | 'decline' | 'cancel' | 'remove'
  ) => {
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/friends/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to update friend request');
      }

      setSuccess('Network updated.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update network');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-2.7rem)] items-center justify-center px-4 text-center text-[var(--kip-text-secondary)]">
        Loading profile...
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-2.7rem)] bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.1),transparent_24%),linear-gradient(180deg,rgba(17,17,17,0.98)_0%,rgba(12,12,12,1)_100%)] px-4 py-5 text-white lg:px-6 lg:py-8">
      <div className="mx-auto grid w-full max-w-7xl gap-6">
        <section className="grid gap-6 lg:grid-cols-[1.02fr_0.98fr]">
          <div className="kip-panel rounded-[1.9rem] p-6 sm:p-7">
            <span className="kip-pill">Profile</span>
            <h1 className="mt-4 max-w-[14ch] text-[2.2rem] font-semibold leading-[0.96] tracking-[-0.05em] text-white sm:text-[3rem]">
              Keep your Ember identity current.
            </h1>
            <p className="mt-4 max-w-[35rem] text-sm leading-7 text-[var(--kip-text-secondary)] sm:text-base">
              Your network, contributor invites, and shared access all depend on this identity layer staying accurate and easy to recognize.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <span className="kip-sort-chip">{friends.length} friends</span>
              <span className="kip-sort-chip">{incomingRequests.length} incoming</span>
              <span className="kip-sort-chip">{outgoingRequests.length} pending</span>
            </div>

            <div className="mt-6">
              <LogoutButton />
            </div>

            {(error || success) && (
              <div
                className={`mt-6 rounded-[1.2rem] border px-4 py-3 text-sm leading-6 ${
                  error
                    ? 'border-red-500/35 bg-red-500/10 text-red-100'
                    : 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100'
                }`}
              >
                {error || success}
              </div>
            )}
          </div>

        </section>

        <section className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="kip-panel rounded-[1.9rem] p-6">
            <span className="kip-pill">Personal details</span>
            <h2 className="mt-4 text-[2rem] font-semibold leading-[0.98] tracking-[-0.05em] text-white">
              Update your profile
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--kip-text-secondary)]">
              Phone number is used for account access, voice calls, and SMS invite flows.
            </p>

            <form onSubmit={handleProfileSave} className="mt-8 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--kip-text-secondary)]">
                  First name
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  className="kip-input"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--kip-text-secondary)]">
                  Last name
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  className="kip-input"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--kip-text-secondary)]">
                  Phone
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                  placeholder="Recommended for SMS and voice invites"
                  className="kip-input"
                />
              </div>

              <button
                type="submit"
                disabled={savingProfile}
                className="kip-primary-button w-full disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingProfile ? 'Saving...' : 'Save profile'}
              </button>
            </form>
          </div>

          <div className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-2">
              <section className="kip-panel rounded-[1.9rem] p-6">
                <h3 className="text-[1.6rem] font-semibold tracking-[-0.04em] text-white">Friends</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--kip-text-secondary)]">
                  People who can be added quickly to shared Embers.
                </p>

                <div className="mt-5 space-y-3">
                  {friends.length === 0 ? (
                    <p className="text-sm text-[var(--kip-text-secondary)]">No accepted friends yet.</p>
                  ) : (
                    friends.map((friend) => (
                      <div key={friend.id} className="kip-surface rounded-[1.45rem] px-4 py-4">
                        <div className="font-semibold text-white">
                          {formatPersonLabel(friend.user)}
                        </div>
                        {friend.user.phoneNumber && (
                          <div className="mt-1 text-sm text-[var(--kip-text-secondary)]">
                            {friend.user.phoneNumber}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => handleFriendAction(friend.id, 'remove')}
                          className="mt-4 text-sm font-semibold text-[var(--kip-accent)]"
                        >
                          Remove
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="kip-panel rounded-[1.9rem] p-6">
                <h3 className="text-[1.6rem] font-semibold tracking-[-0.04em] text-white">
                  Incoming requests
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--kip-text-secondary)]">
                  Approve requests to connect your network.
                </p>

                <div className="mt-5 space-y-3">
                  {incomingRequests.length === 0 ? (
                    <p className="text-sm text-[var(--kip-text-secondary)]">No incoming requests.</p>
                  ) : (
                    incomingRequests.map((request) => (
                      <div key={request.id} className="kip-surface rounded-[1.45rem] px-4 py-4">
                        <div className="font-semibold text-white">
                          {formatPersonLabel(request.user)}
                        </div>
                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => handleFriendAction(request.id, 'accept')}
                            className="kip-primary-button min-h-0 px-4 py-2.5"
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFriendAction(request.id, 'decline')}
                            className="kip-secondary-button min-h-0 px-4 py-2.5"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>

            <section className="kip-panel rounded-[1.9rem] p-6">
              <h3 className="text-[1.6rem] font-semibold tracking-[-0.04em] text-white">
                Pending requests
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--kip-text-secondary)]">
                Invitations you have sent but that are not confirmed yet.
              </p>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {outgoingRequests.length === 0 ? (
                  <p className="text-sm text-[var(--kip-text-secondary)]">No pending requests.</p>
                ) : (
                  outgoingRequests.map((request) => (
                    <div key={request.id} className="kip-surface rounded-[1.45rem] px-4 py-4">
                      <div className="font-semibold text-white">
                        {formatPersonLabel(request.user)}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleFriendAction(request.id, 'cancel')}
                        className="mt-4 text-sm font-semibold text-[var(--kip-accent)]"
                      >
                        Cancel request
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </section>
      </div>
    </div>
  );
}
