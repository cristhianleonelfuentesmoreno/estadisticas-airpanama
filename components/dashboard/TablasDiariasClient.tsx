"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateLlegadaMalek, updateSalidaMalek, deleteLlegadaMalek, deleteSalidaMalek, insertFlightRecords, getImportKnowledge, importHistoricoRows, type FlightRecordInput, type HistoricoUpdates } from "@/app/actions/flights";
import { requestFlightDeletion } from "@/app/actions/deletionRequests";
import { can, type Role } from "@/lib/permissions";
import { parseRegistroMensual, type ImportResult, type SheetInput, type Cell } from "@/lib/import/registroMensual";
import * as XLSX from 'xlsx';
import { FlightAuditBoard, fetchPendingAudit } from "./FlightAuditBoard";
import { ExcelImportPreviewModal } from "./ExcelImportPreviewModal";
import { UploadGlyph, UploadProgress, type UploadJob } from "@/components/ui/UploadProgress";
import { DailyFlightCard, MalekFlight, formatTime, getAirlineBadge } from "./DailyFlightCard";


// Valor de una celda leída con sheet_to_json({ raw: true })

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
  currentDateStr,
  role = 'usuario',
  openPendientes = false
}: {
  initialData: { llegadas: MalekFlight[], salidas: MalekFlight[] };
  currentDateStr: string;
  role?: Role;
  openPendientes?: boolean; // llegó desde "Revisar en Pendientes" del itinerario
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
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(openPendientes);
  const [pendingAuditCount, setPendingAuditCount] = useState(0);

  // Derivados de initialData para separar PENDIENTES
  const llegadasPendientes = useMemo(() => initialData.llegadas.filter(f => f.estado_final === 'PENDIENTE'), [initialData.llegadas]);
  const llegadasAprobadas = useMemo(() => initialData.llegadas.filter(f => f.estado_final !== 'PENDIENTE'), [initialData.llegadas]);

  const salidasPendientes = useMemo(() => initialData.salidas.filter(f => f.estado_final === 'PENDIENTE'), [initialData.salidas]);
  const salidasAprobadas = useMemo(() => initialData.salidas.filter(f => f.estado_final !== 'PENDIENTE'), [initialData.salidas]);

  const activeDataList = useMemo(() => {
    let combined = [];
    if (viewType === 'llegadas') {
      combined = [...llegadasAprobadas];
    } else if (viewType === 'salidas') {
      combined = [...salidasAprobadas];
    } else {
      combined = [...llegadasAprobadas, ...salidasAprobadas];
    }
    
    return combined.sort((a, b) => {
      const timeA = new Date(a.actualizado_en || a.creado_en || a.hora_real_llegada || a.hora_real_salida || 0).getTime();
      const timeB = new Date(b.actualizado_en || b.creado_en || b.hora_real_llegada || b.hora_real_salida || 0).getTime();
      return timeB - timeA;
    });
  }, [llegadasAprobadas, salidasAprobadas, viewType]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  // Progreso de la subida al guardar una importación
  const [uploadJob, setUploadJob] = useState<UploadJob | null>(null);
  const uploadSeq = useRef(0);
  const importFileRef = useRef<{ name: string; size: number } | null>(null);
  const afterUploadRef = useRef<(() => void) | null>(null);
  const [importWorkbook, setImportWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [isSheetModalOpen, setIsSheetModalOpen] = useState(false);
  const [selectedSheets, setSelectedSheets] = useState<string[]>([]);
  
  // Preview State
  const [previewData, setPreviewData] = useState<ImportResult | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const loadPendingAudit = async () => {
    try {
      setPendingAuditCount((await fetchPendingAudit('TODOS')).length);
    } catch (err) {
      console.error("Error loading pending audit", err);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetchPendingAudit('TODOS')
      .then(list => { if (!cancelled) setPendingAuditCount(list.length); })
      .catch(err => console.error("Error loading pending audit", err));
    return () => { cancelled = true; };
  }, [currentDateStr]);

  const [importResult, setImportResult] = useState<{show: boolean, type: 'success' | 'error', message: string}>({show: false, type: 'success', message: ''});
  const [flightToDelete, setFlightToDelete] = useState<MalekFlight | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  // Supervisores eliminan directo; los usuarios envían una solicitud
  const canDelete = can.deleteFlights(role);
  
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
      const location = flight.origen || flight.destino;
      const matchSearch = 
        flight.numero_vuelo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (location && location.toLowerCase().includes(searchQuery.toLowerCase())) ||
        flight.aerolinea.toLowerCase().includes(searchQuery.toLowerCase());

      const matchFilter = activeFilter === "all" || flight.aerolinea === activeFilter;

      return matchSearch && matchFilter;
    });
  }, [activeDataList, searchQuery, activeFilter]);


  const sortedData = useMemo(() => {
    const sorted = [...filteredData];
    if (sortColumn === 'ruta') {
      sorted.sort((a, b) => {
        const routeA = a.origen ? `${a.origen}-DAV` : `DAV-${a.destino}`;
        const routeB = b.origen ? `${b.origen}-DAV` : `DAV-${b.destino}`;
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


  const toTimeStringForInput = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', timeZone: 'America/Panama' });
    } catch {
      return '00:00';
    }
  };

  const openEditDrawer = (flight: MalekFlight) => {
    setEditingFlight(flight);
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
    
    const isLlegada = !!editingFlight.origen;
    
    // Hora vacía = sin hora (vuelos importados del Excel): se guarda como null, no como 00:00
    const toIso = (time?: string) => (time ? new Date(`${editFormData.fecha}T${time}:00-05:00`).toISOString() : null);
    const itinSalida = toIso(editFormData.hora_itinerario_salida);
    const realSalida = toIso(editFormData.hora_real_salida || editFormData.hora_itinerario_salida);
    const itinLlegada = toIso(editFormData.hora_itinerario_llegada);
    const realLlegada = toIso(editFormData.hora_real_llegada || editFormData.hora_itinerario_llegada);

    const updates: HistoricoUpdates = {
      fecha: editFormData.fecha,
      aerolinea: editFormData.aerolinea,
      numero_vuelo: editFormData.numero_vuelo,
      pasajeros_abordo: Number(editFormData.pasajeros_abordo),
      capacidad_total: Number(editFormData.capacidad_total),
      estado_final: editFormData.estado_final,
    };
    
    if (isLlegada) {
      updates.origen = editFormData.origen;
      updates.hora_itinerario = itinLlegada;
      updates.hora_itinerario_llegada = itinLlegada;
      updates.hora_real_llegada = realLlegada;
    } else {
      updates.destino = editFormData.destino;
      updates.hora_itinerario = itinSalida;
      updates.hora_itinerario_salida = itinSalida;
      updates.hora_real_salida = realSalida;
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
    setDeleteReason('');
    setIsDeleteModalOpen(true);
  };

  const executeDelete = async () => {
    if (!flightToDelete || deleteReason.trim().length < 3) return;
    setDeleteBusy(true);

    try {
      const isLlegada = !!flightToDelete.origen;
      const motivo = deleteReason.trim();
      const res = canDelete
        ? await (isLlegada ? deleteLlegadaMalek(flightToDelete.id, motivo) : deleteSalidaMalek(flightToDelete.id, motivo))
        : await requestFlightDeletion(isLlegada ? 'llegada' : 'salida', flightToDelete.id, motivo);

      if (res.success) {
        setIsDeleteModalOpen(false);
        if (canDelete) window.location.reload();
        else {
          setImportResult({ show: true, type: 'success', message: `Solicitud enviada. Un supervisor revisará la eliminación del vuelo ${flightToDelete.numero_vuelo}; mientras tanto no cuenta en los reportes.` });
        }
      } else {
        alert((canDelete ? "Error al eliminar: " : "No se pudo enviar la solicitud: ") + res.error);
      }
    } catch (err) {
      alert("Error inesperado: " + (err as Error).message);
    } finally {
      setDeleteBusy(false);
      setFlightToDelete(null);
    }
  };
  const handleAddFlightSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isLlegada = addFormData.type === 'llegadas';
    
    // Create correct Date objects (Using real time for both real and itin)
    const realSalida = new Date(`${addFormData.fecha}T${addFormData.hora_real_salida || '00:00'}:00-05:00`);
    const itinSalida = realSalida;
    const realLlegada = new Date(`${addFormData.fecha}T${addFormData.hora_real_llegada || '00:00'}:00-05:00`);
    const itinLlegada = realLlegada;
    
    const record: FlightRecordInput = {
      fecha: addFormData.fecha,
      aerolinea: addFormData.aerolinea,
      numero_vuelo: addFormData.numero_vuelo,
      estado_final: addFormData.estado_final,
      pasajeros_abordo: Number(addFormData.pasajeros_abordo),
      capacidad_total: Number(addFormData.capacidad_total),
      hora_itinerario_salida: itinSalida.toISOString(),
      hora_real_salida: realSalida.toISOString(),
      hora_itinerario_llegada: itinLlegada.toISOString(),
      hora_real_llegada: realLlegada.toISOString(),
      hora_itinerario: (isLlegada ? itinLlegada : itinSalida).toISOString(),
    };

    if (isLlegada) {
      record.origen = addFormData.origen;
      record.hora_real_llegada = realLlegada.toISOString();
    } else {
      record.destino = addFormData.destino;
      record.hora_real_salida = realSalida.toISOString();
    }

    const res = await insertFlightRecords([record], addFormData.type);
    if (res.success) {
      window.location.reload();
    } else {
      alert("Error al guardar: " + res.error);
    }
  };

  // Filas de una pestaña, recortadas al bloque con datos y alineadas con la numeración
  // de Excel (fila 1 = índice 0). Una celda suelta muy abajo (p. ej. un total en la fila
  // 1.048.576) no cuenta: el bloque termina al encontrar más de 500 filas vacías seguidas.
  const sheetRows = (ws: XLSX.WorkSheet): Cell[][] => {
    const usedRows = new Set<number>();
    let lastCol = 0;
    for (const addr of Object.keys(ws)) {
      if (addr[0] === '!') continue;
      const v = (ws[addr] as XLSX.CellObject).v;
      if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) continue;
      const { r, c } = XLSX.utils.decode_cell(addr);
      usedRows.add(r);
      if (c > lastCol) lastCol = c;
    }
    const sorted = [...usedRows].sort((a, b) => a - b);
    if (sorted.length === 0) return [];
    let lastRow = sorted[0];
    for (const r of sorted) {
      if (r - lastRow > 500) break;
      lastRow = r;
    }
    return XLSX.utils.sheet_to_json<Cell[]>(ws, {
      header: 1, raw: true, defval: null, blankrows: true,
      range: { s: { r: 0, c: 0 }, e: { r: lastRow, c: lastCol } },
    });
  };

  // Lee las pestañas elegidas y abre la vista previa (solo Air Panama y Copa; solo fechas)
  const processExcelSheets = async (wb: XLSX.WorkBook, sheetNames: string[]) => {
    setImporting(true);
    setIsSheetModalOpen(false);

    try {
      const sheets: SheetInput[] = sheetNames.map(name => ({ name, rows: sheetRows(wb.Sheets[name]) }));
      const result = parseRegistroMensual(sheets, await getImportKnowledge());

      if (result.rows.length > 0) {
        setPreviewData(result);
        setIsPreviewOpen(true);
      } else {
        setImportResult({ show: true, type: 'error', message: 'No se encontraron vuelos de Air Panama ni de Copa Airlines en las pestañas elegidas. Verifica que tengan las columnas Leg, Airline, Flight y Runway Time.' });
      }
    } catch (err) {
      console.error("Error importando Excel:", err);
      setImportResult({ show: true, type: 'error', message: "Error procesando archivo. Verifica el formato. Detalles: " + (err as Error).message });
    } finally {
      setImporting(false);
      setImportWorkbook(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    importFileRef.current = { name: file.name, size: file.size };
    
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        
        if (wb.SheetNames.length > 1) {
          // Varias pestañas (una por mes): el usuario elige cuáles; por defecto todas
          setImportWorkbook(wb);
          setSelectedSheets(wb.SheetNames);
          setIsSheetModalOpen(true);
          setImporting(false); // Pausamos el spinner de carga de importación global mientras selecciona
        } else {
          await processExcelSheets(wb, wb.SheetNames);
        }
      } catch (err) {
        console.error("Error leyendo Excel:", err);
        alert("Error procesando archivo. Detalles: " + (err as Error).message);
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

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-20">
          <div className="flex items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                <span className="font-label-sm text-[12px] uppercase tracking-wider text-emerald-300 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">EN LINEA</span>
              </div>
              <h1 className="font-headline-md text-2xl md:text-3xl text-white font-black tracking-tight drop-shadow-sm">
                Registro Histórico
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto pb-1 shrink-0">
            {/* Botón dividido: "Importar" abre el Excel; la flecha ofrece también agregar un vuelo a mano */}
            <div className="relative flex-1 md:flex-none flex">
              <button
                onClick={() => { setIsAddMenuOpen(false); setIsImportModalOpen(true); }}
                className="upbtn flex-1 justify-center bg-emerald-500 hover:bg-emerald-400 pl-3.5 pr-3 py-2.5 rounded-l-xl flex items-center gap-1.5 shadow-md transition-colors cursor-pointer text-white font-bold tracking-wide border border-r-0 border-emerald-400/50"
              >
                <UploadGlyph />
                <span className="text-[12px] md:text-[13px]">Importar</span>
              </button>
              <button
                onClick={() => setIsAddMenuOpen(open => !open)}
                aria-label="Más opciones: importar Excel o agregar vuelo"
                aria-haspopup="menu"
                aria-expanded={isAddMenuOpen}
                className="bg-emerald-500 hover:bg-emerald-400 px-2 rounded-r-xl flex items-center shadow-md transition-colors cursor-pointer text-white border border-emerald-400/50 border-l-emerald-700/40"
              >
                <span className={`material-symbols-outlined text-[20px] transition-transform ${isAddMenuOpen ? 'rotate-180' : ''}`}>expand_more</span>
              </button>
              {isAddMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsAddMenuOpen(false)} aria-hidden="true" />
                  <div role="menu" className="absolute right-0 md:left-0 md:right-auto top-full mt-2 z-50 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 text-slate-700 animate-in fade-in zoom-in-95 duration-150">
                    <button
                      role="menuitem"
                      onClick={() => { setIsAddMenuOpen(false); setIsImportModalOpen(true); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold hover:bg-slate-50"
                    >
                      <span className="material-symbols-outlined text-[20px] text-emerald-600">upload_file</span>
                      Importar Excel
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => { setIsAddMenuOpen(false); setIsAddModalOpen(true); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold hover:bg-slate-50"
                    >
                      <span className="material-symbols-outlined text-[20px] text-emerald-600">add_circle</span>
                      Agregar vuelo
                    </button>
                  </div>
                </>
              )}
            </div>
{(
            <button
              onClick={() => setIsAuditModalOpen(true)}
              className={`flex-1 md:flex-none justify-center px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm border transition-colors cursor-pointer text-white font-bold tracking-wide ${pendingAuditCount > 0 ? 'bg-amber-500 hover:bg-amber-400 border-amber-400/50 animate-[pulse_2s_infinite] shadow-amber-900/30' : 'bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/20'}`}
            >
              <span className="material-symbols-outlined text-[18px]">{pendingAuditCount > 0 ? 'notification_important' : 'fact_check'}</span>
              <span className="text-[12px] md:text-[13px]">Pendientes {pendingAuditCount > 0 && `(${pendingAuditCount})`}</span>
            </button>
            )}
          </div>
        </div>

        {/* ============================================== */}
        {/* FILTROS REDISEÑADOS                            */}
        {/* ============================================== */}
        <div className="flex flex-col gap-3 mt-4 w-full relative z-10">
          
          <div className="flex flex-col md:flex-row gap-3">
            {/* Fila 1: Toggle Todos/Llegadas/Salidas */}
            <div className="flex items-center gap-1 bg-white/5 backdrop-blur-md p-1.5 rounded-xl border border-white/10 shadow-inner w-full md:w-fit">
              <button 
                onClick={() => setViewType('todos')}
                className={`flex-1 md:flex-none flex flex-col md:flex-row items-center justify-center gap-1 md:gap-1.5 px-2 md:px-4 py-1.5 md:py-2 rounded-lg text-[12px] md:text-sm font-bold transition-all leading-tight ${viewType === 'todos' ? 'bg-white text-primary shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
              >
                <span className="material-symbols-outlined text-[18px] md:text-[16px]">swap_vert</span>
                <span className="whitespace-nowrap">Todos ({llegadasAprobadas.length + salidasAprobadas.length})</span>
              </button>
              <button 
                onClick={() => setViewType('llegadas')}
                className={`flex-1 md:flex-none flex flex-col md:flex-row items-center justify-center gap-1 md:gap-1.5 px-2 md:px-4 py-1.5 md:py-2 rounded-lg text-[12px] md:text-sm font-bold transition-all leading-tight ${viewType === 'llegadas' ? 'bg-white text-primary shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
              >
                <span className="material-symbols-outlined text-[18px] md:text-[16px]">flight_land</span>
                <span className="whitespace-nowrap">Llegadas ({llegadasAprobadas.length})</span>
              </button>
              <button 
                onClick={() => setViewType('salidas')}
                className={`flex-1 md:flex-none flex flex-col md:flex-row items-center justify-center gap-1 md:gap-1.5 px-2 md:px-4 py-1.5 md:py-2 rounded-lg text-[12px] md:text-sm font-bold transition-all leading-tight ${viewType === 'salidas' ? 'bg-white text-primary shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
              >
                <span className="material-symbols-outlined text-[18px] md:text-[16px]">flight_takeoff</span>
                <span className="whitespace-nowrap">Salidas ({salidasAprobadas.length})</span>
              </button>
            </div>
          </div>

          {/* Fila 2: Buscador */}
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-white/50">
              <span className="material-symbols-outlined text-[18px]">search</span>
            </div>
            <input 
              className="w-full h-11 pl-10 pr-10 bg-white/5 backdrop-blur-md text-white text-sm font-medium rounded-xl border border-white/10 placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:bg-white/10 transition-all shadow-inner"
              placeholder="Buscar por vuelo (ej: 7P-670), origen, destino IATA (PAC, DAV, BOC) o matrícula..." 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                className="absolute inset-y-0 right-2 w-8 h-8 my-auto flex items-center justify-center text-white/50 hover:text-white transition-colors"
                onClick={() => setSearchQuery("")}
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
          </div>

          {/* Fila 3: Operador + Date Picker */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 w-full">
            
            {/* Operador Filters */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full lg:w-auto">
              <span className="text-[12px] font-black text-white/50 uppercase tracking-widest mr-1">OPERADOR:</span>
              <button 
                onClick={() => setActiveFilter("all")}
                className={`whitespace-nowrap px-4 py-2 rounded-lg text-[13px] font-bold transition-all border ${activeFilter === 'all' ? 'bg-white text-primary border-white shadow-md' : 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10 hover:text-white'}`}
              >
                Todas ({activeDataList.length})
              </button>
              <button 
                onClick={() => setActiveFilter("Air Panama")}
                className={`whitespace-nowrap px-4 py-2 rounded-lg text-[13px] font-bold transition-all border ${activeFilter === 'Air Panama' ? 'bg-red-600 text-white border-red-500 shadow-md' : 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10 hover:text-white'}`}
              >
                Air Panama
              </button>
              <button 
                onClick={() => setActiveFilter("Copa Airlines")}
                className={`whitespace-nowrap px-4 py-2 rounded-lg text-[13px] font-bold transition-all border ${activeFilter === 'Copa Airlines' ? 'bg-[#0032A0] text-white border-[#0032A0] shadow-md' : 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10 hover:text-white'}`}
              >
                Copa Airlines
              </button>
            </div>

            {/* Fecha y Controles a la derecha */}
            <div className="flex items-center justify-between md:justify-end gap-2 w-full md:w-auto shrink-0 mt-1 md:mt-0">
              <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10 shadow-sm backdrop-blur-md w-full md:w-auto justify-between md:justify-start">
                <button onClick={handlePrevDay} className="w-9 h-9 rounded-lg text-white/70 hover:bg-white/10 hover:text-white flex items-center justify-center transition-colors">
                  <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                </button>
                
                <div 
                  className="flex flex-1 md:flex-none justify-center items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 text-white relative cursor-pointer hover:bg-white/20 transition-colors border border-transparent shadow-inner"
                  onClick={() => dateInputRef.current?.showPicker && dateInputRef.current.showPicker()}
                >
                  <input 
                    type="date"
                    ref={dateInputRef}
                    value={currentDateStr}
                    onChange={handleDateChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <span className="material-symbols-outlined text-[16px] text-emerald-400">calendar_month</span>
                  <span className="text-[13px] font-black uppercase tracking-wide pointer-events-none mt-0.5">
                    {new Date(currentDateStr + "T12:00:00").toLocaleDateString('es-PA', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleToday(); }} 
                    className={`text-[11px] px-1.5 py-0.5 rounded font-black uppercase ml-1 transition-all z-10 relative ${isToday ? 'bg-white text-primary' : 'bg-white/20 hover:bg-white/30 text-white'}`}
                  >
                    HOY
                  </button>
                </div>

                <button onClick={handleNextDay} className="w-9 h-9 rounded-lg text-white/70 hover:bg-white/10 hover:text-white flex items-center justify-center transition-colors">
                  <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                </button>
              </div>

            </div>
          </div>
        </div>
      </section>
      {/* Airtable Grid */}
      <section className="px-4 flex flex-col gap-2 flex-1 pb-6 mt-4">


        {/* Celular: tarjetas apiladas */}
        <div className="md:hidden flex flex-col gap-2">
          {sortedData.length > 0 ? (
            sortedData.map((flight) => (
              <DailyFlightCard
                key={flight.id}
                flight={flight}
                showType={viewType === 'todos'}
                onEdit={() => openEditDrawer(flight)}
                onDelete={flight.eliminacion_solicitada && !canDelete ? undefined : () => handleDeleteClick(flight)}
              />
            ))
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 py-12 text-center text-slate-500 text-sm">
              <span className="material-symbols-outlined text-4xl text-slate-300 block mb-2">flight_takeoff</span>
              No se encontraron vuelos para estos filtros.
            </div>
          )}
        </div>

        {/* Tablet y escritorio: tabla completa */}
        <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto no-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
            <table className="w-full text-left text-sm border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[12px] font-bold text-slate-500 uppercase tracking-wider">
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
                  <th className="px-4 py-3.5 min-w-[130px]">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px]">flight_takeoff</span>
                      <span>Salida (Itin ➔ Real)</span>
                    </div>
                  </th>
                  <th className="px-4 py-3.5 min-w-[130px]">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px]">flight_land</span>
                      <span>Llegada (Itin ➔ Real)</span>
                    </div>
                  </th>
                  <th className="px-4 py-3.5 min-w-[120px]">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px]">group</span>
                      <span>Ocupación</span>
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
                    const isLlegada = !!flight.origen;

                    return (
                      <tr key={flight.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 px-4 py-3 shadow-[2px_0_5px_rgba(0,0,0,0.02)] border-r border-slate-100">
                          <div className="flex items-center gap-3">
                            <span className={`w-9 h-9 rounded-lg ${getAirlineBadge(flight.aerolinea)} flex items-center justify-center font-bold text-[14px] shrink-0 uppercase`}>
                              {flight.numero_vuelo.split('-')[0]}
                            </span>
                            <div>
                              <span className="font-bold text-primary block leading-tight text-[14px]">{flight.numero_vuelo}</span>
                              {flight.eliminacion_solicitada && (
                                <span className="inline-flex items-center gap-0.5 mt-0.5 px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold" title="Hay una solicitud de eliminación pendiente de un supervisor">
                                  <span className="material-symbols-outlined text-[12px]">hourglass_top</span> Eliminación solicitada
                                </span>
                              )}
                              <span className="text-[12px] text-slate-500 block truncate w-24">
                                {flight.aerolinea} {viewType === 'todos' && <span className="font-bold text-[11px] uppercase ml-1 opacity-60">({isLlegada ? 'Llegada' : 'Salida'})</span>}
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
                        <td className="px-4 py-3 align-middle">
                          <div className="flex flex-col gap-1.5 w-[130px]">
                            <div className="flex items-center justify-between text-[13px]">
                              <span className="text-slate-400 font-medium line-through decoration-slate-300" title="Salida Itinerario">
                                {formatTime(flight.hora_itinerario_salida)}
                              </span>
                              <span className="material-symbols-outlined text-[14px] text-slate-300 mx-1">arrow_right_alt</span>
                              <span className="font-bold text-slate-800" title="Salida Real">
                                {formatTime(!isLlegada ? flight.hora_real_salida : flight.hora_itinerario_salida)}
                              </span>
                            </div>
                            
                            {(() => {
                              const rDate = new Date(flight.hora_real_salida || '');
                              const iDate = new Date(flight.hora_itinerario_salida || '');
                              let diffMins = 0;
                              if (!isNaN(rDate.getTime()) && !isNaN(iDate.getTime())) {
                                diffMins = Math.round((rDate.getTime() - iDate.getTime()) / 60000);
                              }
                              const isDelayed = diffMins > 10;
                              const pct = isDelayed ? Math.min((diffMins / 60) * 100, 100) : 0;
                              return (
                                <div>
                                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden flex">
                                    <div className={`h-full rounded-full transition-all ${isDelayed ? 'bg-rose-500' : 'bg-emerald-400'}`} style={{ width: `${isDelayed ? pct : 100}%` }}></div>
                                  </div>
                                  <div className="flex justify-end mt-0.5">
                                    <span className={`text-[11px] font-bold ${isDelayed ? 'text-rose-600' : 'text-emerald-600'}`}>
                                      {isDelayed ? `+${diffMins}m retraso` : 'A Tiempo'}
                                    </span>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </td>

                        <td className="px-4 py-3 align-middle">
                          <div className="flex flex-col gap-1.5 w-[130px]">
                            <div className="flex items-center justify-between text-[13px]">
                              <span className="text-slate-400 font-medium line-through decoration-slate-300" title="Llegada Itinerario">
                                {formatTime(flight.hora_itinerario_llegada)}
                              </span>
                              <span className="material-symbols-outlined text-[14px] text-slate-300 mx-1">arrow_right_alt</span>
                              <span className="font-bold text-slate-800" title="Llegada Real">
                                {formatTime(isLlegada ? flight.hora_real_llegada : flight.hora_itinerario_llegada)}
                              </span>
                            </div>

                            {(() => {
                              const rDate = new Date(flight.hora_real_llegada || '');
                              const iDate = new Date(flight.hora_itinerario_llegada || '');
                              let diffMins = 0;
                              if (!isNaN(rDate.getTime()) && !isNaN(iDate.getTime())) {
                                diffMins = Math.round((rDate.getTime() - iDate.getTime()) / 60000);
                              }
                              const isDelayed = diffMins > 10;
                              const pct = isDelayed ? Math.min((diffMins / 60) * 100, 100) : 0;
                              return (
                                <div>
                                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden flex">
                                    <div className={`h-full rounded-full transition-all ${isDelayed ? 'bg-rose-500' : 'bg-emerald-400'}`} style={{ width: `${isDelayed ? pct : 100}%` }}></div>
                                  </div>
                                  <div className="flex justify-end mt-0.5">
                                    <span className={`text-[11px] font-bold ${isDelayed ? 'text-rose-600' : 'text-emerald-600'}`}>
                                      {isDelayed ? `+${diffMins}m retraso` : 'A Tiempo'}
                                    </span>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 text-[12px] mb-1">
                            <span className="font-bold text-slate-700">{paxCount}/{paxMax}</span>
                            <span className="text-[11px] text-slate-400 font-semibold">({paxPct}%)</span>
                          </div>
                          <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${paxPct}%` }}></div>
                          </div>
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
                            {!(flight.eliminacion_solicitada && !canDelete) && (
                              <button 
                                onClick={() => handleDeleteClick(flight)}
                                className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-500 hover:text-white active:scale-95 transition-all shadow-sm"
                                title={canDelete ? "Eliminar vuelo" : "Solicitar eliminación a un supervisor"}
                              >
                                <span className="material-symbols-outlined text-[16px]">delete</span>
                              </button>
                            )}
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
            <span className="text-[12px] text-slate-500">Última actualización: Hoy</span>
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
                    <label className="text-[12px] text-slate-500 font-bold uppercase tracking-wider">Fecha</label>
                    <input 
                      className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      type="date" required value={editFormData.fecha}
                      onChange={(e) => setEditFormData({...editFormData, fecha: e.target.value})}
                    />
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[12px] text-slate-500 font-bold uppercase tracking-wider">Aerolínea</label>
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
                    <label className="text-[12px] text-slate-500 font-bold uppercase tracking-wider">Avión</label>
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
                    <label className="text-[12px] text-slate-500 font-bold uppercase tracking-wider">Número de Vuelo</label>
                    <input list="edit-flight-numbers"
                      className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      type="text" required value={editFormData.numero_vuelo}
                      onChange={(e) => setEditFormData({...editFormData, numero_vuelo: e.target.value})}
                    />
                    <datalist id="edit-flight-numbers">
                      {COMMON_FLIGHTS.map(f => <option key={f} value={f} />)}
                    </datalist>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] text-slate-500 font-bold uppercase tracking-wider">{!!editingFlight.origen ? 'Origen' : 'Destino'}</label>
                  <select 
                    className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none w-full" 
                    required 
                    value={!!editingFlight.origen ? editFormData.origen : editFormData.destino}
                    onChange={(e) => !!editingFlight.origen 
                      ? setEditFormData({...editFormData, origen: e.target.value}) 
                      : setEditFormData({...editFormData, destino: e.target.value})}
                  >
                    <option value="">Seleccione...</option>
                    {AIRPORTS.map(apt => (
                      <option key={apt.code} value={apt.code}>{apt.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[12px] text-slate-500 font-bold uppercase tracking-wider">Hora Itin. Salida</label>
                    <input 
                      className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      type="time" value={editFormData.hora_itinerario_salida}
                      onChange={(e) => setEditFormData({...editFormData, hora_itinerario_salida: e.target.value})}
                    />
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[12px] text-slate-500 font-bold uppercase tracking-wider">Hora Real Salida</label>
                    <input 
                      className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      type="time" value={editFormData.hora_real_salida}
                      onChange={(e) => setEditFormData({...editFormData, hora_real_salida: e.target.value})}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[12px] text-slate-500 font-bold uppercase tracking-wider">Hora Itin. Llegada</label>
                    <input 
                      className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      type="time" value={editFormData.hora_itinerario_llegada}
                      onChange={(e) => setEditFormData({...editFormData, hora_itinerario_llegada: e.target.value})}
                    />
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[12px] text-slate-500 font-bold uppercase tracking-wider">Hora Real Llegada</label>
                    <input 
                      className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      type="time" value={editFormData.hora_real_llegada}
                      onChange={(e) => setEditFormData({...editFormData, hora_real_llegada: e.target.value})}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[12px] text-slate-500 font-bold uppercase tracking-wider">Pasajeros</label>
                    <input 
                      className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      type="number" min="0" required value={editFormData.pasajeros_abordo}
                      onChange={(e) => setEditFormData({...editFormData, pasajeros_abordo: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[12px] text-slate-500 font-bold uppercase tracking-wider">Capacidad</label>
                    <input 
                      className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      type="number" min="0" required value={editFormData.capacidad_total}
                      onChange={(e) => setEditFormData({...editFormData, capacidad_total: parseInt(e.target.value) || 0})}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] text-slate-500 font-bold uppercase tracking-wider">Estado Final</label>
                  <select 
                    className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                    value={editFormData.estado_final}
                    onChange={(e) => setEditFormData({...editFormData, estado_final: e.target.value})}
                  >
                    <option value="LLEGÓ">Arribo</option>
                    <option value="CUMPLIDO">Cumplido</option>
                    <option value="DEMORADO">Demorado</option>
                    <option value="DESVIADO">Desviado</option>
                    <option value="CANCELADO">Cancelado</option>
                    <option value="PENDIENTE">Pendiente</option>
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
                    <label className="text-[12px] text-slate-500 font-bold uppercase tracking-wider">Tipo de Operación</label>
                    <select className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      value={addFormData.type} onChange={(e) => setAddFormData({...addFormData, type: e.target.value as 'llegadas' | 'salidas'})} required>
                      <option value="llegadas">Llegada</option>
                      <option value="salidas">Salida</option>
                    </select>
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[12px] text-slate-500 font-bold uppercase tracking-wider">Fecha (YYYY-MM-DD)</label>
                    <input type="date" className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      value={addFormData.fecha} onChange={(e) => setAddFormData({...addFormData, fecha: e.target.value})} required />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[12px] text-slate-500 font-bold uppercase tracking-wider">Aerolínea</label>
                    <select className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      value={addFormData.aerolinea} onChange={(e) => setAddFormData({...addFormData, aerolinea: e.target.value})} required>
                      <option value="Air Panama">Air Panama</option>
                      <option value="Copa Airlines">Copa Airlines</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[12px] text-slate-500 font-bold uppercase tracking-wider">Avión</label>
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
                    <label className="text-[12px] text-slate-500 font-bold uppercase tracking-wider">Número de Vuelo</label>
                    <input list="add-flight-numbers" type="text" placeholder="Ej: 7P-972" className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      value={addFormData.numero_vuelo} onChange={(e) => setAddFormData({...addFormData, numero_vuelo: e.target.value})} required />
                    <datalist id="add-flight-numbers">
                      {COMMON_FLIGHTS.map(f => <option key={f} value={f} />)}
                    </datalist>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[12px] text-slate-500 font-bold uppercase tracking-wider">{addFormData.type === 'llegadas' ? 'Origen' : 'Destino'}</label>
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
                    <label className="text-[12px] text-slate-500 font-bold uppercase tracking-wider">Estado Final</label>
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
                  <div className="flex-1 flex flex-col gap-1.5 hidden">
                    <label className="text-[12px] text-slate-500 font-bold uppercase tracking-wider">
                      Hora Itin. Salida (HH:MM)
                    </label>
                    <input type="time" className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      value={addFormData.hora_itinerario_salida} onChange={(e) => setAddFormData({...addFormData, hora_itinerario_salida: e.target.value})} />
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5 w-1/2">
                    <label className="text-[12px] text-slate-500 font-bold uppercase tracking-wider">
                      Hora Real Salida (HH:MM)
                    </label>
                    <input type="time" className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      value={addFormData.hora_real_salida} onChange={(e) => setAddFormData({...addFormData, hora_real_salida: e.target.value})} />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1 flex flex-col gap-1.5 hidden">
                    <label className="text-[12px] text-slate-500 font-bold uppercase tracking-wider">
                      Hora Itin. Llegada (HH:MM)
                    </label>
                    <input type="time" className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      value={addFormData.hora_itinerario_llegada} onChange={(e) => setAddFormData({...addFormData, hora_itinerario_llegada: e.target.value})} />
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5 w-1/2">
                    <label className="text-[12px] text-slate-500 font-bold uppercase tracking-wider">
                      Hora Real Llegada (HH:MM)
                    </label>
                    <input type="time" className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      value={addFormData.hora_real_llegada} onChange={(e) => setAddFormData({...addFormData, hora_real_llegada: e.target.value})} />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[12px] text-slate-500 font-bold uppercase tracking-wider">Pasajeros</label>
                    <input type="number" min="0" className="h-10 px-3 bg-white text-slate-800 text-sm font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary outline-none" 
                      value={addFormData.pasajeros_abordo} onChange={(e) => setAddFormData({...addFormData, pasajeros_abordo: parseInt(e.target.value)})} required />
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[12px] text-slate-500 font-bold uppercase tracking-wider">Capacidad</label>
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
      {/* MODAL: Eliminar (supervisor) o solicitar eliminación (usuario) */}
      {isDeleteModalOpen && flightToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface max-w-sm w-full rounded-3xl p-6 shadow-2xl animate-fade-in-up border border-outline-variant/30">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${canDelete ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
              <span className="material-symbols-outlined text-2xl">{canDelete ? 'delete' : 'outgoing_mail'}</span>
            </div>
            <h3 className="text-xl font-medium text-center mb-2">{canDelete ? '¿Eliminar vuelo?' : 'Solicitar eliminación'}</h3>
            <p className="text-on-surface-variant text-center text-sm mb-4">
              {canDelete ? (
                <>El vuelo <strong>{flightToDelete.numero_vuelo}</strong> saldrá del Registro y de los Reportes. Queda guardado y se puede restaurar desde el panel.</>
              ) : (
                <>Un supervisor revisará la eliminación del vuelo <strong>{flightToDelete.numero_vuelo}</strong>. Mientras tanto no cuenta en los reportes.</>
              )}
            </p>
            <label className="flex flex-col gap-1.5 mb-5">
              <span className="text-[12px] font-bold uppercase tracking-wider text-slate-500">Motivo</span>
              <textarea
                autoFocus
                rows={3}
                maxLength={500}
                value={deleteReason}
                onChange={e => setDeleteReason(e.target.value)}
                placeholder="Ej.: vuelo duplicado, registrado en la fecha equivocada…"
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </label>
            <div className="flex gap-3">
              <button 
                onClick={() => { setIsDeleteModalOpen(false); setFlightToDelete(null); }}
                disabled={deleteBusy}
                className="flex-1 px-4 py-2 rounded-full font-medium hover:bg-surface-variant transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={executeDelete}
                disabled={deleteBusy || deleteReason.trim().length < 3}
                className={`flex-1 text-white px-4 py-2 rounded-full font-medium shadow-sm disabled:opacity-50 ${canDelete ? 'bg-red-600 hover:bg-red-700 shadow-red-900/20' : 'bg-amber-600 hover:bg-amber-700 shadow-amber-900/20'}`}
              >
                {deleteBusy ? 'Enviando…' : canDelete ? 'Eliminar' : 'Enviar solicitud'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Flight Audit Modal */}
      {isAuditModalOpen && (
        <FlightAuditBoard 
          canDelete={canDelete}
          onClose={() => { 
            setIsAuditModalOpen(false); 
            loadPendingAudit(); 
            // Recarga para ver lo aprobado; sin ?pendientes para que no se vuelva a abrir sola
            const url = new URL(window.location.href);
            url.searchParams.delete('pendientes');
            window.location.replace(url.toString());
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
              {[...llegadasPendientes.map(f => ({...f, type: 'llegadas' as const})), ...salidasPendientes.map(f => ({...f, type: 'salidas' as const}))].map(flight => (
                <PendingFlightCard key={flight.id} flight={flight} onApprove={handleApprovePending} />
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
                El archivo tiene varias pestañas. Elige los meses que quieres importar; las pestañas sin vuelos se ignoran.
              </p>
              
              <label className="flex items-center gap-3 px-3 pb-2 mb-2 border-b border-surface-variant/40 text-sm font-semibold text-on-surface cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-blue-600"
                  checked={selectedSheets.length === importWorkbook.SheetNames.length}
                  onChange={e => setSelectedSheets(e.target.checked ? importWorkbook.SheetNames : [])}
                />
                Todas las pestañas
              </label>
              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {importWorkbook.SheetNames.map(sheet => (
                  <label
                    key={sheet}
                    className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${selectedSheets.includes(sheet) ? 'border-blue-500 bg-blue-50' : 'border-surface-variant/50 hover:border-blue-300'}`}
                  >
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-blue-600"
                      checked={selectedSheets.includes(sheet)}
                      onChange={e => setSelectedSheets(prev => e.target.checked ? [...prev, sheet] : prev.filter(n => n !== sheet))}
                    />
                    <span className="font-label-lg font-semibold text-on-surface">{sheet}</span>
                  </label>
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
              <button
                onClick={() => processExcelSheets(importWorkbook, importWorkbook.SheetNames.filter(n => selectedSheets.includes(n)))}
                disabled={selectedSheets.length === 0}
                className="flex-1 px-4 py-2 rounded-xl font-label-md text-label-md font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                Continuar ({selectedSheets.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progreso de la subida: el aro se desenrolla en la barra (antes: cubo a pantalla completa) */}
      <UploadProgress
        job={uploadJob}
        onFinished={() => {
          setUploadJob(null);
          afterUploadRef.current?.();
          afterUploadRef.current = null;
        }}
      />

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

      {/* Excel Import Preview Modal */}
      {isPreviewOpen && previewData && (
        <ExcelImportPreviewModal
          data={previewData}
          onConfirm={async (rowsToSave) => {
            setIsPreviewOpen(false);
            setImporting(true);

            // Lotes de 400: la barra avanza de verdad y ninguna petición es demasiado grande
            const CHUNK = 400;
            const total = rowsToSave.length;
            setUploadJob({
              id: ++uploadSeq.current,
              label: `Guardando ${total} ${total === 1 ? 'vuelo' : 'vuelos'}…`,
              fileName: importFileRef.current?.name,
              fileSize: importFileRef.current?.size,
              actual: 0,
              creepTo: Math.min(0.95, CHUNK / total),
              status: 'running',
            });
            
            let totalInserted = 0;
            let totalUpdated = 0;
            try {
              for (let i = 0; i < total; i += CHUNK) {
                const res = await importHistoricoRows(rowsToSave.slice(i, i + CHUNK), {
                  archivo: importFileRef.current?.name,
                  lote: i / CHUNK + 1,
                  lotes: Math.ceil(total / CHUNK),
                });
                totalInserted += res.inserted || 0;
                totalUpdated += res.updated || 0;
                if (!res.success) throw new Error(res.error);
                const done = Math.min(total, i + CHUNK);
                setUploadJob(j => j && { ...j, actual: done / total, creepTo: Math.min(0.95, (done + CHUNK) / total), label: `Guardando ${done} de ${total} vuelos…` });
              }

              let msg = `Importación completada: ${totalInserted} vuelos nuevos agregados.`;
              if (totalUpdated > 0) msg += ` ${totalUpdated} vuelos ya existentes actualizados.`;
              
              // El resumen aparece después del check; al aceptarlo se recarga la página
              afterUploadRef.current = () => setImportResult({ show: true, type: 'success', message: msg });
              setUploadJob(j => j && { ...j, status: 'success', label: 'Importación completa' });
              setPreviewData(null);
            } catch (err) {
              console.error("Error saving previewed data:", err);
              const saved = totalInserted + totalUpdated;
              const message = `Error al guardar los vuelos${saved > 0 ? ` (se alcanzaron a guardar ${saved}; puedes volver a importar el archivo, los ya guardados solo se actualizan)` : ''}. Detalles: ${(err as Error).message}`;
              afterUploadRef.current = () => setImportResult({ show: true, type: 'error', message });
              setUploadJob(j => j && { ...j, status: 'error', errorText: 'No se pudieron guardar los vuelos' });
            } finally {
              setImporting(false);
            }
          }}
          onCancel={() => {
            setIsPreviewOpen(false);
            setPreviewData(null);
          }}
        />
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
