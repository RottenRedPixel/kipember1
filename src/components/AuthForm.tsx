'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import EmberBrand from '@/components/EmberBrand';

type AuthMode = 'login' | 'signup';

export default function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || null,
          email,
          phoneNumber: phoneNumber.trim() || null,
          password,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Authentication failed');
      }

      router.push('/feed');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSignup = mode === 'signup';

  return (
    <div className="ember-panel-strong w-full max-w-md rounded-[2rem] p-8">
      <div className="mb-8">
        <EmberBrand subtitle={isSignup ? 'new account' : 'welcome back'} compact />
        <h1 className="ember-heading mt-6 text-4xl text-[var(--ember-text)]">
          {isSignup ? 'Create your account' : 'Log in to your archive'}
        </h1>
        <p className="ember-copy mt-3 text-sm">
          {isSignup
            ? 'Start your Ember network, upload photos, and invite the people who help tell the story.'
            : 'Return to your Embers, your network, and the stories already building around them.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {isSignup && (
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--ember-text)]">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="How should Ember know you?"
              className="ember-input"
            />
          </div>
        )}

        <div>
          <label className="mb-2 block text-sm font-medium text-[var(--ember-text)]">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
            className="ember-input"
          />
        </div>

        {isSignup && (
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--ember-text)]">
              Phone
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              placeholder="Optional, but useful for contributor invites"
              className="ember-input"
            />
          </div>
        )}

        <div>
          <label className="mb-2 block text-sm font-medium text-[var(--ember-text)]">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 8 characters"
            required
            minLength={8}
            className="ember-input"
          />
        </div>

        {error && (
          <div className="ember-status ember-status-error">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="ember-button-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting
            ? isSignup
              ? 'Creating account...'
              : 'Logging in...'
            : isSignup
              ? 'Create account'
              : 'Log in'}
        </button>
      </form>

      <p className="mt-6 text-sm text-[var(--ember-muted)]">
        {isSignup ? 'Already have an account?' : 'Need an account?'}{' '}
        <Link
          href={isSignup ? '/login' : '/signup'}
          className="font-semibold text-[var(--ember-orange-deep)] transition-colors hover:text-[var(--ember-orange)]"
        >
          {isSignup ? 'Log in' : 'Create one'}
        </Link>
      </p>
    </div>
  );
}
