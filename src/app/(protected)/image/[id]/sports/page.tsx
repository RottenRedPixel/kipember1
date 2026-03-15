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
    loadSportsMode();
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
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-slate-500">Loading Sports Mode...</div>
      </div>
    );
  }

  const { image, sportsMode, wiki, canManage } = data;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#ecfeff_45%,#f0fdf4_100%)]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Link
              href={`/image/${imageId}`}
              className="inline-flex items-center text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
            >
              &larr; Back to Ember
            </Link>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-600">
                Sports Mode
              </p>
              <h1 className="text-3xl font-semibold text-slate-950">
                Capture the game story and stat line
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {wiki && (
              <Link
                href={`/image/${imageId}/wiki`}
                className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:text-slate-950"
              >
                View Wiki
              </Link>
            )}
            <Link
              href={`/image/${imageId}/chat`}
              className="rounded-full bg-sky-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-sky-700"
            >
              Ask Ember About It
            </Link>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-6">
            <div className="overflow-hidden rounded-[2rem] border border-white/80 bg-white p-5 shadow-sm">
              <MediaPreview
                mediaType={image.mediaType}
                filename={image.filename}
                posterFilename={image.posterFilename}
                originalName={image.originalName}
                controls={image.mediaType === 'VIDEO'}
                className="max-h-[26rem] w-full rounded-[1.5rem] object-contain bg-slate-950"
              />

              <div className="mt-5">
                <h2 className="text-xl font-semibold text-slate-950">{image.originalName}</h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  {image.description || 'No description added yet.'}
                </p>
              </div>
            </div>

            {sportsMode ? (
              <div className="rounded-[2rem] border border-white/80 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold text-slate-950">Structured sports data</h2>
                  {sportsMode.finalScore && (
                    <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-teal-800">
                      {sportsMode.finalScore}
                    </span>
                  )}
                  {sportsMode.outcome && sportsMode.outcome !== 'unknown' && (
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
                      {sportsMode.outcome}
                    </span>
                  )}
                </div>

                {sportsMode.summary && (
                  <p className="mt-3 text-sm leading-7 text-slate-600">{sportsMode.summary}</p>
                )}

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[1.4rem] bg-slate-50 px-4 py-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Matchup
                    </div>
                    <div className="mt-3 space-y-2 text-sm text-slate-700">
                      <div>Sport: {sportsMode.sportType || 'Unknown'}</div>
                      <div>Player: {sportsMode.subjectName || 'Unknown'}</div>
                      <div>Team: {sportsMode.teamName || 'Unknown'}</div>
                      <div>Opponent: {sportsMode.opponentName || 'Unknown'}</div>
                      <div>Event: {sportsMode.eventName || 'Unknown'}</div>
                      <div>Season: {sportsMode.season || 'Unknown'}</div>
                    </div>
                  </div>

                  <div className="rounded-[1.4rem] bg-slate-50 px-4 py-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Stat line
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {sportsMode.statLines.length === 0 ? (
                        <div className="text-sm text-slate-500">No structured stats yet.</div>
                      ) : (
                        sportsMode.statLines.map((stat) => (
                          <span
                            key={`${stat.label}-${stat.value}`}
                            className="rounded-full bg-slate-950 px-3 py-2 text-sm font-medium text-white"
                          >
                            {stat.label}: {stat.value}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {sportsMode.highlights.length > 0 && (
                  <div className="mt-5 rounded-[1.4rem] bg-emerald-50 px-4 py-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                      Highlights
                    </div>
                    <ul className="mt-3 space-y-2 text-sm text-emerald-900">
                      {sportsMode.highlights.map((highlight) => (
                        <li key={highlight}>{highlight}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white/70 px-6 py-8 text-center text-sm text-slate-500">
                No sports data has been saved for this Ember yet.
              </div>
            )}
          </div>

          <div className="rounded-[2rem] border border-white/80 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-2xl font-semibold text-slate-950">Tell Ember the game details</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Paste the performance in plain language and Ember will extract the sport,
                result, and key stat lines for the wiki and chat.
              </p>
            </div>

            {!canManage && (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Only the Ember owner can edit Sports Mode. You can still view the saved stats.
              </div>
            )}

            {error && (
              <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            {notice && (
              <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {notice}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm text-slate-700">
                <div className="mb-2 font-medium">Sport</div>
                <input
                  type="text"
                  value={sportType}
                  onChange={(event) => setSportType(event.target.value)}
                  placeholder="Basketball, Baseball, Football..."
                  disabled={!canManage || saving}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-teal-400 focus:bg-white disabled:opacity-70"
                />
              </label>
              <label className="text-sm text-slate-700">
                <div className="mb-2 font-medium">Player / subject</div>
                <input
                  type="text"
                  value={subjectName}
                  onChange={(event) => setSubjectName(event.target.value)}
                  placeholder="Whose performance is this?"
                  disabled={!canManage || saving}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-teal-400 focus:bg-white disabled:opacity-70"
                />
              </label>
              <label className="text-sm text-slate-700">
                <div className="mb-2 font-medium">Team</div>
                <input
                  type="text"
                  value={teamName}
                  onChange={(event) => setTeamName(event.target.value)}
                  placeholder="Optional"
                  disabled={!canManage || saving}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-teal-400 focus:bg-white disabled:opacity-70"
                />
              </label>
              <label className="text-sm text-slate-700">
                <div className="mb-2 font-medium">Opponent</div>
                <input
                  type="text"
                  value={opponentName}
                  onChange={(event) => setOpponentName(event.target.value)}
                  placeholder="Optional"
                  disabled={!canManage || saving}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-teal-400 focus:bg-white disabled:opacity-70"
                />
              </label>
              <label className="text-sm text-slate-700">
                <div className="mb-2 font-medium">Event</div>
                <input
                  type="text"
                  value={eventName}
                  onChange={(event) => setEventName(event.target.value)}
                  placeholder="Championship, regular season game..."
                  disabled={!canManage || saving}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-teal-400 focus:bg-white disabled:opacity-70"
                />
              </label>
              <label className="text-sm text-slate-700">
                <div className="mb-2 font-medium">Season / year</div>
                <input
                  type="text"
                  value={season}
                  onChange={(event) => setSeason(event.target.value)}
                  placeholder="Optional"
                  disabled={!canManage || saving}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-teal-400 focus:bg-white disabled:opacity-70"
                />
              </label>
            </div>

            <label className="mt-5 block text-sm text-slate-700">
              <div className="mb-2 font-medium">Sports details</div>
              <textarea
                value={rawDetails}
                onChange={(event) => setRawDetails(event.target.value)}
                placeholder="Example: Seth had 10 points, 3 rebounds, 6 assists, 2 steals, and they won 11-10. It was a tight game against Central."
                disabled={!canManage || saving}
                rows={8}
                className="w-full resize-none rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4 text-slate-950 outline-none transition focus:border-teal-400 focus:bg-white disabled:opacity-70"
              />
            </label>

            <div className="mt-5 rounded-[1.4rem] border border-teal-100 bg-teal-50 px-4 py-4 text-sm text-teal-900">
              Ember can extract flexible stat lines such as points, rebounds, assists, steals,
              hits, home runs, spikes, yards, touchdowns, goals, saves, innings, or other sport-specific numbers.
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={!canManage || saving}
                className="rounded-full bg-teal-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Saving sports mode...' : 'Save sports mode'}
              </button>
              <span className="text-sm text-slate-500">
                Saving also refreshes the wiki so the stats show up in Ember chat.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
