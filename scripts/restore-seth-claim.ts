// I deleted the Seth person claim before realizing the extractor had
// actually got the subject right — the UI just wasn't surfacing it.
// Re-trigger person extraction on the original "That is Seth Tropper on
// the right" message so the claim comes back, this time so the user can
// see the new subject-headline rendering.

import 'dotenv/config';
import { prisma } from '../src/lib/db';
import { extractPeopleForMessage } from '../src/lib/memory-reconciliation';

async function main() {
  const imageId = 'cmoqbq8nr004w4xn473le6279';
  const message = await prisma.emberMessage.findFirst({
    where: {
      session: { imageId },
      role: 'user',
      content: { contains: 'Seth' },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, content: true, createdAt: true },
  });
  if (!message) {
    console.log('No Seth message found on image', imageId);
    await prisma.$disconnect();
    return;
  }
  console.log(`Re-extracting person claims for message ${message.id}: "${message.content}"`);
  const result = await extractPeopleForMessage(message.id);
  console.log(`Created ${result.claimsCreated} claim(s).`);
  const claims = await prisma.memoryClaim.findMany({
    where: { emberMessageId: message.id, claimType: 'person' },
    select: { subject: true, value: true },
  });
  for (const c of claims) {
    console.log(`  → subject="${c.subject}" value="${c.value}"`);
  }
  await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
