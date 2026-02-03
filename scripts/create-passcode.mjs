#!/usr/bin/env node
import { PrismaClient } from '../src/generated/prisma/client.js';
import { generateSalt, hashPasscode } from '../src/lib/access.js';

const prisma = new PrismaClient();

const [,, passcode, label] = process.argv;

if (!passcode) {
  console.error('Usage: node scripts/create-passcode.mjs "passcode" "label"');
  process.exit(1);
}

const salt = generateSalt();
const codeHash = hashPasscode(passcode, salt);

const pass = await prisma.accessPass.create({
  data: {
    label: label || null,
    salt,
    codeHash,
  },
});

console.log(`Created passcode ${pass.id}`);
await prisma.$disconnect();
