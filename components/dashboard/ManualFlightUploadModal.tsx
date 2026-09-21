"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import { addMultipleManualFlights, ManualFlightInput } from "@/app/actions/manualFlights";
import { parseItineraryImage } from "@/app/actions/imageParser";
import * as Papa from "papaparse";
import * as XLSX from "xlsx";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ManualFlightUploadModal({ isOpen, onClose, onSuccess }: Props) {
  const [activeTab, setActiveTab] = useState<'image' | 'upload' | 'manual'>('image');
  const [loading, setLoading] = useState(false);
  const [fileData, setFileData] = useState<ManualFlightInput[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const todayPanama = new Date().toLocaleString("en-US", { timeZone: "America/Panama" });
  const todayStr = new Date(todayPanama).toISOString().split('T')[0];
  const [targetDate, setTargetDate] = useState(todayStr);

  // Manual Form State
  const [fNum, setFNum] = useState("");
  const [fOri, setFOri] = useState("");
  const [fDes, setFDes] = useState("");
  const [fDep, setFDep] = useState("");
  const [fArr, setFArr] = useState("");
  const [fAirline, setFAirline] = useState("Air Panama");
  const [fDate, setFDate] = useState(todayStr);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase();
    
    if (extension === 'csv') {
      Papa.parse(file, {
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
        const data = XLSX.utils.sheet_to_json(ws);
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
    const toastId = toast.loading("Analizando imagen con IA...");
    
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Image = reader.result as string;
        try {
          const flights = await parseItineraryImage(base64Image, targetDate);
          if (flights && flights.length > 0) {
            setFileData(flights as any); // Reusing fileData for parsed flights
            toast.success(`Se encontraron ${flights.length} vuelos en la imagen.`, { id: toastId });
          } else {
            toast.error("No se encontraron vuelos válidos en la imagen.", { id: toastId });
          }
        } catch (error: any) {
          toast.error(error.message, { id: toastId });
        } finally {
          setLoading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (e) {
      toast.error("Error leyendo la imagen", { id: toastId });
      setLoading(false);
    }
  };

  const processParsedData = (data: any[]) => {
    const flights: ManualFlightInput[] = data
      .filter((row: any) => row.num || row.flightNumber)
      .map((row: any) => ({
        flightNumber: String(row.num || row.flightNumber),
        aircraft: String(row.type || row.aircraft || 'Desconocido'),
        aircraftReg: String(row.reg || row.aircraftReg || ''),
        origin: String(row.ori || row.origin || ''),
        originName: String(row.oriName || row.originName || ''),
        destination: String(row.des || row.destination || ''),
        destinationName: String(row.desName || row.destinationName || ''),
        departureTimeLocal: String(row.dep || row.departureTimeLocal || ''),
        arrivalTimeLocal: String(row.arr || row.arrivalTimeLocal || ''),
        airline: String(row.airline || 'Air Panama'),
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
    try {
      await addMultipleManualFlights(fileData);
      toast.success("Vuelos subidos correctamente");
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error("Error al subir: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveManual = async () => {
    if (!fNum || !fOri || !fDes || !fDep || !fArr) {
      toast.error("Por favor completa todos los campos del vuelo");
      return;
    }
    setLoading(true);
    try {
      const newFlight: ManualFlightInput = {
        flightNumber: fNum,
        aircraft: 'Desconocido',
        aircraftReg: '',
        origin: fOri.toUpperCase(),
        originName: '',
        destination: fDes.toUpperCase(),
        destinationName: '',
        departureTimeLocal: fDep,
        arrivalTimeLocal: fArr,
        airline: fAirline,
        pilot: '',
        paxCount: 0,
        paxMax: 0,
        flightDate: fDate
      };
      // Aquí también deberíamos usar addMultipleManualFlights para la lógica de duplicados, o dejar addManualFlight. Como la lógica está en addMultiple, la usaremos.
      await addMultipleManualFlights([newFlight]);
      toast.success("Vuelo agregado correctamente");
      setFNum(""); setFOri(""); setFDes(""); setFDep(""); setFArr(""); setFDate(todayStr);
      onSuccess();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-surface/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-surface-container-lowest rounded-[28px] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
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
          <div className="flex flex-col h-full">
            <div className="p-6 overflow-y-auto max-h-[60vh] flex flex-col gap-4">
              <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 text-on-surface flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-2xl">fact_check</span>
                <div>
                  <h3 className="font-label-lg font-bold text-primary mb-1">Confirmación de Vuelos</h3>
                  <p className="text-sm text-on-surface-variant">
                    Se han detectado <strong>{fileData.length}</strong> vuelos válidos. A continuación se muestran los primeros {Math.min(fileData.length, 10)} para que verifiques que el formato es correcto antes de importarlos a la base de datos.
                  </p>
                </div>
              </div>

              <div className="bg-surface-container rounded-2xl overflow-hidden border border-outline-variant/30">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-container-high text-on-surface-variant font-label-sm uppercase">
                    <tr>
                      <th className="px-4 py-3">Aerolínea</th>
                      <th className="px-4 py-3">Vuelo</th>
                      <th className="px-4 py-3">Ruta</th>
                      <th className="px-4 py-3">Horario</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20">
                    {fileData.slice(0, 10).map((f, i) => (
                      <tr key={i} className="hover:bg-surface-container-highest transition-colors">
                        <td className="px-4 py-3 font-medium text-on-surface">{f.airline}</td>
                        <td className="px-4 py-3 text-on-surface-variant">{f.flightNumber}</td>
                        <td className="px-4 py-3">
                          <span className="bg-surface-variant/50 px-2 py-0.5 rounded text-xs">{f.origin}</span>
                          <span className="mx-2 text-on-surface-variant/50">→</span>
                          <span className="bg-surface-variant/50 px-2 py-0.5 rounded text-xs">{f.destination}</span>
                        </td>
                        <td className="px-4 py-3 text-on-surface-variant">
                          {f.departureTimeLocal} - {f.arrivalTimeLocal}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {fileData.length > 10 && (
                  <div className="p-3 text-center text-xs text-on-surface-variant bg-surface-container-high/50 italic">
                    ... y {fileData.length - 10} vuelos más ocultos para resumir.
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-outline-variant/20 flex justify-end gap-3 bg-surface-container-low rounded-b-[28px] mt-auto">
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
                  <div className="flex items-center gap-3 bg-surface-container p-4 rounded-xl border border-white/5">
                    <span className="material-symbols-outlined text-primary">calendar_month</span>
                    <div className="flex flex-col flex-1">
                      <label className="text-xs font-bold text-on-surface-variant uppercase">Fecha de Referencia</label>
                      <span className="text-xs text-on-surface-variant/70">Fecha que se asignará si la foto no la incluye explícitamente</span>
                    </div>
                    <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} className="h-10 px-3 bg-surface-container-high rounded-lg border border-outline-variant/30 text-sm focus:ring-1 focus:ring-primary" />
                  </div>

                  <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-on-surface-variant text-sm flex gap-3">
                    <span className="material-symbols-outlined text-purple-500">auto_awesome</span>
                    <p>
                      Sube una foto o pantallazo del itinerario. La Inteligencia Artificial analizará la imagen y extraerá automáticamente los vuelos estructurados, sin importar el formato.
                    </p>
                  </div>
                  
                  <div 
                    className={`w-full h-32 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${loading ? 'border-primary/50 bg-primary/5' : 'border-outline-variant hover:bg-surface-container hover:border-primary'}`}
                    onClick={() => !loading && imageInputRef.current?.click()}
                  >
                    {loading ? (
                      <span className="material-symbols-outlined text-3xl text-primary animate-spin">sync</span>
                    ) : (
                      <span className="material-symbols-outlined text-3xl text-on-surface-variant">add_photo_alternate</span>
                    )}
                    <span className="font-label-md font-bold text-on-surface">
                      {loading ? 'Procesando con IA...' : 'Click para subir fotografía'}
                    </span>
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
                      <span className="text-xs text-on-surface-variant/70">Aplica a todos los vuelos si el archivo no tiene columna 'date'</span>
                    </div>
                    <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} className="h-10 px-3 bg-surface-container-high rounded-lg border border-outline-variant/30 text-sm focus:ring-1 focus:ring-primary" />
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
                <div className="grid grid-cols-2 gap-4">
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
                    <input type="text" value={fNum} onChange={e => setFNum(e.target.value)} className="h-10 px-3 bg-surface-container rounded-lg border border-white/5 focus:ring-1" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-on-surface-variant uppercase">Origen (Ej: PAC)</label>
                    <input type="text" value={fOri} onChange={e => setFOri(e.target.value)} className="h-10 px-3 bg-surface-container rounded-lg border border-white/5 focus:ring-1" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-on-surface-variant uppercase">Destino (Ej: DAV)</label>
                    <input type="text" value={fDes} onChange={e => setFDes(e.target.value)} className="h-10 px-3 bg-surface-container rounded-lg border border-white/5 focus:ring-1" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-on-surface-variant uppercase">Hora Salida (HH:mm)</label>
                    <input type="time" value={fDep} onChange={e => setFDep(e.target.value)} className="h-10 px-3 bg-surface-container rounded-lg border border-white/5 focus:ring-1" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-on-surface-variant uppercase">Hora Llegada (HH:mm)</label>
                    <input type="time" value={fArr} onChange={e => setFArr(e.target.value)} className="h-10 px-3 bg-surface-container rounded-lg border border-white/5 focus:ring-1" />
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
  );
}
