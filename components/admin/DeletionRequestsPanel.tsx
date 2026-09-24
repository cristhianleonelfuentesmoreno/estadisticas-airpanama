"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getDeletedFlights, getDeletionRequests, resolveDeletionRequest, restoreFlight,
  type SolicitudEliminacion, type VueloEliminado,
} from "@/app/actions/deletionRequests";
import { confirmDialog } from "@/components/ui/dialogs";

type Tab = "pendientes" | "resueltas" | "eliminados";

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("es-PA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Panama" }) : "—";
const fmtDay = (d?: string) =>
  d ? new Date(`${d}T12:00:00`).toLocaleDateString("es-PA", { day: "numeric", month: "short", year: "numeric" }) : "—";

function FlightChip({ numero, tipo, ruta, fecha, pasajeros }: { numero?: string; tipo: "llegada" | "salida"; ruta?: string; fecha?: string; pasajeros?: number | null }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <span className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-white text-[11px] font-bold ${numero?.startsWith("CM") ? "bg-[#0032A0]" : "bg-red-600"}`}>
        {numero?.split("-")[0] ?? "?"}
      </span>
      <div className="min-w-0">
        <p className="font-bold text-on-surface leading-tight">{numero ?? "—"}</p>
        <p className="text-[12px] text-on-surface-variant truncate">
          {fmtDay(fecha)} · {tipo === "llegada" ? `${ruta ?? "?"} → DAV` : `DAV → ${ruta ?? "?"}`}
          {pasajeros != null && ` · ${pasajeros} pax`}
        </p>
      </div>
    </div>
  );
}

export function DeletionRequestsPanel() {
  const [tab, setTab] = useState<Tab>("pendientes");
  const [pending, setPending] = useState<SolicitudEliminacion[]>([]);
  const [resolved, setResolved] = useState<SolicitudEliminacion[]>([]);
  const [deleted, setDeleted] = useState<VueloEliminado[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<SolicitudEliminacion | null>(null);
  const [comment, setComment] = useState("");

  const load = useCallback(async () => {
    try {
      const [p, r, d] = await Promise.all([getDeletionRequests("pendiente"), getDeletionRequests("resueltas"), getDeletedFlights()]);
      setPending(p);
      setResolved(r);
      setDeleted(d);
    } catch (err) {
      toast.error(`No se pudieron cargar las solicitudes: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Primera carga y luego cada minuto: las solicitudes llegan de otros turnos
    const first = setTimeout(load, 0);
    const interval = setInterval(load, 60000);
    return () => { clearTimeout(first); clearInterval(interval); };
  }, [load]);

  const approve = async (req: SolicitudEliminacion) => {
    const ok = await confirmDialog({
      title: `¿Aprobar la eliminación del ${req.resumen.numero_vuelo}?`,
      message: <>Pedido por <strong>{req.solicitado_nombre ?? "un usuario"}</strong>. Motivo: “{req.motivo}”.<br />El vuelo saldrá del Registro y de los Reportes. Se puede restaurar después.</>,
      tone: "danger",
      confirmText: "Aprobar eliminación",
    });
    if (!ok) return;
    setBusyId(req.id);
    const res = await resolveDeletionRequest(req.id, true);
    setBusyId(null);
    if (!res.success) return toast.error(res.error);
    toast.success(`Vuelo ${req.resumen.numero_vuelo} eliminado`);
    load();
  };

  const reject = async () => {
    if (!rejecting) return;
    setBusyId(rejecting.id);
    const res = await resolveDeletionRequest(rejecting.id, false, comment);
    setBusyId(null);
    if (!res.success) return toast.error(res.error);
    toast.success("Solicitud rechazada; el vuelo se mantiene");
    setRejecting(null);
    setComment("");
    load();
  };

  const restore = async (f: VueloEliminado) => {
    const ok = await confirmDialog({
      title: `¿Restaurar el ${f.numero_vuelo}?`,
      message: <>Vuelo del {fmtDay(f.fecha)}. Volverá al Registro y a los Reportes.</>,
      tone: "success",
      confirmText: "Restaurar",
    });
    if (!ok) return;
    setBusyId(f.id);
    const res = await restoreFlight(f.tipo, f.id);
    setBusyId(null);
    if (!res.success) return toast.error(res.error);
    toast.success(`Vuelo ${f.numero_vuelo} restaurado`);
    load();
  };

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "pendientes", label: "Pendientes", count: pending.length },
    { id: "resueltas", label: "Resueltas", count: resolved.length },
    { id: "eliminados", label: "Vuelos eliminados", count: deleted.length },
  ];

  return (
    <section className="flex flex-col bg-surface-container-lowest rounded-3xl p-5 md:p-7 shadow-sm border border-outline-variant/30">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-600">rule</span>
            Solicitudes de eliminación
          </h2>
          <p className="font-body-sm text-on-surface-variant mt-1">
            Los usuarios piden eliminar vuelos con un motivo; aquí se aprueban o se rechazan. Nada se borra de verdad: se puede restaurar.
          </p>
        </div>
        {pending.length > 0 && (
          <span className="self-start md:self-center inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-sm font-bold">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> {pending.length} por revisar
          </span>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-4">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold transition-colors ${tab === t.id ? "bg-on-surface text-surface-container-lowest" : "bg-surface-container hover:bg-surface-container-high text-on-surface"}`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-10 text-center text-on-surface-variant animate-pulse">Cargando…</p>
      ) : tab === "pendientes" ? (
        pending.length === 0 ? (
          <p className="py-10 text-center text-on-surface-variant bg-surface-container rounded-2xl">No hay solicitudes pendientes.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {pending.map(req => (
              <article key={req.id} className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1 min-w-0 flex flex-col gap-2">
                  <FlightChip numero={req.resumen.numero_vuelo} tipo={req.tipo} ruta={req.resumen.ruta} fecha={req.resumen.fecha} pasajeros={req.resumen.pasajeros} />
                  <p className="text-sm text-on-surface"><span className="font-bold">Motivo:</span> {req.motivo}</p>
                  <p className="text-[12px] text-on-surface-variant">Solicitado por <strong>{req.solicitado_nombre ?? "—"}</strong> · {fmtDate(req.solicitado_en)}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => { setRejecting(req); setComment(""); }}
                    disabled={busyId === req.id}
                    className="px-4 h-10 rounded-xl font-bold text-sm bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Rechazar
                  </button>
                  <button
                    onClick={() => approve(req)}
                    disabled={busyId === req.id}
                    className="px-4 h-10 rounded-xl font-bold text-sm bg-red-600 text-white hover:bg-red-700 shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                    Aprobar eliminación
                  </button>
                </div>
              </article>
            ))}
          </div>
        )
      ) : tab === "resueltas" ? (
        resolved.length === 0 ? (
          <p className="py-10 text-center text-on-surface-variant bg-surface-container rounded-2xl">Aún no hay solicitudes resueltas.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {resolved.map(req => (
              <article key={req.id} className="rounded-2xl border border-outline-variant/40 p-4 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <FlightChip numero={req.resumen.numero_vuelo} tipo={req.tipo} ruta={req.resumen.ruta} fecha={req.resumen.fecha} />
                  <p className="text-[12px] text-on-surface-variant mt-2">
                    Pedido por <strong>{req.solicitado_nombre ?? "—"}</strong>: {req.motivo}
                  </p>
                  {req.comentario && <p className="text-[12px] text-on-surface-variant">Comentario: {req.comentario}</p>}
                </div>
                <div className="text-right shrink-0">
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-[12px] font-bold ${req.estado === "aprobada" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                    {req.estado === "aprobada" ? "Eliminado" : "Rechazada · se mantuvo"}
                  </span>
                  <p className="text-[12px] text-on-surface-variant mt-1">{req.resuelto_nombre ?? "—"} · {fmtDate(req.resuelto_en)}</p>
                </div>
              </article>
            ))}
          </div>
        )
      ) : deleted.length === 0 ? (
        <p className="py-10 text-center text-on-surface-variant bg-surface-container rounded-2xl">No hay vuelos eliminados.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {deleted.map(f => (
            <article key={`${f.tipo}-${f.id}`} className="rounded-2xl border border-outline-variant/40 p-4 flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex-1 min-w-0">
                <FlightChip numero={f.numero_vuelo} tipo={f.tipo} ruta={f.ruta} fecha={f.fecha} pasajeros={f.pasajeros_abordo} />
                <p className="text-[12px] text-on-surface-variant mt-2">
                  Eliminado por <strong>{f.eliminado_por_nombre ?? "—"}</strong> · {fmtDate(f.eliminado_en)}{f.motivo_eliminacion && ` · ${f.motivo_eliminacion}`}
                </p>
              </div>
              <button
                onClick={() => restore(f)}
                disabled={busyId === f.id}
                className="self-start md:self-center px-4 h-10 rounded-xl font-bold text-sm bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm disabled:opacity-50 flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[18px]">restore</span>
                Restaurar
              </button>
            </article>
          ))}
        </div>
      )}

      {/* Rechazo con comentario obligatorio (queda en la bitácora) */}
      {rejecting && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => busyId || setRejecting(null)}>
          <div className="bg-surface w-full max-w-sm rounded-3xl p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-on-surface">Rechazar solicitud</h3>
            <p className="text-sm text-on-surface-variant mt-1 mb-4">
              El vuelo <strong>{rejecting.resumen.numero_vuelo}</strong> se mantiene. Explica por qué para quien lo pidió.
            </p>
            <textarea
              autoFocus
              rows={3}
              maxLength={500}
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Ej.: el vuelo sí se realizó, no es duplicado"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setRejecting(null)} disabled={!!busyId} className="flex-1 h-11 rounded-full font-bold text-on-surface-variant hover:bg-surface-variant/50">
                Cancelar
              </button>
              <button onClick={reject} disabled={!!busyId || comment.trim().length < 3} className="flex-1 h-11 rounded-full font-bold bg-slate-800 text-white disabled:opacity-50">
                {busyId ? "Guardando…" : "Rechazar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
