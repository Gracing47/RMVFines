import { useState, useCallback } from "react";
import { parseIntent, speak } from "@/lib/voice";
import { searchLocation, searchTrips, searchNearbyStations, Trip } from "@/lib/rmv-api";
import { Mic, Loader2, AlertCircle, MapPin, Navigation, ArrowRight, Accessibility } from "lucide-react";
import { ConnectionCard } from "./connection-card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useVoiceRecognition } from "@/hooks/use-voice-recognition";

export function VoiceInterface() {
  const [status, setStatus] = useState<"idle" | "listening" | "processing" | "success" | "error">("idle");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [routeInfo, setRouteInfo] = useState<{ from: string, to: string } | null>(null);
  const [showHelp, setShowHelp] = useState(true);
  const [manualInput, setManualInput] = useState("");
  const [isWheelchair, setIsWheelchair] = useState(false);

  const handleVoiceResult = useCallback(async (text: string) => {
    setStatus("processing");

    try {
      const intent = parseIntent(text);

      if (!intent.to) {
        throw new Error("Ich konnte kein Ziel verstehen. Sag zum Beispiel: 'Nach Wiesbaden'");
      }

      let fromQuery = intent.from;
      const toQuery = intent.to;

      let start;
      let dest;

      // Step A: Find Start
      if (fromQuery === "CURRENT_LOCATION") {
        speak("Ich ermittle deinen Standort...");

        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000
          });
        });

        const nearbyStations = await searchNearbyStations(
          position.coords.latitude,
          position.coords.longitude
        );

        if (nearbyStations.length === 0) {
          throw new Error("Keine Haltestelle in der Nähe gefunden.");
        }

        start = nearbyStations[0];
        fromQuery = "Deinem Standort";
        speak(`Nächste Haltestelle: ${start.name}`);
      } else {
        fromQuery = fromQuery || "Frankfurt Hauptbahnhof";
        const startLocations = await searchLocation(fromQuery);
        if (startLocations.length === 0) throw new Error(`Startort "${fromQuery}" nicht gefunden.`);
        start = startLocations[0];
      }

      // Step B: Find Dest
      const destLocations = await searchLocation(toQuery);
      if (destLocations.length === 0) {
        throw new Error(`Zielort "${toQuery}" nicht gefunden.`);
      }
      dest = destLocations[0];

      setRouteInfo({ from: start.name, to: dest.name });

      // Step C: Find Trips
      const foundTrips = await searchTrips(start.id, dest.id, isWheelchair ? 'wheelchair' : 'standard');
      if (foundTrips.length === 0) {
        throw new Error("Keine Verbindungen gefunden.");
      }

      setTrips(foundTrips.slice(0, 3));
      setStatus("success");

      const firstTrip = foundTrips[0];
      const startTime = firstTrip.legs[0].Origin.time.substring(0, 5);
      const track = firstTrip.legs[0].Origin.track;

      speak(`Die nächste Verbindung von ${start.name} nach ${dest.name} geht um ${startTime} Uhr${track ? ` von Gleis ${track}` : ''}.`);

    } catch (err: any) {
      console.error(err);
      setStatus("error");
      const msg = err.message || "Ein Fehler ist aufgetreten.";
      setErrorMsg(msg);
      speak(msg);
    }
  }, [isWheelchair]);

  const {
    isListening,
    isReceivingAudio,
    transcript,
    error: voiceError,
    startListening,
    stopListening,
    reset: resetVoice
  } = useVoiceRecognition({
    onResult: handleVoiceResult,
    onError: (err) => {
      setStatus("error");

      let msg = "Ein Fehler ist aufgetreten.";
      let speakMsg = "Es gab ein Problem.";

      if (err === 'no-speech') {
        msg = "Ich habe nichts gehört. Bitte sprich lauter oder näher am Mikrofon.";
        speakMsg = "Ich habe nichts gehört.";
      } else if (err === 'not-allowed') {
        msg = "Mikrofon-Zugriff verweigert. Bitte überprüfe deine Einstellungen.";
        speakMsg = "Ich darf dein Mikrofon nicht benutzen.";
      } else if (err === 'network') {
        msg = "Netzwerkfehler. Bitte überprüfe deine Internetverbindung.";
        speakMsg = "Ich habe keine Verbindung zum Internet.";
      } else if (err === 'aborted') {
        // Don't show error for aborted
        return;
      } else {
        msg = `Fehler: ${err}`;
      }

      setErrorMsg(msg);
      speak(speakMsg);
    }
  });

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      resetVoice();
      setTrips([]);
      setRouteInfo(null);
      setShowHelp(false);
      setStatus("listening");
      startListening();
    }
  };

  const handleReset = () => {
    setStatus("idle");
    setTrips([]);
    setShowHelp(true);
    resetVoice();
    setManualInput("");
  };

  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto min-h-[85vh] justify-center py-6 px-4">

      <div className="text-center mb-8 space-y-6 min-h-[140px] w-full">
        {status === "idle" && showHelp && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center justify-center gap-4 mb-6 bg-secondary/30 p-3 rounded-full w-fit mx-auto backdrop-blur-sm border border-white/5">
              <div className="flex items-center space-x-2">
                <Switch
                  id="wheelchair-mode"
                  checked={isWheelchair}
                  onCheckedChange={setIsWheelchair}
                />
                <Label htmlFor="wheelchair-mode" className="flex items-center gap-2 cursor-pointer font-medium">
                  <Accessibility className="h-4 w-4" />
                  Barrierefrei
                </Label>
              </div>
            </div>

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
              </div>
            </div>
          </div>
        )}

        {status === "listening" && (
          <div className="space-y-3 animate-in fade-in">
            <div className={`text-3xl font-bold animate-pulse ${isReceivingAudio ? "text-green-500" : "text-primary"}`}>
              {isReceivingAudio ? "🔊 Ich höre..." : "🎤 Sprechen Sie jetzt"}
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

      {status !== "error" && status !== "success" && (
        <div className="relative mb-10 w-full flex flex-col items-center">
          <div className="relative">
            {isListening && (
              <div className={`absolute inset-0 rounded-full animate-pulse-ring pointer-events-none ${isReceivingAudio ? "bg-green-500/30" : "bg-primary/30"}`} />
            )}
            <Button
              size="icon"
              variant={isListening ? "default" : "secondary"}
              disabled={status === "processing"}
              className={`h-32 w-32 rounded-full shadow-2xl transition-all duration-300 ${isListening
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
                <Mic className={`h-14 w-14 ${isListening ? "text-primary-foreground" : "text-foreground"
                  }`} />
              )}
            </Button>
          </div>

          {!isListening && (
            <div className="w-full max-w-sm mt-8 animate-in fade-in slide-in-from-bottom-4">
              <div className="relative mb-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Oder tippen
                  </span>
                </div>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (manualInput.trim()) {
                    handleVoiceResult(manualInput);
                  }
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="z.B. Nach Frankfurt..."
                  className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <Button type="submit" disabled={!manualInput.trim()}>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>
            </div>
          )}
        </div>
      )}

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
            onClick={handleReset}
            className="w-full mt-8 text-lg h-14"
          >
            Neue Suche
          </Button>
        </div>
      )}
    </div>
  );
}
