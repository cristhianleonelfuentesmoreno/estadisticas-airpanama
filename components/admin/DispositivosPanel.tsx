"use client";

import { useState, useEffect } from "react";
import { getSesionesActivas } from "@/app/actions/sessions";
import { HistorialSesionesModal } from "./HistorialSesionesModal";

export function DispositivosPanel() {
  const [sesiones, setSesiones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    const fetchSesiones = async () => {
      const data = await getSesionesActivas();
      setSesiones(data || []);
      setLoading(false);
    };
    fetchSesiones();
    const interval = setInterval(fetchSesiones, 60000);
    return () => clearInterval(interval);
  }, []);

  const totalPages = Math.ceil(sesiones.length / ITEMS_PER_PAGE);
  const paginatedSesiones = sesiones.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  if (loading) {
    return <div className="p-8 text-center text-on-surface-variant animate-pulse">Cargando dispositivos...</div>;
  }

  return (
    <div className="flex flex-col w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined">devices</span>
          Dispositivos & Ubicación Activa
        </h2>
        <div className="bg-primary-container text-on-primary-container px-3 py-1 rounded-full font-label-md font-bold text-sm">
          {sesiones.length} Sesiones Activas
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {paginatedSesiones.map((sesion) => {
          const isMobile = sesion.dispositivo_tipo === 'mobile';
          const initials = sesion.user?.nombre ? sesion.user.nombre.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'U';
          
          // Calcular tiempo inactivo
          const lastActive = new Date(sesion.ultima_actividad);
          const diffMin = Math.floor((new Date().getTime() - lastActive.getTime()) / 60000);
          
          let statusText = "En línea";
          let statusColor = "bg-emerald-100 text-emerald-700";
          let indicatorColor = "bg-emerald-500";
          
          if (diffMin > 10) {
            statusText = `Activo (hace ${diffMin}m)`;
            statusColor = "bg-surface-variant text-on-surface-variant";
            indicatorColor = "bg-outline";
          } else if (diffMin > 2) {
            statusText = `En línea (hace ${diffMin}m)`;
          }

          return (
            <div key={sesion.id} className="bg-surface-container-lowest rounded-3xl p-5 shadow-sm border border-outline-variant/30 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-secondary text-on-secondary flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
                    {initials}
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-label-lg font-bold text-on-surface capitalize">{sesion.user?.nombre}</span>
                      {sesiones.filter(s => s.user_id === sesion.user_id).length > 1 && (
                        <span className="bg-error/10 text-error px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">warning</span>
                          Múltiple
                        </span>
                      )}
                    </div>
                    <span className="font-body-sm text-on-surface-variant capitalize">{sesion.user?.cargo || 'Sin cargo'}</span>
                  </div>
                </div>
                
                <button 
                  onClick={() => setSelectedUser(sesion.user_id)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-transform hover:scale-105 active:scale-95 cursor-pointer ${statusColor}`}
                >
                  <span className={`w-2 h-2 rounded-full ${indicatorColor} animate-pulse`}></span>
                  {statusText}
                </button>
              </div>

              <div className="flex flex-col gap-1.5 mt-2">
                <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                  <span className="material-symbols-outlined text-[18px]">{isMobile ? 'smartphone' : 'computer'}</span>
                  <span>{sesion.dispositivo_modelo} • {sesion.sistema_operativo}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                  <div className="flex items-center gap-1 bg-surface-container px-2 py-0.5 rounded text-xs font-medium text-on-surface">
                    <span className="material-symbols-outlined text-[14px] text-error">location_on</span>
                    {sesion.ubicacion_texto}
                  </div>
                  <span className="text-xs opacity-70">{sesion.ip}</span>
                </div>
              </div>
            </div>
          );
        })}

        {sesiones.length === 0 && (
          <div className="p-8 text-center text-on-surface-variant bg-surface-container-lowest rounded-2xl border border-outline-variant/30">
            No hay dispositivos conectados en este momento.
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-6">
          <button 
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            className="p-2 bg-surface-container hover:bg-surface-container-high rounded-full disabled:opacity-50 transition-colors"
          >
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <span className="font-label-md text-on-surface">Página {page} de {totalPages}</span>
          <button 
            disabled={page === totalPages}
            onClick={() => setPage(p => p + 1)}
            className="p-2 bg-surface-container hover:bg-surface-container-high rounded-full disabled:opacity-50 transition-colors"
          >
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      )}

      {selectedUser && (
        <HistorialSesionesModal 
          userId={selectedUser} 
          onClose={() => setSelectedUser(null)} 
        />
      )}
    </div>
  );
}
