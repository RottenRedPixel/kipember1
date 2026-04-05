import Link from 'next/link';
import AuthTopNav from '@/components/AuthTopNav';
import LogoutButton from '@/components/LogoutButton';
import { getCurrentAuth } from '@/lib/auth-server';

export default async function AccessPage() {
  const auth = await getCurrentAuth();

  return (
    <main className="ember-page">
      <AuthTopNav
        signedIn={Boolean(auth)}
        userName={auth?.user.name || null}
        userEmail={auth?.user.email || null}
      />
      <div className="ember-auth-shell min-h-[calc(100vh-4.5rem)] items-start">
        <div className="w-full max-w-xl">
          <div className="ember-panel rounded-[2.25rem] p-6 sm:p-8">
            <div className="mt-2 text-center">
              <p className="ember-eyebrow">Account</p>
              <h1 className="ember-heading mt-4 text-4xl text-[var(--ember-text)]">
                {auth ? 'You are signed in.' : 'Choose how to continue.'}
              </h1>
              <p className="ember-copy mt-4 text-sm">
                {auth
                  ? `Signed in as ${auth.user.name || auth.user.email}.`
                  : 'Log in to your Embers or create a new account.'}
              </p>
            </div>

            <div className="mt-8 grid gap-3">
              {auth ? (
                <>
                  <Link href="/profile" className="ember-button-primary">
                    Open profile
                  </Link>
                  <Link href="/feed" className="ember-button-secondary">
                    Go to Embers
                  </Link>
                  <div className="pt-1">
                    <LogoutButton />
                  </div>
                </>
              ) : (
                <>
                  <Link href="/login" className="ember-button-primary">
                    Log in
                  </Link>
                  <Link href="/signup" className="ember-button-secondary">
                    Create account
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
