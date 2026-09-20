"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { updateLlegadaMalek } from "@/app/actions/flights";

interface MalekFlight {
  id: string;
  fecha: string;
  aerolinea: string;
  numero_vuelo: string;
  origen?: string;
  destino?: string;
  hora_llegada_real?: string;
  hora_salida_real?: string;
  estado_final: string;
  pasajeros_abordo: number;
  capacidad_total: number;
}

export default function TablasDiariasClient({
  initialData,
  currentDateStr
}: {
  initialData: { llegadas: MalekFlight[], salidas: MalekFlight[] };
  currentDateStr: string;
}) {
  const [viewType, setViewType] = useState<'llegadas' | 'salidas' | 'todos'>('llegadas');
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const router = useRouter();
  const dateInputRef = useRef<HTMLInputElement>(null);
  
  // Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingFlight, setEditingFlight] = useState<MalekFlight | null>(null);
  const [editFormData, setEditFormData] = useState({
    hora_real: "",
    pasajeros_abordo: 0,
    estado_final: ""
  });

  const handlePrevDay = () => {
    const d = new Date(currentDateStr + "T12:00:00");
    d.setDate(d.getDate() - 1);
    const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'America/Panama' });
    router.push(`?date=${dateStr}`);
  };

  const handleNextDay = () => {
    const d = new Date(currentDateStr + "T12:00:00");
    d.setDate(d.getDate() + 1);
    const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'America/Panama' });
    router.push(`?date=${dateStr}`);
  };

  const handleToday = () => {
    const dateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' });
    router.push(`?date=${dateStr}`);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      router.push(`?date=${e.target.value}`);
    }
  };

  const isToday = currentDateStr === new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' });


  const activeDataList = useMemo(() => {
    if (viewType === 'llegadas') return initialData.llegadas;
    if (viewType === 'salidas') return initialData.salidas;
    
    // Para 'todos', combinamos y ordenamos por la hora (ya sea de llegada o salida)
    const combined = [...initialData.llegadas, ...initialData.salidas];
    return combined.sort((a, b) => {
      const timeA = new Date(a.hora_llegada_real || a.hora_salida_real || 0).getTime();
      const timeB = new Date(b.hora_llegada_real || b.hora_salida_real || 0).getTime();
      return timeB - timeA; // Descendente (más recientes primero)
    });
  }, [initialData, viewType]);

  // Derive summary metrics
  const totalFlights = activeDataList.length;
  const aTiempo = activeDataList.filter(f => f.estado_final === "LLEGÓ" || f.estado_final === "CUMPLIDO").length;

  const filteredData = useMemo(() => {
    return activeDataList.filter(flight => {
      const location = flight.hora_llegada_real ? flight.origen : flight.destino;
      const matchSearch = 
        flight.numero_vuelo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (location && location.toLowerCase().includes(searchQuery.toLowerCase())) ||
        flight.aerolinea.toLowerCase().includes(searchQuery.toLowerCase());

      const matchFilter = activeFilter === "all" || flight.aerolinea === activeFilter;

      return matchSearch && matchFilter;
    });
  }, [activeDataList, searchQuery, activeFilter]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => window.location.reload(), 600);
  };

  const getAirlineColor = (airline: string) => {
    if (airline === 'Air Panama') return 'bg-primary-container text-white';
    if (airline === 'Copa Airlines') return 'bg-sky-700 text-white';
    return 'bg-gray-700 text-white';
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '--:--';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '--:--';
    }
  };

  const toTimeStringForInput = (isoString?: string) => {
    if (!isoString) return '00:00';
    try {
      const date = new Date(isoString);
      const h = date.getHours().toString().padStart(2, '0');
      const m = date.getMinutes().toString().padStart(2, '0');
      return `${h}:${m}`;
    } catch {
      return '00:00';
    }
  };

  const openEditDrawer = (flight: MalekFlight) => {
    setEditingFlight(flight);
    const timeValue = flight.hora_llegada_real ? flight.hora_llegada_real : flight.hora_salida_real;
    setEditFormData({
      hora_real: toTimeStringForInput(timeValue),
      pasajeros_abordo: flight.pasajeros_abordo || 0,
      estado_final: flight.estado_final
    });
    setIsDrawerOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFlight) return;
    
    // Parse time to ISO
    const [hours, minutes] = editFormData.hora_real.split(':').map(Number);
    const isLlegada = !!editingFlight.hora_llegada_real;
    const timeToUpdate = isLlegada ? editingFlight.hora_llegada_real : editingFlight.hora_salida_real;
    const newDate = new Date(timeToUpdate || new Date().toISOString());
    newDate.setHours(hours, minutes, 0, 0);

    const updates = {
      [isLlegada ? 'hora_llegada_real' : 'hora_salida_real']: newDate.toISOString(),
      pasajeros_abordo: editFormData.pasajeros_abordo,
      estado_final: editFormData.estado_final
    };

    let res;
    if (isLlegada) {
      res = await updateLlegadaMalek(editingFlight.id, updates);
    } else {
      const { updateSalidaMalek } = await import('@/app/actions/flights');
      res = await updateSalidaMalek(editingFlight.id, updates);
    }

    if (res.success) {
      setIsDrawerOpen(false);
      window.location.reload(); // Recargar para ver los cambios
    } else {
      alert("Error al actualizar: " + res.error);
    }
  };

  return (
    <div className="flex flex-col w-full min-h-[calc(100vh-8rem)] relative">
      {/* Header Panel */}
      <section className="bg-primary-container text-on-primary px-4 py-6 shadow-md flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span className="font-label-sm text-[11px] uppercase tracking-wider text-emerald-300 font-bold">Registro Histórico</span>
            </div>
            <h1 className="font-headline-md text-2xl text-white font-bold tracking-tight">
              Información del Aeropuerto Internacional Enrique Malek (David - Chiriquí)
            </h1>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm border border-white/10">
              <span className="material-symbols-outlined text-[15px] text-white">table_view</span>
              <span className="font-label-sm text-[11px] text-white font-semibold tracking-wide">Modo Airtable</span>
            </div>
          </div>
        </div>

        {/* Llegadas / Salidas Toggle */}
        <div className="flex items-center gap-2 mt-2 bg-white/10 p-1 rounded-xl w-fit border border-white/10">
          <button 
            onClick={() => setViewType('todos')}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors flex items-center gap-1.5 ${viewType === 'todos' ? 'bg-white text-primary shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
          >
            <span className="material-symbols-outlined text-[16px]">swap_vert</span>
            Todos
          </button>
          <button 
            onClick={() => setViewType('llegadas')}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors flex items-center gap-1.5 ${viewType === 'llegadas' ? 'bg-white text-primary shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
          >
            <span className="material-symbols-outlined text-[16px]">flight_land</span>
            Llegadas
          </button>
          <button 
            onClick={() => setViewType('salidas')}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors flex items-center gap-1.5 ${viewType === 'salidas' ? 'bg-white text-primary shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
          >
            <span className="material-symbols-outlined text-[16px]">flight_takeoff</span>
            Salidas
          </button>
        </div>

        <div className="bg-white/5 backdrop-blur-md rounded-xl p-3 flex flex-col gap-3 border border-white/10 mt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <button onClick={handlePrevDay} className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white hover:bg-white/20 active:scale-95 transition-all">
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
              
              <div 
                className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-lg text-white relative cursor-pointer hover:bg-white/20 transition-all"
                onClick={() => dateInputRef.current?.showPicker && dateInputRef.current.showPicker()}
              >
                <input 
                  type="date"
                  ref={dateInputRef}
                  value={currentDateStr}
                  onChange={handleDateChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <span className="material-symbols-outlined text-white text-[16px] pointer-events-none">calendar_today</span>
                <span className="font-label-md text-[13px] font-bold tracking-wide pointer-events-none">
                  {new Date(currentDateStr + "T12:00:00").toLocaleDateString('es-PA', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}
                </span>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleToday(); }} 
                  className={`text-[10px] px-1.5 rounded font-bold uppercase ml-1 transition-all z-10 relative ${isToday ? 'bg-secondary text-white' : 'bg-white/20 hover:bg-secondary'}`}
                >
                  Hoy
                </button>
              </div>

              <button onClick={handleNextDay} className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white hover:bg-white/20 active:scale-95 transition-all">
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 text-center">
            <div className="bg-white/5 rounded-lg py-2 flex flex-col">
              <span className="text-[10px] text-white/70">
                {viewType === 'todos' ? 'Total Vuelos' : `Total ${viewType === 'llegadas' ? 'Llegadas' : 'Salidas'}`}
              </span>
              <span className="font-label-md text-xl font-bold text-white">{totalFlights}</span>
            </div>
            <div className="bg-emerald-500/20 rounded-lg py-2 flex flex-col border border-emerald-500/30">
              <span className="text-[10px] text-emerald-200 font-medium">Completados</span>
              <span className="font-label-md text-xl font-bold text-emerald-300">{aTiempo}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Filters & Search */}
      <section className="px-4 pt-4 pb-2 flex flex-col gap-3">
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
            <span className="material-symbols-outlined text-[20px]">search</span>
          </div>
          <input 
            className="w-full h-12 pl-10 pr-10 bg-white text-slate-800 text-sm rounded-xl shadow-sm border border-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Buscar por vuelo, origen o aerolínea..." 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button 
              className="absolute inset-y-0 right-2 w-8 h-8 my-auto flex items-center justify-center text-slate-400 hover:text-slate-600"
              onClick={() => setSearchQuery("")}
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4 no-scrollbar">
          <button 
            onClick={() => setActiveFilter("all")}
            className={`whitespace-nowrap px-4 py-2 rounded-lg text-[13px] font-bold shadow-sm transition-all ${activeFilter === 'all' ? 'bg-primary text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
          >
            Todas ({totalFlights})
          </button>
          <button 
            onClick={() => setActiveFilter("Air Panama")}
            className={`whitespace-nowrap px-4 py-2 rounded-lg text-[13px] font-bold shadow-sm transition-all ${activeFilter === 'Air Panama' ? 'bg-primary text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
          >
            Air Panama
          </button>
          <button 
            onClick={() => setActiveFilter("Copa Airlines")}
            className={`whitespace-nowrap px-4 py-2 rounded-lg text-[13px] font-bold shadow-sm transition-all ${activeFilter === 'Copa Airlines' ? 'bg-primary text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
          >
            Copa Airlines
          </button>
        </div>
      </section>

      {/* Airtable Grid */}
      <section className="px-4 flex flex-col gap-2 flex-1 pb-6 mt-2">
        <div className="flex items-center justify-between px-1 text-slate-500 text-xs mb-1">
          <span className="flex items-center gap-1 font-semibold text-slate-700">
            <span className="material-symbols-outlined text-[16px] text-primary">grid_on</span>Vista Cuadrícula
          </span>
          <span className="flex items-center gap-1 font-medium text-slate-400">
            <span className="material-symbols-outlined text-[15px]">swipe</span>Desliza horizontal
          </span>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto no-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
            <table className="w-full text-left text-sm border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="sticky left-0 z-20 bg-slate-50 px-4 py-3.5 shadow-[2px_0_5px_rgba(0,0,0,0.04)] min-w-[150px]">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px]">flight</span>
                      <span>Vuelo / Línea</span>
                    </div>
                  </th>
                  <th className="px-4 py-3.5 min-w-[120px]">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px]">near_me</span>
                      <span>Ruta</span>
                    </div>
                  </th>
                  <th className="px-4 py-3.5 min-w-[120px]">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px]">schedule</span>
                      <span>{viewType === 'todos' ? 'Hora' : (viewType === 'llegadas' ? 'Hora Llegada' : 'Hora Salida')}</span>
                    </div>
                  </th>
                  <th className="px-4 py-3.5 min-w-[120px]">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px]">group</span>
                      <span>Ocupación</span>
                    </div>
                  </th>
                  <th className="px-4 py-3.5 min-w-[110px]">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px]">flag</span>
                      <span>Estado</span>
                    </div>
                  </th>
                  <th className="px-4 py-3.5 min-w-[80px] text-center">
                    <span>Acción</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredData.length > 0 ? (
                  filteredData.map((flight) => {
                    const paxCount = flight.pasajeros_abordo || 0;
                    const paxMax = flight.capacidad_total || 100;
                    const paxPct = Math.round((paxCount / paxMax) * 100);
                    const isLlegada = !!flight.hora_llegada_real;

                    return (
                      <tr key={flight.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 px-4 py-3 shadow-[2px_0_5px_rgba(0,0,0,0.02)] border-r border-slate-100">
                          <div className="flex items-center gap-3">
                            <span className={`w-9 h-9 rounded-lg ${getAirlineColor(flight.aerolinea)} flex items-center justify-center font-bold text-[11px] shrink-0 uppercase`}>
                              {flight.numero_vuelo.split('-')[0]}
                            </span>
                            <div>
                              <span className="font-bold text-primary block leading-tight text-[14px]">{flight.numero_vuelo}</span>
                              <span className="text-[11px] text-slate-500 block truncate w-24">
                                {flight.aerolinea} {viewType === 'todos' && <span className="font-bold text-[9px] uppercase ml-1 opacity-60">({isLlegada ? 'Llegada' : 'Salida'})</span>}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 font-bold text-[13px]">
                            <span className="text-primary">{isLlegada ? flight.origen : 'DAV'}</span>
                            <span className="material-symbols-outlined text-[14px] text-slate-400">arrow_forward</span>
                            <span className="text-primary">{isLlegada ? 'DAV' : flight.destino}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-[13px]">
                            <span className="font-bold text-slate-800">
                              {formatTime(isLlegada ? flight.hora_llegada_real : flight.hora_salida_real)}
                            </span>
                          </div>
                          <span className="text-[11px] text-emerald-600 font-medium">
                            {new Date(isLlegada ? (flight.hora_llegada_real || '') : (flight.hora_salida_real || '')).toLocaleDateString('es-PA')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 text-[12px] mb-1">
                            <span className="font-bold text-slate-700">{paxCount}/{paxMax}</span>
                            <span className="text-[10px] text-slate-400 font-semibold">({paxPct}%)</span>
                          </div>
                          <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${paxPct}%` }}></div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold text-[10px] uppercase tracking-wide bg-emerald-100 text-emerald-800">
                            <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                            {flight.estado_final}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button 
                            onClick={() => openEditDrawer(flight)}
                            className="p-1.5 rounded-lg bg-slate-100 text-primary hover:bg-primary hover:text-white active:scale-95 transition-all shadow-sm"
                            title="Editar Fila"
                          >
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500 text-sm">
                      <span className="material-symbols-outlined text-4xl text-slate-300 block mb-2">flight_takeoff</span>
                      No se encontraron vuelos para estos filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Footer Sync bar */}
      <div className="mx-4 mb-4 p-3 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <div className="flex flex-col">
            <span className="text-[13px] font-bold text-primary">Histórico AODB</span>
            <span className="text-[11px] text-slate-500">Última actualización: Hoy</span>
          </div>
        </div>
        <button 
          onClick={handleRefresh}
          className="p-2 text-primary hover:bg-slate-50 rounded-lg active:scale-95 transition-transform flex items-center gap-1.5 text-[12px] font-semibold border border-slate-200"
        >
          <span className={`material-symbols-outlined text-[18px] ${isRefreshing ? 'animate-spin' : ''}`}>sync</span>
          <span>Sync</span>
        </button>
      </div>

      {/* Edit Drawer Modal */}
      {isDrawerOpen && editingFlight && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
          <div 
            className="absolute inset-0 bg-[#0A192F]/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsDrawerOpen(false)}
          ></div>
          <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl z-10 transform transition-transform animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:fade-in-0 duration-300 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[20px]">edit_document</span>
                </div>
                <div>
                  <h2 className="font-headline-sm text-[16px] font-bold text-primary">{editingFlight.numero_vuelo}</h2>
                  <p className="font-body-sm text-[12px] text-slate-500">{editingFlight.origen} ➔ DAV</p>
                </div>
              </div>
              <button 
                className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100" 
                onClick={() => setIsDrawerOpen(false)}
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form className="flex flex-col gap-4 pt-1" onSubmit={handleSaveEdit}>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Hora Real</label>
                <input 
                  className="h-12 px-4 bg-slate-50 text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none" 
                  type="time" 
                  required
                  value={editFormData.hora_real}
                  onChange={(e) => setEditFormData({...editFormData, hora_real: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Pax Abordo</label>
                  <input 
                    className="h-12 px-4 bg-slate-50 text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none" 
                    type="number" 
                    min="0"
                    max={editingFlight.capacidad_total || 160}
                    required
                    value={editFormData.pasajeros_abordo}
                    onChange={(e) => setEditFormData({...editFormData, pasajeros_abordo: parseInt(e.target.value) || 0})}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Estado</label>
                  <select 
                    className="h-12 px-4 bg-slate-50 text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none" 
                    value={editFormData.estado_final}
                    onChange={(e) => setEditFormData({...editFormData, estado_final: e.target.value})}
                  >
                    <option value="LLEGÓ">Llegó</option>
                    <option value="CUMPLIDO">Cumplido</option>
                    <option value="DEMORADO">Demorado</option>
                    <option value="DESVIADO">Desviado</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                <button 
                  className="flex-1 h-12 rounded-xl bg-slate-100 text-slate-600 font-semibold active:scale-95 transition-transform" 
                  onClick={() => setIsDrawerOpen(false)} 
                  type="button"
                >
                  Cancelar
                </button>
                <button 
                  className="flex-1 h-12 rounded-xl bg-primary text-white font-bold shadow-md hover:bg-primary/90 active:scale-95 transition-transform flex items-center justify-center gap-2" 
                  type="submit"
                >
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  <span>Guardar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
