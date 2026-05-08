import { redirect } from 'next/navigation';
import { claimMemoriesForUser, createUserSession, setUserSessionCookie } from '@/lib/auth-server';
import { consumeSmsSigninChallenge } from '@/lib/auth-challenges';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const DEBUG = true;

function DebugPage({ log }: { log: string[] }) {
  return (
    <div style={{ background: '#111', color: '#0f0', fontFamily: 'monospace', fontSize: 14, padding: 24, minHeight: '100dvh' }}>
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

  log.push(`✓ token received: ${token.slice(0, 8)}...`);

  let challenge: { userId: string | null; redirectPath: string } | null = null;
  try {
    challenge = await consumeSmsSigninChallenge(token);
    log.push(`✓ challenge result: ${JSON.stringify(challenge)}`);
  } catch (err) {
    log.push(`✗ consumeSmsSigninChallenge threw: ${err instanceof Error ? err.message : String(err)}`);
    if (DEBUG) return <DebugPage log={log} />;
    redirect('/');
  }

  const userId = challenge?.userId;
  if (!userId) {
    log.push(`✗ no userId — challenge was null or userId missing`);
    if (DEBUG) return <DebugPage log={log} />;
    redirect('/');
  }
  log.push(`✓ userId: ${userId}`);

  let user: { id: string; firstName: string | null; lastName: string | null; email: string | null; phoneNumber: string | null } | null = null;
  try {
    user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true },
    });
    log.push(`✓ user found: ${user ? user.firstName : 'null'}`);
  } catch (err) {
    log.push(`✗ prisma.user.findUnique threw: ${err instanceof Error ? err.message : String(err)}`);
    if (DEBUG) return <DebugPage log={log} />;
    redirect('/');
  }

  if (!user) {
    log.push(`✗ user not found in DB for userId: ${userId}`);
    if (DEBUG) return <DebugPage log={log} />;
    redirect('/');
  }

  try {
    await claimMemoriesForUser(user);
    log.push(`✓ claimMemoriesForUser done`);
    const sessionToken = await createUserSession(user.id);
    log.push(`✓ session created`);
    await setUserSessionCookie(sessionToken);
    log.push(`✓ cookie set`);
  } catch (err) {
    log.push(`✗ session/cookie error: ${err instanceof Error ? err.message : String(err)}`);
    if (DEBUG) return <DebugPage log={log} />;
    redirect('/');
  }

  log.push(`✓ all done — redirecting to: ${challenge?.redirectPath}`);
  if (DEBUG) return <DebugPage log={log} />;
  redirect(challenge?.redirectPath ?? '/home');
}
