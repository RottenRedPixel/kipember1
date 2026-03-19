import AuthTopNav from '@/components/AuthTopNav';
import ForgotPasswordForm from '@/components/ForgotPasswordForm';

export default function ForgotPasswordPage() {
  return (
    <main className="ember-page">
      <AuthTopNav signedIn={false} />
      <div className="flex min-h-[calc(100vh-6rem)] items-center justify-center px-4 py-10">
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
