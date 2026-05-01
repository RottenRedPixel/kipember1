import Link from 'next/link';
import { notFound } from 'next/navigation';
import MediaPreview from '@/components/MediaPreview';
import StoryCircleThread from '@/components/StoryCircleThread';
import { requirePageUser } from '@/lib/auth-server';
import { getEmberAccessType } from '@/lib/ember-access';
import { getStoryCircleForImage } from '@/lib/story-circle';

export default async function StoryCirclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requirePageUser();
  const accessType = await getEmberAccessType(user.id, id);

  if (!accessType) {
    notFound();
  }

  const storyCircle = await getStoryCircleForImage(id);

  if (!storyCircle) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <section className="mb-6 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="ember-panel-strong rounded-[2.5rem] p-6 sm:p-8">
          <Link
            href={`/image/${id}/play`}
            className="text-sm font-medium text-[var(--ember-muted)] hover:text-[var(--ember-text)]"
          >
            {'<- Back to Play Ember'}
          </Link>

          <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start">
            <div className="ember-photo-shell relative h-44 w-full border border-[rgba(20,20,20,0.06)] bg-white lg:h-48 lg:w-48">
              <MediaPreview
                mediaType={storyCircle.image.mediaType}
                filename={storyCircle.image.filename}
                posterFilename={storyCircle.image.posterFilename}
                originalName={storyCircle.image.originalName}
                usePosterForVideo
                controls={storyCircle.image.mediaType === 'VIDEO'}
                className={`h-full w-full ${
                  storyCircle.image.mediaType === 'VIDEO'
                    ? 'object-contain bg-[#a8ba91]'
                    : 'object-cover'
                }`}
              />
            </div>

            <div className="min-w-0 flex-1">
              <p className="ember-eyebrow">Story circle</p>
              <h1 className="ember-heading mt-4 text-4xl text-[var(--ember-text)]">
                Running memory thread
              </h1>
              <p className="ember-copy mt-4 max-w-3xl text-sm">
                {storyCircle.image.description ||
                  'A full timeline of how contributors interacted with this Ember across web, SMS, and voice.'}
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                <span className="ember-chip">{storyCircle.entryCount} thread entries</span>
                <span className="ember-chip">{storyCircle.contributorCount} contributors</span>
                <span className="ember-chip">
                  {storyCircle.image.mediaType === 'VIDEO' ? 'Video Ember' : 'Photo Ember'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="ember-panel rounded-[2.25rem] p-6">
          <p className="ember-eyebrow">Use this view</p>
          <h2 className="ember-heading mt-4 text-3xl text-[var(--ember-text)]">
            See how the record evolved
          </h2>
          <p className="ember-copy mt-3 text-sm">
            Story Circle shows the raw conversational trail behind the wiki, including
            what Ember asked, how people answered, and where voice or text was used.
          </p>

          <div className="mt-6 grid gap-3">
            <Link href={`/image/${id}`} className="ember-button-secondary">
              Open Ember workspace
            </Link>
            <Link href={`/image/${id}/chat`} className="ember-button-secondary">
              Ask Ember
            </Link>
            <Link href={`/image/${id}/play`} className="ember-button-secondary">
              Back to Play Ember
            </Link>
          </div>
        </div>
      </section>

      <StoryCircleThread entries={storyCircle.entries} />
    </div>
  );
}
