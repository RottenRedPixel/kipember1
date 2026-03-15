import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { chat } from '@/lib/claude';
import { prisma } from '@/lib/db';
import { getKidsImageModel, getOpenAIClient } from '@/lib/openai';

const PANEL_COUNT = 5;
const PANEL_SIZE = '1536x1024';
const PANEL_OUTPUT_FORMAT = 'webp';

type StoryboardPanel = {
  title: string;
  caption: string;
  scene: string;
  mood: string;
  camera: string;
};

type Storyboard = {
  title: string;
  subtitle: string;
  summary: string;
  visualStyle: string;
  panels: StoryboardPanel[];
};

function extractJsonObject(text: string): string {
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    throw new Error('Expected a JSON object in storyboard response');
  }

  return text.slice(firstBrace, lastBrace + 1);
}

function normalizeStoryboard(raw: Partial<Storyboard>): Storyboard {
  const panels = Array.isArray(raw.panels)
    ? raw.panels.flatMap((panel) => {
        if (
          !panel ||
          typeof panel !== 'object' ||
          typeof panel.title !== 'string' ||
          typeof panel.caption !== 'string' ||
          typeof panel.scene !== 'string'
        ) {
          return [];
        }

        return [
          {
            title: panel.title.trim(),
            caption: panel.caption.trim(),
            scene: panel.scene.trim(),
            mood:
              typeof panel.mood === 'string' && panel.mood.trim()
                ? panel.mood.trim()
                : 'warm and adventurous',
            camera:
              typeof panel.camera === 'string' && panel.camera.trim()
                ? panel.camera.trim()
                : 'cinematic illustrated storybook frame',
          },
        ];
      })
    : [];

  if (panels.length < PANEL_COUNT) {
    throw new Error('Storyboard did not return enough panels');
  }

  return {
    title:
      typeof raw.title === 'string' && raw.title.trim()
        ? raw.title.trim()
        : 'Memory Adventure',
    subtitle:
      typeof raw.subtitle === 'string' && raw.subtitle.trim()
        ? raw.subtitle.trim()
        : 'A playful family storybook',
    summary:
      typeof raw.summary === 'string' && raw.summary.trim()
        ? raw.summary.trim()
        : 'A bright retelling of a treasured memory for younger readers.',
    visualStyle:
      typeof raw.visualStyle === 'string' && raw.visualStyle.trim()
        ? raw.visualStyle.trim()
        : 'Original 3D toy-adventure storybook world with expressive characters and warm cinematic lighting.',
    panels: panels.slice(0, PANEL_COUNT),
  };
}

async function buildStoryboardFromWiki({
  imageTitle,
  imageDescription,
  wikiContent,
}: {
  imageTitle: string;
  imageDescription: string | null;
  wikiContent: string;
}): Promise<Storyboard> {
  const systemPrompt = `Turn a memory wiki into a five-panel kids flipbook storyboard.

Return ONLY valid JSON with this exact shape:
{
  "title": "short title",
  "subtitle": "short subtitle",
  "summary": "1-2 sentence summary",
  "visualStyle": "shared recurring character and world description",
  "panels": [
    {
      "title": "panel title",
      "caption": "1-2 sentence child-friendly caption",
      "scene": "visual scene description with characters, action, setting, and continuity cues",
      "mood": "emotional tone",
      "camera": "shot framing"
    }
  ]
}

Rules:
- Exactly 5 panels.
- Make it suitable for kids while staying faithful to the underlying memory.
- Keep the emotional truth, but soften grief, conflict, or adult themes into warmth and wonder.
- Keep recurring characters visually consistent across all panels.
- Describe an original toy-adventure 3D animated look without naming existing movies, brands, or copyrighted characters.
- No on-image text, speech bubbles, logos, or watermarks.
- Preserve real-world specifics like season, location, relationships, and key events when known.
- Each caption should feel like a page in a flipbook a child would enjoy.`;

  const response = await chat(systemPrompt, [
    {
      role: 'user',
      content: `Image title: ${imageTitle}
Image description: ${imageDescription || 'None provided'}

Wiki content:
${wikiContent}`,
    },
  ]);

  return normalizeStoryboard(
    JSON.parse(extractJsonObject(response)) as Partial<Storyboard>
  );
}

function buildPanelPrompt({
  imageTitle,
  imageDescription,
  visualStyle,
  panel,
}: {
  imageTitle: string;
  imageDescription: string | null;
  visualStyle: string;
  panel: StoryboardPanel;
}): string {
  const contextLine = imageDescription
    ? `Source memory context: ${imageTitle}. ${imageDescription}`
    : `Source memory context: ${imageTitle}.`;

  return [
    'Create a single illustrated kids flipbook panel.',
    contextLine,
    'Look: original 3D toy-adventure animated feature aesthetic, handcrafted miniature environments, expressive original toy-like characters, polished cinematic lighting, soft depth of field, playful motion energy, family-friendly tone.',
    `Shared visual continuity: ${visualStyle}`,
    `Scene: ${panel.scene}`,
    `Mood: ${panel.mood}`,
    `Camera: ${panel.camera}`,
    'Important constraints: no text, no logos, no watermark, no split panels, no collage, no character sheets, no direct references to existing films or copyrighted characters.',
  ].join('\n');
}

async function renderPanelImage(prompt: string): Promise<Buffer> {
  const response = await getOpenAIClient().images.generate({
    model: getKidsImageModel(),
    prompt,
    size: PANEL_SIZE,
    quality: 'medium',
    output_format: PANEL_OUTPUT_FORMAT,
    moderation: 'auto',
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error('OpenAI image response did not include image data');
  }

  return Buffer.from(b64, 'base64');
}

async function savePanelImage(buffer: Buffer): Promise<string> {
  const uploadsDir = process.env.UPLOADS_DIR || join(process.cwd(), 'public', 'uploads');
  await mkdir(uploadsDir, { recursive: true });

  const filename = `${randomUUID()}.${PANEL_OUTPUT_FORMAT}`;
  await writeFile(join(uploadsDir, filename), buffer);
  return filename;
}

export async function getKidsStory(imageId: string) {
  return prisma.kidsStory.findUnique({
    where: { imageId },
    include: {
      panels: {
        orderBy: { position: 'asc' },
      },
      image: {
        select: {
          id: true,
          filename: true,
          mediaType: true,
          posterFilename: true,
          originalName: true,
          description: true,
        },
      },
    },
  });
}

export async function generateKidsStoryForImage(imageId: string) {
  const image = await prisma.image.findUnique({
    where: { id: imageId },
    include: {
      wiki: true,
      kidsStory: true,
    },
  });

  if (!image) {
    throw new Error('Image not found');
  }

  if (!image.wiki?.content) {
    throw new Error('Generate the wiki before using Kids Mode');
  }

  const existingStory = image.kidsStory;

  const workingStory = existingStory
    ? await prisma.kidsStory.update({
        where: { id: existingStory.id },
        data: {
          status: 'generating',
          errorMessage: null,
        },
      })
    : await prisma.kidsStory.create({
        data: {
          imageId,
          title: 'Kids Mode Story',
          status: 'generating',
        },
      });

  try {
    const storyboard = await buildStoryboardFromWiki({
      imageTitle: image.originalName,
      imageDescription: image.description,
      wikiContent: image.wiki.content,
    });

    const renderedPanels = await Promise.all(
      storyboard.panels.map(async (panel, index) => {
        const prompt = buildPanelPrompt({
          imageTitle: image.originalName,
          imageDescription: image.description,
          visualStyle: storyboard.visualStyle,
          panel,
        });

        const imageBuffer = await renderPanelImage(prompt);
        const filename = await savePanelImage(imageBuffer);

        return {
          position: index + 1,
          title: panel.title,
          caption: panel.caption,
          imagePrompt: prompt,
          filename,
        };
      })
    );

    await prisma.$transaction(async (tx) => {
      await tx.kidsStoryPanel.deleteMany({
        where: { storyId: workingStory.id },
      });

      await tx.kidsStory.update({
        where: { id: workingStory.id },
        data: {
          title: storyboard.title,
          subtitle: storyboard.subtitle,
          summary: storyboard.summary,
          visualStyle: storyboard.visualStyle,
          status: 'ready',
          errorMessage: null,
          version: existingStory ? existingStory.version + 1 : 1,
        },
      });

      await tx.kidsStoryPanel.createMany({
        data: renderedPanels.map((panel) => ({
          storyId: workingStory.id,
          position: panel.position,
          title: panel.title,
          caption: panel.caption,
          imagePrompt: panel.imagePrompt,
          filename: panel.filename,
        })),
      });
    });

    const story = await getKidsStory(imageId);
    if (!story) {
      throw new Error('Failed to load generated kids story');
    }

    return story;
  } catch (error) {
    await prisma.kidsStory.update({
      where: { id: workingStory.id },
      data: {
        status: 'error',
        errorMessage:
          error instanceof Error ? error.message : 'Failed to generate kids story',
      },
    });

    throw error;
  }
}
