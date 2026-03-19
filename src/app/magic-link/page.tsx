import { Suspense } from 'react';
import AuthTopNav from '@/components/AuthTopNav';
import MagicLinkVerifier from '@/components/MagicLinkVerifier';

export default function MagicLinkPage() {
  return (
    <main className="ember-page">
      <AuthTopNav signedIn={false} />
      <div className="flex min-h-[calc(100vh-6rem)] items-center justify-center px-4 py-10">
        <Suspense fallback={<div className="ember-panel-strong w-full max-w-md rounded-[2rem] p-8 text-center text-sm text-[var(--ember-muted)]">Opening Ember...</div>}>
          <MagicLinkVerifier />
        </Suspense>
      </div>
    </main>
  );
}
