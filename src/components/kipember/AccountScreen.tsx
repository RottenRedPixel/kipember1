'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Camera, ChevronLeft, ChevronRight,
  KeyRound, MessageSquarePlus, Phone,
  Settings, ShieldAlert, User, UserRound, Users,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import AvatarCropModal from '@/components/kipember/AvatarCropModal';

type Section = 'profile' | 'contributors' | 'preferences' | 'password' | 'settings' | null;

type AccountScreenProps = {
  name: string | null;
  email: string;
  phoneNumber: string | null;
  avatarUrl: string | null;
  userInitials: string;
  joinedAt?: Date | null;
  coverPhotoUrl?: string | null;
};

function InputRow({
  placeholder,
  value,
  onChange,
  type = 'text',
  border,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  border?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-12 px-0 text-sm text-white placeholder-white/30 outline-none bg-transparent"
      style={border ? { borderTop: '1px solid var(--border-subtle)' } : undefined}
    />
  );
}

function ToggleRow({
  label,
  enabled,
  onToggle,
  border,
}: {
  label: string;
  enabled: boolean;
  onToggle: () => void;
  border?: boolean;
}) {
  return (
    <label
      className="flex items-center justify-between gap-4 px-4 cursor-pointer"
      style={{ minHeight: 44, borderTop: border ? '1px solid var(--border-subtle)' : undefined }}
    >
      <span className="text-sm text-white">{label}</span>
      <span className="relative flex-shrink-0" style={{ width: 48, height: 28 }}>
        <input type="checkbox" checked={enabled} onChange={onToggle} className="sr-only" />
        <span
          className="absolute inset-0 rounded-full transition-colors duration-200"
          style={{ background: enabled ? '#f97316' : 'rgba(255,255,255,0.15)' }}
        />
        <span
          className="absolute top-0.5 left-0.5 rounded-full bg-white shadow transition-transform duration-200"
          style={{ width: 24, height: 24, transform: enabled ? 'translateX(20px)' : 'translateX(0)' }}
        />
      </span>
    </label>
  );
}

export default function AccountScreen({
  name: initialName,
  email: initialEmail,
  phoneNumber: initialPhone,
  avatarUrl: initialAvatarUrl,
  userInitials,
  joinedAt,
  coverPhotoUrl,
}: AccountScreenProps) {
  const router = useRouter();
  const [section, setSection] = useState<Section>(null);

  // Avatar
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Profile
  function splitName(full: string | null) {
    const trimmed = full?.trim() || '';
    const [first = '', ...rest] = trimmed.split(/\s+/);
    return { firstName: first, lastName: rest.join(' ') };
  }
  const { firstName: initFirst, lastName: initLast } = splitName(initialName);
  const [firstName, setFirstName] = useState(initFirst);
  const [lastName, setLastName] = useState(initLast);
  const [form, setForm] = useState({
    email: initialEmail,
    phoneNumber: initialPhone ?? '',
  });
  const [profileStatus, setProfileStatus] = useState('');

  // Preferences
  const [isDark, setIsDark] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => {
    setIsDark(localStorage.getItem('ember-theme') !== 'light');
  }, []);

  // Contacts
  type Contact = {
    id: string;
    emberId: string;
    name: string | null;
    phoneNumber: string | null;
    email: string | null;
    avatarFilename: string | null;
    emberTitles: string[];
  };
  const [contacts, setContacts] = useState<Contact[]>([]);

  useEffect(() => {
    void fetch('/api/user/contacts')
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d?.contacts)) setContacts(d.contacts); })
      .catch(() => undefined);
  }, []);

  // Delete account
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Update password
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwStatus, setPwStatus] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const pwDirty =
    pwCurrent.length > 0 &&
    pwNew.length >= 8 &&
    pwNew === pwConfirm &&
    pwNew !== pwCurrent;

  async function handlePasswordSave() {
    if (!pwDirty || pwSaving) return;
    setPwSaving(true);
    setPwError('');
    setPwStatus('');
    try {
      const res = await fetch('/api/profile/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew }),
      });
      const payload = await res.json().catch(() => ({} as { error?: string }));
      if (!res.ok) {
        setPwError(payload?.error || 'Failed to update password.');
        return;
      }
      setPwStatus('Password updated.');
      setPwCurrent('');
      setPwNew('');
      setPwConfirm('');
      // Clear the success message after a short dwell so the fields reset cleanly.
      setTimeout(() => setPwStatus(''), 2500);
    } catch {
      setPwError('Network error. Try again.');
    } finally {
      setPwSaving(false);
    }
  }

  // Avatar handlers
  async function handleAvatarUpload(blob: Blob) {
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', blob, 'avatar.jpg');
      const res = await fetch('/api/profile/avatar', { method: 'POST', body: formData });
      const payload = await res.json().catch(() => ({}));
      if (res.ok && typeof payload?.avatarUrl === 'string') {
        setAvatarUrl(payload.avatarUrl);
      }
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleCropConfirm(blob: Blob) {
    setCropSrc(null);
    await handleAvatarUpload(blob);
  }

  async function saveProfile() {
    setProfileStatus('');
    const name = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ') || null;
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, name }),
    });
    const payload = await res.json().catch(() => ({}));
    setProfileStatus(res.ok ? 'Saved.' : payload?.error || 'Failed to save.');
  }

  function toggleTheme() {
    const next = isDark ? 'light' : 'dark';
    localStorage.setItem('ember-theme', next);
    document.documentElement.dataset.theme = next;
    setIsDark(!isDark);
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/signin');
    router.refresh();
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    const res = await fetch('/api/user', { method: 'DELETE' });
    if (res.ok) {
      router.push('/');
      router.refresh();
    } else {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const displayName = [firstName, lastName].filter(Boolean).join(' ') || form.email;

  // Section header config
  const SECTIONS: { key: Exclude<Section, null>; icon: React.ReactNode; label: string }[] = [
    { key: 'profile',      icon: <User size={20} strokeWidth={1.6} />,         label: 'Profile' },
    { key: 'contributors', icon: <Users size={20} strokeWidth={1.6} />,        label: 'Contributors' },
    { key: 'preferences',  icon: <Settings size={20} strokeWidth={1.6} />,     label: 'Preferences' },
    { key: 'password',     icon: <KeyRound size={20} strokeWidth={1.6} />,     label: 'Password' },
    { key: 'settings',     icon: <ShieldAlert size={20} strokeWidth={1.6} />,  label: 'Settings' },
  ];

  const activeSection = SECTIONS.find((s) => s.key === section);

  return (
    <div
      className="fixed inset-0 flex"
      style={coverPhotoUrl ? { backgroundImage: `url(${coverPhotoUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
    >
      <Link href="/home" className="w-[7%] h-full" />
      <div
        className="w-[93%] h-full flex flex-col slide-in-right"
        style={{ background: 'var(--bg-screen)', borderLeft: '1px solid var(--border-subtle)' }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 pt-6 pb-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          {section ? (
            <button
              type="button"
              onClick={() => setSection(null)}
              className="w-11 h-11 flex items-center justify-center flex-shrink-0 rounded-full can-hover"
              style={{ opacity: 0.75, cursor: 'pointer' }}
            >
              <ChevronLeft size={22} color="var(--text-primary)" strokeWidth={1.8} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined' && window.history.length > 1) {
                  router.back();
                } else {
                  router.push('/home');
                }
              }}
              className="w-11 h-11 flex items-center justify-center flex-shrink-0 rounded-full can-hover"
              style={{ opacity: 0.75, cursor: 'pointer' }}
            >
              <ChevronLeft size={22} color="var(--text-primary)" strokeWidth={1.8} />
            </button>
          )}
          <span className="flex-shrink-0" style={{ color: 'var(--text-primary)' }}>
            {activeSection ? activeSection.icon : <User size={22} strokeWidth={1.6} />}
          </span>
          <h2 className="text-white font-medium text-base">
            {activeSection ? activeSection.label : 'Account'}
          </h2>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setCropSrc((prev) => {
              if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
              return URL.createObjectURL(file);
            });
            e.target.value = '';
          }}
        />

        {cropSrc ? (
          <AvatarCropModal
            imageSrc={cropSrc}
            onConfirm={handleCropConfirm}
            onCancel={() => { if (cropSrc.startsWith('blob:')) URL.revokeObjectURL(cropSrc); setCropSrc(null); }}
            onChooseNew={() => { fileInputRef.current?.click(); }}
          />
        ) : null}

        {/* Content */}
        <div className="flex-1 overflow-y-auto no-scrollbar">

          {/* ── Main menu ── */}
          {!section && (
            <div className="flex flex-col items-center px-5 py-6 gap-6">

              {/* Avatar */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      if (avatarUrl) {
                        setCropSrc(avatarUrl);
                      } else {
                        fileInputRef.current?.click();
                      }
                    }}
                    className="relative rounded-full overflow-hidden flex items-center justify-center"
                    style={{ width: 80, height: 80, background: 'rgba(249,115,22,0.85)', cursor: 'pointer' }}
                  >
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white text-2xl font-medium">{userInitials}</span>
                    )}
                    {avatarUploading ? (
                      <div className="absolute inset-0 flex items-center justify-center rounded-full" style={{ background: 'rgba(0,0,0,0.5)' }}>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" style={{ animation: 'kipSpin 0.8s linear infinite' }} />
                      </div>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (avatarUrl) {
                        setCropSrc(avatarUrl);
                      } else {
                        fileInputRef.current?.click();
                      }
                    }}
                    className="absolute bottom-0 right-0 w-7 h-7 rounded-full flex items-center justify-center"
                    style={{ background: 'var(--bg-screen)', border: '2px solid var(--border-subtle)', cursor: 'pointer' }}
                  >
                    <Camera size={13} color="var(--text-primary)" strokeWidth={1.8} />
                  </button>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-white font-semibold text-base">{displayName}</span>
                  {joinedAt ? (
                    <span className="text-white/30 text-xs mt-1">
                      Member since {new Date(joinedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Menu items */}
              <div className="w-full rounded-xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                {SECTIONS.map((s, i) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setSection(s.key)}
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

              {/* Logout */}
              <div className="w-full flex justify-end mb-4">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-1/2 flex items-center justify-center rounded-full text-white text-sm font-medium"
                  style={{ background: 'transparent', border: '1.5px solid var(--border-btn)', minHeight: 36, cursor: 'pointer' }}
                >
                  Log Out
                </button>
              </div>

            </div>
          )}

          {/* ── Profile ── */}
          {section === 'profile' && (
            <div className="px-5 py-6 flex flex-col gap-4">
              <div className="rounded-xl px-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                <InputRow placeholder="First name" value={firstName} onChange={setFirstName} />
                <InputRow placeholder="Last name" value={lastName} onChange={setLastName} border />
                <InputRow placeholder="Email address" value={form.email} type="email" onChange={(v) => setForm((f) => ({ ...f, email: v }))} border />
                <InputRow placeholder="Phone number" value={form.phoneNumber} type="tel" onChange={(v) => setForm((f) => ({ ...f, phoneNumber: v }))} border />
              </div>
              <div className="flex justify-between items-center px-1">
                {profileStatus ? <span className="text-xs text-white/50">{profileStatus}</span> : <span />}
                <button
                  type="button"
                  onClick={saveProfile}
                  className="w-1/2 rounded-full px-5 text-white text-sm font-medium"
                  style={{ background: '#f97316', minHeight: 36, cursor: 'pointer' }}
                >
                  Update
                </button>
              </div>
            </div>
          )}

          {/* ── Contributors ── */}
          {section === 'contributors' && (
            <div className="px-5 py-6 flex flex-col gap-4">
              {contacts.length === 0 ? (
                <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                  <p className="text-white/30 text-sm px-4 py-4">No contributors yet.</p>
                </div>
              ) : contacts.map((c) => {
                const label = c.name || c.phoneNumber || c.email || 'Unknown';
                const ini = label.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
                return (
                  <div
                    key={c.id}
                    className="flex items-center rounded-xl overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.05)' }}
                  >
                    <Link
                      href={`/tend/contributors?id=${c.emberId}&view=${c.id}&from=account`}
                      className="flex items-center gap-3 flex-1 min-w-0 px-4 py-3 can-hover"
                      style={{ minHeight: 44, opacity: 0.9 }}
                    >
                      <div className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center text-white text-sm font-medium" style={{ background: 'rgba(100,116,139,0.6)' }}>
                        {c.avatarFilename ? (
                          <img src={`/api/uploads/${c.avatarFilename}`} alt={label} className="w-full h-full object-cover" />
                        ) : ini}
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-white text-sm font-medium truncate">{label}</span>
                        {c.emberTitles.length === 1 ? (
                          <span className="text-white/25 text-xs truncate">{c.emberTitles[0]}</span>
                        ) : c.emberTitles.length > 1 ? (
                          <span className="text-white/25 text-xs truncate">Contributed to multiple embers</span>
                        ) : null}
                      </div>
                    </Link>
                    <div className="w-8 h-11 flex items-center justify-center flex-shrink-0" style={{ opacity: 0.4 }}>
                      <Phone size={15} color="var(--text-primary)" strokeWidth={1.8} />
                    </div>
                    <div className="w-8 h-11 flex items-center justify-center flex-shrink-0" style={{ opacity: 0.4 }}>
                      <MessageSquarePlus size={15} color="var(--text-primary)" strokeWidth={1.8} />
                    </div>
                    <div className="w-8 h-11 flex items-center justify-center flex-shrink-0 mr-2" style={{ opacity: 0.4 }}>
                      <UserRound size={15} color="var(--text-primary)" strokeWidth={1.8} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Preferences ── */}
          {section === 'preferences' && (
            <div className="px-5 py-6">
              <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                <ToggleRow
                  label={isDark ? 'Dark Mode' : 'Light Mode'}
                  enabled={isDark}
                  onToggle={toggleTheme}
                />
                <ToggleRow
                  label="Notifications"
                  enabled={notificationsEnabled}
                  onToggle={() => setNotificationsEnabled((v) => !v)}
                  border
                />
              </div>
            </div>
          )}

          {/* ── Password ── */}
          {section === 'password' && (
            <div className="px-5 py-6">
              <div className="flex flex-col gap-3">
                <div className="rounded-xl px-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                  <InputRow
                    placeholder="Current password"
                    value={pwCurrent}
                    onChange={(v) => { setPwCurrent(v); setPwError(''); }}
                    type="password"
                  />
                  <InputRow
                    placeholder="New password (8+ characters)"
                    value={pwNew}
                    onChange={(v) => { setPwNew(v); setPwError(''); }}
                    type="password"
                    border
                  />
                  <InputRow
                    placeholder="Confirm new password"
                    value={pwConfirm}
                    onChange={(v) => { setPwConfirm(v); setPwError(''); }}
                    type="password"
                    border
                  />
                </div>

                {pwConfirm.length > 0 && pwNew !== pwConfirm && (
                  <p className="text-xs px-1" style={{ color: '#f87171' }}>Passwords don&apos;t match.</p>
                )}
                {pwError && (
                  <p className="text-xs px-1" style={{ color: '#f87171' }}>{pwError}</p>
                )}
                {pwStatus && (
                  <p className="text-xs px-1" style={{ color: '#4ade80' }}>{pwStatus}</p>
                )}

                <div className="flex">
                  <button
                    type="button"
                    onClick={() => void handlePasswordSave()}
                    disabled={!pwDirty || pwSaving}
                    className="flex-1 ml-auto rounded-full px-5 text-white text-sm font-medium disabled:opacity-60"
                    style={{
                      background: pwDirty ? '#f97316' : 'var(--bg-surface)',
                      border: pwDirty ? 'none' : '1px solid var(--border-subtle)',
                      minHeight: 44,
                      cursor: pwDirty ? 'pointer' : 'default',
                      maxWidth: '50%',
                    }}
                  >
                    {pwSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Settings ── */}
          {section === 'settings' && (
            <div className="px-5 py-6">
              <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                {confirmDelete ? (
                  <div className="px-4 py-4 flex flex-col gap-3">
                    <p className="text-sm text-white/70">This will permanently delete your account and all your embers. This cannot be undone.</p>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        className="flex-1 rounded-full text-white text-sm font-medium"
                        style={{ border: '1.5px solid var(--border-btn)', minHeight: 44, cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteAccount()}
                        disabled={deleting}
                        className="flex-1 rounded-full text-white text-sm font-medium disabled:opacity-50"
                        style={{ background: '#ef4444', minHeight: 44, cursor: 'pointer' }}
                      >
                        {deleting ? 'Deleting...' : 'Delete Now!'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="w-full flex items-center gap-4 px-4 py-4"
                    style={{ minHeight: 44, cursor: 'pointer' }}
                  >
                    <span className="text-sm font-medium" style={{ color: '#f87171' }}>Delete Account</span>
                  </button>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
