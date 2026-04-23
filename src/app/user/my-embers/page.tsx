import { redirect } from 'next/navigation';

export default async function LegacyMyEmbersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = await searchParams;
  const preserved = new URLSearchParams();
  for (const [key, value] of Object.entries(resolved)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      value.forEach((v) => preserved.append(key, v));
    } else {
      preserved.set(key, value);
    }
  }
  const query = preserved.toString();
  redirect(query ? `/embers?${query}` : '/embers');
}
