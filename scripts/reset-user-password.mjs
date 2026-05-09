import { createRequire } from 'module';
import { scryptSync, randomBytes } from 'crypto';
import { PrismaClient } from '../src/generated/prisma/client/index.js';

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

const PHONE = '+18484684648';
const TEMP_PASSWORD = 'Ember123!';

const user = await prisma.user.findUnique({ where: { phoneNumber: PHONE } });
if (!user) {
  console.error('User not found for phone:', PHONE);
  process.exit(1);
}

await prisma.user.update({
  where: { id: user.id },
  data: { passwordHash: hashPassword(TEMP_PASSWORD) },
});

console.log(`✓ Password set for ${user.email ?? user.phoneNumber}`);
console.log(`  Temp password: ${TEMP_PASSWORD}`);
console.log(`  Please change it after logging in.`);
await prisma.$disconnect();
