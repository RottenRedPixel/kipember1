import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';

const COOKIE_NAME = 'mw_access';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = cookies().get(COOKIE_NAME)?.value;

  if (!token) {
    redirect('/access');
  }

  const session = await prisma.accessSession.findUnique({
    where: { token },
    include: { pass: true },
  });

  if (!session || !session.active || !session.pass.active) {
    redirect('/access');
  }

  return <>{children}</>;
}
