'use client';

import { useEffect, useState } from 'react';

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

  const loadData = async () => {
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
  };

  useEffect(() => {
    loadData();
  }, []);

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

  const handleFriendAction = async (id: string, action: 'accept' | 'decline' | 'cancel' | 'remove') => {
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
    return <div className="py-16 text-center text-slate-500">Loading profile...</div>;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[2rem] border border-white/85 bg-white/88 p-6 shadow-sm backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">
            Profile
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-950">
            Your Ember identity
          </h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Keep your email and phone current so friends can find you, invite you,
            and quickly add you to Embers as a contributor.
          </p>

          <form onSubmit={handleProfileSave} className="mt-8 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Name</label>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-amber-400 focus:bg-white"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-amber-400 focus:bg-white"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Phone</label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                placeholder="Recommended for SMS and voice invites"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-amber-400 focus:bg-white"
              />
            </div>

            {(error || success) && (
              <div
                className={`rounded-2xl px-4 py-3 text-sm ${
                  error
                    ? 'border border-rose-200 bg-rose-50 text-rose-700'
                    : 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                }`}
              >
                {error || success}
              </div>
            )}

            <button
              type="submit"
              disabled={savingProfile}
              className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingProfile ? 'Saving...' : 'Save profile'}
            </button>
          </form>
        </div>

        <div className="space-y-6">
          <div className="rounded-[2rem] border border-white/85 bg-white/88 p-6 shadow-sm backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
              Ember Network
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-950">
              Add friends by email
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Once someone is in your network, you can share network Embers with them
              and add them as contributors in one click.
            </p>

            <form onSubmit={handleAddFriend} className="mt-6 flex flex-col gap-3 sm:flex-row">
              <input
                type="email"
                value={friendEmail}
                onChange={(event) => setFriendEmail(event.target.value)}
                placeholder="friend@example.com"
                className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white"
              />
              <button
                type="submit"
                disabled={sendingRequest}
                className="rounded-full bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sendingRequest ? 'Sending...' : 'Add to network'}
              </button>
            </form>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-[2rem] border border-white/85 bg-white/88 p-6 shadow-sm backdrop-blur">
              <h3 className="text-lg font-semibold text-slate-950">Friends</h3>
              <div className="mt-4 space-y-3">
                {friends.length === 0 ? (
                  <p className="text-sm text-slate-500">No accepted friends yet.</p>
                ) : (
                  friends.map((friend) => (
                    <div
                      key={friend.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                    >
                      <div className="font-medium text-slate-900">
                        {friend.user.name || friend.user.email}
                      </div>
                      <div className="text-sm text-slate-500">{friend.user.email}</div>
                      {friend.user.phoneNumber && (
                        <div className="text-xs text-slate-400">{friend.user.phoneNumber}</div>
                      )}
                      <button
                        type="button"
                        onClick={() => handleFriendAction(friend.id, 'remove')}
                        className="mt-3 text-sm font-medium text-rose-600 transition hover:text-rose-700"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-[2rem] border border-white/85 bg-white/88 p-6 shadow-sm backdrop-blur">
                <h3 className="text-lg font-semibold text-slate-950">Incoming requests</h3>
                <div className="mt-4 space-y-3">
                  {incomingRequests.length === 0 ? (
                    <p className="text-sm text-slate-500">No incoming requests.</p>
                  ) : (
                    incomingRequests.map((request) => (
                      <div
                        key={request.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                      >
                        <div className="font-medium text-slate-900">
                          {request.user.name || request.user.email}
                        </div>
                        <div className="text-sm text-slate-500">{request.user.email}</div>
                        <div className="mt-3 flex gap-3">
                          <button
                            type="button"
                            onClick={() => handleFriendAction(request.id, 'accept')}
                            className="text-sm font-medium text-emerald-600 transition hover:text-emerald-700"
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFriendAction(request.id, 'decline')}
                            className="text-sm font-medium text-rose-600 transition hover:text-rose-700"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/85 bg-white/88 p-6 shadow-sm backdrop-blur">
                <h3 className="text-lg font-semibold text-slate-950">Pending requests</h3>
                <div className="mt-4 space-y-3">
                  {outgoingRequests.length === 0 ? (
                    <p className="text-sm text-slate-500">No pending requests.</p>
                  ) : (
                    outgoingRequests.map((request) => (
                      <div
                        key={request.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                      >
                        <div className="font-medium text-slate-900">
                          {request.user.name || request.user.email}
                        </div>
                        <div className="text-sm text-slate-500">{request.user.email}</div>
                        <button
                          type="button"
                          onClick={() => handleFriendAction(request.id, 'cancel')}
                          className="mt-3 text-sm font-medium text-slate-600 transition hover:text-slate-900"
                        >
                          Cancel request
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
