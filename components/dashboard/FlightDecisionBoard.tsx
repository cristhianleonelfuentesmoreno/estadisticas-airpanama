"use client";

import { useEffect, useState, useMemo } from "react";
import { getFlightDecisions, FlightDecision } from "@/app/actions/weather";

type FilterType = 'all' | 'red' | 'yellow' | 'green';

export function FlightDecisionBoard() {
  const [decisions, setDecisions] = useState<FlightDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedTaf, setExpandedTaf] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getFlightDecisions();
        setDecisions(data);
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

  const { counts, filteredDecisions, globalAlert } = useMemo(() => {
    const counts = {
      all: decisions.length,
      red: decisions.filter(d => d.statusColor === 'red').length,
      yellow: decisions.filter(d => d.statusColor === 'yellow').length,
      green: decisions.filter(d => d.statusColor === 'green').length,
    };

    const filteredDecisions = decisions.filter(d => {
      if (filter === 'all') return true;
      return d.statusColor === filter;
    });

    // Determine global alert
    let globalAlert = null;
    if (counts.red > 0) {
      const redStations = decisions.filter(d => d.statusColor === 'red');
      const worstAlert = redStations[0]?.shortAlert || "RIESGO ALTO: TORMENTAS";
      globalAlert = {
        title: worstAlert.includes('TORMENTAS') ? "Alerta de Tormentas Severas" : worstAlert.includes('NIEBLA') ? "Alerta de Visibilidad Crítica" : "Alerta Operativa Severa",
        subtitle: `Múltiples Estaciones • Próximas 8 Horas`,
        level: "DEFCON OPS-2",
        redCount: counts.red,
        yellowCount: counts.yellow,
        greenCount: counts.green,
        redDesc: worstAlert,
      };
    } else if (counts.yellow > 0) {
      globalAlert = {
        title: "Vigilancia Meteorológica Activa",
        subtitle: `Condiciones marginales en progreso`,
        level: "DEFCON OPS-3",
        redCount: counts.red,
        yellowCount: counts.yellow,
        greenCount: counts.green,
        redDesc: "Riesgo Medio",
      };
    }

    return { counts, filteredDecisions, globalAlert };
  }, [decisions, filter]);

  if (loading) {
    return (
      <div className="bg-surface-container-lowest rounded-2xl p-space-md border border-white/5 shadow-sm animate-pulse flex flex-col gap-4">
        <div className="h-6 bg-surface-container-low rounded w-1/4"></div>
        <div className="h-32 bg-surface-container-low rounded-xl"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-space-sm font-sans">
      {/* HEADER & FILTERS */}
      <div className="flex flex-col gap-2 px-1 pb-1">
        <div className="flex items-center justify-between">
          <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">Pronóstico del Clima</h2>
          <a href="https://aviationweather.gov/" target="_blank" rel="noreferrer" className="text-secondary hover:underline font-label-sm text-label-sm flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">open_in_new</span>
            Fuente: NOAA
          </a>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
            <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">TAF Operacional a 8 Horas • Act. hace 4 min</span>
          </div>
          <span className="font-label-sm text-label-sm text-on-surface-variant font-medium opacity-50 hidden sm:block">CIC-AERO</span>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        <FilterBadge 
          label="Todas" count={counts.all} active={filter === 'all'} 
          onClick={() => setFilter('all')} color="default"
        />
        <FilterBadge 
          label="Con Alerta" count={counts.red} active={filter === 'red'} 
          onClick={() => setFilter('red')} color="red"
        />
        <FilterBadge 
          label="Vigilancia" count={counts.yellow} active={filter === 'yellow'} 
          onClick={() => setFilter('yellow')} color="yellow"
        />
        <FilterBadge 
          label="VFR Óptimo" count={counts.green} active={filter === 'green'} 
          onClick={() => setFilter('green')} color="green"
        />
      </div>

      {/* GLOBAL ALERT BANNER */}
      {globalAlert && filter === 'all' && (
        <div className="bg-surface-container-lowest rounded-xl p-space-md border border-orange-500/20 flex flex-col gap-space-md shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-space-sm">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                <span className="material-symbols-outlined text-[24px]">thunderstorm</span>
              </div>
              <div className="flex flex-col">
                <span className="font-headline-sm text-headline-sm font-bold text-on-surface">{globalAlert.title}</span>
                <span className="font-label-md text-label-md text-on-surface-variant">{globalAlert.subtitle}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 text-orange-500 rounded-full font-label-sm text-label-sm font-bold">
              <div className="w-2 h-2 rounded-full bg-orange-500"></div>
              {globalAlert.level}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-space-sm">
            <div className="bg-orange-500/5 border border-orange-500/10 rounded-lg p-space-sm flex flex-col items-center justify-center text-center">
              <span className="font-label-sm text-label-sm font-bold text-orange-500 uppercase">{globalAlert.redCount} ESTACION{globalAlert.redCount !== 1 ? 'ES' : ''}</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant leading-tight mt-1">Riesgo Alto<br/>{globalAlert.redDesc}</span>
            </div>
            <div className="bg-surface-container rounded-lg p-space-sm flex flex-col items-center justify-center text-center">
              <span className="font-label-sm text-label-sm font-bold text-amber-500 uppercase">{globalAlert.yellowCount} ESTACION{globalAlert.yellowCount !== 1 ? 'ES' : ''}</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant leading-tight mt-1">Monitoreo<br/>Bruma/Lluvia</span>
            </div>
            <div className="bg-surface-container-low rounded-lg p-space-sm flex flex-col items-center justify-center text-center">
              <span className="font-label-sm text-label-sm font-bold text-emerald-500 uppercase">{globalAlert.greenCount} ESTACION{globalAlert.greenCount !== 1 ? 'ES' : ''}</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant leading-tight mt-1">VFR<br/>Ilimitado</span>
            </div>
          </div>
        </div>
      )}

      {/* DECISION CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-sm">
        {filteredDecisions.map(decision => (
          <DecisionCard 
            key={decision.icao} 
            decision={decision} 
            onClick={() => setExpandedTaf(decision.icao)}
          />
        ))}
        {filteredDecisions.length === 0 && (
          <div className="col-span-1 lg:col-span-3 p-space-xl text-center text-on-surface-variant font-body-md text-body-md bg-surface-container-lowest rounded-xl border border-white/5">
            No hay estaciones que coincidan con el filtro.
          </div>
        )}
      </div>

      {/* MODAL */}
      {expandedTaf && (
        <DecisionModal 
          decision={filteredDecisions.find(d => d.icao === expandedTaf) || decisions.find(d => d.icao === expandedTaf)!}
          onClose={() => setExpandedTaf(null)} 
        />
      )}
    </div>
  );
}

// Subcomponents

function FilterBadge({ label, count, active, onClick, color }: { label: string, count: number, active: boolean, onClick: () => void, color: string }) {
  let bgClass = "bg-surface-container hover:bg-surface-container-high text-on-surface-variant border-transparent";
  let dotClass = "bg-on-surface-variant/50";
  
  if (active) {
    if (color === 'red') { bgClass = "bg-orange-500/15 border-orange-500/30 text-orange-500"; dotClass = "bg-orange-500"; }
    else if (color === 'yellow') { bgClass = "bg-amber-500/15 border-amber-500/30 text-amber-500"; dotClass = "bg-amber-500"; }
    else if (color === 'green') { bgClass = "bg-emerald-500/15 border-emerald-500/30 text-emerald-500"; dotClass = "bg-emerald-500"; }
    else { bgClass = "bg-surface-variant text-on-surface border-transparent"; dotClass = "bg-transparent hidden"; }
  } else {
    if (color === 'red') { dotClass = "bg-orange-500"; }
    else if (color === 'yellow') { dotClass = "bg-amber-500"; }
    else if (color === 'green') { dotClass = "bg-emerald-500"; }
  }

  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full font-label-md text-label-md font-medium border transition-all active:scale-95 outline-none focus:outline-none ${bgClass} shrink-0`}
    >
      {color !== 'default' && <div className={`w-2 h-2 rounded-full ${dotClass}`}></div>}
      {label} ({count})
    </button>
  );
}

function DecisionCard({ decision, onClick }: { decision: FlightDecision, onClick: () => void }) {
  let borderColor = "border-white/10";
  let topBorderColor = "border-t-surface-container-high";
  let badgeColor = "bg-surface-container text-on-surface-variant";
  let badgeIcon = "check_circle";

  if (decision.statusColor === 'red') {
    borderColor = "border-orange-500/20";
    topBorderColor = "border-t-orange-500";
    badgeColor = "bg-orange-500/15 text-orange-500";
    badgeIcon = "warning";
  } else if (decision.statusColor === 'yellow') {
    borderColor = "border-amber-500/20";
    topBorderColor = "border-t-amber-500";
    badgeColor = "bg-amber-500/15 text-amber-500";
    badgeIcon = "visibility";
  } else if (decision.statusColor === 'green') {
    borderColor = "border-emerald-500/20";
    topBorderColor = "border-t-emerald-500";
    badgeColor = "bg-emerald-500/10 text-emerald-500";
    badgeIcon = "check";
  }

  return (
    <div className={`bg-surface-container-lowest rounded-xl border ${borderColor} border-t-4 ${topBorderColor} shadow-sm overflow-hidden flex flex-col transition-all hover:bg-surface-container-low cursor-pointer`} onClick={onClick}>
      <div className="p-space-sm flex flex-col gap-3 w-full items-center text-center">
        <div className="flex flex-col items-center">
          <span className="font-display-sm text-display-sm font-bold text-on-surface">{decision.icao}</span>
          <span className="font-label-lg text-label-lg font-bold text-on-surface leading-tight mt-1">{decision.name}</span>
          <span className="font-label-sm text-[11px] text-on-surface-variant">{decision.fullName}</span>
        </div>
        <div className={`flex items-center w-full justify-center gap-1 px-2.5 py-1.5 rounded-md font-label-sm text-[11px] font-bold uppercase ${badgeColor}`}>
          <span className="material-symbols-outlined text-[16px]">{badgeIcon}</span>
          {decision.shortAlert}
        </div>
      </div>
    </div>
  );
}

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

  const mockedFlights = decision.icao === 'MPMG' ? ['PST-804', 'PST-702'] : 
                       decision.icao === 'MPTO' ? ['PST-201'] : 
                       decision.icao === 'MPDA' ? ['PST-405'] : [];

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
            <div className="flex flex-wrap items-center gap-2">
              {mockedFlights.length > 0 ? (
                <>
                  <span className="material-symbols-outlined text-[20px] text-on-surface-variant">flight_takeoff</span>
                  <span className="font-label-md text-label-md text-on-surface-variant font-bold">Vuelos afectados:</span>
                  <div className="flex flex-wrap gap-2">
                    {mockedFlights.map(fl => (
                      <span key={fl} className="bg-surface-container px-3 py-1 rounded-md text-on-surface font-label-sm text-label-sm font-bold">
                        {fl}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2 text-emerald-500">
                  <span className="material-symbols-outlined text-[20px]">check_circle</span>
                  <span className="font-label-md text-label-md font-bold">Condiciones Seguras para Vuelos</span>
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
