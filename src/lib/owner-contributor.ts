import { prisma } from '@/lib/db';

type OwnerProfile = {
  id: string;
  name: string | null;
  email: string;
  phoneNumber: string | null;
};

async function getOwnerProfile(userId: string): Promise<OwnerProfile | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phoneNumber: true,
    },
  });
}

export async function ensureUserContributorForImage(imageId: string, userId: string) {
  const user = await getOwnerProfile(userId);

  if (!user) {
    return null;
  }

  return prisma.contributor.upsert({
    where: {
      imageId_userId: {
        imageId,
        userId,
      },
    },
    update: {
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
    },
    create: {
      imageId,
      userId,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
    },
  });
}

export async function ensureOwnerContributorForImage(imageId: string, userId: string) {
  return ensureUserContributorForImage(imageId, userId);
}

export async function ensureOwnerContributorsForOwnedImages(userId: string) {
  const owner = await getOwnerProfile(userId);

  if (!owner) {
    return;
  }

  const ownedImages = await prisma.image.findMany({
    where: { ownerId: userId },
    select: { id: true },
  });

  if (!ownedImages.length) {
    return;
  }

  const existingContributorRecords = await prisma.contributor.findMany({
    where: {
      userId,
      imageId: {
        in: ownedImages.map((image) => image.id),
      },
    },
    select: {
      imageId: true,
    },
  });

  const existingImageIds = new Set(
    existingContributorRecords.map((contributor) => contributor.imageId)
  );
  const missingImageIds = ownedImages
    .map((image) => image.id)
    .filter((imageId) => !existingImageIds.has(imageId));

  if (!missingImageIds.length) {
    return;
  }

  await prisma.$transaction(
    missingImageIds.map((imageId) =>
      prisma.contributor.create({
        data: {
          imageId,
          userId,
          name: owner.name,
          email: owner.email,
          phoneNumber: owner.phoneNumber,
        },
      })
    )
  );
}
