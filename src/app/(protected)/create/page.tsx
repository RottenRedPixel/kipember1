import { redirect } from 'next/navigation';

export default function CreatePage() {
  redirect('/home?mode=first-ember');
}
