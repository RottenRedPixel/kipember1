import AuthTopNav from '@/components/AuthTopNav';
import ForgotPasswordForm from '@/components/ForgotPasswordForm';

export default function ForgotPasswordPage() {
  return (
    <main className="ember-page">
      <AuthTopNav signedIn={false} />
      <div className="ember-auth-shell min-h-[calc(100vh-4.5rem)] items-start">
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
