"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { addMultipleManualFlights, getFlightFormSuggestions, ManualFlightInput, FleetSuggestion } from "@/app/actions/manualFlights";
import { parseItineraryImage } from "@/app/actions/imageParser";
import * as Papa from "papaparse";
import * as XLSX from "xlsx";
import { UploadProgress, type UploadJob } from "@/components/ui/UploadProgress";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ManualFlightUploadModal({ isOpen, onClose, onSuccess }: Props) {
  const [activeTab, setActiveTab] = useState<'image' | 'upload' | 'manual'>('image');
  const [loading, setLoading] = useState(false);
  const [loadingSeconds, setLoadingSeconds] = useState(0);
  const [fileData, setFileData] = useState<ManualFlightInput[]>([]);
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

  // Manual Form State
  const [fNum, setFNum] = useState("");
  const [fOri, setFOri] = useState("");
  const [fDes, setFDes] = useState("");
  const [fDep, setFDep] = useState("");
  const [fArr, setFArr] = useState("");
  const [fAirline, setFAirline] = useState("Air Panama");
  const [fDate, setFDate] = useState(todayStr);
  const [fReg, setFReg] = useState("");
  const [fAircraft, setFAircraft] = useState("");
  const [fPilot, setFPilot] = useState("");
  const [fPax, setFPax] = useState("");
  const [fPaxMax, setFPaxMax] = useState("");
  const [fleet, setFleet] = useState<FleetSuggestion[]>([]);
  const [pilotOptions, setPilotOptions] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'manual' || fleet.length > 0) return;
    getFlightFormSuggestions()
      .then(({ fleet, pilots }) => { setFleet(fleet); setPilotOptions(pilots); })
      .catch(() => {});
  }, [isOpen, activeTab, fleet.length]);

  // Al elegir una matrícula conocida se completan tipo y capacidad
  const handleRegChange = (value: string) => {
    setFReg(value);
    const known = fleet.find(f => f.aircraftReg === value.trim().toUpperCase());
    if (known) {
      setFAircraft(known.aircraft);
      if (known.paxMax) setFPaxMax(String(known.paxMax));
    }
  };

  const resetManualForm = () => {
    setFNum(""); setFOri(""); setFDes(""); setFDep(""); setFArr(""); setFDate(todayStr);
    setFReg(""); setFAircraft(""); setFPilot(""); setFPax(""); setFPaxMax("");
  };

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
            setFileData(flights as ManualFlightInput[]);
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

  const handleSaveManual = async () => {
    if (!fNum || !fOri || !fDes || !fDep || !fArr) {
      toast.error("Completa número de vuelo, origen, destino y horas");
      return;
    }
    if (fOri === fDes) {
      toast.error("El origen y el destino no pueden ser iguales");
      return;
    }
    const pax = parseInt(fPax) || 0;
    const paxMax = parseInt(fPaxMax) || 0;
    if (paxMax > 0 && pax > paxMax) {
      toast.error("Los pasajeros no pueden superar la capacidad");
      return;
    }
    setLoading(true);
    try {
      const newFlight: ManualFlightInput = {
        flightNumber: fNum.trim(),
        aircraft: fAircraft.trim().toUpperCase() || 'Desconocido',
        aircraftReg: fReg.trim().toUpperCase(),
        origin: fOri.toUpperCase(),
        originName: '',
        destination: fDes.toUpperCase(),
        destinationName: '',
        departureTimeLocal: fDep,
        arrivalTimeLocal: fArr,
        airline: fAirline,
        pilot: fPilot.trim(),
        paxCount: pax,
        paxMax,
        flightDate: fDate
      };
      await addMultipleManualFlights([newFlight]);
      toast.success("Vuelo agregado correctamente");
      resetManualForm();
      onSuccess();
    } catch (e) {
      toast.error((e as Error).message);
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
              <span className="material-symbols-outlined text-[20px]">add_flight</span>
            </div>
            <h2 className="font-headline-md text-headline-md font-bold text-on-surface">Agregar Vuelos</h2>
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
                    Se han detectado <strong>{fileData.length}</strong> vuelos válidos. Revisa y edita cualquier dato en la tabla (vuelo, tripulación, pasajeros) si el escáner cometió algún error, antes de importarlos.
                  </p>
                </div>
              </div>
              {/* Barra de resumen + indicador de scroll */}
              <div className="flex items-center justify-between px-3 py-2 bg-surface-container-high rounded-xl border border-outline-variant/20">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-primary">airplane_ticket</span>
                  <span className="text-[12px] font-bold text-on-surface">{fileData.length} vuelos · {fileData[0]?.flightDate?.substring(0,7)}</span>
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
                        <th className="px-4 py-3 bg-surface-container-high">Capacidad</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/20">
                      {fileData.map((f, i) => (
                        <tr key={i} className="hover:bg-surface-container-highest transition-colors">
                          <td className="px-4 py-3 text-on-surface-variant font-medium">
                            <input 
                            type="text" 
                            value={f.flightNumber} 
                            onChange={(e) => {
                              const newData = [...fileData];
                              newData[i].flightNumber = e.target.value;
                              setFileData(newData);
                            }}
                            className="w-16 bg-transparent border-b border-outline-variant/30 focus:border-primary focus:outline-none"
                          />
                          <div className="text-xs text-on-surface-variant/70 font-normal mt-1">{f.departureTimeLocal}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="bg-surface-variant/50 px-2 py-0.5 rounded text-xs">{f.origin}</span>
                          <span className="mx-2 text-on-surface-variant/50">→</span>
                          <span className="bg-surface-variant/50 px-2 py-0.5 rounded text-xs">{f.destination}</span>
                        </td>
                        <td className="px-4 py-3 text-on-surface-variant">
                          {f.aircraft || f.aircraftReg ? (
                            <div className="flex flex-col">
                              <span>{f.aircraft || ''}</span>
                              <span className="text-xs text-on-surface-variant/70">{f.aircraftReg || ''}</span>
                            </div>
                          ) : (
                            <span className="italic opacity-50">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-on-surface-variant text-xs">
                          <input 
                            type="text" 
                            value={f.pilot || ''} 
                            onChange={(e) => {
                              const newData = [...fileData];
                              newData[i].pilot = e.target.value;
                              setFileData(newData);
                            }}
                            className="w-full min-w-[120px] max-w-[150px] bg-transparent border-b border-outline-variant/30 focus:border-primary focus:outline-none"
                            placeholder="Desconocida"
                          />
                        </td>
                        <td className="px-4 py-3 text-on-surface-variant">
                          <div className="flex items-center gap-1">
                            <input 
                              type="number" 
                              value={f.paxCount !== undefined ? f.paxCount : ''} 
                              onChange={(e) => {
                                const newData = [...fileData];
                                newData[i].paxCount = e.target.value ? parseInt(e.target.value, 10) : 0;
                                setFileData(newData);
                              }}
                              className="w-12 text-center bg-surface-container-highest rounded border border-outline-variant/30 focus:border-primary focus:outline-none text-on-surface"
                            />
                            {f.paxMax && <span className="text-on-surface-variant/70 text-xs">/ {f.paxMax}</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-outline-variant/20 flex justify-end gap-3 bg-surface-container-low rounded-b-[28px] mt-auto flex-shrink-0">
              <button 
                onClick={() => setFileData([])}
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
            {/* Tabs */}
            <div className="flex border-b border-outline-variant/20">
              <button 
                onClick={() => setActiveTab('image')}
                className={`py-4 px-4 font-label-md font-bold text-sm border-b-2 transition-colors ${activeTab === 'image' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
              >
                Subir Fotografía (IA)
              </button>
              <button 
                onClick={() => setActiveTab('upload')}
                className={`py-4 px-4 font-label-md font-bold text-sm border-b-2 transition-colors ${activeTab === 'upload' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
              >
                Subir Archivo (Excel/CSV)
              </button>
              <button 
                onClick={() => setActiveTab('manual')}
                className={`py-4 px-4 font-label-md font-bold text-sm border-b-2 transition-colors ${activeTab === 'manual' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
              >
                Ingreso Manual (Individual)
              </button>
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

              {activeTab === 'manual' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-xs font-bold text-on-surface-variant uppercase">Fecha del Vuelo</label>
                    <input type="date" value={fDate} onChange={e => setFDate(e.target.value)} className="h-10 px-3 bg-surface-container rounded-lg border border-white/5 focus:ring-1" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-on-surface-variant uppercase">Aerolínea</label>
                    <select value={fAirline} onChange={e => setFAirline(e.target.value)} className="h-10 px-3 bg-surface-container rounded-lg border border-white/5 focus:ring-1">
                      <option value="Air Panama">Air Panama</option>
                      <option value="Copa Airlines">Copa Airlines</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-on-surface-variant uppercase">Nº de Vuelo (Ej: 670)</label>
                    <input list="manual-flight-numbers" type="text" value={fNum} onChange={e => setFNum(e.target.value)} className="h-10 px-3 bg-surface-container rounded-lg border border-white/5 focus:ring-1" />
                    <datalist id="manual-flight-numbers">
                      {COMMON_FLIGHTS.map(f => <option key={f} value={f} />)}
                    </datalist>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-on-surface-variant uppercase">Origen</label>
                    <select value={fOri} onChange={e => setFOri(e.target.value)} className="h-10 px-3 bg-surface-container rounded-lg border border-white/5 focus:ring-1">
                      <option value="">Seleccione Origen...</option>
                      {AIRPORTS.map(apt => (
                        <option key={apt.code} value={apt.code}>{apt.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-on-surface-variant uppercase">Destino</label>
                    <select value={fDes} onChange={e => setFDes(e.target.value)} className="h-10 px-3 bg-surface-container rounded-lg border border-white/5 focus:ring-1">
                      <option value="">Seleccione Destino...</option>
                      {AIRPORTS.map(apt => (
                        <option key={apt.code} value={apt.code}>{apt.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-on-surface-variant uppercase">Hora Salida (HH:mm)</label>
                    <input type="time" value={fDep} onChange={e => setFDep(e.target.value)} className="h-10 px-3 bg-surface-container rounded-lg border border-white/5 focus:ring-1" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-on-surface-variant uppercase">Hora Llegada (HH:mm)</label>
                    <input type="time" value={fArr} onChange={e => setFArr(e.target.value)} className="h-10 px-3 bg-surface-container rounded-lg border border-white/5 focus:ring-1" />
                  </div>

                  <div className="col-span-2 pt-2 mt-1 border-t border-outline-variant/20 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Aeronave y tripulación</div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-on-surface-variant uppercase">Matrícula</label>
                    <input list="manual-fleet-regs" type="text" value={fReg} onChange={e => handleRegChange(e.target.value)} placeholder="Ej: HP-1997" className="h-10 px-3 bg-surface-container rounded-lg border border-white/5 focus:ring-1 uppercase" />
                    <datalist id="manual-fleet-regs">
                      {fleet.filter(f => f.airline === fAirline).map(f => (
                        <option key={f.aircraftReg} value={f.aircraftReg}>{`${f.aircraft} · ${f.paxMax} pax`}</option>
                      ))}
                    </datalist>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-on-surface-variant uppercase">Tipo de Aeronave</label>
                    <input type="text" value={fAircraft} onChange={e => setFAircraft(e.target.value)} placeholder="Ej: DH8D, B738" className="h-10 px-3 bg-surface-container rounded-lg border border-white/5 focus:ring-1 uppercase" />
                  </div>
                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-xs font-bold text-on-surface-variant uppercase">Piloto / Tripulación</label>
                    <input list="manual-pilots" type="text" value={fPilot} onChange={e => setFPilot(e.target.value)} placeholder="Capitán / Primer oficial" className="h-10 px-3 bg-surface-container rounded-lg border border-white/5 focus:ring-1" />
                    <datalist id="manual-pilots">
                      {pilotOptions.map(p => <option key={p} value={p} />)}
                    </datalist>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-on-surface-variant uppercase">Pasajeros a bordo</label>
                    <input type="number" inputMode="numeric" min={0} value={fPax} onChange={e => setFPax(e.target.value)} placeholder="0" className="h-10 px-3 bg-surface-container rounded-lg border border-white/5 focus:ring-1" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-on-surface-variant uppercase">Capacidad</label>
                    <input type="number" inputMode="numeric" min={0} value={fPaxMax} onChange={e => setFPaxMax(e.target.value)} placeholder="0" className="h-10 px-3 bg-surface-container rounded-lg border border-white/5 focus:ring-1" />
                  </div>
                </div>
              )}
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
              
              {activeTab === 'manual' && (
                <button 
                  onClick={handleSaveManual}
                  disabled={loading}
                  className="px-6 py-2.5 rounded-full font-label-md font-bold bg-primary text-on-primary hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {loading ? <span className="material-symbols-outlined animate-spin text-[18px]">sync</span> : <span className="material-symbols-outlined text-[18px]">add</span>}
                  Agregar Vuelo Manual
                </button>
              )}
            </div>
          </>
        )}

      </div>
    </div>
    </>
  );
}
