import { NextRequest, NextResponse } from 'next/server';
import {
  getElevenLabsApiKey,
  getElevenLabsModelId,
  resolveNarrationVoice,
  type NarrationPreference,
} from '@/lib/elevenlabs';
import { requireApiUser } from '@/lib/auth-server';
import {
  buildNarrationText,
  cleanNarrationScript,
  normalizeNarrationText,
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
          content?: string;
          script?: string;
          voicePreference?: NarrationPreference;
        }
      | null;

    const content = typeof body?.content === 'string' ? body.content : '';
    const providedScript =
      typeof body?.script === 'string' && body.script.trim()
        ? normalizeNarrationText(body.script)
        : '';
    const voicePreference: NarrationPreference =
      body?.voicePreference === 'male' ? 'male' : 'female';

    const narrationText = providedScript || buildNarrationText(content);
    if (!narrationText) {
      return NextResponse.json(
        { error: 'There is no story content available to narrate yet.' },
        { status: 400 }
      );
    }

    const cleanedNarrationText = providedScript
      ? providedScript
      : await cleanNarrationScript(narrationText);

    const { voiceId } = await resolveNarrationVoice(voicePreference);

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
          text: cleanedNarrationText,
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
