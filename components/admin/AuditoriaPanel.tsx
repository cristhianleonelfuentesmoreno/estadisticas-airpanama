"use client";

import { useEffect, useState } from "react";
import { getAuditLogs, getAuditPeople, type AuditCategoria, type AuditLog } from "@/app/actions/audit";
import type { TipoEventoAuditoria } from "@/lib/audit";
import { ROLE_LABEL, toRole } from "@/lib/permissions";

// Bitácora de auditoría: todo lo que hace cada persona, con filtros. Solo lectura:
// en la base de datos nadie puede editar ni borrar un registro.

const CATEGORIAS: { id: AuditCategoria; label: string }[] = [
  { id: "todos", label: "Todo" },
  { id: "vuelos", label: "Vuelos" },
  { id: "solicitudes", label: "Solicitudes" },
  { id: "datos", label: "Importar / Exportar" },
  { id: "accesos", label: "Accesos" },
  { id: "usuarios", label: "Usuarios y config." },
  { id: "navegacion", label: "Navegación" },
  { id: "fallas", label: "Fallas" },
];

const STYLE: Record<TipoEventoAuditoria, { icon: string; label: string; tone: string }> = {
  inicio_sesion: { icon: "login", label: "Entró", tone: "bg-emerald-100 text-emerald-700" },
  cierre_sesion: { icon: "logout", label: "Salió", tone: "bg-slate-100 text-slate-600" },
  acceso_fallido: { icon: "warning", label: "Acceso fallido", tone: "bg-amber-100 text-amber-700" },
  creacion: { icon: "add_circle", label: "Agregó", tone: "bg-sky-100 text-sky-700" },
  edicion: { icon: "edit", label: "Editó", tone: "bg-blue-100 text-blue-700" },
  aprobacion: { icon: "task_alt", label: "Aprobó", tone: "bg-emerald-100 text-emerald-700" },
  eliminacion: { icon: "delete", label: "Eliminó", tone: "bg-red-100 text-red-700" },
  restauracion: { icon: "restore", label: "Restauró", tone: "bg-teal-100 text-teal-700" },
  solicitud_eliminacion: { icon: "outgoing_mail", label: "Solicitó eliminar", tone: "bg-amber-100 text-amber-800" },
  resolucion_solicitud: { icon: "rule", label: "Resolvió solicitud", tone: "bg-violet-100 text-violet-700" },
  importacion: { icon: "upload_file", label: "Importó", tone: "bg-indigo-100 text-indigo-700" },
  exportacion: { icon: "download", label: "Exportó", tone: "bg-indigo-100 text-indigo-700" },
  navegacion: { icon: "near_me", label: "Navegó", tone: "bg-slate-100 text-slate-500" },
  alerta_sistema: { icon: "error", label: "Falla del sistema", tone: "bg-red-600 text-white" },
};

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString("es-PA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/Panama" });

const show = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));

type Person = { id: string; nombre: string; role: string };

export function AuditoriaPanel() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(30);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [categoria, setCategoria] = useState<AuditCategoria>("todos");
  const [usuarioId, setUsuarioId] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [texto, setTexto] = useState("");
  const [busqueda, setBusqueda] = useState(""); // texto aplicado (con pausa al escribir)
  const [incluirNavegacion, setIncluirNavegacion] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [tick, setTick] = useState(0);

  useEffect(() => { getAuditPeople().then(setPeople).catch(() => {}); }, []);

  // Pausa al escribir: no consultar con cada tecla
  useEffect(() => {
    const t = setTimeout(() => { setBusqueda(texto); setPagina(1); }, 400);
    return () => clearTimeout(t);
  }, [texto]);

  useEffect(() => {
    let cancelled = false;
    getAuditLogs({ categoria, usuarioId: usuarioId || undefined, desde: desde || undefined, hasta: hasta || undefined, texto: busqueda || undefined, pagina, incluirNavegacion })
      .then(res => {
        if (cancelled) return;
        setLogs(res.logs);
        setTotal(res.total);
        setPageSize(res.pageSize);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [categoria, usuarioId, desde, hasta, busqueda, pagina, incluirNavegacion, tick]);

  // Se actualiza sola cada 30 s mientras se mira la primera página
  useEffect(() => {
    if (pagina !== 1) return;
    const i = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(i);
  }, [pagina]);

  const change = (fn: () => void) => { fn(); setPagina(1); setLoading(true); };
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasFilters = categoria !== "todos" || usuarioId || desde || hasta || texto || incluirNavegacion;
  const selectedPerson = people.find(p => p.id === usuarioId);

  const inputCls = "h-10 px-3 rounded-xl bg-surface-container text-on-surface text-sm font-semibold border border-transparent focus:outline-none focus:ring-2 ring-primary/20";

  return (
    <section className="flex flex-col w-full bg-surface-container-lowest rounded-3xl p-5 md:p-7 shadow-sm border border-outline-variant/30 relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/20" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">policy</span>
            Bitácora de auditoría
          </h2>
          <p className="font-body-sm text-on-surface-variant mt-1">
            Quién hizo qué, cuándo y desde dónde. Nadie puede editar ni borrar estos registros.
          </p>
        </div>
        <span className="self-start md:self-center bg-surface-container-highest text-on-surface-variant px-3 py-1 rounded-full text-sm font-bold">
          {total.toLocaleString("es-PA")} eventos
        </span>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-3">
        {CATEGORIAS.map(c => (
          <button
            key={c.id}
            onClick={() => change(() => setCategoria(c.id))}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold transition-colors ${categoria === c.id ? "bg-on-surface text-surface-container-lowest" : "bg-surface-container hover:bg-surface-container-high text-on-surface"}`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-2">
        <select aria-label="Persona" value={usuarioId} onChange={e => change(() => setUsuarioId(e.target.value))} className={inputCls}>
          <option value="">Todas las personas</option>
          {people.map(p => <option key={p.id} value={p.id}>{p.nombre} · {ROLE_LABEL[toRole(p.role)]}</option>)}
        </select>
        <label className="flex items-center gap-2">
          <span className="text-[12px] font-bold text-on-surface-variant w-10">Desde</span>
          <input type="date" value={desde} max={hasta || undefined} onChange={e => change(() => setDesde(e.target.value))} className={`${inputCls} flex-1 min-w-0`} />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-[12px] font-bold text-on-surface-variant w-10">Hasta</span>
          <input type="date" value={hasta} min={desde || undefined} onChange={e => change(() => setHasta(e.target.value))} className={`${inputCls} flex-1 min-w-0`} />
        </label>
        <input type="search" value={texto} onChange={e => { setTexto(e.target.value); setLoading(true); }} placeholder="Buscar vuelo, persona o texto…" className={inputCls} aria-label="Buscar en la bitácora" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
        <label className={`flex items-center gap-2 text-sm font-semibold text-on-surface-variant ${categoria !== "todos" ? "opacity-40 pointer-events-none" : ""}`}>
          <input type="checkbox" className="w-4 h-4 accent-primary" checked={incluirNavegacion} onChange={e => change(() => setIncluirNavegacion(e.target.checked))} />
          Incluir cada página visitada (ver el turno completo)
        </label>
        {hasFilters && (
          <button
            onClick={() => change(() => { setCategoria("todos"); setUsuarioId(""); setDesde(""); setHasta(""); setTexto(""); setBusqueda(""); setIncluirNavegacion(false); })}
            className="text-sm font-bold text-primary hover:underline"
          >
            Quitar filtros
          </button>
        )}
      </div>
      {selectedPerson && (
        <p className="text-sm text-on-surface-variant mb-3">
          Actividad de <strong className="text-on-surface">{selectedPerson.nombre}</strong>{desde || hasta ? ` entre ${desde || "el inicio"} y ${hasta || "hoy"}` : ""}.
        </p>
      )}

      {/* Lista */}
      {loading && logs.length === 0 ? (
        <p className="py-12 text-center text-on-surface-variant animate-pulse">Cargando bitácora…</p>
      ) : logs.length === 0 ? (
        <p className="py-12 text-center text-on-surface-variant bg-surface-container rounded-2xl">No hay eventos con estos filtros.</p>
      ) : (
        <ol className={`flex flex-col divide-y divide-outline-variant/30 border border-outline-variant/30 rounded-2xl overflow-hidden transition-opacity ${loading ? "opacity-60" : ""}`}>
          {logs.map(log => {
            const st = STYLE[log.tipo_evento] ?? { icon: "info", label: log.tipo_evento, tone: "bg-slate-100 text-slate-600" };
            const cambios = (log.detalles_extra as { cambios?: Record<string, { antes: unknown; despues: unknown }> } | null)?.cambios;
            const hasDetails = !!cambios && Object.keys(cambios).length > 0;
            const isOpen = expanded === log.id;
            return (
              <li key={log.id} className="bg-surface-container-lowest">
                <button
                  onClick={() => setExpanded(isOpen ? null : log.id)}
                  className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-surface-container-low/60 transition-colors"
                  aria-expanded={isOpen}
                >
                  <span className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center ${st.tone}`}>
                    <span className="material-symbols-outlined text-[18px]">{st.icon}</span>
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="font-bold text-on-surface">{log.actor_nombre ?? (log.tipo_evento === "acceso_fallido" ? "Desconocido" : "—")}</span>
                      {log.actor_rol && (
                        <span className="px-1.5 py-0.5 rounded-md bg-surface-container text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
                          {ROLE_LABEL[toRole(log.actor_rol)]}
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${st.tone}`}>{st.label}</span>
                      <span className="text-sm font-semibold text-on-surface truncate">{log.nombre_referencia}</span>
                    </div>
                    <p className="text-sm text-on-surface-variant mt-0.5 break-words">{log.descripcion}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <time className="block text-[12px] font-semibold text-on-surface-variant whitespace-nowrap">{fmtWhen(log.creado_en)}</time>
                    <span className="material-symbols-outlined text-[18px] text-on-surface-variant/60">{isOpen ? "expand_less" : "expand_more"}</span>
                  </div>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 pl-16 flex flex-col gap-3 text-sm">
                    {hasDetails && (
                      <div className="rounded-xl border border-outline-variant/40 overflow-hidden">
                        <table className="w-full text-left">
                          <thead className="bg-surface-container text-[11px] uppercase tracking-wide text-on-surface-variant">
                            <tr><th className="px-3 py-1.5">Campo</th><th className="px-3 py-1.5">Antes</th><th className="px-3 py-1.5">Después</th></tr>
                          </thead>
                          <tbody>
                            {Object.entries(cambios!).map(([campo, c]) => (
                              <tr key={campo} className="border-t border-outline-variant/30">
                                <td className="px-3 py-1.5 font-semibold text-on-surface">{campo}</td>
                                <td className="px-3 py-1.5 text-red-700 line-through decoration-red-300">{show(c.antes)}</td>
                                <td className="px-3 py-1.5 text-emerald-700 font-semibold">{show(c.despues)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-on-surface-variant">
                      <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">location_on</span>{log.ubicacion ?? "—"}</span>
                      <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">devices</span>{log.dispositivo ?? "—"}</span>
                      <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">lan</span>IP {log.ip ?? "—"}</span>
                      <span className="font-mono opacity-70">#{log.id.slice(0, 8)}</span>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-[12px] text-on-surface-variant">
            Página <strong>{pagina} de {totalPages}</strong>
          </span>
          <div className="flex gap-2">
            <button disabled={pagina === 1} onClick={() => { setPagina(p => p - 1); setLoading(true); }} aria-label="Página anterior" className="w-9 h-9 flex items-center justify-center bg-surface-container hover:bg-surface-container-high rounded-lg disabled:opacity-30">
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <button disabled={pagina >= totalPages} onClick={() => { setPagina(p => p + 1); setLoading(true); }} aria-label="Página siguiente" className="w-9 h-9 flex items-center justify-center bg-surface-container hover:bg-surface-container-high rounded-lg disabled:opacity-30">
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
