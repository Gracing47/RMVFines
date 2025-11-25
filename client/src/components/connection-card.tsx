import { Card, CardContent } from "@/components/ui/card";
import { Trip, formatTime, getDelay } from "@/lib/rmv-api";
import { ArrowRight, Clock, Train, AlertTriangle } from "lucide-react";

interface ConnectionCardProps {
  trip: Trip;
  index: number;
}

export function ConnectionCard({ trip, index }: ConnectionCardProps) {
  // Get first and last leg for overview
  const firstLeg = trip.legs[0];
  const legs = trip.legs;
  const lastLeg = legs[legs.length - 1];

  const startTime = formatTime(firstLeg.Origin.time);
  const rtStartTime = firstLeg.Origin.rtTime ? formatTime(firstLeg.Origin.rtTime) : null;
  const endTime = formatTime(lastLeg.Destination.time);
  const rtEndTime = lastLeg.Destination.rtTime ? formatTime(lastLeg.Destination.rtTime) : null;
  
  const delay = getDelay(firstLeg.Origin.time, firstLeg.Origin.rtTime);
  const track = firstLeg.Origin.rtTrack || firstLeg.Origin.track;
  
  const duration = trip.duration; // e.g., "PT1H2M"
  
  // Clean up duration string (PT1H2M -> 1h 2min)
  const cleanDuration = duration
    .replace("PT", "")
    .replace("H", "h ")
    .replace("M", "min")
    .toLowerCase();

  // Get transport types involved (S-Bahn, Bus, etc.)
  const transportTypes = legs
    .map((l) => l.name.replace(/\s+/g, ' '))
    .filter((v, i, a) => a.indexOf(v) === i) // unique
    .join(" → ");

  // Check for high occupancy note
  const highOccupancy = firstLeg.Origin.Notes?.Note?.some(n => 
    n.value?.includes("Hohe Belegung") || n.key === "text.occup.loc.max.12"
  );

  return (
    <div 
      className="animate-in slide-in-from-bottom-4 fade-in duration-500"
      style={{ animationDelay: `${index * 150}ms` }}
    >
      <Card className="bg-secondary/50 border-white/10 backdrop-blur-md overflow-hidden hover:bg-secondary/70 transition-colors">
        <CardContent className="p-5">
          <div className="flex justify-between items-start mb-4">
            <div className="flex flex-col">
              <div className="flex items-center gap-2 text-3xl font-bold font-mono text-foreground">
                <span className={delay > 0 ? "line-through text-muted-foreground text-xl mr-1" : ""}>
                  {startTime}
                </span>
                {delay > 0 && (
                  <span className="text-destructive">{rtStartTime}</span>
                )}
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
                <span>
                   {rtEndTime && delay > 0 ? rtEndTime : endTime}
                </span>
              </div>
              
              <div className="text-sm text-muted-foreground mt-1 flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {cleanDuration}
                </span>
                {delay > 0 && (
                  <span className="text-destructive text-xs font-bold">
                    +{delay} min Verspätung
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-2">
              <div className="bg-primary/20 text-primary px-3 py-1 rounded-full text-xs font-bold font-mono">
                Gl. {track || "?"}
              </div>
              {highOccupancy && (
                <div className="flex items-center gap-1 text-[10px] text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded-full border border-orange-400/20">
                  <AlertTriangle className="h-3 w-3" />
                  Voller Zug
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <div className={`w-1 h-full rounded-full ${delay > 5 ? 'bg-destructive' : 'bg-primary'}`} />
              <div className="flex-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider mb-1">
                  <Train className="h-3 w-3" />
                  Verbindung
                </div>
                <div className="text-foreground/90 font-medium truncate">
                  {transportTypes}
                </div>
              </div>
            </div>
            
            <div className="flex justify-between items-end text-xs text-muted-foreground mt-4 border-t border-white/5 pt-3">
              <span>{firstLeg.Origin.name}</span>
              <span className="text-right">{lastLeg.Destination.name}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
