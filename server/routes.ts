import type { Express } from "express";
import { createServer, type Server } from "http";

// Public Transport API (Community Wrapper for DB)
// Documentation: https://v6.db.transport.rest/p/docs/index.html
const API_BASE = "https://v6.db.transport.rest";

export async function registerRoutes(app: Express): Promise<Server> {

  // 1. Search Location (Text)
  // Endpoint: /locations?query=...
  app.get("/api/locations/search", async (req, res) => {
    try {
      const { query } = req.query;
      if (!query || typeof query !== "string") {
        return res.status(400).json({ message: "Query parameter is required" });
      }

      const response = await fetch(
        `${API_BASE}/locations?query=${encodeURIComponent(query)}&results=10`
      );

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();

      // Filter for stations/stops and map to frontend format
      const results = data
        .filter((loc: any) => loc.type === 'station' || loc.type === 'stop')
        .map((loc: any) => ({
          id: loc.id,
          name: loc.name,
          lat: loc.location?.latitude,
          lon: loc.location?.longitude,
        }));

      res.json(results);
    } catch (error: any) {
      console.error("Location search error:", error);
      res.status(500).json({ message: "Failed to search locations" });
    }
  });

  // 2. Search Nearby Stations (GPS)
  // Endpoint: /stops/nearby?latitude=...&longitude=...
  app.get("/api/locations/nearby", async (req, res) => {
    try {
      const { lat, lon, r } = req.query;
      if (!lat || !lon) {
        return res.status(400).json({ message: "lat and lon parameters are required" });
      }

      const distance = parseInt((r as string) || "1000", 10);

      const response = await fetch(
        `${API_BASE}/stops/nearby?latitude=${lat}&longitude=${lon}&distance=${distance}&results=10`
      );

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();

      const results = data
        .filter((loc: any) => loc.type === 'station' || loc.type === 'stop')
        .map((loc: any) => ({
          id: loc.id,
          name: loc.name,
          lat: loc.location?.latitude,
          lon: loc.location?.longitude,
          distance: loc.distance,
        }));

      res.json(results);
    } catch (error: any) {
      console.error("Nearby search error:", error);
      res.status(500).json({ message: "Failed to find nearby stations" });
    }
  });

  // 3. Search Trips (Routing)
  // Endpoint: /journeys?from=...&to=...
  app.get("/api/trips", async (req, res) => {
    try {
      const { originId, destId, profile } = req.query;

      if (!originId || !destId) {
        return res.status(400).json({ message: "originId and destId are required" });
      }

      let url = `${API_BASE}/journeys?from=${encodeURIComponent(originId as string)}&to=${encodeURIComponent(destId as string)}&results=3`;

      // Accessibility options (mapped to API parameters if supported, 
      // otherwise handled by frontend logic or ignored if API doesn't support it directly in this version)
      // v6.db.transport.rest might not support 'accessibility' param directly in all backends,
      // but we keep the logic clean.
      if (profile === "wheelchair") {
        // url += '&accessibility=complete'; // Uncomment if supported
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      const journeys = data.journeys || [];

      // Map to frontend format
      const trips = journeys.map((journey: any) => {
        const legs = journey.legs.map((leg: any) => {

          const formatTime = (iso: string) =>
            iso ? new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : "";

          const formatDate = (iso: string) =>
            iso ? new Date(iso).toLocaleDateString('de-DE') : "";

          return {
            Origin: {
              name: leg.origin.name,
              time: formatTime(leg.departure),
              date: formatDate(leg.departure),
              track: leg.departurePlatform,
              rtTime: leg.plannedDeparture !== leg.departure ? formatTime(leg.departure) : undefined,
            },
            Destination: {
              name: leg.destination.name,
              time: formatTime(leg.arrival),
              date: formatDate(leg.arrival),
              track: leg.arrivalPlatform,
            },
            name: leg.line?.name || (leg.walking ? "Fußweg" : "Zug"),
            type: leg.line?.mode || (leg.walking ? "walking" : "train"),
            direction: leg.direction,
          };
        });

        // Calculate total duration
        const startTime = new Date(journey.legs[0].departure).getTime();
        const endTime = new Date(journey.legs[journey.legs.length - 1].arrival).getTime();
        const durationMinutes = Math.floor((endTime - startTime) / 60000);

        return {
          legs,
          duration: `PT${durationMinutes}M`, // ISO duration format roughly
          startTime: new Date(journey.legs[0].departure).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
          startDate: new Date(journey.legs[0].departure).toLocaleDateString('de-DE'),
          endTime: new Date(journey.legs[journey.legs.length - 1].arrival).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
          endDate: new Date(journey.legs[journey.legs.length - 1].arrival).toLocaleDateString('de-DE'),
        };
      });

      res.json(trips);
    } catch (error: any) {
      console.error("Trip search error:", error);
      res.status(500).json({ message: "Failed to search trips" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
