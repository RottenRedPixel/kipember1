// ─── KipemberWikiContent — utility functions ─────────────────────────────────
// Extracted from KipemberWikiContent.tsx (Phase 3 of wiki feature-module split).
// No React imports — all pure TypeScript.

import { pastelForContributor, pastelForContributorIdentity } from '@/lib/contributor-color';
import type { KipemberWikiDetail } from './types';
import type { ReconciliationClaim, ReconciliationResponse } from './hooks';

// ── Identity / avatar ─────────────────────────────────────────────────────────

/**
 * Identity bundle a single resolver hands back to every avatar surface.
 * One person → one record, regardless of where they're being rendered.
 * userId / email / phoneNumber drive the pool-stable color via
 * pastelForContributorIdentity; avatarUrl wins over color when present.
 */
export type PersonIdentity = {
  userId: string | null;
  email: string | null;
  phoneNumber: string | null;
  id: string | null;
  avatarColor?: string | null;
  avatarUrl: string | null;
  // Owner gets a dedicated orange swatch so their avatar stays consistent
  // with the AppHeader, /account, and the wiki Owner card. Without this
  // flag the owner falls into the pool-key pastel and breaks the visual
  // continuity their other surfaces establish.
  isOwner?: boolean;
};

/** Single resolver passed to every avatar surface. */
export type FindPerson = (name: string) => PersonIdentity | null;
/** Backwards-compat alias for older call sites that only need the URL. */
export type FindAvatar = (name: string) => string | null;

/**
 * Single source for the owner's bubble color. Matches AppHeader and the
 * Account avatar so the owner reads as the same person on every surface.
 */
export const OWNER_AVATAR_BG = 'color-mix(in srgb, var(--color-accent) 60%, transparent)';

/**
 * Pastels are pale enough that dark text reads cleanly. The owner's
 * orange tint is dark enough that white text reads better — same
 * treatment AppHeader and the /account avatar use.
 */
export function avatarStylesForPerson(
  person: PersonIdentity | null,
  fallbackName: string
): { background: string; color: string } {
  if (person?.isOwner) return { background: OWNER_AVATAR_BG, color: '#ffffff' };
  if (person)
    return {
      background: person.avatarColor ?? pastelForContributorIdentity(person),
      color: '#1f2937',
    };
  return { background: pastelForContributor(fallbackName), color: '#1f2937' };
}

/** Backwards-compat alias for sites that only need the bg. */
export function colorForPerson(person: PersonIdentity | null, fallbackName: string): string {
  return avatarStylesForPerson(person, fallbackName).background;
}

// ── Date / time formatters ────────────────────────────────────────────────────

export function formatLongDate(value: string | null | undefined): string {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function relativeAt(value: string): string {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const m = Math.round(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d`;
  return `${Math.round(d / 7)}w`;
}

export function formatAnalysisFooterDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ── String helpers ────────────────────────────────────────────────────────────

export function initials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function joinDistinct(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (!trimmed) continue;
    const normalized = trimmed.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(trimmed);
  }
  return result;
}

export function formatAnalysisList(values: string[] | undefined): string | null {
  const items = joinDistinct(values || []);
  return items.length > 0 ? items.join(', ') : null;
}

export function formatLocationLine(
  label: string | null | undefined,
  detail: string | null | undefined
): string | null {
  const parts = [label, detail]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

// ── Claim / reconciliation helpers ───────────────────────────────────────────

export function claimSourceLabelFromMetadata(metadata: unknown): string {
  if (!metadata || typeof metadata !== 'object') return 'Someone';
  const label = (metadata as Record<string, unknown>).sourceLabel;
  return typeof label === 'string' && label.trim() ? label.trim() : 'Someone';
}

export function getSourceName(claim: ReconciliationClaim): string {
  const metadata = claim.metadata;
  if (
    metadata &&
    typeof metadata === 'object' &&
    'sourceLabel' in metadata &&
    typeof metadata.sourceLabel === 'string' &&
    metadata.sourceLabel.trim()
  ) {
    return metadata.sourceLabel.trim();
  }
  return 'Contributor';
}

export function formatClaimType(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}

export function formatConfidence(value: number | null): string | null {
  if (typeof value !== 'number') return null;
  return `${Math.round(value * 100)}% confidence`;
}

// ── Analysis text builder ─────────────────────────────────────────────────────

export function appendAnalysisLine(
  lines: string[],
  label: string,
  value: string | null | undefined
): void {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (trimmed) {
    lines.push(`- **${label}:** ${trimmed}`);
  }
}

export function buildStructuredAnalysisText(
  analysis: KipemberWikiDetail['analysis']
): string {
  const sceneInsights = analysis?.sceneInsights;
  const people = sceneInsights?.peopleAndDemographics;
  const setting = sceneInsights?.settingAndEnvironment;
  const activities = sceneInsights?.activitiesAndContext;
  const emotional = sceneInsights?.emotionalContext;

  const numberOfPeople =
    typeof people?.numberOfPeopleVisible === 'number'
      ? `${people.numberOfPeopleVisible}`
      : null;
  const ageRanges = formatAnalysisList(people?.estimatedAgeRanges);
  const visibleActivities = formatAnalysisList(activities?.visibleActivities);
  const relationships = joinDistinct([
    people?.relationshipInference,
    people?.spatialRelationships,
  ]).join('. ');
  const background = joinDistinct([
    setting?.backgroundDetails,
    setting?.architectureOrLandscape,
  ]).join('. ');
  const overallMood = joinDistinct([
    emotional?.overallMoodAndAtmosphere,
    analysis?.mood,
  ]).join('. ');
  const socialDynamics = joinDistinct([
    activities?.socialDynamics,
    activities?.interactionsBetweenPeople,
    emotional?.socialEnergy,
  ]).join('. ');
  const summary = analysis?.summary || null;

  const hasStructuredContent = Boolean(
    numberOfPeople ||
      ageRanges ||
      people?.genderPresentation ||
      people?.clothingAndStyle ||
      people?.bodyLanguageAndExpressions ||
      relationships ||
      setting?.locationType ||
      setting?.timeOfDayAndLighting ||
      background ||
      activities?.whatAppearsToBeHappening ||
      activities?.eventType ||
      visibleActivities ||
      overallMood ||
      emotional?.emotionalExpressions ||
      socialDynamics ||
      summary
  );

  if (!hasStructuredContent) {
    return [
      analysis?.summary,
      analysis?.visualDescription,
      analysis?.metadataSummary,
    ]
      .filter((value): value is string => Boolean(value && value.trim()))
      .join('\n\n');
  }

  const sections: string[] = [];

  const peopleLines: string[] = [];
  appendAnalysisLine(peopleLines, 'Number of People', numberOfPeople);
  appendAnalysisLine(peopleLines, 'Estimated Age Ranges', ageRanges);
  appendAnalysisLine(peopleLines, 'Gender', people?.genderPresentation);
  appendAnalysisLine(peopleLines, 'Clothing', people?.clothingAndStyle);
  appendAnalysisLine(peopleLines, 'Body Language', people?.bodyLanguageAndExpressions);
  appendAnalysisLine(peopleLines, 'Relationships', relationships);
  if (peopleLines.length > 0) {
    sections.push('**PEOPLE:**');
    sections.push(...peopleLines);
  }

  const settingLines: string[] = [];
  appendAnalysisLine(
    settingLines,
    'Location Type',
    setting?.locationType || setting?.environmentType
  );
  appendAnalysisLine(
    settingLines,
    'Time of Day',
    setting?.timeOfDayAndLighting || setting?.lightingDescription
  );
  appendAnalysisLine(settingLines, 'Background', background);
  if (settingLines.length > 0) {
    sections.push('');
    sections.push('**SETTING & ENVIRONMENT:**');
    sections.push(...settingLines);
  }

  const activityLines: string[] = [];
  appendAnalysisLine(
    activityLines,
    "What's Happening",
    activities?.whatAppearsToBeHappening || visibleActivities
  );
  appendAnalysisLine(activityLines, 'Event Type', activities?.eventType);
  if (activityLines.length > 0) {
    sections.push('');
    sections.push('**ACTIVITIES & CONTEXT:**');
    sections.push(...activityLines);
  }

  const emotionalLines: string[] = [];
  appendAnalysisLine(emotionalLines, 'Overall Mood', overallMood);
  appendAnalysisLine(
    emotionalLines,
    'Emotional Expressions',
    emotional?.emotionalExpressions || emotional?.individualEmotions
  );
  appendAnalysisLine(emotionalLines, 'Social Dynamics', socialDynamics);
  if (emotionalLines.length > 0) {
    sections.push('');
    sections.push('**EMOTIONAL CONTEXT:**');
    sections.push(...emotionalLines);
  }

  const summaryLines: string[] = [];
  appendAnalysisLine(summaryLines, 'Summary', summary);
  if (summaryLines.length > 0) {
    sections.push('');
    sections.push('**SUMMARY:**');
    sections.push(...summaryLines);
  }

  return sections.join('\n');
}

// ── API helpers ───────────────────────────────────────────────────────────────

export async function fetchReconciliationState(
  emberId: string,
  signal?: AbortSignal
): Promise<ReconciliationResponse> {
  const response = await fetch(`/api/embers/${emberId}/reconciliation`, { signal });
  if (!response.ok) {
    throw new Error('Failed to load reconciliation state');
  }
  const payload = (await response.json()) as ReconciliationResponse;
  return {
    claims: Array.isArray(payload.claims) ? payload.claims : [],
    conflicts: Array.isArray(payload.conflicts) ? payload.conflicts : [],
  };
}
