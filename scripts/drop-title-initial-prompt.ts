import 'dotenv/config';
import { prisma } from '../src/lib/db';

async function main() {
  const dropped = await prisma.promptOverride
    .delete({ where: { key: 'title_generation.initial' } })
    .catch(() => null);
  console.log(dropped ? 'Dropped title_generation.initial' : 'No title_generation.initial row to drop');

  const cleared = await prisma.image.updateMany({
    where: { smartTitleSuggestionsJson: { not: null } },
    data: { smartTitleSuggestionsJson: null, smartTitleSuggestionsUpdatedAt: null },
  });
  console.log(`Cleared smartTitleSuggestionsJson on ${cleared.count} image(s)`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
