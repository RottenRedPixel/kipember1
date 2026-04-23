import { redirect } from 'next/navigation';

export default async function ImagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/ember/${id}`);
}
