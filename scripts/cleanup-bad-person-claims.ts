// Drops every existing person claim so the tightened
// housekeeping.person_extraction prompt can re-extract from scratch on
// the next chat / voice / call message. Person extraction is brand new
// (one bad claim in the wild) so we don't lose anything.

import 'dotenv/config';
import { prisma } from '../src/lib/db';

async function main() {
  const before = await prisma.memoryClaim.findMany({
    where: { claimType: 'person' },
    select: { id: true, subject: true, value: true, imageId: true },
  });
  console.log(`Found ${before.length} person claim(s):`);
  for (const c of before) {
    console.log(`  - ${c.id} on ${c.imageId}: subject="${c.subject}" value="${c.value}"`);
  }
  if (before.length === 0) {
    await prisma.$disconnect();
    return;
  }

  const result = await prisma.memoryClaim.deleteMany({ where: { claimType: 'person' } });
  console.log(`Deleted ${result.count} person claim(s).`);
  await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
