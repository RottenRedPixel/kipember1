'use client';

import { Calendar, Copy, MapPin } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  usePlaceResolution,
  clearPlaceResolutionCache,
} from '@/components/kipember/usePlaceResolution';

const US_STATES = new Set<string>([
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

function parseAddressParts(detail: string | null | undefined): {
  street: string;
  cityStateZip: string;
  country: string;
} {
  const empty = { street: '', cityStateZip: '', country: '' };
  if (typeof detail !== 'string') return empty;
  const parts = detail
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return empty;

  const last = parts[parts.length - 1];
  const isCountry = /^(USA|United States|US|U\.S\.|U\.S\.A\.)$/i.test(last);
  const country = isCountry ? parts.pop() ?? '' : '';

  const stateZipIdx = parts.findIndex(
    (part) =>
      /\b[A-Z]{2}\s+\d{5}(-\d{4})?$/.test(part) ||
      /\b[A-Z][A-Za-z]+\s+\d{5}(-\d{4})?$/.test(part)
  );
  if (stateZipIdx > 0) {
    const street = parts.slice(0, stateZipIdx - 1).join(', ');
    const city = parts[stateZipIdx - 1];
    const stateZip = parts[stateZipIdx];
    return { street, cityStateZip: `${city}, ${stateZip}`, country };
  }

  const tail = parts[parts.length - 1];
  if (parts.length >= 2 && tail && US_STATES.has(tail.toLowerCase())) {
    const stateIdx = parts.length - 1;
    const street = parts.slice(0, stateIdx - 1).join(', ');
    const city = parts[stateIdx - 1];
    const state = parts[stateIdx];
    return { street, cityStateZip: `${city}, ${state}`, country };
  }

  return { street: parts.join(', '), cityStateZip: '', country };
}

type TimePlaceDetail = {
  analysis?: {
    capturedAt?: string | Date | null;
    latitude?: number | null;
    longitude?: number | null;
    confirmedLocation?: {
      label?: string | null;
      detail?: string | null;
      latitude?: number | null;
      longitude?: number | null;
    } | null;
  } | null;
};

export default function EditTimePlaceSlider({
  detail,
  imageId,
  refreshDetail,
  onStatus,
}: {
  detail: TimePlaceDetail | null;
  imageId: string | null;
  refreshDetail: () => Promise<unknown>;
  onStatus?: (message: string) => void;
}) {
  const [timeDateValue, setTimeDateValue] = useState('');
  const [locationLabel, setLocationLabel] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [locationCityStateZip, setLocationCityStateZip] = useState('');
  const [locationCountry, setLocationCountry] = useState('');
  const [locationLatitude, setLocationLatitude] = useState('');
  const [locationLongitude, setLocationLongitude] = useState('');
  const [savedTimeDateValue, setSavedTimeDateValue] = useState('');
  const [savedLocationLabel, setSavedLocationLabel] = useState('');
  const [savedLocationAddress, setSavedLocationAddress] = useState('');
  const [savedLocationCityStateZip, setSavedLocationCityStateZip] = useState('');
  const [savedLocationCountry, setSavedLocationCountry] = useState('');
  const [savedLocationLat, setSavedLocationLat] = useState('');
  const [savedLocationLng, setSavedLocationLng] = useState('');
  const [timeDateSaving, setTimeDateSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [locationSaving, setLocationSaving] = useState(false);
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  const placeResolution = usePlaceResolution(detail as Parameters<typeof usePlaceResolution>[0]);
  const placePrefilledRef = useRef(false);

  // Sync working + saved state from `detail` whenever it loads or changes.
  useEffect(() => {
    if (!detail) return;

    const capturedAt = detail.analysis?.capturedAt;
    if (capturedAt) {
      const d = new Date(capturedAt);
      if (!Number.isNaN(d.getTime())) {
        const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
        setTimeDateValue(local);
        setSavedTimeDateValue(local);
      }
    }

    const loc = detail.analysis?.confirmedLocation;
    const label = loc?.label || '';
    const fullAddress = loc?.detail || '';
    const parsed = parseAddressParts(fullAddress);
    const lat = detail.analysis?.latitude ?? loc?.latitude ?? null;
    const lng = detail.analysis?.longitude ?? loc?.longitude ?? null;
    const latStr = lat != null ? parseFloat(lat.toFixed(5)).toString() : '';
    const lngStr = lng != null ? parseFloat(lng.toFixed(5)).toString() : '';
    setLocationLabel(label);
    setLocationAddress(parsed.street);
    setLocationCityStateZip(parsed.cityStateZip);
    setLocationCountry(parsed.country);
    setLocationLatitude(latStr);
    setLocationLongitude(lngStr);
    setSavedLocationLabel(label);
    setSavedLocationAddress(parsed.street);
    setSavedLocationCityStateZip(parsed.cityStateZip);
    setSavedLocationCountry(parsed.country);
    setSavedLocationLat(latStr);
    setSavedLocationLng(lngStr);
    setMode('view');
  }, [detail]);

  useEffect(() => {
    placePrefilledRef.current = false;
  }, [imageId]);

  useEffect(() => {
    if (!detail) return;
    if (detail.analysis?.confirmedLocation?.label) return;
    if (placePrefilledRef.current) return;

    const { nearbyPlaceSuggestion, exactAddressSuggestion } = placeResolution;
    if (!nearbyPlaceSuggestion && !exactAddressSuggestion) return;

    placePrefilledRef.current = true;

    if (nearbyPlaceSuggestion) {
      setLocationLabel(nearbyPlaceSuggestion.label);
      setSavedLocationLabel(nearbyPlaceSuggestion.label);
    }
    if (exactAddressSuggestion) {
      const fullAddress = [exactAddressSuggestion.label, exactAddressSuggestion.detail]
        .filter(Boolean)
        .join(', ');
      const parsed = parseAddressParts(fullAddress);
      const country =
        exactAddressSuggestion.country?.trim() ||
        nearbyPlaceSuggestion?.country?.trim() ||
        parsed.country;
      setLocationAddress(parsed.street);
      setSavedLocationAddress(parsed.street);
      setLocationCityStateZip(parsed.cityStateZip);
      setSavedLocationCityStateZip(parsed.cityStateZip);
      setLocationCountry(country);
      setSavedLocationCountry(country);
    } else if (nearbyPlaceSuggestion?.country?.trim()) {
      const country = nearbyPlaceSuggestion.country.trim();
      setLocationCountry(country);
      setSavedLocationCountry(country);
    }
  }, [detail, placeResolution]);

  async function saveTimeDate(): Promise<boolean> {
    if (!imageId || !timeDateValue) return false;
    try {
      const response = await fetch(`/api/images/${imageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capturedAt: new Date(timeDateValue).toISOString() }),
      });
      if (response.ok) {
        setSavedTimeDateValue(timeDateValue);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async function saveLocation(): Promise<boolean> {
    if (!imageId || !locationLabel.trim()) return false;
    try {
      const composedDetail = [locationAddress, locationCityStateZip, locationCountry]
        .map((s) => s.trim())
        .filter(Boolean)
        .join(', ') || null;
      const body: Record<string, unknown> = {
        label: locationLabel.trim(),
        detail: composedDetail,
        kind: 'place',
      };
      const lat = parseFloat(locationLatitude);
      const lng = parseFloat(locationLongitude);
      if (!Number.isNaN(lat)) body.latitude = lat;
      if (!Number.isNaN(lng)) body.longitude = lng;

      const response = await fetch(`/api/images/${imageId}/location-suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (response.ok) {
        setSavedLocationLabel(locationLabel.trim());
        setSavedLocationAddress(locationAddress.trim());
        setSavedLocationCityStateZip(locationCityStateZip.trim());
        setSavedLocationCountry(locationCountry.trim());
        setSavedLocationLat(locationLatitude);
        setSavedLocationLng(locationLongitude);
        clearPlaceResolutionCache(imageId);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  const isTimeDateDirty =
    Boolean(timeDateValue) && timeDateValue !== savedTimeDateValue;
  const isLocationDirty =
    locationLabel !== savedLocationLabel ||
    locationAddress !== savedLocationAddress ||
    locationCityStateZip !== savedLocationCityStateZip ||
    locationCountry !== savedLocationCountry ||
    locationLatitude !== savedLocationLat ||
    locationLongitude !== savedLocationLng;
  const isDirty = isTimeDateDirty || (Boolean(locationLabel.trim()) && isLocationDirty);
  const isSaving = timeDateSaving || locationSaving;

  async function saveAll() {
    setTimeDateSaving(isTimeDateDirty);
    setLocationSaving(Boolean(locationLabel.trim()) && isLocationDirty);
    await Promise.all([
      isTimeDateDirty ? saveTimeDate() : Promise.resolve(),
      Boolean(locationLabel.trim()) && isLocationDirty ? saveLocation() : Promise.resolve(),
    ]);
    setTimeDateSaving(false);
    setLocationSaving(false);
    await refreshDetail();
    setSavedMessage('Time & Place Saved');
    setMode('view');
  }

  const isView = mode === 'view';

  return (
    <>
      {/* Date & Time */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Calendar size={17} color="var(--text-secondary)" strokeWidth={1.6} />
          <h3 className="text-white font-medium text-base">Time &amp; Date</h3>
        </div>
        <input
          type="datetime-local"
          value={timeDateValue}
          onChange={(e) => setTimeDateValue(e.target.value)}
          readOnly={isView}
          className="w-full h-12 px-4 rounded-xl text-sm text-white outline-none"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            colorScheme: 'dark',
            cursor: isView ? 'default' : 'pointer',
            pointerEvents: isView ? 'none' : 'auto',
          }}
        />
      </div>

      {/* Location fields */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <MapPin size={17} color="var(--text-secondary)" strokeWidth={1.6} />
          <h3 className="text-white font-medium text-base">Place</h3>
        </div>
        <div
          className="rounded-xl px-4"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
        >
          <input
            type="text"
            value={locationLabel}
            onChange={(e) => setLocationLabel(e.target.value)}
            placeholder="Name of location"
            readOnly={isView}
            className="w-full h-12 px-0 text-sm text-white placeholder-white/30 outline-none bg-transparent read-only:cursor-default"
          />
          <input
            type="text"
            value={locationAddress}
            onChange={(e) => setLocationAddress(e.target.value)}
            placeholder="Address"
            readOnly={isView}
            className="w-full h-12 px-0 text-sm text-white placeholder-white/30 outline-none bg-transparent read-only:cursor-default"
            style={{ borderTop: '1px solid var(--border-subtle)' }}
          />
          <input
            type="text"
            value={locationCityStateZip}
            onChange={(e) => setLocationCityStateZip(e.target.value)}
            placeholder="City, State ZIP"
            readOnly={isView}
            className="w-full h-12 px-0 text-sm text-white placeholder-white/30 outline-none bg-transparent read-only:cursor-default"
            style={{ borderTop: '1px solid var(--border-subtle)' }}
          />
          <input
            type="text"
            value={locationCountry}
            onChange={(e) => setLocationCountry(e.target.value)}
            placeholder="Country"
            readOnly={isView}
            className="w-full h-12 px-0 text-sm text-white placeholder-white/30 outline-none bg-transparent read-only:cursor-default"
            style={{ borderTop: '1px solid var(--border-subtle)' }}
          />
        </div>
      </div>

      {/* GPS coordinates */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <MapPin size={17} color="var(--text-secondary)" strokeWidth={1.6} />
          <h3 className="text-white font-medium text-base">GPS Data</h3>
        </div>
        <div
          className="rounded-xl px-4 flex items-center gap-2 min-h-[48px]"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
        >
          {locationLatitude && locationLongitude ? (
            <>
              <a
                href={`https://maps.google.com/?q=${locationLatitude},${locationLongitude}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-3 text-sm text-white/80"
              >
                {locationLatitude}, {locationLongitude}
              </a>
              <button
                type="button"
                onClick={() =>
                  void navigator.clipboard.writeText(
                    `${locationLatitude}, ${locationLongitude}`
                  )
                }
                className="flex-shrink-0 p-1 cursor-pointer"
                aria-label="Copy coordinates"
              >
                <Copy size={15} color="var(--text-secondary)" strokeWidth={1.6} />
              </button>
            </>
          ) : (
            <input
              type="text"
              value={locationLatitude || locationLongitude}
              onChange={(e) => {
                const parts = e.target.value.split(',');
                setLocationLatitude(parts[0]?.trim() ?? '');
                setLocationLongitude(parts[1]?.trim() ?? '');
              }}
              placeholder="Latitude, Longitude"
              readOnly={isView}
              className="flex-1 h-12 px-0 text-sm text-white placeholder-white/30 outline-none bg-transparent read-only:cursor-default"
            />
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {isView ? (
          <button
            type="button"
            onClick={() => { setMode('edit'); setSavedMessage(''); }}
            className="w-1/2 ml-auto rounded-full px-5 text-white text-sm font-medium"
            style={{ background: '#f97316', border: 'none', minHeight: 44, cursor: 'pointer' }}
          >
            Edit
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void saveAll()}
            disabled={isSaving || !isDirty}
            className="w-1/2 ml-auto rounded-full px-5 text-white text-sm font-medium disabled:opacity-60"
            style={{
              background: isDirty ? '#f97316' : 'var(--bg-surface)',
              border: isDirty ? 'none' : '1px solid var(--border-subtle)',
              minHeight: 44,
              cursor: isDirty ? 'pointer' : 'default',
            }}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        )}
      </div>
    </>
  );
}
