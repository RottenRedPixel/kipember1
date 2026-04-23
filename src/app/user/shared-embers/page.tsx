import { redirect } from 'next/navigation';

export default function SharedEmbersPage() {
  redirect('/embers?view=shared');
}
