import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuth } from '@/lib/auth-server';
import { isAdmin } from '@/lib/admin-access';
import { prisma } from '@/lib/db';
import { VOICE_CATALOG, DEFAULT_VOICE_ID } from '@/lib/voice-catalog';

export async function GET() {
  const auth = await getCurrentAuth();
  if (!auth || !isAdmin(auth.user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const counts = await prisma.user.groupBy({
    by: ['voicePreferenceId'],
    _count: { id: true },
  });

  const totalUsers = counts.reduce((sum, r) => sum + r._count.id, 0);

  const voices = VOICE_CATALOG.map((v) => {
    const row = counts.find((r) => (r.voicePreferenceId ?? DEFAULT_VOICE_ID) === v.id);
    return {
      id: v.id,
      name: v.name,
      accent: v.accent,
      gender: v.gender,
      elevenLabsId: v.elevenLabsId,
      retellId: v.retellId,
      userCount: row?._count.id ?? 0,
    };
  });

  // Users with null voicePreferenceId default to sarah — fold into sarah count
  const nullRow = counts.find((r) => r.voicePreferenceId === null);
  if (nullRow) {
    const sarah = voices.find((v) => v.id === DEFAULT_VOICE_ID);
    if (sarah) sarah.userCount += nullRow._count.id;
  }

  return NextResponse.json({ voices, totalUsers });
}

export async function PATCH(request: NextRequest) {
  const auth = await getCurrentAuth();
  if (!auth || !isAdmin(auth.user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { voiceId, field, value } = await request.json() as {
    voiceId: string;
    field: 'elevenLabsId' | 'retellId';
    value: string;
  };

  if (!voiceId || !field || !value?.trim()) {
    return NextResponse.json({ error: 'voiceId, field, and value are required' }, { status: 400 });
  }
  if (field !== 'elevenLabsId' && field !== 'retellId') {
    return NextResponse.json({ error: 'field must be elevenLabsId or retellId' }, { status: 400 });
  }

  const entry = VOICE_CATALOG.find((v) => v.id === voiceId);
  if (!entry) {
    return NextResponse.json({ error: 'Unknown voice ID' }, { status: 404 });
  }

  // Mutate the in-memory catalog (takes effect for all new calls until restart)
  entry[field] = value.trim();

  return NextResponse.json({ ok: true, voice: entry });
}
