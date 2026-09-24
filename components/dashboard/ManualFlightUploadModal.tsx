"use client";

import { Fragment, useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { addMultipleManualFlights, ManualFlightInput } from "@/app/actions/manualFlights";
import { ManualFlightForm } from "./ManualFlightForm";
import { parseItineraryImage } from "@/app/actions/imageParser";
import * as Papa from "papaparse";
import * as XLSX from "xlsx";
import { UploadProgress, type UploadJob } from "@/components/ui/UploadProgress";
import { getImportKnowledge } from "@/app/actions/flights";
import { estimatedArrival, reviewWarnings, withAircraft } from "@/lib/ocr/review";
import type { FleetKnowledge } from "@/lib/fleet/rules";
import { ItineraryFlightEditor, type ReviewFlight } from "./ItineraryFlightEditor";


interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ManualFlightUploadModal({ isOpen, onClose, onSuccess }: Props) {
  const [activeTab, setActiveTab] = useState<'image' | 'upload' | 'manual'>('image');
  const [loading, setLoading] = useState(false);
  const [loadingSeconds, setLoadingSeconds] = useState(0);
  // Vuelos a revisar antes de importar; `warnings` viene de la base de conocimiento
  const [fileData, setFileData] = useState<ReviewFlight[]>([]);
  const [editingRow, setEditingRow] = useState<number | null>(null);
  // Base de conocimiento para completar y validar lo que se corrige en la revisión
  const [kb, setKb] = useState<FleetKnowledge | null>(null);
  useEffect(() => {
    if (fileData.length === 0 || kb) return;
    getImportKnowledge().then(setKb).catch(() => {});
  }, [fileData.length, kb]);

  // Edita un vuelo: la matrícula completa modelo y capacidad, la salida o la ruta
  // recalculan la llegada, y los avisos se vuelven a calcular con la base
  const updateRow = (i: number, patch: Partial<ReviewFlight>) => {
    setFileData(rows => rows.map((r, j) => {
      if (j !== i) return r;
      let next: ReviewFlight = { ...r, ...patch };
      if (kb && 'aircraftReg' in patch) next = withAircraft(next, kb);
      const routeOrTime = 'departureTimeLocal' in patch || 'origin' in patch || 'destination' in patch;
      if (kb && routeOrTime && !('arrivalTimeLocal' in patch)) next.arrivalTimeLocal = estimatedArrival(next, kb);
      return { ...next, warnings: kb ? reviewWarnings(next, kb) : r.warnings };
    }));
  };
  const removeRow = (i: number) => {
    setFileData(rows => rows.filter((_, j) => j !== i));
    setEditingRow(null);
  };
  const reviewCount = fileData.filter(f => f.warnings?.length).length;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const loadingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Progreso visual de la subida (análisis de imagen o guardado)
  const [uploadJob, setUploadJob] = useState<UploadJob | null>(null);
  const uploadSeq = useRef(0);
  const afterUploadRef = useRef<(() => void) | null>(null);

  const todayPanama = new Date().toLocaleString("en-US", { timeZone: "America/Panama" });
  const todayStr = new Date(todayPanama).toISOString().split('T')[0];
  const [targetDate, setTargetDate] = useState(todayStr);
  const [selectedAirline, setSelectedAirline] = useState<'airpanama' | 'copa'>('airpanama');

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase();
    
    if (extension === 'csv') {
      Papa.parse<Record<string, unknown>>(file, {
        header: true,
        complete: (results) => {
          processParsedData(results.data);
        }
      });
    } else if (extension === 'xlsx' || extension === 'xls') {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
        processParsedData(data);
      };
      reader.readAsBinaryString(file);
    } else {
      toast.error("Formato no soportado. Sube un CSV o Excel (.xlsx)");
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setLoading(true);
    setLoadingSeconds(0);
    // Start a timer to show elapsed time
    loadingTimerRef.current = setInterval(() => {
      setLoadingSeconds(prev => prev + 1);
    }, 1000);
    setUploadJob({
      id: ++uploadSeq.current,
      label: "Analizando imagen…",
      fileName: file.name,
      fileSize: file.size,
      actual: 0,
      creepTo: 0.2,
      status: "running",
    });
    
    const stopTimer = () => {
      if (loadingTimerRef.current) {
        clearInterval(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
    };
    
    try {
      const reader = new FileReader();
      // Lectura real del archivo: 0 → 20 %
      reader.onprogress = (ev) => {
        if (ev.lengthComputable) setUploadJob(j => j && { ...j, actual: (ev.loaded / ev.total) * 0.2 });
      };
      reader.onloadend = async () => {
        const base64Image = reader.result as string;
        // El OCR en el servidor no informa avance: la barra avanza despacio hacia 92 %
        setUploadJob(j => j && { ...j, actual: 0.2, creepTo: 0.92, label: "Leyendo vuelos de la imagen…" });
        try {
          const flights = await parseItineraryImage(base64Image, targetDate, selectedAirline);
          if (flights && flights.length > 0) {
            // El OCR no trae nombres de origen/destino; el resto de campos se completa al editar
            setFileData(flights as ReviewFlight[]);
            afterUploadRef.current = () => toast.success(`Se encontraron ${flights.length} vuelos en la imagen.`);
            setUploadJob(j => j && { ...j, status: "success", label: `${flights.length} vuelos encontrados` });
          } else {
            afterUploadRef.current = () => toast.error("No se encontraron vuelos válidos en la imagen.");
            setUploadJob(j => j && { ...j, status: "error", errorText: "No se encontraron vuelos en la imagen" });
          }
        } catch (error) {
          const isTimeout = ((error as Error).message || "").includes(">35s") || ((error as Error).message || "").includes("sobrecargada");
          const message = isTimeout
            ? "El análisis de la imagen tardó demasiado. Espera un momento e intenta de nuevo."
            : (error as Error).message;
          afterUploadRef.current = () => toast.error(message, { duration: 8000 });
          setUploadJob(j => j && { ...j, status: "error", errorText: "No se pudo analizar la imagen" });
        } finally {
          stopTimer();
          setLoading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error("Error leyendo la imagen");
      setUploadJob(null);
      stopTimer();
      setLoading(false);
    }
  };

  const handleCancelAnalysis = () => {
    if (loadingTimerRef.current) {
      clearInterval(loadingTimerRef.current);
      loadingTimerRef.current = null;
    }
    setLoading(false);
    setLoadingSeconds(0);
    setUploadJob(null);
    afterUploadRef.current = null;
    toast.dismiss();
    // Reset the file input so the same file can be selected again
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const processParsedData = (data: Record<string, unknown>[]) => {
    const flights: ManualFlightInput[] = data
      .filter((row) => row.num || row.flightNumber)
      .map((row) => ({
        flightNumber: String(row.num || row.flightNumber),
        aircraft: String(row.type || row.aircraft || 'Desconocido'),
        aircraftReg: String(row.reg || row.aircraftReg || ''),
        origin: String(row.ori || row.origin || ''),
        originName: String(row.oriName || row.originName || ''),
        destination: String(row.des || row.destination || ''),
        destinationName: String(row.desName || row.destinationName || ''),
        departureTimeLocal: String(row.dep || row.departureTimeLocal || ''),
        arrivalTimeLocal: String(row.arr || row.arrivalTimeLocal || ''),
        airline: String(row.airline || (selectedAirline === 'airpanama' ? 'Air Panama' : 'Copa Airlines')),
        pilot: String(row.pilot || ''),
        paxCount: Number(row.pax || row.paxCount || 0),
        paxMax: Number(row.max || row.paxMax || 0),
        flightDate: String(row.date || row.flightDate || targetDate)
      }));

    setFileData(flights);
    if (flights.length > 0) {
      toast.success(`${flights.length} vuelos detectados en el archivo.`);
    } else {
      toast.error("No se encontraron vuelos válidos en el archivo.");
    }
  };

  const handleSaveFile = async () => {
    if (fileData.length === 0) return;
    setLoading(true);
    const n = fileData.length;
    setUploadJob({
      id: ++uploadSeq.current,
      label: `Subiendo ${n} ${n === 1 ? "vuelo" : "vuelos"}…`,
      actual: 0,
      creepTo: 0.9,
      status: "running",
    });
    try {
      await addMultipleManualFlights(fileData);
      // Se cierra después del check
      afterUploadRef.current = () => {
        toast.success("Vuelos subidos correctamente");
        onSuccess();
        onClose();
      };
      setUploadJob(j => j && { ...j, status: "success", label: "Itinerario cargado" });
    } catch (error) {
      const message = "Error al subir: " + (error as Error).message;
      afterUploadRef.current = () => toast.error(message);
      setUploadJob(j => j && { ...j, status: "error", errorText: "No se pudieron subir los vuelos" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <UploadProgress
      job={uploadJob}
      onCancel={uploadJob?.label.startsWith("Analizando") || uploadJob?.label.startsWith("Leyendo") ? handleCancelAnalysis : undefined}
      onFinished={() => {
        setUploadJob(null);
        afterUploadRef.current?.();
        afterUploadRef.current = null;
      }}
    />
    <div className="fixed inset-0 z-[100] bg-surface/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-surface-container-lowest rounded-[28px] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[92vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-outline-variant/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">flight_takeoff</span>
            </div>
            <h2 className="font-headline-md text-headline-md font-bold text-on-surface">Cargar Itinerario</h2>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant transition-colors">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Confirmation Screen */}
        {fileData.length > 0 ? (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="p-6 flex flex-col gap-4 flex-1 overflow-hidden">
              <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 text-on-surface flex items-start gap-3 flex-shrink-0">
                <span className="material-symbols-outlined text-primary text-2xl">fact_check</span>
                <div>
                  <h3 className="font-label-lg font-bold text-primary mb-1">Confirmación de Vuelos</h3>
                  <p className="text-sm text-on-surface-variant">
                    Se han detectado <strong>{fileData.length}</strong> vuelos válidos. Toca un vuelo (o el lápiz) para corregir cualquier dato: vuelo, horas, ruta, avión, tripulación y pasajeros. Los avisos se actualizan solos al corregir.
                  </p>
                </div>
              </div>
              {/* Barra de resumen + indicador de scroll */}
              <div className="flex items-center justify-between px-3 py-2 bg-surface-container-high rounded-xl border border-outline-variant/20">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-primary">airplane_ticket</span>
                  <span className="text-[12px] font-bold text-on-surface">{fileData.length} vuelos · {fileData[0]?.flightDate}</span>
                  {reviewCount > 0 && (
                    <span className="text-[12px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                      {reviewCount} para revisar
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-on-surface-variant/60">
                  <span className="material-symbols-outlined text-[14px]">swipe_vertical</span>
                  <span className="text-[12px]">Desliza para ver todos</span>
                </div>
              </div>
              <div className="bg-surface-container rounded-2xl border border-outline-variant/30 flex flex-col overflow-hidden" style={{ maxHeight: '420px' }}>
                <div className="overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'thin', scrollbarColor: 'var(--md-sys-color-outline-variant) transparent' }}>
                  <table className="w-full text-left text-sm relative">
                    <thead className="bg-surface-container-high text-on-surface-variant font-label-sm uppercase sticky top-0 z-10 shadow-sm border-b border-outline-variant/20">
                      <tr>
                        <th className="px-4 py-3 bg-surface-container-high">Vuelo</th>
                        <th className="px-4 py-3 bg-surface-container-high">Ruta</th>
                        <th className="px-4 py-3 bg-surface-container-high">Avión</th>
                        <th className="px-4 py-3 bg-surface-container-high">Tripulación</th>
                        <th className="px-4 py-3 bg-surface-container-high">Pax</th>
                        <th className="px-3 py-3 bg-surface-container-high"><span className="sr-only">Editar</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/20">
                      {fileData.map((f, i) => (
                        <Fragment key={i}>
                        <tr
                          className={`cursor-pointer transition-colors ${editingRow === i ? 'bg-primary/5' : f.warnings?.length ? 'bg-amber-50 hover:bg-amber-100/70' : 'hover:bg-surface-container-highest'}`}
                          onClick={() => setEditingRow(editingRow === i ? null : i)}
                        >
                          <td className="px-4 py-3">
                            <span className="block font-bold text-on-surface">{f.flightNumber || '—'}</span>
                            <span className={`block text-xs ${f.departureTimeLocal ? 'text-on-surface-variant' : 'text-amber-700 font-semibold'}`}>
                              {f.departureTimeLocal ? `${f.departureTimeLocal}${f.arrivalTimeLocal ? ` → ${f.arrivalTimeLocal}` : ''}` : 'Sin hora'}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="bg-surface-variant/50 px-2 py-0.5 rounded text-xs font-semibold">{f.origin || '?'}</span>
                            <span className="mx-1.5 text-on-surface-variant/50">→</span>
                            <span className="bg-surface-variant/50 px-2 py-0.5 rounded text-xs font-semibold">{f.destination || '?'}</span>
                          </td>
                          <td className="px-4 py-3 text-on-surface-variant">
                            <span className="block font-semibold text-on-surface">{f.aircraft || '—'}</span>
                            <span className="block text-xs whitespace-nowrap">{f.aircraftReg || ''}</span>
                          </td>
                          <td className="px-4 py-3 text-xs text-on-surface-variant max-w-[200px]">
                            <span className="block truncate text-on-surface">{f.pilot || <em className="opacity-50">Sin pilotos</em>}</span>
                            {f.cabin_crew && <span className="block truncate">{f.cabin_crew}</span>}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`font-bold ${f.paxCount == null ? 'text-amber-700' : 'text-on-surface'}`}>{f.paxCount ?? '?'}</span>
                            <span className="text-on-surface-variant/70 text-xs"> / {f.paxMax || '?'}</span>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); setEditingRow(editingRow === i ? null : i); }}
                              className={`w-9 h-9 rounded-lg inline-flex items-center justify-center transition-colors ${editingRow === i ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-primary hover:bg-primary hover:text-on-primary'}`}
                              aria-label={`Editar vuelo ${f.flightNumber}`}
                              title="Editar"
                            >
                              <span className="material-symbols-outlined text-[18px]">{editingRow === i ? 'expand_less' : 'edit'}</span>
                            </button>
                          </td>
                        </tr>
                        {editingRow === i && (
                          <tr>
                            <td colSpan={6} className="p-0">
                              <ItineraryFlightEditor
                                flight={f}
                                kb={kb}
                                onChange={patch => updateRow(i, patch)}
                                onRemove={() => removeRow(i)}
                                onDone={() => setEditingRow(null)}
                              />
                            </td>
                          </tr>
                        )}
                      {f.warnings?.length && editingRow !== i ? (
                        <tr className="bg-amber-50">
                          <td colSpan={6} className="px-4 pb-3 pt-0">
                            <div className="flex flex-wrap gap-1.5">
                              {f.warnings.map(w => (
                                <span key={w} className="inline-flex items-center gap-1 text-[12px] font-medium text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">
                                  <span className="material-symbols-outlined text-[14px]">warning</span>
                                  {w}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                      </Fragment>
                    ))}
                  </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-outline-variant/20 flex justify-end gap-3 bg-surface-container-low rounded-b-[28px] mt-auto flex-shrink-0">
              <button 
                onClick={() => { setFileData([]); setEditingRow(null); }}
                className="px-6 py-2.5 rounded-full font-label-md font-bold text-error hover:bg-error/10 transition-colors"
                disabled={loading}
              >
                Cancelar Importación
              </button>
              
              <button 
                onClick={handleSaveFile}
                disabled={loading}
                className="px-6 py-2.5 rounded-full font-label-md font-bold bg-primary text-on-primary hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                {loading ? <span className="material-symbols-outlined animate-spin text-[18px]">sync</span> : <span className="material-symbols-outlined text-[18px]">check_circle</span>}
                Aceptar e Importar {fileData.length} Vuelos
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Tres formas de cargar: tarjetas con pastilla deslizante */}
            <div className="px-6 pt-5">
              <div role="tablist" aria-label="Forma de carga" className="relative grid grid-cols-3 p-1 rounded-2xl bg-surface-container-high">
                <span
                  aria-hidden="true"
                  className="absolute top-1 bottom-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-xl bg-surface-container-lowest shadow-md ring-1 ring-black/5 transition-transform duration-300 ease-out"
                  style={{ transform: `translateX(${['image', 'upload', 'manual'].indexOf(activeTab) * 100}%)` }}
                />
                {([
                  { id: 'image', icon: 'document_scanner', title: 'Escanear', hint: 'Foto o captura' },
                  { id: 'upload', icon: 'upload_file', title: 'Importar', hint: 'Excel o CSV' },
                  { id: 'manual', icon: 'edit_note', title: 'Manual', hint: 'Vuelo por vuelo' },
                ] as const).map(t => (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={activeTab === t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`relative z-10 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2.5 py-2.5 px-2 rounded-xl transition-colors ${activeTab === t.id ? 'text-on-surface' : 'text-on-surface-variant hover:text-on-surface'}`}
                  >
                    <span className={`material-symbols-outlined text-[22px] ${activeTab === t.id ? 'text-primary' : ''}`}>{t.icon}</span>
                    <span className="flex flex-col items-center sm:items-start leading-tight">
                      <span className="text-[14px] font-bold">{t.title}</span>
                      <span className="hidden sm:block text-[11px] font-medium opacity-70">{t.hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              
              {activeTab === 'image' && (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3">
                    <label className="text-xs font-bold text-on-surface-variant uppercase">Aerolínea de la Imagen</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedAirline('airpanama')}
                        className={`flex-1 py-2 px-4 rounded-xl border ${selectedAirline === 'airpanama' ? 'bg-primary/10 border-primary text-primary font-bold' : 'border-outline-variant/30 text-on-surface-variant'}`}
                      >
                        Air Panama (Diario)
                      </button>
                      <button
                        onClick={() => setSelectedAirline('copa')}
                        className={`flex-1 py-2 px-4 rounded-xl border ${selectedAirline === 'copa' ? 'bg-primary/10 border-primary text-primary font-bold' : 'border-outline-variant/30 text-on-surface-variant'}`}
                      >
                        Copa Airlines (Mensual)
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 bg-surface-container p-4 rounded-xl border border-white/5">
                    <span className="material-symbols-outlined text-primary">calendar_month</span>
                    <div className="flex flex-col flex-1">
                      <label className="text-xs font-bold text-on-surface-variant uppercase">Fecha de Referencia</label>
                      <span className="text-xs text-on-surface-variant/70">Fecha que se asignará si la foto no la incluye explícitamente</span>
                    </div>
                    <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} className="h-10 px-3 bg-surface-container-high rounded-lg border border-outline-variant/30 text-sm focus:ring-1 focus:ring-primary" />
                  </div>

                  <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-on-surface-variant text-sm flex gap-3">
                    <span className="material-symbols-outlined text-blue-500">document_scanner</span>
                    <p>
                      {selectedAirline === 'copa'
                        ? <><strong>Copa Airlines (Mensual):</strong> Sube la foto del itinerario. El sistema leerá el mes de la <strong>Fecha de Referencia</strong> y cargará automáticamente todos los vuelos del mes usando el motor OCR local — sin internet ni IA. 🛫 B738</>  
                        : <><strong>Air Panama (Diario):</strong> Sube la hoja de vuelos del día. El motor OCR local analizará la imagen y extraerá los vuelos (número, ruta, hora, tripulación) — sin internet ni IA. 🛫</>  
                      }
                    </p>
                  </div>
                  
                  <div 
                    className={`w-full border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 transition-all ${
                      loading
                        ? 'border-primary/50 bg-primary/5 py-6'
                        : 'h-32 border-outline-variant hover:bg-surface-container hover:border-primary cursor-pointer'
                    }`}
                    onClick={() => !loading && imageInputRef.current?.click()}
                  >
                    {loading ? (
                      <>
                        <span className="material-symbols-outlined text-3xl text-primary animate-spin">sync</span>
                        <span className="font-label-md font-bold text-on-surface">Procesando imagen...</span>
                        <span className="text-xs text-on-surface-variant">
                          {loadingSeconds < 35
                            ? `${loadingSeconds}s — máx. 35s`
                            : "Puede demorar un poco más..."}
                        </span>
                        {/* Barra de progreso */}
                        <div className="w-48 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-1000"
                            style={{ width: `${Math.min((loadingSeconds / 35) * 100, 100)}%` }}
                          />
                        </div>
                        <button
                          onClick={(ev) => { ev.stopPropagation(); handleCancelAnalysis(); }}
                          className="mt-2 px-4 py-1.5 rounded-full border border-rose-300 text-rose-500 text-xs font-bold hover:bg-rose-50 transition-colors"
                        >
                          Cancelar análisis
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-3xl text-on-surface-variant">add_photo_alternate</span>
                        <span className="font-label-md font-bold text-on-surface">Click para subir fotografía</span>
                      </>
                    )}
                    <input type="file" className="hidden" ref={imageInputRef} accept="image/png, image/jpeg, image/jpg, image/webp" onChange={handleImageUpload} />
                  </div>
                </div>
              )}

              {activeTab === 'upload' && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3 bg-surface-container p-4 rounded-xl border border-white/5">
                    <span className="material-symbols-outlined text-primary">calendar_month</span>
                    <div className="flex flex-col flex-1">
                      <label className="text-xs font-bold text-on-surface-variant uppercase">Fecha de Carga Masiva</label>
                      <span className="text-xs text-on-surface-variant/70">Aplica a todos los vuelos si el archivo no tiene columna &apos;date&apos;</span>
                    </div>
                    <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} className="h-10 px-3 bg-surface-container-high rounded-lg border border-outline-variant/30 text-sm focus:ring-1 focus:ring-primary" />
                  </div>

                  <div className="flex flex-col gap-3">
                    <label className="text-xs font-bold text-on-surface-variant uppercase">Aerolínea Predeterminada</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedAirline('airpanama')}
                        className={`flex-1 py-2 px-4 rounded-xl border ${selectedAirline === 'airpanama' ? 'bg-primary/10 border-primary text-primary font-bold' : 'border-outline-variant/30 text-on-surface-variant'}`}
                      >
                        Air Panama
                      </button>
                      <button
                        onClick={() => setSelectedAirline('copa')}
                        className={`flex-1 py-2 px-4 rounded-xl border ${selectedAirline === 'copa' ? 'bg-primary/10 border-primary text-primary font-bold' : 'border-outline-variant/30 text-on-surface-variant'}`}
                      >
                        Copa Airlines
                      </button>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-primary-container/20 border border-primary/20 text-on-surface-variant text-sm flex gap-3">
                    <span className="material-symbols-outlined text-primary">info</span>
                    <p>
                      Sube un archivo Excel (.xlsx) o CSV con las columnas: <code>num, ori, des, dep, arr, airline, type, reg, date (opcional)</code>.
                      El sistema cruzará estos datos y evitará duplicados automáticamente.
                    </p>
                  </div>
                  
                  <div 
                    className="w-full h-32 border-2 border-dashed border-outline-variant rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-surface-container hover:border-primary transition-all"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <span className="material-symbols-outlined text-3xl text-on-surface-variant">upload_file</span>
                    <span className="font-label-md font-bold text-on-surface">Click para seleccionar archivo</span>
                    <input type="file" className="hidden" ref={fileInputRef} accept=".csv, .xlsx, .xls" onChange={handleFileUpload} />
                  </div>
                </div>
              )}

              {activeTab === 'manual' && <ManualFlightForm onSaved={onSuccess} />}
            </div>

            {/* Default Footer for Manual Entry */}
            <div className="p-6 border-t border-outline-variant/20 flex justify-end gap-3 bg-surface-container-low rounded-b-[28px]">
              <button 
                onClick={onClose}
                className="px-6 py-2.5 rounded-full font-label-md font-bold text-on-surface-variant hover:bg-surface-variant transition-colors"
                disabled={loading}
              >
                Cancelar
              </button>
              
            </div>
          </>
        )}

      </div>
    </div>
    </>
  );
}
