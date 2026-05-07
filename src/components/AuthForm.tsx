'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppHeader from '@/components/kipember/AppHeader';
import { useState } from 'react';

type AuthMode = 'login' | 'signup';

export default function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const isSignup = mode === 'signup';
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phoneNumber: '',
    password: '',
  });
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
          firstName: isSignup ? form.firstName.trim() || undefined : undefined,
          lastName: isSignup ? form.lastName.trim() || undefined : undefined,
          phoneNumber: form.phoneNumber.trim() || undefined,
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
      <div className="flex flex-col gap-8 w-full max-w-sm pt-6 pb-16 fade-in">
        <div className="flex flex-col gap-1">
          <h1 className="text-white text-2xl font-bold tracking-tight">
            {isSignup ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="text-white/60 text-sm">
            {isSignup
              ? 'Start preserving your memories with Ember.'
              : 'Log in to continue to Ember.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {isSignup ? (
            <div className="flex gap-3">
              <Field
                label="First Name"
                name="firstName"
                type="text"
                placeholder="First"
                value={form.firstName}
                onChange={handleChange}
                required
              />
              <Field
                label="Last Name"
                name="lastName"
                type="text"
                placeholder="Last"
                value={form.lastName}
                onChange={handleChange}
                required
              />
            </div>
          ) : null}
          <PhoneField
            value={form.phoneNumber}
            onChange={(v) => setForm((prev) => ({ ...prev, phoneNumber: v }))}
          />
          <Field
            label="Password"
            name="password"
            type="password"
            placeholder={isSignup ? 'Create a password' : 'Your password'}
            value={form.password}
            onChange={handleChange}
            required
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
                : 'Logging in...'
              : isSignup
                ? 'Sign Up'
                : 'Login'}
          </button>
        </form>

        <p className="text-center text-white/60 text-sm">
          {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
          <Link
            href={isSignup ? '/login' : '/signup'}
            className="text-white font-medium hover:opacity-70 transition-opacity"
          >
            {isSignup ? 'Login' : 'Sign Up'}
          </Link>
        </p>
      </div>
    </div>
  );
}

function PhoneField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
      <label className="text-white/60 text-xs font-medium">Phone Number</label>
      <div
        className="flex items-center w-full h-12 rounded-xl text-sm text-white outline-none transition-colors"
        style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)' }}
        onFocusCapture={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(249,115,22,0.6)')}
        onBlurCapture={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-input)')}
      >
        <span className="pl-4 pr-2 text-white/50 select-none shrink-0">+1</span>
        <div className="w-px h-5 bg-white/15 shrink-0" />
        <input
          name="phoneNumber"
          type="tel"
          placeholder="(xxx) xxx-xxxx"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          autoComplete="tel-national"
          className="flex-1 min-w-0 h-full bg-transparent px-3 text-sm text-white placeholder-white/30 outline-none"
        />
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
  required,
}: {
  label: string;
  name: string;
  type: string;
  placeholder: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
      <label className="text-white/60 text-xs font-medium">{label}</label>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        autoComplete="off"
        className="w-full h-12 rounded-xl px-4 text-sm text-white placeholder-white/30 outline-none transition-colors"
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
