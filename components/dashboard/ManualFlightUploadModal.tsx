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

  // Manual Form State
  const [fNum, setFNum] = useState("");
  const [fOri, setFOri] = useState("");
  const [fDes, setFDes] = useState("");
  const [fDep, setFDep] = useState("");
  const [fArr, setFArr] = useState("");
  const [fAirline, setFAirline] = useState("Air Panama");

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
          const flights = await parseItineraryImage(base64Image);
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
    const today = new Date().toLocaleString("en-US", { timeZone: "America/Panama" });
    const todayStr = new Date(today).toISOString().split('T')[0];

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
        flightDate: todayStr
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
      toast.error("Llena todos los campos obligatorios");
      return;
    }
    setLoading(true);
    const today = new Date().toLocaleString("en-US", { timeZone: "America/Panama" });
    const todayStr = new Date(today).toISOString().split('T')[0];

    const flight: ManualFlightInput = {
      flightNumber: fNum,
      origin: fOri,
      originName: fOri,
      destination: fDes,
      destinationName: fDes,
      departureTimeLocal: fDep,
      arrivalTimeLocal: fArr,
      airline: fAirline,
      aircraft: 'N/A',
      aircraftReg: '',
      pilot: '',
      paxCount: 0,
      paxMax: 0,
      flightDate: todayStr
    };

    try {
      await addMultipleManualFlights([flight]);
      toast.success("Vuelo agregado correctamente");
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error("Error al guardar: " + error.message);
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

              {fileData.length > 0 && (
                <div className="mt-2 flex flex-col gap-2">
                  <h4 className="font-label-md font-bold text-on-surface flex justify-between items-center">
                    <span>Vista Previa ({fileData.length} vuelos detectados)</span>
                    <button onClick={() => setFileData([])} className="text-xs text-error hover:underline">Borrar resultados</button>
                  </h4>
                  <div className="bg-surface-container p-3 rounded-xl max-h-40 overflow-y-auto text-sm font-mono flex flex-col gap-1">
                    {fileData.map((f, i) => (
                      <div key={i}>✨ {f.airline} {f.flightNumber} | {f.origin} ➡️ {f.destination} ({f.departureTimeLocal} - {f.arrivalTimeLocal})</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="flex flex-col gap-4">
              <div className="p-4 rounded-2xl bg-primary-container/20 border border-primary/20 text-on-surface-variant text-sm flex gap-3">
                <span className="material-symbols-outlined text-primary">info</span>
                <p>
                  Sube un archivo Excel (.xlsx) o CSV con las columnas: <code>num, ori, des, dep, arr, airline, type, reg</code>.
                  El sistema cruzará estos datos y omitirá los que ya existan en los radares satelitales.
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

              {fileData.length > 0 && (
                <div className="mt-2 flex flex-col gap-2">
                  <h4 className="font-label-md font-bold text-on-surface">Vista Previa ({fileData.length} vuelos)</h4>
                  <div className="bg-surface-container p-3 rounded-xl max-h-40 overflow-y-auto text-sm font-mono flex flex-col gap-1">
                    {fileData.slice(0, 5).map((f, i) => (
                      <div key={i}>🚀 {f.airline} {f.flightNumber} | {f.origin} ➡️ {f.destination} ({f.departureTimeLocal} - {f.arrivalTimeLocal})</div>
                    ))}
                    {fileData.length > 5 && <div className="text-on-surface-variant opacity-70">... y {fileData.length - 5} más.</div>}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'manual' && (
            <div className="grid grid-cols-2 gap-4">
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

        {/* Footer */}
        <div className="p-6 border-t border-outline-variant/20 flex justify-end gap-3 bg-surface-container-low rounded-b-[28px]">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 rounded-full font-label-md font-bold text-on-surface-variant hover:bg-surface-variant transition-colors"
            disabled={loading}
          >
            Cancelar
          </button>
          
          {(activeTab === 'upload' || activeTab === 'image') ? (
            <button 
              onClick={handleSaveFile}
              disabled={loading || fileData.length === 0}
              className="px-6 py-2.5 rounded-full font-label-md font-bold bg-primary text-on-primary hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              {loading ? <span className="material-symbols-outlined animate-spin text-[18px]">sync</span> : <span className="material-symbols-outlined text-[18px]">save</span>}
              Guardar Vuelos
            </button>
          ) : (
            <button 
              onClick={handleSaveManual}
              disabled={loading}
              className="px-6 py-2.5 rounded-full font-label-md font-bold bg-primary text-on-primary hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              {loading ? <span className="material-symbols-outlined animate-spin text-[18px]">sync</span> : <span className="material-symbols-outlined text-[18px]">add</span>}
              Agregar Vuelo
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
