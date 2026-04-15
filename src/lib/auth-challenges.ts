import { randomBytes, randomInt } from 'crypto';
import { prisma } from '@/lib/db';
import { hashAuthSecret } from '@/lib/auth-server';

export type AuthChallengeType = 'magic_link' | 'password_reset' | 'phone_signin';
export type MagicLinkMode = 'login' | 'signup';

type ParsedMetadata = {
  mode?: MagicLinkMode;
};

type ChallengeRecord = Awaited<ReturnType<typeof prisma.authChallenge.findUnique>>;

function getTtlMinutes(envName: string, fallbackMinutes: number): number {
  const raw = process.env[envName];
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackMinutes;
}

function getExpiry(minutes: number) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function parseMetadata(metadataJson: string | null): ParsedMetadata {
  if (!metadataJson) {
    return {};
  }

  try {
    return JSON.parse(metadataJson) as ParsedMetadata;
  } catch {
    return {};
  }
}

function attachMetadata(challenge: NonNullable<ChallengeRecord>) {
  return {
    ...challenge,
    metadata: parseMetadata(challenge.metadataJson),
  };
}

export function getMagicLinkTtlMinutes() {
  return getTtlMinutes('MAGIC_LINK_TTL_MINUTES', 15);
}

export function getPasswordResetTtlMinutes() {
  return getTtlMinutes('PASSWORD_RESET_TTL_MINUTES', 30);
}

export function getPhoneCodeTtlMinutes() {
  return getTtlMinutes('PHONE_SIGNIN_CODE_TTL_MINUTES', 10);
}

export async function createMagicLinkChallenge({
  email,
  phoneNumber,
  name,
  userId,
  mode,
}: {
  email: string;
  phoneNumber: string | null;
  name: string | null;
  userId: string | null;
  mode: MagicLinkMode;
}) {
  const rawToken = randomBytes(32).toString('hex');

  await prisma.authChallenge.updateMany({
    where: {
      type: 'magic_link',
      email,
      consumedAt: null,
    },
    data: {
      consumedAt: new Date(),
    },
  });

  await prisma.authChallenge.create({
    data: {
      type: 'magic_link',
      tokenHash: hashAuthSecret(rawToken),
      email,
      phoneNumber,
      name,
      userId,
      metadataJson: JSON.stringify({ mode }),
      expiresAt: getExpiry(getMagicLinkTtlMinutes()),
    },
  });

  return rawToken;
}

export async function consumeMagicLinkChallenge(rawToken: string) {
  const challenge = await prisma.authChallenge.findUnique({
    where: {
      tokenHash: hashAuthSecret(rawToken),
    },
  });

  if (
    !challenge ||
    challenge.type !== 'magic_link' ||
    challenge.consumedAt ||
    challenge.expiresAt.getTime() <= Date.now()
  ) {
    return null;
  }

  await prisma.authChallenge.update({
    where: { id: challenge.id },
    data: {
      consumedAt: new Date(),
    },
  });

  return attachMetadata(challenge);
}

export async function createPasswordResetChallenge({
  email,
  userId,
}: {
  email: string;
  userId: string;
}) {
  const rawToken = randomBytes(32).toString('hex');

  await prisma.authChallenge.updateMany({
    where: {
      type: 'password_reset',
      userId,
      consumedAt: null,
    },
    data: {
      consumedAt: new Date(),
    },
  });

  await prisma.authChallenge.create({
    data: {
      type: 'password_reset',
      tokenHash: hashAuthSecret(rawToken),
      email,
      userId,
      expiresAt: getExpiry(getPasswordResetTtlMinutes()),
    },
  });

  return rawToken;
}

export async function consumePasswordResetChallenge(rawToken: string) {
  const challenge = await prisma.authChallenge.findUnique({
    where: {
      tokenHash: hashAuthSecret(rawToken),
    },
  });

  if (
    !challenge ||
    challenge.type !== 'password_reset' ||
    challenge.consumedAt ||
    challenge.expiresAt.getTime() <= Date.now()
  ) {
    return null;
  }

  await prisma.authChallenge.update({
    where: { id: challenge.id },
    data: {
      consumedAt: new Date(),
    },
  });

  return attachMetadata(challenge);
}

export async function createPhoneSigninChallenge({
  phoneNumber,
  userId,
}: {
  phoneNumber: string;
  userId: string | null;
}) {
  const code = randomInt(100000, 1000000).toString();

  await prisma.authChallenge.updateMany({
    where: {
      type: 'phone_signin',
      phoneNumber,
      consumedAt: null,
    },
    data: {
      consumedAt: new Date(),
    },
  });

  await prisma.authChallenge.create({
    data: {
      type: 'phone_signin',
      codeHash: hashAuthSecret(code),
      phoneNumber,
      userId,
      expiresAt: getExpiry(getPhoneCodeTtlMinutes()),
    },
  });

  return code;
}

export async function consumePhoneSigninChallenge({
  phoneNumber,
  code,
}: {
  phoneNumber: string;
  code: string;
}) {
  const challenges = await prisma.authChallenge.findMany({
    where: {
      type: 'phone_signin',
      phoneNumber,
      consumedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 5,
  });

  const codeHash = hashAuthSecret(code);
  const matched = challenges.find((challenge) => challenge.codeHash === codeHash);

  if (!matched) {
    return null;
  }

  await prisma.authChallenge.updateMany({
    where: {
      type: 'phone_signin',
      phoneNumber,
      consumedAt: null,
    },
    data: {
      consumedAt: new Date(),
    },
  });

  return attachMetadata(matched);
}
