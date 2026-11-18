export type TravelMode = 'auto' | 'driving' | 'walking' | 'transit';
export type TargetProvider = 'google-dir' | 'waze' | 'apple-maps' | 'google-place';

export interface ParsedLocation {
  placeName: string;
  lat: number | null;
  lng: number | null;
  coordSource: 'pin' | 'viewport' | 'query' | 'manual' | 'none';
  rawInput: string;
  isValid: boolean;
  errorMessage?: string;
}

export const DEFAULT_MAPS_URL =
  'https://www.google.com/maps/place/Clinique+mont+carmel/@5.3552392,-4.1086511,15z/data=!4m10!1m2!2m1!1sClinical+Mont+Carmel!3m6!1s0xfc1c198ab6d5177:0xaeb7e4aac1ea0424!8m2!3d5.3552392!4d-4.0985352!15sChRDbGluaWNhbCBNb250IENhcm1lbJIBCGhvc3BpdGFs4AEA!16s%2Fg%2F11fpmc8g75?hl=fr&entry=ttu&g_ep=EgoyMDI2MTExNS4wIKXMDSoASAFQAw%3D%3D';

function safeDecodePlaceName(raw: string): string {
  try {
    return decodeURIComponent(raw.replace(/\+/g, ' ')).trim();
  } catch {
    return raw.replace(/\+/g, ' ').trim();
  }
}

export function parseGoogleMapsInput(input: string): ParsedLocation {
  const trimmed = input.trim();

  if (!trimmed) {
    return {
      placeName: '',
      lat: null,
      lng: null,
      coordSource: 'none',
      rawInput: trimmed,
      isValid: false,
      errorMessage: 'Collez un lien Google Maps ou des coordonnées GPS (latitude, longitude).',
    };
  }

  // 1. Direct coordinates input: "5.3861726, -4.0155503"
  const directCoordsMatch = trimmed.match(/^(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (directCoordsMatch) {
    const lat = Number.parseFloat(directCoordsMatch[1]);
    const lng = Number.parseFloat(directCoordsMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return {
        placeName: 'Destination GPS',
        lat,
        lng,
        coordSource: 'manual',
        rawInput: trimmed,
        isValid: true,
      };
    }
  }

  // 2. Extract place name from /place/<Name>/
  let placeName = '';
  const placeMatch = trimmed.match(/\/place\/([^/@?#]+)/i);
  if (placeMatch && placeMatch[1]) {
    placeName = safeDecodePlaceName(placeMatch[1]);
  }

  // 3. Priority 1: Exact pin coordinates (!3dLAT!4dLNG)
  const pinMatch = trimmed.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (pinMatch) {
    const lat = Number.parseFloat(pinMatch[1]);
    const lng = Number.parseFloat(pinMatch[2]);
    return {
      placeName: placeName || 'Destination Google Maps',
      lat,
      lng,
      coordSource: 'pin',
      rawInput: trimmed,
      isValid: true,
    };
  }

  // 4. Priority 2: Query parameters (?q=lat,lng or destination=lat,lng or ll=lat,lng)
  const queryCoordMatch = trimmed.match(/[?&](?:q|query|destination|ll)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i);
  if (queryCoordMatch) {
    const lat = Number.parseFloat(queryCoordMatch[1]);
    const lng = Number.parseFloat(queryCoordMatch[2]);
    return {
      placeName: placeName || 'Destination Google Maps',
      lat,
      lng,
      coordSource: 'query',
      rawInput: trimmed,
      isValid: true,
    };
  }

  // 5. Priority 3: Map viewport center (/@LAT,LNG)
  const viewportMatch = trimmed.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (viewportMatch) {
    const lat = Number.parseFloat(viewportMatch[1]);
    const lng = Number.parseFloat(viewportMatch[2]);
    return {
      placeName: placeName || 'Destination Google Maps',
      lat,
      lng,
      coordSource: 'viewport',
      rawInput: trimmed,
      isValid: true,
    };
  }

  // 6. Fallback: Check if it's a short maps.app.goo.gl or goo.gl/maps URL
  if (/^https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps)\/\S+/i.test(trimmed)) {
    return {
      placeName: 'Lien court Google Maps',
      lat: null,
      lng: null,
      coordSource: 'none',
      rawInput: trimmed,
      isValid: false,
      errorMessage:
        'Les liens courts (maps.app.goo.gl) ne contiennent pas les coordonnées directement. Ouvrez ce lien dans votre navigateur et copiez l’URL complète.',
    };
  }

  return {
    placeName: '',
    lat: null,
    lng: null,
    coordSource: 'none',
    rawInput: trimmed,
    isValid: false,
    errorMessage:
      'Coordonnées introuvables dans ce lien. Collez l’URL complète Google Maps (contenant @lat,lng ou !3dlat!4dlng) ou saisissez des coordonnées GPS.',
  };
}

export function buildNavigationUrl(
  lat: number,
  lng: number,
  provider: TargetProvider,
  travelMode: TravelMode
): string {
  const coords = `${lat},${lng}`;

  switch (provider) {
    case 'google-dir': {
      const base = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(coords)}`;
      if (travelMode !== 'auto') {
        return `${base}&travelmode=${travelMode}`;
      }
      return base;
    }
    case 'waze':
      return `https://waze.com/ul?ll=${encodeURIComponent(coords)}&navigate=yes`;
    case 'apple-maps': {
      const dirflg = travelMode === 'walking' ? 'w' : travelMode === 'transit' ? 'r' : 'd';
      return `https://maps.apple.com/?daddr=${encodeURIComponent(coords)}&dirflg=${dirflg}`;
    }
    case 'google-place':
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coords)}`;
  }
}
