// /contribute/[token] used to be a "Choose a mode" landing page with
// Phone Call / Ask Ember / Video Call buttons. The flow now lives
// inside the unified guest experience at /guest/[token], so this route
// just resolves the token and redirects there. The phone-call entry
// point lives in the chat shell's call icon when needed.

import { redirect } from 'next/navigation';

export default async function ContributeRedirect({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  redirect(`/guest/${token}`);
}
