"use client";

import { useEffect, useState } from "react";
import { getNavigationMetrics, type NavMetric } from "@/app/actions/metrics";

// Velocidad real de la app para el equipo: cuánto tarda cada cambio de pantalla,
// por sección y dispositivo. Mediana = lo típico; "lento" = el 10 % más lento.

const SECCIONES: Record<string, string> = {
  "/dashboard": "Inicio",
  "/dashboard/diario": "Registro",
  "/dashboard/mensual": "Reportes",
  "/dashboard/admin": "Panel",
};
const TIPOS: { id: NavMetric["tipo"]; label: string; hint: string }[] = [
  { id: "cambio_seccion", label: "Cambiar de sección", hint: "Desde que tocas Inicio, Registro o Reportes hasta ver la pantalla" },
  { id: "cambio_filtro", label: "Cambiar fecha o filtro", hint: "Dentro de la misma sección (otro día, otro mes…)" },
  { id: "carga_inicial", label: "Abrir la app", hint: "Desde que se abre el enlace hasta ver la primera pantalla" },
];
const DISPOSITIVOS: { id: NavMetric["dispositivo"]; label: string; icon: string }[] = [
  { id: "celular", label: "Celular", icon: "smartphone" },
  { id: "computadora", label: "Computadora", icon: "computer" },
  { id: "tablet", label: "Tablet", icon: "tablet" },
];

const segundos = (ms: number) => `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0).replace(".", ",")} s`;

// Referencias de Google: < 1 s instantáneo, 1–3 s aceptable, > 3 s se siente lento
// (al abrir la app: < 2,5 s bien, 2,5–4 s mejorable)
function tono(ms: number, tipo: NavMetric["tipo"]) {
  const [bien, regular] = tipo === "carga_inicial" ? [2500, 4000] : [1000, 3000];
  if (ms < bien) return { cls: "bg-emerald-50 text-emerald-700 ring-emerald-200", label: "Rápido" };
  if (ms < regular) return { cls: "bg-amber-50 text-amber-700 ring-amber-200", label: "Aceptable" };
  return { cls: "bg-red-50 text-red-700 ring-red-200", label: "Lento" };
}

export function VelocidadPanel() {
  const [dias, setDias] = useState(7);
  const [data, setData] = useState<NavMetric[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getNavigationMetrics(dias)
      .then(d => { if (!cancelled) { setData(d); setError(null); } })
      .catch(e => { if (!cancelled) setError((e as Error).message); });
    return () => { cancelled = true; };
  }, [dias]);

  const total = (data ?? []).reduce((s, m) => s + Number(m.mediciones), 0);
  const find = (pagina: string, tipo: NavMetric["tipo"], disp: NavMetric["dispositivo"]) =>
    data?.find(m => m.pagina === pagina && m.tipo === tipo && m.dispositivo === disp);

  return (
    <section className="flex flex-col bg-surface-container-lowest rounded-3xl p-5 md:p-7 shadow-sm border border-outline-variant/30">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">speed</span>
            Velocidad de la app
          </h2>
          <p className="font-body-sm text-on-surface-variant mt-1">
            Lo que tarda de verdad cada pantalla para tu equipo. <strong>Típico</strong> = lo normal; <strong>lento</strong> = el 10 % de las veces más lentas.
          </p>
        </div>
        <select
          aria-label="Período"
          value={dias}
          onChange={e => { setData(null); setDias(Number(e.target.value)); }}
          className="self-start h-10 px-3 rounded-xl bg-surface-container text-on-surface text-sm font-semibold"
        >
          <option value={1}>Hoy</option>
          <option value={7}>Últimos 7 días</option>
          <option value={30}>Últimos 30 días</option>
          <option value={90}>Últimos 90 días</option>
        </select>
      </div>

      {error ? (
        <p className="py-8 text-center text-red-600 bg-red-50 rounded-2xl">No se pudo cargar: {error}</p>
      ) : !data ? (
        <p className="py-10 text-center text-on-surface-variant animate-pulse">Cargando mediciones…</p>
      ) : total === 0 ? (
        <p className="py-10 text-center text-on-surface-variant bg-surface-container rounded-2xl">
          Aún no hay mediciones en este período. Se registran solas a medida que el equipo usa la app.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {TIPOS.map(t => {
            const paginas = Object.keys(SECCIONES).filter(p => DISPOSITIVOS.some(d => find(p, t.id, d.id)));
            if (paginas.length === 0) return null;
            return (
              <div key={t.id}>
                <h3 className="text-[14px] font-bold text-on-surface">{t.label}</h3>
                <p className="text-[12px] text-on-surface-variant mb-2">{t.hint}</p>
                <div className="overflow-x-auto rounded-2xl border border-outline-variant/40">
                  <table className="w-full text-sm">
                    <thead className="bg-surface-container text-[11px] uppercase tracking-wide text-on-surface-variant">
                      <tr>
                        <th className="px-3 py-2 text-left">Sección</th>
                        {DISPOSITIVOS.map(d => (
                          <th key={d.id} className="px-3 py-2 text-left whitespace-nowrap">
                            <span className="inline-flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">{d.icon}</span>{d.label}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paginas.map(p => (
                        <tr key={p} className="border-t border-outline-variant/30">
                          <td className="px-3 py-2.5 font-semibold text-on-surface whitespace-nowrap">{SECCIONES[p]}</td>
                          {DISPOSITIVOS.map(d => {
                            const m = find(p, t.id, d.id);
                            if (!m) return <td key={d.id} className="px-3 py-2.5 text-on-surface-variant/50">—</td>;
                            const tn = tono(m.mediana_ms, t.id);
                            return (
                              <td key={d.id} className="px-3 py-2.5 whitespace-nowrap">
                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[13px] font-bold ring-1 ${tn.cls}`} title={tn.label}>
                                  {segundos(m.mediana_ms)}
                                </span>
                                <span className="block text-[11px] text-on-surface-variant mt-0.5">lento {segundos(m.lento_ms)} · {m.mediciones} veces</span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
          <div className="flex flex-wrap gap-2 text-[12px] text-on-surface-variant">
            <span className="px-2 py-0.5 rounded-full ring-1 bg-emerald-50 text-emerald-700 ring-emerald-200 font-semibold">Menos de 1 s: se siente instantáneo</span>
            <span className="px-2 py-0.5 rounded-full ring-1 bg-amber-50 text-amber-700 ring-amber-200 font-semibold">1 a 3 s: aceptable</span>
            <span className="px-2 py-0.5 rounded-full ring-1 bg-red-50 text-red-700 ring-red-200 font-semibold">Más de 3 s: se siente lento</span>
          </div>
        </div>
      )}
    </section>
  );
}
