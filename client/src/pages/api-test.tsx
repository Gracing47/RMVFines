import { useState } from "react";
import { searchLocation, searchNearbyStations, searchTrips, StopLocation, Trip } from "@/lib/rmv-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

export default function ApiTest() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Location Search State
    const [locationQuery, setLocationQuery] = useState("");
    const [locationResults, setLocationResults] = useState<StopLocation[]>([]);

    // Nearby Search State
    const [nearbyResults, setNearbyResults] = useState<StopLocation[]>([]);

    // Trip Search State
    const [originId, setOriginId] = useState("");
    const [destId, setDestId] = useState("");
    const [tripResults, setTripResults] = useState<Trip[]>([]);

    const handleLocationSearch = async () => {
        setLoading(true);
        setError(null);
        try {
            const results = await searchLocation(locationQuery);
            setLocationResults(results);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleNearbySearch = async () => {
        setLoading(true);
        setError(null);
        try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject);
            });
            const results = await searchNearbyStations(position.coords.latitude, position.coords.longitude);
            setNearbyResults(results);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleTripSearch = async () => {
        setLoading(true);
        setError(null);
        try {
            const results = await searchTrips(originId, destId);
            setTripResults(results);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto p-4 max-w-4xl">
            <h1 className="text-3xl font-bold mb-6">RMV API Test Console</h1>

            {error && (
                <div className="bg-destructive/15 text-destructive p-4 rounded-md mb-6">
                    Error: {error}
                </div>
            )}

            <Tabs defaultValue="location">
                <TabsList className="mb-4">
                    <TabsTrigger value="location">Location Search</TabsTrigger>
                    <TabsTrigger value="nearby">Nearby Stations</TabsTrigger>
                    <TabsTrigger value="trip">Trip Search</TabsTrigger>
                </TabsList>

                <TabsContent value="location">
                    <Card>
                        <CardHeader>
                            <CardTitle>Search Location</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Station name (e.g. Frankfurt Hauptbahnhof)"
                                    value={locationQuery}
                                    onChange={(e) => setLocationQuery(e.target.value)}
                                />
                                <Button onClick={handleLocationSearch} disabled={loading}>
                                    {loading ? <Loader2 className="animate-spin" /> : "Search"}
                                </Button>
                            </div>

                            <div className="space-y-2">
                                {locationResults.map((loc) => (
                                    <div key={loc.id} className="p-3 border rounded flex justify-between items-center">
                                        <div>
                                            <div className="font-bold">{loc.name}</div>
                                            <div className="text-sm text-muted-foreground">ID: {loc.id}</div>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setOriginId(prev => prev ? prev : loc.id);
                                                if (originId) setDestId(loc.id);
                                            }}
                                        >
                                            Use ID
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="nearby">
                    <Card>
                        <CardHeader>
                            <CardTitle>Nearby Stations</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Button onClick={handleNearbySearch} disabled={loading}>
                                {loading ? <Loader2 className="animate-spin mr-2" /> : null}
                                Get Current Location & Search
                            </Button>

                            <div className="space-y-2">
                                {nearbyResults.map((loc) => (
                                    <div key={loc.id} className="p-3 border rounded">
                                        <div className="font-bold">{loc.name}</div>
                                        <div className="text-sm text-muted-foreground">
                                            ID: {loc.id} | Lat: {loc.lat}, Lon: {loc.lon}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="trip">
                    <Card>
                        <CardHeader>
                            <CardTitle>Trip Search</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Origin ID</label>
                                    <Input value={originId} onChange={(e) => setOriginId(e.target.value)} placeholder="Origin ID" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Destination ID</label>
                                    <Input value={destId} onChange={(e) => setDestId(e.target.value)} placeholder="Destination ID" />
                                </div>
                            </div>

                            <Button onClick={handleTripSearch} disabled={loading || !originId || !destId}>
                                {loading ? <Loader2 className="animate-spin" /> : "Search Trips"}
                            </Button>

                            <div className="space-y-4">
                                {tripResults.map((trip, i) => (
                                    <div key={i} className="p-4 border rounded bg-card">
                                        <div className="flex justify-between mb-2">
                                            <span className="font-bold">{trip.startTime} - {trip.endTime}</span>
                                            <span className="text-muted-foreground">{trip.duration}</span>
                                        </div>
                                        <div className="space-y-2">
                                            {trip.legs.map((leg, j) => (
                                                <div key={j} className="text-sm pl-4 border-l-2 border-primary">
                                                    <div className="font-medium">{leg.name}</div>
                                                    <div className="text-muted-foreground">
                                                        {leg.Origin.name} ({leg.Origin.time}) → {leg.Destination.name} ({leg.Destination.time})
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
