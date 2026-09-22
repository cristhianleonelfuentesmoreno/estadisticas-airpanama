"use client";

import { useEffect, useState, useRef } from "react";
import { getUpcomingFlights, FlightData } from "@/app/actions/flights";
import { ManualFlightUploadModal } from "./ManualFlightUploadModal";
import { addMultipleManualFlights, updateFlightStatusOverride, deleteManualFlight } from "@/app/actions/manualFlights";
import { FlightEditModal } from "./FlightEditModal";
import { toast } from "sonner";

export function FlightListBoard({ isAdmin = false }: { isAdmin?: boolean }) {
  const [flights, setFlights] = useState<FlightData[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter & Modal State
  const todayPanama = new Date().toLocaleString("en-US", { timeZone: "America/Panama" });
  const todayStr = new Date(todayPanama).toISOString().split('T')[0];
  const [boardDate, setBoardDate] = useState<string>(todayStr);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const handlePrevDay = () => {
    const d = new Date(boardDate);
    d.setUTCDate(d.getUTCDate() - 1);
    setBoardDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(boardDate);
    d.setUTCDate(d.getUTCDate() + 1);
    setBoardDate(d.toISOString().split('T')[0]);
  };

  const [destinationFilter, setDestinationFilter] = useState<string>('DAV');
  const [airlineFilter, setAirlineFilter] = useState<string>('Air Panama');
  const [statusFilter, setStatusFilter] = useState<string>('TODOS');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const data = await getUpcomingFlights(boardDate);
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
  }, [boardDate, refreshCounter]);

  // 1. Filter Flights
  const filteredFlights = flights.filter(f => {
    const passDest = destinationFilter === 'TODOS' || f.destination === destinationFilter || f.origin === destinationFilter;
    const passAirline = airlineFilter === 'TODOS' || f.airline === airlineFilter;
    const passStatus = statusFilter === 'TODOS' || f.status === statusFilter;
    return passDest && passAirline && passStatus;
  });

  // 2. Sort Flights
  // Priority: 1. EN VUELO, 2. ABORDANDO / A TIEMPO, 3. ARRIBÓ
  const getStatusPriority = (status: FlightData['status']) => {
    switch (status) {
      case 'EN VUELO': return 1;
      case 'ABORDANDO': return 2;
      case 'PROGRAMADO': return 3;
      case 'RETRASADO': return 3;
      case 'CANCELADO': return 4;
      case 'ARRIBÓ': return 5;
      default: return 6;
    }
  };

  const sortedFlights = [...filteredFlights].sort((a, b) => {
    const pA = getStatusPriority(a.status);
    const pB = getStatusPriority(b.status);
    if (pA !== pB) return pA - pB;
    
    // Secondary sort for ARRIBÓ: most recently arrived at top (descending actualArrivalTime)
    if (a.status === 'ARRIBÓ' && b.status === 'ARRIBÓ') {
      return new Date(b.arrivalTime).getTime() - new Date(a.arrivalTime).getTime();
    }
    
    // Secondary sort by departure time ascendente (más temprano primero)
    return new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime();
  });

  // 3. Limit visible flights on the dashboard (e.g., top 12)
  const visibleFlights = sortedFlights.slice(0, 12);

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
              <div className="flex items-center gap-1 bg-surface-container rounded-lg border border-white/5 shadow-sm p-1">
                <button 
                  onClick={handlePrevDay}
                  className="w-8 h-8 hover:bg-surface-container-high rounded-md transition-colors text-on-surface-variant flex items-center justify-center"
                  title="Día anterior"
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                </button>
                
                <div 
                  onClick={() => {
                    if (dateInputRef.current) {
                      try {
                        dateInputRef.current.showPicker();
                      } catch (e) {
                        dateInputRef.current.focus();
                      }
                    }
                  }}
                  className="flex items-center gap-1.5 px-2 py-1 h-8 cursor-pointer hover:bg-surface-container-high rounded-md transition-colors"
                  title="Seleccionar fecha"
                >
                  <span className="material-symbols-outlined text-[18px] text-primary">calendar_month</span>
                  <input 
                    ref={dateInputRef}
                    type="date" 
                    value={boardDate}
                    onChange={(e) => setBoardDate(e.target.value)}
                    className="bg-transparent border-none outline-none font-label-sm text-on-surface font-bold focus:ring-0 cursor-pointer [&::-webkit-calendar-picker-indicator]:hidden p-0 w-[100px]"
                  />
                </div>

                <button 
                  onClick={handleNextDay}
                  className="w-8 h-8 hover:bg-surface-container-high rounded-md transition-colors text-on-surface-variant flex items-center justify-center"
                  title="Día siguiente"
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                </button>
              </div>


            {isAdmin && (
              <button
                onClick={() => setIsManualModalOpen(true)}
                className="mt-2 sm:mt-0 flex items-center gap-2 px-4 py-2 bg-primary text-on-primary font-label-md font-bold rounded-full shadow-sm hover:bg-primary/90 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Cargar Itinerario
              </button>
            )}

            </div>
            
            {/* Rutas Filter (Desktop & Mobile) */}
            <div className="flex items-center gap-2 bg-surface-container-low rounded-lg p-1 border border-white/5 w-fit max-w-full overflow-x-auto scrollbar-hide">
              <span className="text-on-surface-variant text-[11px] font-bold px-2 uppercase tracking-wider whitespace-nowrap">Rutas:</span>
              <button 
                onClick={() => setDestinationFilter('TODOS')}
                className={`px-3 py-1 text-label-sm font-bold rounded-md transition-colors whitespace-nowrap ${destinationFilter === 'TODOS' ? 'bg-secondary text-on-secondary' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'}`}
              >
                TODOS
              </button>
              {uniqueDests.map(dest => (
                <button 
                  key={dest}
                  onClick={() => setDestinationFilter(dest)}
                  className={`px-3 py-1 text-label-sm font-bold rounded-md transition-colors whitespace-nowrap ${destinationFilter === dest ? 'bg-secondary text-on-secondary' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'}`}
                >
                  {dest}
                </button>
              ))}
            </div>

            {/* Airline Filter (Desktop & Mobile) */}
            <div className="flex items-center gap-2 bg-surface-container-low rounded-lg p-1 border border-white/5 w-fit">
              <span className="text-on-surface-variant text-[11px] font-bold px-2 uppercase tracking-wider">Aerolínea:</span>
              <button 
                onClick={() => setAirlineFilter('TODOS')}
                className={`px-3 py-1 text-label-sm font-bold rounded-md transition-colors ${airlineFilter === 'TODOS' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'}`}
              >
                TODAS
              </button>
              {uniqueAirlines.map(airline => (
                <button 
                  key={airline}
                  onClick={() => setAirlineFilter(airline)}
                  className={`px-3 py-1 text-label-sm font-bold rounded-md transition-colors ${airlineFilter === airline ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'}`}
                >
                  {airline.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2 bg-surface-container-low rounded-lg p-1 border border-white/5 w-fit">
              <span className="text-on-surface-variant text-[11px] font-bold px-2 uppercase tracking-wider">Estado:</span>
              <button 
                onClick={() => setStatusFilter('TODOS')}
                className={`px-3 py-1 text-label-sm font-bold rounded-md transition-colors ${statusFilter === 'TODOS' ? 'bg-secondary text-on-secondary' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'}`}
              >
                TODOS
              </button>
              {['PROGRAMADO', 'ABORDANDO', 'EN VUELO', 'ARRIBÓ', 'CANCELADO'].map(status => (
                <button 
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1 text-label-sm font-bold rounded-md transition-colors ${statusFilter === status ? 'bg-secondary text-on-secondary' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'}`}
                >
                  {status}
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



        <div className="flex flex-col gap-space-sm">
          {visibleFlights.map(flight => (
            <FlightCard key={flight.id} flight={flight} isAdmin={isAdmin} onRefresh={() => setRefreshCounter(c => c + 1)} />
          ))}
          {sortedFlights.length > 12 && (
          <div className="text-center pt-2 pb-4">
            <button 
              onClick={() => setIsModalOpen(true)}
              className="px-6 py-2 rounded-full bg-white/5 hover:bg-white/10 text-secondary text-sm font-medium transition-colors border border-white/5"
            >
              +{sortedFlights.length - 12} vuelos ocultos. Clic para ver todos.
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
                <FlightCard key={flight.id} flight={flight} isAdmin={isAdmin} onRefresh={() => setBoardDate(d => d + " ")} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Manual Upload Modal */}
        {isManualModalOpen && (
          <ManualFlightUploadModal 
            isOpen={isManualModalOpen}
            onClose={() => setIsManualModalOpen(false)}
            onSuccess={() => {
              const fetchNew = async () => {
                setLoading(true);
                const data = await getUpcomingFlights(boardDate);
                setFlights(data);
                setLoading(false);
              };
              fetchNew();
            }}
          />
        )}


    </>
  );
}

function FlightCard({ flight, isAdmin, onRefresh }: { flight: FlightData, isAdmin?: boolean, onRefresh?: () => void }) {
  const localStatus = flight.status;
  const [loadingAction, setLoadingAction] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const handleAction = async (actionType: 'DESPEGAR' | 'ATERRIZAR' | 'CANCELAR' | 'RESTABLECER') => {
    if (!flight.manualLogId) {
      toast.error("Este vuelo no se puede editar (no tiene ID manual)");
      return;
    }
    setLoadingAction(true);
    try {
      const nowTime = new Date().toLocaleTimeString('en-US', { timeZone: 'America/Panama', hour12: false, hour: '2-digit', minute: '2-digit' });
      
      let payload = {};
      if (actionType === 'DESPEGAR') {
        payload = { status_override: 'EN VUELO', actual_departure_time: nowTime };
      } else if (actionType === 'ATERRIZAR') {
        payload = { status_override: 'ARRIBÓ', actual_arrival_time: nowTime };
      } else if (actionType === 'CANCELAR') {
        payload = { status_override: 'CANCELADO' };
      } else if (actionType === 'RESTABLECER') {
        payload = { status_override: null, actual_departure_time: null, actual_arrival_time: null };
      }

      await updateFlightStatusOverride(flight.manualLogId, payload);
      toast.success(`Vuelo ${actionType} correctamente`);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar");
    } finally {
      setLoadingAction(false);
    }
  };

  const handleDelete = async () => {
    if (!flight.manualLogId) return;
    if (confirm("¿Estás seguro de que deseas eliminar este vuelo? Esta acción no se puede deshacer.")) {
      setLoadingAction(true);
      try {
        await deleteManualFlight(flight.manualLogId);
        toast.success("Vuelo eliminado correctamente");
        if (onRefresh) onRefresh();
      } catch (err: any) {
        toast.error("Error al eliminar el vuelo: " + err.message);
      } finally {
        setLoadingAction(false);
      }
    }
  };

  // Determine status badge styling based on localStatus
  let badgeClass = 'text-primary border-primary/20 bg-primary-container/10';
  if (localStatus === 'RETRASADO') {
    badgeClass = 'text-error border-error/20 bg-error-container/10';
  } else if (localStatus === 'ARRIBÓ') {
    badgeClass = 'text-on-surface-variant border-white/10 bg-surface-container-high';
  } else if (localStatus === 'EN VUELO') {
    badgeClass = 'text-emerald-500 border-emerald-500/20 bg-emerald-500/10';
  } else if (localStatus === 'PROGRAMADO') {
    badgeClass = 'text-amber-500 border-amber-500/20 bg-amber-500/10';
  } else if (localStatus === 'CANCELADO') {
    badgeClass = 'text-error border-error/20 bg-error/10 line-through';
  }

  // Format times
  const dTime = new Date(flight.departureTime);
  const aTime = new Date(flight.arrivalTime);
  const timeOpts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
  const depTimeStr = dTime.toLocaleTimeString('es-PA', timeOpts);
  const arrTimeStr = aTime.toLocaleTimeString('es-PA', timeOpts);

  // Plane color based on status
  const planeColorClass = localStatus === 'ARRIBÓ' ? 'text-primary' : 'text-error';
  // Progress clamping
  const progressPercent = Math.min(Math.max(flight.progress, 0), 100);

  // Dot styling
  let dotClass = 'bg-current';
  if (localStatus === 'EN VUELO') {
    dotClass = 'bg-current animate-pulse';
  } else if (localStatus === 'ARRIBÓ') {
    dotClass = flight.isArchived ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse';
  }

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
          
          {/* Status Badge */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-sm text-label-sm font-bold border uppercase whitespace-nowrap shadow-sm ${badgeClass}`}>
            <div className={`w-2 h-2 rounded-full ${dotClass}`}></div>
            {localStatus}
          </div>
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
          {flight.paxCount > 0 ? (
            <>{flight.paxCount}/{flight.paxMax} Pax {flight.paxCount === flight.paxMax ? "(Lleno)" : ""}</>
          ) : (
            <>CAP. {flight.paxMax} Pax</>
          )}
        </div>
      </div>

      {/* Actions Bar (Available to everyone) */}
      {flight.manualLogId && !flight.isArchived && (
        <div className="mt-2 flex items-center justify-end gap-2 pt-3 border-t border-white/5">
          <span className="text-[10px] text-on-surface-variant uppercase tracking-wider mr-auto font-bold">Acciones</span>
          
          <button 
            onClick={() => setIsEditModalOpen(true)}
            disabled={loadingAction}
            className="px-3 py-1.5 bg-surface-container hover:bg-surface-container-high text-on-surface-variant rounded-md text-xs font-bold transition-colors flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[14px]">edit</span>
            Editar
          </button>
          
          <div className="w-[1px] h-6 bg-surface-container-high mx-1"></div>

          {localStatus !== 'CANCELADO' && localStatus !== 'ARRIBÓ' && (
            <button 
              onClick={() => handleAction('CANCELAR')}
              disabled={loadingAction}
              className="px-3 py-1.5 bg-error/10 text-error hover:bg-error/20 rounded-md text-xs font-bold transition-colors"
            >
              Vuelo Cancelado
            </button>
          )}
          
          {(localStatus === 'PROGRAMADO' || localStatus === 'ABORDANDO' || localStatus === 'RETRASADO') && (
            <button 
              onClick={() => handleAction('DESPEGAR')}
              disabled={loadingAction}
              className="px-4 py-1.5 bg-emerald-500 text-white rounded-md text-xs font-bold shadow-sm hover:bg-emerald-600 transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[14px]">flight_takeoff</span>
              Despegar
            </button>
          )}

          {localStatus === 'EN VUELO' && (
            <button 
              onClick={() => handleAction('ATERRIZAR')}
              disabled={loadingAction}
              className="px-4 py-1.5 bg-primary text-on-primary rounded-md text-xs font-bold shadow-sm hover:bg-primary/90 transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[14px]">flight_land</span>
              Aterrizó
            </button>
          )}

          {flight.statusOverride && (
            <button 
              onClick={() => handleAction('RESTABLECER')}
              disabled={loadingAction}
              className="px-3 py-1.5 bg-slate-200 text-slate-700 hover:bg-slate-300 rounded-md text-xs font-bold transition-colors flex items-center gap-1"
              title="Restablecer horas y estado a los del itinerario original"
            >
              <span className="material-symbols-outlined text-[14px]">undo</span>
              Restablecer
            </button>
          )}
        </div>
      )}

      {isEditModalOpen && (
        <FlightEditModal 
          flight={flight}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={() => {
            if (onRefresh) onRefresh();
          }}
        />
      )}

    </div>
  );
}
