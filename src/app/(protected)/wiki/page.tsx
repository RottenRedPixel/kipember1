import { redirect } from 'next/navigation';

export default function WikiIndexRedirect() {
  redirect('/feed');
}
