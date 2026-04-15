import { randomBytes, createHash } from 'crypto';

export function generateSalt(): string {
  return randomBytes(16).toString('hex');
}

export function hashPasscode(passcode: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${passcode}`).digest('hex');
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}
