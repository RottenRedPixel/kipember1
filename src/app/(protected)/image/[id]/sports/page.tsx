'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import MediaPreview from '@/components/MediaPreview';

type SportsStatLine = {
  label: string;
  value: string;
};

type SportsModeRecord = {
  id: string;
  sportType: string | null;
  subjectName: string | null;
  teamName: string | null;
  opponentName: string | null;
  eventName: string | null;
  season: string | null;
  outcome: string | null;
  finalScore: string | null;
  rawDetails: string;
  summary: string | null;
  statLines: SportsStatLine[];
  highlights: string[];
  updatedAt: string;
};

type SportsPageData = {
  image: {
    id: string;
    filename: string;
    mediaType: 'IMAGE' | 'VIDEO';
    posterFilename: string | null;
    durationSeconds: number | null;
    originalName: string;
    description: string | null;
  };
  canManage: boolean;
  wiki: {
    id: string;
    version: number;
    updatedAt: string;
  } | null;
  sportsMode: SportsModeRecord | null;
};

export default function SportsModePage() {
  const params = useParams<{ id: string }>();
  const imageId = params.id;

  const [data, setData] = useState<SportsPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [sportType, setSportType] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [opponentName, setOpponentName] = useState('');
  const [eventName, setEventName] = useState('');
  const [season, setSeason] = useState('');
  const [rawDetails, setRawDetails] = useState('');

  const loadSportsMode = useCallback(async () => {
    if (!imageId) {
      return;
    }

    try {
      const response = await fetch(`/api/sports/${imageId}`, {
        cache: 'no-store',
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load sports mode');
      }

      setData(payload);
      const sportsMode = payload.sportsMode as SportsModeRecord | null;
      setSportType(sportsMode?.sportType || '');
      setSubjectName(sportsMode?.subjectName || '');
      setTeamName(sportsMode?.teamName || '');
      setOpponentName(sportsMode?.opponentName || '');
      setEventName(sportsMode?.eventName || '');
      setSeason(sportsMode?.season || '');
      setRawDetails(sportsMode?.rawDetails || '');
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load sports mode');
    } finally {
      setLoading(false);
    }
  }, [imageId]);

  useEffect(() => {
    void loadSportsMode();
  }, [loadSportsMode]);

  const handleSave = async () => {
    if (!imageId || !rawDetails.trim()) {
      setError('Add the sports details before saving.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`/api/sports/${imageId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sportType,
          subjectName,
          teamName,
          opponentName,
          eventName,
          season,
          rawDetails,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to save sports mode');
      }

      setData((current) =>
        current
          ? {
              ...current,
              sportsMode: payload.sportsMode,
            }
          : current
      );

      setNotice(
        payload.warning
          ? `Sports Mode saved. Wiki regeneration warning: ${payload.warning}`
          : payload.wikiGenerated
            ? 'Sports Mode saved and the wiki was regenerated.'
            : 'Sports Mode saved.'
      );
      await loadSportsMode();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save sports mode');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-6xl items-center justify-center px-4 py-8 sm:px-6">
        <div className="ember-panel rounded-full px-6 py-3 text-sm text-[var(--ember-muted)]">
          Loading Sports Mode...
        </div>
      </div>
    );
  }

  const { image, sportsMode, wiki, canManage } = data;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <section className="mb-6 grid gap-6 lg:grid-cols-[0.96fr_1.04fr]">
        <div className="ember-panel rounded-[2.25rem] p-6">
          <Link
            href={`/image/${imageId}`}
            className="text-sm font-medium text-[var(--ember-muted)] hover:text-[var(--ember-text)]"
          >
            {'<- Back to Ember'}
          </Link>

            <div className="mt-5 overflow-hidden ember-photo-shell border border-[rgba(20,20,20,0.06)] bg-white">
              <MediaPreview
                mediaType={image.mediaType}
                filename={image.filename}
              posterFilename={image.posterFilename}
              originalName={image.originalName}
              controls={image.mediaType === 'VIDEO'}
              className="max-h-[28rem] w-full object-contain bg-[var(--ember-bg)]"
            />
          </div>

          <div className="mt-5">
            <p className="ember-eyebrow">Sports mode</p>
            <h1 className="ember-heading mt-3 text-3xl text-[var(--ember-text)]">
              Capture the game story and stat line
            </h1>
            <p className="ember-copy mt-3 text-sm">
              {image.description ||
                'Use Sports Mode when this Ember needs structured performance data alongside the memory narrative.'}
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {sportsMode?.finalScore && <span className="ember-chip">{sportsMode.finalScore}</span>}
            {sportsMode?.outcome && sportsMode.outcome !== 'unknown' && (
              <span className="ember-chip">{sportsMode.outcome}</span>
            )}
            {wiki && <span className="ember-chip">Wiki v{wiki.version}</span>}
          </div>
        </div>

        <div className="ember-panel rounded-[2.25rem] p-6">
          <p className="ember-eyebrow">Connected views</p>
          <h2 className="ember-heading mt-4 text-3xl text-[var(--ember-text)]">
            Sports data feeds the rest of Ember
          </h2>
          <p className="ember-copy mt-3 text-sm">
            Save structured performance details here so the wiki and chat can reference
            the event in a more grounded way.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            {wiki && (
              <Link href={`/image/${imageId}/play`} className="ember-button-secondary">
                Play Ember
              </Link>
            )}
            <Link href={`/image/${imageId}/chat`} className="ember-button-secondary">
              Ask Ember
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <section className="space-y-6">
          {sportsMode ? (
            <div className="ember-panel-strong rounded-[2.25rem] p-6">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="ember-heading text-3xl text-[var(--ember-text)]">
                  Structured sports data
                </h2>
                {sportsMode.finalScore && <span className="ember-chip">{sportsMode.finalScore}</span>}
              </div>

              {sportsMode.summary && (
                <p className="ember-copy mt-4 text-sm">{sportsMode.summary}</p>
              )}

              <div className="mt-6 grid gap-4">
                <div className="ember-card rounded-[1.6rem] px-4 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ember-muted)]">
                    Matchup
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-[var(--ember-text)]">
                    <div>Sport: {sportsMode.sportType || 'Unknown'}</div>
                    <div>Player: {sportsMode.subjectName || 'Unknown'}</div>
                    <div>Team: {sportsMode.teamName || 'Unknown'}</div>
                    <div>Opponent: {sportsMode.opponentName || 'Unknown'}</div>
                    <div>Event: {sportsMode.eventName || 'Unknown'}</div>
                    <div>Season: {sportsMode.season || 'Unknown'}</div>
                  </div>
                </div>

                <div className="ember-card rounded-[1.6rem] px-4 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ember-muted)]">
                    Stat line
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {sportsMode.statLines.length === 0 ? (
                      <div className="text-sm text-[var(--ember-muted)]">
                        No structured stats yet.
                      </div>
                    ) : (
                      sportsMode.statLines.map((stat) => (
                        <span key={`${stat.label}-${stat.value}`} className="ember-chip">
                          {stat.label}: {stat.value}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {sportsMode.highlights.length > 0 && (
                  <div className="ember-card rounded-[1.6rem] px-4 py-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ember-muted)]">
                      Highlights
                    </div>
                    <ul className="mt-3 ml-5 list-disc space-y-2 text-sm leading-7 text-[var(--ember-text)] marker:text-[var(--ember-orange)]">
                      {sportsMode.highlights.map((highlight) => (
                        <li key={highlight}>{highlight}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="ember-panel rounded-[2.25rem] border-dashed p-8 text-center text-[var(--ember-muted)]">
              No sports data has been saved for this Ember yet.
            </div>
          )}
        </section>

        <section className="ember-panel-strong rounded-[2.25rem] p-6">
          <p className="ember-eyebrow">Editor</p>
          <h2 className="ember-heading mt-4 text-3xl text-[var(--ember-text)]">
            Tell Ember the game details
          </h2>
          <p className="ember-copy mt-3 text-sm">
            Paste the performance in plain language and Ember will extract the sport,
            result, and key stat lines for the wiki and chat.
          </p>

          {!canManage && (
            <div className="mt-6 ember-status border border-[rgba(255,102,33,0.14)] bg-[rgba(255,102,33,0.08)] text-[var(--ember-text)]">
              Only the Ember owner can edit Sports Mode. You can still view the saved stats.
            </div>
          )}

          {error && (
            <div className="mt-6 ember-status ember-status-error">
              {error}
            </div>
          )}

          {notice && (
            <div className="mt-6 ember-status ember-status-success">
              {notice}
            </div>
          )}

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-[var(--ember-text)]">
              <div className="mb-2 font-medium">Sport</div>
              <input
                type="text"
                value={sportType}
                onChange={(event) => setSportType(event.target.value)}
                placeholder="Basketball, Baseball, Football..."
                disabled={!canManage || saving}
                className="ember-input disabled:opacity-70"
              />
            </label>
            <label className="text-sm text-[var(--ember-text)]">
              <div className="mb-2 font-medium">Player / subject</div>
              <input
                type="text"
                value={subjectName}
                onChange={(event) => setSubjectName(event.target.value)}
                placeholder="Whose performance is this?"
                disabled={!canManage || saving}
                className="ember-input disabled:opacity-70"
              />
            </label>
            <label className="text-sm text-[var(--ember-text)]">
              <div className="mb-2 font-medium">Team</div>
              <input
                type="text"
                value={teamName}
                onChange={(event) => setTeamName(event.target.value)}
                placeholder="Optional"
                disabled={!canManage || saving}
                className="ember-input disabled:opacity-70"
              />
            </label>
            <label className="text-sm text-[var(--ember-text)]">
              <div className="mb-2 font-medium">Opponent</div>
              <input
                type="text"
                value={opponentName}
                onChange={(event) => setOpponentName(event.target.value)}
                placeholder="Optional"
                disabled={!canManage || saving}
                className="ember-input disabled:opacity-70"
              />
            </label>
            <label className="text-sm text-[var(--ember-text)]">
              <div className="mb-2 font-medium">Event</div>
              <input
                type="text"
                value={eventName}
                onChange={(event) => setEventName(event.target.value)}
                placeholder="Championship, regular season game..."
                disabled={!canManage || saving}
                className="ember-input disabled:opacity-70"
              />
            </label>
            <label className="text-sm text-[var(--ember-text)]">
              <div className="mb-2 font-medium">Season / year</div>
              <input
                type="text"
                value={season}
                onChange={(event) => setSeason(event.target.value)}
                placeholder="Optional"
                disabled={!canManage || saving}
                className="ember-input disabled:opacity-70"
              />
            </label>
          </div>

          <label className="mt-5 block text-sm text-[var(--ember-text)]">
            <div className="mb-2 font-medium">Sports details</div>
            <textarea
              value={rawDetails}
              onChange={(event) => setRawDetails(event.target.value)}
              placeholder="Example: Seth had 10 points, 3 rebounds, 6 assists, 2 steals, and they won 11-10. It was a tight game against Central."
              disabled={!canManage || saving}
              rows={8}
              className="ember-textarea disabled:opacity-70"
            />
          </label>

          <div className="mt-5 ember-card rounded-[1.6rem] px-4 py-4 text-sm text-[var(--ember-text)]">
            Ember can extract flexible stat lines such as points, rebounds, assists,
            steals, hits, home runs, spikes, yards, touchdowns, goals, saves, innings,
            or other sport-specific numbers.
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!canManage || saving}
              className="ember-button-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Saving sports mode...' : 'Save sports mode'}
            </button>
            <span className="text-sm text-[var(--ember-muted)]">
              Saving also refreshes the wiki so the stats show up in Ember chat.
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
