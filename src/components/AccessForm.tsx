'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AccessForm() {
  const router = useRouter();

  const [passcode, setPasscode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!passcode.trim()) {
      setError('Passcode is required');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: passcode.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Invalid passcode');
      }

      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify passcode');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="ember-auth-card p-8">
      <span className="ember-stage-pill">Private site</span>
      <h1 className="mt-5 text-[2.1rem] font-semibold leading-[0.96] tracking-[-0.06em] text-white">
        Enter the access passcode
      </h1>
      <p className="mt-3 text-sm leading-7 text-white/56">
        This deployment is private. Unlock it with the passcode to continue.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <input
          type="password"
          value={passcode}
          onChange={(event) => setPasscode(event.target.value)}
          placeholder="Passcode"
          className="ember-input min-h-[3.35rem] px-4 text-[0.98rem] placeholder:text-white/34"
        />
        {error ? <div className="ember-status ember-status-error">{error}</div> : null}
        <button
          type="submit"
          disabled={isSubmitting}
          className="ember-button-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Checking...' : 'Unlock'}
        </button>
      </form>
    </div>
  );
}
