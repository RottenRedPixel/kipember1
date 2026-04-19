import { prisma } from '@/lib/db';

export async function invalidateSmartTitleSuggestions(imageId: string) {
  await prisma.image.update({
    where: { id: imageId },
    data: {
      smartTitleSuggestionsJson: null,
      smartTitleSuggestionsUpdatedAt: null,
    },
  });
}
