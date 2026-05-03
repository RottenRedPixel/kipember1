import { redirect } from 'next/navigation';
import { getCurrentAuth } from '@/lib/auth-server';
import { isAdmin } from '@/lib/admin-access';
import AdminShell from '@/components/admin/AdminShell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const auth = await getCurrentAuth();
  if (!auth) redirect('/signin?from=/admin/analytics');
  if (!isAdmin(auth.user)) redirect('/');

  return (
    <AdminShell userEmail={auth.user.email}>
      {children}
    </AdminShell>
  );
}
