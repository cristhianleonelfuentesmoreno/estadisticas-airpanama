"use client";

export interface MalekFlight {
  id: string;
  fecha: string;
  aerolinea: string;
  numero_vuelo: string;
  origen: string;
  destino?: string;
  hora_itinerario_salida?: string;
  hora_real_salida?: string;
  hora_itinerario_llegada?: string;
  hora_real_llegada?: string;
  estado_final: string;
  pasajeros_abordo: number;
  capacidad_total: number;
  avion?: string;
  creado_en?: string;
  actualizado_en?: string;
}

export const getAirlineBadge = (airline: string) => {
  if (airline === 'Air Panama') return 'bg-red-600 text-white';
  if (airline === 'Copa Airlines') return 'bg-[#0032A0] text-white';
  return 'bg-slate-100 text-slate-700';
};

export const formatTime = (isoString?: string) => {
  if (!isoString) return '--:--';
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Panama' });
  } catch {
    return '--:--';
  }
};

// Minutos de diferencia entre la hora real y la de itinerario (0 si falta alguna)
export const getDelayMins = (real?: string, itinerario?: string) => {
  const r = new Date(real || '');
  const i = new Date(itinerario || '');
  if (isNaN(r.getTime()) || isNaN(i.getTime())) return 0;
  return Math.round((r.getTime() - i.getTime()) / 60000);
};

function TimeRow({ label, itin, real, showDelay }: { label: string; itin?: string; real?: string; showDelay: boolean }) {
  const delay = showDelay ? getDelayMins(real, itin) : 0;
  const isDelayed = delay > 10;
  return (
    <div className="flex items-center justify-between gap-2 text-[13px]">
      <span className="text-slate-500 w-12 shrink-0">{label}</span>
      <div className="flex items-center gap-1 flex-1">
        <span className="text-slate-400 line-through decoration-slate-300">{formatTime(itin)}</span>
        <span className="material-symbols-outlined text-[14px] text-slate-300">arrow_right_alt</span>
        <span className="font-bold text-slate-800">{formatTime(real ?? itin)}</span>
      </div>
      {showDelay && (
        <span className={`text-[12px] font-bold shrink-0 ${isDelayed ? 'text-rose-600' : 'text-emerald-600'}`}>
          {isDelayed ? `+${delay}m` : 'A tiempo'}
        </span>
      )}
    </div>
  );
}

// Vista de tarjeta para celular: la misma información de una fila de la tabla,
// apilada para leerse sin desplazarse de lado.
export function DailyFlightCard({ flight, showType, onEdit, onDelete }: {
  flight: MalekFlight;
  showType: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const paxCount = flight.pasajeros_abordo || 0;
  const paxMax = flight.capacidad_total || 100;
  const paxPct = Math.round((paxCount / paxMax) * 100);
  const isLlegada = !!flight.origen;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`w-9 h-9 rounded-lg ${getAirlineBadge(flight.aerolinea)} flex items-center justify-center font-bold text-[13px] shrink-0 uppercase`}>
            {flight.numero_vuelo.split('-')[0]}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-primary text-[15px] leading-tight">{flight.numero_vuelo}</span>
              <span className="flex items-center gap-0.5 font-bold text-[13px] text-slate-600">
                {isLlegada ? flight.origen : 'DAV'}
                <span className="material-symbols-outlined text-[13px] text-slate-400">arrow_forward</span>
                {isLlegada ? 'DAV' : flight.destino}
              </span>
            </div>
            <span className="text-[12px] text-slate-500 block truncate">
              {flight.aerolinea}{showType && ` · ${isLlegada ? 'Llegada' : 'Salida'}`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={onEdit} className="w-9 h-9 rounded-lg bg-slate-100 text-primary active:scale-95 transition-all flex items-center justify-center" title="Editar">
            <span className="material-symbols-outlined text-[18px]">edit</span>
          </button>
          <button onClick={onDelete} className="w-9 h-9 rounded-lg bg-red-50 text-red-500 active:scale-95 transition-all flex items-center justify-center" title="Eliminar">
            <span className="material-symbols-outlined text-[18px]">delete</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1 border-t border-slate-100 pt-2">
        <TimeRow
          label="Sale"
          itin={flight.hora_itinerario_salida}
          real={!isLlegada ? flight.hora_real_salida : undefined}
          showDelay={!isLlegada}
        />
        <TimeRow
          label="Llega"
          itin={flight.hora_itinerario_llegada}
          real={isLlegada ? flight.hora_real_llegada : undefined}
          showDelay={isLlegada}
        />
      </div>

      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[16px] text-slate-400">group</span>
        <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(paxPct, 100)}%` }}></div>
        </div>
        <span className="text-[12px] font-bold text-slate-700 shrink-0">{paxCount}/{paxMax} <span className="text-slate-400 font-semibold">({paxPct}%)</span></span>
      </div>
    </div>
  );
}
