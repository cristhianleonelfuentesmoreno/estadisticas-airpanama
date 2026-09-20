"use client";

import { useEffect, useState } from "react";
import { getUpcomingFlights, FlightData } from "@/app/actions/flights";
import Link from "next/link";

export function FlightListBoard() {
  const [flights, setFlights] = useState<FlightData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getUpcomingFlights();
        setFlights(data);
      } catch (err) {
        console.error("Error loading flights:", err);
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
    // Update every 5 minutes (300000 ms) as requested for real-time feel
    const interval = setInterval(loadData, 300000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-surface-container-lowest rounded-2xl p-space-md border border-white/5 shadow-sm animate-pulse flex flex-col gap-4">
        <div className="h-6 bg-surface-container-low rounded w-1/4"></div>
        <div className="h-32 bg-surface-container-low rounded-xl"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-space-sm font-sans">
      {/* Header */}
      <div className="flex items-center justify-between px-1 pb-2">
        <div className="flex items-center gap-3">
          <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">Próximos Vuelos</h2>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-surface-container rounded-full border border-white/5">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
            <span className="font-label-sm text-label-sm font-bold text-on-surface-variant">Hoy</span>
          </div>
        </div>
        <Link href="/dashboard/vuelos" className="text-secondary font-label-md text-label-md font-bold flex items-center gap-1 hover:opacity-80 transition-opacity">
          Ver todos
          <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        </Link>
      </div>

      {/* Flight Cards */}
      <div className="flex flex-col gap-space-sm">
        {flights.map(flight => (
          <FlightCard key={flight.id} flight={flight} />
        ))}
        {flights.length === 0 && (
          <div className="p-space-xl text-center text-on-surface-variant font-body-md text-body-md bg-surface-container-lowest rounded-xl border border-white/5">
            No hay vuelos programados para hoy.
          </div>
        )}
      </div>
    </div>
  );
}

function FlightCard({ flight }: { flight: FlightData }) {
  // Determine status badge styling
  let badgeClass = "bg-primary/15 text-primary border-primary/20";
  let badgeIcon = "check_circle";
  
  if (flight.status === 'ABORDANDO') {
    badgeClass = "bg-tertiary/15 text-tertiary border-tertiary/20";
    badgeIcon = "flight_takeoff";
  } else if (flight.status === 'RETRASADO') {
    badgeClass = "bg-error/15 text-error border-error/20";
    badgeIcon = "warning";
  } else if (flight.status === 'LLEGÓ') {
    badgeClass = "bg-surface-container-high text-on-surface-variant border-white/10";
    badgeIcon = "flight_land";
  } else if (flight.status === 'EN VUELO') {
    badgeClass = "bg-secondary/15 text-secondary border-secondary/20";
    badgeIcon = "flight";
  }

  // Format times
  const dTime = new Date(flight.departureTime);
  const aTime = new Date(flight.arrivalTime);
  const timeOpts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
  const depTimeStr = dTime.toLocaleTimeString('es-PA', timeOpts);
  const arrTimeStr = aTime.toLocaleTimeString('es-PA', timeOpts);

  // Plane color based on status
  const planeColorClass = flight.status === 'LLEGÓ' ? 'text-primary' : 'text-error';
  // Progress clamping
  const progressPercent = Math.min(Math.max(flight.progress, 0), 100);

  return (
    <div className="bg-surface-container-lowest rounded-xl p-space-md border border-white/5 shadow-sm flex flex-col gap-space-md hover:border-white/10 transition-colors">
      
      {/* Top row: Flight Info & Status */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="font-headline-sm text-headline-sm font-black text-on-surface">{flight.flightNumber}</span>
          <span className="font-label-md text-label-md font-medium text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-md border border-white/5">
            {flight.aircraft} ({flight.aircraftReg})
          </span>
        </div>
        
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-sm text-label-sm font-bold border uppercase ${badgeClass}`}>
          <div className={`w-2 h-2 rounded-full ${flight.status === 'LLEGÓ' ? 'bg-on-surface-variant' : 'bg-current'}`}></div>
          {flight.status}
        </div>
      </div>

      {/* Middle row: Grid layout for Origin - Line - Destination */}
      <div className="flex items-center justify-between w-full">
        {/* Origin */}
        <div className="flex flex-col flex-1">
          <span className="font-display-md text-display-md font-black text-on-surface leading-none">{flight.origin}</span>
          <span className="font-label-sm text-label-sm text-on-surface-variant mt-1">{flight.originName}</span>
          <span className="font-headline-sm text-headline-sm font-bold text-on-surface mt-1">{depTimeStr}</span>
        </div>

        {/* Central Trajectory Line */}
        <div className="flex flex-col flex-1 items-center px-4 relative min-w-[150px]">
          <span className="font-label-sm text-label-sm font-bold text-on-surface-variant mb-2">{flight.durationStr}</span>
          
          <div className="w-full relative flex items-center h-4">
            {/* Background line */}
            <div className="absolute left-0 right-0 h-[1px] bg-on-surface-variant/20"></div>
            {/* Progress line */}
            <div className="absolute left-0 h-[2px] bg-error/50" style={{ width: `${progressPercent}%` }}></div>
            
            {/* Plane Icon */}
            <div 
              className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-1000 ${planeColorClass}`}
              style={{ left: `${progressPercent}%` }}
            >
              <span className="material-symbols-outlined text-[24px] rotate-90">flight</span>
            </div>
          </div>
          
          <span className="font-label-sm text-label-sm font-bold text-on-surface-variant mt-2 text-center">{flight.flightType}</span>
        </div>

        {/* Destination */}
        <div className="flex flex-col flex-1 text-right items-end">
          <span className="font-display-md text-display-md font-black text-on-surface leading-none">{flight.destination}</span>
          <span className="font-label-sm text-label-sm text-on-surface-variant mt-1">{flight.destinationName}</span>
          <span className="font-headline-sm text-headline-sm font-bold text-on-surface mt-1">{arrTimeStr}</span>
        </div>
      </div>

      {/* Divider */}
      <div className="h-[1px] w-full bg-surface-container-high"></div>

      {/* Bottom row: Details */}
      <div className="flex flex-wrap items-center justify-between gap-4 text-on-surface-variant font-label-md text-label-md font-medium">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[18px]">meeting_room</span>
          {flight.gate}
        </div>
        
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[18px]">person</span>
          {flight.pilot}
        </div>
        
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[18px]">group</span>
          {flight.paxCount}/{flight.paxMax} Pax {flight.paxCount === flight.paxMax ? "(Lleno)" : ""}
        </div>
      </div>

    </div>
  );
}
