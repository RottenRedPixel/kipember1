import { requirePageUser } from '@/lib/auth-server';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePageUser();
  return <>{children}</>;
}
