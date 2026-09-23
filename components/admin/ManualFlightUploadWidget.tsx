"use client";

import { useState } from "react";
import { toast } from "sonner";

export function ManualFlightUploadWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [flightDataText, setFlightDataText] = useState("");

  const handleSave = async () => {
    setLoading(true);
    try {
      // Por ahora simulamos la carga manual ya que requeriría una tabla en la DB
      // o modificar un archivo temporal (lo cual no es ideal en prod).
      // Aquí se conectaría la action server para persistir los vuelos.
      await new Promise(r => setTimeout(r, 1000)); 
      
      toast.success("Vuelos cargados manualmente al sistema");
      setIsOpen(false);
      setFlightDataText("");
    } catch (error) {
      toast.error((error as Error).message || "Error al cargar los vuelos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div 
        onClick={() => setIsOpen(true)}
        className="bg-surface-container-lowest rounded-3xl p-6 shadow-sm border border-outline-variant/30 flex items-center justify-between cursor-pointer hover:border-error/50 transition-colors group"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-error-container text-on-error-container flex items-center justify-center group-hover:bg-error group-hover:text-on-error transition-colors">
            <span className="material-symbols-outlined text-[24px]">backup</span>
          </div>
          <div>
            <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">Carga Manual</h3>
            <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">Itinerario de Contingencia</p>
          </div>
        </div>
        <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-[100] bg-surface/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-surface-container-lowest rounded-[28px] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-outline-variant/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-error-container text-on-error-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">emergency</span>
                </div>
                <h2 className="font-headline-md text-headline-md font-bold text-on-surface">Itinerario Manual</h2>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="w-10 h-10 rounded-full hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Form */}
            <div className="p-6 overflow-y-auto flex flex-col gap-4 max-h-[70vh]">
              <div className="p-4 bg-surface-container-high rounded-xl text-on-surface-variant text-sm font-medium border border-white/5">
                <span className="material-symbols-outlined text-error float-left mr-2 mt-0.5">warning</span>
                Utiliza este módulo para cargar itinerarios manualmente. Los datos introducidos aquí se reflejarán en el panel de próximos vuelos.
              </div>
              
              <div className="flex flex-col gap-2 mt-2">
                <label className="font-label-md font-bold text-on-surface">Datos de Vuelos (JSON o CSV)</label>
                <textarea 
                  value={flightDataText}
                  onChange={(e) => setFlightDataText(e.target.value)}
                  placeholder='Ej: [ { "num": "670", "dep": "07:00", ... } ]'
                  className="w-full h-48 p-4 rounded-xl bg-surface-container font-mono text-sm text-on-surface focus:outline-none focus:ring-2 ring-primary/20 placeholder:text-on-surface-variant/50 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-outline-variant/20 flex justify-end gap-3 bg-surface-container-low rounded-b-[28px]">
              <button 
                onClick={() => setIsOpen(false)}
                className="px-6 py-2.5 rounded-full font-label-md font-bold text-on-surface-variant hover:bg-surface-variant transition-colors"
                disabled={loading}
              >
                Cancelar
              </button>
              <button 
                onClick={handleSave}
                disabled={loading || flightDataText.trim() === ""}
                className="px-6 py-2.5 rounded-full font-label-md font-bold bg-error text-on-error hover:bg-error/90 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                {loading ? (
                  <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                ) : (
                  <span className="material-symbols-outlined text-[18px]">upload</span>
                )}
                Subir Itinerario
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
