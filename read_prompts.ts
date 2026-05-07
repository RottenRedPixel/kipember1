import { PrismaClient } from './src/generated/prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const prisma = new PrismaClient();
  const rows = await prisma.promptOverride.findMany({
    where: { key: { startsWith: 'ember_chat' } },
    orderBy: { key: 'asc' },
  });
  for (const r of rows) {
    console.log(`\n=== ${r.key} ===\n${r.body}\n`);
  }
  await prisma.$disconnect();
}
main();
