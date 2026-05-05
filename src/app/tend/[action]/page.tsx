import { redirect } from 'next/navigation';
import { getCurrentAuth } from '@/lib/auth-server';
import TendActionScreen from '@/components/kipember/TendActionScreen';

export default async function TendActionPage({
  params,
  searchParams,
}: {
  params: Promise<{ action: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await getCurrentAuth();
  if (!auth) {
    redirect('/signin');
  }

  const { action } = await params;
  // The wiki has moved to a modal on /ember/[id]?m=wiki so the ember
  // layout (cover photo + right rail) stays visible behind it. Old
  // /tend/view-wiki?id=X URLs (deep links, edit-slider back-navigation)
  // get bridged to the new modal URL transparently.
  if (action === 'view-wiki') {
    const sp = await searchParams;
    const idRaw = sp.id;
    const id = Array.isArray(idRaw) ? idRaw[0] : idRaw;
    if (id) {
      redirect(`/ember/${id}?m=wiki`);
    }
    redirect('/home');
  }

  return <TendActionScreen action={action} />;
}
