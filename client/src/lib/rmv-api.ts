// Client-side API wrapper that calls our own backend
// This keeps the API key secure and handles CORS properly

export interface StopLocation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  distance?: number;
}

export interface Trip {
  legs: Leg[];
  duration: string;
  startTime: string;
  startDate: string;
  endTime: string;
  endDate: string;
  price?: number;
}

export interface Leg {
  Origin: {
    name: string;
    time: string;
    date: string;
    track?: string;
    rtTime?: string;
    rtDate?: string;
    rtTrack?: string;
    lat?: number;
    lon?: number;
    Notes?: {
      Note: {
        value?: string;
        key: string;
      }[];
    };
  };
  Destination: {
    name: string;
    time: string;
    date: string;
    track?: string;
    rtTime?: string;
    rtDate?: string;
    rtTrack?: string;
    lat?: number;
    lon?: number;
  };
  name: string; // e.g., "S-Bahn S8"
  type: string; // "JNY"
  transferDuration?: number;
  Messages?: {
    Message: {
      text: string;
      type: string;
    }[];
  };
}

// Helper to format RMV time (hh:mm:ss) to simpler hh:mm
export function formatTime(time: string) {
  if (!time) return "";
  return time.substring(0, 5);
}

// Helper to calculate delay in minutes
export function getDelay(scheduled: string, realTime?: string): number {
  if (!realTime) return 0;

  const [h1, m1] = scheduled.split(':').map(Number);
  const [h2, m2] = realTime.split(':').map(Number);

  const scheduledMins = h1 * 60 + m1;
  const realMins = h2 * 60 + m2;

  return realMins - scheduledMins;
}

export async function searchLocation(query: string): Promise<StopLocation[]> {
  try {
    // First, try exact search with the original query
    const res = await fetch(`/api/locations/search?query=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
    const results = await res.json();

    // If we got good results, return them
    if (results.length > 0) {
      return results;
    }

    // If no results, try with normalized query (remove accents, special chars)
    const { normalizeText } = await import('./fuzzy-search');
    const normalizedQuery = normalizeText(query);

    // Try common variations for German umlauts
    const variations = [
      normalizedQuery,
      normalizedQuery.replace(/ae/g, 'ä').replace(/oe/g, 'ö').replace(/ue/g, 'ü'),
      normalizedQuery.replace(/ss/g, 'ß'),
    ];

    // Try each variation
    for (const variant of variations) {
      if (variant === query) continue; // Skip if same as original

      const variantRes = await fetch(`/api/locations/search?query=${encodeURIComponent(variant)}`);
      if (variantRes.ok) {
        const variantResults = await variantRes.json();
        if (variantResults.length > 0) {
          return variantResults;
        }
      }
    }

    // If still no results, try partial matches
    // Split query into words and try each word
    const words = query.split(/\s+/).filter(w => w.length > 2);
    for (const word of words) {
      const wordRes = await fetch(`/api/locations/search?query=${encodeURIComponent(word)}`);
      if (wordRes.ok) {
        const wordResults = await wordRes.json();
        if (wordResults.length > 0) {
          return wordResults;
        }
      }
    }

    return [];
  } catch (error) {
    console.error("Location search failed:", error);
    return [];
  }
}

export async function searchNearbyStations(lat: number, lon: number): Promise<StopLocation[]> {
  try {
    const res = await fetch(`/api/locations/nearby?lat=${lat}&lon=${lon}&r=1000`);
    if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
    return await res.json();
  } catch (error) {
    console.error("Nearby search failed:", error);
    return [];
  }
}

export async function searchTrips(originId: string, destId: string, profile: 'standard' | 'wheelchair' | 'mobility_impaired' = 'standard', time?: Date): Promise<Trip[]> {
  try {
    // Defaulting to 'standard' now, as profiles will be handled separately
    let url = `/api/trips?originId=${encodeURIComponent(originId)}&destId=${encodeURIComponent(destId)}&profile=${profile}`;

    if (time) {
      url += `&departure=${encodeURIComponent(time.toISOString())}`;
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
    return await res.json();
  } catch (error) {
    console.error("Trip search failed:", error);
    return [];
  }
}

