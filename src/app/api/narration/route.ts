import { NextRequest, NextResponse } from 'next/server';
import {
  getElevenLabsApiKey,
  getElevenLabsModelId,
  resolveNarrationVoice,
  type NarrationPreference,
} from '@/lib/elevenlabs';
import { requireApiUser } from '@/lib/auth-server';
import {
  normalizeNarrationText,
  normalizeTextForSpeech,
} from '@/lib/narration';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKey = getElevenLabsApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ElevenLabs is not configured for narration.' },
        { status: 503 }
      );
    }

    const body = (await request.json().catch(() => null)) as
      | {
          script?: string;
          voicePreference?: NarrationPreference;
          voiceId?: string;
        }
      | null;

    const script =
      typeof body?.script === 'string' && body.script.trim()
        ? normalizeNarrationText(body.script)
        : '';
    const voicePreference: NarrationPreference =
      body?.voicePreference === 'male' ? 'male' : 'female';
    const explicitVoiceId =
      typeof body?.voiceId === 'string' && body.voiceId.trim() ? body.voiceId.trim() : null;

    if (!script) {
      return NextResponse.json(
        { error: 'There is no snapshot available to narrate yet.' },
        { status: 400 }
      );
    }

    const speechReadyNarrationText = normalizeTextForSpeech(script);

    const voiceId = explicitVoiceId || (await resolveNarrationVoice(voicePreference)).voiceId;

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          Accept: 'audio/mpeg',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: speechReadyNarrationText,
          model_id: getElevenLabsModelId(),
          output_format: 'mp3_44100_128',
          voice_settings: {
            stability: 0.46,
            similarity_boost: 0.76,
            style: 0.28,
            speed: 0.96,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(errorText || 'Failed to generate narration');
    }

    const audioBuffer = await response.arrayBuffer();

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Narration error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to generate narration',
      },
      { status: 500 }
    );
  }
}
