// Ping each external dependency. Run: npx tsx scripts/healthcheck.ts
//
// Reports per-service: OK / FAIL / status code + latency. Non-fatal — runs
// every check even if earlier ones fail.

import { config as loadEnv } from 'dotenv';
loadEnv({ override: true });

type Result = { name: string; ok: boolean; detail: string; ms: number };

async function time<T>(fn: () => Promise<T>): Promise<{ value?: T; err?: unknown; ms: number }> {
  const t0 = Date.now();
  try {
    const value = await fn();
    return { value, ms: Date.now() - t0 };
  } catch (err) {
    return { err, ms: Date.now() - t0 };
  }
}

async function checkAnthropic(): Promise<Result> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { name: 'Anthropic', ok: false, detail: 'ANTHROPIC_API_KEY not set', ms: 0 };
  const { value, err, ms } = await time(async () => {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'ping' }],
      }),
    });
    return { status: r.status, body: r.ok ? '' : await r.text() };
  });
  if (err) return { name: 'Anthropic', ok: false, detail: String(err), ms };
  return { name: 'Anthropic', ok: value!.status < 400, detail: `HTTP ${value!.status}${value!.body ? ' — ' + value!.body.slice(0, 200) : ''}`, ms };
}

async function checkOpenAI(): Promise<Result> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { name: 'OpenAI', ok: false, detail: 'OPENAI_API_KEY not set', ms: 0 };
  const { value, err, ms } = await time(async () => {
    const r = await fetch('https://api.openai.com/v1/models', {
      headers: { authorization: `Bearer ${key}` },
    });
    return { status: r.status, body: r.ok ? '' : await r.text() };
  });
  if (err) return { name: 'OpenAI', ok: false, detail: String(err), ms };
  return { name: 'OpenAI', ok: value!.status < 400, detail: `HTTP ${value!.status}${value!.body ? ' — ' + value!.body.slice(0, 200) : ''}`, ms };
}

async function checkRetell(): Promise<Result> {
  const key = process.env.RETELL_API_KEY;
  if (!key) return { name: 'Retell', ok: false, detail: 'RETELL_API_KEY not set', ms: 0 };
  const { value, err, ms } = await time(async () => {
    const r = await fetch('https://api.retellai.com/list-agents', {
      headers: { authorization: `Bearer ${key}` },
    });
    return { status: r.status, body: r.ok ? '' : await r.text() };
  });
  if (err) return { name: 'Retell', ok: false, detail: String(err), ms };
  return { name: 'Retell', ok: value!.status < 400, detail: `HTTP ${value!.status}${value!.body ? ' — ' + value!.body.slice(0, 200) : ''}`, ms };
}

async function checkElevenLabs(): Promise<Result> {
  const key = process.env.ELEVENLABS;
  if (!key) return { name: 'ElevenLabs', ok: false, detail: 'ELEVENLABS not set', ms: 0 };
  const { value, err, ms } = await time(async () => {
    const r = await fetch('https://api.elevenlabs.io/v1/user', {
      headers: { 'xi-api-key': key },
    });
    return { status: r.status, body: r.ok ? '' : await r.text() };
  });
  if (err) return { name: 'ElevenLabs', ok: false, detail: String(err), ms };
  return { name: 'ElevenLabs', ok: value!.status < 400, detail: `HTTP ${value!.status}${value!.body ? ' — ' + value!.body.slice(0, 200) : ''}`, ms };
}

async function checkPostgres(): Promise<Result> {
  const url = process.env.DATABASE_URL;
  if (!url) return { name: 'Postgres', ok: false, detail: 'DATABASE_URL not set', ms: 0 };
  const { value, err, ms } = await time(async () => {
    const { prisma } = await import('../src/lib/db');
    const rows = await prisma.$queryRaw`SELECT 1 as ok`;
    await prisma.$disconnect();
    return rows;
  });
  if (err) return { name: 'Postgres', ok: false, detail: String(err).slice(0, 300), ms };
  return { name: 'Postgres', ok: Array.isArray(value) && value.length > 0, detail: 'SELECT 1 ok', ms };
}

(async () => {
  console.log('Pinging external services...\n');
  const results = await Promise.all([
    checkAnthropic(),
    checkOpenAI(),
    checkRetell(),
    checkElevenLabs(),
    checkPostgres(),
  ]);
  for (const r of results) {
    const tag = r.ok ? '✅ OK  ' : '❌ FAIL';
    console.log(`${tag}  ${r.name.padEnd(12)} ${String(r.ms).padStart(5)}ms  ${r.detail}`);
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} services healthy.`);
  process.exit(failed.length > 0 ? 1 : 0);
})();
