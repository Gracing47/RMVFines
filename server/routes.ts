import type { Express } from "express";
import { createServer, type Server } from "http";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { createDbHafas } = require("db-hafas");

// Initialize DB HAFAS Client
// We use a generic user agent as required by the library
const client = createDbHafas("rmv-voice-app");

export async function registerRoutes(app: Express): Promise<Server> {

  // 1. Search Location (Text)
  app.get("/api/locations/search", async (req, res) => {
    try {
      const { query } = req.query;
      if (!query || typeof query !== "string") {
        return res.status(400).json({ message: "Query parameter is required" });
      }

      // DB HAFAS: client.locations(name, [opt])
      const locations = await client.locations(query, { results: 10 });

      // Normalize response for frontend
      const results = locations
        .filter(loc => loc.type === 'station' || loc.type === 'stop')
        .map((loc: any) => ({
          id: loc.id,
          name: loc.name,
          lat: loc.location?.latitude,
          lon: loc.location?.longitude,
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

      const latitude = parseFloat(lat as string);
      const longitude = parseFloat(lon as string);
      const distance = parseInt((r as string) || "1000", 10);

      // DB HAFAS: client.nearby({ latitude, longitude }, [opt])
      const nearby = await client.nearby(
        { latitude, longitude },
        { distance, results: 10 }
      );

      const results = nearby
        .filter(loc => loc.type === 'station' || loc.type === 'stop')
        .map((loc: any) => ({
          id: loc.id,
          name: loc.name,
          lat: loc.location?.latitude,
          lon: loc.location?.longitude,
          distance: loc.distance, // db-hafas returns distance in meters
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

      const options: any = {
        results: 3,
        transfers: -1, // unlimited
      };

      // Apply Accessibility Profiles (DB HAFAS supports accessibility options)
      if (profile === "wheelchair") {
        options.accessibility = 'complete';
      } else if (profile === "mobility_impaired") {
        options.accessibility = 'partial';
      }

      // DB HAFAS: client.journeys(from, to, [opt])
      const journeys = await client.journeys(originId as string, destId as string, options);

      if (!journeys.journeys) {
        return res.json([]);
      }

      // Map DB HAFAS format to our frontend format
      const trips = journeys.journeys.map((journey: any) => {
        const legs = journey.legs.map((leg: any) => {
          return {
            Origin: {
              name: leg.origin.name,
              time: leg.departure, // ISO string
              date: leg.departure.split('T')[0],
              track: leg.platform,
              rtTime: leg.plannedDeparture !== leg.departure ? leg.departure : undefined, // Logic for delay
              // DB HAFAS gives specific delay fields, but we map simply here
            },
            Destination: {
              name: leg.destination.name,
              time: leg.arrival,
              date: leg.arrival.split('T')[0],
              track: leg.arrivalPlatform,
            },
            name: leg.line?.name || leg.line?.productName || "Fußweg", // Line name or "Walk"
            type: leg.mode, // "train", "bus", "walking"
          };
        });

        // Filter out walking-only legs at start/end if desired, but for now keep all

        return {
          legs,
          duration: "PT" + Math.floor((new Date(journey.arrival).getTime() - new Date(journey.departure).getTime()) / 60000) + "M", // Simple duration format for frontend
          startTime: journey.departure,
          startDate: journey.departure.split('T')[0],
          endTime: journey.arrival,
          endDate: journey.arrival.split('T')[0],
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
