import type { Express } from "express";
import { createServer, type Server } from "http";

// Public Transport API (Community Wrapper for DB)
// Documentation: https://v6.db.transport.rest/p/docs/index.html
const API_BASE = "https://v6.db.transport.rest";

export async function registerRoutes(app: Express): Promise<Server> {

  // 1. Search Location (Text)
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
  app.get("/api/locations/nearby", async (req, res) => {
    try {
      const { lat, lon, r } = req.query;
      if (!lat || !lon) {
        return res.status(400).json({ message: "lat and lon parameters are required" });
      }

      // Ensure valid numbers
      const latitude = parseFloat(lat as string);
      const longitude = parseFloat(lon as string);
      const distance = parseInt((r as string) || "2000", 10); // Increased default radius to 2km

      const response = await fetch(
        `${API_BASE}/stops/nearby?latitude=${latitude}&longitude=${longitude}&distance=${distance}&results=10`
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
  app.get("/api/trips", async (req, res) => {
    try {
      const { originId, destId, profile } = req.query;

      if (!originId || !destId) {
        return res.status(400).json({ message: "originId and destId are required" });
      }

      // Added &stopovers=true to get intermediate stops
      let url = `${API_BASE}/journeys?from=${encodeURIComponent(originId as string)}&to=${encodeURIComponent(destId as string)}&results=3&stopovers=true`;

      if (profile === "wheelchair") {
        // url += '&accessibility=complete'; 
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      const journeys = data.journeys || [];

      // Map to frontend format
      const trips = journeys.map((journey: any) => {
        let previousArrival: Date | null = null;

        const legs = journey.legs.map((leg: any, index: number) => {

          const formatTime = (iso: string) =>
            iso ? new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : "";

          const formatDate = (iso: string) =>
            iso ? new Date(iso).toLocaleDateString('de-DE') : "";

          // Calculate transfer time from previous leg
          let transferDuration = 0;
          if (previousArrival && leg.departure) {
            const departureTime = new Date(leg.departure).getTime();
            const arrivalTime = previousArrival.getTime();
            transferDuration = Math.max(0, Math.floor((departureTime - arrivalTime) / 60000));
          }
          previousArrival = leg.arrival ? new Date(leg.arrival) : null;

          return {
            Origin: {
              name: leg.origin.name,
              time: formatTime(leg.departure),
              date: formatDate(leg.departure),
              track: leg.departurePlatform || leg.platform, // Try both fields
              rtTime: leg.plannedDeparture !== leg.departure ? formatTime(leg.departure) : undefined,
            },
            Destination: {
              name: leg.destination.name,
              time: formatTime(leg.arrival),
              date: formatDate(leg.arrival),
              track: leg.arrivalPlatform || leg.platform, // Try both fields
            },
            name: leg.line?.name || (leg.walking ? "Fußweg" : "Zug"),
            type: leg.line?.mode || (leg.walking ? "walking" : "train"),
            direction: leg.direction,
            transferDuration: index > 0 ? transferDuration : undefined, // Transfer time before this leg
            stopovers: leg.stopovers ? leg.stopovers.map((stop: any) => ({
              name: stop.stop?.name,
              arrival: formatTime(stop.arrival),
              departure: formatTime(stop.departure),
              track: stop.arrivalPlatform || stop.departurePlatform
            })) : []
          };
        });

        // Calculate total duration
        const startTime = new Date(journey.legs[0].departure).getTime();
        const endTime = new Date(journey.legs[journey.legs.length - 1].arrival).getTime();
        const durationMinutes = Math.floor((endTime - startTime) / 60000);

        return {
          legs,
          duration: `PT${durationMinutes}M`,
          startTime: new Date(journey.legs[0].departure).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
          startDate: new Date(journey.legs[0].departure).toLocaleDateString('de-DE'),
          endTime: new Date(journey.legs[journey.legs.length - 1].arrival).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
          endDate: new Date(journey.legs[journey.legs.length - 1].arrival).toLocaleDateString('de-DE'),
          price: journey.price ? journey.price.amount : undefined, // Include price if available
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
