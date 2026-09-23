"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function TransitionLoader() {
  const [isNavigating, setIsNavigating] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Ocultar el spinner cuando la ruta cambie efectivamente
  // (se ajusta durante el render, como recomienda React, en vez de en un efecto)
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const [prevRouteKey, setPrevRouteKey] = useState(routeKey);
  if (routeKey !== prevRouteKey) {
    setPrevRouteKey(routeKey);
    setIsNavigating(false);
  }

  // Interceptar clicks en enlaces para mostrar el spinner inmediatamente
  useEffect(() => {
    const handleStart = () => setIsNavigating(true);
    
    const handleClick = (e: MouseEvent) => {
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

    // Escuchar un evento personalizado por si acaso
    window.addEventListener("start-navigation", handleStart);
    document.addEventListener('click', handleClick);

    return () => {
      window.removeEventListener("start-navigation", handleStart);
      document.removeEventListener('click', handleClick);
    };
  }, []);

  if (!isNavigating) return null;

  return (
    <div className="fixed inset-0 z-[10000] bg-[#0A192F]/80 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-200">
      <div className="spinner mb-8">
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
      </div>
      <h2 className="text-white font-headline-md font-bold tracking-widest uppercase flex items-center gap-2">
        <span className="material-symbols-outlined text-[24px] text-red-600">flight_takeoff</span>
        Air Panama
      </h2>
      <p className="text-white/60 font-body-sm mt-2 animate-pulse">Sincronizando módulos...</p>
    </div>
  );
}
