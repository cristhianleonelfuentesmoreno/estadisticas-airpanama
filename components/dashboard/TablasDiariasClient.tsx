"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateLlegadaMalek, updateSalidaMalek, deleteLlegadaMalek, deleteSalidaMalek, insertFlightRecords, getUpcomingFlights } from "@/app/actions/flights";
import * as XLSX from 'xlsx';
import { FlightAuditBoard } from "./FlightAuditBoard";

interface MalekFlight {
  id: string;
  fecha: string;
  aerolinea: string;
  numero_vuelo: string;
  origen: string;
  destino?: string;
  hora_itinerario_salida?: string;
  hora_real_salida?: string;
  hora_itinerario_llegada?: string;
  hora_real_llegada?: string;
  estado_final: string;
  pasajeros_abordo: number;
  capacidad_total: number;
  avion?: string;
}

const AIRCRAFT_MODELS = [
  { id: 'F50', label: 'F50 (Air Panama)', cap: 50 },
  { id: 'DH8D', label: 'DH8D (Air Panama)', cap: 78 },
  { id: 'B737', label: 'B737 (Copa)', cap: 124 },
  { id: 'B738', label: 'B738 (Copa)', cap: 160 },
  { id: 'B39M', label: 'B39M (Copa)', cap: 166 },
  { id: 'OTRO', label: 'Otro', cap: 100 },
];

const AIRPORTS = [
  { code: 'DAV', name: 'DAV - Enrique Malek' },
  { code: 'PAC', name: 'PAC - Albrook' },
  { code: 'PTY', name: 'PTY - Tocumen' },
  { code: 'BLB', name: 'BLB - Panamá Pacífico' },
  { code: 'BOC', name: 'BOC - Isla Colón (Bocas)' },
  { code: 'CHX', name: 'CHX - Changuinola' },
  { code: 'SYQ', name: 'SYQ - Tobías Bolaños' },
  { code: 'SJO', name: 'SJO - Juan Santamaría' }
];

const COMMON_FLIGHTS = [
  "770", "771", "772", "773", "774", "775", "776", "777", "778", "779",
  "011", "012", "015", "016", "019"
];

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
  
  // Aprobacion state
  const [isPendingModalOpen, setIsPendingModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [pendingAuditCount, setPendingAuditCount] = useState(0);

  // Derivados de initialData para separar PENDIENTES
  const llegadasPendientes = useMemo(() => initialData.llegadas.filter(f => f.estado_final === 'PENDIENTE'), [initialData.llegadas]);
  const llegadasAprobadas = useMemo(() => initialData.llegadas.filter(f => f.estado_final !== 'PENDIENTE'), [initialData.llegadas]);

  const salidasPendientes = useMemo(() => initialData.salidas.filter(f => f.estado_final === 'PENDIENTE'), [initialData.salidas]);
  const salidasAprobadas = useMemo(() => initialData.salidas.filter(f => f.estado_final !== 'PENDIENTE'), [initialData.salidas]);

  const totalPendientes = llegadasPendientes.length + salidasPendientes.length;

  const activeDataList = useMemo(() => {
    if (viewType === 'llegadas') return llegadasAprobadas;
    if (viewType === 'salidas') return salidasAprobadas;
    
    const combined = [...llegadasAprobadas, ...salidasAprobadas];
    return combined.sort((a, b) => {
      const timeA = new Date(a.hora_real_llegada || a.hora_real_salida || 0).getTime();
      const timeB = new Date(b.hora_real_llegada || b.hora_real_salida || 0).getTime();
      return timeB - timeA;
    });
  }, [llegadasAprobadas, salidasAprobadas, viewType]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importWorkbook, setImportWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [isSheetModalOpen, setIsSheetModalOpen] = useState(false);
  const [submittingAction, setSubmittingAction] = useState<string | null>(null);

  const loadPendingAudit = async () => {
    try {
      const data = await getUpcomingFlights(currentDateStr);
      const pendingAudit = data.filter(f => 
        (f.origin === 'DAV' || f.destination === 'DAV') &&
        (f.status === 'ARRIBÓ' || f.status === 'CANCELADO') && !f.isArchived
      );
      setPendingAuditCount(pendingAudit.length);
    } catch (err) {
      console.error("Error loading pending audit", err);
    }
  };

  useEffect(() => {
    loadPendingAudit();
  }, [currentDateStr]);

  const [importResult, setImportResult] = useState<{show: boolean, type: 'success' | 'error', message: string}>({show: false, type: 'success', message: ''});
  const [flightToDelete, setFlightToDelete] = useState<MalekFlight | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Add Flight Form State
  const [addFormData, setAddFormData] = useState({
    type: 'llegadas' as 'llegadas' | 'salidas',
    aerolinea: 'Air Panama',
    numero_vuelo: '',
    origen: '',
    destino: '',
    fecha: currentDateStr,
    hora_itinerario_salida: '',
    hora_real_salida: '',
    hora_itinerario_llegada: '',
    hora_real_llegada: '',
    estado_final: 'LLEGÓ',
    pasajeros_abordo: 0,
    capacidad_total: 78,
    avion: 'DH8D'
  });
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingFlight, setEditingFlight] = useState<MalekFlight | null>(null);
  const [editFormData, setEditFormData] = useState({
    fecha: "",
    aerolinea: "",
    numero_vuelo: "",
    avion: "DH8D",
    origen: "",
    destino: "",
    hora_itinerario_salida: "",
    hora_real_salida: "",
    hora_itinerario_llegada: "",
    hora_real_llegada: "",
    pasajeros_abordo: 0,
    capacidad_total: 0,
    estado_final: ""
  });

  const handlePrevDay = () => {
    const d = new Date(currentDateStr + "T12:00:00");
    d.setDate(d.getDate() - 1);
    const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'America/Panama' });
    window.dispatchEvent(new CustomEvent("start-navigation"));
    router.push(`?date=${dateStr}`);
  };

  const handleNextDay = () => {
    const d = new Date(currentDateStr + "T12:00:00");
    d.setDate(d.getDate() + 1);
    const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'America/Panama' });
    window.dispatchEvent(new CustomEvent("start-navigation"));
    router.push(`?date=${dateStr}`);
  };

  const handleToday = () => {
    const dateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' });
    window.dispatchEvent(new CustomEvent("start-navigation"));
    router.push(`?date=${dateStr}`);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      window.dispatchEvent(new CustomEvent("start-navigation"));
      router.push(`?date=${e.target.value}`);
    }
  };

  const isToday = currentDateStr === new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' });

  const filteredData = useMemo(() => {
    return activeDataList.filter(flight => {
      const location = flight.hora_real_llegada ? flight.origen : flight.destino;
      const matchSearch = 
        flight.numero_vuelo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (location && location.toLowerCase().includes(searchQuery.toLowerCase())) ||
        flight.aerolinea.toLowerCase().includes(searchQuery.toLowerCase());

      const matchFilter = activeFilter === "all" || flight.aerolinea === activeFilter;

      return matchSearch && matchFilter;
    });
  }, [activeDataList, searchQuery, activeFilter]);

  const totalFlights = filteredData.length;
  const aTiempo = filteredData.filter(f => f.estado_final === "LLEGÓ" || f.estado_final === "CUMPLIDO").length;

  const sortedData = useMemo(() => {
    let sorted = [...filteredData];
    if (sortColumn === 'ruta') {
      sorted.sort((a, b) => {
        const routeA = a.hora_real_llegada ? `${a.origen}-DAV` : `DAV-${a.destino}`;
        const routeB = b.hora_real_llegada ? `${b.origen}-DAV` : `DAV-${b.destino}`;
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
      return date.toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Panama' });
    } catch {
      return '--:--';
    }
  };

  const toTimeStringForInput = (isoString?: string) => {
    if (!isoString) return '00:00';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', timeZone: 'America/Panama' });
    } catch {
      return '00:00';
    }
  };

  const openEditDrawer = (flight: MalekFlight) => {
    setEditingFlight(flight);
    const timeValue = flight.hora_real_llegada ? flight.hora_real_llegada : flight.hora_real_salida;
    
    setEditFormData({
      fecha: flight.fecha || "",
      aerolinea: flight.aerolinea || "",
      numero_vuelo: flight.numero_vuelo || "",
      origen: flight.origen || "",
      destino: flight.destino || "",
      hora_itinerario_salida: toTimeStringForInput(flight.hora_itinerario_salida),
      hora_real_salida: toTimeStringForInput(flight.hora_real_salida),
      hora_itinerario_llegada: toTimeStringForInput(flight.hora_itinerario_llegada),
      hora_real_llegada: toTimeStringForInput(flight.hora_real_llegada),
      pasajeros_abordo: flight.pasajeros_abordo || 0,
      capacidad_total: flight.capacidad_total || 78,
      avion: flight.avion || "DH8D",
      estado_final: flight.estado_final
    });
    setIsDrawerOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFlight) return;
    
    const isLlegada = !!editingFlight.hora_real_llegada;
    
    const itinSalida = new Date(`${editFormData.fecha}T${editFormData.hora_itinerario_salida || '00:00'}:00-05:00`);
    const realSalida = new Date(`${editFormData.fecha}T${editFormData.hora_real_salida || editFormData.hora_itinerario_salida || '00:00'}:00-05:00`);
    const itinLlegada = new Date(`${editFormData.fecha}T${editFormData.hora_itinerario_llegada || '00:00'}:00-05:00`);
    const realLlegada = new Date(`${editFormData.fecha}T${editFormData.hora_real_llegada || editFormData.hora_itinerario_llegada || '00:00'}:00-05:00`);

    const updates: any = {
      fecha: editFormData.fecha,
      aerolinea: editFormData.aerolinea,
      numero_vuelo: editFormData.numero_vuelo,
      pasajeros_abordo: Number(editFormData.pasajeros_abordo),
      capacidad_total: Number(editFormData.capacidad_total),
      estado_final: editFormData.estado_final,
      hora_itinerario_salida: itinSalida.toISOString(),
      hora_real_salida: realSalida.toISOString(),
      hora_itinerario_llegada: itinLlegada.toISOString(),
      hora_real_llegada: realLlegada.toISOString()
    };
    
    if (isLlegada) {
      updates.origen = editFormData.origen;
      updates.hora_itinerario = itinLlegada.toISOString();
      updates.hora_real_llegada = realLlegada.toISOString();
    } else {
      updates.destino = editFormData.destino;
      updates.hora_itinerario = itinSalida.toISOString();
      updates.hora_real_salida = realSalida.toISOString();
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
      window.location.reload();
    } else {
      alert("Error al actualizar: " + res.error);
    }
  };
  const handleDeleteClick = (flight: MalekFlight) => {
    setFlightToDelete(flight);
    setIsDeleteModalOpen(true);
  };

  const executeDelete = async () => {
    if (!flightToDelete) return;

    setDeletingId(flightToDelete.id);
    setIsDeleteModalOpen(false);

    try {
      const isLlegada = !!flightToDelete.origen;
      let res;
      if (isLlegada) {
        res = await deleteLlegadaMalek(flightToDelete.id);
      } else {
        res = await deleteSalidaMalek(flightToDelete.id);
      }

      if (res.success) {
        window.location.reload();
      } else {
        alert("Error al eliminar: " + res.error);
      }
    } catch (err: any) {
      alert("Error inesperado: " + err.message);
    } finally {
      setDeletingId(null);
      setFlightToDelete(null);
    }
  };
  const handleAddFlightSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isLlegada = addFormData.type === 'llegadas';
    
    // Create correct Date objects
    const itinSalida = new Date(`${addFormData.fecha}T${addFormData.hora_itinerario_salida || '00:00'}:00-05:00`);
    const realSalida = new Date(`${addFormData.fecha}T${addFormData.hora_real_salida || addFormData.hora_itinerario_salida || '00:00'}:00-05:00`);
    const itinLlegada = new Date(`${addFormData.fecha}T${addFormData.hora_itinerario_llegada || '00:00'}:00-05:00`);
    const realLlegada = new Date(`${addFormData.fecha}T${addFormData.hora_real_llegada || addFormData.hora_itinerario_llegada || '00:00'}:00-05:00`);
    
    const record: any = {
      fecha: addFormData.fecha,
      aerolinea: addFormData.aerolinea,
      numero_vuelo: addFormData.numero_vuelo,
      estado_final: addFormData.estado_final,
      pasajeros_abordo: Number(addFormData.pasajeros_abordo),
      capacidad_total: Number(addFormData.capacidad_total),
      hora_itinerario_salida: itinSalida.toISOString(),
      hora_real_salida: realSalida.toISOString(),
      hora_itinerario_llegada: itinLlegada.toISOString(),
      hora_real_llegada: realLlegada.toISOString()
    };

    if (isLlegada) {
      record.origen = addFormData.origen;
      record.hora_itinerario = itinLlegada.toISOString();
      record.hora_real_llegada = realLlegada.toISOString();
    } else {
      record.destino = addFormData.destino;
      record.hora_itinerario = itinSalida.toISOString();
      record.hora_real_salida = realSalida.toISOString();
    }

    const res = await insertFlightRecords([record], addFormData.type);
    if (res.success) {
      window.location.reload();
    } else {
      alert("Error al guardar: " + res.error);
    }
  };

  const processExcelSheet = async (wb: XLSX.WorkBook, sheetName: string) => {
    setImporting(true);
    setIsSheetModalOpen(false);

    try {
      const ws = wb.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' }) as any[][];
      
      // Encontrar la fila de encabezados (buscamos 'Leg' o 'Tipo', 'Airline' o 'Aerolínea')
      let headerRowIndex = -1;
      let headers: string[] = [];
      for (let i = 0; i < Math.min(20, rawData.length); i++) {
        const row = rawData[i];
        if (!row) continue;
        const stringRow = row.map(cell => cell ? cell.toString().toLowerCase().trim() : '');
        if (stringRow.includes('leg') || stringRow.includes('tipo') || stringRow.includes('airline') || stringRow.includes('aerolínea') || stringRow.includes('flight') || stringRow.includes('vuelo')) {
          headerRowIndex = i;
          headers = row.map(cell => cell ? cell.toString().trim() : '');
          break;
        }
      }

      if (headerRowIndex === -1) {
         throw new Error("No se encontraron encabezados válidos (Leg, Airline, Flight, etc.) en esta pestaña.");
      }

      // Reconstruir los datos como objetos
      const data = [];
      for (let i = headerRowIndex + 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.length === 0) continue;
        const obj: any = {};
        let hasAnyData = false;
        for (let j = 0; j < headers.length; j++) {
           if (headers[j] && row[j] !== undefined && row[j] !== null && row[j] !== '') {
             obj[headers[j]] = row[j];
             hasAnyData = true;
           }
        }
        if (hasAnyData) data.push(obj);
      }
      
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
          record.hora_real_llegada = realDate.toISOString();
          llegadasToInsert.push(record);
        } else {
          record.destino = od;
          record.hora_real_salida = realDate.toISOString();
          salidasToInsert.push(record);
        }
      }

      let totalInserted = 0;
      let totalUpdated = 0;
      if (llegadasToInsert.length > 0) {
        const res = await insertFlightRecords(llegadasToInsert, 'llegadas');
        if (res.success) {
          totalInserted += res.inserted || 0;
          totalUpdated += res.updated || 0;
        }
      }
      if (salidasToInsert.length > 0) {
        const res = await insertFlightRecords(salidasToInsert, 'salidas');
        if (res.success) {
          totalInserted += res.inserted || 0;
          totalUpdated += res.updated || 0;
        }
      }

      let msg = `Importación completada: ${totalInserted} vuelos nuevos agregados.`;
      if (totalUpdated > 0) msg += ` ${totalUpdated} vuelos actualizados.`;
      
      setImportResult({ show: true, type: 'success', message: msg });
      setImporting(false);
    } catch (err: any) {
      console.error("Error importando Excel:", err);
      setImportResult({ show: true, type: 'error', message: "Error procesando archivo. Verifica el formato. Detalles: " + err.message });
      setImporting(false);
    } finally {
      setImporting(false);
      setImportWorkbook(null);
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
        
        if (wb.SheetNames.length > 1) {
          // Hay más de 1 pestaña, mostramos el modal para que el usuario seleccione
          setImportWorkbook(wb);
          setIsSheetModalOpen(true);
          setImporting(false); // Pausamos el spinner de carga de importación global mientras selecciona
        } else {
          // Si solo hay 1 pestaña, la importamos directamente
          await processExcelSheet(wb, wb.SheetNames[0]);
        }
      } catch (err: any) {
        console.error("Error leyendo Excel:", err);
        alert("Error procesando archivo. Detalles: " + err.message);
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

  const handleApprovePending = async (id: string, type: string, pax: number, time: string, status: string) => {
    const flight = [...llegadasPendientes, ...salidasPendientes].find(f => f.id === id);
    if (!flight) return;
    
    const realDate = new Date(`${flight.fecha}T${time}:00-05:00`).toISOString();
    
    if (type === 'llegadas') {
      await updateLlegadaMalek(id, {
        hora_real_llegada: realDate,
        pasajeros_abordo: pax,
        estado_final: status
      });
    } else {
      await updateSalidaMalek(id, {
        hora_real_salida: realDate,
        pasajeros_abordo: pax,
        estado_final: status
      });
    }
    
    handleRefresh();
  };

  return (
    <div className="flex flex-col w-full min-h-[calc(100vh-8rem)] relative">
      {/* Header Panel */}
      <section className="bg-gradient-to-br from-primary-container to-[#111f33] text-on-primary px-5 py-8 shadow-xl flex flex-col gap-5 rounded-b-[2rem] relative overflow-hidden">
        {/* Decoración sutil de fondo */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl translate-y-1/3 -translate-x-1/4"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                <span className="font-label-sm text-[11px] uppercase tracking-wider text-emerald-300 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">AODB Base</span>
              </div>
              <h1 className="font-headline-md text-2xl md:text-3xl text-white font-black tracking-tight drop-shadow-sm">
                Registro Histórico
              </h1>
            </div>
            {totalPendientes > 0 && (
              <button 
                onClick={() => setIsPendingModalOpen(true)}
                className="ml-4 flex items-center gap-2 bg-red-600/90 hover:bg-red-500 text-white px-4 py-2 rounded-full font-medium shadow-lg shadow-red-900/30 transition-all border border-red-400/50 animate-[pulse_2s_infinite]"
              >
                <span className="material-symbols-outlined text-xl">notification_important</span>
                {totalPendientes} Vuelos por Aprobar
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <button onClick={() => setIsAddModalOpen(true)} className="flex-1 md:flex-none justify-center bg-emerald-500 hover:bg-emerald-400 px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-md transition-colors cursor-pointer text-white font-bold tracking-wide border border-emerald-400/50">
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span className="text-[13px]">Agregar Vuelo</span>
            </button>
            <button onClick={() => setIsImportModalOpen(true)} className="flex-1 md:flex-none justify-center bg-white/10 backdrop-blur-md px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm border border-white/20 hover:bg-white/20 transition-colors cursor-pointer text-white font-bold tracking-wide">
              <span className="material-symbols-outlined text-[18px]">upload_file</span>
              <span className="text-[13px]">Importar</span>
            </button>
            <button 
              onClick={() => setIsAuditModalOpen(true)} 
              className={`flex-1 md:flex-none justify-center px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm border transition-colors cursor-pointer text-white font-bold tracking-wide ${pendingAuditCount > 0 ? 'bg-amber-500 hover:bg-amber-400 border-amber-400/50 animate-[pulse_2s_infinite] shadow-amber-900/30' : 'bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/20'}`}
            >
              <span className="material-symbols-outlined text-[18px]">{pendingAuditCount > 0 ? 'notification_important' : 'fact_check'}</span>
              <span className="text-[13px]">Pendientes {pendingAuditCount > 0 && `(${pendingAuditCount})`}</span>
            </button>
          </div>
        </div>

        {/* Llegadas / Salidas Toggle */}
        <div className="flex items-center gap-1 md:gap-2 mt-2 bg-white/10 p-1.5 rounded-xl w-full md:w-fit border border-white/10 shadow-inner relative z-10 backdrop-blur-md overflow-x-auto hide-scrollbar">
          <button 
            onClick={() => setViewType('todos')}
            className={`flex-1 md:flex-none justify-center px-3 md:px-5 py-2 rounded-lg text-[13px] md:text-sm font-bold transition-all flex items-center gap-1.5 ${viewType === 'todos' ? 'bg-white text-primary shadow-md' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
          >
            <span className="material-symbols-outlined text-[16px] md:text-[18px]">swap_vert</span>
            Todos
          </button>
          <button 
            onClick={() => setViewType('llegadas')}
            className={`flex-1 md:flex-none justify-center px-3 md:px-5 py-2 rounded-lg text-[13px] md:text-sm font-bold transition-all flex items-center gap-1.5 ${viewType === 'llegadas' ? 'bg-white text-primary shadow-md' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
          >
            <span className="material-symbols-outlined text-[16px] md:text-[18px]">flight_land</span>
            Llegadas
          </button>
          <button 
            onClick={() => setViewType('salidas')}
            className={`flex-1 md:flex-none justify-center px-3 md:px-5 py-2 rounded-lg text-[13px] md:text-sm font-bold transition-all flex items-center gap-1.5 ${viewType === 'salidas' ? 'bg-white text-primary shadow-md' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
          >
            <span className="material-symbols-outlined text-[16px] md:text-[18px]">flight_takeoff</span>
            Salidas
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-3 relative z-10 w-full mt-2">
          {/* Filters & Search */}
          <div className="flex flex-col gap-3 w-full bg-white/5 p-3 rounded-2xl border border-white/10 backdrop-blur-md">
            <div className="relative w-full">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                <span className="material-symbols-outlined text-[20px]">search</span>
              </div>
              <input 
                className="w-full h-11 pl-10 pr-10 bg-white/10 text-white text-sm rounded-xl border border-white/20 placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:bg-white/20 transition-all shadow-inner"
                placeholder="Buscar por vuelo, origen o aerolínea..." 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button 
                  className="absolute inset-y-0 right-2 w-8 h-8 my-auto flex items-center justify-center text-white/70 hover:text-white"
                  onClick={() => setSearchQuery("")}
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              <button 
                onClick={() => setActiveFilter("all")}
                className={`whitespace-nowrap px-4 py-2 rounded-lg text-[13px] font-bold transition-all border ${activeFilter === 'all' ? 'bg-white text-primary border-white shadow-md' : 'bg-white/10 text-white border-white/20 hover:bg-white/20'}`}
              >
                Todas ({activeDataList.length})
              </button>
              <button 
                onClick={() => setActiveFilter("Air Panama")}
                className={`whitespace-nowrap px-4 py-2 rounded-lg text-[13px] font-bold transition-all border ${activeFilter === 'Air Panama' ? 'bg-red-600 text-white border-red-500 shadow-md' : 'bg-white/10 text-white border-white/20 hover:bg-white/20'}`}
              >
                Air Panama
              </button>
              <button 
                onClick={() => setActiveFilter("Copa Airlines")}
                className={`whitespace-nowrap px-4 py-2 rounded-lg text-[13px] font-bold transition-all border ${activeFilter === 'Copa Airlines' ? 'bg-[#0032A0] text-white border-[#0032A0] shadow-md' : 'bg-white/10 text-white border-white/20 hover:bg-white/20'}`}
              >
                Copa Airlines
              </button>
            </div>
          </div>
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
      {/* Airtable Grid */}
      <section className="px-4 flex flex-col gap-2 flex-1 pb-6 mt-4">


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
                    const isLlegada = !!flight.hora_real_llegada;

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
                          <div className="flex flex-col gap-2 w-[160px]">
                            {/* Línea de Salida */}
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Salida</span>
                              <div className="flex items-center justify-between text-[13px]">
                                <span className="text-slate-400 font-medium line-through decoration-slate-300" title="Salida Itinerario">
                                  {formatTime(flight.hora_itinerario_salida)}
                                </span>
                                <span className="material-symbols-outlined text-[14px] text-slate-300 mx-1">arrow_right_alt</span>
                                <span className="font-bold text-slate-800" title="Salida Real">
                                  {formatTime(!isLlegada ? flight.hora_real_salida : flight.hora_itinerario_salida)}
                                </span>
                              </div>
                            </div>
                            
                            {/* Línea de Llegada */}
                            <div className="flex flex-col gap-0.5 border-t border-slate-100 pt-1">
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Llegada</span>
                              <div className="flex items-center justify-between text-[13px]">
                                <span className="text-slate-400 font-medium line-through decoration-slate-300" title="Llegada Itinerario">
                                  {formatTime(flight.hora_itinerario_llegada)}
                                </span>
                                <span className="material-symbols-outlined text-[14px] text-slate-300 mx-1">arrow_right_alt</span>
                                <span className="font-bold text-slate-800" title="Llegada Real">
                                  {formatTime(isLlegada ? flight.hora_real_llegada : flight.hora_itinerario_llegada)}
                                </span>
                              </div>
                            </div>
                            
                            <div className="mt-1">
                            {(() => {
                              const realStr = isLlegada ? flight.hora_real_llegada : flight.hora_real_salida;
                              const itinStr = isLlegada ? flight.hora_itinerario_llegada : flight.hora_itinerario_salida;
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
                            {flight.estado_final === 'LLEGÓ' ? 'ARRIBÓ' : flight.estado_final}
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
                              onClick={() => handleDeleteClick(flight)}
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

            <form className="flex flex-col flex-1 overflow-hidden" onSubmit={handleSaveEdit}>
              <div className="p-6 overflow-y-auto flex flex-col gap-5">
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
                    <label className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Avión</label>
                    <select 
                      className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      required value={editFormData.avion}
                      onChange={(e) => {
                        const avionStr = e.target.value;
                        const defaultCap = AIRCRAFT_MODELS.find(m => m.id === avionStr)?.cap || 100;
                        setEditFormData({...editFormData, avion: avionStr, capacidad_total: defaultCap});
                      }}
                    >
                      {AIRCRAFT_MODELS.map(model => (
                        <option key={model.id} value={model.id}>{model.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Número de Vuelo</label>
                    <input list="edit-flight-numbers"
                      className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      type="text" required value={editFormData.numero_vuelo}
                      onChange={(e) => setEditFormData({...editFormData, numero_vuelo: e.target.value})}
                    />
                    <datalist id="edit-flight-numbers">
                      {COMMON_FLIGHTS.map(f => <option key={f} value={f} />)}
                    </datalist>
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">{!!editingFlight.hora_real_llegada ? 'Origen' : 'Destino'}</label>
                    <select 
                      className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      required 
                      value={!!editingFlight.hora_real_llegada ? editFormData.origen : editFormData.destino}
                      onChange={(e) => !!editingFlight.hora_real_llegada 
                        ? setEditFormData({...editFormData, origen: e.target.value}) 
                        : setEditFormData({...editFormData, destino: e.target.value})}
                    >
                      <option value="">Seleccione...</option>
                      {AIRPORTS.map(apt => (
                        <option key={apt.code} value={apt.code}>{apt.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Hora Itin. Salida</label>
                    <input 
                      className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      type="time" value={editFormData.hora_itinerario_salida}
                      onChange={(e) => setEditFormData({...editFormData, hora_itinerario_salida: e.target.value})}
                    />
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Hora Real Salida</label>
                    <input 
                      className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      type="time" value={editFormData.hora_real_salida}
                      onChange={(e) => setEditFormData({...editFormData, hora_real_salida: e.target.value})}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Hora Itin. Llegada</label>
                    <input 
                      className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      type="time" value={editFormData.hora_itinerario_llegada}
                      onChange={(e) => setEditFormData({...editFormData, hora_itinerario_llegada: e.target.value})}
                    />
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Hora Real Llegada</label>
                    <input 
                      className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      type="time" value={editFormData.hora_real_llegada}
                      onChange={(e) => setEditFormData({...editFormData, hora_real_llegada: e.target.value})}
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
                    <option value="LLEGÓ">Arribo</option>
                    <option value="CUMPLIDO">Cumplido</option>
                    <option value="DEMORADO">Demorado</option>
                    <option value="DESVIADO">Desviado</option>
                  </select>
                </div>

              </div>
              <div className="p-6 border-t border-slate-100 bg-white shrink-0">
                <div className="flex items-center gap-3">
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
              </div>
            </form>
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
            
            <form onSubmit={handleAddFlightSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 overflow-y-auto flex flex-col gap-5">
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
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Avión</label>
                    <select className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      value={addFormData.avion} 
                      onChange={(e) => {
                        const avionStr = e.target.value;
                        const defaultCap = AIRCRAFT_MODELS.find(m => m.id === avionStr)?.cap || 100;
                        setAddFormData({...addFormData, avion: avionStr, capacidad_total: defaultCap});
                      }} required>
                      {AIRCRAFT_MODELS.map(model => (
                        <option key={model.id} value={model.id}>{model.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Número de Vuelo</label>
                    <input list="add-flight-numbers" type="text" placeholder="Ej: 7P-972" className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      value={addFormData.numero_vuelo} onChange={(e) => setAddFormData({...addFormData, numero_vuelo: e.target.value})} required />
                    <datalist id="add-flight-numbers">
                      {COMMON_FLIGHTS.map(f => <option key={f} value={f} />)}
                    </datalist>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">{addFormData.type === 'llegadas' ? 'Origen' : 'Destino'}</label>
                    <select className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      value={addFormData.type === 'llegadas' ? addFormData.origen : addFormData.destino} 
                      onChange={(e) => addFormData.type === 'llegadas' ? setAddFormData({...addFormData, origen: e.target.value}) : setAddFormData({...addFormData, destino: e.target.value})} required>
                      <option value="">Seleccione...</option>
                      {AIRPORTS.map(apt => (
                        <option key={apt.code} value={apt.code}>{apt.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Estado Final</label>
                    <select className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      value={addFormData.estado_final} onChange={(e) => setAddFormData({...addFormData, estado_final: e.target.value})} required>
                      <option value="LLEGÓ">Arribo</option>
                      <option value="CUMPLIDO">Cumplido</option>
                      <option value="DEMORADO">Demorado</option>
                      <option value="DESVIADO">Desviado</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
                      Hora Itin. Salida (HH:MM)
                    </label>
                    <input type="time" className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      value={addFormData.hora_itinerario_salida} onChange={(e) => setAddFormData({...addFormData, hora_itinerario_salida: e.target.value})} />
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
                      Hora Real Salida (HH:MM)
                    </label>
                    <input type="time" className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      value={addFormData.hora_real_salida} onChange={(e) => setAddFormData({...addFormData, hora_real_salida: e.target.value})} />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
                      Hora Itin. Llegada (HH:MM)
                    </label>
                    <input type="time" className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      value={addFormData.hora_itinerario_llegada} onChange={(e) => setAddFormData({...addFormData, hora_itinerario_llegada: e.target.value})} />
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
                      Hora Real Llegada (HH:MM)
                    </label>
                    <input type="time" className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      value={addFormData.hora_real_llegada} onChange={(e) => setAddFormData({...addFormData, hora_real_llegada: e.target.value})} />
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

              </div>
              <div className="p-6 border-t border-slate-100 bg-white shrink-0">
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 h-11 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-colors">
                    Cancelar
                  </button>
                  <button type="submit" className="flex-1 h-11 rounded-xl bg-primary text-white font-bold shadow-md hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">save</span>
                    Guardar
                  </button>
                </div>
              </div>
            </form>
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
      {/* MODAL: Confirmar Eliminación */}
      {isDeleteModalOpen && flightToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface max-w-sm w-full rounded-3xl p-6 shadow-2xl animate-fade-in-up border border-outline-variant/30">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-2xl">warning</span>
            </div>
            <h3 className="text-xl font-medium text-center mb-2">¿Eliminar Vuelo?</h3>
            <p className="text-on-surface-variant text-center mb-6">
              ¿Estás seguro de que deseas eliminar el vuelo <strong>{flightToDelete.numero_vuelo}</strong>? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => { setIsDeleteModalOpen(false); setFlightToDelete(null); }}
                className="flex-1 px-4 py-2 rounded-full font-medium hover:bg-surface-variant transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={executeDelete}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-full font-medium hover:bg-red-700 shadow-sm shadow-red-900/20"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Flight Audit Modal */}
      {isAuditModalOpen && (
        <FlightAuditBoard 
          initialDate={currentDateStr} 
          onClose={() => { 
            setIsAuditModalOpen(false); 
            loadPendingAudit(); 
            // Reload historical data so changes are visible instantly
            window.location.reload(); 
          }} 
        />
      )}

      {/* Pending Approval Modal */}
      {isPendingModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface w-full max-w-4xl rounded-[2rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-outline-variant/30">
            <div className="p-6 border-b border-outline-variant/50 flex items-center justify-between bg-surface-container-lowest">
              <div>
                <h3 className="text-xl font-medium flex items-center gap-2 text-red-600">
                  <span className="material-symbols-outlined">notification_important</span>
                  Vuelos Pendientes de Aprobación
                </h3>
                <p className="text-sm text-on-surface-variant mt-1">Revisa y edita los vuelos detectados automáticamente antes de guardarlos en el histórico.</p>
              </div>
              <button 
                onClick={() => setIsPendingModalOpen(false)}
                className="p-2 rounded-full hover:bg-surface-variant transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
              {[...llegadasPendientes.map(f => ({...f, type: 'llegadas'})), ...salidasPendientes.map(f => ({...f, type: 'salidas'}))].map(flight => (
                <PendingFlightCard key={flight.id} flight={flight as any} onApprove={handleApprovePending} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal para Seleccionar Pestaña de Excel */}
      {isSheetModalOpen && importWorkbook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden transform transition-all">
            <div className="p-6 border-b border-surface-variant/30 flex items-center gap-3">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <span className="material-symbols-outlined text-[24px]">dataset</span>
              </div>
              <h3 className="text-xl font-title-lg font-bold text-on-surface">Seleccionar Pestaña</h3>
            </div>
            
            <div className="p-6">
              <p className="text-sm font-body-sm text-on-surface-variant mb-4">
                El archivo de Excel contiene múltiples pestañas. ¿Cuál de estas deseas importar a la base de datos?
              </p>
              
              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {importWorkbook.SheetNames.map(sheet => (
                  <button
                    key={sheet}
                    onClick={() => processExcelSheet(importWorkbook, sheet)}
                    className="flex items-center justify-between p-3 rounded-2xl border border-surface-variant/50 hover:border-blue-500 hover:bg-blue-50 text-left transition-all group"
                  >
                    <span className="font-label-lg font-semibold text-on-surface group-hover:text-blue-700">{sheet}</span>
                    <span className="material-symbols-outlined text-on-surface-variant group-hover:text-blue-500 transition-transform group-hover:translate-x-1">chevron_right</span>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex bg-surface-container-low border-t border-black/5 p-4 gap-3">
              <button 
                onClick={() => {
                  setIsSheetModalOpen(false);
                  setImportWorkbook(null);
                }}
                className="flex-1 px-4 py-2 rounded-xl font-label-md text-label-md font-semibold bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN CUBE LOADER DURANTE LA IMPORTACIÓN */}
      {importing && (
        <div className="fixed inset-0 z-[10000] bg-[#0A192F]/80 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-200">
          <div className="spinner mb-8">
            <div></div><div></div><div></div><div></div><div></div><div></div>
          </div>
          <h2 className="text-white font-headline-md font-bold tracking-widest uppercase flex items-center gap-2">
            <span className="material-symbols-outlined text-[24px] text-red-600">flight_takeoff</span>
            Air Panama
          </h2>
          <p className="text-white/60 font-body-sm mt-2 animate-pulse">Su solicitud está en proceso...</p>
        </div>
      )}

      {/* MODAL DE RESULTADO DE IMPORTACIÓN */}
      {importResult.show && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden transform transition-all animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center flex flex-col items-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${importResult.type === 'success' ? 'bg-green-100' : 'bg-red-100'}`}>
                <span className={`material-symbols-outlined text-4xl ${importResult.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                  {importResult.type === 'success' ? 'check_circle' : 'error'}
                </span>
              </div>
              <h3 className="text-xl font-title-lg font-bold text-on-surface mb-2">
                {importResult.type === 'success' ? '¡Importación Exitosa!' : 'Atención'}
              </h3>
              <p className="text-sm font-body-sm text-on-surface-variant">
                {importResult.message}
              </p>
            </div>
            
            <div className="flex bg-surface-container-low border-t border-black/5 p-4 gap-3">
              <button 
                onClick={() => {
                  setImportResult({ show: false, type: 'success', message: '' });
                  if (importResult.type === 'success') {
                    window.location.reload();
                  }
                }}
                className="flex-1 px-4 py-2 rounded-xl font-label-md text-label-md font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function PendingFlightCard({ flight, onApprove }: { flight: MalekFlight & { type: 'llegadas'|'salidas' }, onApprove: (id: string, type: string, pax: number, time: string, status: string) => Promise<void> }) {
  const [pax, setPax] = useState(flight.pasajeros_abordo || 0);
  const timeVal = flight.hora_real_llegada ? flight.hora_real_llegada : flight.hora_real_salida;
  const [time, setTime] = useState(timeVal ? new Date(timeVal).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', timeZone: 'America/Panama' }) : '00:00');
  const [status, setStatus] = useState(flight.type === 'llegadas' ? 'LLEGÓ' : 'DESPEGÓ');
  const [saving, setSaving] = useState(false);

  return (
    <div className="bg-surface-container-low rounded-2xl p-5 border border-outline-variant/40 flex flex-col md:flex-row md:items-center gap-6 justify-between">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <span className={`px-2 py-0.5 rounded text-xs font-bold ${flight.aerolinea === 'Copa Airlines' ? 'bg-[#0032A0] text-white' : 'bg-red-600 text-white'}`}>{flight.aerolinea}</span>
          <span className="font-semibold">{flight.numero_vuelo}</span>
          <span className="text-sm text-on-surface-variant font-mono">{flight.fecha}</span>
        </div>
        <p className="text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">{flight.type === 'llegadas' ? 'flight_land' : 'flight_takeoff'}</span>
          {flight.origen} <span className="material-symbols-outlined text-[16px] text-on-surface-variant">arrow_forward</span> {flight.destino || 'DAV'}
        </p>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-on-surface-variant font-medium">Hora Real {flight.type === 'llegadas' ? 'Llegada' : 'Salida'}</label>
          <input type="time" value={time} onChange={e => setTime(e.target.value)} className="bg-surface px-3 py-1.5 rounded-lg border border-outline-variant focus:border-primary outline-none" />
        </div>
        <div className="flex flex-col gap-1 w-24">
          <label className="text-xs text-on-surface-variant font-medium">Pasajeros</label>
          <input type="number" min={0} value={pax} onChange={e => setPax(parseInt(e.target.value) || 0)} className="bg-surface px-3 py-1.5 rounded-lg border border-outline-variant focus:border-primary outline-none" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-on-surface-variant font-medium">Estado</label>
          <select value={status} onChange={e => setStatus(e.target.value)} className="bg-surface px-3 py-1.5 rounded-lg border border-outline-variant focus:border-primary outline-none">
            <option value={flight.type === 'llegadas' ? 'LLEGÓ' : 'DESPEGÓ'}>{flight.type === 'llegadas' ? 'LLEGÓ' : 'DESPEGÓ'}</option>
            <option value="CANCELADO">CANCELADO</option>
            <option value="DIVERTIDO">DIVERTIDO</option>
          </select>
        </div>
        <button 
          onClick={async () => {
            setSaving(true);
            await onApprove(flight.id, flight.type, pax, time, status);
            setSaving(false);
          }}
          disabled={saving}
          className="ml-auto bg-primary text-on-primary hover:bg-primary/90 px-4 py-2 rounded-xl font-medium shadow-sm flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : <span className="material-symbols-outlined">check_circle</span>}
          Aprobar
        </button>
      </div>
    </div>
  );
}
