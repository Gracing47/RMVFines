const API_KEY = "765abdb9-e12c-46a0-84fa-2349bc29fb5b";
const BASE_URL = "https://www.rmv.de/hapi";

export interface StopLocation {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export interface Trip {
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
  const url = `${BASE_URL}/location.name?accessId=${API_KEY}&input=${encodeURIComponent(query)}&format=json`;
  
  try {
    const res = await fetch(url);
    const data = await res.json();
    
    if (!data.StopLocation) return [];
    
    // Ensure array
    const stops = Array.isArray(data.StopLocation) ? data.StopLocation : [data.StopLocation];
    
    return stops.map((stop: any) => ({
      id: stop.extId, // Use extId for trip requests usually, or id? HAFAS usually uses extId for trips
      name: stop.name,
      lat: stop.lat,
      lon: stop.lon
    }));
  } catch (error) {
    console.error("Location search failed", error);
    return [];
  }
}

export async function searchTrips(originId: string, destId: string) {
  const url = `${BASE_URL}/trip?accessId=${API_KEY}&originId=${encodeURIComponent(originId)}&destId=${encodeURIComponent(destId)}&format=json&numF=3`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    
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
    console.error("Trip search failed", error);
    return [];
  }
}
