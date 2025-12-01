import type { Express } from "express";
import { createServer, type Server } from "http";

// Official Deutsche Bahn API
const DB_API_BASE = "https://apis.deutschebahn.com";
const DB_CLIENT_ID = process.env.DB_CLIENT_ID;
const DB_API_KEY = process.env.DB_API_KEY;

if (!DB_CLIENT_ID || !DB_API_KEY) {
  console.warn("WARNING: DB_CLIENT_ID or DB_API_KEY is not set in environment variables.");
}

// Helper to create headers for DB API
function getDBHeaders() {
  return {
    "DB-Client-Id": DB_CLIENT_ID || "",
    "DB-Api-Key": DB_API_KEY || "",
    "Accept": "application/json",
  };
}

export async function registerRoutes(app: Express): Promise<Server> {

  // 1. Search Location (Text)
  app.get("/api/locations/search", async (req, res) => {
    try {
      const { query } = req.query;
      if (!query || typeof query !== "string") {
        return res.status(400).json({ message: "Query parameter is required" });
      }

      // DB API: Fahrplan-Free endpoint for location search
      const response = await fetch(
        `${DB_API_BASE}/fahrplan-plus/v1/location/${encodeURIComponent(query)}`,
        { headers: getDBHeaders() }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`DB API Error: ${response.status}`, errorText);
        throw new Error(`DB API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Normalize response - DB API returns array directly
      const results = (Array.isArray(data) ? data : [data])
        .filter((loc: any) => loc.type === 'station' || loc.type === 'ST')
        .slice(0, 10)
        .map((loc: any) => ({
          id: loc.id || loc.extId,
          name: loc.name,
          lat: loc.lat || loc.latitude,
          lon: loc.lon || loc.longitude,
        }));

      res.json(results);
    } catch (error: any) {
      console.error("Location search error:", error);
      res.status(500).json({ message: error.message || "Internal Server Error" });
    }
  });

  // 2. Search Nearby Stations (GPS)
  app.get("/api/locations/nearby", async (req, res) => {
    try {
      const { lat, lon, r } = req.query;
      if (!lat || !lon) {
        return res.status(400).json({ message: "lat and lon parameters are required" });
      }

      // DB API: Nearby stops
      const response = await fetch(
        `${DB_API_BASE}/fahrplan-plus/v1/location/nearby?lat=${lat}&lon=${lon}`,
        { headers: getDBHeaders() }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`DB API Error: ${response.status}`, errorText);
        throw new Error(`DB API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      const results = (Array.isArray(data) ? data : [data])
        .filter((loc: any) => loc.type === 'station' || loc.type === 'ST')
        .slice(0, 10)
        .map((loc: any) => ({
          id: loc.id || loc.extId,
          name: loc.name,
          lat: loc.lat || loc.latitude,
          lon: loc.lon || loc.longitude,
          distance: loc.dist || loc.distance,
        }));

      res.json(results);
    } catch (error: any) {
      console.error("Nearby search error:", error);
      res.status(500).json({ message: error.message || "Internal Server Error" });
    }
  });

  // 3. Search Trips (Routing)
  app.get("/api/trips", async (req, res) => {
    try {
      const { originId, destId, profile } = req.query;

      if (!originId || !destId) {
        return res.status(400).json({ message: "originId and destId are required" });
      }

      // DB API: Journey search
      let url = `${DB_API_BASE}/fahrplan-plus/v1/journey?originId=${encodeURIComponent(originId as string)}&destId=${encodeURIComponent(destId as string)}`;

      const response = await fetch(url, { headers: getDBHeaders() });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`DB API Error: ${response.status}`, errorText);
        throw new Error(`DB API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.Trip || data.Trip.length === 0) {
        return res.json([]);
      }

      // Map DB API format to our frontend format
      const trips = (Array.isArray(data.Trip) ? data.Trip : [data.Trip]).slice(0, 3).map((trip: any) => {
        const legs = Array.isArray(trip.LegList?.Leg) ? trip.LegList.Leg : [trip.LegList?.Leg].filter(Boolean);

        return {
          legs: legs.map((leg: any) => ({
            Origin: {
              name: leg.Origin?.name || "",
              time: leg.Origin?.time || "",
              date: leg.Origin?.date || "",
              track: leg.Origin?.track,
            },
            Destination: {
              name: leg.Destination?.name || "",
              time: leg.Destination?.time || "",
              date: leg.Destination?.date || "",
              track: leg.Destination?.track,
            },
            name: leg.name || "Transfer",
            type: leg.type || "",
          })),
          duration: trip.duration || "",
          startTime: legs[0]?.Origin?.time || "",
          startDate: legs[0]?.Origin?.date || "",
          endTime: legs[legs.length - 1]?.Destination?.time || "",
          endDate: legs[legs.length - 1]?.Destination?.date || "",
        };
      });

      res.json(trips);
    } catch (error: any) {
      console.error("Trip search error:", error);
      res.status(500).json({ message: error.message || "Internal Server Error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
