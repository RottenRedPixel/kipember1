import { prisma } from '@/lib/db';

export async function ensureUserContributorForImage(emberId: string, userId: string) {
  return prisma.emberContributor.upsert({
    where: { userId_emberId: { userId, emberId } },
    update: {},
    create: { userId, emberId },
  });
}

export const ensureOwnerContributorForImage = ensureUserContributorForImage;

export async function ensureOwnerContributorsForOwnedImages(userId: string) {
  const ownedEmbers = await prisma.ember.findMany({
    where: { ownerId: userId },
    select: { id: true },
  });
  if (!ownedEmbers.length) return;

  const existing = await prisma.emberContributor.findMany({
    where: { userId, emberId: { in: ownedEmbers.map((i) => i.id) } },
    select: { emberId: true },
  });

  const existingIds = new Set(existing.map((ec) => ec.emberId));
  const missing = ownedEmbers.map((i) => i.id).filter((id) => !existingIds.has(id));
  if (!missing.length) return;

  await prisma.$transaction(
    missing.map((emberId) => prisma.emberContributor.create({ data: { userId, emberId } }))
  );
}
