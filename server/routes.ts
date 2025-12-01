import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

const RMV_API_KEY = process.env.RMV_API_KEY;
const RMV_BASE_URL = process.env.RMV_BASE_URL || "https://www.rmv.de/hapi";

if (!RMV_API_KEY) {
  console.warn("WARNING: RMV_API_KEY is not set in environment variables.");
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Helper to fetch from RMV API
  async function fetchRMV(endpoint: string, params: Record<string, string>) {
    const searchParams = new URLSearchParams({
      accessId: RMV_API_KEY || "",
      format: "json",
      ...params,
    });

    const url = `${RMV_BASE_URL}/${endpoint}?${searchParams.toString()}`;
    console.log(`[RMV API] Fetching: ${url}`);

    const response = await fetch(url, {
      headers: {
        "User-Agent": "RMV-Voice-App/1.0",
        "Accept": "application/json"
      }
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[RMV API Error] Status: ${response.status}, Body: ${errorText}`);
      throw new Error(`RMV API Error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  // 1. Search Location (Text)
  app.get("/api/locations/search", async (req, res) => {
    try {
      const { query } = req.query;
      if (!query || typeof query !== "string") {
        return res.status(400).json({ message: "Query parameter is required" });
      }

      const data = await fetchRMV("location.name", {
        input: query,
        type: "S", // Stations only
        maxNo: "10", // Request more results for better fuzzy matching
      });

      // Normalize response
      const locationList = data.stopLocationOrCoordLocation || data.StopLocation;
      const stops = Array.isArray(locationList) ? locationList : (locationList ? [locationList] : []);

      const results = stops
        .map((item: any) => {
          const stop = item.StopLocation || item;
          if (!stop.extId) return null;
          return {
            id: stop.extId,
            name: stop.name,
            lat: stop.lat,
            lon: stop.lon,
          };
        })
        .filter(Boolean);

      res.json(results);
    } catch (error: any) {
      console.error("Location search error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // 2. Search Nearby Stations (GPS)
  app.get("/api/locations/nearby", async (req, res) => {
    try {
      const { lat, lon, r } = req.query;
      if (!lat || !lon) {
        return res.status(400).json({ message: "lat and lon parameters are required" });
      }

      const data = await fetchRMV("location.nearbystops", {
        originCoordLat: lat as string,
        originCoordLong: lon as string,
        r: (r as string) || "1000", // Default 1000m radius
        type: "S", // Stations only
      });

      // Normalize response
      const locationList = data.stopLocationOrCoordLocation || data.StopLocation;
      const stops = Array.isArray(locationList) ? locationList : (locationList ? [locationList] : []);

      const results = stops
        .map((item: any) => {
          const stop = item.StopLocation || item;
          if (!stop.extId) return null;
          return {
            id: stop.extId,
            name: stop.name,
            lat: stop.lat,
            lon: stop.lon,
            distance: stop.dist, // Distance in meters
          };
        })
        .filter(Boolean);

      res.json(results);
    } catch (error: any) {
      console.error("Nearby search error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // 3. Search Trips (Routing) with Accessibility
  app.get("/api/trips", async (req, res) => {
    try {
      const { originId, destId, profile } = req.query;

      if (!originId || !destId) {
        return res.status(400).json({ message: "originId and destId are required" });
      }

      const params: Record<string, string> = {
        originId: originId as string,
        destId: destId as string,
        numF: "3", // Number of following trips
      };

      // Apply Accessibility Profiles
      if (profile === "wheelchair") {
        params.avoidPaths = "SW,ES"; // No stairs, no escalators
        params.changeTimePercent = "200"; // Double transfer time
        // params.mobilityProfile = "!BLOCK_BACKWARDS_TRAVEL"; // Example if supported
      } else if (profile === "mobility_impaired") {
        params.changeTimePercent = "150"; // 1.5x transfer time
        params.avoidPaths = "SW"; // No stairs preferred
      }

      const data = await fetchRMV("trip", params);

      if (!data.Trip) {
        return res.json([]);
      }

      const trips = data.Trip.map((trip: any) => {
        const legs = Array.isArray(trip.LegList.Leg) ? trip.LegList.Leg : [trip.LegList.Leg];

        return {
          legs,
          duration: trip.duration,
          startTime: legs[0].Origin.time,
          startDate: legs[0].Origin.date,
          endTime: legs[legs.length - 1].Destination.time,
          endDate: legs[legs.length - 1].Destination.date,
        };
      });

      res.json(trips);
    } catch (error: any) {
      console.error("Trip search error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
