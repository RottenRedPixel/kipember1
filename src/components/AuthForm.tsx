'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

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
    <div className="w-full max-w-md rounded-[2rem] border border-white/80 bg-white/92 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-700">
          Ember Archive
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-950">
          {isSignup ? 'Create your account' : 'Log in to your archive'}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {isSignup
            ? 'Start your Ember network, upload photos, and invite the people who help tell the story.'
            : 'Return to your Embers, your network, and the stories already building around them.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {isSignup && (
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="How should Ember know you?"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-amber-400 focus:bg-white"
            />
          </div>
        )}

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-amber-400 focus:bg-white"
          />
        </div>

        {isSignup && (
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Phone
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              placeholder="Optional, but useful for contributor invites"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-amber-400 focus:bg-white"
            />
          </div>
        )}

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 8 characters"
            required
            minLength={8}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-amber-400 focus:bg-white"
          />
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
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

      <p className="mt-6 text-sm text-slate-600">
        {isSignup ? 'Already have an account?' : 'Need an account?'}{' '}
        <Link
          href={isSignup ? '/login' : '/signup'}
          className="font-semibold text-amber-700 transition-colors hover:text-amber-800"
        >
          {isSignup ? 'Log in' : 'Create one'}
        </Link>
      </p>
    </div>
  );
}
