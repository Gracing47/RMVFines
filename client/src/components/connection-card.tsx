import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trip, formatTime, getDelay } from "@/lib/rmv-api";
import { ArrowRight, ChevronDown, ChevronUp, Train, Bus, TramFront, Clock } from "lucide-react";
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
    if (name.includes("Bus")) return <Bus className="h-4 w-4" />;
    if (name.includes("TramFront") || name.includes("Str")) return <TramFront className="h-4 w-4" />;
    return <Train className="h-4 w-4" />;
  };

  // Transport Color Logic - Adjusted for light theme
  const getTransportColor = (name: string) => {
    if (name.includes("S")) return "bg-green-100 text-green-700 border-green-200";
    if (name.includes("ICE") || name.includes("IC")) return "bg-red-100 text-red-700 border-red-200";
    if (name.includes("RB") || name.includes("RE")) return "bg-slate-100 text-slate-700 border-slate-200";
    return "bg-blue-100 text-blue-700 border-blue-200";
  };

  const transportName = firstLeg.name.replace(/\s+/g, ' ');
  const transfers = trip.legs.length - 1;

  // Helper for Platform Badge
  const PlatformBadge = ({ track, type }: { track?: string, type: string }) => {
    if (!track) return null;
    const label = type.includes("Bus") ? "Bstg." : "Gl.";
    return (
      <span className="bg-[#13182C] text-white text-[11px] font-bold px-2 py-1 rounded-sm ml-auto shrink-0 shadow-sm">
        {label} {track}
      </span>
    );
  };

  return (
    <div
      className="animate-in slide-in-from-bottom-4 fade-in duration-500"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <Card className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <CardContent className="p-0 cursor-pointer">
              <div className="flex">

                {/* Left: Time & Duration */}
                <div className="w-24 flex flex-col items-center justify-center border-r border-slate-100 bg-slate-50/50 p-4">
                  <div className="text-center">
                    <span className={cn("text-2xl font-bold block leading-none", delay > 5 ? "text-red-600" : "text-slate-900")}>
                      {rtStartTime || startTime}
                    </span>
                    {delay > 0 && (
                      <span className="text-xs font-medium text-red-600 block mt-1">
                        +{delay} min
                      </span>
                    )}
                  </div>
                  <div className="h-8 w-px bg-slate-200 my-2"></div>
                  <span className="text-slate-500 font-medium text-lg">
                    {rtEndTime || endTime}
                  </span>
                </div>

                {/* Middle: Journey Details */}
                <div className="flex-1 p-4 flex flex-col justify-between min-h-[120px]">

                  {/* Top: Transport & Direction */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn("text-xs font-bold px-2 py-0.5 rounded border flex items-center gap-1.5", getTransportColor(transportName))}>
                          {getTransportIcon(transportName)}
                          {transportName}
                        </span>
                        {track && (
                          <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            {transportName.includes("Bus") ? "H." : "Gl."} {track}
                          </span>
                        )}
                      </div>
                      <span className="font-medium text-slate-900 line-clamp-1">
                        Richtung {firstLeg.Destination.name}
                      </span>
                    </div>
                  </div>

                  {/* Bottom: Duration & Transfers */}
                  <div className="flex items-center gap-4 text-sm text-slate-500 mt-auto">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4" />
                      <span>{duration}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={cn("font-medium", transfers > 0 ? "text-slate-700" : "text-green-600")}>
                        {transfers === 0 ? "Direktverbindung" : `${transfers} Umstieg${transfers > 1 ? 'e' : ''}`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Action */}
                <div className="w-12 flex items-center justify-center border-l border-slate-100 bg-slate-50/30 text-slate-400 group-hover:text-primary transition-colors">
                  {isOpen ? <ChevronUp className="h-6 w-6" /> : <ChevronDown className="h-6 w-6" />}
                </div>
              </div>
            </CardContent>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="bg-slate-50/50 border-t border-slate-100 p-5">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-6">
                Reiseverlauf
              </h4>

              {/* Timeline */}
              <div className="relative pl-2 space-y-0">
                {/* Vertical Line */}
                <div className="absolute left-[9px] top-2 bottom-2 w-0.5 bg-slate-300"></div>

                {legs.map((leg, i) => (
                  <div key={i} className="relative pb-8 last:pb-0">

                    {/* ORIGIN OF LEG */}
                    <div className="flex gap-4 relative items-center group/stop">
                      <div className="w-5 h-5 rounded-full bg-white border-[3px] border-slate-700 z-10 shrink-0 shadow-sm group-hover/stop:scale-110 transition-transform"></div>
                      <div className="flex-1 flex items-center justify-between bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
                          <span className="font-bold text-slate-900 w-14">{formatTime(leg.Origin.time)}</span>
                          <span className="font-semibold text-slate-800">{leg.Origin.name}</span>
                        </div>
                        <PlatformBadge track={leg.Origin.track} type={leg.name} />
                      </div>
                    </div>

                    {/* TRANSPORT SEGMENT */}
                    <div className="ml-[19px] border-l-2 border-slate-300 pl-6 py-4 my-1 flex flex-col justify-center">
                      <div className="flex items-center gap-3">
                        <span className={cn("text-xs font-bold px-2 py-1 rounded border flex items-center gap-1.5 shadow-sm", getTransportColor(leg.name))}>
                          {getTransportIcon(leg.name)}
                          {leg.name}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                          nach {leg.Destination.name}
                        </span>
                      </div>
                      {/* Stopovers could go here */}
                    </div>

                    {/* DESTINATION OF LEG */}
                    <div className="flex gap-4 relative items-center group/stop">
                      <div className="w-5 h-5 rounded-full bg-slate-700 border-[3px] border-slate-700 z-10 shrink-0 shadow-sm group-hover/stop:scale-110 transition-transform"></div>
                      <div className="flex-1 flex items-center justify-between bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
                          <span className="font-bold text-slate-900 w-14">{formatTime(leg.Destination.time)}</span>
                          <span className="font-semibold text-slate-800">{leg.Destination.name}</span>
                        </div>
                        <PlatformBadge track={leg.Destination.track} type={leg.name} />
                      </div>
                    </div>

                    {/* TRANSFER INFO (if not last leg) */}
                    {i < legs.length - 1 && (
                      <div className="ml-[19px] border-l-2 border-dashed border-slate-300 pl-6 py-3 my-1">
                        <div className="text-xs font-medium text-slate-500 flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                          {/* @ts-ignore - transferDuration exists in API response but not yet in interface */}
                          {leg.transferDuration ? `${leg.transferDuration} Min. Umstieg` : "Umstieg"}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <Button className="w-full mt-8 bg-primary hover:bg-primary/90 text-white font-medium h-12 shadow-sm rounded-xl">
                {/* @ts-ignore - price exists in API response but not yet in interface */}
                Ticket auswählen ab {trip.price ? trip.price.toFixed(2).replace('.', ',') : '4,90'} €
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  );
}
