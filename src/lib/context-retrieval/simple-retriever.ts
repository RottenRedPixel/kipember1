import { prisma } from '../db';
import type { ContextRetriever, ContextContent } from './index';

/**
 * Simple context retriever that concatenates all content
 * Good for small to medium amounts of content that fit in context window
 */
export class SimpleRetriever implements ContextRetriever {
  /**
   * No-op for simple retriever - content is already in database
   */
  async indexContent(_imageId: string, _content: ContextContent[]): Promise<void> {
    // Content is stored in database, no additional indexing needed
    return;
  }

  /**
   * Retrieve all relevant context for an image
   * Concatenates wiki content and all response data
   */
  async retrieve(imageId: string, _query: string, _limit?: number): Promise<string> {
    // Fetch wiki
    const wiki = await prisma.wiki.findUnique({
      where: { imageId },
    });

    // Fetch all responses from completed conversations
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
      return '';
    }

    // Build context sections
    const sections: string[] = [];

    // Add wiki if available
    if (wiki?.content) {
      sections.push('=== WIKI CONTENT ===\n' + wiki.content);
    }

    // Add raw responses
    const responses: string[] = [];
    for (const contributor of image.contributors) {
      if (contributor.conversation?.responses) {
        for (const response of contributor.conversation.responses) {
          responses.push(
            `[${contributor.name || 'Anonymous'}] ${response.questionType.toUpperCase()}\n` +
              `Q: ${response.question}\n` +
              `A: ${response.answer}`
          );
        }
      }
    }

    if (responses.length > 0) {
      sections.push('=== CONTRIBUTOR RESPONSES ===\n' + responses.join('\n\n'));
    }

    return sections.join('\n\n');
  }
}
