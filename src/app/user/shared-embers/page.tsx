import { redirect } from 'next/navigation';

export default function SharedEmbersPage() {
  redirect('/user/my-embers?view=shared');
}
