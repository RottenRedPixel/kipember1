import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-server';
import { listNarrationVoices } from '@/lib/elevenlabs';

export async function GET() {
  try {
    const auth = await requireApiUser();

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const voices = await listNarrationVoices();
    return NextResponse.json({ voices });
  } catch (error) {
    console.error('Story cut voice list error:', error);
    return NextResponse.json(
      { error: 'Failed to load voice options' },
      { status: 500 }
    );
  }
}
