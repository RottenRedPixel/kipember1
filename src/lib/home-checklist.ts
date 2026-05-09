import { prisma } from '@/lib/db';
import type { HomeActivityThumb } from '@/lib/home-activity';

export type ChecklistItem = {
  emberId: string;
  emberTitle: string | null;
  thumb: HomeActivityThumb;
  slug: string;
  label: string;
  deepLink: string;
};

const STEP_META: Record<string, { label: string }> = {
  title:          { label: 'Add a title' },
  snapshot:       { label: 'Generate a snapshot' },
  contributors:   { label: 'Invite a contributor' },
  'time-place':   { label: 'Set time & place' },
  'image-analysis': { label: 'Run image analysis' },
};

export async function getEmberChecklist(userId: string): Promise<ChecklistItem[]> {
  const embers = await prisma.ember.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      mediaType: true,
      filename: true,
      posterFilename: true,
      snapshot: { select: { id: true } },
      noContributors: true,
      analysis: { select: { status: true, capturedAt: true, latitude: true } },
      contributors: {
        where: { NOT: { userId: userId } },
        select: { id: true },
        take: 1,
      },
    },
  });

  const items: ChecklistItem[] = [];

  for (const ember of embers) {
    const thumb: HomeActivityThumb = {
      mediaType: ember.mediaType,
      filename: ember.filename,
      posterFilename: ember.posterFilename,
    };
    const deepLink = `/ember/${ember.id}?m=wiki`;

    const push = (slug: string) => {
      const meta = STEP_META[slug];
      if (meta) items.push({ emberId: ember.id, emberTitle: ember.title, thumb, slug, label: meta.label, deepLink });
    };

    if (!ember.title) push('title');
    if (!ember.snapshot) push('snapshot');
    if (ember.contributors.length === 0 && !ember.noContributors) push('contributors');
    if (!ember.analysis?.capturedAt && !ember.analysis?.latitude) push('time-place');
    if (ember.analysis?.status && ember.analysis.status !== 'ready') push('image-analysis');
  }

  return items;
}
