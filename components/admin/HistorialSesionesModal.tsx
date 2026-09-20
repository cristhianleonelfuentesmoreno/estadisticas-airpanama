"use client";

import { useEffect, useState } from "react";
import { getHistorialSesionesUser } from "@/app/actions/sessions";

interface Props {
  userId: string;
  onClose: () => void;
}

export function HistorialSesionesModal({ userId, onClose }: Props) {
  const [historial, setHistorial] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistorial = async () => {
      const data = await getHistorialSesionesUser(userId);
      setHistorial(data);
      setLoading(false);
    };
    fetchHistorial();
  }, [userId]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-surface-container-lowest w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-outline-variant/30">
          <h2 className="font-headline-sm font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined">history</span>
            Historial de Sesiones
          </h2>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container-highest transition-colors text-on-surface-variant"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {loading ? (
            <div className="py-12 text-center text-on-surface-variant animate-pulse">
              Cargando historial...
            </div>
          ) : historial.length === 0 ? (
            <div className="py-12 text-center text-on-surface-variant">
              No hay registros de sesiones anteriores.
            </div>
          ) : (
            <div className="relative border-l-2 border-outline-variant/30 ml-4 space-y-8 pb-4">
              {historial.map((sesion) => (
                <div key={sesion.id} className="relative pl-6">
                  {/* Dot */}
                  <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-surface-container-lowest ${sesion.estado === 'en_linea' ? 'bg-emerald-500' : 'bg-outline-variant'}`}></div>
                  
                  <div className="bg-surface-container-low rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-label-md font-bold text-on-surface">
                        {new Date(sesion.inicio_sesion).toLocaleDateString()}
                      </span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${sesion.estado === 'en_linea' ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-variant text-on-surface-variant'}`}>
                        {sesion.estado === 'en_linea' ? 'Activa' : 'Desconectado'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                      <div>
                        <span className="text-on-surface-variant text-xs block mb-0.5">Inicio de Sesión</span>
                        <span className="text-on-surface font-medium">{new Date(sesion.inicio_sesion).toLocaleTimeString()}</span>
                      </div>
                      <div>
                        <span className="text-on-surface-variant text-xs block mb-0.5">Fin de Sesión</span>
                        <span className="text-on-surface font-medium">{sesion.fin_sesion ? new Date(sesion.fin_sesion).toLocaleTimeString() : '---'}</span>
                      </div>
                      
                      <div className="col-span-2 bg-surface-container-lowest rounded-xl p-3 border border-outline-variant/30 flex flex-col gap-2 mt-2">
                        <div className="flex items-center gap-2 text-on-surface-variant text-xs">
                          <span className="material-symbols-outlined text-[16px]">devices</span>
                          {sesion.dispositivo_modelo} ({sesion.sistema_operativo})
                        </div>
                        <div className="flex items-center gap-2 text-on-surface-variant text-xs">
                          <span className="material-symbols-outlined text-[16px]">location_on</span>
                          {sesion.ubicacion_texto} • {sesion.ip}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
