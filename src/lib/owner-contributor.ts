import { prisma } from '@/lib/db';
import { getUserDisplayName } from '@/lib/user-name';

type OwnerProfile = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phoneNumber: string | null;
};

async function getOwnerProfile(userId: string): Promise<OwnerProfile | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phoneNumber: true,
    },
  });
}

async function ensureContributorPoolEntry(
  ownerId: string,
  user: OwnerProfile
) {
  const displayName = getUserDisplayName(user);

  return prisma.contributor.upsert({
    where: {
      ownerId_userId: {
        ownerId,
        userId: user.id,
      },
    },
    update: {
      name: displayName,
      email: user.email,
      phoneNumber: user.phoneNumber,
    },
    create: {
      ownerId,
      userId: user.id,
      name: displayName,
      email: user.email,
      phoneNumber: user.phoneNumber,
    },
  });
}

export async function ensureUserContributorForImage(imageId: string, userId: string) {
  const image = await prisma.image.findUnique({
    where: { id: imageId },
    select: { ownerId: true },
  });
  if (!image) return null;

  const user = await getOwnerProfile(userId);
  if (!user) return null;

  const contributor = await ensureContributorPoolEntry(image.ownerId, user);

  return prisma.emberContributor.upsert({
    where: {
      contributorId_imageId: {
        contributorId: contributor.id,
        imageId,
      },
    },
    update: {},
    create: {
      contributorId: contributor.id,
      imageId,
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

  const contributor = await ensureContributorPoolEntry(userId, owner);

  const existingEmberContributors = await prisma.emberContributor.findMany({
    where: {
      contributorId: contributor.id,
      imageId: {
        in: ownedImages.map((image) => image.id),
      },
    },
    select: { imageId: true },
  });

  const existingImageIds = new Set(existingEmberContributors.map((ec) => ec.imageId));
  const missingImageIds = ownedImages
    .map((image) => image.id)
    .filter((imageId) => !existingImageIds.has(imageId));

  if (!missingImageIds.length) {
    return;
  }

  await prisma.$transaction(
    missingImageIds.map((imageId) =>
      prisma.emberContributor.create({
        data: {
          contributorId: contributor.id,
          imageId,
        },
      })
    )
  );
}
