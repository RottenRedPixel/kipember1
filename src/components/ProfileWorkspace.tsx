'use client';

import { useCallback, useEffect, useState } from 'react';
import LogoutButton from '@/components/LogoutButton';

type FriendUser = {
  id: string;
  name: string | null;
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
  return user.name || user.email;
}

export default function ProfileWorkspace() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [friendEmail, setFriendEmail] = useState('');
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<PendingRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);
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

      setName(profilePayload.user.name || '');
      setEmail(profilePayload.user.email || '');
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
        body: JSON.stringify({ name, email, phoneNumber }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to save profile');
      }

      setName(payload.user.name || '');
      setEmail(payload.user.email || '');
      setPhoneNumber(payload.user.phoneNumber || '');
      setSuccess('Profile updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddFriend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!friendEmail.trim()) {
      return;
    }

    setSendingRequest(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: friendEmail }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to add friend');
      }

      setFriendEmail('');
      setSuccess(payload.autoAccepted ? 'Friend request accepted.' : 'Friend request sent.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add friend');
    } finally {
      setSendingRequest(false);
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
      <div className="ember-screen text-center text-[var(--ember-muted)]">
        Loading profile...
      </div>
    );
  }

  return (
    <div className="ember-screen">
      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="ember-panel rounded-[2.25rem] p-8">
          <p className="ember-eyebrow">Profile</p>
          <h1 className="ember-heading mt-4 text-4xl text-[var(--ember-text)]">
            Keep your Ember identity current.
          </h1>
          <p className="ember-copy mt-4 max-w-2xl text-sm">
            Your network, contributor invites, and shared access all depend on this
            identity layer staying accurate and easy to recognize.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <span className="ember-chip">{friends.length} friends</span>
            <span className="ember-chip">{incomingRequests.length} incoming</span>
            <span className="ember-chip">{outgoingRequests.length} pending</span>
          </div>

          <div className="mt-6">
            <LogoutButton />
          </div>

          {(error || success) && (
            <div
              className={`mt-6 ember-status ${
                error ? 'ember-status-error' : 'ember-status-success'
              }`}
            >
              {error || success}
            </div>
          )}
        </div>

        <div className="ember-panel rounded-[2.25rem] p-6">
          <p className="ember-eyebrow">Ember network</p>
          <h2 className="ember-heading mt-4 text-3xl text-[var(--ember-text)]">
            Add friends by email
          </h2>
          <p className="ember-copy mt-3 text-sm">
            Once someone is in your network, you can share network Embers with them
            and add them as contributors in one step.
          </p>

          <form onSubmit={handleAddFriend} className="mt-6 flex flex-col gap-3">
            <input
              type="email"
              value={friendEmail}
              onChange={(event) => setFriendEmail(event.target.value)}
              placeholder="friend@example.com"
              className="ember-input"
            />
            <button
              type="submit"
              disabled={sendingRequest}
              className="ember-button-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sendingRequest ? 'Sending...' : 'Add to network'}
            </button>
          </form>
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="ember-panel-strong rounded-[2.25rem] p-6">
          <p className="ember-eyebrow">Personal details</p>
          <h2 className="ember-heading mt-4 text-3xl text-[var(--ember-text)]">
            Update your profile
          </h2>
          <p className="ember-copy mt-3 text-sm">
            Email is used for account access, while phone helps with voice and SMS
            invite flows.
          </p>

          <form onSubmit={handleProfileSave} className="mt-8 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--ember-text)]">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="ember-input"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--ember-text)]">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="ember-input"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--ember-text)]">
                Phone
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                placeholder="Recommended for SMS and voice invites"
                className="ember-input"
              />
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="ember-button-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingProfile ? 'Saving...' : 'Save profile'}
            </button>
          </form>
        </div>

        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-2">
            <section className="ember-panel rounded-[2.25rem] p-6">
              <h3 className="ember-heading text-2xl text-[var(--ember-text)]">Friends</h3>
              <p className="ember-copy mt-2 text-sm">
                People who can be added quickly to shared Embers.
              </p>

              <div className="mt-5 space-y-3">
                {friends.length === 0 ? (
                  <p className="text-sm text-[var(--ember-muted)]">No accepted friends yet.</p>
                ) : (
                  friends.map((friend) => (
                    <div key={friend.id} className="ember-card rounded-[1.6rem] px-4 py-4">
                      <div className="font-semibold text-[var(--ember-text)]">
                        {formatPersonLabel(friend.user)}
                      </div>
                      <div className="mt-1 text-sm text-[var(--ember-muted)]">
                        {friend.user.email}
                      </div>
                      {friend.user.phoneNumber && (
                        <div className="mt-1 text-xs text-[var(--ember-muted)]">
                          {friend.user.phoneNumber}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => handleFriendAction(friend.id, 'remove')}
                        className="mt-4 text-sm font-semibold text-[var(--ember-orange-deep)]"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="ember-panel rounded-[2.25rem] p-6">
              <h3 className="ember-heading text-2xl text-[var(--ember-text)]">
                Incoming requests
              </h3>
              <p className="ember-copy mt-2 text-sm">
                Approve requests to connect your network.
              </p>

              <div className="mt-5 space-y-3">
                {incomingRequests.length === 0 ? (
                  <p className="text-sm text-[var(--ember-muted)]">No incoming requests.</p>
                ) : (
                  incomingRequests.map((request) => (
                    <div key={request.id} className="ember-card rounded-[1.6rem] px-4 py-4">
                      <div className="font-semibold text-[var(--ember-text)]">
                        {formatPersonLabel(request.user)}
                      </div>
                      <div className="mt-1 text-sm text-[var(--ember-muted)]">
                        {request.user.email}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => handleFriendAction(request.id, 'accept')}
                          className="ember-button-primary min-h-0 px-4 py-2.5"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFriendAction(request.id, 'decline')}
                          className="ember-button-secondary min-h-0 px-4 py-2.5"
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

          <section className="ember-panel rounded-[2.25rem] p-6">
            <h3 className="ember-heading text-2xl text-[var(--ember-text)]">
              Pending requests
            </h3>
            <p className="ember-copy mt-2 text-sm">
              Invitations you have sent but that are not confirmed yet.
            </p>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {outgoingRequests.length === 0 ? (
                <p className="text-sm text-[var(--ember-muted)]">No pending requests.</p>
              ) : (
                outgoingRequests.map((request) => (
                  <div key={request.id} className="ember-card rounded-[1.6rem] px-4 py-4">
                    <div className="font-semibold text-[var(--ember-text)]">
                      {formatPersonLabel(request.user)}
                    </div>
                    <div className="mt-1 text-sm text-[var(--ember-muted)]">
                      {request.user.email}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleFriendAction(request.id, 'cancel')}
                      className="mt-4 text-sm font-semibold text-[var(--ember-orange-deep)]"
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
  );
}
