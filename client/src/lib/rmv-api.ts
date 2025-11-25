const API_KEY = "765abdb9-e12c-46a0-84fa-2349bc29fb5b";
const BASE_URL = "https://www.rmv.de/hapi";
// Use a CORS proxy for frontend-only development to avoid CORS errors
const CORS_PROXY = "https://corsproxy.io/?";

export interface StopLocation {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export interface Trip {
  legs: Leg[];
  duration: string;
  startTime: string;
  startDate: string;
  endTime: string;
  endDate: string;
}

interface RawTripResponse {
  Trip: {
    LegList: {
      Leg: Leg[];
    };
    duration: string; // PT26M
  }[];
}

export interface Leg {
  Origin: {
    name: string;
    time: string;
    date: string;
    track?: string;
  };
  Destination: {
    name: string;
    time: string;
    date: string;
    track?: string;
  };
  name: string; // e.g., "S-Bahn S8"
  type: string; // "JNY"
}

// Helper to format RMV time (hh:mm:ss) to simpler hh:mm
export function formatTime(time: string) {
  if (!time) return "";
  return time.substring(0, 5);
}

export async function searchLocation(query: string): Promise<StopLocation[]> {
  const targetUrl = `${BASE_URL}/location.name?accessId=${API_KEY}&input=${encodeURIComponent(query)}&format=json`;
  const url = `${CORS_PROXY}${encodeURIComponent(targetUrl)}`;
  
  try {
    console.log(`Fetching location: ${targetUrl}`);
    const res = await fetch(url);
    
    if (!res.ok) {
      throw new Error(`API returned ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    console.log("Location data:", data);
    
    // Handle the array structure: stopLocationOrCoordLocation array containing objects with StopLocation
    const locationList = data.stopLocationOrCoordLocation || data.StopLocation;
    if (!locationList) return [];
    
    // Ensure array
    const stops = Array.isArray(locationList) ? locationList : [locationList];
    
    return stops
      .map((item: any) => {
        // Handle nested StopLocation if present
        const stop = item.StopLocation || item;
        
        if (!stop.extId) return null;

        return {
          id: stop.extId,
          name: stop.name,
          lat: stop.lat,
          lon: stop.lon
        } as StopLocation;
      })
      .filter((stop: StopLocation | null): stop is StopLocation => stop !== null);
  } catch (error) {
    console.error("Location search failed detailed:", error);
    return [];
  }
}

export async function searchTrips(originId: string, destId: string): Promise<Trip[]> {
  const targetUrl = `${BASE_URL}/trip?accessId=${API_KEY}&originId=${encodeURIComponent(originId)}&destId=${encodeURIComponent(destId)}&format=json&numF=3`;
  const url = `${CORS_PROXY}${encodeURIComponent(targetUrl)}`;

  try {
    console.log(`Fetching trips: ${targetUrl}`);
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`API returned ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    console.log("Trip data:", data);
    
    if (!data.Trip) return [];
    
    return data.Trip.map((trip: any) => {
      const legs = Array.isArray(trip.LegList.Leg) ? trip.LegList.Leg : [trip.LegList.Leg];
      
      // Calculate duration in minutes if possible, or just use the API's duration
      // API returns duration like "PT26M" (ISO 8601)
      let duration = trip.duration;
      
      return {
        legs,
        duration,
        startTime: legs[0].Origin.time,
        startDate: legs[0].Origin.date,
        endTime: legs[legs.length - 1].Destination.time,
        endDate: legs[legs.length - 1].Destination.date,
      };
    });
  } catch (error) {
    console.error("Trip search failed detailed:", error);
    return [];
  }
}
