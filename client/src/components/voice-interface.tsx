import { useState, useEffect, useRef } from "react";
import { VoiceAssistant, parseIntent } from "@/lib/voice";
import { searchLocation, searchTrips, Trip } from "@/lib/rmv-api";
import { Mic, Loader2, AlertCircle, MapPin } from "lucide-react";
import { ConnectionCard } from "./connection-card";
import { Button } from "@/components/ui/button";

export function VoiceInterface() {
  const [status, setStatus] = useState<"idle" | "listening" | "processing" | "success" | "error">("idle");
  const [transcript, setTranscript] = useState("");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [routeInfo, setRouteInfo] = useState<{from: string, to: string} | null>(null);
  
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

    const fromQuery = intent.from || "Frankfurt Hauptbahnhof"; // Default fallback
    const toQuery = intent.to;

    try {
      // Step A: Find Start
      const startLocations = await searchLocation(fromQuery);
      if (startLocations.length === 0) throw new Error(`Startort "${fromQuery}" nicht gefunden.`);
      const start = startLocations[0];

      // Step B: Find Dest
      const destLocations = await searchLocation(toQuery);
      if (destLocations.length === 0) throw new Error(`Zielort "${toQuery}" nicht gefunden.`);
      const dest = destLocations[0];

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
      const startTime = firstTrip.Trip[0].LegList.Leg[0].Origin.time.substring(0, 5);
      const track = firstTrip.Trip[0].LegList.Leg[0].Origin.track;
      
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
    } else {
      setTranscript("");
      setErrorMsg("");
      setTrips([]);
      setRouteInfo(null);
      assistantRef.current?.start();
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto min-h-[80vh] justify-center py-8">
      
      {/* Header / Transcript Area */}
      <div className="text-center mb-12 space-y-4 min-h-[100px]">
        {status === "idle" && !trips.length && (
          <h2 className="text-2xl font-light text-muted-foreground animate-in fade-in slide-in-from-top-4">
            "Von Frankfurt nach Wiesbaden"
          </h2>
        )}
        
        {status === "listening" && (
          <div className="text-xl text-primary font-medium animate-pulse">
            Ich höre zu...
          </div>
        )}

        {transcript && (
          <div className="text-2xl font-medium text-foreground px-4">
            "{transcript}"
          </div>
        )}

        {status === "processing" && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Suche Verbindung...
          </div>
        )}

        {status === "error" && (
          <div className="flex items-center justify-center gap-2 text-destructive animate-in shake">
            <AlertCircle className="h-5 w-5" />
            {errorMsg}
          </div>
        )}
      </div>

      {/* Main Action Button */}
      <div className="relative mb-12">
        {status === "listening" && (
          <div className="absolute inset-0 rounded-full bg-primary/20 animate-pulse-ring pointer-events-none" />
        )}
        <Button
          size="icon"
          variant={status === "listening" ? "default" : "secondary"}
          className={`h-24 w-24 rounded-full shadow-2xl transition-all duration-300 ${
            status === "listening" ? "scale-110 bg-primary hover:bg-primary" : "hover:scale-105"
          }`}
          onClick={toggleListening}
        >
          <Mic className={`h-10 w-10 ${status === "listening" ? "text-primary-foreground" : "text-foreground"}`} />
        </Button>
      </div>

      {/* Results Area */}
      {status === "success" && trips.length > 0 && (
        <div className="w-full space-y-4 px-4 animate-in slide-in-from-bottom-8 duration-700">
          {routeInfo && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-6">
              <MapPin className="h-4 w-4" />
              <span>{routeInfo.from}</span>
              <span className="text-white/20">→</span>
              <span>{routeInfo.to}</span>
            </div>
          )}
          
          <div className="space-y-3">
            {trips.map((trip, i) => (
              <ConnectionCard key={i} trip={trip} index={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
