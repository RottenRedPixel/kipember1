export type ConfirmedLocationContext = {
  label: string;
  detail: string | null;
  kind: string;
  latitude: number | null;
  longitude: number | null;
  confirmedAt: string;
};

export type LocationSuggestion = {
  id: string;
  label: string;
  detail: string | null;
  kind: 'place' | 'address' | 'neighborhood' | 'city' | 'region' | 'coordinates';
};

type ReverseGeocodeResponse = {
  name?: string;
  display_name?: string;
  address?: Record<string, string | undefined>;
};

function compactDetail(parts: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const values: string[] = [];

  for (const part of parts) {
    const trimmed = typeof part === 'string' ? part.trim() : '';
    if (!trimmed) {
      continue;
    }

    const normalized = trimmed.toLowerCase();
    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    values.push(trimmed);
  }

  return values.length > 0 ? values.join(', ') : null;
}

function firstDefined(address: Record<string, string | undefined>, keys: string[]) {
  for (const key of keys) {
    const value = address[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function createSuggestionId(kind: string, label: string, detail: string | null) {
  return `${kind}:${label.toLowerCase()}|${(detail || '').toLowerCase()}`;
}

function dedupeSuggestions(items: LocationSuggestion[]) {
  const seen = new Set<string>();
  const result: LocationSuggestion[] = [];

  for (const item of items) {
    const key = createSuggestionId(item.kind, item.label, item.detail);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push({
      ...item,
      id: key,
    });
  }

  return result;
}

export function parseConfirmedLocationContext(
  metadataJson: string | null | undefined
): ConfirmedLocationContext | null {
  if (!metadataJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(metadataJson) as Record<string, unknown>;
    const raw = parsed.confirmedLocation;

    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const candidate = raw as Record<string, unknown>;
    const label =
      typeof candidate.label === 'string' && candidate.label.trim()
        ? candidate.label.trim()
        : null;

    if (!label) {
      return null;
    }

    return {
      label,
      detail:
        typeof candidate.detail === 'string' && candidate.detail.trim()
          ? candidate.detail.trim()
          : null,
      kind:
        typeof candidate.kind === 'string' && candidate.kind.trim()
          ? candidate.kind.trim()
          : 'place',
      latitude:
        typeof candidate.latitude === 'number' && Number.isFinite(candidate.latitude)
          ? candidate.latitude
          : null,
      longitude:
        typeof candidate.longitude === 'number' && Number.isFinite(candidate.longitude)
          ? candidate.longitude
          : null,
      confirmedAt:
        typeof candidate.confirmedAt === 'string' && candidate.confirmedAt.trim()
          ? candidate.confirmedAt
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function mergeConfirmedLocationContext({
  metadataJson,
  context,
}: {
  metadataJson: string | null | undefined;
  context: ConfirmedLocationContext;
}) {
  const parsed =
    metadataJson && metadataJson.trim()
      ? (() => {
          try {
            const candidate = JSON.parse(metadataJson);
            return candidate && typeof candidate === 'object'
              ? (candidate as Record<string, unknown>)
              : {};
          } catch {
            return {};
          }
        })()
      : {};

  parsed.confirmedLocation = context;
  return JSON.stringify(parsed);
}

export async function getLocationSuggestionsForCoordinates({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}): Promise<LocationSuggestion[]> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('lat', latitude.toString());
  url.searchParams.set('lon', longitude.toString());
  url.searchParams.set('zoom', '18');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('namedetails', '1');

  const response = await fetch(url.toString(), {
    headers: {
      'Accept-Language': 'en',
      'User-Agent': 'EmberMemoryWiki/1.0',
    },
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error('Failed to look up nearby places from the photo coordinates');
  }

  const payload = (await response.json()) as ReverseGeocodeResponse;
  const address = payload.address || {};

  const street = firstDefined(address, ['road', 'pedestrian', 'footway', 'cycleway']);
  const houseNumber = firstDefined(address, ['house_number']);
  const streetAddress = compactDetail([houseNumber, street]);
  const placeName = firstDefined(address, [
    'attraction',
    'amenity',
    'building',
    'shop',
    'leisure',
    'tourism',
    'historic',
  ]);
  const neighborhood = firstDefined(address, [
    'neighbourhood',
    'suburb',
    'quarter',
    'city_district',
    'borough',
    'hamlet',
  ]);
  const city = firstDefined(address, ['city', 'town', 'village', 'municipality']);
  const county = firstDefined(address, ['county']);
  const state = firstDefined(address, ['state']);
  const country = firstDefined(address, ['country']);

  const suggestions: LocationSuggestion[] = [];

  if (placeName) {
    suggestions.push({
      id: '',
      label: placeName,
      detail: compactDetail([streetAddress, neighborhood, city, state]),
      kind: 'place',
    });
  }

  if (streetAddress) {
    suggestions.push({
      id: '',
      label: streetAddress,
      detail: compactDetail([neighborhood, city, state]),
      kind: 'address',
    });
  }

  if (neighborhood) {
    suggestions.push({
      id: '',
      label: neighborhood,
      detail: compactDetail([city, state, country]),
      kind: 'neighborhood',
    });
  }

  if (city) {
    suggestions.push({
      id: '',
      label: city,
      detail: compactDetail([state, country]),
      kind: 'city',
    });
  }

  const regionDetail = compactDetail([county, state, country]);
  if (regionDetail) {
    suggestions.push({
      id: '',
      label: county || state || 'Nearby region',
      detail:
        county && state
          ? compactDetail([state, country])
          : compactDetail([country]),
      kind: 'region',
    });
  }

  suggestions.push({
    id: '',
    label: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
    detail: 'Exact GPS coordinates from the photo metadata',
    kind: 'coordinates',
  });

  return dedupeSuggestions(suggestions).slice(0, 5);
}
