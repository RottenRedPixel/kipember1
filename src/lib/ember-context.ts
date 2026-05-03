// Single source of truth for "what we know about an ember" — every chat /
// voice / call / sms surface should call loadEmberContext to assemble the
// same bag of facts. Adding a new field here surfaces it everywhere; the
// alternative (each surface fetching its own slice) is exactly how the
// system drifted into Chat / Call / SMS each seeing different "wikis".

import { prisma } from '@/lib/db';
import { getEmberTitle } from '@/lib/ember-title';
import {
  parseConfirmedLocationContext,
  parseLocationSuggestionsCache,
  type LocationSuggestion,
} from '@/lib/location-suggestions';
import { getUserDisplayName } from '@/lib/user-name';

export type EmberContext = {
  /** Display title of the ember. */
  title: string;
  /** Snapshot script (the AI-written one-paragraph summary). */
  snapshot: string;
  /** ISO timestamp the photo was captured (or empty). */
  capturedAt: string;
  /** Resolved place string ("Stage House Tavern, Somerset NJ") or empty. */
  location: string;
  /** Newline-joined list of tagged people with positions. */
  taggedPeople: string;
  /** GPT-4o photo analysis summary. */
  visualScene: string;
  /** Multi-line "feeling: descriptor" entries from the photo analysis. */
  emotionalContext: string;
  /**
   * Markdown-formatted claim values grouped by type (Why / Emotional /
   * Extra story / Place), with attribution. Empty when no claims exist.
   */
  claims: string;
  /** The wiki markdown as-stored in image.wiki.content. */
  wikiRaw: string;
  /**
   * The wiki Claude (and any other surface) should actually read. This is
   * the stored wiki + claims + location appended as markdown sections so
   * everyone sees the same "everything we know" document.
   */
  wiki: string;
};

const EMPTY_CONTEXT: EmberContext = {
  title: '',
  snapshot: '',
  capturedAt: '',
  location: '',
  taggedPeople: '',
  visualScene: '',
  emotionalContext: '',
  claims: '',
  wikiRaw: '',
  wiki: '',
};

function extractEmotionalContext(json: string | null | undefined): string {
  if (!json) return '';
  try {
    const parsed = JSON.parse(json) as { emotionalContext?: Record<string, unknown> | null };
    const ec = parsed.emotionalContext;
    if (!ec || typeof ec !== 'object') return '';
    return Object.entries(ec)
      .filter(([, v]) => v != null && String(v).trim())
      .map(([k, v]) => `${k}: ${String(v).trim()}`)
      .join('\n');
  } catch {
    return '';
  }
}

function formatSuggestionsLocation(suggestions: LocationSuggestion[]): string {
  if (!suggestions.length) return '';
  const place = suggestions.find((s) => s.kind === 'place')
    || suggestions.find((s) => s.kind === 'neighborhood')
    || suggestions.find((s) => s.kind === 'city');
  const address = suggestions.find((s) => s.kind === 'address');
  const parts = [place?.label, address?.label].filter(
    (value): value is string => Boolean(value && value.trim())
  );
  if (parts.length > 0) return parts.join(', ');
  return suggestions[0].label || '';
}

function formatLocation(
  metadataJson: string | null | undefined,
  latitude: number | null | undefined,
  longitude: number | null | undefined
): string {
  const confirmed = parseConfirmedLocationContext(metadataJson);
  if (confirmed) {
    return [confirmed.label, confirmed.detail].filter(Boolean).join(', ');
  }
  if (latitude != null && longitude != null) {
    const cached = parseLocationSuggestionsCache(metadataJson, latitude, longitude);
    if (cached && cached.length > 0) {
      return formatSuggestionsLocation(cached);
    }
  }
  return '';
}

type RawClaim = {
  claimType: string;
  value: string;
  subject: string;
  metadataJson: string | null;
};

function claimSourceLabel(metadataJson: string | null): string {
  if (!metadataJson) return 'Someone';
  try {
    const parsed = JSON.parse(metadataJson) as { sourceLabel?: unknown };
    return typeof parsed.sourceLabel === 'string' && parsed.sourceLabel.trim()
      ? parsed.sourceLabel.trim()
      : 'Someone';
  } catch {
    return 'Someone';
  }
}

const CLAIM_TYPE_HEADINGS: Record<string, string> = {
  why: 'Why this memory matters',
  emotion: 'Emotional states',
  extra_story: 'Extra stories',
  place: 'Places mentioned',
  person: 'People mentioned (not necessarily tagged on the photo)',
};

function formatClaims(claims: RawClaim[]): string {
  if (!claims.length) return '';
  const grouped = new Map<string, string[]>();
  for (const claim of claims) {
    const heading = CLAIM_TYPE_HEADINGS[claim.claimType];
    if (!heading) continue;
    const source = claimSourceLabel(claim.metadataJson);
    const subject = claim.subject?.trim();
    const value = claim.value?.trim() || '';
    if (!value) continue;
    const line = subject
      ? `- ${source} said about ${subject}: "${value}"`
      : `- ${source} said: "${value}"`;
    const list = grouped.get(heading) ?? [];
    list.push(line);
    grouped.set(heading, list);
  }
  if (grouped.size === 0) return '';
  return Array.from(grouped.entries())
    .map(([heading, lines]) => `${heading}:\n${lines.join('\n')}`)
    .join('\n\n');
}

function describePosition(
  leftPct: number | null,
  topPct: number | null,
  widthPct: number | null,
  heightPct: number | null
): string | null {
  if (leftPct == null || topPct == null || widthPct == null || heightPct == null) return null;
  const cx = leftPct + widthPct / 2;
  const cy = topPct + heightPct / 2;
  let horizontal: string;
  if (cx < 33) horizontal = 'left';
  else if (cx < 45) horizontal = 'left of center';
  else if (cx < 55) horizontal = 'center';
  else if (cx < 67) horizontal = 'right of center';
  else horizontal = 'right';
  let vertical: string | null = null;
  if (cy < 33) vertical = 'upper';
  else if (cy >= 67) vertical = 'lower';
  const zone = vertical ? `${vertical} ${horizontal}` : horizontal;
  return `${zone} side of the photo (centered around ${Math.round(cx)}% from the left, ${Math.round(cy)}% from the top)`;
}

function formatTaggedPeople(
  tags: Array<{
    label: string;
    leftPct: number | null;
    topPct: number | null;
    widthPct: number | null;
    heightPct: number | null;
    user: { firstName: string | null; lastName: string | null } | null;
    emberContributor: { contributor: { name: string | null } } | null;
  }>
): string {
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const tag of tags) {
    const name = (getUserDisplayName(tag.user) || tag.emberContributor?.contributor.name || tag.label || '').trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const position = describePosition(tag.leftPct, tag.topPct, tag.widthPct, tag.heightPct);
    lines.push(position ? `${name} — ${position}` : name);
  }
  return lines.join('\n');
}

// Build the merged "everything we know" wiki: stored wiki markdown + the
// resolved location + the housekeeping claims. The result is what every
// surface should hand to Claude as the source of truth.
function composeMergedWiki({
  wikiRaw,
  location,
  taggedPeople,
  claims,
}: {
  wikiRaw: string;
  location: string;
  taggedPeople: string;
  claims: string;
}): string {
  const sections: string[] = [];
  if (wikiRaw.trim()) sections.push(wikiRaw.trim());
  if (location.trim()) sections.push(`## Place\n${location.trim()}`);
  if (taggedPeople.trim()) sections.push(`## People in the photo\n${taggedPeople.trim()}`);
  if (claims.trim()) sections.push(`## What people have said\n${claims.trim()}`);
  return sections.join('\n\n');
}

export async function loadEmberContext(imageId: string): Promise<EmberContext> {
  const image = await prisma.image.findUnique({
    where: { id: imageId },
    select: {
      title: true,
      originalName: true,
      analysis: {
        select: {
          summary: true,
          capturedAt: true,
          metadataJson: true,
          sceneInsightsJson: true,
          latitude: true,
          longitude: true,
        },
      },
      snapshot: { select: { script: true } },
      wiki: { select: { content: true } },
      tags: {
        orderBy: { createdAt: 'asc' },
        select: {
          label: true,
          leftPct: true,
          topPct: true,
          widthPct: true,
          heightPct: true,
          user: { select: { firstName: true, lastName: true } },
          emberContributor: { select: { contributor: { select: { name: true } } } },
        },
      },
      memoryClaims: {
        where: { status: 'active' },
        select: {
          claimType: true,
          value: true,
          subject: true,
          metadataJson: true,
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!image) return EMPTY_CONTEXT;

  const capturedAt = image.analysis?.capturedAt ? image.analysis.capturedAt.toISOString() : '';
  const location = formatLocation(
    image.analysis?.metadataJson,
    image.analysis?.latitude ?? null,
    image.analysis?.longitude ?? null
  );
  const taggedPeople = formatTaggedPeople(image.tags);
  const claims = formatClaims(image.memoryClaims);
  const wikiRaw = image.wiki?.content ?? '';
  const wiki = composeMergedWiki({ wikiRaw, location, taggedPeople, claims });

  return {
    title: getEmberTitle(image),
    snapshot: image.snapshot?.script ?? '',
    capturedAt,
    location,
    taggedPeople,
    visualScene: image.analysis?.summary ?? '',
    emotionalContext: extractEmotionalContext(image.analysis?.sceneInsightsJson),
    claims,
    wikiRaw,
    wiki,
  };
}

// Re-export the active claim types so callers can compute interview
// coverage without re-fetching the claims.
export async function loadActiveClaimTypes(imageId: string): Promise<Set<string>> {
  const claims = await prisma.memoryClaim.findMany({
    where: { imageId, status: 'active' },
    select: { claimType: true },
  });
  return new Set(claims.map((c) => c.claimType));
}
