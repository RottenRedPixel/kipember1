import Link from 'next/link';
import AppHeader from '@/components/kipember/AppHeader';
import PageShell from '@/components/PageShell';

export default function LinkExpiredPage() {
  return (
    <PageShell
      header={<AppHeader />}
      width="sm"
      contentClassName="items-center gap-6 pt-16 pb-16 fade-in text-center"
    >
      <div
        className="flex items-center justify-center rounded-full"
        style={{ width: 64, height: 64, background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.25)' }}
      >
        <span style={{ fontSize: 28 }}>🔗</span>
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-white text-2xl font-bold tracking-tight">This link has expired</h1>
        <p className="text-white/50 text-sm leading-relaxed">
          Sign-in links are single-use and expire after a short time. Request a new one to continue.
        </p>
      </div>

      <Link
        href="/login"
        className="flex items-center justify-center rounded-full text-white text-sm font-medium w-full"
        style={{ background: 'var(--color-accent)', minHeight: 44 }}
      >
        Back to Login
      </Link>
    </PageShell>
  );
}
