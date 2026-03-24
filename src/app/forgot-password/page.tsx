import AuthTopNav from '@/components/AuthTopNav';
import ForgotPasswordForm from '@/components/ForgotPasswordForm';

export default function ForgotPasswordPage() {
  return (
    <main className="ember-page">
      <AuthTopNav signedIn={false} />
      <div className="flex min-h-[calc(100vh-6rem)] items-start justify-center px-3 pt-3 pb-6 sm:px-4 sm:pt-4 sm:pb-8">
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
