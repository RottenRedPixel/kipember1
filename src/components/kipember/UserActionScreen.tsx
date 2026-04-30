'use client';

import Link from 'next/link';
import { Camera, ChevronDown, ChevronLeft, FileStack, Plus, User, Users } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { USER_ACTIONS, USER_ICONS } from '@/app/user/constants';
import type { EmberMediaType } from '@/lib/media';
import { getPreviewMediaUrl } from '@/lib/media';
import type { FriendNetworkPayload } from '@/lib/friend-network';
import type { AccessibleImageSummary } from '@/lib/image-summaries';
import AvatarCropModal from '@/components/kipember/AvatarCropModal';
import { getUserDisplayName } from '@/lib/user-name';

type ImageSummary = AccessibleImageSummary & {
  mediaType: EmberMediaType;
  createdAt: string | Date;
};

type Profile = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phoneNumber: string | null;
  avatarUrl?: string | null;
};

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

const SORT_OPTIONS = ['Newest', 'Oldest', 'A-Z', 'Z-A'];

function sortEmbers(embers: ImageSummary[], sort: string) {
  return [...embers].sort((left, right) => {
    if (sort === 'A-Z') {
      return (left.title || left.originalName).localeCompare(right.title || right.originalName);
    }
    if (sort === 'Z-A') {
      return (right.title || right.originalName).localeCompare(left.title || left.originalName);
    }
    if (sort === 'Oldest') {
      return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
    }
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}

export default function UserActionScreen({
  action,
  basePath,
  rootView = false,
  initialImages = [],
  initialProfile = null,
  initialFriends = null,
}: {
  action: string;
  basePath?: string;
  rootView?: boolean;
  initialImages?: ImageSummary[];
  initialProfile?: Profile | null;
  initialFriends?: FriendNetworkPayload | null;
}) {
  const searchParams = useSearchParams();
  const title = USER_ACTIONS[action];
  const [images, setImages] = useState<ImageSummary[]>(initialImages);
  const [friends, setFriends] = useState<FriendNetworkPayload | null>(initialFriends);
  const [form, setForm] = useState({
    firstName: initialProfile?.firstName || '',
    lastName: initialProfile?.lastName || '',
    email: initialProfile?.email || '',
    phoneNumber: initialProfile?.phoneNumber || '',
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialProfile?.avatarUrl ?? null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [friendEmail, setFriendEmail] = useState('');
  const [status, setStatus] = useState('');
  const isEmberList = action === 'my-embers' || action === 'shared-embers';
  const pagePath = basePath || `/user/${action}`;

  useEffect(() => {
    if (isEmberList) {
      if (initialImages.length > 0) {
        return;
      }

      void fetch('/api/images')
        .then(async (response) => {
          if (!response.ok) {
            return;
          }
          setImages((await response.json()) as ImageSummary[]);
        })
        .catch(() => undefined);

      return;
    }

    if (!initialProfile) {
      void fetch('/api/profile')
        .then(async (response) => {
          if (!response.ok) {
            return;
          }
          const payload = (await response.json()) as { user: Profile };
          setForm({
            firstName: payload.user.firstName || '',
            lastName: payload.user.lastName || '',
            email: payload.user.email,
            phoneNumber: payload.user.phoneNumber || '',
          });
          setAvatarUrl(payload.user.avatarUrl ?? null);
        })
        .catch(() => undefined);
    }

    if (!initialFriends) {
      void fetch('/api/friends')
        .then(async (response) => {
          if (!response.ok) {
            return;
          }
          setFriends((await response.json()) as FriendNetworkPayload);
        })
        .catch(() => undefined);
    }
  }, [initialFriends, initialImages.length, initialProfile, isEmberList]);

  if (!title) {
    return null;
  }

  const UserIcon = USER_ICONS[action];
  const sort = searchParams.get('sort') ?? 'Newest';
  const showSort = searchParams.get('sort-open') === '1';
  const emberSet =
    action === 'shared-embers'
      ? images.filter((image) => image.accessType !== 'owner')
      : images.filter((image) => image.accessType === 'owner');
  const sorted = sortEmbers(emberSet, sort);
  const buildHref = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    });
    const query = next.toString();
    return query ? `${pagePath}?${query}` : pagePath;
  };

  async function saveProfile() {
    setStatus('');
    const response = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const payload = await response.json().catch(() => ({}));
    setStatus(response.ok ? 'Profile saved.' : payload?.error || 'Failed to save profile.');
  }

  async function addFriend() {
    setStatus('');
    const response = await fetch('/api/friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: friendEmail }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(payload?.error || 'Failed to add friend.');
      return;
    }
    setStatus('Friend request sent.');
    setFriendEmail('');
    const refreshed = await fetch('/api/friends');
    if (refreshed.ok) {
      setFriends((await refreshed.json()) as FriendNetworkPayload);
    }
  }

  async function handleAvatarUpload(blob: Blob) {
    setAvatarUploading(true);
    setCropSrc(null);
    const formData = new FormData();
    formData.append('file', blob, 'avatar.jpg');
    try {
      const response = await fetch('/api/profile/avatar', { method: 'POST', body: formData });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && typeof payload.avatarUrl === 'string') {
        setAvatarUrl(payload.avatarUrl + '?t=' + Date.now());
      } else {
        setStatus(payload?.error || 'Failed to upload avatar.');
      }
    } catch {
      setStatus('Failed to upload avatar.');
    } finally {
      setAvatarUploading(false);
    }
  }

  return (
    <div className="absolute inset-0 flex justify-center">
      <div className={`relative w-full max-w-xl h-full flex ${rootView ? 'flex-col' : ''}`}>
      {!rootView ? <Link href="/home" className="w-[7%] h-full" /> : null}
      <div
        className={`${rootView ? 'w-full' : 'w-[93%]'} h-full flex flex-col ${rootView ? '' : 'slide-in-right'}`}
        style={{
          background: 'var(--bg-screen)',
          borderLeft: rootView ? 'none' : '1px solid var(--border-subtle)',
        }}
      >
        <div
          className="flex items-center gap-3 px-4 pt-6 pb-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          {rootView ? (
            <div className="w-11 h-11 flex items-center justify-center flex-shrink-0 rounded-full" style={{ background: 'var(--bg-surface)' }}>
              {UserIcon ? <UserIcon size={24} color="var(--text-primary)" strokeWidth={1.6} /> : null}
            </div>
          ) : (
            <Link
              href="/home"
              className="w-11 h-11 flex items-center justify-center flex-shrink-0 rounded-full can-hover"
              style={{ opacity: 0.75 }}
            >
              <ChevronLeft size={22} color="var(--text-primary)" strokeWidth={1.8} />
            </Link>
          )}
          {!rootView && UserIcon ? (
            <UserIcon size={24} color="var(--text-primary)" strokeWidth={1.6} className="flex-shrink-0" />
          ) : null}
          <h2 className="text-white font-medium text-base">{title}</h2>
          {rootView ? (
            <div className="ml-auto flex items-center gap-2">
              <Link
                href="/embers?view=shared"
                className="w-11 h-11 flex items-center justify-center rounded-full can-hover"
                style={{ background: 'var(--bg-surface)' }}
              >
                <Users size={20} color="var(--text-primary)" strokeWidth={1.8} />
              </Link>
              <Link
                href="/home?mode=first-ember"
                className="w-11 h-11 flex items-center justify-center rounded-full can-hover"
                style={{ background: '#f97316' }}
              >
                <Plus size={20} color="white" strokeWidth={2} />
              </Link>
              <Link
                href="/user/profile"
                className="w-11 h-11 flex items-center justify-center rounded-full can-hover"
                style={{ background: 'var(--bg-surface)' }}
              >
                <User size={20} color="var(--text-primary)" strokeWidth={1.8} />
              </Link>
            </div>
          ) : null}
        </div>

        <div className="flex-1 px-4 min-h-0 flex flex-col">
          {isEmberList ? (
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-end py-3 flex-shrink-0">
                <div className="relative">
                  <Link
                    href={buildHref({ sort, 'sort-open': showSort ? '0' : '1' })}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl can-hover"
                    style={{ background: 'var(--bg-surface)', opacity: 0.9 }}
                  >
                    <span className="text-white text-xs font-medium">{sort}</span>
                    <ChevronDown size={13} color="var(--text-secondary)" strokeWidth={2} />
                  </Link>
                  {showSort ? (
                    <div
                      className="absolute top-full right-0 mt-1 rounded-xl overflow-hidden z-10 flex flex-col"
                      style={{ background: 'var(--bg-screen)', border: '1px solid var(--border-default)', minWidth: 110 }}
                    >
                      {SORT_OPTIONS.map((option) => (
                        <Link
                          key={option}
                          href={buildHref({ sort: option, 'sort-open': '0' })}
                          className="px-4 py-2.5 text-xs font-medium can-hover"
                          style={{ color: option === sort ? '#f97316' : 'var(--text-primary)', opacity: 0.9 }}
                        >
                          {option}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pb-6 no-scrollbar">
                <div className="grid grid-cols-3 gap-1.5">
                  {sorted.map((image) => (
                    <Link
                      key={image.id}
                      href={`/ember/${image.id}`}
                      className="aspect-square rounded-xl overflow-hidden can-hover relative"
                      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', opacity: 0.95 }}
                    >
                      <img
                        src={getPreviewMediaUrl({
                          mediaType: image.mediaType,
                          filename: image.filename,
                          posterFilename: image.posterFilename,
                        })}
                        alt={image.title || image.originalName}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      {image.photoCount > 1 ? (
                        <div className="absolute top-1.5 right-1.5 z-10">
                          <FileStack size={16} className="text-white drop-shadow-md" />
                        </div>
                      ) : null}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto no-scrollbar py-5 flex flex-col gap-4">
              <div className="flex flex-col items-center gap-3 py-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.currentTarget.value = '';
                    if (!file) return;
                    const url = URL.createObjectURL(file);
                    setCropSrc(url);
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (avatarUrl) {
                      setCropSrc(avatarUrl);
                    } else {
                      fileInputRef.current?.click();
                    }
                  }}
                  className="relative cursor-pointer"
                  style={{ width: 80, height: 80 }}
                >
                  <div
                    className="w-full h-full rounded-full flex items-center justify-center overflow-hidden"
                    style={{ background: 'rgba(249,115,22,0.85)' }}
                  >
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white text-xl font-medium">
                        {initials(getUserDisplayName(form) || form.email || 'U')}
                      </span>
                    )}
                  </div>
                  <div
                    className="absolute bottom-0 right-0 w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ background: '#f97316', border: '2px solid var(--bg-screen)' }}
                  >
                    <Camera size={12} color="white" strokeWidth={2} />
                  </div>
                </button>
                {avatarUploading ? (
                  <span className="text-xs text-white/50">Uploading...</span>
                ) : (
                  <span className="text-xs text-white/40">Tap to change photo</span>
                )}
              </div>
              <div className="rounded-xl px-4 py-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                <p className="text-white/30 text-xs font-medium mb-3">Profile</p>
                <div className="flex flex-col">
                  {[
                    { key: 'firstName', placeholder: 'First name' },
                    { key: 'lastName', placeholder: 'Last name' },
                    { key: 'email', placeholder: 'Email address' },
                    { key: 'phoneNumber', placeholder: 'Phone number' },
                  ].map((field, index) => (
                    <input
                      key={field.key}
                      value={form[field.key as keyof typeof form]}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, [field.key]: event.target.value }))
                      }
                      placeholder={field.placeholder}
                      className="w-full h-12 px-0 text-sm text-white placeholder-white/30 outline-none bg-transparent"
                      style={{ borderTop: index > 0 ? '1px solid var(--border-subtle)' : 'none' }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={saveProfile}
                  className="w-1/2 rounded-full px-5 text-white text-sm font-medium btn-primary"
                  style={{ background: '#f97316', minHeight: 44 }}
                >
                  Save Profile
                </button>
              </div>

              <div className="rounded-xl px-4 py-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                <p className="text-white/30 text-xs font-medium mb-3">Add to Your Network</p>
                <input
                  value={friendEmail}
                  onChange={(event) => setFriendEmail(event.target.value)}
                  placeholder="Friend email"
                  className="w-full h-12 px-0 text-sm text-white placeholder-white/30 outline-none bg-transparent"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={addFriend}
                  className="w-1/2 rounded-full px-5 text-white text-sm font-medium btn-secondary"
                  style={{ border: '1.5px solid var(--border-btn)', minHeight: 44 }}
                >
                  Add Friend
                </button>
              </div>

              {status ? <p className="text-sm text-white/60">{status}</p> : null}

              <div className="rounded-xl px-4 py-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                <p className="text-white/30 text-xs font-medium mb-3">Friends</p>
                <div className="flex flex-col gap-2">
                  {(friends?.friends || []).map((friend) => (
                    <div key={friend.id} className="text-sm text-white/90">
                      {getUserDisplayName(friend.user) || friend.user.email}
                    </div>
                  ))}
                  {friends && friends.friends.length === 0 ? (
                    <p className="text-sm text-white/30">No friends yet.</p>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {cropSrc ? (
        <AvatarCropModal
          imageSrc={cropSrc}
          onConfirm={(blob) => { void handleAvatarUpload(blob); }}
          onCancel={() => { if (cropSrc.startsWith('blob:')) URL.revokeObjectURL(cropSrc); setCropSrc(null); }}
          onChooseNew={() => { if (cropSrc.startsWith('blob:')) URL.revokeObjectURL(cropSrc); setCropSrc(null); fileInputRef.current?.click(); }}
        />
      ) : null}
      </div>
    </div>
  );
}
