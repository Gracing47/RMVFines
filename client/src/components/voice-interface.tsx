import { useState, useEffect, useRef } from "react";
import { VoiceAssistant, parseIntent } from "@/lib/voice";
import { searchLocation, searchTrips, searchNearbyStations, Trip } from "@/lib/rmv-api";
import { Mic, Loader2, AlertCircle, MapPin, Navigation, ArrowRight } from "lucide-react";
import { ConnectionCard } from "./connection-card";
import { Button } from "@/components/ui/button";

export function VoiceInterface() {
  const [status, setStatus] = useState<"idle" | "listening" | "processing" | "success" | "error">("idle");
  const [transcript, setTranscript] = useState("");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [routeInfo, setRouteInfo] = useState<{from: string, to: string} | null>(null);
  const [locationPermission, setLocationPermission] = useState<PermissionState | null>(null);
  const [pendingIntent, setPendingIntent] = useState<{from?: string, to?: string} | null>(null);
  const [showHelp, setShowHelp] = useState(true);
  
  const assistantRef = useRef<VoiceAssistant | null>(null);

  useEffect(() => {
    // Initialize Voice Assistant
    assistantRef.current = new VoiceAssistant(
      (text) => handleVoiceResult(text),
      () => setStatus("listening"),
      () => {
        if (status === "listening") setStatus("processing");
      },
      (err) => {
        console.error(err);
        setStatus("error");
        setErrorMsg("Spracherkennung fehlgeschlagen. Bitte versuche es erneut.");
      }
    );

    return () => assistantRef.current?.stop();
  }, []);

  const checkLocationPermission = async (): Promise<boolean> => {
    if (!navigator.permissions) return true; // If Permissions API not available, try anyway
    
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      setLocationPermission(result.state);
      return result.state === 'granted';
    } catch (error) {
      console.log('Permissions API not fully supported, will try geolocation directly');
      return true; // Try anyway
    }
  };

  const getGeolocation = (retry = false): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported"));
        return;
      }
      
      const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: retry ? 0 : 30000 // Force fresh location on retry
      };
      
      navigator.geolocation.getCurrentPosition(
        resolve, 
        (error) => {
          console.error('Geolocation error:', error);
          reject(error);
        },
        options
      );
    });
  };

  const requestLocationWithRetry = async (intent: {from?: string, to?: string}): Promise<GeolocationPosition | null> => {
    try {
      // Check permission first
      const hasPermission = await checkLocationPermission();
      
      if (locationPermission === 'denied') {
        assistantRef.current?.speak("Standortzugriff wurde verweigert. Bitte erlaube den Zugriff in den Browser-Einstellungen.");
        setStatus("error");
        setErrorMsg("Standortzugriff verweigert. Bitte aktiviere die Standortberechtigung in deinen Browser-Einstellungen und versuche es erneut.");
        return null;
      }
      
      // Try to get location
      const position = await getGeolocation(locationPermission === 'prompt');
      return position;
      
    } catch (error: any) {
      console.error('Location request failed:', error);
      
      // Store intent for retry
      setPendingIntent(intent);
      
      // Provide user-friendly error message
      let errorMessage = "Standortzugriff fehlgeschlagen. ";
      
      if (error.code === 1) { // PERMISSION_DENIED
        errorMessage = "Standortzugriff wurde abgelehnt. Bitte erlaube den Zugriff und versuche es erneut.";
        assistantRef.current?.speak("Ich benötige Zugriff auf deinen Standort. Bitte erlaube den Zugriff und drücke das Mikrofon erneut.");
      } else if (error.code === 2) { // POSITION_UNAVAILABLE
        errorMessage = "Standort konnte nicht ermittelt werden. Bitte überprüfe deine Verbindung.";
        assistantRef.current?.speak("Standort konnte nicht ermittelt werden.");
      } else if (error.code === 3) { // TIMEOUT
        errorMessage = "Standortabfrage dauerte zu lange. Bitte versuche es erneut.";
        assistantRef.current?.speak("Standortabfrage dauerte zu lange.");
      } else {
        assistantRef.current?.speak("Standortzugriff fehlgeschlagen.");
      }
      
      setStatus("error");
      setErrorMsg(errorMessage + " Drücke das Mikrofon erneut, um es nochmal zu versuchen.");
      return null;
    }
  };

  const handleVoiceResult = async (text: string) => {
    setTranscript(text);
    setStatus("processing");

    const intent = parseIntent(text);
    
    if (!intent.to) {
      setStatus("error");
      setErrorMsg("Ich konnte kein Ziel verstehen. Sag zum Beispiel: 'Nach Wiesbaden'");
      assistantRef.current?.speak("Ich habe kein Ziel verstanden.");
      return;
    }

    let fromQuery = intent.from;
    const toQuery = intent.to;

    try {
      let start;

      // Step A: Find Start
      if (fromQuery === "CURRENT_LOCATION") {
        assistantRef.current?.speak("Ich ermittle deinen Standort...");
        
        const position = await requestLocationWithRetry(intent);
        if (!position) {
          // Error already handled in requestLocationWithRetry
          return;
        }
        
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        
        const nearbyStations = await searchNearbyStations(lat, lon);
        if (nearbyStations.length === 0) {
          throw new Error("Keine Haltestelle in der Nähe gefunden. Bitte gib einen Startort manuell ein.");
        }
        
        // Take the closest station
        start = nearbyStations[0];
        fromQuery = "Deinem Standort";
        assistantRef.current?.speak(`Nächste Haltestelle: ${start.name}`);
      } else {
         fromQuery = fromQuery || "Frankfurt Hauptbahnhof"; // Default fallback
         const startLocations = await searchLocation(fromQuery);
         if (startLocations.length === 0) throw new Error(`Startort "${fromQuery}" nicht gefunden.`);
         start = startLocations[0];
      }

      // Step B: Find Dest
      let dest;
      const destLocations = await searchLocation(toQuery);
      
      if (destLocations.length === 0) {
        // If destination not found by name, try using GPS to find nearby stations
        // and let user select, or use reverse geocoding
        // For now, we'll try to search for nearby stations if we have GPS access
        try {
          assistantRef.current?.speak(`Ich konnte ${toQuery} nicht finden. Suche in der Nähe...`);
          const position = await requestLocationWithRetry(intent);
          if (!position) {
            throw new Error(`Zielort "${toQuery}" nicht gefunden.`);
          }
          const nearbyStations = await searchNearbyStations(
            position.coords.latitude,
            position.coords.longitude
          );
          
          // Search for the destination name in nearby stations
          const matchingNearby = nearbyStations.filter(station => 
            station.name.toLowerCase().includes(toQuery.toLowerCase().split(' ')[0])
          );
          
          if (matchingNearby.length > 0) {
            dest = matchingNearby[0];
          } else if (nearbyStations.length > 0) {
            // If no match but we have nearby stations, suggest the closest one
            throw new Error(`"${toQuery}" nicht gefunden. Meinten Sie ${nearbyStations[0].name}?`);
          } else {
            throw new Error(`Zielort "${toQuery}" nicht gefunden.`);
          }
        } catch (geoErr) {
          throw new Error(`Zielort "${toQuery}" nicht gefunden.`);
        }
      } else {
        dest = destLocations[0];
      }

      setRouteInfo({ from: start.name, to: dest.name });

      // Step C: Find Trips
      const foundTrips = await searchTrips(start.id, dest.id);
      
      if (foundTrips.length === 0) {
        throw new Error("Keine Verbindungen gefunden.");
      }

      setTrips(foundTrips.slice(0, 3)); // Take top 3
      setStatus("success");

      // Speak first connection
      const firstTrip = foundTrips[0];
      const startTime = firstTrip.legs[0].Origin.time.substring(0, 5);
      const track = firstTrip.legs[0].Origin.track;
      
      const speakText = `Die nächste Verbindung von ${start.name} nach ${dest.name} geht um ${startTime} Uhr${track ? ` von Gleis ${track}` : ''}.`;
      assistantRef.current?.speak(speakText);

    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setErrorMsg(err.message || "Ein Fehler ist aufgetreten.");
      assistantRef.current?.speak("Entschuldigung, da ist etwas schiefgelaufen.");
    }
  };

  const toggleListening = () => {
    if (status === "listening") {
      assistantRef.current?.stop();
      setStatus("idle");
    } else if (status === "processing") {
      // Allow cancelling processing
      setStatus("idle");
      setTranscript("");
    } else {
      setShowHelp(false);
      setTranscript("");
      setErrorMsg("");
      setTrips([]);
      setRouteInfo(null);
      assistantRef.current?.start();
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto min-h-[85vh] justify-center py-6 px-4">
      
      {/* Header / Transcript Area */}
      <div className="text-center mb-8 space-y-6 min-h-[140px] w-full">
        {status === "idle" && !trips.length && showHelp && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
            <h2 className="text-3xl font-bold text-foreground">
              Wohin möchten Sie fahren?
            </h2>
            <div className="space-y-2 text-lg text-muted-foreground">
              <p className="flex items-center justify-center gap-2">
                <Mic className="h-5 w-5 text-primary" />
                Drücken Sie den Mikrofon-Button
              </p>
              <div className="mt-4 space-y-2 text-base opacity-70">
                <p className="font-medium">Beispiele:</p>
                <p>"Von hier nach Frankfurt"</p>
                <p>"Nach Wiesbaden Hauptbahnhof"</p>
                <p>"Hier nach Mainz"</p>
              </div>
            </div>
          </div>
        )}
        
        {status === "listening" && (
          <div className="space-y-3 animate-in fade-in">
            <div className="text-3xl text-primary font-bold animate-pulse">
              🎤 Sprechen Sie jetzt
            </div>
            <p className="text-muted-foreground text-lg">Sagen Sie Ihr Ziel...</p>
          </div>
        )}

        {transcript && (
          <div className="text-3xl font-bold text-foreground px-4 animate-in fade-in">
            "{transcript}"
          </div>
        )}

        {status === "processing" && (
          <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground animate-in fade-in">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-xl">Suche Verbindungen...</p>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-3 animate-in shake">
            <div className="flex items-center justify-center gap-3 text-destructive">
              <AlertCircle className="h-8 w-8" />
            </div>
            <p className="text-lg font-medium text-destructive px-4">{errorMsg}</p>
            <Button 
              variant="outline" 
              size="lg"
              onClick={toggleListening}
              className="mt-4 text-lg h-14 px-8"
            >
              Nochmal versuchen
            </Button>
          </div>
        )}
      </div>

      {/* Main Action Button */}
      {status !== "error" && (
        <div className="relative mb-10">
          {status === "listening" && (
            <div className="absolute inset-0 rounded-full bg-primary/30 animate-pulse-ring pointer-events-none" />
          )}
          <Button
            size="icon"
            variant={status === "listening" ? "default" : "secondary"}
            disabled={status === "processing"}
            className={`h-32 w-32 rounded-full shadow-2xl transition-all duration-300 ${
              status === "listening" 
                ? "scale-110 bg-primary hover:bg-primary/90" 
                : status === "processing"
                ? "opacity-50 cursor-not-allowed"
                : "hover:scale-110 active:scale-95"
            }`}
            onClick={toggleListening}
          >
            {status === "processing" ? (
              <Loader2 className="h-12 w-12 animate-spin text-foreground" />
            ) : (
              <Mic className={`h-14 w-14 ${
                status === "listening" ? "text-primary-foreground" : "text-foreground"
              }`} />
            )}
          </Button>
          {status === "idle" && !trips.length && (
            <p className="text-center mt-4 text-sm text-muted-foreground">Tippen zum Sprechen</p>
          )}
        </div>
      )}

      {/* Results Area */}
      {status === "success" && trips.length > 0 && (
        <div className="w-full space-y-6 animate-in slide-in-from-bottom-8 duration-700">
          {routeInfo && (
            <div className="bg-card/50 backdrop-blur-sm rounded-2xl p-4 mb-6 border border-white/5">
              <div className="flex items-center justify-center gap-3 text-base">
                {routeInfo.from.includes("Standort") ? (
                  <Navigation className="h-6 w-6 text-blue-400" />
                ) : (
                  <MapPin className="h-6 w-6 text-green-400" />
                )}
                <span className="font-semibold">{routeInfo.from}</span>
                <ArrowRight className="h-5 w-5 text-primary" />
                <MapPin className="h-6 w-6 text-red-400" />
                <span className="font-semibold">{routeInfo.to}</span>
              </div>
            </div>
          )}
          
          <div className="space-y-4">
            <p className="text-center text-lg font-medium text-muted-foreground mb-4">
              Ihre nächsten Verbindungen:
            </p>
            {trips.map((trip, i) => (
              <ConnectionCard key={i} trip={trip} index={i} />
            ))}
          </div>
          
          <Button 
            variant="outline" 
            size="lg"
            onClick={() => {
              setStatus("idle");
              setTrips([]);
              setShowHelp(true);
            }}
            className="w-full mt-8 text-lg h-14"
          >
            Neue Suche
          </Button>
        </div>
      )}
    </div>
  );
}
