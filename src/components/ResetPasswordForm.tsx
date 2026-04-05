'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import EmberBrand from '@/components/EmberBrand';

export default function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
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
        body: JSON.stringify({
          token,
          password,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to reset password');
      }

      router.push('/feed');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="ember-auth-card p-8">
      <EmberBrand subtitle="password reset" compact />
      <h1 className="ember-heading mt-6 text-4xl text-[var(--ember-text)]">
        Choose a new password
      </h1>
      <p className="ember-copy mt-3 text-sm">
        Set a new password, then Ember will sign you in immediately.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-[var(--ember-text)]">
            New password
          </label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
            className="ember-input"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-[var(--ember-text)]">
            Confirm password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            minLength={8}
            required
            className="ember-input"
          />
        </div>

        {error && <div className="ember-status ember-status-error">{error}</div>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="ember-button-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Resetting password...' : 'Reset password'}
        </button>
      </form>
    </div>
  );
}
