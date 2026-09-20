"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { updateLlegadaMalek, updateSalidaMalek, deleteLlegadaMalek, deleteSalidaMalek, insertFlightRecords } from "@/app/actions/flights";
import * as XLSX from 'xlsx';

interface MalekFlight {
  id: string;
  fecha: string;
  aerolinea: string;
  numero_vuelo: string;
  origen: string;
  destino?: string;
  hora_itinerario?: string;
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
  const [viewType, setViewType] = useState<'llegadas' | 'salidas' | 'todos'>('todos');
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  type SortColumn = 'ruta' | 'estado' | null;
  type SortDirection = 'asc' | 'desc';
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else { setSortColumn(null); setSortDirection('asc'); }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const router = useRouter();
  const dateInputRef = useRef<HTMLInputElement>(null);
  
  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  
  // Add Flight Form State
  const [addFormData, setAddFormData] = useState({
    type: 'llegadas' as 'llegadas' | 'salidas',
    aerolinea: 'Air Panama',
    numero_vuelo: '',
    origen: '',
    destino: '',
    fecha: currentDateStr,
    hora_itinerario: '',
    hora_real: '',
    estado_final: 'LLEGÓ',
    pasajeros_abordo: 0,
    capacidad_total: 78
  });
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingFlight, setEditingFlight] = useState<MalekFlight | null>(null);
  const [editFormData, setEditFormData] = useState({
    fecha: "",
    aerolinea: "",
    numero_vuelo: "",
    origen: "",
    destino: "",
    hora_itinerario: "",
    hora_real: "",
    pasajeros_abordo: 0,
    capacidad_total: 0,
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

  const sortedData = useMemo(() => {
    let sorted = [...filteredData];
    if (sortColumn === 'ruta') {
      sorted.sort((a, b) => {
        const routeA = a.hora_llegada_real ? `${a.origen}-DAV` : `DAV-${a.destino}`;
        const routeB = b.hora_llegada_real ? `${b.origen}-DAV` : `DAV-${b.destino}`;
        return sortDirection === 'asc' ? routeA.localeCompare(routeB) : routeB.localeCompare(routeA);
      });
    } else if (sortColumn === 'estado') {
      sorted.sort((a, b) => {
        const eA = a.estado_final || '';
        const eB = b.estado_final || '';
        return sortDirection === 'asc' ? eA.localeCompare(eB) : eB.localeCompare(eA);
      });
    }
    return sorted;
  }, [filteredData, sortColumn, sortDirection]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => window.location.reload(), 600);
  };

  const getAirlineBadge = (airline: string) => {
    if (airline === 'Air Panama') return 'bg-red-600 text-white';
    if (airline === 'Copa Airlines') return 'bg-[#0032A0] text-white';
    return 'bg-slate-100 text-slate-700';
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
      fecha: flight.fecha || "",
      aerolinea: flight.aerolinea || "",
      numero_vuelo: flight.numero_vuelo || "",
      origen: flight.origen || "",
      destino: flight.destino || "",
      hora_itinerario: toTimeStringForInput(flight.hora_itinerario),
      hora_real: toTimeStringForInput(timeValue),
      pasajeros_abordo: flight.pasajeros_abordo || 0,
      capacidad_total: flight.capacidad_total || 78,
      estado_final: flight.estado_final
    });
    setIsDrawerOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFlight) return;
    
    const isLlegada = !!editingFlight.hora_llegada_real;
    
    const itinDate = new Date(`${editFormData.fecha}T${editFormData.hora_itinerario}:00-05:00`);
    const realDate = new Date(`${editFormData.fecha}T${editFormData.hora_real}:00-05:00`);

    const updates: any = {
      fecha: editFormData.fecha,
      aerolinea: editFormData.aerolinea,
      numero_vuelo: editFormData.numero_vuelo,
      hora_itinerario: itinDate.toISOString(),
      pasajeros_abordo: Number(editFormData.pasajeros_abordo),
      capacidad_total: Number(editFormData.capacidad_total),
      estado_final: editFormData.estado_final
    };
    
    if (isLlegada) {
      updates.origen = editFormData.origen;
      updates.hora_llegada_real = realDate.toISOString();
    } else {
      updates.destino = editFormData.destino;
      updates.hora_salida_real = realDate.toISOString();
    }

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

  const handleDelete = async (flight: MalekFlight) => {
    if (!confirm(`¿Estás seguro de que deseas ELIMINAR el vuelo ${flight.numero_vuelo}? Esta acción no se puede deshacer y borrará el registro histórico.`)) {
      return;
    }
    
    const isLlegada = !!flight.hora_llegada_real;
    let res;
    if (isLlegada) {
      res = await deleteLlegadaMalek(flight.id);
    } else {
      res = await deleteSalidaMalek(flight.id);
    }
    
    if (res.success) {
      window.location.reload();
    } else {
      alert("Error al eliminar el vuelo: " + res.error);
    }
  };

  const handleAddFlightSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isLlegada = addFormData.type === 'llegadas';
    
    // Create correct Date objects
    const itinDate = new Date(`${addFormData.fecha}T${addFormData.hora_itinerario}:00-05:00`);
    const realDate = new Date(`${addFormData.fecha}T${addFormData.hora_real || addFormData.hora_itinerario}:00-05:00`);
    
    const record: any = {
      fecha: addFormData.fecha,
      aerolinea: addFormData.aerolinea,
      numero_vuelo: addFormData.numero_vuelo,
      hora_itinerario: itinDate.toISOString(),
      estado_final: addFormData.estado_final,
      pasajeros_abordo: Number(addFormData.pasajeros_abordo),
      capacidad_total: Number(addFormData.capacidad_total)
    };

    if (isLlegada) {
      record.origen = addFormData.origen;
      record.hora_llegada_real = realDate.toISOString();
    } else {
      record.destino = addFormData.destino;
      record.hora_salida_real = realDate.toISOString();
    }

    const res = await insertFlightRecords([record], addFormData.type);
    if (res.success) {
      window.location.reload();
    } else {
      alert("Error al guardar: " + res.error);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data: any[] = XLSX.utils.sheet_to_json(ws, { raw: false });
        
        const llegadasToInsert = [];
        const salidasToInsert = [];

        for (const row of data) {
          // Leer las columnas de AODB según la captura
          const leg = row['Leg']?.toString().toLowerCase() || row['Tipo']?.toString().toLowerCase() || '';
          const isLlegada = leg.includes('arrival') || leg.includes('llegada');
          const isSalida = leg.includes('departure') || leg.includes('salida');
          
          if (!isLlegada && !isSalida) continue;

          // Filtrar estrictamente solo Air Panama y Copa Airlines
          let aerolinea = row['Airline']?.toString().trim() || row['Aerolínea']?.toString().trim();
          if (aerolinea !== 'Air Panama' && aerolinea !== 'Copa Airlines') {
            continue; // Se ignora cualquier otra aerolínea
          }

          // Extraer Fecha y Horas robustamente
          let fechaStr = currentDateStr; // Fallback
          let runwayTimeStr = '12:00';
          let actualTimeStr = '12:00';

          const rawRunway = (row['Runway Time'] || row['Runway time'] || row['Hora Itinerario'] || '').toString().trim();
          const rawActual = (row['Actual Time (ATA/ATAD)'] || row['Actual Time'] || row['Actual time'] || row['Hora Real'] || rawRunway).toString().trim();

          // Si rawRunway viene como "08/01/2026 12:33" (MM/DD/YYYY HH:mm)
          if (rawRunway.includes(' ')) {
            const parts = rawRunway.split(' ');
            const dParts = parts[0].split('/'); // MM/DD/YYYY
            if (dParts.length === 3) {
              fechaStr = `${dParts[2]}-${dParts[0].padStart(2, '0')}-${dParts[1].padStart(2, '0')}`; // YYYY-MM-DD
            }
            runwayTimeStr = parts[1];
          } else if (rawRunway) {
            runwayTimeStr = rawRunway;
          }

          if (rawActual.includes(' ')) {
            actualTimeStr = rawActual.split(' ')[1];
          } else if (rawActual) {
            actualTimeStr = rawActual;
          }

          // Fallback por si la fecha venía en otra columna (como Date)
          if (!rawRunway.includes(' ')) {
            let fallbackDate = (row['Date'] || row['Fecha'] || '').toString().trim();
            if (fallbackDate && fallbackDate.includes('/')) {
              const months: any = { 'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06', 'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12' };
              const parts = fallbackDate.split('/');
              if (parts.length === 3) {
                const day = parts[0].padStart(2, '0');
                const month = months[parts[1].toLowerCase()] || parts[1].padStart(2, '0');
                const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
                fechaStr = `${year}-${month}-${day}`;
              }
            } else if (fallbackDate) {
              fechaStr = fallbackDate;
            }
          }
          
          // Parsear Número de Vuelo
          let rawFlight = (row['Flight'] || row['Vuelo'] || '').toString().trim().toUpperCase();
          rawFlight = rawFlight.replace(' ', '-'); // "CM 030" -> "CM-030"
          
          if (aerolinea === 'Air Panama' && rawFlight.startsWith('7P') && !rawFlight.includes('-')) {
            rawFlight = rawFlight.replace('7P', '7P-');
          } else if (aerolinea === 'Copa Airlines') {
            if (rawFlight.startsWith('CMP')) rawFlight = rawFlight.replace('CMP', 'CM-');
            if (rawFlight.startsWith('CM') && !rawFlight.includes('-')) rawFlight = rawFlight.replace('CM', 'CM-');
            
            // Pad flight number with zero if it's too short, ej: CM-14 -> CM-014
            const parts = rawFlight.split('-');
            if (parts.length === 2 && parts[1].length < 3) {
              parts[1] = parts[1].padStart(3, '0');
              rawFlight = `${parts[0]}-${parts[1]}`;
            }
          }
          
          const itinDate = new Date(`${fechaStr}T${runwayTimeStr}:00-05:00`);
          const realDate = new Date(`${fechaStr}T${actualTimeStr}:00-05:00`);

          // Calcular estado básico basado en retraso (>15 mins = DEMORADO)
          const diffMins = (realDate.getTime() - itinDate.getTime()) / 60000;
          let estadoFinal = 'LLEGÓ';
          if (diffMins > 15) estadoFinal = 'DEMORADO';

          const record: any = {
            fecha: fechaStr,
            aerolinea: aerolinea,
            numero_vuelo: rawFlight,
            hora_itinerario: itinDate.toISOString(),
            estado_final: row['Estado'] || estadoFinal,
            pasajeros_abordo: Number(row['Pax'] || row['Pasajeros']) || 0,
            capacidad_total: aerolinea === 'Air Panama' ? 78 : 160 // Valor por defecto
          };

          // Extra (si existe en base de datos futura, no hace daño enviarlo, se ignora si no existe)
          if (row['Reg']) record.matricula = row['Reg'];

          const od = row['O/D'] || row['Origen'] || row['Destino'] || 'PAC';

          if (isLlegada) {
            record.origen = od;
            record.hora_llegada_real = realDate.toISOString();
            llegadasToInsert.push(record);
          } else {
            record.destino = od;
            record.hora_salida_real = realDate.toISOString();
            salidasToInsert.push(record);
          }
        }

        let total = 0;
        if (llegadasToInsert.length > 0) {
          const res = await insertFlightRecords(llegadasToInsert, 'llegadas');
          if (res.success) total += llegadasToInsert.length;
        }
        if (salidasToInsert.length > 0) {
          const res = await insertFlightRecords(salidasToInsert, 'salidas');
          if (res.success) total += salidasToInsert.length;
        }

        alert(`Importación completada: ${total} vuelos procesados e importados correctamente.`);
        window.location.reload();
      } catch (err: any) {
        console.error("Error importando Excel:", err);
        alert("Error procesando archivo. Verifica el formato. Detalles: " + err.message);
        setImporting(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      {
        "Leg": "Arrival",
        "Airline": "Air Panama",
        "Flight": "7P972",
        "O/D": "PAC",
        "Reg": "HP1996P",
        "Aircraft": "F50",
        "Date": "01/Aug/26",
        "Runway Time": "09:45",
        "Actual Time": "09:50",
        "Pax": 60
      },
      {
        "Leg": "Departure",
        "Airline": "Copa Airlines",
        "Flight": "CMP14",
        "O/D": "PTY",
        "Reg": "HP1850P",
        "Aircraft": "B738",
        "Date": "01/Aug/26",
        "Runway Time": "10:15",
        "Actual Time": "11:00",
        "Pax": 150
      }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "AODB Data");
    XLSX.writeFile(wb, "Plantilla_AODB_Malek.xlsx");
  };

  return (
    <div className="flex flex-col w-full min-h-[calc(100vh-8rem)] relative">
      {/* Header Panel */}
      <section className="bg-gradient-to-br from-primary-container to-[#111f33] text-on-primary px-5 py-8 shadow-xl flex flex-col gap-5 rounded-b-[2rem] relative overflow-hidden">
        {/* Decoración sutil de fondo */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl translate-y-1/3 -translate-x-1/4"></div>

        <div className="flex items-center justify-between gap-2 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
              <span className="font-label-sm text-[11px] uppercase tracking-wider text-emerald-300 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">Registro Histórico</span>
            </div>
            <h1 className="font-headline-md text-2xl md:text-3xl text-white font-black tracking-tight drop-shadow-sm">
              Información del Aeropuerto Internacional Enrique Malek (David - Chiriquí)
            </h1>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <button onClick={() => setIsAddModalOpen(true)} className="bg-emerald-500 hover:bg-emerald-400 px-3.5 py-2 rounded-full flex items-center gap-1.5 shadow-md transition-colors cursor-pointer text-white font-bold tracking-wide border border-emerald-400/50">
                <span className="material-symbols-outlined text-[16px]">add</span>
                <span className="text-[12px]">Agregar Vuelo</span>
              </button>
              <button onClick={() => setIsImportModalOpen(true)} className="bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-full flex items-center gap-1.5 shadow-sm border border-white/20 hover:bg-white/20 transition-colors cursor-pointer text-white font-bold tracking-wide">
                <span className="material-symbols-outlined text-[16px]">upload_file</span>
                <span className="text-[12px]">Importar</span>
              </button>

            </div>
          </div>
        </div>

        {/* Llegadas / Salidas Toggle */}
        <div className="flex items-center gap-2 mt-1 bg-white/10 p-1.5 rounded-2xl w-fit border border-white/10 shadow-inner relative z-10 backdrop-blur-md">
          <button 
            onClick={() => setViewType('todos')}
            className={`px-5 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${viewType === 'todos' ? 'bg-white text-primary shadow-md scale-[1.02]' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
          >
            <span className="material-symbols-outlined text-[18px]">swap_vert</span>
            Todos
          </button>
          <button 
            onClick={() => setViewType('llegadas')}
            className={`px-5 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${viewType === 'llegadas' ? 'bg-white text-primary shadow-md scale-[1.02]' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
          >
            <span className="material-symbols-outlined text-[18px]">flight_land</span>
            Llegadas
          </button>
          <button 
            onClick={() => setViewType('salidas')}
            className={`px-5 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${viewType === 'salidas' ? 'bg-white text-primary shadow-md scale-[1.02]' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
          >
            <span className="material-symbols-outlined text-[18px]">flight_takeoff</span>
            Salidas
          </button>
        </div>

        <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-4 flex flex-col gap-4 border border-white/10 mt-1 relative z-10 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={handlePrevDay} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 hover:scale-105 active:scale-95 transition-all border border-white/5">
                <span className="material-symbols-outlined text-[20px]">chevron_left</span>
              </button>
              
              <div 
                className="flex items-center gap-2.5 px-4 py-2 bg-white/10 rounded-xl text-white relative cursor-pointer hover:bg-white/20 hover:scale-[1.02] transition-all border border-white/10 shadow-sm"
                onClick={() => dateInputRef.current?.showPicker && dateInputRef.current.showPicker()}
              >
                <input 
                  type="date"
                  ref={dateInputRef}
                  value={currentDateStr}
                  onChange={handleDateChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <span className="material-symbols-outlined text-white text-[18px] pointer-events-none drop-shadow-sm">calendar_today</span>
                <span className="font-label-md text-[14px] font-black tracking-wide pointer-events-none drop-shadow-sm">
                  {new Date(currentDateStr + "T12:00:00").toLocaleDateString('es-PA', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}
                </span>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleToday(); }} 
                  className={`text-[11px] px-2 py-0.5 rounded-md font-black uppercase ml-1 transition-all z-10 relative shadow-sm ${isToday ? 'bg-emerald-500 text-white' : 'bg-white/20 hover:bg-emerald-500'}`}
                >
                  Hoy
                </button>
              </div>

              <button onClick={handleNextDay} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 hover:scale-105 active:scale-95 transition-all border border-white/5">
                <span className="material-symbols-outlined text-[20px]">chevron_right</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1 text-center">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl py-3 flex flex-col border border-white/20 shadow-inner hover:bg-white/15 transition-colors">
              <span className="text-[11px] text-white/80 font-bold uppercase tracking-wider mb-0.5">
                {viewType === 'todos' ? 'Total Vuelos' : `Total ${viewType === 'llegadas' ? 'Llegadas' : 'Salidas'}`}
              </span>
              <span className="font-headline-md text-2xl font-black text-white drop-shadow-sm">{totalFlights}</span>
            </div>
            <div className="bg-gradient-to-b from-emerald-500/20 to-emerald-600/20 backdrop-blur-md rounded-2xl py-3 flex flex-col border border-emerald-400/30 shadow-[0_4px_20px_rgba(16,185,129,0.15)] hover:from-emerald-500/30 hover:to-emerald-600/30 transition-colors">
              <span className="text-[11px] text-emerald-100 font-bold uppercase tracking-wider mb-0.5">Completados</span>
              <span className="font-headline-md text-2xl font-black text-emerald-300 drop-shadow-sm">{aTiempo}</span>
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
                  <th 
                    className="px-4 py-3.5 min-w-[120px] cursor-pointer hover:bg-slate-100 transition-colors select-none"
                    onClick={() => handleSort('ruta')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px]">near_me</span>
                      <span>Ruta</span>
                      {sortColumn === 'ruta' && (
                        <span className="material-symbols-outlined text-[14px] text-primary">
                          {sortDirection === 'asc' ? 'arrow_downward' : 'arrow_upward'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3.5 min-w-[120px]">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px]">schedule</span>
                      <span>Itinerario ➔ Real (Retraso)</span>
                    </div>
                  </th>
                  <th className="px-4 py-3.5 min-w-[120px]">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px]">group</span>
                      <span>Ocupación</span>
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3.5 min-w-[110px] cursor-pointer hover:bg-slate-100 transition-colors select-none"
                    onClick={() => handleSort('estado')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px]">flag</span>
                      <span>Estado</span>
                      {sortColumn === 'estado' && (
                        <span className="material-symbols-outlined text-[14px] text-primary">
                          {sortDirection === 'asc' ? 'arrow_downward' : 'arrow_upward'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3.5 min-w-[80px] text-center">
                    <span>Acción</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedData.length > 0 ? (
                  sortedData.map((flight) => {
                    const paxCount = flight.pasajeros_abordo || 0;
                    const paxMax = flight.capacidad_total || 100;
                    const paxPct = Math.round((paxCount / paxMax) * 100);
                    const isLlegada = !!flight.hora_llegada_real;

                    return (
                      <tr key={flight.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 px-4 py-3 shadow-[2px_0_5px_rgba(0,0,0,0.02)] border-r border-slate-100">
                          <div className="flex items-center gap-3">
                            <span className={`w-9 h-9 rounded-lg ${getAirlineBadge(flight.aerolinea)} flex items-center justify-center font-bold text-[14px] shrink-0 uppercase`}>
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
                          <div className="flex flex-col gap-1 w-[120px]">
                            <div className="flex items-center justify-between text-[13px]">
                              <span className="text-slate-400 font-medium line-through decoration-slate-300" title="Itinerario">
                                {formatTime(flight.hora_itinerario || (isLlegada ? flight.hora_llegada_real : flight.hora_salida_real))}
                              </span>
                              <span className="material-symbols-outlined text-[14px] text-slate-300">arrow_right_alt</span>
                              <span className="font-bold text-slate-800" title="Hora Real">
                                {formatTime(isLlegada ? flight.hora_llegada_real : flight.hora_salida_real)}
                              </span>
                            </div>
                            
                            {(() => {
                              const realStr = isLlegada ? flight.hora_llegada_real : flight.hora_salida_real;
                              const itinStr = flight.hora_itinerario || realStr;
                              const rDate = new Date(realStr || '');
                              const iDate = new Date(itinStr || '');
                              
                              let diffMins = 0;
                              if (!isNaN(rDate.getTime()) && !isNaN(iDate.getTime())) {
                                diffMins = Math.round((rDate.getTime() - iDate.getTime()) / 60000);
                              }
                              
                              const isDelayed = diffMins > 10; // Tolerancia 10 min
                              const pct = isDelayed ? Math.min((diffMins / 60) * 100, 100) : 0;
                              
                              return (
                                <>
                                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden flex">
                                    <div 
                                      className={`h-full rounded-full transition-all ${isDelayed ? 'bg-rose-500' : 'bg-emerald-400'}`} 
                                      style={{ width: `${isDelayed ? pct : 100}%` }}
                                    ></div>
                                  </div>
                                  <div className="flex justify-end mt-0.5">
                                    <span className={`text-[10px] font-bold ${isDelayed ? 'text-rose-600' : 'text-emerald-600'}`}>
                                      {isDelayed ? `+${diffMins}m retraso` : 'A Tiempo'}
                                    </span>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
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
                          <div className="flex items-center justify-center gap-2">
                            <button 
                              onClick={() => openEditDrawer(flight)}
                              className="p-1.5 rounded-lg bg-slate-100 text-primary hover:bg-primary hover:text-white active:scale-95 transition-all shadow-sm"
                              title="Editar Fila"
                            >
                              <span className="material-symbols-outlined text-[16px]">edit</span>
                            </button>
                            <button 
                              onClick={() => handleDelete(flight)}
                              className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-500 hover:text-white active:scale-95 transition-all shadow-sm"
                              title="Eliminar Vuelo Incorrecto"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          </div>
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
          <div className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl z-10 transform transition-transform animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:fade-in-0 duration-300 flex flex-col max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[20px]">edit_document</span>
                </div>
                <div>
                  <h2 className="font-headline-sm text-[16px] font-bold text-primary">Editar Registro</h2>
                  <p className="font-body-sm text-[12px] text-slate-500">ID: {editingFlight.id.slice(0,8)}...</p>
                </div>
              </div>
              <button 
                className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100" 
                onClick={() => setIsDrawerOpen(false)}
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <form className="flex flex-col gap-5" onSubmit={handleSaveEdit}>
                <div className="flex items-center gap-4">
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Fecha</label>
                    <input 
                      className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      type="date" required value={editFormData.fecha}
                      onChange={(e) => setEditFormData({...editFormData, fecha: e.target.value})}
                    />
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Aerolínea</label>
                    <select 
                      className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      required value={editFormData.aerolinea}
                      onChange={(e) => setEditFormData({...editFormData, aerolinea: e.target.value})}
                    >
                      <option value="Air Panama">Air Panama</option>
                      <option value="Copa Airlines">Copa Airlines</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Número de Vuelo</label>
                    <input 
                      className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      type="text" required value={editFormData.numero_vuelo}
                      onChange={(e) => setEditFormData({...editFormData, numero_vuelo: e.target.value})}
                    />
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">{!!editingFlight.hora_llegada_real ? 'Origen' : 'Destino'}</label>
                    <input 
                      className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      type="text" required 
                      value={!!editingFlight.hora_llegada_real ? editFormData.origen : editFormData.destino}
                      onChange={(e) => !!editingFlight.hora_llegada_real 
                        ? setEditFormData({...editFormData, origen: e.target.value}) 
                        : setEditFormData({...editFormData, destino: e.target.value})}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Hora Itin.</label>
                    <input 
                      className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      type="time" required value={editFormData.hora_itinerario}
                      onChange={(e) => setEditFormData({...editFormData, hora_itinerario: e.target.value})}
                    />
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Hora Real</label>
                    <input 
                      className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      type="time" required value={editFormData.hora_real}
                      onChange={(e) => setEditFormData({...editFormData, hora_real: e.target.value})}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Pasajeros</label>
                    <input 
                      className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      type="number" min="0" required value={editFormData.pasajeros_abordo}
                      onChange={(e) => setEditFormData({...editFormData, pasajeros_abordo: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Capacidad</label>
                    <input 
                      className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      type="number" min="0" required value={editFormData.capacidad_total}
                      onChange={(e) => setEditFormData({...editFormData, capacidad_total: parseInt(e.target.value) || 0})}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Estado Final</label>
                  <select 
                    className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                    value={editFormData.estado_final}
                    onChange={(e) => setEditFormData({...editFormData, estado_final: e.target.value})}
                  >
                    <option value="LLEGÓ">Llegó</option>
                    <option value="CUMPLIDO">Cumplido</option>
                    <option value="DEMORADO">Demorado</option>
                    <option value="DESVIADO">Desviado</option>
                  </select>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-slate-100 mt-2">
                  <button 
                    className="flex-1 h-11 rounded-xl bg-slate-100 text-slate-600 font-bold active:scale-95 transition-transform" 
                    onClick={() => setIsDrawerOpen(false)} 
                    type="button"
                  >
                    Cancelar
                  </button>
                  <button 
                    className="flex-1 h-11 rounded-xl bg-primary text-white font-bold shadow-md hover:bg-primary/90 active:scale-95 transition-transform flex items-center justify-center gap-2" 
                    type="submit"
                  >
                    <span className="material-symbols-outlined text-[18px]">save</span>
                    <span>Guardar Cambios</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Agregar Vuelo */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">add_circle</span>
                Agregar Registro de Vuelo
              </h2>
              <button onClick={() => setIsAddModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-500 transition-colors">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <form onSubmit={handleAddFlightSubmit} className="flex flex-col gap-5">
                <div className="flex items-center gap-4">
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Tipo de Operación</label>
                    <select className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      value={addFormData.type} onChange={(e) => setAddFormData({...addFormData, type: e.target.value as any})} required>
                      <option value="llegadas">Llegada a Malek</option>
                      <option value="salidas">Salida de Malek</option>
                    </select>
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Fecha (YYYY-MM-DD)</label>
                    <input type="date" className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      value={addFormData.fecha} onChange={(e) => setAddFormData({...addFormData, fecha: e.target.value})} required />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Aerolínea</label>
                    <select className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      value={addFormData.aerolinea} onChange={(e) => setAddFormData({...addFormData, aerolinea: e.target.value})} required>
                      <option value="Air Panama">Air Panama</option>
                      <option value="Copa Airlines">Copa Airlines</option>
                    </select>
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Número de Vuelo</label>
                    <input type="text" placeholder="Ej: 7P-972" className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      value={addFormData.numero_vuelo} onChange={(e) => setAddFormData({...addFormData, numero_vuelo: e.target.value})} required />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">{addFormData.type === 'llegadas' ? 'Origen' : 'Destino'}</label>
                    <input type="text" placeholder="Ej: PAC" className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      value={addFormData.type === 'llegadas' ? addFormData.origen : addFormData.destino} 
                      onChange={(e) => addFormData.type === 'llegadas' ? setAddFormData({...addFormData, origen: e.target.value}) : setAddFormData({...addFormData, destino: e.target.value})} required />
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Estado Final</label>
                    <select className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      value={addFormData.estado_final} onChange={(e) => setAddFormData({...addFormData, estado_final: e.target.value})} required>
                      <option value="LLEGÓ">Llegó</option>
                      <option value="CUMPLIDO">Cumplido</option>
                      <option value="DEMORADO">Demorado</option>
                      <option value="DESVIADO">Desviado</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Hora Itinerario (HH:MM)</label>
                    <input type="time" className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      value={addFormData.hora_itinerario} onChange={(e) => setAddFormData({...addFormData, hora_itinerario: e.target.value})} required />
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Hora Real (HH:MM)</label>
                    <input type="time" className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      value={addFormData.hora_real} onChange={(e) => setAddFormData({...addFormData, hora_real: e.target.value})} required />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Pasajeros</label>
                    <input type="number" min="0" className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      value={addFormData.pasajeros_abordo} onChange={(e) => setAddFormData({...addFormData, pasajeros_abordo: parseInt(e.target.value)})} required />
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Capacidad</label>
                    <input type="number" min="0" className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      value={addFormData.capacidad_total} onChange={(e) => setAddFormData({...addFormData, capacidad_total: parseInt(e.target.value)})} required />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-slate-100 mt-2">
                  <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 h-11 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-colors">
                    Cancelar
                  </button>
                  <button type="submit" className="flex-1 h-11 rounded-xl bg-primary text-white font-bold shadow-md hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">save</span>
                    Guardar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Importar Vuelos */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">upload_file</span>
                Importar Vuelos Masivos
              </h2>
              <button onClick={() => setIsImportModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-500 transition-colors">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            
            <div className="p-6 flex flex-col gap-6 items-center">
              <div className="text-center space-y-2">
                <h3 className="font-bold text-slate-800 text-[15px]">Arrastra tu archivo Excel o CSV</h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                  Puedes importar registros históricos pasados arrastrando el documento aquí. Asegúrate de que las columnas coincidan con la plantilla oficial.
                </p>
              </div>

              <div className="relative w-full h-48 border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50 flex flex-col items-center justify-center gap-3 hover:border-primary hover:bg-primary/5 transition-colors group cursor-pointer">
                <input 
                  type="file" 
                  accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={handleFileUpload}
                  disabled={importing}
                />
                <div className={`flex flex-col items-center gap-2 ${importing ? 'animate-pulse' : ''}`}>
                  <span className={`material-symbols-outlined text-4xl ${importing ? 'text-primary' : 'text-slate-400 group-hover:text-primary transition-colors'}`}>
                    {importing ? 'hourglass_top' : 'cloud_upload'}
                  </span>
                  <span className="font-bold text-slate-600 text-sm group-hover:text-primary transition-colors">
                    {importing ? 'Procesando archivo...' : 'Haz clic o arrastra aquí'}
                  </span>
                </div>
              </div>

              <button 
                onClick={handleDownloadTemplate} 
                className="text-primary font-bold text-sm hover:underline flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                Descargar Plantilla de Ejemplo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
