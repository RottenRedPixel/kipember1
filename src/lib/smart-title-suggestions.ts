import { prisma } from '@/lib/db';

export async function invalidateSmartTitleSuggestions(emberId: string) {
  await prisma.ember.update({
    where: { id: emberId },
    data: {
      smartTitleSuggestionsJson: null,
      smartTitleSuggestionsUpdatedAt: null,
    },
  });
}
