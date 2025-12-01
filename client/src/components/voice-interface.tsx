import { useState, useEffect, useCallback } from "react";
import { useVoiceRecognition } from "@/hooks/use-voice-recognition";
import { speak, cancelSpeech, parseIntent } from "@/lib/voice";
import { searchLocation, searchNearbyStations, searchTrips, Trip } from "@/lib/rmv-api";
import { Button } from "@/components/ui/button";
import { Mic, MapPin, Loader2, AlertCircle, ArrowRight, Keyboard, X, Accessibility } from "lucide-react";
import { ConnectionCard } from "@/components/connection-card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function VoiceInterface() {
  const [status, setStatus] = useState<"idle" | "listening" | "processing" | "success" | "error">("idle");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [routeInfo, setRouteInfo] = useState<{ from: string, to: string } | null>(null);
  const [manualInput, setManualInput] = useState("");
  const [isWheelchair, setIsWheelchair] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [permissionDeniedType, setPermissionDeniedType] = useState<"microphone" | "geolocation" | null>(null);

  const handleVoiceResult = useCallback(async (text: string) => {
    setStatus("processing");
    setManualInput(text);

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
      if (!fromQuery || fromQuery === "CURRENT_LOCATION") {
        setIsSpeaking(true);
        speak("Ich ermittle deinen Standort...", () => setIsSpeaking(false));

        try {
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
          setIsSpeaking(true);
          speak(`Nächste Haltestelle: ${start.name}`, () => setIsSpeaking(false));
        } catch (geoErr: any) {
          if (geoErr.code === 1) { // PERMISSION_DENIED
            setPermissionDeniedType('geolocation');
            setIsSpeaking(true);
            speak("Ich brauche deinen Standort. Bitte erlaube den Zugriff zusätzlich oben im Browser.", () => setIsSpeaking(false));
            setStatus("idle"); // Reset status so UI doesn't show loading
            return;
          }
          throw new Error("Standort konnte nicht ermittelt werden.");
        }
      } else {
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
      // Use extracted time or default to now
      const searchTime = intent.time || new Date();

      const foundTrips = await searchTrips(start.id, dest.id, isWheelchair ? 'wheelchair' : 'standard', searchTime);
      if (foundTrips.length === 0) {
        throw new Error("Keine Verbindungen gefunden.");
      }

      setTrips(foundTrips.slice(0, 3));
      setStatus("success");

      const firstTrip = foundTrips[0];
      const startTime = firstTrip.legs[0].Origin.time.substring(0, 5);
      const track = firstTrip.legs[0].Origin.track;
      const transportName = firstTrip.legs[0].name;
      const platformType = transportName.includes("Bus") ? "Haltestelle" : "Gleis";

      setIsSpeaking(true);
      speak(
        `Die nächste Verbindung von ${start.name} nach ${dest.name} geht um ${startTime} Uhr${track ? ` von ${platformType} ${track}` : ''}.`,
        () => setIsSpeaking(false)
      );

    } catch (err: any) {
      console.error(err);
      setStatus("error");
      const msg = err.message || "Ein Fehler ist aufgetreten.";
      setErrorMsg(msg);
      setIsSpeaking(true);
      speak(msg, () => setIsSpeaking(false));
    }
  }, [isWheelchair]);

  const {
    isListening,
    isReceivingAudio,
    transcript,
    startListening,
    stopListening,
    reset: resetVoice
  } = useVoiceRecognition({
    onResult: handleVoiceResult,
    onError: (err) => {
      if (err === 'not-allowed') {
        setPermissionDeniedType('microphone');
        setIsSpeaking(true);
        speak("Ich brauche dein Mikrofon. Bitte erlaube den Zugriff zusätzlich oben im Browser.", () => setIsSpeaking(false));
        setStatus("idle");
        return;
      }

      setStatus("error");
      setShowInput(true); // Auto-show input on error
      let msg = "Ein Fehler ist aufgetreten.";
      let speakMsg = "Es gab ein Problem.";

      if (err === 'no-speech') {
        msg = "Ich habe nichts gehört. Bitte sprich lauter.";
        speakMsg = "Ich habe nichts gehört.";
      } else if (err === 'network') {
        msg = "Netzwerkfehler. Bitte überprüfe deine Internetverbindung.";
        speakMsg = "Ich habe keine Verbindung zum Internet.";
      }

      setErrorMsg(msg);
      setIsSpeaking(true);
      speak(speakMsg, () => setIsSpeaking(false));
    }
  });

  // Update input with transcript while listening
  useEffect(() => {
    if (transcript) {
      setManualInput(transcript);
    }
  }, [transcript]);

  const toggleListening = () => {
    // Reset permission state if user tries again
    if (permissionDeniedType) {
      setPermissionDeniedType(null);
    }

    if (isSpeaking) {
      cancelSpeech();
      setIsSpeaking(false);
      // Fall through to start listening
    }

    if (isListening) {
      stopListening();
    } else {
      resetVoice();
      setTrips([]);
      setRouteInfo(null);
      setStatus("listening");
      startListening();
      setShowInput(false);
    }
  };

  const handleReset = () => {
    setStatus("idle");
    setTrips([]);
    resetVoice();
    setManualInput("");
    setShowInput(false);
    setPermissionDeniedType(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      handleVoiceResult(manualInput);
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-3xl mx-auto min-h-[85vh] py-8 px-4 relative overflow-hidden">

      {/* Permission Dialog Overlay */}
      {permissionDeniedType && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full border border-slate-100 text-center transform scale-100 animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
              {permissionDeniedType === 'microphone' ? <Mic className="h-8 w-8" /> : <MapPin className="h-8 w-8" />}
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">
              Zugriff erforderlich
            </h3>
            <p className="text-slate-600 mb-6 leading-relaxed">
              {permissionDeniedType === 'microphone'
                ? "Damit ich dich verstehen kann, benötige ich Zugriff auf dein Mikrofon."
                : "Damit ich Verbindungen von deinem Standort finden kann, benötige ich Zugriff auf deinen Standort."
              }
            </p>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6 text-sm text-slate-500 text-left flex items-start gap-3">
              <div className="mt-0.5">🔒</div>
              <div>
                Tippe auf das <strong>Schloss-Symbol</strong> in der Adressleiste und aktiviere den Zugriff <strong>zusätzlich</strong>.
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setPermissionDeniedType(null)}
              >
                Abbrechen
              </Button>
              <Button
                className="flex-1 bg-primary hover:bg-primary/90 text-white"
                onClick={() => {
                  setPermissionDeniedType(null);
                  if (permissionDeniedType === 'microphone') {
                    toggleListening();
                  } else {
                    // Retry last command? For now just close dialog and let user try again
                    // Ideally we would retry the last action, but simple is better here.
                  }
                }}
              >
                Erneut versuchen
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header / Brand Area */}
      <div className="w-full flex justify-between items-center mb-8 z-10">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold shadow-lg shadow-primary/20">
            RMV
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-800">Voice</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-full shadow-sm border border-slate-100">
            <Switch
              id="wheelchair-mode"
              checked={isWheelchair}
              onCheckedChange={setIsWheelchair}
            />
            <Label htmlFor="wheelchair-mode" className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-600">
              <Accessibility className="h-4 w-4" />
              Barrierefrei
            </Label>
          </div>
        </div>
      </div>

      {/* Main Interaction Area */}
      <div className={`w-full flex flex-col items-center transition-all duration-700 ease-in-out z-10 ${status === 'success' && !isSpeaking ? 'mt-0' : 'mt-12'}`}>

        {/* Dynamic Title */}
        <div className="text-center mb-12 h-24 flex flex-col justify-center items-center">
          {status === 'idle' && (
            <h1 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tight animate-in fade-in slide-in-from-bottom-4 duration-700">
              Wohin geht's?
            </h1>
          )}

          {status === 'listening' && (
            <h1 className="text-3xl md:text-5xl font-bold text-primary animate-pulse">
              Ich höre zu...
            </h1>
          )}

          {status === 'processing' && (
            <h1 className="text-3xl md:text-5xl font-bold text-slate-700 flex items-center gap-3">
              <Loader2 className="h-8 w-8 md:h-12 md:w-12 animate-spin text-primary" />
              Moment...
            </h1>
          )}

          {/* Show "Speaking" title when speaking, even if success */}
          {isSpeaking && (
            <h1 className="text-3xl md:text-5xl font-bold text-primary animate-pulse">
              Ich spreche...
            </h1>
          )}

          {status === 'success' && !isSpeaking && (
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
              Verbindungen gefunden
            </h1>
          )}

          {status === 'error' && !isSpeaking && (
            <h1 className="text-2xl md:text-3xl font-bold text-destructive flex items-center gap-3">
              <AlertCircle className="h-8 w-8" />
              Ups, ein Fehler
            </h1>
          )}

          {/* Transcript / Subtitle */}
          <div className="mt-4 h-8">
            {transcript && status === 'listening' && (
              <p className="text-xl text-slate-600 font-medium animate-in fade-in">"{transcript}"</p>
            )}
            {status === 'idle' && !showInput && (
              <p className="text-slate-500 text-lg">Tippe auf das Mikrofon und sprich.</p>
            )}
            {status === 'error' && (
              <p className="text-slate-500">{errorMsg}</p>
            )}
          </div>
        </div>

        {/* THE ORB - Central Interaction Element */}
        {/* Show Orb if NOT success OR if Speaking */}
        {(status !== 'success' || isSpeaking) && (
          <div className="relative mb-12 group">
            {/* Animated Rings for Listening/Speaking State */}
            {(isListening || isSpeaking) && (
              <>
                <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping duration-[2000ms]" />
                <div className="absolute inset-[-20px] rounded-full bg-primary/10 animate-pulse duration-[1500ms]" />
              </>
            )}

            {/* Idle Pulse */}
            {status === 'idle' && (
              <div className="absolute inset-0 rounded-full bg-primary/5 animate-pulse duration-[3000ms]" />
            )}

            <Button
              size="icon"
              onClick={toggleListening}
              className={cn(
                "relative h-32 w-32 md:h-40 md:w-40 rounded-full shadow-2xl transition-all duration-500 flex items-center justify-center border-4 overflow-hidden",
                (isListening || isSpeaking)
                  ? "bg-primary border-primary-foreground/20 scale-110"
                  : "bg-gradient-to-br from-primary to-red-600 border-white hover:scale-105 hover:shadow-primary/30"
              )}
            >
              {(isListening || isSpeaking) ? (
                <div className="flex items-center justify-center gap-1 h-16 w-full px-4">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="w-2 bg-white rounded-full animate-wave"
                      style={{
                        animationDelay: `${i * 0.15}s`,
                        height: isSpeaking ? '60%' : '40%' // Higher waves when speaking
                      }}
                    />
                  ))}
                </div>
              ) : (
                <Mic className="h-12 w-12 md:h-16 md:w-16 text-white transition-all duration-300" />
              )}
            </Button>
          </div>
        )}

        {/* Manual Input Toggle - Hide when speaking or success */}
        {status !== 'success' && !isSpeaking && (
          <div className="w-full max-w-md mx-auto transition-all duration-300">
            {!showInput ? (
              <Button
                variant="ghost"
                onClick={() => setShowInput(true)}
                className="mx-auto flex items-center gap-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <Keyboard className="h-4 w-4" />
                Tastatur verwenden
              </Button>
            ) : (
              <form onSubmit={handleSubmit} className="relative animate-in fade-in slide-in-from-bottom-2">
                <input
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="z.B. Nach Frankfurt..."
                  className="w-full h-12 pl-4 pr-12 rounded-xl border border-slate-200 shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-lg"
                  autoFocus
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowInput(false)}
                  className="absolute right-1 top-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </Button>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Results Section - Only show when NOT speaking */}
      {status === "success" && trips.length > 0 && !isSpeaking && (
        <div className="w-full max-w-2xl animate-in slide-in-from-bottom-8 duration-700 fade-in">
          {routeInfo && (
            <div className="flex items-center justify-between text-sm text-slate-500 mb-6 bg-slate-50 px-4 py-3 rounded-lg border border-slate-100">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-slate-400" />
                <span className="font-medium text-slate-700">{routeInfo.from}</span>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-300" />
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <span className="font-medium text-slate-700">{routeInfo.to}</span>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {trips.map((trip, i) => (
              <ConnectionCard key={i} trip={trip} index={i} />
            ))}
          </div>

          <div className="mt-8 flex justify-center gap-4">
            <Button
              size="lg"
              onClick={toggleListening}
              className="rounded-full h-14 px-8 shadow-lg bg-primary hover:bg-primary/90 text-white font-bold text-lg flex items-center gap-2"
            >
              <Mic className="h-5 w-5" />
              Neue Anfrage
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
