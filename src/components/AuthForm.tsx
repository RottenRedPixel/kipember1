'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppHeader from '@/components/kipember/AppHeader';
import { useState } from 'react';

type AuthMode = 'login' | 'signup';

export default function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const isSignup = mode === 'signup';
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: isSignup ? form.name : undefined,
          email: form.email,
          password: form.password,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof payload?.error === 'string' ? payload.error : 'Authentication failed'
        );
      }

      router.push(isSignup ? '/home?mode=first-ember' : '/home');
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Authentication failed'
      );
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
      <div className="flex flex-col gap-8 w-full max-w-sm pt-6 pb-16">
        <div className="flex flex-col gap-1">
          <h1 className="text-white text-2xl font-bold tracking-tight">
            {isSignup ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="text-white/60 text-sm">
            {isSignup
              ? 'Start preserving your memories with Ember.'
              : 'Sign in to continue to Ember.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {isSignup ? (
            <Field
              label="Name"
              name="name"
              type="text"
              placeholder="Your name"
              value={form.name}
              onChange={handleChange}
            />
          ) : null}
          <Field
            label="Email"
            name="email"
            type="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={handleChange}
          />
          <Field
            label="Password"
            name="password"
            type="password"
            placeholder={isSignup ? 'Create a password' : 'Your password'}
            value={form.password}
            onChange={handleChange}
          />

          {!isSignup ? (
            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                className="text-white/30 text-xs hover:text-white/60 transition-colors"
              >
                Forgot password?
              </Link>
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className={`${
              isSignup ? 'mt-2' : ''
            } flex items-center justify-center rounded-full text-white text-sm font-medium transition-opacity hover:opacity-80 w-full btn-primary disabled:cursor-not-allowed disabled:opacity-60`}
            style={{ background: '#f97316', minHeight: 44 }}
          >
            {isSubmitting
              ? isSignup
                ? 'Signing Up...'
                : 'Signing In...'
              : isSignup
                ? 'Sign Up'
                : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-white/60 text-sm">
          {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
          <Link
            href={isSignup ? '/signin' : '/signup'}
            className="text-white font-medium hover:opacity-70 transition-opacity"
          >
            {isSignup ? 'Sign In' : 'Sign Up'}
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  name: string;
  type: string;
  placeholder: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-white/60 text-xs font-medium">{label}</label>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete="off"
        className="h-12 rounded-xl px-4 text-sm text-white placeholder-white/30 outline-none transition-colors"
        style={{
          background: 'var(--bg-input)',
          border: '1px solid var(--border-input)',
        }}
        onFocus={(event) => (event.currentTarget.style.borderColor = 'rgba(249,115,22,0.6)')}
        onBlur={(event) => (event.currentTarget.style.borderColor = 'var(--border-input)')}
      />
    </div>
  );
}
