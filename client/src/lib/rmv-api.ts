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
    const res = await fetch(`/api/locations/search?query=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
    return await res.json();
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

export async function searchTrips(originId: string, destId: string, profile: 'standard' | 'wheelchair' | 'mobility_impaired' = 'standard'): Promise<Trip[]> {
  try {
    // Defaulting to 'standard' now, as profiles will be handled separately
    const res = await fetch(`/api/trips?originId=${encodeURIComponent(originId)}&destId=${encodeURIComponent(destId)}&profile=${profile}`);
    if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
    return await res.json();
  } catch (error) {
    console.error("Trip search failed:", error);
    return [];
  }
}

