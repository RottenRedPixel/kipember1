import * as dotenv from 'dotenv';
dotenv.config();

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PrismaClient, Prisma } = await import('./src/generated/prisma/client/index.js');
const { PrismaPg } = require('@prisma/adapter-pg') as any;
const { Pool } = require('pg') as any;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

const rows = await prisma.promptOverride.findMany({
  where: { key: { startsWith: 'ember_chat' } },
  orderBy: { key: 'asc' },
});
for (const r of rows) {
  console.log(`\n=== ${r.key} ===\n${r.body}\n`);
}
await prisma.$disconnect();
