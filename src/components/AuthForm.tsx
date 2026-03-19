'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import EmberBrand from '@/components/EmberBrand';

type AuthMode = 'login' | 'signup';

export default function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const isSignup = mode === 'signup';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [phoneSignInNumber, setPhoneSignInNumber] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneCodeRequested, setPhoneCodeRequested] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingMagicLink, setIsSendingMagicLink] = useState(false);
  const [isRequestingPhoneCode, setIsRequestingPhoneCode] = useState(false);
  const [isVerifyingPhoneCode, setIsVerifyingPhoneCode] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const clearFeedback = () => {
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    clearFeedback();

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

  const handleSendMagicLink = async () => {
    setIsSendingMagicLink(true);
    clearFeedback();

    try {
      const response = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          email,
          name: name.trim() || null,
          phoneNumber: phoneNumber.trim() || null,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to send magic link');
      }

      setSuccess(payload.message || 'Check your email for your Ember link.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send magic link');
    } finally {
      setIsSendingMagicLink(false);
    }
  };

  const handleRequestPhoneCode = async () => {
    setIsRequestingPhoneCode(true);
    clearFeedback();

    try {
      const response = await fetch('/api/auth/phone/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: phoneSignInNumber,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to send sign-in code');
      }

      setPhoneCodeRequested(true);
      setSuccess(payload.message || 'Check your phone for your sign-in code.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send sign-in code');
    } finally {
      setIsRequestingPhoneCode(false);
    }
  };

  const handleVerifyPhoneCode = async () => {
    setIsVerifyingPhoneCode(true);
    clearFeedback();

    try {
      const response = await fetch('/api/auth/phone/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: phoneSignInNumber,
          code: phoneCode,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to verify sign-in code');
      }

      router.push('/feed');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify sign-in code');
    } finally {
      setIsVerifyingPhoneCode(false);
    }
  };

  return (
    <div className="ember-panel-strong w-full max-w-md rounded-[2rem] p-8">
      <div className="mb-8">
        <EmberBrand subtitle={isSignup ? 'new account' : 'welcome back'} compact />
        <h1 className="ember-heading mt-6 text-4xl text-[var(--ember-text)]">
          {isSignup ? 'Create your account' : 'Log in to your archive'}
        </h1>
        <p className="ember-copy mt-3 text-sm">
          {isSignup
            ? 'Create an Ember account with a password or let Ember email you a secure signup link.'
            : 'Sign in with your password, a magic link, or a phone code so you can get back to your memories quickly.'}
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
              placeholder="Optional, but useful for SMS and memory recovery"
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

        {!isSignup && (
          <div className="text-right">
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-[var(--ember-orange-deep)] transition-colors hover:text-[var(--ember-orange)]"
            >
              Forgot password?
            </Link>
          </div>
        )}

        {(error || success) && (
          <div
            className={`ember-status ${error ? 'ember-status-error' : 'ember-status-success'}`}
          >
            {error || success}
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
              : 'Log in with password'}
        </button>

        <button
          type="button"
          onClick={() => void handleSendMagicLink()}
          disabled={isSendingMagicLink}
          className="ember-button-secondary w-full disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSendingMagicLink
            ? isSignup
              ? 'Sending sign-up link...'
              : 'Sending magic link...'
            : isSignup
              ? 'Send sign-up link'
              : 'Email me a magic link'}
        </button>
      </form>

      {!isSignup && (
        <div className="mt-8 rounded-[1.6rem] border border-[rgba(20,20,20,0.08)] bg-white px-5 py-5">
          <p className="ember-eyebrow">Phone sign-in</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-[var(--ember-text)]">
            Get a sign-in code by text
          </h2>
          <p className="mt-2 text-sm leading-7 text-[var(--ember-muted)]">
            This is especially useful if you created a test Ember and want to come back to it from your phone.
          </p>

          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--ember-text)]">
                Phone
              </label>
              <input
                type="tel"
                value={phoneSignInNumber}
                onChange={(event) => setPhoneSignInNumber(event.target.value)}
                placeholder="(555) 555-5555"
                className="ember-input"
              />
            </div>

            {phoneCodeRequested && (
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--ember-text)]">
                  Sign-in code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={phoneCode}
                  onChange={(event) => setPhoneCode(event.target.value)}
                  placeholder="6-digit code"
                  className="ember-input"
                />
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => void handleRequestPhoneCode()}
                disabled={isRequestingPhoneCode}
                className="ember-button-secondary w-full disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRequestingPhoneCode ? 'Sending code...' : 'Text me a sign-in code'}
              </button>

              {phoneCodeRequested && (
                <button
                  type="button"
                  onClick={() => void handleVerifyPhoneCode()}
                  disabled={isVerifyingPhoneCode}
                  className="ember-button-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isVerifyingPhoneCode ? 'Verifying code...' : 'Sign in with code'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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
