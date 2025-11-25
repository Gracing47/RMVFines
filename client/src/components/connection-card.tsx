import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trip, formatTime, getDelay } from "@/lib/rmv-api";
import { ArrowRight, Ticket, ChevronDown, ChevronUp, AlertTriangle, Train, Bus, TramFront } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface ConnectionCardProps {
  trip: Trip;
  index: number;
}

export function ConnectionCard({ trip, index }: ConnectionCardProps) {
  const [isOpen, setIsOpen] = useState(false);

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
  
  const duration = trip.duration
    .replace("PT", "")
    .replace("H", "h ")
    .replace("M", "min")
    .toLowerCase();

  // Calculate minutes until departure
  const now = new Date();
  const departureDate = new Date(`${firstLeg.Origin.rtDate || firstLeg.Origin.date}T${firstLeg.Origin.rtTime || firstLeg.Origin.time}`);
  const diffMs = departureDate.getTime() - now.getTime();
  const minutesUntil = Math.floor(diffMs / 60000);
  
  // Transport Icon Logic
  const getTransportIcon = (name: string) => {
    if (name.includes("Bus")) return <Bus className="h-5 w-5" />;
    if (name.includes("TramFront") || name.includes("Str")) return <TramFront className="h-5 w-5" />;
    return <Train className="h-5 w-5" />;
  };

  // Transport Color Logic
  const getTransportColor = (name: string) => {
    if (name.includes("S")) return "text-green-500";
    if (name.includes("ICE") || name.includes("IC")) return "text-red-500";
    if (name.includes("RB") || name.includes("RE")) return "text-gray-200";
    return "text-blue-400";
  };

  const transportName = firstLeg.name.replace(/\s+/g, ' ');
  const transfers = trip.legs.length - 1;

  return (
    <div 
      className="animate-in slide-in-from-bottom-4 fade-in duration-500"
      style={{ animationDelay: `${index * 150}ms` }}
    >
      <Card className="bg-card/90 border-white/10 backdrop-blur-sm overflow-hidden hover:bg-accent/10 transition-all hover:shadow-xl hover:scale-[1.02] group">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <CardContent className="p-0 cursor-pointer">
              <div className="flex items-stretch min-h-[110px]">
                
                {/* Left: Minutes Countdown */}
                <div className="w-28 flex flex-col items-center justify-center border-r border-white/10 bg-gradient-to-br from-primary/10 to-primary/5 p-3">
                  <span className={cn("text-4xl font-black", minutesUntil <= 5 ? "text-red-500 animate-pulse" : minutesUntil <= 10 ? "text-orange-500" : "text-foreground")}>
                    {minutesUntil > 0 ? minutesUntil : "<1"}
                  </span>
                  <span className="text-sm text-muted-foreground font-bold uppercase tracking-wider mt-1">
                    Min
                  </span>
                </div>

                {/* Middle: Trip Info */}
                <div className="flex-1 p-4 flex flex-col justify-center gap-2">
                  
                  {/* Line & Destination */}
                  <div className="flex items-center gap-3 mb-1">
                    <span className={cn("text-lg font-black flex items-center gap-2", getTransportColor(transportName))}>
                      {getTransportIcon(transportName)}
                      {transportName}
                    </span>
                  </div>

                  {/* Times & Duration */}
                  <div className="text-base text-muted-foreground flex items-center gap-2 flex-wrap">
                    <span className={cn("font-mono text-foreground font-bold text-lg", delay > 0 && "line-through text-muted-foreground/50")}>
                      {startTime}
                    </span>
                    {delay > 0 && <span className="text-red-500 font-mono font-black text-lg">{rtStartTime}</span>}
                    <ArrowRight className="h-4 w-4" />
                    <span className="font-mono text-foreground font-bold text-lg">
                      {rtEndTime || endTime}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm flex-wrap">
                    <span className="font-medium">{transfers === 0 ? "✅ Direkt" : `${transfers} Umstieg${transfers > 1 ? 'e' : ''}`}</span>
                    <span className="text-white/30">•</span>
                    <span className="font-medium">{duration}</span>
                  </div>

                  {/* Delay/Track Info */}
                  <div className="flex items-center gap-3 mt-1">
                    {track && (
                      <span className="text-sm bg-primary/20 px-3 py-1 rounded-full text-foreground font-bold border border-primary/30">
                        Gleis {track}
                      </span>
                    )}
                    {delay > 0 && (
                      <span className="text-sm text-red-400 flex items-center gap-1 font-bold animate-pulse">
                        ⚠️ +{delay} min Verspätung
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Expand Indicator */}
                <div className="flex flex-col items-center justify-center p-4 border-l border-white/10 bg-gradient-to-br from-white/5 to-transparent w-16">
                  {isOpen ? (
                    <ChevronUp className="h-7 w-7 text-primary" />
                  ) : (
                    <ChevronDown className="h-7 w-7 text-muted-foreground group-hover:text-primary transition-colors" />
                  )}
                  <span className="text-xs text-muted-foreground mt-1">{isOpen ? 'Weniger' : 'Mehr'}</span>
                </div>
              </div>
            </CardContent>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="bg-black/30 border-t border-white/10 p-5 space-y-5">
              <h4 className="text-base font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                🚆 Fahrtverlauf
              </h4>
              
              {/* Timeline */}
              <div className="relative pl-6 border-l-2 border-primary/30 space-y-7 ml-2">
                {legs.map((leg, i) => (
                  <div key={i} className="relative">
                    {/* Dot */}
                    <div className="absolute -left-[25px] top-1 w-4 h-4 rounded-full bg-primary border-4 border-background shadow-lg shadow-primary/50" />
                    
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-base text-foreground">{leg.Origin.name}</span>
                        <span className="font-mono text-base text-muted-foreground font-bold">{formatTime(leg.Origin.time)}</span>
                      </div>
                      
                      <div className="flex items-center gap-3 text-sm text-muted-foreground my-2 p-3 rounded-lg bg-white/10 border border-white/5">
                        <span className={cn("flex items-center gap-2 font-bold text-base", getTransportColor(leg.name))}>
                          {getTransportIcon(leg.name)}
                          {leg.name}
                        </span>
                        <ArrowRight className="h-4 w-4 opacity-50" />
                        <span className="text-foreground font-medium">{leg.Destination.name}</span>
                      </div>

                      {i === legs.length - 1 && (
                        <div className="mt-5 relative">
                           <div className="absolute -left-[25px] top-1 w-4 h-4 rounded-full bg-green-500 border-4 border-background shadow-lg shadow-green-500/50" />
                           <div className="flex items-center justify-between">
                            <span className="font-bold text-base text-foreground">🎯 {leg.Destination.name}</span>
                            <span className="font-mono text-base text-muted-foreground font-bold">{formatTime(leg.Destination.time)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg h-14 mt-6 shadow-lg">
                🎫 Ticket kaufen
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  );
}
