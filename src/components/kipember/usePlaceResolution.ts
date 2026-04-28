'use client';

import { useEffect, useState } from 'react';

export type LocationSuggestion = {
  id: string;
  label: string;
  detail: string | null;
  kind: string;
  country?: string | null;
};

export type PlaceResolutionDetail = {
  id?: string | null;
  analysis?: {
    latitude?: number | null;
    longitude?: number | null;
    confirmedLocation?: {
      label?: string | null;
      detail?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      confirmedAt?: string | null;
    } | null;
  } | null;
} | null;

export type PlaceResolution = {
  placeName: string | null;
  addressSource: string | null;
  addressLines: string[];
  showExactAddress: boolean;
  coordinateLine: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  source: 'manual' | 'gps' | 'none';
  confirmedAt: string | null;
  isLoading: boolean;
  exactAddressSuggestion: LocationSuggestion | null;
  nearbyPlaceSuggestion: LocationSuggestion | null;
};

const suggestionCache = new Map<string, Promise<LocationSuggestion[]>>();

function cacheKey(imageId: string, latitude: number, longitude: number) {
  return `${imageId}|${latitude.toFixed(5)}|${longitude.toFixed(5)}`;
}

export function clearPlaceResolutionCache(imageId: string | null | undefined) {
  if (!imageId) return;
  for (const key of suggestionCache.keys()) {
    if (key.startsWith(`${imageId}|`)) {
      suggestionCache.delete(key);
    }
  }
}

function fetchSuggestions(
  imageId: string,
  latitude: number,
  longitude: number,
  signal: AbortSignal
): Promise<LocationSuggestion[]> {
  const key = cacheKey(imageId, latitude, longitude);
  const existing = suggestionCache.get(key);
  if (existing) {
    return existing;
  }

  const promise = fetch(`/api/images/${imageId}/location-suggestions`, { signal })
    .then((response) => {
      if (!response.ok) {
        throw new Error('Failed to load location suggestions');
      }
      return response.json() as Promise<{ suggestions?: LocationSuggestion[] }>;
    })
    .then((payload) =>
      Array.isArray(payload.suggestions) ? payload.suggestions : []
    )
    .catch((error) => {
      suggestionCache.delete(key);
      throw error;
    });

  suggestionCache.set(key, promise);
  return promise;
}

export function formatCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined
) {
  if (latitude == null || longitude == null) {
    return null;
  }
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

const US_COUNTRY_PATTERN = /^(USA|United States|US|U\.S\.|U\.S\.A\.)$/i;

function resolveCountry({
  addressSource,
  suggestionCountry,
}: {
  addressSource: string | null;
  suggestionCountry: string | null;
}): string | null {
  if (suggestionCountry) {
    return suggestionCountry;
  }
  if (!addressSource) {
    return null;
  }
  const parts = addressSource
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) {
    return null;
  }
  const last = parts[parts.length - 1];
  if (US_COUNTRY_PATTERN.test(last)) {
    return last;
  }
  // Trailing alphabetic-only token after multiple parts is almost always a country
  // (slider always saves country as the last comma-separated segment).
  if (!/\d/.test(last) && /[A-Za-z]/.test(last) && last.length <= 56) {
    return last;
  }
  return null;
}

function stripTrailingCountry(
  source: string | null,
  country: string
): string | null {
  if (!source) return null;
  const trimmedSource = source.trim();
  const target = country.trim().toLowerCase();
  if (!target) return source;
  const parts = trimmedSource.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) {
    return trimmedSource;
  }
  if (parts[parts.length - 1].toLowerCase() === target) {
    return parts.slice(0, -1).join(', ');
  }
  return trimmedSource;
}

const US_STATES_FOR_DISPLAY = new Set<string>([
  'alabama','alaska','arizona','arkansas','california','colorado','connecticut',
  'delaware','florida','georgia','hawaii','idaho','illinois','indiana','iowa',
  'kansas','kentucky','louisiana','maine','maryland','massachusetts','michigan',
  'minnesota','mississippi','missouri','montana','nebraska','nevada',
  'new hampshire','new jersey','new mexico','new york','north carolina',
  'north dakota','ohio','oklahoma','oregon','pennsylvania','rhode island',
  'south carolina','south dakota','tennessee','texas','utah','vermont',
  'virginia','washington','west virginia','wisconsin','wyoming',
  'district of columbia',
  'al','ak','az','ar','ca','co','ct','de','fl','ga','hi','id','il','in','ia',
  'ks','ky','la','me','md','ma','mi','mn','ms','mo','mt','ne','nv','nh','nj',
  'nm','ny','nc','nd','oh','ok','or','pa','ri','sc','sd','tn','tx','ut','vt',
  'va','wa','wv','wi','wy','dc',
]);

export function formatUsPostalAddress(detail: string | null | undefined): string[] {
  if (typeof detail !== 'string') return [];
  const parts = detail
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length <= 1) return parts;

  const stateZipIdx = parts.findIndex((part) =>
    /\b[A-Z]{2}\s+\d{5}(-\d{4})?$/.test(part) ||
    /\b[A-Z][A-Za-z]+\s+\d{5}(-\d{4})?$/.test(part)
  );

  const lines: string[] = [];
  if (stateZipIdx > 0) {
    const street = parts.slice(0, stateZipIdx - 1).join(', ');
    const city = parts[stateZipIdx - 1];
    const stateZip = parts[stateZipIdx];
    if (street) lines.push(street);
    lines.push(`${city}, ${stateZip}`);
  } else {
    const tail = parts[parts.length - 1];
    if (parts.length >= 2 && tail && US_STATES_FOR_DISPLAY.has(tail.toLowerCase())) {
      const stateIdx = parts.length - 1;
      const street = parts.slice(0, stateIdx - 1).join(', ');
      const city = parts[stateIdx - 1];
      const state = parts[stateIdx];
      if (street) lines.push(street);
      lines.push(`${city}, ${state}`);
    } else {
      lines.push(parts.join(', '));
    }
  }
  return lines;
}

export function usePlaceResolution(
  detail: PlaceResolutionDetail
): PlaceResolution {
  const imageId = detail?.id || null;
  const confirmed = detail?.analysis?.confirmedLocation || null;

  const latitude =
    confirmed?.latitude ??
    detail?.analysis?.latitude ??
    null;
  const longitude =
    confirmed?.longitude ??
    detail?.analysis?.longitude ??
    null;

  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!imageId || latitude == null || longitude == null) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setIsLoading(true);

    fetchSuggestions(imageId, latitude, longitude, controller.signal)
      .then((result) => {
        if (cancelled) return;
        setSuggestions(result);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('Failed to resolve wiki location details:', error);
        setSuggestions([]);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [imageId, latitude, longitude]);

  const exactAddressSuggestion =
    suggestions.find((suggestion) => suggestion.kind === 'address') || null;
  const nearbyPlaceSuggestion =
    suggestions.find((suggestion) => suggestion.kind === 'place') ||
    suggestions.find((suggestion) => suggestion.kind === 'neighborhood') ||
    suggestions.find((suggestion) => suggestion.kind === 'city') ||
    null;

  const placeName =
    confirmed?.label?.trim() ||
    nearbyPlaceSuggestion?.label?.trim() ||
    exactAddressSuggestion?.label?.trim() ||
    null;

  const addressSource =
    confirmed?.detail?.trim() ||
    exactAddressSuggestion?.detail?.trim() ||
    exactAddressSuggestion?.label?.trim() ||
    null;

  const country = resolveCountry({
    addressSource,
    suggestionCountry:
      exactAddressSuggestion?.country?.trim() ||
      nearbyPlaceSuggestion?.country?.trim() ||
      null,
  });

  const addressForFormatting = country
    ? stripTrailingCountry(addressSource, country)
    : addressSource;
  const addressLines = formatUsPostalAddress(addressForFormatting);
  const showExactAddress =
    addressLines.length > 0 &&
    (addressLines.length > 1 || addressLines[0] !== placeName);

  const source: PlaceResolution['source'] = confirmed?.confirmedAt
    ? 'manual'
    : latitude != null && longitude != null
      ? 'gps'
      : 'none';

  return {
    placeName,
    addressSource,
    addressLines,
    showExactAddress,
    coordinateLine: formatCoordinates(latitude, longitude),
    country,
    latitude,
    longitude,
    source,
    confirmedAt: confirmed?.confirmedAt ?? null,
    isLoading,
    exactAddressSuggestion,
    nearbyPlaceSuggestion,
  };
}
