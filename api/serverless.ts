import type { Express } from "express";
import express from 'express';

// Public Transport API (Community Wrapper for DB)
const API_BASE = "https://v6.db.transport.rest";

const app: Express = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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

        const latitude = parseFloat(lat as string);
        const longitude = parseFloat(lon as string);
        const distance = parseInt((r as string) || "2000", 10);

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
        const { originId, destId, profile, departure } = req.query;

        if (!originId || !destId) {
            return res.status(400).json({ message: "originId and destId are required" });
        }

        let url = `${API_BASE}/journeys?from=${encodeURIComponent(originId as string)}&to=${encodeURIComponent(destId as string)}&results=3&stopovers=true`;

        if (profile === "wheelchair") {
            // url += '&accessibility=complete'; 
        }

        if (departure) {
            url += `&departure=${encodeURIComponent(departure as string)}`;
        }

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        const journeys = data.journeys || [];

        const trips = journeys.map((journey: any) => {
            let previousArrival: Date | null = null;

            const legs = journey.legs.map((leg: any, index: number) => {

                const formatTime = (iso: string) =>
                    iso ? new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : "";

                const formatDate = (iso: string) =>
                    iso ? new Date(iso).toLocaleDateString('de-DE') : "";

                let transferDuration = 0;
                if (previousArrival && leg.departure) {
                    const departureTime = new Date(leg.departure).getTime();
                    const arrivalTime = previousArrival.getTime();
                    transferDuration = Math.max(0, Math.floor((departureTime - arrivalTime) / 60000));
                }
                previousArrival = leg.arrival ? new Date(leg.arrival) : null;

                // Calculate leg duration
                const legDuration = leg.departure && leg.arrival
                    ? Math.floor((new Date(leg.arrival).getTime() - new Date(leg.departure).getTime()) / 60000)
                    : undefined;

                return {
                    Origin: {
                        name: leg.origin.name,
                        time: formatTime(leg.departure),
                        date: formatDate(leg.departure),
                        track: leg.departurePlatform || leg.platform,
                        rtTime: leg.plannedDeparture !== leg.departure ? formatTime(leg.departure) : undefined,
                    },
                    Destination: {
                        name: leg.destination.name,
                        time: formatTime(leg.arrival),
                        date: formatDate(leg.arrival),
                        track: leg.arrivalPlatform || leg.platform,
                    },
                    name: leg.line?.name || (leg.walking ? "Fußweg" : "Zug"),
                    type: leg.line?.mode || (leg.walking ? "walking" : "train"),
                    direction: leg.direction,
                    walking: leg.walking || false,
                    distance: leg.distance, // Distance in meters
                    duration: legDuration, // Duration in minutes
                    transferDuration: index > 0 ? transferDuration : undefined,
                    stopovers: leg.stopovers ? leg.stopovers.map((stop: any) => ({
                        name: stop.stop?.name,
                        arrival: formatTime(stop.arrival),
                        departure: formatTime(stop.departure),
                        track: stop.arrivalPlatform || stop.departurePlatform
                    })) : []
                };
            });

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
                price: journey.price ? journey.price.amount : undefined,
            };
        });

        res.json(trips);
    } catch (error: any) {
        console.error("Trip search error:", error);
        res.status(500).json({ message: "Failed to search trips" });
    }
});

export default app;
