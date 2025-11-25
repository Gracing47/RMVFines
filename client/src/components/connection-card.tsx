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
      <Card className="bg-card/80 border-white/5 backdrop-blur-sm overflow-hidden hover:bg-accent/5 transition-colors group">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <CardContent className="p-0 cursor-pointer">
              <div className="flex items-stretch min-h-[100px]">
                
                {/* Left: Minutes Countdown */}
                <div className="w-24 flex flex-col items-center justify-center border-r border-white/5 bg-white/5 p-2">
                  <span className={cn("text-3xl font-bold", minutesUntil <= 5 ? "text-red-500" : "text-foreground")}>
                    {minutesUntil > 0 ? minutesUntil : "0"}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    min
                  </span>
                </div>

                {/* Middle: Trip Info */}
                <div className="flex-1 p-4 flex flex-col justify-center gap-1">
                  
                  {/* Line & Destination */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn("font-bold flex items-center gap-2", getTransportColor(transportName))}>
                      {getTransportIcon(transportName)}
                      {transportName}
                    </span>
                  </div>

                  {/* Times & Duration */}
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <span className={cn("font-mono text-foreground font-medium", delay > 0 && "line-through text-muted-foreground/50")}>
                      {startTime}
                    </span>
                    {delay > 0 && <span className="text-red-500 font-mono font-bold">{rtStartTime}</span>}
                    <span>-</span>
                    <span className="font-mono text-foreground font-medium">
                      {rtEndTime || endTime}
                    </span>
                    
                    <span className="mx-2 text-white/20">•</span>
                    <span>{transfers === 0 ? "Direkt" : `${transfers} Umstieg${transfers > 1 ? 'e' : ''}`}</span>
                    <span className="mx-2 text-white/20">•</span>
                    <span>{duration}</span>
                  </div>

                  {/* Delay/Track Info */}
                  <div className="flex items-center gap-3 mt-1">
                    {track && (
                      <span className="text-xs bg-white/10 px-2 py-0.5 rounded text-foreground/80">
                        Gl. {track}
                      </span>
                    )}
                    {delay > 0 && (
                      <span className="text-xs text-red-400 flex items-center gap-1">
                        +{delay} min
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Ticket & Expand */}
                <div className="flex flex-col items-center justify-center p-2 gap-2 border-l border-white/5 bg-white/5 w-16">
                  <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full hover:bg-primary/20 hover:text-primary text-muted-foreground">
                    <Ticket className="h-5 w-5" />
                  </Button>
                  {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </div>
            </CardContent>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="bg-black/20 border-t border-white/5 p-4 space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Fahrtverlauf</h4>
              
              {/* Timeline */}
              <div className="relative pl-4 border-l border-white/10 space-y-6 ml-2">
                {legs.map((leg, i) => (
                  <div key={i} className="relative">
                    {/* Dot */}
                    <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background" />
                    
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-foreground">{leg.Origin.name}</span>
                        <span className="font-mono text-xs text-muted-foreground">{formatTime(leg.Origin.time)}</span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs text-muted-foreground my-1 p-2 rounded bg-white/5">
                        {getTransportIcon(leg.name)}
                        <span className={getTransportColor(leg.name)}>{leg.name}</span>
                        <ArrowRight className="h-3 w-3 opacity-50" />
                        <span>{leg.Destination.name}</span>
                      </div>

                      {i === legs.length - 1 && (
                        <div className="mt-4 relative">
                           <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-white border-2 border-background" />
                           <div className="flex items-center justify-between">
                            <span className="font-medium text-sm text-foreground">{leg.Destination.name}</span>
                            <span className="font-mono text-xs text-muted-foreground">{formatTime(leg.Destination.time)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <Button className="w-full bg-primary/90 hover:bg-primary text-primary-foreground font-medium">
                Ticket kaufen ({trip.legs.length > 1 ? 'Preisstufe 4' : 'Preisstufe 3'})
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  );
}
