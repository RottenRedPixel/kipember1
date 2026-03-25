'use client';

import { useState } from 'react';
import MediaPreview from '@/components/MediaPreview';

type MediaType = 'IMAGE' | 'VIDEO';
type ActivityTab = 'wiki' | 'media';

type ContributorRecord = {
  id: string;
  name: string | null;
  email: string | null;
  phoneNumber: string | null;
  inviteSent: boolean;
  user: {
    name: string | null;
  } | null;
};

type TagRecord = {
  id: string;
  label: string;
  email: string | null;
  phoneNumber: string | null;
};

type AttachmentRecord = {
  id: string;
  filename: string;
  mediaType: MediaType;
  posterFilename: string | null;
  originalName: string;
  description: string | null;
};

type AnalysisRecord = {
  status: string;
  summary: string | null;
  visualDescription: string | null;
  metadataSummary: string | null;
  capturedAt: string | null;
  latitude: number | null;
  longitude: number | null;
  cameraMake: string | null;
  cameraModel: string | null;
  lensModel: string | null;
  updatedAt: string;
} | null;

type MessageRecord = {
  id: string;
  contributorLabel: string;
  role: string;
  source: string;
  content: string;
  createdAt: string;
};

function CompletionBadge({
  complete,
  label,
}: {
  complete: boolean;
  label?: string;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
        complete
          ? 'bg-emerald-100 text-emerald-700'
          : 'bg-[var(--ember-soft)] text-[var(--ember-muted)]'
      }`}
    >
      {label || (complete ? 'Complete' : 'Not Complete')}
    </span>
  );
}

function ActivitySection({
  title,
  complete,
  children,
}: {
  title: string;
  complete: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xl font-semibold tracking-[-0.03em] text-[var(--ember-text)]">{title}</h3>
        <CompletionBadge complete={complete} />
      </div>
      <div className="rounded-[1.5rem] border border-[rgba(20,20,20,0.08)] bg-[var(--ember-soft)] px-4 py-4">
        {children}
      </div>
    </section>
  );
}

export default function EmberActivityView({
  emberTitle,
  originalName,
  description,
  createdAt,
  titleSaved,
  mediaType,
  filename,
  posterFilename,
  contributors,
  tags,
  attachments,
  analysis,
  messages,
}: {
  emberTitle: string;
  originalName: string;
  description: string | null;
  createdAt: string;
  titleSaved: boolean;
  mediaType: MediaType;
  filename: string;
  posterFilename: string | null;
  contributors: ContributorRecord[];
  tags: TagRecord[];
  attachments: AttachmentRecord[];
  analysis: AnalysisRecord;
  messages: MessageRecord[];
}) {
  const [tab, setTab] = useState<ActivityTab>('wiki');

  const titleComplete = Boolean(emberTitle.trim());
  const captionComplete = Boolean(description?.trim());
  const contributorsComplete = contributors.length > 0;
  const taggedPeopleComplete = tags.length > 0;
  const supportingMediaComplete = attachments.length > 0;
  const locationComplete = analysis?.latitude !== null && analysis?.longitude !== null;
  const timeComplete = Boolean(analysis?.capturedAt || createdAt);
  const analysisComplete = Boolean(analysis?.visualDescription?.trim() || analysis?.summary?.trim());

  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-full border border-[var(--ember-line-strong)] bg-white p-1">
        {(['wiki', 'media'] as ActivityTab[]).map((nextTab) => (
          <button
            key={nextTab}
            type="button"
            onClick={() => setTab(nextTab)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              tab === nextTab
                ? 'bg-[var(--ember-soft)] text-[var(--ember-orange-deep)]'
                : 'text-[var(--ember-muted)]'
            }`}
          >
            {nextTab === 'wiki' ? 'Wiki' : 'Media'}
          </button>
        ))}
      </div>

      {tab === 'wiki' ? (
        <div className="space-y-6">
          <ActivitySection title="Title" complete={titleComplete}>
            <div className="text-lg font-semibold text-[var(--ember-text)]">{emberTitle}</div>
            <div className="mt-2 text-sm text-[var(--ember-muted)]">
              {titleSaved ? 'Source: saved title' : 'Source: generated title'}
            </div>
          </ActivitySection>

          <ActivitySection title="Caption" complete={captionComplete}>
            <div className="text-sm leading-7 text-[var(--ember-text)]">
              {description?.trim() || 'No caption has been added yet.'}
            </div>
          </ActivitySection>

          <ActivitySection title="Contributors" complete={contributorsComplete}>
            <div className="space-y-3">
              {contributors.length === 0 ? (
                <div className="text-sm text-[var(--ember-muted)]">No contributors yet.</div>
              ) : (
                contributors.map((contributor, index) => {
                  const contributorLabel =
                    contributor.name ||
                    contributor.user?.name ||
                    contributor.email ||
                    contributor.phoneNumber ||
                    'Contributor';

                  return (
                    <div
                      key={contributor.id}
                      className={`rounded-[1.2rem] border px-4 py-4 ${
                        index === 0 ? 'border-amber-200 bg-amber-50' : 'border-sky-100 bg-white'
                      }`}
                    >
                      <div className="text-base font-semibold text-[var(--ember-text)]">
                        {contributorLabel}
                      </div>
                      <div className="mt-2 text-sm text-[var(--ember-muted)]">
                        {index === 0 ? 'Owner' : contributor.inviteSent ? 'Invited contributor' : 'Contributor'}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ActivitySection>

          <ActivitySection title="Story Conversation" complete={messages.length > 0}>
            <div className="space-y-3">
              {messages.length === 0 ? (
                <div className="text-sm text-[var(--ember-muted)]">No contributor messages yet.</div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`rounded-[1.2rem] border px-4 py-4 ${
                      message.role === 'assistant'
                        ? 'border-fuchsia-100 bg-fuchsia-50'
                        : message.source === 'voice'
                          ? 'border-emerald-100 bg-emerald-50'
                          : 'border-sky-100 bg-sky-50'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--ember-muted)]">
                      <span className="font-medium text-[var(--ember-text)]">
                        {message.role === 'assistant' ? 'Ember AI' : message.contributorLabel}
                      </span>
                      <span>{new Date(message.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-[var(--ember-text)]">
                      {message.content}
                    </p>
                    <div className="mt-3 text-xs font-medium text-[var(--ember-muted)]">
                      {message.source === 'voice'
                        ? 'Audio message'
                        : message.source === 'sms'
                          ? 'Text message'
                          : 'Web response'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ActivitySection>
        </div>
      ) : (
        <div className="space-y-6">
          <ActivitySection title="Tagged People" complete={taggedPeopleComplete}>
            <div className="space-y-3">
              {tags.length === 0 ? (
                <div className="text-sm text-[var(--ember-muted)]">No people have been tagged yet.</div>
              ) : (
                tags.map((tag) => (
                  <div
                    key={tag.id}
                    className="rounded-[1.2rem] border border-[rgba(20,20,20,0.08)] bg-white px-4 py-4"
                  >
                    <div className="text-base font-semibold text-[var(--ember-text)]">{tag.label}</div>
                    <div className="mt-2 text-sm text-[var(--ember-muted)]">
                      {tag.email || tag.phoneNumber || 'Tagged on image'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ActivitySection>

          <ActivitySection title="Photos" complete={true}>
              <div className="flex gap-4">
                <div className="overflow-hidden ember-photo-shell border border-[rgba(20,20,20,0.08)] bg-white">
                  <MediaPreview
                    mediaType={mediaType}
                    filename={filename}
                  posterFilename={posterFilename}
                  originalName={emberTitle}
                  usePosterForVideo
                  className="h-24 w-24 object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-base font-semibold text-[var(--ember-text)]">{emberTitle}</div>
                <div className="mt-2 text-sm text-[var(--ember-muted)]">
                  Original: {originalName}
                </div>
              </div>
            </div>
          </ActivitySection>

          <ActivitySection title="Supporting Media" complete={supportingMediaComplete}>
            {attachments.length === 0 ? (
              <div className="text-sm text-[var(--ember-muted)]">
                No supporting media has been uploaded yet.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="overflow-hidden ember-photo-shell border border-[rgba(20,20,20,0.08)] bg-white"
                    >
                      <MediaPreview
                        mediaType={attachment.mediaType}
                        filename={attachment.filename}
                      posterFilename={attachment.posterFilename}
                      originalName={attachment.originalName}
                      usePosterForVideo
                      className="h-24 w-full object-cover"
                    />
                    <div className="px-3 py-3 text-xs text-[var(--ember-muted)]">
                      {attachment.description?.trim() || 'No note added yet.'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ActivitySection>

          <ActivitySection title="Location" complete={locationComplete}>
            <div className="text-sm leading-7 text-[var(--ember-text)]">
              {locationComplete
                ? `${analysis?.latitude?.toFixed(5)}, ${analysis?.longitude?.toFixed(5)}`
                : 'No location data available.'}
            </div>
          </ActivitySection>

          <ActivitySection title="Time & Date" complete={timeComplete}>
            <div className="text-sm leading-7 text-[var(--ember-text)]">
              {analysis?.capturedAt
                ? new Date(analysis.capturedAt).toLocaleString()
                : new Date(createdAt).toLocaleString()}
            </div>
            {analysis?.cameraModel && (
              <div className="mt-2 text-sm text-[var(--ember-muted)]">
                Camera: {[analysis.cameraMake, analysis.cameraModel].filter(Boolean).join(' ')}
              </div>
            )}
          </ActivitySection>

          <ActivitySection title="Image Analysis" complete={analysisComplete}>
            <div className="space-y-3 text-sm leading-7 text-[var(--ember-text)]">
              <p>{analysis?.visualDescription || analysis?.summary || 'No image analysis available yet.'}</p>
              {analysis?.metadataSummary && (
                <p className="text-[var(--ember-muted)]">{analysis.metadataSummary}</p>
              )}
            </div>
          </ActivitySection>
        </div>
      )}
    </div>
  );
}
