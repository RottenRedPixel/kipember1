import { prisma } from '../db';
import { getUserDisplayName } from '../user-name';
import type { ContextRetriever } from './index';

/**
 * Simple context retriever that concatenates all content
 * Good for small to medium amounts of content that fit in context window
 */
export class SimpleRetriever implements ContextRetriever {
  /**
   * No-op for simple retriever - content is already in database
   */
  async indexContent(): Promise<void> {
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
        emberContributors: {
          include: {
            contributor: true,
            emberSession: {
              include: {
                messages: {
                  where: { role: 'user', questionType: { not: null } },
                },
              },
            },
            voiceCalls: {
              include: {
                emberSession: {
                  include: {
                    messages: {
                      where: { role: 'user', questionType: { not: null } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!image) {
      return '';
    }

    let voiceCallClips: Array<{
      title: string;
      quote: string;
      significance: string | null;
      emberContributor: {
        contributor: {
          name: string | null;
          email: string | null;
          phoneNumber: string | null;
          user: {
            firstName: string | null;
            lastName: string | null;
            email: string;
          } | null;
        };
      };
    }> = [];

    try {
      voiceCallClips = await prisma.voiceCallClip.findMany({
        where: { imageId },
        orderBy: [{ createdAt: 'asc' }, { sortOrder: 'asc' }],
        select: {
          title: true,
          quote: true,
          significance: true,
          emberContributor: {
            select: {
              contributor: {
                select: {
                  name: true,
                  email: true,
                  phoneNumber: true,
                  user: {
                    select: {
                      firstName: true,
                      lastName: true,
                      email: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
    } catch (error) {
      console.error('SimpleRetriever voice clip load failed:', error);
    }

    // Build context sections
    const sections: string[] = [];

    // Add wiki if available
    if (wiki?.content) {
      sections.push('=== WIKI CONTENT ===\n' + wiki.content);
    }

    // Add raw responses
    const responses: string[] = [];
    for (const ec of image.emberContributors) {
      const contributorMessages = [
        ...(ec.emberSession?.messages || []),
        ...ec.voiceCalls.flatMap((call) => call.emberSession?.messages || []),
      ];

      for (const message of contributorMessages) {
        responses.push(
          `[${ec.contributor.name || 'Anonymous'}] ${(message.questionType || '').toUpperCase()}\n` +
            `Q: ${message.question || message.questionType || ''}\n` +
            `A: ${message.content}`
        );
      }
    }

    if (responses.length > 0) {
      sections.push('=== CONTRIBUTOR RESPONSES ===\n' + responses.join('\n\n'));
    }

    const voiceClips: string[] = [];
    for (const clip of voiceCallClips) {
      const c = clip.emberContributor.contributor;
      const contributorName =
        c.name ||
        getUserDisplayName(c.user) ||
        c.email ||
        c.phoneNumber ||
        'Contributor';

      voiceClips.push(
        `[${contributorName}] ${clip.title}\n` +
          `Quote: "${clip.quote}"` +
          (clip.significance ? `\nWhy it matters: ${clip.significance}` : '')
      );
    }

    if (voiceClips.length > 0) {
      sections.push('=== IMPORTANT VOICE CLIPS ===\n' + voiceClips.join('\n\n'));
    }

    const fullContext = sections.join('\n\n');
    if (!_limit || fullContext.length <= _limit) {
      return fullContext;
    }

    const limitedSections: string[] = [];
    let remaining = _limit;

    for (const section of sections) {
      if (remaining <= 0) {
        break;
      }

      const separator = limitedSections.length > 0 ? '\n\n' : '';
      const availableForSection = remaining - separator.length;
      if (availableForSection <= 0) {
        break;
      }

      if (section.length <= availableForSection) {
        limitedSections.push(section);
        remaining -= separator.length + section.length;
        continue;
      }

      if (availableForSection > 32) {
        limitedSections.push(`${section.slice(0, availableForSection - 3).trimEnd()}...`);
      }
      break;
    }

    return limitedSections.join('\n\n');
  }
}
