"use client";

import { useEffect, useRef } from "react";
import {
  BG_PANEL, BG_ZOOM_MAX, BG_ZOOM_MIN, clamp, fitZoom, frameCss, renderedSize,
  type BgDevice, type BgFrame,
} from "@/lib/loginBackground";

type Props = {
  device: BgDevice;
  imageUrl: string;
  aspect: number;
  frame: BgFrame;
  onChange: (update: (f: BgFrame) => BgFrame) => void;
  title: string;
};

const zoomTo = (f: BgFrame, zoom: number): BgFrame => ({ ...f, zoom: clamp(zoom, BG_ZOOM_MIN, BG_ZOOM_MAX) });

// Vista previa del panel de imagen del login: se arrastra con mouse o dedo,
// la rueda o el pellizco hacen zoom, y las flechas / + / − funcionan con teclado.
export function BackgroundFramer({ device, imageUrl, aspect, frame, onChange, title }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; y: number; frame: BgFrame } | null>(null);
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  const panel = BG_PANEL[device];
  const css = frameCss(frame, aspect);
  const fit = fitZoom(aspect, device);

  // La rueda necesita un listener no pasivo para no desplazar el modal
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      onChange(f => zoomTo(f, f.zoom * Math.exp(-e.deltaY * 0.0015)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onChange]);

  const pinchDistance = () => {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const startDrag = (x: number, y: number) => { drag.current = { x, y, frame }; };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      drag.current = null;
      pinch.current = { dist: pinchDistance(), zoom: frame.zoom };
    } else {
      startDrag(e.clientX, e.clientY);
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pinch.current && pointers.current.size === 2) {
      const { dist, zoom } = pinch.current;
      onChange(f => zoomTo(f, zoom * (pinchDistance() / dist)));
      return;
    }
    const start = drag.current;
    if (!start || !boxRef.current) return;
    // Igual que background-position en %: desplazamiento = (panel − imagen) × pos
    const rect = boxRef.current.getBoundingClientRect();
    const img = renderedSize(start.frame, aspect, rect.width, rect.height);
    const spanX = rect.width - img.w, spanY = rect.height - img.h;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    onChange(f => ({
      ...f,
      x: Math.abs(spanX) > 0.5 ? clamp(start.frame.x + (dx / spanX) * 100, 0, 100) : f.x,
      y: Math.abs(spanY) > 0.5 ? clamp(start.frame.y + (dy / spanY) * 100, 0, 100) : f.y,
    }));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    pinch.current = null;
    // Si queda un dedo, sigue arrastrando desde donde está (sin saltos)
    const rest = [...pointers.current.values()][0];
    if (rest) startDrag(rest.x, rest.y);
    else drag.current = null;
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 2;
    const moves: Record<string, (f: BgFrame) => BgFrame> = {
      ArrowLeft: f => ({ ...f, x: clamp(f.x - step, 0, 100) }),
      ArrowRight: f => ({ ...f, x: clamp(f.x + step, 0, 100) }),
      ArrowUp: f => ({ ...f, y: clamp(f.y - step, 0, 100) }),
      ArrowDown: f => ({ ...f, y: clamp(f.y + step, 0, 100) }),
      "+": f => zoomTo(f, f.zoom * 1.05),
      "=": f => zoomTo(f, f.zoom * 1.05),
      "-": f => zoomTo(f, f.zoom / 1.05),
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    onChange(move);
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={boxRef}
        role="application"
        aria-label="Encuadre de la imagen: arrastra para moverla, usa la rueda o pellizca para hacer zoom. Con teclado: flechas para mover, + y − para zoom."
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className="relative w-full mx-auto overflow-hidden rounded-2xl bg-primary-container shadow-inner select-none cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-4 ring-primary/30"
        style={{
          aspectRatio: `${panel.w} / ${panel.h}`,
          maxWidth: device === "desktop" ? 340 : 560,
          containerType: "size",
          touchAction: "none",
        }}
      >
        {css.backdrop && (
          <div
            className="absolute -inset-10"
            style={{ backgroundImage: `url(${imageUrl})`, backgroundSize: "cover", backgroundPosition: "center", filter: "blur(28px) brightness(0.8) saturate(1.1)" }}
          />
        )}
        <div
          className="absolute inset-0"
          style={{ backgroundImage: `url(${imageUrl})`, backgroundRepeat: "no-repeat", backgroundSize: css.size, backgroundPosition: css.position }}
        />
        <div className="absolute inset-0 bg-black/30 pointer-events-none" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white pointer-events-none p-4">
          <span className="font-bold drop-shadow-md" style={{ fontSize: device === "desktop" ? "1.15rem" : "1.3rem" }}>{title || "¡Hola!"}</span>
          <span className="mt-3 px-4 py-1 border border-white rounded-full text-[0.6rem] tracking-widest">REGISTRARSE</span>
        </div>
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/55 text-white text-[11px] font-semibold whitespace-nowrap pointer-events-none">
          <span className="material-symbols-outlined text-[14px]">pan_tool</span>
          Arrastra para mover · rueda o pellizca para zoom
        </div>
      </div>

      {/* Zoom */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => onChange(f => zoomTo(f, f.zoom / 1.1))} className="w-9 h-9 shrink-0 rounded-lg bg-surface-container hover:bg-surface-container-high flex items-center justify-center" aria-label="Alejar">
          <span className="material-symbols-outlined text-[20px]">zoom_out</span>
        </button>
        <input
          type="range"
          min={BG_ZOOM_MIN}
          max={BG_ZOOM_MAX}
          step={0.01}
          value={frame.zoom}
          onChange={e => onChange(f => zoomTo(f, Number(e.target.value)))}
          className="flex-1 accent-primary"
          aria-label="Zoom de la imagen"
        />
        <button type="button" onClick={() => onChange(f => zoomTo(f, f.zoom * 1.1))} className="w-9 h-9 shrink-0 rounded-lg bg-surface-container hover:bg-surface-container-high flex items-center justify-center" aria-label="Acercar">
          <span className="material-symbols-outlined text-[20px]">zoom_in</span>
        </button>
        <span className="w-12 text-right text-xs font-bold text-on-surface-variant tabular-nums">{Math.round(frame.zoom * 100)}%</span>
      </div>

      {/* Atajos */}
      <div className="grid grid-cols-3 gap-2">
        <button type="button" onClick={() => onChange(() => ({ zoom: fit, x: 50, y: 50 }))} className="py-2 rounded-lg text-xs font-bold bg-surface-container text-on-surface-variant hover:bg-surface-container-high flex items-center justify-center gap-1.5">
          <span className="material-symbols-outlined text-[16px]">fit_screen</span>Imagen completa
        </button>
        <button type="button" onClick={() => onChange(f => ({ ...f, zoom: 1 }))} className="py-2 rounded-lg text-xs font-bold bg-surface-container text-on-surface-variant hover:bg-surface-container-high flex items-center justify-center gap-1.5">
          <span className="material-symbols-outlined text-[16px]">crop_free</span>Llenar espacio
        </button>
        <button type="button" onClick={() => onChange(f => ({ ...f, x: 50, y: 50 }))} className="py-2 rounded-lg text-xs font-bold bg-surface-container text-on-surface-variant hover:bg-surface-container-high flex items-center justify-center gap-1.5">
          <span className="material-symbols-outlined text-[16px]">center_focus_strong</span>Centrar
        </button>
      </div>
      <p className="text-[11px] text-on-surface-variant text-center">
        Por debajo de 100% la imagen se ve más completa y el espacio libre se rellena con la misma foto desenfocada.
      </p>
    </div>
  );
}
