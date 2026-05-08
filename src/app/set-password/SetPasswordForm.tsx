'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppHeader from '@/components/kipember/AppHeader';
import { useState } from 'react';

export default function SetPasswordForm({
  firstName,
  lastName,
  phoneNumber,
}: {
  firstName: string;
  lastName: string;
  phoneNumber: string;
}) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/profile/set-first-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'Failed to create account');
      }

      router.push('/home');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="flex flex-col items-center justify-start w-full px-6"
      style={{ minHeight: '100dvh', background: 'var(--bg-screen)', paddingTop: 56 }}
    >
      <AppHeader />
      <div className="flex flex-col gap-8 w-full max-w-sm pt-6 pb-16 fade-in">
        <div className="flex flex-col gap-1">
          <h1 className="text-white text-2xl font-bold tracking-tight">Create your account</h1>
          <p className="text-white/60 text-sm">Set a password to sign in anytime.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex gap-3">
            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              <label className="text-white/60 text-xs font-medium">First Name</label>
              <div
                className="w-full h-12 rounded-xl px-4 flex items-center text-sm text-white/50"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)' }}
              >
                {firstName || 'First'}
              </div>
            </div>
            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              <label className="text-white/60 text-xs font-medium">Last Name</label>
              <div
                className="w-full h-12 rounded-xl px-4 flex items-center text-sm text-white/50"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)' }}
              >
                {lastName || 'Last'}
              </div>
            </div>
          </div>

          {phoneNumber ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-white/60 text-xs font-medium">Phone Number</label>
              <div
                className="w-full h-12 rounded-xl px-4 flex items-center text-sm text-white/50"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)' }}
              >
                {phoneNumber}
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <label className="text-white/60 text-xs font-medium">Password</label>
            <input
              type="password"
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full h-12 rounded-xl px-4 text-sm text-white placeholder-white/30 outline-none transition-colors"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)' }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(249,115,22,0.6)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-input)')}
            />
          </div>

          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 flex items-center justify-center rounded-full text-white text-sm font-medium transition-opacity hover:opacity-80 w-full btn-primary disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: '#f97316', minHeight: 44 }}
          >
            {isSubmitting ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-white/60 text-sm">
          Want to sign in instead?{' '}
          <Link href="/signin" className="text-white font-medium hover:opacity-70 transition-opacity">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
