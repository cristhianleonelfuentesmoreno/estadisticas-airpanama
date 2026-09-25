"use client";

import { useEffect, useState, useRef } from "react";
import type { FlightData } from "@/app/actions/flights";
import { fetchUpcomingFlights } from "@/lib/client/api";
import { ManualFlightUploadModal } from "./ManualFlightUploadModal";
import { updateFlightStatusOverride } from "@/app/actions/manualFlights";
import { FlightEditModal } from "./FlightEditModal";
import { UploadGlyph } from "@/components/ui/UploadProgress";
import { toast } from "sonner";
import Link from "next/link";

type ListProps = {
  canDelete?: boolean;
  // Vuelos que ya trajo el servidor junto con la página (evita una acción extra en fila)
  initial?: { date: string; flights: FlightData[] };
  // Solo el estado de carga, sin pedir datos (fallback de Suspense)
  pending?: boolean;
};

export function FlightListBoard({ canDelete = false, initial, pending = false }: ListProps) {
  const [flights, setFlights] = useState<FlightData[]>(initial?.flights ?? []);
  const [loading, setLoading] = useState(!initial);
  // La primera carga ya vino del servidor para esta fecha
  const skipFirstLoad = useRef(!!initial);
  
  // Filter & Modal State
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' });
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

  const [destinationFilter, setDestinationFilter] = useState<string>('TODOS');
  const [airlineFilter, setAirlineFilter] = useState<string>('TODOS');
  const [statusFilter, setStatusFilter] = useState<string>('TODOS');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const data = await fetchUpcomingFlights(boardDate);
        setFlights(data);
      } catch (err) {
        console.error("Error loading flights:", err);
      } finally {
        setLoading(false);
      }
    }
    
    if (pending) return;
    if (skipFirstLoad.current && initial?.date === boardDate) skipFirstLoad.current = false;
    else loadData();
    const interval = setInterval(loadData, 300000);
    return () => clearInterval(interval);
  }, [boardDate, refreshCounter, pending, initial?.date]);

  // Get unique destinations and airlines for the filters
  const uniqueDests = Array.from(new Set(flights.map(f => f.destination)));
  const uniqueAirlines = Array.from(new Set(flights.map(f => f.airline)));

  // Si el filtro elegido no existe en los vuelos del día (p. ej. solo hay Copa DAV→PTY),
  // se usa TODOS en vez de ocultar todos los vuelos sin ninguna opción marcada
  const activeDest = flights.some(f => f.destination === destinationFilter || f.origin === destinationFilter) ? destinationFilter : 'TODOS';
  const activeAirline = uniqueAirlines.includes(airlineFilter) ? airlineFilter : 'TODOS';

  // 1. Filter Flights
  const filteredFlights = flights.filter(f => {
    const passDest = activeDest === 'TODOS' || f.destination === activeDest || f.origin === activeDest;
    const passAirline = activeAirline === 'TODOS' || f.airline === activeAirline;
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

  return (
    <>
      <div className="flex flex-col gap-space-sm font-sans">
        {/* Header */}
        <div className="flex flex-col gap-3 px-1 pb-2 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">Próximos Vuelos</h2>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="text-secondary font-label-md text-label-md font-bold flex items-center gap-1 hover:opacity-80 transition-opacity shrink-0"
            >
              Ver todos
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-surface-container rounded-lg border border-white/5 shadow-sm p-1">
              <button 
                onClick={handlePrevDay}
                className="w-9 h-9 hover:bg-surface-container-high rounded-md transition-colors text-on-surface-variant flex items-center justify-center"
                title="Día anterior"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
              
              <div 
                onClick={() => {
                  if (dateInputRef.current) {
                    try {
                      dateInputRef.current.showPicker();
                    } catch {
                      dateInputRef.current.focus();
                    }
                  }
                }}
                className="flex items-center gap-1.5 px-2 h-9 cursor-pointer hover:bg-surface-container-high rounded-md transition-colors"
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
                className="w-9 h-9 hover:bg-surface-container-high rounded-md transition-colors text-on-surface-variant flex items-center justify-center"
                title="Día siguiente"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>

            <button
              onClick={() => setIsManualModalOpen(true)}
              className="upbtn flex items-center gap-2 px-4 h-11 bg-primary text-on-primary font-label-md font-bold rounded-full shadow-sm hover:bg-primary/90 transition-colors"
            >
              <UploadGlyph />
              Cargar Itinerario
            </button>
          </div>

          <FilterRow
            label="Rutas"
            options={[{ value: 'TODOS', label: 'TODOS' }, ...uniqueDests.map(d => ({ value: d, label: d }))]}
            value={activeDest}
            onChange={setDestinationFilter}
          />
          <FilterRow
            label="Aerolínea"
            options={[{ value: 'TODOS', label: 'TODAS' }, ...uniqueAirlines.map(a => ({ value: a, label: a.toUpperCase() }))]}
            value={activeAirline}
            onChange={setAirlineFilter}
          />
          <FilterRow
            label="Estado"
            options={['TODOS', 'PROGRAMADO', 'ABORDANDO', 'EN VUELO', 'ARRIBÓ', 'CANCELADO'].map(s => ({ value: s, label: s }))}
            value={statusFilter}
            onChange={setStatusFilter}
          />
        </div>



        <div className="flex flex-col gap-space-sm">
          {visibleFlights.map(flight => (
            <FlightCard key={flight.id} flight={flight} canDelete={canDelete} onRefresh={() => setRefreshCounter(c => c + 1)} />
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
              {loading && flights.length === 0 ? 'Cargando vuelos...' : 'No hay vuelos programados para esta ruta hoy.'}
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
                  Ruta: {activeDest === 'TODOS' ? 'Todas' : activeDest}
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
                <FlightCard key={flight.id} flight={flight} canDelete={canDelete} onRefresh={() => setBoardDate(d => d + " ")} />
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
                const data = await fetchUpcomingFlights(boardDate);
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

// Fila de filtros deslizable: en celular se desplaza horizontalmente
// con un degradado a la derecha que indica que hay más opciones.
function FilterRow({ label, options, value, onChange }: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative min-w-0 w-full sm:w-fit sm:max-w-full">
      <div className="flex items-center gap-1 bg-surface-container-low rounded-lg p-1 border border-white/5 overflow-x-auto scrollbar-hide">
        <span className="sticky left-0 z-10 bg-surface-container-low text-on-surface-variant text-[12px] font-bold pl-2 pr-2 uppercase tracking-wider whitespace-nowrap self-stretch flex items-center">
          {label}
        </span>
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`shrink-0 px-3 h-8 text-label-sm font-bold rounded-md transition-colors whitespace-nowrap ${value === opt.value ? 'bg-secondary text-on-secondary' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'}`}
          >
            {opt.label}
          </button>
        ))}
        <span className="shrink-0 w-6" aria-hidden />
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 rounded-r-lg bg-gradient-to-l from-surface-container-low to-transparent sm:hidden" />
    </div>
  );
}

function FlightCard({ flight, canDelete, onRefresh }: { flight: FlightData, canDelete?: boolean, onRefresh?: () => void }) {
  const localStatus = flight.status;
  // Solo los vuelos que llegan o salen de DAV y arriban pasan por Pendientes y al Registro histórico
  const touchesDav = flight.origin === 'DAV' || flight.destination === 'DAV';
  const [loadingAction, setLoadingAction] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
      const toPending = touchesDav ? ' · pasa a Pendientes' : '';
      const done = { DESPEGAR: 'despegó', ATERRIZAR: `aterrizó${toPending}`, CANCELAR: 'cancelado', RESTABLECER: 'restablecido al itinerario' }[actionType];
      toast.success(`${flight.flightNumber} ${done}`);
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error((err as Error).message || "Error al actualizar");
    } finally {
      setLoadingAction(false);
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
    dotClass = flight.isArchived ? 'bg-emerald-500' : touchesDav ? 'bg-amber-500 animate-pulse' : 'bg-current';
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

      {/* Acciones. Mientras vuela: Opciones (editar, cancelar, restablecer) + la acción principal.
          Cuando arribó: si es de DAV pasa a Pendientes y allí se revisa y aprueba. Los cancelados
          y los vuelos entre otras estaciones solo se cierran (no van al Registro histórico). */}
      {flight.manualLogId && !flight.isArchived && (() => {
        const finished = localStatus === 'ARRIBÓ' || localStatus === 'CANCELADO';
        const awaitingApproval = localStatus === 'ARRIBÓ' && touchesDav;
        const menuItems = [
          ...(!finished ? [{ key: 'edit', icon: 'edit', label: 'Editar datos del vuelo', tone: 'text-on-surface', run: () => setIsEditModalOpen(true) }] : []),
          ...(!finished ? [{ key: 'cancel', icon: 'cancel', label: 'Marcar como cancelado', tone: 'text-error', run: () => handleAction('CANCELAR') }] : []),
          ...(flight.statusOverride ? [{ key: 'reset', icon: 'undo', label: finished ? 'Deshacer (volver al itinerario)' : 'Restablecer al itinerario', tone: 'text-on-surface-variant', run: () => handleAction('RESTABLECER') }] : []),
        ];
        return (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-surface-container-high">
            {awaitingApproval ? (
              <div className="flex items-center gap-2 min-w-0 mr-auto">
                <span className="w-8 h-8 shrink-0 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">pending_actions</span>
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-on-surface leading-tight">Pendiente de aprobación</p>
                  <p className="text-[12px] text-on-surface-variant leading-tight">Revisa pasajeros y horas en Pendientes antes de aprobarlo.</p>
                </div>
              </div>
            ) : finished ? (
              <div className="flex items-center gap-2 min-w-0 mr-auto">
                <span className="w-8 h-8 shrink-0 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">{localStatus === 'CANCELADO' ? 'event_busy' : 'flight_land'}</span>
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-on-surface leading-tight">{localStatus === 'CANCELADO' ? 'Vuelo cancelado' : 'Vuelo finalizado'}</p>
                  <p className="text-[12px] text-on-surface-variant leading-tight">{localStatus === 'CANCELADO' ? 'No pasa a Pendientes ni al Registro histórico.' : 'No opera en DAV: no pasa al Registro histórico.'}</p>
                </div>
              </div>
            ) : (
              <span className="text-[11px] text-on-surface-variant uppercase tracking-wider mr-auto font-bold">Acciones</span>
            )}

            <div className="flex items-center gap-2 ml-auto">
              {menuItems.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen(o => !o)}
                    disabled={loadingAction}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    className="h-9 pl-3 pr-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[16px]">tune</span>
                    Opciones
                    <span className={`material-symbols-outlined text-[18px] transition-transform ${menuOpen ? 'rotate-180' : ''}`}>expand_more</span>
                  </button>
                  {menuOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} aria-hidden="true" />
                      <div role="menu" className="absolute right-0 bottom-full mb-2 z-40 w-60 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 animate-in fade-in zoom-in-95 duration-150">
                        {menuItems.map(item => (
                          <button
                            key={item.key}
                            role="menuitem"
                            onClick={() => { setMenuOpen(false); item.run(); }}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold hover:bg-slate-50 ${item.tone}`}
                          >
                            <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {(localStatus === 'PROGRAMADO' || localStatus === 'ABORDANDO' || localStatus === 'RETRASADO') && (
                <button
                  onClick={() => handleAction('DESPEGAR')}
                  disabled={loadingAction}
                  className="h-9 px-4 bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-sm hover:bg-emerald-600 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">flight_takeoff</span>
                  Despegar
                </button>
              )}

              {localStatus === 'EN VUELO' && (
                <button
                  onClick={() => handleAction('ATERRIZAR')}
                  disabled={loadingAction}
                  className="h-9 px-4 bg-primary text-on-primary rounded-lg text-xs font-bold shadow-sm hover:bg-primary/90 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">flight_land</span>
                  Aterrizó
                </button>
              )}

              {awaitingApproval && (
                <Link
                  href="/dashboard/diario?pendientes=1"
                  className="h-9 px-4 bg-amber-500 text-white rounded-lg text-xs font-bold shadow-sm hover:bg-amber-600 transition-colors flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">fact_check</span>
                  Revisar en Pendientes
                </Link>
              )}
            </div>
          </div>
        );
      })()}

      {flight.isArchived && (
        <div className="mt-2 flex items-center gap-2 pt-3 border-t border-surface-container-high text-emerald-700 text-[13px] font-bold">
          <span className="material-symbols-outlined text-[18px]">verified</span>
          Aprobado y archivado en el Registro
        </div>
      )}

      {isEditModalOpen && (
        <FlightEditModal 
          flight={flight}
          canDelete={canDelete}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={() => {
            if (onRefresh) onRefresh();
          }}
        />
      )}

    </div>
  );
}
