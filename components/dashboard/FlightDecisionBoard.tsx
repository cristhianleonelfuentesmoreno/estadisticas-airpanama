"use client";

import { useState, useEffect } from "react";
import { getFlightDecisions, FlightDecision, StatusColor } from "@/app/actions/weather";

function StatusIcon({ color }: { color: StatusColor }) {
  const colorMap = {
    green: "text-emerald-600 bg-emerald-100",
    yellow: "text-amber-600 bg-amber-100",
    red: "text-rose-600 bg-rose-100"
  };

  const iconMap = {
    green: "check_circle",
    yellow: "warning",
    red: "error"
  };

  return (
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${colorMap[color]}`}>
      <span className="material-symbols-outlined text-[28px]">{iconMap[color]}</span>
    </div>
  );
}

export function FlightDecisionBoard() {
  const [decisions, setDecisions] = useState<FlightDecision[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStation, setSelectedStation] = useState<FlightDecision | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    const data = await getFlightDecisions();
    setDecisions(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
    // Refrescar cada 15 minutos automáticamente
    const interval = setInterval(loadData, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="font-headline-sm font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">flight_takeoff</span>
            Panel de Decisión de Vuelos
          </h2>
          <p className="font-body-sm text-on-surface-variant">Pronósticos TAF operacionales a 8 horas</p>
        </div>
        <button 
          onClick={loadData}
          disabled={isLoading}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container-high hover:bg-surface-container-highest transition-colors text-on-surface"
        >
          <span className={`material-symbols-outlined ${isLoading ? 'animate-spin text-primary' : ''}`}>sync</span>
        </button>
      </div>

      {/* GRID */}
      {isLoading && decisions.length === 0 ? (
        <div className="flex justify-center p-8">
          <span className="material-symbols-outlined animate-spin text-primary text-3xl">sync</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {decisions.map(station => (
            <div key={station.icao} className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
              
              {/* LÍNEA SUPERIOR */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <StatusIcon color={station.statusColor} />
                  <div>
                    <h3 className="font-label-lg font-bold text-on-surface leading-tight">{station.name}</h3>
                    <span className="font-label-sm text-on-surface-variant uppercase tracking-widest">{station.icao}</span>
                  </div>
                </div>
              </div>

              {/* CENTRO: STATUS */}
              <div className="mb-4">
                <p className={`font-label-md font-bold ${
                  station.statusColor === 'green' ? 'text-emerald-700' : 
                  station.statusColor === 'yellow' ? 'text-amber-700' : 'text-rose-700'
                }`}>
                  {station.statusText}
                </p>
              </div>

              {/* LÍNEA INFERIOR: PRÓXIMAS HORAS (RESUMEN) */}
              <div className="flex-1">
                {station.forecasts.length > 0 ? (
                  <div className="space-y-2">
                    {station.forecasts.slice(0, 2).map((fcst, i) => (
                      <div key={i} className="flex gap-2">
                        <div className={`w-1 h-auto shrink-0 rounded-full ${
                          fcst.color === 'green' ? 'bg-emerald-400' : 
                          fcst.color === 'yellow' ? 'bg-amber-400' : 'bg-rose-400'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="font-label-sm text-[10px] text-on-surface-variant font-bold">{fcst.period}</p>
                          <p className="font-body-sm text-[11px] text-on-surface truncate" title={fcst.text}>{fcst.text}</p>
                        </div>
                      </div>
                    ))}
                    {station.forecasts.length > 2 && (
                      <p className="text-[10px] text-on-surface-variant text-right pt-1">+ {station.forecasts.length - 2} cambios más</p>
                    )}
                  </div>
                ) : (
                  <p className="font-body-sm text-xs text-on-surface-variant italic">No hay pronóstico en las próximas horas.</p>
                )}
              </div>

              {/* BOTON VER MÁS */}
              <button 
                onClick={() => setSelectedStation(station)}
                className="mt-4 w-full py-2 bg-surface-container hover:bg-surface-container-high rounded-xl font-label-sm font-bold text-primary transition-colors flex items-center justify-center gap-1"
              >
                Ver más detalles <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* MODAL VER MÁS */}
      {selectedStation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface-container-lowest w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="p-6 bg-surface-container-high flex items-start justify-between border-b border-outline-variant/30">
              <div className="flex items-center gap-4">
                <StatusIcon color={selectedStation.statusColor} />
                <div>
                  <h2 className="font-headline-sm font-bold text-on-surface">{selectedStation.name}</h2>
                  <p className="font-body-sm text-on-surface-variant uppercase">{selectedStation.icao} • {selectedStation.statusText}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedStation(null)}
                className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-variant flex items-center justify-center transition-colors"
              >
                <span className="material-symbols-outlined text-on-surface text-[20px]">close</span>
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              <h3 className="font-label-md font-bold text-on-surface mb-4 uppercase tracking-widest text-xs">Desglose de las próximas 8 horas</h3>
              
              <div className="space-y-4">
                {selectedStation.forecasts.map((fcst, i) => (
                  <div key={i} className="bg-surface-container p-4 rounded-2xl flex gap-4">
                     <div className={`w-1.5 h-auto shrink-0 rounded-full ${
                        fcst.color === 'green' ? 'bg-emerald-400' : 
                        fcst.color === 'yellow' ? 'bg-amber-400' : 'bg-rose-400'
                      }`} />
                      <div className="flex-1">
                        <p className="font-label-md text-on-surface-variant font-bold mb-1">{fcst.period}</p>
                        <p className="font-body-md text-on-surface">{fcst.text}</p>
                      </div>
                  </div>
                ))}
                {selectedStation.forecasts.length === 0 && (
                  <p className="text-on-surface-variant italic">No hay datos en el rango operativo actual.</p>
                )}
              </div>

              <div className="mt-8 pt-6 border-t border-outline-variant/30">
                <h3 className="font-label-md font-bold text-on-surface mb-2 uppercase tracking-widest text-xs">CÓDIGO TAF ORIGINAL (NOAA)</h3>
                <div className="bg-[#1e1e1e] rounded-xl p-4 overflow-x-auto">
                  <code className="text-[#d4d4d4] text-xs font-mono whitespace-pre-wrap">{selectedStation.rawTAF}</code>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
