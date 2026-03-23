import { NextRequest, NextResponse } from 'next/server';
import {
  getElevenLabsApiKey,
  getElevenLabsModelId,
  resolveNarrationVoice,
  type NarrationPreference,
} from '@/lib/elevenlabs';
import { requireApiUser } from '@/lib/auth-server';
import { getNarrationCleanupModel, getOpenAIClient } from '@/lib/openai';

function stripInlineMarkdown(value: string) {
  return value
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/[`*_>~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeNarrationText(value: string) {
  return stripInlineMarkdown(value)
    .normalize('NFKC')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—−]/g, '-')
    .replace(/[…]/g, '...')
    .replace(/[•]/g, ' ')
    .replace(/â€™|â€œ|â€|â€“|â€”/g, ' ')
    .replace(/\b(?:vs\.?|v\.)\b/gi, ' versus ')
    .replace(/\s+/g, ' ')
    .trim();
}

function shouldSkipHeading(heading: string) {
  const normalized = heading.trim().toLowerCase();

  return (
    normalized.includes('metadata') ||
    normalized.includes('open question') ||
    normalized.includes('search tag') ||
    normalized.includes('timeline') ||
    normalized.includes('scene insight') ||
    normalized.includes('technical') ||
    normalized.includes('sports snapshot') ||
    normalized.includes('people') ||
    normalized.includes('location')
  );
}

function looksLikeMetadataParagraph(paragraph: string) {
  const normalized = paragraph.toLowerCase();

  const metadataTerms = [
    'camera',
    'lens',
    'resolution',
    'gps',
    'latitude',
    'longitude',
    'iso ',
    'f/',
    'timestamp',
    'captured:',
    'captured ',
    'updated ',
    'version ',
    'utc',
    'exposure',
    'focal length',
    'photo metadata',
    'technical',
    'open question',
    'search tag',
    'scene insight',
  ];

  if (metadataTerms.some((term) => normalized.includes(term))) {
    return true;
  }

  if (/\b\d{1,2}:\d{2}(?::\d{2})?\b/.test(paragraph)) {
    return true;
  }

  if (/\b-?\d{1,3}\.\d{3,}\s*,\s*-?\d{1,3}\.\d{3,}\b/.test(paragraph)) {
    return true;
  }

  const digitCount = (paragraph.match(/\d/g) || []).length;
  if (digitCount >= 10) {
    return true;
  }

  return false;
}

function buildNarrationText(markdown: string) {
  const sections: Array<{ heading: string | null; lines: string[] }> = [];
  let currentSection: { heading: string | null; lines: string[] } = {
    heading: null,
    lines: [],
  };

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      if (currentSection.lines.length > 0) {
        currentSection.lines.push('');
      }
      continue;
    }

    const headingMatch = line.match(/^#{1,6}\s+(.*)$/);
    if (headingMatch) {
      if (currentSection.lines.length > 0 || currentSection.heading) {
        sections.push(currentSection);
      }
      currentSection = {
        heading: headingMatch[1].trim(),
        lines: [],
      };
      continue;
    }

    const cleanedLine = normalizeNarrationText(
      line.replace(/^\s*[-*+]\s+/, '').replace(/^\s*\d+\.\s+/, '')
    );

    if (cleanedLine) {
      currentSection.lines.push(cleanedLine);
    }
  }

  if (currentSection.lines.length > 0 || currentSection.heading) {
    sections.push(currentSection);
  }

  const preferredHeadings = [
    'story',
    'story / backstory',
    'backstory',
    'significance',
    'quotes',
    'ember story',
  ];

  const preferredSections = sections.filter(
    (section) =>
      section.heading &&
      preferredHeadings.some((heading) => section.heading?.toLowerCase().includes(heading))
  );

  const candidateSections =
    preferredSections.length > 0
      ? preferredSections
      : sections.filter((section) => !section.heading || !shouldSkipHeading(section.heading));

  const paragraphs = candidateSections
    .flatMap((section) =>
      section.lines
        .join('\n')
        .split(/\n{2,}/)
        .map((paragraph) => normalizeNarrationText(paragraph))
        .filter((paragraph) => Boolean(paragraph) && !looksLikeMetadataParagraph(paragraph))
    )
    .slice(0, 6);

  return paragraphs.join('\n\n').trim();
}

async function cleanNarrationScript(narrationText: string) {
  if (!narrationText) {
    return narrationText;
  }

  try {
    const openai = getOpenAIClient();
    const response = await openai.responses.create({
      model: getNarrationCleanupModel(),
      input: [
        {
          role: 'developer',
          type: 'message',
          content: [
            {
              type: 'input_text',
              text: `You rewrite Ember memory text into a single spoken narration script.

Rules:
- Keep only the strongest story details.
- Remove repetition across categories or sections.
- Do not add facts.
- Do not add headings, labels, bullets, metadata, timestamps, coordinates, camera details, or open questions.
- Keep it in plain natural English for text-to-speech.
- Make it sound like a short human story being read aloud.
- Preserve names and factual details that matter to the memory.
- Output plain text only.`,
            },
          ],
        },
        {
          role: 'user',
          type: 'message',
          content: [
            {
              type: 'input_text',
              text: `Turn this into one clean spoken script for narration:\n\n${narrationText}`,
            },
          ],
        },
      ],
      text: {
        verbosity: 'low',
      },
    });

    const cleaned = normalizeNarrationText(response.output_text || '');
    return cleaned || narrationText;
  } catch (error) {
    console.error('Narration cleanup fallback:', error);
    return narrationText;
  }
}

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
          voicePreference?: NarrationPreference;
        }
      | null;

    const content = typeof body?.content === 'string' ? body.content : '';
    const voicePreference: NarrationPreference =
      body?.voicePreference === 'male' ? 'male' : 'female';

    const narrationText = buildNarrationText(content);
    if (!narrationText) {
      return NextResponse.json(
        { error: 'There is no story content available to narrate yet.' },
        { status: 400 }
      );
    }

    const cleanedNarrationText = await cleanNarrationScript(narrationText);

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
