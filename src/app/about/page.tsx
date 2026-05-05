import { Suspense } from 'react';
import Link from 'next/link';
import AppHeader from '@/components/kipember/AppHeader';

function EmberMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" fill="white">
      <circle cx="36" cy="36" r="7.2" fill="#f97316" />
      <rect x="32.4" y="3.18" width="7.2" height="21.6" rx="3.6" ry="3.6" />
      <rect x="32.4" y="47.22" width="7.2" height="21.6" rx="3.6" ry="3.6" />
      <rect x="10.38" y="25.2" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(-22.02 49.98) rotate(-90)" />
      <rect x="54.42" y="25.2" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(22.02 94.02) rotate(-90)" />
      <rect x="47.97" y="9.63" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(29.55 -30.48) rotate(45)" />
      <rect x="16.83" y="40.77" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(42.45 .66) rotate(45)" />
      <rect x="16.83" y="9.63" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(-8.46 20.43) rotate(-45)" />
      <rect x="47.97" y="40.77" width="7.2" height="21.6" rx="3.6" ry="3.6" transform="translate(-21.36 51.57) rotate(-45)" />
    </svg>
  );
}

function Avatar({ initials, orange }: { initials: string; orange?: boolean }) {
  return (
    <div
      className="rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
      style={{
        width: 34,
        height: 34,
        background: orange ? 'rgba(249,115,22,0.85)' : 'rgba(100,116,139,0.55)',
      }}
    >
      {initials}
    </div>
  );
}

function Connector() {
  return (
    <div className="flex justify-center">
      <div style={{ width: 1, height: 20, background: 'var(--border-default)' }} />
    </div>
  );
}

function EmberDiagram() {
  return (
    <div className="flex flex-col w-full gap-0" style={{ border: '1px solid var(--border-subtle)', borderRadius: 16, overflow: 'hidden' }}>

      {/* Step 1 — The moment */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div
          className="rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-subtle)' }}
        >
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium">A moment is captured</p>
          <p className="text-white/40 text-xs leading-snug">One photo or video becomes the anchor</p>
        </div>
        <div
          className="rounded-full px-2 py-0.5 text-xs font-medium flex-shrink-0"
          style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316' }}
        >
          1
        </div>
      </div>

      {/* Step 2 — Voices join */}
      <div
        className="flex flex-col gap-3 px-4 py-3"
        style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ width: 44, height: 44, background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)' }}
          >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium">Everyone adds their voice</p>
            <p className="text-white/40 text-xs leading-snug">Friends and family share what they remember</p>
          </div>
          <div
            className="rounded-full px-2 py-0.5 text-xs font-medium flex-shrink-0"
            style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316' }}
          >
            2
          </div>
        </div>
        {/* Contributor avatars */}
        <div className="flex items-center gap-2 pl-1">
          <Avatar initials="JK" orange />
          <Avatar initials="TS" />
          <Avatar initials="MR" />
          <Avatar initials="AL" />
          <div
            className="rounded-full flex items-center justify-center text-white/40 text-xs font-medium"
            style={{ width: 34, height: 34, background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.12)' }}
          >
            +
          </div>
          <p className="text-white/30 text-xs ml-1">Contributors</p>
        </div>
      </div>

      {/* Step 3 — Living ember */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ background: 'var(--bg-surface)' }}
      >
        <div
          className="rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ width: 44, height: 44, background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)' }}
        >
          <EmberMark size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium">A living ember is born</p>
          <p className="text-white/40 text-xs leading-snug">Grows richer with every new memory added</p>
        </div>
        <div
          className="rounded-full px-2 py-0.5 text-xs font-medium flex-shrink-0"
          style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316' }}
        >
          3
        </div>
      </div>

    </div>
  );
}

export default function AboutPage() {
  return (
    <Suspense>
      <div
        className="flex min-h-[100dvh] w-full flex-col items-center justify-start px-4"
        style={{ background: 'var(--bg-screen)', paddingTop: 56 }}
      >
        <AppHeader />
        <div className="flex w-full max-w-xl flex-col gap-6 pt-6 pb-16 fade-in">
          <div className="flex flex-col gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              What is ember?
            </h1>
            <p className="text-base leading-relaxed text-white/60">
              An ember is a living memory — a photo or video anchored to the real voices of the people who were there, capturing not just the moment but how it felt and what it meant.
            </p>
          </div>

          <EmberDiagram />

          <Link
            href="#"
            className="flex w-full items-center justify-center rounded-full text-sm font-medium text-white btn-primary"
            style={{ background: '#6a7c5c', minHeight: 44 }}
          >
            Demo an ember
          </Link>

          <p className="text-base leading-relaxed text-white/60">
            As friends and family contribute their own stories over time, each ember grows richer, building a shared archive that no single person could create alone.
          </p>

          <div className="flex flex-col gap-3">
            <Link
              href="/signup"
              className="flex w-full items-center justify-center rounded-full text-sm font-medium text-white btn-primary"
              style={{ background: '#f97316', minHeight: 44 }}
            >
              Sign Up
            </Link>
            <p className="text-center text-white/60 text-sm">
              Already have an account?{' '}
              <Link href="/login" className="text-white font-medium hover:opacity-70 transition-opacity">
                Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </Suspense>
  );
}
