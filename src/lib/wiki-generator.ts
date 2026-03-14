import { prisma } from './db';
import { ensureImageAnalysisForImage } from './image-analysis';
import { generateWiki } from './claude';

type ParsedEntity = {
  label: string;
  details: string;
  confidence: string;
};

function parseJsonArray<T>(value: string | null): T[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

async function fetchImageForWiki(imageId: string) {
  return prisma.image.findUnique({
    where: { id: imageId },
    include: {
      analysis: true,
      contributors: {
        include: {
          conversation: {
            where: { status: 'completed' },
            include: {
              responses: true,
            },
          },
        },
      },
    },
  });
}

export async function generateWikiForImage(imageId: string): Promise<string> {
  await ensureImageAnalysisForImage(imageId).catch((error) => {
    console.error('Image analysis failed during wiki generation:', error);
  });

  const image = await fetchImageForWiki(imageId);

  if (!image) {
    throw new Error('Image not found');
  }

  // Collect all responses from completed conversations
  const allResponses: {
    contributorName: string;
    questionType: string;
    question: string;
    answer: string;
  }[] = [];

  for (const contributor of image.contributors) {
    if (contributor.conversation?.responses) {
      for (const response of contributor.conversation.responses) {
        allResponses.push({
          contributorName: contributor.name || 'Anonymous',
          questionType: response.questionType,
          question: response.question,
          answer: response.answer,
        });
      }
    }
  }

  if (!image.analysis && allResponses.length === 0 && !image.description?.trim()) {
    throw new Error('No image analysis or completed interviews available to generate a wiki');
  }

  const wikiContent = await generateWiki({
    imageTitle: image.originalName,
    imageDescription: image.description,
    analysis: image.analysis
      ? {
          status: image.analysis.status,
          errorMessage: image.analysis.errorMessage,
          summary: image.analysis.summary,
          visualDescription: image.analysis.visualDescription,
          metadataSummary: image.analysis.metadataSummary,
          mood: image.analysis.mood,
          capturedAt: image.analysis.capturedAt?.toISOString() || null,
          latitude: image.analysis.latitude,
          longitude: image.analysis.longitude,
          cameraMake: image.analysis.cameraMake,
          cameraModel: image.analysis.cameraModel,
          lensModel: image.analysis.lensModel,
          people: parseJsonArray<ParsedEntity>(image.analysis.peopleJson),
          places: parseJsonArray<ParsedEntity>(image.analysis.placesJson),
          things: parseJsonArray<ParsedEntity>(image.analysis.thingsJson),
          activities: parseJsonArray<string>(image.analysis.activitiesJson),
          visibleText: parseJsonArray<string>(image.analysis.visibleTextJson),
          keywords: parseJsonArray<string>(image.analysis.keywordsJson),
          openQuestions: parseJsonArray<string>(image.analysis.openQuestionsJson),
        }
      : null,
    responses: allResponses,
  });

  // Save or update wiki
  const existingWiki = await prisma.wiki.findUnique({
    where: { imageId },
  });

  if (existingWiki) {
    await prisma.wiki.update({
      where: { id: existingWiki.id },
      data: {
        content: wikiContent,
        version: existingWiki.version + 1,
      },
    });
  } else {
    await prisma.wiki.create({
      data: {
        imageId,
        content: wikiContent,
      },
    });
  }

  return wikiContent;
}
