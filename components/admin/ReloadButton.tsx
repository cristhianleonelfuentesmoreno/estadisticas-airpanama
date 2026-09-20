"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ReloadButton() {
  const router = useRouter();
  const [isReloading, setIsReloading] = useState(false);

  const handleReload = () => {
    setIsReloading(true);
    // Para asegurar que todos los datos frescos se carguen en una SPA Next.js, 
    // lo más efectivo cuando el usuario da click manual a "Recargar" es usar window.location.reload()
    window.location.reload();
  };

  return (
    <button 
      onClick={handleReload}
      disabled={isReloading}
      className="bg-primary text-on-primary px-4 py-2 rounded-full font-label-md font-bold flex items-center gap-2 hover:bg-primary/90 transition-transform hover:scale-105 active:scale-95 shadow-sm"
    >
      <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.8)]"></span>
      {isReloading ? "Recargando..." : "Recargar"}
    </button>
  );
}
