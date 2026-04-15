#!/usr/bin/env node
import { createClient } from '@libsql/client';
import { randomBytes, createHash } from 'crypto';

const [,, passcode, label] = process.argv;

if (!passcode) {
  console.error('Usage: node scripts/create-passcode.mjs "passcode" "label"');
  process.exit(1);
}

const dbUrl = process.env.DATABASE_URL || 'file:./dev.db';
const client = createClient({ url: dbUrl });

const salt = randomBytes(16).toString('hex');
const codeHash = createHash('sha256')
  .update(`${salt}:${passcode}`)
  .digest('hex');
const id = randomBytes(16).toString('hex');

await client.execute({
  sql: 'INSERT INTO AccessPass (id, label, codeHash, salt, active) VALUES (?, ?, ?, ?, 1)',
  args: [id, label || null, codeHash, salt],
});

console.log(`Created passcode ${id}`);
