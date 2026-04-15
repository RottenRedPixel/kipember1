import { Prisma, PrismaClient } from '@/generated/prisma/client';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PrismaPg } = require('@prisma/adapter-pg') as {
  PrismaPg: new (poolOrConfig: unknown) => NonNullable<Prisma.PrismaClientOptions['adapter']>;
};
const { Pool } = require('pg') as {
  Pool: new (config: { connectionString: string }) => unknown;
};

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not configured');
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaPool: unknown;
};

export const prisma =
  globalForPrisma.prisma ??
  (() => {
    const pool = globalForPrisma.prismaPool ?? new Pool({ connectionString });
    const adapter: NonNullable<Prisma.PrismaClientOptions['adapter']> = new PrismaPg(pool);
    const client = new PrismaClient({ adapter });

    if (process.env.NODE_ENV !== 'production') {
      globalForPrisma.prismaPool = pool;
      globalForPrisma.prisma = client;
    }

    return client;
  })();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
