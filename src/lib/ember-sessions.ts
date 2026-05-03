import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';

export type EmberParticipantType = 'owner' | 'contributor' | 'guest';
export type EmberSessionType = 'chat' | 'call' | 'voice';

export type EmberSessionIdentity = {
  imageId: string;
  sessionType: EmberSessionType;
  participantType: EmberParticipantType;
  participantId: string;
};

export type ContributorParticipantInput = {
  id: string;
  userId: string | null;
  image: {
    ownerId: string;
  };
};

type EnsureEmberSessionInput = EmberSessionIdentity & {
  status?: string;
  currentStep?: string | null;
  userId?: string | null;
  emberContributorId?: string | null;
  browserId?: string | null;
};

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export function emberSessionParticipantWhere(identity: EmberSessionIdentity) {
  return {
    imageId_sessionType_participantType_participantId: {
      imageId: identity.imageId,
      sessionType: identity.sessionType,
      participantType: identity.participantType,
      participantId: identity.participantId,
    },
  };
}

export function contributorParticipant(
  contributor: ContributorParticipantInput
): Pick<EmberSessionIdentity, 'participantType' | 'participantId'> {
  if (contributor.userId && contributor.userId === contributor.image.ownerId) {
    return {
      participantType: 'owner',
      participantId: contributor.userId,
    };
  }

  return {
    participantType: 'contributor',
    participantId: contributor.id,
  };
}

export function contributorChatSessionIdentity(
  contributor: ContributorParticipantInput & { imageId: string }
): EmberSessionIdentity {
  return {
    imageId: contributor.imageId,
    sessionType: 'chat',
    ...contributorParticipant(contributor),
  };
}

export async function findEmberSessionByParticipant(identity: EmberSessionIdentity) {
  return prisma.emberSession.findUnique({
    where: emberSessionParticipantWhere(identity),
  });
}

export async function ensureEmberSession(input: EnsureEmberSessionInput) {
  const identity: EmberSessionIdentity = {
    imageId: input.imageId,
    sessionType: input.sessionType,
    participantType: input.participantType,
    participantId: input.participantId,
  };

  const existing = await findEmberSessionByParticipant(identity);
  if (existing) {
    const updateData: {
      userId?: string;
      emberContributorId?: string;
      browserId?: string;
    } = {};

    if (input.userId && !existing.userId) updateData.userId = input.userId;
    if (input.emberContributorId && !existing.emberContributorId) updateData.emberContributorId = input.emberContributorId;
    if (input.browserId && !existing.browserId) updateData.browserId = input.browserId;

    if (Object.keys(updateData).length === 0) return existing;

    try {
      return await prisma.emberSession.update({
        where: { id: existing.id },
        data: updateData,
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      return existing;
    }
  }

  const data = {
    imageId: input.imageId,
    sessionType: input.sessionType,
    participantType: input.participantType,
    participantId: input.participantId,
    status: input.status ?? 'active',
    currentStep: input.currentStep,
    userId: input.userId,
    emberContributorId: input.emberContributorId,
    browserId: input.browserId,
  };

  try {
    return await prisma.emberSession.create({ data });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const raced = await findEmberSessionByParticipant(identity);
    if (raced) return raced;
    throw error;
  }
}
