import { redirect } from 'next/navigation';
import AccessForm from '@/components/AccessForm';
import { isAccessLockEnabled } from '@/lib/access-server';

export default function AccessPage() {
  if (!isAccessLockEnabled()) {
    redirect('/');
  }

  return <AccessForm />;
}
