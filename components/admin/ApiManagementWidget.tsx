"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { getApiConfigs, saveApiConfig, ApiConfig } from "@/app/actions/apiConfig";

export function ApiManagementWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [faKey, setFaKey] = useState("");
  const [faActive, setFaActive] = useState(true);
  
  const [frKey, setFrKey] = useState("");
  const [frActive, setFrActive] = useState(true);

  const [geminiKey, setGeminiKey] = useState("");
  const [geminiActive, setGeminiActive] = useState(true);

  const loadConfigs = async () => {
    try {
      const configs = await getApiConfigs();
      if (configs.flightaware) {
        setFaKey(configs.flightaware.api_key);
        setFaActive(configs.flightaware.is_active);
      }
      if (configs.flightradar24) {
        setFrKey(configs.flightradar24.api_key);
        setFrActive(configs.flightradar24.is_active);
      }
      if (configs.gemini) {
        setGeminiKey(configs.gemini.api_key);
        setGeminiActive(configs.gemini.is_active);
      }
    } catch (e) {
      console.error(e);
      toast.error("Error al cargar configuración de APIs");
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadConfigs();
    }
  }, [isOpen]);

  const handleSave = async () => {
    setLoading(true);
    try {
      await saveApiConfig('flightaware', faKey, faActive);
      await saveApiConfig('flightradar24', frKey, frActive);
      await saveApiConfig('gemini', geminiKey, geminiActive);
      toast.success("Configuración de APIs guardada correctamente");
      setIsOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Error al guardar configuración");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div 
        onClick={() => setIsOpen(true)}
        className="bg-surface-container-lowest rounded-3xl p-6 shadow-sm border border-outline-variant/30 flex items-center justify-between cursor-pointer hover:border-primary/50 transition-colors group"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center group-hover:bg-primary group-hover:text-on-primary transition-colors">
            <span className="material-symbols-outlined text-[24px]">key</span>
          </div>
          <div>
            <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">Gestión de API</h3>
            <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">Configurar FlightAware y FlightRadar24</p>
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
                <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">api</span>
                </div>
                <h2 className="font-headline-md text-headline-md font-bold text-on-surface">Gestión de API</h2>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="w-10 h-10 rounded-full hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Form */}
            <div className="p-6 overflow-y-auto flex flex-col gap-6 max-h-[70vh]">
              
              {/* FlightAware */}
              <div className="flex flex-col gap-4 p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30">
                <div className="flex justify-between items-center">
                  <h3 className="font-label-lg font-bold text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[20px]">flight_takeoff</span>
                    FlightAware (Copa Airlines)
                  </h3>
                  <label className="flex items-center cursor-pointer">
                    <div className="relative">
                      <input type="checkbox" className="sr-only" checked={faActive} onChange={(e) => setFaActive(e.target.checked)} />
                      <div className={`block w-14 h-8 rounded-full transition-colors ${faActive ? 'bg-primary' : 'bg-surface-variant'}`}></div>
                      <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${faActive ? 'transform translate-x-6' : ''}`}></div>
                    </div>
                  </label>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="font-label-md font-bold text-on-surface-variant">API Key</label>
                  <input 
                    type="password"
                    autoComplete="new-password"
                    name="fa_api_key_ignore"
                    data-1p-ignore="true"
                    data-lpignore="true"
                    spellCheck="false"
                    value={faKey}
                    onChange={(e) => setFaKey(e.target.value)}
                    placeholder="h5ky5A5GsPXo..."
                    className="w-full h-12 px-4 rounded-xl bg-surface-container font-body-md text-on-surface focus:outline-none focus:ring-2 ring-primary/20 placeholder:text-on-surface-variant/50"
                  />
                  <div className="flex items-center gap-1.5 mt-1 bg-emerald-500/10 px-3 py-2 rounded-lg border border-emerald-500/20">
                    <span className="material-symbols-outlined text-[16px] text-emerald-600">monitoring</span>
                    <span className="font-label-sm text-xs text-emerald-700 dark:text-emerald-400 font-medium">Consumo estimado: ~$4.20 / $5.00 mensuales (Caché optimizada)</span>
                  </div>
                </div>
              </div>

              {/* FlightRadar24 */}
              <div className="flex flex-col gap-4 p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30">
                <div className="flex justify-between items-center">
                  <h3 className="font-label-lg font-bold text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary text-[20px]">radar</span>
                    FlightRadar24 (Air Panama)
                  </h3>
                  <label className="flex items-center cursor-pointer">
                    <div className="relative">
                      <input type="checkbox" className="sr-only" checked={frActive} onChange={(e) => setFrActive(e.target.checked)} />
                      <div className={`block w-14 h-8 rounded-full transition-colors ${frActive ? 'bg-primary' : 'bg-surface-variant'}`}></div>
                      <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${frActive ? 'transform translate-x-6' : ''}`}></div>
                    </div>
                  </label>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="font-label-md font-bold text-on-surface-variant">API Key</label>
                  <input 
                    type="password"
                    autoComplete="new-password"
                    name="fr_api_key_ignore"
                    data-1p-ignore="true"
                    data-lpignore="true"
                    spellCheck="false"
                    value={frKey}
                    onChange={(e) => setFrKey(e.target.value)}
                    placeholder="01a0c440-1e8f..."
                    className="w-full h-12 px-4 rounded-xl bg-surface-container font-body-md text-on-surface focus:outline-none focus:ring-2 ring-primary/20 placeholder:text-on-surface-variant/50"
                  />
                  <div className="flex items-center gap-1.5 mt-1 bg-emerald-500/10 px-3 py-2 rounded-lg border border-emerald-500/20">
                    <span className="material-symbols-outlined text-[16px] text-emerald-600">monitoring</span>
                    <span className="font-label-sm text-xs text-emerald-700 dark:text-emerald-400 font-medium">Consumo estimado: ~26,000 / 60,000 créditos (Caché optimizada)</span>
                  </div>
                </div>
              </div>

              {/* Google Gemini */}
              <div className="flex flex-col gap-4 p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30">
                <div className="flex justify-between items-center">
                  <h3 className="font-label-lg font-bold text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-purple-500 text-[20px]">smart_toy</span>
                    Google Gemini (Extracción IA)
                  </h3>
                  <label className="flex items-center cursor-pointer">
                    <div className="relative">
                      <input type="checkbox" className="sr-only" checked={geminiActive} onChange={(e) => setGeminiActive(e.target.checked)} />
                      <div className={`block w-14 h-8 rounded-full transition-colors ${geminiActive ? 'bg-primary' : 'bg-surface-variant'}`}></div>
                      <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${geminiActive ? 'transform translate-x-6' : ''}`}></div>
                    </div>
                  </label>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="font-label-md font-bold text-on-surface-variant">API Key</label>
                  <input 
                    type="password"
                    autoComplete="new-password"
                    name="gemini_api_key_ignore"
                    data-1p-ignore="true"
                    data-lpignore="true"
                    spellCheck="false"
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full h-12 px-4 rounded-xl bg-surface-container font-body-md text-on-surface focus:outline-none focus:ring-2 ring-primary/20 placeholder:text-on-surface-variant/50"
                  />
                  <div className="flex items-center gap-1.5 mt-1 bg-emerald-500/10 px-3 py-2 rounded-lg border border-emerald-500/20">
                    <span className="material-symbols-outlined text-[16px] text-emerald-600">monitoring</span>
                    <span className="font-label-sm text-xs text-emerald-700 dark:text-emerald-400 font-medium">Costo: ~$0.00002 por foto analizada (Gratis hasta 1,500 fotos/día)</span>
                  </div>
                </div>
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
                disabled={loading}
                className="px-6 py-2.5 rounded-full font-label-md font-bold bg-primary text-on-primary hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-sm"
              >
                {loading ? (
                  <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                ) : (
                  <span className="material-symbols-outlined text-[18px]">save</span>
                )}
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
