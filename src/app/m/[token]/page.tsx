import { redirect } from 'next/navigation';
import { createHash } from 'crypto';
import { claimMemoriesForUser, createUserSession, setUserSessionCookie } from '@/lib/auth-server';
import { findSmsSigninChallenge, markSmsSigninChallengeConsumed } from '@/lib/auth-challenges';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const DEBUG = false;

function DebugPage({ log }: { log: string[] }) {
  return (
    <div style={{ background: '#111', color: '#0f0', fontFamily: 'monospace', fontSize: 13, padding: 24, minHeight: '100dvh', wordBreak: 'break-all' }}>
      <h2 style={{ color: '#fff', marginBottom: 16 }}>/m/[token] debug</h2>
      {log.map((line, i) => (
        <div key={i} style={{ marginBottom: 6 }}>{line}</div>
      ))}
    </div>
  );
}

export default async function SmsSigninPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const log: string[] = [];

  const computedHash = createHash('sha256').update(token).digest('hex');
  log.push(`token (full): ${token}`);
  log.push(`hash: ${computedHash}`);

  // Raw DB lookup to show exactly what's in the DB
  const raw = await prisma.authChallenge.findUnique({
    where: { tokenHash: computedHash },
  }).catch((e: unknown) => { log.push(`raw lookup error: ${e instanceof Error ? e.message : String(e)}`); return undefined; });

  if (raw === undefined) {
    // error already logged
  } else if (!raw) {
    log.push(`✗ no AuthChallenge row found with this hash`);
    const recent = await prisma.authChallenge.findMany({
      where: { type: 'sms_signin' },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: { tokenHash: true, consumedAt: true, expiresAt: true, createdAt: true, userId: true },
    }).catch(() => []);
    log.push(`recent sms_signin challenges (${recent.length}):`);
    for (const r of recent) {
      log.push(`  hash: ${r.tokenHash}`);
      log.push(`  consumed: ${r.consumedAt ?? 'no'}`);
      log.push(`  created: ${r.createdAt.toISOString()}`);
      log.push('---');
    }
  } else {
    log.push(`✓ raw row found:`);
    log.push(`  type: ${raw.type}`);
    log.push(`  userId: ${raw.userId}`);
    log.push(`  consumed: ${raw.consumedAt ?? 'no'}`);
    log.push(`  expires: ${raw.expiresAt.toISOString()}`);
    log.push(`  metadata: ${raw.metadataJson}`);
  }

  // Find (validate) without consuming
  const challenge = await findSmsSigninChallenge(token).catch((e: unknown) => {
    log.push(`findSmsSigninChallenge error: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  });

  if (!challenge?.userId) {
    log.push(`✗ challenge invalid or consumed — see raw row above`);
    if (DEBUG) return <DebugPage log={log} />;
    redirect('/');
  }
  log.push(`✓ challenge valid, userId: ${challenge.userId}`);

  const user = await prisma.user.findUnique({
    where: { id: challenge.userId },
    select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true },
  }).catch((e: unknown) => { log.push(`user lookup error: ${e instanceof Error ? e.message : String(e)}`); return null; });

  if (!user) {
    log.push(`✗ user not found`);
    if (DEBUG) return <DebugPage log={log} />;
    redirect('/');
  }
  log.push(`✓ user: ${user.firstName}`);

  try {
    await claimMemoriesForUser(user);
    log.push(`✓ claimMemoriesForUser done`);
    const sessionToken = await createUserSession(user.id);
    log.push(`✓ session created`);
    await setUserSessionCookie(sessionToken);
    log.push(`✓ cookie set`);
    // Only consume AFTER session is successfully created
    await markSmsSigninChallengeConsumed(challenge.id);
    log.push(`✓ challenge consumed`);
  } catch (err) {
    log.push(`✗ session error: ${err instanceof Error ? err.message : String(err)}`);
    if (DEBUG) return <DebugPage log={log} />;
    redirect('/');
  }

  log.push(`✓ redirecting to: ${challenge.redirectPath}`);
  if (DEBUG) return <DebugPage log={log} />;
  redirect(challenge.redirectPath);
}
