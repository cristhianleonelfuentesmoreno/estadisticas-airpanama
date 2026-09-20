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
            <div className="w-2 h-2 rounded-full bg-error animate-pulse"></div>
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
        <div className="bg-surface-container-lowest rounded-xl p-space-md border border-error/20 flex flex-col gap-space-md shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-space-sm">
              <div className="w-10 h-10 rounded-xl bg-error/10 flex items-center justify-center text-error">
                <span className="material-symbols-outlined text-[24px]">thunderstorm</span>
              </div>
              <div className="flex flex-col">
                <span className="font-headline-sm text-headline-sm font-bold text-on-surface">{globalAlert.title}</span>
                <span className="font-label-md text-label-md text-on-surface-variant">{globalAlert.subtitle}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-error/10 text-error rounded-full font-label-sm text-label-sm font-bold">
              <div className="w-2 h-2 rounded-full bg-error"></div>
              {globalAlert.level}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-space-sm">
            <div className="bg-error/5 border border-error/10 rounded-lg p-space-sm flex flex-col items-center justify-center text-center">
              <span className="font-label-sm text-label-sm font-bold text-error uppercase">{globalAlert.redCount} ESTACION{globalAlert.redCount !== 1 ? 'ES' : ''}</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant leading-tight mt-1">Riesgo Alto<br/>{globalAlert.redDesc}</span>
            </div>
            <div className="bg-surface-container rounded-lg p-space-sm flex flex-col items-center justify-center text-center">
              <span className="font-label-sm text-label-sm font-bold text-error uppercase">{globalAlert.yellowCount} ESTACION{globalAlert.yellowCount !== 1 ? 'ES' : ''}</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant leading-tight mt-1">Monitoreo<br/>Bruma/Lluvia</span>
            </div>
            <div className="bg-surface-container-low rounded-lg p-space-sm flex flex-col items-center justify-center text-center">
              <span className="font-label-sm text-label-sm font-bold text-primary uppercase">{globalAlert.greenCount} ESTACION{globalAlert.greenCount !== 1 ? 'ES' : ''}</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant leading-tight mt-1">VFR<br/>Ilimitado</span>
            </div>
          </div>
        </div>
      )}

      {/* DECISION CARDS */}
      <div className="flex flex-col gap-space-sm">
        {filteredDecisions.map(decision => (
          <DecisionCard 
            key={decision.icao} 
            decision={decision} 
            isExpanded={expandedTaf === decision.icao}
            onToggleExpand={() => setExpandedTaf(expandedTaf === decision.icao ? null : decision.icao)}
          />
        ))}
        {filteredDecisions.length === 0 && (
          <div className="p-space-xl text-center text-on-surface-variant font-body-md text-body-md bg-surface-container-lowest rounded-xl border border-white/5">
            No hay estaciones que coincidan con el filtro.
          </div>
        )}
      </div>
    </div>
  );
}

// Subcomponents

function FilterBadge({ label, count, active, onClick, color }: { label: string, count: number, active: boolean, onClick: () => void, color: string }) {
  let bgClass = "bg-surface-container hover:bg-surface-container-high text-on-surface-variant border-transparent";
  let dotClass = "bg-on-surface-variant/50";
  
  if (active) {
    if (color === 'red') { bgClass = "bg-error/15 border-error text-error"; dotClass = "bg-error"; }
    else if (color === 'yellow') { bgClass = "bg-tertiary/15 border-tertiary text-tertiary"; dotClass = "bg-tertiary"; }
    else if (color === 'green') { bgClass = "bg-primary/15 border-primary text-primary"; dotClass = "bg-primary"; }
    else { bgClass = "bg-secondary-container text-on-secondary-container border-secondary-container"; dotClass = "bg-transparent hidden"; }
  } else {
    if (color === 'red') { dotClass = "bg-error"; }
    else if (color === 'yellow') { dotClass = "bg-tertiary"; }
    else if (color === 'green') { dotClass = "bg-primary"; }
  }

  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full font-label-md text-label-md font-medium border transition-all active:scale-95 ${bgClass} shrink-0`}
    >
      {color !== 'default' && <div className={`w-2 h-2 rounded-full ${dotClass}`}></div>}
      {label} ({count})
    </button>
  );
}

function DecisionCard({ decision, isExpanded, onToggleExpand }: { decision: FlightDecision, isExpanded: boolean, onToggleExpand: () => void }) {
  // Styles based on status
  let borderColor = "border-white/10";
  let topBorderColor = "border-t-surface-container-high";
  let badgeColor = "bg-surface-container text-on-surface-variant";
  let badgeIcon = "check_circle";

  if (decision.statusColor === 'red') {
    borderColor = "border-error/20";
    topBorderColor = "border-t-error";
    badgeColor = "bg-error/15 text-error";
    badgeIcon = "warning";
  } else if (decision.statusColor === 'yellow') {
    borderColor = "border-tertiary/20";
    topBorderColor = "border-t-tertiary";
    badgeColor = "bg-tertiary/15 text-tertiary";
    badgeIcon = "visibility";
  } else if (decision.statusColor === 'green') {
    borderColor = "border-primary/20";
    topBorderColor = "border-t-primary";
    badgeColor = "bg-primary/10 text-primary";
    badgeIcon = "check";
  }

  // Simulated flights
  const mockedFlights = decision.icao === 'MPMG' ? ['PST-804', 'PST-702'] : 
                       decision.icao === 'MPTO' ? ['PST-201'] : 
                       decision.icao === 'MPDA' ? ['PST-405'] : [];

  return (
    <div className={`bg-surface-container-lowest rounded-xl border ${borderColor} border-t-4 ${topBorderColor} shadow-sm overflow-hidden flex flex-col transition-all`}>
      {/* Header - Clickable to expand */}
      <button 
        onClick={onToggleExpand}
        className="p-space-sm flex items-start justify-between text-left hover:bg-surface-container-low transition-colors w-full"
      >
        <div className="flex items-center gap-space-sm">
          <span className="font-display-sm text-display-sm font-bold text-secondary shrink-0">{decision.icao}</span>
          <div className="flex flex-col">
            <span className="font-label-lg text-label-lg font-bold text-on-surface leading-tight">{decision.name}</span>
            <span className="font-label-sm text-label-sm text-on-surface-variant">{decision.fullName}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-label-sm text-label-sm font-bold uppercase ${badgeColor}`}>
            <span className="material-symbols-outlined text-[16px]">{badgeIcon}</span>
            {decision.shortAlert}
          </div>
          <span className="material-symbols-outlined text-on-surface-variant text-[20px] transition-transform duration-300" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            expand_more
          </span>
        </div>
      </button>

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
          {/* Evolución 8H */}
          <div className="px-space-sm pb-space-sm flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm text-on-surface-variant">Evolución Ventana 8H</span>
              {decision.criticalWindow && (
                <span className="font-label-sm text-label-sm text-error font-bold">Ventana Crítica: {decision.criticalWindow}</span>
              )}
              {!decision.criticalWindow && decision.statusColor === 'green' && (
                <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">Condiciones Óptimas</span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-space-xs">
              {decision.forecasts.map((f, i) => {
                let blockBg = "bg-surface-container";
                let dotColor = "bg-primary";
                let textColor = "text-on-surface";
                
                if (f.color === 'red') {
                  blockBg = "bg-error/10";
                  dotColor = "bg-error";
                  textColor = "text-error";
                } else if (f.color === 'yellow') {
                  blockBg = "bg-surface-container-high";
                  dotColor = "bg-tertiary";
                }

                return (
                  <div key={i} className={`flex flex-col gap-1 p-2 rounded-lg ${blockBg} border border-white/5`}>
                    <div className="flex items-center gap-1.5 font-label-sm text-label-sm font-bold text-on-surface">
                      <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></div>
                      {f.shortPeriod}
                    </div>
                    <span className={`font-body-sm text-body-sm leading-tight ${textColor}`}>{f.text}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer / Flights & TAF Toggle */}
          <div className="px-space-sm py-3 border-t border-white/5 flex flex-col gap-3 bg-surface-container-lowest">
            <div className="flex flex-wrap items-center gap-2">
              {mockedFlights.length > 0 ? (
                <>
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant">flight_takeoff</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">Vuelos afectados:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {mockedFlights.map(fl => (
                      <span key={fl} className="bg-surface-container px-2 py-0.5 rounded text-on-surface font-label-sm text-label-sm font-bold">
                        {fl}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-1.5 text-primary">
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  <span className="font-label-sm text-label-sm font-medium">Condiciones Seguras para Vuelos</span>
                </div>
              )}
            </div>
            
            <div className="p-2 bg-surface-container rounded border border-white/5 font-mono text-[11px] text-on-surface-variant leading-relaxed break-words whitespace-pre-wrap mt-1">
              <span className="font-bold text-on-surface block mb-1">TAF Crudo:</span>
              {decision.rawTAF}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
