'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import EmberBrand from '@/components/EmberBrand';

export default function MagicLinkVerifier() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('This sign-in link is missing its token.');
      return;
    }

    let cancelled = false;

    const verify = async () => {
      try {
        const response = await fetch('/api/auth/magic-link/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || 'Failed to verify sign-in link');
        }

        if (!cancelled) {
          router.push('/feed');
          router.refresh();
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to verify sign-in link');
        }
      }
    };

    void verify();

    return () => {
      cancelled = true;
    };
  }, [router, token]);

  return (
    <div className="ember-panel-strong w-full max-w-md rounded-[2rem] p-8 text-center">
      <EmberBrand subtitle="magic link" compact />
      <h1 className="ember-heading mt-6 text-4xl text-[var(--ember-text)]">
        Opening Ember
      </h1>
      <p className="ember-copy mt-3 text-sm">
        {error
          ? 'That sign-in link did not work.'
          : 'Verifying your secure link and opening your Embers.'}
      </p>

      {error ? (
        <div className="mt-6 ember-status ember-status-error">{error}</div>
      ) : (
        <div className="mt-6 text-sm text-[var(--ember-muted)]">One moment...</div>
      )}
    </div>
  );
}
