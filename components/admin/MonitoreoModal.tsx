"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { getSupabaseUsage, type UsoSupabase } from "@/app/actions/monitoring";

// Consumo del plan gratuito de Supabase: cuánto espacio queda y qué tablas lo ocupan.
// Solo el administrador. Se consulta de nuevo cada vez que se abre la ventana.

const MB = 1024 * 1024;
const LIMITES = { db: 500 * MB, storage: 1024 * MB, egreso: 5 * 1024 * MB, mau: 50_000, pausaDias: 7 };

type Modulo = "Vuelos" | "Flota" | "Seguridad" | "Sistema";
const TABLAS: Record<string, { nombre: string; modulo: Modulo }> = {
  llegadas_malek_historico: { nombre: "Registro de llegadas", modulo: "Vuelos" },
  salidas_malek_historico: { nombre: "Registro de salidas", modulo: "Vuelos" },
  scheduled_flights: { nombre: "Itinerario programado", modulo: "Vuelos" },
  manual_flights_log: { nombre: "Vuelos del día (itinerario)", modulo: "Vuelos" },
  aircraft: { nombre: "Aeronaves", modulo: "Flota" },
  aircraft_types: { nombre: "Tipos de aeronave", modulo: "Flota" },
  flight_routes: { nombre: "Rutas", modulo: "Flota" },
  crew_members: { nombre: "Tripulación", modulo: "Flota" },
  perfiles: { nombre: "Cuentas del personal", modulo: "Seguridad" },
  sesiones: { nombre: "Sesiones y dispositivos", modulo: "Seguridad" },
  registros_auditoria: { nombre: "Bitácora de auditoría", modulo: "Seguridad" },
  solicitudes_eliminacion: { nombre: "Solicitudes de eliminación", modulo: "Seguridad" },
  metricas_navegacion: { nombre: "Velocidad de la app", modulo: "Seguridad" },
};
const MODULO_CLS: Record<Modulo, string> = {
  Vuelos: "bg-sky-500/10 text-sky-300 ring-sky-500/30",
  Flota: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
  Seguridad: "bg-rose-500/10 text-rose-300 ring-rose-500/30",
  Sistema: "bg-slate-500/10 text-slate-300 ring-slate-500/30",
};
const FILTROS: ("Todas" | Modulo)[] = ["Todas", "Vuelos", "Flota", "Seguridad", "Sistema"];

function peso(bytes: number) {
  if (bytes >= MB) return `${(bytes / MB).toFixed(bytes >= 100 * MB ? 0 : 1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}
const pct = (v: number, max: number) => (v / max) * 100;
const pctTxt = (p: number) => (p < 0.1 && p > 0 ? "< 0,1 %" : `${p.toFixed(1).replace(".", ",")} %`);
const num = (n: number) => n.toLocaleString("es-PA");

function estado(p: number) {
  if (p < 50) return { bar: "bg-emerald-400", text: "text-emerald-300", label: "Óptimo y seguro" };
  if (p < 80) return { bar: "bg-amber-400", text: "text-amber-300", label: "Vigilar" };
  return { bar: "bg-red-500", text: "text-red-300", label: "Casi al límite" };
}

type Fila = { tabla: string; nombre: string; modulo: Modulo; filas: number | null; bytes: number };

export function MonitoreoButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="h-11 px-4 rounded-xl border border-emerald-600/40 bg-emerald-950 text-emerald-300 hover:bg-emerald-900 font-bold flex items-center gap-2 shadow-sm"
      >
        <span className="material-symbols-outlined text-[20px]">monitor_heart</span>
        Monitoreo
      </button>
      {open && <MonitoreoModal onClose={() => setOpen(false)} />}
    </>
  );
}

function MonitoreoModal({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<UsoSupabase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]>("Todas");
  const [buscar, setBuscar] = useState("");

  const cargar = useCallback(() => {
    setCargando(true);
    getSupabaseUsage()
      .then(d => { setData(d); setError(null); })
      .catch(e => setError((e as Error).message))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    getSupabaseUsage()
      .then(d => { if (!cancelled) { setData(d); setError(null); } })
      .catch(e => { if (!cancelled) setError((e as Error).message); })
      .finally(() => { if (!cancelled) setCargando(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const filas = useMemo<Fila[]>(() => {
    if (!data) return [];
    const tablas: Fila[] = data.tablas.map(t => ({
      tabla: t.tabla,
      nombre: TABLAS[t.tabla]?.nombre ?? t.tabla,
      modulo: TABLAS[t.tabla]?.modulo ?? "Sistema",
      filas: t.filas,
      bytes: t.bytes,
    }));
    const sumaTablas = tablas.reduce((s, t) => s + t.bytes, 0);
    // Lo que Supabase ocupa por su cuenta (cuentas de acceso, archivos, catálogos internos)
    tablas.push({ tabla: "auth · storage · pg_catalog", nombre: "Base interna de Supabase", modulo: "Sistema", filas: null, bytes: Math.max(0, data.db_bytes - sumaTablas) });
    return tablas.sort((a, b) => b.bytes - a.bytes);
  }, [data]);

  const visibles = filas.filter(f =>
    (filtro === "Todas" || f.modulo === filtro) &&
    (!buscar.trim() || `${f.nombre} ${f.tabla} ${f.modulo}`.toLowerCase().includes(buscar.trim().toLowerCase()))
  );

  const dbPct = data ? pct(data.db_bytes, LIMITES.db) : 0;
  const stPct = data ? pct(data.storage_bytes, LIMITES.storage) : 0;
  const peor = estado(Math.max(dbPct, stPct));
  const diasInactivo = data?.ultima_actividad ? (new Date(data.medido_en).getTime() - new Date(data.ultima_actividad).getTime()) / 86_400_000 : null;
  const totalFilas = filas.reduce((s, f) => s + (f.filas ?? 0), 0);
  const mayor = filas.find(f => f.filas !== null);
  const interna = filas.find(f => f.filas === null);
  const panelUso = data ? `https://supabase.com/dashboard/project/${data.proyecto}/usage` : "#";

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="monitoreo-title"
        onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-5xl max-h-[94vh] bg-[#0d1117] text-slate-100 rounded-t-3xl sm:rounded-3xl border border-white/10 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300"
      >
        {/* Encabezado */}
        <div className="flex items-start gap-4 px-5 sm:px-7 pt-6 pb-5 border-b border-white/10">
          <div className="hidden sm:flex w-14 h-14 shrink-0 rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/30 items-center justify-center">
            <span className="material-symbols-outlined text-emerald-400 text-[30px]">monitor_heart</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="monitoreo-title" className="text-xl sm:text-2xl font-bold">Monitoreo de Base de Datos</h2>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold tracking-wider bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/30">EN VIVO</span>
            </div>
            <p className="text-sm text-slate-400 mt-1">Límites del plan gratuito de Supabase y lo que ocupa cada tabla.</p>
          </div>
          <button onClick={cargar} disabled={cargando} className="h-10 px-3 sm:px-4 rounded-xl bg-white/5 hover:bg-white/10 ring-1 ring-white/10 text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
            <span className={`material-symbols-outlined text-[18px] ${cargando ? "animate-spin" : ""}`}>refresh</span>
            <span className="hidden sm:inline">Actualizar</span>
          </button>
          <button onClick={onClose} aria-label="Cerrar" className="w-10 h-10 shrink-0 rounded-xl hover:bg-white/10 text-slate-400 flex items-center justify-center">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-6 flex flex-col gap-6">
          {error ? (
            <p className="py-10 text-center text-red-300 bg-red-500/10 rounded-2xl">No se pudo consultar Supabase: {error}</p>
          ) : !data ? (
            <p className="py-16 text-center text-slate-400 animate-pulse">Consultando Supabase…</p>
          ) : (
            <>
              {/* Tarjetas de límites */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Tarjeta icon="database" titulo="Base de datos" plan="Gratis 500 MB" planCls="text-emerald-300 ring-emerald-500/30 bg-emerald-500/10"
                  valor={peso(data.db_bytes)} de="/ 500 MB" porcentaje={dbPct}
                  izq={`${pctTxt(dbPct)} usado`} der={`${peso(LIMITES.db - data.db_bytes)} libres`} derCls={estado(dbPct).text} />
                <Tarjeta icon="cloud_upload" titulo="Archivos (Storage)" plan="Gratis 1 GB" planCls="text-amber-300 ring-amber-500/30 bg-amber-500/10"
                  valor={peso(data.storage_bytes)} de="/ 1 024 MB" porcentaje={stPct}
                  izq={`${num(data.storage_archivos)} archivo${data.storage_archivos === 1 ? "" : "s"}`} der={`${pctTxt(stPct)} usado`} derCls={estado(stPct).text} />
                <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-4 flex flex-col">
                  <Cabecera icon="swap_vert" titulo="Transferencia" plan="Gratis 5 GB/mes" planCls="text-sky-300 ring-sky-500/30 bg-sky-500/10" />
                  <p className="text-[13px] text-slate-400 mt-3 leading-snug flex-1">
                    Lo que se descarga de Supabase al usar la app. Supabase no lo expone a la base de datos; se ve en su panel.
                  </p>
                  <a href={panelUso} target="_blank" rel="noopener noreferrer" className="mt-3 text-sm font-semibold text-sky-300 hover:text-sky-200 inline-flex items-center gap-1">
                    Ver consumo del mes <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                  </a>
                </div>
                <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-4">
                  <Cabecera icon="verified_user" titulo="Usuarios y estado" plan="50 000 MAU" planCls="text-emerald-300 ring-emerald-500/30 bg-emerald-500/10" />
                  <p className="mt-3"><span className="text-3xl font-bold">{num(data.usuarios_mes)}</span> <span className="text-sm text-slate-400">activos este mes</span></p>
                  <Barra porcentaje={pct(data.usuarios_mes, LIMITES.mau)} />
                  <div className="flex justify-between gap-2 mt-2 text-[13px]">
                    <span className="text-slate-400">{num(data.usuarios_total)} cuentas</span>
                    {diasInactivo !== null && diasInactivo < 5
                      ? <span className="text-emerald-300 font-semibold">Sin riesgo de pausa</span>
                      : <span className="text-amber-300 font-semibold">Pausa a los 7 días sin uso</span>}
                  </div>
                </div>
              </div>

              {/* Diagnóstico */}
              <div className="rounded-2xl bg-emerald-500/[0.06] ring-1 ring-emerald-500/20 p-4 sm:p-5 flex gap-4">
                <span className={`material-symbols-outlined text-[32px] ${peor.text}`}>{Math.max(dbPct, stPct) < 80 ? "check_circle" : "warning"}</span>
                <div className="flex-1 min-w-0 text-[14px] leading-relaxed text-slate-300">
                  <p className="font-bold text-slate-100 text-base">Diagnóstico de capacidad: <span className={peor.text}>{peor.label}</span></p>
                  <p className="mt-1">
                    Hay <strong className="text-slate-100">{num(totalFilas)} registros</strong> en total.
                    {mayor && <> La tabla más grande es <strong className="text-slate-100">{mayor.nombre}</strong> ({peso(mayor.bytes)}).</>}
                    {" "}Quedan <strong className={estado(dbPct).text}>{peso(LIMITES.db - data.db_bytes)}</strong> libres en la base de datos.
                    {interna && interna.bytes > data.db_bytes / 2 && <>{" "}La mayor parte del espacio usado es la base interna de Supabase, que casi no crece.</>}
                  </p>
                  <p className="mt-1 text-slate-400 text-[13px]">
                    Última actividad: {data.ultima_actividad ? new Date(data.ultima_actividad).toLocaleString("es-PA", { dateStyle: "medium", timeStyle: "short" }) : "—"}.
                    {" "}El plan gratuito pausa el proyecto si pasa {LIMITES.pausaDias} días sin uso (se reactiva desde el panel de Supabase).
                  </p>
                </div>
                <span className="hidden md:flex items-start gap-1 text-[12px] text-slate-500 whitespace-nowrap">
                  <span className="material-symbols-outlined text-[16px]">schedule</span>
                  {new Date(data.medido_en).toLocaleTimeString("es-PA")}
                </span>
              </div>

              {/* Desglose por tabla */}
              <div className="flex flex-col gap-3">
                <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-400">stacks</span>
                    Desglose por tabla
                    <span className="px-2 py-0.5 rounded-lg bg-white/5 ring-1 ring-white/10 text-[12px] font-medium text-slate-400">{data.tablas.length} tablas</span>
                  </h3>
                  <div className="lg:ml-auto flex flex-wrap gap-2">
                    {FILTROS.map(f => (
                      <button key={f} onClick={() => setFiltro(f)}
                        className={`px-3 h-8 rounded-lg text-sm font-semibold ${filtro === f ? "bg-emerald-500 text-white" : "bg-white/5 text-slate-300 hover:bg-white/10"}`}>
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-[20px]">search</span>
                  <input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Buscar tabla o concepto (ej.: llegadas, bitácora, sesiones)…"
                    className="w-full h-11 pl-10 pr-3 rounded-xl bg-white/[0.03] ring-1 ring-white/10 focus:ring-emerald-500/50 outline-none text-sm placeholder:text-slate-500" />
                </label>

                <div className="overflow-x-auto rounded-2xl ring-1 ring-white/10">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead className="bg-white/[0.04] text-[11px] uppercase tracking-wider text-slate-400">
                      <tr>
                        <th className="px-4 py-3 text-left">Tabla y descripción</th>
                        <th className="px-4 py-3 text-left">Módulo</th>
                        <th className="px-4 py-3 text-right">Registros</th>
                        <th className="px-4 py-3 text-right">Peso</th>
                        <th className="px-4 py-3 text-right w-48">% de la base</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibles.map(f => {
                        const p = pct(f.bytes, data.db_bytes);
                        return (
                          <tr key={f.tabla} className="border-t border-white/5 hover:bg-white/[0.02]">
                            <td className="px-4 py-3">
                              <p className="font-semibold text-slate-100">{f.nombre}</p>
                              <p className="font-mono text-[12px] text-slate-500">{f.tabla}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-md text-[12px] font-semibold ring-1 ${MODULO_CLS[f.modulo]}`}>{f.modulo}</span>
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">{f.filas === null ? "—" : num(f.filas)}</td>
                            <td className="px-4 py-3 text-right font-mono text-slate-300">{peso(f.bytes)}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-2">
                                <span className="font-mono text-[12px] text-slate-400 w-16 text-right">{pctTxt(p)}</span>
                                <div className="w-20 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                  <div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.max(2, p)}%` }} />
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {visibles.length === 0 && (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Ninguna tabla coincide con la búsqueda.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="text-[12px] text-slate-500">El peso incluye los índices (lo que hace rápidas las búsquedas). Los registros se cuentan uno por uno al abrir esta ventana.</p>
              </div>
            </>
          )}
        </div>

        {/* Pie */}
        <div className="px-5 sm:px-7 py-4 border-t border-white/10 flex items-center justify-between gap-3">
          <p className="text-[13px] text-slate-400 flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-[18px] text-slate-500">dns</span>
            <span className="truncate">Proyecto Supabase: <strong className="text-slate-200 font-mono">{data?.proyecto ?? "…"}</strong></span>
          </p>
          <button onClick={onClose} className="h-10 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold shrink-0">Entendido</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Cabecera({ icon, titulo, plan, planCls }: { icon: string; titulo: string; plan: string; planCls: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-slate-400">
        <span className="material-symbols-outlined text-[18px]">{icon}</span>{titulo}
      </p>
      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ring-1 whitespace-nowrap ${planCls}`}>{plan}</span>
    </div>
  );
}

function Barra({ porcentaje }: { porcentaje: number }) {
  return (
    <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
      <div className={`h-full rounded-full ${estado(porcentaje).bar}`} style={{ width: `${Math.min(100, Math.max(2, porcentaje))}%` }} />
    </div>
  );
}

function Tarjeta(p: { icon: string; titulo: string; plan: string; planCls: string; valor: string; de: string; porcentaje: number; izq: string; der: string; derCls: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-4">
      <Cabecera icon={p.icon} titulo={p.titulo} plan={p.plan} planCls={p.planCls} />
      <p className="mt-3"><span className="text-3xl font-bold">{p.valor}</span> <span className="text-sm text-slate-400">{p.de}</span></p>
      <Barra porcentaje={p.porcentaje} />
      <div className="flex justify-between gap-2 mt-2 text-[13px]">
        <span className="text-slate-400">{p.izq}</span>
        <span className={`font-semibold ${p.derCls}`}>{p.der}</span>
      </div>
    </div>
  );
}
