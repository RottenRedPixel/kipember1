'use client';

import Link from 'next/link';
import { useState } from 'react';
import AppHeader from '@/components/kipember/AppHeader';

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/auth/password/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to send reset link');
      }

      setSuccess(payload.message || 'If that email is in Ember, a reset link has been sent.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset link');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="flex flex-col items-center justify-start w-full px-6"
      style={{ minHeight: '100dvh', background: 'var(--bg-screen)', paddingTop: 56 }}
    >
      <AppHeader />
      <div className="flex flex-col gap-8 w-full max-w-sm pt-6 pb-16 fade-in">
        {success ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-white text-2xl font-bold tracking-tight">Check your email</h1>
              <p className="text-white/60 text-sm">{success}</p>
            </div>
            <Link
              href="/login"
              className="flex items-center justify-center rounded-full text-white text-sm font-medium"
              style={{ background: '#f97316', minHeight: 44 }}
            >
              Back to Login
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <h1 className="text-white text-2xl font-bold tracking-tight">Reset your password</h1>
              <p className="text-white/60 text-sm">
                Enter your email and we'll send you a secure reset link.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-white/60 text-xs font-medium">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                  className="h-12 rounded-xl px-4 text-sm text-white placeholder-white/30 outline-none transition-colors"
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)' }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(249,115,22,0.6)')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-input)')}
                />
              </div>

              {error ? <p className="text-sm text-red-300">{error}</p> : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center justify-center rounded-full text-white text-sm font-medium transition-opacity hover:opacity-80 w-full disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: '#f97316', minHeight: 44 }}
              >
                {isSubmitting ? 'Sending reset link...' : 'Email reset link'}
              </button>
            </form>

            <p className="text-center text-white/60 text-sm">
              Remember your password?{' '}
              <Link href="/login" className="text-white font-medium hover:opacity-70 transition-opacity">
                Login
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
