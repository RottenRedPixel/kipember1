import { redirect } from 'next/navigation';
import AuthForm from '@/components/AuthForm';
import EmberMobileTopBar from '@/components/EmberMobileTopBar';
import { getCurrentAuth } from '@/lib/auth-server';

export default async function LoginPage() {
  const auth = await getCurrentAuth();

  if (auth) {
    redirect('/feed');
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[26rem] bg-white">
      <header className="sticky top-0 z-40 bg-[#1a1a1a]">
        <EmberMobileTopBar
          homeHref="/"
          embersHref="/feed"
          addHref="/?openGuestUploader=1"
          accountHref="/access"
          menuAuthMode="signed-out"
          variant="text"
        />
      </header>
      <div className="min-h-[calc(100vh-2.7rem)] bg-white px-6 pt-8 pb-10">
        <AuthForm mode="login" />
      </div>
    </main>
  );
}
