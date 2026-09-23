"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Barra de progreso fina arriba mientras se navega. Antes era un overlay a pantalla
// completa: tapar todo hace que la espera se sienta más larga que ver la página quieta.
type Phase = "idle" | "loading" | "done";

export default function TransitionLoader() {
  const [phase, setPhase] = useState<Phase>("idle");
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Al cambiar la ruta, completar la barra
  // (se ajusta durante el render, como recomienda React, en vez de en un efecto)
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const [prevRouteKey, setPrevRouteKey] = useState(routeKey);
  if (routeKey !== prevRouteKey) {
    setPrevRouteKey(routeKey);
    if (phase === "loading") setPhase("done");
  }

  // Tras completarse, desvanecer y ocultar
  useEffect(() => {
    if (phase !== "done") return;
    const id = setTimeout(() => setPhase("idle"), 350);
    return () => clearTimeout(id);
  }, [phase]);

  // Interceptar clicks en enlaces para arrancar la barra de inmediato
  useEffect(() => {
    const handleStart = () => setPhase("loading");

    const handleClick = (e: MouseEvent) => {
      // (no se mira defaultPrevented: next/link lo marca en sus propias navegaciones)
      // Ctrl/Cmd+clic abre otra pestaña: esta página no navega
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = (e.target as HTMLElement).closest('a');
      if (
        target &&
        target.href &&
        target.href.startsWith(window.location.origin) &&
        target.target !== '_blank'
      ) {
        const url = new URL(target.href);
        // Solo si va a cambiar de página (no es un ancla a la misma página)
        if (url.pathname !== window.location.pathname || url.search !== window.location.search) {
          handleStart();
        }
      }
    };

    // Evento propio para navegaciones hechas con router.push()
    window.addEventListener("start-navigation", handleStart);
    document.addEventListener('click', handleClick);

    return () => {
      window.removeEventListener("start-navigation", handleStart);
      document.removeEventListener('click', handleClick);
    };
  }, []);

  if (phase === "idle") return null;

  return (
    <div className="nav-progress" data-phase={phase} role="progressbar" aria-label="Cargando página">
      <span className="nav-progress__bar" />
    </div>
  );
}
