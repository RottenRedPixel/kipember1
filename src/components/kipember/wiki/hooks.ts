// ─── KipemberWikiContent — custom hooks ──────────────────────────────────────
// Extracted from KipemberWikiContent.tsx (Phase 2 of wiki feature-module split).

import { useEffect, useState } from 'react';

// ── Types owned by this module ────────────────────────────────────────────────

// What the user actually said, never the LLM's paraphrase. Each claim ships
// with zero or more of these — the UI renders one row per source with the
// appropriate icon (chat/voice/call) and a play button when audio exists.
export type ClaimSource =
  | { kind: 'chat'; text: string; messageId: string }
  | { kind: 'sms'; text: string; messageId: string }
  | { kind: 'voice'; text: string; messageId: string; audioUrl: string | null }
  | { kind: 'call'; text: string; voiceCallId: string; recordingUrl: string | null; startMs: number | null; endMs: number | null };

export type ReconciliationClaim = {
  id: string;
  claimType: string;
  subject: string;
  value: string;
  normalizedValue: string;
  rawText: string | null;
  confidence: number | null;
  evidenceKind: string;
  resolutionMode: string;
  status: string;
  questionType: string | null;
  source: string;
  contributorId: string | null;
  userId: string | null;
  metadata: unknown;
  createdAt: string;
  sources: ClaimSource[];
};

export type ReconciliationConflict = {
  id: string;
  claimType: string;
  subject: string;
  summary: string;
  status: string;
  resolutionMode: string;
  resolutionValue: string | null;
  resolutionNote: string | null;
  outreachQuestion: string | null;
  confidence: number | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  claims: Array<{
    stance: string;
    claim: ReconciliationClaim;
  }>;
};

export type ReconciliationResponse = {
  claims: ReconciliationClaim[];
  conflicts: ReconciliationConflict[];
};

// Defined for completeness; currently unused in the main component.
export type ReconciliationRefreshResponse = {
  processedMessages: number;
  claimsCreated: number;
  conflictsCreated: number;
  openConflictCount: number;
};

export type TrackerStepConfig = {
  slug: string;
  ownerRequired: boolean;
  contributorMin: number | null;
};

export type EmberStoryRecord = {
  id: string;
  script: string;
  facets: string[];
  people: string[];
  authorType: string | null;
  authorName: string | null;
  createdAt: string;
};

// ── Hooks ─────────────────────────────────────────────────────────────────────

/**
 * Pulls the current admin tracker config (which slugs are enabled +
 * completion rule per step). Returns null while loading — caller treats
 * as "show all enabled steps with default rules" until we know better.
 */
export function useTrackerConfig(): TrackerStepConfig[] | null {
  const [config, setConfig] = useState<TrackerStepConfig[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/progress-tracker', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { steps?: TrackerStepConfig[] } | null) => {
        if (cancelled) return;
        if (data?.steps) {
          setConfig(data.steps);
        }
      })
      .catch(() => {
        // Silently keep null — wiki falls back to showing all steps.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return config;
}

export function useReconciliationClaims(
  emberId: string | null | undefined
): ReconciliationClaim[] | null {
  const [claims, setClaims] = useState<ReconciliationClaim[] | null>(null);

  useEffect(() => {
    if (!emberId) {
      setClaims(null);
      return;
    }

    let cancelled = false;
    fetch(`/api/embers/${emberId}/reconciliation`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: ReconciliationResponse | null) => {
        if (cancelled) return;
        setClaims(data?.claims ?? []);
      })
      .catch(() => {
        if (!cancelled) setClaims([]);
      });

    return () => {
      cancelled = true;
    };
  }, [emberId]);

  return claims;
}

export function useEmberStories(
  emberId: string | null | undefined
): EmberStoryRecord[] | null {
  const [stories, setStories] = useState<EmberStoryRecord[] | null>(null);

  useEffect(() => {
    if (!emberId) { setStories(null); return; }
    let cancelled = false;
    fetch(`/api/embers/${emberId}/stories`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { stories?: EmberStoryRecord[] } | null) => {
        if (cancelled) return;
        setStories(d?.stories ?? []);
      })
      .catch(() => { if (!cancelled) setStories([]); });
    return () => { cancelled = true; };
  }, [emberId]);

  return stories;
}
