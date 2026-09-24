"use server";

import { requireApprovedUser, requireSupervisor } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit, type TipoEventoAuditoria } from "@/lib/audit";

// ---------------------------------------------------------------------------
// Eventos que ocurren en el navegador (navegar, exportar). Cada usuario solo puede
// registrar eventos a su propio nombre y de estos tipos: no permite falsear otros.
// ---------------------------------------------------------------------------
const PAGE_NAMES: Record<string, string> = {
  '/dashboard': 'Inicio',
  '/dashboard/diario': 'Registro Histórico',
  '/dashboard/mensual': 'Reportes',
  '/dashboard/admin': 'Panel de supervisión',
};

export type UserEvent =
  | { tipo: 'navegacion'; ruta: string }
  | { tipo: 'exportacion'; formato: 'excel' | 'pdf'; periodo: string; aerolinea: string; vuelos: number };

export async function logUserEvent(event: UserEvent) {
  const user = await requireApprovedUser().catch(() => null);
  if (!user || !event || typeof event !== 'object') return;

  if (event.tipo === 'navegacion') {
    const ruta = typeof event.ruta === 'string' ? event.ruta.split('?')[0].slice(0, 120) : '';
    if (!ruta.startsWith('/dashboard')) return;
    const pagina = PAGE_NAMES[ruta] ?? ruta;
    await logAudit({
      tipo_evento: 'navegacion',
      actor: user,
      entidad: 'pagina',
      entidad_id: ruta,
      nombre_referencia: pagina,
      descripcion: `Abrió ${pagina}`,
    });
    return;
  }

  if (event.tipo === 'exportacion') {
    const formato = event.formato === 'pdf' ? 'PDF' : 'Excel';
    const periodo = String(event.periodo ?? '').slice(0, 60);
    const aerolinea = String(event.aerolinea ?? '').slice(0, 60);
    const vuelos = Number.isFinite(event.vuelos) ? Math.max(0, Math.round(event.vuelos)) : 0;
    await logAudit({
      tipo_evento: 'exportacion',
      actor: user,
      entidad: 'reporte',
      nombre_referencia: `Reporte ${periodo} · ${aerolinea}`,
      descripcion: `Exportó el reporte en ${formato} (${vuelos} vuelos)`,
      detalles_extra: { formato, periodo, aerolinea, vuelos },
    });
  }
}

// ---------------------------------------------------------------------------
// Consulta de la bitácora (supervisores y administrador)
// ---------------------------------------------------------------------------
export type AuditCategoria = 'todos' | 'accesos' | 'vuelos' | 'solicitudes' | 'datos' | 'usuarios' | 'navegacion' | 'fallas';

const CATEGORIAS: Record<Exclude<AuditCategoria, 'todos'>, TipoEventoAuditoria[]> = {
  accesos: ['inicio_sesion', 'cierre_sesion', 'acceso_fallido'],
  vuelos: ['creacion', 'edicion', 'aprobacion', 'eliminacion', 'restauracion'],
  solicitudes: ['solicitud_eliminacion', 'resolucion_solicitud'],
  datos: ['importacion', 'exportacion'],
  usuarios: ['edicion', 'eliminacion'],
  navegacion: ['navegacion'],
  fallas: ['alerta_sistema'],
};

export type AuditFilters = {
  categoria?: AuditCategoria;
  usuarioId?: string;
  desde?: string;   // YYYY-MM-DD (hora de Panamá)
  hasta?: string;
  texto?: string;
  pagina?: number;
  incluirNavegacion?: boolean; // en "Todos": mostrar también cada página visitada (ver un turno completo)
};

export type AuditLog = {
  id: string;
  tipo_evento: TipoEventoAuditoria;
  usuario_id: string | null;
  actor_nombre: string | null;
  actor_rol: string | null;
  entidad: string | null;
  entidad_id: string | null;
  nombre_referencia: string;
  descripcion: string;
  detalles_extra: Record<string, unknown> | null;
  ip: string | null;
  ubicacion: string | null;
  dispositivo: string | null;
  creado_en: string;
};

const PAGE_SIZE = 30;
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

export async function getAuditLogs(filters: AuditFilters = {}) {
  await requireSupervisor();
  const supabase = createAdminClient();
  const page = Math.max(1, Math.floor(Number(filters.pagina) || 1));

  let query = supabase
    .from('registros_auditoria')
    .select('*', { count: 'exact' })
    .order('creado_en', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const categoria = filters.categoria ?? 'todos';
  if (categoria !== 'todos' && CATEGORIAS[categoria]) {
    query = query.in('tipo_evento', CATEGORIAS[categoria]);
    if (categoria === 'vuelos') query = query.eq('entidad', 'vuelo');
    // Los registros anteriores a esta versión no tienen entidad: eran cambios de usuarios y flota
    if (categoria === 'usuarios') query = query.or('entidad.in.(usuario,flota,configuracion),entidad.is.null');
  } else if (!filters.incluirNavegacion) {
    // "Todos" no incluye la navegación salvo que se pida (es mucho volumen)
    query = query.neq('tipo_evento', 'navegacion');
  }
  if (typeof filters.usuarioId === 'string' && /^[0-9a-f-]{36}$/i.test(filters.usuarioId)) query = query.eq('usuario_id', filters.usuarioId);
  // Días completos en hora de Panamá (UTC-5)
  if (isDate(filters.desde)) query = query.gte('creado_en', `${filters.desde}T00:00:00-05:00`);
  if (isDate(filters.hasta)) query = query.lte('creado_en', `${filters.hasta}T23:59:59.999-05:00`);
  const texto = typeof filters.texto === 'string' ? filters.texto.replace(/[%,()]/g, ' ').trim().slice(0, 60) : '';
  if (texto) query = query.or(`nombre_referencia.ilike.%${texto}%,descripcion.ilike.%${texto}%,actor_nombre.ilike.%${texto}%`);

  const { data, error, count } = await query;
  if (error) {
    console.error("Error obteniendo logs de auditoría:", error);
    return { logs: [] as AuditLog[], total: 0, pageSize: PAGE_SIZE };
  }
  return { logs: (data ?? []) as AuditLog[], total: count ?? 0, pageSize: PAGE_SIZE };
}

// Personas para el filtro de la bitácora
export async function getAuditPeople() {
  await requireSupervisor();
  const { data } = await createAdminClient().from('perfiles').select('id, nombre, email, role').order('nombre');
  return (data ?? []).map(p => ({ id: p.id as string, nombre: (p.nombre || p.email) as string, role: p.role as string }));
}
