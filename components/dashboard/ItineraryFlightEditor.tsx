"use client";

import { useId } from "react";
import { AIRPORTS } from "@/lib/airports";
import type { FleetKnowledge } from "@/lib/fleet/rules";
import type { ManualFlightInput } from "@/app/actions/manualFlights";

export type ReviewFlight = ManualFlightInput & { warnings?: string[] };

// Editor completo de un vuelo leído del itinerario (antes de importarlo).
// Cada cambio se aplica al momento; los avisos se recalculan en el modal.
export function ItineraryFlightEditor({ flight, kb, onChange, onRemove, onDone }: {
  flight: ReviewFlight;
  kb: FleetKnowledge | null;
  onChange: (patch: Partial<ReviewFlight>) => void;
  onRemove: () => void;
  onDone: () => void;
}) {
  const id = useId();
  const field = "h-11 px-3 rounded-xl bg-white border border-slate-200 text-slate-800 text-[15px] font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary w-full min-w-0";
  const label = "flex flex-col gap-1 min-w-0";
  const caption = "text-[11px] font-bold uppercase tracking-wider text-slate-500";

  const crewNames = (kb?.crew ?? []).filter(c => c.role !== "cabina").map(c => c.name);
  const cabinNames = (kb?.crew ?? []).filter(c => c.role === "cabina").map(c => c.name);
  const upper = (v: string) => v.toUpperCase();
  const toNumber = (v: string) => (v === "" ? undefined : Math.max(0, parseInt(v, 10) || 0));

  return (
    <div
      className="flex flex-col gap-4 p-4 md:p-5 bg-slate-50 border-y border-primary/20"
      onKeyDown={e => { if (e.key === "Escape") onDone(); }}
    >
      {!!flight.warnings?.length && (
        <div className="flex flex-wrap gap-1.5">
          {flight.warnings.map(w => (
            <span key={w} className="inline-flex items-center gap-1 text-[12px] font-medium text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">
              <span className="material-symbols-outlined text-[14px]">warning</span>{w}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <label className={label}>
          <span className={caption}>Vuelo</span>
          <input className={field} value={flight.flightNumber} onChange={e => onChange({ flightNumber: upper(e.target.value.trim()) })} />
        </label>
        <label className={label}>
          <span className={caption}>Aerolínea</span>
          <select className={field} value={flight.airline} onChange={e => onChange({ airline: e.target.value })}>
            <option value="Air Panama">Air Panama</option>
            <option value="Copa Airlines">Copa Airlines</option>
          </select>
        </label>
        <label className={label}>
          <span className={caption}>Salida</span>
          <input type="time" className={field} value={flight.departureTimeLocal || ""} onChange={e => onChange({ departureTimeLocal: e.target.value })} />
        </label>
        <label className={label}>
          <span className={caption}>Llegada</span>
          <input type="time" className={field} value={flight.arrivalTimeLocal || ""} onChange={e => onChange({ arrivalTimeLocal: e.target.value })} title="Se calcula con la duración de la ruta; puedes cambiarla" />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className={label}>
          <span className={caption}>Origen</span>
          <input list={`${id}-airports`} maxLength={4} className={`${field} uppercase`} value={flight.origin} onChange={e => onChange({ origin: upper(e.target.value.trim()) })} placeholder="Elige o escribe" />
        </label>
        <label className={label}>
          <span className={caption}>Destino</span>
          <input list={`${id}-airports`} maxLength={4} className={`${field} uppercase`} value={flight.destination} onChange={e => onChange({ destination: upper(e.target.value.trim()) })} placeholder="Elige o escribe" />
        </label>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <label className={label}>
          <span className={caption}>Matrícula</span>
          <input list={`${id}-regs`} className={`${field} uppercase`} value={flight.aircraftReg || ""} onChange={e => onChange({ aircraftReg: upper(e.target.value.trim()) })} placeholder="HP-1997" />
        </label>
        <label className={label}>
          <span className={caption}>Avión</span>
          <input list={`${id}-types`} className={`${field} uppercase`} value={flight.aircraft || ""} onChange={e => onChange({ aircraft: upper(e.target.value.trim()) })} placeholder="DH8D" />
        </label>
        <label className={`${label} col-span-2 md:col-span-1`}>
          <span className={caption}>Pasajeros / capacidad</span>
          <div className="flex items-center gap-2">
            <input type="number" inputMode="numeric" min={0} className={field} value={flight.paxCount ?? ""} onChange={e => onChange({ paxCount: toNumber(e.target.value) as number })} placeholder="Pax" aria-label="Pasajeros" />
            <span className="text-slate-400 font-bold">/</span>
            <input type="number" inputMode="numeric" min={0} className={field} value={flight.paxMax ?? ""} onChange={e => onChange({ paxMax: toNumber(e.target.value) as number })} placeholder="Cap." aria-label="Capacidad" />
          </div>
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className={label}>
          <span className={caption}>Pilotos (capitán / primer oficial)</span>
          <input list={`${id}-pilots`} className={`${field} uppercase`} value={flight.pilot || ""} onChange={e => onChange({ pilot: upper(e.target.value) })} placeholder="NOMBRE APELLIDO / NOMBRE APELLIDO" />
        </label>
        <label className={label}>
          <span className={caption}>Tripulantes de cabina</span>
          <input list={`${id}-cabin`} className={`${field} uppercase`} value={flight.cabin_crew || ""} onChange={e => onChange({ cabin_crew: upper(e.target.value) })} placeholder="Opcional · la C-208 no lleva" />
        </label>
      </div>

      <label className={label}>
        <span className={caption}>Notas</span>
        <input className={field} value={flight.notes || ""} onChange={e => onChange({ notes: e.target.value })} placeholder="Chárter, carga, ferry…" />
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onRemove} className="px-4 h-10 rounded-xl text-sm font-bold text-red-600 hover:bg-red-50 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[18px]">remove_circle</span>
          Quitar de la importación
        </button>
        <button type="button" onClick={onDone} className="px-5 h-10 rounded-xl text-sm font-bold bg-primary text-on-primary hover:bg-primary/90 shadow-sm flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[18px]">check</span>
          Listo
        </button>
      </div>

      {/* Sugerencias: flota, modelos, tripulación y aeropuertos de la base de conocimiento */}
      <datalist id={`${id}-airports`}>
        {AIRPORTS.map(a => <option key={a.code} value={a.code}>{a.name ?? a.code}</option>)}
      </datalist>
      <datalist id={`${id}-regs`}>
        {(kb?.aircraft ?? []).map(a => <option key={a.registration} value={a.registration}>{a.code}</option>)}
      </datalist>
      <datalist id={`${id}-types`}>
        {(kb?.types ?? []).map(t => <option key={t.code} value={t.code}>{t.name}</option>)}
      </datalist>
      <datalist id={`${id}-pilots`}>
        {crewNames.map(n => <option key={n} value={n} />)}
      </datalist>
      <datalist id={`${id}-cabin`}>
        {cabinNames.map(n => <option key={n} value={n} />)}
      </datalist>
    </div>
  );
}
