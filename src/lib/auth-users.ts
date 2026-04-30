import { prisma } from '@/lib/db';
import {
  createTemporaryPasswordHash,
  getPhoneAccountEmail,
  normalizeEmail,
  normalizePhone,
  transferLegacyOwnerImagesIfNeeded,
} from '@/lib/auth-server';

export const authUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phoneNumber: true,
} as const;

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: {
      email: normalizeEmail(email),
    },
    select: authUserSelect,
  });
}

export async function findUserByPhone(phoneNumber: string) {
  return prisma.user.findFirst({
    where: {
      phoneNumber: normalizePhone(phoneNumber),
    },
    select: authUserSelect,
  });
}

export async function createUserAccount({
  email,
  phoneNumber,
  firstName,
  lastName,
  passwordHash,
}: {
  email: string;
  phoneNumber: string | null;
  firstName: string | null;
  lastName: string | null;
  passwordHash?: string;
}) {
  const user = await prisma.user.create({
    data: {
      email: normalizeEmail(email),
      phoneNumber: normalizePhone(phoneNumber),
      firstName: typeof firstName === 'string' && firstName.trim() ? firstName.trim() : null,
      lastName: typeof lastName === 'string' && lastName.trim() ? lastName.trim() : null,
      passwordHash: passwordHash || createTemporaryPasswordHash(),
    },
    select: authUserSelect,
  });

  await transferLegacyOwnerImagesIfNeeded(user);
  return user;
}

export async function getOrCreatePhoneUser({
  phoneNumber,
}: {
  phoneNumber: string;
}) {
  const normalizedPhone = normalizePhone(phoneNumber);
  if (!normalizedPhone) {
    throw new Error('A valid phone number is required');
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      phoneNumber: normalizedPhone,
    },
    select: authUserSelect,
  });

  if (existingUser) {
    return existingUser;
  }

  return createUserAccount({
    email: getPhoneAccountEmail(normalizedPhone),
    phoneNumber: normalizedPhone,
    firstName: null,
    lastName: null,
  });
}
