import { prisma } from '@/lib/db';

export async function ensureUserContributorForImage(imageId: string, userId: string) {
  return prisma.emberContributor.upsert({
    where: { userId_imageId: { userId, imageId } },
    update: {},
    create: { userId, imageId },
  });
}

export const ensureOwnerContributorForImage = ensureUserContributorForImage;

export async function ensureOwnerContributorsForOwnedImages(userId: string) {
  const ownedImages = await prisma.image.findMany({
    where: { ownerId: userId },
    select: { id: true },
  });
  if (!ownedImages.length) return;

  const existing = await prisma.emberContributor.findMany({
    where: { userId, imageId: { in: ownedImages.map((i) => i.id) } },
    select: { imageId: true },
  });

  const existingIds = new Set(existing.map((ec) => ec.imageId));
  const missing = ownedImages.map((i) => i.id).filter((id) => !existingIds.has(id));
  if (!missing.length) return;

  await prisma.$transaction(
    missing.map((imageId) => prisma.emberContributor.create({ data: { userId, imageId } }))
  );
}
