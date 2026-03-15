import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import StoryCircleThread from '@/components/StoryCircleThread';
import { requirePageUser } from '@/lib/auth-server';
import { getImageAccessType } from '@/lib/ember-access';
import { getStoryCircleForImage } from '@/lib/story-circle';
import { getPreviewMediaUrl } from '@/lib/media';

export default async function StoryCirclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requirePageUser();
  const accessType = await getImageAccessType(user.id, id);

  if (!accessType) {
    notFound();
  }

  const storyCircle = await getStoryCircleForImage(id);

  if (!storyCircle) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_45%,#fff7ed_100%)]">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Link
              href={`/image/${id}/wiki`}
              className="inline-flex items-center text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
            >
              &larr; Back to Wiki
            </Link>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Story Circle
              </p>
              <h1 className="text-3xl font-semibold text-slate-950">
                Running memory thread
              </h1>
            </div>
          </div>

          <Link
            href={`/image/${id}`}
            className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-400 hover:text-slate-950"
          >
            Open Image
          </Link>
        </div>

        <div className="mb-8 rounded-[2rem] border border-white/70 bg-white/75 p-5 shadow-sm backdrop-blur sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-100">
              <Image
                src={getPreviewMediaUrl({
                  mediaType: storyCircle.image.mediaType,
                  filename: storyCircle.image.filename,
                  posterFilename: storyCircle.image.posterFilename,
                })}
                alt={storyCircle.image.originalName}
                fill
                unoptimized
                className="object-cover"
              />
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-semibold text-slate-950">
                {storyCircle.image.originalName}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                {storyCircle.image.description ||
                  'A full running feed of how contributors interacted with this photo across web, text, and voice.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:min-w-[220px]">
              <div className="rounded-2xl bg-slate-950 px-4 py-3 text-white">
                <div className="text-2xl font-semibold">{storyCircle.entryCount}</div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-300">
                  Thread Entries
                </div>
              </div>
              <div className="rounded-2xl bg-emerald-500 px-4 py-3 text-white">
                <div className="text-2xl font-semibold">{storyCircle.contributorCount}</div>
                <div className="text-xs uppercase tracking-[0.18em] text-emerald-100">
                  Contributors
                </div>
              </div>
            </div>
          </div>
        </div>

        <StoryCircleThread entries={storyCircle.entries} />
      </div>
    </div>
  );
}
