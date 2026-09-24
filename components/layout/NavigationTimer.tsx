"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Mide cuánto tarda cada cambio de pantalla, desde el toque hasta que se ve el
// contenido real (no el esqueleto gris de carga), y lo envía a /api/metrics.
// Se ve en el panel → "Velocidad de la app".

type Tipo = "carga_inicial" | "cambio_seccion" | "cambio_filtro";

function dispositivo(): "celular" | "tablet" | "computadora" {
  const ua = navigator.userAgent;
  if (/iPad|Tablet/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "tablet";
  if (/Mobi|iPhone|Android/i.test(ua)) return "celular";
  return "computadora";
}

function enviar(pagina: string, tipo: Tipo, duracion: number) {
  if (duracion < 0 || duracion > 60000 || document.visibilityState === "hidden") return;
  const conexion = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType;
  fetch("/api/metrics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pagina, tipo, dispositivo: dispositivo(), conexion, duracion_ms: Math.round(duracion) }),
    keepalive: true,
  }).catch(() => {});
}

// Llama a `listo` cuando ya no está el esqueleto de carga de la sección (máx. 60 s)
function cuandoSeVeaElContenido(listo: () => void) {
  const cargando = () => !!document.querySelector("[data-route-loading]");
  if (!cargando()) { requestAnimationFrame(() => listo()); return () => {}; }
  const obs = new MutationObserver(() => {
    if (cargando()) return;
    obs.disconnect();
    clearTimeout(limite);
    requestAnimationFrame(() => listo());
  });
  obs.observe(document.body, { childList: true, subtree: true });
  const limite = setTimeout(() => obs.disconnect(), 60000);
  return () => { obs.disconnect(); clearTimeout(limite); };
}

export function NavigationTimer() {
  const pathname = usePathname();
  const search = useSearchParams();
  const ruta = `${pathname}?${search.toString()}`;
  const inicio = useRef<number | null>(null);
  const anterior = useRef<string | null>(null);

  // El cronómetro arranca con el toque en un enlace del panel o con un cambio de fecha/filtro
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest("a");
      if (!a || a.target === "_blank") return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || !url.pathname.startsWith("/dashboard")) return;
      if (url.pathname + url.search === location.pathname + location.search) return;
      inicio.current = performance.now();
    };
    const onStart = () => { inicio.current = performance.now(); };
    document.addEventListener("click", onClick, true);
    window.addEventListener("start-navigation", onStart);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("start-navigation", onStart);
    };
  }, []);

  useEffect(() => {
    // Primera pantalla: desde que se pidió la página hasta ver el contenido
    if (anterior.current === null) {
      anterior.current = ruta;
      return cuandoSeVeaElContenido(() => enviar(pathname, "carga_inicial", performance.now()));
    }
    if (anterior.current === ruta) return;
    const mismaSeccion = anterior.current.split("?")[0] === pathname;
    anterior.current = ruta;
    const t0 = inicio.current;
    inicio.current = null;
    if (t0 === null) return; // p. ej. atrás/adelante del navegador: sin punto de partida confiable
    return cuandoSeVeaElContenido(() => enviar(pathname, mismaSeccion ? "cambio_filtro" : "cambio_seccion", performance.now() - t0));
  }, [ruta, pathname]);

  return null;
}
