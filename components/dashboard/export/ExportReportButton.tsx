"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getReporteMensual } from "@/app/actions/flights";
import { sendAuditEvent } from "@/lib/client/api";
import { buildFontEmbedCSS } from "@/lib/client/fontEmbed";
import {
  AIRLINE_LABEL, MONTHS, computeReportMetrics, periodLabel,
  type ReportAirline, type ReportMetrics, type ReportRange, type ReporteVuelo,
} from "@/lib/reportes/metrics";
import { ReportPdfDocument } from "./ReportPdfDocument";

type Format = "excel" | "pdf";
type PdfJob = { metrics: ReportMetrics; airline: ReportAirline; period: string; generatedAt: string; fileName: string };

const FORMATS: { id: Format; label: string; detail: string; icon: string; tone: string }[] = [
  { id: "excel", label: "Excel", detail: "Tabla con todos los vuelos y un resumen", icon: "table_view", tone: "#107c41" },
  { id: "pdf", label: "PDF", detail: "Visuales del reporte listas para compartir", icon: "picture_as_pdf", tone: "#bb001d" },
];
const RANGES: { id: ReportRange; label: string }[] = [
  { id: "month", label: "Mes" },
  { id: "year", label: "Año" },
  { id: "6m", label: "6 meses" },
];
const AIRLINES: { id: ReportAirline; label: string; dot: string }[] = [
  { id: "all", label: "Todas", dot: "bg-gradient-to-br from-secondary to-primary-container" },
  { id: "7p", label: "Air Panama", dot: "bg-secondary" },
  { id: "cm", label: "Copa", dot: "bg-primary-container" },
];

const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");

// Control segmentado con pastilla deslizante (mismo estilo que los filtros de Reportes)
function Segmented<T extends string>({ options, value, onChange, label }: {
  options: { id: T; label: string; dot?: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  const idx = Math.max(0, options.findIndex(o => o.id === value));
  return (
    <div role="radiogroup" aria-label={label} className="relative grid p-1 rounded-xl bg-surface-container-low ring-1 ring-black/5" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      <span
        aria-hidden="true"
        className="absolute top-1 bottom-1 left-1 rounded-lg bg-white shadow-md ring-1 ring-black/5 transition-transform duration-300 ease-out"
        style={{ width: `calc((100% - 0.5rem) / ${options.length})`, transform: `translateX(${idx * 100}%)` }}
      />
      {options.map(o => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={`relative z-10 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[13px] font-bold transition-colors ${value === o.id ? "text-on-surface" : "text-on-surface-variant hover:text-on-surface"}`}
        >
          {o.dot && <span className={`w-2 h-2 rounded-full ${o.dot}`} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ExportReportButton({ rawFlights, year: pageYear, month: pageMonth, range: pageRange, airline: pageAirline }: {
  rawFlights: ReporteVuelo[];   // datos ya cargados en la página (se reusan si el periodo coincide)
  year: number;
  month: number;
  range: ReportRange;
  airline: ReportAirline;
}) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<Format>("pdf");
  const [range, setRange] = useState<ReportRange>(pageRange);
  const [year, setYear] = useState(pageYear);
  const [month, setMonth] = useState(pageMonth);
  const [airline, setAirline] = useState<ReportAirline>(pageAirline);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfJob, setPdfJob] = useState<PdfJob | null>(null);
  const pdfDone = useRef<((err?: Error) => void) | null>(null);
  const capturedJob = useRef<PdfJob | null>(null); // evita capturar dos veces el mismo PDF

  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1;
  const years = Array.from({ length: 4 }, (_, i) => curYear - 3 + i);

  // Al abrir, parte de lo que se está viendo en la página
  const openDialog = () => {
    setRange(pageRange);
    setYear(pageYear);
    setMonth(pageMonth);
    setAirline(pageAirline);
    setError(null);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy]);

  // Las páginas del PDF ya están pintadas: se capturan y se arma el archivo
  const handlePdfReady = useCallback(async (pages: HTMLElement[]) => {
    const job = pdfJob;
    if (!job || capturedJob.current === job) return;
    capturedJob.current = job;
    try {
      const [{ toPng }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
      pdf.setProperties({ title: `Reporte AirPanama · ${job.period}`, author: "AirPanama · Ops BI" });
      // Fuente de la app ya incrustada: evita que html-to-image lea hojas de otros dominios
      const fontEmbedCSS = await buildFontEmbedCSS();
      for (let i = 0; i < pages.length; i++) {
        const img = await toPng(pages[i], { pixelRatio: 2, backgroundColor: "#ffffff", cacheBust: true, fontEmbedCSS });
        if (i > 0) pdf.addPage();
        pdf.addImage(img, "PNG", 0, 0, 210, 297, undefined, "FAST");
      }
      pdf.save(job.fileName);
      pdfDone.current?.();
    } catch (err) {
      pdfDone.current?.(err as Error);
    }
  }, [pdfJob]);

  const handleExport = async () => {
    setBusy(true);
    setError(null);
    try {
      const samePeriod = year === pageYear && month === pageMonth && range === pageRange;
      const rows = samePeriod ? rawFlights : await getReporteMensual(year, month, range);
      const metrics = computeReportMetrics(rows, airline, year, month, range);
      const period = periodLabel(year, month, range);
      const generatedAt = new Date().toLocaleDateString("es-PA", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Panama" });
      const baseName = `Reporte_AirPanama_${slug(period)}_${slug(AIRLINE_LABEL[airline])}`;

      if (metrics.filteredTotal === 0) {
        setError("No hay vuelos registrados en ese periodo para la aerolínea elegida.");
        return;
      }

      if (format === "excel") {
        const { buildReportWorkbook, downloadWorkbook } = await import("@/lib/reportes/excel");
        downloadWorkbook(buildReportWorkbook(rows, metrics, { year, month, range, airline, generatedAt }), `${baseName}.xlsx`);
      } else {
        await new Promise<void>((resolve, reject) => {
          pdfDone.current = err => (err ? reject(err) : resolve());
          setPdfJob({ metrics, airline, period, generatedAt, fileName: `${baseName}.pdf` });
        });
      }
      sendAuditEvent({ tipo: "exportacion", formato: format, periodo: period, aerolinea: AIRLINE_LABEL[airline], vuelos: metrics.filteredTotal });
      setOpen(false);
    } catch (err) {
      console.error("Error exportando reporte:", err);
      setError(`No se pudo generar el archivo. ${(err as Error).message ?? ""}`.trim());
    } finally {
      pdfDone.current = null;
      setPdfJob(null);
      setBusy(false);
    }
  };

  const isFuture = (y: number, m: number) => y > curYear || (y === curYear && m > curMonth);

  return (
    <>
      <button
        onClick={openDialog}
        className="inline-flex items-center gap-1.5 h-8 pl-2.5 pr-3 rounded-full bg-primary-container text-on-primary text-[12px] font-bold shadow-sm hover:shadow-md active:scale-95 transition-all"
      >
        <span className="material-symbols-outlined text-[18px]">ios_share</span>
        Exportar
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#0A192F]/70 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => !busy && setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-title"
            onClick={e => e.stopPropagation()}
            className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300"
          >
            <div className="flex items-start justify-between gap-3 px-6 pt-6">
              <div>
                <h2 id="export-title" className="text-lg font-bold text-slate-800">Exportar reporte</h2>
                <p className="text-sm text-slate-500">Elige el formato y los datos que quieres incluir.</p>
              </div>
              <button onClick={() => setOpen(false)} disabled={busy} aria-label="Cerrar" className="w-8 h-8 shrink-0 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="px-6 py-5 flex flex-col gap-5">
              {/* Formato */}
              <div role="radiogroup" aria-label="Formato" className="grid grid-cols-2 gap-3">
                {FORMATS.map(f => {
                  const selected = format === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setFormat(f.id)}
                      className={`relative text-left p-4 rounded-2xl border-2 transition-all active:scale-[0.98] ${selected ? "shadow-lg" : "border-slate-200 hover:border-slate-300"}`}
                      style={selected ? { borderColor: f.tone, background: `${f.tone}0d`, boxShadow: `0 10px 24px -12px ${f.tone}80` } : undefined}
                    >
                      <span className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm" style={{ background: f.tone }}>
                        <span className="material-symbols-outlined text-[22px]">{f.icon}</span>
                      </span>
                      <span className="block mt-3 text-[15px] font-bold text-slate-800">{f.label}</span>
                      <span className="block text-[12px] leading-snug text-slate-500 mt-0.5">{f.detail}</span>
                      {selected && (
                        <span className="absolute top-3 right-3 material-symbols-outlined text-[20px]" style={{ color: f.tone }}>check_circle</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Periodo */}
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Periodo</span>
                <Segmented label="Periodo" options={RANGES} value={range} onChange={setRange} />
                <div className="grid grid-cols-2 gap-2">
                  {range !== "year" && (
                    <select
                      aria-label="Mes"
                      value={month}
                      onChange={e => setMonth(Number(e.target.value))}
                      className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700"
                    >
                      {MONTHS.map((name, i) => (
                        <option key={name} value={i + 1} disabled={isFuture(year, i + 1)}>{range === "6m" ? `Hasta ${name.toLowerCase()}` : name}</option>
                      ))}
                    </select>
                  )}
                  <select
                    aria-label="Año"
                    value={year}
                    onChange={e => {
                      const y = Number(e.target.value);
                      setYear(y);
                      if (isFuture(y, month)) setMonth(curMonth);
                    }}
                    className={`h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 ${range === "year" ? "col-span-2" : ""}`}
                  >
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <p className="text-[12px] text-slate-500">Se exportará: <strong className="text-slate-700">{periodLabel(year, month, range)}</strong></p>
              </div>

              {/* Aerolínea */}
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Aerolínea</span>
                <Segmented label="Aerolínea" options={AIRLINES} value={airline} onChange={setAirline} />
              </div>

              {error && (
                <p role="alert" className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">{error}</p>
              )}
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setOpen(false)} disabled={busy} className="flex-1 h-12 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleExport}
                disabled={busy}
                className="flex-[2] h-12 rounded-xl font-bold text-white shadow-md hover:shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                style={{ background: FORMATS.find(f => f.id === format)?.tone }}
              >
                <span className={`material-symbols-outlined text-[20px] ${busy ? "animate-spin" : ""}`}>{busy ? "progress_activity" : "download"}</span>
                {busy ? "Generando…" : `Descargar ${format === "pdf" ? "PDF" : "Excel"}`}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Lienzo fuera de pantalla donde se arma el PDF antes de capturarlo */}
      {pdfJob && createPortal(
        <div aria-hidden="true" style={{ position: "fixed", left: -10000, top: 0, pointerEvents: "none" }}>
          <ReportPdfDocument
            metrics={pdfJob.metrics}
            airline={pdfJob.airline}
            airlineLabel={AIRLINE_LABEL[pdfJob.airline]}
            period={pdfJob.period}
            generatedAt={pdfJob.generatedAt}
            onReady={handlePdfReady}
          />
        </div>,
        document.body
      )}
    </>
  );
}
