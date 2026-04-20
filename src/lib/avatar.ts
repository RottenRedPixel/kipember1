import { prisma } from '@/lib/db';

export async function getAvatarUrl(userId: string): Promise<string | null> {
  const record = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarFilename: true },
  });
  return record?.avatarFilename ? `/api/uploads/${record.avatarFilename}` : null;
}
