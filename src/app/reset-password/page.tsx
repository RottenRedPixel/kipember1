import { Suspense } from 'react';
import AuthTopNav from '@/components/AuthTopNav';
import ResetPasswordForm from '@/components/ResetPasswordForm';

export default function ResetPasswordPage() {
  return (
    <main className="ember-page">
      <AuthTopNav signedIn={false} />
      <div className="flex min-h-[calc(100vh-6rem)] items-start justify-center px-3 pt-3 pb-6 sm:px-4 sm:pt-4 sm:pb-8">
        <Suspense fallback={<div className="ember-panel-strong w-full max-w-md rounded-[2rem] p-8 text-center text-sm text-[var(--ember-muted)]">Loading reset form...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
