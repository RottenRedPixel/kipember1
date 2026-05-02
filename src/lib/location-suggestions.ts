import { chat } from '@/lib/claude';
import { renderPromptTemplate } from '@/lib/control-plane';

export type ConfirmedLocationContext = {
  label: string;
  detail: string | null;
  kind: string;
  latitude: number | null;
  longitude: number | null;
  placeId?: string | null;
  confidence?: string | null;
  reason?: string | null;
  confirmedAt: string;
};

export type LocationSuggestion = {
  id: string;
  label: string;
  detail: string | null;
  kind: 'place' | 'address' | 'neighborhood' | 'city' | 'region' | 'coordinates';
  latitude?: number | null;
  longitude?: number | null;
  placeId?: string | null;
  confidence?: 'high' | 'medium' | 'low';
  reason?: string | null;
  country?: string | null;
};

type ReverseGeocodeResponse = {
  name?: string;
  display_name?: string;
  address?: Record<string, string | undefined>;
};

type GoogleAddressComponent = {
  long_name?: string;
  short_name?: string;
  types?: string[];
};

type GoogleGeocodeResponse = {
  results?: Array<{
    formatted_address?: string;
    place_id?: string;
    geometry?: {
      location?: {
        lat?: number;
        lng?: number;
      };
    };
    types?: string[];
    address_components?: GoogleAddressComponent[];
  }>;
};

function extractCountryFromGeocode(result: GoogleGeocodeResult | undefined) {
  const component = result?.address_components?.find((part) =>
    Array.isArray(part.types) && part.types.includes('country')
  );
  const value = component?.long_name?.trim();
  return value ? value : null;
}

type GoogleGeocodeResult = NonNullable<GoogleGeocodeResponse['results']>[number];

type GooglePlacesNearbyResponse = {
  results?: Array<{
    name?: string;
    place_id?: string;
    vicinity?: string;
    business_status?: string;
    types?: string[];
    geometry?: {
      location?: {
        lat?: number;
        lng?: number;
      };
    };
  }>;
};

type RankedLocationResult = {
  bestLocation?: {
    name?: string | null;
    address?: string | null;
    placeId?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    locationType?: string | null;
    confidence?: 'high' | 'medium' | 'low';
    reason?: string | null;
  } | null;
  alternates?: Array<{
    name?: string | null;
    address?: string | null;
    placeId?: string | null;
    confidence?: 'high' | 'medium' | 'low';
    reason?: string | null;
  }>;
};

type LocationResolutionContext = {
  visualAnalysis?: unknown;
  metadataSummary?: string | null;
  userDescription?: string | null;
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

function getGoogleMapsApiKey() {
  return process.env.GOOGLE_MAPS_API_KEY?.trim() || '';
}

function safeJson(value: unknown) {
  return JSON.stringify(value ?? null, null, 2);
}

function extractJsonObject(text: string): string {
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    throw new Error('Expected a JSON object in location resolution response');
  }

  return text.slice(firstBrace, lastBrace + 1);
}

function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
) {
  const earthRadiusMeters = 6_371_000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * earthRadiusMeters * Math.asin(Math.min(1, Math.sqrt(h)));
}

function normalizePlaceType(types: string[] | undefined): LocationSuggestion['kind'] {
  const values = new Set((types || []).map((type) => type.toLowerCase()));
  if (
    values.has('restaurant') ||
    values.has('cafe') ||
    values.has('bar') ||
    values.has('bakery') ||
    values.has('meal_takeaway') ||
    values.has('meal_delivery')
  ) {
    return 'place';
  }
  if (values.has('street_address') || values.has('premise')) {
    return 'address';
  }
  if (values.has('neighborhood') || values.has('sublocality')) {
    return 'neighborhood';
  }
  if (values.has('locality')) {
    return 'city';
  }
  return 'place';
}

function isResidentialAddressResult(result: GoogleGeocodeResult | undefined) {
  const types = new Set((result?.types || []).map((type) => type.toLowerCase()));
  return types.has('street_address') || types.has('premise') || types.has('subpremise');
}

function buildAddressSuggestion({
  latitude,
  longitude,
  result,
  reason,
}: {
  latitude: number;
  longitude: number;
  result: GoogleGeocodeResult;
  reason?: string;
}): LocationSuggestion {
  return {
    id: '',
    label: result.formatted_address || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
    detail: 'Reverse-geocoded address from photo GPS',
    kind: normalizePlaceType(result.types),
    latitude: result.geometry?.location?.lat ?? latitude,
    longitude: result.geometry?.location?.lng ?? longitude,
    placeId: result.place_id || null,
    confidence: 'high',
    reason: reason || null,
    country: extractCountryFromGeocode(result),
  };
}

function buildCoordinateSuggestion(latitude: number, longitude: number): LocationSuggestion {
  return {
    id: '',
    label: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
    detail: 'Exact GPS coordinates from the photo metadata',
    kind: 'coordinates',
    latitude,
    longitude,
  };
}

function hasStrongPublicPlaceCandidate(nearby: GooglePlacesNearbyResponse) {
  const publicTypes = new Set([
    'amusement_park',
    'aquarium',
    'art_gallery',
    'bakery',
    'bar',
    'bowling_alley',
    'cafe',
    'casino',
    'church',
    'city_hall',
    'food',
    'gym',
    'landmark',
    'library',
    'lodging',
    'meal_delivery',
    'meal_takeaway',
    'movie_theater',
    'museum',
    'night_club',
    'park',
    'restaurant',
    'school',
    'shopping_mall',
    'stadium',
    'tourist_attraction',
    'university',
    'zoo',
  ]);

  return (nearby.results || []).some((place) => {
    if (!place.name?.trim() || place.business_status === 'CLOSED_PERMANENTLY') {
      return false;
    }

    return (place.types || []).some((type) => publicTypes.has(type.toLowerCase()));
  });
}

function hasPublicPlaceContext(context?: LocationResolutionContext) {
  const text = safeJson(context || {}).toLowerCase();
  return /\b(restaurant|dining|menu|table|server|stadium|arena|game|court|field|concert|stage|castle|theme park|park|venue|store|shop|hotel|museum|school|church|bar|cafe|coffee|bakery|signage|logo|uniform)\b/.test(text);
}

async function fetchGoogleReverseGeocode({
  latitude,
  longitude,
  apiKey,
}: {
  latitude: number;
  longitude: number;
  apiKey: string;
}) {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('latlng', `${latitude},${longitude}`);
  url.searchParams.set('key', apiKey);

  const response = await fetch(url.toString(), { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Google geocode lookup failed');
  }

  return (await response.json()) as GoogleGeocodeResponse;
}

async function fetchGoogleNearbyPlaces({
  latitude,
  longitude,
  apiKey,
  radius = 90,
  type,
}: {
  latitude: number;
  longitude: number;
  apiKey: string;
  radius?: number;
  type?: string;
}) {
  const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
  url.searchParams.set('location', `${latitude},${longitude}`);
  url.searchParams.set('radius', radius.toString());
  if (type) {
    url.searchParams.set('type', type);
  }
  url.searchParams.set('key', apiKey);

  const response = await fetch(url.toString(), { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Google nearby place lookup failed');
  }

  return (await response.json()) as GooglePlacesNearbyResponse;
}

function mergeGoogleNearbyResponses(
  ...responses: Array<GooglePlacesNearbyResponse | null | undefined>
): GooglePlacesNearbyResponse {
  const seen = new Set<string>();
  const results: NonNullable<GooglePlacesNearbyResponse['results']> = [];

  for (const response of responses) {
    for (const place of response?.results || []) {
      const key = place.place_id || `${place.name || ''}|${place.vicinity || ''}`;
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      results.push(place);
    }
  }

  return { results };
}

function buildGoogleSuggestions({
  latitude,
  longitude,
  geocode,
  nearby,
  context,
}: {
  latitude: number;
  longitude: number;
  geocode: GoogleGeocodeResponse;
  nearby: GooglePlacesNearbyResponse;
  context?: LocationResolutionContext;
}) {
  const suggestions: LocationSuggestion[] = [];
  const bestAddress = geocode.results?.[0];
  const geocodeCountry = extractCountryFromGeocode(bestAddress);

  if (
    bestAddress?.formatted_address &&
    isResidentialAddressResult(bestAddress) &&
    !hasStrongPublicPlaceCandidate(nearby) &&
    !hasPublicPlaceContext(context)
  ) {
    suggestions.push(
      buildAddressSuggestion({
        latitude,
        longitude,
        result: bestAddress,
        reason: 'GPS resolved to a residential address with no strong public-place match, so nearby businesses were filtered out.',
      })
    );
    suggestions.push(buildCoordinateSuggestion(latitude, longitude));
    return dedupeSuggestions(suggestions).slice(0, 3);
  }

  for (const place of nearby.results || []) {
    if (!place.name?.trim() || place.business_status === 'CLOSED_PERMANENTLY') {
      continue;
    }

    const placeLat = place.geometry?.location?.lat;
    const placeLng = place.geometry?.location?.lng;
    const distance =
      typeof placeLat === 'number' && typeof placeLng === 'number'
        ? Math.round(distanceMeters(
            { latitude, longitude },
            { latitude: placeLat, longitude: placeLng }
          ))
        : null;

    suggestions.push({
      id: '',
      label: place.name.trim(),
      detail: compactDetail([
        place.vicinity,
        place.types?.slice(0, 4).join(', '),
        distance != null ? `${distance}m from photo GPS` : null,
      ]),
      kind: normalizePlaceType(place.types),
      latitude: placeLat ?? null,
      longitude: placeLng ?? null,
      placeId: place.place_id || null,
      country: geocodeCountry,
    });
  }

  if (bestAddress?.formatted_address) {
    suggestions.push(buildAddressSuggestion({ latitude, longitude, result: bestAddress }));
  }

  suggestions.push(buildCoordinateSuggestion(latitude, longitude));

  return dedupeSuggestions(suggestions).slice(0, 12);
}

async function rankLocationSuggestions({
  latitude,
  longitude,
  suggestions,
  geocode,
  context,
}: {
  latitude: number;
  longitude: number;
  suggestions: LocationSuggestion[];
  geocode: GoogleGeocodeResponse | null;
  context?: LocationResolutionContext;
}) {
  if (suggestions.length === 0) {
    return suggestions;
  }

  const reverseGeocodeAddress = geocode?.results?.[0]?.formatted_address || null;
  const prompt = await renderPromptTemplate('image_analysis.location_resolution', '', {
    gpsCoordinates: `${latitude}, ${longitude}`,
    reverseGeocodeAddress: reverseGeocodeAddress || '',
    placeCandidates: safeJson(
      suggestions.map((suggestion) => ({
        name: suggestion.label,
        address: suggestion.detail,
        placeId: suggestion.placeId,
        latitude: suggestion.latitude,
        longitude: suggestion.longitude,
        kind: suggestion.kind,
      }))
    ),
    visualAnalysis: safeJson(context?.visualAnalysis || null),
    metadataSummary: context?.metadataSummary || '',
    userDescription: context?.userDescription || '',
  });

  const response = await chat(
    prompt,
    [
      {
        role: 'user',
        content: 'Rank the provided candidates and return the requested JSON only.',
      },
    ],
    {
      capabilityKey: 'image_analysis.location_resolution',
      fallbackModel: 'claude-sonnet-4-20250514',
      maxTokens: 900,
    }
  );

  const parsed = JSON.parse(extractJsonObject(response)) as RankedLocationResult;
  const rankedKeys = [
    parsed.bestLocation?.placeId,
    parsed.bestLocation?.name,
    ...(parsed.alternates || []).flatMap((alternate) => [alternate.placeId, alternate.name]),
  ]
    .map((value) => (typeof value === 'string' ? value.trim().toLowerCase() : ''))
    .filter(Boolean);

  const rankByIdOrName = new Map<string, number>();
  rankedKeys.forEach((key, index) => {
    if (!rankByIdOrName.has(key)) {
      rankByIdOrName.set(key, index);
    }
  });

  const best = parsed.bestLocation || null;
  return [...suggestions]
    .map((suggestion, originalIndex) => {
      const rank =
        rankByIdOrName.get((suggestion.placeId || '').toLowerCase()) ??
        rankByIdOrName.get(suggestion.label.toLowerCase()) ??
        100 + originalIndex;
      const isBest =
        (best?.placeId && suggestion.placeId === best.placeId) ||
        (best?.name && suggestion.label.toLowerCase() === best.name.toLowerCase());

      return {
        ...suggestion,
        confidence: isBest ? best?.confidence || suggestion.confidence : suggestion.confidence,
        reason: isBest ? best?.reason || suggestion.reason : suggestion.reason,
        _rank: rank,
      };
    })
    .sort((a, b) => a._rank - b._rank)
    .map(({ _rank, ...suggestion }) => suggestion);
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
      placeId:
        typeof candidate.placeId === 'string' && candidate.placeId.trim()
          ? candidate.placeId.trim()
          : null,
      confidence:
        typeof candidate.confidence === 'string' && candidate.confidence.trim()
          ? candidate.confidence.trim()
          : null,
      reason:
        typeof candidate.reason === 'string' && candidate.reason.trim()
          ? candidate.reason.trim()
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

// Persisted cache for the geocode + LLM ranking result so we don't re-spend
// Google + Claude tokens on every wiki page load. Keyed by lat/lng so a new
// photo (different coords) misses the cache automatically.
export type LocationSuggestionsCache = {
  latitude: number;
  longitude: number;
  suggestions: LocationSuggestion[];
  cachedAt: string;
};

const COORD_TOLERANCE = 1e-6;

export function parseLocationSuggestionsCache(
  metadataJson: string | null | undefined,
  latitude: number,
  longitude: number
): LocationSuggestion[] | null {
  if (!metadataJson) return null;
  try {
    const parsed = JSON.parse(metadataJson) as Record<string, unknown>;
    const raw = parsed.suggestionsCache;
    if (!raw || typeof raw !== 'object') return null;
    const cache = raw as LocationSuggestionsCache;
    if (
      typeof cache.latitude !== 'number' ||
      typeof cache.longitude !== 'number' ||
      !Array.isArray(cache.suggestions)
    ) {
      return null;
    }
    if (
      Math.abs(cache.latitude - latitude) > COORD_TOLERANCE ||
      Math.abs(cache.longitude - longitude) > COORD_TOLERANCE
    ) {
      return null;
    }
    return cache.suggestions;
  } catch {
    return null;
  }
}

export function mergeLocationSuggestionsCache({
  metadataJson,
  latitude,
  longitude,
  suggestions,
}: {
  metadataJson: string | null | undefined;
  latitude: number;
  longitude: number;
  suggestions: LocationSuggestion[];
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

  parsed.suggestionsCache = {
    latitude,
    longitude,
    suggestions,
    cachedAt: new Date().toISOString(),
  } satisfies LocationSuggestionsCache;
  return JSON.stringify(parsed);
}

export async function getLocationSuggestionsForCoordinates({
  latitude,
  longitude,
  context,
}: {
  latitude: number;
  longitude: number;
  context?: LocationResolutionContext;
}): Promise<LocationSuggestion[]> {
  const googleApiKey = getGoogleMapsApiKey();
  if (googleApiKey) {
    try {
      const [geocode, nearby, restaurants, cafes] = await Promise.all([
        fetchGoogleReverseGeocode({ latitude, longitude, apiKey: googleApiKey }),
        fetchGoogleNearbyPlaces({ latitude, longitude, apiKey: googleApiKey }),
        fetchGoogleNearbyPlaces({ latitude, longitude, apiKey: googleApiKey, radius: 180, type: 'restaurant' }),
        fetchGoogleNearbyPlaces({ latitude, longitude, apiKey: googleApiKey, radius: 180, type: 'cafe' }),
      ]);
      const nearbyCandidates = mergeGoogleNearbyResponses(nearby, restaurants, cafes);
      const suggestions = buildGoogleSuggestions({
        latitude,
        longitude,
        geocode,
        nearby: nearbyCandidates,
        context,
      });
      try {
        return await rankLocationSuggestions({
          latitude,
          longitude,
          suggestions,
          geocode,
          context,
        });
      } catch (rankingError) {
        console.error('Location prompt ranking failed, using Google candidate order:', rankingError);
        return suggestions;
      }
    } catch (error) {
      console.error('Google location resolution failed, falling back to reverse geocode:', error);
    }
  }

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
      country,
    });
  }

  if (streetAddress) {
    suggestions.push({
      id: '',
      label: streetAddress,
      detail: compactDetail([neighborhood, city, state]),
      kind: 'address',
      country,
    });
  }

  if (neighborhood) {
    suggestions.push({
      id: '',
      label: neighborhood,
      detail: compactDetail([city, state, country]),
      kind: 'neighborhood',
      country,
    });
  }

  if (city) {
    suggestions.push({
      id: '',
      label: city,
      detail: compactDetail([state, country]),
      kind: 'city',
      country,
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
      country,
    });
  }

  suggestions.push({
    id: '',
    label: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
    detail: 'Exact GPS coordinates from the photo metadata',
    kind: 'coordinates',
  });

  const deduped = dedupeSuggestions(suggestions).slice(0, 5);

  if (context) {
    try {
      return await rankLocationSuggestions({
        latitude,
        longitude,
        suggestions: deduped,
        geocode: null,
        context,
      });
    } catch (error) {
      console.error('Location prompt ranking failed:', error);
    }
  }

  return deduped;
}
