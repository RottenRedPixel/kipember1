import { prisma } from './db';
import { generateWiki } from './claude';

export async function generateWikiForImage(imageId: string): Promise<string> {
  // Get image with all completed conversation responses
  const image = await prisma.image.findUnique({
    where: { id: imageId },
    include: {
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

  if (allResponses.length === 0) {
    throw new Error('No completed interviews to generate wiki from');
  }

  // Generate wiki content using Claude
  const wikiContent = await generateWiki(
    image.description || image.originalName,
    allResponses
  );

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
