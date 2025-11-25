import { Card, CardContent } from "@/components/ui/card";
import { Trip, formatTime } from "@/lib/rmv-api";
import { ArrowRight, Clock, Train } from "lucide-react";

interface ConnectionCardProps {
  trip: Trip;
  index: number;
}

export function ConnectionCard({ trip, index }: ConnectionCardProps) {
  // Get first and last leg for overview
  const firstLeg = trip.Trip[0].LegList.Leg[0];
  const legs = trip.Trip[0].LegList.Leg;
  const lastLeg = legs[legs.length - 1];

  const startTime = formatTime(firstLeg.Origin.time);
  const endTime = formatTime(lastLeg.Destination.time);
  const duration = trip.Trip[0].duration; // e.g., "PT1H2M"
  
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
                {startTime}
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
                {endTime}
              </div>
              <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                <Clock className="h-3 w-3" />
                {cleanDuration}
              </div>
            </div>
            <div className="bg-primary/20 text-primary px-3 py-1 rounded-full text-xs font-bold font-mono">
              Gl. {firstLeg.Origin.track || "?"}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <div className="w-1 h-full bg-white/10 rounded-full" />
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
