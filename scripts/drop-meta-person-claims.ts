// Cleanup pass: drops person claims whose `value` contains the
// extractor's meta-paraphrase tokens ("contributor", "speaker", "user
// said", "asking"). Those rows aren't real mentions — they describe
// the conversation rather than what was said about the subject. Future
// messages re-process under the tightened prompt.

import 'dotenv/config';
import { prisma } from '../src/lib/db';

async function main() {
  const META_TOKENS = ['contributor', 'speaker', 'user said', 'is asking', 'asked about', 'asking about'];

  const claims = await prisma.memoryClaim.findMany({
    where: { claimType: 'person' },
    select: { id: true, subject: true, value: true, imageId: true },
  });

  const bad = claims.filter((c) => {
    const v = (c.value || '').toLowerCase();
    return META_TOKENS.some((tok) => v.includes(tok));
  });

  console.log(`Inspected ${claims.length} person claim(s).`);
  console.log(`Flagging ${bad.length} as meta-paraphrase:`);
  for (const c of bad) {
    console.log(`  - ${c.id} on ${c.imageId}: subject="${c.subject}" value="${c.value}"`);
  }

  if (bad.length === 0) {
    await prisma.$disconnect();
    return;
  }

  const result = await prisma.memoryClaim.deleteMany({
    where: { id: { in: bad.map((c) => c.id) } },
  });
  console.log(`Deleted ${result.count} bad person claim(s).`);
  await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
