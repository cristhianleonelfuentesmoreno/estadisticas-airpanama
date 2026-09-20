"use client";

import { useEffect, useState } from "react";
import { getUpcomingFlights, FlightData } from "@/app/actions/flights";

export function FlightListBoard() {
  const [flights, setFlights] = useState<FlightData[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter & Modal State
  const [destinationFilter, setDestinationFilter] = useState<string>('TODOS');
  const [airlineFilter, setAirlineFilter] = useState<string>('TODOS');
  const [isModalOpen, setIsModalOpen] = useState(false);

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
    const interval = setInterval(loadData, 300000);
    return () => clearInterval(interval);
  }, []);

  // 1. Filter Flights
  const filteredFlights = flights.filter(f => {
    const passDest = destinationFilter === 'TODOS' || f.destination === destinationFilter || f.origin === destinationFilter;
    const passAirline = airlineFilter === 'TODOS' || f.airline === airlineFilter;
    return passDest && passAirline;
  });

  // 2. Sort Flights
  // Priority: 1. EN VUELO, 2. ABORDANDO / A TIEMPO, 3. LLEGÓ
  const getStatusPriority = (status: FlightData['status']) => {
    switch (status) {
      case 'EN VUELO': return 1;
      case 'ABORDANDO': return 2;
      case 'A TIEMPO': return 3;
      case 'RETRASADO': return 3;
      case 'LLEGÓ': return 4;
      default: return 5;
    }
  };

  const sortedFlights = [...filteredFlights].sort((a, b) => {
    const pA = getStatusPriority(a.status);
    const pB = getStatusPriority(b.status);
    if (pA !== pB) return pA - pB;
    // Secondary sort by departure time
    return new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime();
  });

  // 3. Limit visible flights on the dashboard (e.g., top 4)
  const visibleFlights = sortedFlights.slice(0, 4);

  if (loading) {
    return (
      <div className="bg-surface-container-lowest rounded-2xl p-space-md border border-white/5 shadow-sm animate-pulse flex flex-col gap-4">
        <div className="h-6 bg-surface-container-low rounded w-1/4"></div>
        <div className="h-32 bg-surface-container-low rounded-xl"></div>
      </div>
    );
  }

  // Get unique destinations and airlines for the filters
  const uniqueDests = Array.from(new Set(flights.map(f => f.destination)));
  const uniqueAirlines = Array.from(new Set(flights.map(f => f.airline)));

  return (
    <>
      <div className="flex flex-col gap-space-sm font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-1 pb-2 flex-wrap gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">Próximos Vuelos</h2>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-surface-container rounded-full border border-white/5">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
                <span className="font-label-sm text-label-sm font-bold text-on-surface-variant">Hoy</span>
              </div>
              
              {/* Dest Filter */}
              <div className="hidden sm:flex items-center gap-2 ml-2 bg-surface-container-low rounded-lg p-1 border border-white/5">
                <button 
                  onClick={() => setDestinationFilter('TODOS')}
                  className={`px-3 py-1 text-label-sm font-bold rounded-md transition-colors ${destinationFilter === 'TODOS' ? 'bg-secondary text-on-secondary' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'}`}
                >
                  Todos
                </button>
                {uniqueDests.map(dest => (
                  <button 
                    key={dest}
                    onClick={() => setDestinationFilter(dest)}
                    className={`px-3 py-1 text-label-sm font-bold rounded-md transition-colors ${destinationFilter === dest ? 'bg-secondary text-on-secondary' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'}`}
                  >
                    {dest}
                  </button>
                ))}
              </div>

              {/* Source API Link */}
              <a 
                href="https://www.flightradar24.com/data/airlines/7p-pnc" 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant hover:text-secondary hover:underline transition-colors ml-2 border border-white/5 bg-surface-container-low px-2 py-1 rounded-md"
                title="Ir a la fuente de datos"
              >
                <span className="material-symbols-outlined text-[14px]">public</span>
                FlightRadar24
              </a>
            </div>
            
            {/* Airline Filter (Desktop & Mobile) */}
            <div className="flex items-center gap-2 bg-surface-container-low rounded-lg p-1 border border-white/5 w-fit">
              <span className="text-on-surface-variant text-[11px] font-bold px-2 uppercase tracking-wider">Aerolínea:</span>
              <button 
                onClick={() => setAirlineFilter('TODOS')}
                className={`px-3 py-1 text-label-sm font-bold rounded-md transition-colors ${airlineFilter === 'TODOS' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'}`}
              >
                Todas
              </button>
              {uniqueAirlines.map(airline => (
                <button 
                  key={airline}
                  onClick={() => setAirlineFilter(airline)}
                  className={`px-3 py-1 text-label-sm font-bold rounded-md transition-colors ${airlineFilter === airline ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'}`}
                >
                  {airline}
                </button>
              ))}
            </div>
          </div>
          
          <button 
            onClick={() => setIsModalOpen(true)}
            className="text-secondary font-label-md text-label-md font-bold flex items-center gap-1 hover:opacity-80 transition-opacity"
          >
            Ver todos
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          </button>
        </div>

        {/* Mobile Dest Filter (visible only on small screens) */}
        <div className="sm:hidden flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button 
            onClick={() => setDestinationFilter('TODOS')}
            className={`whitespace-nowrap px-3 py-1.5 text-label-sm font-bold rounded-md border ${destinationFilter === 'TODOS' ? 'bg-secondary text-on-secondary border-secondary' : 'bg-surface-container text-on-surface border-white/5'}`}
          >
            Todos
          </button>
          {uniqueDests.map(dest => (
            <button 
              key={dest}
              onClick={() => setDestinationFilter(dest)}
              className={`whitespace-nowrap px-3 py-1.5 text-label-sm font-bold rounded-md border ${destinationFilter === dest ? 'bg-secondary text-on-secondary border-secondary' : 'bg-surface-container text-on-surface border-white/5'}`}
            >
              {dest}
            </button>
          ))}
        </div>

        {/* Flight Cards */}
        <div className="flex flex-col gap-space-sm">
          {visibleFlights.map(flight => (
            <FlightCard key={flight.id} flight={flight} />
          ))}
          {sortedFlights.length > 4 && (
             <div className="text-center pt-2 pb-4">
               <button onClick={() => setIsModalOpen(true)} className="text-on-surface-variant text-label-md font-bold hover:text-secondary">
                 +{sortedFlights.length - 4} vuelos ocultos. Clic para ver todos.
               </button>
             </div>
          )}
          {visibleFlights.length === 0 && (
            <div className="p-space-xl text-center text-on-surface-variant font-body-md text-body-md bg-surface-container-lowest rounded-xl border border-white/5">
              No hay vuelos programados para esta ruta hoy.
            </div>
          )}
        </div>
      </div>

      {/* Modal / Popup for "Ver todos" */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-primary/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[90vh] bg-surface-container-lowest rounded-2xl flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-space-md border-b border-surface-container">
              <div className="flex items-center gap-3">
                <h2 className="font-headline-md text-headline-md font-bold text-on-surface">Vuelos de Hoy ({sortedFlights.length})</h2>
                <div className="px-3 py-1 bg-surface-container-high rounded-full font-label-sm text-label-sm font-bold text-on-surface border border-white/5">
                  Ruta: {destinationFilter === 'TODOS' ? 'Todas' : destinationFilter}
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            {/* Modal Content - Scrollable list of all sorted flights */}
            <div className="p-space-md overflow-y-auto flex flex-col gap-space-sm bg-surface">
              {sortedFlights.map(flight => (
                <FlightCard key={flight.id} flight={flight} />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function FlightCard({ flight }: { flight: FlightData }) {
  // Determine status badge styling
  let badgeClass = "bg-amber-100 text-amber-800 border-amber-200/50"; // default A TIEMPO, ABORDANDO
  
  if (flight.status === 'RETRASADO') {
    badgeClass = "bg-error/15 text-error border-error/20";
  } else if (flight.status === 'LLEGÓ') {
    badgeClass = "bg-surface-container-high text-on-surface-variant border-white/10";
  } else if (flight.status === 'EN VUELO') {
    badgeClass = "bg-emerald-100 text-emerald-800 border-emerald-200/50";
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
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-headline-sm text-headline-sm font-black text-on-surface">{flight.flightNumber}</span>
          <span className={`font-label-md text-label-md font-bold px-2 py-0.5 rounded-md shadow-sm ${flight.airline === 'Air Panama' ? 'text-white bg-red-600' : 'text-white bg-[#0032A0]'}`}>
            {flight.airline}
          </span>
          <span className="font-label-md text-label-md font-medium text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-md border border-white/5">
            {flight.aircraft} ({flight.aircraftReg})
          </span>
        </div>
        
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-sm text-label-sm font-bold border uppercase whitespace-nowrap ${badgeClass}`}>
          <div className={`w-2 h-2 rounded-full ${flight.status === 'LLEGÓ' ? 'bg-on-surface-variant' : 'bg-current'} ${flight.status === 'EN VUELO' ? 'animate-pulse' : ''}`}></div>
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
