"use client";

import { useEffect, useRef } from "react";
import "./UploadProgress.css";

// ------------------------------------------------------------------
// Ícono para los botones de subir: aro + flecha. Se anima al pasar el mouse
// sobre el botón que lo contiene (clase .upbtn).
// ------------------------------------------------------------------
export function UploadGlyph() {
  return (
    <svg className="upglyph" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <circle className="upglyph__ring" cx="12" cy="12" r="9.5" pathLength="1" />
      <g className="upglyph__arrow">
        <path d="M12 16.5V8M8.2 11.3 12 7.5l3.8 3.8" />
      </g>
    </svg>
  );
}

// ------------------------------------------------------------------
// Progreso de una subida real. UN solo trazo es el aro y la pista:
// al empezar, el aro se desenrolla en la barra y la flecha "despega"
// montada en el frente del progreso. Al terminar, la flecha se vuelve un check.
// ------------------------------------------------------------------
export type UploadJob = {
  id: number;              // cambia en cada subida nueva
  label: string;           // "Guardando 48 vuelos…"
  fileName?: string;
  fileSize?: number;       // bytes
  actual: number;          // progreso REAL conocido, 0…1
  creepTo?: number;        // mientras se espera al servidor, la barra avanza despacio hacia aquí
  status: "running" | "success" | "error";
  errorText?: string;
};

type Props = {
  job: UploadJob | null;
  onFinished: () => void;  // tras el check (o el error), para cerrar y seguir
  onCancel?: () => void;
};

const VB_W = 320;
const RING = { cx: 160, cy: 70, r: 30 };
const LINE = { x0: 40, x1: 280, y: 130 };
const N = 96;              // puntos del trazo
const UNROLL_MS = 700;
const MIN_MS = 1200;       // una subida rápida igual se alcanza a leer
const CREEP_MS = 3500;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function formatSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// El aro se DESENROLLA en la barra: cada punto mezcla su lugar en el círculo
// con su lugar en la línea. El aro empieza abajo, así la barra crece desde la izquierda.
function railPath(u: number) {
  let d = "";
  for (let i = 0; i <= N; i++) {
    const k = i / N;
    const a = Math.PI / 2 + k * Math.PI * 2;
    const rx = RING.cx + RING.r * Math.cos(a);
    const ry = RING.cy + RING.r * Math.sin(a);
    const lx = LINE.x0 + (LINE.x1 - LINE.x0) * k;
    const x = rx + (lx - rx) * u;
    const y = ry + (LINE.y - ry) * u;
    d += `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return d;
}

export function UploadProgress({ job, onFinished, onCancel }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<SVGPathElement>(null);
  const fillRef = useRef<SVGPathElement>(null);
  const rigRef = useRef<SVGGElement>(null);
  const checkRef = useRef<SVGGElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);

  // El bucle lee el trabajo más reciente sin reiniciarse en cada actualización
  const jobRef = useRef(job);
  const finishedRef = useRef(onFinished);
  useEffect(() => {
    jobRef.current = job;
    finishedRef.current = onFinished;
  });

  // Cuándo cambió por última vez el progreso real (para el avance lento de espera)
  const realRef = useRef({ value: 0, at: 0 });
  const actual = job?.actual;
  useEffect(() => {
    if (actual !== undefined) realRef.current = { value: actual, at: performance.now() };
  }, [actual]);

  const jobId = job?.id ?? null;
  useEffect(() => {
    if (jobId === null) return;
    const root = rootRef.current!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let shown = 0;
    let doneAt = 0;
    let frame = 0;

    const tick = (now: number) => {
      const j = jobRef.current;
      if (!j) return;
      const elapsed = now - start;
      const u = reduce ? 1 : easeInOut(clamp01(elapsed / UNROLL_MS));
      const d = railPath(u);
      trackRef.current!.setAttribute("d", d);
      fillRef.current!.setAttribute("d", d);

      // Objetivo: lo real, más un avance lento mientras se espera al servidor
      const real = realRef.current;
      const creepTarget = j.creepTo ?? real.value;
      const creep = creepTarget > real.value
        ? real.value + (creepTarget - real.value) * (1 - Math.exp(-(now - real.at) / CREEP_MS))
        : real.value;
      const target = j.status === "success" ? 1 : Math.max(j.actual, creep);
      // Ritmo mínimo: aunque el servidor responda al instante, la barra se alcanza a leer
      const paced = Math.min(target, Math.max(0, elapsed - UNROLL_MS * 0.6) / MIN_MS);
      shown += (paced - shown) * 0.18;
      if (j.status === "success" && paced >= 1 && shown > 0.995) shown = 1;

      // Solo el relleno avanza: pathLength=1, así el dashoffset ES el progreso
      fillRef.current!.style.strokeDashoffset = `${1 - shown * u}`;
      pctRef.current!.textContent = `${Math.round(shown * 100)}%`;

      // La flecha va montada en el frente del progreso
      const headX = LINE.x0 + (LINE.x1 - LINE.x0) * shown;
      // Se queda en el centro del aro mientras se desenrolla y luego sale hacia el frente
      const flyX = RING.cx + (headX - RING.cx) * u * u * u;
      const flyY = RING.cy + (LINE.y - 34 - RING.cy) * u + Math.sin(now / 260) * 2.5 * u;
      rigRef.current!.setAttribute("transform", `translate(${flyX.toFixed(2)} ${flyY.toFixed(2)})`);
      checkRef.current!.setAttribute("transform", `translate(${LINE.x1} ${LINE.y - 34})`);

      if (j.status === "success" && shown === 1 && !doneAt) {
        doneAt = now;
        root.dataset.state = "done";
      }
      if (j.status === "error" && !doneAt) {
        doneAt = now;
        root.dataset.state = "error";
      }
      if (doneAt && now - doneAt > (j.status === "error" ? 1800 : 900)) {
        finishedRef.current();
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    root.dataset.state = "running";
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [jobId]);

  if (!job) return null;

  return (
    <div ref={rootRef} className="upprog" role="dialog" aria-modal="true" aria-label={job.label}>
      <div className="upprog__panel">
        <svg className="upprog__stage" viewBox={`0 0 ${VB_W} 170`} aria-hidden="true">
          {/* UN trazo es el aro y la pista; el relleno es el mismo trazo con dashoffset */}
          <path ref={trackRef} className="upprog__rail" pathLength="1" />
          <path ref={fillRef} className="upprog__rail upprog__rail--fill" pathLength="1" />

          {/* Lo que despega: la flecha con su estela */}
          <g ref={rigRef} className="upprog__rig">
            <g className="upprog__trail">
              <line x1="-5" y1="13" x2="-5" y2="21" />
              <line x1="0" y1="15" x2="0" y2="26" />
              <line x1="5" y1="13" x2="5" y2="21" />
            </g>
            <path className="upprog__arrow" d="M0 12V-10M-8 -2 0 -10l8 8" />
          </g>
          <g ref={checkRef} className="upprog__check">
            <circle r="15" />
            <path d="M-6.5 0.5 -2 5 7 -5" pathLength="1" />
          </g>
        </svg>

        <span ref={pctRef} className="upprog__pct">0%</span>
        <p className="upprog__label" aria-live="polite">
          {job.status === "error" ? job.errorText || "No se pudo completar la subida" : job.label}
        </p>
        {job.fileName && (
          <p className="upprog__file">
            {job.fileName} <span>{formatSize(job.fileSize)}</span>
          </p>
        )}
        {onCancel && job.status === "running" && (
          <button type="button" className="upprog__cancel" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}
