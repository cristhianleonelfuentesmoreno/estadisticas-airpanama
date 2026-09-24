// Logger interno de auditoría. NO lleva "use server": así no queda expuesto
// como Server Action y nadie puede insertar registros falsos desde fuera.
import { headers } from "next/headers";
import { UAParser } from "ua-parser-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SessionUser } from "@/lib/auth";


export type TipoEventoAuditoria =
  | 'acceso_fallido' | 'inicio_sesion' | 'cierre_sesion'
  | 'creacion' | 'edicion' | 'aprobacion' | 'eliminacion' | 'restauracion'
  | 'solicitud_eliminacion' | 'resolucion_solicitud'
  | 'importacion' | 'exportacion' | 'navegacion'
  | 'alerta_sistema';

export type AuditEntidad = 'vuelo' | 'usuario' | 'flota' | 'configuracion' | 'sesion' | 'reporte' | 'pagina';

interface AuditParams {
  tipo_evento: TipoEventoAuditoria;
  // Quién lo hizo. Si se pasa `actor` se guardan su id, nombre y rol.
  actor?: Pick<SessionUser, 'id' | 'nombre' | 'role'> | null;
  usuario_id?: string | null;
  nombre_referencia: string;   // sobre qué: "7P-971 · 22 sep 2026", el correo de un usuario…
  descripcion: string;
  entidad?: AuditEntidad;
  entidad_id?: string | null;
  detalles_extra?: object;
}

// Cambios campo por campo para la bitácora: { pasajeros: { antes: 62, despues: 72 } }
export function diffFields(before: Record<string, unknown> | null | undefined, after: Record<string, unknown>) {
  const cambios: Record<string, { antes: unknown; despues: unknown }> = {};
  for (const [key, value] of Object.entries(after)) {
    const prev = before?.[key] ?? null;
    if (value === undefined) continue;
    if (JSON.stringify(prev) !== JSON.stringify(value ?? null)) cambios[key] = { antes: prev, despues: value ?? null };
  }
  return cambios;
}

export async function logAudit({ tipo_evento, actor, usuario_id, nombre_referencia, descripcion, entidad, entidad_id, detalles_extra = {} }: AuditParams) {
  try {
    const supabaseAdmin = createAdminClient();
    const headersList = await headers();
    
    // Obtener IP
    let ip = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'IP desconocida';
    if (ip.includes(',')) {
      ip = ip.split(',')[0].trim();
    }

    // Obtener User-Agent
    const userAgentStr = headersList.get('user-agent') || '';
    const parser = new UAParser(userAgentStr);
    const result = parser.getResult();
    
    const dispositivoTipo = result.device.type || (result.os.name === 'iOS' || result.os.name === 'Android' ? 'Móvil' : 'PC');
    const dispositivoModelo = result.device.model || result.device.vendor || result.browser.name || 'Desconocido';
    const os = result.os.name || '';
    
    const dispositivo = `${dispositivoTipo} ${dispositivoModelo} ${os}`.trim();

    // Obtener ubicación (Aprovechar headers de Vercel si existen)
    const city = headersList.get('x-vercel-ip-city') || '';
    const country = headersList.get('x-vercel-ip-country') || '';
    const region = headersList.get('x-vercel-ip-country-region') || '';
    
    let ubicacion = 'Ubicación Desconocida';
    // Decodificar los headers de Vercel que vienen url-encoded
    if (city && country) {
      try { ubicacion = `${decodeURIComponent(city)} (${decodeURIComponent(region || country)})`; } catch {}
    }

    // Insertar en Supabase
    await supabaseAdmin.from('registros_auditoria').insert([{
      tipo_evento,
      usuario_id: actor?.id ?? usuario_id ?? null,
      actor_nombre: actor?.nombre ?? null,
      actor_rol: actor?.role ?? null,
      entidad: entidad ?? null,
      entidad_id: entidad_id ?? null,
      nombre_referencia: String(nombre_referencia ?? '').slice(0, 300),
      descripcion: String(descripcion ?? '').slice(0, 1000),
      detalles_extra,
      ip,
      ubicacion,
      dispositivo
    }]);

  } catch (error) {
    console.error("Error al registrar auditoría:", error);
    // No queremos que un fallo en el log rompa la app, así que lo atrapamos silenciosamente.
  }
}
