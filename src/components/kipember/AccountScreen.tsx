'use client';

import { useRouter } from 'next/navigation';
import { Camera, ChevronLeft, LogOut, Moon, Sun } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import AppHeader from '@/components/kipember/AppHeader';
import AvatarCropModal from '@/components/kipember/AvatarCropModal';

type AccountScreenProps = {
  name: string | null;
  email: string;
  phoneNumber: string | null;
  avatarUrl: string | null;
  userInitials: string;
  joinedAt?: Date | null;
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-white/30 text-xs font-medium mb-3 px-1">{children}</p>
  );
}

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

export default function AccountScreen({
  name: initialName,
  email: initialEmail,
  phoneNumber: initialPhone,
  avatarUrl: initialAvatarUrl,
  userInitials,
  joinedAt,
}: AccountScreenProps) {
  const router = useRouter();

  // Avatar
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Profile
  const [form, setForm] = useState({
    name: initialName ?? '',
    email: initialEmail,
    phoneNumber: initialPhone ?? '',
  });
  const [profileStatus, setProfileStatus] = useState('');

  // Theme
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    setIsDark(localStorage.getItem('ember-theme') !== 'light');
  }, []);

  // ── Avatar ──────────────────────────────────────────────────────────────
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

  // ── Profile ─────────────────────────────────────────────────────────────
  async function saveProfile() {
    setProfileStatus('');
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const payload = await res.json().catch(() => ({}));
    setProfileStatus(res.ok ? 'Saved.' : payload?.error || 'Failed to save.');
  }

  // ── Theme ────────────────────────────────────────────────────────────────
  function toggleTheme() {
    const next = isDark ? 'light' : 'dark';
    localStorage.setItem('ember-theme', next);
    document.documentElement.dataset.theme = next;
    setIsDark(!isDark);
  }

  // ── Logout ───────────────────────────────────────────────────────────────
  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/signin');
    router.refresh();
  }

  const displayName = form.name || form.email;

  return (
    <div className="fixed inset-0 slide-in-right" style={{ background: 'var(--bg-screen)' }}>
      <AppHeader avatarUrl={avatarUrl} userInitials={userInitials} userModalHref="/account" />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setCropSrc(URL.createObjectURL(file));
          e.target.value = '';
        }}
      />

      {cropSrc ? (
        <AvatarCropModal
          imageSrc={cropSrc}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropSrc(null)}
        />
      ) : null}

      <div className="absolute left-0 right-0 bottom-0 overflow-y-auto no-scrollbar px-4" style={{ top: 56 }}>

        {/* Back */}
        <div className="pt-4 pb-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-11 h-11 flex items-center justify-center rounded-full can-hover-dim"
            style={{ background: 'var(--bg-surface)', cursor: 'pointer' }}
          >
            <ChevronLeft size={22} color="var(--text-primary)" strokeWidth={1.8} />
          </button>
        </div>

        {/* Avatar */}
        <div className="flex flex-col items-center gap-3 py-6">
          <div className="relative">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
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
              onClick={() => fileInputRef.current?.click()}
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

        {/* Profile */}
        <div className="mb-3">
          <SectionLabel>Profile</SectionLabel>
          <div className="rounded-xl px-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
            <InputRow placeholder="Your name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
            <InputRow placeholder="Email address" value={form.email} type="email" onChange={(v) => setForm((f) => ({ ...f, email: v }))} border />
            <InputRow placeholder="Phone number" value={form.phoneNumber} type="tel" onChange={(v) => setForm((f) => ({ ...f, phoneNumber: v }))} border />
          </div>
          <div className="flex justify-between items-center mt-2 px-1">
            {profileStatus ? <span className="text-xs text-white/50">{profileStatus}</span> : <span />}
            <button
              type="button"
              onClick={saveProfile}
              className="rounded-full px-5 text-white text-sm font-medium"
              style={{ background: '#f97316', minHeight: 36, cursor: 'pointer' }}
            >
              Update Profile
            </button>
          </div>
        </div>

        {/* Theme toggle */}
        <div className="mb-3">
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
            <button
              type="button"
              onClick={toggleTheme}
              className="w-full flex items-center gap-4 px-4 py-4 can-hover-dim"
              style={{ cursor: 'pointer' }}
            >
              {isDark ? <Sun size={18} color="var(--text-primary)" strokeWidth={1.6} /> : <Moon size={18} color="var(--text-primary)" strokeWidth={1.6} />}
              <span className="text-sm font-medium text-white">{isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}</span>
            </button>
          </div>
        </div>

        {/* Logout */}
        <div className="mb-8">
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-4 px-4 py-4 can-hover-dim"
              style={{ cursor: 'pointer' }}
            >
              <LogOut size={18} color="#f87171" strokeWidth={1.6} />
              <span className="text-sm font-medium" style={{ color: '#f87171' }}>Log Out</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
