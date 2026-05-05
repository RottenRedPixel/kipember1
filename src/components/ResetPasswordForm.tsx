'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AppHeader from '@/components/kipember/AppHeader';
import { useState } from 'react';

export default function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    if (!token) {
      setError('This password reset link is missing its token.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to reset password');
      }

      router.push('/home');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
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
          <h1 className="text-white text-2xl font-bold tracking-tight">Choose a new password</h1>
          <p className="text-white/60 text-sm">Set a new password and Ember will sign you in.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field
            label="New password"
            type="password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Field
            label="Confirm password"
            type="password"
            placeholder="Repeat your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 flex items-center justify-center rounded-full text-white text-sm font-medium transition-opacity hover:opacity-80 w-full btn-primary disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: '#f97316', minHeight: 44 }}
          >
            {isSubmitting ? 'Resetting...' : 'Reset password'}
          </button>
        </form>

        <p className="text-center text-white/60 text-sm">
          Remembered it?{' '}
          <Link href="/login" className="text-white font-medium hover:opacity-70 transition-opacity">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  type,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  type: string;
  placeholder: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-white/60 text-xs font-medium">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete="off"
        className="h-12 rounded-xl px-4 text-sm text-white placeholder-white/30 outline-none transition-colors"
        style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)' }}
        onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(249,115,22,0.6)')}
        onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-input)')}
      />
    </div>
  );
}
