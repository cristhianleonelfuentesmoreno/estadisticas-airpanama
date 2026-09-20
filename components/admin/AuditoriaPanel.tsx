"use client";

import { useState, useEffect } from "react";
import { getAuditLogs, TipoEventoAuditoria } from "@/app/actions/audit";

interface AuditLog {
  id: string;
  tipo_evento: TipoEventoAuditoria;
  usuario_id: string | null;
  nombre_referencia: string;
  descripcion: string;
  detalles_extra: any;
  ip: string;
  ubicacion: string;
  dispositivo: string;
  creado_en: string;
}

type FilterType = 'todos' | 'accesos' | 'ediciones' | 'fallas';

export function AuditoriaPanel() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('todos');
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    const fetchLogs = async () => {
      const data = await getAuditLogs();
      setLogs(data as any);
      setLoading(false);
    };
    fetchLogs();
    
    // Auto refresh cada 30 segundos
    const interval = setInterval(fetchLogs, 30000);
    return () => clearInterval(interval);
  }, []);

  const filteredLogs = logs.filter(log => {
    if (filter === 'todos') return true;
    if (filter === 'accesos') return log.tipo_evento === 'inicio_sesion' || log.tipo_evento === 'cierre_sesion' || log.tipo_evento === 'acceso_fallido';
    if (filter === 'ediciones') return log.tipo_evento === 'edicion' || log.tipo_evento === 'eliminacion';
    if (filter === 'fallas') return log.tipo_evento === 'alerta_sistema';
    return true;
  });

  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
  const paginatedLogs = filteredLogs.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const getEventStyle = (tipo: TipoEventoAuditoria) => {
    switch(tipo) {
      case 'acceso_fallido':
        return { icon: 'warning', label: 'Intento Fallido de Acceso', color: 'bg-amber-100 text-amber-700', borderColor: 'border-amber-200' };
      case 'inicio_sesion':
        return { icon: 'lock_open', label: 'Inicio de Sesión Autorizado', color: 'bg-emerald-100 text-emerald-700', borderColor: 'border-emerald-200' };
      case 'cierre_sesion':
        return { icon: 'lock', label: 'Cierre de Sesión', color: 'bg-surface-variant text-on-surface-variant', borderColor: 'border-outline-variant' };
      case 'edicion':
        return { icon: 'edit_document', label: 'Edición', color: 'bg-blue-100 text-blue-700', borderColor: 'border-blue-200' };
      case 'eliminacion':
        return { icon: 'delete', label: 'Registro Eliminado', color: 'bg-red-100 text-red-700', borderColor: 'border-red-200' };
      case 'alerta_sistema':
        return { icon: 'error', label: 'Alerta de Caída / Reconexión', color: 'bg-error text-on-error', borderColor: 'border-error' };
      default:
        return { icon: 'info', label: 'Evento', color: 'bg-surface-variant text-on-surface', borderColor: 'border-outline-variant' };
    }
  };

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    const today = new Date();
    const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    const isYesterday = new Date(today.setDate(today.getDate() - 1)).getDate() === d.getDate();
    
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return time;
    if (isYesterday) return `Ayer ${time}`;
    return `${d.toLocaleDateString()} ${time}`;
  };

  return (
    <div className="flex flex-col w-full bg-surface-container-lowest rounded-3xl p-6 md:p-8 shadow-sm border border-outline-variant/30 relative overflow-hidden mt-8">
      {/* Decorative vertical line left */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/20"></div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-error">assignment_late</span>
            Registro de Auditoría & Fallas
          </h2>
          <p className="font-body-sm text-on-surface-variant mt-1">
            Traza forense inmutable de operaciones y eventos de acceso
          </p>
        </div>
        <div className="bg-surface-container-highest text-on-surface-variant px-3 py-1 rounded-full font-label-md font-bold text-sm">
          {logs.length} eventos
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-4 custom-scrollbar mb-4">
        {[
          { id: 'todos', label: `Todos (${logs.length})` },
          { id: 'accesos', label: `Accesos (${logs.filter(l => ['inicio_sesion', 'cierre_sesion', 'acceso_fallido'].includes(l.tipo_evento)).length})` },
          { id: 'ediciones', label: `Ediciones/Bajas (${logs.filter(l => ['edicion', 'eliminacion'].includes(l.tipo_evento)).length})` },
          { id: 'fallas', label: `Fallas (${logs.filter(l => l.tipo_evento === 'alerta_sistema').length})` }
        ].map(f => (
          <button
            key={f.id}
            onClick={() => { setFilter(f.id as FilterType); setPage(1); }}
            className={`whitespace-nowrap px-4 py-2 rounded-full font-label-md font-bold transition-colors ${
              filter === f.id 
                ? 'bg-on-surface text-surface-container-lowest' 
                : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-12 text-center text-on-surface-variant animate-pulse">
          Cargando registros forenses...
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="py-12 text-center text-on-surface-variant bg-surface-container rounded-2xl">
          No hay eventos registrados en esta categoría.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {paginatedLogs.map((log) => {
            const style = getEventStyle(log.tipo_evento);
            return (
              <div key={log.id} className={`bg-surface-container-lowest rounded-2xl p-4 shadow-sm border ${style.borderColor}`}>
                <div className="flex justify-between items-start mb-2">
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${style.color}`}>
                    <span className="material-symbols-outlined text-[14px]">{style.icon}</span>
                    {style.label}
                  </div>
                  <span className="font-label-sm font-bold text-on-surface-variant text-xs">
                    {formatDate(log.creado_en)}
                  </span>
                </div>
                
                <h4 className="font-label-lg font-bold mt-2 text-on-surface">
                  {log.tipo_evento === 'acceso_fallido' ? (
                    <>Usuario no reconocido: <span className="text-error">{log.nombre_referencia}</span></>
                  ) : (
                    log.nombre_referencia
                  )}
                </h4>
                
                <p className="font-body-sm text-sm text-on-surface-variant mt-1 leading-relaxed">
                  {log.descripcion}
                </p>

                <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-outline-variant/30">
                  <div className="flex items-center gap-4 text-xs font-medium text-on-surface-variant">
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px] text-error">location_on</span>
                      {log.ubicacion}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">devices</span>
                      {log.dispositivo}
                    </div>
                  </div>
                  <div className="text-xs font-bold font-mono text-on-surface opacity-60">
                    {log.tipo_evento === 'acceso_fallido' || log.tipo_evento === 'inicio_sesion' ? `IP ${log.ip}` : `Auditoría #${log.id.substring(0,8)}`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-outline-variant/30">
          <span className="font-label-sm text-xs text-on-surface-variant">
            Pág. <strong>{page} de {totalPages}</strong> ({filteredLogs.length} eventos)
          </span>
          <div className="flex gap-2">
            <button 
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="w-8 h-8 flex items-center justify-center bg-surface-container hover:bg-surface-container-high rounded disabled:opacity-30 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <button 
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              className="w-8 h-8 flex items-center justify-center bg-surface-container hover:bg-surface-container-high rounded disabled:opacity-30 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
