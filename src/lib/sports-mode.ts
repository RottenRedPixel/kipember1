import { chat } from '@/lib/claude';

export type SportsStatLine = {
  label: string;
  value: string;
};

export type ParsedSportsMode = {
  sportType: string | null;
  subjectName: string | null;
  teamName: string | null;
  opponentName: string | null;
  eventName: string | null;
  season: string | null;
  outcome: 'win' | 'loss' | 'tie' | 'unknown';
  finalScore: string | null;
  rawDetails: string;
  summary: string | null;
  statLines: SportsStatLine[];
  highlights: string[];
};

function extractJsonObject(text: string): string {
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    throw new Error('Expected a JSON object in sports mode response');
  }

  return text.slice(firstBrace, lastBrace + 1);
}

function sanitizeString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function sanitizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const cleaned = sanitizeString(item);
    return cleaned ? [cleaned] : [];
  });
}

function sanitizeStatLines(value: unknown): SportsStatLine[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return [];
    }

    const label = sanitizeString((item as Record<string, unknown>).label);
    const statValue = sanitizeString((item as Record<string, unknown>).value);

    if (!label || !statValue) {
      return [];
    }

    return [{ label, value: statValue }];
  });
}

function normalizeOutcome(value: unknown): ParsedSportsMode['outcome'] {
  return value === 'win' || value === 'loss' || value === 'tie' ? value : 'unknown';
}

function applyHint<T extends string | null>(primary: T, hint: string | null): string | null {
  return hint || primary;
}

export async function parseSportsModeInput({
  sportTypeHint,
  subjectNameHint,
  teamNameHint,
  opponentNameHint,
  eventNameHint,
  seasonHint,
  rawDetails,
}: {
  sportTypeHint: string | null;
  subjectNameHint: string | null;
  teamNameHint: string | null;
  opponentNameHint: string | null;
  eventNameHint: string | null;
  seasonHint: string | null;
  rawDetails: string;
}): Promise<ParsedSportsMode> {
  const systemPrompt = `You extract structured sports memory data from a user's description.

Return ONLY valid JSON in this shape:
{
  "sportType": "string or null",
  "subjectName": "string or null",
  "teamName": "string or null",
  "opponentName": "string or null",
  "eventName": "string or null",
  "season": "string or null",
  "outcome": "win|loss|tie|unknown",
  "finalScore": "string or null",
  "summary": "1-2 sentence grounded recap",
  "statLines": [
    { "label": "stat label", "value": "stat value" }
  ],
  "highlights": ["short bullet", "short bullet"]
}

Rules:
- Use only what is explicitly stated or a direct restatement of the input.
- Do not invent teams, opponents, dates, or stats.
- Convert common sports shorthand into readable stat labels.
- Keep stat values as short strings so they can handle any sport.
- If the outcome cannot be determined, use "unknown".
- Summary should be concise and factual.`;

  const userMessage = [
    `Sport hint: ${sportTypeHint || 'None'}`,
    `Subject/player hint: ${subjectNameHint || 'None'}`,
    `Team hint: ${teamNameHint || 'None'}`,
    `Opponent hint: ${opponentNameHint || 'None'}`,
    `Event hint: ${eventNameHint || 'None'}`,
    `Season hint: ${seasonHint || 'None'}`,
    `Raw sports details: ${rawDetails}`,
  ].join('\n');

  const response = await chat(systemPrompt, [{ role: 'user', content: userMessage }]);
  const parsed = JSON.parse(extractJsonObject(response)) as Record<string, unknown>;

  return {
    sportType: applyHint(sanitizeString(parsed.sportType), sportTypeHint),
    subjectName: applyHint(sanitizeString(parsed.subjectName), subjectNameHint),
    teamName: applyHint(sanitizeString(parsed.teamName), teamNameHint),
    opponentName: applyHint(sanitizeString(parsed.opponentName), opponentNameHint),
    eventName: applyHint(sanitizeString(parsed.eventName), eventNameHint),
    season: applyHint(sanitizeString(parsed.season), seasonHint),
    outcome: normalizeOutcome(parsed.outcome),
    finalScore: sanitizeString(parsed.finalScore),
    rawDetails,
    summary: sanitizeString(parsed.summary),
    statLines: sanitizeStatLines(parsed.statLines),
    highlights: sanitizeStringList(parsed.highlights),
  };
}

export function parseSportsModeJson(value: string | null): SportsStatLine[] {
  if (!value) {
    return [];
  }

  try {
    return sanitizeStatLines(JSON.parse(value));
  } catch {
    return [];
  }
}

export function parseSportsHighlightsJson(value: string | null): string[] {
  if (!value) {
    return [];
  }

  try {
    return sanitizeStringList(JSON.parse(value));
  } catch {
    return [];
  }
}

export function formatSportsModeContext(sportsMode: {
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
  statLinesJson: string | null;
  highlightsJson: string | null;
}): string {
  const statLines = parseSportsModeJson(sportsMode.statLinesJson);
  const highlights = parseSportsHighlightsJson(sportsMode.highlightsJson);

  return [
    `Sport: ${sportsMode.sportType || 'Unknown'}`,
    `Subject: ${sportsMode.subjectName || 'Unknown'}`,
    `Team: ${sportsMode.teamName || 'Unknown'}`,
    `Opponent: ${sportsMode.opponentName || 'Unknown'}`,
    `Event: ${sportsMode.eventName || 'Unknown'}`,
    `Season: ${sportsMode.season || 'Unknown'}`,
    `Outcome: ${sportsMode.outcome || 'Unknown'}`,
    `Final score: ${sportsMode.finalScore || 'Unknown'}`,
    `Summary: ${sportsMode.summary || 'None'}`,
    `Stat lines:\n${statLines.map((item) => `- ${item.label}: ${item.value}`).join('\n') || '- None'}`,
    `Highlights:\n${highlights.map((item) => `- ${item}`).join('\n') || '- None'}`,
    `Raw sports details: ${sportsMode.rawDetails}`,
  ].join('\n');
}
