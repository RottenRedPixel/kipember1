import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Public read of the tracker config (enabled steps + completion rules).
// Drives the wiki's progress bar — disabled steps drop out and the
// owner / contributor thresholds determine when each step is "complete".
// Admin writes go through /api/admin/system/progress-tracker.
export async function GET() {
  const steps = await prisma.progressTrackerStep.findMany({
    where: { enabled: true },
    orderBy: { position: 'asc' },
    select: {
      slug: true,
      ownerRequired: true,
      contributorMin: true,
    },
  });
  return NextResponse.json({ steps });
}
