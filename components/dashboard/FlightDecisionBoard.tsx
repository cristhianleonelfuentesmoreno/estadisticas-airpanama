"use client";

import { useEffect, useState, useMemo } from "react";
import { getFlightDecisions, FlightDecision, StatusColor } from "@/app/actions/weather";
import { getUpcomingFlights, FlightData } from "@/app/actions/flights";

// Código IATA usado en los vuelos para cada estación TAF (ICAO)
const ICAO_TO_IATA: Record<string, string> = {
  MPDA: 'DAV',
  MPMG: 'PAC',
  MPTO: 'PTY',
  MPBO: 'BOC',
  MPCE: 'CTD',
};

const COLOR_STYLES: Record<StatusColor, { dot: string; text: string; chip: string; icon: string }> = {
  red: { dot: "bg-orange-500", text: "text-orange-600", chip: "border-orange-500/30 bg-orange-500/5", icon: "thunderstorm" },
  yellow: { dot: "bg-amber-500", text: "text-amber-600", chip: "border-amber-500/30 bg-amber-500/5", icon: "rainy" },
  green: { dot: "bg-emerald-500", text: "text-emerald-600", chip: "border-emerald-500/30 bg-emerald-500/5", icon: "sunny" },
};

// "RIESGO ALTO: TORMENTAS" -> "Tormentas"
function shortLabel(alert: string) {
  const label = alert.includes(':') ? alert.split(':')[1].trim() : alert;
  return label.charAt(0) + label.slice(1).toLowerCase();
}

function criticalPeriod(decision: FlightDecision) {
  return decision.forecasts.find(f => f.isCritical)?.shortPeriod ?? null;
}

export function FlightDecisionBoard() {
  const [decisions, setDecisions] = useState<FlightDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [expandedTaf, setExpandedTaf] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getFlightDecisions();
        setDecisions(data);
        setUpdatedAt(new Date());
      } catch (err) {
        console.error("Error loading flight decisions:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
    const interval = setInterval(loadData, 300000); // 5 min
    return () => clearInterval(interval);
  }, []);

  // Resumen de una línea pensado para gerencia
  const summary = useMemo(() => {
    const red = decisions.filter(d => d.statusColor === 'red');
    const yellow = decisions.filter(d => d.statusColor === 'yellow');
    const total = decisions.length;
    if (red.length > 0) {
      return { color: 'red' as StatusColor, text: `${shortLabel(red[0].shortAlert)} en ${red.length} de ${total} aeropuertos · posibles demoras` };
    }
    if (yellow.length > 0) {
      return { color: 'yellow' as StatusColor, text: `Precaución en ${yellow.length} de ${total} aeropuertos · condiciones marginales` };
    }
    return { color: 'green' as StatusColor, text: 'Clima favorable en todos los aeropuertos' };
  }, [decisions]);

  if (loading) {
    return (
      <div className="bg-surface-container-lowest rounded-xl p-space-sm border border-surface-container/50 shadow-sm animate-pulse flex flex-col gap-2">
        <div className="h-4 bg-surface-container-low rounded w-1/3"></div>
        <div className="h-10 bg-surface-container-low rounded-lg"></div>
      </div>
    );
  }

  if (decisions.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-xl px-space-sm py-2 border border-surface-container/50 text-on-surface-variant font-body-sm text-body-sm">
        Pronóstico del clima no disponible en este momento.
      </div>
    );
  }

  const summaryStyle = COLOR_STYLES[summary.color];

  return (
    <div className="bg-surface-container-lowest rounded-xl p-space-sm border border-surface-container/50 shadow-sm flex flex-col gap-2 font-sans">
      {/* Encabezado + resumen en una línea */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <span className={`material-symbols-outlined text-[20px] ${summaryStyle.text}`}>{summaryStyle.icon}</span>
          <div className="flex flex-col min-w-0">
            <span className="font-label-md text-label-md font-bold text-on-surface">{summary.text}</span>
            <span className="font-label-sm text-[11px] text-on-surface-variant">
              Clima próximas 8 h{updatedAt && ` · Act. ${updatedAt.toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' })}`}
            </span>
          </div>
        </div>
        <a href="https://aviationweather.gov/" target="_blank" rel="noreferrer" className="text-on-surface-variant hover:text-secondary font-label-sm text-[11px] flex items-center gap-0.5 shrink-0">
          NOAA
          <span className="material-symbols-outlined text-[12px]">open_in_new</span>
        </a>
      </div>

      {/* Un chip por aeropuerto: toca para ver detalle y vuelos afectados */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {decisions.map(decision => {
          const style = COLOR_STYLES[decision.statusColor];
          const period = decision.statusColor !== 'green' ? criticalPeriod(decision) : null;
          return (
            <button
              key={decision.icao}
              onClick={() => setExpandedTaf(decision.icao)}
              className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border ${style.chip} hover:bg-surface-container-low transition-colors text-left`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`}></span>
                <span className="font-label-md text-label-md font-bold text-on-surface truncate">{decision.name}</span>
              </div>
              <span className={`font-label-sm text-[11px] font-bold shrink-0 ${style.text}`}>
                {shortLabel(decision.shortAlert)}{period && ` ${period}`}
              </span>
            </button>
          );
        })}
      </div>

      {/* MODAL */}
      {expandedTaf && (
        <DecisionModal
          decision={decisions.find(d => d.icao === expandedTaf)!}
          onClose={() => setExpandedTaf(null)}
        />
      )}
    </div>
  );
}

// Subcomponents

function DecisionModal({ decision, onClose }: { decision: FlightDecision, onClose: () => void }) {
  if (!decision) return null;
  
  let headerBg = "bg-surface-container";
  let headerText = "text-on-surface";
  let badgeIcon = "check_circle";

  if (decision.statusColor === 'red') {
    headerBg = "bg-orange-500/20";
    headerText = "text-orange-500";
    badgeIcon = "warning";
  } else if (decision.statusColor === 'yellow') {
    headerBg = "bg-amber-500/20";
    headerText = "text-amber-500";
    badgeIcon = "visibility";
  } else if (decision.statusColor === 'green') {
    headerBg = "bg-emerald-500/20";
    headerText = "text-emerald-500";
    badgeIcon = "check";
  }

  return <DecisionModalContent decision={decision} onClose={onClose} headerBg={headerBg} headerText={headerText} badgeIcon={badgeIcon} />;
}

function DecisionModalContent({ decision, onClose, headerBg, headerText, badgeIcon }: { decision: FlightDecision, onClose: () => void, headerBg: string, headerText: string, badgeIcon: string }) {
  const [flights, setFlights] = useState<FlightData[] | null>(null);

  // Próximos vuelos de hoy que salen o llegan a esta estación
  useEffect(() => {
    const iata = ICAO_TO_IATA[decision.icao];
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' });
    getUpcomingFlights(today)
      .then(all => setFlights(all.filter(f =>
        (f.origin === iata || f.destination === iata) &&
        !f.isArchived && f.status !== 'ARRIBÓ' && f.status !== 'CANCELADO'
      )))
      .catch(() => setFlights([]));
  }, [decision.icao]);

  return (
    <div className="fixed inset-0 z-50 bg-primary/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-3xl bg-surface-container-lowest rounded-2xl flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b border-white/5 rounded-t-2xl ${headerBg}`}>
          <div className="flex items-center gap-3">
            <span className={`material-symbols-outlined text-[28px] ${headerText}`}>{badgeIcon}</span>
            <div className="flex flex-col">
              <span className="font-headline-sm text-headline-sm font-bold text-on-surface">{decision.name} ({decision.icao})</span>
              <span className={`font-label-md text-label-md font-bold uppercase ${headerText}`}>{decision.shortAlert}</span>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-6 overflow-y-auto max-h-[70vh]">
          {/* Evolución 8H */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-label-md text-label-md text-on-surface-variant font-bold uppercase tracking-wider">Evolución Ventana 8H</span>
              {decision.criticalWindow && (
                <span className="font-label-md text-label-md text-orange-500 font-bold">Ventana Crítica: {decision.criticalWindow}</span>
              )}
              {!decision.criticalWindow && decision.statusColor === 'green' && (
                <span className="font-label-md text-label-md text-emerald-500 font-bold">Condiciones Óptimas</span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {decision.forecasts.map((f, i) => {
                let blockBg = "bg-surface-container";
                let dotColor = "bg-emerald-500";
                let textColor = "text-on-surface";
                
                if (f.color === 'red') {
                  blockBg = "bg-orange-500/10 border-orange-500/20";
                  dotColor = "bg-orange-500";
                  textColor = "text-orange-500";
                } else if (f.color === 'yellow') {
                  blockBg = "bg-amber-500/10 border-amber-500/20";
                  dotColor = "bg-amber-500";
                  textColor = "text-amber-500";
                }

                return (
                  <div key={i} className={`flex flex-col gap-2 p-4 rounded-xl ${blockBg} border border-white/5`}>
                    <div className="flex items-center gap-2 font-label-md text-label-md font-bold text-on-surface">
                      <div className={`w-2.5 h-2.5 rounded-full ${dotColor}`}></div>
                      {f.shortPeriod}
                    </div>
                    <span className={`font-body-md text-body-md leading-tight ${textColor}`}>{f.text}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer / Flights & TAF Toggle */}
          <div className="border-t border-white/10 pt-6 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-on-surface-variant">flight_takeoff</span>
                <span className="font-label-md text-label-md text-on-surface-variant font-bold">Próximos vuelos de hoy en {decision.name}</span>
              </div>
              {flights === null ? (
                <span className="font-body-sm text-body-sm text-on-surface-variant">Cargando vuelos...</span>
              ) : flights.length === 0 ? (
                <span className="font-body-sm text-body-sm text-on-surface-variant">No hay vuelos pendientes hoy en esta estación.</span>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {flights.map(fl => (
                    <span key={fl.id} className="bg-surface-container px-3 py-1 rounded-md text-on-surface font-label-sm text-label-sm font-bold">
                      {fl.flightNumber} · {fl.origin}→{fl.destination} · {fl.departureTimeLocal}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 bg-surface-container-low rounded-xl border border-white/5 font-mono text-[13px] text-on-surface-variant leading-relaxed break-words whitespace-pre-wrap mt-2">
              <span className="font-bold text-on-surface block mb-2 uppercase text-[11px] tracking-wider">TAF Crudo:</span>
              {decision.rawTAF}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
